import { ClipboardModule } from '@angular/cdk/clipboard';
import { CommonModule } from '@angular/common';
import { Component, HostListener, Inject, inject, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatOptionModule } from '@angular/material/core';
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
import { ServidorService } from './servidor.service';
import { ToastrService } from 'ngx-toastr';
import { grupoServidor, Servidor, ServidorParamentroProcesso, ServidorProcesso } from '@core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormlyFieldConfig, FormlyModule } from '@ngx-formly/core';
import { ConfirmDialogComponent } from './confirm-dialog.component';

@Component({
  selector: 'app-servidor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatDialogModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatMenuModule,
    MatOptionModule,
    MatRadioModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MtxGridModule,
    MtxSelectModule,
    ClipboardModule,
    FormlyModule
  ],
  templateUrl: './servidor.component.html',
  styleUrl: './servidor.component.scss'
})
export class ServidorComponent implements OnInit {
  private readonly toast = inject(ToastrService);
  private readonly servidorService = inject(ServidorService);
  private readonly dialog = inject(MatDialog);

  list: Servidor[] = [];
  listProcesso: ServidorProcesso[] = [];
  listParamentro: ServidorParamentroProcesso[] = [];
  listGrupo: grupoServidor[] = [];
  grupoSelecionado: grupoServidor = {};
  servidorSelecionado: Servidor = {};
  processoSelecionado: ServidorProcesso = {};
  paramentroSelecionado: ServidorParamentroProcesso = {};

  noResult = 'Nenhum registro encontrado';

  // TEMPLATES
  @ViewChild('statusAtivoTpl', { static: true }) statusAtivoTpl!: TemplateRef<any>;
  @ViewChild('statusProcessoTpl', { static: true }) statusProcessoTpl!: TemplateRef<any>;
  @ViewChild('statusMonitoramentoTpl', { static: true }) statusMonitoramentoTpl!: TemplateRef<any>;

  isMobile = window.innerWidth < 768;

  // COLUNAS DESKTOP - otimizadas para menor altura
  columnsServidorDesktop: MtxGridColumn[] = [
    {
      header: 'Descrição',
      field: 'dsServidor',
      width: '100%',
      resizable: false,
      formatter: (data: any) =>
        `<span class="label box" title="${data?.dsServidor || ''}">${data?.dsServidor || ''}</span>`
    },
    {
      header: 'IP',
      field: 'dsIP',
      width: '100px',
      resizable: true,
      formatter: (data: any) =>
        `<span class="label" title="${data?.dsIP || ''}">${data?.dsIP || ''}</span>`
    },
    {
      header: 'Usuário',
      field: 'dsUserAdmin',
      width: '90px',
      resizable: true,
      formatter: (data: any) =>
        `<span class="label" title="${data?.dsUserAdmin || ''}">${data?.dsUserAdmin || ''}</span>`
    },
    {
      header: 'Senha',
      field: 'dsSenhaAdmin',
      width: '90px',
      resizable: true,
      formatter: (data: any) =>
        `<span class="label" title="${data?.dsSenhaAdmin || ''}">${data?.dsSenhaAdmin || ''}</span>`
    },
    {
      header: 'Máquina',
      field: 'dsMaquina',
      width: '130px',
      resizable: true,
      formatter: (data: any) =>
        `<span class="label" title="${data?.dsMaquina || ''}">${data?.dsMaquina || ''}</span>`
    },
    {
      header: 'Acesso',
      field: 'tpAcessoRemoto',
      width: '60px',
      resizable: true,
      formatter: (data: any) =>
        `<span class="label" title="${data?.tpAcessoRemoto || ''}">${data?.tpAcessoRemoto || ''}</span>`
    },
    {
      header: 'SO',
      field: 'tpSo',
      width: '60px',
      resizable: true,
      formatter: (data: any) =>
        `<span class="label" title="${data?.tpSo || ''}">${data?.tpSo || ''}</span>`
    },
    {
      header: 'Status',
      field: 'snAtivo',
      width: '55px',
      cellTemplate: this.statusAtivoTpl
    },
    {
      header: 'Monit.',
      field: 'snMonitorado',
      width: '55px',
      cellTemplate: this.statusMonitoramentoTpl
    },
  ];

