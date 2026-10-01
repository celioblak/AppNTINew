import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { MtxDialog } from '@ng-matero/extensions/dialog';
import { HotToastService } from '@ngxpert/hot-toast';
import { finalize } from 'rxjs';

import {
  ParametroEdicaoDialogComponent,
  ParametroHistoricoDialogComponent,
  ParametroNovoDialogComponent,
} from './parametro-dialogs';
import { Parametro, ParametrosService, ROTULO_EFEITO } from './parametros.service';

/** Grupos que têm tela própria (D-06): edita-se aqui também, com atalho para lá. */
const TELA_PROPRIA: Record<string, { rota: string; nome: string }> = {
  'Google Drive': { rota: '/configuracao/google-driver', nome: 'tela Google Drive' },
  Notificações: { rota: '/configuracao/notificacoes', nome: 'tela Notificações' },
};

/**
 * Configurações > Parâmetros (docs/parametros.md): os parâmetros do sistema (TB_CONFIGURACAO) por grupo, com
 * descrição, padrão, validação pelo tipo e histórico. Segredo aparece mascarado (D-02); controle interno, só leitura.
 */
@Component({
  selector: 'app-parametros',
  imports: [DatePipe, FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule,
    MatSlideToggleModule, MatTooltipModule, RouterLink],
  template: `
    <div class="pagina">
      @if (carregando()) { <mat-progress-bar mode="indeterminate" /> }
      <div class="topo">
        <h2>Parâmetros do sistema</h2>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="busca">
          <mat-icon matPrefix>search</mat-icon>
          <mat-label>Pesquisar</mat-label>
          <input matInput [ngModel]="filtro()" (ngModelChange)="filtro.set($event)" placeholder="Chave, descrição ou grupo" />
        </mat-form-field>
        <mat-slide-toggle [checked]="mostrarInternos()" (change)="mostrarInternos.set($event.checked)">Controle interno</mat-slide-toggle>
        <span class="espaco"></span>
        <button mat-icon-button matTooltip="Atualizar" (click)="carregar()"><mat-icon>refresh</mat-icon></button>
        <button mat-flat-button (click)="novo()"><mat-icon>add</mat-icon> Novo parâmetro</button>
      </div>
      <p class="dica">
        Segredos (senhas e tokens) aparecem mascarados: para trocar, digite o novo valor. Os de controle interno são mantidos
        pelo próprio sistema e ficam só para consulta.
      </p>

      @for (g of grupos(); track g.nome) {
        <section class="grupo">
          <h3>
            {{ g.nome }} <small>({{ g.itens.length }})</small>
            @if (telaPropria[g.nome]; as t) {
              <a class="atalho" [routerLink]="t.rota">abrir a {{ t.nome }} <mat-icon inline>open_in_new</mat-icon></a>
            }
          </h3>
          @for (p of g.itens; track p.chave) {
            <div class="parametro" [class.parametro--interno]="p.interno">
              <div class="parametro__nome">
                <code>{{ p.chave }}</code>
                @if (p.usandoPadrao && !p.interno) { <span class="marca">padrão</span> }
                @if (p.interno) { <span class="marca" matTooltip="Mantido pelo sistema: só leitura">interno</span> }
                @if (p.obrigatorio) { <span class="marca" matTooltip="O sistema não funciona sem ele">obrigatório</span> }
                @if (p.efeito !== 'IMEDIATO') { <span class="marca marca--efeito">{{ rotuloEfeito[p.efeito] }}</span> }
                <small>{{ p.descricao ?? 'Sem descrição' }}</small>
              </div>
              <div class="parametro__valor" [matTooltip]="p.segredo ? '' : (p.valor ?? '')">
                @if (p.segredo) {
                  {{ p.cadastrado ? '••••••••' : 'não cadastrado' }}
                } @else if (p.valor == null || p.valor === '') {
                  <i>não configurado</i>
                } @else if (p.tipo === 'SIM_NAO') {
                  {{ p.valor === 'S' ? 'Sim' : 'Não' }}
                } @else {
                  {{ p.valor }}
                }
                @if (p.alteradoPor) {
                  <small>{{ p.alteradoPor }} · {{ p.alteradoEm | date: 'dd/MM/yyyy HH:mm' }}</small>
                }
              </div>
              <div class="parametro__acoes">
                @if (!p.interno) {
                  <button mat-icon-button matTooltip="Editar" (click)="editar(p)"><mat-icon>edit</mat-icon></button>
                  @if (!p.usandoPadrao && (p.padrao != null || !p.obrigatorio)) {
                    <button mat-icon-button [matTooltip]="p.padrao != null ? 'Voltar ao padrão (' + p.padrao + ')' : 'Voltar ao padrão (não configurado)'"
                            (click)="voltar(p)">
                      <mat-icon>settings_backup_restore</mat-icon>
                    </button>
                  }
                }
                <button mat-icon-button matTooltip="Histórico" (click)="historico(p)"><mat-icon>history</mat-icon></button>
              </div>
            </div>
          }
        </section>
      } @empty {
        @if (!carregando()) { <p class="dica">Nenhum parâmetro atende à pesquisa.</p> }
      }
    </div>
  `,
  styles: `
    .pagina { padding: 8px 16px 24px; }
    .topo { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
    .topo h2 { margin: 0 8px 0 0; }
    .busca { width: 320px; max-width: 100%; }
    .espaco { flex: 1; }
    .dica { margin: 8px 0 12px; font-size: .82rem; color: var(--mat-sys-on-surface-variant, rgba(0,0,0,.6)); }
    .grupo { margin-bottom: 16px; border: 1px solid var(--mat-sys-outline-variant, #d5d8de); border-radius: 12px; overflow: hidden; }
    .grupo h3 { display: flex; align-items: center; gap: 6px; margin: 0; padding: 8px 14px; font-size: .95rem;
                background: var(--mat-sys-surface-container, #eef0f3); }
    .grupo h3 small { font-weight: 400; opacity: .7; }
    .atalho { margin-left: auto; font-size: .78rem; font-weight: 400; }
    .parametro { display: grid; grid-template-columns: minmax(260px, 2fr) minmax(160px, 1.4fr) auto; gap: 12px; align-items: center;
                 padding: 6px 14px; border-top: 1px solid var(--mat-sys-outline-variant, #e3e5e9); }
    .parametro--interno { opacity: .75; }
    .parametro__nome code { font-size: .85rem; font-weight: 600; }
    .parametro__nome small, .parametro__valor small { display: block; font-size: .75rem; color: var(--mat-sys-on-surface-variant, rgba(0,0,0,.6)); }
    .parametro__valor { font-size: .85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .parametro__acoes { display: flex; }
    .marca { margin-left: 6px; padding: 0 6px; border-radius: 6px; font-size: .68rem;
             background: var(--mat-sys-surface-container-high, #e6e8ec); }
    .marca--efeito { background: color-mix(in srgb, #e08a00 18%, transparent); }
    @media (max-width: 760px) { .parametro { grid-template-columns: 1fr; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParametrosComponent implements OnInit {
  private readonly service = inject(ParametrosService);
  private readonly dialog = inject(MatDialog);
  private readonly mtxDialog = inject(MtxDialog);
  private readonly toast = inject(HotToastService);

  readonly rotuloEfeito = ROTULO_EFEITO;
  readonly telaPropria = TELA_PROPRIA;
  readonly parametros = signal<Parametro[]>([]);
  readonly carregando = signal(true);
  readonly filtro = signal('');
  readonly mostrarInternos = signal(false);

  readonly grupos = computed(() => {
    const termo = this.filtro().trim().toLowerCase();
    const mapa = new Map<string, Parametro[]>();
    for (const p of this.parametros()) {
      if (p.interno && !this.mostrarInternos()) continue;
      if (termo && ![p.chave, p.descricao, p.grupo].some(t => (t ?? '').toLowerCase().includes(termo))) continue;
      const lista = mapa.get(p.grupo) ?? [];
      lista.push(p);
      mapa.set(p.grupo, lista);
    }
    // "Outros" (chaves sem uso conhecido) por último.
    return [...mapa.entries()]
      .sort(([a], [b]) => (a === 'Outros' ? 1 : b === 'Outros' ? -1 : a.localeCompare(b)))
      .map(([nome, itens]) => ({ nome, itens }));
  });

  ngOnInit() {
    this.carregar();
  }

  carregar() {
    this.carregando.set(true);
    this.service
      .listar()
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({ next: l => this.parametros.set(l), error: () => {} });
  }

  editar(p: Parametro) {
    this.dialog
      .open(ParametroEdicaoDialogComponent, { width: '560px', maxWidth: '96vw', data: p })
      .afterClosed()
      .subscribe((salvo?: Parametro) => {
        if (!salvo) return;
        this.substituir(salvo);
        this.toast.success(`${salvo.chave} salvo. ${ROTULO_EFEITO[salvo.efeito]}.`);
      });
  }

  voltar(p: Parametro) {
    this.mtxDialog.confirm(
      `Voltar ${p.chave} ao padrão?`,
      p.padrao != null ? `O valor passa a ser "${p.padrao}".` : 'O parâmetro fica não configurado (vazio).',
      () =>
        this.service.voltarAoPadrao(p.chave).subscribe({
          next: salvo => {
            this.substituir(salvo);
            this.toast.success(`${salvo.chave} voltou ao padrão.`);
          },
          error: () => {},
        })
    );
  }

  historico(p: Parametro) {
    this.dialog.open(ParametroHistoricoDialogComponent, { width: '640px', maxWidth: '96vw', maxHeight: '90vh', data: p.chave });
  }

  novo() {
    const grupos = [...new Set(this.parametros().map(p => p.grupo))].sort();
    this.dialog
      .open(ParametroNovoDialogComponent, { width: '640px', maxWidth: '96vw', data: grupos })
      .afterClosed()
      .subscribe((criado?: Parametro) => {
        if (!criado) return;
        this.parametros.update(l => [...l, criado]);
        this.toast.success(`${criado.chave} criado.`);
      });
  }

  private substituir(p: Parametro) {
    this.parametros.update(l => l.map(x => (x.chave === p.chave ? p : x)));
  }
}
