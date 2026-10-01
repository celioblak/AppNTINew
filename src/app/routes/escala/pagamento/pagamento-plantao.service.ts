// =========================================================
// pagamento-plantao.service.ts
// =========================================================
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  DisponiveisResponse,
  EnviadosResponse,
  NaoPagosResponse,
  RemessasResponse,
  EnviarPagamentoRequest,
  EnviarPagamentoResponse,
  MarcarNaoPagoRequest,
  MarcarNaoPagoResponse,
  CriarPlantaoAvulsoRequest,
} from '@core';
import { environment } from '@env/environment';


@Injectable({ providedIn: 'root' })
export class PagamentoPlantaoService {

  private readonly base = `${environment.ApiBaseUrl}pagamento-plantao`;

  constructor(private http: HttpClient) {}

  // ── headers com usuário logado ─────────────────────────
  private headers(): HttpHeaders {
    const userId = localStorage.getItem('userId') ?? '0';
    return new HttpHeaders({ 'X-User-Id': userId });
  }

  // ── GET /disponiveis ───────────────────────────────────
  buscarDisponiveis(
    dataInicio?: string,
    dataFim?: string,
    incluirFuturos = false
  ): Observable<DisponiveisResponse> {
    let params = new HttpParams().set('incluirFuturos', String(incluirFuturos));
    if (dataInicio) params = params.set('dataInicio', dataInicio);
    if (dataFim)    params = params.set('dataFim', dataFim);
    return this.http.get<DisponiveisResponse>(`${this.base}/disponiveis`, { params });
  }

  // ── POST /enviar ───────────────────────────────────────
  enviarParaPagamento(req: EnviarPagamentoRequest): Observable<{ remessa: EnviarPagamentoResponse; mensagem: string }> {
    return this.http.post<{ remessa: EnviarPagamentoResponse; mensagem: string }>(
      `${this.base}/enviar`, req, { headers: this.headers() }
    );
  }

  // ── POST /avulso ────────────────────────────────────────
  criarAvulso(req: CriarPlantaoAvulsoRequest): Observable<{ mensagem: string }> {
    return this.http.post<{ mensagem: string }>(
      `${this.base}/avulso`, req, { headers: this.headers() }
    );
  }

  // ── POST /marcar-nao-pago ──────────────────────────────
  marcarNaoPago(req: MarcarNaoPagoRequest): Observable<MarcarNaoPagoResponse> {
    return this.http.post<MarcarNaoPagoResponse>(
      `${this.base}/marcar-nao-pago`, req, { headers: this.headers() }
    );
  }

  // ── GET /enviados ──────────────────────────────────────
  buscarEnviados(
    numeroRemessa?: number,
    dataInicio?: string,
    dataFim?: string
  ): Observable<EnviadosResponse> {
    let params = new HttpParams();
    if (numeroRemessa) params = params.set('numeroRemessa', String(numeroRemessa));
    if (dataInicio)    params = params.set('dataInicio', dataInicio);
    if (dataFim)       params = params.set('dataFim', dataFim);
    return this.http.get<EnviadosResponse>(`${this.base}/enviados`, { params });
  }

  // ── GET /nao-pagos ─────────────────────────────────────
  buscarNaoPagos(dataInicio?: string, dataFim?: string): Observable<NaoPagosResponse> {
    let params = new HttpParams();
    if (dataInicio) params = params.set('dataInicio', dataInicio);
    if (dataFim)    params = params.set('dataFim', dataFim);
    return this.http.get<NaoPagosResponse>(`${this.base}/nao-pagos`, { params });
  }

  // ── GET /remessas ──────────────────────────────────────
  buscarRemessas(): Observable<RemessasResponse> {
    return this.http.get<RemessasResponse>(`${this.base}/remessas`);
  }

  // ── DELETE /remessas/{numero} ──────────────────────────
  excluirRemessa(numeroRemessa: number): Observable<{ mensagem: string }> {
    return this.http.delete<{ mensagem: string }>(
      `${this.base}/remessas/${numeroRemessa}`,
      { headers: this.headers() }
    );
  }

  // ── POST /reverter-nao-pago ────────────────────────────
  reverterNaoPago(idsPlantoes: number[]): Observable<{ totalRevertidos: number; mensagem: string }> {
    return this.http.post<{ totalRevertidos: number; mensagem: string }>(
      `${this.base}/reverter-nao-pago`,
      idsPlantoes,
      { headers: this.headers() }
    );
  }

  // ── GET /remessas/{numero}/excel ───────────────────────
  downloadExcel(numeroRemessa: number): Observable<Blob> {
    return this.http.get(`${this.base}/remessas/${numeroRemessa}/excel`, {
      responseType: 'blob'
    });
  }
}
