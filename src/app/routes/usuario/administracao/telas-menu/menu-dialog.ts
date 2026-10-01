import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslateService } from '@ngx-translate/core';
import { finalize, map, startWith } from 'rxjs';

import { LinhaMenu, codigosDaSubarvore, linhasDoMenu } from './arvore-menu';
import { MenuCadastro, TelaCadastro, TelasMenuService, TipoMenu } from './telas-menu.service';

export interface MenuDialogData {
  menu?: MenuCadastro;
  /** Pai sugerido ao criar um subitem. */
  codMenuPai?: number | null;
  menus: MenuCadastro[];
  telas: TelaCadastro[];
}

const PADRAO_TRECHO = /^[A-Za-z0-9_-]+$/;

@Component({
  selector: 'app-menu-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
  templateUrl: './menu-dialog.html',
  styleUrl: './menu-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuDialogComponent {
  readonly data = inject<MenuDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<MenuDialogComponent, MenuCadastro>>(MatDialogRef);
  private readonly service = inject(TelasMenuService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly tipos: { valor: TipoMenu; rotulo: string; descricao: string }[] = [
    { valor: 'M', rotulo: 'Agrupador (submenu)', descricao: 'Abre uma lista de subitens; não abre tela.' },
    { valor: 'T', rotulo: 'Tela', descricao: 'Link que abre uma tela; o acesso é liberado pela tela vinculada.' },
    { valor: 'R', rotulo: 'Rota oculta', descricao: 'Não aparece no menu, mas libera o acesso à rota pela tela vinculada.' },
  ];

  private readonly linhas = linhasDoMenu(this.data.menus);
  private readonly linhaPorCodigo = new Map(this.linhas.map(l => [l.menu.codMenu!, l]));

  /** Só agrupadores, sem o próprio item e seus subitens. */
  readonly opcoesPai: LinhaMenu[] = (() => {
    const bloqueados = this.data.menu?.codMenu ? codigosDaSubarvore(this.data.menu.codMenu, this.data.menus) : new Set<number>();
    return this.linhas.filter(l => l.menu.tipo === 'M' && !bloqueados.has(l.menu.codMenu!));
  })();

  readonly telas = [...this.data.telas].sort((a, b) => a.dsTela.localeCompare(b.dsTela));
  readonly salvando = signal(false);

  readonly form = this.fb.group({
    tipo: this.fb.control<TipoMenu>(this.data.menu?.tipo ?? 'T'),
    codMenuPai: this.fb.control<number | null>(this.data.menu ? this.data.menu.codMenuPai : (this.data.codMenuPai ?? null)),
    rota: [this.data.menu?.rota ?? '', [Validators.required, Validators.pattern(PADRAO_TRECHO)]],
    nome: [this.data.menu?.nome ?? '', [Validators.required, Validators.pattern(PADRAO_TRECHO)]],
    codTela: this.fb.control<number | null>(this.data.menu?.codTela ?? null),
    icone: [this.data.menu?.icone ?? ''],
    ordem: this.fb.control<number | null>(this.data.menu?.ordem ?? null),
  });

  readonly valores = toSignal(
    this.form.valueChanges.pipe(
      startWith(null),
      map(() => this.form.getRawValue())
    ),
    { requireSync: true }
  );

  readonly descricaoTipo = computed(() => this.tipos.find(t => t.valor === this.valores().tipo)?.descricao ?? '');

  readonly previa = computed(() => {
    const valores = this.valores();
    const pai = valores.codMenuPai != null ? this.linhaPorCodigo.get(valores.codMenuPai) : undefined;
    const chave = `${pai?.chave ?? 'menu'}.${valores.nome || '…'}`;
    return {
      caminho: `${pai?.caminho ?? ''}/${valores.rota || '…'}`,
      chave,
      rotulo: valores.nome ? this.traduzir(chave) : null,
    };
  });

  constructor() {
    const { tipo, codTela, rota, nome } = this.form.controls;
    tipo.valueChanges.pipe(startWith(tipo.value), takeUntilDestroyed()).subscribe(valor => {
      codTela.setValidators(valor === 'M' ? null : Validators.required);
      codTela.updateValueAndValidity({ emitEvent: false });
    });

    // Item novo: a chave de tradução acompanha a rota até ser editada à mão.
    if (!this.data.menu) {
      rota.valueChanges.pipe(takeUntilDestroyed()).subscribe(valor => {
        if (!nome.dirty) {
          nome.setValue(valor);
        }
      });
    }
  }

  rotuloDe(linha: LinhaMenu) {
    return this.traduzir(linha.chave) ?? linha.menu.nome;
  }

  salvar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const valores = this.form.getRawValue();
    const menu: MenuCadastro = {
      ...valores,
      codMenu: this.data.menu?.codMenu,
      icone: valores.icone.trim() || null,
    };
    this.salvando.set(true);
    this.service
      .salvarMenu(menu)
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({
        next: salvo => this.dialogRef.close(salvo),
        // O errorInterceptor já exibe a mensagem do backend.
        error: () => {},
      });
  }

  private traduzir(chave: string): string | null {
    const texto = this.translate.instant(chave);
    return typeof texto === 'string' && texto !== chave ? texto : null;
  }
}
