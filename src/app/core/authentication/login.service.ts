import { HttpBackend, HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, firstValueFrom, lastValueFrom, map, Observable, of, timeout } from 'rxjs';
import { environment } from '@env/environment';
import { Menu, PermissionResponse, Token, TokenService, Usuario } from '@core';

/** MV = usuário/senha do MV; AD = usuário/senha da rede (Active Directory). */
export type TipoLogin = 'MV' | 'AD';

/** Opções de login habilitadas pelo administrador. */
export interface StatusLogin {
  /** Login pela rede (usuário/senha do AD). */
  ad: boolean;
  /** Login automático com o usuário do Windows (Kerberos). */
  sso: boolean;
}

/** btoa só aceita Latin-1: converte para UTF-8 antes (o backend decodifica em UTF-8), senão senhas com acento falham. */
function paraBase64Utf8(texto: string): string {
  let binario = '';
  new TextEncoder().encode(texto).forEach(byte => (binario += String.fromCharCode(byte)));
  return btoa(binario);
}

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
  /** Sem interceptors: consultas públicas da tela de login não devem exibir toast de erro nem redirecionar em 401. */
  private readonly httpDireto = new HttpClient(inject(HttpBackend));
  private apiUrl = `${environment.ApiBaseUrl}auth`;



  login(username: string, password: string, rememberMe = false, tipo: TipoLogin = 'MV') {
    let _params   = new HttpParams();
    _params = _params.append('credential', paraBase64Utf8(username+':'+password));
    _params = _params.append('tipo', tipo);
    return this.http.post<Token>(this.apiUrl+'/login','',{ params: _params});
  }

  /** Opções de login habilitadas. Qualquer falha = nenhuma opção extra. */
  statusLogin(): Observable<StatusLogin> {
    return this.httpDireto.get<{ habilitado: boolean; sso?: boolean }>(`${this.apiUrl}/ad/status`).pipe(
      map(resposta => ({ ad: !!resposta?.habilitado, sso: !!resposta?.habilitado && !!resposta?.sso })),
      catchError(() => of({ ad: false, sso: false }))
    );
  }

  /**
   * Login automático: o backend responde 401 "Negotiate" e o navegador repete sozinho com o ticket do Windows,
   * quando pode. Erros (401 sem ticket, 403 com código) chegam como HttpErrorResponse.
   */
  loginSso() {
    return this.httpDireto.get<Token>(`${this.apiUrl}/sso`, { withCredentials: true }).pipe(timeout(20000));
  }

  refresh(params: Record<string, any>) {
    return this.http.post<Token>('/refresh', params);
  }

  logout() {
    return this.http.post<any>(this.apiUrl+'/logout', {});
  }

  async check() {
    return await firstValueFrom(this.http.get<any>(this.apiUrl+'/check'));
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
    const validacao = await firstValueFrom(this.http.get<any>(this.apiUrl+'/check')).then((retorno) => {
      return retorno;
    }).catch((err) => {
      if (err.status){
        this.logout();
      }
      return false;
    });

    return validacao;
}

 hasPermission(tela: string): Observable<boolean> {
    return this.http.get<PermissionResponse>(`${this.apiUrl}/check-permission`, {params: { tela: tela }}
    ).pipe(
      map(response => response.allowed === true),
      catchError(err => {
        console.error('Erro ao checar permissão:', err);
        return of(false);  // ou trate 401/403 diferente se quiser
      })
    );
  }

  status() {
    return this.http.get<any>(this.apiUrl+'/status');
  }

  me() {
    return this.http.get<Usuario>(environment.ApiBaseUrl+'usuario/me');
  }
  async mee() {
    return await lastValueFrom(this.http.get<Usuario>(environment.ApiBaseUrl+'usuario/me'));
  }

  menu() {
    return this.http.get<{ menu: Menu[] }>(environment.ApiBaseUrl+'acesso/menu/me').pipe(map(res => res.menu));
  }

  getConfiguracaoUsuario(chave:string) {
    return this.http.get<any>(environment.ApiBaseUrl+'configuracao/usuario/'+chave);
  }

  setConfiguracaoUsuario(chave:string, valor:string) {
    return this.http.post<any>(environment.ApiBaseUrl+'configuracao/usuario/'+chave,valor/*,{headers:this._headers}*/);
  }
}
