import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ComandoCategoria } from '@core';
import { MtxDialog } from '@ng-matero/extensions/dialog';
import { HotToastService } from '@ngxpert/hot-toast';
import { finalize } from 'rxjs';

import { TerminalSshService } from '../terminal-ssh/terminal-ssh.service';

/** Cadastro das categorias dos comandos, aberto a partir da tela de Comandos SSH. */
@Component({
  selector: 'app-categorias-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatTooltipModule],
  template: `
    <h2 mat-dialog-title>Categorias de comandos</h2>
    <mat-dialog-content>
      <form #form="ngForm" class="formulario" (ngSubmit)="salvar(form)">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="nome">
          <mat-label>{{ emEdicao() ? 'Renomear "' + emEdicao()!.dsCategoria + '"' : 'Nova categoria' }}</mat-label>
          <input matInput name="dsCategoria" [(ngModel)]="dsCategoria" required maxlength="50" autocomplete="off" cdkFocusInitial>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="ordem">
          <mat-label>Ordem</mat-label>
          <input matInput type="number" name="nrOrdem" [(ngModel)]="nrOrdem">
        </mat-form-field>
        <button mat-flat-button type="submit" [disabled]="form.invalid || salvando()">
          <mat-icon>{{ emEdicao() ? 'check' : 'add' }}</mat-icon>
          {{ emEdicao() ? 'Salvar' : 'Adicionar' }}
        </button>
        @if (emEdicao()) {
          <button mat-button type="button" (click)="cancelarEdicao(form)">Cancelar</button>
        }
      </form>

      <div class="lista">
        @for (categoria of categorias(); track categoria.codCategoria) {
          <div class="item" [class.editando]="emEdicao()?.codCategoria === categoria.codCategoria">
            <span class="item-ordem">{{ categoria.nrOrdem ?? '—' }}</span>
            <span class="item-nome">{{ categoria.dsCategoria }}</span>
            <span class="item-uso">{{ categoria.qtdComandos }} {{ categoria.qtdComandos === 1 ? 'comando' : 'comandos' }}</span>
            <button mat-icon-button matTooltip="Editar" (click)="editar(categoria)">
              <mat-icon>edit</mat-icon>
            </button>
            <button mat-icon-button matTooltip="Excluir" [disabled]="categoria.qtdComandos > 0" (click)="excluir(categoria)">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        } @empty {
          <p class="vazio">{{ carregando() ? 'Carregando...' : 'Nenhuma categoria cadastrada.' }}</p>
        }
      </div>

      <p class="dica">
        A ordem define a sequência dos grupos no painel do terminal. Comandos sem categoria aparecem em "Geral".
        Só é possível excluir categorias sem comandos.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Fechar</button>
    </mat-dialog-actions>
  `,
  styles: `
    .formulario {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding-top: 4px;
    }

    .nome {
      flex: 1 1 220px;
    }

    .ordem {
      width: 100px;
    }

    .lista {
      display: flex;
      flex-direction: column;
      margin-top: 12px;
      border: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, .12));
      border-radius: 8px;
      max-height: 50vh;
      overflow-y: auto;
    }

    .item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 2px 4px 2px 12px;

      & + .item {
        border-top: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, .12));
      }

      &.editando {
        background-color: var(--mat-sys-secondary-container, rgba(0, 0, 0, .06));
      }
    }

    .item-ordem {
      width: 36px;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .item-nome {
      flex: 1;
      font-weight: 500;
    }

    .item-ordem,
    .item-uso,
    .vazio,
    .dica {
      font-size: .8rem;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
    }

    .vazio {
      padding: 12px;
      text-align: center;
    }

    .dica {
      margin: 8px 0 0;
      font-size: .75rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriasDialogComponent implements OnInit {
  private readonly service = inject(TerminalSshService);
  private readonly mtxDialog = inject(MtxDialog);
  private readonly toast = inject(HotToastService);

  readonly categorias = signal<ComandoCategoria[]>([]);
  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly emEdicao = signal<ComandoCategoria | null>(null);

  dsCategoria = '';
  nrOrdem: number | null = null;

  ngOnInit() {
    this.carregar();
  }

  editar(categoria: ComandoCategoria) {
    this.emEdicao.set(categoria);
    this.dsCategoria = categoria.dsCategoria;
    this.nrOrdem = categoria.nrOrdem;
  }

  cancelarEdicao(form: NgForm) {
    this.emEdicao.set(null);
    form.resetForm({ dsCategoria: '', nrOrdem: null });
  }

  salvar(form: NgForm) {
    this.salvando.set(true);
    this.service
      .salvarCategoria({ codCategoria: this.emEdicao()?.codCategoria, dsCategoria: this.dsCategoria.trim(), nrOrdem: this.nrOrdem })
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({
        next: salva => {
          this.toast.success(`Categoria "${salva.dsCategoria}" salva.`);
          this.cancelarEdicao(form);
          this.carregar();
        },
        // O errorInterceptor já exibe a mensagem do backend (ex.: nome duplicado).
        error: () => {},
      });
  }

  excluir(categoria: ComandoCategoria) {
    this.mtxDialog.confirm(`Excluir a categoria "${categoria.dsCategoria}"?`, '', () =>
      this.service.excluirCategoria(categoria.codCategoria).subscribe({
        next: () => {
          this.toast.success('Categoria excluída.');
          this.carregar();
        },
        error: () => {},
      })
    );
  }

  private carregar() {
    this.carregando.set(true);
    this.service
      .listarCategorias()
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({ next: categorias => this.categorias.set(categorias), error: () => this.categorias.set([]) });
  }
}
