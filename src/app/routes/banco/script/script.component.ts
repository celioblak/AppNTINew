// script.component.ts - VERSÃO FINAL CORRIGIDA
import { Clipboard, ClipboardModule } from '@angular/cdk/clipboard';
import { CommonModule } from '@angular/common';
import { Component, Inject, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatOptionModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MtxGridColumn, MtxGridModule } from '@ng-matero/extensions/grid';
import { MtxSelectModule } from '@ng-matero/extensions/select';
import { TranslateModule } from '@ngx-translate/core';
import { BreadcrumbComponent } from '@shared';
import { ScriptService } from './script.service';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { ToastrService } from 'ngx-toastr';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Script } from '@core';
import { FormlyModule } from '@ngx-formly/core';
import { catchError, finalize } from 'rxjs';
import { cloneDeep } from "lodash";
import { SqlProfessionalEditorComponent } from '@shared/sql-editor/sql-professional-editor.component';


// Import nosso editor SQL


@Component({
  selector: 'app-script',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MtxGridModule,
    MatInputModule,
    MatOptionModule,
    MatSelectModule,
    ReactiveFormsModule,
    MatCardModule,
    MatDatepickerModule,
    MatIconModule,
    TranslateModule,
    MatRadioModule,
    MtxSelectModule,
    CommonModule,
    ClipboardModule,
    MatMenuModule,
    MatDialogModule,
    SqlProfessionalEditorComponent,
    MatListModule,
    MatDividerModule,
  ],
  templateUrl: './script.component.html',
  styleUrl: './script.component.scss'
})
export class ScriptComponent implements OnInit {
  private readonly toast = inject(ToastrService);
  private readonly clipboard = inject(Clipboard);
  private readonly scriptService = inject(ScriptService);
  private readonly cdr = inject(ChangeDetectorRef);

  dados: Script = {};
  private dadosAnterior: Script = {};
  sql: any = '';
  snEdicao: boolean = false;

  dialog = inject(MatDialog);

  list: any[] = [];
  noResult = 'Nenhum registro encontrado';



  columns: MtxGridColumn[] = [
    {
      header: 'Nome',
      field: 'nome',
      width: '100%',
      resizable: false,
      formatter: (data: any) => `<span class="label">${data?.nome ? data?.nome : ''}</span>`
    },
  ];

  ngOnInit() {
    this.search();
  }

  habilitarEdicao() {
    this.dadosAnterior = cloneDeep(this.dados);
    this.snEdicao = true;
    this.openAddDialogEditar();
  }

  cancelaEditar() {
    this.snEdicao = false;
    this.dados = cloneDeep(this.dadosAnterior);
    this.sql = this.dados.sql || '';
    this.cdr.detectChanges();
  }

  salvarEdicao() {
    this.scriptService
      .atualizarScript(this.dados)
      .pipe(
        finalize(() => {
          this.snEdicao = false;
        }),
        catchError((err, caught) => {
          console.log('err ' + err)
          return err;
        })
      )
      .subscribe(res => {
        this.search();
        this.toast.info('Script salvo com sucesso', 'Sucesso');
        this.dadosAnterior = cloneDeep(this.dados);
      });
  }

  dialogAdicionarCancelado(result: any) {
    if (result != 'cancelado') {
      this.search();
    }
  }

  openAddDialogAdicionar() {
    const dialogRef = this.dialog.open(DialogAddComponent, {
      maxWidth: '70vw',
      width: '80%',
      panelClass: 'full-screen-modal',
      disableClose: true
    });
    dialogRef.afterClosed().subscribe(result => (this.dialogAdicionarCancelado(result)));
  }

  openAddDialogEditar() {
    const dialogRef = this.dialog.open(DialogAddComponent, {
      data: this.dados,
      maxWidth: '70vw',
      width: '80%',
      panelClass: 'full-screen-modal',
      disableClose: true
    });
    dialogRef.afterClosed().subscribe(result => (this.dialogAdicionarCancelado(result)));
  }

  openAddDialogConfirDelecao() {
    const dialogRef = this.dialog.open(DialogDelComponent, { data: this.dados });
    dialogRef.afterClosed().subscribe(result => (this.deletarScript(result)));
  }

  deletarScript(confir: string) {
    if (confir == 'SIM') {
      this.scriptService
        .deletarScript(this.dados)
        .pipe(
          finalize(() => {
          }),
          catchError((err, caught) => {
            console.log('err ' + err)
            return err;
          })
        )
        .subscribe(res => {
          this.search();
          this.toast.info('Script ' + this.dados.nome + ' deletado com sucesso', 'Sucesso');
          this.dados = {};
          this.sql = '';
        });
    }
  }

