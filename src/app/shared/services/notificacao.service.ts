import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, NgZone, OnDestroy, inject, signal } from '@angular/core';
import { TokenService } from '@core';
import { environment } from '@env/environment';
import { HotToastService } from '@ngxpert/hot-toast';
import { Observable, Subject, tap } from 'rxjs';

export interface Notificacao {
  codigo: number;
  codMensagem: number;
  titulo: string | null;
  mensagem: string | null;
  gravidade: string | null;
  tipo: string | null;
  quando: string | null;
  lida: boolean;
}

interface Resumo {
  naoLidas: number;
  ultimas: Notificacao[];
  diasHistorico: number;
  som: boolean;
  notificacaoWindows: boolean;
}

/** Consulta periódica quando o tempo real (SSE) não está conectado. */
const CONSULTA_SEM_TEMPO_REAL_MS = 60_000;
/** Conferência de segurança mesmo com o tempo real conectado. */
const CONSULTA_COM_TEMPO_REAL_MS = 5 * 60_000;
const ESPERA_INICIAL_MS = 2_000;
const ESPERA_MAXIMA_MS = 60_000;

/**
 * Notificações do aplicativo — sino e central (docs/telegram-expediente.md, seção 12).
 *
 * Tempo real por SSE (`GET /api/notificacoes/stream`), aberto com fetch por causa do cabeçalho Authorization,
 * como o tempo real das homologações. Se o SSE cair, consulta o resumo a cada 60 s.
 */
