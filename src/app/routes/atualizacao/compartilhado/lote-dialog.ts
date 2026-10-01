import { HttpEvent, HttpEventType, HttpResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { filter, finalize, from, map, mergeMap, tap, toArray } from 'rxjs';

import { AMBIENTE_ROTULO, Ambiente, Arquivo, AtualizacaoDetalhe, LoteResultado } from '../atualizacao.models';
import { AtualizacaoService } from '../atualizacao.service';

export type ModoLote = 'backups' | 'jars';

export interface LoteDialogData {
  detalhe: AtualizacaoDetalhe;
  ambiente: Ambiente;
  modo: ModoLote;
}

const ENVIOS_SIMULTANEOS = 2;

function resposta(evento: HttpEvent<Arquivo>): evento is HttpResponse<Arquivo> {
  return evento.type === HttpEventType.Response;
}

/**
 * Operações em lote de um ambiente: enviar vários JARs de backup de uma vez (cada um vai para o artefato cujo
 * nome de JAR combina) ou montar o JAR de todos os destinos pendentes. Sempre mostra o que não deu e por quê.
 */
@Component({
  selector: 'app-atualizacao-lote-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule, MatProgressBarModule],
  template: `
    <h2 mat-dialog-title>{{ titulo }} · {{ ambienteRotulo[data.ambiente].toLowerCase() }}</h2>
    <mat-dialog-content class="conteudo">
      @if (backups) {
        <p class="dica">
          Envie os JARs que estão hoje nos destinos. O sistema identifica cada um pelo nome, grava o backup em todos os destinos
          daquele artefato e avisa o que não conseguiu atribuir.
        </p>
        <input #entrada type="file" accept=".jar" multiple hidden (change)="enviar(entrada)" />
        <button mat-stroked-button type="button" [disabled]="ocupado()" (click)="entrada.click()">
          <mat-icon>file_upload</mat-icon>
          Escolher os JARs de backup
        </button>
      } @else {
        <p class="dica">
          Monta o JAR de cada destino que já tem backup e ainda não foi aplicado, a partir do JAR atual daquele destino.
        </p>
      }

      @if (ocupado()) {
        <div class="progresso">
          <span class="dica">{{ etapa() }}</span>
          <mat-progress-bar [mode]="progresso() === null ? 'indeterminate' : 'determinate'" [value]="progresso() ?? 0" />
        </div>
      }

      @if (resultado(); as r) {
        @if (r.aplicados.length) {
          <section class="bloco bloco--ok">
            <h3>{{ backups ? 'Backups registrados' : 'JARs gerados' }} ({{ r.aplicados.length }})</h3>
            <ul>
              @for (i of r.aplicados; track $index) {
                <li>
                  <strong>{{ i.artefato }}</strong>
                  @if (i.arquivo) {
                    · <code>{{ i.arquivo }}</code>
                  }
                  <span class="dica">{{ i.mensagem }}</span>
                  @if (i.destinos.length) {
                    <span class="dica">{{ i.destinos.join(', ') }}</span>
                  }
                </li>
              }
            </ul>
          </section>
        }

        @if (r.ignorados.length) {
          <section class="bloco bloco--alerta">
            <h3>Não entraram ({{ r.ignorados.length }})</h3>
            @if (!backups && r.divergentes) {
              <div class="divergentes">
                <span>
                  <strong>{{ r.divergentes }} artefato(s) com arquivos no JAR em outro caminho.</strong>
                  O ajuste grava na versão o caminho em que cada arquivo realmente está no JAR (vale para todos os destinos) e
                  gera de novo.
                </span>
                <button mat-flat-button type="button" [disabled]="ocupado()" (click)="gerarJars(true)">
                  <mat-icon>build</mat-icon> Ajustar caminhos divergentes e gerar todos
                </button>
              </div>
            }
            <ul>
              @for (i of r.ignorados; track $index) {
                <li>
                  @if (i.arquivo) {
                    <code>{{ i.arquivo }}</code>
                  }
                  @if (i.artefato) {
                    <strong>{{ i.artefato }}</strong>
                  }
                  <span>{{ i.mensagem }}</span>
                  @if (i.destinos.length) {
                    <span class="dica">{{ i.destinos.join(', ') }}</span>
                  }
                </li>
              }
            </ul>
          </section>
        }

        @if (r.pendentes.length) {
          <section class="bloco bloco--pendente">
            <h3>Ainda falta ({{ r.pendentes.length }})</h3>
            <ul>
              @for (p of r.pendentes; track $index) {
                <li>{{ p }}</li>
              }
            </ul>
          </section>
        }

        @if (!r.aplicados.length && !r.ignorados.length && !r.pendentes.length) {
          <p class="dica">Nada a fazer: todos os destinos deste ambiente já estão resolvidos.</p>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button type="button" [disabled]="ocupado()" (click)="fechar()">Fechar</button>
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

    .dica {
      margin: 0;
      font-size: .8rem;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
    }

    .progresso {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    button[mat-stroked-button] {
      align-self: flex-start;
    }

    .bloco {
      --cor: #2e7d32;
      padding: 8px 12px;
      border-left: 3px solid var(--cor);
      border-radius: 8px;
      background: color-mix(in srgb, var(--cor) 8%, transparent);
      font-size: .84rem;
    }

    /* Ajuste em massa dos caminhos divergentes, no topo de "Não entraram". */
    .divergentes {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      margin-bottom: 8px;
      font-size: .84rem;

      span {
        flex: 1 1 320px;
      }
    }

    .bloco--alerta {
      --cor: #d32f2f;
    }

    .bloco--pendente {
      --cor: #e08a00;
    }

    h3 {
      margin: 0 0 4px;
      font-size: .85rem;
      font-weight: 600;
    }

    ul {
      margin: 0;
      padding-left: 18px;
    }

    li {
      display: flex;
      flex-direction: column;
      gap: 1px;
      padding: 2px 0;
      overflow-wrap: anywhere;
    }

    code {
      font-size: .76rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoteDialogComponent {
  readonly data = inject<LoteDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<LoteDialogComponent, AtualizacaoDetalhe>>(MatDialogRef);
  private readonly service = inject(AtualizacaoService);

  readonly ambienteRotulo = AMBIENTE_ROTULO;
  readonly backups = this.data.modo === 'backups';
  readonly titulo = this.backups ? 'Backups em lote' : 'Gerar o JAR de todos os destinos';

  readonly resultado = signal<LoteResultado | null>(null);
  readonly ocupado = signal(false);
  readonly etapa = signal('');
  readonly progresso = signal<number | null>(null);
  readonly detalhe = computed(() => this.resultado()?.detalhe ?? null);

  constructor() {
    if (!this.backups) {
      this.gerarJars();
    }
  }

  enviar(entrada: HTMLInputElement) {
    const arquivos = Array.from(entrada.files ?? []);
    entrada.value = '';
    if (!arquivos.length) {
      return;
    }
    let enviados = 0;
    this.ocupado.set(true);
    this.etapa.set(`Enviando 0 de ${arquivos.length}`);
    this.progresso.set(0);
    from(arquivos)
      .pipe(
        mergeMap(
          arquivo =>
            this.service.enviarArquivo(this.data.detalhe.codAtualizacao, arquivo).pipe(
              filter(resposta),
              map(r => r.body!),
              tap(() => {
                enviados++;
                this.etapa.set(`Enviando ${enviados} de ${arquivos.length}`);
                this.progresso.set(Math.round((100 * enviados) / arquivos.length));
              })
            ),
          ENVIOS_SIMULTANEOS
        ),
        toArray(),
        tap(() => {
          this.etapa.set('Identificando os destinos…');
          this.progresso.set(null);
        }),
        mergeMap(lista =>
          this.service.registrarBackupsEmLote(
            this.data.detalhe.codAtualizacao,
            this.data.ambiente,
            lista.map(a => a.codArquivo)
          )
        ),
        finalize(() => this.ocupado.set(false))
      )
      .subscribe({ next: r => this.resultado.set(r), error: () => {} });
  }

  gerarJars(corrigirCaminhos = false) {
    this.ocupado.set(true);
    this.etapa.set(corrigirCaminhos ? 'Ajustando os caminhos e montando os JARs…' : 'Montando os JARs…');
    this.progresso.set(null);
    this.service
      .gerarJars(this.data.detalhe.codAtualizacao, this.data.ambiente, corrigirCaminhos)
      .pipe(finalize(() => this.ocupado.set(false)))
      .subscribe({ next: r => this.resultado.set(r), error: () => this.dialogRef.close(undefined) });
  }

  fechar() {
    this.dialogRef.close(this.detalhe() ?? undefined);
  }
}
