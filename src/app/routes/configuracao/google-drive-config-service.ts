import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { GoogleDriveConfig } from '@core';

@Injectable({
  providedIn: 'root'
})
export class GoogleDriveConfigService {

  private readonly apiUrl = `${environment.ApiBaseUrl}` + 'googleDrive';

  constructor(private http: HttpClient) { }

  obterConfig() {
    return this.http.get<GoogleDriveConfig>(`${this.apiUrl}/config/`);
  }

  salvarConfig(config: GoogleDriveConfig) {
    return this.http.put<GoogleDriveConfig>(`${this.apiUrl}/config/`, config);
  }

  obterUrlAutorizacao() {
    return this.http.get<{ url: string }>(`${this.apiUrl}/oauth/authUrl`);
  }
}
