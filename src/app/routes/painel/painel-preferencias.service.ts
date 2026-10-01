import { Injectable, signal } from '@angular/core';

/** Como os cards entram na tela quando a página vira. */
export type EfeitoPainel = 'flip' | 'fade' | 'nenhum';

const EFEITOS: EfeitoPainel[] = ['flip', 'fade', 'nenhum'];

/**
 * Preferências de exibição da TV, lidas da própria URL — assim cada televisão
 * pode ter o seu ajuste sem recompilar nem mexer em configuração no servidor:
 *
 *   /painel/incidente               → efeito padrão (flip, estilo painel de aeroporto)
 *   /painel/incidente?efeito=fade   → troca suave
 *   /painel/incidente?efeito=nenhum → troca seca, sem animação
 */
@Injectable({ providedIn: 'root' })
export class PainelPreferenciasService {
  readonly efeito = signal<EfeitoPainel>('flip');

  lerDaUrl(valor: string | null | undefined): void {
    const escolhido = (valor ?? '').trim().toLowerCase() as EfeitoPainel;
    if (EFEITOS.includes(escolhido)) {
      this.efeito.set(escolhido);
    }
  }
}
