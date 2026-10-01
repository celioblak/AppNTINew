import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TipoAusencia } from '@core';

@Injectable({
  providedIn: 'root'
})
export class TipoAusenciaService {
  private apiUrl = `${environment.ApiBaseUrl}tipoausencia`;

  constructor(private http: HttpClient) {}

  getTiposAusencia(): Observable<TipoAusencia[]> {
    return this.http.get<TipoAusencia[]>(`${this.apiUrl}/ativo`);
  }

  getTipoAusenciaById(id: number): Observable<TipoAusencia> {
    return this.http.get<TipoAusencia>(`${this.apiUrl}/${id}`);
  }

  createTipoAusencia(tipo: Partial<TipoAusencia>): Observable<TipoAusencia> {
    return this.http.post<TipoAusencia>(this.apiUrl, tipo);
  }

  updateTipoAusencia(id: number, tipo: Partial<TipoAusencia>): Observable<TipoAusencia> {
    return this.http.put<TipoAusencia>(`${this.apiUrl}/${id}`, tipo);
  }

  deleteTipoAusencia(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
