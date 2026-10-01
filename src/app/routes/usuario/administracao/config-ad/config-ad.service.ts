import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '@env/environment';

export interface ConfiguracaoAd {
  ativo: boolean;
  url: string | null;
  dominio: string | null;
  baseDn: string | null;
  usuarioBind: string | null;
  /** Só entrada: nova senha da conta de serviço (vazia = mantém a gravada). */
  senhaBind?: string | null;
  removerSenhaBind?: boolean;
  /** Só saída: existe senha gravada. */
  senhaBindDefinida?: boolean;
  filtroUsuario: string | null;
  grupoPermitido: string | null;
  timeoutMs: number | null;
  autoAtivacao: boolean;
  /** Login automático com o usuário do Windows (Kerberos). */
  sso: boolean;
  /** HTTP/nome.dns.do.servidor@DOMINIO */
  spn: string | null;
  /** Caminho do keytab no servidor do backend. */
  keytab: string | null;
  dtAtualizacao?: string | null;
  usuarioAtualizacao?: string | null;
}

export interface ResultadoTesteAd {
  sucesso: boolean;
  etapas: { ok: boolean; mensagem: string }[];
  /** defaultNamingContext informado pelo servidor. */
  baseDnSugerido: string | null;
}

@Injectable({ providedIn: 'root' })
export class ConfigAdService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.ApiBaseUrl}admin/ad`;

  obter() {
    return this.http.get<ConfiguracaoAd>(this.apiUrl);
  }

  salvar(configuracao: ConfiguracaoAd) {
    return this.http.put<ConfiguracaoAd>(this.apiUrl, configuracao);
  }

  /** Testa os valores da tela sem salvar; usuário/senha opcionais testam também a autenticação. */
  testar(configuracao: ConfiguracaoAd, usuario: string | null, senha: string | null) {
    return this.http.post<ResultadoTesteAd>(`${this.apiUrl}/testar`, { configuracao, usuario, senha });
  }
}
