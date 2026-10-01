import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '@env/environment';

/** Modelo usado pela tela de cadastro/edição de usuários. */
export interface UsuarioCadastro {
  codUsuario?: number | null;
  login: string;
  nome: string;
  email?: string | null;
  matricula?: number | null;
  snAtivo: boolean;
  snAdmin: boolean;
  snPlantonista: boolean;
  glpiUserId?: string | null;
  telegramId?: number | null;
  snMsgTelegram: boolean;
  /** Login pela rede (Active Directory) ativado. */
  snLoginAd: boolean;
  /** Conta da rede; vazia = mesmo login do APP. */
  loginAd?: string | null;
  /** Login automático com o usuário do Windows (exige snLoginAd). */
  snLoginAutomatico: boolean;
  foto?: string | null;
}

@Injectable({ providedIn: 'root' })
export class UsuarioCadastroService {
  /**
   * HttpClient sem interceptors (igual UsuarioService.getAtivos): os endpoints de
   * listagem retornam array puro, que o error-interceptor do projeto trataria
   * como erro mesmo com status 200.
   */
  private readonly httpDireto = new HttpClient(inject(HttpBackend));
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.ApiBaseUrl}usuario`;

  listar(): Observable<UsuarioCadastro[]> {
    return this.httpDireto
      .get<any[]>(`${this.apiUrl}/?incluirInativos=true`)
      .pipe(map(lista => (lista ?? []).map(u => this.normalizar(u))));
  }

  obter(id: number): Observable<UsuarioCadastro> {
    return this.httpDireto.get<any>(`${this.apiUrl}/${id}`).pipe(map(u => this.normalizar(u)));
  }

  criar(dto: UsuarioCadastro): Observable<any> {
    return this.http.post(`${this.apiUrl}/`, this.paraEntidade(dto));
  }

  atualizar(id: number, dto: UsuarioCadastro): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, this.paraEntidade(dto));
  }

  excluir(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  existeLogin(login: string): Observable<boolean> {
    return this.httpDireto.get<boolean>(`${this.apiUrl}/exists/login/${encodeURIComponent(login)}`);
  }

  /** Normaliza o JSON do backend (que mistura `snativo`/`snadmin` minúsculos com camelCase). */
  private normalizar(u: any): UsuarioCadastro {
    return {
      codUsuario: u?.codUsuario ?? u?.cod_usuario ?? null,
      login: u?.login ?? '',
      nome: u?.nome ?? '',
      email: u?.email ?? '',
      matricula: u?.matricula ?? null,
      snAtivo: u?.snAtivo ?? u?.snativo ?? false,
      snAdmin: u?.snAdmin ?? u?.snadmin ?? false,
      snPlantonista: u?.snPlantonista ?? u?.snplantonista ?? false,
      glpiUserId: u?.glpiUserId ?? u?.glpi_user_id ?? null,
      telegramId: u?.telegramId ?? u?.telegram_id ?? null,
      snMsgTelegram: u?.snMsgTelegram ?? u?.snMsgTelagram ?? u?.sn_msg_telegram ?? false,
      snLoginAd: u?.snLoginAd ?? false,
      loginAd: u?.loginAd ?? null,
      snLoginAutomatico: u?.snLoginAutomatico ?? false,
      foto: u?.foto ?? null,
    };
  }

  /**
   * O backend espera a entidade `Usuario`. Enviamos só os campos editáveis;
   * o endpoint de update no servidor preserva senha, perfis e integrações.
   */
  private paraEntidade(dto: UsuarioCadastro): Record<string, unknown> {
    return {
      codUsuario: dto.codUsuario ?? null,
      login: dto.login?.trim(),
      nome: dto.nome?.trim(),
      email: dto.email?.trim() || null,
      matricula: dto.matricula ?? null,
      snAtivo: !!dto.snAtivo,
      snAdmin: !!dto.snAdmin,
      snPlantonista: !!dto.snPlantonista,
      // enviamos '' (e não null) para permitir limpar o vínculo com o GLPI
      glpiUserId: dto.glpiUserId?.trim() ?? '',
      telegramId: dto.telegramId ?? null,
      // nome do campo na entidade tem o typo histórico "Telagram"
      snMsgTelagram: !!dto.snMsgTelegram,
      snLoginAd: !!dto.snLoginAd,
      // vazio vira nulo no backend (= mesmo login do APP)
      loginAd: dto.loginAd?.trim() || null,
      snLoginAutomatico: !!dto.snLoginAd && !!dto.snLoginAutomatico,
    };
  }
}
