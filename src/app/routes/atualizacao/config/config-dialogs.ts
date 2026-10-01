import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable, finalize } from 'rxjs';

import {
  AMBIENTE_ROTULO,
  Ambiente,
  Aplicacao,
  Catalogo,
  METODO_ROTULO,
  MapeamentoJar,
  MetodoArtefato,
  SistemaAmbiente,
  SistemaTipo,
  TipoArtefato,
  normalizarTexto,
  usaVersao,
} from '../atualizacao.models';
import { AtualizacaoService } from '../atualizacao.service';

export interface ConfigDialogData<T> {
  catalogo: Catalogo;
  registro?: T;
}

const ESTILO_CAMPOS = `
  .campos {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-top: 8px !important;
  }

  .dica {
    margin: 0 0 8px;
    font-size: .8rem;
    line-height: 1.4;
    color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
  }

  .dica code {
    font-size: .76rem;
  }

  .linha {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  @media (max-width: 560px) {
    .linha {
      grid-template-columns: minmax(0, 1fr);
    }
  }
`;

/** Fecha com true quando salvou; o errorInterceptor mostra as mensagens do backend. */
function salvarE(pedido: Observable<unknown>, salvando: ReturnType<typeof signal<boolean>>, fechar: () => void) {
  salvando.set(true);
  pedido.pipe(finalize(() => salvando.set(false))).subscribe({ next: fechar, error: () => {} });
}

// ------------------------------------------------------------------ tipo de artefato

