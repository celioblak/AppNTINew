import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { finalize } from 'rxjs';

import { Artefato, AtualizacaoDetalhe } from '../atualizacao.models';
import { AtualizacaoService } from '../atualizacao.service';

export interface ArtefatoDialogData {
  detalhe: AtualizacaoDetalhe;
  artefato: Artefato;
}

/** Altera nome e observação do artefato. Tipo e destinos vêm da inclusão e do cadastro do sistema. */
@Component({
  selector: 'app-atualizacao-artefato-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>Alterar {{ data.artefato.nome }}</h2>
    <form #form="ngForm" (ngSubmit)="salvar()">
      <mat-dialog-content class="campos">
        <p class="dica">
          {{ data.artefato.tipo }}. Os destinos vêm do cadastro do sistema: para mudá-los, ajuste a configuração e use "Recalcular destinos".
        </p>
        <mat-form-field appearance="outline">
          <mat-label>Nome do artefato</mat-label>
          <input matInput name="nome" [(ngModel)]="nome" required maxlength="255" autocomplete="off" cdkFocusInitial />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Observação</mat-label>
          <textarea matInput name="observacao" [(ngModel)]="observacao" rows="3" maxlength="1000"></textarea>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="form.invalid || salvando()">Salvar</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .campos {
      display: flex;
      flex-direction: column;
      gap: 4px;
      width: min(520px, 86vw);
      padding-top: 8px !important;
    }

    .dica {
      margin: 0 0 8px;
      font-size: .8rem;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArtefatoDialogComponent {
  readonly data = inject<ArtefatoDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ArtefatoDialogComponent, AtualizacaoDetalhe>>(MatDialogRef);
  private readonly service = inject(AtualizacaoService);

  readonly salvando = signal(false);
  nome = this.data.artefato.nome;
  observacao = this.data.artefato.observacao ?? '';

  salvar() {
    this.salvando.set(true);
    this.service
      .alterarArtefato(this.data.artefato.codArtefato, {
        nome: this.nome.trim(),
        codTipoArtefato: this.data.artefato.codTipoArtefato,
        observacao: this.observacao.trim() || null,
      })
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({ next: detalhe => this.dialogRef.close(detalhe), error: () => {} });
  }
}
