import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '@env/environment';


export interface Feriado {
  id: number;
  data: string; // YYYY-MM-DD
  nome: string;
  tipo: 'NACIONAL' | 'ESTADUAL' | 'MUNICIPAL';
  descricao?: string;
  ano: number;
}

@Injectable({
  providedIn: 'root'
})
export class FeriadoService {
  private apiUrl = `${environment.ApiBaseUrl}feriado`;

  constructor(private http: HttpClient) {}

  getFeriados(ano: number, mes?: number): Observable<Feriado[]> {
    let url = `${this.apiUrl}?ano=${ano}`;
    if (mes) {
      url += `&mes=${mes}`;
    }
    return this.http.get<Feriado[]>(url);
  }

  // MÉTODO CORRIGIDO - Agora retorna Observable<number[]>
  getFeriadosPorMes(ano: number, mes: number): Observable<number[]> {
    return this.getFeriados(ano, mes).pipe(
      map((feriados: Feriado[]) => {
        const dias = feriados.map(feriado => {
          const data = new Date(feriado.data);
          return data.getDate();
        });
        return dias;
      })
    );
  }

  getFeriadoById(id: number): Observable<Feriado> {
    return this.http.get<Feriado>(`${this.apiUrl}/${id}`);
  }

  createFeriado(feriado: Partial<Feriado>): Observable<Feriado> {
    return this.http.post<Feriado>(this.apiUrl, feriado);
  }

  updateFeriado(id: number, feriado: Partial<Feriado>): Observable<Feriado> {
    return this.http.put<Feriado>(`${this.apiUrl}/${id}`, feriado);
  }

  deleteFeriado(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // Método alternativo que retorna apenas os dias
  getDiasFeriados(ano: number, mes: number): Observable<number[]> {
    return this.getFeriadosPorMes(ano, mes);
  }
}
