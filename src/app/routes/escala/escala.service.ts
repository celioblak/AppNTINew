import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, shareReplay, tap } from 'rxjs/operators';
import { Escala, Plantao, VistaEscala } from '@core';
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

    // Extrai a mensagem do backend diretamente
    let errorMessage = 'Erro desconhecido ao processar a requisição';

    // Verifica se o erro veio do seu backend
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

    // Cria um erro que será propagado corretamente
    const customError = new Error(errorMessage);
    // Adiciona propriedades extras para ajudar no debug
    (customError as any).status = error.status;
    (customError as any).originalError = error;

    return throwError(() => customError);
  }

  getEscala(mesEscala: number, forceRefresh = false): Observable<VistaEscala> {
    // Verificar cache
    if (!forceRefresh && this.vistaCache.has(mesEscala)) {
      return of(this.vistaCache.get(mesEscala)!);
    }

    // Verificar se já existe uma requisição em andamento
    if (!forceRefresh && this.escalaCache.has(mesEscala)) {
      return this.escalaCache.get(mesEscala)!;
    }

    const idUsuario = 1;
    const request$ = this.http.get<VistaEscala>(
      `${this.apiUrl}/vista/${mesEscala}?idUsuario=${idUsuario}`
    ).pipe(
      tap(vista => {
        console.log('DEBUG - getEscala response:', vista);
        // Armazenar no cache
        this.vistaCache.set(mesEscala, vista);
      }),
      shareReplay(1),
      catchError(this.handleError)
    );

    this.escalaCache.set(mesEscala, request$);
    return request$;
  }

  // Método para atualizar cache local após operações
  atualizarCacheLocal(mesEscala: number, plantao: Plantao, operacao: 'adicionar' | 'atualizar' | 'remover'): void {
    if (this.vistaCache.has(mesEscala)) {
      const vista = this.vistaCache.get(mesEscala)!;

      console.log('DEBUG - atualizarCacheLocal:', { mesEscala, plantao, operacao, vista });

      if (!vista.grid) vista.grid = {};

      if (operacao === 'adicionar' || operacao === 'atualizar') {
        if (!vista.grid[plantao.idUsuario]) {
          vista.grid[plantao.idUsuario] = {};
        }
        vista.grid[plantao.idUsuario][plantao.dia] = plantao;
      } else if (operacao === 'remover') {
        if (vista.grid[plantao.idUsuario]) {
          delete vista.grid[plantao.idUsuario][plantao.dia];
          // Remover entrada do usuário se vazia
          if (Object.keys(vista.grid[plantao.idUsuario]).length === 0) {
            delete vista.grid[plantao.idUsuario];
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
        // Limpar cache após gerar nova escala
        const mesEscala = ano * 100 + mes;
        this.escalaCache.delete(mesEscala);
        this.vistaCache.delete(mesEscala);
      }),
      catchError(this.handleError)
    );
  }

  salvarPlantao(plantao: Plantao, idUsuarioAtual: number, escalaId?: number): Observable<any> {
    console.log('DEBUG - salvarPlantao chamado:', { plantao, idUsuarioAtual, escalaId });

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
        idEscala: idEscalaNumero,
        mesEscala: Number(plantao.mesEscala)
      },
      idUsuarioAtual: Number(idUsuarioAtual)
    };

    console.log('DEBUG - Request final (JSON):', JSON.stringify(request));

    return this.http.post<any>(
      `${this.apiUrl}/plantao`,
      request
    ).pipe(
      tap(response => {
        console.log('DEBUG - salvarPlantao response:', response);
        // Atualizar cache local
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

  removerPlantao(plantaoId: number, idUsuario: number): Observable<void> {
    console.log('DEBUG - removerPlantao chamado:', { plantaoId, idUsuario });

    return this.http.delete<void>(
      `${this.apiUrl}/plantao/${plantaoId}`,
      {
        params: { idUsuario: idUsuario.toString() }
      }
    ).pipe(
      tap(() => {
        console.log('DEBUG - removerPlantao sucesso');
        // Limpar cache para forçar recarregamento
        this.escalaCache.clear();
        this.vistaCache.clear();
      }),
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
      tap(() => {
        // Atualizar cache
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

  reverterPublicacao(mesEscala: number, idUsuarioAtual: number): Observable<any> {
    const request = {
      mesEscala: mesEscala,
      idUsuarioAtual: idUsuarioAtual
    };

    return this.http.put<any>(
      `${this.apiUrl}/reverter`,
      request
    ).pipe(
      tap(() => {
        // Atualizar cache
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

  // Método para limpar cache (útil para logout ou mudança de mês)
  limparCache(): void {
    this.escalaCache.clear();
    this.vistaCache.clear();
  }

  // Método para atualizar apenas um plantão no cache
  atualizarPlantaoNoCache(mesEscala: number, plantaoAtualizado: Plantao): void {
    this.atualizarCacheLocal(mesEscala, plantaoAtualizado, 'atualizar');
  }
}
