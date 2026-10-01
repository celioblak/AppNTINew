import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Ticket, TicketChamado } from '@core';
import { environment } from '@env/environment';

export interface BuscarClassificacaoParams {
  excluirFinalizados?: boolean;
  statusHb?: string;
  nivelId?: number;
}

@Injectable({
  providedIn: 'root'
})
export class TicketService {
  private readonly apiUrl = `${environment.ApiBaseUrl}tickets`;

  constructor(private http: HttpClient) { }

  // Métodos existentes
  getTicketsDisponiveis(): Observable<Ticket[]> {
    return this.http.get<Ticket[]>(`${this.apiUrl}/disponiveis`);
  }

  getTickets(): Observable<Ticket[]> {
    return this.http.get<Ticket[]>(this.apiUrl);
  }

  getTicket(id: number): Observable<Ticket> {
    return this.http.get<Ticket>(`${this.apiUrl}/${id}`);
  }

  criarTicket(ticket: Ticket): Observable<Ticket> {
    return this.http.post<Ticket>(this.apiUrl, ticket);
  }

  atualizarTicket(id: number, ticket: Ticket): Observable<Ticket> {
    return this.http.put<Ticket>(`${this.apiUrl}/${id}`, ticket);
  }

  excluirTicket(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // NOVOS MÉTODOS ADICIONADOS:
  listarTodosTickets(): Observable<Ticket[]> {
    return this.http.get<Ticket[]>(`${this.apiUrl}/todos`);
  }

  listarTicketsForaSprint(): Observable<Ticket[]> {
    return this.http.get<Ticket[]>(`${this.apiUrl}/fora-sprint`);
  }

  buscarClassificacao(params: BuscarClassificacaoParams): Observable<Ticket[]> {
  let httpParams = new HttpParams();

  if (params.excluirFinalizados !== undefined) {
    httpParams = httpParams.set('excluirFinalizados', String(params.excluirFinalizados));
  }
  if (params.statusHb) {
    httpParams = httpParams.set('statusHb', params.statusHb);
  }
  if (params.nivelId !== undefined) {
    httpParams = httpParams.set('nivelId', String(params.nivelId));
  }

  return this.http.get<TicketChamado[]>(
    `${this.apiUrl}/classificacao`,
    { params: httpParams }
  );
}
}
