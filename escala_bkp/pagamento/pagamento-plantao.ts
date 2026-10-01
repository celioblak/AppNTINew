// =========================================================
// pagamento-plantao.ts
// =========================================================
import { Component, OnInit, ChangeDetectorRef, ViewChild, TemplateRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MtxGridModule, MtxGridColumn } from '@ng-matero/extensions/grid';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '@core';
import { PagamentoPlantaoService } from './pagamento-plantao.service';
import {
  PlantaoDisponivelDTO,
  PlantaoEnviadoDTO,
  PlantaoNaoPagoDTO,
  RemessaDTO,
  EnviarPagamentoRequest,
  MarcarNaoPagoRequest,
} from '@core';

@Component({
  selector: 'app-pagamento-plantao',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatCheckboxModule,
    MtxGridModule,
    MatDatepickerModule,
  ],
  templateUrl: './pagamento-plantao.html',
  styleUrls: ['./pagamento-plantao.scss'],
})
export class PagamentoPlantaoComponent implements OnInit {

  // ── Usuário logado (igual ao escala.component) ────────
  private readonly auth = inject(AuthService);
  usuarioLogado = toSignal(this.auth.user());

  private get usuarioLogadoId(): number {
    const cod = this.usuarioLogado()?.['codusuario'];
    if (cod == null) return 0;
    return typeof cod === 'string' ? parseInt(cod, 10) : (cod as number);
  }

  // ── Templates para o mtx-grid ─────────────────────────
  @ViewChild('selTpl',    { static: true }) selTpl!:    TemplateRef<any>;
  @ViewChild('opTpl',     { static: true }) opTpl!:     TemplateRef<any>;
  @ViewChild('opNaoPago', { static: true }) opNaoPago!: TemplateRef<any>;

  // ── Filtros ───────────────────────────────────────────
  filtroInicio: Date | null = new Date(new Date().getFullYear(), 0, 1);
  filtroFim:    Date | null = new Date();
  incluirFuturos = false;

  // ── Seleção de não pagos ───────────────────────────────
  selecionadosNaoPagos = new Set<number>();
  get algumNaoPagoSelecionado(): boolean { return this.selecionadosNaoPagos.size > 0; }

  // ── Modal excluir remessa ──────────────────────────────
  modalExcluirRemessaAberto = false;
  remessaParaExcluir: RemessaDTO | null = null;

  // ── Dados ─────────────────────────────────────────────
  plantoesDisponiveis: PlantaoDisponivelDTO[] = [];
  totalHorasDisponiveis = 0;

  remessas: RemessaDTO[] = [];
  plantoesRemessa: PlantaoEnviadoDTO[] = [];
  remessaExpandida: number | null = null;

  plantoesNaoPagos: PlantaoNaoPagoDTO[] = [];

  // ── Seleção ───────────────────────────────────────────
  selecionados = new Set<number>();

  get todosSelecionados(): boolean {
    return this.plantoesDisponiveis.length > 0 &&
           this.selecionados.size === this.plantoesDisponiveis.length;
  }
  get algumSelecionado(): boolean { return this.selecionados.size > 0; }
  get totalHorasSelecionadas(): number {
    return this.plantoesDisponiveis
      .filter(p => this.selecionados.has(p.idPlantao))
      .reduce((acc, p) => acc + (p.horasCalculadas ?? 0), 0);
  }

  // ── Modal ─────────────────────────────────────────────
  modalEnvioAberto    = false;
  modalNaoPagarAberto = false;
  observacaoEnvio     = '';
  motivoNaoPagar      = '';

  // ── Estado ────────────────────────────────────────────
  carregando       = false;
  mensagemSucesso  = '';
  mensagemErro     = '';

  // ── Colunas mtx-grid ──────────────────────────────────
  colunasDisponiveis: MtxGridColumn[] = [];

  colunasRemessa: MtxGridColumn[] = [];

  colunasNaoPagos: MtxGridColumn[] = [];

