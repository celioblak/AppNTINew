import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@env/environment';


@Injectable({
  providedIn: 'root'
})
export class EstatisticaService {


  private readonly apiUrl = `${environment.ApiBaseUrl}`+'estatistica';

  constructor(private http: HttpClient,
  ) { }

  getFinalizadosUsuarioMes(){
   let url:string = this.apiUrl;
      url = url +'/finalizado/usuario';

      return this.http.get<any>(`${url}`).toPromise()
      .then(response =>{
        const dados = response;
        return dados;
      }).catch(error => {
        console.log(error);
        return error;
      });
 }

}


