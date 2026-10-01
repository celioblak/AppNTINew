import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormBuilder, ReactiveFormsModule, FormsModule, FormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { FormlyModule, FormlyFieldConfig } from '@ngx-formly/core';
import { FormlyMaterialModule } from '@ngx-formly/material';
import { HotToastService } from '@ngxpert/hot-toast';

import { FeriasFuncionario, Usuario } from '@core/interface';
import { FeriasService } from '../ferias.service';

@Component({
  selector: 'dialog-ferias',
  template: `
    <h2 mat-dialog-title>{{ data?.modo === 'adicionar' ? 'Nova Férias' : 'Editar Férias' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form">
        <!-- Usuário (autocomplete) -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Usuário</mat-label>
          <input
            matInput
            [matAutocomplete]="autoUsuario"
            [(ngModel)]="usuarioInput"
            (input)="filtrarUsuarios()"
            [ngModelOptions]="{standalone: true}"
            placeholder="Digite para buscar"
            required
          />
          <mat-autocomplete
            #autoUsuario="matAutocomplete"
            (optionSelected)="onUsuarioSelecionado($event.option.value)"
          >
            <mat-option *ngFor="let user of usuariosFiltrados" [value]="user.codusuario">
              {{ user.nome }}
            </mat-option>
          </mat-autocomplete>
        </mat-form-field>

        <!-- Data Início (manual) -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Data Início</mat-label>
          <input
            matInput
            [matDatepicker]="pickerInicio"
            [formControl]="dataInicioControl"
            (dateChange)="onStartDateChange()"
            required
          />
          <mat-datepicker-toggle matSuffix [for]="pickerInicio"></mat-datepicker-toggle>
          <mat-datepicker #pickerInicio startView="month" [startAt]="startAtDate"></mat-datepicker>
        </mat-form-field>

        <!-- Período (dias) via Formly -->
        <formly-form [form]="form" [fields]="fieldsPeriodo" [model]="model"></formly-form>

        <!-- Data Fim (manual) -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Data Fim</mat-label>
          <input
            matInput
            [matDatepicker]="pickerFim"
            [formControl]="dataFimControl"
            (dateChange)="onEndDateChange()"
            required
          />
          <mat-datepicker-toggle matSuffix [for]="pickerFim"></mat-datepicker-toggle>
          <mat-datepicker #pickerFim startView="month" [startAt]="startAtDate"></mat-datepicker>
        </mat-form-field>

        <!-- Observações via Formly -->
        <formly-form [form]="form" [fields]="fieldsObs" [model]="model"></formly-form>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancelar()">Cancelar</button>
      <button mat-raised-button color="primary" (click)="submit()" [disabled]="!form.valid || !model.idUsuario">Salvar</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width {
      width: 100%;
      margin-bottom: 16px;
    }
  `],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatInputModule,
    MatAutocompleteModule,
    MatDatepickerModule,
    MatNativeDateModule,
    FormlyModule,
    FormlyMaterialModule,
  ],
})
export class DialogFeriasComponent {
  private readonly fb = inject(FormBuilder);
  private readonly feriasService = inject(FeriasService);
  private readonly toast = inject(HotToastService);
  private readonly dialogRef = inject(MatDialogRef<DialogFeriasComponent>);
  private readonly data = inject(MAT_DIALOG_DATA);

  form: FormGroup;
  model: any = {};

  // Controles manuais com tipo explícito
  dataInicioControl = this.fb.control<Date | null>(null);
  dataFimControl = this.fb.control<Date | null>(null);

  // Campos Formly
  fieldsPeriodo: FormlyFieldConfig[] = [];
  fieldsObs: FormlyFieldConfig[] = [];

  // Autocomplete
  usuarios: Usuario[] = [];
  usuarioInput: string = '';
  usuariosFiltrados: Usuario[] = [];

  // Data para o startAt do calendário
  startAtDate: Date;

  private _recalculando = false;

