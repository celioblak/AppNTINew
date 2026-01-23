import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Escala, Plantao, VistaEscala } from '@core';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class EscalaService {

  private apiUrl = `${environment.ApiBaseUrl}escala`;

  constructor(private http: HttpClient) {}

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Erro desconhecido ao processar a requisição';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Erro de conexão: ${error.error.message}`;
    } else {
      if (error.error && error.error.erro) {
        errorMessage = error.error.erro;
      } else if (error.error && typeof error.error === 'string') {
        errorMessage = error.error;
      } else if (error.status === 0) {
        errorMessage = 'Servidor não disponível. Verifique sua conexão de rede.';
      } else if (error.status === 400) {
        errorMessage = 'Requisição inválida. Verifique os dados enviados.';
      } else if (error.status === 404) {
        errorMessage = 'Recurso não encontrado no servidor.';
      } else if (error.status === 403) {
        errorMessage = 'Acesso não autorizado para esta operação.';
      } else if (error.status === 409) {
        errorMessage = 'Conflito de dados. O recurso já existe ou está em uso.';
      } else if (error.status === 500) {
        errorMessage = 'Erro interno do servidor. Tente novamente mais tarde.';
      } else {
        errorMessage = `Erro ${error.status}: ${error.statusText}`;
      }
    }

    console.error('Erro na requisição à API:', {
      url: error.url,
      status: error.status,
      message: errorMessage,
      error: error.error
    });

    return throwError(() => new Error(errorMessage));
  }

  getEscala(mesEscala: number): Observable<VistaEscala> {
    const idUsuario = 1;
    return this.http.get<VistaEscala>(
      `${this.apiUrl}/vista/${mesEscala}?idUsuario=${idUsuario}`
    ).pipe(
      catchError(this.handleError)
    );
  }

  gerarEscala(ano: number, mes: number, criadoPor: number): Observable<any> {
    const request = {
      ano: ano,
      mes: mes,
      criadoPor: criadoPor
    };

    return this.http.post<any>(
      `${this.apiUrl}/gerar`,
      request
    ).pipe(
      catchError(this.handleError)
    );
  }

  salvarPlantao(plantao: Plantao, idUsuarioAtual: number, escalaId?: number): Observable<any> {
  // DEBUG: Verificar todos os valores possíveis
  console.log('DEBUG - Valores disponíveis:', {
    escalaIdParam: escalaId,
    plantaoIdEscala: plantao.idEscala,
    plantaoEscalaId: plantao.escala?.id,
    plantaoCompleto: plantao
  });

  // Forçar usar escalaId do parâmetro PRIMEIRO
  const idEscala = escalaId;

  if (!idEscala) {
    console.error('DEBUG - escalaId do parâmetro é null/undefined:', escalaId);
    return throwError(() => new Error('ID da escala é obrigatório'));
  }

  // Garantir que é número
  const idEscalaNumero = Number(idEscala);
  if (isNaN(idEscalaNumero)) {
    console.error('DEBUG - idEscala não é número válido:', idEscala);
    return throwError(() => new Error('ID da escala deve ser um número válido'));
  }

  // Construir request EXATAMENTE como o backend espera
  const request = {
    plantao: {
      id: plantao.id || null,
      dia: Number(plantao.dia),
      idUsuario: Number(plantao.idUsuario),
      idTipoPlantao: Number(plantao.idTipoPlantao),
      idEscala: idEscalaNumero, // ← Garantir que é número
      mesEscala: Number(plantao.mesEscala)
    },
    idUsuarioAtual: Number(idUsuarioAtual)
  };

  console.log('DEBUG - Request final (JSON):', JSON.stringify(request));
  console.log('DEBUG - Tipos dos campos:', {
    idEscalaType: typeof request.plantao.idEscala,
    idEscalaValue: request.plantao.idEscala
  });

  return this.http.post<any>(
    `${this.apiUrl}/plantao`,
    request
  ).pipe(
    catchError(this.handleError)
  );
}

  removerPlantao(plantaoId: number, idUsuario: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/plantao/${plantaoId}`,
      {
        params: { idUsuario: idUsuario.toString() }
      }
    ).pipe(
      catchError(this.handleError)
    );
  }

  publicarEscala(mesEscala: number, idUsuarioAtual: number, observacao?: string): Observable<any> {
    const request = {
      mesEscala: mesEscala,
      idUsuarioAtual: idUsuarioAtual,
      observacao: observacao || ''
    };

    return this.http.put<any>(
      `${this.apiUrl}/publicar`,
      request
    ).pipe(
      catchError(this.handleError)
    );
  }

  reverterPublicacao(mesEscala: number, idUsuarioAtual: number): Observable<any> {
    const request = {
      mesEscala: mesEscala,
      idUsuarioAtual: idUsuarioAtual
    };

    return this.http.put<any>(
      `${this.apiUrl}/reverter`,
      request
    ).pipe(
      catchError(this.handleError)
    );
  }
}