  // COLUNAS MOBILE - mais compactas
  columnsServidorMobile: MtxGridColumn[] = [
    {
      header: 'Descrição',
      field: 'dsServidor',
      width: '180px',
      resizable: true,
      formatter: (data: any) =>
        `<span class="label box" title="${data?.dsServidor || ''}">${data?.dsServidor || ''}</span>`
    },
    {
      header: 'IP',
      field: 'dsIP',
      width: '100px',
      resizable: true,
      formatter: (data: any) =>
        `<span class="label" title="${data?.dsIP || ''}">${data?.dsIP || ''}</span>`
    },
    {
      header: 'Status',
      field: 'snAtivo',
      width: '50px',
      cellTemplate: this.statusAtivoTpl
    },
    {
      header: 'Monit.',
      field: 'snMonitorado',
      width: '50px',
      cellTemplate: this.statusMonitoramentoTpl
    },
  ];

  columnsProcessoDesktop: MtxGridColumn[] = [
    {
      header: 'Descrição',
      field: 'dsProcesso',
      width: '100%',
      resizable: false,
      formatter: (data: any) =>
        `<span class="label box" title="${data?.dsProcesso || ''}">${data?.dsProcesso || ''}</span>`
    },
    {
      header: 'Nome',
      field: 'nmProcesso',
      width: '110px',
      resizable: true,
      formatter: (data: any) =>
        `<span class="label" title="${data?.nmProcesso || ''}">${data?.nmProcesso || ''}</span>`
    },
    {
      header: 'Caminho',
      field: 'caminhoProcesso',
      width: '280px',
      resizable: true,
      formatter: (data: any) =>
        `<span class="label" title="${data?.caminhoProcesso || ''}">${data?.caminhoProcesso || ''}</span>`
    },
    {
      header: 'Status',
      field: 'dsStatus',
      width: '55px',
      cellTemplate: this.statusProcessoTpl
    },
    {
      header: 'Monit.',
      field: 'snMonitorado',
      width: '55px',
      cellTemplate: this.statusMonitoramentoTpl
    },
  ];

  columnsProcessoMobile: MtxGridColumn[] = [
    {
      header: 'Descrição',
      field: 'dsProcesso',
      width: '180px',
      resizable: true,
      formatter: (data: any) =>
        `<span class="label box" title="${data?.dsProcesso || ''}">${data?.dsProcesso || ''}</span>`
    },
    {
      header: 'Nome',
      field: 'nmProcesso',
      width: '100px',
      resizable: true,
      formatter: (data: any) =>
        `<span class="label" title="${data?.nmProcesso || ''}">${data?.nmProcesso || ''}</span>`
    },
    {
      header: 'Status',
      field: 'dsStatus',
      width: '50px',
      cellTemplate: this.statusProcessoTpl
    },
  ];

  columnsParamentroDesktop: MtxGridColumn[] = [
    {
      header: 'Descrição',
      field: 'dsParametro',
      width: '100%',
      resizable: false,
      formatter: (data: any) =>
        `<span class="label box" title="${data?.dsParametro || ''}">${data?.dsParametro || ''}</span>`
    },
    {
      header: 'Valor',
      field: 'dsValor',
      width: '130px',
      resizable: true,
      formatter: (data: any) =>
        `<span class="label" title="${data?.dsValor || ''}">${data?.dsValor || ''}</span>`
    },
    {
      header: 'Monit.',
      field: 'snMonitorado',
      width: '55px',
      cellTemplate: this.statusMonitoramentoTpl
    },
  ];

  columnsParamentroMobile: MtxGridColumn[] = [
    {
      header: 'Descrição',
      field: 'dsParametro',
      width: '150px',
      resizable: true,
      formatter: (data: any) =>
        `<span class="label box" title="${data?.dsParametro || ''}">${data?.dsParametro || ''}</span>`
    },
    {
      header: 'Valor',
      field: 'dsValor',
      width: '90px',
      resizable: true,
      formatter: (data: any) =>
        `<span class="label" title="${data?.dsValor || ''}">${data?.dsValor || ''}</span>`
    },
    {
      header: 'Monit.',
      field: 'snMonitorado',
      width: '50px',
      cellTemplate: this.statusMonitoramentoTpl
    },
  ];

