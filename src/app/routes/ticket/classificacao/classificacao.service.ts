import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TicketChamado } from '@core';

export interface AtualizarClassificacaoRequest {
  idSlaContrato: number | null;
  statusHb: string | null;
  observacao: string | null;
}

export interface BuscarClassificacaoParams {
  excluirFinalizados?: boolean;
  statusHb?: string;
  nivelId?: number;
  snMeus?: boolean;
  /** ID do usuário responsável para filtrar tickets de um analista específico */
  responsavelId?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ClassificacaoService {
  // Aponta para /api/tickets — conforme TicketController (@RequestMapping("/api/tickets"))
  private readonly ticketsUrl = `${environment.ApiBaseUrl}tickets`;

  constructor(private http: HttpClient) {}

  /**
   * GET /api/tickets/classificacao
   * Busca tickets para a tela de classificação com filtros opcionais.
   */
  buscarClassificacao(params: BuscarClassificacaoParams = {}): Observable<TicketChamado[]> {
    let httpParams = new HttpParams();

    if (params.excluirFinalizados !== undefined) {
      httpParams = httpParams.set('excluirFinalizados', String(params.excluirFinalizados));
    }
    if (params.statusHb) {
      httpParams = httpParams.set('statusHb', params.statusHb);
    }
    if (params.nivelId !== undefined && params.nivelId !== null) {
      httpParams = httpParams.set('nivelId', String(params.nivelId));
    }
    if (params.snMeus !== undefined) {
      httpParams = httpParams.set('snMeus', String(params.snMeus));
    }
    if (params.responsavelId !== undefined && params.responsavelId !== null) {
      httpParams = httpParams.set('responsavelId', String(params.responsavelId));
    }

    return this.http.get<TicketChamado[]>(
      `${this.ticketsUrl}/classificacao`,
      { params: httpParams }
    );
  }

  /**
   * PUT /api/tickets/{idTicket}/classificacao
   * Atualiza nível SLA, status HB, data/hora status HB e observação de um ticket.
   * Retorna o ticket completo atualizado.
   *
   * IMPORTANTE: o ID é passado já encodado (encodeURIComponent) pelo componente
   * para lidar corretamente com IDs que contêm hífen (ex: 110153-1).
   */
  atualizarClassificacao(
    idTicket: string,
    payload: AtualizarClassificacaoRequest
  ): Observable<TicketChamado> {
    return this.http.put<TicketChamado>(
      `${this.ticketsUrl}/${idTicket}/classificacao`,
      payload
    );
  }
}
