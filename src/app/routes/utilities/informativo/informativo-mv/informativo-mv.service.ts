import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { informativoMV } from '@core';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class InformativoMvService {

  private readonly apiUrl = `${environment.ApiBaseUrl}`+'informativo';
    private _headers: HttpHeaders = new HttpHeaders({
      'Content-Type': 'application/json',
    });

    constructor(private http:HttpClient) { }

   carregarInformativo() {
      let url:string = this.apiUrl;
      url = url +'/';
      return this.http.get<any>(`${url}` );
   }

   carregarInformativos(page:number, size:number, sort:string, order:string) {
    let url:string = this.apiUrl;
    url = url +'/informativoPageable?page='+page+'&size='+size+'&sort='+sort+','+order;
    console.log(url);
    return this.http.get<any>(`${url}` );
 }

   salvarInformativo(informativo:informativoMV) {
    let url:string = this.apiUrl;
    url = url +'/';
    return this.http.post<informativoMV>(`${url}` , informativo);
  }

  atualizarInformativo(informativo:informativoMV) {
    let url:string = this.apiUrl;
    url = url +'/'+informativo.codMensagem;
    return this.http.put<informativoMV>(`${url}` , informativo);
  }

  deletarInformativo(informativo:informativoMV) {
    let url:string = this.apiUrl;
    url = url +'/'+informativo.codMensagem;
    return this.http.delete<informativoMV>(`${url}`);
  }
}
