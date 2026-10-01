import { HostListener, Injectable, OnInit } from '@angular/core';

import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';

import { Observable, throwError } from 'rxjs';
import { grupoServidor, Script, Servidor, ServidorParamentroProcesso, ServidorProcesso, Sessao } from '@core';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
  export class ServidorService {

  private readonly apiUrl = `${environment.ApiBaseUrl}`+'servidor';

  constructor(private http:HttpClient) { }

 carregarServidor() {
    let url:string = this.apiUrl;
    url = url +'/';
    return this.http.get<any>(`${url}`);
 }

 carregarServidorfiltro(valor:string, grupo:grupoServidor) {
  let url:string = this.apiUrl;
  let cdGrupo = grupo.codGrupoServidor;
  if (cdGrupo == undefined){
    url = url +'/filtrar?valor='+valor;
  }else{
    url = url +'/filtrar?valor='+valor+'&cdGrupo='+grupo.codGrupoServidor;
  }

  return this.http.get<any>(`${url}`);
}

 carregarServidorProcesso(servidor:Servidor) {
  let url:string = this.apiUrl;
  url = url +'/processo/servidor/'+servidor.codServidor;
  return this.http.get<any>(`${url}` );
}

carregarProcessoParamentro(processo:ServidorProcesso) {
  let url:string = this.apiUrl;
  url = url +'/processo/parametro/processo/'+processo.codProcesso;
  return this.http.get<any>(`${url}`);
}

carregarGrupos() {
  let url:string = this.apiUrl;
  url = url +'/grupo';
  return this.http.get<any>(`${url}`);
}

carregarTipoProcesso() {
  let url: string = this.apiUrl;
  url = url + '/processo/tipo';
  // Retorna List<ServidorTipoProcesso> com { codTipoProcesso, dsTipoProcesso }
  return this.http.get<any[]>(`${url}`);
}

carregarTipoParametro() {
  let url: string = this.apiUrl;
  url = url + '/processo/parametro/tipos';
  // Retorna List<{key: string, value: string}> — backend serializa enum nesse formato
  return this.http.get<{ key: string; value: string }[]>(`${url}`);
}

 salvarServidor(servidor:Servidor) {
  let url:string = this.apiUrl;
  url = url +'/';
  return this.http.post<Script>(`${url}` , servidor);
}

atualizarServidor(servidor:Servidor) {
  let url:string = this.apiUrl;
  url = url +'/'+servidor.codServidor;
  return this.http.put<Script>(`${url}` , servidor);
}

deletarServidor(servidor:Servidor) {
  let url:string = this.apiUrl;
  url = url +'/'+servidor.codServidor;
  return this.http.delete<Script>(`${url}`);
}

salvarProcesso(processo: ServidorProcesso, codServidor: number) {
  let url: string = this.apiUrl;
  url = url + '/processo/servidor/' + codServidor;
  return this.http.post<any>(`${url}`, processo);
}

atualizarProcesso(processo: ServidorProcesso) {
  let url: string = this.apiUrl;
  url = url + '/processo/' + processo.codProcesso;
  return this.http.put<any>(`${url}`, processo);
}

deletarProcesso(codProcesso: number) {
  let url: string = this.apiUrl;
  url = url + '/processo/' + codProcesso;
  return this.http.delete<any>(`${url}`);
}

salvarParametro(parametro: ServidorParamentroProcesso, codProcesso: number) {
  let url: string = this.apiUrl;
  url = url + '/processo/parametro/processo/' + codProcesso;
  return this.http.post<any>(`${url}`, parametro);
}

atualizarParametro(parametro: ServidorParamentroProcesso) {
  let url: string = this.apiUrl;
  url = url + '/processo/parametro/' + parametro.codParametro;
  return this.http.put<any>(`${url}`, parametro);
}

deletarParametro(codParametro: number) {
  let url: string = this.apiUrl;
  url = url + '/processo/parametro/' + codParametro;
  return this.http.delete<any>(`${url}`);
}

}
