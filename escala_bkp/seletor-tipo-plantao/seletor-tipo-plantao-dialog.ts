import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { TipoPlantao } from '@core';
import { ContrastColorPipe } from '../contrast-color.pipe'; // Ajuste o caminho conforme necessário

@Component({
  selector: 'app-seletor-tipo-plantao-dialog',
  templateUrl: './seletor-tipo-plantao-dialog.html',
  styleUrls: ['./seletor-tipo-plantao-dialog.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    ContrastColorPipe
  ]
})
export class SeletorTipoPlantaoDialog {
  constructor(
    public dialogRef: MatDialogRef<SeletorTipoPlantaoDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { tipos: TipoPlantao[] }
  ) {}

  selecionar(tipo: TipoPlantao): void {
    this.dialogRef.close(tipo);
  }
}
