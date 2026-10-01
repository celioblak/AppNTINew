import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, finalize, tap } from 'rxjs/operators';
import { of } from 'rxjs';
import { JobManagerService } from './job-manager.service';

@Component({
  selector: 'app-job-manager-advanced-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatDividerModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  templateUrl: 'job-manager-advanced-dialog.html',
  styleUrl: 'job-manager-advanced-dialog.scss',
  providers: [DatePipe]
})
export class JobManagerAdvancedDialogComponent implements OnInit {

  constructor(
    private dialogRef: MatDialogRef<JobManagerAdvancedDialogComponent>,
    public datepipe: DatePipe,
    private snackBar: MatSnackBar
  ) {}

  private readonly jobService = inject(JobManagerService);
  private readonly cdr = inject(ChangeDetectorRef);

  isLoadingHealth = false;
  isLoadingDiagnostic = false;
  isLoadingActions = false;

  // Propriedades para informações
  schedulerMetaData: any = null;
  schedulerHealth: any = null;
  diagnosticInfo: any = null;

  // Contadores para status
  statusCounts: any = {
    SCHEDULED: 0,
    RESUMED: 0,
    PAUSED: 0,
    REMOVED: 0,
    ERROR: 0
  };

  totalJobs = 0;
  selectedTabIndex = 0;
  currentDate = new Date(); // Adicionada propriedade para a data atual

  ngOnInit() {
    this.loadSchedulerMetaData();
  }

  // Métodos para gerenciamento do scheduler
  loadSchedulerMetaData() {
    this.jobService.getSchedulerMetaData().pipe(
      tap((data: any) => {
        this.schedulerMetaData = data;
        this.cdr.detectChanges();
      }),
      catchError((error: any) => {
        console.error('Erro ao carregar metadados:', error);
        return of(null);
      })
    ).subscribe();
     this.cdr.detectChanges();
  }

  checkSchedulerHealth() {
    this.isLoadingHealth = true;
    this.cdr.detectChanges();

    this.jobService.getSchedulerHealth().pipe(
      tap((data: any) => {
        console.log('Resposta completa da API:', data);
        console.log('Estrutura do objeto:', JSON.stringify(data));
        console.log('Tem propriedade scheduler?', 'scheduler' in data);
        console.log('Tem propriedade shutdown?', 'shutdown' in data);
        console.log('Tem propriedade status?', 'status' in data);

        this.schedulerHealth = data;
        this.showMessage('Saúde do scheduler verificada!', 'success');
        this.cdr.detectChanges();
      }),
      catchError((error: any) => {
        this.showMessage(`Erro ao verificar saúde: ${error.message}`, 'error');
        return of(null);
      }),
      finalize(() => {
        this.isLoadingHealth = false;
        this.cdr.detectChanges();
      })
    ).subscribe();
  }

  runDiagnostic() {
    this.isLoadingDiagnostic = true;
     this.cdr.detectChanges();

    this.jobService.getDiagnostic().pipe(
      tap((data: any) => {
        this.diagnosticInfo = data;
        this.showMessage('Diagnóstico executado!', 'success');
         this.cdr.detectChanges();
      }),
      catchError((error: any) => {
        this.showMessage(`Erro no diagnóstico: ${error.message}`, 'error');
        return of(null);
      }),
      finalize(() => {
        this.isLoadingDiagnostic = false;
        this.cdr.detectChanges();
      })
    ).subscribe();
  }

  restartScheduler() {
    if (confirm('Reiniciar o scheduler?\nIsso pode interromper jobs em execução.')) {
      this.isLoadingActions = true;
      this.cdr.detectChanges();

      this.jobService.restartScheduler().pipe(
        tap(() => {
          this.showMessage('Scheduler reiniciado com sucesso!', 'success');
           this.cdr.detectChanges();
          // Recarrega os dados após restart
          setTimeout(() => {
            this.loadSchedulerMetaData();
            this.checkSchedulerHealth();
          }, 2000);
        }),
        catchError((error: any) => {
          this.showMessage(`Erro ao reiniciar scheduler: ${error.message}`, 'error');
          return of(null);
        }),
        finalize(() => {
          this.isLoadingActions = false;
          this.cdr.detectChanges();
        })
      ).subscribe();
    }
  }

