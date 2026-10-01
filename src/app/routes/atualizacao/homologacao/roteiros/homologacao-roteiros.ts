import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConfirmDialogComponent, ConfirmDialogData } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { HotToastService } from '@ngxpert/hot-toast';
import { Observable, finalize } from 'rxjs';

import { FiltroSituacao, contemTexto, passaSituacao } from '../../compartilhado/filtro';
import { EtiquetaComponent } from '../../compartilhado/situacao-chip';
import { AgrupamentoDialogComponent, AgrupamentoDialogData, AgrupamentoDialogResultado } from '../compartilhado/acoes-dialogs';
import {
  AgrupamentoPadrao,
  CatalogoHom,
  ImportacaoRoteiro,
  ItemPadrao,
  ItemPadraoRequest,
  RoteiroPadrao,
  RoteiroResumo,
  porModulo,
} from '../homologacao.models';
import { CopiarDialogData, CopiarRoteiroDialogComponent, ImportarDialogData, ImportarRoteiroDialogComponent } from './carga-dialogs';
import { HomologacaoService } from '../homologacao.service';

// ================================================================== diálogo do item do padrão

interface ItemPadraoDialogData {
  roteiro: RoteiroPadrao;
  item: ItemPadrao | null;
  codAgrupamento: number;
}

