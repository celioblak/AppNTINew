import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface ConfirmDialogData {
  titulo: string;
  mensagem: string;
  confirmarTexto?: string;
  cancelarTexto?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.titulo }}</h2>
    <mat-dialog-content>
      <p>{{ data.mensagem }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">
        {{ data.cancelarTexto || 'Cancelar' }}
      </button>
      <button mat-raised-button color="warn" [mat-dialog-close]="true">
        {{ data.confirmarTexto || 'Confirmar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host {
      display: block;
      max-width: 400px;
    }
    mat-dialog-content p {
      margin: 20px 0;
      font-size: 16px;
      color: #555;
      line-height: 1.5;
    }
    mat-dialog-actions {
      padding: 20px 0 0 0;
      margin: 0;
      gap: 8px;
    }
    button[mat-raised-button] {
      min-width: 100px;
    }
  `]
})
export class ConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) {}
}