@Component({
  selector: 'app-atualizacao-tipo-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule],
  template: `
    <h2 mat-dialog-title>{{ data.registro ? 'Tipo ' + data.registro.nome : 'Novo tipo de artefato' }}</h2>
    <form #form="ngForm" (ngSubmit)="salvar()">
      <mat-dialog-content class="campos">
        <mat-form-field appearance="outline">
          <mat-label>Nome</mat-label>
          <input matInput name="nome" [(ngModel)]="tipo.nome" required maxlength="60" autocomplete="off" cdkFocusInitial />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Método</mat-label>
          <mat-select name="metodo" [(ngModel)]="tipo.metodo" required>
            @for (m of metodos; track m) {
              <mat-option [value]="m">{{ metodoRotulo[m] }}</mat-option>
            }
          </mat-select>
          <mat-hint>Cópia de arquivo vai para os processos do sistema; DDL e script vão para o banco/schema</mat-hint>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Extensões</mat-label>
          <input matInput name="extensoes" [(ngModel)]="tipo.extensoes" maxlength="200" autocomplete="off" placeholder=".jar, .war" />
          <mat-hint>Sugerem o tipo quando o arquivo é enviado</mat-hint>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Forma de verificação padrão</mat-label>
          <input matInput name="verificacao" [(ngModel)]="tipo.verificacao" maxlength="500" autocomplete="off" />
        </mat-form-field>
        @if (data.registro) {
          <mat-slide-toggle name="ativo" [(ngModel)]="tipo.ativo">Ativo</mat-slide-toggle>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="form.invalid || salvando()">Salvar</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: ESTILO_CAMPOS,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TipoDialogComponent {
  readonly data = inject<ConfigDialogData<TipoArtefato>>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<TipoDialogComponent, boolean>>(MatDialogRef);
  private readonly service = inject(AtualizacaoService);

  readonly metodoRotulo = METODO_ROTULO;
  readonly metodos = Object.keys(METODO_ROTULO) as MetodoArtefato[];
  readonly salvando = signal(false);
  tipo: TipoArtefato = this.data.registro
    ? { ...this.data.registro }
    : { codTipoArtefato: null, nome: '', extensoes: null, metodo: 'ARQUIVO', verificacao: null, ativo: true };

  salvar() {
    salvarE(this.service.salvarTipo(this.tipo), this.salvando, () => this.dialogRef.close(true));
  }
}

// ------------------------------------------------------------------ sistema em um ambiente

@Component({
  selector: 'app-atualizacao-ambiente-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  template: `
    <h2 mat-dialog-title>
      {{ data.registro ? (data.registro.sistema ?? 'Sistema') + ' · ' + ambienteRotulo[data.registro.ambiente] : 'Configurar sistema em um ambiente' }}
    </h2>
    <form #form="ngForm" (ngSubmit)="salvar()">
      <mat-dialog-content class="campos">
        <p class="dica">
          De onde saem os destinos dos artefatos: os arquivos vão para os processos, na ordem, no diretório do tipo; scripts e DDL vão para
          o banco/schema. Alterações valem para artefatos novos ou ao usar "Recalcular destinos".
        </p>
        <div class="linha">
          <mat-form-field appearance="outline">
            <mat-label>Sistema</mat-label>
            <mat-select name="sistema" [(ngModel)]="config.codSistema" required [disabled]="!!data.registro">
              @for (s of data.catalogo.sistemas; track s.codSistema) {
                @if (s.ativo || s.codSistema === data.registro?.codSistema) {
                  <mat-option [value]="s.codSistema">{{ s.nome }}</mat-option>
                }
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Ambiente</mat-label>
            <mat-select name="ambiente" [(ngModel)]="config.ambiente" required [disabled]="!!data.registro">
              @for (a of ambientes; track a) {
                <mat-option [value]="a">{{ ambienteRotulo[a] }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
        @if (jaExiste()) {
          <p class="falha">Este sistema já está configurado neste ambiente: edite a configuração existente.</p>
        }
        <p class="dica">
          A versão instalada entra no lugar de <code>&lt;versao&gt;</code> nos diretórios: quando o ambiente sobe de versão, troque só este campo.
        </p>
        <div class="linha">
          <mat-form-field appearance="outline">
            <mat-label>Banco / schema (scripts e DDL)</mat-label>
            <input matInput name="banco" [(ngModel)]="config.banco" maxlength="200" autocomplete="off" placeholder="DBAMV" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Versão instalada</mat-label>
            <input matInput name="versao" [ngModel]="config.versao" readonly />
            <mat-hint>Mantida em Infraestrutura › Sistemas e Serviços</mat-hint>
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline">
          <mat-label>Passo manual antes do reinício</mat-label>
          <input matInput name="passo" [(ngModel)]="config.passoManual" maxlength="500" autocomplete="off" placeholder="Retirar o nó do balanceador" />
        </mat-form-field>

        <fieldset class="bloco">
          <legend>Serviços, na ordem em que recebem os arquivos</legend>
          <p class="dica">
            Quais serviços fazem parte do sistema é mantido em Infraestrutura › Sistemas e Serviços. Aqui só a ordem de publicação.
          </p>
          <ol class="processos">
            @for (p of processos(); track p; let i = $index; let primeiro = $first; let ultimo = $last) {
              <li>
                <span class="processo__nome">
                  @if (aplicacao(p); as ap) {
                    <span>{{ ap.dsServidor }} · {{ descricaoProcesso(ap) }}</span>
                    <span class="dica-inline">
                      {{ ap.nmProcesso ?? 'sem nome' }}@if (ap.porta) { · porta {{ ap.porta }}}@if (ap.caminho) { · {{ ap.caminho }}}
                    </span>
                  } @else {
                    <span>Processo {{ p }}</span>
                  }
                </span>
                <button mat-icon-button type="button" [disabled]="primeiro" (click)="mover(i, -1)" matTooltip="Subir" aria-label="Subir"><mat-icon>arrow_upward</mat-icon></button>
                <button mat-icon-button type="button" [disabled]="ultimo" (click)="mover(i, 1)" matTooltip="Descer" aria-label="Descer"><mat-icon>arrow_downward</mat-icon></button>
              </li>
            } @empty {
              <p class="dica">Sem serviços, só artefatos de banco podem ter destino neste ambiente. Vincule os serviços em Infraestrutura.</p>
            }
          </ol>

        </fieldset>

        <fieldset class="bloco">
          <legend>Tipos de arquivo aceitos e diretório</legend>
          <p class="dica">
            Onde a versão do produto aparece no caminho, escreva <code>&lt;versao&gt;</code>: o sistema troca pela versão instalada acima.
          </p>
          @for (t of tipos(); track $index; let i = $index) {
            <div class="tipo">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Tipo</mat-label>
                <mat-select [name]="'tipo' + i" [(ngModel)]="t.codTipoArtefato" required>
                  @for (opcao of tiposArquivo; track opcao.codTipoArtefato) {
                    <mat-option [value]="opcao.codTipoArtefato" [disabled]="usado(opcao.codTipoArtefato, i)">{{ opcao.nome }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Diretório</mat-label>
                <input matInput [name]="'diretorio' + i" [(ngModel)]="t.diretorio" required maxlength="500" autocomplete="off" placeholder="/MV/apps/soulmv_trn/products/mvpep/&lt;versao&gt;/forms/WEB-INF/lib" />
              </mat-form-field>
              <button mat-icon-button type="button" (click)="removerTipo(i)" matTooltip="Tirar tipo" aria-label="Tirar tipo"><mat-icon>close</mat-icon></button>
              <mat-slide-toggle [name]="'reinicio' + i" [(ngModel)]="t.exigeReinicio">Exige reinício</mat-slide-toggle>
              @if (t.exigeReinicio) {
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="tipo__comando">
                  <mat-label>Comando de reinício</mat-label>
                  <input matInput [name]="'comando' + i" [(ngModel)]="t.comandoReinicio" maxlength="1000" autocomplete="off" placeholder="systemctl restart soul" />
                </mat-form-field>
              }
            </div>
          } @empty {
            <p class="dica">Sem tipos, só artefatos de banco podem ter destino neste ambiente.</p>
          }
          <button mat-stroked-button type="button" class="incluir-tipo" (click)="incluirTipo()" [disabled]="tipos().length >= tiposArquivo.length">
            <mat-icon>add</mat-icon> Incluir tipo
          </button>
        </fieldset>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="form.invalid || salvando() || jaExiste()">Salvar</button>
      </mat-dialog-actions>
    </form>
  `,
  styles:
    ESTILO_CAMPOS +
    `
    .bloco {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin: 0 0 8px;
      padding: 8px 12px 12px;
      border: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, .12));
      border-radius: 8px;
    }

    legend {
      padding: 0 4px;
      font-size: .8rem;
      font-weight: 500;
    }

    .processos {
      margin: 0;
      padding-left: 20px;
    }

    .processos li {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .processo__nome,
    .candidato {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
      line-height: 1.3;
      overflow-wrap: anywhere;
    }

    .candidato {
      padding: 2px 0;
    }

    .candidato__caminho {
      font-family: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }

    .candidatos mat-checkbox {
      align-items: flex-start;
    }

    .dica-inline {
      margin-left: 6px;
      font-size: .75rem;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
    }

    .incluir {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .incluir__servidor {
      flex: 1 1 240px;
    }

    .incluir__filtro {
      flex: 1 1 180px;
    }

    .candidatos {
      display: flex;
      flex-direction: column;
      gap: 2px;
      max-height: 220px;
      padding: 6px 8px;
      overflow: auto;
      border: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, .12));
      border-radius: 6px;
    }

    .tipo {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr) auto;
      align-items: center;
      gap: 6px 8px;
      padding-bottom: 8px;
      border-bottom: 1px dashed var(--mat-sys-outline-variant, rgba(0, 0, 0, .12));
    }

    .tipo__comando {
      grid-column: 2 / -1;
    }

    .incluir-tipo {
      align-self: flex-start;
    }

    .falha {
      margin: 0;
      font-size: .8rem;
      color: #d32f2f;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AmbienteDialogComponent {
  readonly data = inject<ConfigDialogData<SistemaAmbiente>>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<AmbienteDialogComponent, boolean>>(MatDialogRef);
  private readonly service = inject(AtualizacaoService);

  readonly ambienteRotulo = AMBIENTE_ROTULO;
  readonly ambientes = Object.keys(AMBIENTE_ROTULO) as Ambiente[];
  readonly tiposArquivo = this.data.catalogo.tipos.filter(
    t => t.metodo === 'ARQUIVO' && (t.ativo || this.data.registro?.tipos.some(x => x.codTipoArtefato === t.codTipoArtefato))
  );
  readonly salvando = signal(false);
  readonly processos = signal<number[]>([...(this.data.registro?.processos ?? [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)).map(p => p.codProcesso));
  readonly tipos = signal<SistemaTipo[]>((this.data.registro?.tipos ?? []).map(t => ({ ...t })));
  readonly servidor = signal<number | null>(null);
  readonly filtro = signal('');
  readonly marcados = signal<ReadonlySet<number>>(new Set());

  config: SistemaAmbiente = this.data.registro
    ? { ...this.data.registro }
    : { codSistemaAmbiente: null, codSistema: null, ambiente: 'PRODUCAO', versao: null, banco: null, passoManual: null, processos: [], tipos: [] };

  /** Algum diretório usa <versao>: sem a versão instalada o destino não pode ser calculado. */
  exigeVersao() {
    return this.tipos().some(t => usaVersao(t.diretorio));
  }

  /** Só na inclusão: o PUT por sistema + ambiente sobrescreveria a configuração existente. */
  jaExiste() {
    return (
      !this.data.registro &&
      this.data.catalogo.ambientes.some(a => a.codSistema === this.config.codSistema && a.ambiente === this.config.ambiente)
    );
  }

  /** Servidores com processos cadastrados; o sistema pode usar vários no mesmo ambiente. */
  readonly servidores = computed(() => {
    const mapa = new Map<number, { cod: number; nome: string; total: number }>();
    for (const a of this.data.catalogo.aplicacoes) {
      const cod = a.codServidor ?? 0;
      const servidor = mapa.get(cod);
      if (servidor) {
        servidor.total++;
      } else {
        mapa.set(cod, { cod, nome: a.dsServidor ?? 'Sem servidor', total: 1 });
      }
    }
    return [...mapa.values()].sort((x, y) => x.nome.localeCompare(y.nome));
  });

  /** Processos do servidor escolhido que ainda não estão na lista (um servidor pode ter vários). */
  readonly processosDoServidor = computed(() => {
    const servidor = this.servidor();
    const usados = new Set(this.processos());
    const termo = normalizarTexto(this.filtro());
    return this.data.catalogo.aplicacoes
      .filter(a => (a.codServidor ?? 0) === servidor && !usados.has(a.codProcesso))
      .filter(
        a => !termo || normalizarTexto(`${a.dsProcesso ?? ''} ${a.nmProcesso ?? ''} ${a.caminho ?? ''} ${a.porta ?? ''} ${a.tipoProcesso ?? ''}`).includes(termo)
      )
      .sort((x, y) => this.descricaoProcesso(x).localeCompare(this.descricaoProcesso(y)));
  });

  aplicacao(codProcesso: number) {
    return this.data.catalogo.aplicacoes.find(a => a.codProcesso === codProcesso);
  }

  descricaoProcesso(aplicacao: Aplicacao) {
    return aplicacao.dsProcesso ?? aplicacao.nmProcesso ?? `Processo ${aplicacao.codProcesso}`;
  }

  trocarServidor(cod: number | null) {
    this.servidor.set(cod);
    this.filtro.set('');
    this.marcados.set(new Set());
  }

  alternar(codProcesso: number) {
    this.marcados.update(atual => {
      const copia = new Set(atual);
      if (!copia.delete(codProcesso)) {
        copia.add(codProcesso);
      }
      return copia;
    });
  }

  /** Entram na ordem em que aparecem na lista do servidor; o técnico ajusta a ordem depois. */
  incluirMarcados() {
    const novos = this.processosDoServidor()
      .filter(a => this.marcados().has(a.codProcesso))
      .map(a => a.codProcesso);
    if (novos.length) {
      this.processos.update(lista => [...lista, ...novos]);
    }
    this.marcados.set(new Set());
  }

  mover(indice: number, deslocamento: number) {
    this.processos.update(lista => {
      const copia = [...lista];
      const [item] = copia.splice(indice, 1);
      copia.splice(indice + deslocamento, 0, item);
      return copia;
    });
  }

  removerProcesso(indice: number) {
    this.processos.update(lista => lista.filter((_, i) => i !== indice));
  }

  usado(codTipo: number | null, indice: number) {
    return this.tipos().some((t, i) => i !== indice && t.codTipoArtefato === codTipo);
  }

  incluirTipo() {
    this.tipos.update(lista => [...lista, { codTipoArtefato: null, diretorio: '', exigeReinicio: false, comandoReinicio: null }]);
  }

  removerTipo(indice: number) {
    this.tipos.update(lista => lista.filter((_, i) => i !== indice));
  }

  salvar() {
    const dados: SistemaAmbiente = {
      ...this.config,
      versao: this.config.versao?.trim() || null,
      banco: this.config.banco?.trim() || null,
      passoManual: this.config.passoManual?.trim() || null,
      processos: this.processos().map((codProcesso, i) => ({ codProcesso, ordem: i + 1 })),
      tipos: this.tipos().map(t => ({
        codTipoArtefato: t.codTipoArtefato,
        diretorio: t.diretorio.trim(),
        exigeReinicio: t.exigeReinicio,
        comandoReinicio: t.exigeReinicio ? t.comandoReinicio?.trim() || null : null,
      })),
    };
    salvarE(this.service.salvarAmbiente(dados), this.salvando, () => this.dialogRef.close(true));
  }
}

// ------------------------------------------------------------------ mapeamento de JAR

@Component({
  selector: 'app-atualizacao-mapeamento-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, MatSlideToggleModule],
  template: `
    <h2 mat-dialog-title>
      {{ edicao ? 'Mapeamento ' + (data.registro?.pasta ?? '') : copiaDe ? 'Cópia de ' + copiaDe : 'Novo mapeamento de JAR' }}
    </h2>
    <form #form="ngForm" (ngSubmit)="salvar()">
      <mat-dialog-content class="campos">
        <p class="dica">
          Liga a pasta do pacote do fabricante ao JAR da aplicação. Os arquivos dessa pasta (e subpastas) entram no JAR no caminho interno.
        </p>
        @if (copiaDe) {
          <div class="troca">
            <span class="dica">Os três campos vieram do mapeamento copiado. Troque o nome do módulo em todos de uma vez:</span>
            <div class="troca__campos">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Substituir</mat-label>
                <input matInput name="de" [(ngModel)]="de" autocomplete="off" placeholder="ffcv" />
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>por</mat-label>
                <input matInput name="para" [(ngModel)]="para" autocomplete="off" placeholder="admpac" />
              </mat-form-field>
              <button mat-stroked-button type="button" [disabled]="!de.trim()" (click)="substituir()">
                <mat-icon>find_replace</mat-icon> Aplicar
              </button>
            </div>
          </div>
        }
        <div class="linha">
          <mat-form-field appearance="outline">
            <mat-label>Sistema</mat-label>
            <mat-select name="sistema" [(ngModel)]="mapeamento.codSistema" required>
              @for (s of data.catalogo.sistemas; track s.codSistema) {
                @if (s.ativo || s.codSistema === data.registro?.codSistema) {
                  <mat-option [value]="s.codSistema">{{ s.nome }}</mat-option>
                }
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Tipo do JAR</mat-label>
            <mat-select name="tipo" [(ngModel)]="mapeamento.codTipoArtefato" required>
              @for (t of tiposArquivo; track t.codTipoArtefato) {
                <mat-option [value]="t.codTipoArtefato">{{ t.nome }}</mat-option>
              }
            </mat-select>
            <mat-hint>Define o diretório de destino (Sistemas por ambiente)</mat-hint>
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline">
          <mat-label>Pasta no pacote do fabricante</mat-label>
          <input matInput name="pasta" [(ngModel)]="mapeamento.pasta" required maxlength="500" autocomplete="off" placeholder="ATEND\\admpac\\forms" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>JAR na aplicação</mat-label>
          <input matInput name="jar" [(ngModel)]="mapeamento.jarPadrao" required maxlength="255" autocomplete="off" placeholder="soul-admpac-forms-<versao>.jar" />
          @if (semVersao()) {
            <mat-hint class="alerta">Sem &lt;versao&gt;, o nome do JAR precisa ser exatamente este</mat-hint>
          } @else {
            <mat-hint>Use &lt;versao&gt; onde o nome muda a cada release</mat-hint>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Caminho dentro do JAR</mat-label>
          <input matInput name="caminho" [(ngModel)]="mapeamento.caminhoInterno" required maxlength="500" autocomplete="off" placeholder="br/com/mv/soul/admpac/forms" />
        </mat-form-field>
        @if (mapeamento.pasta && mapeamento.caminhoInterno && mapeamento.jarPadrao) {
          <p class="exemplo">
            Exemplo: <code>{{ pastaNormalizada() }}/Tela.class</code> do pacote vai para
            <code>{{ caminhoNormalizado() }}/Tela.class</code> dentro de <code>{{ mapeamento.jarPadrao }}</code>
          </p>
        }
        @if (edicao) {
          <mat-slide-toggle name="ativo" [(ngModel)]="mapeamento.ativo">Ativo</mat-slide-toggle>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="form.invalid || salvando()">Salvar</button>
      </mat-dialog-actions>
    </form>
  `,
  styles:
    ESTILO_CAMPOS +
    `
    .campos {
      width: min(680px, 88vw);
    }

    .troca {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 10px;
      padding: 8px 12px;
      border: 1px dashed var(--mat-sys-outline-variant, rgba(0, 0, 0, .24));
      border-radius: 8px;
    }

    .troca .dica {
      margin: 0;
    }

    .troca__campos {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .troca__campos mat-form-field {
      flex: 1 1 160px;
    }

    .exemplo {
      margin: 0 0 8px;
      padding: 8px 12px;
      border-radius: 8px;
      background: var(--mat-sys-surface-container, rgba(0, 0, 0, .04));
      font-size: .8rem;
      overflow-wrap: anywhere;
    }

    .alerta {
      color: #b26a00;
    }

    code {
      font-size: .76rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapeamentoDialogComponent {
  readonly data = inject<ConfigDialogData<MapeamentoJar>>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<MapeamentoDialogComponent, boolean>>(MatDialogRef);
  private readonly service = inject(AtualizacaoService);

  readonly tiposArquivo = this.data.catalogo.tipos.filter(
    t => t.metodo === 'ARQUIVO' && (t.ativo || t.codTipoArtefato === this.data.registro?.codTipoArtefato)
  );
  readonly salvando = signal(false);
  /** Cópia: chega um registro sem código, para gravar como novo. */
  readonly edicao = !!this.data.registro?.codMapeamento;
  readonly copiaDe = this.data.registro && !this.data.registro.codMapeamento ? this.data.registro.pasta : null;
  mapeamento: MapeamentoJar = this.data.registro
    ? { ...this.data.registro }
    : { codMapeamento: null, codSistema: null, codTipoArtefato: null, pasta: '', jarPadrao: '', caminhoInterno: '', ativo: true };
  de = '';
  para = '';

  /** Na cópia, o que muda é o nome do módulo, que aparece igual na pasta, no JAR e no caminho interno. */
  substituir() {
    const de = this.de.trim();
    if (!de) {
      return;
    }
    const para = this.para.trim();
    const trocar = (texto: string) => texto.split(de).join(para);
    this.mapeamento = {
      ...this.mapeamento,
      pasta: trocar(this.mapeamento.pasta),
      jarPadrao: trocar(this.mapeamento.jarPadrao),
      caminhoInterno: trocar(this.mapeamento.caminhoInterno),
    };
  }

  semVersao() {
    return !!this.mapeamento.jarPadrao && !/<versao>/i.test(this.mapeamento.jarPadrao);
  }

  pastaNormalizada() {
    return this.mapeamento.pasta.trim().replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
  }

  caminhoNormalizado() {
    return this.mapeamento.caminhoInterno.trim().replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
  }

  salvar() {
    const dados: MapeamentoJar = {
      ...this.mapeamento,
      pasta: this.mapeamento.pasta.trim(),
      jarPadrao: this.mapeamento.jarPadrao.trim(),
      caminhoInterno: this.mapeamento.caminhoInterno.trim(),
    };
    salvarE(this.service.salvarMapeamento(dados), this.salvando, () => this.dialogRef.close(true));
  }
}
