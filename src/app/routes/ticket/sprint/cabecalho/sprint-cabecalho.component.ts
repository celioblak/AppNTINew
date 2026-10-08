import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Sprint } from '@core';

/** Um número do resumo da sprint (ex.: "Concluídos 5"). */
export interface SprintIndicador {
  rotulo: string;
  valor: number | string;
  tom?: 'sucesso' | 'alerta' | 'perigo';
}

/**
 * Cabeçalho compacto da sprint, compartilhado pelo Dashboard e pelo Gerencial
 * de Sprint — mesma navegação (◀ n de N ▶), identificação, indicadores e
 * barra de progresso nas duas telas.
 *
 * Conteúdo projetado (ex.: filtro, Concluir, exportações) aparece numa segunda
 * linha do mesmo card; sem conteúdo, a linha não é exibida.
 */
@Component({
  selector: 'app-sprint-cabecalho',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './sprint-cabecalho.component.html',
  styleUrls: ['./sprint-cabecalho.component.scss'],
})
export class SprintCabecalhoComponent {
  @Input({ required: true }) sprint!: Sprint;
  /** Posição da sprint exibida (base 0) e total de sprints, para a navegação. */
  @Input() indice = 0;
  @Input() total = 0;
  @Input() temAnterior = false;
  @Input() temProxima = false;
  /** Desabilita a navegação (ex.: enquanto os tickets carregam). */
  @Input() desabilitado = false;
  @Input() indicadores: SprintIndicador[] = [];
  @Input() percentual = 0;

  @Output() anterior = new EventEmitter<void>();
  @Output() proxima = new EventEmitter<void>();

  private static readonly STATUS: Record<string, string> = {
    PENDENTE: 'Pendente',
    PLANEJADA: 'Planejada',
    EM_PLANEJAMENTO: 'Em planejamento',
    EM_ANDAMENTO: 'Em andamento',
    AG_ENTREGA: 'Aguardando entrega',
    CONCLUIDA: 'Concluída',
    REMOVIDO: 'Removido',
  };

  get statusRotulo(): string {
    const s = this.sprint?.status;
    return s ? SprintCabecalhoComponent.STATUS[s] ?? s : 'Sem status';
  }

  get statusClasse(): string {
    return 'status-' + (this.sprint?.status || 'nenhum').toLowerCase();
  }

  get percentualLimitado(): number {
    return Math.max(0, Math.min(100, this.percentual || 0));
  }

  /**
   * dd/MM/yyyy. Data sem hora ("2026-10-01") é tratada como data LOCAL —
   * new Date("2026-10-01") lê como UTC e no Brasil mostraria o dia anterior.
   */
  formatarData(data: string | Date | null | undefined): string {
    if (!data) return '—';
    let d: Date;
    if (typeof data === 'string') {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
      d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(data);
    } else {
      d = data;
    }
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
  }
}
