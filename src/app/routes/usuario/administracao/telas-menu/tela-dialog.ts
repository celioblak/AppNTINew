import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { finalize } from 'rxjs';

import { TelaCadastro, TelasMenuService } from './telas-menu.service';

export interface TelaDialogData {
  tela?: TelaCadastro;
}

@Component({
  selector: 'app-tela-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSlideToggleModule],
  template: `
    <h2 mat-dialog-title>{{ data.tela ? 'Editar tela' : 'Nova tela' }}</h2>
    <form [formGroup]="form" (ngSubmit)="salvar()">
      <mat-dialog-content class="formulario">
        <mat-form-field appearance="outline" class="inteiro">
          <mat-label>Nome da tela</mat-label>
          <input matInput formControlName="dsTela" autocomplete="off" cdkFocusInitial>
          <mat-hint>É o nome que aparece em Gerenciar Acesso.</mat-hint>
          <mat-error>Informe o nome da tela</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Módulo</mat-label>
          <input matInput formControlName="dsModulo" autocomplete="off">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Grupo do menu</mat-label>
          <input matInput formControlName="dsGrupoMenu" autocomplete="off">
        </mat-form-field>
        <mat-form-field appearance="outline" class="inteiro">
          <mat-label>Roles</mat-label>
          <input matInput formControlName="roles" autocomplete="off">
        </mat-form-field>
        <mat-slide-toggle formControlName="snAtivo" class="inteiro">Tela ativa</mat-slide-toggle>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="salvando()">Salvar</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .formulario {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0 12px;
    }

    .inteiro {
      grid-column: 1 / -1;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TelaDialogComponent {
  readonly data = inject<TelaDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<TelaDialogComponent, TelaCadastro>>(MatDialogRef);
  private readonly service = inject(TelasMenuService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly salvando = signal(false);

  readonly form = this.fb.group({
    dsTela: [this.data.tela?.dsTela ?? '', Validators.required],
    dsModulo: [this.data.tela?.dsModulo ?? ''],
    dsGrupoMenu: [this.data.tela?.dsGrupoMenu ?? ''],
    roles: [this.data.tela?.roles ?? ''],
    snAtivo: [this.data.tela?.snAtivo ?? true],
  });

  salvar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const valores = this.form.getRawValue();
    this.salvando.set(true);
    this.service
      .salvarTela({ ...valores, codTela: this.data.tela?.codTela })
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({
        next: salva => this.dialogRef.close(salva),
        // O errorInterceptor já exibe a mensagem do backend.
        error: () => {},
      });
  }
}
