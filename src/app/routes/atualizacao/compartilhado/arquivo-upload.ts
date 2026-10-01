import { HttpEventType } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { finalize } from 'rxjs';

import { Arquivo, hashCurto, tamanhoLegivel } from '../atualizacao.models';
import { AtualizacaoService } from '../atualizacao.service';

/**
 * Envia o arquivo ao repositório da atualização assim que é escolhido (com progresso) e devolve o
 * registro com SHA-256. O comando que usa o arquivo (artefato, backup, evidência) só recebe o código.
 */
@Component({
  selector: 'app-arquivo-upload',
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule],
  template: `
    <div class="upload" [class.upload--ok]="arquivo()">
      <input #entrada type="file" hidden [attr.accept]="accept()" (change)="escolher(entrada)" />
      <div class="upload__cabecalho">
        <span class="upload__rotulo">{{ rotulo() }}@if (obrigatorio()) {<span aria-hidden="true"> *</span>}</span>
        @if (dica()) {
          <span class="upload__dica">{{ dica() }}</span>
        }
      </div>
      @if (enviando()) {
        <div class="upload__progresso">
          <span class="upload__meta">Enviando {{ nomeEmEnvio() }} · {{ progresso() }}%</span>
          <mat-progress-bar mode="determinate" [value]="progresso()" />
        </div>
      } @else if (arquivo(); as a) {
        <div class="upload__arquivo">
          <mat-icon class="upload__icone">insert_drive_file</mat-icon>
          <div class="upload__info">
            <span class="upload__nome">{{ a.nome }}</span>
            <span class="upload__meta">{{ tamanho(a.tamanho) }} · SHA-256 <code>{{ hash(a.sha256) }}…</code></span>
          </div>
          <button mat-button type="button" [disabled]="desabilitado()" (click)="entrada.click()">Trocar</button>
        </div>
      } @else {
        <button mat-stroked-button type="button" [disabled]="desabilitado()" (click)="entrada.click()">
          <mat-icon>file_upload</mat-icon>
          Escolher arquivo
        </button>
      }
    </div>
  `,
  styles: `
    .upload {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px 12px;
      border: 1px dashed var(--mat-sys-outline-variant, rgba(0, 0, 0, .24));
      border-radius: 8px;
    }

    .upload--ok {
      border-style: solid;
    }

    .upload__cabecalho,
    .upload__info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .upload__rotulo {
      font-size: .8rem;
      font-weight: 500;
    }

    .upload__dica,
    .upload__meta {
      font-size: .75rem;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
    }

    .upload__arquivo {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .upload__icone {
      color: #2e7d32;
      flex-shrink: 0;
    }

    .upload__info {
      flex: 1;
    }

    .upload__nome {
      overflow-wrap: anywhere;
    }

    .upload__progresso {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    code {
      font-size: .72rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArquivoUploadComponent {
  private readonly service = inject(AtualizacaoService);

  readonly codAtualizacao = input.required<number>();
  readonly rotulo = input('Arquivo');
  readonly dica = input<string | null>(null);
  readonly accept = input<string | null>(null);
  readonly obrigatorio = input(false);
  readonly desabilitado = input(false);

  /** Registro do arquivo enviado, ou null enquanto não há arquivo válido. */
  readonly enviado = output<Arquivo | null>();
  /** Arquivo escolhido, antes do envio (ex.: sugerir o tipo pela extensão). */
  readonly escolhido = output<File>();

  readonly arquivo = signal<Arquivo | null>(null);
  readonly enviando = signal(false);
  readonly progresso = signal(0);
  readonly nomeEmEnvio = signal('');

  readonly tamanho = tamanhoLegivel;
  readonly hash = hashCurto;

  escolher(entrada: HTMLInputElement) {
    const arquivo = entrada.files?.[0];
    entrada.value = '';
    if (!arquivo) {
      return;
    }
    this.escolhido.emit(arquivo);
    this.arquivo.set(null);
    this.enviado.emit(null);
    this.enviando.set(true);
    this.progresso.set(0);
    this.nomeEmEnvio.set(arquivo.name);
    this.service
      .enviarArquivo(this.codAtualizacao(), arquivo)
      .pipe(finalize(() => this.enviando.set(false)))
      .subscribe({
        next: evento => {
          if (evento.type === HttpEventType.UploadProgress && evento.total) {
            this.progresso.set(Math.round((100 * evento.loaded) / evento.total));
          } else if (evento.type === HttpEventType.Response && evento.body) {
            this.arquivo.set(evento.body);
            this.enviado.emit(evento.body);
          }
        },
        // O errorInterceptor mostra a mensagem do backend (limite de tamanho, atualização encerrada...).
        error: () => {},
      });
  }
}
