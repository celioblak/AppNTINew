import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError, take } from 'rxjs/operators';
import { AuthService } from './auth.service'; // seu serviço de auth

export const resourceAuthGuard = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Observable<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Exemplo 1: verifica permissão por **caminho da rota** (mais comum)
  const url = state.url; // ou route.routeConfig?.path
  if (
    url.startsWith('/auth/') ||
    url === '/403' ||
    url === '/404' ||
    url === '/500'
  ) {
    return of(true);
  }

  // Exemplo 2: passa um identificador específico via data (mais seguro e flexível)
  // const requiredPermission = route.data['permission'] as string; // 'view:reports', 'edit:users', etc
const resource = authService.normalizeMenuPath(url);
// Verifica se o usuário está autenticado de forma síncrona
if (!authService.check()) {
  // Se não estiver autenticado, redireciona para a página de login
  return of(router.parseUrl('/login'));
}
  return authService.checkPermission(resource).pipe(
   take(1),
   map(allowed => allowed ? true : router.parseUrl('/403')),
    catchError(() => {
      // Token inválido / não logado → vai pro login
      return of(router.parseUrl('/login'));
    })
  );
};
