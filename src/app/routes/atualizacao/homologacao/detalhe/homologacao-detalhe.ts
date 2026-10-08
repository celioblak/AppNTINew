import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MtxSelectModule } from '@ng-matero/extensions/select';
import { ActivatedRoute, Router } from '@angular/router';
import { HotToastService } from '@ngxpert/hot-toast';
import { Observable, Subject, debounceTime, distinctUntilChanged, filter, finalize, interval, map, switchMap, tap } from 'rxjs';

import { normalizarTexto } from '../../atualizacao.models';
import { MotivoDialogComponent, MotivoDialogData } from '../../compartilhado/motivo-dialog';
import { EtiquetaComponent } from '../../compartilhado/situacao-chip';
import { ConfirmDialogComponent, ConfirmDialogData } from '@shared/components/confirm-dialog/confirm-dialog.component';
import {
  AgrupamentoDialogComponent,
  AgrupamentoDialogData,
  AgrupamentoDialogResultado,
  AtribuirDialogComponent,
  AtribuirDialogData,
  CancelarDialogComponent,
  CancelarDialogData,
  DivergenciaDialogComponent,
  DivergenciaDialogData,
  DivergenciaDialogResultado,
  EditarItemDialogComponent,
  EditarItemDialogData,
  EntregaDialogComponent,
  EntregaDialogData,
  EntregaDialogResultado,
  IniciarDialogComponent,
  IniciarDialogData,
  ItemDialogComponent,
  ItemDialogData,
  MoverItensDialogComponent,
  MoverItensDialogData,
  PrevisaoDialogComponent,
  PrevisaoDialogData,
  PrevisaoDialogResultado,
  RemoverReservasDialogComponent,
  RemoverReservasDialogData,
  RemoverReservasResultado,
  TrocarAgrupamentoDialogComponent,
  TrocarAgrupamentoDialogData,
  TrocarAgrupamentoResultado,
} from '../compartilhado/acoes-dialogs';
import { BarraHomologacaoComponent } from '../compartilhado/barra-homologacao';
import { HistoricoDialogComponent, HistoricoDialogData } from '../compartilhado/historico-dialog';
import { ResultadoDialogComponent, ResultadoDialogData } from '../compartilhado/resultado-dialog';
import {
  AgrupamentoHom,
  CancelarRequest,
  DivergenciaHom,
  ESTADO_ITEM,
  EditarItemRequest,
  HomologacaoDetalhe,
  ItemHom,
  ItemRequest,
  ModuloProgresso,
  PARECER_INFO,
  ParticipanteHom,
  RESULTADO_INFO,
  ROTA_BASE,
  SITUACAO_HOM,
  Trilha,
  UsuarioHom,
  concluido,
  dataCurta,
  estadoItem,
  porModulo,
} from '../homologacao.models';
import { HomologacaoService } from '../homologacao.service';
import { EventoTempoReal, HomologacaoTempoRealService } from '../homologacao-tempo-real.service';
import { AcompanhamentoComponent } from './acompanhamento';

type Filtro = 'TODOS' | 'MEUS' | 'LIVRES' | 'PENDENTES' | 'APROVADOS' | 'REPROVADOS' | 'IMPEDITIVOS' | 'SEM_TICKET' | 'BLOQUEADOS' | 'RETESTE' | 'DIVERGENTES' | 'CRITICOS' | 'FORA';

const FILTROS: { chave: Filtro; rotulo: string }[] = [
  { chave: 'TODOS', rotulo: 'Todos' },
  { chave: 'MEUS', rotulo: 'Meus' },
  { chave: 'LIVRES', rotulo: 'Livres' },
  { chave: 'PENDENTES', rotulo: 'Pendentes' },
  { chave: 'APROVADOS', rotulo: 'Aprovados' },
  { chave: 'REPROVADOS', rotulo: 'Reprovados' },
  { chave: 'IMPEDITIVOS', rotulo: 'Impeditivos' },
  { chave: 'SEM_TICKET', rotulo: 'Reprovados sem ticket' },
  { chave: 'BLOQUEADOS', rotulo: 'Bloqueados' },
  { chave: 'RETESTE', rotulo: 'Reteste' },
  { chave: 'DIVERGENTES', rotulo: 'Divergentes' },
  { chave: 'CRITICOS', rotulo: 'Críticos' },
];

/** Recarga periódica de segurança, só enquanto o tempo real (SSE) estiver fora do ar. */
const INTERVALO_MS = 30_000;

/** Mudanças que chegam juntas (ex.: reserva de um agrupamento inteiro) viram uma recarga só. */
const RAJADA_MS = 400;

