import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';

import { normalizar } from '../../dispositivo/terminal-ssh/comandos';
import { CAMADAS, DICA_CAMADA, ROTULO_CAMADA, ServicoSistemas, SistemaDoServico } from '../infraestrutura.models';
import { InfraestruturaService } from '../infraestrutura.service';

export interface ServicoSistemasDialogData {
  codProcesso: number;
  nome: string;
}

/**
 * Sistemas que dependem deste serviço (docs/infraestrutura.md, D-06 e R-27): mostra em quais sistemas ele está e
 * marca/desmarca vários de uma vez, no ambiente do serviço (ex.: SSO usado por vários sistemas MV).
 */
@Component({
  selector: 'app-servico-sistemas-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  template: `
    <h2 mat-dialog-title>
      Sistemas que dependem deste serviço
      <small>{{ data.nome }}{{ dados()?.nomeAmbiente ? ' · ' + dados()!.nomeAmbiente : '' }}</small>
    </h2>
    @if (carregando()) {
      <mat-progress-bar mode="indeterminate" />
    }
    <mat-dialog-content class="campos">
      @if (dados(); as d) {
        @if (!d.ambiente || !d.nomeAmbiente) {
          <p class="aviso">
            <mat-icon inline>info</mat-icon>
            O serviço não tem ambiente de sistema (Produção, Homologação ou Treinamento). Defina o ambiente do serviço, ou o padrão do
            servidor, para ligá-lo a sistemas.
          </p>
        } @else {
          <p class="dica">
            Marque os sistemas de {{ d.nomeAmbiente }} que dependem dele. Só os marcados ficam fora quando ele cai (ex.: o SSO derruba só os
            sistemas que usam o SSO). Sistema que ainda não está em {{ d.nomeAmbiente }} é incluído no ambiente ao marcar.
          </p>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-icon matPrefix>search</mat-icon>
            <mat-label>Procurar sistema</mat-label>
            <input matInput [ngModel]="filtro()" (ngModelChange)="filtro.set($event)" />
          </mat-form-field>
          <div class="linhas">
            @for (s of filtradas(); track s.codSistema) {
              <div class="linha" [class.linha--marcada]="s.vinculado">
                <mat-checkbox [checked]="s.vinculado" (change)="alterar(s.codSistema, { vinculado: $event.checked })">
                  {{ s.sistema }}@if (!s.ativo) { <small> (inativo)</small> }
                </mat-checkbox>
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="camada">
                  <mat-select [ngModel]="s.camada" (ngModelChange)="alterar(s.codSistema, { camada: $event })" [disabled]="!s.vinculado"
                              [matTooltip]="dicaCamada[s.camada]">
                    @for (c of camadas; track c) {
                      <mat-option [value]="c">{{ rotuloCamada[c] }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="marca">
                  <mat-select [ngModel]="s.essencial" (ngModelChange)="alterar(s.codSistema, { essencial: $event })" [disabled]="!s.vinculado">
                    <mat-option [value]="true">Essencial</mat-option>
                    <mat-option [value]="false">Auxiliar</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>
            } @empty {
              <p class="dica">Nenhum sistema encontrado.</p>
            }
          </div>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close>Fechar</button>
      <button matButton="filled" type="button" [disabled]="salvando() || !mudou()" (click)="salvar()">Salvar</button>
    </mat-dialog-actions>
  `,
  styles: `
    h2 small { display: block; font-size: 13px; font-weight: 400; color: var(--mat-sys-on-surface-variant); }
    .campos { display: flex; flex-direction: column; gap: 10px; min-width: min(640px, 92vw); padding-top: 8px !important; }
    .dica, .aviso { margin: 0; font-size: 13px; color: var(--mat-sys-on-surface-variant); }
    .linhas { display: flex; flex-direction: column; gap: 4px; max-height: 50vh; overflow-y: auto; }
    .linha { display: grid; grid-template-columns: minmax(0, 1fr) 160px 130px; gap: 8px; align-items: center; padding: 2px 4px; border-radius: 8px; }
    .linha--marcada { background: color-mix(in srgb, var(--mat-sys-primary) 6%, transparent); }
    @media (max-width: 600px) { .linha { grid-template-columns: 1fr; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicoSistemasDialogComponent implements OnInit {
  readonly data = inject<ServicoSistemasDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ServicoSistemasDialogComponent>);
  private readonly service = inject(InfraestruturaService);

  readonly camadas = CAMADAS;
  readonly rotuloCamada = ROTULO_CAMADA;
  readonly dicaCamada = DICA_CAMADA;

  readonly carregando = signal(false);
  readonly salvando = signal(false);
  readonly dados = signal<ServicoSistemas | null>(null);
  readonly linhas = signal<SistemaDoServico[]>([]);
  readonly filtro = signal('');
  private original = '';

  readonly filtradas = computed(() => {
    const termo = normalizar(this.filtro().trim());
    const lista = [...this.linhas()].sort((a, b) => Number(b.vinculado) - Number(a.vinculado) || a.sistema.localeCompare(b.sistema));
    return termo ? lista.filter(s => normalizar(s.sistema).includes(termo)) : lista;
  });

  ngOnInit() {
    this.carregando.set(true);
    this.service
      .sistemasDoServico(this.data.codProcesso)
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({ next: d => this.aplicar(d), error: () => {} });
  }

  alterar(codSistema: number, mudanca: Partial<SistemaDoServico>) {
    this.linhas.update(l => l.map(s => (s.codSistema === codSistema ? { ...s, ...mudanca } : s)));
  }

  mudou() {
    return JSON.stringify(this.linhas()) !== this.original;
  }

  salvar() {
    this.salvando.set(true);
    this.service
      .salvarSistemasDoServico(this.data.codProcesso, this.linhas())
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({
        next: d => {
          this.aplicar(d);
          this.dialogRef.close(true);
        },
        error: () => {}, // sem permissão ou serviço de outro ambiente: mensagem do interceptor
      });
  }

  private aplicar(d: ServicoSistemas) {
    this.dados.set(d);
    this.linhas.set(d.sistemas);
    this.original = JSON.stringify(d.sistemas);
  }
}
