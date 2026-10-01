import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GrupoServidorResumo } from '@core';
import { MtxDialog } from '@ng-matero/extensions/dialog';
import { MtxGridColumn, MtxGridModule } from '@ng-matero/extensions/grid';
import { HotToastService } from '@ngxpert/hot-toast';
import { AlturaAteRodape } from '@shared';
import { finalize } from 'rxjs';

import { normalizar } from '../terminal-ssh/comandos';
import { GrupoServidorDialogComponent, GrupoServidorDialogData } from './grupo-servidor-dialog';
import { GrupoServidorService } from './grupo-servidor.service';

/** Dispositivos > Grupos de servidores: cadastro dos grupos usados em Servidores e no Terminal SSH. */
@Component({
  selector: 'app-grupo-servidor',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
    MtxGridModule,
    AlturaAteRodape,
  ],
  templateUrl: './grupo-servidor.html',
  styleUrl: './grupo-servidor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrupoServidorComponent implements OnInit {
  private readonly service = inject(GrupoServidorService);
  private readonly dialog = inject(MatDialog);
  private readonly mtxDialog = inject(MtxDialog);
  private readonly toast = inject(HotToastService);

  readonly grupos = signal<GrupoServidorResumo[]>([]);
  readonly carregando = signal(true);
  readonly filtro = signal('');

  readonly filtrados = computed(() => {
    const termo = normalizar(this.filtro().trim());
    return this.grupos().filter(g => !termo || normalizar([g.dsGrupo, ...g.servidores].join(' ')).includes(termo));
  });

  readonly colunas: MtxGridColumn[] = [
    { header: 'Grupo', field: 'dsGrupo', minWidth: 220, sortable: true },
    { header: 'Qtde. servidores', field: 'qtdServidores', width: '140px', sortable: true },
    { header: 'Servidores do grupo', field: 'servidores', minWidth: 320 },
    {
      header: 'Operações',
      field: 'operacoes',
      width: '110px',
      pinned: 'right',
      type: 'button',
      buttons: [
        { type: 'icon', icon: 'edit', tooltip: 'Renomear', click: (g: GrupoServidorResumo) => this.abrirCadastro(g) },
        {
          type: 'icon',
          icon: 'delete',
          color: 'warn',
          tooltip: 'Excluir (só grupos sem servidores)',
          disabled: (g: GrupoServidorResumo) => g.qtdServidores > 0,
          click: (g: GrupoServidorResumo) => this.excluir(g),
        },
      ],
    },
  ];

  ngOnInit() {
    this.carregar();
  }

  abrirCadastro(grupo?: GrupoServidorResumo) {
    this.dialog
      .open<GrupoServidorDialogComponent, GrupoServidorDialogData, GrupoServidorResumo>(GrupoServidorDialogComponent, {
        width: '460px',
        maxWidth: '95vw',
        data: { grupo },
      })
      .afterClosed()
      .subscribe(salvo => {
        if (salvo) {
          this.toast.success(`Grupo "${salvo.dsGrupo}" salvo.`);
          this.carregar();
        }
      });
  }

  private excluir(grupo: GrupoServidorResumo) {
    this.mtxDialog.confirm(`Excluir o grupo "${grupo.dsGrupo}"?`, 'Esta ação não pode ser desfeita.', () =>
      this.service.excluir(grupo.codGrupoServidor).subscribe({
        next: () => {
          this.toast.success('Grupo excluído.');
          this.carregar();
        },
        error: () => {},
      })
    );
  }

  private carregar() {
    this.carregando.set(true);
    this.service
      .listar()
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({ next: grupos => this.grupos.set(grupos), error: () => this.grupos.set([]) });
  }
}
