import { Injectable, NgZone, inject } from '@angular/core';
import { TokenService } from '@core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';

/** Aviso do servidor: algo mudou na homologação (a tela busca o detalhe de novo). */
export interface MudancaHomologacao {
  codEvento: number;
  codHomologacao: number;
  tipo: string;
  codItem: number | null;
  codUsuario: number;
}

export type EventoTempoReal = { tipo: 'conectado' } | { tipo: 'desconectado' } | { tipo: 'mudanca'; mudanca: MudancaHomologacao };

const ESPERA_INICIAL_MS = 2_000;
const ESPERA_MAXIMA_MS = 30_000;

/**
 * Tempo real das homologações (SSE em `GET /api/homologacao/eventos/stream`).
 *
 * Abre com fetch, não com EventSource, porque o fluxo exige o cabeçalho Authorization (o EventSource não manda
 * cabeçalho). Reconecta sozinho com espera crescente; ao reconectar, a tela recarrega para pegar o que perdeu.
 */
@Injectable({ providedIn: 'root' })
export class HomologacaoTempoRealService {
  private readonly token = inject(TokenService);
  private readonly zone = inject(NgZone);
  private readonly url = `${environment.ApiBaseUrl}homologacao/eventos/stream`;

  /** Eventos de uma homologação, ou de todas (painel) sem código. Cancelar a inscrição fecha a conexão. */
  acompanhar(codHomologacao: number | null): Observable<EventoTempoReal> {
    return new Observable<EventoTempoReal>(assinante => {
      let ativo = true;
      let controle: AbortController | null = null;
      let espera = ESPERA_INICIAL_MS;
      let temporizador: ReturnType<typeof setTimeout> | undefined;

      const emitir = (evento: EventoTempoReal) => this.zone.run(() => assinante.next(evento));

      const reconectar = () => {
        if (!ativo) return;
        emitir({ tipo: 'desconectado' });
        temporizador = setTimeout(conectar, espera);
        espera = Math.min(espera * 2, ESPERA_MAXIMA_MS);
      };

      const conectar = () => {
        if (!ativo) return;
        controle = new AbortController();
        const endereco = codHomologacao ? `${this.url}?cod=${codHomologacao}` : this.url;
        fetch(endereco, {
          headers: { Authorization: this.token.getBearerToken(), Accept: 'text/event-stream' },
          signal: controle.signal,
          cache: 'no-store',
        })
          .then(async resposta => {
            if (!resposta.ok || !resposta.body) throw new Error(`HTTP ${resposta.status}`);
            espera = ESPERA_INICIAL_MS;
            await this.ler(resposta.body, emitir);
            reconectar();
          })
          .catch(() => reconectar());
      };

      // Fora da zona: a conexão fica aberta e não deve disparar detecção de mudança a cada pedaço lido.
      this.zone.runOutsideAngular(conectar);

      return () => {
        ativo = false;
        clearTimeout(temporizador);
        controle?.abort();
      };
    });
  }

  /** Lê o text/event-stream e entrega cada evento com nome e dados JSON. */
  private async ler(corpo: ReadableStream<Uint8Array>, emitir: (e: EventoTempoReal) => void) {
    const leitor = corpo.getReader();
    const decodificador = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await leitor.read();
      if (done) return;
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
        if (nome === 'conectado') {
          emitir({ tipo: 'conectado' });
        } else if (nome === 'mudanca' && dados.length) {
          try {
            emitir({ tipo: 'mudanca', mudanca: JSON.parse(dados.join('\n')) });
          } catch {
            // evento malformado: ignora, o próximo recarrega
          }
        }
      }
    }
  }
}
