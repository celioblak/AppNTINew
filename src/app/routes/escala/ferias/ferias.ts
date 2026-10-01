import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, inject, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatOptionModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MtxGridColumn, MtxGridModule } from '@ng-matero/extensions/grid';
import { HotToastService } from '@ngxpert/hot-toast';
import { FormlyFieldConfig, FormlyModule } from '@ngx-formly/core';
import { FormlyMaterialModule } from '@ngx-formly/material';
import { FormlyMatDatepickerModule } from '@ngx-formly/material/datepicker';

import { FeriasFuncionario, Usuario } from '@core/interface';
import { FeriasService } from '../ferias.service';
import { UsuarioService } from '@core/authentication/usuario.service';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { DialogFeriasComponent } from './DialogFeriasComponent';
import { MatAutocompleteModule } from '@angular/material/autocomplete';


@Component({
  selector: 'app-ferias',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatOptionModule,
    MatSelectModule,
    MatTooltipModule,
    MtxGridModule,
    FormlyModule,
    FormlyMaterialModule,
    FormlyMatDatepickerModule,
    MatAutocompleteModule
  ],
  templateUrl: './ferias.html',
  styleUrls: ['./ferias.scss'],
})
export class FeriasComponent implements OnInit {
  private readonly toast = inject(HotToastService);
  private readonly feriasService = inject(FeriasService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);

  // Dados
  feriasList: FeriasFuncionario[] = [];
  usuarios: Usuario[] = [];
  feriasSelecionado?: FeriasFuncionario;

  // Filtros
  mes = new Date().getMonth() + 1; // 1-12
  ano = new Date().getFullYear();
  usuarioFiltroId?: number;
  usuarioFiltroNome: string = '';
  usuariosFiltrados: Usuario[] = [];

  // Grid
  @ViewChild('acoesTpl', { static: true }) acoesTpl!: TemplateRef<any>;
  columns: MtxGridColumn[] = [];

  // Controle de layout
  isMobile = window.innerWidth < 768;

  ngOnInit() {
  this.definirColunas();
  // Carrega usuários primeiro
  this.usuarioService.getTodos().subscribe(users => {
    this.usuarios = users;
    this.usuariosFiltrados = [...users]; // INICIALIZA COM TODOS
    this.cdr.detectChanges();
    // Agora carrega as férias com os usuários já disponíveis
    this.carregarFerias();
  });
}

definirColunas() {
  this.columns = [
    { header: 'Usuário', field: 'nomeUsuario', width: '400px' },
    {
      header: 'Início',
      field: 'dataInicio',
      width: '120px',
      formatter: (row: any) => this.formatarData(row.dataInicio)
    },
    {
      header: 'Fim',
      field: 'dataFim',
      width: '120px',
      formatter: (row: any) => this.formatarData(row.dataFim)
    },
    { header: 'Período (dias)', field: 'periodo', width: '100px' },
    { header: 'Observações', field: 'observacoes', width: 'auto' },
    { header: 'Ações', field: 'acoes', width: '80px', cellTemplate: this.acoesTpl },
  ];
}

// Método auxiliar para formatar datas
private formatarData(data: string | Date): string {
  if (!data) return '';

  // Se for string no formato ISO (yyyy-mm-dd)
  if (typeof data === 'string') {
    const partes = data.split('-');
    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
  }

  // Se for objeto Date
  if (data instanceof Date) {
    const d = data as Date;
    const dia = d.getDate().toString().padStart(2, '0');
    const mes = (d.getMonth() + 1).toString().padStart(2, '0');
    const ano = d.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }

  // Fallback
  return String(data);
}

