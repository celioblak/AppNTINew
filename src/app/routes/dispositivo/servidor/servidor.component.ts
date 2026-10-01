import { ClipboardModule } from '@angular/cdk/clipboard';
import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, Inject, inject, OnInit, TemplateRef, ViewChild,ChangeDetectorRef } from '@angular/core';
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
import { grupoServidor, Servidor, ServidorParamentroProcesso, ServidorProcesso } from '@core/interface';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormlyFieldConfig, FormlyModule } from '@ngx-formly/core';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { HotToastService } from '@ngxpert/hot-toast';
import { Router } from '@angular/router';


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
  private readonly toast = inject(HotToastService);
  private readonly servidorService = inject(ServidorService);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);

  list: Servidor[] = [];
  listCompleta: Servidor[] = [];
  apenasAtivos: boolean = true;
  /** Texto do campo "Valor Pesquisa" — filtra por QUALQUER atributo do servidor (client-side). */
  termoPesquisa: string = '';
  listProcesso: ServidorProcesso[] = [];
  listParamentro: ServidorParamentroProcesso[] = [];
  listGrupo: grupoServidor[] = [];
  listTipoProcesso: any[] = [];
  listTipoParametro: any[] = [];
  grupoSelecionado: grupoServidor = {};
  /** Sentinel para opcao "TODOS" - sem codGrupoServidor, faz o filtro ignorar grupo */
  todosGrupos: grupoServidor = {};
  servidorSelecionado: Servidor = {};
  processoSelecionado: ServidorProcesso = {};
  paramentroSelecionado: ServidorParamentroProcesso = {};

  noResult = 'Nenhum registro encontrado';

  // TEMPLATES
  @ViewChild('statusAtivoTpl', { static: true }) statusAtivoTpl!: TemplateRef<any>;
  @ViewChild('statusProcessoTpl', { static: true }) statusProcessoTpl!: TemplateRef<any>;
  @ViewChild('statusMonitoramentoTpl', { static: true }) statusMonitoramentoTpl!: TemplateRef<any>;
  @ViewChild('filterValue') filterValueRef?: ElementRef<HTMLInputElement>;

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
      width: '180px',
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
      formatter: (data: any) => {
        const label = this.formatTipoParametro(data?.dsParametro);
        return `<span class="label box" title="${label}">${label}</span>`;
      }
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
      formatter: (data: any) => {
        const label = this.formatTipoParametro(data?.dsParametro);
        return `<span class="label box" title="${label}">${label}</span>`;
      }
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
    this.grupoSelecionado = this.todosGrupos;
    this.search();
    this.buscarGrupos();
    this.buscarTiposProcesso();
    this.buscarTiposParametro();
  }

  buscarGrupos() {
    this.servidorService.carregarGrupos().subscribe(dadosGrupo => {
      this.listGrupo = dadosGrupo;
      this.cdr.markForCheck();
    });
  }

  buscarTiposProcesso() {
    this.servidorService.carregarTipoProcesso().subscribe(dados => {
      this.listTipoProcesso = dados;
      this.cdr.markForCheck();
    });
  }

  buscarTiposParametro() {
    this.servidorService.carregarTipoParametro().subscribe(dados => {
      this.listTipoParametro = dados;
      this.cdr.markForCheck();
    });
  }

  formatTipoParametro(key: string): string {
    if (!key) return '';
    const tipo = this.listTipoParametro.find(t => t.key === key);
    return tipo ? tipo.value : key;
  }

  search() {
    this.servidorService.carregarServidor().subscribe(dadosServidor => {
      this.listParamentro = [];
      this.listProcesso = [];
      this.listCompleta = dadosServidor;
      this.aplicarFiltroAtivos();
      this.resetarSelecoes();
      this.cdr.markForCheck();
    });
  }

  searchFiltro(pesquisaInput: HTMLInputElement) {
    // Filtro totalmente client-side sobre a lista já carregada (listCompleta),
    // pesquisando em QUALQUER atributo do servidor.
    this.termoPesquisa = pesquisaInput?.value ?? '';
    this.aplicarFiltroAtivos();
    this.resetarSelecoes();
    this.cdr.markForCheck();
  }

  /**
   * Recarrega os servidores do backend e reaplica os filtros atuais
   * (grupo + texto + apenas ativos). Usar após operações de CRUD.
   */
  refresh() {
    this.search();
  }

  /**
   * Aplica, em sequência, os três filtros locais: grupo, "apenas ativos" e o
   * termo de pesquisa (que casa com qualquer atributo do servidor).
   * Mantém o nome antigo pois é chamado em vários pontos.
   */
  aplicarFiltroAtivos() {
    let base = [...this.listCompleta];

    const codGrupo = this.grupoSelecionado?.codGrupoServidor;
    if (codGrupo) {
      base = base.filter(s => s.grupoServidor?.codGrupoServidor === codGrupo);
    }

    if (this.apenasAtivos) {
      base = base.filter(s => s.snAtivo);
    }

    const termo = (this.termoPesquisa ?? '').trim().toLowerCase();
    if (termo) {
      base = base.filter(s => this.servidorContemTermo(s, termo));
    }

    this.list = base;
  }

  /** Verdadeiro se algum valor (em qualquer profundidade) do servidor contém o termo. */
  private servidorContemTermo(servidor: Servidor, termo: string): boolean {
    const visitados = new Set<any>();

    const percorre = (valor: any): boolean => {
      if (valor == null) return false;

      if (typeof valor === 'string') {
        return valor.toLowerCase().includes(termo);
      }
      if (typeof valor === 'number') {
        return String(valor).includes(termo);
      }
      if (typeof valor === 'boolean') {
        const rotulos = valor ? ['sim', 'true', 'ativo'] : ['nao', 'não', 'false', 'inativo'];
        return rotulos.some(r => r.includes(termo) || termo.includes(r));
      }
      if (valor instanceof Date) {
        return valor.toLocaleString('pt-BR').toLowerCase().includes(termo);
      }
      if (typeof valor === 'object') {
        if (visitados.has(valor)) return false;
        visitados.add(valor);
        return Object.values(valor).some(percorre);
      }
      return false;
    };

    return percorre(servidor);
  }

  onToggleApenasAtivos() {
    this.aplicarFiltroAtivos();
    this.resetarSelecoes();
    this.cdr.markForCheck();
  }

  searchProcessos(serv: Servidor) {
    this.servidorService.carregarServidorProcesso(serv).subscribe(dadosProcesso => {
      this.listProcesso = dadosProcesso;
      this.processoSelecionado = {};
      this.listParamentro = [];
      this.paramentroSelecionado = {};
      this.cdr.markForCheck();
    });
  }

  searchParamentros(proc: ServidorProcesso) {
    this.servidorService.carregarProcessoParamentro(proc).subscribe(dadosParamentro => {
      this.listParamentro = dadosParamentro;
      this.paramentroSelecionado = {};
      this.cdr.markForCheck();
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

    // Pinta a linha clicada para feedback visual consistente com a navegacao por teclado
    if (event && event.event && event.event.target) {
      const tr = (event.event.target as HTMLElement).closest('tr');
      if (tr && tr.parentElement) {
        const wrapper = tr.closest('.grid-wrapper') as HTMLElement | null;
        if (wrapper) {
          wrapper.querySelectorAll('tr.row-selected').forEach(el => el.classList.remove('row-selected'));
          tr.classList.add('row-selected');
        }
      }
    }
  }

  /**
   * Aplica destaque na linha selecionada e faz scroll ate ela.
   * Encontra a <tr> pelo INDICE dentro do wrapper, sem depender da
   * mtx-grid suportar rowClassFormatter.
   */
  private highlightAndScrollRow(wrapper: HTMLElement, indice: number) {
    // Aguarda Angular finalizar o ciclo de detecao
    setTimeout(() => {
      // Remove highlight de qualquer linha previamente marcada nesse wrapper
      const previas = wrapper.querySelectorAll('tr.row-selected');
      previas.forEach(el => el.classList.remove('row-selected'));

      // Pega todas as <tr> de dados (ignora cabecalho thead)
      const linhas = wrapper.querySelectorAll('tbody tr');
      if (linhas.length === 0 || indice < 0 || indice >= linhas.length) {
        return;
      }

      const alvo = linhas[indice] as HTMLElement;
      alvo.classList.add('row-selected');

      if (typeof alvo.scrollIntoView === 'function') {
        alvo.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 0);
  }

  /**
   * Navegacao por teclado nas grids. Captura ArrowUp/ArrowDown e Home/End
   * antes do navegador rolar a pagina, e move a selecao entre as linhas.
   */
  onGridKeyDown(event: KeyboardEvent, type: 'servidor' | 'processo' | 'parametro') {
    const navKeys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!navKeys.includes(event.key)) {
      return;
    }

    let lista: any[];
    let selecionado: any;
    let chaveId: string;

    if (type === 'servidor') {
      lista = this.list;
      selecionado = this.servidorSelecionado;
      chaveId = 'codServidor';
    } else if (type === 'processo') {
      lista = this.listProcesso;
      selecionado = this.processoSelecionado;
      chaveId = 'codProcesso';
    } else {
      lista = this.listParamentro;
      selecionado = this.paramentroSelecionado;
      chaveId = 'codParametro';
    }

    if (!lista || lista.length === 0) {
      return;
    }

    // Sempre preveni o scroll padrao quando a grid tem itens
    event.preventDefault();

    const indiceAtual = selecionado && selecionado[chaveId]
      ? lista.findIndex(item => item[chaveId] === selecionado[chaveId])
      : -1;

    let novoIndice: number;

    switch (event.key) {
      case 'ArrowDown':
        novoIndice = indiceAtual < 0 ? 0 : Math.min(indiceAtual + 1, lista.length - 1);
        break;
      case 'ArrowUp':
        novoIndice = indiceAtual <= 0 ? 0 : indiceAtual - 1;
        break;
      case 'Home':
        novoIndice = 0;
        break;
      case 'End':
        novoIndice = lista.length - 1;
        break;
      default:
        return;
    }

    if (novoIndice === indiceAtual) {
      return;
    }

    // Reusa o mesmo fluxo do clique para manter consistencia (cascata de carregamento)
    this.onRowClick({ rowData: lista[novoIndice] }, type);
    this.cdr.markForCheck();

    // Pinta e rola a linha (independente da versao da mtx-grid)
    const wrapper = event.currentTarget as HTMLElement;
    this.highlightAndScrollRow(wrapper, novoIndice);
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
    this.aplicarFiltroAtivos();
    this.resetarSelecoes();
    this.cdr.markForCheck();
  }

  changeSelectProcesso(event: any) {
    console.log(event);
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
        this.refresh();
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
        this.refresh();
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
            this.refresh();
          },
          error: (error) => {
            this.toast.error('Erro ao excluir servidor!');
            console.error(error);
          }
        });
      }
    });
  }

  /** Abre Dispositivos > Terminal SSH já conectando no servidor selecionado. */
  abrirTerminalSsh() {
    if (!this.servidorSelecionado.codServidor) {
      this.toast.warning('Selecione um servidor para abrir o terminal!');
      return;
    }
    this.router.navigate(['/dispositivo/terminal-ssh'], {
      queryParams: { servidor: this.servidorSelecionado.codServidor },
    });
  }

  openAddProcessoDialog() {
    if (!this.servidorSelecionado.codServidor) {
      this.toast.warning('Selecione um servidor primeiro!');
      return;
    }

    const dialogRef = this.dialog.open(DialogProcessoComponent, {
      data: { modo: 'adicionar', processo: {}, servidor: this.servidorSelecionado, tiposProcesso: this.listTipoProcesso },
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
      data: { modo: 'editar', processo: { ...this.processoSelecionado }, tiposProcesso: this.listTipoProcesso },
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
      data: { modo: 'adicionar', parametro: {}, processo: this.processoSelecionado, tiposParametro: this.listTipoParametro },
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
      data: { modo: 'editar', parametro: { ...this.paramentroSelecionado }, tiposParametro: this.listTipoParametro },
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
        message: `Tem certeza que deseja excluir o parâmetro "${this.formatTipoParametro(this.paramentroSelecionado.dsParametro as any)}"?`,
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
  private readonly toast = inject(HotToastService);

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
            key: 'codGrupoServidor',
            type: 'select',
            templateOptions: {
              label: 'Grupo do Servidor',
              placeholder: 'Selecione o grupo do servidor',
              required: true,
              options: this.grupos.map(g => ({
                value: g.codGrupoServidor,
                label: g.dsGrupo
              }))
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
  private readonly toast = inject(HotToastService);

  form = new FormGroup({});
  model: any = {};
  fields: FormlyFieldConfig[] = [];
  tiposProcesso: any[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<DialogProcessoComponent>,
    private fb: FormBuilder
  ) {
    this.tiposProcesso = data.tiposProcesso || [];
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
      snMonitorado: processo.snMonitorado !== undefined ? processo.snMonitorado : true,
      codTipoProcesso: processo.servidorTipoProcesso?.codTipoProcesso || null
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
        key: 'codTipoProcesso',
        type: 'select',
        templateOptions: {
          label: 'Tipo do Processo',
          placeholder: 'Selecione o tipo do processo',
          required: true,
          options: this.tiposProcesso.map(t => ({
            value: t.codTipoProcesso,
            label: t.dsTipoProcesso
          }))
        }
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
      const { codTipoProcesso, ...rest } = this.model;
      const processo: ServidorProcesso = {
        ...rest,
        servidorTipoProcesso: codTipoProcesso ? { codTipoProcesso } : null
      };
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
  private readonly toast = inject(HotToastService);

  form = new FormGroup({});
  model: any = {};
  fields: FormlyFieldConfig[] = [];
  tiposParametro: any[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<DialogParametroComponent>,
    private fb: FormBuilder
  ) {
    this.tiposParametro = data.tiposParametro || [];
    this.initializeForm();
  }

  private initializeForm() {
    const parametro = this.data.parametro || {};

    this.model = {
      codParametro: parametro.codParametro || null,
      dsParametro: parametro.dsParametro || null,
      dsValor: parametro.dsValor || '',
      snMonitorado: parametro.snMonitorado !== undefined ? parametro.snMonitorado : true
    };

    this.fields = [
      {
        key: 'dsParametro',
        type: 'select',
        templateOptions: {
          label: 'Tipo do Parâmetro',
          placeholder: 'Selecione o tipo do parâmetro',
          required: true,
          options: this.tiposParametro.map(t => ({
            value: t.key,
            label: t.value
          }))
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
