/*
 * VISUAL CLASSICO — copia do painel como ele era antes da repaginacao.
 *
 * Fica no ar em /painel/classico/... para o caso de a equipe nao se adaptar
 * ao visual novo. Nao evolua este arquivo: quando o visual novo for aceito,
 * apague a pasta classico/ e as duas rotas correspondentes (veja README.md).
 */
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Subscription, firstValueFrom } from 'rxjs';

import { PainelEventosService } from '../painel-eventos.service';
import { ChamadoPainel, RequisicaoTotais, TOTAIS_ZERADOS } from '../painel.models';
import { PainelService } from '../painel.service';

@Component({
  selector: 'app-painel-requisicao-classico',
  standalone: true,
  templateUrl: './painel-requisicao-classico.html',
  styleUrl: './painel-requisicao-classico.scss',
})
export class PainelRequisicaoClassico implements OnInit, OnDestroy {
  private readonly painelService = inject(PainelService);
  private readonly eventos = inject(PainelEventosService);

  readonly totais = signal<RequisicaoTotais>({ ...TOTAIS_ZERADOS });
  readonly itens = signal<ChamadoPainel[]>([]);

  /** Coluna da esquerda: aguardando análise, ignorando o que já está com técnico. */
  readonly emAnalise = computed(() =>
    this.itens().filter(i => i.status === 'AGUARDANDO_ANALISE' && i.snTecnico === 'N')
  );

  /** Pausados entram logo abaixo dos que aguardam análise. */
  readonly pausados = computed(() => this.itens().filter(i => i.status === 'PAUSADO'));

  /** Coluna da direita: prontos para execução, com os reprovados em destaque. */
  readonly paraExecucao = computed(() =>
    this.itens().filter(i => i.status === 'AGUARDANDO_EXECUCAO' || i.status === 'REPROVADO')
  );

  private assinaturas = new Subscription();
  private carregando = false;

  ngOnInit(): void {
    void this.carregar();
    this.assinaturas.add(this.eventos.atualizacoes().subscribe(() => void this.carregar()));
  }

  ngOnDestroy(): void {
    this.assinaturas.unsubscribe();
  }

  private async carregar(): Promise<void> {
    if (this.carregando) return;
    this.carregando = true;

    try {
      const resposta = await firstValueFrom(this.painelService.requisicoes());

      if (!resposta || resposta.type === 'error') {
        this.totais.set({ ...TOTAIS_ZERADOS });
        this.itens.set([]);
        return;
      }

      this.totais.set({
        total: resposta.total ?? 0,
        totalSolicitado: resposta.totalSolicitado ?? 0,
        totalAprovacaoGestor: resposta.totalAprovacaoGestor ?? 0,
        totalAnaliseRequisitos: resposta.totalAnaliseRequisitos ?? 0,
        totalEmAnalise: resposta.totalEmAnalise ?? 0,
        totalPausado: resposta.totalPausado ?? 0,
        totalValidacao: resposta.totalValidacao ?? 0,
        totalReprovado: resposta.totalReprovado ?? 0,
        totalAguardandoExecucao: resposta.totalAguardandoExecucao ?? 0,
        totalEmExecucao: resposta.totalEmExecucao ?? 0,
      });

      this.itens.set(resposta.item ?? []);
    } catch (erro) {
      console.error('Painel: falha ao carregar requisições', erro);
    } finally {
      this.carregando = false;
    }
  }

  classeAnalise(chamado: ChamadoPainel): string {
    return chamado.snPendente === 'S' ? 'chamado chamado--pendente' : 'chamado chamado--normal';
  }

  classeExecucao(chamado: ChamadoPainel): string {
    if (chamado.status === 'REPROVADO') return 'chamado chamado--reprovado';
    return chamado.snPendente === 'S' ? 'chamado chamado--pendente' : 'chamado chamado--normal';
  }

  titulo(chamado: ChamadoPainel): string {
    return (chamado.titulo ?? '').toUpperCase();
  }
}
