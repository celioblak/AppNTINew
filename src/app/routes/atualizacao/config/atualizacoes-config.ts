import { ComponentType } from '@angular/cdk/portal';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MtxDialog } from '@ng-matero/extensions/dialog';
import { HotToastService } from '@ngxpert/hot-toast';
import { Observable, finalize } from 'rxjs';

import {
  AMBIENTE_ROTULO,
  Ambiente,
  Catalogo,
  METODO_ROTULO,
  MapeamentoJar,
  MetodoArtefato,
  SistemaAmbiente,
  SistemaResumo,
  TipoArtefato,
} from '../atualizacao.models';
import { AtualizacaoService } from '../atualizacao.service';
import { FiltroSituacao, contemTexto, passaSituacao } from '../compartilhado/filtro';
import { EtiquetaComponent } from '../compartilhado/situacao-chip';
import { AmbienteDialogComponent, ConfigDialogData, MapeamentoDialogComponent, TipoDialogComponent } from './config-dialogs';
import { HomologacaoService } from '../homologacao/homologacao.service';

/** Atualizações > Configuração (T-09): tipos, sistemas por ambiente, mapeamentos de JAR, sistemas e regras. */
@Component({
  selector: 'app-atualizacoes-config',
  imports: [
    NgTemplateOutlet,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTabsModule,
    MatTooltipModule,
    EtiquetaComponent,
    RouterLink,
  ],
  template: `
    <div class="pagina">
      @if (carregando()) {
        <mat-progress-bar mode="indeterminate" />
      }
      @if (catalogo(); as c) {
        <mat-tab-group animationDuration="0ms" mat-stretch-tabs="false">
          <mat-tab [label]="'Sistemas por ambiente (' + total(ambientesFiltrados().length, c.ambientes.length) + ')'">
            <div class="aba">
              <div class="barra">
                <span class="suave">
                  Os destinos de cada artefato saem daqui: serviços na ordem, diretório por tipo e banco/schema. Sistema, versão e quais
                  serviços fazem parte são mantidos em Infraestrutura; aqui fica a publicação (ordem, tipos, banco e passo manual).
                </span>
                <span class="espaco"></span>
                <a mat-stroked-button routerLink="/infraestrutura/sistemas-servicos"><mat-icon>apps</mat-icon> Sistemas e serviços</a>
              </div>
              <div class="filtros">
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="filtros__busca">
                  <mat-icon matPrefix>search</mat-icon>
                  <mat-label>Buscar</mat-label>
                  <input matInput [ngModel]="buscaAmbiente()" (ngModelChange)="buscaAmbiente.set($event)" placeholder="Sistema, processo, diretório, versão ou banco" />
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Ambiente</mat-label>
                  <mat-select [ngModel]="filtroAmbiente()" (ngModelChange)="filtroAmbiente.set($event)">
                    <mat-option value="">Todos</mat-option>
                    @for (a of ambientes; track a) {
                      <mat-option [value]="a">{{ ambienteRotulo[a] }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                @if (ambientesFiltrados().length !== c.ambientes.length) {
                  <span class="filtros__total">{{ ambientesFiltrados().length }} de {{ c.ambientes.length }}</span>
                  <button mat-button type="button" (click)="limparFiltrosAmbiente()"><mat-icon>clear_all</mat-icon> Limpar</button>
                }
              </div>
              <div class="rolagem">
                <table class="tabela">
                  <thead>
                    <tr><th>Sistema</th><th>Ambiente</th><th>Versão instalada</th><th>Processos, na ordem</th><th>Tipos e diretórios</th><th>Banco / schema</th><th class="acoes"></th></tr>
                  </thead>
                  <tbody>
                    @for (a of ambientesFiltrados(); track a.codSistemaAmbiente) {
                      <tr>
                        <td><strong>{{ a.sistema }}</strong></td>
                        <td>{{ ambienteRotulo[a.ambiente] }}</td>
                        <td class="mono">{{ a.versao ?? '—' }}</td>
                        <td>
                          <ol class="lista">
                            @for (p of a.processos; track p.codProcesso) {
                              <li>{{ p.aplicacao }}@if (p.porta) {<span class="suave"> · porta {{ p.porta }}</span>}</li>
                            } @empty {
                              <span class="suave">—</span>
                            }
                          </ol>
                          @if (a.passoManual) {
                            <span class="suave">Passo manual: {{ a.passoManual }}</span>
                          }
                        </td>
                        <td>
                          <ul class="lista lista--simples">
                            @for (t of a.tipos; track t.codTipoArtefato) {
                              <li>
                                <span>{{ t.tipo }}</span> → <code>{{ t.diretorio }}</code>
                                @if (t.exigeReinicio) {
                                  <span class="suave" [matTooltip]="t.comandoReinicio ?? ''"> · reinicia</span>
                                }
                              </li>
                            } @empty {
                              <span class="suave">—</span>
                            }
                          </ul>
                        </td>
                        <td>{{ a.banco ?? '—' }}</td>
                        <td class="acoes">
                          <button mat-icon-button type="button" (click)="editarAmbiente(a)" matTooltip="Editar" aria-label="Editar configuração"><mat-icon>edit</mat-icon></button>
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="7" class="vazio">
                          {{ c.ambientes.length ? 'Nenhuma configuração com esses filtros.' : 'Nenhum sistema configurado. Sem isso, os artefatos não têm destino.' }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </mat-tab>

          <mat-tab [label]="'Mapeamentos de JAR (' + total(mapeamentosFiltrados().length, c.mapeamentos.length) + ')'">
            <div class="aba">
              <div class="barra">
                <span class="suave">
                  Pasta do pacote do fabricante → JAR da aplicação → caminho dentro do JAR. Usado quando o fabricante manda telas e classes
                  soltas para substituir dentro de um JAR.
                </span>
                <span class="espaco"></span>
                <button mat-flat-button type="button" (click)="editarMapeamento()"><mat-icon>add</mat-icon> Novo mapeamento</button>
              </div>
              <div class="filtros">
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="filtros__busca">
                  <mat-icon matPrefix>search</mat-icon>
                  <mat-label>Buscar</mat-label>
                  <input matInput [ngModel]="buscaMapeamento()" (ngModelChange)="buscaMapeamento.set($event)" placeholder="Pasta, JAR ou caminho (ex.: admpac forms)" />
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Sistema</mat-label>
                  <mat-select [ngModel]="filtroMapeamentoSistema()" (ngModelChange)="filtroMapeamentoSistema.set($event)">
                    <mat-option [value]="null">Todos</mat-option>
                    @for (s of sistemasDosMapeamentos(); track s.cod) {
                      <mat-option [value]="s.cod">{{ s.rotulo }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Tipo</mat-label>
                  <mat-select [ngModel]="filtroMapeamentoTipo()" (ngModelChange)="filtroMapeamentoTipo.set($event)">
                    <mat-option [value]="null">Todos</mat-option>
                    @for (t of tiposDosMapeamentos(); track t.cod) {
                      <mat-option [value]="t.cod">{{ t.rotulo }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <ng-container *ngTemplateOutlet="situacao; context: { $implicit: filtroMapeamentoSituacao }" />
                @if (mapeamentosFiltrados().length !== c.mapeamentos.length) {
                  <span class="filtros__total">{{ mapeamentosFiltrados().length }} de {{ c.mapeamentos.length }}</span>
                  <button mat-button type="button" (click)="limparFiltrosMapeamento()"><mat-icon>clear_all</mat-icon> Limpar</button>
                }
              </div>
              <div class="rolagem">
                <table class="tabela">
                  <thead>
                    <tr><th>Sistema</th><th>Pasta no pacote</th><th>JAR</th><th>Caminho no JAR</th><th>Tipo</th><th class="acoes"></th></tr>
                  </thead>
                  <tbody>
                    @for (m of mapeamentosFiltrados(); track m.codMapeamento) {
                      <tr>
                        <td>{{ m.sistema }}</td>
                        <td>
                          <div class="celula">
                            <code>{{ m.pasta }}</code>
                            @if (!m.ativo) {
                              <app-etiqueta>Inativo</app-etiqueta>
                            }
                          </div>
                        </td>
                        <td><code>{{ m.jarPadrao }}</code></td>
                        <td><code>{{ m.caminhoInterno }}</code></td>
                        <td>{{ m.tipo }}</td>
                        <td class="acoes">
                          <button mat-icon-button type="button" (click)="copiarMapeamento(m)" matTooltip="Duplicar para outra pasta" aria-label="Duplicar mapeamento"><mat-icon>content_copy</mat-icon></button>
                          <button mat-icon-button type="button" (click)="editarMapeamento(m)" matTooltip="Editar" aria-label="Editar mapeamento"><mat-icon>edit</mat-icon></button>
                          <button mat-icon-button type="button" (click)="excluirMapeamento(m)" matTooltip="Excluir (só sem uso)" aria-label="Excluir mapeamento"><mat-icon>delete</mat-icon></button>
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="6" class="vazio">
                          @if (c.mapeamentos.length) {
                            Nenhum mapeamento com esses filtros.
                          } @else {
                            Nenhum mapeamento. Ex.: ATEND\\admpac\\forms → soul-admpac-forms-&lt;versao&gt;.jar → br/com/mv/soul/admpac/forms
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </mat-tab>

          <mat-tab [label]="'Tipos de artefato (' + total(tiposFiltrados().length, c.tipos.length) + ')'">
            <div class="aba">
              <div class="barra">
                <span class="suave">Cadastro livre. O método é fixo em código e define como é o backup e a aplicação.</span>
                <span class="espaco"></span>
                <button mat-flat-button type="button" (click)="editarTipo()"><mat-icon>add</mat-icon> Novo tipo</button>
              </div>
              <div class="filtros">
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="filtros__busca">
                  <mat-icon matPrefix>search</mat-icon>
                  <mat-label>Buscar</mat-label>
                  <input matInput [ngModel]="buscaTipo()" (ngModelChange)="buscaTipo.set($event)" placeholder="Nome, extensão ou verificação" />
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Método</mat-label>
                  <mat-select [ngModel]="filtroTipoMetodo()" (ngModelChange)="filtroTipoMetodo.set($event)">
                    <mat-option value="">Todos</mat-option>
                    @for (m of metodos; track m) {
                      <mat-option [value]="m">{{ metodoRotulo[m] }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <ng-container *ngTemplateOutlet="situacao; context: { $implicit: filtroTipoSituacao }" />
                @if (tiposFiltrados().length !== c.tipos.length) {
                  <span class="filtros__total">{{ tiposFiltrados().length }} de {{ c.tipos.length }}</span>
                  <button mat-button type="button" (click)="limparFiltrosTipo()"><mat-icon>clear_all</mat-icon> Limpar</button>
                }
              </div>
              <div class="rolagem">
                <table class="tabela">
                  <thead>
                    <tr><th>Tipo</th><th>Extensões</th><th>Método</th><th>Verificação padrão</th><th>Configurado em</th><th class="acoes"></th></tr>
                  </thead>
                  <tbody>
                    @for (t of tiposFiltrados(); track t.codTipoArtefato) {
                      <tr>
                        <td>
                          <div class="celula">
                            <strong>{{ t.nome }}</strong>
                            @if (!t.ativo) {
                              <app-etiqueta>Inativo</app-etiqueta>
                            }
                          </div>
                        </td>
                        <td><code>{{ t.extensoes ?? '—' }}</code></td>
                        <td>{{ metodoRotulo[t.metodo] }}</td>
                        <td>{{ t.verificacao ?? '—' }}</td>
                        <td>{{ t.metodo === 'ARQUIVO' ? (usosDoTipo()[t.codTipoArtefato!] ?? 0) + ' sistema/ambiente' : 'banco/schema' }}</td>
                        <td class="acoes">
                          <button mat-icon-button type="button" (click)="editarTipo(t)" matTooltip="Editar" aria-label="Editar tipo"><mat-icon>edit</mat-icon></button>
                          <button mat-icon-button type="button" (click)="excluirTipo(t)" matTooltip="Excluir (só sem uso)" aria-label="Excluir tipo"><mat-icon>delete</mat-icon></button>
                        </td>
                      </tr>
                    } @empty {
                      <tr><td colspan="6" class="vazio">{{ c.tipos.length ? 'Nenhum tipo com esses filtros.' : 'Nenhum tipo cadastrado.' }}</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </mat-tab>

          <mat-tab [label]="'Sistemas (' + total(sistemasFiltrados().length, c.sistemas.length) + ')'">
            <div class="aba">
              <div class="barra">
                <span class="suave">Cadastro de sistemas e módulos: mantido em Infraestrutura › Sistemas e Serviços (somente leitura aqui).</span>
                <span class="espaco"></span>
                <a mat-stroked-button routerLink="/infraestrutura/sistemas-servicos"><mat-icon>apps</mat-icon> Sistemas e serviços</a>
              </div>
              <div class="filtros">
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="filtros__busca">
                  <mat-icon matPrefix>search</mat-icon>
                  <mat-label>Buscar</mat-label>
                  <input matInput [ngModel]="buscaSistema()" (ngModelChange)="buscaSistema.set($event)" placeholder="Nome ou código" />
                </mat-form-field>
                <ng-container *ngTemplateOutlet="situacao; context: { $implicit: filtroSistemaSituacao }" />
                @if (sistemasFiltrados().length !== c.sistemas.length) {
                  <span class="filtros__total">{{ sistemasFiltrados().length }} de {{ c.sistemas.length }}</span>
                  <button mat-button type="button" (click)="limparFiltrosSistema()"><mat-icon>clear_all</mat-icon> Limpar</button>
                }
              </div>
              <div class="rolagem">
                <table class="tabela">
                  <thead>
                    <tr><th>Código</th><th>Sistema</th><th>Módulos</th><th>Situação</th><th class="acoes"></th></tr>
                  </thead>
                  <tbody>
                    @for (s of sistemasFiltrados(); track s.codSistema) {
                      <tr>
                        <td class="mono">{{ s.codSistema }}</td>
                        <td><strong>{{ s.nome }}</strong></td>
                        <td class="suave">{{ s.trabalhaModulo ? modulosAtivos(s) : '—' }}</td>
                        <td>
                          <app-etiqueta [tom]="s.ativo ? 'sucesso' : 'neutro'">{{ s.ativo ? 'Ativo' : 'Inativo' }}</app-etiqueta>
                        </td>
                        <td class="acoes">
                        </td>
                      </tr>
                    } @empty {
                      <tr><td colspan="5" class="vazio">{{ c.sistemas.length ? 'Nenhum sistema com esses filtros.' : 'Nenhum sistema cadastrado.' }}</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </mat-tab>

          <mat-tab label="Regras">
            <div class="aba">
              <section class="secao regras">
                <h2 class="secao__titulo">Regras do processo</h2>
                <span class="suave">Valem para todas as atualizações e mudam aqui mesmo, sem republicar o sistema.</span>

                <mat-slide-toggle name="validador" [(ngModel)]="regras.validadorDiferente">
                  Quem registrou a aplicação em homologação não pode validar (R-06)
                </mat-slide-toggle>
                <span class="suave">
                  Desligue quando quem aplica também homologa — é o caso de equipes pequenas. Ligada, a validação fica para outra pessoa
                  com acesso à tela.
                </span>

                <div class="regras__linha">
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Dias de observação antes de concluir</mat-label>
                    <input matInput type="number" name="dias" [(ngModel)]="regras.diasObservacao" min="0" max="365" />
                    <mat-hint>0 = sem prazo</mat-hint>
                  </mat-form-field>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Tolerância antes da janela (minutos)</mat-label>
                    <input matInput type="number" name="tolerancia" [(ngModel)]="regras.toleranciaJanelaMinutos" min="0" max="1440" />
                    <mat-hint>Quanto antes da janela já é possível registrar a produção</mat-hint>
                  </mat-form-field>
                  <button mat-flat-button type="button" [disabled]="salvandoRegras()" (click)="salvarRegras()">
                    <mat-icon>save</mat-icon> Salvar regras
                  </button>
                </div>
              </section>

              <section class="secao regras">
                <h2 class="secao__titulo">Homologações de versão</h2>
                <mat-slide-toggle name="homParticipantes" [ngModel]="regrasHomologacao().participantesIncluemItens" (ngModelChange)="regrasHomologacao.set({ participantesIncluemItens: $event })">
                  Participantes também incluem itens "só nesta homologação" (padrão de novas homologações)
                </mat-slide-toggle>
                <span class="suave">
                  Desligado, só a gestão inclui. Cada homologação pode mudar no próprio cadastro. Gravar também no roteiro padrão exige
                  a tela Roteiros de homologação.
                </span>
                <div class="regras__linha">
                  <button mat-flat-button type="button" [disabled]="salvandoRegras()" (click)="salvarRegrasHomologacao()">
                    <mat-icon>save</mat-icon> Salvar
                  </button>
                </div>
              </section>

              <p class="suave">Estas continuam no application.properties do backend (app.atualizacao.*) e exigem nova publicação:</p>
              <dl class="dl secao">
                <dt>Tamanho máximo por arquivo</dt>
                <dd>{{ c.regras.tamanhoMaximoMb }} MB <code class="suave">tamanho-maximo-mb</code></dd>
                <dt>Repositório de arquivos</dt>
                <dd [class.falha]="!c.regras.repositorioConfigurado">
                  {{ c.regras.repositorioConfigurado ? 'Configurado' : 'Não configurado: envios de arquivo vão falhar' }}
                  <code class="suave">repositorio</code>
                </dd>
                <dt>Modo de execução</dt>
                <dd>Manual (F-1): o sistema não acessa servidores nem bancos. JARs com conteúdo são montados no repositório e baixados pelo técnico.</dd>
              </dl>
            </div>
          </mat-tab>
        </mat-tab-group>
      }
    </div>

    <!-- Filtro de situação, igual em todas as abas: recebe o signal que guarda a escolha -->
    <ng-template #situacao let-filtro>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Situação</mat-label>
        <mat-select [ngModel]="filtro()" (ngModelChange)="filtro.set($event)">
          <mat-option value="todos">Todos</mat-option>
          <mat-option value="ativos">Ativos</mat-option>
          <mat-option value="inativos">Inativos</mat-option>
        </mat-select>
      </mat-form-field>
    </ng-template>
  `,
  styleUrls: ['../compartilhado/atualizacao-pagina.scss'],
  styles: `
    .aba {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-top: 12px;

      > p {
        margin: 0;
      }
    }

    .lista {
      margin: 0;
      padding-left: 18px;
    }

    .lista--simples {
      padding-left: 0;
      list-style: none;
    }

    .regras__linha {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 12px;
      padding-top: 4px;

      mat-form-field {
        flex: 1 1 260px;
      }

      button {
        margin-top: 6px;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AtualizacoesConfigComponent implements OnInit {
  private readonly service = inject(AtualizacaoService);
  private readonly homologacaoService = inject(HomologacaoService);
  private readonly dialog = inject(MatDialog);
  private readonly mtxDialog = inject(MtxDialog);
  private readonly toast = inject(HotToastService);

  readonly metodoRotulo = METODO_ROTULO;
  readonly ambienteRotulo = AMBIENTE_ROTULO;
  readonly catalogo = signal<Catalogo | null>(null);
  readonly carregando = signal(true);
  readonly salvandoRegras = signal(false);
  /** Cópia editável das regras do processo; o restante do catálogo é só leitura. */
  regras = { validadorDiferente: true, diasObservacao: 0, toleranciaJanelaMinutos: 60 };

  readonly ambientesOrdenados = computed(() =>
    [...(this.catalogo()?.ambientes ?? [])].sort(
      (a, b) => (a.sistema ?? '').localeCompare(b.sistema ?? '') || ordemAmbiente(a.ambiente) - ordemAmbiente(b.ambiente)
    )
  );

  readonly mapeamentosOrdenados = computed(() =>
    [...(this.catalogo()?.mapeamentos ?? [])].sort((a, b) => (a.sistema ?? '').localeCompare(b.sistema ?? '') || a.pasta.localeCompare(b.pasta))
  );

  // ------------------------------------------------------------------ filtros (na tela, sobre o catálogo carregado)

  readonly ambientes = Object.keys(AMBIENTE_ROTULO) as Ambiente[];
  readonly metodos = Object.keys(METODO_ROTULO) as MetodoArtefato[];

  readonly buscaAmbiente = signal('');
  readonly filtroAmbiente = signal<Ambiente | ''>('');
  readonly ambientesFiltrados = computed(() =>
    this.ambientesOrdenados().filter(
      a =>
        (!this.filtroAmbiente() || a.ambiente === this.filtroAmbiente()) &&
        contemTexto(
          this.buscaAmbiente(),
          a.sistema,
          AMBIENTE_ROTULO[a.ambiente],
          a.versao,
          a.banco,
          a.passoManual,
          ...a.processos.map(p => p.aplicacao),
          ...a.tipos.flatMap(t => [t.tipo, t.diretorio])
        )
    )
  );

  readonly buscaMapeamento = signal('');
  readonly filtroMapeamentoSistema = signal<number | null>(null);
  readonly filtroMapeamentoTipo = signal<number | null>(null);
  readonly filtroMapeamentoSituacao = signal<FiltroSituacao>('todos');
  /** Só os sistemas e tipos que aparecem nos mapeamentos, para o seletor não listar opção vazia. */
  readonly sistemasDosMapeamentos = computed(() => opcoes(this.catalogo()?.mapeamentos ?? [], m => m.codSistema, m => m.sistema));
  readonly tiposDosMapeamentos = computed(() => opcoes(this.catalogo()?.mapeamentos ?? [], m => m.codTipoArtefato, m => m.tipo));
  readonly mapeamentosFiltrados = computed(() =>
    this.mapeamentosOrdenados().filter(
      m =>
        (this.filtroMapeamentoSistema() === null || m.codSistema === this.filtroMapeamentoSistema()) &&
        (this.filtroMapeamentoTipo() === null || m.codTipoArtefato === this.filtroMapeamentoTipo()) &&
        passaSituacao(this.filtroMapeamentoSituacao(), m.ativo) &&
        contemTexto(this.buscaMapeamento(), m.sistema, m.pasta, m.jarPadrao, m.caminhoInterno, m.tipo)
    )
  );

  readonly buscaTipo = signal('');
  readonly filtroTipoMetodo = signal<MetodoArtefato | ''>('');
  readonly filtroTipoSituacao = signal<FiltroSituacao>('todos');
  readonly tiposFiltrados = computed(() =>
    (this.catalogo()?.tipos ?? []).filter(
      t =>
        (!this.filtroTipoMetodo() || t.metodo === this.filtroTipoMetodo()) &&
        passaSituacao(this.filtroTipoSituacao(), t.ativo) &&
        contemTexto(this.buscaTipo(), t.nome, t.extensoes, t.verificacao, METODO_ROTULO[t.metodo])
    )
  );

  readonly buscaSistema = signal('');
  readonly filtroSistemaSituacao = signal<FiltroSituacao>('todos');
  readonly sistemasFiltrados = computed(() =>
    (this.catalogo()?.sistemas ?? []).filter(
      s => passaSituacao(this.filtroSistemaSituacao(), s.ativo) && contemTexto(this.buscaSistema(), s.nome, s.codSistema, this.modulosAtivos(s))
    )
  );

  limparFiltrosAmbiente() {
    this.buscaAmbiente.set('');
    this.filtroAmbiente.set('');
  }

  limparFiltrosMapeamento() {
    this.buscaMapeamento.set('');
    this.filtroMapeamentoSistema.set(null);
    this.filtroMapeamentoTipo.set(null);
    this.filtroMapeamentoSituacao.set('todos');
  }

  limparFiltrosTipo() {
    this.buscaTipo.set('');
    this.filtroTipoMetodo.set('');
    this.filtroTipoSituacao.set('todos');
  }

  /** Módulos ativos, na ordem do cadastro (homologação de versão, D-11). */
  modulosAtivos(s: SistemaResumo) {
    return (s.modulos ?? []).filter(m => m.ativo).map(m => m.nome).join(', ');
  }

  limparFiltrosSistema() {
    this.buscaSistema.set('');
    this.filtroSistemaSituacao.set('todos');
  }

  /** "12" ou "3 de 12" quando o filtro esconde algum. */
  total(filtrados: number, todos: number) {
    return filtrados === todos ? `${todos}` : `${filtrados} de ${todos}`;
  }

  readonly usosDoTipo = computed(() => {
    const usos: Record<number, number | undefined> = {};
    for (const config of this.catalogo()?.ambientes ?? []) {
      for (const t of config.tipos) {
        if (t.codTipoArtefato) {
          usos[t.codTipoArtefato] = (usos[t.codTipoArtefato] ?? 0) + 1;
        }
      }
    }
    return usos;
  });

  ngOnInit() {
    this.carregar();
    this.carregarRegrasHomologacao();
  }

  carregar() {
    this.carregando.set(true);
    this.service
      .catalogo()
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({
        next: c => {
          this.catalogo.set(c);
          this.regras = {
            validadorDiferente: c.regras.validadorDiferente,
            diasObservacao: c.regras.diasObservacao,
            toleranciaJanelaMinutos: c.regras.toleranciaJanelaMinutos,
          };
        },
        error: () => {},
      });
  }

  /** Regras da homologação de versão (D-04), no mesmo lugar das regras das atualizações. */
  readonly regrasHomologacao = signal({ participantesIncluemItens: false });

  private carregarRegrasHomologacao() {
    this.homologacaoService.regras().subscribe({ next: r => this.regrasHomologacao.set({ ...r }), error: () => {} });
  }

  salvarRegrasHomologacao() {
    this.salvandoRegras.set(true);
    this.homologacaoService
      .salvarRegras(this.regrasHomologacao())
      .pipe(finalize(() => this.salvandoRegras.set(false)))
      .subscribe({ next: () => this.toast.success('Regra das homologações salva.'), error: () => {} });
  }

  salvarRegras() {
    this.salvandoRegras.set(true);
    this.service
      .salvarRegras(this.regras)
      .pipe(finalize(() => this.salvandoRegras.set(false)))
      .subscribe({
        next: () => {
          this.toast.success('Regras salvas. Valem a partir de agora, sem republicar.');
          this.carregar();
        },
        error: () => {},
      });
  }

  editarTipo(tipo?: TipoArtefato) {
    this.abrir(TipoDialogComponent, tipo, 'Tipo salvo.');
  }

  editarAmbiente(config?: SistemaAmbiente) {
    this.abrir(AmbienteDialogComponent, config, 'Configuração salva.', '960px');
  }

  editarMapeamento(mapeamento?: MapeamentoJar) {
    this.abrir(MapeamentoDialogComponent, mapeamento, 'Mapeamento salvo.', '720px');
  }

  /** Mesmo sistema, tipo e padrões: só muda o módulo na pasta, no JAR e no caminho interno. */
  copiarMapeamento(mapeamento: MapeamentoJar) {
    this.abrir(MapeamentoDialogComponent, { ...mapeamento, codMapeamento: null, ativo: true }, 'Mapeamento criado.', '720px');
  }

  excluirTipo(tipo: TipoArtefato) {
    this.confirmarExclusao(`Excluir o tipo "${tipo.nome}"?`, () => this.service.excluirTipo(tipo.codTipoArtefato!));
  }

  excluirMapeamento(mapeamento: MapeamentoJar) {
    this.confirmarExclusao(`Excluir o mapeamento de ${mapeamento.pasta}?`, () => this.service.excluirMapeamento(mapeamento.codMapeamento!));
  }

  private abrir<C, T>(componente: ComponentType<C>, registro: T | undefined, mensagem: string, largura = '620px') {
    const catalogo = this.catalogo();
    if (!catalogo) {
      return;
    }
    this.dialog
      .open<C, ConfigDialogData<T>, boolean>(componente, { width: largura, maxWidth: '95vw', data: { catalogo, registro } })
      .afterClosed()
      .subscribe(salvo => {
        if (salvo) {
          this.toast.success(mensagem);
          this.carregar();
        }
      });
  }

  private confirmarExclusao(titulo: string, acao: () => Observable<void>) {
    this.mtxDialog.confirm(titulo, 'Esta ação não pode ser desfeita.', () =>
      acao().subscribe({
        next: () => {
          this.toast.success('Excluído.');
          this.carregar();
        },
        error: () => {},
      })
    );
  }
}

function ordemAmbiente(ambiente: string) {
  return ['HOMOLOGACAO', 'PRODUCAO', 'TREINAMENTO'].indexOf(ambiente);
}

/** Opções distintas (código e nome) de uma lista, em ordem alfabética. */
function opcoes<T>(lista: T[], codigo: (x: T) => number | null, nome: (x: T) => string | null | undefined) {
  const mapa = new Map<number, string>();
  for (const item of lista) {
    const cod = codigo(item);
    if (cod !== null && !mapa.has(cod)) {
      mapa.set(cod, nome(item) ?? `#${cod}`);
    }
  }
  return [...mapa].map(([cod, rotulo]) => ({ cod, rotulo })).sort((a, b) => a.rotulo.localeCompare(b.rotulo));
}
