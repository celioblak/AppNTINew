import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import { Alvo, Artefato, GerarJarResultado, nomeDoJar } from '../atualizacao.models';

/** O que fazer com os caminhos que não existem no JAR: ajustar para os do JAR ou gerar como estão. */
export type AcaoInclusoes = 'corrigir' | 'gerar';

export interface InclusoesDialogData {
  artefato: Artefato;
  alvo: Alvo;
  resultado: GerarJarResultado;
}

/**
 * Última conferência antes de montar o JAR: arquivo cujo caminho não existe no JAR do destino quase sempre é
 * pasta ou JAR trocado. Mostra a lista para o técnico decidir se são telas novas mesmo.
 */
@Component({
  selector: 'app-atualizacao-inclusoes-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Arquivos em caminho trocado</h2>
    <mat-dialog-content class="conteudo">
      <div class="alerta">
        <mat-icon>report</mat-icon>
        <div>
          <strong>{{ resultado.correcoes.length }} arquivo(s) já existem no JAR de {{ data.alvo.alvo }}, mas em outro caminho</strong>
          <span>
            O JAR é <code>{{ jar }}</code>. Gerados como estão, iriam para um caminho novo e a versão antiga continuaria no lugar
            dela — a correção não teria efeito. Normalmente é uma pasta a mais ou a menos na hora de incluir o artefato.
          </span>
        </div>
      </div>

      <ul class="caminhos caminhos--ajuste">
        @for (correcao of resultado.correcoes; track correcao.de) {
          <li>
            <code class="falha">{{ correcao.de }}</code>
            <code class="ok">→ {{ correcao.para }}</code>
          </li>
        }
      </ul>

      <dl class="resumo">
        <dt>Substituem arquivo existente</dt>
        <dd>{{ resultado.substituidas }}</dd>
        <dt>Em caminho trocado</dt>
        <dd class="falha">{{ resultado.correcoes.length }}</dd>
        <dt>Novos da correção (entram normalmente)</dt>
        <dd>{{ novos.length + restantes }}</dd>
        <dt>Iguais ao que já está lá</dt>
        <dd>{{ resultado.iguais }}</dd>
      </dl>

      @if (novos.length) {
        <details>
          <summary class="dica">Arquivos novos da correção ({{ novos.length + restantes }}) — não existem no JAR e entram como novos</summary>
          <ul class="caminhos">
            @for (caminho of novos; track caminho) {
              <li><code>{{ caminho }}</code></li>
            }
          </ul>
          @if (restantes > 0) {
            <span class="dica">… e mais {{ restantes }}.</span>
          }
        </details>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Cancelar</button>
      <button mat-stroked-button type="button" class="perigo-contorno" (click)="fechar('gerar')">Gerar sem ajustar</button>
      @if (resultado.correcoes.length) {
        <button mat-flat-button type="button" (click)="fechar('corrigir')">
          <mat-icon>build</mat-icon> Ajustar {{ resultado.correcoes.length }} caminho(s) e gerar
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: `
    .conteudo {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: min(680px, 88vw);
      padding-top: 8px !important;
    }

    .alerta {
      display: flex;
      gap: 10px;
      padding: 10px 12px;
      border: 1px solid #d32f2f;
      border-left-width: 4px;
      border-radius: 8px;
      background: color-mix(in srgb, #d32f2f 10%, transparent);
      font-size: .84rem;

      div {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      mat-icon {
        color: #d32f2f;
        flex-shrink: 0;
      }
    }

    .resumo {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 2px 16px;
      margin: 0;
      font-size: .85rem;

      dt {
        color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
      }

      dd {
        margin: 0;
        font-variant-numeric: tabular-nums;
      }
    }

    .falha {
      color: #d32f2f;
      font-weight: 600;
    }

    .dica {
      margin: 0;
      font-size: .8rem;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
    }

    .caminhos {
      max-height: 260px;
      margin: 0;
      padding: 8px 8px 8px 24px;
      overflow: auto;
      border: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, .12));
      border-radius: 8px;
    }

    code {
      font-size: .76rem;
      overflow-wrap: anywhere;
    }

    .perigo-contorno {
      --mdc-outlined-button-label-text-color: #d32f2f;
      --mdc-outlined-button-outline-color: #d32f2f;
    }

    .ajuste {
      display: flex;
      gap: 10px;
      padding: 10px 12px;
      border: 1px solid #2e7d32;
      border-left-width: 4px;
      border-radius: 8px;
      background: color-mix(in srgb, #2e7d32 8%, transparent);
      font-size: .84rem;

      div {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }

      mat-icon {
        color: #2e7d32;
        flex-shrink: 0;
      }
    }

    .caminhos--ajuste {
      max-height: 200px;
      background: var(--mat-sys-surface, rgba(255, 255, 255, .5));
    }

    .caminhos--ajuste li {
      display: flex;
      flex-direction: column;
      padding: 2px 0;
    }

    .ok {
      color: #2e7d32;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InclusoesDialogComponent {
  readonly data = inject<InclusoesDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<InclusoesDialogComponent, AcaoInclusoes>>(MatDialogRef);

  readonly resultado = this.data.resultado;
  readonly jar = nomeDoJar(this.data.artefato.conteudoJar?.jarPadrao);
  /** Os que não existem no JAR e também não estão em caminho trocado: arquivos novos de verdade. */
  readonly novos = this.resultado.caminhosIncluidos.filter(c => !this.resultado.correcoes.some(correcao => correcao.de === c));
  /** Não listados pelo servidor (a lista vem limitada). */
  readonly restantes = Math.max(0, this.resultado.incluidas - this.resultado.correcoes.length - this.novos.length);

  fechar(acao: AcaoInclusoes) {
    this.dialogRef.close(acao);
  }
}
