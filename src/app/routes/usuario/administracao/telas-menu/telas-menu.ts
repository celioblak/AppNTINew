import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MtxDialog } from '@ng-matero/extensions/dialog';
import { MtxGridColumn, MtxGridModule } from '@ng-matero/extensions/grid';
import { TranslateService } from '@ngx-translate/core';
import { HotToastService } from '@ngxpert/hot-toast';
import { AlturaAteRodape } from '@shared';
import { finalize } from 'rxjs';

import { linhasDoMenu, normalizar } from './arvore-menu';
import { MenuDialogComponent, MenuDialogData } from './menu-dialog';
import { TelaDialogComponent, TelaDialogData } from './tela-dialog';
import { MenuCadastro, TelaCadastro, TelasMenuService, TipoMenu } from './telas-menu.service';

/** Usuário > Telas e Menu: cadastro de TB_TELA e da árvore TB_MENU. Somente administradores. */
@Component({
  selector: 'app-telas-menu',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTabsModule,
    MatTooltipModule,
    MtxGridModule,
    AlturaAteRodape,
  ],
  templateUrl: './telas-menu.html',
  styleUrl: './telas-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TelasMenuComponent implements OnInit {
  private readonly service = inject(TelasMenuService);
  private readonly dialog = inject(MatDialog);
  private readonly mtxDialog = inject(MtxDialog);
  private readonly toast = inject(HotToastService);
  private readonly translate = inject(TranslateService);

  readonly telas = signal<TelaCadastro[]>([]);
  readonly menus = signal<MenuCadastro[]>([]);
  readonly carregandoTelas = signal(true);
  readonly carregandoMenus = signal(true);
  readonly filtroTela = signal('');
  readonly filtroMenu = signal('');

  readonly rotuloTipo: Record<TipoMenu, string> = { M: 'Agrupador', T: 'Tela', R: 'Rota oculta' };

  readonly telasFiltradas = computed(() => {
    const termo = normalizar(this.filtroTela().trim());
    return this.telas().filter(t => !termo || normalizar([t.codTela, t.dsTela, t.dsModulo, t.dsGrupoMenu, t.roles].join(' ')).includes(termo));
  });

  readonly linhasMenu = computed(() => {
    const termo = normalizar(this.filtroMenu().trim());
    return linhasDoMenu(this.menus())
      .map(linha => ({ ...linha, rotulo: this.traduzir(linha.chave) }))
      .filter(
        linha =>
          !termo ||
          normalizar([linha.rotulo, linha.menu.nome, linha.caminho, linha.menu.dsTela].join(' ')).includes(termo)
      );
  });

  readonly colunasTelas: MtxGridColumn[] = [
    { header: 'Código', field: 'codTela', width: '90px', sortable: true },
    { header: 'Tela', field: 'dsTela', minWidth: 220, sortable: true },
    { header: 'Módulo', field: 'dsModulo', width: '160px', sortable: true },
    { header: 'Grupo do menu', field: 'dsGrupoMenu', width: '160px', sortable: true },
    { header: 'Ativa', field: 'snAtivo', width: '70px', formatter: (t: TelaCadastro) => (t.snAtivo ? 'Sim' : 'Não') },
    { header: 'Acessos', field: 'qtdAcessos', width: '90px', sortable: true },
    { header: 'Itens de menu', field: 'qtdMenus', width: '110px', sortable: true },
    {
      header: 'Operações',
      field: 'operacoes',
      width: '110px',
      pinned: 'right',
      type: 'button',
      buttons: [
        { type: 'icon', icon: 'edit', tooltip: 'Editar', click: (t: TelaCadastro) => this.abrirTela(t) },
        {
          type: 'icon',
          icon: 'delete',
          color: 'warn',
          tooltip: 'Excluir (só telas sem itens de menu)',
          disabled: (t: TelaCadastro) => (t.qtdMenus ?? 0) > 0,
          click: (t: TelaCadastro) => this.excluirTela(t),
        },
      ],
    },
  ];

  ngOnInit() {
    this.carregarTelas();
    this.carregarMenus();
  }

  // ---------------------------------------------------------------- telas

  abrirTela(tela?: TelaCadastro) {
    this.dialog
      .open<TelaDialogComponent, TelaDialogData, TelaCadastro>(TelaDialogComponent, { width: '560px', maxWidth: '95vw', data: { tela } })
      .afterClosed()
      .subscribe(salva => {
        if (salva) {
          this.toast.success(`Tela "${salva.dsTela}" salva.`);
          this.carregarTelas();
          this.carregarMenus(); // nome da tela aparece na árvore
        }
      });
  }

  private excluirTela(tela: TelaCadastro) {
    const acessos = tela.qtdAcessos ?? 0;
    const detalhe = acessos
      ? `Os ${acessos} acesso(s) de usuários a esta tela também serão removidos.`
      : 'Esta ação não pode ser desfeita.';
    this.mtxDialog.confirm(`Excluir a tela "${tela.dsTela}"?`, detalhe, () =>
      this.service.excluirTela(tela.codTela!).subscribe({
        next: () => {
          this.toast.success('Tela excluída.');
          this.carregarTelas();
        },
        error: () => {},
      })
    );
  }

  // ----------------------------------------------------------------- menu

  abrirMenu(menu?: MenuCadastro, codMenuPai?: number | null) {
    const data: MenuDialogData = { menu, codMenuPai, menus: this.menus(), telas: this.telas() };
    this.dialog
      .open<MenuDialogComponent, MenuDialogData, MenuCadastro>(MenuDialogComponent, { width: '760px', maxWidth: '95vw', data })
      .afterClosed()
      .subscribe(salvo => {
        if (salvo) {
          this.toast.success('Item de menu salvo. O menu lateral atualiza ao recarregar a página ou no próximo login.');
          this.carregarMenus();
          this.carregarTelas(); // contagem de itens por tela
        }
      });
  }

  excluirMenu(menu: MenuCadastro) {
    this.mtxDialog.confirm(`Excluir o item de menu "${menu.nome}"?`, 'Esta ação não pode ser desfeita.', () =>
      this.service.excluirMenu(menu.codMenu!).subscribe({
        next: () => {
          this.toast.success('Item de menu excluído.');
          this.carregarMenus();
          this.carregarTelas();
        },
        error: () => {},
      })
    );
  }

  // ---------------------------------------------------------------- apoio

  private traduzir(chave: string): string | null {
    const texto = this.translate.instant(chave);
    return typeof texto === 'string' && texto !== chave ? texto : null;
  }

  private carregarTelas() {
    this.carregandoTelas.set(true);
    this.service
      .listarTelas()
      .pipe(finalize(() => this.carregandoTelas.set(false)))
      .subscribe({ next: telas => this.telas.set(telas), error: () => this.telas.set([]) });
  }

  private carregarMenus() {
    this.carregandoMenus.set(true);
    this.service
      .listarMenus()
      .pipe(finalize(() => this.carregandoMenus.set(false)))
      .subscribe({ next: menus => this.menus.set(menus), error: () => this.menus.set([]) });
  }
}
