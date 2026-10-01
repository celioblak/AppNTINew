import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MtxDialog } from '@ng-matero/extensions/dialog';
import { MtxGridColumn, MtxGridModule } from '@ng-matero/extensions/grid';
import { HotToastService } from '@ngxpert/hot-toast';
import { AlturaAteRodape } from '@shared';
import { finalize, forkJoin } from 'rxjs';

import { normalizar } from '../terminal-ssh/comandos';
import { BalanceadorDialogComponent, BalanceadorDialogData } from './balanceador-dialog';
import { BalanceadorCadastro, PAINEL_DIALOGO_MAPA, ProcessoOpcao, SistemaCadastro } from './mapa-servicos.models';
import { MapaServicosService } from './mapa-servicos.service';
import { SistemaMapaDialogComponent, SistemaMapaDialogData } from './sistema-mapa-dialog';

interface LinhaSistema extends SistemaCadastro {
  entradasTexto: string;
}

interface LinhaBalanceador extends BalanceadorCadastro {
  processoTexto: string;
  membrosTexto: string;
  usoTexto: string;
}

/**
 * Dispositivos > Balanceadores dos sistemas: o cadastro que monta o Mapa de
 * serviços e diz ao painel de TV quais sistemas um servidor/serviço fora
 * derruba.
 *
 * - Sistemas: por onde cada sistema é acessado (balanceador ou serviço direto).
 * - Balanceadores: cada balanceador e seus membros (serviços ou outros
 *   balanceadores), reutilizáveis entre sistemas.
 */
