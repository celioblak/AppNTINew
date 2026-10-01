import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Contagem } from '../homologacao.models';

interface Segmento {
  chave: string;
  rotulo: string;
  valor: number;
  pct: number;
}

/**
 * Progresso coletivo (seção 7): barra empilhada da distribuição com a marca do ritmo esperado para hoje.
 * Concluído = aprovados + reprovados + não se aplica; o restante é pendente.
 */
@Component({
  selector: 'app-barra-homologacao',
  imports: [MatTooltipModule],
  template: `
    <div class="linha">
      <div class="barra" [style.height.px]="altura()" role="img" [attr.aria-label]="rotulo()">
        @for (s of segmentos(); track s.chave) {
          @if (s.valor) {
            <span class="seg" [attr.data-seg]="s.chave" [style.width.%]="s.pct" [matTooltip]="s.rotulo + ': ' + s.valor"></span>
          }
        }
        @if (ritmo(); as r) {
          <span class="ritmo" [style.left.%]="r" [matTooltip]="'Esperado para hoje pela previsão: ' + r + '%'"></span>
        }
      </div>
      @if (mostrarPercentual()) {
        <span class="pct" [class.abaixo]="abaixo()">{{ contagem().percentual }}%</span>
      }
    </div>
    @if (legenda()) {
      <div class="legenda">
        @for (s of segmentos(); track s.chave) {
          <span class="leg" [class.leg--zero]="!s.valor"><span class="cor" [attr.data-seg]="s.chave"></span>{{ s.rotulo }} {{ s.valor }}</span>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      min-width: 80px;
    }

    .linha {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .barra {
      position: relative;
      display: flex;
      flex: 1;
      overflow: visible;
      border-radius: 999px;
      background: color-mix(in srgb, var(--mat-sys-on-surface, #000) 9%, transparent);
    }

    .seg {
      height: 100%;
      transition: width .3s ease;

      &:first-child {
        border-radius: 999px 0 0 999px;
      }

      &:last-of-type {
        border-radius: 0 999px 999px 0;
      }
    }

    .ritmo {
      position: absolute;
      top: -3px;
      bottom: -3px;
      width: 2px;
      margin-left: -1px;
      background: var(--mat-sys-on-surface, #222);
      border-radius: 1px;
    }

    .pct {
      min-width: 38px;
      font-size: .8rem;
      font-weight: 600;
      text-align: right;
      font-variant-numeric: tabular-nums;

      &.abaixo {
        color: #e08a00;
      }
    }

    [data-seg='aprovados'] { background: #2e7d32; }
    [data-seg='reprovados'] { background: #d32f2f; }
    [data-seg='naoSeAplica'] { background: #8d99a0; }
    [data-seg='bloqueados'] { background: #e08a00; }
    [data-seg='reteste'] { background: #7e57c2; }
    [data-seg='reservados'] { background: color-mix(in srgb, #1976d2 45%, transparent); }

    .legenda {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 14px;
      margin-top: 6px;
      font-size: .75rem;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
      font-variant-numeric: tabular-nums;
    }

    .leg {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }

    .leg--zero {
      opacity: .5;
    }

    .cor {
      width: 9px;
      height: 9px;
      border-radius: 2px;
      background: color-mix(in srgb, var(--mat-sys-on-surface, #000) 12%, transparent);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarraHomologacaoComponent {
  readonly contagem = input.required<Contagem>();
  /** Percentual esperado para hoje; nulo ou 0 não desenha a marca. */
  readonly ritmo = input<number | null>(null);
  readonly altura = input(8);
  readonly legenda = input(false);
  readonly mostrarPercentual = input(true);

  readonly abaixo = computed(() => {
    const r = this.ritmo();
    return !!r && this.contagem().percentual < r;
  });

  readonly segmentos = computed<Segmento[]>(() => {
    const c = this.contagem();
    const total = c.total || 1;
    const lista: [string, string, number][] = [
      ['aprovados', 'Aprovados', c.aprovados],
      ['reprovados', 'Reprovados', c.reprovados],
      ['naoSeAplica', 'Não se aplica', c.naoSeAplica],
      ['bloqueados', 'Bloqueados', c.bloqueados],
      ['reteste', 'Reteste', c.reteste],
      ['reservados', 'Reservados sem resultado', c.reservados],
      ['livres', 'Livres', c.livres],
    ];
    return lista.map(([chave, rotulo, valor]) => ({ chave, rotulo, valor, pct: (valor * 100) / total }));
  });

  readonly rotulo = computed(() => {
    const c = this.contagem();
    return `${c.percentual}% concluído: ${c.concluidos} de ${c.total} itens`;
  });
}
