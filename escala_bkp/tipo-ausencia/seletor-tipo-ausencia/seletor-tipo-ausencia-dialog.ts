import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { TipoAusencia } from '@core';


export interface SeletorAusenciaData {
  tipos: TipoAusencia[];
}

@Component({
  selector: 'app-seletor-tipo-ausencia-dialog',
  templateUrl: './seletor-tipo-ausencia-dialog.html',
  styleUrls: ['./seletor-tipo-ausencia-dialog.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule
  ]
})
export class SeletorAusenciaDialog {
  tipoSelecionado: TipoAusencia | null = null;

  constructor(
    public dialogRef: MatDialogRef<SeletorAusenciaDialog>,
    @Inject(MAT_DIALOG_DATA) public data: SeletorAusenciaData
  ) {}

  selecionarTipo(tipo: TipoAusencia): void {
    this.tipoSelecionado = tipo;
  }

  confirmar(): void {
    if (this.tipoSelecionado) {
      this.dialogRef.close(this.tipoSelecionado);
    }
  }

  cancelar(): void {
    this.dialogRef.close();
  }
}
