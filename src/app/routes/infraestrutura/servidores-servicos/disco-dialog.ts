import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { finalize } from 'rxjs';

import { Disco, Servidor } from '../infraestrutura.models';
import { InfraestruturaService } from '../infraestrutura.service';

export interface DiscoDialogData {
  servidor: string;
  disco: Disco;
}

/**
 * Exceções da partição (docs/infraestrutura.md, D-41): monitorar ou não e limites próprios de espaço livre. Vazio =
 * padrão (atenção abaixo de 20% e de 30 GB livres; crítico abaixo de 10% e de 10 GB). Devolve o servidor atualizado.
 */
@Component({
  selector: 'app-disco-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSlideToggleModule],
  template: `
    <h2 mat-dialog-title>Partição {{ data.disco.local }} · {{ data.servidor }}</h2>
    <mat-dialog-content>
      <p class="dica">
        Agora: {{ data.disco.livre }}. Só o <b>crítico</b> notifica (Telegram, aplicativo, painel): ao entrar, e depois a cada
        6 horas — ou a cada hora se ficar <b>extremamente crítico</b> (menos de 5% e de 5 GB livres). Atenção aparece só na tela.
      </p>
      <mat-slide-toggle [(ngModel)]="monitorado">Monitorar esta partição (desligado: aparece na tela, sem alerta)</mat-slide-toggle>

      <h4>Limites de espaço livre <small>(vazio = padrão)</small></h4>
      <div class="linha">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Atenção: % livre</mat-label>
          <input matInput type="number" min="1" max="99" [(ngModel)]="pcLivreAtencao" [disabled]="!monitorado" placeholder="20" />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>e GB livres</mat-label>
          <input matInput type="number" min="0" [(ngModel)]="gbLivreAtencao" [disabled]="!monitorado" placeholder="30" />
        </mat-form-field>
      </div>
      <div class="linha">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Crítico: % livre</mat-label>
          <input matInput type="number" min="1" max="99" [(ngModel)]="pcLivreCritico" [disabled]="!monitorado" placeholder="10" />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>e GB livres</mat-label>
          <input matInput type="number" min="0" [(ngModel)]="gbLivreCritico" [disabled]="!monitorado" placeholder="10" />
        </mat-form-field>
      </div>
      <p class="dica">O nível vale quando as duas condições acontecem juntas: 8% livres de um disco de 2 TB (160 GB) não é crítico.</p>

      @if (erro()) {
        <div class="erro"><mat-icon>error</mat-icon><span>{{ erro() }}</span></div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button (click)="salvar()" [disabled]="salvando()">Salvar</button>
    </mat-dialog-actions>
  `,
  styles: `
    .dica { margin: 0 0 10px; font-size: .82rem; color: var(--mat-sys-on-surface-variant, rgba(0,0,0,.6)); }
    h4 { margin: 14px 0 8px; }
    h4 small { font-weight: 400; opacity: .7; }
    .linha { display: flex; gap: 12px; margin-bottom: 10px; }
    .linha > * { flex: 1 1 140px; }
    .erro { display: flex; gap: 8px; align-items: flex-start; margin-top: 8px; padding: 8px 10px; border-radius: 8px;
            font-size: .85rem; background: color-mix(in srgb, #d93636 12%, transparent); color: #c62828; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscoDialogComponent {
  readonly data = inject<DiscoDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<DiscoDialogComponent, Servidor>>(MatDialogRef);
  private readonly service = inject(InfraestruturaService);

  monitorado = this.data.disco.monitorado;
  pcLivreAtencao = this.data.disco.pcLivreAtencao;
  gbLivreAtencao = this.data.disco.gbLivreAtencao;
  pcLivreCritico = this.data.disco.pcLivreCritico;
  gbLivreCritico = this.data.disco.gbLivreCritico;

  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);

  salvar() {
    if (this.data.disco.codDisco == null) return;
    const vazio = (v: number | null | undefined) => (v === null || v === undefined || (v as unknown) === '' ? null : Number(v));
    this.salvando.set(true);
    this.erro.set(null);
    this.service
      .salvarDisco(this.data.disco.codDisco, {
        monitorado: this.monitorado,
        pcLivreAtencao: vazio(this.pcLivreAtencao),
        gbLivreAtencao: vazio(this.gbLivreAtencao),
        pcLivreCritico: vazio(this.pcLivreCritico),
        gbLivreCritico: vazio(this.gbLivreCritico),
      })
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({
        next: servidor => this.ref.close(servidor),
        error: e => this.erro.set(e?.message ?? 'Não foi possível salvar.'),
      });
  }
}
