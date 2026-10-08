import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription, finalize } from 'rxjs';

// Material Angular
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { DashboardService } from './dashboard.service';
import { Sprint, SprintTicket, TicketSprintDetalhado } from '@core';
import { SprintCabecalhoComponent, SprintIndicador } from '../cabecalho/sprint-cabecalho.component';

@Component({
  selector: 'app-dashboard-principal',
  templateUrl: './dashboard-principal.html',
  styleUrls: ['./dashboard-principal.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    SprintCabecalhoComponent
  ]
})
export class DashboardPrincipalComponent implements OnInit, OnDestroy {
  // Dados
  sprints: Sprint[] = [];
  sprintSelecionada: Sprint | null = null;
  ticketsDaSprint: SprintTicket[] = [];

  // Tickets separados
  ticketsConcluidosLista: SprintTicket[] = [];
  ticketsPendentesLista: SprintTicket[] = [];

  // Índice para navegação
  indiceSprintAtual: number = 0;

  // Estatísticas
  totalTickets: number = 0;
  ticketsConcluidos: number = 0;
  ticketsPendentes: number = 0;
  /** Números exibidos no cabeçalho da sprint — recalculados em calcularEstatisticas(). */
  indicadoresSprint: SprintIndicador[] = [];

  // Estados
  carregando: boolean = false;
  carregandoTickets: boolean = false;
  erro: string | null = null;

  // Subscrições
  private subscriptions: Subscription = new Subscription();

