import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

// Material
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { ChangeDetectorRef } from '@angular/core';

// Modelos e Serviços
import { Sprint, SprintTicket, Ticket, StatusEntrega } from '@core';
import { SprintService } from '../sprintService';
import { TicketService } from '../../ticketService';
import { PainelSugestoesComponent } from '../sugestao/painel-suestao.componente';
import { SugestaoSprintService } from '../sugestao/sugestao-ticket-sprint.service';

// Configuração do formato de data brasileiro
import { MAT_DATE_FORMATS, MAT_DATE_LOCALE, DateAdapter } from '@angular/material/core';

export const MY_DATE_FORMATS = {
  parse: { dateInput: 'DD/MM/YYYY' },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY'
  }
};

@Component({
  selector: 'app-editar-sprint',
  templateUrl: './editarSprint.html',
  styleUrls: ['./editarSprint.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatChipsModule,
    MatTooltipModule,
    MatBadgeModule,
    PainelSugestoesComponent,
  ],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' },
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS }
  ]
})
export class EditarSprintComponent implements OnInit, OnDestroy {
  form: FormGroup;
  buscaControl = new FormControl('');
  filtroTipo: string | null = null;
  filtroPrioridade: string | null = null;

  carregandoSprint = false;
  carregandoTickets = false;
  carregandoSprints = false;
  enviando = false;

  sprintId: number = 0;
  sprintAtual: Sprint | null = null;

  sprintsDisponiveis: Sprint[] = [];
  todosTickets: Ticket[] = [];
  ticketsSelecionados: Ticket[] = [];       // view model com criticidade
  ticketsOriginais: Ticket[] = [];          // cópia para detectar alterações

  filtroAtivo = {
    tipos: [] as string[],
    prioridades: [] as string[],
    search: ''
  };

  tiposDisponiveis: string[] = [];
  prioridadesDisponiveis: string[] = ['ALTA', 'MEDIA', 'BAIXA'];

  opcoesCriticidade = [
    { valor: 1, descricao: 'Crítica' },
    { valor: 2, descricao: 'Alta' },
    { valor: 3, descricao: 'Média' },
    { valor: 4, descricao: 'Baixa' }
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private sprintService: SprintService,
    private ticketService: TicketService,
    private sugestaoService: SugestaoSprintService,
    private snackBar: MatSnackBar,
    private router: Router,
    private route: ActivatedRoute,
    private dateAdapter: DateAdapter<Date>,
    private cdr: ChangeDetectorRef
  ) {
    this.dateAdapter.setLocale('pt-BR');
    this.form = this.fb.group({
      nome: ['', [Validators.required, Validators.maxLength(100)]],
      dataInicio: ['', Validators.required],
      dataFim: ['', Validators.required],
      objetivo: ['', Validators.maxLength(500)]
    }, { validators: this.validarDatas });
  }

  ngOnInit(): void {
    this.carregarSprintsDisponiveis();
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const id = params['id'];
      if (id) {
        this.sprintId = +id;
        this.carregarSprint();
      }
    });

    // 🔍 FILTRO DE BUSCA EM TEMPO REAL
    this.buscaControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(valor => {
        this.filtroAtivo.search = valor?.toLowerCase() || '';
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  trackByTicketId(index: number, ticket: Ticket): string {
    return ticket.id;
  }

  // ------------------------------------------------------------------------
  // CARREGAMENTO DE DADOS
  // ------------------------------------------------------------------------

  private carregarSprintsDisponiveis(): void {
    this.carregandoSprints = true;
    this.sprintService.getSprints()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sprints: Sprint[]) => {
          this.sprintsDisponiveis = sprints.filter(s => s.status !== 'CANCELADA');
          this.carregandoSprints = false;
          if (this.sprintId === 0 && this.sprintsDisponiveis.length > 0) {
            const primeira = this.sprintsDisponiveis[0];
            if (primeira?.id) {
              this.sprintId = primeira.id;
              this.carregarSprint();
            }
          }
        },
        error: (error: any) => {
          console.error('Erro ao carregar sprints:', error);
          this.carregandoSprints = false;
          this.snackBar.open('Erro ao carregar sprints disponíveis', 'Fechar', { duration: 5000 });
        }
      });
  }

