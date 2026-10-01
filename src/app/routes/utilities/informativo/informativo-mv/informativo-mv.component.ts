import {
  Component, Inject, inject, OnInit, AfterViewInit, ChangeDetectorRef
} from '@angular/core';
import {
  FormBuilder, FormGroup, FormsModule, ReactiveFormsModule,
  Validators, AbstractControl, ValidationErrors, ValidatorFn
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DATE_LOCALE, MatOptionModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { informativoMV } from '@core';
import {
  MtxDatetimepickerFilterType, MtxDatetimepickerModule
} from '@ng-matero/extensions/datetimepicker';
import { MtxGridColumn, MtxGridModule } from '@ng-matero/extensions/grid';
import { FormlyModule } from '@ngx-formly/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, finalize, Subscription } from 'rxjs';
import { InformativoMvService } from './informativo-mv.service';
import { CommonModule, DatePipe } from '@angular/common';
import { MtxSelectModule } from '@ng-matero/extensions/select';
import { MatMenuModule } from '@angular/material/menu';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { PageEvent } from '@angular/material/paginator';
import { HotToastService } from '@ngxpert/hot-toast';
import { MTX_DATETIME_FORMATS } from '@ng-matero/extensions/core';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function isValidDate(date: any): date is Date {
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Converte string ISO (com ou sem Z/offset) para Date SEM deslocamento de fuso.
 * Se a string vier sem timezone (ex: "2026-04-30T07:35:00"), evita que o
 * browser interprete como UTC e desloque +3h.
 */
function parseLocalDate(value: Date | string | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;

  // Se a string não tiver designador de fuso, adiciona offset local para
  // que o Date resultante aponte para o horário exato sem conversão.
  const hasTimezone = /[Zz]|[+\-]\d{2}:\d{2}$/.test(value);
  if (!hasTimezone) {
    // Trata como horário local diretamente
    return new Date(value.replace('T', ' '));
  }
  return new Date(value);
}

// ─── Validador de intervalo de datas ──────────────────────────────────────────

function dateRangeValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const fg = control as FormGroup;
    const ini = fg.get('dtInicio')?.value;
    const fim = fg.get('dtFinal')?.value;
    if (!ini || !fim) return null;
    const inicio = ini instanceof Date ? ini : new Date(ini);
    const final  = fim instanceof Date ? fim : new Date(fim);
    return inicio >= final ? { dateRange: true } : null;
  };
}

// ─── MTX_DATETIME_FORMATS compartilhado ──────────────────────────────────────
// FIX: token "ddd" é inválido no date-fns; o correto é "EEE".

