import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, catchError, forkJoin, from, iif, interval, map, merge, of, share, Subscription, switchMap, tap } from 'rxjs';
import { filterObject, isEmptyObject } from './helpers';
import { LoginService } from './login.service';
import { TokenService } from './token.service';
import { User } from '@core/interface';
import { result } from 'lodash';
import { Router } from '@angular/router';
import { SettingsService } from '@core/bootstrap';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly loginService = inject(LoginService);
  private readonly tokenService = inject(TokenService);
  private readonly settings = inject(SettingsService);
  private user$ = new BehaviorSubject<User>({});
  private readonly router = inject(Router);
  private tokenValidado:boolean = false;
  private tokenChecado:boolean = false;



  private change$ = merge(
                            this.tokenService.change(),
                            this.tokenService.refresh().pipe(switchMap(() => this.refresh())),
                          ).pipe(
                            switchMap(() => this.assignUser()),
                            tap(() => this.setSettings()),
                            share()
                          );

  init() {
    return new Promise<void>(resolve => this.change$.subscribe(() => resolve()));
  }

  change() {
    if(this.tokenChecado == false){
      if(this.check()){
        this.validTokens();
      }
    }
      return this.change$;
  }

 check() {
    return this.tokenService.valid();
  }

  validTokens() {
    if(this.check()){
      let this_ = this;
      const isValid = this.loginService.validSession()
       .then((r) => {
                      this.tokenValidado = r;
                      this.tokenChecado = true;
                      if (r==false){
                        this_.tokenService.clear();
                      }
                      return r
                    }
            ).finally(function() {
              this_.tokenChecado = true;
           })
      return isValid;
    }else{
      return false;
    }
    }

  me() {
    return this.loginService.mee();
  }

  async checkPermission(tela:any){
    const retorno = await this.loginService.getMeTela(tela);
    if(retorno.permissao == 'LIBERADO'){
        return true;
    }else{
        return false;
    }
}

 login(username: string, password: string, rememberMe = false) {
    return this.loginService.login(username, password, rememberMe).pipe(
      tap(token => {
                      this.tokenService.set(token);
                    }),
      map(() => this.check())
    );
  }

  refresh() {
    return this.loginService
      .refresh(filterObject({ refresh_token: this.tokenService.getRefreshToken() }))
      .pipe(
        catchError(() => of(undefined)),
        tap(token => this.tokenService.set(token)),
        map(() => this.check())
      );
  }

  logout() {
    this.router.parseUrl('/auth/login');
    this.router.navigateByUrl('/auth/login');
    return this.loginService.logout().pipe(
      tap(() => this.tokenService.clear()),
      map(() => !this.check())
    );
  }

  user() {
    return this.user$.pipe(share());
  }

    private setSettings() {
      if (!this.tokenService.valid()){
        return;
      }
    this.loginService.getConfiguracaoUsuario(this.settings.getkey().toLocaleUpperCase()).subscribe(data =>{
        this.settings.setOptions(Object.assign(JSON.parse(data.valor)));
    });
  }

  menu() {
    return iif(() => (this.check() && this.tokenValidado), this.loginService.menu(), of([]));
    //return  this.loginService.menu();
  }

   getUser(){
    return (async () => {
      const check = await this.check();
      if(check){
        const checkTokenDB = await this.validTokens();
        if(checkTokenDB){
          const usr = await this.me();
          this.user$.next(usr);
          return usr;
        }
      }

      return {};
    })();

  }

 private assignUser() {
    if (!this.validTokens()) {
      return of({}).pipe(tap(user => this.user$.next(user)));
    }
    if (!isEmptyObject(this.user$.getValue())) {
      return of(this.user$.getValue());
    }
  return this.getUser();
  }
}
