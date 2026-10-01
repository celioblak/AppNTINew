import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '@env/environment';
import { PreferenciaFolga } from '@core';

@Injectable({
  providedIn: 'root'
})
export class PreferenciaFolgaService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.ApiBaseUrl}preferencia-folga`;

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('Erro no PreferenciaFolgaService:', error);

    let errorMessage = 'Erro desconhecido ao processar a requisição';

    if (error.error && error.error.erro) {
      errorMessage = error.error.erro;
    } else if (error.error && error.error.message) {
      errorMessage = error.error.message;
    } else if (typeof error.error === 'string') {
      errorMessage = error.error;
    } else {
      errorMessage = error.message || `Erro ${error.status}: ${error.statusText}`;
    }

    const customError = new Error(errorMessage);
    (customError as any).status = error.status;
    (customError as any).originalError = error;

    return throwError(() => customError);
  }

  // ✅ CORRIGIDO: Obter preferências por mês (GET /mes/{ano}/{mes})
  getPreferenciasPorMes(ano: number, mes: number): Observable<PreferenciaFolga[]> {
    return this.http.get<PreferenciaFolga[]>(`${this.apiUrl}/mes/${ano}/${mes}`)
      .pipe(catchError(this.handleError));
  }

  // ✅ CORRIGIDO: Obter dias de preferência de um usuário (GET /usuario/{idUsuario}/mes/{ano}/{mes})
  getDiasPreferenciaUsuario(idUsuario: number, ano: number, mes: number): Observable<number[]> {
    return this.http.get<number[]>(`${this.apiUrl}/usuario/${idUsuario}/mes/${ano}/${mes}`)
      .pipe(catchError(this.handleError));
  }

  // ✅ CORRIGIDO: Verificar se usuário pode cadastrar preferência (GET /usuario/{idUsuario}/verificar?data=YYYY-MM-DD)
  verificarPodeCadastrar(idUsuario: number, data: string): Observable<boolean> {
    const params = new HttpParams().set('data', data);
    return this.http.get<boolean>(`${this.apiUrl}/usuario/${idUsuario}/verificar`, { params })
      .pipe(catchError(this.handleError));
  }

  // ✅ CORRIGIDO: Cadastrar preferência (POST /cadastrar?idUsuario=X&dataFolga=YYYY-MM-DD)
  cadastrarPreferencia(idUsuario: number, dataFolga: string): Observable<PreferenciaFolga> {
    const params = new HttpParams()
      .set('idUsuario', idUsuario.toString())
      .set('dataFolga', dataFolga);

    return this.http.post<PreferenciaFolga>(`${this.apiUrl}/cadastrar`, null, { params })
      .pipe(catchError(this.handleError));
  }

  // ✅ CORRIGIDO: Remover preferência (DELETE /remover?idUsuario=X&dataFolga=YYYY-MM-DD)
  removerPreferencia(idUsuario: number, dataFolga: string): Observable<void> {
    const params = new HttpParams()
      .set('idUsuario', idUsuario.toString())
      .set('dataFolga', dataFolga);

    return this.http.delete<void>(`${this.apiUrl}/remover`, { params })
      .pipe(catchError(this.handleError));
  }

  // ✅ MÉTODOS ALTERNATIVOS PARA COMPATIBILIDADE COM CÓDIGO EXISTENTE

  // Alias para getPreferenciasPorMes (mantém compatibilidade)
  listarPorMesAno(mes: number, ano: number): Observable<PreferenciaFolga[]> {
    return this.getPreferenciasPorMes(ano, mes);
  }

  // Obter preferências por usuário (usando o endpoint de dias)
  listarPorUsuario(idUsuario: number): Observable<number[]> {
    const currentDate = new Date();
    const ano = currentDate.getFullYear();
    const mes = currentDate.getMonth() + 1;
    return this.getDiasPreferenciaUsuario(idUsuario, ano, mes);
  }

  // Obter preferências por usuário e mês específico
  listarPorUsuarioMesAno(idUsuario: number, mes: number, ano: number): Observable<number[]> {
    return this.getDiasPreferenciaUsuario(idUsuario, ano, mes);
  }

  // Método genérico para listar todas (busca do mês atual)
  listarPreferencias(): Observable<PreferenciaFolga[]> {
    const currentDate = new Date();
    const ano = currentDate.getFullYear();
    const mes = currentDate.getMonth() + 1;
    return this.getPreferenciasPorMes(ano, mes);
  }

  // Método para excluir por ID (não suportado pelo backend atual)
  excluirPreferencia(id: number): Observable<void> {
    console.warn('Método excluirPreferencia por ID não é suportado pelo backend. Use removerPreferencia por usuário e data.');
    return throwError(() => new Error('Método não suportado. Use removerPreferencia(idUsuario, dataFolga).'));
  }
}
