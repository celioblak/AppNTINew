import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  HostListener,
  OnInit,
  TemplateRef,
  ViewChild,
  inject,
} from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MtxGridColumn, MtxGridModule } from '@ng-matero/extensions/grid';
import { HotToastService } from '@ngxpert/hot-toast';

import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { UsuarioCadastro, UsuarioCadastroService } from './usuario-cadastro.service';
import { UsuarioFormDialogComponent } from './usuario-form-dialog.component';
import { UsuariosMvComponent } from './usuarios-mv/usuarios-mv.component';
import { UsuariosMvService } from './usuarios-mv/usuarios-mv.service';

@Component({
  selector: 'app-usuario-cadastro',
  standalone: true,
  templateUrl: './usuario-cadastro.component.html',
  styleUrls: ['./usuario-cadastro.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatTabsModule,
    MtxGridModule,
    UsuariosMvComponent,
  ],
})
export class UsuarioCadastroComponent implements OnInit {
  private readonly service = inject(UsuarioCadastroService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(HotToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly usuariosMvService = inject(UsuariosMvService);

  /** Nomes de responsável dos tickets MV sem vínculo (número na aba "Usuários MV"). */
  pendentesMv = 0;

  // Dados
  usuarios: UsuarioCadastro[] = [];
  usuariosFiltrados: UsuarioCadastro[] = [];
  carregando = false;

  // Filtros
  readonly buscaCtrl = new FormControl('', { nonNullable: true });
  somenteAtivos = true;

  // Grid
  @ViewChild('acoesTpl', { static: true }) acoesTpl!: TemplateRef<any>;
  @ViewChild('perfilTpl', { static: true }) perfilTpl!: TemplateRef<any>;
  @ViewChild('situacaoTpl', { static: true }) situacaoTpl!: TemplateRef<any>;
  columns: MtxGridColumn[] = [];

  isMobile = window.innerWidth < 768;

  @HostListener('window:resize')
  onResize() {
    this.isMobile = window.innerWidth < 768;
  }

  ngOnInit(): void {
    this.definirColunas();
    this.carregar();

    this.buscaCtrl.valueChanges.subscribe(() => this.aplicarFiltro());
  }

  private definirColunas(): void {
    this.columns = [
      { header: 'Nome', field: 'nome', width: 'auto', sortable: true },
      { header: 'Login', field: 'login', width: '140px', sortable: true },
      { header: 'E-mail', field: 'email', width: 'auto', formatter: (r: UsuarioCadastro) => r.email || '—' },
      { header: 'Matrícula', field: 'matricula', width: '110px', formatter: (r: UsuarioCadastro) => (r.matricula ?? '—') as any },
      { header: 'GLPI', field: 'glpiUserId', width: '90px', formatter: (r: UsuarioCadastro) => r.glpiUserId || '—' },
      { header: 'Perfil', field: 'perfil', width: '150px', cellTemplate: this.perfilTpl },
      { header: 'Situação', field: 'snAtivo', width: '100px', cellTemplate: this.situacaoTpl },
      { header: 'Ações', field: 'acoes', width: '110px', cellTemplate: this.acoesTpl },
    ];
  }

  private aplicarFiltro(): void {
    const termo = this.buscaCtrl.value.trim().toLowerCase();
    let lista = this.usuarios;
    if (this.somenteAtivos) {
      lista = lista.filter(u => u.snAtivo);
    }
    if (termo) {
      lista = lista.filter(u =>
        [u.nome, u.login, u.email, u.matricula, u.glpiUserId]
          .filter(v => v != null)
          .some(v => String(v).toLowerCase().includes(termo))
      );
    }
    this.usuariosFiltrados = lista;
    this.cdr.detectChanges();
  }

  carregar(): void {
    this.carregando = true;
    this.service
      .listar()
      .subscribe({
        next: lista => {
          this.usuarios = [...lista].sort((a, b) => a.nome.localeCompare(b.nome));
          this.carregando = false;
          this.aplicarFiltro();
          this.atualizarPendentesMv();
        },
        error: () => {
          this.carregando = false;
          this.toast.error('Erro ao carregar a lista de usuários');
          this.cdr.detectChanges();
        },
      });
  }

  /** Salvar usuário pode vincular pendentes no backend (nome novo ou corrigido), por isso recarrega. */
  private atualizarPendentesMv(): void {
    this.usuariosMvService.quantidadePendentes().subscribe({
      next: qtd => {
        this.pendentesMv = qtd;
        this.cdr.detectChanges();
      },
      error: () => (this.pendentesMv = 0),
    });
  }

  onFiltroChange(): void {
    this.aplicarFiltro();
  }

  openAddDialog(): void {
    const ref = this.dialog.open(UsuarioFormDialogComponent, {
      data: { modo: 'adicionar', usuario: {} as UsuarioCadastro },
      width: this.isMobile ? '95%' : '560px',
      disableClose: true,
    });
    ref.afterClosed().subscribe(res => {
      if (res && res !== 'cancelado') {
        this.carregar();
      }
    });
  }

  openEditDialog(u: UsuarioCadastro): void {
    const ref = this.dialog.open(UsuarioFormDialogComponent, {
      data: { modo: 'editar', usuario: { ...u } },
      width: this.isMobile ? '95%' : '560px',
      disableClose: true,
    });
    ref.afterClosed().subscribe(res => {
      if (res && res !== 'cancelado') {
        this.carregar();
      }
    });
  }

  openDeleteDialog(u: UsuarioCadastro): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        titulo: 'Confirmar Exclusão',
        mensagem: `Tem certeza que deseja excluir o usuário "${u.nome}" (${u.login})?`,
        confirmarTexto: 'Excluir',
      },
      width: this.isMobile ? '90%' : '400px',
    });
    ref.afterClosed().subscribe(res => {
      if (res && u.codUsuario != null) {
        this.service.excluir(u.codUsuario).subscribe({
          next: () => {
            this.toast.success('Usuário excluído com sucesso!');
            this.carregar();
          },
          error: () =>
            this.toast.error('Não foi possível excluir (o usuário pode ter registros vinculados)'),
        });
      }
    });
  }
}
