import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '@env/environment';

import { BalanceadorCadastro, JkConsulta, Mapa, ProcessoOpcao, SistemaCadastro } from './mapa-servicos.models';

@Injectable({ providedIn: 'root' })
export class MapaServicosService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.ApiBaseUrl}mapa-servicos`;

  mapa() {
    return this.http.get<Mapa>(this.api);
  }

  processos() {
    return this.http.get<ProcessoOpcao[]>(`${this.api}/processos`);
  }

  /** jk-status ao vivo do Apache: workers e membros, com a sugestão para cada membro. */
  jkStatus(codProcesso: number) {
    return this.http.get<JkConsulta>(`${this.api}/jk-status/${codProcesso}`);
  }

  // ---------------------------------------------------------------- balanceadores

  balanceadores() {
    return this.http.get<BalanceadorCadastro[]>(`${this.api}/balanceadores`);
  }

  salvarBalanceador(b: BalanceadorCadastro) {
    return b.codBalanceador
      ? this.http.put<BalanceadorCadastro>(`${this.api}/balanceadores/${b.codBalanceador}`, b)
      : this.http.post<BalanceadorCadastro>(`${this.api}/balanceadores`, b);
  }

  excluirBalanceador(codBalanceador: number) {
    return this.http.delete<void>(`${this.api}/balanceadores/${codBalanceador}`);
  }

  // ---------------------------------------------------------------- sistemas

  sistemas() {
    return this.http.get<SistemaCadastro[]>(`${this.api}/sistemas`);
  }

  salvarSistema(s: SistemaCadastro) {
    return this.http.put<SistemaCadastro>(`${this.api}/sistemas/${s.codSistema}`, s);
  }

  excluirSistema(codSistema: number) {
    return this.http.delete<void>(`${this.api}/sistemas/${codSistema}`);
  }
}
