import { Clipboard } from '@angular/cdk/clipboard';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MtxDialog } from '@ng-matero/extensions/dialog';
import { HotToastService } from '@ngxpert/hot-toast';
import { finalize, forkJoin } from 'rxjs';

import { normalizar } from '../../dispositivo/terminal-ssh/comandos';
import {
  Credencial,
  Disponibilidade,
  Opcoes,
  Papel,
  Pendencia,
  ROTULO_FORMA,
  ROTULO_PAPEL,
  ROTULO_SITUACAO,
  ROTULO_TIPO_LOCAL,
  Servico,
  Servidor,
  Situacao,
  TipoCredencial,
  ROTULO_FONTE,
  ROTULO_LEITURA,
  TesteFonte,
  TipoServico,
  duracao,
} from '../infraestrutura.models';
import { InfraestruturaService } from '../infraestrutura.service';
import {
  ConsultasCredencialDialogComponent,
  HistoricoDialogComponent,
  HistoricoDialogData,
} from './historico-dialog';
import { ServicoDialogComponent, ServicoDialogData } from './servico-dialog';
import { ServicoSistemasDialogComponent } from './servico-sistemas-dialog';
import { AtualizarHbServiceDialogComponent, AtualizarHbServiceDialogData } from './atualizar-hbservice-dialog';
import { ServidorDialogComponent, ServidorDialogData } from './servidor-dialog';
import { WinRmDialogComponent, WinRmDialogData } from './winrm-dialog';

/** Tempo que uma senha revelada fica na tela. */
const SENHA_VISIVEL_MS = 30_000;

/**
 * Infraestrutura > Servidores e Serviços: cadastro único de servidores (e
 * appliances, hosts Docker, clusters...) e seus serviços, com situação,
 * pendências (o que corrigir e como), cofre de credenciais e disponibilidade.
 */
