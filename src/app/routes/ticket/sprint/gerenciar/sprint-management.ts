import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, finalize } from 'rxjs';

// Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';

// Bibliotecas para exportação
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Serviços e modelos (ajuste os paths conforme sua estrutura)
import { Sprint, SprintTicket } from '@core';
import { SprintService } from '../sprintService';
import { DashboardService } from '../dashboard/dashboard.service';


@Component({
  selector: 'app-gerenciamento-sprint',
  templateUrl: './sprint-management.html',
  styleUrls: ['./sprint-management.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatOptionModule,
    MatSnackBarModule,
    MatDividerModule,
    MatInputModule,
    MatFormFieldModule,
    MatTooltipModule
  ]
})
export class GerenciamentoSprint implements OnInit, OnDestroy {
  sprints: Sprint[] = [];
  sprintSelecionada: Sprint | null = null;
  ticketsDaSprint: SprintTicket[] = [];

  ticketsConcluidosLista: SprintTicket[] = [];
  ticketsNaoEntreguesLista: SprintTicket[] = [];
  ticketsPendentesLista: SprintTicket[] = [];

  filtroTexto: string = '';

  totalTickets: number = 0;
  ticketsConcluidos: number = 0;
  ticketsNaoEntregues: number = 0;
  ticketsPendentes: number = 0;

  indiceSprintAtual: number = 0;

  carregando: boolean = false;
  carregandoTickets: boolean = false;
  atualizandoSprint: boolean = false;
  atualizandoTicketId: string | null = null;
  exportando: boolean = false;
  erro: string | null = null;

  statusSprintOptions: string[] = ['PLANEJADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA'];
  statusTicketOptions: string[] = ['PENDENTE', 'ENTREGUE', 'NAO_ENTREGUE'];
  criticidadeOptions = [
    { valor: 1, rotulo: 'CRÍTICA' },
    { valor: 2, rotulo: 'ALTA' },
    { valor: 3, rotulo: 'MÉDIA' },
    { valor: 4, rotulo: 'BAIXA' }
  ];

  private subscriptions: Subscription = new Subscription();