  @HostListener('window:resize')
  onResize() {
    this.isMobile = window.innerWidth < 768;
  }

  ngOnInit() {
    this.search();
    this.buscarGrupos();
  }

  buscarGrupos() {
    this.servidorService.carregarGrupos().subscribe(dadosGrupo => {
      this.listGrupo = dadosGrupo;
    });
  }

  search() {
    this.servidorService.carregarServidor().subscribe(dadosServidor => {
      this.listParamentro = [];
      this.listProcesso = [];
      this.list = dadosServidor;
      this.resetarSelecoes();
    });
  }

  searchFiltro(pesquisaInput: HTMLInputElement) {
    if (pesquisaInput.value === "" && !this.grupoSelecionado.codGrupoServidor) {
      this.search();
      return;
    }

    this.servidorService.carregarServidorfiltro(pesquisaInput.value, this.grupoSelecionado).subscribe(dadosServidor => {
      this.listParamentro = [];
      this.listProcesso = [];
      this.list = dadosServidor;
      this.resetarSelecoes();
    });
  }

  searchProcessos(serv: Servidor) {
    this.servidorService.carregarServidorProcesso(serv).subscribe(dadosProcesso => {
      this.listProcesso = dadosProcesso;
      this.processoSelecionado = {};
      this.listParamentro = [];
      this.paramentroSelecionado = {};
    });
  }

  searchParamentros(proc: ServidorProcesso) {
    this.servidorService.carregarProcessoParamentro(proc).subscribe(dadosParamentro => {
      this.listParamentro = dadosParamentro;
      this.paramentroSelecionado = {};
    });
  }

  // Método para clique na linha
  onRowClick(event: any, type: 'servidor' | 'processo' | 'parametro') {
    const row = event.rowData;

    if (type === 'servidor') {
      this.servidorSelecionado = row;
      this.searchProcessos(row);
    } else if (type === 'processo') {
      this.processoSelecionado = row;
      this.searchParamentros(row);
    } else if (type === 'parametro') {
      this.paramentroSelecionado = row;
    }
  }

  // Métodos auxiliares
  private resetarSelecoes() {
    this.servidorSelecionado = {};
    this.processoSelecionado = {};
    this.paramentroSelecionado = {};
  }

  changeSelectServidor(event: any) {
    if (event && event.length > 0) {
      this.servidorSelecionado = event[0];
      this.searchProcessos(event[0]);
    }
  }

  changeGrupo(event: any) {
    this.grupoSelecionado = event || {};
  }

  changeSelectProcesso(event: any) {
    if (event && event.length > 0) {
      this.processoSelecionado = event[0];
      this.searchParamentros(event[0]);
    }
  }

  changeSelectParamentro(event: any) {
    if (event && event.length > 0) {
      this.paramentroSelecionado = event[0];
    }
  }

