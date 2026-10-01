import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmDialogComponent, ConfirmDialogData } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { HotToastService } from '@ngxpert/hot-toast';
import { Observable, finalize, forkJoin, of } from 'rxjs';

import { normalizarTexto } from '../../atualizacao.models';
import {
  AgrupamentoPadrao,
  CatalogoHom,
  HomologacaoDetalhe,
  HomologacaoRequest,
  Participacao,
  ROTA_BASE,
  RoteiroPadrao,
  SistemaCatalogo,
  hojeIso,
  porModulo,
} from '../homologacao.models';
import { HomologacaoService } from '../homologacao.service';

/** Sistema em edição no cadastro: roteiros escolhidos e itens do padrão deixados fora do escopo. */
interface SistemaForm {
  codSistema: number;
  nome: string;
  /** Versões congeladas ao iniciar; enquanto planejada vêm do cadastro de sistemas por ambiente. */
  congeladas: { atual: string | null; nova: string | null } | null;
  codRoteiros: number[];
  fora: Set<number>;
  /** Já existia na homologação salva (depois de iniciada, sistema não sai nem entra). */
  salvo: boolean;
  /** Ainda não homologado: sai da homologação mesmo depois de iniciada (sem resultado, entrega nem parecer). */
  removivel: boolean;
  /** Itens e reservas que saem junto, para a confirmação. */
  qtdItens: number;
  qtdReservados: number;
}

