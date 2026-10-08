// src/app/routes/ticket/classificacao/classificacao-ticket.ts
import { Component, OnInit, AfterViewInit, inject, ViewChild, ChangeDetectorRef } from '@angular/core';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Angular Material
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { TextFieldModule } from '@angular/cdk/text-field';

// Interfaces do core — NÃO redeclarar localmente
import { TicketChamado, SlaContrato } from '@core';
import { Usuario } from '@core/interface';

// Services
import { ClassificacaoService } from './classificacao.service';
import { SlaConfigService } from '../sla/sla-config.service';
import { UsuarioService } from '@core/authentication/usuario.service';

// ─── Interfaces locais ───────────────────────────────────────

interface EdicaoTicket {
  idSlaContrato: number | null;
  statusHb: string | null;
  observacao: string | null;
}

interface FiltrosTicket {
  busca: string;
  statusHb: string;
  nivelId: string | number;
  apenasNaoFinalizados: boolean;
  apenasMeus: boolean;
  /** ID do usuário responsável (codUsuario) selecionado no dropdown; '' = sem filtro */
  responsavelId: number | '';
  /** Exibe somente tickets com flag desatualizado = true */
  apenasDesatualizados: boolean;
}

/**
 * Status considerados "finalizados" no sistema de origem.
 * Ajuste conforme os valores reais do campo `status` da sua API.
 */
const STATUS_FINALIZADOS = ['CANCELADO', 'FECHADO', 'RESOLVIDO', 'finalizado', 'FINALIZADO'];

// ─── Componente ──────────────────────────────────────────────

