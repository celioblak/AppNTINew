import { HttpEvent, HttpHandlerFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { HotToastService } from '@ngxpert/hot-toast';
import { mergeMap, of, throwError } from 'rxjs';

export function apiInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  const toast = inject(HotToastService);

  if (!req.url.includes('/api/')) {
    return next(req);
  }

  return next(req).pipe(
    mergeMap((event: HttpEvent<any>) => {
      if (event instanceof HttpResponse) {
        const body: any = event.body;
        // failure: { code: **, msg: 'failure' }
        // success: { code: 0,  msg: 'success', data: {} }
        // Só objeto: em resposta de texto (responseType 'text') o operador "in" lança TypeError.
        if (body && typeof body === 'object' && 'code' in body && body.code !== 0) {
          if (body.msg) {
            toast.error(body.msg);
          }
          return throwError(() => []);
        }
      }
      // Pass down event if everything is OK
      return of(event);
    })
  );
}
