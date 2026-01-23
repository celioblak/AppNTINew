import { Component, Inject, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { DateAdapter, MAT_DATE_LOCALE, MatOptionModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { informativoMV } from '@core';
import { MtxDatetimepickerFilterType, MtxDatetimepickerModule } from '@ng-matero/extensions/datetimepicker';
import { MtxGridColumn, MtxGridModule } from '@ng-matero/extensions/grid';
import { FormlyModule } from '@ngx-formly/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import * as _moment from 'moment';
import { default as _rollupMoment } from 'moment';
import { ToastrService } from 'ngx-toastr';
import { catchError, finalize, Subscription } from 'rxjs';
import { InformativoMvService } from './informativo-mv.service';
import {CommonModule, DatePipe} from '@angular/common';
import { MtxSelectModule } from '@ng-matero/extensions/select';
import { MatMenuModule } from '@angular/material/menu';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { PageEvent } from '@angular/material/paginator';

const moment = _rollupMoment || _moment;

@Component({
  selector: 'app-informativo-mv',
  standalone: true,
  imports: [ MtxGridModule,
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
  styleUrl: './informativo-mv.component.scss',
  providers: [DatePipe]
})
export class InformativoMvComponent implements OnInit {

  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastrService);
  private readonly informativoService = inject(InformativoMvService);
  dialog = inject(MatDialog);

  isLoading= false;
  list: any[] = [];
  total = 0;
  noResult='Nenhum registro encontrado';

  informativoSelecionado: informativoMV = {} as informativoMV;

  constructor(public datepipe: DatePipe) {}

  columns: MtxGridColumn[] = [
      { header: 'Cod.', field: 'codMensagem', width: '50px', resizable: false, formatter: (data: any) => `<span class="label">${data?.codMensagem?data?.codMensagem:''}</span>`},
      { header: 'Descrição', field: 'dsMensagem', width: '100%', resizable: false, formatter: (data: any) => `<span class="label">${data?.dsMensagem?data?.dsMensagem:''}</span>`},
      { header: 'Data Inicio', field: 'dtInicio', width: '150px', resizable: false, formatter: (data: any) => `<span class="label">${data?.dtInicio?this.datepipe.transform(data?.dtInicio, 'dd/MM/yyyy HH:mm'):''}</span>`},
      { header: 'Data Final', field: 'dtFinal', width: '150px', resizable: false, formatter: (data: any) => `<span class="label">${data?.dtFinal?this.datepipe.transform(data?.dtFinal, 'dd/MM/yyyy HH:mm'):''}</span>`},
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
            tooltip: 'Deletar',
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
      sort: 'DtFinal',
      order: 'desc',
      page: 0,
      per_page: 10,
    };

    ngOnInit() {
      this.search();
    }

    search() {

      this.isLoading = true;
      this.informativoService.carregarInformativos(this.query.page,this.query.per_page, this.query.sort,this.query.order).pipe(
        finalize(() => {
          this.isLoading = false;
        })
      ).subscribe(dados =>{
          this.list = dados.content;
          this.total = dados.totalElements;
      });
    }

    changeSelect(event:any){
      this.informativoSelecionado = event[0];
    }
    changeSelectPage(e: PageEvent){
      this.query.page = e.pageIndex;
      this.query.per_page = e.pageSize;
      this.search();
    }
    openAdd(){
        const dialogRef = this.dialog.open(DialogAddComponent,{
            data: {},
            maxWidth: '70vw',
            width: '80%',
          /*  maxWidth: '70vw',
            maxHeight: '70vh',
            height: '70%',
            width: '70%',*/
            panelClass: 'full-screen-modal',
            disableClose: true
          });
           dialogRef.afterClosed().subscribe(result => (this.dialogoAddCancelado(result)));
    }

    dialogoAddCancelado(result:any){
      if(result != 'cancelado'){
        this.search();
      }
    }

    openEdit(informativoEdit:informativoMV){
      const dialogRef = this.dialog.open(DialogAddComponent,{
          data: informativoEdit,
          maxWidth: '70vw',
          width: '80%',
        /*  maxWidth: '70vw',
          maxHeight: '70vh',
          height: '70%',
          width: '70%',*/
          panelClass: 'full-screen-modal',
          disableClose: true
        });
         dialogRef.afterClosed().subscribe(result => (this.dialogoAddCancelado(result)));
  }

    openAddDialogConfirDelecao(informativoDelete:informativoMV) {
      const dialogRef = this.dialog.open(DialogDelComponent,{data: informativoDelete});
      dialogRef.afterClosed().subscribe(result => (this.deletarInformativo(result,informativoDelete)));
    }

    deletarInformativo(confir:string,informativoDelete:informativoMV) {
      if(confir == 'SIM'){
        this.informativoService
        .deletarInformativo(informativoDelete)
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
          this.toast.info('Informativo '+informativoDelete.dsMensagem+' deletado com sucesso','Sucesso');
        });
      }
    }

}

