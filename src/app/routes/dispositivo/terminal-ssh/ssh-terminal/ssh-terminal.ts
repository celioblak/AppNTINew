import { Clipboard } from '@angular/cdk/clipboard';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';

import { DestinoSsh, TerminalSshService } from '../terminal-ssh.service';

export type StatusTerminal = 'CONECTANDO' | 'CONECTADO' | 'DESCONECTADO' | 'ERRO';

export interface EventoStatusTerminal {
  status: StatusTerminal;
  mensagem: string;
  chaveHost?: string;
}

/** Eventos JSON enviados pelo SshTerminalHandler; a saída do terminal chega em frames binários. */
interface EventoServidor {
  type: 'status' | 'error' | 'pong';
  status?: 'CONECTANDO' | 'CONECTADO' | 'DESCONECTADO';
  message?: string;
  hostKey?: string;
}

/** Caracteres por mensagem de input: mesmo com escapes JSON fica abaixo do limite de 64 KB do WebSocket. */
const TAMANHO_BLOCO_ENVIO = 8_000;
const INTERVALO_PING_MS = 25_000;
const FONTE_MINIMA = 9;
const FONTE_MAXIMA = 28;

const TEMA = {
  background: '#0f1419',
  foreground: '#e6e1cf',
  cursor: '#ffcc66',
  cursorAccent: '#0f1419',
  selectionBackground: '#33415e',
  black: '#1c2328',
  red: '#f07178',
  green: '#aad94c',
  yellow: '#ffb454',
  blue: '#59c2ff',
  magenta: '#d2a6ff',
  cyan: '#95e6cb',
  white: '#c7c7c7',
  brightBlack: '#686868',
  brightRed: '#ff8f8f',
  brightGreen: '#c2ff66',
  brightYellow: '#ffd173',
  brightBlue: '#73d0ff',
  brightMagenta: '#dfbfff',
  brightCyan: '#a6f0db',
  brightWhite: '#ffffff',
};

