import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CriarSprintRequest,
  RegistrarAnaliseEntrega,
  Sprint,
  SprintTicket,
  TicketAnaliseEntrega,
  TicketSprintDTO,
} from '@core';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class SprintService {
  private readonly apiUrl = `${environment.ApiBaseUrl}sprints`;

  constructor(private http: HttpClient) {}

  // ============ CRUD DE SPRINT ============

  /**
   * Cria uma nova sprint, opcionalmente com tickets.
   * POST /api/sprints
   */
  criarSprint(dto: CriarSprintRequest): Observable<Sprint> {
    return this.http.post<Sprint>(this.apiUrl, dto);
  }

  /**
   * Lista todas as sprints.
   * GET /api/sprints
   */
  getSprints(): Observable<Sprint[]> {
    return this.http.get<Sprint[]>(this.apiUrl);
  }

  /**
   * Busca uma sprint por ID.
   * GET /api/sprints/{id}
   */
  getSprint(id: number): Observable<Sprint> {
    return this.http.get<Sprint>(`${this.apiUrl}/${id}`);
  }

  /**
   * Atualiza apenas os dados básicos da sprint (nome, objetivo, datas).
   * PUT /api/sprints/{id}
   */
  atualizarSprint(id: number, sprint: Partial<Sprint>): Observable<Sprint> {
    return this.http.put<Sprint>(`${this.apiUrl}/${id}`, sprint);
  }

  /**
   * Exclui uma sprint (somente se não tiver tickets).
   * DELETE /api/sprints/{id}
   */
  excluirSprint(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // ============ GERENCIAMENTO DE TICKETS NA SPRINT ============

  /**
   * Adiciona um ticket à sprint.
   * POST /api/sprints/{sprintId}/tickets
   */
  adicionarTicketASprint(
    sprintId: number,
    ticketId: string,
    criticidade: number
  ): Observable<SprintTicket> {
    const payload = { ticketId, criticidade };
    return this.http.post<SprintTicket>(
      `${this.apiUrl}/${sprintId}/tickets`,
      payload
    );
  }

  atualizarTicketASprint(
    sprintId: number,
    ticketId: string,
    criticidade: number
  ): Observable<SprintTicket> {
    const payload = { ticketId, criticidade };
    return this.http.put<SprintTicket>(
      `${this.apiUrl}/${sprintId}/tickets`,
      payload
    );
  }

  /**
   * Remove um ticket da sprint.
   * DELETE /api/sprints/{sprintId}/tickets/{ticketId}
   */
  removerTicketDaSprint(sprintId: number, ticketId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/${sprintId}/tickets/${ticketId}`
    );
  }

  /**
   * Atualiza o status de entrega de um ticket específico.
   * PUT /api/sprints/tickets/{sprintTicketId}/status
   */
  atualizarStatusTicket(
    sprintId: number,
    ticketId: string,
    status: string | null,
    criticidade?: number | null,
    dataEntregaReal?: string | null,
    observacao?: string | null
  ): Observable<SprintTicket> {
    const payload = { ticketId, status, criticidade, dataEntregaReal, observacao };
    return this.http.put<SprintTicket>(
      `${this.apiUrl}/tickets/${sprintId}/status`,
      payload
    );
  }

  /**
   * Lista todos os tickets de uma sprint (com JOIN FETCH do ticket).
   * GET /api/sprints/{sprintId}/tickets
   */
  listarTicketsDaSprint(sprintId: number): Observable<SprintTicket[]> {
    return this.http.get<SprintTicket[]>(`${this.apiUrl}/${sprintId}/tickets`);
  }

  // ============ DASHBOARD E MÉTRICAS ============

  /**
   * Obtém dashboard da sprint.
   * GET /api/sprints/{sprintId}/dashboard
   */
  obterDashboardSprint(sprintId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${sprintId}/dashboard`);
  }

  /**
   * Finaliza (fecha) a sprint.
   * PUT /api/sprints/{sprintId}/fechar
   */
  finalizarSprint(sprintId: number): Observable<Sprint> {
    return this.http.put<Sprint>(`${this.apiUrl}/${sprintId}/fechar`, {});
  }

  /**
   * Reabre uma sprint finalizada.
   * PUT /api/sprints/{sprintId}/reabrir
   */

  fecharSprint(sprintId: number): Observable<Sprint> {
    return this.http.put<Sprint>(`${this.apiUrl}/${sprintId}/fechar`, {});
  }
  reabrirSprint(sprintId: number): Observable<Sprint> {
    return this.http.put<Sprint>(`${this.apiUrl}/${sprintId}/reabrir`, {});
  }

  /**
   * Calcula o progresso atual da sprint.
   * GET /api/sprints/{sprintId}/progresso
   */
  calcularProgressoSprint(sprintId: number): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/${sprintId}/progresso`);
  }

  /**
   * Obtém métricas detalhadas da sprint.
   * GET /api/sprints/{sprintId}/metricas
   */
  obterMetricasSprint(sprintId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${sprintId}/metricas`);
  }

  /**
   * Verifica disponibilidade de um ticket (se pode ser adicionado a sprint).
   * GET /api/sprints/tickets/{ticketId}/disponibilidade
   */
  verificarDisponibilidadeTicket(ticketId: string): Observable<boolean> {
    return this.http.get<boolean>(
      `${this.apiUrl}/tickets/${ticketId}/disponibilidade`
    );
  }

  /**
   * Obtém resumo completo da sprint.
   * GET /api/sprints/{sprintId}/resumo
   */
  obterResumoSprint(sprintId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${sprintId}/resumo`);
  }

  /**
   * Sincroniza manualmente os contadores da sprint.
   * PUT /api/sprints/{sprintId}/sincronizar-contadores
   */
  sincronizarContadoresSprint(sprintId: number): Observable<Sprint> {
    return this.http.put<Sprint>(
      `${this.apiUrl}/${sprintId}/sincronizar-contadores`,
      {}
    );
  }

  // ============ ANÁLISE DE ENTREGA (APÓS O FIM DA SPRINT) ============

  /**
   * Tickets do usuário logado em sprints encerradas que ainda aguardam análise de entrega.
   * GET /api/sprints/analise-entrega/meus-tickets
   */
  listarMinhasAnalisesEntrega(): Observable<TicketAnaliseEntrega[]> {
    return this.http.get<TicketAnaliseEntrega[]>(`${this.apiUrl}/analise-entrega/meus-tickets`);
  }

  /**
   * Registra ENTREGUE/NAO_ENTREGUE e devolve o que ainda falta analisar.
   * PUT /api/sprints/analise-entrega/meus-tickets
   */
  registrarMinhasAnalisesEntrega(analises: RegistrarAnaliseEntrega[]): Observable<TicketAnaliseEntrega[]> {
    return this.http.put<TicketAnaliseEntrega[]>(`${this.apiUrl}/analise-entrega/meus-tickets`, analises);
  }

  // ============ MÉTODOS LEGADOS / COMPATIBILIDADE ============

  /**
   * @deprecated Use listarTicketsDaSprint() + lógica própria.
   * Atualiza status de vários tickets de uma vez (se o backend suportar).
   */
  atualizarStatusTickets(sprintId: number, tickets: any[]): Observable<any> {
    return this.http.put(`${this.apiUrl}/${sprintId}/tickets/status`, tickets);
  }

  /**
   * @deprecated Use getSprints() com filtro manual ou endpoint específico.
   * Lista sprints ativas.
   */
  listarSprintsAtivas(): Observable<Sprint[]> {
    return this.http.get<Sprint[]>(`${this.apiUrl}/ativas`);
  }

  /**
   * @deprecated Use obterDashboardSprint() passando o ID da sprint atual.
   * Obtém dashboard da sprint atual.
   */
  obterDashboardAtual(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/dashboard/atual`);
  }

  relatorio(sprintId: number): Observable<Blob> {
  return this.http.get(`${this.apiUrl}/${sprintId}/relatorio-jasper`, {
    responseType: 'blob' as const,     // 'as const' ajuda bastante
    observe: 'body' as const           // opcional, mas reforça que queremos o body
  }) as Observable<Blob>;
}

}
