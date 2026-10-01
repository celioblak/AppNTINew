import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatInputModule } from '@angular/material/input';
import { FormlyModule, FormlyFieldConfig } from '@ngx-formly/core';
import { FormlyMaterialModule } from '@ngx-formly/material';
import { FormlyMatDatepickerModule } from '@ngx-formly/material/datepicker';
import { HotToastService } from '@ngxpert/hot-toast';

import { Feriado } from '@core/interface';
import { FeriadoService } from '../feriado.service';

@Component({
  selector: 'dialog-feriado',
  template: `
    <h2 mat-dialog-title>{{ data.modo === 'adicionar' ? 'Novo Feriado' : 'Editar Feriado' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form">
        <formly-form [form]="form" [fields]="fields" [model]="model"></formly-form>
        <!-- Opcional: exibir erros do formulário para debug -->
        <pre *ngIf="false">Form valid: {{ form.valid | json }}</pre>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancelar()">Cancelar</button>
      <button mat-raised-button color="primary" (click)="submit()" [disabled]="!form.valid">Salvar</button>
    </mat-dialog-actions>
  `,
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatCheckboxModule,
    MatInputModule,
    FormlyModule,
    FormlyMaterialModule,
    FormlyMatDatepickerModule,
  ],
})
export class DialogFeriadoComponent {
  private readonly feriadoService = inject(FeriadoService);
  private readonly toast = inject(HotToastService);
  private readonly dialogRef = inject(MatDialogRef<DialogFeriadoComponent>);
  private readonly data = inject(MAT_DIALOG_DATA);

  form = new FormGroup({});
  model: any = {};
  fields: FormlyFieldConfig[] = [];

  constructor() {
    this.initializeForm();
  }

  private initializeForm() {

    const feriado = this.data.feriado || {};

     this.model = {
        id: feriado.id || null,
        data: feriado.data ? new Date(feriado.data) : new Date(), // ← data atual como padrão
        nome: feriado.nome || '',
        fixo: false,
        anosFuturos: 5,
      };

    this.fields = [
      {
        key: 'data',
        type: 'datepicker',
        templateOptions: {
          label: 'Data',
          required: true,
          datepickerOptions: { startView: 'multi-year' },
        },
        // Garante que o valor seja uma data válida
        //parsers: [(value: any) => value ? new Date(value) : null],
      },
      {
        key: 'nome',
        type: 'input',
        templateOptions: {
          label: 'Nome do Feriado',
          required: true,
          maxLength: 100,
        },
      },
      {
        key: 'fixo',
        type: 'checkbox',
        templateOptions: {
          label: 'Feriado fixo (repetir anualmente)',
        },
        hideExpression: this.data.modo === 'editar',
      },
      {
        key: 'anosFuturos',
        type: 'input',
        templateOptions: {
          label: 'Repetir por quantos anos?',
          type: 'number',
          min: 1,
          max: 20,
          required: true,
        },
        hideExpression: (model: any) => !model.fixo || this.data.modo === 'editar',
        // Validação condicional: só é obrigatório quando visível
        validators: {
          requiredIfVisible: {
            expression: (c: any) => {
              const model = this.model;
              return !model.fixo || (c.value && c.value > 0);
            },
            message: 'Informe a quantidade de anos',
          },
        },
      },
    ];
  }

  submit() {
    console.log('Form válido?', this.form.valid); // Para depuração
    if (this.form.valid) {
      const dataObj = this.model.data as Date;
      const dataStr = dataObj.toISOString().split('T')[0]; // YYYY-MM-DD

      const feriadoBase: Feriado = {
        id: this.model.id,
        data: dataStr,
        nome: this.model.nome,
      };

      if (this.data.modo === 'editar') {
        this.feriadoService.updateFeriado(feriadoBase.id!, feriadoBase).subscribe({
          next: () => {
            this.toast.success('Feriado atualizado com sucesso!');
            this.dialogRef.close(true);
          },
          error: (err) => {
            this.toast.error('Erro ao atualizar feriado');
            console.error(err);
          },
        });
        return;
      }

      if (this.model.fixo) {
        this.criarFeriadosRecorrentes(feriadoBase, this.model.anosFuturos);
      } else {
        this.feriadoService.createFeriado(feriadoBase).subscribe({
          next: () => {
            this.toast.success('Feriado cadastrado com sucesso!');
            this.dialogRef.close(true);
          },
          error: (err) => {
            this.toast.error('Erro ao cadastrar feriado');
            console.error(err);
          },
        });
      }
    }
  }

  private criarFeriadosRecorrentes(feriadoBase: Feriado, anosFuturos: number) {
    const dataBase = new Date(feriadoBase.data);
    const dia = dataBase.getDate();
    const mes = dataBase.getMonth() + 1;
    const anoBase = dataBase.getFullYear();

    // Gera anos futuros (não inclui o ano base novamente)
    const anos = [];
    for (let i = 1; i <= anosFuturos; i++) {
      anos.push(anoBase + i);
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
        nome: feriadoBase.nome,
      };
      return this.feriadoService.createFeriado(feriadoCopy);
    });

    // Adiciona o ano base apenas se estiver criando (já incluso no form)
    // Não adicionar novamente para evitar duplicação

    Promise.all(requests.map(req => req.toPromise()))
      .then(() => {
        this.toast.success(`${requests.length} feriados cadastrados com sucesso!`);
        this.dialogRef.close(true);
      })
      .catch((err) => {
        this.toast.error('Erro ao cadastrar feriados recorrentes');
        console.error(err);
      });
  }

  private isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  cancelar() {
    this.dialogRef.close('cancelado');
  }
}
