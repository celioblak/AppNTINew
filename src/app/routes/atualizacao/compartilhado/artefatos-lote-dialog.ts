import { HttpEventType } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EMPTY, catchError, finalize, from, mergeMap, of, switchMap, tap } from 'rxjs';

import {
  Arquivo,
  ArquivoPacote,
  ArtefatoRequest,
  AtualizacaoDetalhe,
  CHOQUE_ROTULO,
  Catalogo,
  GRAVIDADE_TOM,
  METODO_ROTULO,
  MetodoArtefato,
  PacoteAnalise,
  PacoteGrupo,
  SITUACAO_INFO,
  hashCurto,
  jarCombina,
  nomeDoJar,
  previsaoDestinos,
  tamanhoLegivel,
} from '../atualizacao.models';
import { AtualizacaoService } from '../atualizacao.service';
import { ArquivoUploadComponent } from './arquivo-upload';
import { PacoteConteudoComponent } from './pacote-conteudo';
import { ForaMapeamentoDialogComponent, ForaMapeamentoDialogData, PastaForaDoMapeamento } from './fora-mapeamento-dialog';
import { EtiquetaComponent } from './situacao-chip';

export interface ArtefatosLoteDialogData {
  detalhe: AtualizacaoDetalhe;
  catalogo: Catalogo;
}

interface ItemLote {
  id: number;
  arquivoLocal: File;
  nome: string;
  codTipo: number | null;
  /** Tipos que usam a extensão do arquivo; mais de um = o técnico escolhe (ex.: .jar da MV). */
  tiposDaExtensao: number;
  selecionado: boolean;
  arquivo: Arquivo | null;
  retorno: Arquivo | null;
  progresso: number;
  enviando: boolean;
  erro: boolean;
}

interface GrupoEdicao extends PacoteGrupo {
  /** Um mapeamento pode aparecer como conteúdo e como JAR pronto: a chave separa os dois. */
  chave: string;
  incluir: boolean;
  nome: string;
  /** Destino identificado sem a pasta cadastrada: só entra com a confirmação de quem inclui. */
  confirmado: boolean;
  /** Conflito crítico (as duas atualizações mexem nos mesmos arquivos): exige assumir antes de incluir. */
  cienteChoque: boolean;
}

/** Arquivos enviados ao mesmo tempo, no máximo. */
const ENVIOS_SIMULTANEOS = 2;

/** Arquivos de uma mesma pasta do pacote. */
interface PastaDoPacote {
  pasta: string;
  arquivos: { arquivo: ArquivoPacote; nome: string }[];
}

/** Agrupa pela pasta de origem no pacote (o caminho relativo sem o nome do arquivo), em ordem alfabética. */
function porPasta(arquivos: ArquivoPacote[]): PastaDoPacote[] {
  const mapa = new Map<string, PastaDoPacote>();
  for (const arquivo of arquivos) {
    const caminho = (arquivo.caminhoRelativo || arquivo.nome).replace(/\\/g, '/');
    const barra = caminho.lastIndexOf('/');
    const pasta = barra < 0 ? '(raiz do pacote)' : caminho.substring(0, barra);
    const grupo = mapa.get(pasta) ?? { pasta, arquivos: [] };
    grupo.arquivos.push({ arquivo, nome: caminho.substring(barra + 1) });
    mapa.set(pasta, grupo);
  }
  return [...mapa.values()].sort((a, b) => a.pasta.localeCompare(b.pasta));
}

/**
 * Inclui vários artefatos de uma vez: arquivos inteiros (JARs, Forms, scripts) e conteúdo para dentro de JARs
 * (pacote do fabricante em zip ou pasta). Os destinos saem do cadastro do sistema; aqui só aparecem como prévia.
 */
