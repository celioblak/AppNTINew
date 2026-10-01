import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

/** Uma pasta do pacote sem mapeamento de JAR, com os arquivos dela. */
export interface PastaForaDoMapeamento {
  pasta: string;
  arquivos: string[];
}

export interface ForaMapeamentoDialogData {
  pastas: PastaForaDoMapeamento[];
  /** Quantos artefatos vão ser incluídos mesmo assim (0 = nada do pacote entra). */
  artefatos: number;
}

/**
 * Antes de incluir: o pacote tem arquivos sem mapeamento de JAR (ex.: pasta dbservices ainda não cadastrada). Mostra
 * o que fica de fora e pergunta se cancela (para cadastrar o mapeamento) ou continua sem eles. true = continuar.
 */
@Component({
  selector: 'app-atualizacao-fora-mapeamento-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title class="titulo"><mat-icon>warning</mat-icon> Arquivos do pacote vão ficar de fora</h2>
    <mat-dialog-content class="conteudo">
      <p>
        <strong>{{ totalArquivos }} arquivo(s) em {{ data.pastas.length }} pasta(s)</strong> não têm mapeamento de JAR e
        <strong>não entram</strong> nesta atualização. Normalmente é uma pasta nova do fabricante ainda não cadastrada.
      </p>
      <div class="pastas">
        @for (p of data.pastas; track p.pasta) {
          <details>
            <summary>
              <mat-icon>folder</mat-icon> <code>{{ p.pasta }}</code> <span class="suave">· {{ p.arquivos.length }} arquivo(s)</span>
            </summary>
            <ul>
              @for (a of p.arquivos.slice(0, 50); track a) {
                <li><code>{{ a }}</code></li>
              }
              @if (p.arquivos.length > 50) {
                <li class="suave">… e mais {{ p.arquivos.length - 50 }}.</li>
              }
            </ul>
          </details>
        }
      </div>
      <p class="suave">
        <strong>Cancelar:</strong> volta para a inclusão, sem incluir nada; cadastre o mapeamento em Configuração › Mapeamentos de JAR e
        analise o pacote de novo.<br />
        <strong>Continuar sem eles:</strong> inclui {{ data.artefatos }} artefato(s) e registra na linha do tempo quais pastas ficaram de
        fora.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button type="button" [mat-dialog-close]="false">Cancelar</button>
      <button mat-stroked-button type="button" class="perigo-contorno" [mat-dialog-close]="true">Continuar sem eles</button>
    </mat-dialog-actions>
  `,
  styles: `
    .titulo {
      display: flex;
      align-items: center;
      gap: 8px;

      mat-icon {
        color: #ed6c02;
      }
    }

    .conteudo {
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: min(720px, 90vw);
      font-size: .9rem;

      p {
        margin: 0;
      }
    }

    .pastas {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 45vh;
      padding: 8px 10px;
      overflow: auto;
      border: 1px solid #ed6c02;
      border-radius: 8px;
      background: color-mix(in srgb, #ed6c02 6%, transparent);

      summary {
        display: flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        overflow-wrap: anywhere;

        mat-icon {
          flex-shrink: 0;
          width: 18px;
          height: 18px;
          font-size: 18px;
        }
      }

      ul {
        margin: 2px 0 6px;
        padding-left: 28px;
        font-size: .8rem;
        overflow-wrap: anywhere;
      }
    }

    code {
      font-size: .8rem;
    }

    .suave {
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
      font-size: .82rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForaMapeamentoDialogComponent {
  readonly data = inject<ForaMapeamentoDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject<MatDialogRef<ForaMapeamentoDialogComponent, boolean>>(MatDialogRef);
  readonly totalArquivos = this.data.pastas.reduce((soma, p) => soma + p.arquivos.length, 0);
}
