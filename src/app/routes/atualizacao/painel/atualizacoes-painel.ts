import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { MtxGridColumn, MtxGridModule } from '@ng-matero/extensions/grid';
import { HotToastService } from '@ngxpert/hot-toast';
import { AlturaAteRodape } from '@shared';
import { finalize } from 'rxjs';

import {
  AtualizacaoDetalhe,
  AtualizacaoResumo,
  Painel,
  SITUACAO_INFO,
  SituacaoAtualizacao,
  Tom,
  normalizarTexto,
} from '../atualizacao.models';
import { AtualizacaoService } from '../atualizacao.service';
import { DadosDialogComponent, DadosDialogData } from '../compartilhado/dados-dialog';
import { EtiquetaComponent, SituacaoChipComponent } from '../compartilhado/situacao-chip';

type ChaveResumo =
  | 'aguardandoValidacao'
  | 'aguardandoCorrecao'
  | 'backupProducaoPendente'
  | 'aguardandoAprovacao'
  | 'producaoNaSemana'
  | 'emergenciaisSemHomologacao'
  | 'parciais'
  | 'comChoques';

const DEPOIS_DA_SOLICITACAO: SituacaoAtualizacao[] = ['AGUARDANDO_APROVACAO', 'APROVADA', 'PARCIAL', 'EM_PRODUCAO'];

/** Filtros do resumo: o mesmo critério da contagem do backend, aplicado às linhas. */
const RESUMOS: { chave: ChaveResumo; rotulo: string; tom: Tom; filtro: (r: AtualizacaoResumo) => boolean }[] = [
  {
    chave: 'aguardandoValidacao',
    rotulo: 'Aguardando validação',
    tom: 'alerta',
    filtro: r =>
      r.homologacaoCompleta && !r.homologada && (r.situacao === 'EM_HOMOLOGACAO' || (r.emergencial && DEPOIS_DA_SOLICITACAO.includes(r.situacao))),
  },
  { chave: 'aguardandoCorrecao', rotulo: 'Aguardando correção do fabricante', tom: 'alerta', filtro: r => r.situacao === 'AGUARDANDO_CORRECAO' },
  { chave: 'backupProducaoPendente', rotulo: 'Validadas com backup de produção pendente', tom: 'info', filtro: r => r.backupProducaoPendente },
  { chave: 'aguardandoAprovacao', rotulo: 'Aguardando aprovação', tom: 'alerta', filtro: r => r.situacao === 'AGUARDANDO_APROVACAO' },
  {
    chave: 'producaoNaSemana',
    rotulo: 'Produção agendada em 7 dias',
    tom: 'info',
    filtro: r => r.situacao === 'APROVADA' && !!r.janela && new Date(r.janela).getTime() < Date.now() + 7 * 86_400_000,
  },
  {
    chave: 'emergenciaisSemHomologacao',
    rotulo: 'Emergenciais sem homologação',
    tom: 'critico',
    filtro: r => r.emergencial && !r.homologada && (r.situacao === 'PARCIAL' || r.situacao === 'EM_PRODUCAO'),
  },
  { chave: 'parciais', rotulo: 'Parciais', tom: 'critico', filtro: r => r.situacao === 'PARCIAL' },
  { chave: 'comChoques', rotulo: 'Com choque de telas ou JAR', tom: 'critico', filtro: r => r.qtdChoques > 0 },
];

