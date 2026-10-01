import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { SITUACAO_INFO, SituacaoAtualizacao, Tom } from '../atualizacao.models';

/** Situação da atualização: ponto colorido + rótulo, legível nos dois temas. */
@Component({
  selector: 'app-situacao-atualizacao',
  template: `<span class="chip" [attr.data-tom]="info().tom"><span class="ponto" aria-hidden="true"></span>{{ info().rotulo }}</span>`,
  styleUrl: './atualizacao-comum.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SituacaoChipComponent {
  readonly situacao = input.required<SituacaoAtualizacao>();
  readonly info = computed(() => SITUACAO_INFO[this.situacao()]);
}

/** Etiqueta genérica com tom semântico (resultado, momento, emergencial...). */
@Component({
  selector: 'app-etiqueta',
  template: `<span class="chip" [attr.data-tom]="tom()"><span class="ponto" aria-hidden="true"></span><ng-content /></span>`,
  styleUrl: './atualizacao-comum.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EtiquetaComponent {
  readonly tom = input<Tom>('neutro');
}