private carregarSprint(): void {
  if (this.sprintId === 0) {
    this.resetarEstado();
    return;
  }

  this.carregandoSprint = true;
  this.cdr.detectChanges();   // <-- notifica Angular

  this.sprintService.getSprint(this.sprintId)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (sprint: Sprint) => {
        this.sprintAtual = sprint;
        this.preencherFormulario(sprint);
        this.ticketsSelecionados = this.formatarTicketsDaSprint(sprint.tickets || []);
        this.ticketsOriginais = JSON.parse(JSON.stringify(this.ticketsSelecionados));
        this.carregandoSprint = false;
        this.cdr.detectChanges();   // <-- notifica Angular

        this.carregarTicketsDisponiveis();
      },
      error: (error: any) => {
        console.error('Erro ao carregar sprint:', error);
        this.carregandoSprint = false;
        this.cdr.detectChanges();   // <-- notifica Angular
        this.resetarEstado();
        this.snackBar.open('Erro ao carregar sprint', 'Fechar', { duration: 5000 });
      }
    });
}

  /**
   * Converte a lista de SprintTicket (vinda do backend) no modelo Ticket usado no componente.
   */
  private formatarTicketsDaSprint(sprintTickets: SprintTicket[]): Ticket[] {
    return sprintTickets.map(st => {
      const ticket = st.ticket;   // TicketChamado
      return {
        id: ticket.id,
        titulo: ticket.titulo || 'Sem título',
        descricao: ticket.descricao,
        tipo: this.extrairTipoDoTicket(ticket), // se houver campo tipo no seu modelo
        prioridade: this.extrairPrioridade(ticket), // se houver
        criticidade: st.criticidade
      };
    });
  }

  // Métodos auxiliares para extrair tipo/prioridade do TicketChamado (ajuste conforme seu modelo)
  private extrairTipoDoTicket(ticket: any): string {
    // Se existir um campo 'tipo' ou mapeamento próprio
    return ticket.tipo || 'TAREFA';
  }

  private extrairPrioridade(ticket: any): string {
    return ticket.prioridade || 'MEDIA';
  }

  private preencherFormulario(sprint: Sprint): void {
    const dataInicio = this.converterParaDate(sprint.dataInicio);
    const dataFim = this.converterParaDate(sprint.dataFim);

    this.form.patchValue({
      nome: sprint.nome || '',
      objetivo: sprint.objetivo || '',
      dataInicio: dataInicio,
      dataFim: dataFim
    }, { emitEvent: false });

    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  private converterParaDate(data: string | Date): Date | null {
    if (!data) return null;
    if (data instanceof Date) return data;
    const str = String(data);
    if (str.includes('T')) return new Date(str);
    const [year, month, day] = str.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private resetarEstado(): void {
    this.sprintAtual = null;
    this.form.reset();
    this.ticketsSelecionados = [];
    this.ticketsOriginais = [];
    this.todosTickets = [];
  }

  onSprintSelecionada(id: number): void {
    if (id && id !== this.sprintId) {
      this.sprintId = id;
      this.carregarSprint();
    }
  }

  criarNovaSprint(): void {
    this.router.navigate(['/ticket/sprint/sprint-criar']);
  }

carregarTicketsDisponiveis(): void {
  this.carregandoTickets = true;
  this.cdr.detectChanges();   // <-- notifica Angular

  this.ticketService.getTicketsDisponiveis()
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (tickets: Ticket[]) => {
        const idsSelecionados = this.ticketsSelecionados.map(t => t.id);
        this.todosTickets = tickets.filter(t => !idsSelecionados.includes(t.id));
        this.extrairOpcoesFiltro();
        this.carregandoTickets = false;
        this.cdr.detectChanges();   // <-- notifica Angular
      },
      error: (error: any) => {
        console.error('Erro ao carregar tickets:', error);
        this.carregandoTickets = false;
        this.cdr.detectChanges();   // <-- notifica Angular
        this.snackBar.open('Erro ao carregar tickets disponíveis', 'Fechar', { duration: 5000 });
      }
    });
 }

  // ------------------------------------------------------------------------
  // VALIDAÇÕES
  // ------------------------------------------------------------------------

  private validarDatas(formGroup: FormGroup) {
    const inicio = formGroup.get('dataInicio')?.value;
    const fim = formGroup.get('dataFim')?.value;
    if (inicio && fim && new Date(inicio) > new Date(fim)) {
      formGroup.get('dataFim')?.setErrors({ dataInvalida: true });
      return { dataInvalida: true };
    }
    return null;
  }

  // ------------------------------------------------------------------------
  // FILTROS E SELEÇÃO DE TICKETS
  // ------------------------------------------------------------------------

  private extrairOpcoesFiltro(): void {
    const tiposSet = new Set<string>();
    this.todosTickets.forEach(ticket => {
      if (ticket.tipo) tiposSet.add(ticket.tipo);
    });
    this.tiposDisponiveis = Array.from(tiposSet).sort();
  }

  get ticketsDisponiveis(): Ticket[] {
    let filtrados = this.todosTickets.filter(t =>
      !this.ticketsSelecionados.some(s => s.id === t.id)
    );

    if (this.filtroAtivo.search) {
      const search = this.filtroAtivo.search.toLowerCase();
      filtrados = filtrados.filter(t =>
        t.titulo?.toLowerCase().includes(search) ||
        t.id?.toString().includes(this.filtroAtivo.search) ||
        t.descricao?.toLowerCase().includes(search)
      );
    }

    if (this.filtroTipo) {
      filtrados = filtrados.filter(t => t.tipo === this.filtroTipo);
    }

    if (this.filtroPrioridade) {
      filtrados = filtrados.filter(t => t.prioridade === this.filtroPrioridade);
    }

    return filtrados;
  }

  contarTicketsPorTipo(tipo: string): number {
    return this.todosTickets.filter(t =>
      !this.ticketsSelecionados.some(s => s.id === t.id) && t.tipo === tipo
    ).length;
  }

  contarTicketsPorPrioridade(prioridade: string): number {
    return this.todosTickets.filter(t =>
      !this.ticketsSelecionados.some(s => s.id === t.id) && t.prioridade === prioridade
    ).length;
  }

  aplicarFiltroTipo(tipo: string): void {
    this.filtroTipo = this.filtroTipo === tipo ? null : tipo;
    this.filtroAtivo.tipos = this.filtroTipo ? [this.filtroTipo] : [];
  }

  aplicarFiltroPrioridade(prioridade: string): void {
    this.filtroPrioridade = this.filtroPrioridade === prioridade ? null : prioridade;
    this.filtroAtivo.prioridades = this.filtroPrioridade ? [this.filtroPrioridade] : [];
  }

  isTicketSelected(ticket: Ticket): boolean {
    return this.ticketsSelecionados.some(t => t.id === ticket.id);
  }

  limparFiltros(): void {
    this.filtroTipo = null;
    this.filtroPrioridade = null;
    this.buscaControl.setValue('');
    this.filtroAtivo = { tipos: [], prioridades: [], search: '' };
  }

  selecionarTicket(ticket: Ticket): void {
    if (!this.isTicketSelected(ticket)) {
      this.ticketsSelecionados.push({ ...ticket, criticidade: 3 });
    }
  }

  adicionarTicket(ticket: Ticket): void {
    this.selecionarTicket(ticket);
  }

  atualizarCriticidade(ticket: Ticket, criticidade: number): void {
    const idx = this.ticketsSelecionados.findIndex(t => t.id === ticket.id);
    if (idx !== -1) this.ticketsSelecionados[idx].criticidade = criticidade;
  }

  removerTicket(ticket: Ticket): void {
    const idx = this.ticketsSelecionados.findIndex(t => t.id === ticket.id);
    if (idx !== -1) {
      //this.ticketsSelecionados.splice(idx, 1);
        const [removed] = this.ticketsSelecionados.splice(idx, 1); // remove e captura o objeto removido
        if (!this.todosTickets.some(t => t.id === removed.id)) {
          this.todosTickets.push(removed);
        }
    }
  }

  removerTicketSelecionado(ticket: Ticket): void {
    this.removerTicket(ticket);
  }

  // ------------------------------------------------------------------------
  // UTILITÁRIOS DE FORMATAÇÃO
  // ------------------------------------------------------------------------

  private formatarDataParaAPI(data: any): string {
    if (!data) return '';
    const dateObj = data instanceof Date ? data : new Date(data);
    if (isNaN(dateObj.getTime())) return '';
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getDescricaoCriticidade(criticidade: number): string {
    const op = this.opcoesCriticidade.find(o => o.valor === criticidade);
    return op ? op.descricao : 'Não definida';
  }

  // ------------------------------------------------------------------------
  // DETECÇÃO DE ALTERAÇÕES
  // ------------------------------------------------------------------------

  isTicketOriginal(ticket: Ticket): boolean {
    return this.ticketsOriginais.some(t => t.id === ticket.id);
  }

  isTicketNovo(ticket: Ticket): boolean {
    return !this.isTicketOriginal(ticket);
  }

  get houveAlteracoes(): boolean {
    if (!this.sprintAtual || this.sprintId === 0) return false;

    // 1. Dados básicos da sprint
    const formVal = this.form.value;
    const dadosAlterados =
      formVal.nome !== this.sprintAtual.nome ||
      formVal.objetivo !== (this.sprintAtual.objetivo || '') ||
      this.formatarDataParaAPI(formVal.dataInicio) !== this.sprintAtual.dataInicio ||
      this.formatarDataParaAPI(formVal.dataFim) !== this.sprintAtual.dataFim;

    // 2. Tickets (adição/remoção/alteração de criticidade)
    const idsOriginais = this.ticketsOriginais.map(t => t.id).sort();
    const idsAtuais = this.ticketsSelecionados.map(t => t.id).sort();
    const ticketsAlterados = JSON.stringify(idsOriginais) !== JSON.stringify(idsAtuais);

    let criticidadeAlterada = false;
    if (!ticketsAlterados) {
      for (const ticket of this.ticketsSelecionados) {
        const original = this.ticketsOriginais.find(t => t.id === ticket.id);
        if (original && original.criticidade !== ticket.criticidade) {
          criticidadeAlterada = true;
          break;
        }
      }
    }

    return dadosAlterados || ticketsAlterados || criticidadeAlterada || this.form.dirty;
  }

  // ------------------------------------------------------------------------
  // SUBMISSÃO (ATUALIZAÇÃO EM DUAS ETAPAS)
  // ------------------------------------------------------------------------

  onSubmit(): void {
    if (this.form.invalid || this.sprintId === 0) {
      this.marcarCamposComoTocados();
      this.snackBar.open('Preencha todos os campos obrigatórios', 'Fechar', { duration: 5000 });
      return;
    }

    this.enviando = true;

    // 1. Atualizar dados básicos da sprint
    const sprintAtualizada: Partial<Sprint> = {
      nome: this.form.get('nome')?.value,
      objetivo: this.form.get('objetivo')?.value || '',
      dataInicio: this.formatarDataParaAPI(this.form.get('dataInicio')?.value),
      dataFim: this.formatarDataParaAPI(this.form.get('dataFim')?.value)
    };

    this.sprintService.atualizarSprint(this.sprintId, sprintAtualizada)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          // Após atualizar os dados, processa os tickets
          this.processarAlteracoesTickets();
        })
      )
      .subscribe({
        next: () => {
          this.snackBar.open('Sprint atualizada com sucesso!', 'Fechar', { duration: 3000 });
        },
        error: (error: any) => {
          console.error('Erro ao atualizar sprint:', error);
          this.enviando = false;
          this.exibirErro(error);
        }
      });
  }

  /**
   * Processa adições, remoções e atualizações de criticidade dos tickets.
   */
  private processarAlteracoesTickets(): void {
    const idsOriginais = this.ticketsOriginais.map(t => t.id);
    const idsAtuais = this.ticketsSelecionados.map(t => t.id);

    // Tickets removidos (estavam nos originais, não estão nos atuais)
    const idsRemover = idsOriginais.filter(id => !idsAtuais.includes(id));


    // Tickets adicionados (estão nos atuais, não estavam nos originais)
    const ticketsAdicionar = this.ticketsSelecionados.filter(t => !idsOriginais.includes(t.id));

    // Tickets com criticidade alterada (presentes em ambos, mas criticidade diferente)
    const ticketsAtualizarCriticidade = this.ticketsSelecionados.filter(t => {
      const original = this.ticketsOriginais.find(orig => orig.id === t.id);
      return original && original.criticidade !== t.criticidade;
    });

    const operacoes: any[] = [];

    // Requisições de remoção
    idsRemover.forEach(id => {
      operacoes.push(this.sprintService.removerTicketDaSprint(this.sprintId, id));
    });

    // Requisições de adição
    ticketsAdicionar.forEach(ticket => {
      operacoes.push(this.sprintService.adicionarTicketASprint(
        this.sprintId,
        ticket.id,
        ticket.criticidade ?? 3
      ));
    });

    if (ticketsAtualizarCriticidade.length > 0) {
       ticketsAtualizarCriticidade.forEach(ticket => {
        operacoes.push(this.sprintService.atualizarStatusTicket(
          this.sprintId,
          ticket.id,
          null,
          ticket.criticidade
        ));
      });
    }

    if (operacoes.length === 0) {
      this.finalizarAtualizacao();
      return;
    }

    // Executa todas as operações em paralelo
    forkJoin(operacoes)
      .pipe(finalize(() => this.finalizarAtualizacao()))
      .subscribe({
        next: () => {
          this.snackBar.open('Tickets sincronizados com sucesso!', 'Fechar', { duration: 3000 });
        },
        error: (error: any) => {
          console.error('Erro ao sincronizar tickets:', error);
          this.exibirErro(error, 'Erro ao atualizar tickets');
        }
      });
  }

  private finalizarAtualizacao(): void {
    this.enviando = false;
    // Recarrega a sprint para obter o estado mais recente
    this.carregarSprint();
  }

  private exibirErro(error: any, mensagemPadrao = 'Erro ao atualizar sprint'): void {
    let msg = mensagemPadrao;
    if (error.error?.message) msg = error.error.message;
    else if (error.status === 400) msg = 'Dados inválidos. Verifique os campos.';
    else if (error.status === 404) msg = 'Sprint não encontrada.';
    else if (error.status === 500) msg = 'Erro interno do servidor.';
    this.snackBar.open(msg, 'Fechar', { duration: 7000 });
  }

  private marcarCamposComoTocados(): void {
    Object.keys(this.form.controls).forEach(c => this.form.get(c)?.markAsTouched());
  }

  // ------------------------------------------------------------------------
  // CANCELAMENTO
  // ------------------------------------------------------------------------

  // ------------------------------------------------------------------------
  // SUGESTÕES DE TICKETS
  // ------------------------------------------------------------------------

  /**
   * Recebe evento do painel de sugestões.
   * Como sprintId já existe (editar), o painel já marcou a sugestão como atendida.
   * Aqui apenas adicionamos o ticket ao form se ainda não estiver.
   */
  incluirTicketSugerido(evento: { ticketId: string; sugestaoId: number | null }): void {
    const ticket = this.todosTickets.find(t => t.id === evento.ticketId);
    if (ticket && !this.isTicketSelected(ticket)) {
      this.selecionarTicket(ticket);
      this.snackBar.open(`Ticket #${evento.ticketId} incluído via sugestão.`, 'Fechar', { duration: 3000 });
    }
  }

  cancelar(): void {
    if (this.houveAlteracoes) {
      if (confirm('Tem certeza que deseja cancelar? As alterações não salvas serão perdidas.')) {
        this.navegarParaSprint();
      }
    } else {
      this.navegarParaSprint();
    }
  }

  private navegarParaSprint(): void {
    if (this.sprintId !== 0) {
      this.router.navigate(['/sprints', this.sprintId]);
    } else {
      this.router.navigate(['/sprints']);
    }
  }
}
