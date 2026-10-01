import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { MatSnackBar } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';

import { TicketService } from '../../ticketService';

import { Ticket } from '@core';
import { CriarSugestaoRequest, SugestaoSprintService, SugestaoTicketSprint } from './sugestao-ticket-sprint.service';

@Component({
  selector: 'app-sugestao-ticket-sprint',
  templateUrl: './sugestao-ticket-sprint.component.html',
  styleUrls: ['./sugestao-ticket-sprint.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatChipsModule,
    MatDividerModule,
    MatBadgeModule,
  ]
})
export class SugestaoTicketSprintComponent implements OnInit, OnDestroy {

  // Tickets disponíveis para sugerir (não concluídos/finalizados)
  ticketsDisponiveis: Ticket[] = [];
  ticketsFiltrados: Ticket[] = [];

  // Sugestões já registradas (apenas PENDENTES)
  sugestoes: SugestaoTicketSprint[] = [];

  // Histórico completo (pendentes + atendidas)
  historico: SugestaoTicketSprint[] = [];
  historicoFiltrado: SugestaoTicketSprint[] = [];

  // Controles de estado
  carregandoTickets   = false;
  carregandoSugestoes = false;
  carregandoHistorico = false;
  mostrarHistorico    = false;
  removendoId: number | null = null;
  adicionandoTicketId: string | null = null;

  // Filtro busca histórico
  buscaHistorico = new FormControl('');

  // Filtro de busca
  buscaControl = new FormControl('');

  // Filtro de prioridade
  filtroPrioridade: string | null = null;
  prioridades = ['ALTA', 'MEDIA', 'BAIXA'];

  private destroy$ = new Subject<void>();

  // Status que indicam ticket concluído/finalizado — não podem ser sugeridos
  private readonly STATUS_FINALIZADOS = ['FECHADO', 'CANCELADO', 'RESOLVIDO', 'CONCLUIDO'];

  constructor(
    private ticketService: TicketService,
    private sugestaoService: SugestaoSprintService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.carregarTudo();

    this.buscaControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.filtrar());

    this.buscaHistorico.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.filtrarHistorico());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Carregamento ───────────────────────────────────────────────────────────

  carregarTudo(): void {
    this.carregarTickets();
    this.carregarSugestoes();
  }

  carregarTickets(): void {
    this.carregandoTickets = true;

    this.ticketService.getTicketsDisponiveis()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tickets) => {
          // Filtra apenas tickets não concluídos/finalizados
          this.ticketsDisponiveis = (tickets || []).filter(t =>
            !this.STATUS_FINALIZADOS.includes((t as any).status?.toUpperCase() ?? '')
          );
          this.filtrar();
          this.carregandoTickets = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.mostrarToast('Erro ao carregar tickets.', 'error');
          this.carregandoTickets = false;
          this.cdr.detectChanges();
        }
      });
  }

  carregarSugestoes(): void {
    this.carregandoSugestoes = true;
    this.sugestaoService.listarSugestoes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sugestoes) => {
          // Backend retorna apenas pendentes — atendidas já não aparecem
          this.sugestoes = sugestoes || [];
          this.carregandoSugestoes = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.mostrarToast('Erro ao carregar sugestões.', 'error');
          this.carregandoSugestoes = false;
          this.cdr.detectChanges();
        }
      });
  }

  toggleHistorico(): void {
    this.mostrarHistorico = !this.mostrarHistorico;
    if (this.mostrarHistorico && this.historico.length === 0) {
      this.carregarHistorico();
    }
  }

  carregarHistorico(): void {
    this.carregandoHistorico = true;
    this.sugestaoService.listarHistorico()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lista: SugestaoTicketSprint[]) => {
          this.historico = lista || [];
          this.filtrarHistorico();
          this.carregandoHistorico = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.mostrarToast('Erro ao carregar histórico.', 'error');
          this.carregandoHistorico = false;
          this.cdr.detectChanges();
        }
      });
  }

  filtrarHistorico(): void {
    const termo = (this.buscaHistorico.value ?? '').toLowerCase().trim();
    this.historicoFiltrado = !termo ? this.historico
      : this.historico.filter(s =>
          s.ticketId?.toLowerCase().includes(termo) ||
          s.titulo?.toLowerCase().includes(termo) ||
          s.sugeridoPorNome?.toLowerCase().includes(termo)
        );
  }

  statusLabel(s: SugestaoTicketSprint): string {
    return s.snAtendido ? 'Atendida' : 'Pendente';
  }

  // ── Filtro ─────────────────────────────────────────────────────────────────

  filtrar(): void {
    const termo = (this.buscaControl.value ?? '').toLowerCase().trim();

    this.ticketsFiltrados = this.ticketsDisponiveis.filter(t => {
      const matchBusca = !termo
        || t.titulo?.toLowerCase().includes(termo)
        || t.id?.toString().includes(termo)
        || t.descricao?.toLowerCase().includes(termo);

      const matchPrioridade = !this.filtroPrioridade
        || t.prioridade === this.filtroPrioridade;

      return matchBusca && matchPrioridade;
    });
  }

  toggleFiltroPrioridade(p: string): void {
    this.filtroPrioridade = this.filtroPrioridade === p ? null : p;
    this.filtrar();
  }

  limparFiltros(): void {
    this.filtroPrioridade = null;
    this.buscaControl.setValue('');
  }

  // ── Ações ──────────────────────────────────────────────────────────────────

  sugerirTicket(ticket: Ticket): void {
    if (this.jaFoiSugerido(ticket.id)) {
      this.mostrarToast('Este ticket já está na lista de sugestões.', 'info');
      return;
    }

    this.adicionandoTicketId = ticket.id;

    const request: CriarSugestaoRequest = { ticketId: ticket.id };
    this.cdr.detectChanges();

    this.sugestaoService.adicionarSugestao(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (nova) => {
          this.sugestoes = [nova, ...this.sugestoes];
          this.adicionandoTicketId = null;
          this.mostrarToast(`Ticket #${ticket.id} sugerido com sucesso!`, 'success');
          this.cdr.detectChanges();
        },
        error: () => {
          this.adicionandoTicketId = null;
          this.mostrarToast('Erro ao sugerir ticket.', 'error');
          this.cdr.detectChanges();
        }
      });
  }

  removerSugestao(sugestao: SugestaoTicketSprint): void {
    if (!sugestao.id) return;
    this.removendoId = sugestao.id;
    this.sugestaoService.removerSugestao(sugestao.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          // Remove imediatamente da lista local
          this.sugestoes = this.sugestoes.filter(s => s.id !== sugestao.id);
          this.removendoId = null;
          this.mostrarToast('Sugestão removida.', 'info');
          this.cdr.detectChanges();
        },
        error: () => {
          this.removendoId = null;
          this.mostrarToast('Erro ao remover sugestão.', 'error');
          this.cdr.detectChanges();
        }
      });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  jaFoiSugerido(ticketId: string): boolean {
    return this.sugestoes.some(s => s.ticketId === ticketId);
  }

  contarPorPrioridade(p: string): number {
    return this.ticketsDisponiveis.filter(t => t.prioridade === p).length;
  }

  formatarData(data: string | undefined): string {
    if (!data) return '—';
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  private mostrarToast(msg: string, tipo: 'success' | 'error' | 'info'): void {
    this.snackBar.open(msg, 'Fechar', {
      duration: 4000,
      panelClass: [`snackbar-${tipo}`]
    });
  }
}
