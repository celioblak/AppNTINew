import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { FormlyModule, FormlyFieldConfig } from '@ngx-formly/core';
import { FormlyMaterialModule } from '@ngx-formly/material';
import { HotToastService } from '@ngxpert/hot-toast';

import { Feriado } from '@core/interface';
import { FeriadoService } from '../feriado.service';

@Component({
  selector: 'replicar-feriado-dialog',
  template: `
    <h2 mat-dialog-title>Replicar Feriado</h2>
    <mat-dialog-content>
      <p>Feriado: <strong>{{ feriadoOriginal.nome }} ({{ dataOriginal }})</strong></p>
      <form [formGroup]="form">
        <formly-form [form]="form" [fields]="fields" [model]="model"></formly-form>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancelar()">Cancelar</button>
      <button mat-raised-button color="primary" (click)="submit()" [disabled]="!form.valid">Replicar</button>
    </mat-dialog-actions>
  `,
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatInputModule,
    FormlyModule,
    FormlyMaterialModule,
  ],
})
export class ReplicarFeriadoDialogComponent {
  private readonly feriadoService = inject(FeriadoService);
  private readonly toast = inject(HotToastService);
  private readonly dialogRef = inject(MatDialogRef<ReplicarFeriadoDialogComponent>);
  private readonly data = inject(MAT_DIALOG_DATA);

  feriadoOriginal: Feriado = this.data.feriado;
  dataOriginal: string;

  form = new FormGroup({});
  model: any = {};
  fields: FormlyFieldConfig[] = [];

  constructor() {
    const [ano, mes, dia] = this.feriadoOriginal.data.split('-');
    this.dataOriginal = `${dia}/${mes}/${ano}`;

    this.model = {
      anoInicial: ano,
      anoFinal: new Date().getFullYear() + 5,
    };

    this.fields = [
      {
        key: 'anoInicial',
        type: 'input',
        templateOptions: {
          label: 'Ano inicial',
          type: 'number',
          min: 2000,
          max: 2100,
          required: true,
        },
      },
      {
        key: 'anoFinal',
        type: 'input',
        templateOptions: {
          label: 'Ano final',
          type: 'number',
          min: 2000,
          max: 2100,
          required: true,
        },
      },
    ];
  }

  submit() {
    if (this.form.valid) {
      const [dia, mes] = this.feriadoOriginal.data.split('-').map(Number);
      const anos: number[] = [];
      for (let a = this.model.anoInicial; a <= this.model.anoFinal; a++) {
        anos.push(a);
      }

      const requests = anos.map((ano) => {
        let dataStr: string;
        if (mes === 2 && dia === 29 && !this.isLeapYear(ano)) {
          dataStr = `${ano}-02-28`;
        } else {
          dataStr = `${ano}-${mes.toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`;
        }
        const feriadoCopy: Feriado = {
          data: dataStr,
          nome: this.feriadoOriginal.nome,
        };
        return this.feriadoService.createFeriado(feriadoCopy);
      });

      Promise.all(requests.map(req => req.toPromise()))
        .then(() => {
          this.toast.success(`${requests.length} feriados replicados com sucesso!`);
          this.dialogRef.close(true);
        })
        .catch((err) => {
          this.toast.error('Erro ao replicar feriados');
          console.error(err);
        });
    }
  }

  private isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  cancelar() {
    this.dialogRef.close('cancelado');
  }
}
