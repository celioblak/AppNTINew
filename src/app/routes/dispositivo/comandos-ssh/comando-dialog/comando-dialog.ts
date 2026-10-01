import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ComandoCategoria, ServidorComando, ServidorSsh } from '@core';
import { finalize, startWith } from 'rxjs';

import { agrupar, normalizar } from '../../terminal-ssh/comandos';
import { TerminalSshService } from '../../terminal-ssh/terminal-ssh.service';
import { CategoriasDialogComponent } from '../categorias-dialog';

export interface ComandoDialogData {
  comando?: ServidorComando;
  /** Servidor já marcado quando o comando é novo (ex.: filtro de servidor ativo na tela). */
  codServidorSugerido?: number | null;
}

type EstadoGrupo = 'todos' | 'parcial' | 'nenhum';

@Component({
  selector: 'app-comando-dialog',
  imports: [
    ReactiveFormsModule,
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
  templateUrl: './comando-dialog.html',
  styleUrl: './comando-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComandoDialogComponent implements OnInit {
  readonly data = inject<ComandoDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ComandoDialogComponent, ServidorComando>>(MatDialogRef);
  private readonly dialog = inject(MatDialog);
  private readonly service = inject(TerminalSshService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly dicaParametros = 'Use {{nome}} para pedir um valor na execução. Ex.: tail -f {{arquivo}}';
  readonly salvando = signal(false);

  readonly servidores = signal<ServidorSsh[]>([]);
  readonly carregandoServidores = signal(true);
  readonly erroServidores = signal(false);
  readonly categorias = signal<ComandoCategoria[]>([]);
  readonly filtroServidor = signal('');

  private readonly sugerido = this.data.codServidorSugerido;

  readonly form = this.fb.group({
    dsTitulo: [this.data.comando?.dsTitulo ?? '', [Validators.required, Validators.maxLength(100)]],
    codCategoria: this.fb.control<number | null>(this.data.comando?.codCategoria ?? null),
    dsComando: [this.data.comando?.dsComando ?? '', [Validators.required, Validators.maxLength(4000)]],
    dsDescricao: [this.data.comando?.dsDescricao ?? '', Validators.maxLength(500)],
    snTodosServidores: [this.data.comando?.snTodosServidores ?? false],
    codServidores: this.fb.control<number[]>(this.data.comando?.codServidores ?? (this.sugerido ? [this.sugerido] : [])),
    snExecutar: [this.data.comando?.snExecutar ?? true],
    snConfirmar: [this.data.comando?.snConfirmar ?? false],
    nrOrdem: this.fb.control<number | null>(this.data.comando?.nrOrdem ?? null),
  });

  readonly todosServidores = toSignal(this.form.controls.snTodosServidores.valueChanges, {
    initialValue: this.form.controls.snTodosServidores.value,
  });

  private readonly codServidores = toSignal(this.form.controls.codServidores.valueChanges, {
    initialValue: this.form.controls.codServidores.value,
  });

  readonly selecionados = computed(() => new Set(this.codServidores()));

  readonly gruposServidores = computed(() => {
    const termo = normalizar(this.filtroServidor().trim());
    const visiveis = this.servidores().filter(
      s => !termo || normalizar([s.dsServidor, s.dsIP, s.dsMaquina, s.dsGrupo].join(' ')).includes(termo)
    );
    return agrupar(visiveis, s => s.dsGrupo ?? 'Sem grupo').sort((a, b) => a.nome.localeCompare(b.nome));
  });

  /** Vinculados que não estão na lista (ex.: servidor deixou de ser Linux/SSH). O vínculo é mantido. */
  readonly vinculadosForaDaLista = computed(() => {
    if (this.carregandoServidores() || this.erroServidores()) {
      return 0;
    }
    const naLista = new Set(this.servidores().map(s => s.codServidor));
    return this.codServidores().filter(cod => !naLista.has(cod)).length;
  });

  constructor() {
    const { snTodosServidores, codServidores } = this.form.controls;
    snTodosServidores.valueChanges
      .pipe(startWith(snTodosServidores.value), takeUntilDestroyed())
      .subscribe(todos => {
        codServidores.setValidators(todos ? null : Validators.required);
        codServidores.updateValueAndValidity({ emitEvent: false });
      });
  }

  ngOnInit() {
    this.service
      .listarServidores()
      .pipe(finalize(() => this.carregandoServidores.set(false)))
      .subscribe({
        next: servidores => this.servidores.set(servidores),
        error: () => this.erroServidores.set(true),
      });
    this.carregarCategorias();
  }

  estadoGrupo(itens: ServidorSsh[]): EstadoGrupo {
    const marcados = itens.filter(s => this.selecionados().has(s.codServidor)).length;
    if (marcados === 0) {
      return 'nenhum';
    }
    return marcados === itens.length ? 'todos' : 'parcial';
  }

  alternarServidor(codServidor: number, marcado: boolean) {
    this.alterarSelecao([codServidor], marcado);
  }

  /** Marca ou desmarca os servidores visíveis do grupo. */
  alternarGrupo(itens: ServidorSsh[], marcado: boolean) {
    this.alterarSelecao(itens.map(s => s.codServidor), marcado);
  }

  limparSelecao() {
    this.definirSelecao([]);
  }

  abrirCategorias(evento: Event) {
    evento.stopPropagation();
    this.dialog
      .open(CategoriasDialogComponent, { width: '560px', maxWidth: '95vw' })
      .afterClosed()
      .subscribe(() => this.carregarCategorias());
  }

  salvar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const valores = this.form.getRawValue();
    const comando: ServidorComando = {
      ...valores,
      codServidores: valores.snTodosServidores ? [] : valores.codServidores,
      codComando: this.data.comando?.codComando,
    };
    this.salvando.set(true);
    this.service
      .salvarComando(comando)
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({
        next: salvo => this.dialogRef.close(salvo),
        // O errorInterceptor já exibe a mensagem do backend.
        error: () => {},
      });
  }

  private carregarCategorias() {
    this.service.listarCategorias().subscribe({
      next: categorias => {
        this.categorias.set(categorias);
        // Categoria selecionada pode ter sido excluída no cadastro de categorias.
        const controle = this.form.controls.codCategoria;
        if (controle.value != null && !categorias.some(c => c.codCategoria === controle.value)) {
          controle.setValue(null);
        }
      },
      error: () => {},
    });
  }

  private alterarSelecao(codigos: number[], marcado: boolean) {
    const selecao = new Set(this.form.controls.codServidores.value);
    for (const codigo of codigos) {
      if (marcado) {
        selecao.add(codigo);
      } else {
        selecao.delete(codigo);
      }
    }
    this.definirSelecao([...selecao]);
  }

  private definirSelecao(codigos: number[]) {
    const controle = this.form.controls.codServidores;
    controle.setValue(codigos);
    controle.markAsTouched();
  }
}
