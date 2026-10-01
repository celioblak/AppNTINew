import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';

import { ConsultaCredencial, Disponibilidade, Periodo, ROTULO_PERIODO, duracao } from '../infraestrutura.models';
import { InfraestruturaService } from '../infraestrutura.service';

export interface HistoricoDialogData {
  tipo: 'SERVIDOR' | 'SERVICO' | 'SISTEMA';
  codItem: number;
  nome: string;
  disponibilidade: Disponibilidade | null;
}

/**
 * Histórico de paradas de um servidor ou serviço. Cada período pode ser
 * marcado como manutenção planejada (sai do cálculo), com justificativa.
 */
@Component({
  selector: 'app-historico-dialog',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTooltipModule,
  ],
  template: `
    <h2 mat-dialog-title>Disponibilidade — {{ data.nome }}</h2>
    <mat-dialog-content>
      <div class="topo">
        <mat-button-toggle-group [value]="dias()" (change)="trocarDias($event.value)" hideSingleSelectionIndicator>
          <mat-button-toggle [value]="7">7 dias</mat-button-toggle>
          <mat-button-toggle [value]="30">30 dias</mat-button-toggle>
          <mat-button-toggle [value]="90">90 dias</mat-button-toggle>
        </mat-button-toggle-group>
        @if (dias() === 30 && data.disponibilidade; as d) {
          <div class="resumo">
            <b>{{ d.percentual !== null ? d.percentual + '%' : '—' }}</b> disponível
            <span>· {{ d.paradas }} parada(s) · {{ fmt(d.minutosParado) }} parado · {{ fmt(d.minutosDegradado) }} degradado</span>
          </div>
        }
      </div>
      <p class="dica">
        Manutenção planejada sai do cálculo; tempo "sem dados" (monitoramento parado) também, para não contar como no ar.
      </p>
      @if (carregando()) {
        <mat-progress-bar mode="indeterminate" />
      }

      @for (p of periodos(); track p.codIndisponibilidade) {
        <article class="periodo periodo--{{ p.situacao.toLowerCase() }}" [class.periodo--planejada]="p.planejada">
          <div class="periodo__topo">
            <span class="tag">{{ p.planejada ? 'Planejada' : rotulo[p.situacao] }}</span>
            <span>{{ p.inicio | date: 'dd/MM/yyyy HH:mm' }} → {{ p.fim ? (p.fim | date: 'dd/MM HH:mm') : 'em andamento' }}</span>
            <b>{{ fmt(p.minutos) }}</b>
          </div>
          @if (p.causa) {
            <div class="periodo__causa">{{ p.causa }}</div>
          }
          @if (editando() === p.codIndisponibilidade) {
            <mat-form-field appearance="outline" class="cheio" subscriptSizing="dynamic">
              <mat-label>Observação / justificativa</mat-label>
              <textarea matInput rows="2" [(ngModel)]="observacao" maxlength="2000"></textarea>
            </mat-form-field>
            @if (erro()) {
              <div class="erro"><mat-icon>error</mat-icon><span>{{ erro() }}</span></div>
            }
            <div class="acoes">
              <button mat-button (click)="editando.set(null)">Cancelar</button>
              <button mat-stroked-button (click)="salvar(p, false)">Salvar observação</button>
              <button mat-flat-button (click)="salvar(p, true)">Marcar como planejada</button>
            </div>
          } @else {
            @if (p.observacao) {
              <div class="periodo__obs"><mat-icon inline>comment</mat-icon> {{ p.observacao }} <i>— {{ p.usuarioObservacao }}</i></div>
            }
            <div class="acoes">
              @if (p.planejada) {
                <button mat-button (click)="salvar(p, false, p.observacao)">Desmarcar planejada</button>
              }
              <button mat-button (click)="editar(p)"><mat-icon>edit</mat-icon> Observação{{ p.planejada ? '' : ' / planejada' }}</button>
            </div>
          }
        </article>
      } @empty {
        @if (!carregando()) {
          <div class="vazio"><mat-icon>check_circle</mat-icon> Nenhuma parada registrada no período.</div>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Fechar</button>
    </mat-dialog-actions>
  `,
  styles: `
    .topo { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; margin-bottom: 8px; }
    .resumo b { font-size: 1.3rem; }
    .resumo span, .dica { font-size: .8rem; color: var(--mat-sys-on-surface-variant, rgba(0,0,0,.6)); }
    .dica { margin: 0 0 10px; }
    .periodo { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; padding: 8px 12px; border-radius: 10px;
               border-left: 5px solid #8a8f98; background: var(--mat-sys-surface-container-low, #f7f7f9); }
    .periodo--total { border-left-color: #d93636; }
    .periodo--parcial { border-left-color: #e08a00; }
    .periodo--planejada { border-left-color: #7b5cc4; }
    .periodo__topo { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; font-size: .9rem; }
    .periodo__topo b { margin-left: auto; }
    .periodo__causa, .periodo__obs { font-size: .8rem; color: var(--mat-sys-on-surface-variant, rgba(0,0,0,.6)); }
    .tag { padding: 1px 8px; border-radius: 999px; font-size: .7rem; font-weight: 700;
           background: var(--mat-sys-surface-container-high, #e6e8ec); }
    .acoes { display: flex; gap: 6px; justify-content: flex-end; }
    .cheio { width: 100%; }
    .vazio { display: flex; gap: 8px; align-items: center; padding: 16px; color: #2e7d4f; }
    .erro { display: flex; gap: 8px; align-items: flex-start; padding: 6px 10px; border-radius: 8px; font-size: .8rem;
            background: color-mix(in srgb, #d93636 12%, transparent); color: #c62828; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoricoDialogComponent implements OnInit {
  readonly data = inject<HistoricoDialogData>(MAT_DIALOG_DATA);
  private readonly service = inject(InfraestruturaService);

  readonly rotulo = ROTULO_PERIODO;
  readonly periodos = signal<Periodo[]>([]);
  readonly carregando = signal(false);
  readonly dias = signal(30);
  readonly editando = signal<number | null>(null);
  readonly erro = signal<string | null>(null);
  observacao = '';

  ngOnInit() {
    this.carregar();
  }

  fmt(min: number) {
    return duracao(min);
  }

  trocarDias(d: number) {
    this.dias.set(d);
    this.carregar();
  }

  editar(p: Periodo) {
    this.observacao = p.observacao ?? '';
    this.erro.set(null);
    this.editando.set(p.codIndisponibilidade);
  }

  salvar(p: Periodo, planejada: boolean, observacao: string | null = this.observacao) {
    this.erro.set(null);
    this.service.marcarPeriodo(p.codIndisponibilidade, planejada, observacao).subscribe({
      next: atualizado => {
        this.periodos.update(l => l.map(x => (x.codIndisponibilidade === atualizado.codIndisponibilidade ? atualizado : x)));
        this.editando.set(null);
      },
      error: e => this.erro.set(e?.error?.message ?? 'Não foi possível salvar.'),
    });
  }

  private carregar() {
    this.carregando.set(true);
    this.service
      .periodos(this.data.tipo, this.data.codItem, this.dias())
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({ next: l => this.periodos.set(l), error: () => this.periodos.set([]) });
  }
}

/** Quem consultou as senhas deste servidor no cofre. */
@Component({
  selector: 'app-consultas-credencial-dialog',
  imports: [DatePipe, MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Consultas de senha — {{ data.nome }}</h2>
    <mat-dialog-content>
      @for (c of consultas(); track $index) {
        <div class="linha">
          <mat-icon>{{ c.tipo === 'ADMIN' ? 'admin_panel_settings' : 'desktop_windows' }}</mat-icon>
          <b>{{ c.login }}</b>
          <span>{{ c.tipo === 'ADMIN' ? 'administrador' : 'acesso remoto' }}</span>
          <span class="espaco"></span>
          <span>{{ c.quando | date: 'dd/MM/yyyy HH:mm' }}</span>
          <span class="ip">{{ c.ip }}</span>
        </div>
      } @empty {
        <p>Ninguém consultou as senhas deste servidor pelo cofre.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button mat-dialog-close>Fechar</button></mat-dialog-actions>
  `,
  styles: `
    .linha { display: flex; gap: 10px; align-items: center; padding: 6px 0; font-size: .85rem;
             border-bottom: 1px solid var(--mat-sys-outline-variant, #e0e0e0); }
    .espaco { flex: 1; }
    .ip { font-size: .75rem; color: var(--mat-sys-on-surface-variant, rgba(0,0,0,.6)); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsultasCredencialDialogComponent implements OnInit {
  readonly data = inject<{ codServidor: number; nome: string }>(MAT_DIALOG_DATA);
  private readonly service = inject(InfraestruturaService);
  readonly consultas = signal<ConsultaCredencial[]>([]);

  ngOnInit() {
    this.service.consultasCredencial(this.data.codServidor).subscribe({ next: l => this.consultas.set(l), error: () => {} });
  }
}
