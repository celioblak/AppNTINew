import { HttpErrorResponse, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@core/authentication';
import { ToastrService } from 'ngx-toastr';
import { catchError, throwError } from 'rxjs';

export enum STATUS {
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  INTERNAL_SERVER_ERROR = 500,
}

// ✅ Função simplificada - trata string, null e undefined
const isApiRequest = (url: string | null | undefined): boolean => {
  if (!url) return false;
  return url.includes('/api/') ||
         url.includes('/auth/') ||
         url.includes('/upload/') ||
         url.includes('/download/');
};

export function errorInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  const router = inject(Router);
  const toast  = inject(ToastrService);
  const authService = inject(AuthService);

  const getMessage = (error: HttpErrorResponse) => {
    if (error.error?.message) return error.error.message;
    if (error.error?.msg) return error.error.msg;
    if (error.error?.error) return error.error.error;
    return `${error.status} ${error.statusText}`;
  };

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {

      // 🔹 TRATAMENTO PARA 403 FORBIDDEN
      if (error.status === STATUS.FORBIDDEN) {
        const isApi = isApiRequest(error.url);

        if (isApi) {
          // ✅ Para APIs: apenas mostra erro, NÃO redireciona
          toast.warning(getMessage(error) || 'Permissão negada', 'Acesso Restrito');
          console.warn(`API access denied: ${req.method} ${req.url}`);
        } else {
          // ✅ Para navegação: redireciona para página de erro
          router.navigateByUrl(`/${STATUS.FORBIDDEN}`, {
            skipLocationChange: true,
          });
        }
      }

      // 🔹 TRATAMENTO PARA 404 NOT FOUND
      else if (error.status === STATUS.NOT_FOUND) {
        const isApi = isApiRequest(error.url);

        if (isApi) {
          toast.error(`Recurso não encontrado`, 'Erro 404');
        } else {
          router.navigateByUrl(`/${STATUS.NOT_FOUND}`, {
            skipLocationChange: true,
          });
        }
      }

      // 🔹 TRATAMENTO PARA 401 UNAUTHORIZED (mantenha sua lógica)
      else if (error.status === STATUS.UNAUTHORIZED) {
        if (error.url?.includes('/login')) {
          toast.error(getMessage(error), 'Erro de Login');
        } else {
          toast.error('Sua sessão expirou', 'Sessão Expirada');
          authService.logout();
        }
      }

      // 🔹 MANTENHA SUA LÓGICA EXISTENTE PARA OUTROS ERROS
      else {
        if (error.error?.message && isORA_Raise_Application_Error(error.error.message)) {
          toast.error(tratarErroORA(error), 'Erro do Sistema');
        } else if (error.status === 0) {
          handleNetworkError(error, toast, authService);
        } else if (error.status !== 406) {
          toast.error(getMessage(error), `Erro ${error.status}`);
        }
      }

      return throwError(() => error);
    })
  );
}

// ✅ Função auxiliar para erros de rede
function handleNetworkError(
  error: HttpErrorResponse,
  toast: ToastrService,
  authService: AuthService
) {
  if (error.url?.includes('/check')) {
    toast.error('Servidor está fora do ar', 'Servidor Indisponível');
    authService.logout();
  } else if (error.url?.includes('/status')) {
    toast.error('Servidor está fora do ar', 'Acesso Servidor');
  } else {
    toast.error('Não foi possível conectar ao servidor', 'Falha de Conexão');
  }
}

// ✅ Mantenha suas funções existentes (sem alterações)
export function tratarErroORA(error: HttpErrorResponse): string {
  const msg = error.error?.message || '';
  if (msg.includes('ORA-')) {
    try {
      const oraMatch = msg.match(/ORA-\d+:([^[]+)/);
      if (oraMatch && oraMatch[1]) {
        return oraMatch[1].trim();
      }
    } catch (e) {
      console.error('Erro ao processar ORA:', e);
    }
  }
  return msg;
}

export function isORA_Raise_Application_Error(erro: string): boolean {
  if (!erro.includes('ORA-')) return false;
  const match = erro.match(/ORA-(\d+)/);
  if (match) {
    const num = parseInt(match[1], 10);
    return num >= 20000 && num <= 20999;
  }
  return false;
}
