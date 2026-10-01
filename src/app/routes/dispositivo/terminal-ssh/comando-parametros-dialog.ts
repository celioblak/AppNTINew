import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ServidorComando } from '@core';

import { aplicarParametros } from './comandos';

export interface ComandoParametrosDialogData {
  comando: ServidorComando;
  parametros: string[];
}

/** Pede os valores dos parâmetros {{nome}} e devolve o comando final. */
@Component({
  selector: 'app-comando-parametros-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>{{ data.comando.dsTitulo }}</h2>
    <form #form="ngForm" (ngSubmit)="confirmar()">
      <mat-dialog-content>
        @if (data.comando.dsDescricao) {
          <p class="descricao">{{ data.comando.dsDescricao }}</p>
        }
        @for (nome of data.parametros; track nome) {
          <mat-form-field appearance="outline" class="campo">
            <mat-label>{{ nome }}</mat-label>
            <input matInput [name]="nome" [(ngModel)]="valores[nome]" required autocomplete="off">
          </mat-form-field>
        }
        <div class="previa">
          <span class="previa-rotulo">Comando que será enviado</span>
          <code>{{ previa() }}</code>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="form.invalid">Continuar</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .descricao {
      margin-top: 0;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
    }

    .campo {
      width: 100%;
    }

    .previa {
      display: flex;
      flex-direction: column;
      gap: 4px;

      code {
        padding: 8px 10px;
        border-radius: 6px;
        background-color: #0f1419;
        color: #e6e1cf;
        font-family: 'Cascadia Mono', Consolas, monospace;
        white-space: pre-wrap;
        word-break: break-all;
      }
    }

    .previa-rotulo {
      font-size: .75rem;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComandoParametrosDialogComponent {
  readonly data = inject<ComandoParametrosDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ComandoParametrosDialogComponent, string>>(MatDialogRef);

  valores: Record<string, string> = {};

  previa() {
    return aplicarParametros(this.data.comando.dsComando, this.valores);
  }

  confirmar() {
    this.dialogRef.close(this.previa());
  }
}
