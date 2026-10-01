import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, shareReplay, tap } from 'rxjs/operators';
import { Ausencia, Escala, PermissaoUsuarioEscala, Plantao, VistaEscala } from '@core';

import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class EscalaService {

  private apiUrl = `${environment.ApiBaseUrl}escala`;

  // Cache para melhor performance
  private escalaCache = new Map<number, Observable<VistaEscala>>();
  private vistaCache = new Map<number, VistaEscala>();

  constructor(private http: HttpClient) {}

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.log('DEBUG - Error completo (EscalaService):', error);

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

    console.log('DEBUG - Mensagem extraída:', errorMessage);

    const customError = new Error(errorMessage);
    (customError as any).status = error.status;
    (customError as any).originalError = error;

    return throwError(() => customError);
  }

  getEscala(mesEscala: number, forceRefresh = false): Observable<VistaEscala> {
    if (!forceRefresh && this.vistaCache.has(mesEscala)) {
      return of(this.vistaCache.get(mesEscala)!);
    }

    if (!forceRefresh && this.escalaCache.has(mesEscala)) {
      return this.escalaCache.get(mesEscala)!;
    }

    const idUsuario = 1;
    const request$ = this.http.get<VistaEscala>(
      `${this.apiUrl}/vista/${mesEscala}?idUsuario=${idUsuario}`
    ).pipe(
      tap(vista => {
        this.vistaCache.set(mesEscala, vista);
      }),
      shareReplay(1),
      catchError(this.handleError)
    );

    this.escalaCache.set(mesEscala, request$);
    return request$;
  }

  getPermissao(): Observable<PermissaoUsuarioEscala> {
    return this.http.get<PermissaoUsuarioEscala>(`${this.apiUrl}/permissao`);
  }

  // ========== MÉTODOS PARA AUSÊNCIAS ==========

  /**
   * Salva uma ausência (banco de horas, atestado, etc.)
   */
  salvarAusencia(ausencia: Ausencia, escalaId?: number): Observable<any> {
    const idEscala = escalaId;

    if (!idEscala) {
      console.error('DEBUG - escalaId é null/undefined:', escalaId);
      return throwError(() => new Error('ID da escala é obrigatório'));
    }

    const idEscalaNumero = Number(idEscala);
    if (isNaN(idEscalaNumero)) {
      console.error('DEBUG - idEscala não é número válido:', idEscala);
      return throwError(() => new Error('ID da escala deve ser um número válido'));
    }

    const request = {
      ausencia: {
        id: ausencia.id || null,
        dia: Number(ausencia.dia),
        idUsuario: Number(ausencia.idUsuario),
        idTipoAusencia: Number(ausencia.idTipoAusencia),
        idEscala: idEscalaNumero,
        mesEscala: Number(ausencia.mesEscala),
        observacao: ausencia.observacao || null
      }
    };

    return this.http.post<any>(
      `${this.apiUrl}/ausencia`,
      request
    ).pipe(
      tap(response => {
        if (ausencia.mesEscala) {
          const ausenciaSalva = response.ausencia || ausencia;
          if (ausenciaSalva.id) {
            ausencia.id = ausenciaSalva.id;
          }
          this.atualizarCacheLocalAusencia(ausencia.mesEscala, ausenciaSalva, ausencia.id ? 'atualizar' : 'adicionar');
        }
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Remove uma ausência
   */
  removerAusencia(ausenciaId: number): Observable<void> {

    return this.http.delete<void>(
      `${this.apiUrl}/ausencia/${ausenciaId}`,
      { params: {} }
    ).pipe(
      tap(() => {
        this.escalaCache.clear();
        this.vistaCache.clear();
      }),
      catchError(this.handleError)
    );
  }

  // ========== MÉTODOS PARA PLANTÕES (mantidos) ==========

  atualizarCacheLocal(mesEscala: number, plantao: Plantao, operacao: 'adicionar' | 'atualizar' | 'remover'): void {
    if (this.vistaCache.has(mesEscala)) {
      const vista = this.vistaCache.get(mesEscala)!;

      if (!vista.grid) vista.grid = {};

      if (operacao === 'adicionar' || operacao === 'atualizar') {
        if (!vista.grid[plantao.idUsuario]) {
          vista.grid[plantao.idUsuario] = {};
        }
        vista.grid[plantao.idUsuario][plantao.dia] = plantao;
      } else if (operacao === 'remover') {
        if (vista.grid[plantao.idUsuario]) {
          delete vista.grid[plantao.idUsuario][plantao.dia];
          if (Object.keys(vista.grid[plantao.idUsuario]).length === 0) {
            delete vista.grid[plantao.idUsuario];
          }
        }
      }
    }
  }

  /**
   * Atualiza cache local para ausências
   */
  private atualizarCacheLocalAusencia(mesEscala: number, ausencia: Ausencia, operacao: 'adicionar' | 'atualizar' | 'remover'): void {
    if (this.vistaCache.has(mesEscala)) {
      const vista = this.vistaCache.get(mesEscala)!;

      // Criar estrutura de ausências se não existir
      if (!(vista as any).gridAusencias) {
        (vista as any).gridAusencias = {};
      }

      const gridAusencias = (vista as any).gridAusencias;

      if (operacao === 'adicionar' || operacao === 'atualizar') {
        if (!gridAusencias[ausencia.idUsuario]) {
          gridAusencias[ausencia.idUsuario] = {};
        }
        gridAusencias[ausencia.idUsuario][ausencia.dia] = ausencia;
      } else if (operacao === 'remover') {
        if (gridAusencias[ausencia.idUsuario]) {
          delete gridAusencias[ausencia.idUsuario][ausencia.dia];
          if (Object.keys(gridAusencias[ausencia.idUsuario]).length === 0) {
            delete gridAusencias[ausencia.idUsuario];
          }
        }
      }
    }
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
      tap(() => {
        const mesEscala = ano * 100 + mes;
        this.escalaCache.delete(mesEscala);
        this.vistaCache.delete(mesEscala);
      }),
      catchError(this.handleError)
    );
  }

  salvarPlantao(plantao: Plantao, escalaId?: number): Observable<any> {

    const idEscala = escalaId;

    if (!idEscala) {
      return throwError(() => new Error('ID da escala é obrigatório'));
    }

    const idEscalaNumero = Number(idEscala);
    if (isNaN(idEscalaNumero)) {
      return throwError(() => new Error('ID da escala deve ser um número válido'));
    }

    const request = {
      plantao: {
        id: plantao.id || null,
        dia: Number(plantao.dia),
        idUsuario: Number(plantao.idUsuario),
        idTipoPlantao: Number(plantao.idTipoPlantao),
        idEscala: idEscalaNumero,
        mesEscala: Number(plantao.mesEscala)
      }
    };

    return this.http.post<any>(
      `${this.apiUrl}/plantao`,
      request
    ).pipe(
      tap(response => {
        if (plantao.mesEscala) {
          const plantaoSalvo = response.plantao || plantao;
          if (plantaoSalvo.id) {
            plantao.id = plantaoSalvo.id;
          }
          this.atualizarCacheLocal(plantao.mesEscala, plantaoSalvo, plantao.id ? 'atualizar' : 'adicionar');
        }
      }),
      catchError(this.handleError)
    );
  }

  removerPlantao(plantaoId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/plantao/${plantaoId}`,
      { params: {} }
    ).pipe(
      tap(() => {
        this.escalaCache.clear();
        this.vistaCache.clear();
      }),
      catchError(this.handleError)
    );
  }

  publicarEscala(mesEscala: number,observacao?: string): Observable<any> {
    const request = {
      mesEscala: mesEscala,
      observacao: observacao || ''
    };

    return this.http.put<any>(
      `${this.apiUrl}/publicar`,
      request
    ).pipe(
      tap(() => {
        if (this.vistaCache.has(mesEscala)) {
          const vista = this.vistaCache.get(mesEscala)!;
          if (vista.escala) {
            vista.escala.publicado = true;
          }
        }
      }),
      catchError(this.handleError)
    );
  }

  reverterPublicacao(mesEscala: number): Observable<any> {
    const request = {
      mesEscala: mesEscala
    };

    return this.http.put<any>(
      `${this.apiUrl}/reverter`,
      request
    ).pipe(
      tap(() => {
        if (this.vistaCache.has(mesEscala)) {
          const vista = this.vistaCache.get(mesEscala)!;
          if (vista.escala) {
            vista.escala.publicado = false;
          }
        }
      }),
      catchError(this.handleError)
    );
  }

  limparCache(): void {
    this.escalaCache.clear();
    this.vistaCache.clear();
  }

  atualizarPlantaoNoCache(mesEscala: number, plantaoAtualizado: Plantao): void {
    this.atualizarCacheLocal(mesEscala, plantaoAtualizado, 'atualizar');
  }
}