  carregarUsuarios() {
    this.usuarioService.getTodos().subscribe(users => {
      this.usuarios = users;
      this.cdr.detectChanges();
    });
  }

carregarFerias() {
  const ano = this.ano;
  const mes = this.mes;

  const request = this.usuarioFiltroId
    ? this.feriasService.getFeriasUsuario(this.usuarioFiltroId, ano, mes)
    : this.feriasService.getFeriasPorPeriodo(ano, mes);

  request.subscribe(list => {
    this.feriasList = list.map(f => ({
      ...f,
      nomeUsuario: this.getNomeUsuario(f.idUsuario),
      // ⬇️ Calcula período (dias inclusivos)
      periodo: this.calcularPeriodo(f.dataInicio, f.dataFim)
    }));
    this.cdr.detectChanges();
  });
}

private getNomeUsuario(idUsuario: number): string {
  const user = this.usuarios.find(u => u.codUsuario === idUsuario);
  return user ? user.nome || `ID: ${idUsuario}` : `ID: ${idUsuario}`;
}
private calcularPeriodo(dataInicio: string | Date, dataFim: string | Date): number {
  if (!dataInicio || !dataFim) return 0;
  const inicio = new Date(dataInicio);
  const fim = new Date(dataFim);
  inicio.setHours(0, 0, 0, 0);
  fim.setHours(0, 0, 0, 0);
  const diffTime = fim.getTime() - inicio.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusivo
  return diffDays;
}

  onFiltroChange() {
    this.carregarFerias();
  }

  openAddDialog() {
      const dialogRef = this.dialog.open(DialogFeriasComponent, {
    data: {
      modo: 'adicionar',
      ferias: {},
      usuarios: this.usuarios,
      mesFiltro: this.mes,    // ⬅️
      anoFiltro: this.ano      // ⬅️
    },
    width: this.isMobile ? '95%' : '600px',
    disableClose: true,
  });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result !== 'cancelado') {
        this.carregarFerias();
        this.toast.success('Férias cadastradas com sucesso!');
      }
    });
  }

  openEditDialog(ferias: FeriasFuncionario) {
    const dialogRef = this.dialog.open(DialogFeriasComponent, {
    data: {
      modo: 'editar',
      ferias: { ...ferias },
      usuarios: this.usuarios,
      mesFiltro: this.mes,     // ⬅️
      anoFiltro: this.ano       // ⬅️
    },
    width: this.isMobile ? '95%' : '600px',
    disableClose: true,
  });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result !== 'cancelado') {
        this.carregarFerias();
        this.toast.success('Férias atualizadas com sucesso!');
      }
    });
  }

  openDeleteDialog(ferias: FeriasFuncionario) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        titulo: 'Confirmar Exclusão',
        mensagem: `Tem certeza que deseja excluir as férias do período ${ferias.dataInicio} a ${ferias.dataFim}?`,
        confirmarTexto: 'Excluir',
      },
      width: this.isMobile ? '90%' : '400px',
      height: this.isMobile ? '90%' : '230px',
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && ferias.id) {
        this.feriasService.excluirFerias(ferias.id).subscribe({
          next: () => {
            this.toast.success('Férias excluídas com sucesso!');
            this.carregarFerias();
          },
          error: err => {
            this.toast.error('Erro ao excluir férias!');
            console.error(err);
          },
        });
      }
    });
  }

  @HostListener('window:resize')
  onResize() {
    this.isMobile = window.innerWidth < 768;
  }

// MÉTODO PARA FILTRAR USUÁRIOS
filtrarUsuarios() {
  const termo = this.usuarioFiltroNome?.toLowerCase() || '';
  this.usuariosFiltrados = this.usuarios.filter(u =>
    u.nome?.toLowerCase().includes(termo)
  );
}

// MÉTODO QUANDO UM USUÁRIO É SELECIONADO
onUsuarioSelecionado(id: number) {
  this.usuarioFiltroId = id;
  const user = this.usuarios.find(u => u.codUsuario === id);
  this.usuarioFiltroNome = user ? (user.nome || '') : ''; // <- correção
  this.onFiltroChange();
}

// MÉTODO PARA LIMPAR O FILTRO
limparFiltroUsuario() {
  this.usuarioFiltroId = undefined;
  this.usuarioFiltroNome = '';
  this.usuariosFiltrados = [...this.usuarios];
  this.onFiltroChange();
}
}
