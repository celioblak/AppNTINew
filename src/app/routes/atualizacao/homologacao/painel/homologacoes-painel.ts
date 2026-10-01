import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { AlturaAteRodape } from '@shared';
import { debounceTime, filter, finalize, skip } from 'rxjs';

import { Tom, normalizarTexto } from '../../atualizacao.models';
import { EtiquetaComponent } from '../../compartilhado/situacao-chip';
import { BarraHomologacaoComponent } from '../compartilhado/barra-homologacao';
import { HomologacaoResumo, PARECER_INFO, PainelHom, ROTA_BASE, SITUACAO_HOM, SituacaoHomologacao, dataCurta } from '../homologacao.models';
import { HomologacaoService } from '../homologacao.service';
import { HomologacaoTempoRealService } from '../homologacao-tempo-real.service';

type ChaveResumo = 'minhasPendencias' | 'emAndamento' | 'atrasadasOuAbaixo' | 'semTicket' | 'divergencias';

const RESUMOS: { chave: ChaveResumo; rotulo: string; tom: Tom; filtro: (h: HomologacaoResumo) => boolean; gestao?: boolean }[] = [
  { chave: 'minhasPendencias', rotulo: 'Minhas pendências (itens e divergências)', tom: 'info', filtro: h => h.minhasPendencias > 0 },
  { chave: 'emAndamento', rotulo: 'Em andamento', tom: 'info', filtro: h => h.situacao === 'EM_ANDAMENTO' },
  { chave: 'atrasadasOuAbaixo', rotulo: 'Atrasadas ou abaixo do ritmo', tom: 'alerta', filtro: h => h.atrasada || h.abaixoDoRitmo },
  { chave: 'semTicket', rotulo: 'Reprovados sem ticket no fabricante', tom: 'alerta', filtro: h => h.situacao === 'EM_ANDAMENTO' && h.contagem.semTicket > 0 },
  { chave: 'divergencias', rotulo: 'Divergências abertas', tom: 'critico', filtro: h => h.situacao === 'EM_ANDAMENTO' && h.contagem.divergencias > 0, gestao: true },
];

/**
 * Homologações de versão — painel (T-01). A rota "homologacoes-gestao" abre a mesma tela no modo gestão:
 * todas as situações e o botão de nova homologação.
 */
