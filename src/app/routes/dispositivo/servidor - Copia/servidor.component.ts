import { Clipboard, ClipboardModule } from '@angular/cdk/clipboard';
import { CommonModule } from '@angular/common';
import { Component, Inject, inject, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatOptionModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MtxGridColumn, MtxGridModule } from '@ng-matero/extensions/grid';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MtxSelectModule } from '@ng-matero/extensions/select';
import { TranslateModule } from '@ngx-translate/core';
import { BreadcrumbComponent, PageHeaderComponent } from '@shared';
import { ServidorService } from './servidor.service';
import { ToastrService } from 'ngx-toastr';
import { grupoServidor, Servidor, ServidorParamentroProcesso, ServidorProcesso } from '@core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormlyFieldConfig, FormlyModule } from '@ngx-formly/core';
import { catchError, finalize } from 'rxjs';

@Component({
  selector: 'app-servidor',
  standalone: true,
  imports: [ FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MtxGridModule,
    MatInputModule,
    MatOptionModule,
    MatSelectModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDatepickerModule,
    MatIconModule,
    MatInputModule,
    MatOptionModule,
    TranslateModule,
    MatRadioModule,
    MtxSelectModule,
    MatSlideToggleModule,
    CommonModule,
    ClipboardModule,
    MatMenuModule,
    MatDialogModule,
    FormsModule,
    MatListModule,
    MatDividerModule,
    MatTooltipModule],
  templateUrl: './servidor.component.html',
  styleUrl: './servidor.component.scss'
})
export class ServidorComponent implements OnInit {
  private readonly toast = inject(ToastrService);
  private readonly clipboard = inject(Clipboard);
  private readonly servidorService = inject(ServidorService);

  dialogServer = inject(MatDialog);

  list: any[] = [];
  listProcesso: any[] = [];
  listParamentro: any[] = [];
  listGrupo: any[] = [];
  grupoSelecionado:grupoServidor = {};
  servidorSelecionado:Servidor = {};
  processoSelecionado:ServidorProcesso = {};
  paramentroSelecionado:ServidorParamentroProcesso = {};

  noResult='Nenhum registro encontrado';
  @ViewChild('statusTpl', { static: true }) statusTpl!: TemplateRef<any>;
  @ViewChild('statusProcessoTpl', { static: true }) statusProcessoTpl!: TemplateRef<any>;
  @ViewChild('statusMonitoramentoTpl', { static: true }) statusMonitoramentoTpl!: TemplateRef<any>;

  columnsServidor: MtxGridColumn[] = [
    { header: 'Descrição', field: 'dsServidor', width: '100%', resizable: false, formatter: (data: any) => `<span class="label box">${data?.dsServidor?data?.dsServidor:''}</span>`},
    { header: 'IP', field: 'dsIP', width: '100px', resizable: true, formatter: (data: any) => `<span class="label">${data?.dsIP?data?.dsIP:''}</span>`},
    { header: 'Usuario', field: 'dsUserAdmin', width: '100px', resizable: true, formatter: (data: any) => `<span class="label">${data?.dsUserAdmin?data?.dsUserAdmin:''}</span>`},
    { header: 'Senha', field: 'dsSenhaAdmin', width: '100px', resizable: true, formatter: (data: any) => `<span class="label">${data?.dsSenhaAdmin?data?.dsSenhaAdmin:''}</span>`},
    { header: 'Maquina', field: 'dsMaquina', width: '150px', resizable: true, formatter: (data: any) => `<span class="label">${data?.dsMaquina?data?.dsMaquina:''}</span>`},
    { header: 'Acesso', field: 'tpAcessoRemoto', width: '50px', resizable: true, formatter: (data: any) => `<span class="label">${data?.tpAcessoRemoto?data?.tpAcessoRemoto:''}</span>`},
    { header: 'SO', field: 'tpSo', width: '50px', resizable: true, formatter: (data: any) => `<span class="label">${data?.tpSo?data?.tpSo:''}</span>`},
    { header: 'Status', field: 'snAtivo',  width: '10px', cellTemplate: this.statusTpl },
    { header: 'Monitorado', field: 'snMonitorado',  width: '10px', cellTemplate: this.statusMonitoramentoTpl },
  ];

