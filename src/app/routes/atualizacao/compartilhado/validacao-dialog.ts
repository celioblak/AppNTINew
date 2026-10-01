import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';

import { AMBIENTE_ROTULO, Arquivo, AtualizacaoDetalhe, Catalogo, ResultadoValidacao } from '../atualizacao.models';
import { AtualizacaoService } from '../atualizacao.service';
import { ArquivoUploadComponent } from './arquivo-upload';

export interface ValidacaoDialogData {
  detalhe: AtualizacaoDetalhe;
  catalogo?: Catalogo;
}

type StatusItem = 'OK' | 'ERRO';

/** Uma linha do roteiro, escrita pelo validador: o que testou no sistema e se passou. */
interface ItemRoteiro {
  id: number;
  texto: string;
  status: StatusItem | null;
  erro: string;
}

interface VersaoValidada {
  codVersao: number;
  artefato: string;
  numero: number;
  /** Na reprovação, volta para o fabricante. Começa marcada: o validador testa o sistema, não sabe qual arquivo falhou. */
  comErro: boolean;
}

const LIMITE_ROTEIRO = 20000;
const LIMITE_ERRO = 3000;

/**
 * Validação da homologação (T-04). O validador escreve o roteiro — o que testou no sistema, um item por linha — e
 * marca Passou/Falhou em cada item. Um item com falha reprova a validação; as versões que voltam para o fabricante
 * são todas, a menos que o validador saiba apontar quais (R-12).
 */