  cleanupOrphanedJobs() {
    if (confirm('Limpar jobs órfãos?\nEsta ação removerá jobs que estão no scheduler mas não no banco.')) {
      this.isLoadingActions = true;
       this.cdr.detectChanges();

      this.jobService.cleanupJobs().pipe(
        tap(() => {
          this.showMessage('Limpeza de jobs órfãos concluída!', 'success');
           this.cdr.detectChanges();
        }),
        catchError((error: any) => {
          this.showMessage(`Erro na limpeza: ${error.message}`, 'error');
          return of(null);
        }),
        finalize(() => {
          this.isLoadingActions = false;
          this.cdr.detectChanges();
        })
      ).subscribe();
    }
  }

  cancelAllJobs() {
    if (confirm('Cancelar todos os jobs?\nEsta ação impedirá triggers futuros, mas não interromperá jobs em execução.')) {
      this.isLoadingActions = true;
       this.cdr.detectChanges();

      this.jobService.cancelAllJobs().pipe(
        tap(() => {
          this.showMessage('Todos os jobs foram cancelados!', 'success');
           this.cdr.detectChanges();
        }),
        catchError((error: any) => {
          this.showMessage(`Erro ao cancelar jobs: ${error.message}`, 'error');
          return of(null);
        }),
        finalize(() => {
          this.isLoadingActions = false;
          this.cdr.detectChanges();
        })
      ).subscribe();
    }
  }

  recreateAllJobs() {
    if (confirm('Recriar todos os jobs?\nEsta ação recriará todos os jobs do banco no scheduler.')) {
      this.isLoadingActions = true;
       this.cdr.detectChanges();

      this.jobService.recreateAllJobs().pipe(
        tap(() => {
          this.showMessage('Todos os jobs recriados!', 'success');
           this.cdr.detectChanges();
        }),
        catchError((error: any) => {
          this.showMessage(`Erro ao recriar jobs: ${error.message}`, 'error');
          return of(null);
        }),
        finalize(() => {
          this.isLoadingActions = false;
           this.cdr.detectChanges();
        })
      ).subscribe();
    }
  }

  // Métodos auxiliares
  private showMessage(message: string, type: 'success' | 'error' | 'info' = 'info') {
    this.snackBar.open(message, 'Fechar', {
      duration: 3000,
      panelClass: [`snackbar-${type}`],
      horizontalPosition: 'right',
      verticalPosition: 'top'
    });
  }

  getSchedulerStatus(): string {
    console.log('schedulerHealth:', this.schedulerHealth);

    if (!this.schedulerHealth) return 'DESCONHECIDO';

    // Verifica estrutura da resposta da API
    if (this.schedulerHealth.shutdown) return 'PARADO';
    if (this.schedulerHealth.standby) return 'EM ESPERA';
    if (this.schedulerHealth.started || this.schedulerHealth.status === 'RUNNING') return 'RODANDO';

    return 'DESCONHECIDO';
  }

  getSchedulerStatusClass(): string {
    const status = this.getSchedulerStatus();
    const classMap: { [key: string]: string } = {
      'RODANDO': 'scheduler-running',
      'PARADO': 'scheduler-stopped',
      'EM ESPERA': 'scheduler-standby',
      'DESCONHECIDO': 'scheduler-unknown'
    };
    return classMap[status] || 'scheduler-unknown';
  }

  getSchedulerStatusText(): string {
    const status = this.getSchedulerStatus();
    const statusMap: { [key: string]: string } = {
      'RODANDO': 'Rodando',
      'PARADO': 'Parado',
      'EM ESPERA': 'Em espera',
      'DESCONHECIDO': 'Desconhecido'
    };
    return statusMap[status] || status;
  }

  getTotalActiveJobs(): number {
    return (this.statusCounts.SCHEDULED || 0) + (this.statusCounts.RESUMED || 0);
  }

  closeDialog() {
    this.dialogRef.close(true);
  }

