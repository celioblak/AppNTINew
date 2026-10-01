// src/app/routes/sprint/criar/adicionar-ticket-dialog.component.ts
import { Component, inject, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

// Material
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-adicionar-ticket-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule
  ],
  template: `
    <h2 mat-dialog-title>Adicionar Ticket à Sprint</h2>
    <mat-dialog-content>
      <form [formGroup]="form">
        <div class="mb-4">
          <p><strong>Ticket:</strong> {{ data.ticket.id }}</p>
          <p><strong>Título:</strong> {{ data.ticket.titulo }}</p>
        </div>

        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Criticidade</mat-label>
          <mat-select formControlName="criticidade">
            <mat-option [value]="1">Nível 1 - Impacto crítico negócio PARADA TOTAL</mat-option>
            <mat-option [value]="2">Nível 2 - Impacto significativo ao negócio</mat-option>
            <mat-option [value]="3">Nível 3 - Impacto reduzido ao negócio</mat-option>
            <mat-option [value]="4">Nível 4 - Baixo impacto</mat-option>
          </mat-select>
          <mat-error *ngIf="form.get('criticidade')?.hasError('required')">
            Criticidade é obrigatória
          </mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Observação (opcional)</mat-label>
          <textarea matInput formControlName="observacao" rows="3"
                    placeholder="Observações sobre este ticket"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancelar()">Cancelar</button>
      <button mat-raised-button color="primary"
              (click)="confirmar()"
              [disabled]="form.invalid">
        Adicionar
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      min-width: 400px;
    }
  `]
})
export class AdicionarTicketDialogComponent {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<AdicionarTicketDialogComponent>);

  form: FormGroup;

  constructor(@Inject(MAT_DIALOG_DATA) public data: any) {
    this.form = this.fb.group({
      criticidade: [null, Validators.required],
      observacao: ['']
    });
  }

  confirmar(): void {
    if (this.form.valid) {
      this.dialogRef.close(this.form.value);
    }
  }

  cancelar(): void {
    this.dialogRef.close();
  }
}
