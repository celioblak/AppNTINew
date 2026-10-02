import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatOptionModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { PageEvent } from '@angular/material/paginator';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MtxDatetimepickerModule } from '@ng-matero/extensions/datetimepicker';
import { MtxGridColumn, MtxGridModule } from '@ng-matero/extensions/grid';
import { MtxSelectModule } from '@ng-matero/extensions/select';
import { FormlyModule } from '@ngx-formly/core';
import { TranslateModule } from '@ngx-translate/core';
import { EstadoAgendador, JobManagerService } from './job-manager.service';
import { catchError, finalize } from 'rxjs';
import { schedulerJobInfoDetail } from '@core';
import { JobManagerAdvancedDialogComponent } from './job-manager-advanced-dialog';
import { JobCadastroDialogComponent, JobCadastroDialogData } from './job-cadastro-dialog';

@Component({
  selector: 'app-job-manager',
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
    MatSnackBarModule,
    MatTooltipModule,
    MatSlideToggleModule
  ],
  templateUrl: './job-manager.component.html',
  styleUrl: './job-manager.component.scss',
  providers: [DatePipe]
})
export class JobManagerComponent implements OnInit, OnDestroy {

  constructor(
    public datepipe: DatePipe,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  private readonly jobService = inject(JobManagerService);
  private readonly cdr = inject(ChangeDetectorRef);

  isLoading = false;
  isLoadingActions = false;
  /** Todos os jobs retornados pelo backend, sem filtro — base para aplicarFiltro(). */
  private listaCompleta: any[] = [];
  list: any[] = [];
  total = 0;
  noResult = 'Nenhum registro encontrado';

  /** Grupo Quartz dos jobs de agendamento de exportação de script (ver ScriptAgendamentoService.JOB_GROUP no backend). */
  private static readonly GRUPO_AGENDAMENTO_SCRIPT = 'SCRIPT_EXPORT';
  /** Oculto por padrão: são muitos jobs recorrentes que poluem a visão geral do scheduler. */
  mostrarJobsAgendamentoScript = false;

  autoAtualizar = true;
  ultimaAtualizacao: Date | null = null;
  /** Estado do agendador (vigia): alimenta o aviso acima da lista. */
  agendador: EstadoAgendador | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  // Mesmo intervalo da tela "Últimas Execuções" — visão agregada, não precisa ser mais frequente.
  private static readonly INTERVALO_MS = 15000;

  columns: MtxGridColumn[] = [
    {
      header: 'Cod.',
      field: 'jobId',
      width: '50px',
      resizable: false,
      formatter: (data: any) => `<span class="label">${data?.jobId ? data?.jobId : ''}</span>`
    },
    {
      header: 'Nome',
      field: 'jobName',
      width: '100%',
      resizable: false,
      formatter: (data: any) => `<span class="label">${data?.jobName ? data?.jobName : ''}</span>`
    },
    {
      header: 'Ult. Execução',
      field: 'prev_fire_time',
      width: '170px',
      resizable: false,
      formatter: (data: any) => `<span class="label">${data?.prev_fire_time ? this.datepipe.transform(data?.prev_fire_time, 'dd/MM/yyyy HH:mm:ss') : ''}</span>`
    },
    {
      header: 'Prox. Execução',
      field: 'next_fire_time',
      width: '170px',
      resizable: false,
      formatter: (data: any) => `<span class="label">${data?.next_fire_time ? this.datepipe.transform(data?.next_fire_time, 'dd/MM/yyyy HH:mm:ss') : ''}</span>`
    },
    {
      header: 'Status',
      field: 'jobStatus',
      width: '130px',
      resizable: false,
      formatter: (data: any) => `<span class="label">${data?.jobStatus ? data?.jobStatus : ''}</span>`
    },
    {
      header: 'Status Trigger',
      field: 'trigger_state',
      width: '150px',
      resizable: false,
      formatter: (data: any) => `<span title="${this.getStatusTriggerDescription(data?.trigger_state ? data?.trigger_state : '')}" class="label" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block; max-width: 100%;">${data?.trigger_state ? data?.trigger_state : ''} </span>`
    },
    {
      header: 'Último Erro',
      field: 'ultimoErro',
      width: '260px',
      resizable: false,
      formatter: (data: any) => this.formatarUltimoErro(data)
    },
    {
      header: 'Operação',
      field: 'operacao',
      pinned: 'right',
      minWidth: 250,
      width: '250px',
      right: '0px',
      type: 'button',
      resizable: false,
      buttons: [
        {
          type: 'icon',
          text: 'Executar',
          icon: 'settings_power',
          color: 'primary',
          tooltip: 'Executar',
          click: (data) => this.run(data),
        },
        {
          type: 'icon',
          text: 'Pausar',
          icon: 'pause',
          color: 'primary',
          tooltip: 'Pausar',
          click: (data) => this.pause(data),
        },
        {
          type: 'icon',
          text: 'Retomar',
          icon: 'play_arrow',
          color: 'primary',
          tooltip: 'Retomar',
          click: (data) => this.resume(data),
        },
        {
          type: 'icon',
          text: 'Editar',
          icon: 'edit',
          color: 'primary',
          tooltip: 'Editar',
          click: (data) => this.edit(data),
        },
        {
          type: 'icon',
          text: 'Remover',
          icon: 'delete',
          color: 'warn',
          tooltip: 'Remover',
          iif: (data: any) => data.jobStatus != "REMOVED",
          click: (data) => this.remove(data),
        },
        {
          type: 'icon',
          text: 'Recriar',
          icon: 'build',
          color: 'accent',
          tooltip: 'Recriar',
          iif: (data: any) => data.jobStatus == "REMOVED",
          click: (data) => this.recreate(data),
        },
      ],
    },
  ];

  ngOnInit() {
    this.search();
    this.iniciarAutoAtualizacao();
  }

  ngOnDestroy() {
    this.pararAutoAtualizacao();
  }

  onToggleAutoAtualizar() {
    if (this.autoAtualizar) {
      this.iniciarAutoAtualizacao();
    } else {
      this.pararAutoAtualizacao();
    }
  }

  private iniciarAutoAtualizacao() {
    this.pararAutoAtualizacao();
    if (!this.autoAtualizar) {
      return;
    }
    this.intervalId = setInterval(() => this.search(), JobManagerComponent.INTERVALO_MS);
  }

  private pararAutoAtualizacao() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  run(job: schedulerJobInfoDetail) {
    this.jobService.runJob(job).pipe(
      finalize(() => {
        this.search();
      })
    ).subscribe((dados: any) => {
      console.log(dados);
      this.showMessage('Job executado com sucesso!', 'success');
    });
  }

  pause(job: schedulerJobInfoDetail) {
    this.jobService.pauseJob(job).pipe(
      finalize(() => {
        this.search();
      })
    ).subscribe((dados: any) => {
      console.log(dados);
      this.showMessage('Job pausado com sucesso!', 'success');
    });
  }

  resume(job: schedulerJobInfoDetail) {
    this.jobService.resumeJob(job).pipe(
      finalize(() => {
        this.search();
      })
    ).subscribe((dados: any) => {
      console.log(dados);
      this.showMessage('Job retomado com sucesso!', 'success');
    });
  }

  // MÉTODO REMOVIDO: Não há endpoint para restart individual
  // restart(job: schedulerJobInfoDetail) {
  //   this.jobService.restartJob(job).pipe(
  //     finalize(() => {
  //       this.search();
  //     })
  //   ).subscribe((dados: any) => {
  //     console.log(dados);
  //   });
  // }

  remove(job: schedulerJobInfoDetail) {
    this.jobService.removeJob(job).pipe(
      finalize(() => {
        this.search();
      })
    ).subscribe((dados: any) => {
      console.log(dados);
      this.showMessage('Job removido com sucesso!', 'success');
    });
  }

  recreate(job: schedulerJobInfoDetail) {
    // Use recreateSingleJob em vez de recreateJob
    this.jobService.recreateSingleJob(job).pipe(
      finalize(() => {
        this.search();

      })
    ).subscribe((dados: any) => {
      console.log(dados);
      this.showMessage('Job recriado com sucesso!', 'success');
    });
  }

  novo() {
    this.abrirCadastro(null);
  }

  edit(job: schedulerJobInfoDetail) {
    this.abrirCadastro(job);
  }

  /** Cadastro/edição de job; a lista para de se atualizar sozinha enquanto o diálogo está aberto. */
  private abrirCadastro(job: schedulerJobInfoDetail | null) {
    const grupos = [...new Set(this.listaCompleta.map((j: any) => j?.jobGroup).filter(Boolean))].sort() as string[];
    this.pararAutoAtualizacao();
    this.dialog
      .open<JobCadastroDialogComponent, JobCadastroDialogData, boolean>(JobCadastroDialogComponent, {
        width: '760px',
        maxWidth: '96vw',
        maxHeight: '92vh',
        autoFocus: false,
        data: { job, grupos },
      })
      .afterClosed()
      .subscribe(salvo => {
        this.iniciarAutoAtualizacao();
        if (salvo) {
          this.showMessage(job ? 'Job atualizado.' : 'Job criado.', 'success');
          this.search();
        }
      });
  }

  search() {
    this.isLoading = true;
    this.cdr.detectChanges();
    this.jobService.carregarJob().subscribe({
      next: (dados: any) => this.aplicarResultado(() => {
        this.listaCompleta = dados;
        this.aplicarFiltro();
        this.ultimaAtualizacao = new Date();
        this.isLoading = false;
      }),
      error: (err) => this.aplicarResultado(() => {
        this.isLoading = false;
      })
    });
    this.jobService.estadoAgendador().subscribe({
      next: e => this.aplicarResultado(() => (this.agendador = e)),
      error: () => this.aplicarResultado(() => (this.agendador = null)),
    });
  }

  /** Problemas que pedem atenção (ERRO) e execuções travadas, para o aviso acima da lista. */
  get problemasAgendador(): number {
    return (this.agendador?.problemas ?? []).filter(p => p.severidade === 'ERRO').length;
  }

  get problemasSoAutomaticos(): boolean {
    return (this.agendador?.problemas ?? []).filter(p => p.severidade === 'ERRO').every(p => p.automatico);
  }

  /**
   * Adia a atualização dos campos ligados ao template pro próximo macrotask e
   * força o detectChanges nesse novo ciclo. Necessário porque, com o
   * auto-refresh, o backend às vezes responde rápido o bastante pra cair
   * ainda dentro da mesma janela de verificação do Angular que iniciou a
   * chamada — mudar isLoading/ultimaAtualizacao nesse instante dispara
   * NG0100 (ExpressionChangedAfterItHasBeenCheckedError). Mesmo padrão usado
   * em UltimasExecucoesComponent e DialogHistoricoExecucaoComponent.
   */
  private aplicarResultado(atualizar: () => void) {
    setTimeout(() => {
      atualizar();
      this.cdr.detectChanges();
    });
  }

  /** Aplica o toggle "mostrar jobs de agendamento de script" sobre a lista completa vinda do backend. */
  private aplicarFiltro() {
    this.list = this.mostrarJobsAgendamentoScript
      ? this.listaCompleta
      : this.listaCompleta.filter((job: any) => job?.jobGroup !== JobManagerComponent.GRUPO_AGENDAMENTO_SCRIPT);
    this.total = this.list.length;
  }

  onToggleMostrarJobsAgendamentoScript() {
    this.aplicarFiltro();
    this.cdr.detectChanges();
  }

  openAdvancedManagement() {
    const dialogRef = this.dialog.open(JobManagerAdvancedDialogComponent, {
      width: '980px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      disableClose: false,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((result: boolean) => {
      if (result) {
        this.search();
      }
    });
  }

  private showMessage(message: string, type: 'success' | 'error' | 'info' = 'info') {
    this.snackBar.open(message, 'Fechar', {
      duration: 3000,
      panelClass: [`snackbar-${type}`],
      horizontalPosition: 'right',
      verticalPosition: 'top'
    });
  }

  changeSelect(event: any) {}
  changeSelectPage(e: PageEvent) {}

  /**
   * Mostra a última falha registrada pelo backend (JobErroTrackingListener),
   * truncada, com data/hora + mensagem completa no tooltip nativo (title).
   * Vazio quando a última execução do job foi bem-sucedida (backend limpa o
   * erro assim que o job volta a rodar sem falhar).
   */
  private formatarUltimoErro(data: any): string {
    if (!data?.ultimoErro) {
      return '';
    }
    const quando = data.dtUltimoErro
      ? this.datepipe.transform(data.dtUltimoErro, 'dd/MM/yyyy HH:mm:ss')
      : '';
    const mensagem: string = data.ultimoErro;
    const truncado = mensagem.length > 60 ? mensagem.substring(0, 60) + '…' : mensagem;
    const tooltip = this.escaparAspas(`${quando ? quando + ' — ' : ''}${mensagem}`);
    return `<span class="label job-erro-label" title="${tooltip}">` +
      `<span class="material-icons job-erro-icon">error_outline</span> ` +
      `${this.escaparHtml(truncado)}</span>`;
  }

  private escaparHtml(texto: string): string {
    return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private escaparAspas(texto: string): string {
    return texto.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  getStatusTriggerDescription(status: string): string {
    switch (status) {
      case 'AGUARDANDO':
        return 'O estado normal e padrão. O trigger está agendado e esperando o seu horário de execução chegar.';
      case 'PAUSADO':
        return 'O trigger foi pausado manualmente (via métodos pauseTrigger ou pauseJob). Ele não será executado até ser retomado (resumed).';
      case 'ADQUIRIDO':
        return 'Um nó do scheduler já identificou este trigger como the próximo a ser executado e o pegou (adquiriu). Ele está prestes a ser disparado.';
      case 'BLOQUEADO':
        return 'O trigger está bloqueado porque está associado a um Job que é Stateful (ou seja DisallowConcurrentExecution está ativado) e a execução anterior desse job ainda não terminou.';
      case 'COMPLETO':
        return 'O trigger concluiu todas as suas execuções programadas (ex: um trigger simples que rodou todas as 5 vezes definidas) e não disparará novamente.';
      case 'ERRO':
        return 'Ocorreu um erro interno no Quartz ao tentar executar o trigger ou o job associado falhou. Ele não será disparado novamente até que o estado seja corrigido (geralmente vai para WAITING após ser reiniciado ou pelo próprio Scheduler).';
      case 'NONE':
        return 'O trigger não existe na base de dados ou na memória do Scheduler.';
      default:
        return 'Estado desconhecido.';
    }
  }
}
