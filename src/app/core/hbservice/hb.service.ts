import { Inject, Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';

import { lastValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { TokenService } from '@core/authentication/token.service';
import { hbserviceInfo, hbserviceStatus } from '@core/interface';


@Injectable({
  providedIn: 'root',
})
export class HbserviceService {

  constructor(private http: HttpClient,
    @Inject(DOCUMENT) private document: Document) { }

  /** Agente local rodando no proprio servidor onde o ntiapi esta instalado. */
  private readonly URL_HBSERVICE = `${environment.hbServiceBaseUrl}`;

  /**
   * Operacoes VNC contra maquinas remotas passam pelo proxy do backend
   * (intranet). Isso permite que usuarios externos as utilizem.
   */
  private readonly URL_VNC_PROXY = `${environment.ApiBaseUrl}vnc`;

  private readonly token = inject(TokenService);

  // =========================================================================
  // Endpoints contra o agente LOCAL do servidor (URL_HBSERVICE) - inalterados
  // =========================================================================

  info() {
    const url: string = this.URL_HBSERVICE + '/info';
    return this.http.get<hbserviceInfo>(url)
      .toPromise()
      .then(response => response);
  }

  notificacaoTexto(json: string) {
    const url: string = this.URL_HBSERVICE + '/notificacao';
    return this.http.put<hbserviceInfo>(url, json)
      .toPromise()
      .then(response => response);
  }

  notificacaoHtml(html: string) {
    const url: string = this.URL_HBSERVICE + '/notificacao?paramentro=' + html + '&tipo=html';
    return this.http.get<hbserviceInfo>(url)
      .toPromise()
      .then(response => response);
  }

  notificacaoBase64(stringBase64: string) {
    const url: string = this.URL_HBSERVICE + '/notificacao?paramentro=' + stringBase64 + '&tipo=imgb64';
    return this.http.get<hbserviceInfo>(url)
      .toPromise()
      .then(response => response);
  }

  healthThis() {
    return this.http.get<hbserviceStatus>(this.URL_HBSERVICE + '/info/health')
      .toPromise()
      .then(response => response)
      .catch(error => {
        console.log(error);
        return error;
      });
  }

  // =========================================================================
  // Endpoints contra maquinas REMOTAS - via proxy do backend
  // =========================================================================
  // Antes: http://<maquina>:9071/<rota>
  // Agora: ${ApiBaseUrl}vnc/<rota>?host=<maquina>&port=9071
  //
  // O proxy backend valida a whitelist e faz a chamada HTTP a partir da
  // intranet, devolvendo o resultado para o cliente externo.
  //
  // Todos os metodos fazem trim() do host para evitar espacos acidentais
  // que causariam "Bad authority" na URL montada pelo backend.
  // Erros HTTP sao relancados como { status, message } para que o componente
  // possa exibir mensagens especificas (ex: 403 = host bloqueado).

  async health(host: string) {
    const url = `${this.URL_VNC_PROXY}/health`;
    try {
      return await lastValueFrom(
        this.http.get<any>(url, { params: { host: host.trim() } })
      );
    } catch (err: any) {
      throw { status: err.status, message: err.error?.error ?? err.message ?? 'Erro desconhecido' };
    }
  }

  /** Versao Observable para uso com pipes (ex: async pipe). */
  healths(host: string) {
    const url = `${this.URL_VNC_PROXY}/health`;
    return this.http.get<hbserviceStatus>(url, { params: { host: host.trim() } });
  }

  async statusVNC(host: string) {
    const url = `${this.URL_VNC_PROXY}/status`;
    try {
      return await lastValueFrom(
        this.http.get<any>(url, { params: { host: host.trim() } })
      );
    } catch (err: any) {
      throw { status: err.status, message: err.error?.error ?? err.message ?? 'Erro desconhecido' };
    }
  }

  async startVNC(host: string) {
    const url = `${this.URL_VNC_PROXY}/start`;
    try {
      return await lastValueFrom(
        this.http.get<any>(url, { params: { host: host.trim() } })
      );
    } catch (err: any) {
      throw { status: err.status, message: err.error?.error ?? err.message ?? 'Erro desconhecido' };
    }
  }

  async stopVNC(host: string) {
    const url = `${this.URL_VNC_PROXY}/stop`;
    try {
      return await lastValueFrom(
        this.http.get<any>(url, { params: { host: host.trim() } })
      );
    } catch (err: any) {
      throw { status: err.status, message: err.error?.error ?? err.message ?? 'Erro desconhecido' };
    }
  }

  async restartVNC(host: string, cmd: string) {
    const url = `${this.URL_VNC_PROXY}/restart`;
    try {
      return await lastValueFrom(
        this.http.put<any>(url, cmd, { params: { host: host.trim() } })
      );
    } catch (err: any) {
      throw { status: err.status, message: err.error?.error ?? err.message ?? 'Erro desconhecido' };
    }
  }

  /**
   * Busca o ultimo acesso de um usuario no sistema (TB_LOG_ACESSO_SISTEMAS).
   * Util para suporte: dado o login, retorna a maquina/IP onde ele esta logado.
   * Retorna null se nao encontrar.
   */
  async buscarUsuarioPorLogin(login: string): Promise<UltimoAcessoUsuario | null> {
    const url = `${this.URL_VNC_PROXY}/lookup/usuario`;
    try {
      return await lastValueFrom(
        this.http.get<UltimoAcessoUsuario>(url, { params: { login } })
      );
    } catch (err: any) {
      if (err?.status === 404) {
        return null;
      }
      throw err;
    }
  }

  // =========================================================================
  // Atualizacao do HBService
  // =========================================================================
  // Atualizacao do HBService
  // =========================================================================

  /**
   * Atualiza os agentes do servidor pelo ntiapi (docs/infraestrutura.md, R-60 e R-61): um atualiza o outro, e só se
   * derruba um com o outro confirmado no ar. O ntiapi conduz o fluxo e manda o progresso por SSE; fechar a tela no
   * meio não interrompe a troca.
   */
  async atualizarAgentes(host: string, aoEtapa: (e: EtapaAtualizacao) => void): Promise<ResultadoAtualizacao> {
    const url = `${environment.ApiBaseUrl}agentes/atualizar?host=${encodeURIComponent(host.trim())}`;
    const resposta = await fetch(url, {
      method: 'POST',
      headers: { Authorization: this.token.getBearerToken(), Accept: 'text/event-stream' },
      cache: 'no-store',
    });
    if (!resposta.ok || !resposta.body) {
      return {
        sucesso: false,
        mensagem: `O NTI recusou a atualização (HTTP ${resposta.status}).`,
        orientacao: resposta.status === 401 ? 'Sua sessão expirou: entre de novo no NTI.' : 'Confira se o ntiapi está no ar e tente de novo.',
        versaoHbService: null,
        versaoAtualizador: null,
      };
    }
    const leitor = resposta.body.getReader();
    const decodificador = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await leitor.read();
      if (done) break;
      buffer += decodificador.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      let fim: number;
      while ((fim = buffer.indexOf('\n\n')) >= 0) {
        const bloco = buffer.substring(0, fim);
        buffer = buffer.substring(fim + 2);
        let nome = 'message';
        const dados: string[] = [];
        for (const linha of bloco.split('\n')) {
          if (linha.startsWith('event:')) nome = linha.substring(6).trim();
          else if (linha.startsWith('data:')) dados.push(linha.substring(5).trim());
        }
        if (!dados.length) continue;
        const objeto = JSON.parse(dados.join('\n'));
        if (nome === 'etapa') aoEtapa(objeto as EtapaAtualizacao);
        else if (nome === 'fim') return objeto as ResultadoAtualizacao;
      }
    }
    return {
      sucesso: false,
      mensagem: 'A conexão com o NTI caiu antes do fim da atualização.',
      orientacao: 'A troca continua no servidor: aguarde 2 minutos e confira a versão (Testar leitura ou nova atualização).',
      versaoHbService: null,
      versaoAtualizador: null,
    };
  }
}
// =============================================================================
// Interfaces
// =============================================================================

/** Resultado da busca de ultimo acesso de usuario. */
export interface UltimoAcessoUsuario {
  usuario: string;
  maquina: string;
  ip: string;
  sistema: string;
  dhAcesso: string;
}

/** Uma linha do progresso da atualização dos agentes. */
export interface EtapaAtualizacao {
  tipo: 'INFO' | 'OK' | 'AVISO' | 'ERRO';
  mensagem: string;
  orientacao: string | null;
}

/** Resultado da atualização dos agentes (evento "fim"). */
export interface ResultadoAtualizacao {
  sucesso: boolean;
  mensagem: string;
  orientacao: string | null;
  versaoHbService: string | null;
  versaoAtualizador: string | null;
}
