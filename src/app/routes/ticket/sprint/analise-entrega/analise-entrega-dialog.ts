import { DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HotToastService } from '@ngxpert/hot-toast';
import { finalize } from 'rxjs';

import { RegistrarAnaliseEntrega, RespostaAnaliseEntrega, TicketAnaliseEntrega } from '@core';
import { SprintService } from '../sprintService';

interface ItemAnalise extends TicketAnaliseEntrega {
  resposta: RespostaAnaliseEntrega | null;
  motivo: string;
}

interface GrupoSprint {
  sprintId: number;
  sprintNome: string;
  sprintDataFim: string;
  itens: ItemAnalise[];
}

/**
 * Análise de entrega: tickets do usuário logado em sprints já encerradas que
 * continuam com entrega PENDENTE. Aberto ao entrar no sistema
 * (AnaliseEntregaPopupService).
 */
@Component({
  selector: 'app-analise-entrega-dialog',
  templateUrl: './analise-entrega-dialog.html',
  styleUrl: './analise-entrega-dialog.scss',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
})
export class AnaliseEntregaDialog {
  private readonly dialogRef = inject<MatDialogRef<AnaliseEntregaDialog, boolean>>(MatDialogRef);
  private readonly sprintService = inject(SprintService);
  private readonly toast = inject(HotToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  grupos: GrupoSprint[] = [];
  salvando = false;

  constructor() {
    this.montarGrupos(inject<TicketAnaliseEntrega[]>(MAT_DIALOG_DATA));
  }

  get totalTickets(): number {
    return this.grupos.reduce((total, grupo) => total + grupo.itens.length, 0);
  }

  get totalRespondidos(): number {
    return this.grupos.reduce((total, grupo) => total + grupo.itens.filter(item => item.resposta).length, 0);
  }

  marcarSprint(grupo: GrupoSprint, resposta: RespostaAnaliseEntrega): void {
    grupo.itens.forEach(item => (item.resposta = resposta));
  }

  salvar(): void {
    const analises: RegistrarAnaliseEntrega[] = this.grupos
      .flatMap(grupo => grupo.itens)
      .filter(item => item.resposta)
      .map(item => ({
        sprintId: item.sprintId,
        ticketId: item.ticketId,
        statusEntrega: item.resposta as RespostaAnaliseEntrega,
        observacao: item.resposta === 'NAO_ENTREGUE' ? item.motivo.trim() || null : null,
      }));
    if (!analises.length || this.salvando) return;

    this.salvando = true;
    this.sprintService
      .registrarMinhasAnalisesEntrega(analises)
      .pipe(
        finalize(() => {
          this.salvando = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: restantes => {
          this.toast.success(
            analises.length === 1 ? 'Análise do ticket registrada.' : `Análise de ${analises.length} tickets registrada.`
          );
          if (!restantes.length) {
            this.dialogRef.close(true);
            return;
          }
          this.montarGrupos(restantes);
        },
        // A mensagem de erro já é exibida pelo errorInterceptor.
        error: () => {},
      });
  }

  responderDepois(): void {
    this.dialogRef.close(false);
  }

  /** Agrupa por sprint, mantendo o que já foi preenchido nos tickets que continuam na lista. */
  private montarGrupos(tickets: TicketAnaliseEntrega[]): void {
    const anteriores = new Map(this.grupos.flatMap(grupo => grupo.itens).map(item => [chave(item), item]));
    const grupos = new Map<number, GrupoSprint>();

    for (const ticket of tickets) {
      let grupo = grupos.get(ticket.sprintId);
      if (!grupo) {
        grupo = { sprintId: ticket.sprintId, sprintNome: ticket.sprintNome, sprintDataFim: ticket.sprintDataFim, itens: [] };
        grupos.set(ticket.sprintId, grupo);
      }
      const anterior = anteriores.get(chave(ticket));
      grupo.itens.push({ ...ticket, resposta: anterior?.resposta ?? null, motivo: anterior?.motivo ?? '' });
    }

    this.grupos = [...grupos.values()];
  }
}

function chave(ticket: TicketAnaliseEntrega): string {
  return `${ticket.sprintId}|${ticket.ticketId}`;
}
