import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '@env/environment';
import { Contrato, Setor } from '@core';
import { limparCnpj } from '@shared/utils/cnpj';

@Injectable({ providedIn: 'root' })
export class ContratoService {

  private apiUrl = `${environment.ApiBaseUrl}contrato`;

  constructor(private http: HttpClient) {}

  private handleError(error: HttpErrorResponse): Observable<never> {
    const msg = error.error?.erro || error.error?.message || error.message || 'Erro desconhecido';
    return throwError(() => new Error(msg));
  }

  listar(apenasAtivos = false): Observable<Contrato[]> {
    const params = apenasAtivos ? '?ativo=true' : '';
    return this.http.get<Contrato[]>(`${this.apiUrl}${params}`)
      .pipe(catchError(this.handleError));
  }

  /**
   * Lista apenas contratos ativos cujo CNPJ coincide com o da NF-e.
   * Usado na aba Contratos do dialog de detalhes da nota.
   * Backend: GET /api/contrato?cnpj=XX
   */
  listarPorCnpj(cnpj: string): Observable<Contrato[]> {
    const cnpjLimpo = limparCnpj(cnpj); // CNPJ pode ser alfanumérico
    return this.http.get<Contrato[]>(`${this.apiUrl}?cnpj=${encodeURIComponent(cnpjLimpo)}`)
      .pipe(catchError(this.handleError));
  }

  pesquisar(termo: string): Observable<Contrato[]> {
    return this.http.get<Contrato[]>(`${this.apiUrl}?q=${encodeURIComponent(termo)}`)
      .pipe(catchError(this.handleError));
  }

  buscarPorId(id: number): Observable<Contrato> {
    return this.http.get<Contrato>(`${this.apiUrl}/${id}`)
      .pipe(catchError(this.handleError));
  }

  criar(contrato: Contrato, idUsuario = 1): Observable<Contrato> {
    return this.http.post<Contrato>(`${this.apiUrl}?idUsuario=${idUsuario}`, contrato)
      .pipe(catchError(this.handleError));
  }

  atualizar(id: number, contrato: Contrato): Observable<Contrato> {
    return this.http.put<Contrato>(`${this.apiUrl}/${id}`, contrato)
      .pipe(catchError(this.handleError));
  }

  alternarAtivo(id: number): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/alternar-ativo`, {})
      .pipe(catchError(this.handleError));
  }

  remover(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`)
      .pipe(catchError(this.handleError));
  }

  listarSetores(termo?: string): Observable<Setor[]> {
    const q = termo ? `?q=${encodeURIComponent(termo)}` : '';
    return this.http.get<Setor[]>(`${this.apiUrl}/setores${q}`)
      .pipe(catchError(this.handleError));
  }
}