  // No JobManagerAdvancedDialogComponent

restartAllInstances() {
  if (confirm('REINICIAR TODAS AS INSTÂNCIAS DO CLUSTER?\n\n' +
              'Isso irá reiniciar o scheduler em TODOS os nós simultaneamente.\n' +
              'Jobs em execução serão interrompidos em TODAS as instâncias.')) {

    this.isLoadingActions = true;
    this.cdr.detectChanges();
    this.jobService.restartAllInstances().pipe(
      tap((response: any) => {
        if (response.success) {
          this.showMessage('Comando de reinício enviado para todas as instâncias!', 'success');
          console.log('ID do comando:', response.commandId);
        } else {
          this.showMessage(`Erro: ${response.error}`, 'error');
        }
         this.cdr.detectChanges();
      }),
      catchError((error: any) => {
        this.showMessage(`Erro ao reiniciar cluster: ${error.message}`, 'error');
        return of(null);
      }),
      finalize(() => {
        this.isLoadingActions = false;
        this.cdr.detectChanges();
      })
    ).subscribe();
  }
}

recreateAllJobsClusterWide() {
  if (confirm('RECRIAR JOBS EM TODAS AS INSTÂNCIAS?\n\n' +
              'Esta ação sincronizará e recriará todos os jobs em cada nó do cluster.')) {

    this.isLoadingActions = true;
     this.cdr.detectChanges();

    this.jobService.recreateAllJobsClusterWide().pipe(
      tap((response: any) => {
        if (response.success) {
          this.showMessage('Comando de recriação enviado para todas as instâncias!', 'success');
        } else {
          this.showMessage(`Erro: ${response.error}`, 'error');
        }
         this.cdr.detectChanges();
      }),
      catchError((error: any) => {
        this.showMessage(`Erro: ${error.message}`, 'error');
        return of(null);
      }),
      finalize(() => {
        this.isLoadingActions = false;
        this.cdr.detectChanges();
      })
    ).subscribe();
  }
}

cancelAllJobsClusterWide() {
  if (confirm('CANCELAR TODOS OS JOBS EM TODAS AS INSTÂNCIAS?\n\n' +
              'Esta ação pausará todos os triggers em todo o cluster.')) {

    this.isLoadingActions = true;
     this.cdr.detectChanges();

    this.jobService.cancelAllJobsClusterWide().pipe(
      tap((response: any) => {
        if (response.success) {
          this.showMessage('Comando de cancelamento enviado para todas as instâncias!', 'success');
        } else {
          this.showMessage(`Erro: ${response.error}`, 'error');
        }
         this.cdr.detectChanges();
      }),
      catchError((error: any) => {
        this.showMessage(`Erro: ${error.message}`, 'error');
        return of(null);
      }),
      finalize(() => {
        this.isLoadingActions = false;
        this.cdr.detectChanges();
      })
    ).subscribe();
  }
}
getStatusTriggerDescription(status: string): string {
    switch (status) {
      case 'WAITING':
        return 'O estado normal e padrão. O trigger está agendado e esperando o seu horário de execução chegar.';
      case 'PAUSED':
        return 'O trigger foi pausado manualmente (via métodos pauseTrigger ou pauseJob). Ele não será executado até ser retomado ("resumed").';
      case 'ACQUIRED':
        return 'Um nó do scheduler já identificou este trigger como the próximo a ser executado e o "pegou" (adquiriu). Ele está prestes a ser disparado.';
      case 'BLOCKED':
        return 'O trigger está bloqueado porque está associado a um Job que é Stateful (ou seja DisallowConcurrentExecution está ativado) e a execução anterior desse job ainda não terminou.';
      case 'COMPLETE':
        return 'O trigger concluiu todas as suas execuções programadas (ex: um trigger simples que rodou todas as 5 vezes definidas) e não disparará novamente.';
      case 'ERROR':
        return 'Ocorreu um erro interno no Quartz ao tentar executar o trigger ou o job associado falhou. Ele não será disparado novamente até que o estado seja corrigido (geralmente vai para WAITING após ser reiniciado ou pelo próprio Scheduler).';
      case 'NONE':
        return 'O trigger não existe na base de dados ou na memória do Scheduler.';
      default:
        return 'Estado desconhecido.';
    }
  }
}
