import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { SlaContrato, SlaContratoVigente } from '@core';

@Injectable({
  providedIn: 'root'
})
export class SlaConfigService {
  private readonly apiUrl = `${environment.ApiBaseUrl}sla-contrato`;

  constructor(private http: HttpClient) {}

  listarTodos(): Observable<SlaContrato[]> {
    return this.http.get<SlaContrato[]>(this.apiUrl);
  }

  listarAtivos(): Observable<SlaContrato[]> {
    return this.http.get<SlaContrato[]>(`${this.apiUrl}/ativos`);
  }

  obterPorId(id: number): Observable<SlaContrato> {
    return this.http.get<SlaContrato>(`${this.apiUrl}/${id}`);
  }

  obterPorNivel(nivel: number): Observable<SlaContrato> {
    return this.http.get<SlaContrato>(`${this.apiUrl}/nivel/${nivel}`);
  }

  obterContratoVigentePorNivel(nivel: number): Observable<SlaContratoVigente> {
    return this.http.get<SlaContratoVigente>(`${this.apiUrl}/nivel/${nivel}/vigente`);
  }

  criar(sla: SlaContrato): Observable<SlaContrato> {
    return this.http.post<SlaContrato>(this.apiUrl, sla);
  }

  atualizar(id: number, sla: SlaContrato): Observable<SlaContrato> {
    return this.http.put<SlaContrato>(`${this.apiUrl}/${id}`, sla);
  }

  excluir(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  desativar(id: number): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}/desativar`, {});
  }

  aplicarConfiguracaoPadrao(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/configuracao-padrao`, {});
  }

  // Método para calcular SLA baseado no contrato
  calcularDataLimite(dataInicio: Date, nivel: number, tipo: 'paliativo' | 'definitivo'): Observable<Date> {
    const params = new HttpParams()
      .set('dataInicio', dataInicio.toISOString())
      .set('nivel', nivel.toString())
      .set('tipo', tipo);

    return this.http.get<Date>(`${environment.ApiBaseUrl}sla/calcular-data-limite`, { params });
  }
}
