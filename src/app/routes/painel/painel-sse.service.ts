import { Injectable, OnDestroy, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';

import { Alerta } from '@core';
import { environment } from '@env/environment';

export type EstadoConexao = 'CONECTADO' | 'CONECTANDO' | 'DESCONECTADO';

/**
 * Alertas do painel por SSE (`GET /api/painel/alertas/stream`).
 *
 * Substitui o WebSocket/STOMP por dois motivos:
 *
 * 1. Cluster. O alerta nasce numa instância, mas a TV pode estar conectada em
 *    outra. No WebSocket cada nó só alcançava os seus clientes, e a volta era
 *    cada nó reenviar o alerta aos outros por HTTP usando a lista fixa da
 *    configuração WEBSOCKET_SERVERS — instância fora da lista ficava muda e
 *    instância desligada gerava erro a cada alerta. No SSE o backend lê a fila
 *    em TB_PAINEL_EVENTO, que é a mesma para todas as instâncias.
 *
 * 2. Infraestrutura. SSE é HTTP comum: atravessa proxy e balanceador sem
 *    configuração de upgrade, e o EventSource reconecta sozinho mandando o
 *    Last-Event-ID — o painel volta do ponto onde parou, sem código de retry.
 */
@Injectable({ providedIn: 'root' })
export class PainelSseService implements OnDestroy {
  /** Estado da conexão, exibido na barra de status do painel. */
  readonly estado = signal<EstadoConexao>('DESCONECTADO');

  /** Quedas desde a última conexão boa; zera ao reconectar. */
  readonly quedas = signal(0);

  private fonte: EventSource | null = null;
  private encerrado = false;

  private readonly alertas$ = new Subject<Alerta>();

  ngOnDestroy(): void {
    this.desconectar();
    this.alertas$.complete();
  }

  alertas(): Observable<Alerta> {
    return this.alertas$.asObservable();
  }

  conectar(): void {
    if (this.fonte) return;

    this.encerrado = false;
    this.estado.set('CONECTANDO');

    let fonte: EventSource;
    try {
      fonte = new EventSource(this.urlStream());
    } catch (erro) {
      console.error('Painel: não foi possível abrir o fluxo de alertas', erro);
      this.estado.set('DESCONECTADO');
      return;
    }
    this.fonte = fonte;

    fonte.onopen = () => {
      this.estado.set('CONECTADO');
      this.quedas.set(0);
    };

    fonte.addEventListener('alerta', (evento: MessageEvent) => this.emitir(evento.data));

    fonte.onerror = () => {
      if (this.encerrado) return;
      // O EventSource reconecta sozinho; aqui só refletimos o estado na tela.
      this.estado.set(fonte.readyState === EventSource.CLOSED ? 'DESCONECTADO' : 'CONECTANDO');
      this.quedas.update(n => n + 1);
    };
  }

  desconectar(): void {
    this.encerrado = true;
    if (this.fonte) {
      try { this.fonte.close(); } catch { /* noop */ }
      this.fonte = null;
    }
    this.estado.set('DESCONECTADO');
  }

  private urlStream(): string {
    return `${environment.ApiBaseUrl}painel/alertas/stream`;
  }

  private emitir(corpo: string): void {
    let alerta: Alerta | null = null;
    try {
      alerta = JSON.parse(corpo) as Alerta;
    } catch {
      return;
    }
    if (alerta?.tipo) {
      this.alertas$.next(alerta);
    }
  }
}