  constructor(
    private sprintService: SprintService,
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
    this.cdr.detectChanges();

    const sub = this.dashboardService.listarTodasSprints()
      .pipe(finalize(() => {
        this.carregando = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (sprints) => {
          this.sprints = sprints || [];
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
    this.filtroTexto = '';
    this.carregarTicketsSprint(sprint.id!);
  }

  carregarTicketsSprint(sprintId: number): void {
    this.carregandoTickets = true;
    this.ticketsDaSprint = [];
    this.cdr.detectChanges();

    const sub = this.sprintService.listarTicketsDaSprint(sprintId)
      .pipe(finalize(() => {
        this.carregandoTickets = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (tickets) => {
          this.ticketsDaSprint = tickets || [];
          this.separarTicketsPorStatus();
          this.atualizarEstatisticas();
          this.aplicarFiltro();
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Erro ao carregar tickets:', error);
          this.erro = 'Falha ao carregar os tickets da sprint.';
          this.ticketsDaSprint = [];
          this.separarTicketsPorStatus();
          this.atualizarEstatisticas();
          this.aplicarFiltro();
          this.cdr.detectChanges();
        }
      });

    this.subscriptions.add(sub);
  }

  aplicarFiltro(): void {
    const termo = (this.filtroTexto || '').trim().toLowerCase();

    if (!termo) {
      this.separarTicketsPorStatus();
      return;
    }

    const ticketsFiltrados = this.ticketsDaSprint.filter(t => {
      const titulo = (t.ticket?.titulo || '').toLowerCase();
      const idTicket = (t.ticket?.id || '').toString().toLowerCase();
      const responsavel = (t.ticket?.responsavel || '').toLowerCase();

      return titulo.includes(termo) ||
             idTicket.includes(termo) ||
             responsavel.includes(termo);
    });

    this.ticketsConcluidosLista = ticketsFiltrados.filter(ticket => {
      const status = (ticket.statusEntrega || '').toUpperCase();
      return status === 'ENTREGUE' || status === 'CONCLUIDO' || status === 'FECHADO';
    });

    this.ticketsNaoEntreguesLista = ticketsFiltrados.filter(ticket => {
      const status = (ticket.statusEntrega || '').toUpperCase();
      return status === 'NAO_ENTREGUE';
    });

    this.ticketsPendentesLista = ticketsFiltrados.filter(ticket => {
      const status = (ticket.statusEntrega || '').toUpperCase();
      return status !== 'ENTREGUE' && status !== 'CONCLUIDO' &&
             status !== 'FECHADO' && status !== 'NAO_ENTREGUE';
    });
  }

  separarTicketsPorStatus(): void {
    this.ticketsConcluidosLista = this.ticketsDaSprint.filter(ticket => {
      const status = (ticket.statusEntrega || '').toUpperCase();
      return status === 'ENTREGUE' || status === 'CONCLUIDO' || status === 'FECHADO';
    });

    this.ticketsNaoEntreguesLista = this.ticketsDaSprint.filter(ticket => {
      const status = (ticket.statusEntrega || '').toUpperCase();
      return status === 'NAO_ENTREGUE';
    });

    this.ticketsPendentesLista = this.ticketsDaSprint.filter(ticket => {
      const status = (ticket.statusEntrega || '').toUpperCase();
      return status !== 'ENTREGUE' && status !== 'CONCLUIDO' &&
             status !== 'FECHADO' && status !== 'NAO_ENTREGUE';
    });
  }

  atualizarEstatisticas(): void {
    this.totalTickets = this.ticketsDaSprint.length;
    this.ticketsConcluidos = this.ticketsDaSprint.filter(t => {
      const status = (t.statusEntrega || '').toUpperCase();
      return status === 'ENTREGUE' || status === 'CONCLUIDO' || status === 'FECHADO';
    }).length;
    this.ticketsNaoEntregues = this.ticketsDaSprint.filter(t => {
      const status = (t.statusEntrega || '').toUpperCase();
      return status === 'NAO_ENTREGUE';
    }).length;
    this.ticketsPendentes = this.totalTickets - this.ticketsConcluidos - this.ticketsNaoEntregues;
  }

  //sprintAnterior
  proximaSprint(): void {
    if (this.sprints.length === 0 || this.indiceSprintAtual <= 0) return;
    this.indiceSprintAtual--;
    this.selecionarSprint(this.sprints[this.indiceSprintAtual]);
  }
//proximaSprint
  sprintAnterior(): void {
    if (this.sprints.length === 0 || this.indiceSprintAtual >= this.sprints.length - 1) return;
    this.indiceSprintAtual++;
    this.selecionarSprint(this.sprints[this.indiceSprintAtual]);
  }

  //temAnterior
  temProxima(): boolean {
    return this.sprints.length > 0 && this.indiceSprintAtual > 0;
  }
 //temProxima
  temAnterior(): boolean {
    return this.sprints.length > 0 && this.indiceSprintAtual < this.sprints.length - 1;
  }

  /** Motivo de a sprint não poder ser concluída; vazio quando pode. */
  get mensagemBloqueioConclusao(): string {
    return this.ticketsPendentes > 0
      ? `Não é possível concluir: ${this.ticketsPendentes} ticket(s) ainda pendente(s). Marque cada um como entregue ou não entregue.`
      : '';
  }

   fecharSprint(): void {
    if (!this.sprintSelecionada || !this.sprintSelecionada.id) return;

    // Mesma regra do backend: só conclui com todos os tickets entregues ou não entregues
    if (this.ticketsPendentes > 0) {
      this.showSnackBar(this.mensagemBloqueioConclusao, 'error');
      return;
    }

    this.atualizandoSprint = true;
    const sprintId = this.sprintSelecionada.id;

    this.sprintService.fecharSprint(sprintId)
      .pipe(finalize(() => {
        this.atualizandoSprint = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (sprintAtualizada) => {
          this.sprintSelecionada = sprintAtualizada;
          const index = this.sprints.findIndex(s => s.id === sprintId);
          if (index !== -1) this.sprints[index] = sprintAtualizada;
          this.showSnackBar('Status da sprint atualizado com sucesso!', 'success');
        },
        error: (error) => {
          console.error('Erro ao atualizar status da sprint:', error);
          this.showSnackBar(error?.message || 'Erro ao atualizar status da sprint.', 'error');
        }
      });
  }

  reabrirSprint(): void {
    if (!this.sprintSelecionada || !this.sprintSelecionada.id) return;

    this.atualizandoSprint = true;
    const sprintId = this.sprintSelecionada.id;

    this.sprintService.reabrirSprint(sprintId)
      .pipe(finalize(() => {
        this.atualizandoSprint = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (sprintAtualizada) => {
          this.sprintSelecionada = sprintAtualizada;
          const index = this.sprints.findIndex(s => s.id === sprintId);
          if (index !== -1) this.sprints[index] = sprintAtualizada;
          this.showSnackBar('Status da sprint atualizado com sucesso!', 'success');
        },
        error: (error) => {
          console.error('Erro ao atualizar status da sprint:', error);
          this.showSnackBar('Erro ao atualizar status da sprint.', 'error');
        }
      });
  }

  atualizarStatusSprint(novoStatus: string): void {
    if (!this.sprintSelecionada || !this.sprintSelecionada.id) return;

    this.atualizandoSprint = true;
    const sprintId = this.sprintSelecionada.id;

    const sub = this.sprintService.atualizarSprint(sprintId, { status: novoStatus })
      .pipe(finalize(() => {
        this.atualizandoSprint = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (sprintAtualizada) => {
          this.sprintSelecionada = sprintAtualizada;
          const index = this.sprints.findIndex(s => s.id === sprintId);
          if (index !== -1) this.sprints[index] = sprintAtualizada;
          this.showSnackBar('Status da sprint atualizado com sucesso!', 'success');
        },
        error: (error) => {
          console.error('Erro ao atualizar status da sprint:', error);
          this.showSnackBar('Erro ao atualizar status da sprint.', 'error');
        }
      });

    this.subscriptions.add(sub);
  }

  atualizarTicket(ticket: SprintTicket): void {
    if (!this.sprintSelecionada?.id || !ticket.ticket?.id) {
      this.showSnackBar('Dados do ticket incompletos.', 'error');
      return;
    }

    this.atualizandoTicketId = ticket.ticket.id;
    this.cdr.detectChanges();

    const sub = this.sprintService.atualizarStatusTicket(
      this.sprintSelecionada.id,
      ticket.ticket.id,
      ticket.statusEntrega,
      ticket.criticidade,
      null,
      null
    ).pipe(finalize(() => {
      this.atualizandoTicketId = null;
      this.cdr.detectChanges();
    }))
    .subscribe({
      next: (ticketAtualizado) => {
        const index = this.ticketsDaSprint.findIndex(t => t.ticket?.id === ticket.ticket?.id);
        if (index !== -1) {
          this.ticketsDaSprint[index] = ticketAtualizado;
        }
        this.separarTicketsPorStatus();
        this.atualizarEstatisticas();
        this.aplicarFiltro();
        this.showSnackBar('Ticket atualizado com sucesso!', 'success');
      },
      error: (error) => {
        console.error('Erro ao atualizar ticket:', error);
        this.showSnackBar('Erro ao atualizar o ticket.', 'error');
        if (this.sprintSelecionada?.id) {
          this.carregarTicketsSprint(this.sprintSelecionada.id);
        }
      }
    });

    this.subscriptions.add(sub);
  }

  calcularPercentual(): number {
    if (this.totalTickets === 0) return 0;
    return Math.round((this.ticketsConcluidos / this.totalTickets) * 100);
  }

  formatarData(data: string | Date | null | undefined): string {
    if (!data) return 'Não definida';
    const dataObj = typeof data === 'string' ? new Date(data) : data;
    if (isNaN(dataObj.getTime())) return 'Data inválida';
    return dataObj.toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  }

  getCriticidadeRotulo(criticidade: number): string {
    const opt = this.criticidadeOptions.find(o => o.valor === criticidade);
    return opt ? opt.rotulo : `Nível ${criticidade}`;
  }

  private showSnackBar(mensagem: string, tipo: 'success' | 'error' | 'info' = 'info'): void {
    this.snackBar.open(mensagem, 'Fechar', {
      duration: 3000,
      panelClass: [`snackbar-${tipo}`]
    });
  }

  // ────────────────────────────────────────────────
  // Exportação completa (PDF)
  // ────────────────────────────────────────────────

exportarPDF() {
  console.log('Iniciando exportação de PDF');

  if (!this.sprintSelecionada?.id) {
    this.showSnackBar('Nenhuma Sprint Selecionada.', 'error');
    return;
  }

  this.exportando = true; // loading indicator (opcional)

  this.sprintService.relatorio(this.sprintSelecionada.id)
    .pipe(
      finalize(() => {
        this.exportando = false;
        this.cdr.detectChanges();
      })
    )
    .subscribe({
      next: (blob: Blob) => {
        // Cria URL temporário para o Blob
        const url = window.URL.createObjectURL(blob);

        // Cria link invisível para download
        const link = document.createElement('a');
        link.href = url;
        link.download = `Sprint_${this.sprintSelecionada?.id}_Relatorio.pdf`; // nome do arquivo
        document.body.appendChild(link);
        link.click();

        // Limpeza (boa prática)
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        this.showSnackBar('Relatório gerado e baixado com sucesso!', 'success');
      },
      error: (error) => {
        console.error('Erro ao gerar relatório PDF:', error);
        this.showSnackBar('Erro ao gerar o relatório da sprint.', 'error');
      }
    });
}

  /**
   * Recebe ticketId do painel de sugestões.
   * No gerenciamento, exibe aviso — inclusão direta em sprint ativa
   * requer endpoint dedicado (adicionar ticket à sprint existente).
   */
  retornaStatus(status: string): string {
  // Objeto que mapeia a chave (código) para o valor (descrição)
  const descricoes: Record<string, string> = {
    'PENDENTE': 'PENDENTE',
    'EM_ANDAMENTO': 'EM ANDAMENTO',
    'AG_ENTREGA': 'AGUARDANDO ENTREGA',
    'CONCLUIDA': 'CONCLUIDA',
    'PLANEJADA': 'PLANEJADA',
    'REMOVIDO': 'REMOVIDO'
  };

  // Busca a chave no objeto.
  // O operador || garante que se um status inválido for passado, ele não retorne 'undefined'.
  return descricoes[status] || 'STATUS DESCONHECIDO';
}

  // ────────────────────────────────────────────────
  // Exportação em texto (copiar / baixar .txt)
  // ────────────────────────────────────────────────

  private montarSecaoTexto(titulo: string, tickets: SprintTicket[]): string {
    const linhas = tickets.map(t => {
      const responsavel = t.ticket?.responsavel;
      return responsavel
        ? `${t.ticket?.id} - ${t.ticket?.titulo} ( ${responsavel} )`
        : `${t.ticket?.id} - ${t.ticket?.titulo}`;
    });
    return `${titulo}\n--------------------------\n${linhas.join('\n')}`;
  }

  gerarTextoTickets(): string {
    if (!this.sprintSelecionada) return '';

    const cabecalho = `Sprint ${this.sprintSelecionada.id} ` +
      `${this.formatarData(this.sprintSelecionada.dataInicio)} - ${this.formatarData(this.sprintSelecionada.dataFim)}`;

    const secoes = [
      { titulo: 'Pendente', tickets: this.ticketsPendentesLista },
      { titulo: 'Concluidos', tickets: this.ticketsConcluidosLista },
      { titulo: 'Não Entregues', tickets: this.ticketsNaoEntreguesLista }
    ]
      .filter(secao => secao.tickets.length > 0)
      .map(secao => this.montarSecaoTexto(secao.titulo, secao.tickets));

    return [cabecalho, ...secoes].join('\n\n');
  }

  copiarTickets(): void {
    const texto = this.gerarTextoTickets();
    if (!texto) {
      this.showSnackBar('Nenhuma Sprint Selecionada.', 'error');
      return;
    }
    navigator.clipboard.writeText(texto)
      .then(() => this.showSnackBar('Tickets copiados para a área de transferência!', 'success'))
      .catch(() => this.showSnackBar('Não foi possível copiar os tickets.', 'error'));
  }

  baixarTicketsTxt(): void {
    const texto = this.gerarTextoTickets();
    if (!texto || !this.sprintSelecionada) {
      this.showSnackBar('Nenhuma Sprint Selecionada.', 'error');
      return;
    }

    const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Sprint_${this.sprintSelecionada.id}_Tickets.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

}
