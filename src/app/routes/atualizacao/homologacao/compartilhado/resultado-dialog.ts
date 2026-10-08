import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';

import { ArquivoHom, HomologacaoDetalhe, ItemHom, RESULTADO_INFO, Resultado, Trilha } from '../homologacao.models';
import { HomologacaoService } from '../homologacao.service';

export interface ResultadoDialogData {
  homologacao: HomologacaoDetalhe;
  item: ItemHom;
  trilha: Trilha;
}

const OPCOES: Resultado[] = ['APROVADO', 'REPROVADO', 'BLOQUEADO', 'NAO_SE_APLICA'];

/**
 * Registrar resultado (T-03). Vale o último registro; o anterior fica no histórico. Reprovar exige descrição e
 * evidência (R-06, R-20); o ticket do fabricante é opcional, com alerta.
 */
@Component({
  selector: 'app-hom-resultado-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  template: `
    <h2 mat-dialog-title>
      Registrar resultado
      <span class="trilha" [class.trilha--geral]="data.trilha === 'GERAL'">
        {{ data.trilha === 'GERAL' ? 'Minha homologação geral' : 'Distribuição' }}
      </span>
    </h2>
    <mat-dialog-content class="conteudo">
      <section class="item">
        <h3>
          {{ data.item.titulo }}
          @if (data.item.critico) {
            <span class="critico" matTooltip="Item crítico: reprovado já vem marcado como impeditivo">crítico</span>
          }
        </h3>
        @if (data.item.passos) {
          <p class="rotulo">Como testar</p>
          <p class="texto">{{ data.item.passos }}</p>
        }
        @if (data.item.resultadoEsperado) {
          <p class="rotulo">Resultado esperado</p>
          <p class="texto">{{ data.item.resultadoEsperado }}</p>
        }
        @if (data.item.reprovouAnterior) {
          <p class="aviso">Este item reprovou (ou ficou bloqueado) na versão anterior: confira com atenção.</p>
        }
      </section>

      @if (anterior(); as a) {
        <!-- Só Bloqueado chega aqui com resultado: o já testado passa antes por "Retestar". -->
        <p class="aviso">Estava <strong>{{ info[a].rotulo }}</strong>: o novo registro passa a valer e o anterior fica no histórico.</p>
      }

      <div class="opcoes" role="radiogroup" aria-label="Resultado">
        @for (o of opcoes; track o) {
          <button
            type="button"
            class="opcao"
            role="radio"
            [attr.aria-checked]="resultado() === o"
            [attr.data-tom]="info[o].tom"
            [class.opcao--ativa]="resultado() === o"
            (click)="escolher(o)">
            <mat-icon>{{ info[o].icone }}</mat-icon>
            {{ info[o].rotulo }}
          </button>
        }
      </div>

      @if (resultado() === 'REPROVADO') {
        <mat-slide-toggle [ngModel]="impeditivo()" (ngModelChange)="impeditivo.set($event)">
          Impeditivo — a falha impede aprovar a versão
        </mat-slide-toggle>
      }

      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ rotuloObservacao() }}</mat-label>
        <textarea matInput rows="4" maxlength="4000" [ngModel]="observacao()" (ngModelChange)="observacao.set($event)"></textarea>
      </mat-form-field>

      @if (resultado() === 'REPROVADO' || resultado() === 'BLOQUEADO') {
        <div class="linha">
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="ticket">
            <mat-label>Ticket aberto ao fabricante</mat-label>
            <input matInput maxlength="100" [ngModel]="ticket()" (ngModelChange)="ticket.set($event)" />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="glpi">
            <mat-label>Chamado GLPI</mat-label>
            <input matInput type="number" [ngModel]="glpi()" (ngModelChange)="glpi.set($event)" />
          </mat-form-field>
        </div>
        @if (resultado() === 'REPROVADO' && !ticket()?.trim()) {
          <p class="alerta"><mat-icon inline>warning</mat-icon> Sem ticket no fabricante: dá para registrar e informar depois, mas o item fica sinalizado.</p>
        }
      }

      <section
        class="evidencias"
        [class.evidencias--arrastando]="arrastando()"
        (dragover)="$event.preventDefault(); arrastando.set(true)"
        (dragleave)="arrastando.set(false)"
        (drop)="soltar($event)">
        <div class="evidencias__topo">
          <span>
            Evidências
            @if (resultado() === 'REPROVADO') {
              <strong>(obrigatória)</strong>
            }
          </span>
          <span class="dica">Cole o print (Ctrl+V), arraste arquivos ou</span>
          <button mat-stroked-button type="button" (click)="seletor.click()"><mat-icon>attach_file</mat-icon> Escolher</button>
          <input #seletor type="file" multiple hidden (change)="escolherArquivos(seletor)" />
        </div>
        @if (enviando()) {
          <mat-progress-bar mode="indeterminate" />
        }
        @for (a of arquivos(); track a.codArquivo) {
          <div class="arquivo">
            <mat-icon>{{ a.contentType?.startsWith('image/') ? 'image' : 'description' }}</mat-icon>
            <span class="nome">{{ a.nome }}</span>
            <span class="suave">{{ tamanho(a.tamanho) }}</span>
            <button mat-icon-button type="button" aria-label="Tirar" (click)="tirar(a)"><mat-icon>close</mat-icon></button>
          </div>
        }
      </section>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <span class="falta">{{ falta() }}</span>
      <button mat-button type="button" mat-dialog-close>Voltar</button>
      <button mat-flat-button type="button" [disabled]="!!falta() || salvando() || enviando()" (click)="salvar()">Registrar</button>
    </mat-dialog-actions>
  `,
  styles: `
    .conteudo {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: min(640px, 90vw);
    }

    .trilha {
      margin-left: 8px;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: .72rem;
      font-weight: 500;
      vertical-align: middle;
      background: color-mix(in srgb, #1976d2 14%, transparent);

      &--geral {
        background: color-mix(in srgb, #7e57c2 18%, transparent);
      }
    }

    .item h3 {
      margin: 0 0 6px;
      font-size: 1rem;
    }

    .rotulo {
      margin: 6px 0 2px;
      font-size: .72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .03em;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
    }

    .texto {
      margin: 0;
      white-space: pre-wrap;
      font-size: .85rem;
    }

    .critico {
      margin-left: 6px;
      padding: 0 6px;
      border-radius: 4px;
      font-size: .7rem;
      color: #fff;
      background: #d32f2f;
    }

    .aviso,
    .alerta {
      margin: 0;
      padding: 6px 10px;
      border-radius: 8px;
      font-size: .8rem;
      background: color-mix(in srgb, #e08a00 14%, transparent);
    }

    .opcoes {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 8px;
    }

    .opcao {
      --tom: #78838a;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px;
      border: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, .15));
      border-radius: 10px;
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;

      mat-icon {
        color: var(--tom);
      }

      &[data-tom='sucesso'] { --tom: #2e7d32; }
      &[data-tom='critico'] { --tom: #d32f2f; }
      &[data-tom='alerta'] { --tom: #e08a00; }

      &--ativa {
        border-color: var(--tom);
        background: color-mix(in srgb, var(--tom) 14%, transparent);
        font-weight: 600;
      }
    }

    .linha {
      display: flex;
      gap: 8px;
    }

    .ticket {
      flex: 2;
    }

    .glpi {
      flex: 1;
    }

    .evidencias {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px;
      border: 1px dashed var(--mat-sys-outline-variant, rgba(0, 0, 0, .25));
      border-radius: 10px;

      &--arrastando {
        border-color: #1976d2;
        background: color-mix(in srgb, #1976d2 8%, transparent);
      }
    }

    .evidencias__topo {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      font-size: .85rem;
    }

    .dica,
    .suave {
      font-size: .78rem;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
    }

    .arquivo {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: .82rem;

      .nome {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .falta {
      flex: 1;
      font-size: .78rem;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultadoDialogComponent {
  readonly data = inject<ResultadoDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ResultadoDialogComponent, HomologacaoDetalhe>>(MatDialogRef);
  private readonly service = inject(HomologacaoService);

  readonly opcoes = OPCOES;
  readonly info = RESULTADO_INFO;

  readonly resultado = signal<Resultado | null>(null);
  readonly impeditivo = signal(this.data.item.critico);
  readonly observacao = signal('');
  readonly ticket = signal<string | null>(null);
  readonly glpi = signal<number | null>(null);
  readonly arquivos = signal<ArquivoHom[]>([]);
  readonly enviando = signal(false);
  readonly salvando = signal(false);
  readonly arrastando = signal(false);

  /** Resultado vigente na trilha (não conta o reteste, que é pendente). */
  readonly anterior = computed<Resultado | null>(() => {
    const r = this.data.trilha === 'GERAL' ? this.data.item.meuResultadoGeral : this.data.item.resultado;
    return r && r !== 'RETESTE' ? r : null;
  });

  readonly rotuloObservacao = computed(() => {
    switch (this.resultado()) {
      case 'REPROVADO':
        return 'O que aconteceu (o que fez, o que esperava, o que o sistema fez)';
      case 'BLOQUEADO':
        return 'O que impediu o teste';
      case 'NAO_SE_APLICA':
        return 'Por que não se aplica a esta versão';
      default:
        return 'Observação (opcional)';
    }
  });

  /** O que ainda falta para registrar, em texto (R-17). */
  readonly falta = computed(() => {
    const r = this.resultado();
    if (!r) return 'Escolha o resultado.';
    const obs = this.observacao().trim();
    if (r !== 'APROVADO' && !obs) return 'Preencha a observação.';
    if (r === 'REPROVADO' && !this.arquivos().length) return 'Anexe pelo menos uma evidência.';
    return '';
  });

  escolher(r: Resultado) {
    this.resultado.set(r);
    if (r === 'REPROVADO') {
      this.impeditivo.set(this.data.item.critico);
    }
  }

  @HostListener('document:paste', ['$event'])
  colar(evento: ClipboardEvent) {
    const arquivos = Array.from(evento.clipboardData?.files ?? []);
    if (!arquivos.length) return;
    evento.preventDefault();
    const agora = new Date();
    const carimbo = `${agora.getFullYear()}${String(agora.getMonth() + 1).padStart(2, '0')}${String(agora.getDate()).padStart(2, '0')}-${String(agora.getHours()).padStart(2, '0')}${String(agora.getMinutes()).padStart(2, '0')}${String(agora.getSeconds()).padStart(2, '0')}`;
    this.enviar(
      arquivos.map((f, i) =>
        f.type.startsWith('image/') && (!f.name || f.name === 'image.png')
          ? new File([f], `evidencia-${this.data.item.codItem}-${carimbo}${i ? '-' + i : ''}.png`, { type: f.type })
          : f
      )
    );
  }

  soltar(evento: DragEvent) {
    evento.preventDefault();
    this.arrastando.set(false);
    this.enviar(Array.from(evento.dataTransfer?.files ?? []));
  }

  escolherArquivos(seletor: HTMLInputElement) {
    this.enviar(Array.from(seletor.files ?? []));
    seletor.value = '';
  }

  private enviar(arquivos: File[]) {
    for (const arquivo of arquivos) {
      this.enviando.set(true);
      this.service
        .enviarEvidencia(this.data.homologacao.codHomologacao, arquivo)
        .pipe(finalize(() => this.enviando.set(false)))
        .subscribe({ next: a => this.arquivos.update(lista => [...lista, a]), error: () => {} });
    }
  }

  tirar(arquivo: ArquivoHom) {
    this.arquivos.update(lista => lista.filter(a => a.codArquivo !== arquivo.codArquivo));
  }

  tamanho(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  salvar() {
    const r = this.resultado();
    if (!r || this.falta()) return;
    this.salvando.set(true);
    const falha = r === 'REPROVADO' || r === 'BLOQUEADO';
    this.service
      .registrarResultado(this.data.item.codItem, {
        trilha: this.data.trilha,
        resultado: r,
        impeditivo: r === 'REPROVADO' ? this.impeditivo() : null,
        observacao: this.observacao().trim() || null,
        ticketFabricante: falha ? this.ticket()?.trim() || null : null,
        chamadoGlpi: falha ? this.glpi() || null : null,
        codArquivos: this.arquivos().map(a => a.codArquivo),
      })
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({ next: detalhe => this.dialogRef.close(detalhe), error: () => {} });
  }
}
