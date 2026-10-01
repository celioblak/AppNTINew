import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface MotivoDialogData {
  titulo: string;
  descricao?: string;
  rotulo: string;
  botao: string;
}

/** Pede um texto obrigatório (justificativa, motivo) e devolve ao fechar. */
@Component({
  selector: 'app-atualizacao-motivo-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>{{ data.titulo }}</h2>
    <form #form="ngForm" (ngSubmit)="confirmar()">
      <mat-dialog-content class="campos">
        @if (data.descricao) {
          <p class="dica">{{ data.descricao }}</p>
        }
        <mat-form-field appearance="outline">
          <mat-label>{{ data.rotulo }}</mat-label>
          <textarea matInput name="texto" [(ngModel)]="texto" rows="3" required maxlength="1000" cdkFocusInitial></textarea>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Voltar</button>
        <button mat-flat-button type="submit" [disabled]="form.invalid">{{ data.botao }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .campos {
      display: flex;
      flex-direction: column;
      width: min(480px, 86vw);
      padding-top: 8px !important;
    }

    .dica {
      margin: 0 0 8px;
      font-size: .82rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MotivoDialogComponent {
  readonly data = inject<MotivoDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<MotivoDialogComponent, string>>(MatDialogRef);
  texto = '';

  confirmar() {
    this.dialogRef.close(this.texto.trim());
  }
}
