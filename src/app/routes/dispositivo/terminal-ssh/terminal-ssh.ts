import { Clipboard } from '@angular/cdk/clipboard';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute } from '@angular/router';
import { ServidorComando, ServidorSsh } from '@core';
import { MtxDialog } from '@ng-matero/extensions/dialog';
import { HotToastService } from '@ngxpert/hot-toast';
import { AlturaAteRodape } from '@shared';
import { Subject, catchError, finalize, of, switchMap } from 'rxjs';

import { ComandoParametrosDialogComponent, ComandoParametrosDialogData } from './comando-parametros-dialog';
import { agrupar, extrairParametros, normalizar, rotuloServidores } from './comandos';
import { ConexaoAvulsa, ConexaoAvulsaDialogComponent } from './conexao-avulsa-dialog';
import { EventoStatusTerminal, SshTerminalComponent, StatusTerminal } from './ssh-terminal/ssh-terminal';
import { DestinoSsh, TerminalSshService } from './terminal-ssh.service';

interface AbaTerminal {
  id: number;
  titulo: string;
  subtitulo: string;
  destino: DestinoSsh;
  /** Só na conexão avulsa; fica apenas em memória para permitir reconectar. */
  senha?: string;
  codServidor: number | null;
  status: StatusTerminal;
  mensagem: string;
  chaveHost?: string;
}

/**
 * Dispositivos > Terminal SSH: terminais em abas, lista de servidores e comandos prontos.
 * O cadastro dos comandos fica em Dispositivos > Comandos SSH, com acesso próprio.
 */
