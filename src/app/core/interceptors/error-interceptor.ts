import {
  HttpContext,
  HttpContextToken,
  HttpErrorResponse,
  HttpHandlerFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { HotToastService } from '@ngxpert/hot-toast';
import { catchError, tap, throwError } from 'rxjs';

export enum STATUS {
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  INTERNAL_SERVER_ERROR = 500,
}

/**
 * Marca requisições que não devem abrir toast nem redirecionar para o login.
 * Usado pelas telas que rodam sem usuário logado (painel de TV), onde um erro de
 * rede não tem ninguém para ver o toast e o redirect tiraria o painel do ar.
 */
export const SKIP_ERROR_HANDLER = new HttpContextToken<boolean>(() => false);

/** Atalho para montar o contexto nas chamadas HTTP dessas telas. */
export function semTratamentoDeErro(): HttpContext {
  return new HttpContext().set(SKIP_ERROR_HANDLER, true);
}

const INVALID_TOKEN_MSG = 'Token enviado não é valido';
const LOGGED_OUT_MSG    = 'Você não esta mais logado';

export function errorInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  if (req.context.get(SKIP_ERROR_HANDLER)) {
    return next(req);
  }

  const router = inject(Router);
  const toast  = inject(HotToastService);

  const errorPages = [{}];

  /**
   * Extrai a mensagem do ApiErrorResponse.
   * Prioriza mensagem descritiva antes do código técnico (errorCode).
   */
  const getMessage = (error: HttpErrorResponse): string => {
    const body = error.error;
    if (!body) return `${error.status} ${error.statusText}`;
    // body.erro: padrão de vários controllers do backend, ex: { "erro": "NF-e já cadastrada..." }.
    // body.error cobre respostas Spring Boot: { "error": "mensagem" }
    return body.message || body.msg || body.erro || body.error || body.errorCode || `${error.status} ${error.statusText}`;
  };

  /** Verifica se o endpoint é auth/status e o token foi rejeitado pelo backend. */
  const isInvalidTokenResponse = (url: string, body: unknown): boolean =>
    url.includes('auth/status') &&
    (body as Record<string, unknown>)?.['status'] === INVALID_TOKEN_MSG;

  const handleLogout = (): void => {
    toast.error(LOGGED_OUT_MSG, { duration: 6000 });
    router.navigateByUrl('/auth/login');
  };

  return next(req).pipe(
    // Intercepta respostas 2xx — o backend pode retornar 200 com token inválido
    tap(event => {
      if (
        event instanceof HttpResponse &&
        isInvalidTokenResponse(req.url, event.body)
      ) {
        handleLogout();
      }
    }),

    catchError((error: HttpErrorResponse) => {
      if (error.status === 0) {
        toast.error('Não foi possível conectar ao servidor. Verifique sua conexão ou tente novamente mais tarde.', {
          duration: 6000,
          style: { 'max-width': '480px', 'white-space': 'normal' },
        });
        console.error('Erro de rede:', error);
        return throwError(() => error);
      }

      // Trata token inválido vindo como resposta de erro (4xx/5xx)
      if (isInvalidTokenResponse(req.url, error.error)) {
        handleLogout();
        return throwError(() => error);
      }

      if (errorPages.includes(error.status)) {
        router.navigateByUrl(`/${error.status}`, { skipLocationChange: true });
      } else {
        console.error('Erro na requisição:', error);

        toast.error(getMessage(error), {
          duration: 8000,
          dismissible: true,
          style: {
            'max-width':   '520px',
            'white-space': 'normal',
            'word-break':  'break-word',
            'line-height': '1.5',
          },
        });

        if (error.status === STATUS.UNAUTHORIZED) {
          router.navigateByUrl('/auth/login');
        }
      }

      // Cria um Error com a mensagem legível para o subscriber poder usar err.message
      const msg = getMessage(error);
      return throwError(() => Object.assign(new Error(msg), { status: error.status, original: error }));
    })
  );
}