// Dialog
@Component({
  selector: 'dialog-add',
  templateUrl: 'dialog-add.html',
  styleUrl: 'dialog-add.scss',
  standalone: true,
  imports: [ReactiveFormsModule,
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
})

export class DialogAddComponent {

   private readonly fb = inject(FormBuilder);
   private readonly translate = inject(TranslateService);
   private readonly toast = inject(ToastrService);
   private readonly informativoService = inject(InformativoMvService);

    informativo:informativoMV = {} as informativoMV;
    imagemBase64:string = '';
    reactiveForm: FormGroup;
    type = 'moment';
    today: moment.Moment;
    tomorrow: moment.Moment;
    min: moment.Moment;
    max: moment.Moment;
    start: moment.Moment;
    filter: (date: moment.Moment | null, type: MtxDatetimepickerFilterType) => boolean;
    fileName = '';
    uploadProgress:number = 0;
    uploadSub: Subscription = {} as Subscription;

    constructor(@Inject(MAT_DIALOG_DATA) public dataDialog: any,
    private dialogRef: MatDialogRef<DialogAddComponent> ) {

    if ((JSON.stringify(dataDialog) !== '{}') || !(dataDialog === null) ){
      this.informativo  = dataDialog;
      if(this.informativo.link != undefined){
        this.fileName = this.informativo.link+'';
      }
    }

     //this.today = moment.utc();
        this.today = moment.utc();
        //this.dataInicio = moment.utc().date(moment.utc().date() + 1);
        //this.dataFinal = moment.utc();
       // this.date = moment.utc().format('YYYY-MM-DD HH:mm:ss');
        this.tomorrow = moment.utc().date(moment.utc().date() + 1);
        this.min = this.today.clone().year(2018).month(10).date(3).hour(11).minute(10);
        this.max = this.min.clone().date(4).minute(45);
        this.start = this.today.clone().year(1930).month(9).date(28);

        this.filter = (date: moment.Moment | null, type: MtxDatetimepickerFilterType) => {
          if (date === null) {
            return true;
          }
          switch (type) {
            case MtxDatetimepickerFilterType.DATE:
              return date.year() % 2 === 0 && date.month() % 2 === 0 && date.date() % 2 === 0;
            case MtxDatetimepickerFilterType.HOUR:
              return date.hour() % 2 === 0;
            case MtxDatetimepickerFilterType.MINUTE:
              return date.minute() % 2 === 0;
          }
        };

        this.reactiveForm = this.fb.group({
          dtInicio: [this.informativo.dtInicio, Validators.required],
          dtFinal: [this.informativo.dtFinal, Validators.required],
          descricao: [this.informativo.dsMensagem, Validators.required]
        });
      }

      onFileSelected(event:any){
        const _this = this;
        const file:File = event.target.files[0];
        const leitorDeArquivos = new FileReader();
        leitorDeArquivos.readAsDataURL(file);

        if (file) {
            this.fileName = file.name;
            leitorDeArquivos.addEventListener('load', function(load:any){
              _this.addImagem64(load.target.result);
          });
        }
      }

      addImagem64(imagem?:string){
        this.imagemBase64 = imagem+'';
        const previaDaImagem:any = document.querySelector('.imagem');

        if (this.imagemBase64 == undefined || this.imagemBase64 == "undefined" || this.imagemBase64 == null){
          previaDaImagem.src = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs%3D";
        }else{
          previaDaImagem.src = this.imagemBase64;
        }
      }

      ngAfterViewInit(){
        this.addImagem64(this.informativo.imagem);
        if(this.informativo.link != undefined){
          this.fileName = this.informativo.link+'';
        }
      }

      dataChange(event:any){
        this.updateData();
      }

      updateData(){
        this.informativo.dtInicio   = this.getFc['dtInicio'].value;
        this.informativo.dtFinal    = this.getFc['dtFinal'].value;
        this.informativo.dsMensagem = this.getFc['descricao'].value;
        this.informativo.imagem     = this.imagemBase64;

        this.reactiveForm = this.fb.group({
           dtInicio: [this.informativo.dtInicio, Validators.required],
            dtFinal: [this.informativo.dtFinal, Validators.required],
          descricao: [this.informativo.dsMensagem, Validators.required],
        });

        if (this.informativo.imagem == null || this.informativo.imagem == '' || this.informativo.imagem == undefined){
          return false;
        }else{
          return this.reactiveForm.valid;
        }
      }

      closeDialog(){
        this.dialogRef.close('salvo');
      }

      salvar(){
        if (this.updateData()){
          if (this.informativo.imagem == undefined || this.informativo.imagem == "undefined"  || this.informativo.imagem == null || this.informativo.imagem == '' ){
            this.toast.warning('Imagem do informativo deve ser carregada','Campo Obrigatorio');
            return;
          }else{
            this.informativoService
            .salvarInformativo(this.informativo)
            .pipe(
              finalize(() => {
              }),
              catchError((err, caught) => {
                console.log('err ' + err)
                return err;
              })
            )
            .subscribe(res => {
              this.toast.info('Informativo salvo com sucesso','Sucesso');
              this.closeDialog();
            });
          }
        }else{
          this.toast.warning('Campos Obrigatorios não informado','Campo Obrigatorio');
          return;
        }
      }

      get getFc() {
        return this.reactiveForm.controls;
      }
}

// Dialog
@Component({
  selector: 'dialog-delete',
  templateUrl: 'dialog-delete.html',
  standalone: true,
  imports: [ReactiveFormsModule,
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
  constructor( @Inject(MAT_DIALOG_DATA) public dataDialog: any,
  private dialogRef: MatDialogRef<DialogDelComponent> ) {
}
  closeDialog(){
    this.dialogRef.close();

 }
}