  // Diálogos (mantidos iguais - não alterei abaixo desta linha)
  openAddDialogAdicionar() {
    const dialogRef = this.dialog.open(DialogServidorComponent, {
      data: { modo: 'adicionar', servidor: {}, grupos: this.listGrupo },
      maxWidth: '90vw',
      maxHeight: '90vh',
      height: '90%',
      width: this.isMobile ? '95%' : '90%',
      panelClass: 'full-screen-modal',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result !== 'cancelado') {
        this.search();
        this.toast.success('Servidor adicionado com sucesso!');
      }
    });
  }

  openEditDialog() {
    if (!this.servidorSelecionado.codServidor) {
      this.toast.warning('Selecione um servidor para editar!');
      return;
    }

    const dialogRef = this.dialog.open(DialogServidorComponent, {
      data: {
        modo: 'editar',
        servidor: { ...this.servidorSelecionado },
        grupos: this.listGrupo
      },
      maxWidth: '90vw',
      maxHeight: '90vh',
      height: '90%',
      width: this.isMobile ? '95%' : '90%',
      panelClass: 'full-screen-modal',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result !== 'cancelado') {
        this.search();
        this.toast.success('Servidor atualizado com sucesso!');
      }
    });
  }

  openDeleteDialog() {
    if (!this.servidorSelecionado.codServidor) {
      this.toast.warning('Selecione um servidor para excluir!');
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Confirmar Exclusão',
        message: `Tem certeza que deseja excluir o servidor "${this.servidorSelecionado.dsServidor}"?`,
        confirmButtonText: 'Excluir'
      },
      width: this.isMobile ? '90%' : '400px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.servidorService.deletarServidor(this.servidorSelecionado).subscribe({
          next: () => {
            this.toast.success('Servidor excluído com sucesso!');
            this.search();
          },
          error: (error) => {
            this.toast.error('Erro ao excluir servidor!');
            console.error(error);
          }
        });
      }
    });
  }

  openAddProcessoDialog() {
    if (!this.servidorSelecionado.codServidor) {
      this.toast.warning('Selecione um servidor primeiro!');
      return;
    }

    const dialogRef = this.dialog.open(DialogProcessoComponent, {
      data: { modo: 'adicionar', processo: {}, servidor: this.servidorSelecionado },
      maxWidth: '90vw',
      maxHeight: '90vh',
      height: '90%',
      width: this.isMobile ? '95%' : '90%',
      panelClass: 'full-screen-modal',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result !== 'cancelado') {
        this.searchProcessos(this.servidorSelecionado);
        this.toast.success('Processo adicionado com sucesso!');
      }
    });
  }

  openEditProcessoDialog() {
    if (!this.processoSelecionado.codProcesso) {
      this.toast.warning('Selecione um processo para editar!');
      return;
    }

    const dialogRef = this.dialog.open(DialogProcessoComponent, {
      data: { modo: 'editar', processo: { ...this.processoSelecionado } },
      maxWidth: '90vw',
      maxHeight: '90vh',
      height: '90%',
      width: this.isMobile ? '95%' : '90%',
      panelClass: 'full-screen-modal',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result !== 'cancelado') {
        this.searchProcessos(this.servidorSelecionado);
        this.toast.success('Processo atualizado com sucesso!');
      }
    });
  }

  openDeleteProcessoDialog() {
    if (!this.processoSelecionado.codProcesso) {
      this.toast.warning('Selecione um processo para excluir!');
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Confirmar Exclusão',
        message: `Tem certeza que deseja excluir o processo "${this.processoSelecionado.dsProcesso}"?`,
        confirmButtonText: 'Excluir'
      },
      width: this.isMobile ? '90%' : '400px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.servidorService.deletarProcesso(this.processoSelecionado.codProcesso!).subscribe({
          next: () => {
            this.toast.success('Processo excluído com sucesso!');
            this.searchProcessos(this.servidorSelecionado);
          },
          error: (error) => {
            this.toast.error('Erro ao excluir processo!');
            console.error(error);
          }
        });
      }
    });
  }

  openAddParametroDialog() {
    if (!this.processoSelecionado.codProcesso) {
      this.toast.warning('Selecione um processo primeiro!');
      return;
    }

    const dialogRef = this.dialog.open(DialogParametroComponent, {
      data: { modo: 'adicionar', parametro: {}, processo: this.processoSelecionado },
      maxWidth: '90vw',
      maxHeight: '90vh',
      height: '90%',
      width: this.isMobile ? '95%' : '90%',
      panelClass: 'full-screen-modal',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result !== 'cancelado') {
        this.searchParamentros(this.processoSelecionado);
        this.toast.success('Parâmetro adicionado com sucesso!');
      }
    });
  }

  openEditParametroDialog() {
    if (!this.paramentroSelecionado.codParametro) {
      this.toast.warning('Selecione um parâmetro para editar!');
      return;
    }

    const dialogRef = this.dialog.open(DialogParametroComponent, {
      data: { modo: 'editar', parametro: { ...this.paramentroSelecionado } },
      maxWidth: '90vw',
      maxHeight: '90vh',
      height: '90%',
      width: this.isMobile ? '95%' : '90%',
      panelClass: 'full-screen-modal',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result !== 'cancelado') {
        this.searchParamentros(this.processoSelecionado);
        this.toast.success('Parâmetro atualizado com sucesso!');
      }
    });
  }

  openDeleteParametroDialog() {
    if (!this.paramentroSelecionado.codParametro) {
      this.toast.warning('Selecione um parâmetro para excluir!');
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Confirmar Exclusão',
        message: `Tem certeza que deseja excluir o parâmetro "${this.paramentroSelecionado.dsParametro}"?`,
        confirmButtonText: 'Excluir'
      },
      width: this.isMobile ? '90%' : '400px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.servidorService.deletarParametro(this.paramentroSelecionado.codParametro!).subscribe({
          next: () => {
            this.toast.success('Parâmetro excluído com sucesso!');
            this.searchParamentros(this.processoSelecionado);
          },
          error: (error) => {
            this.toast.error('Erro ao excluir parâmetro!');
            console.error(error);
          }
        });
      }
    });
  }
}

