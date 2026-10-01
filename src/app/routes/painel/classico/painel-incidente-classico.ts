/*
 * VISUAL CLASSICO — copia do painel como ele era antes da repaginacao.
 *
 * Fica no ar em /painel/classico/... para o caso de a equipe nao se adaptar
 * ao visual novo. Nao evolua este arquivo: quando o visual novo for aceito,
 * apague a pasta classico/ e as duas rotas correspondentes (veja README.md).
 */
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Subscription, firstValueFrom, timer } from 'rxjs';

import { ServidorDto } from '@core';
import { PainelEventosService } from '../painel-eventos.service';
import { ChamadoPainel, SessaoLockPainel } from '../painel.models';
import { PainelService } from '../painel.service';

/** Load por núcleo em que a máquina passa da capacidade (mesmo limite do alerta do backend). */
const LOAD_POR_CPU_ALTO = 1.0;

/** Load por núcleo com fila de espera sustentada: a barra chega a 100% aqui. */
const LOAD_POR_CPU_CRITICO = 2.0;

/** Acima disso sobra menos de 20% de disco: mesmo ponto em que o backend gera ALERTA. */
const DISCO_ALERTA = 80;

/** Acima disso sobra menos de 10%: mesmo ponto em que o backend gera ERRO. */
const DISCO_CRITICO = 90;

/** Lock só aparece na TV depois de alguns minutos parado. */
const LOCK_MINUTOS_MINIMO = 3;

/** Acima disso o painel avisa que há lock antigo. */
const LOCK_MINUTOS_CRITICO = 10;

/** Chamados demais para caber inteiro: divide a tela com o monitoramento. */
const CHAMADOS_PARA_DIVIDIR_TELA = 7;

/** Situação de um indicador do servidor; vale para a cor da barra e para a lista. */
type NivelIndicador = 'ok' | 'alerta' | 'critico';

@Component({
  selector: 'app-painel-incidente-classico',
  standalone: true,
  templateUrl: './painel-incidente-classico.html',
  styleUrl: './painel-incidente-classico.scss',
})
export class PainelIncidenteClassico implements OnInit, OnDestroy {
  private readonly painelService = inject(PainelService);
  private readonly eventos = inject(PainelEventosService);

  readonly chamados = signal<ChamadoPainel[]>([]);
  readonly servidores = signal<ServidorDto[]>([]);
  readonly locks = signal<SessaoLockPainel[]>([]);
  readonly lockMaisLongo = signal(0);

  readonly incidentes = computed(() => this.chamados().filter(c => c.tipo === 'INCIDENTE'));
  readonly requisicoes = computed(() => this.chamados().filter(c => c.tipo !== 'INCIDENTE'));
  readonly qtdChamados = computed(() => this.chamados().length);
  readonly totalLocks = computed(() => this.locks().length);

  readonly temMonitoramento = computed(() => this.servidores().length > 0 || this.totalLocks() > 0);
  readonly telaDividida = computed(
    () => this.temMonitoramento() && this.qtdChamados() > CHAMADOS_PARA_DIVIDIR_TELA
  );
  readonly locksAntigos = computed(() => this.lockMaisLongo() >= LOCK_MINUTOS_CRITICO);

  private assinaturas = new Subscription();
  private carregandoChamados = false;
  private carregandoServidores = false;
  private carregandoLocks = false;

  ngOnInit(): void {
    this.atualizar();
    this.assinaturas.add(timer(2000, 2000).subscribe(() => this.atualizar()));
    this.assinaturas.add(this.eventos.atualizacoes().subscribe(() => this.atualizar()));
  }

  ngOnDestroy(): void {
    this.assinaturas.unsubscribe();
  }

  private atualizar(): void {
    void this.carregarChamados();
    void this.carregarServidores();
    void this.carregarLocks();
  }

  // ───────────────────────── chamados ─────────────────────────

