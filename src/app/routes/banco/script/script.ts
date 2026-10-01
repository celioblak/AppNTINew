// script.component.ts - VERSÃO FINAL CORRIGIDA
import { Clipboard, ClipboardModule } from '@angular/cdk/clipboard';
import { CommonModule } from '@angular/common';
import { Component, HostListener, Inject, inject, OnInit, ChangeDetectorRef } from '@angular/core';
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
import { ScriptService } from './script.service';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';

import { FormlyModule } from '@ngx-formly/core';
import { catchError, finalize } from 'rxjs';
import { HotToastService } from '@ngxpert/hot-toast';
import { CodeEditorComponent } from '@shared/components/code-editor/code-editor';
import { Script } from '@core/interface';


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
    MatListModule,
    MatDividerModule,
    CodeEditorComponent
  ],
  templateUrl: './script.html',
  styleUrl: './script.scss'
})
export class ScriptComponent implements OnInit {
  private readonly toast = inject(HotToastService);
  private readonly clipboard = inject(Clipboard);
  private readonly scriptService = inject(ScriptService);
  private readonly cdr = inject(ChangeDetectorRef);

  dados: Script = {};
  private dadosAnterior: Script = {};
  sql: any = '';
  snEdicao: boolean = false;

  isMobile = window.innerWidth < 768;

  @HostListener('window:resize')
  onWindowResize() {
    this.isMobile = window.innerWidth < 768;
  }

  dialog = inject(MatDialog);

  /** Lista completa vinda do backend — base para filterBy(), nunca é sobrescrita pelo filtro. */
  private listaCompleta: any[] = [];
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
    this.dadosAnterior = structuredClone(this.dados);
    this.snEdicao = true;
    this.openAddDialogEditar();
  }

  cancelaEditar() {
    this.snEdicao = false;
    this.dados = structuredClone(this.dadosAnterior);
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
        this.toast.info('Script salvo com sucesso');
        this.dadosAnterior = structuredClone(this.dados);
      });
  }

  dialogAdicionarCancelado(result: any) {
    if (result != 'cancelado') {
      this.search();
    }
  }

  openAddDialogAdicionar() {
    const dialogRef = this.dialog.open(DialogAddComponent, {
      maxWidth: '90vw',
      maxHeight: '90vh',
      width: this.isMobile ? '95%' : '800px',
      panelClass: 'full-screen-modal',
      disableClose: true
    });
    dialogRef.afterClosed().subscribe(result => (this.dialogAdicionarCancelado(result)));
  }

  openAddDialogEditar() {
    const dialogRef = this.dialog.open(DialogAddComponent, {
      data: this.dados,
      maxWidth: '90vw',
      maxHeight: '90vh',
      width: this.isMobile ? '95%' : '800px',
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
  if (confir === 'SIM') {
    this.scriptService
      .deletarScript(this.dados)
      .pipe(
        finalize(() => {}),
        catchError((err, caught) => {
          console.log('err ' + err);
          return err;
        })
      )
      .subscribe(res => {
        this.search();
        this.toast.info('Script ' + this.dados.nome + ' deletado com sucesso');
        this.dados = {};
        this.cdr.detectChanges(); // força atualização sem NG0100
        // limpa o editor em outro ciclo para evitar NG0100
        setTimeout(() => {
          this.sql = '';
        });
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
  }

  copysql() {
    this.copy(this.sql);
  }

  copy(value: string) {
    this.clipboard.copy(value);
    this.toast.info('Valor copiado para area de transferência');
  }

  search() {
    this.scriptService.carregarScripts().subscribe(dadosScript => {
      this.dados = {};
      this.sql = '';
      this.snEdicao = false;
      this.listaCompleta = dadosScript;
      this.list = dadosScript;
      this.cdr.detectChanges();
    });
  }

  /** Sempre filtra a partir da lista completa — nunca do resultado do filtro anterior, senão um novo filtro nunca reencontraria itens já descartados. */
  filterBy(nameInput: HTMLInputElement) {
    if (nameInput.value) {
      this.list = this.listaCompleta.filter(p => p.nome.toLowerCase().includes(nameInput.value.toLowerCase()));
    } else {
      this.list = this.listaCompleta;
    }
  }

}

// Dialog Add/Edit (Script + Parâmetros)
@Component({
  selector: 'dialog-add',
  templateUrl: 'dialog-add.html',
  styleUrl: './dialog-add.scss',
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
    MatDividerModule,
    MatTooltipModule,
    FormlyModule,
    MatDatepickerModule,
    CommonModule,
    CodeEditorComponent
  ],
})
export class DialogAddComponent implements OnInit {
  private readonly scriptService = inject(ScriptService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(HotToastService);

  reactiveForm = this.fb.nonNullable.group({
    nome: ['', [Validators.required]],
    funcao: ['', [Validators.required]],
    script: ['', [Validators.required]],
    tipoSql: ['QUERY', [Validators.required]],
  });

  constructor(
    @Inject(MAT_DIALOG_DATA) public dataDialog: any,
    private dialogRef: MatDialogRef<DialogAddComponent>
  ) {}

  ngOnInit() {
    if (this.dataDialog == null) {
      this.dataDialog = {};
      return;
    }

    setTimeout(() => {
      this.reactiveForm.patchValue({
        nome: this.dataDialog.nome || '',
        funcao: this.dataDialog.funcao || '',
        script: this.dataDialog.sql || '',
        tipoSql: this.dataDialog.tipoSql || 'QUERY'
      });
    }, 100);
  }

  closeDialog() {
    this.dialogRef.close('cancelado');
  }

  salvar() {

  const nome = this.getFc['nome'].value?.trim();
  const funcao = this.getFc['funcao'].value?.trim();
  const script = this.getFc['script'].value?.trim();
  const tipoSql = this.getFc['tipoSql'].value;

  let requiredText = '';

  if (!nome) requiredText += 'Nome, ';
  if (!funcao) requiredText += 'Função, ';
  if (!script) requiredText += 'Script, ';

  if (requiredText) {
    requiredText = requiredText.slice(0, -2);
    this.toast.warning(requiredText + ' deve ser informado');
    return;
  }

  this.dataDialog.nome = nome;
  this.dataDialog.funcao = funcao;
  this.dataDialog.sql = script;
  this.dataDialog.tipoSql = tipoSql;

  const ehNovo = !this.dataDialog.codSql;
  const salvarScript$ = ehNovo
    ? this.scriptService.salvarScript(this.dataDialog)
    : this.scriptService.atualizarScript(this.dataDialog);

  salvarScript$.subscribe({
    next: () => {
      this.toast.success('Script salvo com sucesso');
      this.dialogRef.close('sucesso');
    },
    error: (err: any) => {
      const msg = err?.error?.message || 'Falha ao salvar script';
      this.toast.error(msg);
    }
  });

}

  get getFc() {
    return this.reactiveForm.controls;
  }

  onScriptChange(value: string) {
    this.reactiveForm.get('script')?.setValue(value?.trim());
    this.reactiveForm.get('script')?.markAsDirty();
    this.reactiveForm.get('script')?.updateValueAndValidity();
  }

}

// Dialog Delete (Script)
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
