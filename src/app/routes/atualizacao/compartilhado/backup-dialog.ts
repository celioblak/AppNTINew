import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';

import { AMBIENTE_ROTULO, Alvo, Ambiente, Arquivo, Artefato, AtualizacaoDetalhe, jarCombina } from '../atualizacao.models';
import { AtualizacaoService } from '../atualizacao.service';
import { ArquivoUploadComponent } from './arquivo-upload';

export interface BackupDialogData {
  detalhe: AtualizacaoDetalhe;
  artefato: Artefato;
  alvo: Alvo;
  ambiente: Ambiente;
}

/** Backup enviado pelo técnico (modo manual): antes da homologação, na validação ou renovado na janela. */
@Component({
  selector: 'app-atualizacao-backup-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    MatSelectModule,
    ArquivoUploadComponent,
  ],
  template: `
    <h2 mat-dialog-title>{{ momento.titulo }}</h2>
    <form #form="ngForm" (ngSubmit)="salvar()">
      <mat-dialog-content class="conteudo">
        <dl class="contexto">
          <dt>Artefato</dt>
          <dd>{{ data.artefato.nome }} · v{{ data.artefato.versaoVigente?.numero }}</dd>
          <dt>{{ nos.length > 1 ? 'Nós (cluster)' : 'Destino' }}</dt>
          <dd>{{ listaDestinos }}</dd>
          @if (data.alvo.diretorio) {
            <dt>Diretório</dt>
            <dd><code>{{ data.alvo.diretorio }}</code></dd>
          }
          @if (conteudoJar) {
            <dt>JAR</dt>
            <dd><code>{{ conteudoJar.jarPadrao }}</code></dd>
          }
        </dl>
        <p class="explicacao">{{ momento.explicacao }}</p>

        @if (conteudoJar) {
          <p class="explicacao destaque">
            O conteúdo vai para dentro do JAR que está hoje no destino: envie esse JAR ({{ conteudoJar.jarPadrao }}). O sistema monta o
            JAR novo a partir dele.
          </p>
        } @else {
          <mat-radio-group name="modo" [(ngModel)]="semArquivo" class="opcoes">
            <mat-radio-button [value]="false">{{ rotuloComArquivo }}</mat-radio-button>
            <mat-radio-button [value]="true">{{ rotuloSemArquivo }}</mat-radio-button>
          </mat-radio-group>
        }

        @if (!semArquivo) {
          <app-arquivo-upload
            [codAtualizacao]="data.detalhe.codAtualizacao"
            [rotulo]="conteudoJar ? 'JAR atual do destino' : 'Arquivo de backup'"
            [dica]="dicaArquivo"
            [accept]="conteudoJar ? '.jar' : null"
            [obrigatorio]="true"
            (enviado)="arquivo.set($event)" />
          @if (nomeForaDoPadrao()) {
            <p class="erro">
              {{ arquivo()?.nome }} não é o JAR deste artefato: o esperado é <code>{{ conteudoJar?.jarPadrao }}</code>
              (&lt;versao&gt; = a versão que está no destino). Envie o JAR que está hoje em {{ data.alvo.alvo }}.
            </p>
          }
        }

        <!-- Cluster (revisão 9): um backup vale para todos os nós; só registra de qual nó foi tirado (D-11) -->
        @if (nos.length > 1) {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Nó de onde o arquivo foi copiado</mat-label>
            <mat-select name="origem" [(ngModel)]="origem">
              @for (n of nos; track n.chave) {
                <mat-option [value]="n.chave">{{ n.alvo }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <span class="explicacao">
            O mesmo sistema e versão rodam em todos os nós: este backup vale para os {{ nos.length }} nós de
            {{ ambienteRotulo[data.ambiente].toLowerCase() }}.
          </span>
        }

        <mat-form-field appearance="outline">
          <mat-label>{{ semArquivo ? 'Por que não há backup' : 'Observação (opcional)' }}</mat-label>
          <textarea matInput name="observacao" [(ngModel)]="observacao" rows="2" maxlength="2000" [required]="semArquivo"></textarea>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="form.invalid || salvando() || (!semArquivo && !arquivo()) || nomeForaDoPadrao()">
          Registrar backup
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .conteudo {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: min(560px, 86vw);
      padding-top: 8px !important;
    }

    .contexto {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 2px 12px;
      margin: 0;
      font-size: .85rem;
    }

    dt {
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
    }

    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }

    .explicacao {
      margin: 0;
      font-size: .8rem;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
    }

    .destaque {
      padding: 8px 12px;
      border-radius: 8px;
      background: color-mix(in srgb, #1976d2 10%, transparent);
      color: inherit;
    }

    .opcoes {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .erro {
      margin: 0;
      padding: 8px 12px;
      border-radius: 8px;
      background: color-mix(in srgb, #d32f2f 12%, transparent);
      font-size: .8rem;
      overflow-wrap: anywhere;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackupDialogComponent {
  readonly data = inject<BackupDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<BackupDialogComponent, AtualizacaoDetalhe>>(MatDialogRef);
  private readonly service = inject(AtualizacaoService);

  readonly conteudoJar = this.data.artefato.conteudoJar;
  readonly ambienteRotulo = AMBIENTE_ROTULO;
  readonly salvando = signal(false);
  readonly arquivo = signal<Arquivo | null>(null);
  semArquivo = false;
  observacao = '';

  /** Os nós do cluster no ambiente, na ordem: o backup vale para todos. */
  readonly nos = this.data.ambiente === 'HOMOLOGACAO' ? this.data.artefato.homologacao : this.data.artefato.producao;
  readonly listaDestinos = this.nos.map(a => a.alvo).join(', ');
  /** Nó de onde o arquivo foi copiado (D-11): sugestão = o recebido (primeiro da ordem). */
  origem = this.data.alvo.chave;

  /** O backup de conteúdo precisa ser o JAR do mapeamento; avisa antes de enviar ao backend. */
  nomeForaDoPadrao() {
    const enviado = this.arquivo();
    return !!this.conteudoJar && !this.semArquivo && !!enviado && !jarCombina(enviado.nome, this.conteudoJar.jarPadrao);
  }

  readonly momento = this.descreverMomento();
  readonly rotuloComArquivo =
    this.data.artefato.metodo === 'ARQUIVO'
      ? 'Enviar o arquivo que está hoje no destino'
      : this.data.artefato.metodo === 'DDL_ORACLE'
        ? 'Enviar a DDL atual do objeto'
        : 'Enviar a exportação das linhas afetadas';
  readonly rotuloSemArquivo =
    this.data.artefato.metodo === 'SCRIPT_RETORNO'
      ? 'Sem backup: o retorno é pelo script de retorno'
      : 'O destino não tem este arquivo/objeto (artefato novo)';
  readonly dicaArquivo = this.conteudoJar
    ? `Copie ${this.conteudoJar.jarPadrao} de ${this.data.alvo.diretorio ?? 'o diretório da aplicação'}`
    : this.data.artefato.metodo === 'DDL_ORACLE'
      ? 'Gere pelo PL/SQL Developer ou DBMS_METADATA.GET_DDL no banco ' + this.data.alvo.alvo
      : 'Copie do destino antes de colocar o arquivo novo';

  private descreverMomento() {
    if (this.data.ambiente === 'HOMOLOGACAO') {
      return {
        titulo: 'Backup antes da homologação',
        explicacao: 'Faça a cópia antes de aplicar o artefato novo. A aplicação em homologação só é liberada com o backup registrado (R-02).',
      };
    }
    if (this.data.detalhe.situacao === 'VALIDADA') {
      return {
        titulo: 'Backup de produção na validação',
        explicacao: 'Copie o estado atual de produção. É esse backup que o retorno em produção vai usar (R-15).',
      };
    }
    return {
      titulo: 'Backup de produção renovado na janela',
      explicacao:
        this.data.detalhe.emergencial && !this.data.detalhe.homologada
          ? 'Emergencial: o backup de produção é feito agora, antes de aplicar.'
          : 'Use quando a produção mudou desde o backup da validação. A divergência fica registrada (R-15).',
    };
  }

  salvar() {
    this.salvando.set(true);
    this.service
      .registrarBackup(this.data.detalhe.codAtualizacao, {
        codArtefato: this.data.artefato.codArtefato,
        ambiente: this.data.ambiente,
        chaveAlvo: this.origem,
        codArquivo: this.semArquivo ? null : (this.arquivo()?.codArquivo ?? null),
        semArquivo: this.semArquivo,
        observacao: this.observacao.trim() || null,
        todosDestinos: true,
      })
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({ next: detalhe => this.dialogRef.close(detalhe), error: () => {} });
  }
}