  private async carregarChamados(): Promise<void> {
    // O ciclo é de 2s e as consultas podem demorar mais que isso: sem esta trava
    // duas cargas terminam fora de ordem e a lista pisca com itens repetidos.
    if (this.carregandoChamados) return;
    this.carregandoChamados = true;

    try {
      const incidentes = await firstValueFrom(this.painelService.incidentes());
      let itens = incidentes?.item ?? [];

      // Com poucos incidentes sobra espaço na TV, então completa com as requisições do dia.
      if ((incidentes?.total ?? 0) < 5) {
        const doDia = await firstValueFrom(this.painelService.requisicoesDoDia());
        itens = this.juntarSemRepetir(itens, doDia?.item ?? []);
      }

      this.chamados.set(itens);
    } catch (erro) {
      // Mantém o último dado bom: lista vazia na falha viraria um "tudo certo" falso.
      console.error('Painel: falha ao carregar chamados', erro);
    } finally {
      this.carregandoChamados = false;
    }
  }

  /**
   * Junta as duas listas por idChamado.
   *
   * /api/painel/incidentes devolve "INCIDENTE sem técnico OU chamado novo
   * (SN_STATUS_NOVO = 'S')", e esse segundo caso inclui requisições abertas hoje —
   * exatamente as que /api/painel/requisicao/hoje traz. Concatenar as duas listas
   * fazia a requisição do dia aparecer duas vezes na TV.
   */
  private juntarSemRepetir(...listas: ChamadoPainel[][]): ChamadoPainel[] {
    const porId = new Map<string, ChamadoPainel>();

    for (const lista of listas) {
      for (const chamado of lista) {
        const id = String(chamado?.idChamado ?? '').trim();
        if (!id || porId.has(id)) continue;
        porId.set(id, chamado);
      }
    }

    return [...porId.values()];
  }

  classeChamado(chamado: ChamadoPainel): string {
    const pendente = chamado.snPendente === 'S';
    if (chamado.tipo === 'INCIDENTE') {
      return pendente ? 'chamado chamado--incidente-pendente' : 'chamado chamado--incidente';
    }
    return pendente ? 'chamado chamado--requisicao-pendente' : 'chamado chamado--requisicao';
  }

  titulo(chamado: ChamadoPainel): string {
    return (chamado.titulo ?? '').toUpperCase();
  }

  // ───────────────────────── servidores ─────────────────────────

  private async carregarServidores(): Promise<void> {
    if (this.carregandoServidores) return;
    this.carregandoServidores = true;

    try {
      const dados = await firstValueFrom(this.painelService.servidores());
      const lista = Array.isArray(dados) ? dados : [];

      // A consulta já vem ordenada pelos piores; a TV mostra no máximo 10 linhas.
      this.servidores.set(
        lista
          .filter(s => !!s)
          .filter(s => this.emAtencao(s))
          .slice(0, 10)
      );
    } catch (erro) {
      console.error('Painel: falha ao carregar servidores', erro);
    } finally {
      this.carregandoServidores = false;
    }
  }

  /**
   * Load de 5 min já dividido pelos núcleos, calculado no backend (LOADPORCPU).
   * null quando o load ainda não foi coletado ou o nº de CPUs é desconhecido —
   * nesse caso não dá para dizer se está alto, e a tela mostra só o texto do uptime.
   */
  loadPorCpu(servidor: ServidorDto | undefined): number | null {
    const valor = servidor?.loadporcpu;
    return typeof valor === 'number' && isFinite(valor) ? valor : null;
  }

  /** Barra cheia quando o load por núcleo chega no crítico (2 processos por núcleo na fila). */
  usoCpuToNumero(servidor: ServidorDto | undefined): number {
    const porCpu = this.loadPorCpu(servidor);
    if (porCpu === null) return 0;
    return Math.min(Math.round((porCpu / LOAD_POR_CPU_CRITICO) * 100), 100);
  }

  usoCpuCor(servidor: ServidorDto | undefined): string {
    return `barra--${this.nivelLoad(servidor)}`;
  }

