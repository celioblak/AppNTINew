import { Component, computed, input } from '@angular/core';

import { ChamadoPainel } from './painel.models';
import { idadeTexto, tituloChamado } from './painel-formato';

/** Faixa de cor do card: o que o chamado exige de quem olha. */
export type TomChamado = 'incidente' | 'requisicao' | 'pendente' | 'pausado' | 'reprovado';

/**
 * Card de chamado na TV.
 *
 * O número fica como etiqueta discreta e o título domina a linha: de longe se lê
 * o assunto, não o protocolo. A idade vai na direita porque é o que diz se algo
 * está parado — a informação que faltava no painel antigo.
 */
@Component({
  selector: 'app-chamado-card',
  standalone: true,
  template: `
    <article class="card card--{{ tom() }}" [class.card--novo]="novo()">
      <span class="card__id">{{ chamado().idChamado }}</span>
      <span class="card__titulo">{{ titulo() }}</span>
      @if (idade()) {
        <span class="card__idade">{{ idade() }}</span>
      }
    </article>
  `,
  styleUrl: './chamado-card.scss',
})
export class ChamadoCard {
  readonly chamado = input.required<ChamadoPainel>();
  readonly tom = input<TomChamado>('incidente');
  readonly novo = input(false);

  readonly titulo = computed(() => tituloChamado(this.chamado().titulo));
  readonly idade = computed(() => idadeTexto(this.chamado().minutosAberto));
}
