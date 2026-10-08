import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
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

  /** Retorna todos os usuários ativos. */
  getAtivos() {
    return this.http.get<Usuario[]>(`${this.apiUrl}/ativos`);
  }

}
