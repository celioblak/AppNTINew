import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MtxDialog } from '@ng-matero/extensions/dialog';
import { HotToastService } from '@ngxpert/hot-toast';
import { finalize, forkJoin } from 'rxjs';

import { SistemaDialogComponent } from '../../atualizacao/config/sistema-dialog';
import { SistemaResumo } from '../../atualizacao/atualizacao.models';
import { normalizar } from '../../dispositivo/terminal-ssh/comandos';
import {
  AmbienteSistema,
  Disponibilidade,
  Opcoes,
  Pendencia,
  ROTULO_CAMADA,
  ROTULO_SITUACAO,
  ROTULO_SITUACAO_SISTEMA,
  Servidor,
  ServicoSistema,
  SistemaInfra,
  SituacaoSistema,
  duracao,
} from '../infraestrutura.models';
import { InfraestruturaService } from '../infraestrutura.service';
import { HistoricoDialogComponent, HistoricoDialogData } from '../servidores-servicos/historico-dialog';
import { VinculoDialogComponent, VinculoDialogData } from './vinculo-dialog';

/** Ambientes que recebem sistemas (os de Atualizações). */
const AMBIENTES_DE_SISTEMA = ['PRODUCAO', 'HOMOLOGACAO', 'TREINAMENTO'];

/**
 * Infraestrutura > Sistemas e Serviços (docs/infraestrutura.md, F-2): sistema, versão e serviços por ambiente, com
 * camada e marca essencial/auxiliar; situação e disponibilidade do sistema. Atualizações só lê daqui.
 */
