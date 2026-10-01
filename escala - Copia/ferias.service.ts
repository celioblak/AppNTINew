import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FeriasFuncionario } from '@core';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class FeriasService {

  private apiUrl = `${environment.ApiBaseUrl}ferias`;

  constructor(private http: HttpClient) {}

  getFeriasPorPeriodo(ano: number, mes: number): Observable<FeriasFuncionario[]> {
    return this.http.get<FeriasFuncionario[]>(`${this.apiUrl}/periodo`, {
      params: {
        ano: ano.toString(),
        mes: mes.toString()
      }
    });
  }

  getFeriasUsuario(idUsuario: number, ano: number, mes: number): Observable<FeriasFuncionario[]> {
    return this.http.get<FeriasFuncionario[]>(`${this.apiUrl}/usuario/${idUsuario}`, {
      params: {
        ano: ano.toString(),
        mes: mes.toString()
      }
    });
  }

  verificarFeriasUsuario(idUsuario: number, data: string): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/usuario/${idUsuario}/verificar`, {
      params: { data }
    });
  }

  salvarFerias(ferias: FeriasFuncionario): Observable<FeriasFuncionario> {
    return ferias.id
      ? this.http.put<FeriasFuncionario>(`${this.apiUrl}/${ferias.id}`, ferias)
      : this.http.post<FeriasFuncionario>(this.apiUrl, ferias);
  }

  excluirFerias(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
