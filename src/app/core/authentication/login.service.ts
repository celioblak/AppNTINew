import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, from, lastValueFrom, map } from 'rxjs';
import { environment } from '@env/environment';
import { Menu, TokenService } from '@core';
import { configuracaoUsuario, Token, User } from '@core/interface';

@Injectable({
  providedIn: 'root',
})

/*function is(reqInfo: RequestInfo, path: string) {
  if (environment.baseUrl) {
    return false;
  }*/

export class LoginService {
  protected readonly http = inject(HttpClient);
  protected readonly tokenService = inject(TokenService);

 /* private _headers: HttpHeaders = new HttpHeaders({
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS,POST,PUT',
    'Access-Control-Allow-Headers': '*',
  });*/


  login(username: string, password: string, rememberMe = false) {
    let _params   = new HttpParams();
    _params = _params.append('credential',btoa(username+':'+password));
    //return this.http.post<Token>(environment.ApiBaseUrl+'auth/login', { username, password, rememberMe });
    return this.http.post<Token>(environment.ApiBaseUrl+'auth/login','',{ params: _params});
  }

  refresh(params: Record<string, any>) {
    return this.http.post<Token>('/auth/refresh', params);
  }

  logout() {
    return this.http.post<any>(environment.ApiBaseUrl+'auth/logout', {});
  }

  async check() {
    //return await firstValueFrom(this.http.get<any>(environment.ApiBaseUrl+'auth/check'));
    return await firstValueFrom(this.http.get<any>(environment.ApiBaseUrl+'auth/check'));
  }

  async checkSession(){
            const retorno = await this.check().finally();
            if(retorno.status == 'OK'){
                return true;
            }else{
                return false;
            }
  }

async validSession(){

    if(!this.tokenService.valid()){
      return false;
    }
    const validacao = await firstValueFrom(this.http.get<any>(environment.ApiBaseUrl+'auth/check')).then((retorno) => {
      return retorno;
    }).catch((err) => {
      if (err.status){
        this.logout();
      }
      return false;
    });

    return validacao;
}

  async getMeTela(tela:string) {
    return await lastValueFrom(this.http.get<any>(`${environment.ApiBaseUrl}acesso/tela/me/`+tela));
}

  status() {
    return this.http.get<any>(environment.ApiBaseUrl+'auth/status');
  }

  me() {
    return this.http.get<User>(environment.ApiBaseUrl+'usuario/me');
  }
  async mee() {
    return await lastValueFrom(this.http.get<User>(environment.ApiBaseUrl+'usuario/me'));
  }

  menu() {
    return this.http.get<{ menu: Menu[] }>(environment.ApiBaseUrl+'acesso/menu/me').pipe(map(res => res.menu));
  }

  getConfiguracaoUsuario(chave:string) {
     console.log("login.service");
    return this.http.get<any>(environment.ApiBaseUrl+'configuracao/usuario/'+chave);
  }

  setConfiguracaoUsuario(chave:string, valor:string) {
    return this.http.post<any>(environment.ApiBaseUrl+'configuracao/usuario/'+chave,valor/*,{headers:this._headers}*/);
  }
}