@Component({
  selector: 'app-sistemas-servicos',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTabsModule,
    MatTooltipModule,
  ],
  templateUrl: './sistemas-servicos.html',
  styleUrls: ['../servidores-servicos/servidores-servicos.scss', './sistemas-servicos.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SistemasServicosComponent implements OnInit {
  private readonly service = inject(InfraestruturaService);
  private readonly dialog = inject(MatDialog);
  private readonly mtxDialog = inject(MtxDialog);
  private readonly toast = inject(HotToastService);

  readonly rotuloCamada = ROTULO_CAMADA;
  readonly rotuloSituacao = ROTULO_SITUACAO;
  readonly rotuloSituacaoSistema = ROTULO_SITUACAO_SISTEMA;

  readonly carregando = signal(false);
  readonly sistemas = signal<SistemaInfra[]>([]);
  readonly cadastro = signal<SistemaResumo[]>([]);
  readonly opcoes = signal<Opcoes | null>(null);
  readonly servidores = signal<Servidor[]>([]);
  readonly selecionado = signal<number | null>(null);
  readonly aba = signal(0);
  readonly filtro = signal('');
  readonly mostrarInativos = signal(false);
  readonly soPendencias = signal(false);
  /** Versão em edição por ambiente (código do sistema no ambiente → texto). */
  readonly versoes = signal<Record<number, string>>({});

  readonly filtrados = computed(() => {
    const termo = normalizar(this.filtro().trim());
    return this.sistemas().filter(s => {
      if (!this.mostrarInativos() && !s.ativo) return false;
      if (this.soPendencias() && s.pendencias === 0) return false;
      if (!termo) return true;
      const textos = [s.nome, ...s.ambientes.flatMap(a => [a.versao ?? '', ...a.servicos.map(x => `${x.nome} ${x.servidor ?? ''}`)])];
      return normalizar(textos.join(' ')).includes(termo);
    });
  });

  readonly atual = computed(() => this.sistemas().find(s => s.codSistema === this.selecionado()) ?? null);

  readonly resumo = computed(() => {
    const lista = this.sistemas().filter(s => s.ativo);
    const ambientes = lista.flatMap(s => s.ambientes);
    return {
      sistemas: lista.length,
      fora: ambientes.filter(a => a.situacao === 'FORA').length,
      parciais: ambientes.filter(a => a.situacao === 'PARCIAL').length,
      pendencias: lista.reduce((n, s) => n + s.pendencias, 0),
    };
  });

  /** Ambientes de sistema em que o selecionado ainda não está. */
  readonly ambientesParaIncluir = computed(() => {
    const s = this.atual();
    const o = this.opcoes();
    if (!s || !o) return [];
    const ja = new Set(s.ambientes.map(a => a.ambiente));
    return o.ambientes.filter(a => a.ativo && AMBIENTES_DE_SISTEMA.includes(a.codigo) && !ja.has(a.codigo));
  });

  ngOnInit() {
    this.carregar();
  }

  carregar(mostrarCarregando = true) {
    if (mostrarCarregando) this.carregando.set(true);
    forkJoin({
      sistemas: this.service.sistemas(),
      cadastro: this.service.cadastroSistemas(),
      opcoes: this.service.opcoes(),
      servidores: this.service.servidores(),
    })
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({
        next: r => {
          this.sistemas.set(r.sistemas);
          this.cadastro.set(r.cadastro);
          this.opcoes.set(r.opcoes);
          this.servidores.set(r.servidores);
          if (!this.selecionado()) {
            const primeiro = r.sistemas.find(s => s.ativo) ?? r.sistemas[0];
            if (primeiro) this.selecionar(primeiro.codSistema);
          }
        },
        error: () => {},
      });
  }

  selecionar(codSistema: number) {
    this.selecionado.set(codSistema);
    this.aba.set(0);
  }

  /** Troca o sistema na lista pela versão que voltou da API. */
  private aplicar(s: SistemaInfra) {
    this.sistemas.update(lista => lista.map(x => (x.codSistema === s.codSistema ? s : x)));
  }

  // ---------------------------------------------------------------- sistema

  novoSistema() {
    this.abrirSistema(undefined);
  }

  editarSistema(s: SistemaInfra) {
    this.abrirSistema(this.cadastro().find(c => c.codSistema === s.codSistema));
  }

  private abrirSistema(registro: SistemaResumo | undefined) {
    this.dialog
      .open(SistemaDialogComponent, { width: '620px', maxWidth: '96vw', data: { catalogo: null, registro } })
      .afterClosed()
      .subscribe(ok => {
        if (ok) {
          this.toast.success('Sistema salvo.');
          this.carregar(false);
        }
      });
  }

  excluirSistema(s: SistemaInfra) {
    this.mtxDialog.confirm(`Excluir o sistema "${s.nome}"? Só é possível se ele não tiver uso (ambientes, atualizações, incidentes).`, '', () =>
      this.service.excluirSistema(s.codSistema).subscribe({
        next: () => {
          this.toast.success('Sistema excluído.');
          this.selecionado.set(null);
          this.carregar(false);
        },
        error: () => {},
      })
    );
  }

  // ---------------------------------------------------------------- ambiente

  incluirAmbiente(s: SistemaInfra, ambiente: string) {
    this.service.salvarVersao(s.codSistema, ambiente, null).subscribe({
      next: atualizado => {
        this.aplicar(atualizado);
        this.aba.set(Math.max(0, atualizado.ambientes.findIndex(a => a.ambiente === ambiente)));
        this.toast.success('Ambiente incluído. Informe a versão e os serviços.');
      },
      error: () => {},
    });
  }

  versaoEditada(a: AmbienteSistema) {
    return this.versoes()[a.codSistemaAmbiente] ?? a.versao ?? '';
  }

  editarVersao(a: AmbienteSistema, texto: string) {
    this.versoes.update(v => ({ ...v, [a.codSistemaAmbiente]: texto }));
  }

  versaoMudou(a: AmbienteSistema) {
    return (this.versaoEditada(a).trim() || null) !== (a.versao ?? null);
  }

  salvarVersao(s: SistemaInfra, a: AmbienteSistema) {
    this.service.salvarVersao(s.codSistema, a.ambiente, this.versaoEditada(a).trim() || null).subscribe({
      next: atualizado => {
        this.aplicar(atualizado);
        this.versoes.update(v => {
          const { [a.codSistemaAmbiente]: _, ...resto } = v;
          return resto;
        });
        this.toast.success('Versão salva.');
      },
      error: () => {},
    });
  }

  excluirAmbiente(s: SistemaInfra, a: AmbienteSistema) {
    this.mtxDialog.confirm(`Tirar ${s.nome} de ${a.nomeAmbiente}? A versão e os ${a.servicos.length} vínculo(s) de serviço saem.`, '', () =>
      this.service.excluirAmbienteDoSistema(s.codSistema, a.ambiente).subscribe({
        next: atualizado => {
          this.aplicar(atualizado);
          this.aba.set(0);
          this.toast.success('Ambiente retirado do sistema.');
        },
        error: () => {},
      })
    );
  }

  // ---------------------------------------------------------------- serviços

  abrirVinculo(s: SistemaInfra, a: AmbienteSistema, vinculo: ServicoSistema | null) {
    this.dialog
      .open<VinculoDialogComponent, VinculoDialogData, SistemaInfra>(VinculoDialogComponent, {
        maxWidth: '96vw',
        data: { sistema: s, ambiente: a.ambiente, nomeAmbiente: a.nomeAmbiente, servidores: this.servidores(), vinculo },
      })
      .afterClosed()
      .subscribe(atualizado => {
        if (atualizado) {
          this.aplicar(atualizado);
          this.toast.success(vinculo ? 'Vínculo atualizado.' : 'Serviço incluído no sistema.');
        }
      });
  }

  desvincular(s: SistemaInfra, a: AmbienteSistema, sv: ServicoSistema) {
    this.mtxDialog.confirm(`Tirar ${sv.nome} de ${s.nome} em ${a.nomeAmbiente}?`, '', () =>
      this.service.desvincular(s.codSistema, a.ambiente, sv.codProcesso).subscribe({
        next: atualizado => {
          this.aplicar(atualizado);
          this.toast.success('Serviço retirado do sistema.');
        },
        error: () => {},
      })
    );
  }

  // ---------------------------------------------------------------- apresentação

  historico(a: AmbienteSistema, s: SistemaInfra) {
    this.dialog.open<HistoricoDialogComponent, HistoricoDialogData>(HistoricoDialogComponent, {
      width: '760px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      data: { tipo: 'SISTEMA', codItem: a.codSistemaAmbiente, nome: `${s.nome} · ${a.nomeAmbiente}`, disponibilidade: a.disponibilidade },
    });
  }

  historicoServico(sv: ServicoSistema) {
    this.dialog.open<HistoricoDialogComponent, HistoricoDialogData>(HistoricoDialogComponent, {
      width: '760px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      data: { tipo: 'SERVICO', codItem: sv.codProcesso, nome: sv.nome, disponibilidade: sv.disponibilidade },
    });
  }

  /** Pior situação entre os ambientes (cor da lista). */
  pior(s: SistemaInfra): SituacaoSistema {
    const ordem: SituacaoSistema[] = ['FORA', 'PARCIAL', 'DESCONHECIDO', 'OK'];
    for (const sit of ordem) if (s.ambientes.some(a => a.situacao === sit)) return sit;
    return 'DESCONHECIDO';
  }

  /** Classe de cor da situação do sistema (parcial usa a cor de atenção). */
  classeSistema(situacao: SituacaoSistema) {
    return 'sit--' + (situacao === 'PARCIAL' ? 'alerta' : situacao.toLowerCase());
  }

  percentual(d: Disponibilidade | null): string {
    if (!d || d.percentual === null) return '—';
    return `${d.percentual.toFixed(d.percentual === 100 ? 0 : 2).replace('.', ',')}%`;
  }

  tooltipDisponibilidade(d: Disponibilidade | null): string {
    if (!d) return 'Sem histórico';
    if (d.percentual === null) return d.observacao ?? 'Sem dados';
    const partes = [
      `Últimos 30 dias: ${d.paradas} parada(s), ${duracao(d.minutosParado)} fora`,
      d.minutosDegradado ? `${duracao(d.minutosDegradado)} parcial` : '',
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

  corAmbiente(a: AmbienteSistema) {
    return a.cor ?? '#8a8f98';
  }
}
