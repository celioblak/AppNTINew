import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { NoMapa, ROTULO_SITUACAO, SituacaoItem } from './mapa-servicos.models';

/**
 * Nó do organograma de um sistema e, recursivamente, seus membros: um
 * balanceador pode ter serviços ou outros balanceadores abaixo dele.
 *
 * As cores vêm de --mapa-* definidas na tela do mapa (custom properties
 * atravessam o encapsulamento).
 */
@Component({
  selector: 'app-no-organograma',
  // Componente standalone enxerga o próprio seletor: a recursão não precisa de import.
  imports: [MatIconModule, MatTooltipModule],
  template: `
    @let n = no();
    <div class="no sit--{{ n.situacao.toLowerCase() }}"
         [class.no--balanceador]="n.tipo === 'BALANCEADOR'"
         [class.no--servico]="n.tipo === 'SERVICO'"
         [matTooltip]="n.tipo === 'SERVICO' ? (n.detalhe ?? '') : ''">
      <mat-icon class="no__icone">{{ n.tipo === 'BALANCEADOR' ? 'alt_route' : 'memory' }}</mat-icon>
      <div class="no__corpo">
        <div class="no__titulo">{{ n.nome }}</div>
        @if (n.servidor) {
          <div class="no__sub"><mat-icon inline>dns</mat-icon> {{ n.servidor }}{{ n.porta ? ':' + n.porta : '' }}</div>
        } @else if (n.tipo === 'BALANCEADOR') {
          <div class="no__sub"><mat-icon inline>cloud</mat-icon> Balanceador externo</div>
        }
        @if (n.worker) {
          <div class="no__sub">worker <b>{{ n.worker }}</b></div>
        }
        @if (n.membro; as m) {
          <div class="no__sub" matTooltip="Como o balanceador acima vê este item">
            <mat-icon inline>login</mat-icon> {{ m.nome }} · {{ m.sessoes }} {{ m.sessoes === 1 ? 'sessão' : 'sessões' }}
          </div>
        }
        <div class="no__detalhe">
          <b>{{ rotulo(n.situacao) }}</b>
          @if (n.resumo) { · {{ n.resumo }} }
          @if (n.detalhe) { · {{ n.detalhe }} }
        </div>
      </div>
    </div>

    @if (n.membrosSemCadastro.length) {
      <div class="aviso">
        <mat-icon>help_outline</mat-icon>
        <span>
          No balanceador e sem cadastro:
          @for (m of n.membrosSemCadastro; track m.nome) {
            <b>{{ m.nome }}</b> ({{ m.host }}:{{ m.porta }}){{ $last ? '' : ', ' }}
          }
        </span>
      </div>
    }

    @if (n.filhos.length) {
      <div class="haste"></div>
      <ul class="filhos">
        @for (filho of n.filhos; track $index) {
          <li><app-no-organograma [no]="filho" /></li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .sit--ok { --cor: var(--mapa-ok); }
    .sit--alerta { --cor: var(--mapa-alerta); }
    .sit--fora { --cor: var(--mapa-fora); }
    .sit--manutencao { --cor: var(--mapa-manutencao); }
    .sit--desconhecido { --cor: var(--mapa-desconhecido); }

    .no {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      min-width: 200px;
      max-width: 280px;
      padding: 10px 14px;
      border: 1px solid var(--mapa-borda);
      border-left: 5px solid var(--cor, var(--mapa-borda));
      border-radius: 10px;
      background: var(--mat-sys-surface, #fff);
      box-shadow: 0 1px 2px rgb(0 0 0 / 6%);

      &__icone {
        flex-shrink: 0;
        color: var(--cor, var(--mapa-texto-fraco));
      }

      &__corpo {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      &__titulo {
        font-weight: 700;
        overflow-wrap: anywhere;
      }

      &__sub,
      &__detalhe {
        font-size: .78rem;
        color: var(--mapa-texto-fraco);
        overflow-wrap: anywhere;
      }

      &__detalhe b {
        color: var(--cor);
      }

      &--balanceador {
        min-width: 240px;
        max-width: 360px;
        background: color-mix(in srgb, var(--cor) 6%, var(--mat-sys-surface, #fff));
      }

      &.sit--fora {
        background: color-mix(in srgb, var(--mapa-fora) 10%, var(--mat-sys-surface, #fff));
      }
    }

    .aviso {
      display: flex;
      align-items: center;
      gap: 6px;
      max-width: 420px;
      margin-top: 6px;
      padding: 6px 10px;
      border-radius: 8px;
      background: var(--mapa-superficie-alta);
      color: var(--mapa-texto-fraco);
      font-size: .75rem;

      mat-icon {
        flex-shrink: 0;
      }
    }

    .haste {
      width: 2px;
      height: 18px;
      background: var(--mapa-borda);
    }

    /* Conectores de organograma: cada filho sobe até a linha horizontal. */
    .filhos {
      display: flex;
      justify-content: center;
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        position: relative;
        display: flex;
        justify-content: center;
        padding: 18px 6px 0;

        &::before {
          position: absolute;
          top: 0;
          right: 0;
          left: 0;
          border-top: 2px solid var(--mapa-borda);
          content: '';
        }

        &::after {
          position: absolute;
          top: 0;
          left: 50%;
          height: 18px;
          border-left: 2px solid var(--mapa-borda);
          content: '';
        }

        &:first-child::before { left: 50%; }
        &:last-child::before { right: 50%; }
        &:only-child::before { display: none; }
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoOrganogramaComponent {
  readonly no = input.required<NoMapa>();

  rotulo(situacao: SituacaoItem): string {
    return ROTULO_SITUACAO[situacao] ?? situacao;
  }
}
