import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

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

// Modelos e Serviços
import { Sprint, Ticket, CriarSprintRequest } from '@core';
import { SprintService } from '../sprintService';
import { TicketService } from '../../ticketService';


// Configuração do formato de data brasileiro
import { MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';
import { DateAdapter } from '@angular/material/core';
import { PainelSugestoesComponent } from '../sugestao/painel-suestao.componente';
import { SugestaoSprintService } from '../sugestao/sugestao-ticket-sprint.service';

export const MY_DATE_FORMATS = {
  parse: {
    dateInput: 'DD/MM/YYYY',
  },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY'
  },
};

interface TicketFiltro {
  tipos: string[];
  prioridades: string[];
  search: string;
}

@Component({
  selector: 'app-criar-sprint',
  templateUrl: './criarSprint.html',
  styleUrls: ['./criarSprint.scss'],
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
export class CriarSprintComponent implements OnInit, OnDestroy {
  // FORMULÁRIO COMPLETO da Sprint
  form: FormGroup;

  // Controle para busca
  buscaControl = new FormControl('');

  // Filtros ativos
  filtroTipo: string | null = null;
  filtroPrioridade: string | null = null;

  // Estados
  carregandoTickets = false;
  enviando = false;

  // Listas
  todosTickets: Ticket[] = [];
  ticketsSelecionados: Ticket[] = [];

  // Filtro ativo (para compatibilidade interna)
  filtroAtivo: TicketFiltro = {
    tipos: [],
    prioridades: [],
    search: ''
  };

  // Opções de filtro
  tiposDisponiveis: string[] = [];
  prioridadesDisponiveis: string[] = ['ALTA', 'MEDIA', 'BAIXA'];

  // Opções de criticidade para os tickets
  opcoesCriticidade = [
    { valor: 1, descricao: 'Crítica' },
    { valor: 2, descricao: 'Alta' },
    { valor: 3, descricao: 'Média' },
    { valor: 4, descricao: 'Baixa' }
  ];

  // Rastreia sugestões incluídas (ticketId → sugestaoId) para marcar como atendidas após criar sprint
  private sugestoesIncluidas = new Map<string, number>();

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private sprintService: SprintService,
    private ticketService: TicketService,
    private sugestaoService: SugestaoSprintService,
    private snackBar: MatSnackBar,
    private router: Router,
    private dateAdapter: DateAdapter<Date>,
    private cdr: ChangeDetectorRef
  ) {
    // Configurar locale para português
    this.dateAdapter.setLocale('pt-BR');

    // Inicializar formulário COMPLETO da sprint
    this.form = this.fb.group({
      nome: ['', [Validators.required, Validators.maxLength(100)]],
      dataInicio: ['', Validators.required],
      dataFim: ['', Validators.required],
      objetivo: ['', Validators.maxLength(500)]
    }, { validators: this.validarDatas });
  }

  ngOnInit(): void {
    // Carregar tickets disponíveis
    this.carregarTicketsDisponiveis();

    // Configurar observáveis
    this.configurarObservaveis();
  }

  ngOnDestroy(): void {
    this.sugestoesIncluidas.clear();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Validador de datas
   */
  private validarDatas(formGroup: FormGroup) {
    const inicio = formGroup.get('dataInicio')?.value;
    const fim = formGroup.get('dataFim')?.value;

    if (inicio && fim && new Date(inicio) > new Date(fim)) {
      formGroup.get('dataFim')?.setErrors({ dataInvalida: true });
      return { dataInvalida: true };
    }
    return null;
  }

  /**
   * Configura os observáveis para reatividade
   */
  private configurarObservaveis(): void {
    // Observar mudanças na busca
    this.buscaControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(valor => {
        this.filtroAtivo.search = valor || '';
      });
  }

  /**
   * Carrega a lista de tickets disponíveis
   */
  carregarTicketsDisponiveis(): void {
    this.carregandoTickets = true;

    this.ticketService.getTicketsDisponiveis()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tickets: Ticket[]) => {
          this.todosTickets = tickets;
          this.extrairOpcoesFiltro();
          this.carregandoTickets = false;
        },
        error: (error: any) => {
          console.error('Erro ao carregar tickets:', error);
          this.carregandoTickets = false;
          this.snackBar.open('Erro ao carregar tickets disponíveis', 'Fechar', {
            duration: 5000
          });
        }
      });
  }

  /**
   * Extrai opções de filtro dos tickets
   */
  private extrairOpcoesFiltro(): void {
    const tiposSet = new Set<string>();

    this.todosTickets.forEach(ticket => {
      if (ticket.tipo) {
        tiposSet.add(ticket.tipo);
      }
    });

    this.tiposDisponiveis = Array.from(tiposSet).sort();
  }

  /**
   * Retorna tickets disponíveis filtrados
   */
  get ticketsDisponiveis(): Ticket[] {
    let ticketsFiltrados = this.todosTickets.filter(ticket =>
      !this.ticketsSelecionados.some(selected => selected.id === ticket.id)
    );

    // Aplicar filtro de busca
    if (this.filtroAtivo.search) {
      const searchLower = this.filtroAtivo.search.toLowerCase();
      ticketsFiltrados = ticketsFiltrados.filter(ticket => {
        return ticket.titulo?.toLowerCase().includes(searchLower) ||
               ticket.id?.toString().includes(this.filtroAtivo.search) ||
               ticket.descricao?.toLowerCase().includes(searchLower);
      });
    }

    // Filtro por tipo
    if (this.filtroTipo) {
      ticketsFiltrados = ticketsFiltrados.filter(ticket =>
        ticket.tipo === this.filtroTipo
      );
    }

    // Filtro por prioridade
    if (this.filtroPrioridade) {
      ticketsFiltrados = ticketsFiltrados.filter(ticket =>
        ticket.prioridade === this.filtroPrioridade
      );
    }

    return ticketsFiltrados;
  }

  /**
   * Conta tickets por tipo
   */
  contarTicketsPorTipo(tipo: string): number {
    return this.todosTickets.filter(ticket =>
      !this.ticketsSelecionados.some(selected => selected.id === ticket.id) &&
      ticket.tipo === tipo
    ).length;
  }

  /**
   * Conta tickets por prioridade
   */
  contarTicketsPorPrioridade(prioridade: string): number {
    return this.todosTickets.filter(ticket =>
      !this.ticketsSelecionados.some(selected => selected.id === ticket.id) &&
      ticket.prioridade === prioridade
    ).length;
  }

  /**
   * Aplica filtro por tipo (toggle)
   */
  aplicarFiltroTipo(tipo: string): void {
    if (this.filtroTipo === tipo) {
      this.filtroTipo = null;
      this.filtroAtivo.tipos = [];
    } else {
      this.filtroTipo = tipo;
      this.filtroAtivo.tipos = [tipo];
    }
  }

  /**
   * Aplica filtro por prioridade (toggle)
   */
  aplicarFiltroPrioridade(prioridade: string): void {
    if (this.filtroPrioridade === prioridade) {
      this.filtroPrioridade = null;
      this.filtroAtivo.prioridades = [];
    } else {
      this.filtroPrioridade = prioridade;
      this.filtroAtivo.prioridades = [prioridade];
    }
  }

  /**
   * Verifica se um ticket está selecionado
   */
  isTicketSelected(ticket: Ticket): boolean {
    return this.ticketsSelecionados.some(t => t.id === ticket.id);
  }

  /**
   * Limpa todos os filtros
   */
  limparFiltros(): void {
    this.filtroTipo = null;
    this.filtroPrioridade = null;
    this.buscaControl.setValue('');
    this.filtroAtivo = {
      tipos: [],
      prioridades: [],
      search: ''
    };
  }

  /**
   * Seleciona um ticket (adiciona à lista de selecionados)
   */
  selecionarTicket(ticket: Ticket): void {
    if (!this.isTicketSelected(ticket)) {
      // Adiciona criticidade padrão 3 (Média) quando seleciona um ticket
      const ticketComCriticidade = {
        ...ticket,
        criticidade: 3 // Criticidade padrão
      };
      this.ticketsSelecionados.push(ticketComCriticidade);
    }
  }

  /**
   * Adiciona ticket (alias para selecionarTicket)
   */
  adicionarTicket(ticket: Ticket): void {
    this.selecionarTicket(ticket);
  }

  /**
   * Atualiza a criticidade de um ticket selecionado
   */
  atualizarCriticidade(ticket: Ticket, criticidade: number): void {
    const ticketIndex = this.ticketsSelecionados.findIndex(t => t.id === ticket.id);
    if (ticketIndex !== -1) {
      this.ticketsSelecionados[ticketIndex].criticidade = criticidade;
    }
  }

  /**
   * Remove ticket da lista de selecionados
   */
  removerTicket(ticket: Ticket): void {
    const index = this.ticketsSelecionados.findIndex(t => t.id === ticket.id);
    if (index !== -1) {
      this.ticketsSelecionados.splice(index, 1);
    }
  }

  /**
   * Remove ticket selecionado
   */
  removerTicketSelecionado(ticket: Ticket): void {
    this.removerTicket(ticket);
  }

  /**
   * Formata data para o formato YYYY-MM-DD
   */
  private formatarDataParaAPI(data: any): string {
    if (!data) return '';

    let dateObj: Date;

    if (data instanceof Date) {
      dateObj = data;
    } else {
      // Tenta converter string para Date
      dateObj = new Date(data);
      if (isNaN(dateObj.getTime())) {
        return '';
      }
    }

    // Formato ISO: YYYY-MM-DD
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  /**
   * Obtém a descrição da criticidade
   */
  getDescricaoCriticidade(criticidade: number): string {
    const opcao = this.opcoesCriticidade.find(op => op.valor === criticidade);
    return opcao ? opcao.descricao : 'Não definida';
  }

  /**
   * Submete o formulário para criar a sprint
   */
  onSubmit(): void {
    if (this.form.invalid) {
      this.marcarCamposComoTocados();
      this.snackBar.open('Preencha todos os campos obrigatórios', 'Fechar', {
        duration: 5000
      });
      return;
    }

    if (this.ticketsSelecionados.length === 0) {
      this.snackBar.open('Selecione pelo menos um ticket para a sprint', 'Fechar', {
        duration: 5000
      });
      return;
    }

    this.enviando = true;

    // Criar o objeto CriarSprintRequest no formato correto
    const sprintRequest: CriarSprintRequest = {
        nome: this.form.get('nome')?.value,
        objetivo: this.form.get('objetivo')?.value,
        dataInicio: this.formatarDataParaAPI(this.form.get('dataInicio')?.value),
        dataFim: this.formatarDataParaAPI(this.form.get('dataFim')?.value),
        tickets: this.ticketsSelecionados.map(ticket => ({
          ticketId: ticket.id,
          criticidade: ticket.criticidade || 3
        }))
      };

    console.log('Enviando sprint request:', sprintRequest);

    this.sprintService.criarSprint(sprintRequest)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sprintCriada: Sprint) => {
          this.enviando = false;
          // Marca as sugestões incluídas como atendidas nesta sprint
          if (sprintCriada.id) {
            this.marcarSugestoesAtendidas(sprintCriada.id);
          }
          this.snackBar.open('Sprint criada com sucesso!', 'Fechar', { duration: 5000 });
          this.router.navigate(['/sprints', sprintCriada.id]);
        },
        error: (error: any) => {
          console.error('Erro ao criar sprint:', error);
          this.enviando = false;

          let mensagemErro = 'Erro ao criar sprint';
          if (error.error?.message) {
            mensagemErro = error.error.message;
          } else if (error.status === 400) {
            mensagemErro = 'Dados inválidos. Verifique os campos.';
          } else if (error.status === 500) {
            mensagemErro = 'Erro interno do servidor. Tente novamente.';
          }

          this.snackBar.open(mensagemErro, 'Fechar', {
            duration: 7000
          });
        }
      });
  }

  /**
   * Marca todos os campos como tocados para exibir erros
   */
  private marcarCamposComoTocados(): void {
    Object.keys(this.form.controls).forEach(campo => {
      const control = this.form.get(campo);
      control?.markAsTouched();
    });
  }

  /**
   * Cancela a criação da sprint
   */
  /**
   * Recebe evento do painel de sugestões.
   * Adiciona o ticket ao form e guarda o sugestaoId para marcar como atendido após criar a sprint.
   */
  incluirTicketSugerido(evento: { ticketId: string; sugestaoId: number | null }): void {
    const idStr = evento.ticketId?.toString();

    const ticket = this.todosTickets.find(t => t.id?.toString() === idStr)
                ?? this.ticketsDisponiveis.find(t => t.id?.toString() === idStr);

    if (!ticket) {
      this.snackBar.open(
        `Ticket #${idStr} não está disponível (pode estar finalizado ou cancelado).`,
        'Fechar', { duration: 6000, panelClass: ['snackbar-error'] }
      );
      return;
    }

    const jaExiste = this.ticketsSelecionados.some(t => t.id?.toString() === idStr);
    if (!jaExiste) {
      this.ticketsSelecionados = [...this.ticketsSelecionados, { ...ticket, criticidade: 3 }];
    }

    if (evento.sugestaoId) {
      this.sugestoesIncluidas.set(evento.ticketId, evento.sugestaoId);
    }
    this.cdr.detectChanges();
  }

  /** Após criar sprint com sucesso, marca TODAS as sugestões incluídas em uma única chamada */
  private marcarSugestoesAtendidas(idSprint: number): void {
    if (this.sugestoesIncluidas.size === 0) return;

    const idsSugestao = Array.from(this.sugestoesIncluidas.values());

    this.sugestaoService.atenderSugestaoLote(idsSugestao, idSprint)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {},
        error: (e) => console.warn('Erro ao marcar sugestões como atendidas (lote):', e)
      });

    this.sugestoesIncluidas.clear();
  }

  cancelar(): void {
    if (confirm('Tem certeza que deseja cancelar? Os dados não salvos serão perdidos.')) {
      this.router.navigate(['/sprints']);
    }
  }
}
