import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, from, lastValueFrom, map } from 'rxjs';
import { environment } from '@env/environment';
import { Menu, TokenService } from '@core';
import { configuracaoUsuario, Token, User } from '@core/interface';

@Injectable({
  providedIn: 'root',
})

export class UsuarioService {
  protected readonly http = inject(HttpClient);
  protected readonly tokenService = inject(TokenService);

  getUsuarios() {
    return this.http.get<User>(environment.ApiBaseUrl+'usuario/me');
  }

}