/** Atualizações > Painel (T-01): o que precisa de ação primeiro. */
@Component({
  selector: 'app-atualizacoes-painel',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    MtxGridModule,
    AlturaAteRodape,
    EtiquetaComponent,
    SituacaoChipComponent,
  ],
  templateUrl: './atualizacoes-painel.html',
  styleUrls: ['../compartilhado/atualizacao-pagina.scss', './atualizacoes-painel.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AtualizacoesPainelComponent implements OnInit {
  private readonly service = inject(AtualizacaoService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly toast = inject(HotToastService);

  readonly situacaoInfo = SITUACAO_INFO;
  readonly situacoesDisponiveis = Object.keys(SITUACAO_INFO) as SituacaoAtualizacao[];
  readonly periodos = [
    { dias: 30, rotulo: '30 dias' },
    { dias: 90, rotulo: '90 dias' },
    { dias: 365, rotulo: '1 ano' },
    { dias: 1825, rotulo: '5 anos' },
  ];

  readonly painel = signal<Painel | null>(null);
  readonly carregando = signal(true);
  readonly dias = signal(365);
  readonly texto = signal('');
  readonly situacoes = signal<SituacaoAtualizacao[]>([]);
  readonly sistema = signal<string | null>(null);
  readonly responsavel = signal<string | null>(null);
  readonly filtroResumo = signal<ChaveResumo | null>(null);

  readonly atualizacoes = computed(() => this.painel()?.atualizacoes ?? []);
  readonly sistemas = computed(() => distintos(this.atualizacoes().map(a => a.sistema)));
  readonly responsaveis = computed(() => distintos(this.atualizacoes().map(a => a.nomeResponsavel)));

  readonly tiles = computed(() => {
    const resumo = this.painel()?.resumo;
    return RESUMOS.map(r => ({ ...r, valor: resumo ? resumo[r.chave] : 0 }));
  });

  readonly filtradas = computed(() => {
    const termo = normalizarTexto(this.texto().trim());
    const situacoes = this.situacoes();
    const sistema = this.sistema();
    const responsavel = this.responsavel();
    const resumo = RESUMOS.find(r => r.chave === this.filtroResumo());
    return this.atualizacoes().filter(
      a =>
        (!termo || normalizarTexto(`${a.numero} ${a.titulo} ${a.ticketMv ?? ''}`).includes(termo)) &&
        (!situacoes.length || situacoes.includes(a.situacao)) &&
        (!sistema || a.sistema === sistema) &&
        (!responsavel || a.nomeResponsavel === responsavel) &&
        (!resumo || resumo.filtro(a))
    );
  });

  readonly colunas: MtxGridColumn[] = [
    { header: 'Número', field: 'numero', width: '130px', sortable: true },
    { header: 'Título', field: 'titulo', minWidth: 260, sortable: true },
    { header: 'Sistema', field: 'sistema', minWidth: 140, sortable: true },
    { header: 'Ticket MV', field: 'ticketMv', width: '110px', sortable: true },
    { header: 'Situação', field: 'situacao', width: '190px', sortable: true },
    { header: 'Ambiente', field: 'ambienteAtual', width: '120px' },
    { header: 'Artefatos', field: 'qtdArtefatos', width: '110px' },
    { header: 'Janela', field: 'janela', width: '140px', sortable: true },
    { header: 'Responsável', field: 'nomeResponsavel', minWidth: 150, sortable: true },
    { header: 'Próximo passo', field: 'proximoPasso', minWidth: 280 },
  ];

  ngOnInit() {
    this.carregar();
  }

  carregar() {
    this.carregando.set(true);
    this.service
      .painel(this.dias())
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({ next: painel => this.painel.set(painel), error: () => this.painel.set(null) });
  }

  trocarPeriodo(dias: number) {
    this.dias.set(dias);
    this.carregar();
  }

  alternarResumo(chave: ChaveResumo) {
    this.filtroResumo.update(atual => (atual === chave ? null : chave));
  }

  limparFiltros() {
    this.texto.set('');
    this.situacoes.set([]);
    this.sistema.set(null);
    this.responsavel.set(null);
    this.filtroResumo.set(null);
  }

  abrir(linha: AtualizacaoResumo) {
    this.router.navigate(['/atualizacao/atualizacoes-detalhe'], { queryParams: { id: linha.codAtualizacao } });
  }

  nova() {
    this.service.catalogo().subscribe({
      next: catalogo =>
        this.dialog
          .open<DadosDialogComponent, DadosDialogData, AtualizacaoDetalhe>(DadosDialogComponent, {
            width: '720px',
            maxWidth: '95vw',
            data: { catalogo },
          })
          .afterClosed()
          .subscribe(criada => {
            if (criada) {
              this.toast.success(`Atualização ${criada.numero} criada. Inclua os artefatos.`);
              this.router.navigate(['/atualizacao/atualizacoes-detalhe'], { queryParams: { id: criada.codAtualizacao } });
            }
          }),
      error: () => {},
    });
  }

  /** Lista filtrada em CSV (separador ; para abrir direto no Excel). */
  exportar() {
    const cabecalho = ['Número', 'Título', 'Sistema', 'Ticket MV', 'Situação', 'Ambiente', 'Artefatos', 'Versões corrigidas', 'Janela', 'Responsável', 'Próximo passo'];
    const linhas = this.filtradas().map(a => [
      a.numero,
      a.titulo,
      a.sistema ?? '',
      a.ticketMv ?? '',
      SITUACAO_INFO[a.situacao].rotulo,
      a.ambienteAtual ?? '',
      String(a.qtdArtefatos),
      String(a.qtdVersoesCorrigidas),
      a.janela ? new Date(a.janela).toLocaleString('pt-BR') : '',
      a.nomeResponsavel ?? '',
      a.proximoPasso ?? '',
    ]);
    const csv = [cabecalho, ...linhas].map(l => l.map(c => `"${c.replaceAll('"', '""')}"`).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `atualizacoes-${new Date().toISOString().substring(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}

function distintos(valores: (string | null)[]): string[] {
  return [...new Set(valores.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));
}
