import { DestroyRef, Directive, ElementRef, afterNextRender, inject, input } from '@angular/core';

/**
 * Estica o elemento de onde ele começa até o fim da janela, descontando o padding
 * inferior da página (.matero-page-content). Use em um container flex column para
 * que o filho com `flex: 1` (ex.: mtx-grid) ocupe todo o espaço que sobra.
 */
@Directive({
  selector: '[alturaAteRodape]',
})
export class AlturaAteRodape {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Altura mínima, em px, para janelas muito baixas. */
  readonly alturaMinima = input(360);

  constructor() {
    const destroyRef = inject(DestroyRef);
    const ajustar = () => this.ajustar();

    afterNextRender(() => {
      // O ResizeObserver cobre o elemento voltando a aparecer (ex.: troca de aba).
      const observer = new ResizeObserver(ajustar);
      observer.observe(this.el.nativeElement);
      window.addEventListener('resize', ajustar);
      ajustar();

      destroyRef.onDestroy(() => {
        observer.disconnect();
        window.removeEventListener('resize', ajustar);
      });
    });
  }

  private ajustar() {
    const elemento = this.el.nativeElement;
    const { top, width } = elemento.getBoundingClientRect();
    if (width === 0) {
      return; // oculto: mantém a última altura calculada
    }
    const rolagem = elemento.closest('.mat-sidenav-content, .mat-drawer-content')?.scrollTop ?? 0;
    const pagina = elemento.closest('.matero-page-content');
    const folga = pagina ? parseFloat(getComputedStyle(pagina).paddingBottom) || 0 : 0;
    const altura = Math.floor(window.innerHeight - (top + rolagem) - folga);
    const novaAltura = `${Math.max(this.alturaMinima(), altura)}px`;

    if (elemento.style.height !== novaAltura) {
      elemento.style.height = novaAltura;
    }
  }
}
