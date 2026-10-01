import { Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';

import { lastValueFrom } from 'rxjs';
import { environment } from '@env/environment';
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

  private readonly HBSERVICE_PORT = 9071;
  private readonly HBSERVICE_UPDATE_PORT = 9072;

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
   * Fluxo completo de atualizacao do HBService na maquina cliente.
   *
   * TODAS as chamadas passam pelo proxy /api/vnc/agente/* do ntiapi —
   * o browser NUNCA acessa diretamente a intranet. Isso resolve falhas
   * em maquinas especificas onde o browser nao tem rota para a intranet.
   *
   * 0.  Mata instância anterior do update.exe (evita conflito na porta 9072)
   * 1.  Health check porta 9071 (via proxy)
   * 2.  xcopy exe da rede → destino local (via proxy)
   * 3.  Abre exe via /processo/abrir — endpoint dedicado, nao trava (via proxy)
   * 3B. Confirma processo no tasklist (via proxy)
   * 4.  Aguarda hbService voltar — porta 9071 (via proxy)
   * 4B. Aguarda update service subir — porta 9072 (via proxy)
   * 5.  POST /update/url (via proxy)
   */
  async atualizarHbService(
    host: string,
    params: AtualizacaoParams,
    onProgress?: (etapa: string) => void
  ): Promise<AtualizacaoResult> {

    host = host.trim();
    const proxy      = this.URL_VNC_PROXY;          // ${ApiBaseUrl}vnc
    const portHb     = this.HBSERVICE_PORT;          // 9071
    const portUpdate = this.HBSERVICE_UPDATE_PORT;   // 9072

    /** Executa comando no agente via proxy (PUT /agente/executar).
     *  REQUER: VncHealthProxyController deployado com endpoint /agente/executar */
    const executar = (processo: string) =>
      lastValueFrom(
        this.http.put<any>(`${proxy}/agente/executar`,
          null, { params: { host, port: portHb, processo } })
      );

    /** Health check via proxy.
     *  Porta 9071: usa /health já existente no servidor.
     *  Porta 9072: usa /agente/health (REQUER novo deploy do backend). */
    const healthProxy = (port: number) => {
      if (port === this.HBSERVICE_PORT) {
        // endpoint já existe — /api/vnc/health?host=X (sem param port, usa default 9071)
        return lastValueFrom(
          this.http.get<any>(`${proxy}/health`, { params: { host } })
        );
      }
      // porta customizada (9072) — requer novo endpoint /agente/health
      return lastValueFrom(
        this.http.get<any>(`${proxy}/agente/health`, { params: { host, port } })
      );
    };

    /** Extrai texto da resposta do /processo/executar.
     *  Cobre: { output }, { resultado }, { mensagem }, string direta,
     *  e como ultimo recurso serializa o objeto inteiro para busca. */
    const saida = (res: any): string => {
      if (typeof res === 'string') return res.trim();
      const texto = res?.output ?? res?.resultado ?? res?.mensagem ?? res?.retorno ?? null;
      if (texto != null) return String(texto).trim();
      // fallback: serializa o objeto — pelo menos nao perde dados inesperados
      return JSON.stringify(res ?? '');
    };

    const progresso = (msg: string) => {
      console.log(`[HBService Update] ${msg}`);
      if (onProgress) onProgress(msg);
    };

    try {
      const exeNome = params.exeDestino.split('\\').pop() ?? 'hbServiceUpdate.exe';

      // =================================================================
      // ETAPA 0 — Matar instância anterior do update.exe (blind kill)
      //
      // taskkill falha silenciosamente se o processo nao existe — nao precisa
      // verificar com tasklist antes. Isso evita depender do stdout do agente.
      // =================================================================
      progresso(`Encerrando instância anterior de ${exeNome} (se houver)...`);
      try {
        await executar(`taskkill /F /IM "${exeNome}"`);
        await new Promise(r => setTimeout(r, 2000));
        progresso('Instância anterior encerrada (ou não existia) ✓');
      } catch {
        progresso('Nenhuma instância anterior encontrada ✓');
      }

      // =================================================================
      // ETAPA 1 — Health check porta 9071
      // =================================================================
      progresso('Verificando HBService (porta 9071)...');
      const health1 = await healthProxy(portHb).catch(() => null);
      if (!health1) {
        return { sucesso: false, etapa: 'health-check',
                 mensagem: 'HBService não responde na porta 9071.' };
      }

      // =================================================================
      // ETAPA 2 — xcopy
      // =================================================================
      progresso('Copiando executável de atualização...');
      await executar(`xcopy "${params.caminhoExeRede}" "${params.destinoLocal}" /Y /I`)
        .catch(e => { throw new Error(`Falha no xcopy: ${e.message}`); });

      // =================================================================
      // ETAPA 3 — Abrir exe via /processo/abrir (endpoint dedicado)
      //
      // /processo/abrir lanca o exe como processo independente sem
      // aguardar retorno — correto para iniciar um servico.
      // /processo/executar aguarda o fim do processo e travaria aqui.
      // =================================================================
      progresso('Iniciando executável de atualização...');
      await lastValueFrom(
        this.http.put<any>(`${proxy}/agente/abrir`,
          null, { params: { host, port: portHb, processo: params.exeDestino } })
      ).catch(e => { throw new Error(`Falha ao iniciar exe: ${e.message}`); });

      // =================================================================
      // ETAPA 3B — Confirmar que o processo subiu aguardando porta 9072
      //
      // O agente nao retorna stdout de /processo/executar de forma confiavel.
      // Em vez de tasklist, aguardamos a porta 9072 responder — se o exe
      // subiu e abriu a porta, o processo definitivamente esta rodando.
      // Timeout curto (20s) para falhar rapido antes do wait longo da ETAPA 4.
      // =================================================================
      progresso('Aguardando serviço de atualização iniciar (porta 9072)...');
      const timeout = params.timeoutReinicioSeg ?? 60;
      const updateSubiu = await this.aguardarHealthProxy(proxy, host, portUpdate, 20, 2000);
      if (!updateSubiu) {
        return { sucesso: false, etapa: 'abrir-exe',
                 mensagem: `Serviço de atualização (porta 9072) não respondeu em 20s. `
                         + `Verifique se "${exeNome}" iniciou corretamente (permissões, antivírus, firewall).` };
      }
      progresso('Serviço de atualização ativo na porta 9072 ✓');

      // =================================================================
      // ETAPA 4 — Aguardar hbService voltar (porta 9071)
      // =================================================================
      progresso('Aguardando HBService reiniciar...');
      const hbOk = await this.aguardarHealthProxy(proxy, host, portHb, timeout, 3000);
      if (!hbOk) {
        return { sucesso: false, etapa: 'aguardar-restart',
                 mensagem: `HBService não voltou após ${timeout}s.` };
      }
      progresso('HBService ativo ✓');

      // =================================================================
      // ETAPA 5 — POST /update/url
      // =================================================================
      progresso('Disparando atualização...');
      await lastValueFrom(
        this.http.post<any>(
          `${proxy}/agente/update`,
          JSON.stringify({ url: params.urlUpdate }),
          { params: { host, port: portUpdate },
            headers: { 'Content-Type': 'application/json' } }
        )
      ).catch(e => { throw new Error(`Falha ao disparar update: ${e.message}`); });

      progresso('Atualização concluída com sucesso!');
      return { sucesso: true, etapa: 'concluido', mensagem: 'HBService atualizado com sucesso.' };

    } catch (err: any) {
      return { sucesso: false, etapa: 'erro',
               mensagem: err.message ?? 'Erro desconhecido.' };
    }
  }

  /** Polling de /agente/health via proxy até responder ou timeout. */
  private async aguardarHealthProxy(
    proxy: string, host: string, port: number,
    timeoutSeg: number, intervalMs: number
  ): Promise<boolean> {
    const limite = Date.now() + timeoutSeg * 1000;
    // Porta 9071 usa endpoint já existente; outras portas usam /agente/health (novo deploy)
    const url = port === this.HBSERVICE_PORT
      ? `${proxy}/health`
      : `${proxy}/agente/health`;
    const params: any = port === this.HBSERVICE_PORT
      ? { host }
      : { host, port };

    while (Date.now() < limite) {
      await new Promise(r => setTimeout(r, intervalMs));
      try {
        await lastValueFrom(this.http.get<any>(url, { params }));
        return true;
      } catch { /* continua */ }
    }
    return false;
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

/** Parametros necessarios para executar o fluxo de atualizacao do HBService. */
export interface AtualizacaoParams {
  /** Caminho UNC do exe na rede. Ex: \\172.17.0.56\mv2000\TI\...\hbServiceUpdate.exe */
  caminhoExeRede: string;

  /** Diretorio de destino na maquina cliente. Ex: C:\Trabalho\app_hb\hbService\ */
  destinoLocal: string;

  /** Caminho completo do exe apos a copia. Ex: C:\Trabalho\app_hb\hbService\hbServiceUpdate.exe */
  exeDestino: string;

  /** URL do pacote de atualizacao. Ex: http://srv-ntic.hbase.local:8091/update/hbService.exe */
  urlUpdate: string;

  /** Timeout em segundos para aguardar o HBService reiniciar. Padrao: 60s */
  timeoutReinicioSeg?: number;
}

/**
 * Download do HB Service: o próprio ntiapi serve o hbService.exe que vai dentro do WAR (docs/infraestrutura.md, R-58),
 * em <base>/update/hbService.exe. Em desenvolvimento (localhost) as máquinas não alcançam este endereço: usa o
 * servidor de download antigo.
 */
export function urlHbServiceDoNti(): string {
  const api = new URL(environment.ApiBaseUrl, window.location.href);
  if (api.hostname === 'localhost' || api.hostname === '127.0.0.1') {
    return 'http://srv-ntic.hbase.local:8091/update/hbService.exe';
  }
  return api.href.replace(/api\/?$/, '') + 'update/hbService.exe';
}

/** Parâmetros padrão da atualização do HB Service (tela do VNC e Infraestrutura). */
export function parametrosAtualizacaoPadrao(): AtualizacaoParams {
  return {
    caminhoExeRede: '\\\\172.17.0.56\\mv2000\\TI\\Celio\\HBService\\hbServiceUpdate.exe',
    destinoLocal: 'C:\\Trabalho\\app_hb\\hbService\\',
    exeDestino: 'C:\\Trabalho\\app_hb\\hbService\\hbServiceUpdate.exe',
    urlUpdate: urlHbServiceDoNti(),
    timeoutReinicioSeg: 60,
  };
}

/** Resultado retornado pelo fluxo de atualizacao. */
export interface AtualizacaoResult {
  sucesso: boolean;
  /** Nome da etapa onde ocorreu sucesso ou falha. */
  etapa: 'health-check' | 'copiar-exe' | 'verificar-copia' | 'abrir-exe' | 'aguardar-restart' | 'update-url' | 'concluido' | 'erro';
  mensagem: string;
}
