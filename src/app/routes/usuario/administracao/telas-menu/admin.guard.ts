import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { TelasMenuService } from './telas-menu.service';

/** Libera a rota só para administradores (TB_USUARIO.SN_ADM), conferido no backend. */
export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(TelasMenuService)
    .permissao()
    .pipe(
      map(({ admin }) => (admin ? true : router.parseUrl('/403'))),
      catchError(() => of(router.parseUrl('/403')))
    );
};