  /** Texto da barra: "0,85 por núcleo (4 CPUs)". Sem os núcleos, mostra o load cru do uptime. */
  usoCpuTexto(servidor: ServidorDto | undefined): string {
    const porCpu = this.loadPorCpu(servidor);
    if (porCpu === null) return servidor?.cpuload ?? '—';

    const cpus = servidor?.qtcpu;
    const valor = porCpu.toFixed(2).replace('.', ',');
    return cpus ? `${valor} por núcleo (${cpus} CPU${cpus > 1 ? 's' : ''})` : `${valor} por núcleo`;
  }

  /** Detalhe do tooltip: as três médias do uptime, como vieram do servidor. */
  loadDetalhe(servidor: ServidorDto | undefined): string {
    if (!servidor?.cpuload) return '';
    const cpus = servidor?.qtcpu ? ` em ${servidor.qtcpu} CPU(s)` : '';
    return `Load 1/5/15 min: ${servidor.cpuload}${cpus}`;
  }

  /**
   * Situação do load: o mesmo corte usado no alerta do backend, sempre por núcleo.
   * Sem o nº de CPUs não dá para julgar, então fica em 'ok' e a tela mostra o load cru.
   */
  nivelLoad(servidor: ServidorDto | undefined): NivelIndicador {
    const porCpu = this.loadPorCpu(servidor);
    if (porCpu === null) return 'ok';
    if (porCpu >= LOAD_POR_CPU_CRITICO) return 'critico';
    if (porCpu >= LOAD_POR_CPU_ALTO) return 'alerta';
    return 'ok';
  }

  /** Situação do disco, nos mesmos cortes do alerta do backend (20% e 10% livres). */
  nivelDisco(usoTexto: string | undefined): NivelIndicador {
    const uso = this.usoDiscoToNumero(usoTexto);
    if (uso > DISCO_CRITICO) return 'critico';
    if (uso > DISCO_ALERTA) return 'alerta';
    return 'ok';
  }

  /**
   * Servidor só entra na lista de atenção se algum indicador saiu do verde.
   *
   * Antes a lista usava um corte próprio (disco acima de 60%) enquanto a barra
   * só saía do verde em 80%, então apareciam servidores "em atenção" com load e
   * disco bons. Lista e cor agora leem a mesma regra.
   */
  emAtencao(servidor: ServidorDto | undefined): boolean {
    return this.nivelLoad(servidor) !== 'ok' || this.nivelDisco(servidor?.usodisco) !== 'ok';
  }

  usoDiscoToNumero(usoTexto: string | undefined): number {
    if (!usoTexto) return 0;
    return parseInt(usoTexto.replace('%', ''), 10) || 0;
  }

  usoDiscoCor(usoTexto: string | undefined): string {
    return `barra--${this.nivelDisco(usoTexto)}`;
  }

  // ───────────────────────── locks ─────────────────────────

  private async carregarLocks(): Promise<void> {
    if (this.carregandoLocks) return;
    this.carregandoLocks = true;

    try {
      const resposta = await firstValueFrom(this.painelService.locks());
      const agora = new Date();
      const emLock: SessaoLockPainel[] = [];
      let maior = 0;

      for (const sessao of resposta?.item ?? []) {
        if (!sessao?.last_status_date) continue;

        const minutos = this.minutosDesde(agora, new Date(sessao.last_status_date));
        sessao.tempoLock = minutos;

        if (minutos >= LOCK_MINUTOS_MINIMO) emLock.push(sessao);
        if (minutos > maior) maior = minutos;
      }

      this.locks.set(emLock);
      this.lockMaisLongo.set(maior);
    } catch (erro) {
      console.error('Painel: falha ao carregar locks', erro);
    } finally {
      this.carregandoLocks = false;
    }
  }

  private minutosDesde(agora: Date, inicio: Date): number {
    return Math.trunc((agora.getTime() - inicio.getTime()) / 1000 / 60);
  }

  classeLock(sessao: SessaoLockPainel | undefined): string {
    const tempo = sessao?.tempoLock ?? 0;
    if (!tempo) return '';
    return tempo <= 5 ? 'lock--alerta' : 'lock--critico';
  }

  tempoLock(sessao: SessaoLockPainel | undefined): number {
    return sessao?.tempoLock ?? 0;
  }
}
