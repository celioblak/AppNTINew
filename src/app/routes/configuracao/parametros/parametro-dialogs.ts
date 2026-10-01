import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { finalize } from 'rxjs';

import {
  EfeitoParametro,
  HistoricoParametro,
  Parametro,
  ParametrosService,
  ROTULO_EFEITO,
  ROTULO_TIPO,
  TipoParametro,
} from './parametros.service';

const ESTILO_DIALOGO = `
  .campos { display: flex; flex-direction: column; gap: 12px; padding-top: 6px; }
  .linha { display: flex; gap: 12px; flex-wrap: wrap; }
  .linha > * { flex: 1 1 160px; }
  .dica { margin: 0; font-size: .82rem; color: var(--mat-sys-on-surface-variant, rgba(0,0,0,.6)); }
  code { font-size: .85rem; }
  .erro { display: flex; gap: 8px; align-items: flex-start; padding: 8px 10px; border-radius: 8px; font-size: .85rem;
          background: color-mix(in srgb, #d93636 12%, transparent); color: #c62828; }
`;

/** Editar o valor de um parâmetro, com o campo do tipo certo. Devolve o parâmetro gravado. */
@Component({
  selector: 'app-parametro-edicao-dialog',
  imports: [FormsModule, MatButtonModule, MatCheckboxModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule,
    MatSelectModule],
  template: `
    <h2 mat-dialog-title>Editar <code>{{ p.chave }}</code></h2>
    <mat-dialog-content>
      <div class="campos">
        @if (p.descricao) { <p class="dica">{{ p.descricao }}</p> }
        @switch (p.tipo) {
          @case ('SIM_NAO') {
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Valor</mat-label>
              <mat-select [(ngModel)]="valor">
                @if (!p.obrigatorio) { <mat-option [value]="''">— não configurado —</mat-option> }
                <mat-option value="S">Sim</mat-option>
                <mat-option value="N">Não</mat-option>
              </mat-select>
            </mat-form-field>
          }
          @case ('SEGREDO') {
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Novo valor</mat-label>
              <input matInput type="password" autocomplete="new-password" [(ngModel)]="valor" [disabled]="apagar" />
              <mat-hint>{{ p.cadastrado ? 'Há um valor cadastrado (não é mostrado). Digite o novo para trocar.' : 'Não cadastrado.' }}</mat-hint>
            </mat-form-field>
            @if (p.cadastrado && !p.obrigatorio) {
              <mat-checkbox [(ngModel)]="apagar">Apagar o valor cadastrado</mat-checkbox>
            }
          }
          @case ('NUMERO') {
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Valor</mat-label>
              <input matInput type="number" [(ngModel)]="valor" [attr.min]="p.minimo" [attr.max]="p.maximo" />
              <mat-hint>{{ faixa() }}</mat-hint>
            </mat-form-field>
          }
          @default {
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Valor</mat-label>
              <textarea matInput rows="2" [(ngModel)]="valor"></textarea>
              <mat-hint>{{ dicaTipo() }}</mat-hint>
            </mat-form-field>
          }
        }
        <p class="dica">
          {{ rotuloEfeito[p.efeito] }}.
          @if (p.padrao) { Padrão: <code>{{ p.padrao }}</code>. }
          @if (p.obrigatorio) { Obrigatório: o sistema não funciona sem ele. } @else { Vazio = não configurado. }
        </p>
        @if (erro()) {
          <div class="erro"><mat-icon>error</mat-icon><span>{{ erro() }}</span></div>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button (click)="salvar()" [disabled]="salvando() || (p.segredo && !valor && !apagar)">Salvar</button>
    </mat-dialog-actions>
  `,
  styles: ESTILO_DIALOGO,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParametroEdicaoDialogComponent {
  readonly p = inject<Parametro>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<ParametroEdicaoDialogComponent, Parametro>>(MatDialogRef);
  private readonly service = inject(ParametrosService);

  readonly rotuloEfeito = ROTULO_EFEITO;
  valor: string | number | null = this.p.segredo ? '' : (this.p.valor ?? '');
  apagar = false;
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);

  faixa(): string {
    const { minimo, maximo } = this.p;
    if (minimo != null && maximo != null) return `De ${minimo} a ${maximo}`;
    if (minimo != null) return `Mínimo ${minimo}`;
    if (maximo != null) return `Máximo ${maximo}`;
    return 'Número inteiro';
  }

  dicaTipo(): string {
    if (this.p.tipo === 'URL') return 'Endereço completo, com http:// ou https://';
    if (this.p.tipo === 'LISTA_IP') return 'IPv4 separados por vírgula (ex.: 192.168.20.10, 192.168.20.11)';
    return ROTULO_TIPO[this.p.tipo];
  }

  salvar() {
    const texto = this.apagar ? null : this.valor === null || this.valor === '' ? null : String(this.valor);
    this.salvando.set(true);
    this.erro.set(null);
    this.service
      .salvar(this.p.chave, texto)
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({
        next: salvo => this.ref.close(salvo),
        error: e => this.erro.set(e?.message ?? 'Não foi possível salvar.'),
      });
  }
}

/** Parâmetro novo (D-04): chave, grupo, tipo, descrição, valor e padrão. */
@Component({
  selector: 'app-parametro-novo-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule,
    MatSlideToggleModule],
  template: `
    <h2 mat-dialog-title>Novo parâmetro</h2>
    <mat-dialog-content>
      <div class="campos">
        <p class="dica">Só vale se algum código ler esta chave: combine com quem vai usá-la.</p>
        <div class="linha">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Chave</mat-label>
            <input matInput [(ngModel)]="n.chave" maxlength="100" placeholder="EX: MODULO_PARAMETRO" />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Grupo</mat-label>
            <input matInput [(ngModel)]="n.grupo" maxlength="60" list="grupos-parametros" />
            <datalist id="grupos-parametros">
              @for (g of grupos; track g) { <option [value]="g"></option> }
            </datalist>
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Descrição</mat-label>
          <input matInput [(ngModel)]="n.descricao" maxlength="400" />
        </mat-form-field>
        <div class="linha">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Tipo</mat-label>
            <mat-select [(ngModel)]="n.tipo">
              @for (t of tipos; track t) { <mat-option [value]="t">{{ rotuloTipo[t] }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Quando vale</mat-label>
            <mat-select [(ngModel)]="n.efeito">
              @for (e of efeitos; track e) { <mat-option [value]="e">{{ rotuloEfeito[e] }}</mat-option> }
            </mat-select>
          </mat-form-field>
        </div>
        <div class="linha">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Valor</mat-label>
            <input matInput [type]="n.tipo === 'SEGREDO' ? 'password' : 'text'" autocomplete="new-password" [(ngModel)]="n.valor" />
          </mat-form-field>
          @if (n.tipo !== 'SEGREDO') {
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Padrão</mat-label>
              <input matInput [(ngModel)]="n.padrao" />
              <mat-hint>"Voltar ao padrão" grava este valor</mat-hint>
            </mat-form-field>
          }
        </div>
        @if (n.tipo === 'NUMERO') {
          <div class="linha">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Mínimo</mat-label>
              <input matInput type="number" [(ngModel)]="n.minimo" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Máximo</mat-label>
              <input matInput type="number" [(ngModel)]="n.maximo" />
            </mat-form-field>
          </div>
        }
        <mat-slide-toggle [(ngModel)]="n.obrigatorio">Obrigatório (não pode ficar vazio)</mat-slide-toggle>
        @if (erro()) {
          <div class="erro"><mat-icon>error</mat-icon><span>{{ erro() }}</span></div>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button (click)="criar()" [disabled]="salvando() || !n.chave || !n.grupo || !n.descricao">Criar</button>
    </mat-dialog-actions>
  `,
  styles: ESTILO_DIALOGO,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParametroNovoDialogComponent {
  readonly grupos = inject<string[]>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<ParametroNovoDialogComponent, Parametro>>(MatDialogRef);
  private readonly service = inject(ParametrosService);

  readonly rotuloTipo = ROTULO_TIPO;
  readonly rotuloEfeito = ROTULO_EFEITO;
  readonly tipos = Object.keys(ROTULO_TIPO) as TipoParametro[];
  readonly efeitos = Object.keys(ROTULO_EFEITO) as EfeitoParametro[];
  n = {
    chave: '',
    grupo: '',
    tipo: 'TEXTO' as TipoParametro,
    descricao: '',
    valor: '' as string | null,
    padrao: '' as string | null,
    minimo: null as number | null,
    maximo: null as number | null,
    obrigatorio: false,
    efeito: 'IMEDIATO' as EfeitoParametro,
  };
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);

  criar() {
    this.salvando.set(true);
    this.erro.set(null);
    this.service
      .criar({ ...this.n, valor: this.n.valor || null, padrao: this.n.tipo === 'SEGREDO' ? null : this.n.padrao || null })
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({
        next: criado => this.ref.close(criado),
        error: e => this.erro.set(e?.message ?? 'Não foi possível criar.'),
      });
  }
}

/** Histórico de um parâmetro: quem mudou, quando, de quê para quê (segredo só "cadastrado"). */
@Component({
  selector: 'app-parametro-historico-dialog',
  imports: [DatePipe, MatButtonModule, MatDialogModule, MatProgressBarModule],
  template: `
    <h2 mat-dialog-title>Histórico de <code>{{ chave }}</code></h2>
    <mat-dialog-content>
      @if (carregando()) { <mat-progress-bar mode="indeterminate" /> }
      @if (!carregando() && !itens().length) { <p class="dica">Nenhuma alteração registrada pela tela ainda.</p> }
      @for (h of itens(); track $index) {
        <div class="item">
          <div><b>{{ rotulo[h.acao] }}</b> · {{ h.usuario ?? '—' }} · {{ h.quando | date: 'dd/MM/yyyy HH:mm' }}</div>
          <div class="valores"><code>{{ h.valorAnterior ?? '(vazio)' }}</code> → <code>{{ h.valorNovo ?? '(vazio)' }}</code></div>
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-flat-button mat-dialog-close>Fechar</button></mat-dialog-actions>
  `,
  styles: `
    .item { padding: 6px 0; border-bottom: 1px solid var(--mat-sys-outline-variant, #ddd); font-size: .85rem; }
    .valores { margin-top: 2px; word-break: break-all; }
    .dica { font-size: .85rem; color: var(--mat-sys-on-surface-variant, rgba(0,0,0,.6)); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParametroHistoricoDialogComponent {
  readonly chave = inject<string>(MAT_DIALOG_DATA);
  private readonly service = inject(ParametrosService);
  readonly rotulo: Record<HistoricoParametro['acao'], string> = { CRIOU: 'Criou', ALTEROU: 'Alterou', PADRAO: 'Voltou ao padrão' };
  readonly itens = signal<HistoricoParametro[]>([]);
  readonly carregando = signal(true);

  constructor() {
    this.service
      .historico(this.chave)
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({ next: h => this.itens.set(h), error: () => {} });
  }
}