// Componentes de Diálogo (mantidos iguais - NÃO ALTEREI ABAIXO)
@Component({
  selector: 'dialog-servidor',
  templateUrl: 'dialog-servidor.html',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatOptionModule,
    MatSlideToggleModule,
    FormlyModule,
    CommonModule,
    MatIconModule,
    MatDividerModule
  ],
})
export class DialogServidorComponent {
  private readonly servidorService = inject(ServidorService);
  private readonly toast = inject(ToastrService);

  form = new FormGroup({});
  model: any = {};
  fields: FormlyFieldConfig[] = [];
  grupos: any[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<DialogServidorComponent>,
    private fb: FormBuilder
  ) {
    this.grupos = data.grupos || [];
    this.initializeForm();
  }

  private initializeForm() {
    const servidor = this.data.servidor || {};

    this.model = {
      codServidor: servidor.codServidor || null,
      dsServidor: servidor.dsServidor || '',
      dsIP: servidor.dsIP || '',
      dsUserAdmin: servidor.dsUserAdmin || '',
      dsSenhaAdmin: servidor.dsSenhaAdmin || '',
      dsMaquina: servidor.dsMaquina || '',
      obsServidor: servidor.obsServidor || '',
      tpAcessoRemoto: servidor.tpAcessoRemoto || 'RDP',
      tpSo: servidor.tpSo || 'WINDOWS',
      snAtivo: servidor.snAtivo !== undefined ? servidor.snAtivo : true,
      snMonitorado: servidor.snMonitorado !== undefined ? servidor.snMonitorado : true,
      usuarioAcessoRemoto: servidor.usuarioAcessoRemoto || '',
      senhaAcessoRemoto: servidor.senhaAcessoRemoto || '',
      codGrupoServidor: servidor.grupoServidor?.codGrupoServidor || null
    };

    this.fields = [
      {
        fieldGroupClassName: 'row',
        fieldGroup: [
          {
            className: 'col-sm-8',
            key: 'dsServidor',
            type: 'input',
            templateOptions: {
              label: 'Descrição do Servidor',
              placeholder: 'Digite a descrição do servidor',
              required: true,
              maxLength: 100
            }
          },
          {
            className: 'col-sm-4',
            key: 'dsIP',
            type: 'input',
            templateOptions: {
              label: 'IP do Servidor',
              placeholder: 'Ex: 192.168.1.1',
              required: true,
              maxLength: 15
            }
          }
        ]
      },
      {
        fieldGroupClassName: 'row',
        fieldGroup: [
          {
            className: 'col-sm-6',
            key: 'dsUserAdmin',
            type: 'input',
            templateOptions: {
              label: 'Usuário Administrativo',
              placeholder: 'Digite o usuário admin',
              required: true,
              maxLength: 50
            }
          },
          {
            className: 'col-sm-6',
            key: 'dsSenhaAdmin',
            type: 'input',
            templateOptions: {
              label: 'Senha Administrativa',
              placeholder: 'Digite a senha admin',
              type: 'password',
              required: true,
              maxLength: 50
            }
          }
        ]
      },
      {
        fieldGroupClassName: 'row',
        fieldGroup: [
          {
            className: 'col-sm-6',
            key: 'dsMaquina',
            type: 'input',
            templateOptions: {
              label: 'Nome da Máquina',
              placeholder: 'Digite o nome da máquina',
              maxLength: 50
            }
          },
          {
            className: 'col-sm-3',
            key: 'tpAcessoRemoto',
            type: 'select',
            templateOptions: {
              label: 'Tipo de Acesso',
              options: [
                { value: 'RDP', label: 'RDP' },
                { value: 'SSH', label: 'SSH' },
                { value: 'TELNET', label: 'Telnet' }
              ],
              required: true
            }
          },
          {
            className: 'col-sm-3',
            key: 'tpSo',
            type: 'select',
            templateOptions: {
              label: 'Sistema Operacional',
              options: [
                { value: 'WINDOWS', label: 'Windows' },
                { value: 'LINUX', label: 'Linux' },
                { value: 'UNIX', label: 'Unix' }
              ],
              required: true
            }
          }
        ]
      },
      {
        fieldGroupClassName: 'row',
        fieldGroup: [
          {
            className: 'col-sm-6',
            key: 'usuarioAcessoRemoto',
            type: 'input',
            templateOptions: {
              label: 'Usuário Acesso Remoto',
              placeholder: 'Usuário para acesso remoto',
              maxLength: 50
            }
          },
          {
            className: 'col-sm-6',
            key: 'senhaAcessoRemoto',
            type: 'input',
            templateOptions: {
              label: 'Senha Acesso Remoto',
              placeholder: 'Senha para acesso remoto',
              type: 'password',
              maxLength: 50
            }
          }
        ]
      },
      {
        fieldGroupClassName: 'row',
        fieldGroup: [
          {
            className: 'col-sm-12',
            key: 'obsServidor',
            type: 'textarea',
            templateOptions: {
              label: 'Observações',
              placeholder: 'Digite observações sobre o servidor',
              rows: 3,
              maxLength: 500
            }
          }
        ]
      },
      {
        fieldGroupClassName: 'row',
        fieldGroup: [
          {
            className: 'col-sm-4',
            key: 'snAtivo',
            type: 'checkbox',
            templateOptions: {
              label: 'Ativo'
            }
          },
          {
            className: 'col-sm-4',
            key: 'snMonitorado',
            type: 'checkbox',
            templateOptions: {
              label: 'Monitorado'
            }
          }
        ]
      }
    ];
  }

