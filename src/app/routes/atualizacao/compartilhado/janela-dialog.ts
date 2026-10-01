import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Observable, finalize } from 'rxjs';

import { AtualizacaoDetalhe } from '../atualizacao.models';
import { AtualizacaoService } from '../atualizacao.service';

export type ModoJanela = 'solicitar' | 'aprovar' | 'recusar' | 'cancelar';

export interface JanelaDialogData {
  modo: ModoJanela;
  detalhe: AtualizacaoDetalhe;
}

const TEXTOS: Record<ModoJanela, { titulo: string; botao: string; comentario: string; comentarioObrigatorio: boolean }> = {
  solicitar: { titulo: 'Solicitar aprovação para produção', botao: 'Solicitar aprovação', comentario: 'Comentário para o aprovador', comentarioObrigatorio: false },
  aprovar: { titulo: 'Aprovar produção', botao: 'Aprovar', comentario: 'Comentário (opcional)', comentarioObrigatorio: false },
  recusar: { titulo: 'Recusar produção', botao: 'Recusar', comentario: 'Motivo da recusa', comentarioObrigatorio: true },
  cancelar: { titulo: 'Cancelar atualização', botao: 'Cancelar atualização', comentario: 'Motivo do cancelamento', comentarioObrigatorio: true },
};

/** Janela de produção (solicitar e aprovar), recusa e cancelamento: comandos com data e/ou texto. */
@Component({
  selector: 'app-atualizacao-janela-dialog',
  imports: [DatePipe, FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>{{ textos.titulo }}</h2>
    <form #form="ngForm" (ngSubmit)="confirmar()">
      <mat-dialog-content class="campos">
        <p class="contexto">
          <strong>{{ data.detalhe.numero }}</strong> · {{ data.detalhe.titulo }}
          @if (data.detalhe.emergencial) {
            <br /><span class="emergencial">Emergencial: {{ data.detalhe.justificativaEmergencial }}</span>
          }
        </p>

        @if (data.modo === 'solicitar' || data.modo === 'aprovar') {
          <mat-form-field appearance="outline">
            <mat-label>Janela de produção</mat-label>
            <input matInput type="datetime-local" name="janela" [(ngModel)]="janela" [required]="data.modo === 'solicitar'" [min]="agora" />
            @if (data.modo === 'aprovar' && data.detalhe.janela) {
              <mat-hint>Proposta: {{ data.detalhe.janela | date: 'dd/MM/yyyy HH:mm' }}. Ajuste se precisar.</mat-hint>
            } @else {
              <mat-hint>Data e hora planejadas para aplicar (R-05)</mat-hint>
            }
          </mat-form-field>
        }

        @if (data.modo === 'cancelar') {
          <p class="aviso">A atualização fica como Cancelada, com o motivo na linha do tempo. Nada é apagado.</p>
        }

        <mat-form-field appearance="outline">
          <mat-label>{{ textos.comentario }}</mat-label>
          <textarea matInput name="comentario" [(ngModel)]="comentario" rows="3" maxlength="2000" [required]="textos.comentarioObrigatorio"></textarea>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Voltar</button>
        <button mat-flat-button type="submit" [class.perigo]="data.modo === 'recusar' || data.modo === 'cancelar'" [disabled]="form.invalid || salvando()">
          {{ textos.botao }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .campos {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: min(440px, 80vw);
    }

    .contexto {
      margin: 0 0 12px;
    }

    .emergencial {
      color: #d32f2f;
      font-size: .8rem;
    }

    .aviso {
      margin: 0 0 8px;
      font-size: .8rem;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
    }

    .perigo:not([disabled]) {
      --mat-button-filled-container-color: #c62828;
      --mat-button-filled-label-text-color: #fff;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JanelaDialogComponent {
  readonly data = inject<JanelaDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<JanelaDialogComponent, AtualizacaoDetalhe>>(MatDialogRef);
  private readonly service = inject(AtualizacaoService);

  readonly textos = TEXTOS[this.data.modo];
  readonly salvando = signal(false);
  readonly agora = paraDatetimeLocal(new Date());

  janela = this.data.detalhe.janela ? this.data.detalhe.janela.substring(0, 16) : '';
  comentario = '';

  confirmar() {
    const cod = this.data.detalhe.codAtualizacao;
    const comentario = this.comentario.trim() || null;
    let pedido: Observable<AtualizacaoDetalhe>;
    switch (this.data.modo) {
      case 'solicitar':
        pedido = this.service.solicitarAprovacao(cod, this.janela, comentario);
        break;
      case 'aprovar':
        pedido = this.service.aprovar(cod, this.janela || null, comentario);
        break;
      case 'recusar':
        pedido = this.service.recusar(cod, comentario ?? '');
        break;
      default:
        pedido = this.service.cancelar(cod, comentario ?? '');
    }
    this.salvando.set(true);
    pedido.pipe(finalize(() => this.salvando.set(false))).subscribe({
      next: detalhe => this.dialogRef.close(detalhe),
      error: () => {},
    });
  }
}

function paraDatetimeLocal(data: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}T${p(data.getHours())}:${p(data.getMinutes())}`;
}
