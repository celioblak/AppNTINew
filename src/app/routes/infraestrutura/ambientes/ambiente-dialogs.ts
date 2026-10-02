import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { finalize } from 'rxjs';

import { Ambiente, Hospedagem } from '../infraestrutura.models';
import { InfraestruturaService } from '../infraestrutura.service';

const ESTILOS = `
  .campos { display: flex; flex-direction: column; gap: 14px; padding-top: 8px !important; }
  .linha { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-start; }
  .linha > * { flex: 1 1 180px; }
  .dica { margin: 0 0 6px; font-size: .8rem; color: var(--mat-sys-on-surface-variant, rgba(0,0,0,.6)); }
  .erro { display: flex; gap: 8px; align-items: flex-start; padding: 8px 10px; border-radius: 8px; font-size: .85rem;
          background: color-mix(in srgb, #d93636 12%, transparent); color: #c62828; }
  .cor { display: flex; align-items: center; gap: 10px; }
  .cor input[type=color] { width: 44px; height: 32px; border: none; background: none; padding: 0; }
`;

/** Cadastro de ambiente. O código é escolhido na criação e não muda (é gravado nos outros cadastros). */
@Component({
  selector: 'app-ambiente-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSlideToggleModule],
  template: `
    <h2 mat-dialog-title>{{ novo ? 'Novo ambiente' : 'Ambiente ' + data.nome }}</h2>
    <mat-dialog-content class="campos">
      <p class="dica">Ambiente é a fase do ciclo (Produção, Homologação...). Onde a máquina está (datacenter, nuvem) é a hospedagem.</p>
      <div class="linha">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Código</mat-label>
          <input matInput [(ngModel)]="a.codigo" [disabled]="!novo" maxlength="30" placeholder="DESENVOLVIMENTO"
                 (ngModelChange)="a.codigo = ($event ?? '').toUpperCase()" />
          <mat-hint>{{ novo ? 'Letras maiúsculas, números e _. Não muda depois.' : 'Não pode ser alterado.' }}</mat-hint>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Nome</mat-label>
          <input matInput [(ngModel)]="a.nome" maxlength="60" required />
        </mat-form-field>
      </div>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Descrição</mat-label>
        <input matInput [(ngModel)]="a.descricao" maxlength="400" />
      </mat-form-field>
      <div class="linha">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Ordem na lista</mat-label>
          <input matInput type="number" [(ngModel)]="a.ordem" />
        </mat-form-field>
        <div class="cor">
          <input type="color" [(ngModel)]="a.cor" aria-label="Cor do ambiente" />
          <span class="dica">Cor usada nas etiquetas do ambiente</span>
        </div>
      </div>
      <mat-slide-toggle [(ngModel)]="a.producao">É produção (queda aparece no painel de TV e pesa no mapa)</mat-slide-toggle>
      <mat-slide-toggle [(ngModel)]="a.alerta">Gera alerta (desligado: problemas deste ambiente não viram mensagem; telas, mapa e disponibilidade continuam)</mat-slide-toggle>
      @if (!novo) {
        <mat-slide-toggle [(ngModel)]="a.ativo">Ativo</mat-slide-toggle>
      }
      @if (erro()) {
        <div class="erro"><mat-icon>error</mat-icon><span>{{ erro() }}</span></div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button (click)="salvar()" [disabled]="salvando() || !a.nome || !a.codigo">Salvar</button>
    </mat-dialog-actions>
  `,
  styles: ESTILOS,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AmbienteDialogComponent {
  readonly data = inject<Ambiente | null>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<AmbienteDialogComponent, Ambiente>>(MatDialogRef);
  private readonly service = inject(InfraestruturaService);

  readonly novo = !this.data;
  a: Ambiente = this.data
    ? { ...this.data }
    : { codigo: '', nome: '', descricao: null, producao: false, cor: '#1565C0', ordem: 100, ativo: true, alerta: true };
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);

  salvar() {
    this.salvando.set(true);
    this.erro.set(null);
    this.service
      .salvarAmbiente(this.a, this.novo)
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({
        next: salvo => this.ref.close(salvo),
        error: e => this.erro.set(e?.error?.message ?? 'Não foi possível salvar.'),
      });
  }
}

/** Cadastro de hospedagem: datacenter próprio ou nuvem (com provedor e região). */
@Component({
  selector: 'app-hospedagem-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ h.codHospedagem ? 'Hospedagem ' + data?.nome : 'Nova hospedagem' }}</h2>
    <mat-dialog-content class="campos">
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Nome</mat-label>
        <input matInput [(ngModel)]="h.nome" maxlength="80" required placeholder="Ex.: AWS São Paulo" />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Tipo</mat-label>
        <mat-select [(ngModel)]="h.tipo">
          <mat-option value="ON_PREMISE">Datacenter próprio</mat-option>
          <mat-option value="CLOUD">Nuvem</mat-option>
        </mat-select>
      </mat-form-field>
      @if (h.tipo === 'CLOUD') {
        <div class="linha">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Provedor</mat-label>
            <input matInput [(ngModel)]="h.provedor" maxlength="80" placeholder="AWS, Azure, Google Cloud" />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Região</mat-label>
            <input matInput [(ngModel)]="h.regiao" maxlength="80" placeholder="sa-east-1" />
          </mat-form-field>
        </div>
      }
      @if (h.codHospedagem) {
        <mat-slide-toggle [(ngModel)]="h.ativo">Ativa</mat-slide-toggle>
      }
      @if (erro()) {
        <div class="erro"><mat-icon>error</mat-icon><span>{{ erro() }}</span></div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button (click)="salvar()" [disabled]="salvando() || !h.nome">Salvar</button>
    </mat-dialog-actions>
  `,
  styles: ESTILOS,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HospedagemDialogComponent {
  readonly data = inject<Hospedagem | null>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<HospedagemDialogComponent, Hospedagem>>(MatDialogRef);
  private readonly service = inject(InfraestruturaService);

  h: Hospedagem = this.data
    ? { ...this.data }
    : { codHospedagem: null, nome: '', tipo: 'ON_PREMISE', provedor: null, regiao: null, ativo: true };
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);

  salvar() {
    this.salvando.set(true);
    this.erro.set(null);
    this.service
      .salvarHospedagem(this.h)
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({
        next: salvo => this.ref.close(salvo),
        error: e => this.erro.set(e?.error?.message ?? 'Não foi possível salvar.'),
      });
  }
}