@Component({
  selector: 'app-classificacao-ticket',
  standalone: true,
  templateUrl: './classificacao-ticket.html',
  styleUrls: ['./classificacao-ticket.scss'],
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatSlideToggleModule,
    TextFieldModule,
  ],
})
export class ClassificacaoTicketComponent implements OnInit, AfterViewInit {
  private classificacaoSvc = inject(ClassificacaoService);
  private slaConfigService = inject(SlaConfigService);
  private usuarioService   = inject(UsuarioService);
  private cdr              = inject(ChangeDetectorRef);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort)      sort!: MatSort;

  // ─── Dados ────────────────────────────────────────────────
  /** Lista completa vinda da API — nunca modificada após carga */
  private todosTickets: TicketChamado[] = [];

  /** SlaContrato do @core: campos id, nivel, nomeContrato */
  slaContratos: SlaContrato[] = [];

  /** Lista de usuários ativos para o filtro de responsável */
  usuarios: Usuario[] = [];

  ticketsFiltrados = new MatTableDataSource<TicketChamado>([]);

  colunasExibidas: string[] = [
    'id', 'titulo', 'status', 'nivel',
    'statusHb', 'dtStatus', 'observacao', 'responsavel', 'acoes',
  ];

  // ─── Filtros ──────────────────────────────────────────────
  filtros: FiltrosTicket = this.filtrosIniciais();

  get filtrosAtivos(): boolean {
    const p = this.filtrosIniciais();
    return (
      this.filtros.busca !== p.busca ||
      this.filtros.statusHb !== p.statusHb ||
      this.filtros.nivelId !== p.nivelId ||
      this.filtros.apenasNaoFinalizados !== p.apenasNaoFinalizados ||
      this.filtros.responsavelId !== p.responsavelId ||
      this.filtros.apenasDesatualizados !== p.apenasDesatualizados
    );
  }

  // ─── Estado ───────────────────────────────────────────────
  carregando = false;
  salvando   = false;

  // ─── Edição inline ────────────────────────────────────────
  editandoId: string | null = null;
  edicaoAtual: EdicaoTicket = this.edicaoVazia();

  // ─── Feedback ─────────────────────────────────────────────
  feedbackMsg:  string | null       = null;
  feedbackTipo: 'success' | 'error' = 'success';
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;

  // ──────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.carregarSlaContratos();
    this.carregarUsuarios();
    this.carregarTickets();
  }

  ngAfterViewInit(): void {
    this.ticketsFiltrados.paginator = this.paginator;
    this.ticketsFiltrados.sort      = this.sort;
  }

  // ─── Carregamento ─────────────────────────────────────────

  carregarTickets(): void {
    this.carregando = true;
    this.cancelarEdicao();

    const params = {
      excluirFinalizados: this.filtros.apenasNaoFinalizados,
      statusHb:           this.filtros.statusHb   || undefined,
      nivelId:            this.filtros.nivelId !== '' ? +this.filtros.nivelId : undefined,
      snMeus:             this.filtros.apenasMeus,
    };

    this.classificacaoSvc.buscarClassificacao(params).subscribe({
      next: (tickets) => {
        this.todosTickets = tickets;
        this.aplicarFiltroLocais();
        this.carregando = false;
      },
      error: () => {
        this.mostrarFeedback('Erro ao carregar tickets.', 'error');
        this.carregando = false;
      },
    });
  }

  carregarSlaContratos(): void {
    // Cast explícito necessário pois listarTodos() pode retornar Observable<unknown>
    const obs = this.slaConfigService.listarTodos() as Observable<SlaContrato[]>;
    obs.subscribe({
      next: (lista) => {
        this.slaContratos = lista;
        // detectChanges evita NG0100: a resposta HTTP pode chegar dentro do
        // ciclo de verificação do ngOnInit e precisamos notificar o Angular
        this.cdr.detectChanges();
      },
      error: () => console.warn('Não foi possível carregar SLA Contratos'),
    });
  }

  carregarUsuarios(): void {
    this.usuarioService.getAtivos().subscribe({
      next: (lista) => {
        this.usuarios = lista;
        this.cdr.detectChanges();
      },
      error: (err) => console.warn('Não foi possível carregar a lista de usuários', err),
    });
  }

  // ─── Filtros ──────────────────────────────────────────────

  /**
   * Filtros pesados (status finalizado, nível, statusHb, responsável) → backend.
   * Filtros leves (busca textual, apenasDesatualizados) → aplicados localmente.
   */
  aplicarFiltros(): void {
    this.carregarTickets();
  }

  /**
   * Quando o usuário seleciona um responsável específico no dropdown,
   * desmarca "Apenas meus" e recarrega do backend sem o filtro snMeus.
   * Usa (selectionChange) no template — dispara só após seleção confirmada,
   * sem interferir no ciclo do mat-select.
   */
  onResponsavelChange(): void {
    if (this.filtros.responsavelId !== '') {
      this.filtros.apenasMeus = false;
    }
    this.aplicarFiltros();
  }

  /**
   * Quando o toggle "Apenas meus" é ativado, limpa o filtro de responsável
   * para evitar resultados vazios (snMeus + responsavelId de outro usuário).
   */
  onApenasMeusChange(): void {
    if (this.filtros.apenasMeus) {
      this.filtros.responsavelId = '';
    }
    this.aplicarFiltros();
  }

  /** Aplica busca textual, desatualizados e responsável sobre os dados já retornados pelo backend.
   *  Preserva a ordenação do backend: desatualizados primeiro. */
  aplicarFiltroLocais(): void {
    const termo = this.filtros.busca.toLowerCase().trim();

    let filtrados = termo
      ? this.todosTickets.filter((t) =>
          t.id?.toLowerCase().includes(termo) ||
          t.titulo?.toLowerCase().includes(termo) ||
          t.responsavel?.toLowerCase().includes(termo)
        )
      : [...this.todosTickets];

    // Filtro local: apenas tickets desatualizados
    if (this.filtros.apenasDesatualizados) {
      filtrados = filtrados.filter((t) => t.desatualizado);
    }

    // Filtro local: responsável — pelo usuário gravado no ticket via de-para de
    // usuários MV (mesma regra do snMeus no backend)
    if (this.filtros.responsavelId !== '') {
      const codUsuario = +this.filtros.responsavelId;
      filtrados = filtrados.filter((t) => t.codUsuarioResp === codUsuario);
    }

    // Mantém ordenação: desatualizados primeiro → dataMovimento decrescente
    filtrados.sort((a, b) => {
      const da = a.desatualizado ? 0 : 1;
      const db = b.desatualizado ? 0 : 1;
      if (da !== db) return da - db;
      if (!a.dataMovimento && !b.dataMovimento) return 0;
      if (!a.dataMovimento) return 1;
      if (!b.dataMovimento) return -1;
      return b.dataMovimento.localeCompare(a.dataMovimento);
    });

    this.ticketsFiltrados.data = filtrados;
    if (this.paginator) this.paginator.firstPage();
  }

  limparFiltros(): void {
    this.filtros = this.filtrosIniciais();
    this.aplicarFiltros();
  }

  // ─── Edição inline ────────────────────────────────────────

  iniciarEdicao(ticket: TicketChamado): void {
    this.editandoId = ticket.id;
    const t = ticket as any;
    this.edicaoAtual = {
      idSlaContrato: ticket.slaContrato?.id ?? null,
      statusHb:      t.statusHb  ?? null,
      observacao:    t.observacao ?? null,
    };
  }

  cancelarEdicao(): void {
    this.editandoId  = null;
    this.edicaoAtual = this.edicaoVazia();
  }

  salvar(ticket: TicketChamado): void {
    if (this.salvando) return;
    this.salvando = true;

    // encodeURIComponent garante que IDs com hífen (ex: 110153-1) não sejam
    // interpretados como separadores de rota pelo Angular/servidor
    const idEncoded = encodeURIComponent(ticket.id);

    this.classificacaoSvc
      .atualizarClassificacao(idEncoded, this.edicaoAtual)
      .subscribe({
        next: (atualizado) => {
          const idx = this.todosTickets.findIndex((t) => t.id === ticket.id);
          if (idx !== -1) this.todosTickets[idx] = atualizado;
          this.aplicarFiltroLocais();
          this.cancelarEdicao();
          this.mostrarFeedback('Ticket atualizado com sucesso!', 'success');
          this.salvando = false;
        },
        error: () => {
          this.mostrarFeedback('Erro ao salvar. Tente novamente.', 'error');
          this.salvando = false;
        },
      });
  }

  // ─── Helpers privados ─────────────────────────────────────

  private filtrosIniciais(): FiltrosTicket {
    return {
      busca: '',
      statusHb: '',
      nivelId: '',
      apenasNaoFinalizados: true,
      apenasMeus: true,
      responsavelId: '',
      apenasDesatualizados: false,
    };
  }

  private edicaoVazia(): EdicaoTicket {
    return { idSlaContrato: null, statusHb: null, observacao: null };
  }

  private mostrarFeedback(msg: string, tipo: 'success' | 'error'): void {
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    this.feedbackMsg  = msg;
    this.feedbackTipo = tipo;
    this.feedbackTimer = setTimeout(() => (this.feedbackMsg = null), 4000);
  }
}
