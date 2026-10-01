import { Injectable, NgZone, OnDestroy, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';

import { environment } from '@env/environment';

/**
 * Evento de tempo real da tela de Escala.
 * Espelha `EscalaEventoDTO` do backend (ntiapi).
 */
export interface EscalaEvento {
  tipo:
    | 'PLANTAO_SALVO'
    | 'PLANTAO_REMOVIDO'
    | 'AUSENCIA_SALVA'
    | 'AUSENCIA_REMOVIDA'
    | 'ESCALA_PUBLICADA'
    | 'ESCALA_REVERTIDA'
    | string;
  mesEscala: number;
  autorId?: number | null;
  autorNome?: string | null;
  dia?: number | null;
  idUsuarioAlvo?: number | null;
  plantaoId?: number | null;
  ausenciaId?: number | null;
  timestamp?: number;
}

const NULL = '\u0000';

/**
 * Cliente STOMP mínimo sobre WebSocket nativo — apenas o suficiente para
 * receber eventos publicados pelo servidor em `/topic/escala/{mesEscala}`.
 *
 * Não adiciona dependências ao projeto. Reconecta automaticamente com backoff
 * e é totalmente tolerante a falhas: se o WebSocket não estiver disponível, a
 * tela de Escala continua funcionando normalmente (só não recebe atualização
 * em tempo real).
 */
@Injectable({ providedIn: 'root' })
export class EscalaRealtimeService implements OnDestroy {

  private readonly zone = inject(NgZone);

  private ws: WebSocket | null = null;
  private conectado = false;
  private conectando = false;
  private tentativaReconexao = 0;
  private reconexaoTimer: any = null;
  private heartbeatTimer: any = null;

  /** destino STOMP -> id de subscription */
  private subscriptions = new Map<string, string>();
  /** destino STOMP -> nº de consumidores (para desinscrever quando zerar) */
  private refCount = new Map<string, number>();
  private subSeq = 0;

  private eventos$ = new Subject<EscalaEvento>();
  private destruido = false;

  ngOnDestroy(): void {
    this.destruido = true;
    this.limparTimers();
    this.fecharSocket();
    this.eventos$.complete();
  }

  /**
   * Observa os eventos de um mês específico (YYYYMM). O WebSocket é aberto sob
   * demanda e a subscription STOMP é liberada quando não houver mais interesse.
   */
  observarMes(mesEscala: number): Observable<EscalaEvento> {
    const destino = `/topic/escala/${mesEscala}`;
    this.registrarInteresse(destino);

    return new Observable<EscalaEvento>(observer => {
      const sub = this.eventos$
        .pipe(filter(evt => Number(evt.mesEscala) === Number(mesEscala)))
        .subscribe(observer);

      return () => {
        sub.unsubscribe();
        this.liberarInteresse(destino);
      };
    });
  }

  // ───────────────────────── conexão ─────────────────────────

  private wsUrl(): string {
    // Deriva de ApiBaseUrl (ex.: http://host:8080/nti/api/ -> ws://host:8080/nti/socket)
    try {
      const base = environment.ApiBaseUrl || '';
      if (base) {
        const u = new URL(base, window.location.origin);
        const proto = u.protocol === 'https:' ? 'wss:' : 'ws:';
        const path = u.pathname.replace(/\/api\/?$/, '/socket').replace(/\/+$/, '');
        return `${proto}//${u.host}${path}`;
      }
    } catch {
      /* cai no fallback */
    }
    return (environment as any).webSockerBaseUrl || `ws://${window.location.hostname}:8080/nti/socket`;
  }

  private registrarInteresse(destino: string): void {
    this.refCount.set(destino, (this.refCount.get(destino) || 0) + 1);
    this.conectar();
    if (this.conectado) {
      this.enviarSubscribe(destino);
    }
  }

  private liberarInteresse(destino: string): void {
    const n = (this.refCount.get(destino) || 1) - 1;
    if (n <= 0) {
      this.refCount.delete(destino);
      this.enviarUnsubscribe(destino);
    } else {
      this.refCount.set(destino, n);
    }
  }

  private conectar(): void {
    if (this.destruido || this.conectado || this.conectando) return;
    this.conectando = true;

    // WebSocket fora da zona do Angular para não disparar change detection à toa;
    // reentramos na zona só ao emitir um evento.
    this.zone.runOutsideAngular(() => {
      let socket: WebSocket;
      try {
        socket = new WebSocket(this.wsUrl());
      } catch (e) {
        this.conectando = false;
        this.agendarReconexao();
        return;
      }
      this.ws = socket;

      socket.onopen = () => {
        // CONNECT STOMP
        socket.send(
          `CONNECT\naccept-version:1.2\nheart-beat:10000,10000\n\n${NULL}`,
        );
      };

      socket.onmessage = (msg: MessageEvent) => this.onFrame(String(msg.data));

      socket.onclose = () => {
        this.conectado = false;
        this.conectando = false;
        this.limparTimers();
        if (!this.destruido) this.agendarReconexao();
      };

      socket.onerror = () => {
        // onclose será chamado em seguida e trata a reconexão
        try { socket.close(); } catch { /* noop */ }
      };
    });
  }

  private onFrame(data: string): void {
    // Um pacote pode conter múltiplos frames separados por NULL.
    for (const raw of data.split(NULL)) {
      const frame = raw.replace(/^\n+/, '');
      if (!frame) continue;

      const sepIdx = frame.indexOf('\n\n');
      const cabecalho = sepIdx >= 0 ? frame.substring(0, sepIdx) : frame;
      const corpo = sepIdx >= 0 ? frame.substring(sepIdx + 2) : '';
      const linhas = cabecalho.split('\n');
      const comando = (linhas.shift() || '').trim();

      if (comando === 'CONNECTED') {
        this.conectado = true;
        this.conectando = false;
        this.tentativaReconexao = 0;
        this.iniciarHeartbeat();
        // (re)assina todos os destinos de interesse
        for (const destino of this.refCount.keys()) {
          this.enviarSubscribe(destino);
        }
      } else if (comando === 'MESSAGE') {
        this.emitir(corpo);
      }
      // ERROR / RECEIPT: ignorados de propósito
    }
  }

  private emitir(corpo: string): void {
    let evt: EscalaEvento | null = null;
    try {
      evt = JSON.parse(corpo);
    } catch {
      return;
    }
    if (!evt || evt.mesEscala == null) return;
    this.zone.run(() => this.eventos$.next(evt as EscalaEvento));
  }

  private enviarSubscribe(destino: string): void {
    if (!this.conectado || !this.ws) return;
    if (this.subscriptions.has(destino)) return;
    const id = `sub-escala-${this.subSeq++}`;
    this.subscriptions.set(destino, id);
    this.ws.send(`SUBSCRIBE\nid:${id}\ndestination:${destino}\n\n${NULL}`);
  }

  private enviarUnsubscribe(destino: string): void {
    const id = this.subscriptions.get(destino);
    if (!id) return;
    this.subscriptions.delete(destino);
    if (this.conectado && this.ws) {
      try {
        this.ws.send(`UNSUBSCRIBE\nid:${id}\n\n${NULL}`);
      } catch { /* noop */ }
    }
  }

  private iniciarHeartbeat(): void {
    this.limparHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.conectado) {
        try { this.ws.send('\n'); } catch { /* noop */ }
      }
    }, 10000);
  }

  private agendarReconexao(): void {
    if (this.destruido || this.reconexaoTimer) return;
    if (this.refCount.size === 0) return; // ninguém interessado
    const espera = Math.min(30000, 1000 * Math.pow(2, this.tentativaReconexao++));
    this.reconexaoTimer = setTimeout(() => {
      this.reconexaoTimer = null;
      this.subscriptions.clear();
      this.conectar();
    }, espera);
  }

  private limparHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private limparTimers(): void {
    this.limparHeartbeat();
    if (this.reconexaoTimer) {
      clearTimeout(this.reconexaoTimer);
      this.reconexaoTimer = null;
    }
  }

  private fecharSocket(): void {
    if (this.ws) {
      try { this.ws.close(); } catch { /* noop */ }
      this.ws = null;
    }
    this.conectado = false;
    this.conectando = false;
  }
}