@Component({
  selector: 'app-balanceadores-sistemas',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSlideToggleModule,
    MatTabsModule,
    MatTooltipModule,
    MtxGridModule,
    RouterLink,
    AlturaAteRodape,
  ],
  templateUrl: './balanceadores-sistemas.html',
  styleUrl: './balanceadores-sistemas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BalanceadoresSistemasComponent implements OnInit {
  private readonly service = inject(MapaServicosService);
  private readonly dialog = inject(MatDialog);
  private readonly mtxDialog = inject(MtxDialog);
  private readonly toast = inject(HotToastService);
  private readonly rota = inject(ActivatedRoute);

  readonly sistemas = signal<SistemaCadastro[]>([]);
  readonly balanceadores = signal<BalanceadorCadastro[]>([]);
  readonly processos = signal<ProcessoOpcao[]>([]);
  readonly carregando = signal(true);
  readonly aba = signal(0);
  readonly filtro = signal('');
  readonly soPendentes = signal(false);

  readonly totalMapeados = computed(() => this.sistemas().filter(s => s.cadastrado).length);

  private readonly nomeProcesso = computed(() => {
    const porCod = new Map(this.processos().map(p => [p.codProcesso, `${p.nome} (${p.servidor})`]));
    return (cod: number | null) => (cod ? porCod.get(cod) ?? `Processo ${cod}` : '');
  });

  private readonly nomeBalanceador = computed(() => {
    const porCod = new Map(this.balanceadores().map(b => [b.codBalanceador, b.nome]));
    return (cod: number | null) => (cod ? porCod.get(cod) ?? `Balanceador ${cod}` : '');
  });

  readonly linhasSistema = computed<LinhaSistema[]>(() => {
    const termo = normalizar(this.filtro().trim());
    const proc = this.nomeProcesso();
    const bal = this.nomeBalanceador();
    return this.sistemas()
      .filter(s => !this.soPendentes() || (!s.cadastrado && s.sistemaAtivo))
      .map(s => ({
        ...s,
        entradasTexto: s.entradas
          .map(e => (e.codBalanceador ? `⇄ ${bal(e.codBalanceador)}` : `⚙ ${proc(e.codProcesso)}`))
          .join('   '),
      }))
      .filter(l => !termo || normalizar([l.sistema, l.entradasTexto].join(' ')).includes(termo));
  });

  readonly linhasBalanceador = computed<LinhaBalanceador[]>(() => {
    const termo = normalizar(this.filtro().trim());
    const proc = this.nomeProcesso();
    const bal = this.nomeBalanceador();
    return this.balanceadores()
      .map(b => ({
        ...b,
        processoTexto: b.codProcesso ? proc(b.codProcesso) : 'Externo',
        membrosTexto: b.membros
          .map(m => (m.codBalanceadorFilho ? `⇄ ${bal(m.codBalanceadorFilho)}` : `⚙ ${proc(m.codProcesso)}`))
          .join(', '),
        usoTexto: [...b.sistemas, ...b.pais.map(p => `⇄ ${p}`)].join(', '),
      }))
      .filter(l => !termo || normalizar([l.nome, l.processoTexto, l.worker, l.membrosTexto, l.usoTexto].join(' ')).includes(termo));
  });

  readonly colunasSistema: MtxGridColumn[] = [
    { header: 'Sistema', field: 'sistema', minWidth: 220, sortable: true },
    { header: 'Entradas (balanceador ou serviço direto)', field: 'entradasTexto', minWidth: 360 },
    { header: 'Painel', field: 'exibePainel', width: '90px' },
    {
      header: 'Operações',
      field: 'operacoes',
      width: '110px',
      pinned: 'right',
      type: 'button',
      buttons: [
        { type: 'icon', icon: 'edit', tooltip: 'Configurar', click: (l: LinhaSistema) => this.abrirSistema(l) },
        {
          type: 'icon',
          icon: 'link_off',
          color: 'warn',
          tooltip: 'Tirar do mapa',
          disabled: (l: LinhaSistema) => !l.cadastrado,
          click: (l: LinhaSistema) => this.excluirSistema(l),
        },
      ],
    },
  ];

  readonly colunasBalanceador: MtxGridColumn[] = [
    { header: 'Balanceador', field: 'nome', minWidth: 200, sortable: true },
    { header: 'Processo', field: 'processoTexto', minWidth: 200 },
    { header: 'Worker', field: 'worker', width: '140px' },
    { header: 'Membros', field: 'membrosTexto', minWidth: 280 },
    { header: 'Usado por', field: 'usoTexto', minWidth: 200 },
    {
      header: 'Operações',
      field: 'operacoes',
      width: '110px',
      pinned: 'right',
      type: 'button',
      buttons: [
        { type: 'icon', icon: 'edit', tooltip: 'Editar', click: (l: LinhaBalanceador) => this.abrirBalanceador(l) },
        {
          type: 'icon',
          icon: 'delete',
          color: 'warn',
          tooltip: 'Excluir',
          click: (l: LinhaBalanceador) => this.excluirBalanceador(l),
        },
      ],
    },
  ];

  ngOnInit() {
    this.carregar(() => {
      // Vindo do Mapa de serviços com ?sistema=, abre direto o cadastro dele.
      const cod = Number(this.rota.snapshot.queryParamMap.get('sistema'));
      const alvo = cod ? this.sistemas().find(s => s.codSistema === cod) : undefined;
      if (alvo) this.abrirSistema(alvo);
    });
  }

  abrirSistema(sistema: SistemaCadastro) {
    this.dialog
      .open<SistemaMapaDialogComponent, SistemaMapaDialogData, SistemaCadastro>(SistemaMapaDialogComponent, {
        width: '760px',
        panelClass: PAINEL_DIALOGO_MAPA,
        maxWidth: '96vw',
        maxHeight: '92vh',
        data: { sistema, processos: this.processos(), balanceadores: this.balanceadores() },
      })
      .afterClosed()
      .subscribe(salvo => {
        if (salvo) {
          this.toast.success(`"${salvo.sistema}" salvo no mapa.`);
          this.carregar();
        }
      });
  }

  abrirBalanceador(balanceador: BalanceadorCadastro | null = null) {
    this.dialog
      .open<BalanceadorDialogComponent, BalanceadorDialogData, BalanceadorCadastro>(BalanceadorDialogComponent, {
        width: '980px',
        panelClass: PAINEL_DIALOGO_MAPA,
        maxWidth: '96vw',
        maxHeight: '92vh',
        data: { balanceador, processos: this.processos(), balanceadores: this.balanceadores() },
      })
      .afterClosed()
      .subscribe(salvo => {
        if (salvo) {
          this.toast.success(`Balanceador "${salvo.nome}" salvo.`);
          this.carregar();
        }
      });
  }

  private excluirSistema(linha: LinhaSistema) {
    this.mtxDialog.confirm(
      `Tirar "${linha.sistema}" do mapa?`,
      'O sistema deixa de aparecer no Mapa de serviços e nos impactos do painel. Os balanceadores continuam cadastrados.',
      () =>
        this.service.excluirSistema(linha.codSistema).subscribe({
          next: () => {
            this.toast.success('Sistema retirado do mapa.');
            this.carregar();
          },
          error: () => {},
        })
    );
  }

  private excluirBalanceador(linha: LinhaBalanceador) {
    const uso = linha.usoTexto ? ` Ele sai também de: ${linha.usoTexto}.` : '';
    this.mtxDialog.confirm(`Excluir o balanceador "${linha.nome}"?`, `Esta ação não pode ser desfeita.${uso}`, () =>
      this.service.excluirBalanceador(linha.codBalanceador!).subscribe({
        next: () => {
          this.toast.success('Balanceador excluído.');
          this.carregar();
        },
        error: () => {},
      })
    );
  }

  private carregar(depois?: () => void) {
    this.carregando.set(true);
    forkJoin({
      sistemas: this.service.sistemas(),
      balanceadores: this.service.balanceadores(),
      processos: this.service.processos(),
    })
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({
        next: ({ sistemas, balanceadores, processos }) => {
          this.sistemas.set(sistemas);
          this.balanceadores.set(balanceadores);
          this.processos.set(processos);
          depois?.();
        },
        error: () => {},
      });
  }
}
