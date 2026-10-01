import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface SugestaoTicketSprint {
  id?: number;
  ticketId: string;
  titulo?: string;
  descricao?: string;
  responsavel?: string;
  prioridade?: string;
  sugeridoPor?: number;
  sugeridoPorNome?: string;
  sugeridoEm?: string;
  justificativa?: string;
  snAtendido?: boolean;   // false=pendente, true=já incluído em sprint
  idSprint?: number;      // sprint que atendeu esta sugestão
  atendidoEm?: string;
}

export interface CriarSugestaoRequest {
  ticketId: string;
  justificativa?: string;
}

@Injectable({ providedIn: 'root' })
export class SugestaoSprintService {

  private apiUrl = `${environment.ApiBaseUrl}sprint/sugestao`;

  constructor(private http: HttpClient) {}

  /** Lista apenas sugestões PENDENTES (snAtendido = false) */
  listarSugestoes(): Observable<SugestaoTicketSprint[]> {
    return this.http.get<SugestaoTicketSprint[]>(this.apiUrl);
  }

  /** Lista TODAS as sugestões para consulta de histórico */
  listarHistorico(): Observable<SugestaoTicketSprint[]> {
    return this.http.get<SugestaoTicketSprint[]>(`${this.apiUrl}/historico`);
  }

  /** Cria nova sugestão — permitido mesmo se o ticket já foi atendido antes */
  adicionarSugestao(request: CriarSugestaoRequest): Observable<SugestaoTicketSprint> {
    return this.http.post<SugestaoTicketSprint>(this.apiUrl, request);
  }

  /**
   * Marca sugestão como ATENDIDA e vincula à sprint.
   * Chamado ao clicar "Incluir" no painel — remove da listagem de pendentes.
   */
  atenderSugestao(idSugestao: number, idSprint: number): Observable<SugestaoTicketSprint> {
    return this.http.put<SugestaoTicketSprint>(
      `${this.apiUrl}/${idSugestao}/atender`,
      null,
      { params: { idSprint: idSprint.toString() } }
    );
  }

  /**
   * Reverte o atendimento — ticket removido da sprint volta para a lista de sugestões.
   * Chamado quando o ticket é removido de uma sprint existente.
   */
  reverterAtendimento(idSugestao: number): Observable<SugestaoTicketSprint> {
    return this.http.put<SugestaoTicketSprint>(
      `${this.apiUrl}/${idSugestao}/reverter`,
      null
    );
  }

  /**
   * Marca múltiplas sugestões como atendidas em uma única requisição.
   * Usar sempre que várias sugestões forem incluídas na mesma sprint.
   */
  atenderSugestaoLote(idsSugestao: number[], idSprint: number): Observable<void> {
    return this.http.put<void>(
      `${this.apiUrl}/atender-lote`,
      { idSprint, idsSugestao }
    );
  }

  removerSugestao(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