  submit() {
    if (this.form.valid) {
      const servidor: Servidor = {
        ...this.model,
        grupoServidor: this.model.codGrupoServidor ? { codGrupoServidor: this.model.codGrupoServidor } : undefined
      };

      const request = this.data.modo === 'adicionar'
        ? this.servidorService.salvarServidor(servidor)
        : this.servidorService.atualizarServidor(servidor);

      request.subscribe({
        next: () => {
          this.toast.success(`Servidor ${this.data.modo === 'adicionar' ? 'adicionado' : 'atualizado'} com sucesso!`);
          this.dialogRef.close(true);
        },
        error: (error) => {
          this.toast.error(`Erro ao ${this.data.modo === 'adicionar' ? 'adicionar' : 'atualizar'} servidor!`);
          console.error(error);
        }
      });
    }
  }

  cancelar() {
    this.dialogRef.close('cancelado');
  }
}

@Component({
  selector: 'dialog-processo',
  templateUrl: 'dialog-processo.html',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatOptionModule,
    MatSlideToggleModule,
    FormlyModule,
    CommonModule,
    MatIconModule,
    MatDividerModule
  ],
})
export class DialogProcessoComponent {
  private readonly servidorService = inject(ServidorService);
  private readonly toast = inject(ToastrService);

  form = new FormGroup({});
  model: any = {};
  fields: FormlyFieldConfig[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<DialogProcessoComponent>,
    private fb: FormBuilder
  ) {
    this.initializeForm();
  }

  private initializeForm() {
    const processo = this.data.processo || {};

    this.model = {
      codProcesso: processo.codProcesso || null,
      dsProcesso: processo.dsProcesso || '',
      nmProcesso: processo.nmProcesso || '',
      caminhoProcesso: processo.caminhoProcesso || '',
      dsProcessoDetalhe: processo.dsProcessoDetalhe || '',
      snMonitorado: processo.snMonitorado !== undefined ? processo.snMonitorado : true
    };

    this.fields = [
      {
        fieldGroupClassName: 'row',
        fieldGroup: [
          {
            className: 'col-sm-8',
            key: 'dsProcesso',
            type: 'input',
            templateOptions: {
              label: 'Descrição do Processo',
              placeholder: 'Digite a descrição do processo',
              required: true,
              maxLength: 100
            }
          },
          {
            className: 'col-sm-4',
            key: 'nmProcesso',
            type: 'input',
            templateOptions: {
              label: 'Nome do Processo',
              placeholder: 'Ex: java.exe, tomcat.exe',
              required: true,
              maxLength: 50
            }
          }
        ]
      },
      {
        key: 'caminhoProcesso',
        type: 'input',
        templateOptions: {
          label: 'Caminho do Processo',
          placeholder: 'Digite o caminho completo do processo',
          maxLength: 500
        }
      },
      {
        key: 'dsProcessoDetalhe',
        type: 'textarea',
        templateOptions: {
          label: 'Detalhes do Processo',
          placeholder: 'Digite detalhes sobre o processo',
          rows: 3,
          maxLength: 1000
        }
      },
      {
        key: 'snMonitorado',
        type: 'checkbox',
        templateOptions: {
          label: 'Monitorar este processo'
        }
      }
    ];
  }

