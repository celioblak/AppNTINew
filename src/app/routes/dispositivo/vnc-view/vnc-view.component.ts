import { Component, ElementRef, HostListener, inject, OnInit, ViewChild, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { HbserviceService } from '@core/hbservice/hb.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';

import RFB from '@novnc/novnc/lib/rfb';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { CommonModule } from '@angular/common';

// Enum para estados da conexão
enum ConnectionState {
  DISCONNECTED = 'DESCONECTADO',
  CONNECTING = 'CONECTANDO',
  CONNECTED = 'CONECTADO',
  ERROR = 'ERRO',
  RECONNECTING = 'RECONECTANDO'
}

// Códigos de teclas (keysyms) - X11 keysym values
const XK = {
  // Modifiers
  Control_L: 0xffe3,
  Control_R: 0xffe4,
  Alt_L: 0xffe9,
  Alt_R: 0xffea,
  Shift_L: 0xffe1,
  Shift_R: 0xffe2,
  Super_L: 0xffeb,  // Windows key
  Super_R: 0xffec,

  // Function keys
  F1: 0xffbe,
  F2: 0xffbf,
  F3: 0xffc0,
  F4: 0xffc1,
  F5: 0xffc2,
  F6: 0xffc3,
  F7: 0xffc4,
  F8: 0xffc5,
  F9: 0xffc6,
  F10: 0xffc7,
  F11: 0xffc8,
  F12: 0xffc9,

  // Special keys
  Escape: 0xff1b,
  Tab: 0xff09,
  Return: 0xff0d,
  BackSpace: 0xff08,
  Delete: 0xffff,
  Insert: 0xff63,
  Home: 0xff50,
  End: 0xff57,
  Page_Up: 0xff55,
  Page_Down: 0xff56,
  Print: 0xff61,
  Pause: 0xff13,
  Scroll_Lock: 0xff14,
  Caps_Lock: 0xffe5,
  Num_Lock: 0xff7f,

  // Arrow keys
  Up: 0xff52,
  Down: 0xff54,
  Left: 0xff51,
  Right: 0xff53,

  // Letters (lowercase)
  a: 0x0061,
  b: 0x0062,
  c: 0x0063,
  d: 0x0064,
  e: 0x0065,
  f: 0x0066,
  g: 0x0067,
  h: 0x0068,
  i: 0x0069,
  j: 0x006a,
  k: 0x006b,
  l: 0x006c,
  m: 0x006d,
  n: 0x006e,
  o: 0x006f,
  p: 0x0070,
  q: 0x0071,
  r: 0x0072,
  s: 0x0073,
  t: 0x0074,
  u: 0x0075,
  v: 0x0076,
  w: 0x0077,
  x: 0x0078,
  y: 0x0079,
  z: 0x007a,

  // Numbers
  '0': 0x0030,
  '1': 0x0031,
  '2': 0x0032,
  '3': 0x0033,
  '4': 0x0034,
  '5': 0x0035,
  '6': 0x0036,
  '7': 0x0037,
  '8': 0x0038,
  '9': 0x0039,

  // Symbols
  space: 0x0020,
  minus: 0x002d,
  equal: 0x003d,
  bracketleft: 0x005b,
  bracketright: 0x005d,
  backslash: 0x005c,
  semicolon: 0x003b,
  apostrophe: 0x0027,
  grave: 0x0060,
  comma: 0x002c,
  period: 0x002e,
  slash: 0x002f,
};

@Component({
  selector: 'app-vnc-view',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    MatIconModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './vnc-view.component.html',
  styleUrl: './vnc-view.component.scss'
})
export class VncViewComponent implements OnInit, OnDestroy {
  readonly hbService: HbserviceService = inject(HbserviceService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly cdr = inject(ChangeDetectorRef);

  // Configurações
  private readonly DEFAULT_PORT = '5901';
  private readonly DEFAULT_PASSWORD = 'monitor';
  private readonly DEFAULT_PATH = 'websockify';
  private readonly RECONNECT_ATTEMPTS = 3;
  private readonly RECONNECT_DELAY = 3000;

  // Estado da conexão
  public rfb: RFB | null = null;
  desktopName = '';

  // Propriedades
  connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  status = 'DESCONECTADO';
  statusMessage = '';
  statusExecutaveis = '';

  // Novas propriedades
  screenshotData: string | null = null;
  connectionStats: { latency: number; } | null = null;
  zoomLevel = 100;
  host = '';
  port = 5901;
  /** Quando true, desabilita envio de mouse e teclado para a maquina remota. */
  viewOnly = false;

  // Busca de usuario por login
  loginBusca = '';
  /** Define qual campo do ultimo acesso preenche o host: 'ip' ou 'maquina' */
  usarCampo: 'ip' | 'maquina' = 'ip';
  buscandoUsuario = false;
  ultimoAcessoUsuario: { usuario: string; maquina: string; ip: string; sistema: string; dhAcesso: string } | null = null;

  // Atualização do HBService
  painelUpdateAberto = false;
  atualizandoHb = false;
  progressoAtualizacao = '';
  updateParams = {
    caminhoExeRede: '\\\\172.17.0.56\\mv2000\\TI\\Celio\\HBService\\hbServiceUpdate.exe',
    destinoLocal:   'C:\\Trabalho\\app_hb\\hbService\\',
    exeDestino:     'C:\\Trabalho\\app_hb\\hbService\\hbServiceUpdate.exe',
    urlUpdate:      'http://srv-ntic.hbase.local:8091/update/hbService.exe',
    timeoutReinicioSeg: 60,
  };
  private readonly http = inject(HttpClient);
  vncAtivo = false;
  isLoading = false;
  reconnectCount = 0;

  // Propriedades para comandos
  commands = [
    { name: 'Ctrl+Alt+Del', icon: 'keyboard', action: () => this.sendCtrlAltDel() },
    { name: 'Ctrl+Shift+Esc', icon: 'list_alt', action: () => this.sendCtrlShiftEsc() },
    { name: 'Ctrl+C', icon: 'content_copy', action: () => this.sendCtrlC() },
    { name: 'Ctrl+V', icon: 'content_paste', action: () => this.sendCtrlV() },
    { name: 'Ctrl+X', icon: 'content_cut', action: () => this.sendCtrlX() },
    { name: 'Ctrl+Z', icon: 'undo', action: () => this.sendCtrlZ() },
    { name: 'Alt+F4', icon: 'close', action: () => this.sendAltF4() },
    { name: 'Print Screen', icon: 'photo_camera', action: () => this.sendPrintScreen() },
    { name: 'Win (⊞)', icon: 'apps', action: () => this.sendWinKey() },
    { name: 'Caps Lock', icon: 'keyboard_capslock', action: () => this.sendCapsLock() },
    { name: 'Enter', icon: 'keyboard_return', action: () => this.sendEnter() },
    { name: 'Escape', icon: 'keyboard_escape', action: () => this.sendEscape() },
    { name: 'Tab', icon: 'keyboard_tab', action: () => this.sendTab() },
  ];

  private reconnectTimer: any = null;
  private latencyCheckInterval: any = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private canvasObserver: MutationObserver | null = null;

  @ViewChild('btnStart') btnStart!: ElementRef;

  // Getter para statusDisplay
  get statusDisplay(): string {
    return this.connectionState;
  }

  ngOnInit(): void {
    // Carregar host salvo do localStorage se existir
    const savedHost = localStorage.getItem('vnc_last_host');
    if (savedHost) {
      this.host = savedHost;
    }
  }

  ngOnDestroy(): void {
    this.cleanupConnection();
    this.clearReconnectTimer();
    this.clearLatencyCheck();
    this.disconnectCanvasObserver();
  }

  @HostListener('window:beforeunload')
  beforeUnloadHandler(): void {
    this.stopClient();
  }

  // Método para captura de tela REAL
  async takeScreenshot(): Promise<void> {
    if (!this.rfb || !this.vncAtivo) {
      this.showError('Não é possível capturar tela: conexão não ativa');
      return;
    }

    try {
      // Primeiro, tenta acessar o canvas do noVNC
      await this.waitForCanvas();

      if (this.canvasElement) {
        // Usa o canvas do noVNC
        await this.captureFromCanvas();
      } else {
        // Fallback: tenta capturar a div da tela
        await this.captureFromScreenDiv();
      }

    } catch (error) {
      console.error('Erro ao capturar tela:', error);
      this.showError('Erro ao capturar tela. Usando método alternativo...');
      this.createFallbackScreenshot();
    }
  }

  private async waitForCanvas(): Promise<void> {
    return new Promise((resolve) => {
      if (this.canvasElement) {
        resolve();
        return;
      }

      // Tenta encontrar o canvas no container
      const container = document.getElementById('screen');
      if (container) {
        const canvas = container.querySelector('canvas');
        if (canvas) {
          this.canvasElement = canvas as HTMLCanvasElement;
          resolve();
        }
      }

      // Se não encontrar, espera um pouco e tenta novamente
      setTimeout(() => {
        const container = document.getElementById('screen');
        if (container) {
          const canvas = container.querySelector('canvas');
          if (canvas) {
            this.canvasElement = canvas as HTMLCanvasElement;
          }
        }
        resolve();
      }, 1000);
    });
  }

  private async captureFromCanvas(): Promise<void> {
    if (!this.canvasElement) return;

    // Cria um canvas temporário
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');

    if (!ctx) {
      throw new Error('Não foi possível criar contexto 2D');
    }

    // Define o tamanho
    tempCanvas.width = this.canvasElement.width;
    tempCanvas.height = this.canvasElement.height;

    // Copia o conteúdo
    ctx.drawImage(this.canvasElement, 0, 0);

    // Adiciona marca d'água
    this.addWatermark(ctx, tempCanvas.width, tempCanvas.height);

    // Converte para data URL
    this.screenshotData = tempCanvas.toDataURL('image/png', 0.9);
    this.showSuccess('Captura de tela realizada com sucesso!');
  }

  private async captureFromScreenDiv(): Promise<void> {
    const screenDiv = document.getElementById('screen');
    if (!screenDiv) {
      throw new Error('Elemento da tela não encontrado');
    }

    // Tenta usar html2canvas se disponível
    if (typeof (window as any).html2canvas === 'function') {
      try {
        const canvas = await (window as any).html2canvas(screenDiv);
        const ctx = canvas.getContext('2d');
        this.addWatermark(ctx, canvas.width, canvas.height);
        this.screenshotData = canvas.toDataURL('image/png', 0.9);
        this.showSuccess('Captura de tela realizada (html2canvas)!');
        return;
      } catch (error) {
        console.error('Erro com html2canvas:', error);
      }
    }

    // Se não conseguir, cria uma imagem simulada
    this.createFallbackScreenshot();
  }

  private createFallbackScreenshot(): void {
    this.screenshotData = 'data:image/svg+xml;base64,' + btoa(`
      <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#1a1a1a"/>
        <text x="50%" y="50%" text-anchor="middle" fill="#ffffff" font-family="Arial" font-size="20">
          Captura de tela VNC - ${new Date().toLocaleTimeString()}
        </text>
        <text x="50%" y="55%" text-anchor="middle" fill="#cccccc" font-family="Arial" font-size="16">
          Host: ${this.host} | Desktop: ${this.desktopName}
        </text>
        <text x="50%" y="60%" text-anchor="middle" fill="#999999" font-family="Arial" font-size="14">
          Para capturas completas, instale html2canvas
        </text>
      </svg>
    `);
    this.showInfo('Captura de tela simulada. Instale html2canvas para capturas reais.');
  }

  private addWatermark(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Adiciona marca d'água com informações
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, height - 50, 400, 40);

    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    ctx.fillText(`Host: ${this.host}`, 20, height - 35);
    ctx.fillText(`Data: ${new Date().toLocaleString()}`, 20, height - 15);
    if (this.desktopName) {
      ctx.fillText(`Desktop: ${this.desktopName}`, 20, height - 55);
    }
  }

  downloadScreenshot(): void {
    if (!this.screenshotData) return;

    const link = document.createElement('a');
    link.href = this.screenshotData;
    link.download = `vnc-screenshot-${this.host.replace(/[^a-z0-9]/gi, '-')}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
    link.click();
  }

  closeScreenshot(): void {
    this.screenshotData = null;
  }

  // COMANDOS DO TECLADO - CORRIGIDOS
  sendCtrlAltDel(): void {
    if (!this.rfb) return;
    // Funcao nativa do noVNC - funciona em Linux e Windows com SoftwareSASGeneration habilitado.
    // Em Windows convencional, Microsoft bloqueia injecao de SAS por software por design.
    this.rfb.sendCtrlAltDel();
    this.showInfo('Ctrl+Alt+Del enviado (em Windows pode requerer SoftwareSASGeneration)');
  }

  /**
   * Alternativa para Windows remoto - abre Gerenciador de Tarefas direto.
   * Funciona em qualquer Windows, sem depender de SAS.
   */
  sendCtrlShiftEsc(): void {
    this.sendKeyCombo([XK.Control_L, XK.Shift_L, XK.Escape]);
    this.showInfo('Ctrl+Shift+Esc enviado (Gerenciador de Tarefas)');
  }

  sendCtrlC(): void {
    this.sendKeyCombo([XK.Control_L, XK.c]);
    this.showInfo('Ctrl+C enviado');
  }

  sendCtrlV(): void {
    this.sendKeyCombo([XK.Control_L, XK.v]);
    this.showInfo('Ctrl+V enviado');
  }

  sendCtrlX(): void {
    this.sendKeyCombo([XK.Control_L, XK.x]);
    this.showInfo('Ctrl+X enviado');
  }

  sendCtrlZ(): void {
    this.sendKeyCombo([XK.Control_L, XK.z]);
    this.showInfo('Ctrl+Z enviado');
  }

  sendAltF4(): void {
    this.sendKeyCombo([XK.Alt_L, XK.F4]);
    this.showInfo('Alt+F4 enviado');
  }

  sendPrintScreen(): void {
    this.sendKey(XK.Print, 'PrintScreen');
    this.showInfo('Print Screen enviado');
  }

  sendWinKey(): void {
    // Envia a tecla Windows/Super
    this.sendKeyCombo([XK.Super_L]);
    this.showInfo('Tecla Windows enviada');
  }

  /**
   * Busca o ultimo IP/maquina onde o usuario informado fez login.
   * Util para suporte: digita o login, e o host e preenchido automaticamente.
   */
  async buscarUsuario(): Promise<void> {
    const login = (this.loginBusca || '').trim();
    if (login.length === 0) {
      this.showError('Informe o login do usuario');
      return;
    }

    if (this.buscandoUsuario) return;
    this.buscandoUsuario = true;
    this.ultimoAcessoUsuario = null;
    this.cdr.markForCheck();

    try {
      const resultado = await this.hbService.buscarUsuarioPorLogin(login);
      if (!resultado) {
        this.showError(`Nenhum acesso encontrado para "${login}"`);
        return;
      }
      this.ultimoAcessoUsuario = resultado;
      // Preenche o host com IP ou nome da máquina conforme seleção do toggle
      this.host = this.usarCampo === 'maquina' ? resultado.maquina : resultado.ip;
      // Formata data/hora para exibicao - YYYY-MM-DDTHH:mm:ss... -> DD/MM/YYYY HH:mm:ss
      const dh = new Date(resultado.dhAcesso);
      const dhFormatado = dh.toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      this.showInfo(
        `${resultado.usuario} em ${resultado.maquina} (${resultado.ip}) | Ultimo acesso: ${dhFormatado}`
      );
    } catch (err: any) {
      console.error('Erro ao buscar usuario:', err);
      this.showError('Falha ao consultar acessos do usuario');
    } finally {
      this.buscandoUsuario = false;
      this.cdr.markForCheck();
    }
  }

  /**
   * Chamado ao trocar o toggle IP/Máquina.
   * Se já há um resultado de busca, atualiza o host imediatamente
   * sem precisar realizar a consulta novamente.
   */
  onUsarCampoChange(): void {
    if (!this.ultimoAcessoUsuario) return;
    this.host = this.usarCampo === 'maquina'
      ? this.ultimoAcessoUsuario.maquina
      : this.ultimoAcessoUsuario.ip;
    this.cdr.markForCheck();
  }

  /**
   * Executa o fluxo completo de atualização do HBService na máquina remota.
   * Usa o host atual do campo + params configurados no painel.
   */
  async executarAtualizacaoHb(): Promise<void> {
    if (this.atualizandoHb || !this.host?.trim()) return;

    this.atualizandoHb = true;
    this.progressoAtualizacao = 'Iniciando...';
    this.cdr.markForCheck();

    try {
      const resultado = await this.hbService.atualizarHbService(
        this.host.trim(),
        { ...this.updateParams },
        (etapa) => {
          this.progressoAtualizacao = etapa;
          this.setStatusMessage(etapa);
          this.cdr.markForCheck();
        }
      );

      if (resultado.sucesso) {
        this.showSuccess(`HBService atualizado com sucesso em ${this.host}`);
        this.painelUpdateAberto = false;
      } else {
        this.showError(`Falha na etapa "${resultado.etapa}": ${resultado.mensagem}`);
      }
    } catch (err: any) {
      this.showError(`Erro inesperado na atualização: ${err?.message ?? err}`);
    } finally {
      this.atualizandoHb = false;
      this.progressoAtualizacao = '';
      this.cdr.markForCheck();
    }
  }

  /**
   * Alterna o modo somente-visualizacao em tempo real.
   * Quando ON, mouse e teclado sao desabilitados (pode ser usado para
   * acompanhar o que o usuario esta fazendo sem interferir).
   */
  toggleViewOnly(): void {
    this.viewOnly = !this.viewOnly;
    if (this.rfb) {
      this.rfb.viewOnly = this.viewOnly;
    }
    this.showInfo(this.viewOnly ? 'Modo somente visualizacao ATIVADO' : 'Modo somente visualizacao DESATIVADO');
    this.cdr.markForCheck();
  }

  sendCapsLock(): void {
    this.sendToggleKey(XK.Caps_Lock, 'CapsLock');
    this.showInfo('Caps Lock enviado');
  }

  /**
   * Envia uma tecla de toggle (CapsLock, NumLock, ScrollLock).
   *
   * Diferente de teclas normais, toggles precisam de press+release
   * imediato (sem delay longo). Senao, alguns servidores VNC interpretam
   * como "tecla pressionada continuamente" e nao alteram o estado do toggle.
   */
  private sendToggleKey(keysym: number, keyName: string): void {
    if (!this.rfb) return;
    this.rfb.sendKey(keysym, keyName, true);
    // 30ms e suficiente para o servidor processar como evento discreto
    setTimeout(() => {
      if (this.rfb) {
        this.rfb.sendKey(keysym, keyName, false);
      }
    }, 30);
  }

  sendEnter(): void {
    this.sendKey(XK.Return, 'Enter');
    this.showInfo('Enter enviado');
  }

  sendEscape(): void {
    this.sendKey(XK.Escape, 'Escape');
    this.showInfo('Escape enviado');
  }

  sendTab(): void {
    this.sendKey(XK.Tab, 'Tab');
    this.showInfo('Tab enviado');
  }

  sendArrowKey(direction: 'up' | 'down' | 'left' | 'right'): void {
    if (!this.rfb) return;

    const keyMap = {
      up: XK.Up,
      down: XK.Down,
      left: XK.Left,
      right: XK.Right
    };

    this.sendKey(keyMap[direction], direction);
    this.showInfo(`Seta ${direction} enviada`);
  }

  // Método para enviar uma única tecla
private sendKey(keysym: number, keyName?: string, down: boolean = true): void {
    if (!this.rfb) return;

    // noVNC espera null para keyName quando nao temos um KeyboardEvent.code real,
    // string vazia pode ser interpretada incorretamente por alguns servidores VNC
    const keyNameToSend = (keyName && keyName.length > 0) ? keyName : null;

    // Envia o evento de pressionar/liberar
    this.rfb.sendKey(keysym, keyNameToSend, down);

    // Se estiver pressionando, libera após um breve delay
    if (down) {
      setTimeout(() => {
        if (this.rfb) {
          this.rfb.sendKey(keysym, keyNameToSend, false);
        }
      }, 100);
    }
}

  /**
   * Envia uma combinacao de teclas (ex: Ctrl+C) na ordem correta esperada
   * por sistemas operacionais:
   *   1) Pressiona modificadores primeiro (Ctrl, Alt, Shift)
   *   2) Pequeno delay para o SO registrar o modificador
   *   3) Pressiona a tecla principal
   *   4) Libera a tecla principal
   *   5) Libera os modificadores na ordem inversa
   *
   * Cada passo tem delay para que o servidor VNC e o SO host processem na
   * sequencia correta. Sem isso, programas remotos podem perder a combinacao.
   */
  private sendKeyCombo(keys: number[]): void {
    if (!this.rfb) return;
    if (keys.length === 0) return;

    const modifiers = keys.slice(0, -1);
    const mainKey   = keys[keys.length - 1];

    // 1) Pressiona modificadores
    modifiers.forEach(key => this.rfb!.sendKey(key, null, true));

    // 2) Aguarda SO registrar modificadores, depois pressiona tecla principal
    setTimeout(() => {
      if (!this.rfb) return;
      this.rfb.sendKey(mainKey, null, true);

      // 3) Libera tecla principal apos pequena duracao
      setTimeout(() => {
        if (!this.rfb) return;
        this.rfb.sendKey(mainKey, null, false);

        // 4) Libera modificadores na ordem inversa (Ctrl pressionado por ultimo, liberado primeiro)
        setTimeout(() => {
          if (!this.rfb) return;
          [...modifiers].reverse().forEach(key => this.rfb!.sendKey(key, null, false));
        }, 50);
      }, 80);
    }, 50);
  }

  // Método alternativo que simula melhor o pressionamento
private async sendKeySequence(keys: number[], keyNames?: string[]): Promise<void> {
    if (!this.rfb) return;

    // Pressiona todas as teclas
    keys.forEach((key, index) => {
      const keyName = keyNames?.[index] || null;
      this.rfb!.sendKey(key, keyName, true);
    });

    // Aguarda um pouco
    await this.delay(50);

    // Libera todas as teclas
    keys.forEach((key, index) => {
      const keyName = keyNames?.[index] || null;
      this.rfb!.sendKey(key, keyName, false);
    });
}

  // Método para enviar texto (simula digitação)
  sendText(text: string): void {
    if (!this.rfb) return;

    for (const char of text) {
      setTimeout(() => {
        if (!this.rfb) return;

        // Converte caractere para keysym (simplificado)
        const keysym = this.charToKeysym(char);
        if (keysym) {
          // Pressiona e libera a tecla
          this.rfb.sendKey(keysym, char, true);
          setTimeout(() => {
            if (this.rfb) {
              this.rfb.sendKey(keysym, char, false);
            }
          }, 50);
        }
      }, 100); // Delay entre caracteres
    }
  }

  private charToKeysym(char: string): number | null {
    const lowerChar = char.toLowerCase();

    // Mapeamento básico de caracteres para keysyms
    if (char >= 'a' && char <= 'z') {
      return XK[lowerChar as 'a'];
    }

    if (char >= 'A' && char <= 'Z') {
      // Para letras maiúsculas, precisamos de Shift + letra
      // Retorna a letra minúscula (o Shift será tratado separadamente)
      return XK[lowerChar as 'a'];
    }

    if (char >= '0' && char <= '9') {
      return XK[char as '0'];
    }

    // Mapeamento de símbolos comuns
    const symbolMap: { [key: string]: number } = {
      ' ': XK.space,
      '-': XK.minus,
      '=': XK.equal,
      '[': XK.bracketleft,
      ']': XK.bracketright,
      '\\': XK.backslash,
      ';': XK.semicolon,
      "'": XK.apostrophe,
      '`': XK.grave,
      ',': XK.comma,
      '.': XK.period,
      '/': XK.slash,
    };

    return symbolMap[char] || null;
  }

  adjustScaling(): void {
    this.zoomLevel = Math.min(this.zoomLevel + 25, 200);
    this.applyZoom();
    this.showInfo(`Zoom: ${this.zoomLevel}%`);
  }

  resetScaling(): void {
    this.zoomLevel = 100;
    this.applyZoom();
    this.showInfo('Zoom resetado para 100%');
  }

  private applyZoom(): void {
    const screenElement = document.getElementById('screen');
    if (screenElement) {
      screenElement.style.transform = `scale(${this.zoomLevel / 100})`;
      screenElement.style.transformOrigin = 'top left';
    }
  }

  // Métodos mantidos para compatibilidade
  getHostValue(e: any): void {
    this.host = e.target.value;
    if (this.host === '') {
      this.btnStart.nativeElement.setAttribute('disabled', '');
    } else {
      this.btnStart.nativeElement.removeAttribute('disabled');
    }
  }

  async startClient(): Promise<void> {
    if (!this.host || this.host.trim().length === 0) {
      this.showError('Host é obrigatório');
      return;
    }

    // Trava: impede execucoes paralelas do startClient
    // (se o usuario clica varias vezes ou se o reconnect dispara junto)
    if (this.isLoading) {
      console.warn('startClient ja em execucao - ignorando chamada duplicada');
      return;
    }

    // Salvar host no localStorage
    localStorage.setItem('vnc_last_host', this.host);

    try {
      this.setConnectionState(ConnectionState.CONNECTING);
      this.isLoading = true;
      // NAO ativa vncAtivo aqui - so depois que estabelecer conexao com sucesso

      // Verificar requisitos
      const canConnect = await this.verificaRequisitos();
      if (!canConnect) {
        this.setConnectionState(ConnectionState.ERROR);
        this.isLoading = false;
        this.vncAtivo = false;
        this.cdr.markForCheck();
        return;
      }

      // Estabelecer conexão (so agora ativa vncAtivo, depois do request de tunnel-token dar certo)
      this.vncAtivo = true;
      await this.establishConnection();

    } catch (error) {
      console.error('Erro ao iniciar conexão:', error);
      this.handleConnectionError(error);
      this.isLoading = false;
      this.vncAtivo = false;
      this.setConnectionState(ConnectionState.ERROR);
      this.cdr.markForCheck();
    }
  }

  stopClient(): void {
    this.cleanupConnection();
    this.setConnectionState(ConnectionState.DISCONNECTED);
    this.showSuccess('Desconectado');
  }

  makeFullScreen(): void {
    const element = document.getElementById('vncView');
    if (!element) return;

    if (!document.fullscreenElement) {
      if (element.requestFullscreen) {
        element.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  private async establishConnection(): Promise<void> {
    const container = document.getElementById('screen');
    if (!container) {
      throw new Error('Container de tela não encontrado');
    }

    // Limpar conexão anterior se existir
    if (this.rfb) {
      this.rfb.disconnect();
      this.rfb = null;
    }

    // 1. Solicita tunnel-token ao backend (autenticado via JWT no header pelo interceptor)
    let tunnelToken: string;
    try {
      const apiBase = environment.ApiBaseUrl.replace(/\/$/, '');
      const resp = await lastValueFrom(
        this.http.post<{ tunnelToken: string; ttlSeconds: number }>(
          `${apiBase}/vnc/tunnel-token`,
          null,
          { params: { host: this.host, port: this.port.toString() } }
        )
      );
      tunnelToken = resp.tunnelToken;
    } catch (err: any) {
      console.error('Falha ao solicitar tunnel-token:', err);
      const msg = err?.status === 403
        ? 'Host ou porta nao permitidos pela politica de seguranca'
        : 'Falha ao solicitar autorizacao do tunel';
      throw new Error(msg);
    }

    // 2. Monta URL do WebSocket apontando para o ntiapi (NAO direto para o host)
    //    O proprio backend valida o token, abre TCP contra host:port e faz proxy.
    //    IMPORTANTE: o context-path da aplicacao (ex: /nti) precisa ser preservado.
    //    ApiBaseUrl tipicamente vem como "http://server/nti/api/" - removemos o "api/"
    //    final para chegar na raiz do context-path, e adicionamos "ws/vnc".
    const apiUrl     = new URL(environment.ApiBaseUrl, window.location.href);
    const wsProtocol = apiUrl.protocol === 'https:' ? 'wss' : 'ws';
    const wsHost     = apiUrl.host; // inclui porta se houver
    // pathname tipicamente '/nti/api/' -> remove segmento final 'api' -> '/nti/ws/vnc'
    const basePath   = apiUrl.pathname.replace(/\/api\/?$/, '').replace(/\/$/, '');
    const url        = `${wsProtocol}://${wsHost}${basePath}/ws/vnc?token=${encodeURIComponent(tunnelToken)}`;

    console.log('Conectando ao tunel VNC:', `${wsProtocol}://${wsHost}${basePath}/ws/vnc`);

    try {
      this.rfb = new RFB(container, url, {
        credentials: {
          username: '',
          password: this.DEFAULT_PASSWORD,
          target: ''
        },
        shared: true,
        repeaterID: '',
        wsProtocols: ['binary'],
      });

      // Aplica modo somente-visualizacao se habilitado
      this.rfb.viewOnly = this.viewOnly;

      this.setupEventListeners();
      this.setupCanvasObserver(container);

    } catch (error) {
      console.error('Erro ao criar RFB:', error);
      throw error;
    }
  }

  private setupCanvasObserver(container: HTMLElement): void {
    // Observa mudanças no container para encontrar o canvas
    this.canvasObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          const canvas = container.querySelector('canvas');
          if (canvas) {
            this.canvasElement = canvas as HTMLCanvasElement;
          }
        }
      });
    });

    this.canvasObserver.observe(container, { childList: true, subtree: true });
  }

  private disconnectCanvasObserver(): void {
    if (this.canvasObserver) {
      this.canvasObserver.disconnect();
      this.canvasObserver = null;
    }
  }

  private setupEventListeners(): void {
    if (!this.rfb) return;

    this.rfb.addEventListener('connect', (event: any) => {
      console.log('Conectado com sucesso:', event);
      this.setConnectionState(ConnectionState.CONNECTED);
      this.vncAtivo = true;
      this.isLoading = false;
      this.reconnectCount = 0;
      this.startLatencyCheck();
      this.showSuccess('Conectado com sucesso');
    });

    this.rfb.addEventListener('disconnect', (event: any) => {
      console.log('Desconectado:', event);
      if (event.detail?.clean) {
        this.setConnectionState(ConnectionState.DISCONNECTED);
        this.showInfo('Desconectado normalmente');
      } else {
        this.handleUnexpectedDisconnect();
      }
      this.vncAtivo = false;
      this.isLoading = false;
      this.clearLatencyCheck();
    });

    this.rfb.addEventListener('credentialsrequired', () => {
      this.setConnectionState(ConnectionState.ERROR);
      this.showError('Credenciais requeridas');
      this.vncAtivo = false;
      this.isLoading = false;
    });

    this.rfb.addEventListener('securityfailure', (event: any) => {
      console.error('Falha de segurança:', event);
      this.setConnectionState(ConnectionState.ERROR);
      this.showError(`Falha de segurança: ${event.detail?.reason || 'Desconhecido'}`);
      this.vncAtivo = false;
      this.isLoading = false;
    });

    this.rfb.addEventListener('desktopname', (event: any) => {
      this.desktopName = event.detail.name?.replace(' - application mode', '').toUpperCase() || '';
      this.cdr.detectChanges();
    });

    this.rfb.addEventListener('bell', (event: any) => {
      const player = document.getElementById('noVNC_bell') as HTMLAudioElement;
      if (player) {
        player.play().catch(e => {
          console.log('Playback error: ' + e);
        });
      }
    });
  }

  private startLatencyCheck(): void {
    this.clearLatencyCheck();

    this.latencyCheckInterval = setInterval(() => {
      if (this.rfb && this.vncAtivo) {
        // Simulação de latência (em produção, use medição real)
        this.connectionStats = {
          latency: Math.floor(Math.random() * 100) + 50, // 50-150ms
        };
        this.cdr.detectChanges();
      }
    }, 5000);
  }

  private clearLatencyCheck(): void {
    if (this.latencyCheckInterval) {
      clearInterval(this.latencyCheckInterval);
      this.latencyCheckInterval = null;
    }
    this.connectionStats = null;
  }

  private handleUnexpectedDisconnect(): void {
    this.setConnectionState(ConnectionState.ERROR);

    if (this.reconnectCount < this.RECONNECT_ATTEMPTS) {
      this.reconnectCount++;
      this.attemptReconnect();
    } else {
      this.showError('Máximo de tentativas de reconexão atingido');
      this.vncAtivo = false;
      this.isLoading = false;
    }
    this.cdr.markForCheck();
  }

  private attemptReconnect(): void {
    this.setConnectionState(ConnectionState.RECONNECTING);
    this.showInfo(`Reconectando (${this.reconnectCount}/${this.RECONNECT_ATTEMPTS})`);
    this.cdr.markForCheck();

    this.clearReconnectTimer();

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.establishConnection();
      } catch (error) {
        this.handleUnexpectedDisconnect();
      }
    }, this.RECONNECT_DELAY);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private cleanupConnection(): void {
    this.clearReconnectTimer();
    this.clearLatencyCheck();
    this.disconnectCanvasObserver();

    if (this.rfb) {
      try {
        this.rfb.disconnect();
      } catch (error) {
        console.error('Erro ao desconectar RFB:', error);
      }
      this.rfb = null;
    }

    this.vncAtivo = false;
    this.isLoading = false;
    this.desktopName = '';
    this.resetScaling();
    this.canvasElement = null;
  }

  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    this.status = state;
    this.cdr.detectChanges();
  }

  private async verificaRequisitos(): Promise<boolean> {
    try {
      this.setStatusMessage('Verificando requisitos...');

      // Timeout de 10s para o health-check - se o backend nao responder,
      // falha rapido em vez de travar a UI indefinidamente
      const healthPromise = this.hbService.health(this.host);
      const timeoutPromise = new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout verificando requisitos')), 10000)
      );

      const hbStatus = await Promise.race([healthPromise, timeoutPromise]);
      if (hbStatus?.status !== 'OK') {
        this.setStatusMessage('HBSERVICE NAO INICIADO NO DESTINO');
        this.showError('Serviço HB não está em execução');
        return false;
      }

      this.setStatusMessage('HBSERVICE INICIADO NO DESTINO');

      // Verificar status VNC (mesmo padrao com timeout)
      const vncStatusPromise = this.hbService.statusVNC(this.host);
      const vncTimeout = new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout verificando VNC')), 10000)
      );
      const vncStatus = await Promise.race([vncStatusPromise, vncTimeout]);

      if (vncStatus?.status === 'NAO INICIADO') {
        // Tentar reiniciar VNC
        this.setStatusMessage('VNC NAO INICIADO NO DESTINO, TENTATIVA DE INICIALIZAÇÃO');

        await this.hbService.restartVNC(this.host, '');

        await this.delay(3000);

        const newStatus = await this.hbService.statusVNC(this.host);
        if (newStatus?.status === 'NAO INICIADO') {
          this.setStatusMessage('VNC NAO INICIADO NO DESTINO, APOS TENTATIVA');
          this.showError('Serviço VNC não iniciado após tentativa');
          return false;
        }

        this.setStatusMessage('VNC INICIADO NO DESTINO COM TENTATIVA');
      } else {
        this.setStatusMessage('VNC EM EXECUÇÃO NO DESTINO');
      }

      return true;

    } catch (error: any) {
      console.error('Erro na verificação de requisitos:', error);

      // O hb_service relança erros HTTP como { status, message }
      // 403 = host bloqueado pela whitelist do backend
      // 503 = máquina não responde
      const msg = error?.message ?? error?.error ?? 'Falha na verificação de requisitos';
      const status = error?.status;

      if (status === 403) {
        this.setStatusMessage('HOST BLOQUEADO PELO SERVIDOR');
        this.showError(`Acesso negado: ${msg}`);
      } else if (status === 503) {
        this.setStatusMessage('MÁQUINA NÃO RESPONDE');
        this.showError(`Máquina inacessível: ${msg}`);
      } else {
        this.setStatusMessage('FALHA NA VERIFICAÇÃO DE REQUISITOS');
        this.showError(msg);
      }
      return false;
    }
  }

  private setStatusMessage(message: string): void {
    this.statusMessage = message;
    this.statusExecutaveis = message;
    // Forca update da UI - evita NG0100 ExpressionChangedAfterItHasBeenChecked
    // quando o setter e chamado dentro de promises async
    this.cdr.markForCheck();
  }

  private handleConnectionError(error: any): void {
    let errorMessage = 'Falha na conexão';

    if (error.message?.includes('NetworkError')) {
      errorMessage = 'Erro de rede';
    } else if (error.message?.includes('timeout')) {
      errorMessage = 'Tempo limite excedido';
    } else if (error.message?.includes('WebSocket')) {
      errorMessage = 'Erro no WebSocket';
    }

    this.showError(`${errorMessage}: ${error.message || 'Erro desconhecido'}`);
  }

  // Métodos auxiliares para feedback
  private showSuccess(message: string): void {
    this.setStatusMessage(message);
    this.snackBar.open(message, 'OK', {
      duration: 3000,
      panelClass: ['snackbar-success']
    });
  }

  private showError(message: string): void {
    this.setStatusMessage(message);
    this.snackBar.open(message, 'Fechar', {
      duration: 5000,
      panelClass: ['snackbar-error']
    });
  }

  private showInfo(message: string): void {
    this.setStatusMessage(message);
    this.snackBar.open(message, 'OK', {
      duration: 3000,
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
