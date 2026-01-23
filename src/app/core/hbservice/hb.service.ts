import { Inject, inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';

import { lastValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { hbserviceInfo, hbserviceStatus } from '@core/interface';


@Injectable({
  providedIn: 'root',
})
export class HbserviceService {

  constructor(private http:HttpClient,
    @Inject(DOCUMENT) private document: Document) { }


  private readonly URL_HBSERVICE = `${environment.hbServiceBaseUrl}`;

  info() {
    const url:string = this.URL_HBSERVICE +'/info';
      return this.http.get<hbserviceInfo>(url)
              .toPromise()
              .then(response =>{
                const dados = response;
                return dados;
              });
   }

   notificacaoTexto(json:string ) {
    //var url:string = this.URL_HBSERVICE +'/notificacao?paramentro='+texto+'&tipo=texto';
    const url:string = this.URL_HBSERVICE +'/notificacao';
      return this.http.put<hbserviceInfo>(url,json)
              .toPromise()
              .then(response =>{
                const dados = response;
                return dados;
              });
   }

   notificacaoHtml(html:string ) {
    const url:string = this.URL_HBSERVICE +'/notificacao?paramentro='+html+'&tipo=html';
      return this.http.get<hbserviceInfo>(url)
              .toPromise()
              .then(response =>{
                const dados = response;
                return dados;
              });
   }

  notificacaoBase64(stringBase64:string ) {
    const url:string = this.URL_HBSERVICE +'/notificacao?paramentro='+stringBase64+'&tipo=imgb64';
      return this.http.get<hbserviceInfo>(url)
              .toPromise()
              .then(response =>{
                const dados = response;
                return dados;
              });
  }

 healthThis()  {
  return this.http.get<hbserviceStatus>(this.URL_HBSERVICE+'/info/health')
          .toPromise()
          .then(response =>{
            const dados = response;
            return dados;
          }).catch(error => {
            console.log(error);
            return error;
          });
   }

async restartVNC(host:string, cmd:string ) {
    const url:string = 'http://'+ host +':9071'+'/vnc/restart';
      return await lastValueFrom(this.http.put<any>(`${url}`,cmd));
  }
async statusVNC(host:string) {
    const url:string = 'http://'+ host +':9071'+'/vnc/status';
      return await lastValueFrom(this.http.get<any>(url));
  }
async startVNC(host:string) {
  const url:string = 'http://'+ host +':9071'+'/vnc/start';
    return await lastValueFrom(this.http.get<any>(url));
}
async stopVNC(host:string) {
  const url:string = 'http://'+ host +':9071'+'/vnc/stop';
    return await lastValueFrom(this.http.get<any>(url));
}

async health(host:string) {
    const url:string = 'http://'+ host +':9071'+'/info/health';
      return await lastValueFrom(this.http.get<any>(url));
}

healths(host:string)  {
  const url:string = 'http://'+ host +':9071'+'/info/health';
        return this.http.get<hbserviceStatus>(url);
     }
}
