import { inject, Injectable, OnDestroy } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { PainelService } from './painel.service';

/**
 * Alerta falado do painel: manda o texto para o serviço de voz configurado em
 * TTS_PAINEL (POST { text } -> audio/wav) e toca os áudios em fila.
 *
 * A fila é encadeada pelo `onended` do próprio áudio decodificado — no painel
 * antigo ela dependia do evento `ended` de um <audio> que nunca tocava, então
 * só o primeiro alerta era falado e os seguintes ficavam presos na fila.
 */
@Injectable({ providedIn: 'root' })
export class PainelTtsService implements OnDestroy {
  private readonly painelService = inject(PainelService);

  private url = '';
  private readonly fila: string[] = [];
  private tocando = false;
  private contexto: AudioContext | null = null;

  ngOnDestroy(): void {
    this.fila.length = 0;
    this.fecharContexto();
  }

  /** Lê a URL do serviço de voz. Sem configuração, o painel simplesmente não fala. */
  async carregarConfiguracao(): Promise<void> {
    try {
      const config = await firstValueFrom(this.painelService.configTts());
      this.url = (config?.valor ?? '').trim();
    } catch {
      this.url = '';
    }
  }

  falar(texto: string | undefined | null): void {
    const frase = (texto ?? '').trim();
    if (!frase || !this.url) return;

    this.fila.push(frase);
    void this.processarFila();
  }

  private async processarFila(): Promise<void> {
    if (this.tocando) return;

    const frase = this.fila.shift();
    if (!frase) return;

    this.tocando = true;
    try {
      await this.tocar(frase);
    } catch (erro) {
      console.error('Painel: falha no alerta falado', erro);
    } finally {
      this.tocando = false;
      if (this.fila.length) void this.processarFila();
    }
  }

  private async tocar(frase: string): Promise<void> {
    const resposta = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'audio/wav' },
      body: JSON.stringify({ text: frase, voice: undefined, download: false }),
    });

    if (!resposta.ok) {
      throw new Error(`Serviço de voz respondeu ${resposta.status} ${resposta.statusText}`);
    }

    const buffer = await resposta.arrayBuffer();
    const contexto = this.obterContexto();

    // A TV abre o painel sem interação do usuário; alguns navegadores deixam o
    // contexto suspenso até um clique. Tentar retomar é o melhor que dá para fazer.
    if (contexto.state === 'suspended') {
      try { await contexto.resume(); } catch { /* noop */ }
    }

    const audio = await contexto.decodeAudioData(buffer);

    await new Promise<void>(resolve => {
      const fonte = contexto.createBufferSource();
      fonte.buffer = audio;
      fonte.connect(contexto.destination);
      fonte.onended = () => resolve();
      fonte.start(0);
    });
  }

  private obterContexto(): AudioContext {
    if (!this.contexto || this.contexto.state === 'closed') {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      this.contexto = new Ctor();
    }
    return this.contexto;
  }

  private fecharContexto(): void {
    if (this.contexto && this.contexto.state !== 'closed') {
      try { void this.contexto.close(); } catch { /* noop */ }
    }
    this.contexto = null;
  }
}