  constructor(
    private dashboardService: DashboardService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.carregarSprints();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  carregarSprints(): void {
    this.carregando = true;
    this.erro = null;
    // Forçar detecção de mudanças
    this.cdr.detectChanges();

    const sub = this.dashboardService.listarTodasSprints()
      .pipe(
        finalize(() => {
          this.carregando = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (sprints) => {
          this.sprints = sprints || [];

          // Se houver sprints, seleciona a primeira
          if (this.sprints.length > 0) {
            this.indiceSprintAtual = 0;
            this.selecionarSprint(this.sprints[0]);
          }
        },
        error: (error) => {
          console.error('Erro ao carregar sprints:', error);
          this.erro = 'Não foi possível carregar as sprints. Verifique sua conexão.';
          this.cdr.detectChanges();
        }
      });

    this.subscriptions.add(sub);
  }

  selecionarSprint(sprint: Sprint | null): void {
    if (!sprint) return;

    this.sprintSelecionada = sprint;
    this.carregarTicketsSprint(sprint.id!);
  }

  carregarTicketsSprint(sprintId: number): void {
    this.carregandoTickets = true;
    this.cdr.detectChanges();

    const sub = this.dashboardService.listarTicketsSprint(sprintId)
      .pipe(
        finalize(() => {
          this.carregandoTickets = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (tickets) => {
          this.ticketsDaSprint = tickets || [];
          this.calcularEstatisticas();
          this.separarTickets();
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Erro ao carregar tickets:', error);
          this.ticketsDaSprint = [];
          this.ticketsConcluidosLista = [];
          this.ticketsPendentesLista = [];
          this.calcularEstatisticas();
          this.cdr.detectChanges();
        }
      });

    this.subscriptions.add(sub);
  }

  // Separar tickets em concluídos e pendentes
  separarTickets(): void {
    this.ticketsConcluidosLista = this.ticketsDaSprint.filter(ticket => {
    const status = (ticket.statusEntrega || '').toUpperCase();
      return status === 'ENTREGUE' || status === 'CONCLUIDO' || status === 'FECHADO';
    });

    this.ticketsPendentesLista = this.ticketsDaSprint.filter(ticket => {
      const status = (ticket.statusEntrega || '').toString().toUpperCase();
       return !(status === 'ENTREGUE' || status === 'CONCLUIDO' || status === 'FECHADO');
    });
  }

  calcularEstatisticas(): void {
    this.totalTickets = this.ticketsDaSprint.length;
    this.ticketsConcluidos = this.ticketsDaSprint.filter(t => {
      const status = (t.statusEntrega || '').toUpperCase();
      return status === 'ENTREGUE' || status === 'CONCLUIDO' || status === 'FECHADO';
    }).length;
    this.ticketsPendentes = this.totalTickets - this.ticketsConcluidos;
    this.indicadoresSprint = [
      { rotulo: 'Total', valor: this.totalTickets },
      { rotulo: 'Concluídos', valor: this.ticketsConcluidos, tom: 'sucesso' },
      { rotulo: 'Pendentes', valor: this.ticketsPendentes, tom: 'alerta' },
    ];
  }

  // Navegação entre sprints
  proximaSprint(): void {
    if (this.sprints.length === 0 || this.indiceSprintAtual <= 0) return;

    this.indiceSprintAtual--;
    this.selecionarSprint(this.sprints[this.indiceSprintAtual]);
  }

  sprintAnterior(): void {
    if (this.sprints.length === 0 || this.indiceSprintAtual >= this.sprints.length - 1) return;

    this.indiceSprintAtual++;
    this.selecionarSprint(this.sprints[this.indiceSprintAtual]);
  }

  // Métodos para controle de navegação
  temProxima(): boolean {
    return this.sprints.length > 0 && this.indiceSprintAtual > 0;
  }

  temAnterior(): boolean {
    return this.sprints.length > 0 && this.indiceSprintAtual < this.sprints.length - 1;
  }

  calcularPercentual(): number {
    if (this.totalTickets === 0) return 0;
    const percentual = (this.ticketsConcluidos / this.totalTickets) * 100;
    return Math.round(percentual);
  }

  // Helper para mostrar criticidade
  getCriticidadeTexto(criticidade: number): string {
    switch(criticidade) {
      case 1: return 'Crítica';
      case 2: return 'Alta';
      case 3: return 'Média';
      case 4: return 'Baixa';
      default: return `Nível ${criticidade}`;
    }
  }

  getStatusTexto(status: string): string {
    if (!status) return 'Desconhecido';

    const statusUpper = (status || '').toUpperCase();
    if (statusUpper === 'ENTREGUE') return 'Entregue';
    if (statusUpper === 'EM_ANDAMENTO') return 'Em Andamento';
    if (statusUpper === 'PENDENTE') return 'Pendente';
    if (statusUpper === 'ATRASADO') return 'Atrasado';
    if (statusUpper === 'REMOVIDO') return 'Removido';
    return status || 'Desconhecido';
  }

  getStatusClasse(status: string): string {
    if (!status) return 'desconhecido';

    const statusUpper = (status || '').toUpperCase();
    if (statusUpper === 'ENTREGUE' || statusUpper === 'CONCLUIDO' || statusUpper === 'FECHADO') {
      return 'entregue';
    } else if (statusUpper === 'EM_ANDAMENTO') {
      return 'em_andamento';
    } else if (statusUpper === 'PENDENTE' || statusUpper === 'ABERTO') {
      return 'pendente';
    } else if (statusUpper === 'ATRASADO') {
      return 'atrasado';
    } else if (statusUpper === 'REMOVIDO') {
      return 'removido';
    }
    return 'desconhecido';
  }

formatarData(data: string | Date | null | undefined): string {
  if (!data) {
    return 'Não resolvido'; // ou '-' ou outro texto padrão
  }

  // Se for string, converte para Date
  const dataObj = typeof data === 'string' ? new Date(data) : data;

  // Verifica se é uma data válida
  if (isNaN(dataObj.getTime())) {
    return 'Data inválida';
  }

  // Formata a data (ajuste conforme sua lógica atual)
  return dataObj.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

  private showSnackBar(mensagem: string, tipo: 'success' | 'error' | 'warning' | 'info' = 'info'): void {
    const config = {
      duration: 3000,
      panelClass: [`snackbar-${tipo}`]
    };

    this.snackBar.open(mensagem, 'Fechar', config);
  }

  // Método para recarregar tudo
  recarregarDashboard(): void {
    this.carregarSprints();
  }
}
