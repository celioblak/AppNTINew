import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import {
  ScriptAgendamento,
  ScriptAgendamentoCreate,
  AgendamentoExecucao,
  UltimaExecucaoAgendamento
} from '@core';

@Injectable({
  providedIn: 'root'
})
export class ScriptAgendamentoService {

  private readonly apiUrl = `${environment.ApiBaseUrl}` + 'scriptAgendamento';

  constructor(private http: HttpClient) { }

  carregarAgendamentos() {
    let url: string = this.apiUrl;
    url = url + '/';
    return this.http.get<ScriptAgendamento[]>(`${url}`);
  }

  buscarAgendamento(codAgendamento: number) {
    let url: string = this.apiUrl;
    url = url + '/' + codAgendamento;
    return this.http.get<ScriptAgendamento>(`${url}`);
  }

  salvarAgendamento(dto: ScriptAgendamentoCreate) {
    let url: string = this.apiUrl;
    url = url + '/';
    return this.http.post<ScriptAgendamento>(`${url}`, dto);
  }

  atualizarAgendamento(codAgendamento: number, dto: ScriptAgendamentoCreate) {
    let url: string = this.apiUrl;
    url = url + '/' + codAgendamento;
    return this.http.put<ScriptAgendamento>(`${url}`, dto);
  }

  ativarAgendamento(codAgendamento: number) {
    let url: string = this.apiUrl;
    url = url + '/' + codAgendamento + '/ativar';
    return this.http.put<any>(`${url}`, {});
  }

  desativarAgendamento(codAgendamento: number) {
    let url: string = this.apiUrl;
    url = url + '/' + codAgendamento + '/desativar';
    return this.http.put<any>(`${url}`, {});
  }

  executarAgora(codAgendamento: number) {
    let url: string = this.apiUrl;
    url = url + '/' + codAgendamento + '/executarAgora';
    return this.http.post<any>(`${url}`, {});
  }

  deletarAgendamento(codAgendamento: number) {
    let url: string = this.apiUrl;
    url = url + '/' + codAgendamento;
    return this.http.delete<any>(`${url}`);
  }

  carregarHistorico(codAgendamento: number) {
    let url: string = this.apiUrl;
    url = url + '/' + codAgendamento + '/execucoes';
    return this.http.get<AgendamentoExecucao[]>(`${url}`);
  }

  /** Última execução de CADA agendamento — tela de acompanhamento geral. */
  carregarUltimasExecucoes() {
    return this.http.get<UltimaExecucaoAgendamento[]>(`${this.apiUrl}/ultimasExecucoes`);
  }

  /** Exclui UMA execução do histórico (mantém o agendamento e as demais execuções). */
  excluirExecucao(codExecucao: number) {
    return this.http.delete<void>(`${this.apiUrl}/execucoes/${codExecucao}`);
  }

  /** Limpa TODO o histórico de execuções de um agendamento (mantém o agendamento). */
  excluirHistorico(codAgendamento: number) {
    return this.http.delete<void>(`${this.apiUrl}/${codAgendamento}/execucoes`);
  }

  /** Baixa o zip de uma execução. Resposta completa (observe: 'response') para
   * ler o header X-Arquivo-Regerado e o Content-Disposition. */
  baixarArquivoExecucao(codExecucao: number) {
    const url = `${this.apiUrl}/execucoes/${codExecucao}/download`;
    return this.http.get(url, { responseType: 'blob', observe: 'response' });
  }

}
