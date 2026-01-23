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

export function errorInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  const router = inject(Router);
  const toast  = inject(ToastrService);
  const authService = inject(AuthService);
  const errorPages = [STATUS.FORBIDDEN, STATUS.NOT_FOUND];

  const getMessage = (error: HttpErrorResponse) => {

    if (error.error?.message) {
      return error.error.message;
    }
    if (error.error?.msg) {
      return error.error.msg;
    }
    return `${error.status} ${error.statusText}`;
  };

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (errorPages.includes(error.status)) {
        router.navigateByUrl(`/${error.status}`, {
          skipLocationChange: true,
        });
      } //else {
        if (error.status === STATUS.UNAUTHORIZED) {
          if (error.url?.includes('/login'))  {
            toast.error(error.error.message);
          }else{
            toast.error('Voce não esta mais logado');
          }
          authService.logout();
        }else if (STATUS.INTERNAL_SERVER_ERROR){
          if (error.error.message != undefined){
            if (isORA_Raise_Application_Error(error.error.message)){
               toast.error(tratarErroORA(error));
            }else{
                toast.error(error.error.message);
              }
            }else{
              console.log(error);
              if (error.status == 0){
                if (error.url?.includes('/check'))  {
                  toast.error('Servidor for do ar');
                  authService.logout();
                  //router.navigateByUrl('/auth/0?returnUrl='+router.url);
                }else if (error.url?.includes('/status')) {
                  toast.error('Servidor for do ar','Acesso Servidor');
                }else{
                  //this.toast.error(this.getMessage(error));
                  toast.error('Não foi possivel realizar requisição','Falha de Conexão');
                }
              }else if (error.status != 406){
                toast.error(getMessage(error));
              }
            }
        }
      return throwError(() => error);
    })
  );
}

export function tratarErroORA(error: HttpErrorResponse):string{
  var msg = error.error.message;
      msg = msg.substring(msg.indexOf(':')+1);/*Obtem a primeira parte da mensagem*/
      msg = msg.substring(0,(msg.indexOf('ORA')));/*Obtem a parte final da mensagem */
      return msg;
}

export function isORA_Raise_Application_Error(erro:string):boolean{
  if(erro.includes('ORA-')){
    var ora = erro.substring(erro.indexOf('[')+1,erro.indexOf(':'));
      ora = ora.replace('ORA','');
      if(Number(ora) >=-20999 && Number(ora) <= -20000){
        return true;
      }
  }
  return false;
}
