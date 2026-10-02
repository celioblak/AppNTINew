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

/** Nó do cluster pelo sinal de vida do Quartz. */
export interface NoAgendador {
  instancia: string;
  ultimoSinal: string;
  intervaloMs: number;
  segundosSemSinal: number;
  ativo: boolean;
  esteNo: boolean;
}

/** Execução em andamento em algum nó (QRTZ_FIRED_TRIGGERS + registro do vigia). */
export interface ExecucaoAgendador {
  entryId: string;
  jobName: string;
  jobGroup: string;
  descricao: string | null;
  instancia: string;
  inicio: string;
  segundos: number;
  limiteMinutos: number;
  travada: boolean;
  estadoQuartz: string;
  estadoThread: string | null;
  local: string | null;
  causa: string | null;
  pilha: string | null;
  interrupcaoPedida: boolean;
  interromperPor: string | null;
  interrompidoEm: string | null;
  resultado: string | null;
}

/** Problema com causa e correção; automatico = o vigia corrige sozinho. */
export interface ProblemaAgendador {
  codigo: string;
  severidade: 'ERRO' | 'AVISO';
  titulo: string;
  causa: string;
  correcao: string;
  automatico: boolean;
  acao: 'REPARAR' | 'RETIRAR_PAUSA_GERAL' | 'LIMPAR_ORFAOS' | null;
}

export interface TravamentoAgendador {
  entryId: string;
  jobName: string;
  jobGroup: string;
  instancia: string;
  inicio: string;
  deteccao: string;
  fim: string;
  limiteMinutos: number | null;
  local: string | null;
  causa: string | null;
  pilha: string | null;
  interromperPor: string | null;
  resultado: string | null;
}

export interface PoolAgendador {
  ativas: number;
  ociosas: number;
  aguardando: number;
  maximo: number;
}

/** Capacidade do nó que respondeu (threads do Quartz e pools de conexão). */
export interface CapacidadeAgendador {
  no: string;
  threadsEmUso: number;
  threadsAbandonadas: number;
  threadsTotal: number;
  poolAplicacao: PoolAgendador | null;
  poolAgendador: PoolAgendador | null;
}

export interface EstadoAgendador {
  noAtual: string;
  agora: string;
  vigiaInstalado: boolean;
  nos: NoAgendador[];
  execucoes: ExecucaoAgendador[];
  problemas: ProblemaAgendador[];
  historico: TravamentoAgendador[];
  capacidade: CapacidadeAgendador;
}

export interface ResultadoAgendador {
  feito: string[];
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

  // ---------------------------------------------------------------- gerenciamento avançado

  getSchedulerMetaData(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/metaData`).pipe(
      catchError(this.handleError('getSchedulerMetaData', null))
    );
  }

  getSchedulerHealth(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/health`).pipe(
      catchError(this.handleError('getSchedulerHealth', null))
    );
  }

  /** Pausa job a job (sem a "pausa geral" do Quartz, que fazia jobs novos nascerem pausados). */
  cancelAllJobs(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/cancel-all`, {}).pipe(
      catchError(this.handleError('cancelAllJobs', null))
    );
  }

  // ---------------------------------------------------------------- agendador no cluster (vigia)

  /** Nós, execuções em andamento, problemas (o que o vigia corrige sozinho) e histórico de travamentos. */
  estadoAgendador() {
    return this.http.get<EstadoAgendador>(`${this.apiUrl}/cluster/estado`);
  }

  /** Faz agora o que o vigia faria na próxima verificação. */
  corrigirAgora() {
    return this.http.post<ResultadoAgendador>(`${this.apiUrl}/cluster/reparar`, {});
  }

  retirarPausaGeral() {
    return this.http.post<ResultadoAgendador>(`${this.apiUrl}/cluster/retirar-pausa-geral`, {});
  }

  limparOrfaos() {
    return this.http.post<ResultadoAgendador>(`${this.apiUrl}/cluster/limpar-orfaos`, {});
  }

  interromperExecucao(entryId: string) {
    return this.http.post<ResultadoAgendador>(`${this.apiUrl}/cluster/execucoes/${encodeURIComponent(entryId)}/interromper`, {});
  }

  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(`${operation} falhou:`, error);
      return throwError(() => new Error(`${operation} falhou: ${error.message || error}`));
    };
  }
}
