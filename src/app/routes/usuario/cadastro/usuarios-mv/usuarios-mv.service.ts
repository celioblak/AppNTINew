import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '@env/environment';

/** Situação de um nome MV no de-para (docs/de-para-usuarios-mv.md). */
export type SituacaoUsuarioMv = 'PENDENTE' | 'AUTOMATICO' | 'MANUAL' | 'SEM_APPNTI';

export interface SugestaoUsuarioMv {
  codUsuario: number;
  nome: string;
}

/** Linha da aba Usuários MV: nome que chega nos tickets MV → usuário do AppNTI. */
export interface UsuarioMv {
  codUsuarioMv: number;
  nmMv: string;
  situacao: SituacaoUsuarioMv;
  codUsuario?: number | null;
  nomeUsuario?: string | null;
  usuarioAtivo?: boolean | null;
  qtdTickets: number;
  qtdAbertos: number;
  ultimoTicket?: string | null;
  alteradoEm?: string | null;
  alteradoPor?: string | null;
  sugestoes?: SugestaoUsuarioMv[] | null;
  /** Só na resposta das ações: tickets que mudaram de dono. */
  ticketsAtualizados?: number | null;
}

export interface ResultadoReprocessar {
  nomesNovos: number;
  pendentesVinculados: number;
  ticketsAtualizados: number;
}

@Injectable({ providedIn: 'root' })
export class UsuariosMvService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.ApiBaseUrl}usuarios-mv`;

  listar(): Observable<UsuarioMv[]> {
    return this.http.get<UsuarioMv[]>(this.apiUrl);
  }

  quantidadePendentes(): Observable<number> {
    return this.http
      .get<{ quantidade: number }>(`${this.apiUrl}/pendentes/quantidade`)
      .pipe(map(r => r?.quantidade ?? 0));
  }

  /** Nomes MV vinculados a um usuário (bloco "Nomes no MV" do cadastro). */
  nomesDoUsuario(codUsuario: number): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/usuario/${codUsuario}`);
  }

  vincular(codUsuarioMv: number, codUsuario: number): Observable<UsuarioMv> {
    return this.http.put<UsuarioMv>(`${this.apiUrl}/${codUsuarioMv}/vincular`, { codUsuario });
  }

  marcarSemAppNti(codUsuarioMv: number): Observable<UsuarioMv> {
    return this.http.put<UsuarioMv>(`${this.apiUrl}/${codUsuarioMv}/sem-appnti`, {});
  }

  /** Desvincular ou desfazer "Não usa o AppNTI". */
  voltarParaPendente(codUsuarioMv: number): Observable<UsuarioMv> {
    return this.http.put<UsuarioMv>(`${this.apiUrl}/${codUsuarioMv}/pendente`, {});
  }

  reprocessar(): Observable<ResultadoReprocessar> {
    return this.http.post<ResultadoReprocessar>(`${this.apiUrl}/reprocessar`, {});
  }
}