/** Um terminal xterm.js ligado ao WebSocket /ws/ssh (protocolo descrito no SshTerminalHandler do backend). */
@Component({
  selector: 'app-ssh-terminal',
  template: '<div class="terminal-host" #host></div>',
  styleUrl: './ssh-terminal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SshTerminalComponent {
  readonly abaId = input.required<number>();
  readonly destino = input.required<DestinoSsh>();
  /** Senha da conexão avulsa; servidores cadastrados usam a credencial guardada no backend. */
  readonly senha = input<string>();
  readonly statusChange = output<EventoStatusTerminal>();

  private readonly service = inject(TerminalSshService);
  private readonly clipboard = inject(Clipboard);
  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');

  private readonly terminal = new Terminal({
    cursorBlink: true,
    fontFamily: "'Cascadia Mono', 'Fira Code', Consolas, 'DejaVu Sans Mono', monospace",
    fontSize: 14,
    lineHeight: 1.1,
    scrollback: 10_000,
    theme: TEMA,
  });
  private readonly ajuste = new FitAddon();
  private readonly busca = new SearchAddon();
  private socket?: WebSocket;
  private ping?: ReturnType<typeof setInterval>;
  private status: StatusTerminal = 'CONECTANDO';

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const elemento = this.host().nativeElement;
      this.terminal.loadAddon(this.ajuste);
      this.terminal.loadAddon(this.busca);
      this.terminal.loadAddon(new WebLinksAddon());
      this.terminal.open(elemento);
      this.terminal.attachCustomKeyEventHandler(evento => this.tratarAtalho(evento));
      this.terminal.onData(dados => this.enviarTexto(dados));
      this.terminal.onResize(({ cols, rows }) => this.enviar({ type: 'resize', cols, rows }));

      // Cobre redimensionamento da janela, painéis recolhidos e a aba voltando a ficar visível.
      const observador = new ResizeObserver(() => this.ajustarTamanho());
      observador.observe(elemento);
      this.ajustarTamanho();
      this.conectar();

      destroyRef.onDestroy(() => {
        observador.disconnect();
        this.desconectar();
        this.terminal.dispose();
      });
    });
  }

  reconectar() {
    this.desconectar();
    this.terminal.write('\r\n\x1b[90m--- reconectando ---\x1b[0m\r\n');
    this.conectar();
  }

  /** Digita um texto no shell; quebras de linha viram Enter. */
  digitar(texto: string, pressionarEnter: boolean) {
    const normalizado = texto.replace(/\r?\n/g, '\r').replace(/\r+$/, '');
    this.enviarTexto(pressionarEnter ? normalizado + '\r' : normalizado);
    this.terminal.focus();
  }

  colar(texto: string) {
    this.terminal.paste(texto);
    this.terminal.focus();
  }

  limpar() {
    this.terminal.clear();
    this.terminal.focus();
  }

  selecao(): string {
    return this.terminal.getSelection();
  }

  localizar(termo: string, proximo: boolean) {
    if (proximo) {
      this.busca.findNext(termo);
    } else {
      this.busca.findPrevious(termo);
    }
  }

  alterarFonte(delta: number) {
    const atual = this.terminal.options.fontSize ?? 14;
    this.terminal.options.fontSize = Math.min(FONTE_MAXIMA, Math.max(FONTE_MINIMA, atual + delta));
    this.ajustarTamanho();
  }

  private conectar() {
    this.atualizarStatus('CONECTANDO', 'Solicitando autorização...');
    this.service.emitirToken(this.destino()).subscribe({
      next: ({ token }) => this.abrirSocket(token),
      // O errorInterceptor já exibe o motivo em toast; aqui fica só o estado da aba.
      error: (erro: Error) => this.atualizarStatus('ERRO', erro.message || 'Não foi possível autorizar a conexão.'),
    });
  }

  private abrirSocket(token: string) {
    const socket = new WebSocket(this.service.urlWebSocket(token));
    socket.binaryType = 'arraybuffer';
    this.socket = socket;
    let aberto = false;

    socket.onopen = () => {
      aberto = true;
      socket.send(JSON.stringify({ type: 'start', cols: this.terminal.cols, rows: this.terminal.rows, senha: this.senha() }));
      this.ping = setInterval(() => this.enviar({ type: 'ping' }), INTERVALO_PING_MS);
    };

    socket.onmessage = evento => {
      if (evento.data instanceof ArrayBuffer) {
        this.terminal.write(new Uint8Array(evento.data));
      } else {
        this.tratarEvento(JSON.parse(evento.data) as EventoServidor);
      }
    };

    socket.onclose = evento => {
      if (this.socket !== socket) {
        return; // substituído por uma reconexão ou fechado de propósito
      }
      this.pararPing();
      this.socket = undefined;
      if (!aberto) {
        this.atualizarStatus('ERRO', 'Não foi possível abrir o WebSocket do terminal (token expirado ou bloqueado por proxy).');
      } else if (this.status !== 'ERRO') {
        this.atualizarStatus('DESCONECTADO', evento.reason || 'Conexão encerrada.');
      }
      this.terminal.write('\r\n\x1b[90m--- sessão encerrada: use Reconectar para abrir de novo ---\x1b[0m\r\n');
    };
  }

  private tratarEvento(evento: EventoServidor) {
    if (evento.type === 'error') {
      this.atualizarStatus('ERRO', evento.message ?? 'Erro no terminal.');
      this.terminal.write(`\r\n\x1b[31m${evento.message}\x1b[0m\r\n`);
      return;
    }
    if (evento.type !== 'status' || !evento.status) {
      return;
    }
    if (evento.status === 'DESCONECTADO' && this.status === 'ERRO') {
      return; // mantém o motivo do erro visível
    }
    this.atualizarStatus(evento.status, evento.message ?? '', evento.hostKey);
    if (evento.status === 'CONECTADO') {
      this.ajustarTamanho();
      this.enviar({ type: 'resize', cols: this.terminal.cols, rows: this.terminal.rows });
      this.terminal.focus();
    }
  }

  /** false = o xterm ignora a tecla e o navegador segue o padrão (ex.: disparar o colar). */
  private tratarAtalho(evento: KeyboardEvent): boolean {
    if (evento.type !== 'keydown' || !evento.ctrlKey) {
      return true;
    }
    const tecla = evento.key.toLowerCase();
    // Ctrl+Shift+C sempre copia; Ctrl+C só copia quando há seleção (sem seleção envia SIGINT).
    if (tecla === 'c' && (evento.shiftKey || this.terminal.hasSelection())) {
      const selecao = this.terminal.getSelection();
      if (selecao) {
        this.clipboard.copy(selecao);
      }
      return false;
    }
    return tecla !== 'v';
  }

  private enviarTexto(texto: string) {
    for (let inicio = 0; inicio < texto.length; ) {
      let fim = Math.min(inicio + TAMANHO_BLOCO_ENVIO, texto.length);
      const codigo = texto.charCodeAt(fim - 1);
      if (fim < texto.length && codigo >= 0xd800 && codigo <= 0xdbff) {
        fim--; // não separa um par surrogate (emoji) entre duas mensagens
      }
      this.enviar({ type: 'input', data: texto.slice(inicio, fim) });
      inicio = fim;
    }
  }

  private enviar(mensagem: object) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(mensagem));
    }
  }

  private ajustarTamanho() {
    const elemento = this.host().nativeElement;
    if (elemento.offsetWidth > 0 && elemento.offsetHeight > 0) {
      this.ajuste.fit();
    }
  }

  private desconectar() {
    this.pararPing();
    const socket = this.socket;
    this.socket = undefined;
    socket?.close(1000, 'Fechado pelo usuário');
  }

  private pararPing() {
    if (this.ping) {
      clearInterval(this.ping);
      this.ping = undefined;
    }
  }

  private atualizarStatus(status: StatusTerminal, mensagem: string, chaveHost?: string) {
    this.status = status;
    this.statusChange.emit({ status, mensagem, chaveHost });
  }
}
