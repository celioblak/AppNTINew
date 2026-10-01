import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Subscription, filter, interval } from 'rxjs';

import { Alerta } from '@core';
import { PainelEventosService } from './painel-eventos.service';
import { PainelPreferenciasService } from './painel-preferencias.service';
import { PainelSseService } from './painel-sse.service';
import { PainelTtsService } from './painel-tts.service';

interface AvisoPainel {
  id: number;
  severidade: 'info' | 'alerta' | 'erro';
  titulo: string;
  mensagem: string;
}

/** Quantas quedas seguidas antes de acusar a perda de conexão na tela. */
const TOLERANCIA_OFFLINE = 4;

/** Dado mais velho que isso e a tela avisa: a primeira dúvida de quem olha é se ainda atualiza. */
const SEGUNDOS_PARA_DADO_VELHO = 30;

const DURACAO_AVISO: Record<AvisoPainel['severidade'], number> = {
  info: 6000,
  alerta: 10000,
  erro: 15000,
};

/**
 * Moldura dos painéis de TV: alertas em tempo real (SSE), aviso falado, relógio,
 * idade do dado e pedido de atualização periódico. As telas entram pelo outlet.
 *
 * Rota pública, sem guard: a TV não tem sessão.
 */
@Component({
  selector: 'app-painel-layout',
  standalone: true,
  imports: [RouterOutlet, DatePipe],
  templateUrl: './painel-layout.html',
  styleUrl: './painel-layout.scss',
})
export class PainelLayout implements OnInit, OnDestroy {
  private readonly sse = inject(PainelSseService);
  private readonly tts = inject(PainelTtsService);
  private readonly eventos = inject(PainelEventosService);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);
  private readonly preferencias = inject(PainelPreferenciasService);

  readonly efeito = this.preferencias.efeito;

  readonly avisos = signal<AvisoPainel[]>([]);
  readonly statusExecucao = signal('');
  readonly agora = signal(new Date());
  readonly titulo = signal('Painel NTI');
  readonly visual = signal<'moderno' | 'classico'>('moderno');

  readonly estadoConexao = this.sse.estado;
  readonly ultimaCarga = this.eventos.ultimaCarga;

  /** Segundos desde a última carga concluída; -1 enquanto nada carregou. */
  readonly idadeDados = computed(() => {
    const carga = this.ultimaCarga();
    if (!carga) return -1;
    return Math.max(0, Math.round((this.agora().getTime() - carga.getTime()) / 1000));
  });

  readonly dadosVelhos = computed(() => this.idadeDados() > SEGUNDOS_PARA_DADO_VELHO);

  /**
   * Conexão de alertas perdida. Vira uma tarja no topo, não um modal: os dados
   * continuam chegando por HTTP e cobrir a tela esconderia justamente o que ainda
   * funciona.
   */
  readonly semAlertas = computed(
    () => this.estadoConexao() !== 'CONECTADO' && this.sse.quedas() >= TOLERANCIA_OFFLINE
  );

  private sequencialAviso = 0;
  private assinaturas = new Subscription();
  private temporizadores: ReturnType<typeof setTimeout>[] = [];

  ngOnInit(): void {
    void this.tts.carregarConfiguracao();
    this.lerRota();

    this.assinaturas.add(this.sse.alertas().subscribe(alerta => this.tratarAlerta(alerta)));

    this.assinaturas.add(
      this.router.events
        .pipe(filter(evento => evento instanceof NavigationEnd))
        .subscribe(() => this.lerRota())
    );

    // Relógio e idade do dado.
    this.assinaturas.add(interval(1000).subscribe(() => this.agora.set(new Date())));

    // Atualização de fundo, como no painel antigo: uma vez por minuto.
    this.assinaturas.add(
      interval(60000).subscribe(() => {
        this.eventos.solicitarAtualizacao();
        this.marcarCargaNoClassico();
      })
    );

    this.marcarCargaNoClassico();

    this.sse.conectar();
  }

  ngOnDestroy(): void {
    this.assinaturas.unsubscribe();
    this.temporizadores.forEach(t => clearTimeout(t));
    this.temporizadores = [];
    this.sse.desconectar();
  }

  /**
   * As telas do visual novo avisam cada carga concluída; as telas clássicas, que
   * ficaram congeladas, não avisam. Para o rodapé clássico continuar mostrando o
   * horário como antes, o próprio layout marca o momento do refresh.
   */
  private marcarCargaNoClassico(): void {
    if (this.visual() === 'classico') this.eventos.registrarCarga();
  }

  /** Título e visual vêm do `data` da rota filha ativa. */
  private lerRota(): void {
    let rota = this.rota.firstChild;
    while (rota?.firstChild) rota = rota.firstChild;

    const dados = rota?.snapshot.data ?? {};
    this.titulo.set(dados['titulo'] ?? 'Painel NTI');
    this.visual.set(dados['visual'] === 'classico' ? 'classico' : 'moderno');

    // O efeito vem da URL da TV (?efeito=flip|fade|nenhum).
    this.preferencias.lerDaUrl(rota?.snapshot.queryParamMap.get('efeito'));
  }

  private tratarAlerta(alerta: Alerta): void {
    switch (alerta.tipo) {
      case 'INFO':
        // "Novo Chamado" já aparece na lista de chamados; na TV viraria ruído.
        if (!alerta.titulo?.includes('Novo Chamado')) {
          this.adicionarAviso('info', alerta);
        }
        break;
      case 'ALERTA':
        this.adicionarAviso('alerta', alerta);
        break;
      case 'ERRO':
        this.adicionarAviso('erro', alerta);
        break;
      case 'LOG':
        this.statusExecucao.set(alerta.msg ?? '');
        break;
      case 'PNUPD':
        this.eventos.solicitarAtualizacao();
        break;
      default:
        break;
    }

    if (alerta.tts) {
      this.tts.falar(alerta.tts);
    }
  }

  private adicionarAviso(severidade: AvisoPainel['severidade'], alerta: Alerta): void {
    const aviso: AvisoPainel = {
      id: ++this.sequencialAviso,
      severidade,
      titulo: alerta.titulo ?? '',
      mensagem: alerta.msg ?? '',
    };

    this.avisos.update(lista => [...lista, aviso]);

    const timer = setTimeout(() => {
      this.avisos.update(lista => lista.filter(a => a.id !== aviso.id));
      this.temporizadores = this.temporizadores.filter(t => t !== timer);
    }, DURACAO_AVISO[severidade]);

    this.temporizadores.push(timer);
  }
}
