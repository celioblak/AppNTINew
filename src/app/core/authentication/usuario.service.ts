import { HttpBackend, HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, from, lastValueFrom, map } from 'rxjs';
import { environment } from '@env/environment';
import { Menu, TokenService } from '@core';
import { configuracaoUsuario, Token, Usuario } from '@core/interface';

@Injectable({
  providedIn: 'root',
})

export class UsuarioService {
  protected readonly http = inject(HttpClient);
  protected readonly tokenService = inject(TokenService);

  /**
   * HttpClient criado diretamente do HttpBackend — bypassa todos os interceptors
   * do projeto (incluindo o error-interceptor que envolve arrays puros como erro).
   * Usado exclusivamente em métodos que retornam arrays sem envelope { data, success }.
   */
  private readonly httpDireto = new HttpClient(inject(HttpBackend));

  private apiUrl = `${environment.ApiBaseUrl}usuario`;


  getMe() {
    return this.http.get<Usuario>(`${this.apiUrl}/me`);
  }

  getTodos() {
    return this.http.get<Usuario[]>(`${this.apiUrl}/`);
  }

  getUsuario(id: number) {
    return this.http.get<Usuario>(`${this.apiUrl}/${id}`);
  }

  /**
   * Retorna todos os usuários ativos.
   * Usa httpDireto (sem interceptors) pois o endpoint retorna um array puro
   * — o error-interceptor do projeto trata arrays sem envelope { data, success }
   * como erro mesmo com status 200.
   */
  getAtivos() {
    return this.httpDireto.get<Usuario[]>(`${this.apiUrl}/ativos`);
  }

}
