import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MtxSelectModule } from '@ng-matero/extensions/select';
import { finalize } from 'rxjs';

import {
  BalanceadorCadastro,
  PAINEL_DIALOGO_MAPA,
  ProcessoItem,
  ProcessoOpcao,
  SistemaCadastro,
  comRotulo,
} from './mapa-servicos.models';
import { MapaServicosService } from './mapa-servicos.service';

export interface SistemaMapaDialogData {
  sistema: SistemaCadastro;
  processos: ProcessoOpcao[];
  balanceadores: BalanceadorCadastro[];
}

type TipoEntrada = 'BALANCEADOR' | 'SERVICO';

interface EntradaEdicao {
  chave: number;
  tipo: TipoEntrada;
  alvo: number | null;
}

/**
 * Por onde o sistema é acessado: um ou mais balanceadores, ou serviços
 * direto (sistema sem balanceador). É daqui que o mapa desce a árvore.
 */
@Component({
  selector: 'app-sistema-mapa-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MtxSelectModule,
  ],
  template: `
    <h2 mat-dialog-title>Sistema {{ data.sistema.sistema }} no mapa</h2>

    <mat-dialog-content class="conteudo">
      <section class="passo">
        <div class="passo__cabecalho">
          <h3>Entradas do sistema</h3>
          <span class="espaco"></span>
          <button mat-stroked-button type="button" (click)="adicionar('BALANCEADOR')" [disabled]="!data.balanceadores.length">
            <mat-icon>alt_route</mat-icon> + Balanceador
          </button>
          <button mat-stroked-button type="button" (click)="adicionar('SERVICO')">
            <mat-icon>memory</mat-icon> + Serviço direto
          </button>
        </div>
        <p class="dica">
          Por onde o acesso chega ao sistema. Normalmente é um balanceador (e o que está atrás dele vem do cadastro do
          balanceador). Sistema sem balanceador: informe os serviços direto.
          @if (!data.balanceadores.length) {
            Nenhum balanceador cadastrado ainda — cadastre na aba Balanceadores.
          }
        </p>

        @if (vinculados.length) {
          <div class="vinculo">
            <mat-icon>link</mat-icon>
            <span>
              Em Atualizações, este sistema está ligado a
              <b>{{ vinculados.length }} {{ vinculados.length === 1 ? 'serviço' : 'serviços' }}</b>:
              {{ nomesVinculados }}.
            </span>
            <button mat-stroked-button type="button" (click)="usarServicosAtualizacao()" [disabled]="!faltamVinculados()"
                    matTooltip="Inclui esses serviços como entradas diretas do sistema">
              Usar como serviços diretos
            </button>
          </div>
        }

        @if (entradas().length === 0) {
          <div class="vazio">Nenhuma entrada. Adicione um balanceador ou um serviço.</div>
        }

        @for (e of entradas(); track e.chave) {
          <div class="entrada">
            <mat-button-toggle-group [value]="e.tipo" (change)="trocarTipo(e.chave, $event.value)" hideSingleSelectionIndicator>
              <mat-button-toggle value="BALANCEADOR" matTooltip="Balanceador" [disabled]="!data.balanceadores.length">
                <mat-icon>alt_route</mat-icon>
              </mat-button-toggle>
              <mat-button-toggle value="SERVICO" matTooltip="Serviço direto"><mat-icon>memory</mat-icon></mat-button-toggle>
            </mat-button-toggle-group>

            <!-- O campo inteiro troca com o tipo: trocar só o controle deixa o mat-form-field preso ao antigo. -->
            @if (e.tipo === 'BALANCEADOR') {
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="entrada__alvo">
                <mat-label>Balanceador</mat-label>
                <mtx-select [items]="data.balanceadores" bindLabel="nome" bindValue="codBalanceador" [searchable]="true"
                            [appendTo]="painelDoDialogo" [ngModel]="e.alvo" (ngModelChange)="alterar(e.chave, $event)" />
              </mat-form-field>
            } @else {
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="entrada__alvo">
                <mat-label>Serviço</mat-label>
                <mtx-select [items]="processos" bindLabel="rotulo" bindValue="codProcesso" [searchable]="true"
                            [appendTo]="painelDoDialogo" [ngModel]="e.alvo" (ngModelChange)="alterar(e.chave, $event)">
                  <ng-template ng-option-tmp let-item="item">
                    <div class="opcao">
                      <span>{{ item.rotulo }}</span>
                      @if (item.vinculado) {
                        <span class="tag" matTooltip="Ligado a este sistema em Atualizações">Atualizações</span>
                      }
                    </div>
                  </ng-template>
                </mtx-select>
              </mat-form-field>
            }

            @if (e.tipo === 'BALANCEADOR' && resumoBalanceador(e.alvo); as resumo) {
              <span class="entrada__resumo">{{ resumo }}</span>
            }

            <button mat-icon-button type="button" (click)="remover(e.chave)" matTooltip="Remover">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        }
      </section>

      <section class="passo">
        <h3>Exibição</h3>
        <mat-form-field appearance="outline" class="cheio">
          <mat-label>URL de acesso do sistema</mat-label>
          <input matInput [(ngModel)]="urlAcesso" maxlength="400" placeholder="https://soul.hospital.local" />
        </mat-form-field>
        <mat-slide-toggle [(ngModel)]="exibePainel">Mostrar queda deste sistema no painel de TV</mat-slide-toggle>
        <mat-form-field appearance="outline" class="cheio observacao">
          <mat-label>Observação</mat-label>
          <textarea matInput [(ngModel)]="observacao" maxlength="1000" rows="2"></textarea>
        </mat-form-field>
      </section>

      @if (pendencias().length) {
        <ul class="pendencias">
          @for (p of pendencias(); track p) {
            <li>{{ p }}</li>
          }
        </ul>
      }
      @if (erro()) {
        <div class="erro"><mat-icon>error</mat-icon> {{ erro() }}</div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Cancelar</button>
      <button mat-flat-button type="button" (click)="salvar()" [disabled]="pendencias().length > 0 || salvando()">Salvar</button>
    </mat-dialog-actions>
  `,
  styles: `
    .conteudo {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding-top: 8px !important;
    }

    .passo {
      display: flex;
      flex-direction: column;
      gap: 8px;

      h3 {
        margin: 0;
        font-size: 1rem;
      }

      &__cabecalho {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
      }
    }

    .espaco {
      flex: 1;
    }

    .dica {
      margin: 0;
      font-size: .8rem;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
    }

    .vazio {
      padding: 14px;
      border: 1px dashed var(--mat-sys-outline-variant, #ccc);
      border-radius: 8px;
      font-size: .85rem;
      text-align: center;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
    }

    .entrada {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;

      &__alvo {
        flex: 1 1 280px;
      }

      &__resumo {
        max-width: 260px;
        font-size: .75rem;
        color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
      }
    }

    .vinculo {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 8px;
      background: var(--mat-sys-surface-container, #eef0f3);
      font-size: .8rem;

      span {
        flex: 1 1 260px;
      }
    }

    .opcao {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .tag {
      padding: 1px 8px;
      border-radius: 999px;
      background: color-mix(in srgb, #2e9e5b 18%, transparent);
      color: #2e7d4f;
      font-size: .7rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .cheio {
      width: 100%;
    }

    .observacao {
      margin-top: 8px;
    }

    .pendencias {
      margin: 0;
      padding-left: 18px;
      font-size: .8rem;
      color: #a86400;
    }

    .erro {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-radius: 8px;
      background: color-mix(in srgb, #d93636 12%, transparent);
      color: #c62828;
      font-size: .8rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SistemaMapaDialogComponent {
  readonly data = inject<SistemaMapaDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<SistemaMapaDialogComponent, SistemaCadastro>>(MatDialogRef);
  private readonly service = inject(MapaServicosService);

  /** A lista dos combos abre dentro do diálogo (ver PAINEL_DIALOGO_MAPA). */
  readonly painelDoDialogo = '.' + PAINEL_DIALOGO_MAPA;

  private proximaChave = 1;

  /** Serviços ligados ao sistema em Atualizações, na ordem de lá (Produção primeiro). */
  readonly vinculados: number[] = (this.data.sistema.servicosAtualizacao ?? []).filter(cod =>
    this.data.processos.some(p => p.codProcesso === cod)
  );

  /** Os vinculados em Atualizações vêm primeiro no combo, marcados. */
  readonly processos: (ProcessoItem & { vinculado: boolean })[] = comRotulo(this.data.processos)
    .map(p => ({ ...p, vinculado: this.vinculados.includes(p.codProcesso) }))
    .sort((a, b) => Number(b.vinculado) - Number(a.vinculado));

  readonly nomesVinculados = this.vinculados
    .map(cod => this.processos.find(p => p.codProcesso === cod)?.rotulo)
    .filter(Boolean)
    .join(', ');

  urlAcesso = this.data.sistema.urlAcesso ?? '';
  exibePainel = this.data.sistema.cadastrado ? this.data.sistema.exibePainel : true;
  observacao = this.data.sistema.observacao ?? '';

  readonly entradas = signal<EntradaEdicao[]>(
    this.data.sistema.entradas.length
      ? this.data.sistema.entradas.map(e => ({
          chave: this.proximaChave++,
          tipo: e.codBalanceador ? 'BALANCEADOR' : 'SERVICO',
          alvo: e.codBalanceador ?? e.codProcesso,
        }))
      : this.entradasIniciais()
  );

  /**
   * Sistema novo no mapa: com balanceador cadastrado, abre uma linha para escolhê-lo;
   * sem nenhum, já traz os serviços ligados ao sistema em Atualizações.
   */
  private entradasIniciais(): EntradaEdicao[] {
    if (this.data.balanceadores.length) return [{ chave: this.proximaChave++, tipo: 'BALANCEADOR', alvo: null }];
    if (this.vinculados.length) {
      return this.vinculados.map(cod => ({ chave: this.proximaChave++, tipo: 'SERVICO' as const, alvo: cod }));
    }
    return [{ chave: this.proximaChave++, tipo: 'SERVICO', alvo: null }];
  }

  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);

  readonly pendencias = computed(() => {
    const lista: string[] = [];
    const entradas = this.entradas();
    if (!entradas.length) lista.push('Informe ao menos uma entrada.');
    if (entradas.some(e => !e.alvo)) lista.push('Escolha o balanceador ou serviço de todas as linhas (ou remova a linha).');
    const chaves = entradas.filter(e => e.alvo).map(e => `${e.tipo}:${e.alvo}`);
    if (new Set(chaves).size !== chaves.length) lista.push('A mesma entrada aparece em mais de uma linha.');
    return lista;
  });

  adicionar(tipo: TipoEntrada) {
    this.entradas.update(lista => [...lista, { chave: this.proximaChave++, tipo, alvo: null }]);
  }

  remover(chave: number) {
    this.entradas.update(lista => lista.filter(e => e.chave !== chave));
  }

  alterar(chave: number, alvo: number | null) {
    this.entradas.update(lista => lista.map(e => (e.chave === chave ? { ...e, alvo } : e)));
  }

  /** Na troca para serviço direto, já sugere o primeiro serviço de Atualizações ainda não usado. */
  trocarTipo(chave: number, tipo: TipoEntrada) {
    const sugestao = tipo === 'SERVICO' ? this.vinculadosLivres()[0] ?? null : null;
    this.entradas.update(lista => lista.map(e => (e.chave === chave ? { ...e, tipo, alvo: sugestao } : e)));
  }

  /** Vinculados em Atualizações que ainda não são entrada. */
  private vinculadosLivres(): number[] {
    const usados = this.entradas().filter(e => e.tipo === 'SERVICO').map(e => e.alvo);
    return this.vinculados.filter(cod => !usados.includes(cod));
  }

  readonly faltamVinculados = computed(() => {
    const usados = this.entradas().filter(e => e.tipo === 'SERVICO').map(e => e.alvo);
    return this.vinculados.some(cod => !usados.includes(cod));
  });

  /** Inclui os serviços de Atualizações como entradas diretas (aproveitando linhas vazias). */
  usarServicosAtualizacao() {
    const livres = this.vinculadosLivres();
    if (!livres.length) return;
    const lista = this.entradas().filter(e => e.alvo !== null);
    for (const cod of livres) lista.push({ chave: this.proximaChave++, tipo: 'SERVICO', alvo: cod });
    this.entradas.set(lista);
  }

  /** "3 membros" para conferir o balanceador escolhido sem abrir outro cadastro. */
  resumoBalanceador(cod: number | null): string {
    const b = this.data.balanceadores.find(x => x.codBalanceador === cod);
    if (!b) return '';
    const n = b.membros.length;
    return n === 1 ? '1 membro' : `${n} membros`;
  }

  salvar() {
    if (this.pendencias().length) return;
    this.salvando.set(true);
    this.erro.set(null);
    const cadastro: SistemaCadastro = {
      ...this.data.sistema,
      urlAcesso: this.urlAcesso.trim() || null,
      exibePainel: this.exibePainel,
      observacao: this.observacao.trim() || null,
      entradas: this.entradas().map(e => ({
        codBalanceador: e.tipo === 'BALANCEADOR' ? e.alvo : null,
        codProcesso: e.tipo === 'SERVICO' ? e.alvo : null,
      })),
    };
    this.service
      .salvarSistema(cadastro)
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({
        next: salvo => this.dialogRef.close(salvo),
        error: e => this.erro.set(e?.error?.message ?? 'Não foi possível salvar.'),
      });
  }
}