@Injectable({ providedIn: 'root' })
export class NotificacaoService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly token = inject(TokenService);
  private readonly toast = inject(HotToastService);
  private readonly zone = inject(NgZone);
  private readonly url = `${environment.ApiBaseUrl}notificacoes`;

  readonly naoLidas = signal(0);
  readonly ultimas = signal<Notificacao[]>([]);
  readonly diasHistorico = signal(30);
  readonly aoVivo = signal(false);

  /** Pedido para abrir a central (painel lateral); o layout escuta. */
  readonly abrirCentral$ = new Subject<void>();
  /** Chegou ou mudou algo: a central recarrega a lista. */
  readonly mudou$ = new Subject<void>();

  private iniciado = false;
  private controle: AbortController | null = null;
  private temporizadorConsulta: ReturnType<typeof setTimeout> | undefined;
  private temporizadorReconexao: ReturnType<typeof setTimeout> | undefined;
  private espera = ESPERA_INICIAL_MS;
  private encerrado = false;

  /** Chamado pelo sino ao aparecer (só existe com usuário logado). */
  iniciar() {
    if (this.iniciado) return;
    this.iniciado = true;
    this.encerrado = false;
    this.atualizar();
    this.zone.runOutsideAngular(() => {
      document.addEventListener('pointerdown', () => this.destravarAudio(), { once: true, capture: true });
      document.addEventListener('keydown', () => this.destravarAudio(), { once: true, capture: true });
      this.conectar();
    });
  }

  ngOnDestroy() {
    this.encerrado = true;
    this.controle?.abort();
    clearTimeout(this.temporizadorConsulta);
    clearTimeout(this.temporizadorReconexao);
  }

  /** Maior código já visto: o que vier acima disso e não lido é novidade (SSE ou consulta periódica). */
  private ultimoVisto: number | null = null;

  atualizar() {
    this.http.get<Resumo>(`${this.url}/resumo`).subscribe({
      next: r => {
        this.naoLidas.set(r.naoLidas);
        this.ultimas.set(r.ultimas);
        this.diasHistorico.set(r.diasHistorico);
        this.som.set(r.som);
        this.notificacaoWindows.set(r.notificacaoWindows);
        this.mudou$.next();
        // Na primeira leitura nada é novidade: só o que chegar depois avisa, toca e aparece no Windows.
        const anterior = this.ultimoVisto;
        this.ultimoVisto = r.ultimas.reduce((m, n) => Math.max(m, n.codigo), anterior ?? 0);
        if (anterior !== null) {
          this.avisar(r.ultimas.filter(n => n.codigo > anterior));
        }
      },
      error: () => {}, // sem sessão ou API fora: tenta de novo na próxima consulta
    });
    this.agendarConsulta();
  }

  listar(filtro: { naoLidas: boolean; gravidade?: string | null; busca?: string | null }): Observable<Notificacao[]> {
    let params = new HttpParams().set('naoLidas', filtro.naoLidas);
    if (filtro.gravidade) params = params.set('gravidade', filtro.gravidade);
    if (filtro.busca) params = params.set('busca', filtro.busca);
    return this.http.get<Notificacao[]>(this.url, { params });
  }

  marcarLida(n: Notificacao): Observable<void> {
    return this.http.put<void>(`${this.url}/${n.codigo}/lida`, {}).pipe(tap(() => this.atualizar()));
  }

  marcarTodas(): Observable<unknown> {
    return this.http.put(`${this.url}/lidas`, {}).pipe(tap(() => this.atualizar()));
  }

  abrirCentral() {
    this.abrirCentral$.next();
  }

  // ───────────────────────── avisos na tela ─────────────────────────

  /**
   * ERRO e ALERTA aparecem como aviso no canto da tela (D-19) e tocam som (R-21); qualquer gravidade vira
   * notificação do Windows com o aplicativo em segundo plano (R-22). Som e Windows saem de uma aba só.
   */
  private avisar(novas: Notificacao[]) {
    for (const n of novas) {
      if (n.lida) continue;
      const g = gravidade(n);
      const texto = `${textoSimples(n.titulo)}${n.mensagem ? ' — ' + resumir(textoSimples(n.mensagem), 140) : ''}`;
      if (g === 'ERRO') {
        this.toast.error(texto, { duration: 10_000, dismissible: true });
      } else if (g === 'ALERTA') {
        this.toast.warning(texto, { duration: 8_000, dismissible: true });
      }
      void this.reservar(n.codigo).then(minha => {
        if (!minha) return;
        if (this.som() && (g === 'ERRO' || g === 'ALERTA')) this.tocar(g);
        if (this.notificacaoWindows() && emSegundoPlano()) this.mostrarNoWindows(n, g);
      });
    }
  }

  // ───────────────────────── som e Windows (seção 13) ─────────────────────────

  /** Preferências do usuário (perfil), vindas do resumo. */
  readonly som = signal(true);
  readonly notificacaoWindows = signal(true);

  private audio: AudioContext | null = null;

  /** Permissão do navegador para a notificação do Windows. */
  permissaoWindows(): NotificationPermission | 'indisponivel' {
    return 'Notification' in window ? Notification.permission : 'indisponivel';
  }

  pedirPermissaoWindows(): Promise<NotificationPermission | 'indisponivel'> {
    if (!('Notification' in window)) return Promise.resolve('indisponivel');
    return Notification.requestPermission();
  }

  /** Botão "Testar" do perfil: toca e mostra uma notificação de exemplo, mesmo com a tela em primeiro plano. */
  testar() {
    this.destravarAudio();
    if (this.som()) this.tocar('ERRO');
    if (this.notificacaoWindows() && this.permissaoWindows() === 'granted') {
      this.mostrarNoWindows(
        { codigo: -Date.now(), codMensagem: 0, titulo: 'Teste de notificação', mensagem: 'Assim chegam os alertas do NTI.',
          gravidade: 'ALERTA', tipo: 'TESTE', quando: null, lida: false },
        'ALERTA'
      );
    }
  }

  /** O navegador só toca som depois de um clique na página: o primeiro clique libera o áudio. */
  private destravarAudio() {
    try {
      this.audio ??= new AudioContext();
      if (this.audio.state === 'suspended') void this.audio.resume();
    } catch {
      this.audio = null;
    }
  }

  /** Bipe gerado pelo navegador (D-27): dois toques para ERRO, um para ALERTA. */
  private tocar(g: string) {
    const ctx = this.audio;
    if (!ctx || ctx.state !== 'running') return;
    const toques = g === 'ERRO' ? [0, 0.28] : [0];
    const frequencia = g === 'ERRO' ? 880 : 660;
    for (const inicio of toques) {
      const osc = ctx.createOscillator();
      const volume = ctx.createGain();
      const t = ctx.currentTime + inicio;
      osc.type = 'sine';
      osc.frequency.value = frequencia;
      volume.gain.setValueAtTime(0.0001, t);
      volume.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(volume).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.24);
    }
  }

  private mostrarNoWindows(n: Notificacao, g: string) {
    if (this.permissaoWindows() !== 'granted') return;
    try {
      const aviso = new Notification(resumir(textoSimples(n.titulo) || 'Notificação do NTI', 120), {
        body: resumir(textoSimples(n.mensagem), 240),
        tag: `nti-${n.codigo}`,
        requireInteraction: g === 'ERRO',
        icon: 'favicon.ico',
      });
      aviso.onclick = () => {
        window.focus();
        this.zone.run(() => this.abrirCentral());
        aviso.close();
      };
    } catch {
      // navegador sem suporte a Notification fora de service worker: fica só o sino
    }
  }

  /**
   * Garante que só uma aba toque e mostre a notificação (várias abas abertas recebem o mesmo evento).
   * Web Locks quando existe; senão, uma marca no localStorage.
   */
  private async reservar(codigo: number): Promise<boolean> {
    const chave = `nti-notificacao-avisada-${codigo}`;
    const marcar = () => {
      try {
        if (localStorage.getItem(chave)) return false;
        localStorage.setItem(chave, String(Date.now()));
        this.limparMarcas();
        return true;
      } catch {
        return true;
      }
    };
    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    if (!locks) return marcar();
    return locks.request(chave, { ifAvailable: true }, async lock => (lock ? marcar() : false));
  }

  private limparMarcas() {
    try {
      const limite = Date.now() - 60 * 60_000;
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k?.startsWith('nti-notificacao-avisada-') && Number(localStorage.getItem(k)) < limite) localStorage.removeItem(k);
      }
    } catch {
      // sem localStorage: nada a limpar
    }
  }

  // ───────────────────────── tempo real (SSE) ─────────────────────────

  private agendarConsulta() {
    clearTimeout(this.temporizadorConsulta);
    if (this.encerrado) return;
    const intervalo = this.aoVivo() ? CONSULTA_COM_TEMPO_REAL_MS : CONSULTA_SEM_TEMPO_REAL_MS;
    this.temporizadorConsulta = setTimeout(() => this.zone.run(() => this.atualizar()), intervalo);
  }

  private conectar() {
    if (this.encerrado) return;
    const bearer = this.token.getBearerToken();
    if (!bearer) {
      this.reconectar();
      return;
    }
    this.controle = new AbortController();
    fetch(`${this.url}/stream`, {
      headers: { Authorization: bearer, Accept: 'text/event-stream' },
      signal: this.controle.signal,
      cache: 'no-store',
    })
      .then(async resposta => {
        if (!resposta.ok || !resposta.body) throw new Error(`HTTP ${resposta.status}`);
        this.espera = ESPERA_INICIAL_MS;
        await this.ler(resposta.body);
        this.reconectar();
      })
      .catch(() => this.reconectar());
  }

  private reconectar() {
    if (this.encerrado) return;
    if (this.aoVivo()) this.zone.run(() => this.aoVivo.set(false));
    this.agendarConsulta();
    this.temporizadorReconexao = setTimeout(() => this.conectar(), this.espera);
    this.espera = Math.min(this.espera * 2, ESPERA_MAXIMA_MS);
  }

  private async ler(corpo: ReadableStream<Uint8Array>) {
    const leitor = corpo.getReader();
    const decodificador = new TextDecoder();
    let buffer = '';
    // Várias linhas chegam juntas numa rajada: um só resumo por rajada.
    let rajada: ReturnType<typeof setTimeout> | undefined;
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
          this.zone.run(() => {
            this.aoVivo.set(true);
            this.atualizar();
          });
        } else if (nome === 'nova') {
          // O resumo descobre o que é novo pelo código (ultimoVisto).
          clearTimeout(rajada);
          rajada = setTimeout(() => this.zone.run(() => this.atualizar()), 400);
        }
      }
    }
  }
}

/** Texto sem as marcas HTML (títulos e mensagens vêm formatados para o Telegram). */
export function textoSimples(html: string | null | undefined): string {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || '').replace(/\s+/g, ' ').trim();
}

export function resumir(texto: string, max: number): string {
  return texto.length <= max ? texto : texto.substring(0, max - 1) + '…';
}

function gravidade(n: Notificacao): 'ERRO' | 'ALERTA' | 'INFO' {
  const g = (n.gravidade || '').toUpperCase();
  if (g === 'ERRO' || g === 'ERROR') return 'ERRO';
  if (g === 'ALERTA') return 'ALERTA';
  return 'INFO';
}

/** Aplicativo minimizado, em outra aba ou atrás de outra janela. */
function emSegundoPlano(): boolean {
  return document.hidden || !document.hasFocus();
}