  columnsProcesso: MtxGridColumn[] = [
    { header: 'Descrição', field: 'dsProcesso', width: '100%', resizable: false, formatter: (data: any) => `<span class="label box">${data?.dsProcesso?data?.dsProcesso:''}</span>`},
    { header: 'Nome', field: 'nmProcesso', width: '80px', resizable: true, formatter: (data: any) => `<span class="label">${data?.nmProcesso?data?.nmProcesso:''}</span>`},
    { header: 'Caminho', field: 'caminhoProcesso', width: '400px', resizable: true, formatter: (data: any) => `<span class="label">${data?.caminhoProcesso?data?.caminhoProcesso:''}</span>`},
    { header: 'Detahe', field: 'dsProcessoDetalhe', width: '300px', resizable: true, formatter: (data: any) => `<span class="label">${data?.dsProcessoDetalhe?data?.dsProcessoDetalhe:''}</span>`},
    { header: 'Status', field: 'dsStatus',width: '5px', cellTemplate: this.statusProcessoTpl },
    { header: 'Monitorado', field: 'snMonitorado', width: '5px', cellTemplate: this.statusMonitoramentoTpl },
  ];

  columnsParamentro: MtxGridColumn[] = [
    { header: 'Descrição', field: 'dsParametro', width: '100%', resizable: false, formatter: (data: any) => `<span class="label box">${data?.dsParametro?data?.dsParametro:''}</span>`},
    { header: 'Valor', field: 'dsValor', width: '100px', resizable: true, formatter: (data: any) => `<span class="label">${data?.dsValor?data?.dsValor:''}</span>`},
    { header: 'Monitorado', width: '30px', field: 'snMonitorado', cellTemplate: this.statusMonitoramentoTpl },
  ];

  ngOnInit() {
    this.search();
    this.buscarGrupos();
  }


  filterBy(nameInput: HTMLInputElement) {
    if (nameInput.value) {
      this.list = this.list.filter(p => p.nome.toLowerCase().includes(nameInput.value.toLowerCase()));
    }else{
      this.search();
    }
  }

  buscarGrupos() {
    this.servidorService.carregarGrupos().subscribe(dadosGrupo =>{
        this.listGrupo = dadosGrupo;
    });
  }

  search() {
    this.servidorService.carregarServidor().subscribe(dadosServidor =>{
      this.listParamentro = [];
      this.listProcesso = [];
        this.list = dadosServidor;
    });
  }

  searchFiltro(pesquisaInput: HTMLInputElement) {
    if (pesquisaInput.value == "" && this.grupoSelecionado.codGrupoServidor == undefined){
      this.search();
      return;
    }

    this.servidorService.carregarServidorfiltro(pesquisaInput.value, this.grupoSelecionado).subscribe(dadosServidor =>{
      this.listParamentro = [];
      this.listProcesso = [];
        this.list = dadosServidor;
    });

  }

  openAddDialogAdicionar() {
    console.log('modal');
    const dialogRef = this.dialogServer.open(DialogAddComponent,{
     // data: this.dados,
      maxWidth: '70vw',
      maxHeight: '70vh',
      height: '70%',
      width: '70%',
      panelClass: 'full-screen-modal',
      disableClose: true
    });
    dialogRef.afterClosed().subscribe(result => (this.dialogAdicionarCancelado(result)));
  }
  dialogAdicionarCancelado(result:any){
    if(result != 'cancelado'){
      this.search();
    }
  }

  searchProcessos(serv:Servidor) {
    this.servidorService.carregarServidorProcesso(serv).subscribe(dadosProcesso =>{
        this.listProcesso = dadosProcesso;
    });
  }

  searchParamentros(proc:ServidorProcesso) {
    this.servidorService.carregarProcessoParamentro(proc).subscribe(dadosParamentro =>{
        this.listParamentro = dadosParamentro;
    });
  }

