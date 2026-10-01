import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ComandoCategoria, ServidorComando, ServidorSsh } from '@core';
import { environment } from '@env/environment';

/** Destino do terminal: servidor cadastrado (codServidor) ou conexão avulsa (host/porta/usuario). */
export interface DestinoSsh {
  codServidor?: number;
  host?: string;
  porta?: number;
  usuario?: string;
}

export interface TokenSsh {
  token: string;
  ttlSeconds: number;
  descricao: string;
}

export interface ComandoCategoriaEdicao {
  codCategoria?: number | null;
  dsCategoria: string;
  nrOrdem: number | null;
}

@Injectable({ providedIn: 'root' })
export class TerminalSshService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.ApiBaseUrl}ssh`;

  listarServidores() {
    return this.http.get<ServidorSsh[]>(`${this.apiUrl}/servidores`);
  }

  emitirToken(destino: DestinoSsh) {
    return this.http.post<TokenSsh>(`${this.apiUrl}/token`, destino);
  }

  /** Comandos de todos os servidores + os vinculados ao servidor. Sem servidor (conexão avulsa): só os de todos. */
  listarComandos(codServidor: number | null) {
    const params = codServidor == null ? new HttpParams() : new HttpParams().set('codServidor', codServidor);
    return this.http.get<ServidorComando[]>(`${this.apiUrl}/comandos`, { params });
  }

  listarTodosComandos() {
    return this.http.get<ServidorComando[]>(`${this.apiUrl}/comandos`, { params: { todos: true } });
  }

  salvarComando(comando: ServidorComando) {
    return comando.codComando
      ? this.http.put<ServidorComando>(`${this.apiUrl}/comandos/${comando.codComando}`, comando)
      : this.http.post<ServidorComando>(`${this.apiUrl}/comandos`, comando);
  }

  excluirComando(codComando: number) {
    return this.http.delete<void>(`${this.apiUrl}/comandos/${codComando}`);
  }

  listarCategorias() {
    return this.http.get<ComandoCategoria[]>(`${this.apiUrl}/categorias`);
  }

  salvarCategoria(categoria: ComandoCategoriaEdicao) {
    return categoria.codCategoria
      ? this.http.put<ComandoCategoria>(`${this.apiUrl}/categorias/${categoria.codCategoria}`, categoria)
      : this.http.post<ComandoCategoria>(`${this.apiUrl}/categorias`, categoria);
  }

  excluirCategoria(codCategoria: number) {
    return this.http.delete<void>(`${this.apiUrl}/categorias/${codCategoria}`);
  }

  /**
   * URL do WebSocket preservando o context-path da API (mesma regra do VNC):
   * "http://server/nti/api/" -> "ws://server/nti/ws/ssh".
   */
  urlWebSocket(token: string): string {
    const apiUrl = new URL(environment.ApiBaseUrl, window.location.href);
    const protocolo = apiUrl.protocol === 'https:' ? 'wss' : 'ws';
    const basePath = apiUrl.pathname.replace(/\/api\/?$/, '').replace(/\/$/, '');
    return `${protocolo}://${apiUrl.host}${basePath}/ws/ssh?token=${encodeURIComponent(token)}`;
  }
}
