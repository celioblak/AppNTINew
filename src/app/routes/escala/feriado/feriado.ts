import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, inject, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatOptionModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MtxGridColumn, MtxGridModule } from '@ng-matero/extensions/grid';
import { HotToastService } from '@ngxpert/hot-toast';

import { Feriado } from '@core/interface';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { FeriadoService } from '../feriado.service';
import { DialogFeriadoComponent } from './dialog-feriado.component';
import { ReplicarFeriadoDialogComponent } from './replicar-feriado-dialog.component';

@Component({
  selector: 'app-feriado',
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
  ],
  templateUrl: './feriado.html',
  styleUrls: ['./feriado.scss'],
})
export class FeriadoComponent implements OnInit {
  private readonly toast = inject(HotToastService);
  private readonly feriadoService = inject(FeriadoService);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);

  // Dados
  feriados: Feriado[] = [];

  // Filtros
  mes = new Date().getMonth() + 1; // 1-12
  ano = new Date().getFullYear();

  // Grid
  @ViewChild('acoesTpl', { static: true }) acoesTpl!: TemplateRef<any>;
  columns: MtxGridColumn[] = [];

  // Controle de layout
  isMobile = window.innerWidth < 768;

  ngOnInit() {
    this.definirColunas();
    this.carregarFeriados();
  }

  definirColunas() {
    this.columns = [
      {
        header: 'Data',
        field: 'data',
        width: '120px',
        formatter: (row: Feriado) => this.formatarData(row.data),
      },
      { header: 'Nome', field: 'nome', width: 'auto' },
      { header: 'Ações', field: 'acoes', width: '120px', cellTemplate: this.acoesTpl },
    ];
  }

  carregarFeriados() {
    this.feriadoService.getFeriados(this.ano, this.mes).subscribe({
      next: (lista) => {
        this.feriados = lista;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.toast.error('Erro ao carregar feriados');
        console.error(err);
      },
    });
  }

  onFiltroChange() {
    this.carregarFeriados();
  }

  private formatarData(data: string): string {
    if (!data) return '';
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  openAddDialog() {
    const dialogRef = this.dialog.open(DialogFeriadoComponent, {
      data: { modo: 'adicionar', feriado: {} },
      width: this.isMobile ? '95%' : '500px',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result && result !== 'cancelado') {
        this.carregarFeriados();
        this.toast.success('Feriado cadastrado com sucesso!');
      }
    });
  }

  openEditDialog(feriado: Feriado) {
    const dialogRef = this.dialog.open(DialogFeriadoComponent, {
      data: { modo: 'editar', feriado: { ...feriado } },
      width: this.isMobile ? '95%' : '500px',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result && result !== 'cancelado') {
        this.carregarFeriados();
        this.toast.success('Feriado atualizado com sucesso!');
      }
    });
  }

  openDeleteDialog(feriado: Feriado) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        titulo: 'Confirmar Exclusão',
        mensagem: `Tem certeza que deseja excluir o feriado "${feriado.nome}" (${this.formatarData(feriado.data)})?`,
        confirmarTexto: 'Excluir',
      },
      width: this.isMobile ? '90%' : '400px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result && feriado.id) {
        this.feriadoService.deleteFeriado(feriado.id).subscribe({
          next: () => {
            this.toast.success('Feriado excluído com sucesso!');
            this.carregarFeriados();
          },
          error: (err) => {
            this.toast.error('Erro ao excluir feriado');
            console.error(err);
          },
        });
      }
    });
  }

  openReplicarDialog(feriado: Feriado) {
    const dialogRef = this.dialog.open(ReplicarFeriadoDialogComponent, {
      data: { feriado },
      width: this.isMobile ? '95%' : '450px',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result && result !== 'cancelado') {
        this.carregarFeriados();
        this.toast.success('Feriados replicados com sucesso!');
      }
    });
  }

  @HostListener('window:resize')
  onResize() {
    this.isMobile = window.innerWidth < 768;
  }
}