  submit() {
    if (this.form.valid) {
      const processo: ServidorProcesso = { ...this.model };
      const codServidor = this.data.servidor?.codServidor;

      if (!codServidor && this.data.modo === 'adicionar') {
        this.toast.error('Servidor não especificado!');
        return;
      }

      const request = this.data.modo === 'adicionar'
        ? this.servidorService.salvarProcesso(processo, codServidor)
        : this.servidorService.atualizarProcesso(processo);

      request.subscribe({
        next: () => {
          this.toast.success(`Processo ${this.data.modo === 'adicionar' ? 'adicionado' : 'atualizado'} com sucesso!`);
          this.dialogRef.close(true);
        },
        error: (error) => {
          this.toast.error(`Erro ao ${this.data.modo === 'adicionar' ? 'adicionar' : 'atualizar'} processo!`);
          console.error(error);
        }
      });
    }
  }

  cancelar() {
    this.dialogRef.close('cancelado');
  }
}

@Component({
  selector: 'dialog-parametro',
  templateUrl: 'dialog-parametro.html',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatOptionModule,
    MatSlideToggleModule,
    FormlyModule,
    CommonModule,
    MatIconModule,
    MatDividerModule
  ],
})
export class DialogParametroComponent {
  private readonly servidorService = inject(ServidorService);
  private readonly toast = inject(ToastrService);

  form = new FormGroup({});
  model: any = {};
  fields: FormlyFieldConfig[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<DialogParametroComponent>,
    private fb: FormBuilder
  ) {
    this.initializeForm();
  }

  private initializeForm() {
    const parametro = this.data.parametro || {};

    this.model = {
      codParametro: parametro.codParametro || null,
      dsParametro: parametro.dsParametro || '',
      dsValor: parametro.dsValor || '',
      snMonitorado: parametro.snMonitorado !== undefined ? parametro.snMonitorado : true
    };

    this.fields = [
      {
        key: 'dsParametro',
        type: 'input',
        templateOptions: {
          label: 'Descrição do Parâmetro',
          placeholder: 'Digite a descrição do parâmetro',
          required: true,
          maxLength: 100
        }
      },
      {
        key: 'dsValor',
        type: 'input',
        templateOptions: {
          label: 'Valor do Parâmetro',
          placeholder: 'Digite o valor do parâmetro',
          required: true,
          maxLength: 200
        }
      },
      {
        key: 'snMonitorado',
        type: 'checkbox',
        templateOptions: {
          label: 'Monitorar este parâmetro'
        }
      }
    ];
  }

  submit() {
    if (this.form.valid) {
      const parametro: ServidorParamentroProcesso = { ...this.model };
      const codProcesso = this.data.processo?.codProcesso;

      if (!codProcesso && this.data.modo === 'adicionar') {
        this.toast.error('Processo não especificado!');
        return;
      }

      const request = this.data.modo === 'adicionar'
        ? this.servidorService.salvarParametro(parametro, codProcesso)
        : this.servidorService.atualizarParametro(parametro);

      request.subscribe({
        next: () => {
          this.toast.success(`Parâmetro ${this.data.modo === 'adicionar' ? 'adicionado' : 'atualizado'} com sucesso!`);
          this.dialogRef.close(true);
        },
        error: (error) => {
          this.toast.error(`Erro ao ${this.data.modo === 'adicionar' ? 'adicionar' : 'atualizar'} parâmetro!`);
          console.error(error);
        }
      });
    }
  }

  cancelar() {
    this.dialogRef.close('cancelado');
  }
}