  colunasDetalheRemessa: MtxGridColumn[] = [
    { header: 'Colaborador', field: 'nomeColaborador' },
    { header: 'Matrícula',  field: 'matricula',   width: '110px' },
    { header: 'Data',       field: 'dataPlantao', width: '110px',
      formatter: (row: PlantaoEnviadoDTO) => this.formatarData(row.dataPlantao) },
    { header: 'Horário',    field: 'horario',
      formatter: (row: PlantaoEnviadoDTO) => `${row.horaInicio} → ${row.horaFim}` },
    { header: 'Tipo',       field: 'tipoPlantao' },
    { header: 'Observação', field: 'observacao' },
  ];

  constructor(
    private service: PagamentoPlantaoService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.definirColunas();
    this.carregarDisponiveis();
  }

  definirColunas(): void {
    this.colunasDisponiveis = [
      { header: '', field: 'selecao', width: '50px', cellTemplate: this.selTpl },
      { header: 'Colaborador', field: 'nomeColaborador', sortable: true },
      { header: 'Matrícula',   field: 'matricula',        width: '110px' },
      { header: 'Data',        field: 'dataPlantao',      sortable: true, width: '110px',
        formatter: (row: PlantaoDisponivelDTO) => this.formatarData(row.dataPlantao) },
      { header: 'Início', field: 'horaInicio', width: '80px' },
      { header: 'Fim',    field: 'horaFim',    width: '80px' },
      { header: 'Tipo',   field: 'tipoPlantao', sortable: true },
      { header: 'Horas',  field: 'horasCalculadas', width: '80px',
        formatter: (row: PlantaoDisponivelDTO) => this.formatarHoras(row.horasCalculadas) },
    ];

    this.colunasRemessa = [
      { header: 'Remessa',     field: 'numeroRemessa', width: '90px' },
      { header: 'Data Envio',  field: 'dataEnvio',     sortable: true,
        formatter: (row: RemessaDTO) => this.formatarDataHora(row.dataEnvio) },
      { header: 'Enviado por', field: 'enviadoPorNome' },
      { header: 'Plantões',    field: 'totalPlantoes', width: '90px' },
      { header: 'Período',     field: 'periodo',
        formatter: (row: RemessaDTO) =>
          `${this.formatarData(row.dataPlantaoInicio)} → ${this.formatarData(row.dataPlantaoFim)}` },
      { header: 'Ações', field: 'acoes', width: '130px', cellTemplate: this.opTpl },
    ];

    this.colunasNaoPagos = [
      { header: '',            field: 'selNaoPago',         width: '50px', cellTemplate: this.opNaoPago },
      { header: 'Colaborador', field: 'nomeColaborador',    sortable: true },
      { header: 'Matrícula',   field: 'matricula',          width: '110px' },
      { header: 'Data',        field: 'dataPlantao',        width: '110px',
        formatter: (row: PlantaoNaoPagoDTO) => this.formatarData(row.dataPlantao) },
      { header: 'Horário',     field: 'horario',
        formatter: (row: PlantaoNaoPagoDTO) => `${row.horaInicio} → ${row.horaFim}` },
      { header: 'Tipo',        field: 'tipoPlantao' },
      { header: 'Motivo',      field: 'motivoNaoPago' },
      { header: 'Marcado por', field: 'marcadoPorNome' },
      { header: 'Quando',      field: 'dataMarcacaoNaoPago',
        formatter: (row: PlantaoNaoPagoDTO) => this.formatarDataHora(row.dataMarcacaoNaoPago) },
    ];
  }

