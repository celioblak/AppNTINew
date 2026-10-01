import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TipoPlantao } from '@core';

@Injectable({
  providedIn: 'root'
})
export class TipoPlantaoService {
  private apiUrl = `${environment.ApiBaseUrl}tipoplantao`;

  constructor(private http: HttpClient) {}

  getTiposPlantao(): Observable<TipoPlantao[]> {
    return this.http.get<TipoPlantao[]>(`${this.apiUrl}/ativo`);
  }

  // REMOVIDO: getTiposPlantaoAtivos() pois TipoPlantao não tem propriedade 'ativo'
  // Usar getTiposPlantao() diretamente

  getTipoPlantaoById(id: number): Observable<TipoPlantao> {
    return this.http.get<TipoPlantao>(`${this.apiUrl}/${id}`);
  }

  createTipoPlantao(tipo: Partial<TipoPlantao>): Observable<TipoPlantao> {
    return this.http.post<TipoPlantao>(this.apiUrl, tipo);
  }

  updateTipoPlantao(id: number, tipo: Partial<TipoPlantao>): Observable<TipoPlantao> {
    return this.http.put<TipoPlantao>(`${this.apiUrl}/${id}`, tipo);
  }

  deleteTipoPlantao(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