@Component({
  selector: 'app-homologacoes-painel',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule,
    AlturaAteRodape,
    EtiquetaComponent,
    BarraHomologacaoComponent,
  ],
  template: `
    <div class="pagina painel" alturaAteRodape>
      <div class="resumo" aria-label="Resumo: clique para filtrar">
        @for (t of tiles(); track t.chave) {
          <button
            type="button"
            class="tile"
            [attr.data-tom]="t.tom"
            [class.tile--ativo]="filtroResumo() === t.chave"
            [class.tile--zero]="!t.valor"
            [attr.aria-pressed]="filtroResumo() === t.chave"
            (click)="filtroResumo.set(filtroResumo() === t.chave ? null : t.chave)">
            <span class="tile__valor">{{ t.valor }}</span>
            <span class="tile__rotulo">{{ t.rotulo }}</span>
          </button>
        }
      </div>

      <div class="barra">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="busca">
          <mat-icon matPrefix>search</mat-icon>
          <mat-label>Pesquisar</mat-label>
          <input matInput placeholder="Número, título, sistema ou versão" [ngModel]="texto()" (ngModelChange)="texto.set($event)" />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="filtro">
          <mat-label>Situação</mat-label>
          <mat-select multiple [ngModel]="situacoes()" (ngModelChange)="situacoes.set($event)">
            @for (s of situacoesDisponiveis; track s) {
              <mat-option [value]="s">{{ situacaoInfo[s].rotulo }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="filtro">
          <mat-label>Sistema</mat-label>
          <mat-select [ngModel]="sistema()" (ngModelChange)="sistema.set($event)">
            <mat-option [value]="null">Todos</mat-option>
            @for (s of sistemas(); track s) {
              <mat-option [value]="s">{{ s }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="filtro">
          <mat-label>Ambiente</mat-label>
          <mat-select [ngModel]="ambiente()" (ngModelChange)="ambiente.set($event)">
            <mat-option [value]="null">Todos</mat-option>
            @for (a of ambientes(); track a) {
              <mat-option [value]="a">{{ a }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        @if (!gestao) {
          <mat-slide-toggle [ngModel]="soOndeParticipo()" (ngModelChange)="soOndeParticipo.set($event)">Só onde participo</mat-slide-toggle>
        }
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="filtro filtro--curto" matTooltip="As abertas aparecem sempre">
          <mat-label>Encerradas dos últimos</mat-label>
          <mat-select [ngModel]="dias()" (ngModelChange)="dias.set($event); carregar()">
            <mat-option [value]="30">30 dias</mat-option>
            <mat-option [value]="90">90 dias</mat-option>
            <mat-option [value]="365">1 ano</mat-option>
            <mat-option [value]="1825">5 anos</mat-option>
          </mat-select>
        </mat-form-field>
        <span class="espaco"></span>
        <span class="total">{{ filtradas().length }} de {{ visiveis().length }}</span>
        @if (gestao && painel()?.permissoes?.gestao) {
          <button mat-flat-button type="button" (click)="nova()"><mat-icon>add</mat-icon> Nova homologação</button>
        }
      </div>

      @if (carregando()) {
        <mat-progress-bar mode="indeterminate" />
      }

      <div class="lista">
        @for (h of filtradas(); track h.codHomologacao) {
          <button type="button" class="cartao" (click)="abrir(h)">
            <div class="cartao__topo">
              <span class="mono numero">{{ h.numero }}</span>
              <strong class="titulo">{{ h.titulo }}</strong>
              <app-etiqueta [tom]="situacaoInfo[h.situacao].tom">{{ situacaoInfo[h.situacao].rotulo }}</app-etiqueta>
              @if (h.atrasada) {
                <app-etiqueta tom="critico">Atrasada</app-etiqueta>
              } @else if (h.abaixoDoRitmo) {
                <app-etiqueta tom="alerta">Abaixo do ritmo</app-etiqueta>
              }
              @if (h.minhasPendencias) {
                <app-etiqueta tom="info">{{ h.minhasPendencias }} pendência{{ h.minhasPendencias > 1 ? 's' : '' }} minha{{ h.minhasPendencias > 1 ? 's' : '' }}</app-etiqueta>
              }
              <span class="espaco"></span>
              <span class="suave">{{ h.ambiente }} · {{ data(h.previsaoInicio) }} → {{ data(h.previsaoFim) }}</span>
            </div>
            <div class="sistemas">
              @for (s of h.sistemas; track s.codSistema) {
                <span class="sistema">
                  {{ s.nome }} <span class="suave">{{ s.versaoAtual ? s.versaoAtual + ' → ' : '' }}{{ s.versaoNova || 'sem versão no ambiente' }}</span>
                  @if (s.parecer) {
                    <app-etiqueta [tom]="parecerInfo[s.parecer].tom">{{ parecerInfo[s.parecer].rotulo }}</app-etiqueta>
                  } @else if (s.parecerPrevisto && h.situacao === 'EM_ANDAMENTO') {
                    <app-etiqueta [tom]="parecerInfo[s.parecerPrevisto].tom">previsto: {{ parecerInfo[s.parecerPrevisto].rotulo }}</app-etiqueta>
                  }
                </span>
              }
            </div>
            <app-barra-homologacao [contagem]="h.contagem" [ritmo]="h.situacao === 'EM_ANDAMENTO' ? h.ritmoEsperado : null" />
            <div class="rodape suave">
              <span>Responsável: {{ h.nomeResponsavel }}</span>
              <span>{{ h.participacao === 'TODOS' ? 'Todos com acesso' : h.qtdDesignados + ' designados' }}</span>
              <span>{{ h.contagem.concluidos }}/{{ h.contagem.total }} itens</span>
              @if (h.contagem.reprovados) {
                <span>{{ h.contagem.reprovados }} reprovado{{ h.contagem.reprovados > 1 ? 's' : '' }}{{ h.contagem.reprovadosImpeditivos ? ' (' + h.contagem.reprovadosImpeditivos + ' impeditivo' + (h.contagem.reprovadosImpeditivos > 1 ? 's)' : ')') : '' }}</span>
              }
              @if (h.contagem.semTicket) {
                <span class="alerta">{{ h.contagem.semTicket }} sem ticket no fabricante</span>
              }
              @if (h.contagem.divergencias) {
                <span class="alerta">{{ h.contagem.divergencias }} divergência{{ h.contagem.divergencias > 1 ? 's' : '' }}</span>
              }
              @if (h.ticketMv) {
                <span>Ticket MV {{ h.ticketMv }}</span>
              }
            </div>
          </button>
        } @empty {
          @if (!carregando()) {
            <p class="vazio">
              @if (visiveis().length) {
                Nenhuma homologação com estes filtros.
              } @else if (gestao) {
                Nenhuma homologação ainda. Crie a primeira em "Nova homologação" (os roteiros padrão ficam em Roteiros de homologação).
              } @else {
                Nenhuma homologação em que você participe. Desligue "Só onde participo" para ver as demais.
              }
            </p>
          }
        }
      </div>
    </div>
  `,
  styleUrls: ['../../compartilhado/atualizacao-pagina.scss', '../../painel/atualizacoes-painel.scss'],
  styles: `
    .lista {
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow-y: auto;
    }

    .cartao {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 14px;
      border: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, .12));
      border-radius: 12px;
      background: var(--mat-sys-surface, transparent);
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;

      &:hover,
      &:focus-visible {
        border-color: #1976d2;
        outline: none;
      }
    }

    .cartao__topo,
    .sistemas,
    .rodape {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 12px;
    }

    .numero {
      font-weight: 600;
    }

    .sistema {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: .85rem;
    }

    .rodape {
      font-size: .78rem;
    }

    .alerta {
      color: #b26a00;
    }

    .busca {
      min-width: 240px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomologacoesPainelComponent implements OnInit {
  private readonly service = inject(HomologacaoService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly tempoReal = inject(HomologacaoTempoRealService);
  private readonly destroyRef = inject(DestroyRef);

  /** Rota homologacoes-gestao: todas as situações e o botão de nova homologação. */
  readonly gestao = !!this.route.snapshot.data['gestao'];
  readonly situacaoInfo = SITUACAO_HOM;
  readonly parecerInfo = PARECER_INFO;
  readonly situacoesDisponiveis = Object.keys(SITUACAO_HOM) as SituacaoHomologacao[];
  readonly data = dataCurta;

  readonly painel = signal<PainelHom | null>(null);
  readonly carregando = signal(true);
  readonly dias = signal(365);
  readonly texto = signal('');
  readonly situacoes = signal<SituacaoHomologacao[]>([]);
  readonly sistema = signal<string | null>(null);
  readonly ambiente = signal<string | null>(null);
  readonly soOndeParticipo = signal(true);
  readonly filtroResumo = signal<ChaveResumo | null>(null);

  readonly todas = computed(() => this.painel()?.homologacoes ?? []);
  /** Fora da gestão: planejadas e canceladas só onde a pessoa participa; o filtro "só onde participo" reduz o resto. */
  readonly visiveis = computed(() =>
    this.gestao ? this.todas() : this.todas().filter(h => !this.soOndeParticipo() || h.participo || h.minhasPendencias > 0)
  );
  readonly sistemas = computed(() => [...new Set(this.todas().flatMap(h => h.sistemas.map(s => s.nome)))].sort((a, b) => a.localeCompare(b)));
  readonly ambientes = computed(() => [...new Set(this.todas().map(h => h.ambiente))].sort((a, b) => a.localeCompare(b)));

  readonly tiles = computed(() => {
    const resumo = this.painel()?.resumo;
    const gestao = this.painel()?.permissoes.gestao;
    return RESUMOS.filter(r => !r.gestao || gestao).map(r => ({ ...r, valor: resumo ? resumo[r.chave] : 0 }));
  });

  readonly filtradas = computed(() => {
    const termo = normalizarTexto(this.texto().trim());
    const situacoes = this.situacoes();
    const sistema = this.sistema();
    const ambiente = this.ambiente();
    const resumo = RESUMOS.find(r => r.chave === this.filtroResumo());
    return this.visiveis().filter(
      h =>
        (!termo || normalizarTexto(`${h.numero} ${h.titulo} ${h.ticketMv ?? ''} ${h.sistemas.map(s => `${s.nome} ${s.versaoNova ?? ''}`).join(' ')}`).includes(termo)) &&
        (!situacoes.length || situacoes.includes(h.situacao)) &&
        (!sistema || h.sistemas.some(s => s.nome === sistema)) &&
        (!ambiente || h.ambiente === ambiente) &&
        (!resumo || resumo.filtro(h))
    );
  });

  ngOnInit() {
    this.carregar();
    // Tempo real: reserva, resultado ou mudança em qualquer homologação atualiza a lista (rajadas viram uma recarga).
    this.tempoReal
      .acompanhar(null)
      .pipe(
        filter(e => e.tipo === 'mudanca' || e.tipo === 'conectado'),
        skip(1),
        debounceTime(1_000),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.carregar(true));
  }

  carregar(silencioso = false) {
    if (!silencioso) this.carregando.set(true);
    this.service
      .painel(this.dias())
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({ next: p => this.painel.set(p), error: () => this.painel.set(null) });
  }

  abrir(h: HomologacaoResumo) {
    this.router.navigate([`${ROTA_BASE}/homologacoes-detalhe`], { queryParams: { id: h.codHomologacao } });
  }

  nova() {
    this.router.navigate([`${ROTA_BASE}/homologacoes-cadastro`]);
  }
}