@Component({
  selector: 'app-servidores-servicos',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTabsModule,
    MatTooltipModule,
  ],
  templateUrl: './servidores-servicos.html',
  styleUrl: './servidores-servicos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServidoresServicosComponent implements OnInit {
  private readonly service = inject(InfraestruturaService);
  private readonly dialog = inject(MatDialog);
  private readonly mtxDialog = inject(MtxDialog);
  private readonly toast = inject(HotToastService);
  private readonly clipboard = inject(Clipboard);
  private readonly destroyRef = inject(DestroyRef);

  readonly servidores = signal<Servidor[]>([]);
  readonly opcoes = signal<Opcoes | null>(null);
  readonly carregando = signal(true);
  readonly selecionado = signal<number | null>(null);

  readonly filtro = signal('');
  readonly filtroAmbiente = signal<string | null>(null);
  readonly filtroSituacao = signal<Situacao | null>(null);
  readonly soPendencias = signal(false);
  readonly mostrarInativos = signal(false);

  /** Senhas reveladas, por servidor e tipo; somem sozinhas. */
  readonly reveladas = signal<Record<string, Credencial>>({});

  /** Último "Testar leitura" por servidor, uma linha por fonte (some ao recarregar a tela). */
  readonly testesLeitura = signal<Record<number, TesteFonte[]>>({});
  readonly testandoLeitura = signal<number | null>(null);
  private temporizadores = new Map<string, ReturnType<typeof setTimeout>>();

  readonly rotuloSituacao = ROTULO_SITUACAO;
  readonly rotuloLocal = ROTULO_TIPO_LOCAL;
  readonly rotuloForma = ROTULO_FORMA;
  readonly rotuloPapel = ROTULO_PAPEL;
  readonly rotuloLeitura = ROTULO_LEITURA;
  readonly rotuloFonte = ROTULO_FONTE;
  readonly papeis = Object.keys(ROTULO_PAPEL) as Papel[];

  readonly filtrados = computed(() => {
    const termo = normalizar(this.filtro().trim());
    return this.servidores().filter(s => {
      if (!this.mostrarInativos() && !s.ativo) return false;
      if (this.filtroAmbiente() && !s.ambientes.includes(this.filtroAmbiente()!)) return false;
      if (this.filtroSituacao() && s.situacao !== this.filtroSituacao()
        && !s.servicos.some(sv => sv.situacao === this.filtroSituacao())) return false;
      if (this.soPendencias() && this.totalPendencias(s) === 0) return false;
      if (!termo) return true;
      const textos = [s.nome, s.ip, s.maquina, s.grupo, s.hospedagem, ...s.servicos.flatMap(sv => [sv.nome, sv.nmProcesso])];
      return normalizar(textos.filter(Boolean).join(' ')).includes(termo);
    });
  });

  readonly atual = computed(() => this.servidores().find(s => s.codServidor === this.selecionado()) ?? null);

  readonly resumo = computed(() => {
    const ativos = this.servidores().filter(s => s.ativo);
    return {
      servidores: ativos.length,
      fora: ativos.filter(s => s.situacao === 'FORA').length,
      servicosFora: ativos.flatMap(s => s.servicos).filter(sv => sv.situacao === 'FORA').length,
      pendencias: ativos.reduce((n, s) => n + this.totalPendencias(s), 0),
    };
  });

  ngOnInit() {
    this.carregar();
    this.destroyRef.onDestroy(() => this.temporizadores.forEach(t => clearTimeout(t)));
  }

  // ---------------------------------------------------------------- apresentação

  totalPendencias(s: Servidor): number {
    return s.pendencias.filter(p => p.gravidade !== 'INFO').length
      + s.servicos.reduce((n, sv) => n + sv.pendencias.filter(p => p.gravidade !== 'INFO').length, 0);
  }

  nomeAmbiente(codigo: string | null): string {
    if (!codigo) return '—';
    return this.opcoes()?.ambientes.find(a => a.codigo === codigo)?.nome ?? codigo;
  }

  ambientesTexto(codigos: string[]): string {
    return codigos.map(c => this.nomeAmbiente(c)).join(', ');
  }

  corAmbiente(codigo: string | null): string {
    return this.opcoes()?.ambientes.find(a => a.codigo === codigo)?.cor ?? '#8a8f98';
  }

  /** Tamanho de disco legível. O coletor grava o `df` em blocos de 1 KB; valor já com unidade (ex.: "70G") passa como veio. */
  tamanho(valor: string | null | undefined): string {
    if (!valor) return '—';
    const kb = Number(valor.trim());
    if (!Number.isFinite(kb)) return valor;
    const unidades = ['KB', 'MB', 'GB', 'TB', 'PB'];
    let v = kb;
    let i = 0;
    while (v >= 1024 && i < unidades.length - 1) {
      v /= 1024;
      i++;
    }
    return `${v.toLocaleString('pt-BR', { maximumFractionDigits: v < 10 ? 1 : 0 })} ${unidades[i]}`;
  }

  tamanhoKb(kb: number | null | undefined): string {
    return kb == null ? '—' : this.tamanho(String(kb));
  }

  /** Percentual inteiro de uso; null sem os dois valores. */
  uso(usado: number | null, total: number | null): number | null {
    if (usado == null || !total) return null;
    return Math.round((100 * usado) / total);
  }

  numero(v: number): string {
    return v.toLocaleString('pt-BR', { maximumFractionDigits: v < 10 ? 1 : 0 });
  }

  porta(sv: Servico): string | null {
    return sv.parametros.find(p => p.tipo === 'HTTP_PORT')?.valor ?? null;
  }

  percentual(d: Disponibilidade | null): string {
    if (!d || d.percentual === null) return '—';
    return `${d.percentual.toFixed(d.percentual === 100 ? 0 : 2).replace('.', ',')}%`;
  }

  tooltipDisponibilidade(d: Disponibilidade | null): string {
    if (!d) return 'Sem histórico';
    if (d.percentual === null) return d.observacao ?? 'Sem dados';
    const partes = [
      `Últimos 30 dias: ${d.paradas} parada(s), ${duracao(d.minutosParado)} parado`,
      d.minutosDegradado ? `${duracao(d.minutosDegradado)} degradado` : '',
      d.minutosPlanejados ? `${duracao(d.minutosPlanejados)} de manutenção planejada (fora do cálculo)` : '',
      d.observacao ?? '',
    ];
    return partes.filter(Boolean).join(' · ');
  }

  classeDisponibilidade(d: Disponibilidade | null): string {
    if (!d || d.percentual === null) return 'disp disp--sem';
    if (d.percentual >= 99.9) return 'disp disp--ok';
    if (d.percentual >= 99) return 'disp disp--alerta';
    return 'disp disp--ruim';
  }

  iconePendencia(p: Pendencia): string {
    return p.gravidade === 'ALTA' ? 'error' : p.gravidade === 'MEDIA' ? 'warning' : 'info';
  }

  // ---------------------------------------------------------------- cofre

  chave(codServidor: number, tipo: TipoCredencial) {
    return `${codServidor}:${tipo}`;
  }

  revelar(s: Servidor, tipo: TipoCredencial, copiar = false) {
    const k = this.chave(s.codServidor, tipo);
    const ja = this.reveladas()[k];
    if (ja && copiar) {
      this.copiar(ja);
      return;
    }
    this.service.revelarCredencial(s.codServidor, tipo).subscribe({
      next: cred => {
        if (cred.aviso) this.toast.warning(cred.aviso);
        if (copiar) {
          this.copiar(cred);
          return;
        }
        this.reveladas.update(r => ({ ...r, [k]: cred }));
        clearTimeout(this.temporizadores.get(k));
        this.temporizadores.set(k, setTimeout(() => this.esconder(k), SENHA_VISIVEL_MS));
      },
      error: () => {},
    });
  }

  esconder(k: string) {
    this.reveladas.update(r => {
      const { [k]: _, ...resto } = r;
      return resto;
    });
  }

  private copiar(cred: Credencial) {
    if (!cred.senha) {
      this.toast.warning('Não há senha cadastrada para copiar.');
      return;
    }
    this.clipboard.copy(cred.senha);
    this.toast.success('Senha copiada para a área de transferência.');
  }

  consultas(s: Servidor) {
    this.dialog.open(ConsultasCredencialDialogComponent, {
      width: '620px',
      maxWidth: '95vw',
      data: { codServidor: s.codServidor, nome: s.nome },
    });
  }

  // ---------------------------------------------------------------- cadastro

  novoServidor() {
    this.abrirServidor(null);
  }

  abrirServidor(s: Servidor | null) {
    const opcoes = this.opcoes();
    if (!opcoes) return;
    this.dialog
      .open<ServidorDialogComponent, ServidorDialogData, Servidor>(ServidorDialogComponent, {
        width: '820px',
        maxWidth: '96vw',
        maxHeight: '92vh',
        data: { servidor: s, opcoes },
      })
      .afterClosed()
      .subscribe(salvo => {
        if (!salvo) return;
        this.toast.success(`Servidor "${salvo.nome}" salvo.`);
        this.substituir(salvo);
        this.selecionado.set(salvo.codServidor);
      });
  }

  abrirServico(s: Servidor, sv: Servico | null) {
    const opcoes = this.opcoes();
    if (!opcoes) return;
    this.dialog
      .open<ServicoDialogComponent, ServicoDialogData, Servico>(ServicoDialogComponent, {
        width: '860px',
        maxWidth: '96vw',
        maxHeight: '92vh',
        data: { servidor: s, servico: sv, opcoes },
      })
      .afterClosed()
      .subscribe(salvo => {
        if (!salvo) return;
        this.toast.success(`Serviço "${salvo.nome}" salvo.`);
        this.carregar(false);
      });
  }

  excluirServico(sv: Servico) {
    this.mtxDialog.confirm(
      `Excluir o serviço "${sv.nome}"?`,
      'O histórico de disponibilidade fica guardado. Se ele só deixou de ser acompanhado, prefira desmarcar "Monitorado".',
      () =>
        this.service.excluirServico(sv.codProcesso).subscribe({
          next: () => {
            this.toast.success('Serviço excluído.');
            this.carregar(false);
          },
          error: () => {},
        })
    );
  }

  /** Em quais sistemas o serviço está; marca vários de uma vez (docs/infraestrutura.md, D-06 e R-27). */
  sistemasDoServico(sv: Servico) {
    this.dialog.open(ServicoSistemasDialogComponent, {
      maxWidth: '96vw',
      data: { codProcesso: sv.codProcesso, nome: sv.nome },
    });
  }

  // ---------------------------------------------------------------- WinRM

  prepararWinRm(s: Servidor) {
    this.dialog
      .open<WinRmDialogComponent, WinRmDialogData, void>(WinRmDialogComponent, {
        width: '860px',
        maxWidth: '96vw',
        maxHeight: '92vh',
        data: { codServidor: s.codServidor, nome: s.nome, protocolo: s.winrm },
      })
      .afterClosed()
      .subscribe(() => this.carregar(false));
  }

  /** Testa as fontes do modo de leitura do Windows: WinRM e/ou HB Service (R-54). */
  testarLeitura(s: Servidor) {
    this.testandoLeitura.set(s.codServidor);
    this.service
      .testarLeitura(s.codServidor)
      .pipe(finalize(() => this.testandoLeitura.set(null)))
      .subscribe({
        next: t => this.testesLeitura.update(r => ({ ...r, [s.codServidor]: t })),
        error: () => {},
      });
  }

  /** HB Service antigo (só memória): pela última leitura ou pelo último "Testar leitura" (R-53, R-59). */
  agenteAntigo(s: Servidor): boolean {
    return s.fonteLeitura === 'HBSERVICE_INFO' || (this.testesLeitura()[s.codServidor] ?? []).some(t => t.atualizarAgente);
  }

  /** Dispara o hbserviceUpdate no servidor, como na tela do VNC (R-59). */
  atualizarHbService(s: Servidor) {
    if (!s.ip) {
      this.toast.warning('Cadastre o IP do servidor: o NTI chama o HB Service por ele.');
      return;
    }
    this.dialog
      .open<AtualizarHbServiceDialogComponent, AtualizarHbServiceDialogData, boolean>(AtualizarHbServiceDialogComponent, {
        width: '720px',
        maxWidth: '96vw',
        maxHeight: '92vh',
        data: { codServidor: s.codServidor, nome: s.nome, host: s.ip },
      })
      .afterClosed()
      .subscribe(atualizou => {
        if (!atualizou) return;
        this.testesLeitura.update(r => {
          const { [s.codServidor]: _, ...resto } = r;
          return resto;
        });
        this.carregar(false);
      });
  }

  historico(tipo: 'SERVIDOR' | 'SERVICO', codItem: number, nome: string, disponibilidade: Disponibilidade | null) {
    this.dialog.open<HistoricoDialogComponent, HistoricoDialogData>(HistoricoDialogComponent, {
      width: '760px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      data: { tipo, codItem, nome, disponibilidade },
    });
  }

  definirPapel(t: TipoServico, papel: Papel | null) {
    this.service.definirPapel(t.codTipoProcesso, papel).subscribe({
      next: atualizado => {
        const o = this.opcoes();
        if (o) {
          this.opcoes.set({
            ...o,
            tipos: o.tipos.map(x => (x.codTipoProcesso === atualizado.codTipoProcesso ? atualizado : x)),
          });
        }
        this.toast.success(`Papel de "${atualizado.nome}" atualizado.`);
        this.carregar(false);
      },
      error: () => {},
    });
  }

  carregar(mostrarCarregando = true) {
    if (mostrarCarregando) this.carregando.set(true);
    forkJoin({ servidores: this.service.servidores(), opcoes: this.service.opcoes() })
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({
        next: r => {
          this.servidores.set(r.servidores);
          this.opcoes.set(r.opcoes);
          if (!this.selecionado() && r.servidores.length) this.selecionado.set(r.servidores[0].codServidor);
        },
        error: () => {},
      });
  }

  private substituir(s: Servidor) {
    const lista = this.servidores();
    const i = lista.findIndex(x => x.codServidor === s.codServidor);
    this.servidores.set(i >= 0 ? lista.map(x => (x.codServidor === s.codServidor ? s : x)) : [...lista, s]);
  }
}
