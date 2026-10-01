import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { informativoMV } from '@core';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class InformativoMvService {
  private readonly apiUrl = `${environment.ApiBaseUrl}informativo`;
  private _headers: HttpHeaders = new HttpHeaders({
    'Content-Type': 'application/json',
  });

  constructor(private http: HttpClient) { }

  carregarInformativo() {
    const url = `${this.apiUrl}/`;
    return this.http.get<any>(url);
  }

  carregarInformativos(
    page: number,
    size: number,
    sort: string,
    order: string,
    descricao?: string,
    dtInicio?: string,
    dtFinal?: string
  ) {
    let params = new HttpParams()
      .set('page', page)
      .set('size', size)
      .set('sort', `${sort},${order}`);

    if (descricao && descricao.trim()) {
      params = params.set('descricao', descricao.trim());
    }
    if (dtInicio) {
      params = params.set('dtInicio', dtInicio);
    }
    if (dtFinal) {
      params = params.set('dtFinal', dtFinal);
    }

    return this.http.get<any>(`${this.apiUrl}/informativoPageable`, { params });
  }

  salvarInformativo(informativo: informativoMV) {
    const url = `${this.apiUrl}/`;
    const payload = this.preparePayload(informativo);
    return this.http.post<informativoMV>(url, payload);
  }

  atualizarInformativo(informativo: informativoMV) {
    const url = `${this.apiUrl}/${informativo.codMensagem}`;
    const payload = this.preparePayload(informativo);
    return this.http.put<informativoMV>(url, payload);
  }

  deletarInformativo(informativo: informativoMV) {
    const url = `${this.apiUrl}/${informativo.codMensagem}`;
    return this.http.delete<informativoMV>(url);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FIX: toISOString() converte para UTC e causa desvio de +3h (UTC-3 Brasil).
  // toLocalISOString mantém o horário exatamente como o usuário escolheu.
  // ─────────────────────────────────────────────────────────────────────────
  // FIX: inclui milissegundos (.000) para corresponder ao @JsonFormat
  // do backend: yyyy-MM-dd'T'HH:mm:ss.SSS
  toLocalISOString(date: Date): string {
    const pad  = (n: number, len = 2) => String(n).padStart(len, '0');
    return (
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
      `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
      `.${pad(date.getMilliseconds(), 3)}`
    );
  }

  private preparePayload(informativo: informativoMV): any {
    const payload = { ...informativo };

    if (payload.dtInicio instanceof Date) {
      payload.dtInicio = this.toLocalISOString(payload.dtInicio);
    }

    if (payload.dtFinal instanceof Date) {
      payload.dtFinal = this.toLocalISOString(payload.dtFinal);
    }

    return payload;
  }
}
