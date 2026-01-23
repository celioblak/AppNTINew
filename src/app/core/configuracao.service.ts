import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

import { environment } from '../../environments/environment';
import { User } from './interface';

@Injectable({
  providedIn: 'root'
})
export class ConfiguracaoService {

  private readonly apiUrl = `${environment.ApiBaseUrl}`+'configuracao';
  constructor(private http: HttpClient) { }

  getAll() {
    let url:string = this.apiUrl;
      url = url +'/';
    return this.http.get<User[]>(`${url}`);
 }

 getConfig(configuracao:string){
      let url:string = this.apiUrl;
      url = url +'/'+configuracao;
       return this.http.get<any>(`${url}`);

   }
}