/** Homologação — roteiro e execução (T-03), acompanhamento (T-04) e linha do tempo. Rota oculta homologacoes-detalhe?id=. */
@Component({
  selector: 'app-homologacao-detalhe',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTabsModule,
    MatTooltipModule,
    MtxSelectModule,
    EtiquetaComponent,
    BarraHomologacaoComponent,
    AcompanhamentoComponent,
  ],
  templateUrl: './homologacao-detalhe.html',
  styleUrls: ['../../compartilhado/atualizacao-pagina.scss', './homologacao-detalhe.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomologacaoDetalheComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(HomologacaoService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(HotToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly tempoReal = inject(HomologacaoTempoRealService);
  private readonly mudancas = new Subject<void>();
  private estavaDesconectado = false;

  readonly situacaoInfo = SITUACAO_HOM;
  readonly parecerInfo = PARECER_INFO;
  readonly resultadoInfo = RESULTADO_INFO;
  readonly estadoInfo = ESTADO_ITEM;
  readonly filtros = FILTROS;
  readonly data = dataCurta;

  readonly detalhe = signal<HomologacaoDetalhe | null>(null);
  readonly carregando = signal(true);
  readonly ocupado = signal(false);
  /** Conectado ao tempo real (sem indicador na tela): fora do ar, a recarga de 30 s assume. */
  readonly aoVivo = signal(false);
  /** Itens fora do escopo ficam ocultos até pedir. */
  readonly mostrarFora = signal(false);
  readonly trilha = signal<Trilha>('DISTRIBUICAO');
  readonly filtro = signal<Filtro>('TODOS');
  readonly texto = signal('');
  readonly selecionados = signal<ReadonlySet<number>>(new Set());
  private usuarios: UsuarioHom[] | null = null;
  private cod = 0;

  readonly eu = computed(() => this.detalhe()?.eu);
  readonly aberta = computed(() => ['PLANEJADA', 'EM_ANDAMENTO'].includes(this.detalhe()?.situacao ?? ''));
  readonly emAndamento = computed(() => this.detalhe()?.situacao === 'EM_ANDAMENTO');
  readonly geral = computed(() => this.trilha() === 'GERAL');

  /** Filtro por sistema da homologação (codHomologacaoSistema); nulo = todos. */
  readonly filtroSistema = signal<number | null>(null);

  /** Filtro por módulo (D-13): código do módulo; nulo = todos. */
  readonly filtroModulo = signal<number | null>(null);

  /** Filtro por usuário: itens com a pessoa (reservados ou atribuídos) ou que ela testou; nulo = todos. */
  readonly filtroUsuario = signal<number | null>(null);

  /** Com filtro, sistema, módulo, usuário ou pesquisa ligados, some o que não corresponde: itens, agrupamentos, módulos e sistemas. */
  readonly filtrando = computed(
    () =>
      this.filtro() !== 'TODOS' ||
      !!this.texto().trim() ||
      this.filtroModulo() !== null ||
      this.filtroSistema() !== null ||
      this.filtroUsuario() !== null ||
      this.soModulosSemTeste()
  );

  /** Quem aparece no filtro: responsáveis, quem reservou agrupamento e quem testou (resultado vigente), por nome. */
  readonly opcoesUsuario = computed(() => {
    const h = this.detalhe();
    const nomes = new Map<number, string>();
    for (const i of h?.itens ?? []) {
      if (i.codResponsavel && i.nomeResponsavel) nomes.set(i.codResponsavel, i.nomeResponsavel);
      if (i.codAutor && i.nomeAutor) nomes.set(i.codAutor, i.nomeAutor);
    }
    for (const a of h?.agrupamentos ?? []) {
      if (a.codReserva && a.nomeReserva) nomes.set(a.codReserva, a.nomeReserva);
    }
    const eu = this.eu()?.codUsuario;
    return [...nomes.entries()]
      .map(([codUsuario, nome]) => ({ codUsuario, nome, rotulo: codUsuario === eu ? `${nome} (você)` : nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  });

  /** O item é do usuário escolhido: está com ele ou foi testado por ele (o resultado vigente é dele). */
  private doUsuario(i: ItemHom) {
    const u = this.filtroUsuario();
    return u === null || i.codResponsavel === u || i.codAutor === u;
  }

  /** Módulos dos sistemas que trabalham com módulos (só os do sistema escolhido, se houver), para o filtro. */
  readonly opcoesModulo = computed(() =>
    (this.detalhe()?.sistemas ?? [])
      .filter(s => this.filtroSistema() === null || s.codHomologacaoSistema === this.filtroSistema())
      .flatMap(s => s.modulos.filter(m => m.codModulo !== null).map(m => ({ codModulo: m.codModulo!, rotulo: `${s.nome} › ${m.nome}` })))
  );

  /** Trocar o sistema limpa o módulo escolhido quando ele é de outro sistema. */
  trocarFiltroSistema(codHs: number | null) {
    this.filtroSistema.set(codHs);
    if (this.filtroModulo() !== null && !this.opcoesModulo().some(m => m.codModulo === this.filtroModulo())) {
      this.filtroModulo.set(null);
    }
  }

  /** Sistemas › módulos (quando o sistema trabalha com módulos) › agrupamentos › itens depois do filtro e da busca. */
  /** Só os módulos ainda sem nenhum teste registrado (sem itens criados ou com itens ainda não testados). */
  readonly soModulosSemTeste = signal(false);

  /**
   * Módulos (dos sistemas que trabalham com módulos, respeitando o filtro de sistema) sem nenhum resultado registrado nos
   * itens do escopo: nem aprovado/reprovado/não se aplica, nem bloqueado ou em reteste. Inclui os que nem têm item.
   */
  readonly modulosSemTeste = computed(() => {
    const sistema = this.filtroSistema();
    const chaves = new Set<string>();
    for (const s of this.detalhe()?.sistemas ?? []) {
      if (!s.trabalhaModulo || (sistema !== null && s.codHomologacaoSistema !== sistema)) continue;
      for (const m of s.modulos) {
        const c = m.contagem;
        if (m.codModulo !== null && m.ativo && c.concluidos + c.bloqueados + c.reteste === 0) {
          chaves.add(`${s.codHomologacaoSistema}:${m.codModulo}`);
        }
      }
    }
    return chaves;
  });

  readonly arvore = computed(() => {
    const h = this.detalhe();
    if (!h) return [];
    if (this.soModulosSemTeste()) return this.arvoreModulosSemTeste();
    const termo = normalizarTexto(this.texto().trim());
    const modulo = this.filtroModulo();
    const nomesModulo = new Map(h.sistemas.flatMap(s => s.modulos).map(m => [m.codModulo, m.nome]));
    // A pesquisa casa com o item, o agrupamento (nome ou tela) ou o módulo: "CAD_PAC" traz o agrupamento inteiro.
    const casa = (i: ItemHom, a: AgrupamentoHom) =>
      !termo || normalizarTexto(`${i.titulo} ${i.passos ?? ''} ${a.nome} ${a.tela ?? ''} ${nomesModulo.get(a.codModulo) ?? ''}`).includes(termo);
    const sistema = this.filtroSistema();
    const arvore = h.sistemas.filter(s => sistema === null || s.codHomologacaoSistema === sistema).map(s => {
      const agrupamentos = h.agrupamentos
        .filter(a => a.codHomologacaoSistema === s.codHomologacaoSistema && (modulo === null || a.codModulo === modulo))
        .map(a => ({ agrupamento: a, codModulo: a.codModulo, itens: h.itens.filter(i => i.codAgrupamento === a.codAgrupamento && this.passaFiltro(i) && this.doUsuario(i) && casa(i, a)) }))
        // Agrupamento vazio só aparece sem filtro e se não tiver item nenhum (recém-criado); com tudo fora do escopo, some.
        .filter(g => g.itens.length || (!this.filtrando() && !h.itens.some(i => i.codAgrupamento === g.agrupamento.codAgrupamento)));
      const modulos = s.trabalhaModulo
        ? porModulo(s.modulos, agrupamentos).map(g => ({ modulo: s.modulos.find(m => m.codModulo === g.codModulo) ?? null, nome: g.nome, agrupamentos: g.itens }))
        : [{ modulo: null, nome: '', agrupamentos }];
      return { sistema: s, modulos: modulos.filter(m => m.agrupamentos.length || !s.trabalhaModulo), total: agrupamentos.length };
    });
    return this.filtrando() ? arvore.filter(g => g.total) : arvore;
  });

  /**
   * Árvore só com os módulos sem teste: cada módulo aparece mesmo sem item (a tela diz "nenhum item criado"), com os
   * agrupamentos e itens que ele tiver — o filtro de módulo e a pesquisa continuam valendo.
   */
  private arvoreModulosSemTeste() {
    const h = this.detalhe()!;
    const termo = normalizarTexto(this.texto().trim());
    const modulo = this.filtroModulo();
    const semTeste = this.modulosSemTeste();
    return h.sistemas
      .filter(s => s.trabalhaModulo)
      .map(s => {
        const modulos = s.modulos
          .filter(m => semTeste.has(`${s.codHomologacaoSistema}:${m.codModulo}`) && (modulo === null || m.codModulo === modulo))
          .filter(m => !termo || normalizarTexto(m.nome).includes(termo))
          .map(m => ({
            modulo: m,
            nome: m.nome,
            agrupamentos: h.agrupamentos
              .filter(a => a.codHomologacaoSistema === s.codHomologacaoSistema && a.codModulo === m.codModulo)
              .map(a => ({ agrupamento: a, codModulo: a.codModulo, itens: h.itens.filter(i => i.codAgrupamento === a.codAgrupamento && !i.foraEscopo) })),
          }));
        return { sistema: s, modulos, total: modulos.length };
      })
      .filter(g => g.total);
  }

  readonly contagemFiltros = computed(() => {
    const h = this.detalhe();
    const conta: Record<Filtro, number> = { TODOS: 0, MEUS: 0, LIVRES: 0, PENDENTES: 0, APROVADOS: 0, REPROVADOS: 0, IMPEDITIVOS: 0, SEM_TICKET: 0, BLOQUEADOS: 0, RETESTE: 0, DIVERGENTES: 0, CRITICOS: 0, FORA: 0 };
    const sistema = this.filtroSistema();
    for (const i of (h?.itens ?? []).filter(x => (sistema === null || x.codHomologacaoSistema === sistema) && this.doUsuario(x))) {
      for (const f of FILTROS) {
        if (this.passaFiltro(i, f.chave, false)) conta[f.chave]++;
      }
      if (i.foraEscopo) conta.FORA++;
    }
    return conta;
  });

  readonly itensSelecionados = computed(() => (this.detalhe()?.itens ?? []).filter(i => this.selecionados().has(i.codItem)));
  readonly podeReservarSelecionados = computed(() => this.itensSelecionados().some(i => this.podeReservar(i)));
  readonly podeLiberarSelecionados = computed(() => this.itensSelecionados().some(i => this.podeLiberar(i)));

  ngOnInit() {
    // Tempo real: cada mudança de outra pessoa (reserva, resultado, entrega...) recarrega a tela, agrupando rajadas.
    this.mudancas.pipe(debounceTime(RAJADA_MS), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.carregar(true));
    this.route.queryParamMap
      .pipe(
        map(params => Number(params.get('id'))),
        distinctUntilChanged(),
        tap(cod => {
          this.cod = cod;
          this.selecionados.set(new Set());
          this.carregar();
        }),
        switchMap(cod => this.tempoReal.acompanhar(cod)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(evento => this.tratarTempoReal(evento));
    // Reserva de segurança só enquanto o tempo real estiver fora do ar.
    interval(INTERVALO_MS)
      .pipe(
        filter(() => !this.aoVivo() && document.visibilityState === 'visible' && !this.dialog.openDialogs.length && !this.ocupado()),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.carregar(true));
  }

  private tratarTempoReal(evento: EventoTempoReal) {
    switch (evento.tipo) {
      case 'conectado':
        // Reconexão: o que mudou enquanto a conexão estava fora não veio pelo fluxo.
        if (this.estavaDesconectado) this.mudancas.next();
        this.estavaDesconectado = false;
        this.aoVivo.set(true);
        break;
      case 'desconectado':
        this.estavaDesconectado = true;
        this.aoVivo.set(false);
        break;
      case 'mudanca':
        // A própria ação já trouxe o detalhe com esta revisão: não precisa buscar de novo.
        if (evento.mudanca.codEvento > (this.detalhe()?.revisao ?? 0)) this.mudancas.next();
        break;
    }
  }

  carregar(silencioso = false) {
    if (!this.cod) return;
    if (!silencioso) this.carregando.set(true);
    this.service
      .detalhe(this.cod)
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({ next: d => this.aplicar(d), error: () => {} });
  }

  /**
   * Mostra o detalhe se não for mais velho que o da tela: uma leitura que começou antes de um comando e terminou
   * depois dele traria o estado antigo de volta (era o "reservei e a tela não mudou").
   */
  private aplicar(d: HomologacaoDetalhe) {
    const atual = this.detalhe();
    if (atual && atual.codHomologacao === d.codHomologacao && d.revisao < atual.revisao) return;
    this.detalhe.set(d);
    if (!d.eu.geral && this.trilha() === 'GERAL') this.trilha.set('DISTRIBUICAO');
  }

  /** Executa um comando que devolve o detalhe atualizado. */
  private executar(chamada: Observable<HomologacaoDetalhe>, sucesso?: string) {
    this.ocupado.set(true);
    chamada.pipe(finalize(() => this.ocupado.set(false))).subscribe({
      next: d => {
        this.aplicar(d);
        this.selecionados.set(new Set());
        if (sucesso) this.toast.success(sucesso);
      },
      error: () => {},
    });
  }

  // ------------------------------------------------------------------ filtros e seleção

  /** Fora do escopo só aparece com "Mostrar fora do escopo" (e só em Todos). */
  private passaFiltro(i: ItemHom, f: Filtro = this.filtro(), incluirFora = this.mostrarFora()): boolean {
    const eu = this.eu()?.codUsuario;
    const r = this.geral() ? i.meuResultadoGeral : i.resultado;
    if (f === 'FORA') return i.foraEscopo;
    if (i.foraEscopo) return f === 'TODOS' && incluirFora;
    switch (f) {
      case 'MEUS':
        return i.codResponsavel === eu;
      case 'LIVRES':
        return !i.codResponsavel;
      case 'PENDENTES':
        return !concluido(r);
      case 'APROVADOS':
        return r === 'APROVADO';
      case 'REPROVADOS':
        return r === 'REPROVADO';
      case 'IMPEDITIVOS':
        return r === 'REPROVADO' && (this.geral() ? i.meuImpeditivoGeral : i.impeditivo);
      // O ticket do fabricante é do resultado da distribuição (o teste geral não tem ticket).
      case 'SEM_TICKET':
        return i.resultado === 'REPROVADO' && !i.ticketFabricante?.trim();
      case 'BLOQUEADOS':
        return r === 'BLOQUEADO';
      case 'RETESTE':
        return r === 'RETESTE';
      case 'DIVERGENTES':
        return i.divergente;
      case 'CRITICOS':
        return i.critico;
      default:
        return true;
    }
  }

  alternarSelecao(item: ItemHom, marcado: boolean) {
    this.selecionados.update(atual => {
      const novo = new Set(atual);
      if (marcado) novo.add(item.codItem);
      else novo.delete(item.codItem);
      return novo;
    });
  }

  limparSelecao() {
    this.selecionados.set(new Set());
  }

  trocarTrilha(trilha: Trilha) {
    this.trilha.set(trilha);
    this.limparSelecao();
  }

  estado(item: ItemHom) {
    return estadoItem(item);
  }

  // ------------------------------------------------------------------ o que cada um pode fazer

  /** Resultado do item na trilha mostrada (distribuição ou a minha homologação geral). */
  private resultadoNaTrilha(i: ItemHom) {
    return this.geral() ? i.meuResultadoGeral : i.resultado;
  }

  /** Registrar: item ainda sem resultado concluído (livre, meu, bloqueado ou em reteste). Já testado → "Retestar". */
  podeRegistrar(i: ItemHom) {
    const eu = this.eu();
    if (!this.emAndamento() || !eu?.participa || i.foraEscopo || concluido(this.resultadoNaTrilha(i))) return false;
    return this.geral() ? eu.geral : !i.codResponsavel || i.codResponsavel === eu.codUsuario;
  }

  /**
   * Retestar: item já testado volta pendente, com o motivo, para registrar de novo. Na distribuição, qualquer participante
   * (quem testou pode estar de férias ou ter saído da equipe) — o item passa para quem retesta; na geral, a minha trilha.
   */
  podeRetestar(i: ItemHom) {
    const eu = this.eu();
    if (!this.emAndamento() || !eu?.participa || i.foraEscopo || !concluido(this.resultadoNaTrilha(i))) return false;
    return !this.geral() || eu.geral;
  }

  podeReservar(i: ItemHom) {
    return this.aberta() && !!this.eu()?.participa && !i.foraEscopo && !i.codResponsavel && !this.geral();
  }

  podeLiberar(i: ItemHom) {
    return this.aberta() && i.codResponsavel === this.eu()?.codUsuario && !concluido(i.resultado);
  }

  /** Pedir reteste (gestão): o item volta pendente para o mesmo responsável, sem passar para quem pediu. */
  podePedirReteste(i: ItemHom) {
    const eu = this.eu();
    return this.emAndamento() && !!eu?.gestao && !this.geral() && !i.foraEscopo && concluido(i.resultado);
  }

  /** Item incluído só nesta homologação: renomeia a gestão ou quem incluiu. */
  podeEditarItem(i: ItemHom) {
    const eu = this.eu();
    if (!this.aberta() || !eu || i.origem !== 'INCLUIDO' || i.codRoteiroItem) return false;
    return eu.gestao || (eu.participa && i.codUsuarioCadastro === eu.codUsuario);
  }

  podeReservarAgrupamento(a: AgrupamentoHom) {
    return this.aberta() && !!this.eu()?.participa && !this.geral() && a.codReserva !== this.eu()?.codUsuario && (!a.codReserva || a.contagem.livres > 0);
  }

  // ------------------------------------------------------------------ distribuição

  reservar(item: ItemHom) {
    this.executar(this.service.reservar(this.cod, [item.codItem]), `"${item.titulo}" reservado para você.`);
  }

  reservarSelecionados() {
    const itens = this.itensSelecionados().filter(i => this.podeReservar(i));
    this.executar(this.service.reservar(this.cod, itens.map(i => i.codItem)), `${itens.length} ${itens.length === 1 ? 'item reservado' : 'itens reservados'} para você.`);
  }

  reservarAgrupamento(a: AgrupamentoHom) {
    this.executar(this.service.reservar(this.cod, null, a.codAgrupamento), `Agrupamento "${a.nome}" reservado: itens novos nele também serão seus.`);
  }

  liberar(item: ItemHom) {
    this.executar(this.service.liberar(this.cod, [item.codItem]), `"${item.titulo}" liberado.`);
  }

  liberarSelecionados() {
    const itens = this.itensSelecionados().filter(i => this.podeLiberar(i));
    this.executar(this.service.liberar(this.cod, itens.map(i => i.codItem)), 'Itens liberados.');
  }

  liberarAgrupamento(a: AgrupamentoHom) {
    this.executar(this.service.liberar(this.cod, null, a.codAgrupamento), `Seus itens pendentes de "${a.nome}" foram liberados.`);
  }

  // ------------------------------------------------------------------ módulo inteiro (D-13)

  reservarModulo(m: ModuloProgresso) {
    this.executar(this.service.reservar(this.cod, null, null, m.codModulo), `Módulo "${m.nome}" reservado: os agrupamentos livres dele são seus.`);
  }

  liberarModulo(m: ModuloProgresso) {
    this.executar(this.service.liberar(this.cod, null, null, m.codModulo), `Seus itens pendentes do módulo "${m.nome}" foram liberados.`);
  }

  atribuirModulo(m: ModuloProgresso) {
    const h = this.detalhe()!;
    this.comUsuarios(usuarios =>
      this.dialog
        .open<AtribuirDialogComponent, AtribuirDialogData, number>(AtribuirDialogComponent, {
          data: { homologacao: h, usuarios, descricao: `Módulo "${m.nome}": todos os agrupamentos, os itens pendentes e os que forem incluídos neles.` },
        })
        .afterClosed()
        .subscribe(codUsuario => {
          if (codUsuario) this.executar(this.service.atribuir(this.cod, codUsuario, null, null, m.codModulo), 'Módulo atribuído.');
        })
    );
  }

  /** Módulo com agrupamento livre ou de outra pessoa ainda não é todo meu. */
  podeReservarModulo(codModulo: number | null) {
    const eu = this.eu();
    if (codModulo === null || !this.aberta() || !eu?.participa || this.geral()) return false;
    return (this.detalhe()?.agrupamentos ?? []).some(a => a.codModulo === codModulo && a.codReserva !== eu.codUsuario && (!a.codReserva || a.contagem.livres > 0));
  }

  temReservaNoModulo(codModulo: number | null) {
    const eu = this.eu()?.codUsuario;
    return codModulo !== null && (this.detalhe()?.agrupamentos ?? []).some(a => a.codModulo === codModulo && a.codReserva === eu);
  }

  atribuir(itens: ItemHom[] | null, agrupamento: AgrupamentoHom | null = null) {
    const h = this.detalhe()!;
    const descricao = agrupamento
      ? `Agrupamento "${agrupamento.nome}": os itens pendentes e os que forem incluídos nele.`
      : itens!.length === 1
        ? `"${itens![0].titulo}"`
        : `${itens!.length} itens selecionados`;
    this.comUsuarios(usuarios =>
      this.dialog
        .open<AtribuirDialogComponent, AtribuirDialogData, number>(AtribuirDialogComponent, { data: { homologacao: h, usuarios, descricao } })
        .afterClosed()
        .subscribe(codUsuario => {
          if (!codUsuario) return;
          this.executar(
            this.service.atribuir(this.cod, codUsuario, itens?.map(i => i.codItem) ?? null, agrupamento?.codAgrupamento ?? null),
            'Atribuído.'
          );
        })
    );
  }

  removerReservas(alvo: { item?: ItemHom; agrupamento?: AgrupamentoHom; participante?: ParticipanteHom }) {
    const descricao = alvo.participante
      ? `Reservas de ${alvo.participante.nome} (${alvo.participante.sobResponsabilidade} itens, ${alvo.participante.sobResponsabilidade - alvo.participante.concluidosResponsabilidade} pendentes).`
      : alvo.agrupamento
        ? `Reservas do agrupamento "${alvo.agrupamento.nome}".`
        : `Reserva de "${alvo.item!.titulo}" (com ${alvo.item!.nomeResponsavel}).`;
    this.dialog
      .open<RemoverReservasDialogComponent, RemoverReservasDialogData, RemoverReservasResultado>(RemoverReservasDialogComponent, { data: { descricao } })
      .afterClosed()
      .subscribe(r => {
        if (!r) return;
        this.executar(
          this.service.removerReservas(this.cod, {
            codUsuario: alvo.participante?.codUsuario ?? null,
            codItens: alvo.item ? [alvo.item.codItem] : null,
            codAgrupamento: alvo.agrupamento?.codAgrupamento ?? null,
            somentePendentes: r.somentePendentes,
            motivo: r.motivo,
          }),
          'Reservas removidas.'
        );
      });
  }

  private comUsuarios(acao: (usuarios: UsuarioHom[]) => void) {
    if (this.usuarios) {
      acao(this.usuarios);
      return;
    }
    this.service.catalogo().subscribe({
      next: c => {
        this.usuarios = c.usuarios;
        acao(c.usuarios);
      },
      error: () => {},
    });
  }

  // ------------------------------------------------------------------ resultados

  registrar(item: ItemHom) {
    this.dialog
      .open<ResultadoDialogComponent, ResultadoDialogData, HomologacaoDetalhe>(ResultadoDialogComponent, {
        data: { homologacao: this.detalhe()!, item, trilha: this.trilha() },
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe(d => {
        if (d) {
          this.aplicar(d);
          this.toast.success('Resultado registrado.');
        }
      });
  }

  historico(item: ItemHom) {
    this.dialog
      .open<HistoricoDialogComponent, HistoricoDialogData>(HistoricoDialogComponent, { data: { item }, maxWidth: '95vw', autoFocus: false })
      .afterClosed()
      .subscribe(() => this.carregar(true));
  }

  pedirReteste(item: ItemHom) {
    this.pedirMotivo(
      'Pedir reteste ao responsável',
      `"${item.titulo}" volta pendente na distribuição, com ${item.nomeResponsavel ?? 'o mesmo responsável'}. Quem testou é avisado.`,
      'Por que testar de novo',
      'Pedir reteste',
      motivo => this.executar(this.service.pedirReteste(item.codItem, motivo), 'Reteste pedido.')
    );
  }

  /** Testar de novo: o item volta pendente (na distribuição, passa para mim) e aparece "Registrar". */
  retestar(item: ItemHom) {
    const eu = this.eu()!;
    const geral = this.geral();
    const descricao = geral
      ? `Seu resultado de "${item.titulo}" na homologação geral volta pendente para você registrar de novo.`
      : `"${item.titulo}" volta pendente para você registrar de novo` +
        (item.codResponsavel && item.codResponsavel !== eu.codUsuario ? ` — passa para você (estava com ${item.nomeResponsavel})` : '') +
        `. O resultado atual (${RESULTADO_INFO[item.resultado!].rotulo}${item.nomeAutor ? ', de ' + item.nomeAutor : ''}) fica no histórico` +
        (item.codAutor && item.codAutor !== eu.codUsuario ? ' e quem testou é avisado.' : '.');
    this.pedirMotivo('Retestar', descricao, 'Por que testar de novo (ex.: o fabricante corrigiu, registrei errado)', 'Retestar', motivo =>
      this.executar(
        this.service.pedirReteste(item.codItem, motivo, geral ? 'GERAL' : 'DISTRIBUICAO', true),
        'Item em reteste: registre o novo resultado.'
      )
    );
  }

  // ------------------------------------------------------------------ reorganizar e excluir

  /** Mover itens entre agrupamentos do mesmo sistema: gestão, administrador ou responsável pela homologação. */
  podeMover() {
    const eu = this.eu();
    return this.aberta() && !!eu && (eu.gestao || eu.podeExcluir);
  }

  /** Excluir item incluído na homologação, mesmo com histórico: administrador ou responsável. */
  podeExcluirItem(i: ItemHom) {
    return this.aberta() && !!this.eu()?.podeExcluir && i.origem === 'INCLUIDO';
  }

  /** Trocar sistema / módulo do agrupamento: administrador ou responsável, havendo outro sistema ou módulos para escolher. */
  podeTrocarAgrupamento(a: AgrupamentoHom) {
    const h = this.detalhe();
    if (!this.aberta() || !this.eu()?.podeExcluir || !h) return false;
    return h.sistemas.length > 1 || !!h.sistemas.find(s => s.codHomologacaoSistema === a.codHomologacaoSistema)?.trabalhaModulo;
  }

  trocarAgrupamento(a: AgrupamentoHom) {
    this.dialog
      .open<TrocarAgrupamentoDialogComponent, TrocarAgrupamentoDialogData, TrocarAgrupamentoResultado>(TrocarAgrupamentoDialogComponent, {
        data: { homologacao: this.detalhe()!, agrupamento: a },
      })
      .afterClosed()
      .subscribe(r => {
        if (r) this.executar(this.service.moverAgrupamento(a.codAgrupamento, r.codHomologacaoSistema, r.codModulo), `Agrupamento "${a.nome}" trocado.`);
      });
  }

  podeExcluirAgrupamento(a: AgrupamentoHom) {
    return this.aberta() && !!this.eu()?.podeExcluir && !a.doPadrao;
  }

  mover(itens: ItemHom[]) {
    this.dialog
      .open<MoverItensDialogComponent, MoverItensDialogData, number>(MoverItensDialogComponent, { data: { homologacao: this.detalhe()!, itens } })
      .afterClosed()
      .subscribe(codAgrupamento => {
        if (codAgrupamento) {
          this.executar(this.service.moverItens(this.cod, itens.map(i => i.codItem), codAgrupamento), itens.length === 1 ? 'Item movido.' : `${itens.length} itens movidos.`);
        }
      });
  }

  excluirItem(item: ItemHom) {
    const historico = item.resultado || item.meuResultadoGeral || item.codRoteiroItem;
    this.pedirMotivo(
      'Excluir item',
      `"${item.titulo}" sai desta homologação.` +
        (historico
          ? ' Ele já tem histórico: os resultados ficam guardados no banco (não se apagam), mas o item some da tela, das contas e do parecer.'
          : ' Não tem resultado: sai de vez.'),
      'Motivo da exclusão',
      'Excluir',
      motivo => this.executar(this.service.excluirItem(item.codItem, motivo), 'Item excluído.')
    );
  }

  excluirAgrupamento(a: AgrupamentoHom) {
    const itens = (this.detalhe()?.itens ?? []).filter(i => i.codAgrupamento === a.codAgrupamento).length;
    this.pedirMotivo(
      'Excluir agrupamento',
      `"${a.nome}" sai desta homologação com ${itens} ${itens === 1 ? 'item' : 'itens'}. Resultados já registrados ficam guardados no banco, mas somem da tela, das contas e do parecer.`,
      'Motivo da exclusão',
      'Excluir',
      motivo => this.executar(this.service.excluirAgrupamentoHomologacao(a.codAgrupamento, motivo), 'Agrupamento excluído.')
    );
  }

  editarItem(item: ItemHom) {
    this.dialog
      .open<EditarItemDialogComponent, EditarItemDialogData, EditarItemRequest>(EditarItemDialogComponent, { data: { item } })
      .afterClosed()
      .subscribe(r => {
        if (r) this.executar(this.service.editarItem(item.codItem, r), 'Item atualizado.');
      });
  }

  /** Agrupamento criado nesta homologação: nome e tela (o do padrão muda em Roteiros de homologação). */
  editarAgrupamento(a: AgrupamentoHom) {
    const h = this.detalhe()!;
    const existentes = h.agrupamentos
      .filter(x => x.codHomologacaoSistema === a.codHomologacaoSistema && x.codAgrupamento !== a.codAgrupamento)
      .map(x => ({ nome: x.nome, codModulo: x.codModulo }));
    const sistema = h.sistemas.find(s => s.codHomologacaoSistema === a.codHomologacaoSistema);
    const modulos = sistema?.trabalhaModulo ? sistema.modulos.filter(m => m.codModulo !== null).map(m => ({ codModulo: m.codModulo!, nome: m.nome, ativo: m.ativo })) : [];
    this.dialog
      .open<AgrupamentoDialogComponent, AgrupamentoDialogData, AgrupamentoDialogResultado>(AgrupamentoDialogComponent, {
        data: { titulo: 'Agrupamento desta homologação', nome: a.nome, tela: a.tela, existentes, modulos, codModulo: a.codModulo },
      })
      .afterClosed()
      .subscribe(r => {
        if (r) this.executar(this.service.editarAgrupamentoHomologacao(a.codAgrupamento, r.nome, r.tela, r.codModulo), 'Agrupamento atualizado.');
      });
  }

  alterarEscopo(item: ItemHom) {
    const sai = !item.foraEscopo;
    const acao = (motivo: string | null) =>
      this.executar(this.service.alterarEscopo(item.codItem, sai, motivo), sai ? 'Item fora do escopo.' : 'Item de volta ao escopo.');
    if (this.detalhe()!.situacao === 'PLANEJADA') {
      acao(null);
      return;
    }
    this.pedirMotivo(sai ? 'Tirar do escopo' : 'Voltar ao escopo', `"${item.titulo}"`, 'Motivo', 'Confirmar', acao);
  }

  resolver(d: DivergenciaHom) {
    this.dialog
      .open<DivergenciaDialogComponent, DivergenciaDialogData, DivergenciaDialogResultado>(DivergenciaDialogComponent, { data: { divergencia: d } })
      .afterClosed()
      .subscribe(r => {
        if (r) this.executar(this.service.resolverDivergencia(d.codDivergencia, r.forma, r.comentario), 'Divergência resolvida.');
      });
  }

  // ------------------------------------------------------------------ homologação geral

  optarGeral() {
    this.executar(this.service.optarGeral(this.cod), 'Homologação geral iniciada: agora você testa todo o roteiro na sua trilha.');
    this.trilha.set('GERAL');
  }

  desistirGeral() {
    this.pedirConfirmacao(
      'Desistir da homologação geral',
      'Seus resultados na geral ficam no histórico e as divergências abertas por ela são fechadas.',
      () => {
        this.trilha.set('DISTRIBUICAO');
        this.executar(this.service.desistirGeral(this.cod), 'Você saiu da homologação geral.');
      }
    );
  }

  // ------------------------------------------------------------------ gestão

  editarCadastro() {
    this.router.navigate([`${ROTA_BASE}/homologacoes-cadastro`], { queryParams: { id: this.cod } });
  }

  incluirItem(sistema?: number, agrupamento?: number) {
    this.dialog
      .open<ItemDialogComponent, ItemDialogData, ItemRequest>(ItemDialogComponent, {
        data: { homologacao: this.detalhe()!, codHomologacaoSistema: sistema, codAgrupamento: agrupamento },
      })
      .afterClosed()
      .subscribe(r => {
        if (r) this.executar(this.service.incluirItem(this.cod, r), 'Item incluído.');
      });
  }

  trazerNovos(codHs: number) {
    this.executar(this.service.trazerNovos(codHs), 'Itens novos do roteiro padrão trazidos.');
  }

  iniciar() {
    this.dialog
      .open<IniciarDialogComponent, IniciarDialogData, boolean>(IniciarDialogComponent, { data: { homologacao: this.detalhe()! } })
      .afterClosed()
      .subscribe(ok => {
        if (ok) this.executar(this.service.iniciar(this.cod), 'Homologação iniciada: testes liberados.');
      });
  }

  alterarPrevisao() {
    this.dialog
      .open<PrevisaoDialogComponent, PrevisaoDialogData, PrevisaoDialogResultado>(PrevisaoDialogComponent, { data: { homologacao: this.detalhe()! } })
      .afterClosed()
      .subscribe(r => {
        if (r) this.executar(this.service.alterarPrevisao(this.cod, r.inicio, r.fim, r.motivo), 'Previsão alterada.');
      });
  }

  registrarEntrega() {
    this.dialog
      .open<EntregaDialogComponent, EntregaDialogData, EntregaDialogResultado>(EntregaDialogComponent, { data: { homologacao: this.detalhe()! } })
      .afterClosed()
      .subscribe(r => {
        if (r) this.executar(this.service.registrarEntrega(this.cod, r), 'Entrega registrada.');
      });
  }

  encerrar() {
    this.pedirMotivo(
      'Encerrar antes do fim',
      'O parecer de cada sistema é calculado com o que foi testado: Reprovada se houver impeditivo; Inconclusiva se houver pendências.',
      'Justificativa',
      'Encerrar',
      motivo => this.executar(this.service.encerrar(this.cod, motivo), 'Homologação encerrada.')
    );
  }

  reabrir() {
    this.pedirMotivo('Reabrir', 'Volta a Em andamento; os pareceres atuais ficam no histórico.', 'Motivo', 'Reabrir', motivo =>
      this.executar(this.service.reabrir(this.cod, motivo), 'Homologação reaberta.')
    );
  }

  cancelar() {
    this.dialog
      .open<CancelarDialogComponent, CancelarDialogData, CancelarRequest>(CancelarDialogComponent, { data: { homologacao: this.detalhe()! } })
      .afterClosed()
      .subscribe(r => {
        if (!r) return;
        this.ocupado.set(true);
        this.service
          .cancelar(this.cod, r)
          .pipe(finalize(() => this.ocupado.set(false)))
          .subscribe({
            next: d => {
              if (d.codHomologacao !== this.cod) {
                this.toast.success(`Cancelada. ${d.numero} criada para a nova versão: revise e inicie quando o fabricante instalar.`);
                this.router.navigate([`${ROTA_BASE}/homologacoes-cadastro`], { queryParams: { id: d.codHomologacao } });
              } else {
                this.aplicar(d);
                this.toast.success('Homologação cancelada.');
              }
            },
            error: () => {},
          });
      });
  }

  observarParecer(codHs: number) {
    this.dialog
      .open<MotivoDialogComponent, MotivoDialogData, string>(MotivoDialogComponent, {
        data: { titulo: 'Observação no parecer', descricao: 'O parecer continua calculado; a observação é só um comentário.', rotulo: 'Observação', botao: 'Salvar' },
      })
      .afterClosed()
      .subscribe(texto => {
        if (texto) this.executar(this.service.observarParecer(codHs, texto), 'Observação salva.');
      });
  }

  irPara(cod: number) {
    this.router.navigate([`${ROTA_BASE}/homologacoes-detalhe`], { queryParams: { id: cod } });
  }

  voltar() {
    this.router.navigate([`${ROTA_BASE}/${this.eu()?.gestao ? 'homologacoes-gestao' : 'homologacoes'}`]);
  }

  /** Relatório final em PDF (pareceres, reprovados, pendências e aceite); aberto numa aba nova. */
  relatorio() {
    this.service.relatorio(this.cod).subscribe({
      next: blob => {
        const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => {},
    });
  }

  /** Itens e resultados vigentes de cada trilha em CSV (separador ; para abrir direto no Excel). */
  exportar() {
    const h = this.detalhe()!;
    const sistemas = new Map(h.sistemas.map(s => [s.codHomologacaoSistema, s.nome]));
    const agrupamentos = new Map(h.agrupamentos.map(a => [a.codAgrupamento, a]));
    const modulos = new Map(h.sistemas.flatMap(s => s.modulos).map(m => [m.codModulo, m.nome]));
    const cabecalho = ['Sistema', 'Módulo', 'Agrupamento', 'Tela', 'Item', 'Crítico', 'Escopo', 'Responsável', 'Resultado', 'Impeditivo', 'Autor', 'Data', 'Ticket fabricante', 'Evidências', 'Divergente'];
    const linhas = h.itens.map(i => [
      sistemas.get(i.codHomologacaoSistema) ?? '',
      modulos.get(agrupamentos.get(i.codAgrupamento)?.codModulo ?? null) ?? '',
      agrupamentos.get(i.codAgrupamento)?.nome ?? '',
      agrupamentos.get(i.codAgrupamento)?.tela ?? '',
      i.titulo,
      i.critico ? 'sim' : '',
      i.foraEscopo ? 'fora' : 'no escopo',
      i.nomeResponsavel ?? '',
      i.resultado ? RESULTADO_INFO[i.resultado].rotulo : '',
      i.impeditivo ? 'sim' : '',
      i.nomeAutor ?? '',
      i.dataResultado ? new Date(i.dataResultado).toLocaleString('pt-BR') : '',
      i.ticketFabricante ?? '',
      String(i.qtdEvidencias),
      i.divergente ? 'sim' : '',
    ]);
    const csv = [cabecalho, ...linhas].map(l => l.map(c => `"${c.replaceAll('"', '""')}"`).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${h.numero}-itens.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // ------------------------------------------------------------------ apoio

  private pedirMotivo(titulo: string, descricao: string, rotulo: string, botao: string, acao: (motivo: string) => void) {
    this.dialog
      .open<MotivoDialogComponent, MotivoDialogData, string>(MotivoDialogComponent, { data: { titulo, descricao, rotulo, botao } })
      .afterClosed()
      .subscribe(motivo => {
        if (motivo) acao(motivo);
      });
  }

  private pedirConfirmacao(titulo: string, mensagem: string, acao: () => void) {
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, { data: { titulo, mensagem, confirmarTexto: 'Confirmar', cancelarTexto: 'Voltar' } })
      .afterClosed()
      .subscribe(ok => {
        if (ok) acao();
      });
  }
}
