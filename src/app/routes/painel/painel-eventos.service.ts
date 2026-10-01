import { Injectable, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';

/**
 * Barramento do painel: o layout pede refresh (a cada minuto ou quando chega um
 * aviso PNUPD) e as telas filhas recarregam.
 *
 * As telas também avisam aqui quando terminam uma carga, e é isso que permite o
 * cabeçalho mostrar "dados de X s atrás" — a pergunta que todo mundo faz ao
 * olhar um painel de parede é se ele ainda está atualizando.
 */
@Injectable({ providedIn: 'root' })
export class PainelEventosService {
  /** Momento da última carga concluída com sucesso por alguma tela. */
  readonly ultimaCarga = signal<Date | null>(null);

  private readonly atualizar$ = new Subject<void>();

  atualizacoes(): Observable<void> {
    return this.atualizar$.asObservable();
  }

  solicitarAtualizacao(): void {
    this.atualizar$.next();
  }

  registrarCarga(): void {
    this.ultimaCarga.set(new Date());
  }
}