  changeSelectServidor(event:any){
    this.servidorSelecionado = event[0];
    this.searchProcessos(this.servidorSelecionado);
  }
  changeSelectServidorCell(event:any){
    console.log(event);
  }

  changeGrupo(event:any){
    if(event==undefined){
      this.grupoSelecionado = {};
    }else{
      this.grupoSelecionado = event;
      console.log(this.grupoSelecionado);
    }
  }

  changeSelectProcesso(event:any){
    this.processoSelecionado = event[0];
    this.searchParamentros(this.processoSelecionado);
  }

  changeSelectParamentro(event:any){
    this.paramentroSelecionado = event[0];    ;
  }
}


// Dialog
@Component({
  selector: 'dialog-add',
  templateUrl: 'dialog-add.html',
  standalone: true,
  imports: [FormsModule,
      ReactiveFormsModule,
      MatButtonModule,
      MatCardModule,
      FormlyModule,
      PageHeaderComponent,
            ],
})

export class DialogAddComponent {
  constructor( @Inject(MAT_DIALOG_DATA) public dataDialog: any,
  private dialogRef: MatDialogRef<DialogAddComponent> ) {
}

  private readonly toast = inject(ToastrService);

   form = new FormGroup({});
   model = { email: 'email@gmail.com' };
   fields: FormlyFieldConfig[] = [
     {
       key: 'text',
       type: 'input',
       templateOptions: {
         label: 'Text',
         placeholder: 'Type here to see the other field become enabled...',
         required: true,
       },
     },
     {
       key: 'text2',
       type: 'input',
       templateOptions: {
         label: 'Hey!',
         placeholder: 'This one is disabled if there is no text in the other input',
       },
       expressionProperties: {
         'templateOptions.disabled': '!model.text',
       },
     },
     {
       key: 'email',
       type: 'input',
       templateOptions: {
         label: 'Email address',
         placeholder: 'Enter email',
         required: true,
       },
     },
   ];

   // Advanced Layout
   form2 = new FormGroup({});
   model2 = {};
   fields2: FormlyFieldConfig[] = [
     {
       fieldGroupClassName: 'row',
       fieldGroup: [
         {
           className: 'col-sm-6',
           type: 'input',
           key: 'firstName',
           templateOptions: {
             label: 'First Name',
             required: true,
           },
         },
         {
           className: 'col-sm-6',
           type: 'input',
           key: 'lastName',
           templateOptions: {
             label: 'Last Name',
             required: true,
           },
           expressionProperties: {
             'templateOptions.disabled': '!model.firstName',
           },
         },
       ],
     },
     {
       fieldGroupClassName: 'row',
       fieldGroup: [
         {
           className: 'col-sm-6',
           type: 'input',
           key: 'street',
           templateOptions: {
             label: 'Street',
           },
         },
         {
           className: 'col-sm-3',
           type: 'combobox',
           key: 'cityId',
           templateOptions: {
             label: 'City',
             options: [
               { id: 1, name: '北京' },
               { id: 2, name: '上海' },
               { id: 3, name: '广州' },
               { id: 4, name: '深圳' },
             ],
             labelProp: 'name',
             valueProp: 'id',
             required: true,
             description: 'This is a custom field type.',
           },
         },
         {
           className: 'col-sm-3',
           type: 'input',
           key: 'zip',
           templateOptions: {
             type: 'number',
             label: 'Zip',
             max: 99999,
             min: 0,
             pattern: '\\d{5}',
           },
         },
       ],
     },
     {
       type: 'textarea',
       key: 'otherInput',
       templateOptions: {
         label: 'Other Input',
       },
     },
     {
       type: 'checkbox',
       key: 'otherToo',
       templateOptions: {
         label: 'Other Checkbox',
       },
       wrappers: ['div'],
     },
   ];

   submit() {
     if (this.form.valid) {
       this.showToast(this.model);
     }
   }

   submit2() {
     if (this.form2.valid) {
       this.showToast(this.model2);
     }
   }

   showToast(obj: any) {
     this.toast.success(JSON.stringify(obj));
   }
 }
