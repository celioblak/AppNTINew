// src/app/services/sla-critico.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { DashboardSlaCritico } from '@core';

@Injectable({
  providedIn: 'root'
})
export class SlaCriticoService {
  private readonly apiUrl = `${environment.ApiBaseUrl}`+'sla-critico';

  constructor(private http: HttpClient) {}

  obterDashboard(): Observable<DashboardSlaCritico> {
    return this.http.get<DashboardSlaCritico>(`${this.apiUrl}/dashboard`);
  }

  registrarPaliativo(idTicket: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/paliativo`, null, {
      params: { idTicket }
    });
  }

  atualizarStatus(): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/atualizar-status`, {});
  }
}
