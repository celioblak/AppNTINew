import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { GrupoServidorResumo } from '@core';
import { finalize } from 'rxjs';

import { GrupoServidorService } from './grupo-servidor.service';

export interface GrupoServidorDialogData {
  grupo?: GrupoServidorResumo;
}

@Component({
  selector: 'app-grupo-servidor-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>{{ data.grupo ? 'Renomear grupo' : 'Novo grupo de servidores' }}</h2>
    <form #form="ngForm" (ngSubmit)="salvar()">
      <mat-dialog-content>
        <mat-form-field appearance="outline" class="campo">
          <mat-label>Nome do grupo</mat-label>
          <input matInput name="dsGrupo" [(ngModel)]="dsGrupo" required maxlength="100" autocomplete="off" cdkFocusInitial>
          <mat-hint align="end">{{ dsGrupo.length }}/100</mat-hint>
          <mat-error>Informe o nome do grupo</mat-error>
        </mat-form-field>
        @if (data.grupo?.qtdServidores) {
          <p class="aviso">O novo nome vale para os {{ data.grupo!.qtdServidores }} servidores do grupo.</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="form.invalid || salvando()">Salvar</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .campo {
      width: 100%;
    }

    .aviso {
      margin: 0;
      font-size: .75rem;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrupoServidorDialogComponent {
  readonly data = inject<GrupoServidorDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<GrupoServidorDialogComponent, GrupoServidorResumo>>(MatDialogRef);
  private readonly service = inject(GrupoServidorService);

  dsGrupo = this.data.grupo?.dsGrupo ?? '';
  readonly salvando = signal(false);

  salvar() {
    this.salvando.set(true);
    this.service
      .salvar({ codGrupoServidor: this.data.grupo?.codGrupoServidor, dsGrupo: this.dsGrupo.trim() })
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({
        next: salvo => this.dialogRef.close(salvo),
        // O errorInterceptor já exibe a mensagem do backend (ex.: nome duplicado).
        error: () => {},
      });
  }
}