@Component({
  selector: 'app-hom-item-padrao-dialog',
  imports: [FormsModule, MatButtonModule, MatCheckboxModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>{{ data.item ? 'Editar item' : 'Novo item' }}</h2>
    <mat-dialog-content class="campos">
      @if (data.item?.usos) {
        <p class="dica">Usado em {{ data.item!.usos }} homologaç{{ data.item!.usos === 1 ? 'ão' : 'ões' }}: elas guardam a cópia e não mudam (R-01).</p>
      }
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Agrupamento</mat-label>
        <mat-select [(ngModel)]="dados.codAgrupamento">
          @for (a of data.roteiro.agrupamentos; track a.codAgrupamento) {
            <mat-option [value]="a.codAgrupamento">{{ a.nome }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>O que testar (título)</mat-label>
        <input matInput maxlength="300" [(ngModel)]="dados.titulo" placeholder="Ex.: Cadastrar novo convênio" />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Como testar (passos)</mat-label>
        <textarea matInput rows="4" maxlength="4000" [(ngModel)]="dados.passos"></textarea>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Resultado esperado</mat-label>
        <textarea matInput rows="2" maxlength="2000" [(ngModel)]="dados.resultadoEsperado"></textarea>
      </mat-form-field>
      <mat-checkbox [(ngModel)]="dados.critico">Crítico — reprovado já vem marcado como impeditivo</mat-checkbox>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Voltar</button>
      <button mat-flat-button type="button" [disabled]="!dados.titulo.trim() || !dados.codAgrupamento" (click)="salvar()">Salvar</button>
    </mat-dialog-actions>
  `,
  styles: `
    .campos {
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: min(560px, 88vw);
      padding-top: 8px !important;
    }

    .dica {
      margin: 0;
      font-size: .8rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemPadraoDialogComponent {
  readonly data = inject<ItemPadraoDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ItemPadraoDialogComponent, ItemPadraoRequest>>(MatDialogRef);
  dados: ItemPadraoRequest = {
    codAgrupamento: this.data.item?.codAgrupamento ?? this.data.codAgrupamento,
    titulo: this.data.item?.titulo ?? '',
    passos: this.data.item?.passos ?? '',
    resultadoEsperado: this.data.item?.resultadoEsperado ?? '',
    critico: this.data.item?.critico ?? false,
  };

  salvar() {
    this.dialogRef.close({
      ...this.dados,
      titulo: this.dados.titulo.trim(),
      passos: this.dados.passos?.trim() || null,
      resultadoEsperado: this.dados.resultadoEsperado?.trim() || null,
    });
  }
}

// ================================================================== tela

/**
 * Roteiros de homologação (T-05): roteiros padrão por sistema (zero, um ou vários), com agrupamentos em um nível
 * e itens. O que já foi usado em homologação só inativa (R-14).
 */
@Component({
  selector: 'app-homologacao-roteiros',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTooltipModule,
    EtiquetaComponent,
  ],
  template: `
    <div class="pagina roteiros">
      <div class="barra">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="sistema">
          <mat-label>Sistema</mat-label>
          <mat-select [ngModel]="codSistema()" (ngModelChange)="escolherSistema($event)">
            @for (s of catalogo()?.sistemas ?? []; track s.codSistema) {
              <mat-option [value]="s.codSistema">{{ s.nome }} ({{ qtdRoteiros(s.codSistema) }})</mat-option>
            }
          </mat-select>
        </mat-form-field>
        @if (!podeAlterar()) {
          <span class="suave">Só consulta: alterar roteiros exige a tela Roteiros de homologação.</span>
        }
      </div>

      @if (carregando()) {
        <mat-progress-bar mode="indeterminate" />
      }

      @if (codSistema()) {
        <div class="colunas">
          <aside class="secao lista">
            <h3 class="secao__titulo">Roteiros</h3>
            @for (r of roteirosDoSistema(); track r.codRoteiro) {
              <button type="button" class="roteiro" [class.roteiro--ativo]="roteiro()?.codRoteiro === r.codRoteiro" (click)="abrir(r.codRoteiro)">
                <strong>{{ r.nome }}</strong>
                <span class="suave">{{ r.qtdAgrupamentos }} agrupamentos · {{ r.qtdItens }} itens · usado {{ r.usos }}×</span>
                @if (!r.ativo) {
                  <app-etiqueta>inativo</app-etiqueta>
                }
              </button>
            } @empty {
              <p class="suave">
                Nenhum roteiro: as homologações deste sistema começam vazias. Crie um roteiro aqui ou inclua itens durante uma homologação
                marcando "nesta e no roteiro padrão".
              </p>
            }
            @if (podeAlterar()) {
              <div class="novo">
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Novo roteiro (ex.: Versão completa)</mat-label>
                  <input matInput maxlength="200" [(ngModel)]="novoRoteiro" (keyup.enter)="criarRoteiro()" />
                </mat-form-field>
                <button mat-stroked-button type="button" [disabled]="!novoRoteiro.trim()" (click)="criarRoteiro()"><mat-icon>add</mat-icon> Criar</button>
              </div>
            }
          </aside>

          <section class="conteudo">
            @if (roteiro(); as r) {
              <div class="secao">
                <div class="cab">
                  @if (podeAlterar()) {
                    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="nome">
                      <mat-label>Nome</mat-label>
                      <input matInput maxlength="200" [(ngModel)]="nome" />
                    </mat-form-field>
                    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="descricao">
                      <mat-label>Descrição (quando usar este roteiro)</mat-label>
                      <input matInput maxlength="2000" [(ngModel)]="descricao" />
                    </mat-form-field>
                    <button mat-stroked-button type="button" [disabled]="!nome.trim()" (click)="salvarRoteiro(r)">Salvar</button>
                    <button mat-icon-button type="button" [matMenuTriggerFor]="menuRoteiro" aria-label="Mais ações do roteiro"><mat-icon>more_vert</mat-icon></button>
                    <mat-menu #menuRoteiro="matMenu">
                      <button mat-menu-item type="button" (click)="importar(r)"><mat-icon>file_upload</mat-icon> Importar planilha</button>
                      <button mat-menu-item type="button" (click)="copiar(r)"><mat-icon>content_copy</mat-icon> Copiar de outro roteiro</button>
                      <button mat-menu-item type="button" (click)="executar(servico.ativarRoteiro(r.codRoteiro, !r.ativo))">
                        <mat-icon>{{ r.ativo ? 'visibility_off' : 'visibility' }}</mat-icon> {{ r.ativo ? 'Inativar' : 'Reativar' }}
                      </button>
                      <button mat-menu-item type="button" [disabled]="r.usos > 0" (click)="excluirRoteiro(r)"><mat-icon>delete</mat-icon> Excluir (nunca usado)</button>
                    </mat-menu>
                  } @else {
                    <h3 class="secao__titulo">{{ r.nome }}</h3>
                    <span class="suave">{{ r.descricao }}</span>
                  }
                </div>
                <p class="suave">
                  Usado em {{ r.usos }} homologaç{{ r.usos === 1 ? 'ão' : 'ões' }}. Mudanças aqui não alteram as já criadas; itens novos aparecem nelas como
                  "itens novos do roteiro padrão" para a gestão trazer.
                  @if (!r.ativo) {
                    <strong>Inativo: não aparece para novas homologações.</strong>
                  }
                </p>
              </div>

              @if (totalItens(r)) {
                <div class="filtros">
                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="filtros__busca">
                    <mat-icon matPrefix>search</mat-icon>
                    <mat-label>Buscar item</mat-label>
                    <input matInput [ngModel]="buscaItem()" (ngModelChange)="buscaItem.set($event)" placeholder="Título, passos, resultado ou agrupamento" />
                  </mat-form-field>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Situação</mat-label>
                    <mat-select [ngModel]="situacaoItem()" (ngModelChange)="situacaoItem.set($event)">
                      <mat-option value="todos">Todos</mat-option>
                      <mat-option value="ativos">Ativos</mat-option>
                      <mat-option value="inativos">Inativos</mat-option>
                    </mat-select>
                  </mat-form-field>
                  @if (filtrando()) {
                    <span class="filtros__total">{{ totalVisiveis(r) }} de {{ totalItens(r) }} itens · subir/descer desligados</span>
                    <button mat-button type="button" (click)="limparFiltros()"><mat-icon>clear_all</mat-icon> Limpar</button>
                  }
                </div>
              }

              @for (grupo of grupos(r); track grupo.nome) {
              @if (r.trabalhaModulo) {
                <div class="modulo-cab">
                  <mat-icon inline>view_module</mat-icon>
                  <strong>{{ grupo.nome }}</strong>
                  <span class="suave">{{ grupo.itens.length }} agrupamento{{ grupo.itens.length === 1 ? '' : 's' }}</span>
                  @if (grupo.codModulo === null && podeAlterar()) {
                    <span class="suave">— marque e classifique:</span>
                    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="classificar">
                      <mat-label>Módulo</mat-label>
                      <mat-select [(ngModel)]="moduloClassificar">
                        @for (m of modulosAtivos(r); track m.codModulo) {
                          <mat-option [value]="m.codModulo">{{ m.nome }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                    <button mat-stroked-button type="button" [disabled]="!paraClassificar().size || !moduloClassificar" (click)="classificar(r)">
                      Classificar {{ paraClassificar().size || '' }}
                    </button>
                  }
                </div>
              }
              @for (a of grupo.itens; track a.codAgrupamento; let primeiro = $first; let ultimo = $last) {
                <div class="secao agrupamento" [class.inativo]="!a.ativo" [class.agrupamento--modulo]="r.trabalhaModulo">
                  <div class="cab">
                    @if (r.trabalhaModulo && grupo.codModulo === null && podeAlterar()) {
                      <mat-checkbox [checked]="paraClassificar().has(a.codAgrupamento)" (change)="marcarClassificar(a.codAgrupamento, $event.checked)" [aria-label]="'Classificar ' + a.nome" />
                    }
                    <strong class="ag-nome">{{ a.nome }}</strong>
                    @if (a.tela) {
                      <span class="tela" matTooltip="Tela do sistema">{{ a.tela }}</span>
                    }
                    @if (!a.ativo) {
                      <app-etiqueta>inativo</app-etiqueta>
                    }
                    <span class="suave">{{ a.itens.length }} itens</span>
                    <span class="espaco"></span>
                    @if (podeAlterar()) {
                      <button mat-icon-button type="button" [disabled]="primeiro || filtrando()" aria-label="Subir agrupamento" (click)="moverAgrupamento(r, grupo.itens, a, -1)"><mat-icon>arrow_upward</mat-icon></button>
                      <button mat-icon-button type="button" [disabled]="ultimo || filtrando()" aria-label="Descer agrupamento" (click)="moverAgrupamento(r, grupo.itens, a, 1)"><mat-icon>arrow_downward</mat-icon></button>
                      <button mat-stroked-button type="button" (click)="editarItem(r, null, a.codAgrupamento)"><mat-icon>add</mat-icon> Item</button>
                      <button mat-icon-button type="button" [matMenuTriggerFor]="menuAg" aria-label="Mais ações do agrupamento"><mat-icon>more_vert</mat-icon></button>
                      <mat-menu #menuAg="matMenu">
                        <button mat-menu-item type="button" (click)="editarAgrupamento(r, a)"><mat-icon>edit</mat-icon> Renomear / tela{{ r.trabalhaModulo ? ' / módulo' : '' }}</button>
                        <button mat-menu-item type="button" (click)="executar(servico.ativarAgrupamento(a.codAgrupamento, !a.ativo))">
                          <mat-icon>{{ a.ativo ? 'visibility_off' : 'visibility' }}</mat-icon> {{ a.ativo ? 'Inativar' : 'Reativar' }}
                        </button>
                        <button mat-menu-item type="button" [disabled]="a.usos > 0 || a.itens.length > 0" (click)="executar(servico.excluirAgrupamento(a.codAgrupamento))">
                          <mat-icon>delete</mat-icon> Excluir (vazio e nunca usado)
                        </button>
                      </mat-menu>
                    }
                  </div>
                  <table class="tabela">
                    <tbody>
                      @for (i of itensVisiveis(a); track i.codRoteiroItem; let pi = $first; let ui = $last) {
                        <tr [class.inativo]="!i.ativo">
                          <td class="item">
                            <strong>{{ i.titulo }}</strong>
                            @if (i.critico) {
                              <span class="critico">crítico</span>
                            }
                            @if (!i.ativo) {
                              <app-etiqueta>inativo</app-etiqueta>
                            }
                            @if (i.passos) {
                              <div class="suave passos">{{ i.passos }}</div>
                            }
                          </td>
                          <td class="suave uso">
                            usado {{ i.usos }}×
                            @if (i.homologacaoOrigem) {
                              <br />veio de {{ i.homologacaoOrigem }}
                            }
                          </td>
                          @if (podeAlterar()) {
                            <td class="acoes">
                              <button mat-icon-button type="button" [disabled]="pi || filtrando()" aria-label="Subir" (click)="moverItem(a, i, -1)"><mat-icon>arrow_upward</mat-icon></button>
                              <button mat-icon-button type="button" [disabled]="ui || filtrando()" aria-label="Descer" (click)="moverItem(a, i, 1)"><mat-icon>arrow_downward</mat-icon></button>
                              <button mat-icon-button type="button" aria-label="Editar" (click)="editarItem(r, i, a.codAgrupamento)"><mat-icon>edit</mat-icon></button>
                              <button mat-icon-button type="button" [matMenuTriggerFor]="menuItem" aria-label="Mais ações do item"><mat-icon>more_vert</mat-icon></button>
                              <mat-menu #menuItem="matMenu">
                                <button mat-menu-item type="button" (click)="executar(servico.ativarItemPadrao(i.codRoteiroItem, !i.ativo))">
                                  <mat-icon>{{ i.ativo ? 'visibility_off' : 'visibility' }}</mat-icon> {{ i.ativo ? 'Inativar' : 'Reativar' }}
                                </button>
                                <button mat-menu-item type="button" [disabled]="i.usos > 0" (click)="executar(servico.excluirItemPadrao(i.codRoteiroItem))">
                                  <mat-icon>delete</mat-icon> Excluir (nunca usado)
                                </button>
                              </mat-menu>
                            </td>
                          }
                        </tr>
                      } @empty {
                        <tr>
                          <td class="vazio">Sem itens.</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
              }

              @if (podeAlterar()) {
                <div class="secao novo">
                  @if (r.trabalhaModulo) {
                    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="novo-modulo">
                      <mat-label>Módulo</mat-label>
                      <mat-select [(ngModel)]="novoModulo">
                        @for (m of modulosAtivos(r); track m.codModulo) {
                          <mat-option [value]="m.codModulo">{{ m.nome }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  }
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Novo agrupamento (ex.: Cadastro de Pacientes)</mat-label>
                    <input matInput maxlength="200" [(ngModel)]="novoAgrupamento" (keyup.enter)="criarAgrupamento(r)" />
                  </mat-form-field>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="nova-tela">
                    <mat-label>Tela (opcional)</mat-label>
                    <input matInput maxlength="100" [(ngModel)]="novaTela" placeholder="Ex.: CAD_PAC" (keyup.enter)="criarAgrupamento(r)" />
                  </mat-form-field>
                  <button mat-stroked-button type="button" [disabled]="!novoAgrupamento.trim() || (r.trabalhaModulo && !novoModulo)" (click)="criarAgrupamento(r)">
                    <mat-icon>add</mat-icon> Agrupamento
                  </button>
                  @if (r.trabalhaModulo && !r.modulos.length) {
                    <span class="suave">{{ r.sistema }} trabalha com módulos, mas não há módulo cadastrado: cadastre em Atualizações › Configuração › Sistemas.</span>
                  }
                </div>
              }
            } @else if (roteirosDoSistema().length) {
              <p class="vazio">Escolha um roteiro.</p>
            }
          </section>
        </div>
      } @else if (!carregando()) {
        <p class="vazio">Escolha o sistema.</p>
      }
    </div>
  `,
  styleUrls: ['../../compartilhado/atualizacao-pagina.scss'],
  styles: `
    .sistema {
      min-width: 320px;
    }

    .colunas {
      display: grid;
      grid-template-columns: minmax(240px, 320px) 1fr;
      gap: 12px;
      align-items: start;
    }

    @media (max-width: 900px) {
      .colunas {
        grid-template-columns: 1fr;
      }
    }

    .roteiro {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      padding: 8px 10px;
      border: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, .12));
      border-radius: 8px;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;

      &--ativo {
        border-color: #1976d2;
        background: color-mix(in srgb, #1976d2 10%, transparent);
      }
    }

    .conteudo {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .cab,
    .novo {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .nome {
      min-width: 220px;
    }

    .descricao {
      flex: 1;
      min-width: 220px;
    }

    .ag-nome {
      font-size: .95rem;
    }

    .tela {
      padding: 0 6px;
      border-radius: 4px;
      font-family: monospace;
      font-size: .75rem;
      background: var(--mat-sys-surface-container-high, rgba(0, 0, 0, .06));
    }

    .nova-tela {
      width: 160px;
    }

    .novo-modulo,
    .classificar {
      width: 220px;
    }

    .modulo-cab {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      padding: 6px 10px;
      border-radius: 8px;
      background: var(--mat-sys-surface-container, rgba(0, 0, 0, .04));
    }

    .agrupamento--modulo {
      margin-left: 16px;
    }

    .inativo {
      opacity: .6;
    }

    .item {
      width: 100%;
    }

    .passos {
      white-space: pre-wrap;
    }

    .uso {
      white-space: nowrap;
    }

    .acoes {
      white-space: nowrap;
    }

    .critico {
      margin-left: 6px;
      padding: 0 6px;
      border-radius: 4px;
      font-size: .7rem;
      color: #fff;
      background: #d32f2f;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomologacaoRoteirosComponent implements OnInit {
  readonly servico = inject(HomologacaoService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(HotToastService);

  readonly catalogo = signal<CatalogoHom | null>(null);
  readonly lista = signal<RoteiroResumo[]>([]);
  readonly codSistema = signal<number | null>(null);
  readonly roteiro = signal<RoteiroPadrao | null>(null);
  readonly carregando = signal(true);

  novoRoteiro = '';
  novoAgrupamento = '';
  novaTela = '';
  nome = '';
  descricao = '';

  readonly podeAlterar = computed(() => !!this.catalogo()?.permissoes.roteiros);
  readonly roteirosDoSistema = computed(() => this.lista().filter(r => r.codSistema === this.codSistema()));

  // ------------------------------------------------------------------ filtros dos itens do roteiro aberto

  readonly buscaItem = signal('');
  readonly situacaoItem = signal<FiltroSituacao>('todos');
  /** Com filtro ligado a ordem mostrada não é a real: subir/descer ficam desligados. */
  readonly filtrando = computed(() => !!this.buscaItem().trim() || this.situacaoItem() !== 'todos');

  /** Item passa se o texto casa com ele ou com o nome do agrupamento (buscar "Faturamento" traz o agrupamento inteiro). */
  itensVisiveis(a: AgrupamentoPadrao): ItemPadrao[] {
    if (!this.filtrando()) {
      return a.itens;
    }
    return a.itens.filter(
      i => passaSituacao(this.situacaoItem(), i.ativo) && contemTexto(this.buscaItem(), a.nome, a.tela, i.titulo, i.passos, i.resultadoEsperado)
    );
  }

  agrupamentosVisiveis(r: RoteiroPadrao): AgrupamentoPadrao[] {
    const modulos = new Map(r.modulos.map(m => [m.codModulo, m.nome]));
    return this.filtrando()
      ? r.agrupamentos.filter(a => this.itensVisiveis(a).length > 0 || (!!this.buscaItem().trim() && contemTexto(this.buscaItem(), modulos.get(a.codModulo ?? -1))))
      : r.agrupamentos;
  }

  // ------------------------------------------------------------------ módulos (D-12, D-16)

  novoModulo: number | null = null;
  moduloClassificar: number | null = null;
  readonly paraClassificar = signal<ReadonlySet<number>>(new Set());

  /** Agrupamentos por módulo (sistema que trabalha com módulos) ou um grupo só; "Sem módulo" no fim, para classificar. */
  grupos(r: RoteiroPadrao) {
    const visiveis = this.agrupamentosVisiveis(r);
    return r.trabalhaModulo ? porModulo(r.modulos, visiveis) : [{ codModulo: null, nome: '', itens: visiveis }];
  }

  modulosAtivos(r: RoteiroPadrao) {
    return r.modulos.filter(m => m.ativo);
  }

  marcarClassificar(codAgrupamento: number, marcado: boolean) {
    this.paraClassificar.update(atual => {
      const novo = new Set(atual);
      if (marcado) novo.add(codAgrupamento);
      else novo.delete(codAgrupamento);
      return novo;
    });
  }

  classificar(r: RoteiroPadrao) {
    const codigos = [...this.paraClassificar()];
    this.servico.classificarAgrupamentos(r.codRoteiro, codigos, this.moduloClassificar!).subscribe({
      next: atualizado => {
        this.paraClassificar.set(new Set());
        this.mostrar(atualizado);
        this.toast.success(`${codigos.length} agrupamento${codigos.length === 1 ? '' : 's'} classificado${codigos.length === 1 ? '' : 's'}.`);
      },
      error: () => {},
    });
  }

  totalItens(r: RoteiroPadrao) {
    return r.agrupamentos.reduce((soma, a) => soma + a.itens.length, 0);
  }

  totalVisiveis(r: RoteiroPadrao) {
    return this.agrupamentosVisiveis(r).reduce((soma, a) => soma + this.itensVisiveis(a).length, 0);
  }

  limparFiltros() {
    this.buscaItem.set('');
    this.situacaoItem.set('todos');
  }

  ngOnInit() {
    this.servico
      .catalogo()
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({ next: c => this.catalogo.set(c), error: () => {} });
    this.recarregarLista();
  }

  qtdRoteiros(codSistema: number) {
    return this.lista().filter(r => r.codSistema === codSistema).length;
  }

  private recarregarLista() {
    this.servico.roteiros().subscribe({ next: l => this.lista.set(l), error: () => {} });
  }

  escolherSistema(cod: number) {
    this.codSistema.set(cod);
    this.roteiro.set(null);
    const primeiro = this.roteirosDoSistema()[0];
    if (primeiro) this.abrir(primeiro.codRoteiro);
  }

  abrir(codRoteiro: number) {
    this.servico.roteiro(codRoteiro).subscribe({ next: r => this.mostrar(r), error: () => {} });
  }

  private mostrar(r: RoteiroPadrao) {
    this.roteiro.set(r);
    this.nome = r.nome;
    this.descricao = r.descricao ?? '';
  }

  /** Comando que devolve o roteiro atualizado. */
  executar(chamada: Observable<RoteiroPadrao>) {
    chamada.subscribe({
      next: r => {
        this.mostrar(r);
        this.recarregarLista();
      },
      error: () => {},
    });
  }

  criarRoteiro() {
    const nome = this.novoRoteiro.trim();
    if (!nome || !this.codSistema()) return;
    this.servico.criarRoteiro(this.codSistema()!, nome, null).subscribe({
      next: r => {
        this.novoRoteiro = '';
        this.mostrar(r);
        this.recarregarLista();
        this.toast.success(`Roteiro "${r.nome}" criado: inclua os agrupamentos e itens.`);
      },
      error: () => {},
    });
  }

  salvarRoteiro(r: RoteiroPadrao) {
    this.executar(this.servico.alterarRoteiro(r.codRoteiro, this.nome.trim(), this.descricao.trim() || null));
  }

  excluirRoteiro(r: RoteiroPadrao) {
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data: { titulo: 'Excluir roteiro', mensagem: `Excluir "${r.nome}" com seus agrupamentos e itens?`, confirmarTexto: 'Excluir', cancelarTexto: 'Voltar' },
      })
      .afterClosed()
      .subscribe(ok => {
        if (!ok) return;
        this.servico.excluirRoteiro(r.codRoteiro).subscribe({
          next: () => {
            this.roteiro.set(null);
            this.recarregarLista();
          },
          error: () => {},
        });
      });
  }

  criarAgrupamento(r: RoteiroPadrao) {
    const nome = this.novoAgrupamento.trim();
    if (!nome) return;
    this.servico.criarAgrupamento(r.codRoteiro, nome, this.novaTela.trim().toUpperCase() || null, r.trabalhaModulo ? this.novoModulo : null).subscribe({
      next: atualizado => {
        this.novoAgrupamento = '';
        this.novaTela = '';
        // O módulo fica escolhido: costuma-se cadastrar vários agrupamentos do mesmo módulo em sequência.
        this.mostrar(atualizado);
        this.recarregarLista();
      },
      error: () => {},
    });
  }

  editarAgrupamento(r: RoteiroPadrao, a: AgrupamentoPadrao) {
    this.dialog
      .open<AgrupamentoDialogComponent, AgrupamentoDialogData, AgrupamentoDialogResultado>(AgrupamentoDialogComponent, {
        data: {
          titulo: 'Agrupamento do roteiro padrão',
          nome: a.nome,
          tela: a.tela,
          existentes: r.agrupamentos.filter(x => x.codAgrupamento !== a.codAgrupamento).map(x => ({ nome: x.nome, codModulo: x.codModulo })),
          modulos: r.trabalhaModulo ? r.modulos : [],
          codModulo: a.codModulo,
        },
      })
      .afterClosed()
      .subscribe(res => {
        if (res && (res.nome !== a.nome || res.tela !== a.tela || res.codModulo !== a.codModulo)) {
          this.executar(this.servico.alterarAgrupamento(a.codAgrupamento, res.nome, res.tela, res.codModulo));
        }
      });
  }

  /** Sobe ou desce dentro do grupo mostrado (o módulo): troca de lugar com o vizinho do grupo na ordem geral. */
  moverAgrupamento(r: RoteiroPadrao, grupo: AgrupamentoPadrao[], a: AgrupamentoPadrao, direcao: number) {
    const vizinho = grupo[grupo.indexOf(a) + direcao];
    if (!vizinho) return;
    const codigos = r.agrupamentos.map(x => x.codAgrupamento);
    const i = codigos.indexOf(a.codAgrupamento);
    const j = codigos.indexOf(vizinho.codAgrupamento);
    [codigos[i], codigos[j]] = [codigos[j], codigos[i]];
    this.executar(this.servico.reordenarAgrupamentos(r.codRoteiro, codigos));
  }

  moverItem(a: AgrupamentoPadrao, item: ItemPadrao, direcao: number) {
    const codigos = a.itens.map(x => x.codRoteiroItem);
    const i = codigos.indexOf(item.codRoteiroItem);
    [codigos[i], codigos[i + direcao]] = [codigos[i + direcao], codigos[i]];
    this.executar(this.servico.reordenarItensPadrao(a.codAgrupamento, codigos));
  }

  importar(r: RoteiroPadrao) {
    this.dialog
      .open<ImportarRoteiroDialogComponent, ImportarDialogData, ImportacaoRoteiro>(ImportarRoteiroDialogComponent, { data: { roteiro: r } })
      .afterClosed()
      .subscribe(resultado => this.aplicarCarga(resultado));
  }

  copiar(r: RoteiroPadrao) {
    this.dialog
      .open<CopiarRoteiroDialogComponent, CopiarDialogData, ImportacaoRoteiro>(CopiarRoteiroDialogComponent, {
        data: { destino: r, sistemas: this.catalogo()?.sistemas ?? [], roteiros: this.lista() },
      })
      .afterClosed()
      .subscribe(resultado => this.aplicarCarga(resultado));
  }

  private aplicarCarga(resultado: ImportacaoRoteiro | undefined) {
    if (!resultado?.roteiro) return;
    this.mostrar(resultado.roteiro);
    this.recarregarLista();
    this.toast.success(
      `${resultado.itensNovos} ${resultado.itensNovos === 1 ? 'item incluído' : 'itens incluídos'}` +
        (resultado.agrupamentosNovos ? ` em ${resultado.agrupamentosNovos} agrupamento(s) novo(s)` : '') +
        (resultado.itensRepetidos ? `; ${resultado.itensRepetidos} repetido(s) ficaram de fora` : '') +
        '.'
    );
  }

  editarItem(r: RoteiroPadrao, item: ItemPadrao | null, codAgrupamento: number) {
    this.dialog
      .open<ItemPadraoDialogComponent, ItemPadraoDialogData, ItemPadraoRequest>(ItemPadraoDialogComponent, { data: { roteiro: r, item, codAgrupamento } })
      .afterClosed()
      .subscribe(dados => {
        if (!dados) return;
        this.executar(item ? this.servico.alterarItemPadrao(item.codRoteiroItem, dados) : this.servico.criarItemPadrao(dados));
      });
  }
}
