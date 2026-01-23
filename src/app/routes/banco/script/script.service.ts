import { HostListener, Injectable, OnInit } from '@angular/core';

import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';

import { Observable, throwError } from 'rxjs';
import { Script, Sessao } from '@core';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
  export class ScriptService {

  private readonly apiUrl = `${environment.ApiBaseUrl}` +"sqlScript";

  constructor(private http:HttpClient) { }

 carregarScripts() {
    let url:string = this.apiUrl;
    url = url +'/';
    return this.http.get<any>(`${url}` );
 }

 salvarScript(scrpt:Script) {
  let url:string = this.apiUrl;
  url = url +'/';
  return this.http.post<Script>(`${url}` , scrpt);
}

atualizarScript(scrpt:Script) {
  let url:string = this.apiUrl;
  url = url +'/'+scrpt.codSql;
  return this.http.put<Script>(`${url}` , scrpt);
}

deletarScript(scrpt:Script) {
  let url:string = this.apiUrl;
  url = url +'/'+scrpt.codSql;
  return this.http.delete<Script>(`${url}`);
}

}
