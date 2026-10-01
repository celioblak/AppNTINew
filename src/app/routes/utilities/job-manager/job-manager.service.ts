import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { schedulerJobInfo, schedulerJobInfoDetail } from '@core';
import { environment } from '@env/environment';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

export interface JobClasse {
  classe: string;
  nome: string;
  descricao: string | null;
  cronSugerido: string | null;
  /** false = criado por outra tela (ex.: agendamento de script) ou exemplo; `motivo` explica. */
  cadastravel: boolean;
  motivo: string | null;
}

export interface CronValidacao {
  valida: boolean;
  mensagem: string | null;
  proximas: string[];
}

export interface JobEdicao {
  jobName: string;
  jobGroup: string;
  jobClass: string;
  cronExpression: string;
  descricao: string | null;
  iniciarPausado: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class JobManagerService {

  private readonly apiUrl = `${environment.ApiBaseUrl}job`;

  private _headers: HttpHeaders = new HttpHeaders({
    'Content-Type': 'application/json',
  });

  constructor(private http: HttpClient) { }

  // ---------------------------------------------------------------- cadastro e edição

  /** Classes de job disponíveis, com descrição e cron sugerido. */
  classes() {
    return this.http.get<JobClasse[]>(`${this.apiUrl}/classes`);
  }

  /** Valida o cron no backend (regras do Quartz) e traz as próximas execuções. */
  validarCron(cron: string) {
    return this.http.post<CronValidacao>(`${this.apiUrl}/cron/validar`, { cron });
  }

  criar(dados: JobEdicao) {
    return this.http.post<schedulerJobInfo>(`${this.apiUrl}/cadastro`, dados);
  }

  editar(jobId: number, dados: JobEdicao) {
    return this.http.put<schedulerJobInfo>(`${this.apiUrl}/cadastro/${jobId}`, dados);
  }

  carregarJob(): Observable<any> {
    const url = `${this.apiUrl}/getAllJobsInfo`;
    return this.http.get<any>(url).pipe(
      catchError(this.handleError('carregarJob', []))
    );
  }

  salvarJob(job: schedulerJobInfo): Observable<schedulerJobInfo> {
    const url = `${this.apiUrl}/saveOrUpdate`;
    return this.http.post<schedulerJobInfo>(url, job).pipe(
      catchError(this.handleError('salvarJob', job))
    );
  }

  resumeJob(job: schedulerJobInfo): Observable<any> {
    const url = `${this.apiUrl}/resume`;
    return this.http.post<any>(url, job).pipe(
      catchError(this.handleError('resumeJob', null))
    );
  }

  pauseJob(job: schedulerJobInfo): Observable<any> {
    const url = `${this.apiUrl}/pause`;
    return this.http.post<any>(url, job).pipe(
      catchError(this.handleError('pauseJob', null))
    );
  }

  // ATENÇÃO: Este método NÃO EXISTE no controller atualizado
  // Vamos comentá-lo ou remover, pois não há endpoint /restart individual
  /*
  restartJob(job: schedulerJobInfo): Observable<any> {
    const url = `${this.apiUrl}/restart`;
    return this.http.post<any>(url, job).pipe(
      catchError(this.handleError('restartJob', null))
    );
  }
  */

  removeJob(job: schedulerJobInfo): Observable<any> {
    const url = `${this.apiUrl}/remove`;
    return this.http.post<any>(url, job).pipe(
      catchError(this.handleError('removeJob', null))
    );
  }

  // MÉTODO CORRIGIDO: Use recreateSingleJob para job individual
  recreateSingleJob(job: schedulerJobInfo): Observable<any> {
    const url = `${this.apiUrl}/recreate-single`;
    return this.http.post<any>(url, job).pipe(
      catchError(this.handleError('recreateSingleJob', null))
    );
  }

  runJob(job: schedulerJobInfo): Observable<any> {
    const url = `${this.apiUrl}/run`;
    return this.http.post<any>(url, job).pipe(
      catchError(this.handleError('runJob', null))
    );
  }

  deletarJob(job: schedulerJobInfo): Observable<any> {
    const url = `${this.apiUrl}/delete`;
    return this.http.post<any>(url, job).pipe(
      catchError(this.handleError('deletarJob', null))
    );
  }

  // Métodos de gerenciamento avançado
  getSchedulerMetaData(): Observable<any> {
    const url = `${this.apiUrl}/metaData`;
    return this.http.get<any>(url).pipe(
      catchError(this.handleError('getSchedulerMetaData', null))
    );
  }

  getAllJobs(): Observable<any> {
    const url = `${this.apiUrl}/getAllJobs`;
    return this.http.get<any>(url).pipe(
      catchError(this.handleError('getAllJobs', []))
    );
  }

  // MÉTODO ATUALIZADO: Agora é POST para /cancel-all
  cancelAllJobs(): Observable<any> {
    const url = `${this.apiUrl}/cancel-all`;
    return this.http.post<any>(url, {}).pipe(
      catchError(this.handleError('cancelAllJobs', null))
    );
  }

  // MÉTODO ATUALIZADO: Agora é POST para /recreate-all
  recreateAllJobs(): Observable<any> {
    const url = `${this.apiUrl}/recreate-all`;
    return this.http.post<any>(url, {}).pipe(
      catchError(this.handleError('recreateAllJobs', null))
    );
  }

  // MÉTODO OBSOLETO: Remover ou manter compatibilidade
  // ATENÇÃO: Este método usa GET para /recreate (obsoleto)
  schedulerRecreate(): Observable<any> {
    const url = `${this.apiUrl}/recreate`;
    return this.http.get<any>(url).pipe(
      catchError(this.handleError('schedulerRecreate', null))
    );
  }

  getSchedulerHealth(): Observable<any> {
    const url = `${this.apiUrl}/health`;
    return this.http.get<any>(url).pipe(
      catchError(this.handleError('getSchedulerHealth', null))
    );
  }

  getDiagnostic(): Observable<any> {
    const url = `${this.apiUrl}/diagnostic`;
    return this.http.get<any>(url).pipe(
      catchError(this.handleError('getDiagnostic', null))
    );
  }

  restartScheduler(): Observable<any> {
    const url = `${this.apiUrl}/restart-scheduler`;
    return this.http.post<any>(url, {}).pipe(
      catchError(this.handleError('restartScheduler', null))
    );
  }

  cleanupJobs(): Observable<any> {
    const url = `${this.apiUrl}/cleanup`;
    return this.http.post<any>(url, {}).pipe(
      catchError(this.handleError('cleanupJobs', null))
    );
  }

  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(`${operation} falhou:`, error);
      return throwError(() => new Error(`${operation} falhou: ${error.message || error}`));
    };
  }

    // MÉTODOS DE CLUSTER - Afetam TODAS as instâncias
  restartAllInstances(): Observable<any> {
    const url = `${this.apiUrl}/cluster/restart-all`;
    return this.http.post<any>(url, {}).pipe(
      catchError(this.handleError('restartAllInstances', null))
    );
  }

  recreateAllJobsClusterWide(): Observable<any> {
    const url = `${this.apiUrl}/cluster/recreate-all`;
    return this.http.post<any>(url, {}).pipe(
      catchError(this.handleError('recreateAllJobsClusterWide', null))
    );
  }

  cleanupAllInstances(): Observable<any> {
    const url = `${this.apiUrl}/cluster/cleanup-all`;
    return this.http.post<any>(url, {}).pipe(
      catchError(this.handleError('cleanupAllInstances', null))
    );
  }

  cancelAllJobsClusterWide(): Observable<any> {
    const url = `${this.apiUrl}/cluster/cancel-all`;
    return this.http.post<any>(url, {}).pipe(
      catchError(this.handleError('cancelAllJobsClusterWide', null))
    );
  }

  getClusterInstances(): Observable<any> {
    const url = `${this.apiUrl}/cluster/instances`;
    return this.http.get<any>(url).pipe(
      catchError(this.handleError('getClusterInstances', null))
    );
  }

  syncAllInstances(): Observable<any> {
    const url = `${this.apiUrl}/cluster/sync-all`;
    return this.http.post<any>(url, {}).pipe(
      catchError(this.handleError('syncAllInstances', null))
    );
  }
}
