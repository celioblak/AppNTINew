import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { Sprint, TicketSprintDetalhado, Ticket, DashboardSprint, SprintTicket } from '@core';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private readonly apiUrl = `${environment.ApiBaseUrl}sprints`;

  constructor(private http: HttpClient) {}

  // Listar todas as sprints
  listarTodasSprints(): Observable<Sprint[]> {
    return this.http.get<Sprint[]>(this.apiUrl);
  }

  // Listar tickets de uma sprint específica
  listarTicketsSprint(sprintId: number): Observable<SprintTicket[]> {
    return this.http.get<SprintTicket[]>(`${this.apiUrl}/${sprintId}/tickets`);
  }

  // Obter dashboard completo da sprint
  obterDashboardSprint(sprintId: number): Observable<DashboardSprint> {
    return this.http.get<DashboardSprint>(`${this.apiUrl}/${sprintId}/dashboard`);
  }

  // Obter sprint atual
  obterSprintAtual(): Observable<Sprint> {
    return this.http.get<Sprint>(`${this.apiUrl}/atual`);
  }

    getStatusClasse(status: string): string {
        if (!status) return 'desconhecido';

        const statusUpper = (status || '').toUpperCase();
        if (statusUpper === 'ENTREGUE' || statusUpper === 'CONCLUIDO' || statusUpper === 'FECHADO') {
          return 'entregue';
        } else if (statusUpper === 'EM_ANDAMENTO') {
          return 'em_andamento';
        } else if (statusUpper === 'PENDENTE' || statusUpper === 'ABERTO') {
          return 'pendente';
        } else if (statusUpper === 'ATRASADO') {
          return 'atrasado';
        } else if (statusUpper === 'REMOVIDO') {
          return 'removido';
        }
        return 'desconhecido';
      }
}
