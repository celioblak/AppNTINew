import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { schedulerJobInfo } from '@core';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class JobManagerService {

  private readonly apiUrl = `${environment.ApiBaseUrl}`+'job';

     private _headers: HttpHeaders = new HttpHeaders({
       'Content-Type': 'application/json',
     });

     constructor(private http:HttpClient) { }

    carregarJob() {
       let url:string = this.apiUrl;
       url = url +'/getAllJobsInfo';
       return this.http.get<any>(`${url}`);
    }

    salvarJob(job:schedulerJobInfo) {
     let url:string = this.apiUrl;
     url = url +'/';
     return this.http.post<schedulerJobInfo>(`${url}` , job);
   }

    resumeJob(job:schedulerJobInfo) {
      let url:string = this.apiUrl;
      url = url +'/resume';
      return this.http.post<schedulerJobInfo>(`${url}` , job);
    }

  pauseJob(job:schedulerJobInfo) {
    let url:string = this.apiUrl;
    url = url +'/pause';
    return this.http.post<schedulerJobInfo>(`${url}` , job);
  }

  restartJob(job:schedulerJobInfo) {
    let url:string = this.apiUrl;
    url = url +'/restart';
    return this.http.post<schedulerJobInfo>(`${url}` , job);
  }

  removeJob(job:schedulerJobInfo) {
    let url:string = this.apiUrl;
    url = url +'/remove';
    return this.http.post<schedulerJobInfo>(`${url}` , job);
  }

  recreateJob(job:schedulerJobInfo) {
    let url:string = this.apiUrl;
    url = url +'/recreate';
    return this.http.post<schedulerJobInfo>(`${url}` , job);
  }

  runJob(job:schedulerJobInfo) {
    let url:string = this.apiUrl;
    url = url +'/run';
    return this.http.post<schedulerJobInfo>(`${url}` , job);
  }

   atualizarJob(job:schedulerJobInfo) {
     let url:string = this.apiUrl;
     url = url +'/'+job.jobId;
     return this.http.put<schedulerJobInfo>(`${url}` , job);
   }

   deletarJob(job:schedulerJobInfo) {
     let url:string = this.apiUrl;
     url = url +'/'+job.jobId;
     return this.http.delete<schedulerJobInfo>(`${url}`);
   }
}