@Component({
  selector: 'app-atualizacao-validacao-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
    ArquivoUploadComponent,
  ],
  template: `
    <h2 mat-dialog-title>Validação da homologação · {{ data.detalhe.numero }}</h2>
    <form #form="ngForm" (ngSubmit)="salvar()">
      <mat-dialog-content class="conteudo">
        <div class="processo" [attr.data-resultado]="situacao()">
          <mat-icon>{{ situacao() === 'REPROVADA' ? 'cancel' : situacao() === 'APROVADA' ? 'check_circle' : 'schedule' }}</mat-icon>
          <div class="processo__texto">
            <strong>{{ titulo() }}</strong>
            <span>{{ resumo() }}</span>
          </div>
          <div class="processo__contagem">
            <span class="ok">{{ contar('OK') }} passou</span>
            <span class="erro">{{ contar('ERRO') }} falhou</span>
            <span>{{ contar(null) }} sem marcar</span>
          </div>
        </div>

        <div class="corpo">
          <section class="principal">
            <div class="cabecalho">
              <h3>Roteiro: o que foi testado em {{ ambiente }}</h3>
              <span class="dica">Enter cria o próximo item</span>
            </div>

            <div class="linhas">
              @for (item of itens(); track item.id; let i = $index) {
                <div class="linha" [attr.data-status]="item.status">
                  <span class="linha__numero">{{ i + 1 }}</span>
                  <input
                    class="campo"
                    [id]="'roteiro-' + item.id"
                    [name]="'texto' + item.id"
                    [(ngModel)]="item.texto"
                    (keydown.enter)="$event.preventDefault(); incluir(i + 1)"
                    required
                    maxlength="500"
                    placeholder="Ex.: Abrir a tela de admissão e gravar um paciente" />
                  <mat-button-toggle-group class="toggle" [name]="'status' + item.id" [(ngModel)]="item.status" required hideSingleSelectionIndicator>
                    <mat-button-toggle value="OK">Passou</mat-button-toggle>
                    <mat-button-toggle value="ERRO">Falhou</mat-button-toggle>
                  </mat-button-toggle-group>
                  <div class="linha__erro">
                    @if (item.status === 'ERRO') {
                      <input
                        class="campo campo--erro"
                        [name]="'erro' + item.id"
                        [(ngModel)]="item.erro"
                        required
                        maxlength="1000"
                        placeholder="O que aconteceu" />
                    }
                  </div>
                  <button
                    mat-icon-button
                    type="button"
                    class="remover"
                    [disabled]="itens().length === 1"
                    (click)="remover(item)"
                    matTooltip="Remover item">
                    <mat-icon>close</mat-icon>
                  </button>
                </div>
              }
            </div>
            <button mat-button type="button" class="incluir" (click)="incluir(itens().length)">
              <mat-icon>add</mat-icon> Incluir item
            </button>

            @if (resultado() === 'REPROVADA') {
              <div class="retorno">
                <strong>Voltam para correção do fabricante</strong>
                <span class="dica">
                  Todas as versões voltam, a menos que você saiba quais apresentaram o erro. O que falhou vai junto na
                  reprovação.
                </span>
                <div class="retorno__versoes">
                  @for (v of versoes; track v.codVersao) {
                    <mat-checkbox [name]="'versao' + v.codVersao" [(ngModel)]="v.comErro">
                      <span class="mono">{{ v.artefato }}</span> v{{ v.numero }}
                    </mat-checkbox>
                  }
                </div>
              </div>
            }
          </section>

          <aside class="lateral">
            <div class="validando">
              <span class="dica">Versões em validação ({{ versoes.length }})</span>
              <ul>
                @for (v of versoes; track v.codVersao) {
                  <li><span class="mono">{{ v.artefato }}</span> v{{ v.numero }}</li>
                } @empty {
                  <li class="dica">Nenhuma versão vigente para validar.</li>
                }
              </ul>
            </div>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Observação (opcional)</mat-label>
              <textarea matInput name="observacao" [(ngModel)]="observacao" rows="4" maxlength="3000"></textarea>
            </mat-form-field>
            <app-arquivo-upload
              [codAtualizacao]="data.detalhe.codAtualizacao"
              rotulo="Evidência (opcional)"
              dica="Prints ou documento com os testes"
              (enviado)="evidencia.set($event)" />
          </aside>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <span class="dica falta">{{ faltam() }}</span>
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button
          mat-flat-button
          type="submit"
          [class.perigo]="resultado() === 'REPROVADA'"
          [disabled]="form.invalid || salvando() || !podeSalvar()">
          {{ resultado() === 'REPROVADA' ? 'Registrar reprovação' : 'Registrar aprovação' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .conteudo {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: min(1100px, 92vw);
      max-height: calc(90vh - 130px);
      padding-top: 8px !important;
    }

    .dica {
      margin: 0;
      font-size: .8rem;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
    }

    .mono {
      font-family: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: .78rem;
    }

    /* Resultado que vai ser registrado, sempre à vista. */
    .processo {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, .12));
      border-left-width: 4px;
      border-radius: 8px;
      background: var(--mat-sys-surface-container-high, #f3f3f3);
      font-size: .84rem;

      > mat-icon {
        color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
      }
    }

    .processo[data-resultado='APROVADA'] {
      border-left-color: #2e7d32;
      background: color-mix(in srgb, #2e7d32 10%, var(--mat-sys-surface-container-high, #fff));

      > mat-icon {
        color: #2e7d32;
      }
    }

    .processo[data-resultado='REPROVADA'] {
      border-left-color: #d32f2f;
      background: color-mix(in srgb, #d32f2f 10%, var(--mat-sys-surface-container-high, #fff));

      > mat-icon {
        color: #d32f2f;
      }
    }

    .processo__texto {
      display: flex;
      flex: 1 1 280px;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .processo__contagem {
      display: flex;
      gap: 10px;
      font-size: .78rem;
      white-space: nowrap;

      .ok {
        color: #2e7d32;
      }

      .erro {
        color: #d32f2f;
      }
    }

    .corpo {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 280px;
      gap: 16px;
      align-items: start;
    }

    @media (max-width: 900px) {
      .corpo {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .principal {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }

    .cabecalho {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;

      h3 {
        margin: 0;
        font-size: .9rem;
        font-weight: 500;
      }
    }

    .linhas {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, .12));
      border-radius: 8px;
    }

    /* Roteiro em linha: nº · o que foi testado · Passou/Falhou · o que aconteceu. */
    .linha {
      display: grid;
      grid-template-columns: 24px minmax(0, 1.3fr) auto minmax(0, 1fr) 32px;
      align-items: center;
      gap: 8px;
      min-height: 42px;
      padding: 4px 6px 4px 10px;
      border-top: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, .08));
    }

    .linha:first-child {
      border-top: 0;
    }

    .linha[data-status='OK'] {
      background: color-mix(in srgb, #2e7d32 6%, transparent);
    }

    .linha[data-status='ERRO'] {
      background: color-mix(in srgb, #d32f2f 7%, transparent);
    }

    @media (max-width: 700px) {
      .linha {
        grid-template-columns: 24px minmax(0, 1fr) auto 32px;
      }

      .linha__erro {
        grid-column: 2 / -2;
        grid-row: 2;
      }

      .linha__erro:empty {
        display: none;
      }
    }

    .linha__numero {
      font-size: .78rem;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
      text-align: right;
    }

    .toggle {
      --mat-standard-button-toggle-height: 30px;
      font-size: .78rem;
    }

    .campo {
      width: 100%;
      min-width: 0;
      padding: 6px 8px;
      border: 1px solid var(--mat-sys-outline, rgba(0, 0, 0, .38));
      border-radius: 6px;
      background: var(--mat-sys-surface, #fff);
      color: inherit;
      font: inherit;
      font-size: .82rem;
    }

    .campo:focus {
      outline: 2px solid var(--mat-sys-primary, #1976d2);
      outline-offset: -1px;
    }

    .campo--erro {
      border-color: #d32f2f;
    }

    .remover {
      --mat-icon-button-state-layer-size: 30px;
      padding: 3px;
    }

    .incluir {
      align-self: flex-start;
    }

    .retorno {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 6px;
      padding: 10px 12px;
      border: 1px solid #d32f2f;
      border-left-width: 4px;
      border-radius: 8px;
      font-size: .84rem;
    }

    .retorno__versoes {
      display: flex;
      flex-wrap: wrap;
      column-gap: 16px;
    }

    .lateral {
      position: sticky;
      top: 72px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .validando {
      padding: 8px 12px;
      border-radius: 8px;
      background: var(--mat-sys-surface-container, rgba(0, 0, 0, .04));

      ul {
        max-height: 140px;
        margin: 4px 0 0;
        padding-left: 18px;
        overflow: auto;
        font-size: .8rem;
        overflow-wrap: anywhere;
      }
    }

    .falta {
      margin-right: auto;
      padding-left: 8px;
    }

    .perigo {
      --mat-button-filled-container-color: #d32f2f;
      --mdc-filled-button-container-color: #d32f2f;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ValidacaoDialogComponent {
  readonly data = inject<ValidacaoDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ValidacaoDialogComponent, AtualizacaoDetalhe>>(MatDialogRef);
  private readonly service = inject(AtualizacaoService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly salvando = signal(false);
  readonly evidencia = signal<Arquivo | null>(null);
  readonly ambiente = AMBIENTE_ROTULO[this.data.detalhe.ambienteHomologacao].toLowerCase();

  observacao = '';
  private proximoId = 0;

  readonly itens = signal<ItemRoteiro[]>([this.novoItem()]);

  readonly versoes: VersaoValidada[] = this.data.detalhe.artefatos
    .filter(a => a.versaoVigente)
    .map(a => ({ codVersao: a.versaoVigente!.codVersao, artefato: a.nome, numero: a.versaoVigente!.numero, comErro: true }));

  private novoItem(): ItemRoteiro {
    return { id: this.proximoId++, texto: '', status: null, erro: '' };
  }

  contar(status: StatusItem | null) {
    return this.itens().filter(i => i.status === status).length;
  }

  /** Um item com falha reprova; a API recebe o resultado já decidido. */
  resultado(): ResultadoValidacao {
    return this.contar('ERRO') ? 'REPROVADA' : 'APROVADA';
  }

  situacao(): ResultadoValidacao | 'PENDENTE' {
    if (this.resultado() === 'REPROVADA') {
      return 'REPROVADA';
    }
    return this.contar(null) || this.itens().some(i => !i.texto.trim()) ? 'PENDENTE' : 'APROVADA';
  }

  titulo() {
    switch (this.situacao()) {
      case 'REPROVADA':
        return 'Vai reprovar a validação';
      case 'APROVADA':
        return 'Vai aprovar a validação';
      default:
        return 'Validação em andamento';
    }
  }

  resumo() {
    switch (this.situacao()) {
      case 'REPROVADA':
        return 'As versões marcadas abaixo aguardam a correção do fabricante (R-12).';
      case 'APROVADA':
        return 'Tudo passou. O próximo passo é o backup de produção de cada destino (R-15).';
      default:
        return 'Escreva o que testou no sistema e marque Passou ou Falhou em cada item.';
    }
  }

  faltam() {
    const itens = this.itens();
    if (itens.some(i => !i.texto.trim())) {
      return 'Preencha ou remova os itens em branco.';
    }
    const pendentes = this.contar(null);
    if (pendentes) {
      return `Falta marcar ${pendentes} item(ns).`;
    }
    if (itens.some(i => i.status === 'ERRO' && !i.erro.trim())) {
      return 'Descreva o que aconteceu nos itens que falharam.';
    }
    if (this.resultado() === 'REPROVADA' && !this.versoes.some(v => v.comErro)) {
      return 'Marque ao menos uma versão para voltar ao fabricante.';
    }
    return '';
  }

  incluir(posicao: number) {
    const item = this.novoItem();
    this.itens.update(lista => [...lista.slice(0, posicao), item, ...lista.slice(posicao)]);
    setTimeout(() => this.host.nativeElement.querySelector<HTMLInputElement>('#roteiro-' + item.id)?.focus());
  }

  remover(item: ItemRoteiro) {
    this.itens.update(lista => lista.filter(i => i !== item));
  }

  podeSalvar() {
    return this.versoes.length > 0 && !this.faltam();
  }

  /** Roteiro gravado na validação: um item por linha, com o resultado. */
  private roteiro() {
    const texto = this.itens()
      .map((i, n) => `${n + 1}. [${i.status === 'ERRO' ? 'FALHOU' : 'OK'}] ${i.texto.trim()}${i.status === 'ERRO' ? ' — ' + i.erro.trim() : ''}`)
      .join('\n');
    return texto.length > LIMITE_ROTEIRO ? texto.slice(0, LIMITE_ROTEIRO - 1) + '…' : texto;
  }

  /** O que falhou vai como erro de cada versão devolvida ao fabricante. */
  private descricaoErro() {
    const texto = this.itens()
      .filter(i => i.status === 'ERRO')
      .map(i => `${i.texto.trim()}: ${i.erro.trim()}`)
      .join('\n');
    return texto.length > LIMITE_ERRO ? texto.slice(0, LIMITE_ERRO - 1) + '…' : texto;
  }

  salvar() {
    const reprovada = this.resultado() === 'REPROVADA';
    const erro = reprovada ? this.descricaoErro() : null;
    this.salvando.set(true);
    this.service
      .registrarValidacao(this.data.detalhe.codAtualizacao, {
        resultado: this.resultado(),
        roteiro: this.roteiro(),
        observacao: this.observacao.trim() || null,
        codArquivoEvidencia: this.evidencia()?.codArquivo ?? null,
        versoes: this.versoes.map(v => {
          const comErro = reprovada && v.comErro;
          return { codVersao: v.codVersao, erro: comErro, descricaoErro: comErro ? erro : null };
        }),
      })
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({ next: detalhe => this.dialogRef.close(detalhe), error: () => {} });
  }
}
