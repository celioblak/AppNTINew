import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { catchError, map, Observable, of, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ChamadoService {

  private readonly apiUrl = `${environment.ApiBaseUrl}`+'chamado';

  constructor(private http: HttpClient,
  ) {}

getTicketPendente(){
  let url:string = this.apiUrl;
      url = url +'/pendentes';
        return this.http.get<any>(`${url}`).toPromise()
                .then(response =>{
                  const dados = response;
                  return dados;
                }).catch(error => {
                  console.log(error);
                  return error;
                });
  }


getTicketPainel(){
   let url:string = this.apiUrl;
       url = url +'/painel/incidentes';

    return this.http.get<any>(`${url}`).toPromise()
            .then(response =>{
              const dados = response;
              return dados;
            }).catch(error => {
              console.log(error);
              return error;
            });
}

getTicketPainelRequisicao() {
  let url:string = this.apiUrl;
       url = url +'/painel/requisicao';

      return this.http.get<any>(`${url}`).toPromise()
          .then(response =>{
            const dados = response;
            return dados;
          }).catch(error => {
            console.log(error);
            return error;
          });
}

getPainelServidor(){
  let url:string = this.apiUrl;
      url = url +'/painel/servidor';

  return this.http.get<any>(`${url}`)
          .pipe(
            catchError(this.handleError)
          );

}
private handleError(error: any) {
  let erro = error.message || 'Server error';
  console.error('Ocorreu um erro', error);
  console.error('Ocorreu um erro', error.currentTarget.status);
  return throwError(() => error);
}

getPainelLocks(){
  let url:string = this.apiUrl;
      url = url +'/painel/locks';

  return this.http.get<any>(`${url}`).toPromise()
          .then(response =>{
            const dados = response;
            return dados;
          }).catch(error => {
            console.log(error);
            return error;
          });
}

getTicketPendenteRequisicao(){
   let url:string = this.apiUrl;
      url = url +'/pendentes/requisicao';

  return this.http.get<any>(`${url}`).toPromise()
          .then(response =>{
            const dados = response;
            return dados;
          }).catch(error => {
            console.log(error);
            return error;
          });
}

getTecnicosChamado(idChamado:number){
  let url:string = this.apiUrl;
      url = url +'/tecnico/'+idChamado;

 return this.http.get<any>(`${url}`).toPromise()
         .then(response =>{
           const dados = response;
           return dados;
         }).catch(error => {
           console.log(error);
           return error;
         });
}


  getTicketTodosPendente(){
   let url:string = this.apiUrl;
      url = url +'/pendentes/todos';

    return this.http.get<any>(`${url}`).toPromise()
            .then(response =>{
              const dados = response;
              return dados;
            }).catch(error => {
              console.log(error);
              return error;
            });
}

getTicketPendenteIncidente(){
    let url:string = this.apiUrl;
      url = url +'/pendentes/incidente';

  return this.http.get<any>(`${url}`).toPromise()
          .then(response =>{
            const dados = response;
            return dados;
          }).catch(error => {
            console.log(error);
            return error;
          });
}


 getTicketPendenteAnalTecnica(){
  let url:string = this.apiUrl;
      url = url +'/pendentes/analise';

  return this.http.get<any>(`${url}`).toPromise()
  .then(response =>{
    const dados = response;
    return dados;
  }).catch(error => {
    console.log(error);
    return error;
  });
}

getTicketEmAndamento(){
let url:string = this.apiUrl;
      url = url +'/processando';

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