/** Homologação — cadastro (T-02), gestão. Rota oculta homologacoes-cadastro (sem id = nova). */
@Component({
  selector: 'app-homologacao-cadastro',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatRadioModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  templateUrl: './homologacao-cadastro.html',
  styleUrls: ['../../compartilhado/atualizacao-pagina.scss', './homologacao-cadastro.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomologacaoCadastroComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(HomologacaoService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(HotToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly catalogo = signal<CatalogoHom | null>(null);
  readonly original = signal<HomologacaoDetalhe | null>(null);
  readonly carregando = signal(true);
  readonly salvando = signal(false);
  /** Roteiros padrão já carregados (árvore do escopo). */
  readonly roteiros = signal<Map<number, RoteiroPadrao>>(new Map());

  titulo = '';
  descricao = '';
  codAmbiente: string | null = null;
  previsaoInicio = hojeIso();
  previsaoFim = '';
  codResponsavel: number | null = null;
  ticketMv = '';
  participacao: Participacao = 'TODOS';
  participantesIncluemItens = false;
  designados = new Set<number>();
  sistemas: SistemaForm[] = [];
  sistemaParaIncluir: number | null = null;
  buscaUsuario = '';

  readonly edicao = computed(() => !!this.original());
  readonly planejada = computed(() => !this.original() || this.original()!.situacao === 'PLANEJADA');

  ngOnInit() {
    const cod = Number(this.route.snapshot.queryParamMap.get('id'));
    forkJoin([this.service.catalogo(), cod ? this.service.detalhe(cod) : of(null)])
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({
        next: ([catalogo, detalhe]) => {
          this.catalogo.set(catalogo);
          this.participantesIncluemItens = catalogo.regras.participantesIncluemItens;
          if (detalhe) {
            this.preencher(detalhe);
          }
          this.cdr.markForCheck();
        },
        error: () => {},
      });
  }

  private preencher(d: HomologacaoDetalhe) {
    this.original.set(d);
    this.titulo = d.titulo;
    this.descricao = d.descricao ?? '';
    this.codAmbiente = d.codAmbiente;
    this.previsaoInicio = d.previsaoInicio;
    this.previsaoFim = d.previsaoFim;
    this.codResponsavel = d.codResponsavel;
    this.ticketMv = d.ticketMv ?? '';
    this.participacao = d.participacao;
    this.participantesIncluemItens = d.participantesIncluemItens;
    this.designados = new Set(d.designados);
    this.sistemas = d.sistemas.map(s => ({
      codSistema: s.codSistema,
      nome: s.nome,
      congeladas: d.situacao === 'PLANEJADA' ? null : { atual: s.versaoAtual, nova: s.versaoNova },
      codRoteiros: [...s.codRoteiros],
      fora: new Set(d.itens.filter(i => i.codHomologacaoSistema === s.codHomologacaoSistema && i.foraEscopo && i.codRoteiroItem).map(i => i.codRoteiroItem!)),
      salvo: true,
      removivel: s.removivel,
      qtdItens: d.itens.filter(i => i.codHomologacaoSistema === s.codHomologacaoSistema).length,
      qtdReservados: d.itens.filter(i => i.codHomologacaoSistema === s.codHomologacaoSistema && i.codResponsavel).length,
    }));
    this.sistemas.forEach(s => s.codRoteiros.forEach(r => this.carregarRoteiro(r)));
  }

  // ------------------------------------------------------------------ sistemas e roteiros

  sistemasDisponiveis(): SistemaCatalogo[] {
    const ja = new Set(this.sistemas.map(s => s.codSistema));
    return (this.catalogo()?.sistemas ?? []).filter(s => !ja.has(s.codSistema));
  }

  catalogoDo(codSistema: number) {
    return this.catalogo()?.sistemas.find(s => s.codSistema === codSistema);
  }

  /** D-06: atual = versão em Produção; homologada = versão no ambiente escolhido (cadastro de sistemas por ambiente). */
  versoes(s: SistemaForm): { atual: string | null; nova: string | null } {
    if (s.congeladas) return s.congeladas;
    const versoes = this.catalogoDo(s.codSistema)?.versoes ?? [];
    const em = (amb: string | null) => versoes.find(v => v.codAmbiente === amb)?.versao?.trim() || null;
    return { atual: em('PRODUCAO'), nova: em(this.codAmbiente) };
  }

  ambienteNome() {
    return this.catalogo()?.ambientes.find(a => a.codigo === this.codAmbiente)?.nome ?? 'ambiente';
  }

  incluirSistema() {
    const s = this.catalogoDo(this.sistemaParaIncluir!);
    if (!s) return;
    const ativos = s.roteiros.filter(r => r.ativo);
    this.sistemas = [
      ...this.sistemas,
      { codSistema: s.codSistema, nome: s.nome, congeladas: null, codRoteiros: ativos.length === 1 ? [ativos[0].codRoteiro] : [], fora: new Set(),
        salvo: false,
        removivel: true,
        qtdItens: 0,
        qtdReservados: 0,
      },
    ];
    if (ativos.length === 1) this.carregarRoteiro(ativos[0].codRoteiro);
    this.sistemaParaIncluir = null;
  }

  /** Roteiros e escopo mudam enquanto planejada; em andamento, só no sistema que está entrando agora (ainda não salvo). */
  editavel(s: SistemaForm) {
    return this.planejada() || !s.salvo;
  }

  /** Sistema já salvo sai ao salvar a homologação: confirma, porque itens e reservas dele saem junto. */
  tirarSistema(s: SistemaForm) {
    if (!s.salvo) {
      this.sistemas = this.sistemas.filter(x => x !== s);
      return;
    }
    const reservas = s.qtdReservados ? `, com ${s.qtdReservados} reservado(s)` : '';
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data: {
          titulo: `Tirar ${s.nome}`,
          mensagem: `${s.nome} ainda não tem resultados. Ao salvar, sai da homologação com os ${s.qtdItens} itens dele${reservas}; a linha do tempo registra a retirada.`,
          confirmarTexto: 'Tirar o sistema',
          cancelarTexto: 'Voltar',
        },
      })
      .afterClosed()
      .subscribe(ok => {
        if (!ok) return;
        this.sistemas = this.sistemas.filter(x => x !== s);
        this.cdr.markForCheck();
      });
  }

  /** Resumo dos roteiros do sistema que não muda mais (homologação em andamento), para a linha do cabeçalho. */
  roteirosTexto(s: SistemaForm) {
    const nomes = this.arvore(s).map(r => r.nome);
    return nomes.length ? `roteiro${nomes.length > 1 ? 's' : ''}: ${nomes.join(', ')}` : 'sem roteiro padrão';
  }

  alternarRoteiro(s: SistemaForm, codRoteiro: number, marcado: boolean) {
    s.codRoteiros = marcado ? [...s.codRoteiros, codRoteiro] : s.codRoteiros.filter(r => r !== codRoteiro);
    if (marcado) this.carregarRoteiro(codRoteiro);
  }

  private carregarRoteiro(codRoteiro: number) {
    if (this.roteiros().has(codRoteiro)) return;
    this.service.roteiro(codRoteiro).subscribe({
      next: r => this.roteiros.update(m => new Map(m).set(codRoteiro, r)),
      error: () => {},
    });
  }

  arvore(s: SistemaForm) {
    return s.codRoteiros.map(c => this.roteiros().get(c)).filter((r): r is RoteiroPadrao => !!r);
  }

  /** D-15: com módulos, o escopo ganha o nível módulo (desmarcar tira todos os itens dele); "Sem módulo" no fim. */
  gruposEscopo(s: SistemaForm, r: RoteiroPadrao) {
    const ativos = r.agrupamentos.filter(a => a.ativo);
    const catalogo = this.catalogoDo(s.codSistema);
    return catalogo?.trabalhaModulo ? porModulo(catalogo.modulos, ativos) : [{ codModulo: null, nome: '', itens: ativos }];
  }

  itensDoGrupo(agrupamentos: AgrupamentoPadrao[]) {
    return agrupamentos.flatMap(a => a.itens);
  }

  /** D-16: agrupamentos ativos dos roteiros escolhidos ainda sem módulo (só aviso, não bloqueia). */
  semModulo(s: SistemaForm) {
    if (!this.catalogoDo(s.codSistema)?.trabalhaModulo) return 0;
    return this.arvore(s).reduce((soma, r) => soma + r.agrupamentos.filter(a => a.ativo && a.codModulo === null).length, 0);
  }

  itensAtivos(s: SistemaForm): number[] {
    return this.arvore(s).flatMap(r => r.agrupamentos.filter(a => a.ativo).flatMap(a => a.itens.filter(i => i.ativo).map(i => i.codRoteiroItem)));
  }

  totalNoEscopo(s: SistemaForm) {
    return this.itensAtivos(s).filter(c => !s.fora.has(c)).length;
  }

  alternarItem(s: SistemaForm, codItem: number, noEscopo: boolean) {
    const fora = new Set(s.fora);
    if (noEscopo) fora.delete(codItem);
    else fora.add(codItem);
    s.fora = fora;
  }

  agrupamentoMarcado(s: SistemaForm, itens: { codRoteiroItem: number; ativo: boolean }[]) {
    const ativos = itens.filter(i => i.ativo);
    return ativos.length > 0 && ativos.every(i => !s.fora.has(i.codRoteiroItem));
  }

  alternarAgrupamento(s: SistemaForm, itens: { codRoteiroItem: number; ativo: boolean }[], noEscopo: boolean) {
    const fora = new Set(s.fora);
    itens.filter(i => i.ativo).forEach(i => (noEscopo ? fora.delete(i.codRoteiroItem) : fora.add(i.codRoteiroItem)));
    s.fora = fora;
  }

  // ------------------------------------------------------------------ participantes

  usuariosFiltrados() {
    const termo = normalizarTexto(this.buscaUsuario.trim());
    return (this.catalogo()?.usuarios ?? []).filter(u => !termo || normalizarTexto(`${u.nome} ${u.login}`).includes(termo));
  }

  qtdComAcesso() {
    return (this.catalogo()?.usuarios ?? []).filter(u => u.temAcesso).length;
  }

  qtdSemAcesso() {
    return (this.catalogo()?.usuarios ?? []).filter(u => !u.temAcesso).length;
  }

  alternarDesignado(codUsuario: number, marcado: boolean) {
    const novo = new Set(this.designados);
    if (marcado) novo.add(codUsuario);
    else novo.delete(codUsuario);
    this.designados = novo;
  }

  // ------------------------------------------------------------------ salvar

  /** O que ainda falta para salvar, em texto (R-17). */
  falta(): string {
    if (!this.titulo.trim()) return 'Informe o título.';
    if (!this.codAmbiente) return 'Escolha o ambiente.';
    if (!this.previsaoInicio || !this.previsaoFim) return 'Informe a previsão de início e de fim (R-03).';
    if (this.previsaoFim < this.previsaoInicio) return 'A previsão de fim é anterior ao início.';
    if (!this.sistemas.length) return 'Inclua pelo menos um sistema.';
    const semVersao = this.planejada() ? undefined : this.sistemas.find(s => !s.salvo && !this.versoes(s).nova);
    if (semVersao) return `Sem versão de ${semVersao.nome} em ${this.ambienteNome()}: cadastre-a antes de incluir o sistema com a homologação em andamento.`;
    if (this.participacao === 'DESIGNADOS' && !this.designados.size) return 'Escolha pelo menos um participante.';
    return '';
  }

  salvar(confirmarConcorrente = false) {
    if (this.falta()) return;
    const original = this.original();
    const planejada = this.planejada();
    const dados: HomologacaoRequest = {
      titulo: this.titulo.trim(),
      descricao: this.descricao.trim() || null,
      codAmbiente: this.codAmbiente!,
      previsaoInicio: this.previsaoInicio,
      previsaoFim: this.previsaoFim,
      codResponsavel: this.codResponsavel,
      ticketMv: this.ticketMv.trim() || null,
      participacao: this.participacao,
      participantesIncluemItens: this.participantesIncluemItens,
      sistemas: this.sistemas.map(s => ({
        codSistema: s.codSistema,
        codRoteiros: s.codRoteiros,
        itensForaEscopo: [...s.fora].filter(c => this.itensAtivos(s).includes(c)),
      })),
      designados: [...this.designados],
      confirmarConcorrente,
    };
    let chamada: Observable<HomologacaoDetalhe> = original ? this.service.alterar(original.codHomologacao, dados) : this.service.criar(dados);
    // Depois de iniciada, participação e designados mudam pelo comando próprio (quem sai não pode ter item pendente).
    if (original && !planejada && this.participantesMudaram(original)) {
      const cod = original.codHomologacao;
      const alterar = chamada;
      chamada = new Observable<HomologacaoDetalhe>(sub => {
        alterar.subscribe({
          next: () => this.service.alterarParticipantes(cod, this.participacao, [...this.designados]).subscribe(sub),
          error: e => sub.error(e),
        });
      });
    }
    this.salvando.set(true);
    chamada.pipe(finalize(() => this.salvando.set(false))).subscribe({
      next: d => {
        this.toast.success(original ? 'Homologação salva.' : `Homologação ${d.numero} criada.`);
        this.router.navigate([`${ROTA_BASE}/homologacoes-detalhe`], { queryParams: { id: d.codHomologacao } });
      },
      error: (erro: { original?: { error?: { errorCode?: string; message?: string } } }) => {
        if (erro?.original?.error?.errorCode === 'HOMOLOGACAO_CONCORRENTE') {
          this.dialog
            .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
              data: {
                titulo: 'Mesmo sistema em outra homologação',
                mensagem: `${erro.original.error.message ?? ''} Salvar mesmo assim?`,
                confirmarTexto: 'Salvar mesmo assim',
                cancelarTexto: 'Voltar',
              },
            })
            .afterClosed()
            .subscribe(ok => ok && this.salvar(true));
        }
      },
    });
  }

  private participantesMudaram(d: HomologacaoDetalhe) {
    const antes = new Set(d.designados);
    return d.participacao !== this.participacao || antes.size !== this.designados.size || [...this.designados].some(c => !antes.has(c));
  }

  voltar() {
    const original = this.original();
    if (original) {
      this.router.navigate([`${ROTA_BASE}/homologacoes-detalhe`], { queryParams: { id: original.codHomologacao } });
    } else {
      this.router.navigate([`${ROTA_BASE}/homologacoes-gestao`]);
    }
  }
}
