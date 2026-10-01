import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { environment } from '@env/environment';
import { AssinaturaUsuario } from '@core';


@Injectable({ providedIn: 'root' })
export class AssinaturaService {

  private apiUrl = `${environment.ApiBaseUrl}assinatura`;

  constructor(private http: HttpClient) {}

  private handleError(error: HttpErrorResponse): Observable<never> {
    const msg = error.error?.erro || error.error?.message || error.message || 'Erro desconhecido';
    return throwError(() => new Error(msg));
  }

  obterMinha(idUsuario = 1): Observable<AssinaturaUsuario> {
    return this.http.get<AssinaturaUsuario>(`${this.apiUrl}/me?idUsuario=${idUsuario}`)
      .pipe(catchError(this.handleError));
  }

  /** Imagem da assinatura com o token (a API exige login: um <img src> direto não manda o token). */
  imagem(idUsuario = 1): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/me/imagem?idUsuario=${idUsuario}`, { responseType: 'blob' });
  }

  salvar(dados: {
    idUsuario: number;
    nomeExibicao: string;
    cargo?: string;
    setor?: string;
    imagem?: File | null;
  }): Observable<AssinaturaUsuario> {
    const formData = new FormData();
    formData.append('idUsuario', dados.idUsuario.toString());
    formData.append('nomeExibicao', dados.nomeExibicao);
    if (dados.cargo) formData.append('cargo', dados.cargo);
    if (dados.setor) formData.append('setor', dados.setor);
    if (dados.imagem) formData.append('imagem', dados.imagem);

    return this.http.post<AssinaturaUsuario>(`${this.apiUrl}/me`, formData)
      .pipe(catchError(this.handleError));
  }

  removerImagem(idUsuario = 1): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/me/imagem?idUsuario=${idUsuario}`)
      .pipe(catchError(this.handleError));
  }
}
