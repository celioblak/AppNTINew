import { signal, WritableSignal } from '@angular/core';

/**
 * Tempo da primeira página. Ela traz os chamados mais antigos, que são os que
 * o técnico deve pegar primeiro, então fica mais tempo na tela que as demais.
 */
export const SEGUNDOS_PRIMEIRA_PAGINA = 25;

/** Tempo de cada uma das outras páginas. */
export const SEGUNDOS_DEMAIS_PAGINAS = 10;

/**
 * Rodízio de páginas de uma lista do painel, com tempo maior na primeira.
 *
 * Com um `interval` fixo toda página tinha o mesmo tempo; aqui cada virada
 * agenda a próxima conforme a página que entrou.
 */
export class RodizioPaginas {
  readonly pagina: WritableSignal<number> = signal(0);

  private proxima: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly totalPaginas: () => number) {}

  iniciar(): void {
    this.agendar();
  }

  parar(): void {
    if (this.proxima) clearTimeout(this.proxima);
    this.proxima = null;
  }

  /** Volta para a primeira página quando a lista encolhe e a atual deixa de existir. */
  ajustar(): void {
    if (this.pagina() >= this.totalPaginas()) this.pagina.set(0);
  }

  private agendar(): void {
    const segundos = this.pagina() === 0 ? SEGUNDOS_PRIMEIRA_PAGINA : SEGUNDOS_DEMAIS_PAGINAS;
    this.proxima = setTimeout(() => {
      this.virar();
      this.agendar();
    }, segundos * 1000);
  }

  private virar(): void {
    const paginas = this.totalPaginas();
    this.pagina.set(paginas <= 1 ? 0 : (this.pagina() + 1) % paginas);
  }
}
