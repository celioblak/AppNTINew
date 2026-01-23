import { HostListener, Injectable, OnInit } from '@angular/core';

import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';

import { Observable, throwError } from 'rxjs';
import { grupoServidor, Script, Servidor, ServidorProcesso, Sessao } from '@core';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
  export class ServidorService {

  private readonly apiUrl = `${environment.ApiBaseUrl}`+'servidor';
  private _headers: HttpHeaders = new HttpHeaders({
    'Content-Type': 'application/json',
  });

  constructor(private http:HttpClient) { }

 carregarServidor() {
    let url:string = this.apiUrl;
    url = url +'/';
    return this.http.get<any>(`${url}` , {headers:this._headers});
 }

 carregarServidorfiltro(valor:string, grupo:grupoServidor) {
  let url:string = this.apiUrl;
  let cdGrupo = grupo.codGrupoServidor;
  if (cdGrupo == undefined){
    url = url +'/filtrar?valor='+valor;
  }else{
    url = url +'/filtrar?valor='+valor+'&cdGrupo='+grupo.codGrupoServidor;
  }

  return this.http.get<any>(`${url}` , {headers:this._headers});
}

 carregarServidorProcesso(servidor:Servidor) {
  let url:string = this.apiUrl;
  url = url +'/processo/servidor/'+servidor.codServidor;
  return this.http.get<any>(`${url}` , {headers:this._headers});
}

carregarProcessoParamentro(processo:ServidorProcesso) {
  let url:string = this.apiUrl;
  url = url +'/processo/parametro/processo/'+processo.codProcesso;
  return this.http.get<any>(`${url}` , {headers:this._headers});
}

carregarGrupos() {
  let url:string = this.apiUrl;
  url = url +'/grupo';
  return this.http.get<any>(`${url}` , {headers:this._headers});
}

 salvarServidor(servidor:Servidor) {
  let url:string = this.apiUrl;
  url = url +'/';
  return this.http.post<Script>(`${url}` , servidor, {headers:this._headers});
}

atualizarServidor(servidor:Servidor) {
  let url:string = this.apiUrl;
  url = url +'/'+servidor.codServidor;
  return this.http.put<Script>(`${url}` , servidor, {headers:this._headers});
}

deletarServidor(servidor:Servidor) {
  let url:string = this.apiUrl;
  url = url +'/'+servidor.codServidor;
  return this.http.delete<Script>(`${url}`,{headers:this._headers});
}

}