  changeSelect(event: any) {
    const selectedRow = event[0];
    if (selectedRow) {
      // Limpa primeiro
      this.dados = {};
      this.sql = '';
      this.cdr.detectChanges();

      // Depois atribui os novos valores
      setTimeout(() => {
        this.dados = { ...selectedRow };
        this.sql = this.dados.sql || '';
        this.cdr.detectChanges();
      }, 50);
    }
  }

  onCodeChange(code: string) {
    console.log('Código alterado:', code);
  }

  onExecute(sql: string) {
    console.log('Executando SQL:', sql);
    // Aqui você faria a chamada HTTP para o backend
    // Exemplo: this.sqlService.execute(sql).subscribe(...)
  }

  copysql() {
    this.copy(this.sql);
  }

  copy(value: string) {
    this.clipboard.copy(value);
    this.toast.info('Valor copiado para area de transferência', 'Area de Transferência');
  }

  search() {
    this.scriptService.carregarScripts().subscribe(dadosScript => {
      this.dados = {};
      this.sql = '';
      this.snEdicao = false;
      this.list = dadosScript;
    });
  }

  filterBy(nameInput: HTMLInputElement) {
    if (nameInput.value) {
      this.list = this.list.filter(p => p.nome.toLowerCase().includes(nameInput.value.toLowerCase()));
    } else {
      this.search();
    }
  }


}

// Dialog Add/Edit
@Component({
  selector: 'dialog-add',
  templateUrl: 'dialog-add.html',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
    MatSelectModule,
    MatOptionModule,
    FormlyModule,
    MatDatepickerModule,
    CommonModule,
    SqlProfessionalEditorComponent
  ],
})
export class DialogAddComponent implements OnInit {
  private readonly scriptService = inject(ScriptService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastrService);

  reactiveForm = this.fb.nonNullable.group({
    nome: ['', [Validators.required]],
    funcao: ['', [Validators.required]],
    script: ['', [Validators.required]],
  });

  constructor(
    @Inject(MAT_DIALOG_DATA) public dataDialog: any,
    private dialogRef: MatDialogRef<DialogAddComponent>
  ) {}

  ngOnInit() {
    if (this.dataDialog == null) {
      this.dataDialog = {};
    } else {
      setTimeout(() => {
        this.reactiveForm.patchValue({
          nome: this.dataDialog.nome || '',
          funcao: this.dataDialog.funcao || '',
          script: this.dataDialog.sql || ''
        });
      }, 100);
    }
  }

  closeDialog() {
    this.dialogRef.close('cancelado');
  }

  salvar() {
    this.dataDialog.funcao = this.getFc['funcao'].value;
    this.dataDialog.nome = this.getFc['nome'].value;
    this.dataDialog.sql = this.getFc['script'].value;

    var requerideTextAlert = "";
    if (this.dataDialog.nome == '') {
      requerideTextAlert = 'Nome '
    }

    if (this.dataDialog.funcao == '') {
      if (requerideTextAlert == '') {
        requerideTextAlert = 'Função';
      } else {
        requerideTextAlert = requerideTextAlert + ", Função";
      }
    }

    if (this.dataDialog.sql == '') {
      if (requerideTextAlert == '') {
        requerideTextAlert = 'Script';
      } else {
        requerideTextAlert = requerideTextAlert + ' e Script';
      }
    }

    if (requerideTextAlert != '') {
      requerideTextAlert = requerideTextAlert + ' Deve ser informado';
      this.toast.warning(requerideTextAlert, 'Campos Requeridos');
      return;
    }

    this.scriptService
      .salvarScript(this.dataDialog)
      .pipe(
        finalize(() => {
        }),
        catchError((err, caught) => {
          console.log('err ' + err)
          return err;
        })
      )
      .subscribe(res => {
        this.toast.info('Script salvo com sucesso', 'Sucesso');
        this.dialogRef.close('sucesso');
      });
  }

  get getFc() {
    return this.reactiveForm.controls;
  }
}

// Dialog Delete
@Component({
  selector: 'dialog-delete',
  templateUrl: 'dialog-delete.html',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
    MatSelectModule,
    MatOptionModule,
    FormlyModule,
    MatDatepickerModule,
  ],
})
export class DialogDelComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public dataDialog: any,
    private dialogRef: MatDialogRef<DialogDelComponent>
  ) {}

  closeDialog() {
    this.dialogRef.close('NAO');
  }

  confirmarDelecao() {
    this.dialogRef.close('SIM');
  }
}
