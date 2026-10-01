import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { finalize } from 'rxjs';

import { Alvo, Ambiente, Arquivo, Artefato, AtualizacaoDetalhe, ResultadoAplicacao, hashCurto } from '../atualizacao.models';
import { AtualizacaoService, salvarDownload } from '../atualizacao.service';
import { ArquivoUploadComponent } from './arquivo-upload';

export interface AplicacaoDialogData {
  detalhe: AtualizacaoDetalhe;
  artefato: Artefato;
  alvo: Alvo;
  ambiente: Ambiente;
}

/**
 * Assistente de aplicação em modo manual (T-03): o técnico aplica fora do sistema seguindo o checklist
 * e registra o resultado. Nada é executado no servidor.
 */
@Component({
  selector: 'app-atualizacao-aplicacao-dialog',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    ArquivoUploadComponent,
  ],
  template: `
    <h2 mat-dialog-title>Aplicação em {{ data.ambiente === 'PRODUCAO' ? 'produção' : 'homologação' }} · modo manual</h2>
    <form #form="ngForm" (ngSubmit)="salvar()">
      <mat-dialog-content class="conteudo">
        <ol class="checklist">
          <li>
            <span class="passo">Conferência</span>
            <span>{{ data.artefato.nome }} <strong>v{{ versao?.numero }}</strong> · SHA-256 <code>{{ hash(versao?.arquivo?.sha256) }}…</code></span>
            @if (pendentes.length > 1) {
              <!-- Cluster (D-07): um registro para os nós marcados, na ordem; o que ficar de fora continua pendente -->
              <span>Nós em que a aplicação foi feita, na ordem:</span>
              <div class="nos">
                @for (n of pendentes; track n.chave) {
                  <mat-checkbox [name]="'no-' + n.chave" [(ngModel)]="marcado[n.chave]">{{ n.ordem }}. {{ n.alvo }}</mat-checkbox>
                }
              </div>
              @if (algumDesmarcado()) {
                <span class="alerta">
                  Os nós desmarcados continuam pendentes{{ data.ambiente === 'PRODUCAO' ? ' e a atualização fica Parcial até serem aplicados' : '' }}.
                </span>
              }
            } @else {
              <span>Destino: {{ data.alvo.alvo }}</span>
            }
            @if (jar; as j) {
              <span [class.ok]="j.baseAtual" [class.falha]="!j.baseAtual">
                JAR gerado em {{ j.data | date: 'dd/MM/yyyy HH:mm' }}: {{ j.substituidas }} substituído(s), {{ j.incluidas }} incluído(s),
                {{ j.iguais }} igual(is){{ j.baseAtual ? '' : ' — o backup mudou, gere o JAR de novo' }}
              </span>
              <button mat-button type="button" class="baixar" (click)="baixar(j.arquivo)">
                <mat-icon>file_download</mat-icon> Baixar {{ j.arquivo.nome }} (gerado)
              </button>
            } @else if (versao && !montaJar) {
              <button mat-button type="button" class="baixar" (click)="baixar(versao.arquivo)">
                <mat-icon>file_download</mat-icon> Baixar {{ versao.arquivo.nome }}
              </button>
            }
          </li>
          <li>
            <span class="passo">Backup</span>
            @if (data.ambiente === 'HOMOLOGACAO') {
              @if (data.alvo.backup; as b) {
                <span class="ok">Feito em {{ b.data | date: 'dd/MM/yyyy HH:mm' }} por {{ b.nomeUsuario }}: {{ b.semArquivo ? 'sem arquivo anterior' : b.arquivo?.nome }}</span>
              }
            } @else {
              @if (data.alvo.backupRenovado; as r) {
                <span class="ok">Renovado na janela em {{ r.data | date: 'dd/MM/yyyy HH:mm' }}: {{ r.semArquivo ? 'sem arquivo anterior' : r.arquivo?.nome }}</span>
              } @else if (data.alvo.backup; as b) {
                <span>Backup da validação de {{ b.data | date: 'dd/MM/yyyy HH:mm' }}: {{ b.semArquivo ? 'sem arquivo anterior' : b.arquivo?.nome + ' · ' + hash(b.arquivo?.sha256) + '…' }}</span>
                <mat-checkbox name="conferido" [(ngModel)]="backupConferido" required>
                  Conferi que o que está em produção é igual a esse backup (R-15)
                </mat-checkbox>
                <span class="dica">Se mudou, feche e registre um backup renovado antes de aplicar.</span>
              }
            }
          </li>
          <li>
            <span class="passo">Aplicação</span>
            @if (montaJar) {
              <span>Substitua <code>{{ jar?.arquivo?.nome ?? conteudoJar?.jarPadrao }}</code> em <code>{{ data.alvo.diretorio || 'o diretório da aplicação' }}</code> pelo JAR gerado</span>
            } @else if (data.artefato.metodo === 'ARQUIVO') {
              <span>Copie o arquivo para <code>{{ data.alvo.diretorio || 'o diretório da aplicação' }}</code></span>
            } @else {
              <span>Execute o script no banco <code>{{ data.alvo.alvo }}</code>, parando no primeiro erro</span>
            }
            @if (data.alvo.passoManual) {
              <span class="alerta">Antes do reinício: {{ data.alvo.passoManual }}</span>
            }
            @if (data.alvo.exigeReinicio) {
              <span>Reinicie: <code>{{ data.alvo.comandoReinicio || 'serviço da aplicação' }}</code></span>
            }
            @if (data.alvo.urlMonitoramento) {
              <span>Verifique: <code>{{ data.alvo.urlMonitoramento }}</code></span>
            }
          </li>
          <li>
            <span class="passo">Resultado</span>
            <mat-button-toggle-group name="resultado" [(ngModel)]="resultado" required hideSingleSelectionIndicator>
              <mat-button-toggle value="SUCESSO">Deu certo</mat-button-toggle>
              <mat-button-toggle value="FALHA">Falhou</mat-button-toggle>
            </mat-button-toggle-group>
          </li>
        </ol>

        @if (jar?.assinado) {
          <mat-checkbox name="assinatura" [(ngModel)]="cienteAssinatura" required class="alerta">
            O JAR original era assinado e a assinatura ficou inválida. Estou ciente e a aplicação aceitou o JAR.
          </mat-checkbox>
        }

        @if (!montaJar) {
          <mat-form-field appearance="outline">
            <mat-label>Justificativa (se o sistema pedir)</mat-label>
            <textarea matInput name="justificativa" [(ngModel)]="justificativa" rows="2" maxlength="2000"></textarea>
            <mat-hint>Exigida quando outra atualização alterou o mesmo arquivo depois do seu backup</mat-hint>
          </mat-form-field>
        }

        <mat-form-field appearance="outline">
          <mat-label>{{ resultado === 'FALHA' ? 'O que falhou (obrigatório)' : 'Log ou observação' }}</mat-label>
          <textarea matInput name="log" [(ngModel)]="log" rows="4" [required]="resultado === 'FALHA'"></textarea>
          <mat-hint>Cole a saída do comando, o que foi verificado depois do reinício etc.</mat-hint>
        </mat-form-field>

        <app-arquivo-upload
          [codAtualizacao]="data.detalhe.codAtualizacao"
          rotulo="Evidência (opcional)"
          dica="Print da tela, log do servidor"
          (enviado)="evidencia.set($event)" />
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="form.invalid || salvando() || !resultado || (montaJar && !jar?.baseAtual) || !marcados().length">
          Registrar aplicação
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .conteudo {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: min(640px, 86vw);
      padding-top: 8px !important;
    }

    .checklist {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 0;
      padding-left: 20px;
    }

    .checklist li {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: .85rem;
    }

    .passo {
      font-weight: 600;
    }

    .baixar {
      align-self: flex-start;
    }

    .nos {
      display: flex;
      flex-wrap: wrap;
      column-gap: 16px;
    }

    .ok {
      color: #2e7d32;
    }

    .falha {
      color: #d32f2f;
    }

    .alerta {
      color: #b26a00;
    }

    .dica {
      font-size: .75rem;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
    }

    code {
      font-size: .78rem;
      overflow-wrap: anywhere;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AplicacaoDialogComponent {
  readonly data = inject<AplicacaoDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<AplicacaoDialogComponent, AtualizacaoDetalhe>>(MatDialogRef);
  private readonly service = inject(AtualizacaoService);

  readonly versao = this.data.artefato.versaoVigente;
  readonly conteudoJar = this.data.artefato.conteudoJar;
  /** Falso quando a versão é o JAR pronto: aí aplica-se o próprio arquivo, sem montagem. */
  readonly montaJar = this.data.artefato.montaJar;
  readonly jar = this.data.alvo.jarGerado;
  readonly hash = hashCurto;
  readonly salvando = signal(false);
  readonly evidencia = signal<Arquivo | null>(null);

  /** Nós do cluster que ainda não receberam a versão com sucesso, na ordem; todos vêm marcados. */
  readonly pendentes = (this.data.ambiente === 'HOMOLOGACAO' ? this.data.artefato.homologacao : this.data.artefato.producao).filter(
    a => a.ultimaAplicacao?.resultado !== 'SUCESSO'
  );
  readonly marcado: Record<string, boolean> = Object.fromEntries(this.pendentes.map(a => [a.chave, true]));

  marcados() {
    return this.pendentes.length ? this.pendentes.filter(a => this.marcado[a.chave]) : [this.data.alvo];
  }

  algumDesmarcado() {
    return this.pendentes.some(a => !this.marcado[a.chave]);
  }

  resultado: ResultadoAplicacao | null = null;
  log = '';
  justificativa = '';
  backupConferido = false;
  cienteAssinatura = false;

  baixar(arquivo: Arquivo) {
    this.service.baixar(arquivo.codArquivo).subscribe({ next: resposta => salvarDownload(resposta, arquivo.nome), error: () => {} });
  }

  salvar() {
    this.salvando.set(true);
    this.service
      .registrarAplicacao(this.data.detalhe.codAtualizacao, {
        codArtefato: this.data.artefato.codArtefato,
        ambiente: this.data.ambiente,
        chaveAlvo: this.marcados()[0].chave,
        chavesAlvos: this.marcados().map(a => a.chave),
        resultado: this.resultado!,
        log: this.log.trim() || null,
        codArquivoEvidencia: this.evidencia()?.codArquivo ?? null,
        backupConferido: this.backupConferido,
        justificativa: this.justificativa.trim() || null,
        cienteAssinatura: this.cienteAssinatura,
      })
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({ next: detalhe => this.dialogRef.close(detalhe), error: () => {} });
  }
}
