import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ComandoCategoria, ServidorComando, ServidorSsh } from '@core';
import { MtxDialog } from '@ng-matero/extensions/dialog';
import { MtxGridColumn, MtxGridModule } from '@ng-matero/extensions/grid';
import { HotToastService } from '@ngxpert/hot-toast';
import { AlturaAteRodape } from '@shared';
import { finalize } from 'rxjs';

import { nomesVinculados, normalizar, rotuloServidores } from '../terminal-ssh/comandos';
import { TerminalSshService } from '../terminal-ssh/terminal-ssh.service';
import { CategoriasDialogComponent } from './categorias-dialog';
import { ComandoDialogComponent, ComandoDialogData } from './comando-dialog/comando-dialog';

/** Dispositivos > Comandos SSH: cadastro dos comandos do terminal, suas categorias e servidores vinculados. */
@Component({
  selector: 'app-comandos-ssh',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    MtxGridModule,
    AlturaAteRodape,
  ],
  templateUrl: './comandos-ssh.html',
  styleUrl: './comandos-ssh.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComandosSshComponent implements OnInit {
  private readonly service = inject(TerminalSshService);
  private readonly dialog = inject(MatDialog);
  private readonly mtxDialog = inject(MtxDialog);
  private readonly toast = inject(HotToastService);

  readonly servidores = signal<ServidorSsh[]>([]);
  readonly categorias = signal<ComandoCategoria[]>([]);
  readonly comandos = signal<ServidorComando[]>([]);
  readonly carregando = signal(true);
  readonly filtro = signal('');
  readonly filtroCategoria = signal<number | null>(null);
  readonly filtroServidor = signal<number | null>(null);

  private readonly nomes = computed(() => new Map(this.servidores().map(s => [s.codServidor, s.dsServidor])));

  readonly filtrados = computed(() => {
    const termo = normalizar(this.filtro().trim());
    const categoria = this.filtroCategoria();
    const servidor = this.filtroServidor();
    return this.comandos().filter(
      c =>
        (categoria == null || c.codCategoria === categoria) &&
        (servidor == null || c.snTodosServidores || c.codServidores.includes(servidor)) &&
        (!termo ||
          normalizar([c.dsTitulo, c.dsComando, c.dsCategoria, c.dsDescricao, this.vinculados(c)].join(' ')).includes(termo))
    );
  });

  readonly colunas: MtxGridColumn[] = [
    { header: 'Título', field: 'dsTitulo', width: '220px', sortable: true },
    { header: 'Comando', field: 'dsComando', minWidth: 280 },
    { header: 'Categoria', field: 'dsCategoria', width: '140px', sortable: true },
    { header: 'Servidores', field: 'codServidores', width: '240px' },
    { header: 'Enter', field: 'snExecutar', width: '70px', formatter: (c: ServidorComando) => (c.snExecutar ? 'Sim' : 'Não') },
    { header: 'Confirma', field: 'snConfirmar', width: '85px', formatter: (c: ServidorComando) => (c.snConfirmar ? 'Sim' : 'Não') },
    { header: 'Cadastrado por', field: 'nmUsuarioCadastro', width: '140px', sortable: true },
    {
      header: 'Operações',
      field: 'operacoes',
      width: '110px',
      pinned: 'right',
      type: 'button',
      buttons: [
        { type: 'icon', icon: 'edit', tooltip: 'Editar', click: (c: ServidorComando) => this.abrirCadastro(c) },
        { type: 'icon', icon: 'delete', color: 'warn', tooltip: 'Excluir', click: (c: ServidorComando) => this.excluir(c) },
      ],
    },
  ];

  ngOnInit() {
    this.carregar();
    this.carregarCategorias();
    this.service.listarServidores().subscribe({ next: servidores => this.servidores.set(servidores), error: () => {} });
  }

  rotulo(comando: ServidorComando) {
    return rotuloServidores(comando, this.nomes());
  }

  vinculados(comando: ServidorComando) {
    return nomesVinculados(comando, this.nomes()).join(', ');
  }

  limparFiltros() {
    this.filtro.set('');
    this.filtroCategoria.set(null);
    this.filtroServidor.set(null);
  }

  abrirCadastro(comando?: ServidorComando) {
    const data: ComandoDialogData = { comando, codServidorSugerido: comando ? null : this.filtroServidor() };
    this.dialog
      .open<ComandoDialogComponent, ComandoDialogData, ServidorComando>(ComandoDialogComponent, { width: '780px', maxWidth: '95vw', data })
      .afterClosed()
      .subscribe(salvo => {
        // Categorias podem ter sido cadastradas de dentro do diálogo.
        this.carregarCategorias();
        if (salvo) {
          this.toast.success(`Comando "${salvo.dsTitulo}" salvo.`);
          this.carregar();
        }
      });
  }

  abrirCategorias() {
    this.dialog
      .open(CategoriasDialogComponent, { width: '560px', maxWidth: '95vw' })
      .afterClosed()
      .subscribe(() => {
        this.carregarCategorias();
        this.carregar(); // nomes e ordem das categorias aparecem na grade
      });
  }

  private excluir(comando: ServidorComando) {
    this.mtxDialog.confirm(`Excluir o comando "${comando.dsTitulo}"?`, `Disponível em: ${this.rotulo(comando)}`, () =>
      this.service.excluirComando(comando.codComando!).subscribe({
        next: () => {
          this.toast.success('Comando excluído.');
          this.carregar();
        },
        error: () => {},
      })
    );
  }

  private carregar() {
    this.carregando.set(true);
    this.service
      .listarTodosComandos()
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({ next: comandos => this.comandos.set(comandos), error: () => this.comandos.set([]) });
  }

  private carregarCategorias() {
    this.service.listarCategorias().subscribe({ next: categorias => this.categorias.set(categorias), error: () => {} });
  }
}
