import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';

import { ImportacaoRoteiro, RoteiroPadrao, RoteiroResumo, SistemaCatalogo } from '../homologacao.models';
import { HomologacaoService } from '../homologacao.service';

const ESTILO = `
  .campos {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: min(620px, 88vw);
    padding-top: 8px !important;
  }

  .dica,
  .suave {
    margin: 0;
    font-size: .8rem;
    color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
  }

  .resumo {
    margin: 0;
    padding: 8px 10px;
    border-radius: 8px;
    font-size: .85rem;
    background: color-mix(in srgb, #1976d2 10%, transparent);
  }

  .ignoradas {
    max-height: 180px;
    margin: 0;
    padding-left: 18px;
    overflow-y: auto;
    font-size: .8rem;
  }

  .agrupamentos {
    display: flex;
    flex-direction: column;
    max-height: 260px;
    overflow-y: auto;
  }
`;

// ================================================================== importar planilha

export interface ImportarDialogData {
  roteiro: RoteiroPadrao;
}

/** Importar planilha no roteiro: escolhe o arquivo, confere a simulação e só então grava. */
@Component({
  selector: 'app-hom-importar-roteiro-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule, MatProgressBarModule],
  template: `
    <h2 mat-dialog-title>Importar planilha em "{{ data.roteiro.nome }}"</h2>
    <mat-dialog-content class="campos">
      <p class="dica">
        Colunas: <strong>Agrupamento</strong>, <strong>Item</strong> (o que testar), Passos, Resultado esperado e Crítico (S/N). Agrupamento vazio
        repete o da linha de cima. Agrupamento com o mesmo nome recebe os itens; item com o mesmo título no mesmo agrupamento não entra de novo.
        Aceita .xlsx ou .csv separado por ponto e vírgula.
      </p>
      <div>
        <button mat-stroked-button type="button" (click)="seletor.click()"><mat-icon>file_upload</mat-icon> Escolher arquivo</button>
        <button mat-button type="button" (click)="baixarModelo()"><mat-icon>file_download</mat-icon> Baixar modelo</button>
        <input #seletor type="file" hidden accept=".xlsx,.xls,.csv" (change)="escolher(seletor)" />
      </div>
      @if (arquivo(); as a) {
        <span class="suave">{{ a.name }}</span>
      }
      @if (ocupado()) {
        <mat-progress-bar mode="indeterminate" />
      }
      @if (simulacao(); as s) {
        <p class="resumo">
          Vai entrar: <strong>{{ s.itensNovos }}</strong> {{ s.itensNovos === 1 ? 'item' : 'itens' }}
          em {{ s.agrupamentosNovos }} {{ s.agrupamentosNovos === 1 ? 'agrupamento novo' : 'agrupamentos novos' }}
          (os demais vão para agrupamentos que já existem).
          @if (s.itensRepetidos) {
            {{ s.itensRepetidos }} {{ s.itensRepetidos === 1 ? 'item repetido fica' : 'itens repetidos ficam' }} de fora.
          }
        </p>
        @if (s.ignoradas.length) {
          <p class="dica">{{ s.ignoradas.length }} {{ s.ignoradas.length === 1 ? 'linha ignorada' : 'linhas ignoradas' }}:</p>
          <ul class="ignoradas">
            @for (l of s.ignoradas; track l.linha) {
              <li>Linha {{ l.linha }}: {{ l.motivo }}</li>
            }
          </ul>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Voltar</button>
      <button mat-flat-button type="button" [disabled]="!simulacao()?.itensNovos || ocupado()" (click)="importar()">
        Importar {{ simulacao()?.itensNovos || '' }} {{ simulacao()?.itensNovos === 1 ? 'item' : 'itens' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: ESTILO,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportarRoteiroDialogComponent {
  readonly data = inject<ImportarDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ImportarRoteiroDialogComponent, ImportacaoRoteiro>>(MatDialogRef);
  private readonly service = inject(HomologacaoService);

  readonly arquivo = signal<File | null>(null);
  readonly simulacao = signal<ImportacaoRoteiro | null>(null);
  readonly ocupado = signal(false);

  escolher(seletor: HTMLInputElement) {
    const arquivo = seletor.files?.[0];
    seletor.value = '';
    if (!arquivo) return;
    this.arquivo.set(arquivo);
    this.simulacao.set(null);
    this.ocupado.set(true);
    this.service
      .importarRoteiro(this.data.roteiro.codRoteiro, arquivo, true)
      .pipe(finalize(() => this.ocupado.set(false)))
      .subscribe({ next: s => this.simulacao.set(s), error: () => {} });
  }

  importar() {
    const arquivo = this.arquivo();
    if (!arquivo) return;
    this.ocupado.set(true);
    this.service
      .importarRoteiro(this.data.roteiro.codRoteiro, arquivo, false)
      .pipe(finalize(() => this.ocupado.set(false)))
      .subscribe({ next: r => this.dialogRef.close(r), error: () => {} });
  }

  baixarModelo() {
    this.service.modeloRoteiro().subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'modelo-roteiro-homologacao.xlsx';
        link.click();
        URL.revokeObjectURL(url);
      },
      error: () => {},
    });
  }
}

// ================================================================== copiar de outro roteiro

export interface CopiarDialogData {
  destino: RoteiroPadrao;
  sistemas: SistemaCatalogo[];
  roteiros: RoteiroResumo[];
}

/** Copiar agrupamentos (e itens ativos) de outro roteiro, de qualquer sistema, para o roteiro aberto. */
@Component({
  selector: 'app-hom-copiar-roteiro-dialog',
  imports: [FormsModule, MatButtonModule, MatCheckboxModule, MatDialogModule, MatFormFieldModule, MatProgressBarModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>Copiar para "{{ data.destino.nome }}"</h2>
    <mat-dialog-content class="campos">
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Roteiro de origem</mat-label>
        <mat-select [ngModel]="codOrigem()" (ngModelChange)="escolherOrigem($event)">
          @for (r of origens(); track r.codRoteiro) {
            <mat-option [value]="r.codRoteiro">{{ nomeSistema(r.codSistema) }} › {{ r.nome }} ({{ r.qtdItens }} itens)</mat-option>
          }
        </mat-select>
      </mat-form-field>
      @if (carregando()) {
        <mat-progress-bar mode="indeterminate" />
      }
      @if (origem(); as o) {
        <p class="dica">Agrupamentos a copiar (os itens ativos vão junto; agrupamento com o mesmo nome recebe os itens, sem repetir título):</p>
        <div class="agrupamentos">
          @for (a of o.agrupamentos; track a.codAgrupamento) {
            @if (a.ativo) {
              <mat-checkbox [checked]="marcados().has(a.codAgrupamento)" (change)="alternar(a.codAgrupamento, $event.checked)">
                {{ a.nome }} <span class="suave">({{ ativos(a) }} itens)</span>
              </mat-checkbox>
            }
          }
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Voltar</button>
      <button mat-flat-button type="button" [disabled]="!marcados().size || ocupado()" (click)="copiar()">Copiar</button>
    </mat-dialog-actions>
  `,
  styles: ESTILO,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CopiarRoteiroDialogComponent {
  readonly data = inject<CopiarDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<CopiarRoteiroDialogComponent, ImportacaoRoteiro>>(MatDialogRef);
  private readonly service = inject(HomologacaoService);

  readonly codOrigem = signal<number | null>(null);
  readonly origem = signal<RoteiroPadrao | null>(null);
  readonly marcados = signal<ReadonlySet<number>>(new Set());
  readonly carregando = signal(false);
  readonly ocupado = signal(false);
  readonly origens = computed(() => this.data.roteiros.filter(r => r.codRoteiro !== this.data.destino.codRoteiro && r.qtdItens > 0));

  nomeSistema(cod: number) {
    return this.data.sistemas.find(s => s.codSistema === cod)?.nome ?? '';
  }

  ativos(a: RoteiroPadrao['agrupamentos'][number]) {
    return a.itens.filter(i => i.ativo).length;
  }

  escolherOrigem(cod: number) {
    this.codOrigem.set(cod);
    this.origem.set(null);
    this.carregando.set(true);
    this.service
      .roteiro(cod)
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({
        next: r => {
          this.origem.set(r);
          this.marcados.set(new Set(r.agrupamentos.filter(a => a.ativo).map(a => a.codAgrupamento)));
        },
        error: () => {},
      });
  }

  alternar(cod: number, marcado: boolean) {
    this.marcados.update(atual => {
      const novo = new Set(atual);
      if (marcado) novo.add(cod);
      else novo.delete(cod);
      return novo;
    });
  }

  copiar() {
    this.ocupado.set(true);
    this.service
      .copiarRoteiro(this.data.destino.codRoteiro, this.codOrigem()!, [...this.marcados()])
      .pipe(finalize(() => this.ocupado.set(false)))
      .subscribe({ next: r => this.dialogRef.close(r), error: () => {} });
  }
}
