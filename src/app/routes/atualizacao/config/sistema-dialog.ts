import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';

import { ModuloSistema, SistemaResumo, normalizarTexto } from '../atualizacao.models';
import { AtualizacaoService } from '../atualizacao.service';
import { ConfigDialogData } from './config-dialogs';

/** Módulo em edição no diálogo: o nome original (para mostrar a renomeação) e se o nome está aberto para edição. */
interface ModuloEdicao extends ModuloSistema {
  nomeOriginal: string;
  editando: boolean;
}

/**
 * Cadastro de sistema (TB_SISTEMA), usado nas atualizações, nos grupos e nos incidentes. Com "Trabalha com módulos",
 * também os módulos (TB_SISTEMA_MODULO), que organizam os roteiros de homologação (Sistema › Módulo › Agrupamento).
 */
@Component({
  selector: 'app-atualizacao-sistema-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.registro ? 'Sistema ' + data.registro.nome : 'Novo sistema' }}</h2>
    <form #form="ngForm" (ngSubmit)="salvar()">
      <mat-dialog-content class="campos">
        <mat-form-field appearance="outline">
          <mat-label>Nome do sistema</mat-label>
          <input matInput name="nome" [(ngModel)]="nome" required maxlength="100" autocomplete="off" cdkFocusInitial />
          <mat-hint>Ex.: MV Soul, MV PEP, Portal do Paciente</mat-hint>
        </mat-form-field>
        @if (data.registro) {
          <mat-slide-toggle name="ativo" [(ngModel)]="ativo">Ativo</mat-slide-toggle>
          <p class="dica">Inativo continua nas atualizações já registradas, mas não aparece para novas.</p>
        }

        <mat-checkbox name="trabalhaModulo" [(ngModel)]="trabalhaModulo">Trabalha com módulos</mat-checkbox>
        <p class="dica">
          Ex.: MV Soul → Faturamento de Convênios, Faturamento SUS, Financeiro, Contabilidade. Nos roteiros de homologação, cada agrupamento
          passa a pertencer a um módulo.
        </p>
        @if (trabalhaModulo) {
          <div class="modulos">
            @for (m of modulos(); track $index; let i = $index; let primeiro = $first; let ultimo = $last) {
              <div class="modulo" [class.inativo]="!m.ativo">
                @if (!m.codModulo || m.editando) {
                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="nome-modulo">
                    <mat-label>{{ m.codModulo ? 'Novo nome do módulo' : 'Módulo' }}</mat-label>
                    <input matInput [name]="'modulo' + i" [(ngModel)]="m.nome" maxlength="100" autocomplete="off" (keydown.enter)="concluirRenomear($event, m)" />
                    @if (m.codModulo && m.nome.trim() !== m.nomeOriginal) {
                      <mat-hint>antes: {{ m.nomeOriginal }}{{ m.usos ? ' — o novo nome aparece nos roteiros e homologações que usam o módulo' : '' }}</mat-hint>
                    }
                  </mat-form-field>
                  @if (m.codModulo) {
                    <button mat-icon-button type="button" aria-label="Concluir renomeação" matTooltip="Concluir" (click)="m.editando = false"><mat-icon>check</mat-icon></button>
                  }
                } @else {
                  <span class="nome-modulo nome-fixo">
                    {{ m.nome }}
                    @if (m.nome.trim() !== m.nomeOriginal) {
                      <span class="dica">(antes: {{ m.nomeOriginal }})</span>
                    }
                  </span>
                  <button mat-icon-button type="button" aria-label="Renomear módulo" matTooltip="Renomear" (click)="m.editando = true"><mat-icon>edit</mat-icon></button>
                }
                <mat-slide-toggle [name]="'ativo' + i" [(ngModel)]="m.ativo" [disabled]="!m.codModulo" matTooltip="Inativo: não aparece para novos agrupamentos">
                  Ativo
                </mat-slide-toggle>
                <button mat-icon-button type="button" [disabled]="primeiro" aria-label="Subir módulo" (click)="mover(i, -1)"><mat-icon>arrow_upward</mat-icon></button>
                <button mat-icon-button type="button" [disabled]="ultimo" aria-label="Descer módulo" (click)="mover(i, 1)"><mat-icon>arrow_downward</mat-icon></button>
                <button
                  mat-icon-button
                  type="button"
                  [disabled]="m.usos > 0"
                  [matTooltip]="m.usos > 0 ? 'Usado em ' + m.usos + ' agrupamento(s): inative em vez de excluir' : 'Excluir'"
                  aria-label="Excluir módulo"
                  (click)="excluir(i)">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            }
            <button mat-stroked-button type="button" class="incluir" (click)="incluir()"><mat-icon>add</mat-icon> Módulo</button>
          </div>
          @if (problema()) {
            <p class="aviso">{{ problema() }}</p>
          }
        } @else if (usados() > 0) {
          <p class="aviso">
            Os módulos continuam cadastrados ({{ usados() }} agrupamento(s) ligados a eles), mas deixam de aparecer nos roteiros e nas homologações
            enquanto a opção estiver desmarcada.
          </p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="form.invalid || salvando() || !!problema()">Salvar</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .campos {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: min(560px, 88vw);
      padding-top: 8px !important;
    }

    .dica {
      margin: 0;
      font-size: .8rem;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
    }

    .aviso {
      margin: 0;
      padding: 6px 10px;
      border-radius: 8px;
      font-size: .8rem;
      background: color-mix(in srgb, #e08a00 14%, transparent);
    }

    .modulos {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .modulo {
      display: flex;
      gap: 4px;
      align-items: center;
    }

    .nome-modulo {
      flex: 1;
    }

    .nome-fixo {
      padding: 0 4px;
      font-size: .9rem;
    }

    .inativo {
      opacity: .6;
    }

    .incluir {
      align-self: flex-start;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SistemaDialogComponent {
  readonly data = inject<ConfigDialogData<SistemaResumo>>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<SistemaDialogComponent, boolean>>(MatDialogRef);
  private readonly service = inject(AtualizacaoService);

  readonly salvando = signal(false);
  nome = this.data.registro?.nome ?? '';
  ativo = this.data.registro?.ativo ?? true;
  trabalhaModulo = this.data.registro?.trabalhaModulo ?? false;
  /** Cópias editáveis, na ordem do cadastro; o nome original mostra o que foi renomeado. */
  readonly modulos = signal<ModuloEdicao[]>((this.data.registro?.modulos ?? []).map(m => ({ ...m, nomeOriginal: m.nome, editando: false })));

  /** Enter no nome conclui a renomeação em vez de enviar o formulário. */
  concluirRenomear(evento: Event, m: ModuloEdicao) {
    evento.preventDefault();
    if (m.codModulo) m.editando = false;
  }

  usados() {
    return this.modulos().reduce((soma, m) => soma + m.usos, 0);
  }

  incluir() {
    this.modulos.update(lista => [...lista, { codModulo: null, nome: '', ativo: true, usos: 0, nomeOriginal: '', editando: true }]);
  }

  excluir(i: number) {
    this.modulos.update(lista => lista.filter((_, j) => j !== i));
  }

  mover(i: number, direcao: number) {
    this.modulos.update(lista => {
      const nova = [...lista];
      [nova[i], nova[i + direcao]] = [nova[i + direcao], nova[i]];
      return nova;
    });
  }

  /** O que impede salvar os módulos, em texto (R-17). */
  problema(): string {
    if (!this.trabalhaModulo) return '';
    const lista = this.modulos();
    if (lista.some(m => !m.nome.trim())) return 'Dê nome a todos os módulos (ou exclua a linha vazia).';
    const vistos = new Set<string>();
    for (const m of lista) {
      const chave = normalizarTexto(m.nome.trim());
      if (vistos.has(chave)) return `O módulo "${m.nome.trim()}" aparece duas vezes.`;
      vistos.add(chave);
    }
    if (!lista.some(m => m.ativo)) return 'Cadastre pelo menos um módulo ativo.';
    return '';
  }

  salvar() {
    this.salvando.set(true);
    this.service
      .salvarSistema({
        codSistema: this.data.registro?.codSistema ?? null,
        nome: this.nome.trim(),
        ativo: this.ativo,
        trabalhaModulo: this.trabalhaModulo,
        modulos: this.modulos().map(m => ({ codModulo: m.codModulo, nome: m.nome.trim(), ativo: m.ativo })),
      })
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({ next: () => this.dialogRef.close(true), error: () => {} });
  }
}