@Component({
  selector: 'app-atualizacao-artefatos-lote-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTabsModule,
    MatTooltipModule,
    ArquivoUploadComponent,
    EtiquetaComponent,
    PacoteConteudoComponent,
  ],
  template: `
    <h2 mat-dialog-title>Incluir artefatos · {{ data.detalhe.numero }}</h2>
    <form #form="ngForm" (ngSubmit)="salvar()">
      <mat-dialog-content class="conteudo">
        @if (reabre) {
          <p class="aviso">Incluir artefatos agora devolve a atualização para homologação e cancela validação, backup de produção e aprovação (R-11).</p>
        }

        <mat-tab-group animationDuration="0ms" mat-stretch-tabs="false">
          <!-- Arquivos inteiros -->
          <mat-tab [label]="'Arquivos inteiros' + (itens().length ? ' (' + itens().length + ')' : '')">
            <div class="aba">
              <input #entrada type="file" multiple hidden (change)="escolher(entrada)" />
              <div
                class="soltar"
                [class.soltar--ativo]="arrastando()"
                role="button"
                tabindex="0"
                (click)="entrada.click()"
                (keydown.enter)="entrada.click()"
                (keydown.space)="$event.preventDefault(); entrada.click()"
                (dragover)="$event.preventDefault(); arrastando.set(true)"
                (dragleave)="arrastando.set(false)"
                (drop)="soltar($event)">
                <mat-icon>file_upload</mat-icon>
                <span><strong>Escolha ou arraste os arquivos do fabricante</strong></span>
                <span class="suave">JAR, Forms, Reports, scripts… Cada arquivo substitui o que está no destino. O tipo só é sugerido quando a extensão é de um único tipo.</span>
              </div>

              @if (itens().length) {
                <div class="massa">
                  <mat-checkbox
                    name="todos"
                    [checked]="todosSelecionados()"
                    [indeterminate]="selecionados().length > 0 && !todosSelecionados()"
                    (change)="selecionarTodos($event.checked)">
                    {{ selecionados().length ? selecionados().length + ' selecionado(s)' : 'Selecionar todos' }}
                  </mat-checkbox>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="massa__tipo">
                    <mat-label>Aplicar tipo aos selecionados</mat-label>
                    <mat-select name="tipoMassa" [disabled]="!selecionados().length" (selectionChange)="aplicarTipo($event.value)">
                      @for (t of tiposAtivos; track t.codTipoArtefato) {
                        <mat-option [value]="t.codTipoArtefato">{{ t.nome }} · {{ metodoRotulo[t.metodo] }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                  @if (semTipo()) {
                    <span class="pendente">{{ semTipo() }} arquivo(s) sem tipo</span>
                  }
                </div>

                <ol class="itens">
                  @for (item of itens(); track item.id) {
                    @let previsao = previsaoDe(item.codTipo);
                    <li class="item" [class.item--erro]="item.erro || previsao.erro" [class.item--sem-tipo]="!item.codTipo">
                      <mat-checkbox
                        [name]="'sel' + item.id"
                        [checked]="item.selecionado"
                        (change)="alterar(item.id, { selecionado: $event.checked })"
                        [attr.aria-label]="'Selecionar ' + item.arquivoLocal.name" />
                      <div class="item__arquivo">
                        <span class="item__nome-arquivo">{{ item.arquivoLocal.name }}</span>
                        @if (item.enviando) {
                          <mat-progress-bar mode="determinate" [value]="item.progresso" />
                        } @else if (item.arquivo) {
                          <span class="suave">{{ tamanho(item.arquivo.tamanho) }} · <code>{{ hash(item.arquivo.sha256) }}…</code></span>
                        } @else if (item.erro) {
                          <span class="falha">Envio falhou <button mat-button type="button" (click)="tentarDeNovo(item)">Tentar de novo</button></span>
                        }
                      </div>
                      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="item__campo">
                        <mat-label>Nome do artefato</mat-label>
                        <input matInput [name]="'nome' + item.id" [ngModel]="item.nome" (ngModelChange)="alterar(item.id, { nome: $event })" required maxlength="255" autocomplete="off" />
                      </mat-form-field>
                      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="item__campo">
                        <mat-label>Tipo</mat-label>
                        <mat-select [name]="'tipo' + item.id" [ngModel]="item.codTipo" (ngModelChange)="alterar(item.id, { codTipo: $event })" required>
                          @for (t of tiposAtivos; track t.codTipoArtefato) {
                            <mat-option [value]="t.codTipoArtefato">{{ t.nome }} · {{ metodoRotulo[t.metodo] }}</mat-option>
                          }
                        </mat-select>
                        @if (!item.codTipo && item.tiposDaExtensao > 1) {
                          <mat-hint class="pendente">Extensão usada por {{ item.tiposDaExtensao }} tipos: escolha</mat-hint>
                        }
                      </mat-form-field>
                      <button mat-icon-button type="button" (click)="remover(item.id)" matTooltip="Tirar da lista" aria-label="Tirar da lista">
                        <mat-icon>close</mat-icon>
                      </button>
                      @if (item.codTipo) {
                        <span class="item__destino" [class.falha]="previsao.erro">{{ previsao.erro ?? previsao.texto }}</span>
                        @if (!previsao.erro && previsao.aviso) {
                          <span class="item__destino pendente">{{ previsao.aviso }}</span>
                        }
                      }
                      @if (metodo(item.codTipo) === 'SCRIPT_RETORNO') {
                        <app-arquivo-upload
                          class="item__retorno"
                          [codAtualizacao]="data.detalhe.codAtualizacao"
                          rotulo="Script de retorno"
                          dica="Obrigatório para scripts (P-06)"
                          [obrigatorio]="true"
                          (enviado)="alterar(item.id, { retorno: $event })" />
                      }
                    </li>
                  }
                </ol>
              }
            </div>
          </mat-tab>

          <!-- Conteúdo para dentro de JAR -->
          <mat-tab [label]="'Conteúdo para JAR' + (gruposIncluidos().length ? ' (' + gruposIncluidos().length + ')' : '')">
            <div class="aba">
              <p class="suave">
                Envie o pacote do fabricante como veio. As pastas reconhecidas viram conteúdo para dentro do JAR — o sistema monta o JAR de
                cada destino a partir do backup e controla quais telas cada atualização altera. E se vier o <strong>JAR pronto</strong>, ele é
                reconhecido pelo nome do mapeamento e entra como arquivo inteiro, substituindo o do destino.
              </p>
              <app-pacote-conteudo [codAtualizacao]="data.detalhe.codAtualizacao" (analisado)="receberAnalise($event)" />
              <!-- Arquivos sem mapeamento de JAR (ex.: pasta dbservices ainda não cadastrada): visível logo depois do envio -->
              @if (naoReconhecidos().length) {
                <div class="fora-alerta" role="alert">
                  <div class="fora-alerta__titulo">
                    <mat-icon>warning</mat-icon>
                    <strong>{{ naoReconhecidos().length }} arquivo(s) em {{ pastasNaoReconhecidas().length }} pasta(s) sem mapeamento de JAR: ficam de fora</strong>
                  </div>
                  <span class="suave">
                    Cadastre a pasta em Atualizações › Configuração › Mapeamentos de JAR e envie o pacote de novo — ou siga sem eles (ao incluir,
                    o sistema pergunta e registra na linha do tempo o que ficou de fora).
                  </span>
                  <div class="arquivos">
                    @for (p of pastasNaoReconhecidas(); track p.pasta) {
                      <details class="pasta-recebida" [open]="pastasNaoReconhecidas().length === 1">
                        <summary class="pasta-recebida__nome">
                          <mat-icon>block</mat-icon> <code>{{ p.pasta }}</code> <span class="suave">· {{ p.arquivos.length }} arquivo(s)</span>
                        </summary>
                        <ul>
                          @for (item of p.arquivos; track item.arquivo.codArquivo) {
                            <li class="deduzido">
                              <code>{{ item.nome }}</code>
                              @if (item.arquivo.motivo) {
                                <span class="falha">{{ item.arquivo.motivo }}</span>
                              }
                            </li>
                          }
                        </ul>
                      </details>
                    }
                  </div>
                </div>
              }

              @if (gruposComConflito().length) {
                <div class="aviso-conflito" [class.aviso-conflito--critico]="temCritico()">
                  <mat-icon>{{ temCritico() ? 'report' : 'warning' }}</mat-icon>
                  <div>
                    <strong>
                      {{ gruposComConflito().length }} JAR(s) desta importação estão sendo alterados por outra atualização em andamento
                    </strong>
                    <span class="suave">
                      {{
                        temCritico()
                          ? 'Há arquivos alterados pelas duas: aplicar um por cima do outro desfaz a alteração de quem está homologando. Confirme grupo a grupo abaixo.'
                          : 'São telas diferentes no mesmo JAR, mas a ordem de aplicação importa: o último JAR montado vence.'
                      }}
                    </span>
                  </div>
                </div>
              }

              @for (g of grupos(); track g.chave) {
                @let previsao = previsaoDe(g.codTipoArtefato);
                <section class="grupo" [class.grupo--critico]="critico(g)" [class.grupo--fora]="!g.incluir">
                  <div class="grupo__cabecalho">
                    <mat-checkbox
                      [name]="'grupo' + g.chave"
                      [checked]="g.incluir"
                      [disabled]="!!g.artefatoExistente"
                      (change)="alterarGrupo(g.chave, { incluir: $event.checked })">
                      <strong>{{ g.jarInteiro ? g.arquivos[0].nome : nomeJar(g.jarPadrao) }}</strong>
                    </mat-checkbox>
                    @if (g.jarInteiro) {
                      <span class="suave">{{ g.tipo }} · JAR pronto: substitui o arquivo inteiro no destino (sem montagem)</span>
                    } @else {
                      <span class="suave">{{ g.tipo }} · {{ g.arquivos.length }} arquivo(s) · dentro do JAR: <code>{{ g.caminhoInterno }}</code></span>
                    }
                  </div>
                  <!-- Pasta recebida: fechada numa linha (quantidade); abre para listar as pastas de origem -->
                  @let pastas = pastasDosGrupos().get(g.chave) ?? [];
                  @if (pastas.length === 1) {
                    <div class="recebidas">
                      <span class="suave">Pasta recebida:</span>
                      <span class="recebida"><mat-icon>folder</mat-icon> {{ pastas[0].pasta }}</span>
                    </div>
                  } @else if (pastas.length > 1) {
                    <details class="recebidas-bloco">
                      <summary class="suave">Pasta recebida: {{ pastas.length }} pastas</summary>
                      <div class="recebidas">
                        @for (p of pastas; track p.pasta) {
                          <span class="recebida"><mat-icon>folder</mat-icon> {{ p.pasta }} <span class="suave">· {{ p.arquivos.length }}</span></span>
                        }
                      </div>
                    </details>
                  }
                  @let sobras = sobrasDoFabricante(g);
                  @if (sobras.length) {
                    <p class="pendente sobras" [matTooltip]="sobras.join('\n')" matTooltipClass="tooltip-lista">
                      <mat-icon>warning</mat-icon>
                      {{ sobras.length }} arquivo(s) de cópia de segurança ou código-fonte (.bak, .java…) vieram do fabricante e entram no
                      JAR como enviados. Fica registrado na linha do tempo.
                    </p>
                  }
                  @if (g.origem !== 'PASTA') {
                    <div class="conferir">
                      <mat-icon>assignment</mat-icon>
                      <div class="conferir__texto">
                        <strong>
                          {{
                            g.origem === 'CLASSE'
                              ? 'Destino lido de dentro dos arquivos'
                              : g.origem === 'JAR'
                                ? 'Destino encontrado no JAR que está no ambiente'
                                : 'Destino deduzido do histórico — confira'
                          }}
                        </strong>
                        <span>{{ g.explicacaoOrigem }}</span>
                        <span>
                          O pacote veio sem a pasta {{ g.pasta }}. Os arquivos vão para <code>{{ g.caminhoInterno }}</code> dentro do JAR
                          <code>{{ nomeJar(g.jarPadrao) }}</code>.
                        </span>
                        <mat-checkbox
                          [name]="'confirma' + g.chave"
                          [checked]="g.confirmado"
                          (change)="alterarGrupo(g.chave, { confirmado: $event.checked })">
                          Confiro e confirmo o destino destes {{ g.arquivos.length }} arquivo(s)
                        </mat-checkbox>
                      </div>
                    </div>
                  }

                  @if (g.artefatoExistente) {
                    <p class="pendente">Esta atualização já tem "{{ g.artefatoExistente }}" para este JAR: envie a versão corrigida nele.</p>
                  } @else {
                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                      <mat-label>Nome do artefato</mat-label>
                      <input matInput [name]="'nomeGrupo' + g.chave" [ngModel]="g.nome" (ngModelChange)="alterarGrupo(g.chave, { nome: $event })" [required]="g.incluir" maxlength="255" autocomplete="off" />
                    </mat-form-field>
                    <span class="suave" [class.falha]="previsao.erro">{{ previsao.erro ?? previsao.texto }}</span>
                    @if (!previsao.erro && previsao.aviso) {
                      <span class="pendente">{{ previsao.aviso }}</span>
                    }
                  }
                  @if (g.choques.length) {
                    <div class="conflitos" [class.conflitos--critico]="critico(g)">
                      <div class="conflitos__titulo">
                        <mat-icon>{{ critico(g) ? 'report' : 'warning' }}</mat-icon>
                        <strong>
                          {{ critico(g) ? 'Conflito: outra homologação está mexendo nestes mesmos arquivos' : 'Atenção: outra atualização mexe neste mesmo JAR' }}
                        </strong>
                      </div>
                      @for (c of g.choques; track $index) {
                        <div class="choque" [attr.data-gravidade]="c.gravidade">
                          <span class="choque__cabecalho">
                            <app-etiqueta [tom]="gravidadeTom[c.gravidade]">{{ choqueRotulo[c.tipo] }}</app-etiqueta>
                            <span class="mono">{{ c.numero }}</span>
                            <span class="suave">{{ situacaoInfo[c.situacao].rotulo }}{{ c.responsavel ? ' · com ' + c.responsavel : '' }}</span>
                          </span>
                          <span>{{ c.mensagem }}</span>
                          <span class="suave">{{ c.titulo }}</span>
                          @if (c.telas.length) {
                            <details [open]="c.gravidade === 'CRITICO'">
                              <summary>{{ c.telas.length }} arquivo(s) que as duas alteram</summary>
                              <ul>
                                @for (t of c.telas; track t) {
                                  <li><code>{{ t }}</code></li>
                                }
                              </ul>
                            </details>
                          }
                        </div>
                      }
                      @if (critico(g)) {
                        <mat-checkbox
                          [name]="'ciente' + g.chave"
                          [checked]="g.cienteChoque"
                          (change)="alterarGrupo(g.chave, { cienteChoque: $event.checked })">
                          Falei com quem está homologando e assumo aplicar estes arquivos por cima
                        </mat-checkbox>
                      }
                    </div>
                  }
                  <!-- Destino deduzido: aberto, com de onde veio e por que foi para lá, arquivo a arquivo -->
                  <details [open]="g.origem !== 'PASTA'">
                    <summary>Arquivos{{ g.origem !== 'PASTA' ? ' — confira de onde cada um veio e para onde vai' : '' }}</summary>
                    <div class="arquivos">
                      @for (p of pastasDosGrupos().get(g.chave) ?? []; track p.pasta) {
                        <div class="pasta-recebida">
                          <span class="pasta-recebida__nome"><mat-icon>folder_open</mat-icon> Pasta recebida: <code>{{ p.pasta }}</code> <span class="suave">· {{ p.arquivos.length }} arquivo(s)</span></span>
                          <ul>
                            @for (item of p.arquivos; track item.arquivo.codArquivo) {
                              <li class="deduzido">
                                <span><code>{{ item.nome }}</code> → <code>{{ item.arquivo.caminhoInterno }}</code> <span class="suave">{{ tamanho(item.arquivo.tamanho) }}</span></span>
                                @if (g.origem !== 'PASTA' && item.arquivo.motivo) {
                                  <span class="suave">{{ item.arquivo.motivo }}</span>
                                }
                              </li>
                            }
                          </ul>
                        </div>
                      }
                    </div>
                  </details>
                </section>
              }


            </div>
          </mat-tab>
        </mat-tab-group>
      </mat-dialog-content>
      <!-- Inclusão em andamento: o servidor confere e empacota cada arquivo numa requisição só (tudo ou nada) -->
      @if (salvando()) {
        <div class="incluindo" role="status" aria-live="polite">
          <mat-progress-bar mode="indeterminate" />
          <span>
            <strong>Incluindo {{ incluindo().artefatos }} artefato(s) com {{ incluindo().arquivos }} arquivo(s)…</strong>
            <span class="suave">
              {{ decorrido() }} · o servidor confere a assinatura de cada arquivo e monta os pacotes. Com muitos arquivos leva alguns
              minutos; não feche esta janela.
            </span>
          </span>
        </div>
      }
      <mat-dialog-actions align="end">
        <span class="resumo suave">{{ resumo() }}</span>
        <button mat-button type="button" mat-dialog-close [disabled]="salvando()">Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="form.invalid || salvando() || !podeSalvar()">
          {{ salvando() ? 'Incluindo…' : 'Incluir ' + (total() || '') + ' artefato' + (total() === 1 ? '' : 's') }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .conteudo {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: min(980px, 90vw);
      padding-top: 8px !important;
    }

    .aba {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-top: 12px;

      > p {
        margin: 0;
      }
    }

    .aviso {
      margin: 0;
      padding: 8px 12px;
      border-radius: 8px;
      background: color-mix(in srgb, #e08a00 14%, transparent);
      font-size: .8rem;
    }

    .soltar {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 18px 12px;
      border: 1px dashed var(--mat-sys-outline, rgba(0, 0, 0, .38));
      border-radius: 10px;
      text-align: center;
      cursor: pointer;
    }

    .soltar--ativo,
    .soltar:hover {
      background: color-mix(in srgb, #1976d2 8%, transparent);
    }

    .soltar:focus-visible {
      outline: 2px solid #1976d2;
      outline-offset: 2px;
    }

    .suave {
      font-size: .78rem;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
    }

    .pendente {
      margin: 0;
      font-size: .78rem;
      color: #b26a00;
    }

    .falha {
      margin: 0;
      font-size: .8rem;
      color: #d32f2f;
    }

    .massa {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 16px;
    }

    .massa__tipo {
      flex: 0 1 320px;
    }

    .itens {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .item {
      display: grid;
      grid-template-columns: auto minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr) auto;
      align-items: center;
      gap: 6px 10px;
      padding: 8px 10px;
      border: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, .12));
      border-radius: 8px;
    }

    .item--sem-tipo {
      border-left: 3px solid #e08a00;
    }

    .item--erro {
      border-color: #d32f2f;
    }

    .item__arquivo {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      font-size: .82rem;
    }

    .item__nome-arquivo {
      overflow-wrap: anywhere;
      font-weight: 500;
    }

    .item__destino,
    .item__retorno {
      grid-column: 2 / -1;
    }

    .item__destino {
      font-size: .76rem;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
      overflow-wrap: anywhere;
    }

    .grupo {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px 12px;
      border: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, .12));
      border-radius: 8px;
    }

    .grupo--critico {
      border-left: 3px solid #d32f2f;
    }

    .conferir {
      display: flex;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 6px;
      background: color-mix(in srgb, #e08a00 14%, transparent);
      font-size: .8rem;
    }

    .conferir__texto {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .grupo--fora {
      opacity: .6;
    }

    .grupo__cabecalho {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 12px;
    }

    .aviso-conflito,
    .conflitos {
      --cor: #e08a00;
      border: 1px solid var(--cor);
      border-left-width: 4px;
      border-radius: 8px;
      background: color-mix(in srgb, var(--cor) 10%, transparent);
    }

    .aviso-conflito--critico,
    .conflitos--critico {
      --cor: #d32f2f;
    }

    .aviso-conflito {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
      font-size: .82rem;

      div {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
    }

    .conflitos {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px 10px;
    }

    .conflitos__titulo {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: .84rem;
    }

    .conflitos__titulo mat-icon,
    .aviso-conflito > mat-icon {
      color: var(--cor);
      flex-shrink: 0;
    }

    .choque {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 6px 10px;
      border-radius: 6px;
      background: var(--mat-sys-surface, rgba(255, 255, 255, .55));
      font-size: .8rem;
    }

    .choque__cabecalho {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }

    .arquivos {
      max-height: 260px;
      margin: 4px 0 0;
      overflow: auto;
      font-size: .76rem;
    }

    /* Pasta recebida: no cabeçalho do grupo, fechada numa linha; abre para listar as pastas de origem. */
    .recebidas-bloco > summary {
      width: fit-content;
      cursor: pointer;
      font-size: .78rem;
    }

    .recebidas {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 8px;
      padding-top: 2px;
      font-size: .78rem;
    }

    .recebida {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 1px 8px 1px 4px;
      border-radius: 10px;
      background: var(--mat-sys-surface-container, rgba(0, 0, 0, .05));
      font-family: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      overflow-wrap: anywhere;

      mat-icon {
        flex-shrink: 0;
        width: 14px;
        height: 14px;
        font-size: 14px;
      }
    }

    /* Lista de arquivos: um bloco por pasta recebida. */
    .pasta-recebida {
      margin-bottom: 6px;

      ul {
        margin: 2px 0 0;
        padding-left: 26px;
      }
    }

    .pasta-recebida__nome {
      display: flex;
      align-items: center;
      gap: 4px;
      font-weight: 500;
      overflow-wrap: anywhere;

      mat-icon {
        flex-shrink: 0;
        width: 16px;
        height: 16px;
        font-size: 16px;
      }
    }

    /* Destino deduzido: origem → destino e, embaixo, o motivo. */
    .deduzido {
      display: flex;
      flex-direction: column;
      gap: 1px;
      margin-bottom: 4px;
      overflow-wrap: anywhere;
    }

    summary {
      cursor: pointer;
      font-size: .78rem;
    }

    .ciente {
      padding: 4px 0;
    }

    .sobras {
      display: flex;
      align-items: flex-start;
      gap: 4px;
      margin: 0;
      font-size: .8rem;

      mat-icon {
        flex-shrink: 0;
        width: 16px;
        height: 16px;
        font-size: 16px;
      }
    }

    /* Arquivos sem mapeamento de JAR: alerta aberto logo depois do envio do pacote. */
    .fora-alerta {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px 12px;
      border: 1px solid #ed6c02;
      border-left-width: 4px;
      border-radius: 8px;
      background: color-mix(in srgb, #ed6c02 8%, transparent);
      font-size: .84rem;

      summary {
        cursor: pointer;
      }
    }

    .fora-alerta__titulo {
      display: flex;
      align-items: center;
      gap: 6px;

      mat-icon {
        flex-shrink: 0;
        color: #ed6c02;
      }
    }

    /* Barra da inclusão em andamento, logo acima dos botões. */
    .incluindo {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px 24px 0;
      font-size: .84rem;

      > span {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
    }

    .resumo {
      margin-right: auto;
      padding-left: 8px;
    }

    code {
      font-size: .72rem;
      overflow-wrap: anywhere;
    }

    @media (max-width: 760px) {
      .item {
        grid-template-columns: auto minmax(0, 1fr) auto;
      }

      .item__arquivo,
      .item__campo {
        grid-column: 2 / 3;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArtefatosLoteDialogComponent {
  readonly data = inject<ArtefatosLoteDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ArtefatosLoteDialogComponent, AtualizacaoDetalhe>>(MatDialogRef);
  private readonly dialog = inject(MatDialog);
  private readonly service = inject(AtualizacaoService);

  readonly metodoRotulo = METODO_ROTULO;
  readonly situacaoInfo = SITUACAO_INFO;
  readonly choqueRotulo = CHOQUE_ROTULO;
  readonly gravidadeTom = GRAVIDADE_TOM;
  readonly nomeJar = nomeDoJar;
  readonly tamanho = tamanhoLegivel;
  readonly hash = hashCurto;
  readonly tiposAtivos = this.data.catalogo.tipos.filter(t => t.ativo);
  readonly reabre = this.data.detalhe.situacao !== 'RASCUNHO';

  readonly itens = signal<ItemLote[]>([]);
  readonly grupos = signal<GrupoEdicao[]>([]);
  readonly naoReconhecidos = signal<ArquivoPacote[]>([]);
  /** Pastas de origem de cada grupo (chave do grupo → pastas com seus arquivos). */
  readonly pastasDosGrupos = computed(() => new Map(this.grupos().map(g => [g.chave, porPasta(g.arquivos)])));
  readonly pastasNaoReconhecidas = computed(() => porPasta(this.naoReconhecidos()));

  /** Cópias de segurança e fontes que o fabricante mandou junto (mesma regra do backend: ConteudoJar.sobraDoFabricante). */
  sobrasDoFabricante(g: GrupoEdicao): string[] {
    return g.arquivos.map(a => a.caminhoRelativo || a.nome).filter(c => /(\.bak|\.orig|\.old|\.tmp|~|\.java)$/i.test(c));
  }


  /** Algum arquivo ficou de fora por contradizer a pasta (ex.: reports sem mapeamento): abre a lista. */
  readonly temContradicao = computed(() => this.naoReconhecidos().some(a => !!a.motivo));
  readonly salvando = signal(false);
  readonly arrastando = signal(false);
  private proximoId = 1;

  readonly selecionados = computed(() => this.itens().filter(i => i.selecionado));
  readonly todosSelecionados = computed(() => this.itens().length > 0 && this.itens().every(i => i.selecionado));
  readonly semTipo = computed(() => this.itens().filter(i => !i.codTipo).length);
  readonly gruposIncluidos = computed(() => this.grupos().filter(g => g.incluir && !g.artefatoExistente));
  readonly total = computed(() => this.itens().length + this.gruposIncluidos().length);
  readonly temCritico = computed(() => this.gruposIncluidos().some(g => this.critico(g)));
  readonly gruposComConflito = computed(() => this.grupos().filter(g => g.choques.length));

  readonly nomesRepetidos = computed(() => {
    const existentes = new Set(this.data.detalhe.artefatos.map(a => a.nome.toLowerCase()));
    const vistos = new Set<string>();
    const repetidos = new Set<string>();
    const nomes = [...this.itens().map(i => i.nome), ...this.gruposIncluidos().map(g => g.nome)];
    for (const bruto of nomes) {
      const nome = bruto.trim().toLowerCase();
      if (nome && (vistos.has(nome) || existentes.has(nome))) {
        repetidos.add(bruto.trim());
      }
      vistos.add(nome);
    }
    return [...repetidos];
  });

  readonly resumo = computed(() => {
    const itens = this.itens();
    const enviando = itens.filter(i => i.enviando).length;
    const partes: string[] = [];
    if (enviando) {
      partes.push(`Enviando ${enviando} arquivo(s)`);
    }
    if (this.nomesRepetidos().length) {
      partes.push(`Nomes repetidos: ${this.nomesRepetidos().join(', ')}`);
    }
    return partes.join(' · ');
  });

  metodo(codTipo: number | null): MetodoArtefato | null {
    return this.data.catalogo.tipos.find(t => t.codTipoArtefato === codTipo)?.metodo ?? null;
  }

  previsaoDe(codTipo: number | null) {
    return previsaoDestinos(
      this.data.catalogo,
      this.data.detalhe.codSistema,
      codTipo,
      this.data.detalhe.emergencial,
      this.data.detalhe.ambienteHomologacao
    );
  }

  critico(grupo: PacoteGrupo) {
    return grupo.choques.some(c => c.gravidade === 'CRITICO');
  }

  // ------------------------------------------------------------------ arquivos inteiros

  escolher(entrada: HTMLInputElement) {
    this.adicionar(Array.from(entrada.files ?? []));
    entrada.value = '';
  }

  soltar(evento: DragEvent) {
    evento.preventDefault();
    this.arrastando.set(false);
    this.adicionar(Array.from(evento.dataTransfer?.files ?? []));
  }

  alterar(id: number, mudanca: Partial<ItemLote>) {
    this.itens.update(lista => lista.map(i => (i.id === id ? { ...i, ...mudanca } : i)));
  }

  selecionarTodos(marcado: boolean) {
    this.itens.update(lista => lista.map(i => ({ ...i, selecionado: marcado })));
  }

  /** Aplica o tipo aos selecionados e desmarca, para seguir com o próximo grupo de arquivos. */
  aplicarTipo(codTipo: number) {
    this.itens.update(lista => lista.map(i => (i.selecionado ? { ...i, codTipo, selecionado: false } : i)));
  }

  remover(id: number) {
    this.itens.update(lista => lista.filter(i => i.id !== id));
  }

  tentarDeNovo(item: ItemLote) {
    this.enviar(item).subscribe();
  }

  // ------------------------------------------------------------------ conteúdo

  receberAnalise(analise: PacoteAnalise | null) {
    const anteriores = new Map(this.grupos().map(g => [g.chave, g]));
    this.grupos.set(
      (analise?.grupos ?? []).map(g => {
        const chave = `${g.codMapeamento}|${g.jarInteiro ? g.arquivos[0]?.codArquivo : 'conteudo'}`;
        return {
          ...g,
          chave,
          incluir: anteriores.get(chave)?.incluir ?? !g.artefatoExistente,
          nome: anteriores.get(chave)?.nome ?? g.nomeSugerido,
          confirmado: anteriores.get(chave)?.confirmado ?? false,
          cienteChoque: anteriores.get(chave)?.cienteChoque ?? false,
        };
      })
    );
    this.naoReconhecidos.set(analise?.naoReconhecidos ?? []);
  }

  alterarGrupo(chave: string, mudanca: Partial<GrupoEdicao>) {
    this.grupos.update(lista => lista.map(g => (g.chave === chave ? { ...g, ...mudanca } : g)));
  }

  // ------------------------------------------------------------------ salvar

  podeSalvar() {
    if (!this.total() || this.nomesRepetidos().length) {
      return false;
    }
    const itensOk = this.itens().every(
      i =>
        i.arquivo &&
        !i.enviando &&
        i.codTipo &&
        !this.previsaoDe(i.codTipo).erro &&
        (this.metodo(i.codTipo) !== 'SCRIPT_RETORNO' || i.retorno)
    );
    // Destino que não veio da pasta cadastrada só entra com a confirmação explícita (erro aqui quebra a aplicação).
    const gruposOk = this.gruposIncluidos().every(
      g =>
        g.nome.trim() &&
        !this.previsaoDe(g.codTipoArtefato).erro &&
        (g.origem === 'PASTA' || g.confirmado) &&
        (!this.critico(g) || g.cienteChoque)
    );
    return itensOk && gruposOk;
  }

  /**
   * Se o pacote tem arquivos sem mapeamento de JAR (ex.: pasta dbservices ainda não cadastrada), mostra o que fica de
   * fora e pergunta antes de incluir: cancelar para cadastrar o mapeamento, ou continuar sem eles (fica na linha do tempo).
   */
  salvar() {
    const fora: PastaForaDoMapeamento[] = this.pastasNaoReconhecidas().map(p => ({
      pasta: p.pasta,
      arquivos: p.arquivos.map(item => item.nome),
    }));
    if (!fora.length) {
      this.incluir([]);
      return;
    }
    this.dialog
      .open<ForaMapeamentoDialogComponent, ForaMapeamentoDialogData, boolean>(ForaMapeamentoDialogComponent, {
        data: { pastas: fora, artefatos: this.total() },
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe(continuar => {
        if (continuar) {
          this.incluir(fora);
        }
      });
  }

  private incluir(fora: PastaForaDoMapeamento[]) {
    const dados: ArtefatoRequest[] = [
      ...this.itens().map(item => ({
        nome: item.nome.trim(),
        codTipoArtefato: item.codTipo,
        observacao: null,
        codArquivo: item.arquivo!.codArquivo,
        codArquivoRetorno: item.retorno?.codArquivo ?? null,
      })),
      // JAR pronto entra como arquivo inteiro; pasta reconhecida entra como conteúdo do JAR.
      ...this.gruposIncluidos().map(g =>
        g.jarInteiro
          ? {
              nome: g.nome.trim(),
              codTipoArtefato: g.codTipoArtefato,
              observacao: null,
              codArquivo: g.arquivos[0].codArquivo,
            }
          : {
              nome: g.nome.trim(),
              codTipoArtefato: g.codTipoArtefato,
              observacao: null,
              codMapeamentoJar: g.codMapeamento,
              arquivosConteudo: g.arquivos.map(a => a.codArquivo),
              destinoConfirmado: g.origem !== 'PASTA',
            }
      ),
    ];
    this.incluindo.set({
      artefatos: dados.length,
      arquivos: this.itens().length + this.gruposIncluidos().reduce((soma, g) => soma + g.arquivos.length, 0),
    });
    this.iniciarProgresso();
    const cod = this.data.detalhe.codAtualizacao;
    this.service
      .incluirArtefatos(cod, dados)
      .pipe(
        // Incluiu: registra na linha do tempo o que ficou de fora e devolve o detalhe já com esse evento.
        switchMap(detalhe =>
          fora.length
            ? this.service
                .registrarForaDoMapeamento(
                  cod,
                  fora.map(p => `${p.pasta} (${p.arquivos.length} arquivo(s))`),
                  fora.reduce((soma, p) => soma + p.arquivos.length, 0)
                )
                .pipe(
                  switchMap(() => this.service.detalhe(cod)),
                  catchError(() => of(detalhe))
                )
            : of(detalhe)
        ),
        finalize(() => this.encerrarProgresso())
      )
      .subscribe({ next: detalhe => this.dialogRef.close(detalhe), error: () => {} });
  }

  // ------------------------------------------------------------------ progresso da inclusão

  /** O que está sendo incluído, para a mensagem da barra. */
  readonly incluindo = signal({ artefatos: 0, arquivos: 0 });
  private readonly segundos = signal(0);
  private relogio: ReturnType<typeof setInterval> | null = null;
  private fechavaAntes: boolean | undefined;

  /** "12 s" ou "1 min 05 s": o tempo andando mostra que não travou. */
  readonly decorrido = computed(() => {
    const s = this.segundos();
    return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
  });

  private iniciarProgresso() {
    this.salvando.set(true);
    this.segundos.set(0);
    // Sem fechar por ESC ou clique fora no meio da inclusão: o resultado chegaria sem ninguém para recebê-lo.
    this.fechavaAntes = this.dialogRef.disableClose;
    this.dialogRef.disableClose = true;
    this.relogio = setInterval(() => this.segundos.update(s => s + 1), 1000);
  }

  private encerrarProgresso() {
    this.salvando.set(false);
    this.dialogRef.disableClose = this.fechavaAntes;
    if (this.relogio) {
      clearInterval(this.relogio);
      this.relogio = null;
    }
  }

  private adicionar(arquivos: File[]) {
    if (!arquivos.length) {
      return;
    }
    const novos = arquivos.map(arquivo => this.novoItem(arquivo));
    this.itens.update(lista => [...lista, ...novos]);
    from(novos)
      .pipe(mergeMap(item => this.enviar(item), ENVIOS_SIMULTANEOS))
      .subscribe();
  }

  private novoItem(arquivo: File): ItemLote {
    const ponto = arquivo.name.lastIndexOf('.');
    const extensao = ponto >= 0 ? arquivo.name.substring(ponto).toLowerCase() : '';
    const candidatos = this.tiposAtivos.filter(t => (t.extensoes ?? '').split(',').includes(extensao));
    // O JAR pronto de um mapeamento já diz de que tipo é (Forms, Libs, Reports), mesmo com a extensão repetida.
    const doMapeamento = this.data.catalogo.mapeamentos.find(
      m => m.ativo && m.codSistema === this.data.detalhe.codSistema && jarCombina(arquivo.name, m.jarPadrao)
    );
    return {
      id: this.proximoId++,
      arquivoLocal: arquivo,
      nome: arquivo.name,
      // Só sugere quando a extensão é de um único tipo: .jar da MV pode ser Forms, Libs ou Reports.
      codTipo: doMapeamento?.codTipoArtefato ?? (candidatos.length === 1 ? candidatos[0].codTipoArtefato : null),
      tiposDaExtensao: candidatos.length,
      selecionado: candidatos.length > 1,
      arquivo: null,
      retorno: null,
      progresso: 0,
      enviando: true,
      erro: false,
    };
  }

  private enviar(item: ItemLote) {
    this.alterar(item.id, { enviando: true, progresso: 0, erro: false });
    return this.service.enviarArquivo(this.data.detalhe.codAtualizacao, item.arquivoLocal).pipe(
      tap(evento => {
        if (evento.type === HttpEventType.UploadProgress && evento.total) {
          this.alterar(item.id, { progresso: Math.round((100 * evento.loaded) / evento.total) });
        } else if (evento.type === HttpEventType.Response && evento.body) {
          this.alterar(item.id, { arquivo: evento.body, enviando: false });
        }
      }),
      // O errorInterceptor já mostra o motivo; aqui só marca o item para tentar de novo.
      catchError(() => {
        this.alterar(item.id, { enviando: false, erro: true });
        return EMPTY;
      })
    );
  }
}
