import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { finalize } from 'rxjs';

import {
  Arquivo,
  Artefato,
  AtualizacaoDetalhe,
  PacoteAnalise,
  SITUACAO_INFO,
  hashCurto,
  jarCombina,
  nomeDoJar,
} from '../atualizacao.models';
import { AtualizacaoService } from '../atualizacao.service';
import { ArquivoUploadComponent } from './arquivo-upload';
import { PacoteConteudoComponent } from './pacote-conteudo';

export interface VersaoDialogData {
  detalhe: AtualizacaoDetalhe;
  artefato: Artefato;
}

/** Enviar versão corrigida do mesmo artefato (R-12): arquivo inteiro ou novo conteúdo para o JAR. */
@Component({
  selector: 'app-atualizacao-versao-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    ArquivoUploadComponent,
    PacoteConteudoComponent,
  ],
  template: `
    <h2 mat-dialog-title>Versão corrigida · {{ data.artefato.nome }}</h2>
    <form #form="ngForm" (ngSubmit)="salvar()">
      <mat-dialog-content class="conteudo">
        @if (vigente; as v) {
          <div class="atual" [class.atual--erro]="v.situacao === 'REPROVADA'">
            <span class="titulo">
              Versão atual: v{{ v.numero }} · <code>{{ hash(v.arquivo.sha256) }}…</code>
              @if (conteudoJar) {
                · {{ v.entradas.length }} arquivo(s) no JAR
              }
            </span>
            @if (v.descricaoErro) {
              <span>Erro apontado na validação: {{ v.descricaoErro }}</span>
            }
          </div>
        }
        <p class="aviso">
          A nova versão recebe o número v{{ proximoNumero }}, fica vigente e exige nova aplicação em homologação (com backup antes) e
          nova validação do conjunto. A versão anterior continua registrada.
        </p>

        @if (conteudoJar) {
          <mat-button-toggle-group name="modo" [(ngModel)]="modo" hideSingleSelectionIndicator>
            <mat-button-toggle value="PACOTE">Arquivos soltos (zip ou pasta)</mat-button-toggle>
            <mat-button-toggle value="JAR">JAR pronto</mat-button-toggle>
          </mat-button-toggle-group>
        }

        @if (conteudoJar && modo === 'JAR') {
          <p class="aviso">
            O fabricante mandou o JAR montado: a v{{ proximoNumero }} passa a ser o arquivo inteiro, aplicado direto no destino
            (sem montagem a partir do backup). Precisa seguir o padrão <code>{{ conteudoJar.jarPadrao }}</code>.
          </p>
          <app-arquivo-upload
            [codAtualizacao]="data.detalhe.codAtualizacao"
            rotulo="JAR corrigido"
            accept=".jar"
            [obrigatorio]="true"
            (enviado)="arquivo.set($event)" />
          @if (nomeForaDoPadrao()) {
            <p class="falha">
              {{ arquivo()?.nome }} não segue o padrão {{ conteudoJar.jarPadrao }} deste artefato.
            </p>
          }
        } @else if (conteudoJar) {
          <p class="aviso">
            Envie o pacote completo corrigido: a v{{ proximoNumero }} substitui todos os arquivos da versão atual dentro do JAR
            <code>{{ nomeJar(conteudoJar.jarPadrao) }}</code> (pasta {{ conteudoJar.pasta }}).
          </p>
          <app-pacote-conteudo [codAtualizacao]="data.detalhe.codAtualizacao" (analisado)="receberAnalise($event)" />
          @if (grupo(); as g) {
            <div class="grupo">
              <strong>{{ g.arquivos.length }} arquivo(s) para {{ nomeJar(g.jarPadrao) }}</strong>
              @if (g.origem !== 'PASTA') {
                <span class="pendente">
                  {{ g.explicacaoOrigem }} O pacote veio sem a pasta {{ g.pasta }}: os arquivos vão para
                  <code>{{ g.caminhoInterno }}</code>.
                </span>
                <mat-checkbox name="confirmaDestino" [(ngModel)]="destinoConfirmado">
                  Confiro e confirmo o destino destes arquivos
                </mat-checkbox>
              }
              @for (c of g.choques; track $index) {
                <span [class.falha]="c.gravidade === 'CRITICO'" [class.pendente]="c.gravidade !== 'CRITICO'">
                  {{ c.mensagem }} ({{ situacaoInfo[c.situacao].rotulo }})
                </span>
              }
              <details>
                <summary>Arquivos</summary>
                <ul>
                  @for (a of g.arquivos; track a.codArquivo) {
                    <li><code>{{ a.caminhoInterno }}</code></li>
                  }
                </ul>
              </details>
            </div>
          } @else if (analisou()) {
            <p class="falha">Nenhum arquivo do pacote está na pasta {{ conteudoJar.pasta }}.</p>
          }
        } @else {
          <app-arquivo-upload
            [codAtualizacao]="data.detalhe.codAtualizacao"
            rotulo="Arquivo corrigido"
            [obrigatorio]="true"
            (enviado)="arquivo.set($event)" />

          @if (data.artefato.metodo === 'SCRIPT_RETORNO') {
            <app-arquivo-upload
              [codAtualizacao]="data.detalhe.codAtualizacao"
              rotulo="Script de retorno da nova versão"
              [obrigatorio]="true"
              (enviado)="retorno.set($event)" />
          }
        }

        @if (destinosComBackup.length) {
          <div class="backups">
            <mat-checkbox name="manterBackups" [(ngModel)]="manterBackups">
              Continuar com o backup já registrado ({{ destinosComBackup.length }} destino(s) de homologação)
            </mat-checkbox>
            <span class="aviso">
              {{
                manterBackups
                  ? 'O destino está com a v' + vigente?.numero + ', e o backup guardado é o estado anterior a ela: continua servindo para voltar atrás.'
                  : 'Vai pedir backup de novo em ' + listaDestinos + '. Use quando o destino mudou por fora desde o último backup.'
              }}
            </span>
          </div>
        }

        <mat-form-field appearance="outline">
          <mat-label>O que a nova versão corrige</mat-label>
          <textarea matInput name="descricao" [(ngModel)]="descricao" rows="3" required maxlength="2000"></textarea>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="form.invalid || salvando() || !pronto()">Enviar v{{ proximoNumero }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .conteudo {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: min(620px, 86vw);
      padding-top: 8px !important;
    }

    .atual,
    .grupo {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px 12px;
      border-radius: 8px;
      background: var(--mat-sys-surface-container, rgba(0, 0, 0, .04));
      font-size: .85rem;
    }

    .atual--erro {
      background: color-mix(in srgb, #d32f2f 12%, transparent);
    }

    .titulo {
      font-weight: 500;
    }

    .aviso {
      margin: 0;
      font-size: .8rem;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
    }

    .backups {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px 12px;
      border: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, .12));
      border-radius: 8px;
    }

    .falha {
      margin: 0;
      color: #d32f2f;
      font-size: .8rem;
    }

    .pendente {
      color: #b26a00;
      font-size: .8rem;
    }

    ul {
      max-height: 160px;
      margin: 4px 0 0;
      padding-left: 18px;
      overflow: auto;
      font-size: .76rem;
    }

    code {
      font-size: .75rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VersaoDialogComponent {
  readonly data = inject<VersaoDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<VersaoDialogComponent, AtualizacaoDetalhe>>(MatDialogRef);
  private readonly service = inject(AtualizacaoService);

  readonly situacaoInfo = SITUACAO_INFO;
  readonly nomeJar = nomeDoJar;
  readonly conteudoJar = this.data.artefato.conteudoJar;
  readonly vigente = this.data.artefato.versaoVigente;
  readonly proximoNumero = Math.max(0, ...this.data.artefato.versoes.map(v => v.numero)) + 1;
  readonly hash = hashCurto;
  readonly salvando = signal(false);
  readonly arquivo = signal<Arquivo | null>(null);
  readonly retorno = signal<Arquivo | null>(null);
  /** Conteúdo pode ser corrigido com os arquivos soltos ou com o JAR já montado pelo fabricante. */
  modo: 'PACOTE' | 'JAR' = 'PACOTE';
  /** O backup guardado é o estado anterior à versão que está no destino: costuma continuar valendo. */
  readonly destinosComBackup = this.data.artefato.homologacao.filter(a => a.backup);
  readonly listaDestinos = this.destinosComBackup.map(a => a.alvo).join(', ');
  manterBackups = true;
  /** Pacote sem a pasta cadastrada: o destino identificado precisa ser confirmado antes de gravar. */
  destinoConfirmado = false;
  readonly analise = signal<PacoteAnalise | null>(null);
  readonly analisou = computed(() => this.analise() !== null);
  /** Só o grupo de conteúdo: o JAR pronto do mesmo mapeamento é outro caminho (artefato de arquivo inteiro). */
  readonly grupo = computed(
    () => this.analise()?.grupos.find(g => !g.jarInteiro && g.codMapeamento === this.conteudoJar?.codMapeamento) ?? null
  );
  descricao = '';

  receberAnalise(analise: PacoteAnalise | null) {
    this.analise.set(analise);
  }

  /** JAR pronto precisa casar com o padrão do mapeamento, igual ao backup. */
  nomeForaDoPadrao() {
    const enviado = this.arquivo();
    return !!this.conteudoJar && this.modo === 'JAR' && !!enviado && !jarCombina(enviado.nome, this.conteudoJar.jarPadrao);
  }

  pronto() {
    if (this.conteudoJar) {
      if (this.modo === 'JAR') {
        return !!this.arquivo() && !this.nomeForaDoPadrao();
      }
      const grupo = this.grupo();
      return !!grupo?.arquivos.length && (grupo.origem === 'PASTA' || this.destinoConfirmado);
    }
    return !!this.arquivo() && (this.data.artefato.metodo !== 'SCRIPT_RETORNO' || !!this.retorno());
  }

  salvar() {
    this.salvando.set(true);
    this.service
      .enviarVersaoCorrigida(this.data.artefato.codArtefato, {
        codArquivo: this.arquivo()?.codArquivo ?? null,
        codArquivoRetorno: this.retorno()?.codArquivo ?? null,
        descricaoCorrecao: this.descricao.trim(),
        manterBackups: this.manterBackups && this.destinosComBackup.length > 0,
        destinoConfirmado: this.modo === 'PACOTE' && this.grupo()?.origem !== 'PASTA',
        arquivosConteudo: this.conteudoJar && this.modo === 'PACOTE' ? (this.grupo()?.arquivos.map(a => a.codArquivo) ?? []) : null,
      })
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({ next: detalhe => this.dialogRef.close(detalhe), error: () => {} });
  }
}
