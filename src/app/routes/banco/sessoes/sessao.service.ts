import { HostListener, Injectable } from '@angular/core';

import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';

import { Observable, throwError } from 'rxjs';
import { Sessao, SessaoLock } from '@core';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class SessionService {

  private readonly apiUrl = `${environment.ApiBaseUrl}`+'sessao';

  constructor(private http:HttpClient) { }

 carregarSessoes() {
    let url:string = this.apiUrl;
    url = url +'/';
    return this.http.get<any>(`${url}` );
 }

 pesquisarSql(params:HttpParams) {
  let url:string = this.apiUrl;
  url = url +'/sessaosql';
  return this.http.get<any>(`${url}`,{params});
}

pesquisarBind(params:HttpParams) {
  let url:string = this.apiUrl;
  url = url +'/sessaosql/sqlbind';
  return this.http.get<any>(`${url}`,{params});
}

 pesquisarSessoes(params:HttpParams) {
  const opts = params;

  let url:string = this.apiUrl;
  url = url +'/';
  return this.http.get<any>(`${url}`,{params});
}

pesquisarSessoesLock(params: HttpParams) {
  return this.http.get<SessaoLock[]>(`${this.apiUrl}/locks`, { params });
}

 matarSessoes(sessao:Sessao) {
  let url:string = this.apiUrl;
  console.log(sessao.instId);
  url = url +'/'+ sessao.sid + '/'+ sessao.serial + '/'+ sessao.instId;
  return this.http.delete<any>(`${url}`);
}

matarSessoesLock(sessao:Sessao) {
  let url:string = this.apiUrl;
  url = url +'/sessaolock/'+ sessao.lc_final_session + '/'+ sessao.lc_final_user +'/'+  sessao.lc_final_inst_id;
  console.log(url);
  return this.http.delete<any>(`${url}`);
}


errorHandler(error: HttpErrorResponse) {
  if (error.error instanceof ErrorEvent) {
    // A client-side or network error occurred. Handle it accordingly.
    console.error('Ocorreu um erro:', error.error.message);
  } else {
    // The backend returned an unsuccessful response code.
    // The response body may contain clues as to what went wrong,
    console.error(
      `Código retornado de back-end ${error.status}, ` +
      `corpo era: ${error.error}`);
  }
  // return an observable with a user-facing error message
  return throwError(
    'Algo ruim aconteceu; por favor tente novamente mais tarde.');
}

  getList(params = {}): Observable<RepoSearchList> {
    return this.http.get<RepoSearchList>('https://api.github.com/search/repositories', { params });
  }

}
export interface RepoSearchList {
  incomplete_results: boolean;
  items: any[];
  total_count: number;
}