  // helper: Date → string ISO para o service
  private dateToISO(d: Date | null): string | undefined {
    if (!d) return undefined;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // =========================================================
  // DISPONÍVEIS
  // =========================================================

  carregarDisponiveis(): void {
    this.carregando = true;
    this.selecionados = new Set<number>();
    this.cdr.detectChanges();

    this.service.buscarDisponiveis(
      this.dateToISO(this.filtroInicio),
      this.dateToISO(this.filtroFim),
      this.incluirFuturos,
    ).subscribe({
      next: res => {
        this.plantoesDisponiveis   = [...res.plantoes];
        this.totalHorasDisponiveis = res.totalHoras;
        this.carregando = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.mensagemErro = 'Erro ao carregar plantões disponíveis.';
        this.carregando   = false;
        this.cdr.detectChanges();
      },
    });
  }

  toggleTodos(): void {
    if (this.todosSelecionados) {
      this.selecionados = new Set<number>();
    } else {
      this.selecionados = new Set<number>(this.plantoesDisponiveis.map(p => p.idPlantao));
    }
    this.cdr.detectChanges();
  }

  togglePlantao(id: number): void {
    const novo = new Set<number>(this.selecionados);
    novo.has(id) ? novo.delete(id) : novo.add(id);
    this.selecionados = novo;
    this.cdr.detectChanges();
  }

  isSelecionado(id: number): boolean { return this.selecionados.has(id); }

  // ── Modal envio ───────────────────────────────────────
  abrirModalEnvio(): void {
    if (!this.algumSelecionado) return;
    this.observacaoEnvio = '';
    this.modalEnvioAberto = true;
    this.cdr.detectChanges();
  }

  confirmarEnvio(): void {
    this.modalEnvioAberto = false;
    this.carregando = true;
    this.cdr.detectChanges();

    // Seta o userId no localStorage para o service pegar via header X-User-Id
    localStorage.setItem('userId', String(this.usuarioLogadoId));

    const req: EnviarPagamentoRequest = {
      idsPlantoes: Array.from(this.selecionados),
      observacao: this.observacaoEnvio || undefined,
    };

    this.service.enviarParaPagamento(req).subscribe({
      next: res => {
        this.mensagemSucesso = res.mensagem;
        this.downloadExcelAuto(res.remessa.numeroRemessa);
        this.carregarDisponiveis();
      },
      error: err => {
        this.mensagemErro = err?.error?.erro ?? 'Erro ao enviar para pagamento.';
        this.carregando   = false;
        this.cdr.detectChanges();
      },
    });
  }

  // ── Modal não pagar ───────────────────────────────────
  abrirModalNaoPagar(): void {
    if (!this.algumSelecionado) return;
    this.motivoNaoPagar = '';
    this.modalNaoPagarAberto = true;
    this.cdr.detectChanges();
  }

  confirmarNaoPagar(): void {
    if (!this.motivoNaoPagar.trim()) return;
    this.modalNaoPagarAberto = false;
    this.carregando = true;
    this.cdr.detectChanges();

    localStorage.setItem('userId', String(this.usuarioLogadoId));

    const req: MarcarNaoPagoRequest = {
      idsPlantoes: Array.from(this.selecionados),
      motivo: this.motivoNaoPagar,
    };

    this.service.marcarNaoPago(req).subscribe({
      next: res => {
        this.mensagemSucesso = res.mensagem;
        this.carregarDisponiveis();
      },
      error: err => {
        this.mensagemErro = err?.error?.erro ?? 'Erro ao marcar como não pagar.';
        this.carregando   = false;
        this.cdr.detectChanges();
      },
    });
  }

  fecharModais(): void {
    this.modalEnvioAberto          = false;
    this.modalNaoPagarAberto       = false;
    this.modalExcluirRemessaAberto = false;
    this.remessaParaExcluir        = null;
    this.cdr.detectChanges();
  }

  // =========================================================
  // REMESSAS
  // =========================================================

  carregarRemessas(): void {
    this.carregando = true;
    this.cdr.detectChanges();

    this.service.buscarRemessas().subscribe({
      next: res => {
        this.remessas   = [...res.remessas];
        this.carregando = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.mensagemErro = 'Erro ao carregar remessas.';
        this.carregando   = false;
        this.cdr.detectChanges();
      },
    });
  }

  expandirRemessa(row: RemessaDTO): void {
    const num = row.numeroRemessa;
    if (this.remessaExpandida === num) {
      this.remessaExpandida = null;
      this.plantoesRemessa  = [];
      this.cdr.detectChanges();
      return;
    }
    this.remessaExpandida = num;
    this.service.buscarEnviados(num).subscribe({
      next: res => {
        this.plantoesRemessa = [...res.plantoes];
        this.cdr.detectChanges();
      },
      error: () => {
        this.mensagemErro = 'Erro ao carregar plantões da remessa.';
        this.cdr.detectChanges();
      },
    });
  }

  downloadExcel(num: number): void {
    this.service.downloadExcel(num).subscribe({
      next: blob => this.salvarBlob(blob, `Remessa_${num}_Horas_Extras_NTI.xlsx`),
      error: () => { this.mensagemErro = 'Erro ao gerar Excel.'; this.cdr.detectChanges(); },
    });
  }

  private downloadExcelAuto(num: number): void {
    this.service.downloadExcel(num).subscribe({
      next: blob => this.salvarBlob(blob, `Remessa_${num}_Horas_Extras_NTI.xlsx`),
      error: () => {},
    });
  }

  private salvarBlob(blob: Blob, nome: string): void {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href = url; a.download = nome; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Excluir remessa ───────────────────────────────────
  abrirModalExcluirRemessa(row: RemessaDTO): void {
    this.remessaParaExcluir = row;
    this.modalExcluirRemessaAberto = true;
    this.cdr.detectChanges();
  }

  confirmarExcluirRemessa(): void {
    if (!this.remessaParaExcluir) return;
    const num = this.remessaParaExcluir.numeroRemessa;
    this.modalExcluirRemessaAberto = false;
    this.carregando = true;
    this.cdr.detectChanges();

    this.service.excluirRemessa(num).subscribe({
      next: (res: { mensagem: string }) => {
        this.mensagemSucesso = res.mensagem;
        this.remessaParaExcluir = null;
        this.remessaExpandida   = null;
        this.plantoesRemessa    = [];
        this.carregarRemessas();
      },
      error: (err: any) => {
        this.mensagemErro = err?.error?.erro ?? 'Erro ao excluir remessa.';
        this.carregando   = false;
        this.cdr.detectChanges();
      },
    });
  }

  // ── Seleção de não pagos ──────────────────────────────
  toggleNaoPago(id: number): void {
    const novo = new Set<number>(this.selecionadosNaoPagos);
    novo.has(id) ? novo.delete(id) : novo.add(id);
    this.selecionadosNaoPagos = novo;
    this.cdr.detectChanges();
  }

  isSelecionadoNaoPago(id: number): boolean {
    return this.selecionadosNaoPagos.has(id);
  }

  reverterNaoPagoSelecionados(): void {
    if (!this.algumNaoPagoSelecionado) return;
    this.carregando = true;
    this.cdr.detectChanges();

    this.service.reverterNaoPago(Array.from(this.selecionadosNaoPagos)).subscribe({
      next: (res: { totalRevertidos: number; mensagem: string }) => {
        this.mensagemSucesso      = res.mensagem;
        this.selecionadosNaoPagos = new Set<number>();
        this.carregarNaoPagos();
      },
      error: (err: any) => {
        this.mensagemErro = err?.error?.erro ?? 'Erro ao reverter plantões.';
        this.carregando   = false;
        this.cdr.detectChanges();
      },
    });
  }

  // =========================================================
  // NÃO PAGOS
  // =========================================================

  carregarNaoPagos(): void {
    this.carregando = true;
    this.selecionadosNaoPagos = new Set<number>();
    this.cdr.detectChanges();

    this.service.buscarNaoPagos(
      this.dateToISO(this.filtroInicio),
      this.dateToISO(this.filtroFim),
    ).subscribe({
      next: res => {
        this.plantoesNaoPagos = [...res.plantoes];
        this.carregando       = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.mensagemErro = 'Erro ao carregar plantões não pagos.';
        this.carregando   = false;
        this.cdr.detectChanges();
      },
    });
  }

  // =========================================================
  // UTILITÁRIOS
  // =========================================================

  limparMensagens(): void {
    this.mensagemSucesso = '';
    this.mensagemErro    = '';
    this.cdr.detectChanges();
  }

  onTabChange(index: number): void {
    this.limparMensagens();
    if (index === 0) this.carregarDisponiveis();
    if (index === 1) this.carregarRemessas();
    if (index === 2) this.carregarNaoPagos();
  }

  formatarData(iso: string): string {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  formatarDataHora(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('pt-BR');
  }

  formatarHoras(h: number): string {
    if (!h) return '0h';
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return mm > 0 ? `${hh}h ${mm}min` : `${hh}h`;
  }
}