const DATETIME_FORMATS = {
  parse: {
    dateInput:     'dd/MM/yyyy',
    timeInput:     'HH:mm',
    datetimeInput: 'dd/MM/yyyy HH:mm',
  },
  display: {
    dateInput:            'dd/MM/yyyy',
    monthYearLabel:       'MMM yyyy',
    dateA11yLabel:        'dd/MM/yyyy',
    monthYearA11yLabel:   'MMMM yyyy',
    timeInput:            'HH:mm',
    datetimeInput:        'dd/MM/yyyy HH:mm',
    popupHeaderDateLabel: 'EEE, dd MMM',   // FIX: era "ddd" → correto "EEE"
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// InformativoMvComponent
// ═══════════════════════════════════════════════════════════════════════════════

@Component({
  selector: 'app-informativo-mv',
  standalone: true,
  imports: [
    MtxGridModule,
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
    MtxDatetimepickerModule,
    TranslateModule,
    MtxSelectModule,
    CommonModule,
    MatMenuModule,
    MatListModule,
    MatDividerModule,
  ],
  templateUrl: './informativo-mv.component.html',
  styleUrl:    './informativo-mv.component.scss',
  providers: [
    DatePipe,
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' },
    { provide: MTX_DATETIME_FORMATS, useValue: DATETIME_FORMATS },
  ]
})
export class InformativoMvComponent implements OnInit {
  private readonly translate         = inject(TranslateService);
  private readonly toast             = inject(HotToastService);
  private readonly informativoService = inject(InformativoMvService);
  private readonly cdr               = inject(ChangeDetectorRef);
  private readonly fb                = inject(FormBuilder);

  dialog = inject(MatDialog);

  isLoading = false;
  list:  any[] = [];
  total = 0;
  noResult = 'Nenhum registro encontrado';

  informativoSelecionado: informativoMV = {} as informativoMV;

  // ── Formulário de filtros ──────────────────────────────────────────────────
  filterForm!: FormGroup;

  constructor(public datepipe: DatePipe) {}

  // ── Colunas da grid ───────────────────────────────────────────────────────

  columns: MtxGridColumn[] = [
    {
      header: 'Cod.',
      field: 'codMensagem',
      width: '70px',
      resizable: false,
      formatter: (data: any) =>
        `<span class="label">${data?.codMensagem ?? ''}</span>`,
    },
    {
      header: 'Descrição',
      field: 'dsMensagem',
      width: '100%',
      resizable: false,
      formatter: (data: any) =>
        `<span class="label">${data?.dsMensagem ?? ''}</span>`,
    },
    {
      header: 'Data Início',
      field: 'dtInicio',
      width: '160px',
      resizable: false,
      formatter: (data: any) => {
        // FIX: usa parseLocalDate para evitar desvio de fuso
        const date = parseLocalDate(data?.dtInicio);
        return `<span class="label">${date ? this.datepipe.transform(date, 'dd/MM/yyyy HH:mm') : ''}</span>`;
      },
    },
    {
      header: 'Data Final',
      field: 'dtFinal',
      width: '160px',
      resizable: false,
      formatter: (data: any) => {
        const date = parseLocalDate(data?.dtFinal);
        return `<span class="label">${date ? this.datepipe.transform(date, 'dd/MM/yyyy HH:mm') : ''}</span>`;
      },
    },
    {
      header: 'Operação',
      field: 'operacao',
      pinned: 'right',
      minWidth: 115,
      width: '115px',
      right: '0px',
      type: 'button',
      resizable: false,
      buttons: [
        {
          type: 'icon',
          text: 'Editar',
          icon: 'edit',
          color: 'primary',
          tooltip: 'Editar',
          click: (data) => this.openEdit(data),
        },
        {
          type: 'icon',
          text: 'Deletar',
          icon: 'delete',
          color: 'warn',
          tooltip: 'Excluir',
          click: (data) => this.openAddDialogConfirDelecao(data),
        },
      ],
    },
  ];

  query = {
    sort:     'dtFinal',  // FIX: deve casar com o atributo JPA (lowercase)
    order:    'desc',
    page:     0,
    per_page: 10,
  };

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit() {
    this.filterForm = this.fb.group({
      descricao: [''],
      dtInicio:  [null],
      dtFinal:   [null],
    });
    this.search();
  }

  // ── Busca com filtros ─────────────────────────────────────────────────────

  search() {
    this.isLoading = true;

    const { descricao, dtInicio, dtFinal } = this.filterForm.value;

    const dtInicioStr = dtInicio instanceof Date
      ? this.informativoService.toLocalISOString(dtInicio)
      : dtInicio ?? undefined;

    const dtFinalStr = dtFinal instanceof Date
      ? this.informativoService.toLocalISOString(dtFinal)
      : dtFinal ?? undefined;

    this.informativoService
      .carregarInformativos(
        this.query.page,
        this.query.per_page,
        this.query.sort,
        this.query.order,
        descricao || undefined,
        dtInicioStr,
        dtFinalStr,
      )
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe(dados => {
        this.list  = dados.content;
        this.total = dados.totalElements;
      });
  }

  limparFiltros() {
    this.filterForm.reset();
    this.query.page = 0;
    this.search();
  }

  aplicarFiltros() {
    this.query.page = 0;
    this.search();
  }

  // ── Eventos da grid ───────────────────────────────────────────────────────

  changeSelect(event: any) {
    this.informativoSelecionado = event[0];
  }

  changeSelectPage(e: PageEvent) {
    this.query.page     = e.pageIndex;
    this.query.per_page = e.pageSize;
    this.search();
  }

  // ── Diálogos ──────────────────────────────────────────────────────────────

  openAdd() {
    const dialogRef = this.dialog.open(DialogAddComponent, {
      data: {},
      maxWidth: '70vw',
      width: '80%',
      panelClass: 'full-screen-modal',
      disableClose: true,
    });
    dialogRef.afterClosed().subscribe(result => this.dialogoAddCancelado(result));
  }

  openEdit(informativoEdit: informativoMV) {
    const dialogRef = this.dialog.open(DialogAddComponent, {
      data: informativoEdit,
      maxWidth: '70vw',
      width: '80%',
      panelClass: 'full-screen-modal',
      disableClose: true,
    });
    dialogRef.afterClosed().subscribe(result => this.dialogoAddCancelado(result));
  }

  dialogoAddCancelado(result: any) {
    if (result !== 'cancelado') {
      this.search();
    }
  }

  openAddDialogConfirDelecao(informativoDelete: informativoMV) {
    const dialogRef = this.dialog.open(DialogDelComponent, { data: informativoDelete });
    dialogRef.afterClosed().subscribe(result =>
      this.deletarInformativo(result, informativoDelete)
    );
  }

  deletarInformativo(confir: string, informativoDelete: informativoMV) {
    if (confir === 'SIM') {
      this.informativoService
        .deletarInformativo(informativoDelete)
        .pipe(
          catchError((err, caught) => {
            console.error(err);
            this.toast.error('Erro ao excluir informativo');
            return err;
          })
        )
        .subscribe(() => {
          this.search();
          this.toast.info(`Informativo "${informativoDelete.dsMensagem}" excluído com sucesso`);
        });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DialogAddComponent
// ═══════════════════════════════════════════════════════════════════════════════

@Component({
  selector: 'dialog-add',
  templateUrl: 'dialog-add.html',
  styleUrl:    'dialog-add.scss',
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
    MtxDatetimepickerModule,
    MtxGridModule,
    TranslateModule,
    MtxSelectModule,
    CommonModule,
    MatMenuModule,
    MatListModule,
    MatDividerModule,
  ],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' },
    { provide: MTX_DATETIME_FORMATS, useValue: DATETIME_FORMATS },
  ],
})
export class DialogAddComponent implements AfterViewInit {
  private readonly fb                 = inject(FormBuilder);
  private readonly toast              = inject(HotToastService);
  private readonly informativoService = inject(InformativoMvService);
  private readonly cdr                = inject(ChangeDetectorRef);

  informativo: informativoMV = {} as informativoMV;
  imagemBase64 = '';
  reactiveForm!: FormGroup;

  today:    Date;
  tomorrow: Date;
  min:      Date;
  max:      Date;
  start:    Date;

  filter: (date: Date | null, type: MtxDatetimepickerFilterType) => boolean =
    () => true;

  fileName   = '';
  uploadSub: Subscription = {} as Subscription;

  constructor(
    @Inject(MAT_DIALOG_DATA) public dataDialog: any,
    private dialogRef: MatDialogRef<DialogAddComponent>,
  ) {
    this.today    = new Date();
    this.tomorrow = addDays(this.today, 1);
    this.min      = new Date(this.today.getFullYear() - 5, 0, 1, 0, 0, 0);
    this.max      = new Date(this.today.getFullYear() + 10, 11, 31, 23, 59, 59);
    this.start    = new Date();

    // ── Carregar dados do informativo recebido ─────────────────────────────
    if (dataDialog && JSON.stringify(dataDialog) !== '{}') {
      this.informativo = { ...dataDialog };

      // FIX: converter string ISO sem fuso para Date local (evita +3h)
      if (this.informativo.dtInicio) {
        this.informativo.dtInicio = parseLocalDate(this.informativo.dtInicio as any) as any;
      }
      if (this.informativo.dtFinal) {
        this.informativo.dtFinal = parseLocalDate(this.informativo.dtFinal as any) as any;
      }

      if (this.informativo.link !== undefined) {
        this.fileName = String(this.informativo.link);
      }
    }

    const dtInicio = (this.informativo.dtInicio instanceof Date && isValidDate(this.informativo.dtInicio))
      ? this.informativo.dtInicio
      : this.today;

    const dtFinal = (this.informativo.dtFinal instanceof Date && isValidDate(this.informativo.dtFinal))
      ? this.informativo.dtFinal
      : this.tomorrow;

    this.reactiveForm = this.fb.group(
      {
        dtInicio: [dtInicio, Validators.required],
        dtFinal:  [dtFinal,  Validators.required],
        descricao: [this.informativo.dsMensagem || '', Validators.required],
      },
      { validators: dateRangeValidator() }
    );
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngAfterViewInit() {
    if (this.informativo.imagem) {
      this.imagemBase64 = this.informativo.imagem;
      this.cdr.detectChanges();
    }
    if (this.informativo.link !== undefined) {
      this.fileName = String(this.informativo.link);
    }
  }

  // ── Upload de imagem ──────────────────────────────────────────────────────

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (!file) return;

    if (!file.type.match('image.*')) {
      this.toast.error('Por favor, selecione um arquivo de imagem');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.toast.error('A imagem deve ter no máximo 5 MB');
      return;
    }

    this.fileName = file.name;
    const reader  = new FileReader();
    reader.readAsDataURL(file);
    reader.onload  = () => {
      this.imagemBase64 = reader.result as string;
      this.cdr.detectChanges();
    };
    reader.onerror = () => this.toast.error('Erro ao carregar a imagem');
  }

  removeImage() {
    this.imagemBase64 = '';
    this.fileName     = '';
    this.cdr.detectChanges();
  }

  onImageError() {
    this.toast.error('Erro ao carregar a imagem. Selecione outra.');
    this.removeImage();
  }

  // ── Evento de mudança de data ─────────────────────────────────────────────

  dataChange(_event: any) {
    this.syncDates();
  }

  private syncDates() {
    const ini = this.getFc['dtInicio'].value;
    const fim = this.getFc['dtFinal'].value;

    this.informativo.dtInicio = ini instanceof Date ? ini : (ini ? new Date(ini) : undefined);
    this.informativo.dtFinal  = fim instanceof Date ? fim : (fim ? new Date(fim) : undefined);
    this.informativo.dsMensagem = this.getFc['descricao'].value;
    this.informativo.imagem     = this.imagemBase64;
  }

  // ── Salvar / Atualizar ────────────────────────────────────────────────────

  salvar() {
    if (this.reactiveForm.invalid) {
      this.toast.warning('Preencha todos os campos obrigatórios');
      return;
    }
    if (!this.imagemBase64) {
      this.toast.warning('Selecione uma imagem para o informativo');
      return;
    }
    if (this.reactiveForm.errors?.['dateRange']) {
      this.toast.warning('Data final deve ser maior que data inicial');
      return;
    }

    this.syncDates();

    if (!isValidDate(this.informativo.dtInicio as any) ||
        !isValidDate(this.informativo.dtFinal as any)) {
      this.toast.warning('Datas inválidas');
      return;
    }

    // FIX: escolhe POST (novo) ou PUT (edição) conforme codMensagem
    const operacao$ = this.informativo.codMensagem
      ? this.informativoService.atualizarInformativo(this.informativo)
      : this.informativoService.salvarInformativo(this.informativo);

    operacao$
      .pipe(
        catchError((err, caught) => {
          console.error(err);
          this.toast.error('Erro ao salvar informativo');
          return err;
        })
      )
      .subscribe(() => {
        const msg = this.informativo.codMensagem
          ? 'Informativo atualizado com sucesso'
          : 'Informativo salvo com sucesso';
        this.toast.success(msg);
        this.dialogRef.close('salvo');
      });
  }

  get getFc() {
    return this.reactiveForm.controls;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DialogDelComponent
// ═══════════════════════════════════════════════════════════════════════════════

@Component({
  selector: 'dialog-delete',
  templateUrl: 'dialog-delete.html',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
  ],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' },
    { provide: MTX_DATETIME_FORMATS, useValue: DATETIME_FORMATS },
  ],
})
export class DialogDelComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public dataDialog: any,
    private dialogRef: MatDialogRef<DialogDelComponent>,
  ) {}

  closeDialog() {
    this.dialogRef.close();
  }
}
