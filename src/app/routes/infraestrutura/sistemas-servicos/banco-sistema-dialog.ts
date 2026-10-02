import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';

import { AmbienteSistema, BancoOpcao, ROTULO_FINALIDADE, SistemaInfra } from '../infraestrutura.models';
import { InfraestruturaService } from '../infraestrutura.service';

export interface BancoSistemaDialogData {
  sistema: SistemaInfra;
  ambiente: AmbienteSistema;
}

/**
 * Banco do sistema no ambiente (docs/infraestrutura.md, R-83, D-48): liga ao banco cadastrado, com a base (schema/PDB)
 * e o ponto de acesso. Vem sugerido pelo texto antigo de Atualizações, que continua (é a chave do histórico).
 */
@Component({
  selector: 'app-banco-sistema-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule,
    MatSelectModule],
  template: `
    <h2 mat-dialog-title>Banco · {{ data.sistema.nome }} · {{ data.ambiente.nomeAmbiente }}</h2>
    <mat-dialog-content>
      @if (data.ambiente.banco?.textoAntigo; as texto) {
        <p class="dica">
          Em Atualizações o banco está como <b>{{ texto }}</b>. Esse texto continua lá (é por ele que o histórico de aplicações é
          encontrado); aqui o sistema passa a apontar o banco cadastrado, que entra na situação do sistema.
          @if (sugerido()) { A sugestão abaixo veio desse texto: confira. }
        </p>
      }
      @if (carregando()) {
        <mat-progress-bar mode="indeterminate" />
      }
      <mat-form-field appearance="outline" class="campo">
        <mat-label>Banco</mat-label>
        <mat-select [(ngModel)]="codBanco" (selectionChange)="codAcesso = null">
          <mat-option [value]="null">Nenhum</mat-option>
          @for (b of bancos(); track b.codBanco) {
            <mat-option [value]="b.codBanco">{{ b.nome }}{{ b.ambiente ? ' (' + b.ambiente + ')' : '' }}</mat-option>
          }
        </mat-select>
        @if (!bancos().length && !carregando()) {
          <mat-hint>Nenhum banco cadastrado: cadastre em Infraestrutura › Bancos de Dados.</mat-hint>
        }
      </mat-form-field>
      @if (codBanco) {
        <mat-form-field appearance="outline" class="campo">
          <mat-label>Base (schema ou PDB)</mat-label>
          <input matInput [(ngModel)]="base" maxlength="128" placeholder="DBAMV" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="campo">
          <mat-label>Ponto de acesso que o sistema usa</mat-label>
          <mat-select [(ngModel)]="codAcesso">
            <mat-option [value]="null">Não informado</mat-option>
            @for (a of acessos(); track a.codAcesso) {
              <mat-option [value]="a.codAcesso">{{ a.nome }} · {{ rotuloFinalidade[a.finalidade] }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button (click)="salvar()" [disabled]="salvando()">Salvar</button>
    </mat-dialog-actions>
  `,
  styles: `
    .dica { margin: 0 0 10px; font-size: .82rem; color: var(--mat-sys-on-surface-variant, rgba(0,0,0,.6)); }
    .campo { display: block; width: 100%; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BancoSistemaDialogComponent implements OnInit {
  readonly data = inject<BancoSistemaDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<BancoSistemaDialogComponent, SistemaInfra>);
  private readonly service = inject(InfraestruturaService);

  readonly rotuloFinalidade = ROTULO_FINALIDADE;
  readonly carregando = signal(false);
  readonly salvando = signal(false);
  readonly bancos = signal<BancoOpcao[]>([]);

  private readonly atual = this.data.ambiente.banco;
  readonly sugerido = signal(!this.atual?.codBanco && !!this.atual?.sugestaoCodBanco);
  codBanco: number | null = this.atual?.codBanco ?? this.atual?.sugestaoCodBanco ?? null;
  base: string | null = this.atual?.base ?? this.atual?.sugestaoBase ?? null;
  codAcesso: number | null = this.atual?.codAcesso ?? null;

  acessos() {
    return this.bancos().find(b => b.codBanco === this.codBanco)?.acessos ?? [];
  }

  ngOnInit() {
    this.carregando.set(true);
    this.service
      .bancosParaSistema()
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({ next: b => this.bancos.set(b), error: () => {} });
  }

  salvar() {
    this.salvando.set(true);
    this.service
      .salvarBancoDoSistema(this.data.sistema.codSistema, this.data.ambiente.ambiente, {
        codBanco: this.codBanco,
        base: this.codBanco ? this.base : null,
        codAcesso: this.codBanco ? this.codAcesso : null,
      })
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({ next: s => this.ref.close(s), error: () => {} });
  }
}