  constructor() {
    const dialogData = this.data || { modo: 'adicionar', ferias: {}, usuarios: [], mesFiltro: 1, anoFiltro: 2024 };
    const ferias = dialogData.ferias || {};
    this.usuarios = dialogData.usuarios || [];
    this.usuariosFiltrados = [...this.usuarios];

    const mesFiltro = dialogData.mesFiltro || new Date().getMonth() + 1;
    const anoFiltro = dialogData.anoFiltro || new Date().getFullYear();
    this.startAtDate = new Date(anoFiltro, mesFiltro - 1, 1);

    // Prepara datas
    const dataInicio = ferias.dataInicio ? new Date(ferias.dataInicio) : null;
    const dataFim = ferias.dataFim ? new Date(ferias.dataFim) : null;

    let periodoInicial = 15;
    if (dataInicio && dataFim) {
      const diffTime = dataFim.getTime() - dataInicio.getTime();
      periodoInicial = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    this.model = {
      id: ferias.id || null,
      idUsuario: ferias.idUsuario || null,
      periodoDias: periodoInicial,
      observacoes: ferias.observacoes || '',
    };

    // Seta valores nos controles manuais
    this.dataInicioControl.setValue(dataInicio);
    this.dataFimControl.setValue(dataFim);

    // Preenche input do usuário se for edição
    if (ferias.idUsuario) {
      const user = this.usuarios.find(u => u.codusuario === ferias.idUsuario);
      this.usuarioInput = user ? (user.nome || '') : '';
    }

    // Cria o FormGroup
    this.form = this.fb.group({
      dataInicio: this.dataInicioControl,
      dataFim: this.dataFimControl,
      // Os campos do Formly serão adicionados dinamicamente
    });

    // Configura campos do Formly
    this.fieldsPeriodo = [
      {
        key: 'periodoDias',
        type: 'input',
        templateOptions: {
          label: 'Período (dias)',
          type: 'number',
          min: 1,
          required: true,
        },
      },
    ];

    this.fieldsObs = [
      {
        key: 'observacoes',
        type: 'textarea',
        templateOptions: {
          label: 'Observações',
          rows: 3,
        },
      },
    ];

    // Inscreve para mudanças nos controles manuais
    this.dataInicioControl.valueChanges.subscribe(() => {
      this.onStartDateChange();
    });

    this.dataFimControl.valueChanges.subscribe(() => {
      this.onEndDateChange();
    });

    // Aguarda criação do controle de período pelo Formly
    setTimeout(() => {
      const periodoControl = this.form.get('periodoDias');
      if (periodoControl) {
        periodoControl.valueChanges.subscribe(() => {
          this.onPeriodChange();
        });
      }
    });
  }

  filtrarUsuarios() {
    const termo = this.usuarioInput ? this.usuarioInput.toLowerCase() : '';
    this.usuariosFiltrados = this.usuarios.filter((u: Usuario) =>
      u.nome?.toLowerCase().includes(termo)
    );
  }

  onUsuarioSelecionado(id: number) {
    this.model.idUsuario = id;
    const user = this.usuarios.find((u: Usuario) => u.codusuario === id);
    this.usuarioInput = user ? (user.nome || '') : '';
  }

  private onStartDateChange() {
    if (this._recalculando) return;
    this._recalculando = true;
    const periodo = this.model.periodoDias;
    const dataInicio = this.dataInicioControl.value;
    if (periodo && dataInicio) {
      this.updateEndDateFromPeriod();
    }
    this._recalculando = false;
  }

  private onPeriodChange() {
    if (this._recalculando) return;
    this._recalculando = true;
    const periodo = this.model.periodoDias;
    const dataInicio = this.dataInicioControl.value;
    if (periodo && dataInicio) {
      this.updateEndDateFromPeriod();
    }
    this._recalculando = false;
  }

  private onEndDateChange() {
    if (this._recalculando) return;
    this._recalculando = true;
    const dataInicio = this.dataInicioControl.value;
    const dataFim = this.dataFimControl.value;
    if (dataInicio && dataFim) {
      this.updatePeriodFromEndDate();
    }
    this._recalculando = false;
  }

  private updateEndDateFromPeriod() {
    const inicio = this.dataInicioControl.value;
    const dias = this.model.periodoDias;
    if (!inicio || !dias) return;
    // Após a verificação, TypeScript sabe que 'inicio' é Date
    const fim = new Date(inicio);
    fim.setDate(inicio.getDate() + dias - 1);
    this.dataFimControl.setValue(fim, { emitEvent: false });
  }

  private updatePeriodFromEndDate() {
    const inicio = this.dataInicioControl.value;
    const fim = this.dataFimControl.value;
    if (!inicio || !fim) return;
    const diffTime = fim.getTime() - inicio.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > 0) {
      this.model.periodoDias = diffDays;
      // Atualiza o controle do período (que está no Formly)
      this.form.patchValue({ periodoDias: diffDays }, { emitEvent: false });
    }
  }

  submit() {
    const dataInicioVal = this.dataInicioControl.value;
    const dataFimVal = this.dataFimControl.value;
    if (this.form.valid && this.model.idUsuario && dataInicioVal && dataFimVal) {
      const dataInicio = dataInicioVal.toISOString().split('T')[0];
      const dataFim = dataFimVal.toISOString().split('T')[0];

      const ferias: FeriasFuncionario = {
        id: this.model.id,
        idUsuario: this.model.idUsuario,
        dataInicio: dataInicio,
        dataFim: dataFim,
        observacoes: this.model.observacoes,
      };

      this.feriasService.salvarFerias(ferias).subscribe({
        next: () => {
          this.toast.success(`Férias ${this.data?.modo === 'adicionar' ? 'cadastradas' : 'atualizadas'} com sucesso!`);
          this.dialogRef.close(true);
        },
        error: (err) => {
          this.toast.error(`Erro ao ${this.data?.modo === 'adicionar' ? 'cadastrar' : 'atualizar'} férias!`);
          console.error(err);
        },
      });
    }
  }

  cancelar() {
    this.dialogRef.close('cancelado');
  }
}