@Component({
  selector: 'app-terminal-ssh',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatSlideToggleModule,
    MatTabsModule,
    MatTooltipModule,
    AlturaAteRodape,
    SshTerminalComponent,
  ],
  templateUrl: './terminal-ssh.html',
  styleUrl: './terminal-ssh.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TerminalSshComponent implements OnInit {
  private readonly service = inject(TerminalSshService);
  private readonly dialog = inject(MatDialog);
  private readonly mtxDialog = inject(MtxDialog);
  private readonly toast = inject(HotToastService);
  private readonly clipboard = inject(Clipboard);
  private readonly route = inject(ActivatedRoute);

  private readonly areaTerminais = viewChild.required<ElementRef<HTMLElement>>('areaTerminais');
  private readonly terminais = viewChildren(SshTerminalComponent);

  readonly servidores = signal<ServidorSsh[]>([]);
  readonly carregandoServidores = signal(true);
  readonly filtroServidor = signal('');
  readonly apenasAtivos = signal(true);
  readonly painelServidoresAberto = signal(true);
  private readonly nomesServidores = computed(() => new Map(this.servidores().map(s => [s.codServidor, s.dsServidor])));

  readonly abas = signal<AbaTerminal[]>([]);
  readonly indiceAba = signal(0);
  readonly abaAtiva = computed(() => this.abas()[this.indiceAba()] ?? null);
  readonly podeExecutar = computed(() => this.abaAtiva()?.status === 'CONECTADO');
  private readonly codServidorAtivo = computed(() => this.abaAtiva()?.codServidor ?? null);

  readonly comandos = signal<ServidorComando[]>([]);
  readonly carregandoComandos = signal(false);
  readonly filtroComando = signal('');
  readonly painelComandosAberto = signal(true);

  termoBusca = '';

  private proximoIdAba = 1;
  private readonly pedidoComandos = new Subject<number | null>();

  readonly gruposServidores = computed(() => {
    const termo = normalizar(this.filtroServidor().trim());
    const visiveis = this.servidores().filter(
      s =>
        (!this.apenasAtivos() || s.snAtivo) &&
        (!termo || normalizar([s.dsServidor, s.dsIP, s.dsMaquina, s.usuario, s.dsGrupo].join(' ')).includes(termo))
    );
    return agrupar(visiveis, s => s.dsGrupo ?? 'Sem grupo').sort((a, b) => a.nome.localeCompare(b.nome));
  });

  readonly gruposComandos = computed(() => {
    const termo = normalizar(this.filtroComando().trim());
    const visiveis = this.comandos().filter(
      c => !termo || normalizar([c.dsTitulo, c.dsComando, c.dsDescricao, c.dsCategoria].join(' ')).includes(termo)
    );
    return agrupar(visiveis, c => c.dsCategoria ?? 'Geral');
  });

  readonly servidoresAbertos = computed(() => new Set(this.abas().map(aba => aba.codServidor)));

  constructor() {
    this.pedidoComandos
      .pipe(
        switchMap(codServidor => {
          this.carregandoComandos.set(true);
          return this.service.listarComandos(codServidor).pipe(
            catchError(() => of<ServidorComando[]>([])),
            finalize(() => this.carregandoComandos.set(false))
          );
        }),
        takeUntilDestroyed()
      )
      .subscribe(comandos => this.comandos.set(comandos));

    // Recarrega os comandos só quando muda o servidor da aba ativa.
    effect(() => {
      const codServidor = this.codServidorAtivo();
      untracked(() => this.pedidoComandos.next(codServidor));
    });
  }

  ngOnInit() {
    this.service
      .listarServidores()
      .pipe(finalize(() => this.carregandoServidores.set(false)))
      .subscribe({
        next: servidores => {
          this.servidores.set(servidores);
          this.abrirServidorDaUrl(servidores);
        },
        error: () => this.servidores.set([]),
      });
  }

  // ---------------------------------------------------------------- abas

  abrirServidor(servidor: ServidorSsh) {
    if (!servidor.possuiCredencial) {
      this.toast.warning(
        `${servidor.dsServidor} não tem IP ou usuário/senha cadastrados. Ajuste em Dispositivos > Servidores.`
      );
      return;
    }
    const abertas = this.abas().filter(aba => aba.codServidor === servidor.codServidor).length;
    this.adicionarAba({
      titulo: servidor.dsServidor + (abertas ? ` (${abertas + 1})` : ''),
      subtitulo: `${servidor.usuario}@${servidor.dsIP || servidor.dsMaquina}`,
      destino: { codServidor: servidor.codServidor },
      codServidor: servidor.codServidor,
    });
  }

  abrirConexaoAvulsa() {
    this.dialog
      .open<ConexaoAvulsaDialogComponent, void, ConexaoAvulsa>(ConexaoAvulsaDialogComponent, { width: '460px', maxWidth: '95vw' })
      .afterClosed()
      .subscribe(conexao => {
        if (!conexao) {
          return;
        }
        const descricao = `${conexao.usuario}@${conexao.host}${conexao.porta === 22 ? '' : ':' + conexao.porta}`;
        this.adicionarAba({
          titulo: descricao,
          subtitulo: 'Conexão avulsa',
          destino: { host: conexao.host, porta: conexao.porta, usuario: conexao.usuario },
          senha: conexao.senha,
          codServidor: null,
        });
      });
  }

  fecharAba(aba: AbaTerminal, evento?: Event) {
    evento?.stopPropagation();
    const fechar = () => {
      const indiceFechado = this.abas().findIndex(a => a.id === aba.id);
      const atual = this.indiceAba();
      this.abas.update(abas => abas.filter(a => a.id !== aba.id));
      const novo = indiceFechado < atual ? atual - 1 : atual;
      this.indiceAba.set(Math.max(0, Math.min(novo, this.abas().length - 1)));
    };

    if (aba.status === 'CONECTADO') {
      this.mtxDialog.confirm(
        `Fechar o terminal ${aba.titulo}?`,
        'A sessão SSH será encerrada. Processos em primeiro plano (sem nohup, tmux ou screen) serão interrompidos.',
        fechar
      );
    } else {
      fechar();
    }
  }

  atualizarStatus(idAba: number, evento: EventoStatusTerminal) {
    this.abas.update(abas =>
      abas.map(aba =>
        aba.id === idAba
          ? { ...aba, status: evento.status, mensagem: evento.mensagem, chaveHost: evento.chaveHost ?? aba.chaveHost }
          : aba
      )
    );
  }

  // ------------------------------------------------------ ações do terminal

  reconectar() {
    this.terminalAtivo()?.reconectar();
  }

  limpar() {
    this.terminalAtivo()?.limpar();
  }

  alterarFonte(delta: number) {
    this.terminalAtivo()?.alterarFonte(delta);
  }

  copiarSelecao() {
    const texto = this.terminalAtivo()?.selecao();
    if (!texto) {
      this.toast.info('Selecione um trecho no terminal para copiar.');
      return;
    }
    this.clipboard.copy(texto);
    this.toast.success('Seleção copiada.');
  }

  async colar() {
    try {
      const texto = await navigator.clipboard.readText();
      if (texto) {
        this.terminalAtivo()?.colar(texto);
      }
    } catch {
      this.toast.info('O navegador bloqueou a área de transferência: use Ctrl+V dentro do terminal.');
    }
  }

  localizar(proximo = true) {
    if (this.termoBusca) {
      this.terminalAtivo()?.localizar(this.termoBusca, proximo);
    }
  }

  telaCheia() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      this.areaTerminais().nativeElement.requestFullscreen();
    }
  }

  // ------------------------------------------------------------- comandos

  rotuloVinculo(comando: ServidorComando) {
    return rotuloServidores(comando, this.nomesServidores());
  }

  recarregarComandos() {
    this.pedidoComandos.next(this.codServidorAtivo());
  }

  executarComando(comando: ServidorComando, pressionarEnter: boolean) {
    const aba = this.abaAtiva();
    const terminal = this.terminalAtivo();
    if (!aba || !terminal || aba.status !== 'CONECTADO') {
      this.toast.warning('Conecte-se a um servidor antes de executar comandos.');
      return;
    }

    const enviar = (texto: string) => {
      if (pressionarEnter && comando.snConfirmar) {
        this.mtxDialog.confirm(`Executar "${comando.dsTitulo}" em ${aba.titulo}?`, texto, () => terminal.digitar(texto, true));
      } else {
        terminal.digitar(texto, pressionarEnter);
      }
    };

    const parametros = extrairParametros(comando.dsComando);
    if (parametros.length === 0) {
      enviar(comando.dsComando);
      return;
    }
    this.dialog
      .open<ComandoParametrosDialogComponent, ComandoParametrosDialogData, string>(ComandoParametrosDialogComponent, {
        width: '520px',
        maxWidth: '95vw',
        data: { comando, parametros },
      })
      .afterClosed()
      .subscribe(texto => {
        if (texto) {
          enviar(texto);
        }
      });
  }

  copiarComando(comando: ServidorComando) {
    this.clipboard.copy(comando.dsComando);
    this.toast.success('Comando copiado.');
  }

  // ------------------------------------------------------------- apoio

  private adicionarAba(dados: Omit<AbaTerminal, 'id' | 'status' | 'mensagem'>) {
    this.abas.update(abas => [...abas, { ...dados, id: this.proximoIdAba++, status: 'CONECTANDO', mensagem: 'Conectando...' }]);
    this.indiceAba.set(this.abas().length - 1);
  }

  private terminalAtivo(): SshTerminalComponent | undefined {
    const aba = this.abaAtiva();
    return aba ? this.terminais().find(terminal => terminal.abaId() === aba.id) : undefined;
  }

  private abrirServidorDaUrl(servidores: ServidorSsh[]) {
    const codServidor = Number(this.route.snapshot.queryParamMap.get('servidor'));
    if (!codServidor) {
      return;
    }
    const servidor = servidores.find(s => s.codServidor === codServidor);
    if (servidor) {
      this.abrirServidor(servidor);
    } else {
      this.toast.warning('O servidor escolhido não está cadastrado como Linux/Unix ou com acesso SSH.');
    }
  }
}
