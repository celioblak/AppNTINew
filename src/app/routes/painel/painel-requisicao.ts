import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Subscription, firstValueFrom } from 'rxjs';

import { ChamadoCard, TomChamado } from './chamado-card';
import { PainelEventosService } from './painel-eventos.service';
import { ChamadoPainel, RequisicaoTotais, TOTAIS_ZERADOS } from './painel.models';
import { RodizioPaginas } from './painel-rodizio';
import { PainelService } from './painel.service';

/** Cards por página em cada coluna; também é o que define a altura do card. */
const POR_PAGINA = 8;

interface Contador {
  rotulo: string;
  valor: number;
  /** Sufixo da classe CSS: dá a cor própria da situação, para identificar o card. */
  situacao: string;
  /** Situação que depende de alguém agir; ganha fundo tingido além da cor. */
  acao?: boolean;
}

/** Cor e significado de cada faixa dos cards, explicados na legenda da tela. */
interface ItemLegenda {
  cor: string;
  texto: string;
}

@Component({
  selector: 'app-painel-requisicao',
  standalone: true,
  imports: [ChamadoCard],
  templateUrl: './painel-requisicao.html',
  styleUrl: './painel-requisicao.scss',
})
export class PainelRequisicao implements OnInit, OnDestroy {
  private readonly painelService = inject(PainelService);
  private readonly eventos = inject(PainelEventosService);

  readonly totais = signal<RequisicaoTotais>({ ...TOTAIS_ZERADOS });
  readonly itens = signal<ChamadoPainel[]>([]);

  /** Coluna da esquerda: aguardando análise (sem técnico) e, em seguida, os pausados. */
  readonly analise = computed(() => [
    ...this.itens().filter(i => i.status === 'AGUARDANDO_ANALISE' && i.snTecnico === 'N'),
    ...this.itens().filter(i => i.status === 'PAUSADO'),
  ]);

  /** Coluna da direita: prontos para execução, com os reprovados na frente. */
  readonly execucao = computed(() => [
    ...this.itens().filter(i => i.status === 'REPROVADO'),
    ...this.itens().filter(i => i.status === 'AGUARDANDO_EXECUCAO'),
  ]);

  readonly paginasAnalise = computed(() => this.paginas(this.analise().length));
  readonly paginasExecucao = computed(() => this.paginas(this.execucao().length));

  /**
   * Cada coluna vira no seu ritmo, com a primeira página (os mais antigos, que
   * a API já manda na frente) mais tempo na tela.
   */
  private readonly rodizioAnalise = new RodizioPaginas(() => this.paginasAnalise());
  private readonly rodizioExecucao = new RodizioPaginas(() => this.paginasExecucao());
  readonly paginaAnalise = this.rodizioAnalise.pagina;
  readonly paginaExecucao = this.rodizioExecucao.pagina;

  readonly analiseVisivel = computed(() => this.fatia(this.analise(), this.paginaAnalise()));
  readonly execucaoVisivel = computed(() => this.fatia(this.execucao(), this.paginaExecucao()));

  /**
   * Faixa de contadores. Cada situação tem a sua cor, senão os cards viram dez
   * retângulos iguais e ninguém sabe qual é qual. As cores são discretas e só as
   * situações que dependem de alguém agir ganham fundo tingido por cima — assim
   * dá para identificar todos sem voltar ao arco-íris de antes.
   */
  readonly contadores = computed<Contador[]>(() => {
    const t = this.totais();
    return [
      { rotulo: 'Solicitado', valor: t.totalSolicitado, situacao: 'solicitado' },
      { rotulo: 'Aprovação gestor', valor: t.totalAprovacaoGestor, situacao: 'gestor', acao: true },
      { rotulo: 'Requisitos', valor: t.totalAnaliseRequisitos, situacao: 'requisitos', acao: true },
      { rotulo: 'Em análise', valor: t.totalEmAnalise, situacao: 'analise' },
      { rotulo: 'Pausado', valor: t.totalPausado, situacao: 'pausado', acao: true },
      { rotulo: 'Validação', valor: t.totalValidacao, situacao: 'validacao' },
      { rotulo: 'Reprovado', valor: t.totalReprovado, situacao: 'reprovado', acao: true },
      { rotulo: 'Para execução', valor: t.totalAguardandoExecucao, situacao: 'para-execucao' },
      { rotulo: 'Em execução', valor: t.totalEmExecucao, situacao: 'em-execucao' },
      { rotulo: 'Total', valor: t.total, situacao: 'total' },
    ];
  });

  /**
   * Sem isto, a cor da faixa do card não quer dizer nada para quem só olha a TV.
   *
   * O azul é o caso normal da coluna — o que o chamado espera já está no título
   * dela (análise ou execução), então a faixa só diz que nada trava esse item.
   */
  readonly legenda: ItemLegenda[] = [
    { cor: 'requisicao', texto: 'Sem pendência' },
    { cor: 'pendente', texto: 'Pendente' },
    { cor: 'pausado', texto: 'Pausado' },
    { cor: 'reprovado', texto: 'Reprovado' },
  ];

  /** Linhas fixas da grade: o card mantém o tamanho padrão mesmo com a página vazia. */
  readonly porPagina = POR_PAGINA;

  /** Bolinhas do indicador de página. */
  readonly indicesAnalise = computed(() =>
    Array.from({ length: this.paginasAnalise() }, (_, i) => i)
  );

  readonly indicesExecucao = computed(() =>
    Array.from({ length: this.paginasExecucao() }, (_, i) => i)
  );

  private assinaturas = new Subscription();
  private carregando = false;

  ngOnInit(): void {
    void this.carregar();
    this.assinaturas.add(this.eventos.atualizacoes().subscribe(() => void this.carregar()));
    this.rodizioAnalise.iniciar();
    this.rodizioExecucao.iniciar();
  }

  ngOnDestroy(): void {
    this.assinaturas.unsubscribe();
    this.rodizioAnalise.parar();
    this.rodizioExecucao.parar();
  }

  private paginas(total: number): number {
    return Math.max(1, Math.ceil(total / POR_PAGINA));
  }

  private fatia(lista: ChamadoPainel[], pagina: number): ChamadoPainel[] {
    const inicio = pagina * POR_PAGINA;
    return lista.slice(inicio, inicio + POR_PAGINA);
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

      this.rodizioAnalise.ajustar();
      this.rodizioExecucao.ajustar();

      this.eventos.registrarCarga();
    } catch (erro) {
      // Mantém o último dado bom na tela; o indicador de idade acusa a parada.
      console.error('Painel: falha ao carregar requisições', erro);
    } finally {
      this.carregando = false;
    }
  }

  /**
   * Faixa do card, na ordem em que a situação importa: reprovado, pausado,
   * pendente e, por último, o caso normal (azul) — nem reprovado, nem pausado,
   * nem pendente. As colunas só trazem AGUARDANDO_ANALISE, PAUSADO,
   * AGUARDANDO_EXECUCAO e REPROVADO, então o azul aqui é sempre um chamado
   * parado na fila da coluna, sem nada que o segure.
   */
  tomDoChamado(chamado: ChamadoPainel): TomChamado {
    if (chamado.status === 'REPROVADO') return 'reprovado';
    if (chamado.status === 'PAUSADO') return 'pausado';
    return chamado.snPendente === 'S' ? 'pendente' : 'requisicao';
  }
}
