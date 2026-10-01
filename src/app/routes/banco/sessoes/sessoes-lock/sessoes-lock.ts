import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SessaoLock } from '@core';
import { MtxDialog } from '@ng-matero/extensions/dialog';
import { MtxGridColumn, MtxGridModule, MtxGridRowClassFormatter } from '@ng-matero/extensions/grid';
import { HotToastService } from '@ngxpert/hot-toast';
import { AlturaAteRodape } from '@shared';
import { finalize } from 'rxjs';

import { SessaoQueriFormComponent } from '../sessao-query-form';
import { SessionService } from '../sessao.service';

interface FiltroSessaoLock {
  status: string;
  username: string;
  osuser: string;
  machine: string;
  program: string;
  owner: string;
  objectName: string;
  objectType: string;
  instId: number | null;
  sid: number | null;
  minutosOciosaMin: number | null;
  somenteBloqueando: boolean;
}

/** Erro relançado pelo errorInterceptor, que já exibe toast com o `message` do ApiErrorResponse. */
type ErroApi = Error & { status?: number; original?: HttpErrorResponse };

const FILTRO_PADRAO: FiltroSessaoLock = {
  status: 'INACTIVE',
  username: '',
  osuser: '',
  machine: '',
  program: '',
  owner: '',
  objectName: '',
  objectType: '',
  instId: null,
  sid: null,
  minutosOciosaMin: null,
  somenteBloqueando: false,
};

/** Aba "Inativas bloqueando objetos": sessões segurando lock (GV$LOCKED_OBJECT) e o impacto em outras sessões. */
@Component({
  selector: 'app-sessoes-lock',
  standalone: true,
  hostDirectives: [AlturaAteRodape],
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MtxGridModule,
  ],
  templateUrl: './sessoes-lock.html',
  styleUrl: './sessoes-lock.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessoesLockComponent implements OnInit {
  private readonly sessaoService = inject(SessionService);
  private readonly toast = inject(HotToastService);
  private readonly dialog = inject(MatDialog);
  private readonly mtxDialog = inject(MtxDialog);

  readonly tiposObjeto = ['TABLE', 'TABLE PARTITION', 'TABLE SUBPARTITION'];
  readonly textoSemResultado = 'Nenhuma sessão segurando lock com os filtros informados';

  filtro: FiltroSessaoLock = { ...FILTRO_PADRAO };

  readonly lista = signal<SessaoLock[]>([]);
  readonly carregando = signal(false);
  readonly ultimaAtualizacao = signal<Date | null>(null);

  /** A grade tem uma linha por objeto; o resumo conta sessões distintas. */
  readonly resumo = computed(() => {
    const linhas = this.lista();
    const sessoes = [...new Map(linhas.map(l => [this.chaveSessao(l), l])).values()];
    return {
      sessoes: sessoes.length,
      objetos: new Set(linhas.map(l => `${l.owner}.${l.objectName}`)).size,
      travando: sessoes.filter(s => s.qtdSessoesBloqueadas > 0).length,
      aguardando: sessoes.reduce((total, s) => total + s.qtdSessoesBloqueadas, 0),
      maiorOciosa: sessoes.reduce((maior, s) => Math.max(maior, s.segundosOciosa), 0),
    };
  });

  readonly columns: MtxGridColumn[] = [
    { header: 'Situação', field: 'gravidade', width: '200px', pinned: 'left' },
    { header: 'Sessão (SID,Serial@Inst)', field: 'sid', width: '170px', pinned: 'left', sortable: true },
    { header: 'Usuário do banco', field: 'username', width: '140px', sortable: true },
    { header: 'Objeto bloqueado', field: 'objectName', width: '260px', sortable: true },
    { header: 'Tipo de lock', field: 'lockedMode', width: '230px', sortable: true },
    { header: 'Sem atividade há', field: 'segundosOciosa', width: '150px', sortable: true },
    { header: 'Lock mantido há', field: 'segundosLock', width: '130px', sortable: true },
    { header: 'Transação aberta desde', field: 'inicioTransacao', width: '170px', sortable: true },
    { header: 'Alterações pendentes', field: 'registrosUndo', width: '150px', sortable: true },
    { header: 'Usuário do SO', field: 'osuser', width: '140px', sortable: true },
    { header: 'Máquina', field: 'machine', width: '180px', sortable: true },
    { header: 'Programa', field: 'program', width: '200px', sortable: true },
    { header: 'Módulo', field: 'module', width: '180px', sortable: true },
    { header: 'Conectada desde', field: 'logonTime', width: '150px', sortable: true },
    {
      header: 'Operações',
      field: 'operacoes',
      pinned: 'right',
      minWidth: 110,
      width: '110px',
      type: 'button',
      buttons: [
        {
          type: 'icon',
          icon: 'code',
          color: 'primary',
          tooltip: 'Ver o último SQL executado pela sessão',
          iif: (row: SessaoLock) => !!row.prevSqlId,
          click: (row: SessaoLock) => this.verUltimoSql(row),
        },
        {
          type: 'icon',
          icon: 'offline_bolt',
          color: 'warn',
          tooltip: 'Derrubar a sessão (desfaz a transação e libera os locks)',
          click: (row: SessaoLock) => this.confirmarDerrubar(row),
        },
      ],
    },
  ];

  readonly rowClassFormatter: MtxGridRowClassFormatter = {
    'linha-critica': (row: SessaoLock) => row.gravidade === 'CRITICO',
  };

  ngOnInit() {
    this.pesquisar();
  }

  pesquisar() {
    this.carregando.set(true);
    this.sessaoService
      .pesquisarSessoesLock(this.montarParametros())
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({
        next: linhas => {
          this.lista.set(linhas ?? []);
          this.ultimaAtualizacao.set(new Date());
        },
        error: () => this.lista.set([]),
      });
  }

  limpar() {
    this.filtro = { ...FILTRO_PADRAO };
    this.pesquisar();
  }

  verUltimoSql(row: SessaoLock) {
    let params = new HttpParams().set('sqlId', row.prevSqlId!);
    if (row.prevHashValue !== null) {
      params = params.set('hashValue', String(row.prevHashValue));
    }
    this.sessaoService.pesquisarSql(params).subscribe({
      next: dados => {
        if (!dados?.length) {
          this.toast.warning('O último SQL desta sessão não está mais em memória no banco.');
          return;
        }
        this.dialog.open(SessaoQueriFormComponent, {
          maxWidth: '70vw',
          maxHeight: '100vh',
          height: '70%',
          width: '90%',
          panelClass: 'full-screen-modal',
          data: dados[0],
        });
      },
      error: () => {},
    });
  }

  confirmarDerrubar(row: SessaoLock) {
    const objetos = this.lista().filter(l => this.chaveSessao(l) === this.chaveSessao(row)).length;
    const pendentes = row.registrosUndo ? ` Cerca de ${row.registrosUndo} alteração(ões) serão desfeitas.` : '';
    this.mtxDialog.confirm(
      `Derrubar a sessão ${row.sid},${row.serial} de ${row.username ?? 'usuário desconhecido'}?`,
      `A transação pendente será desfeita (ROLLBACK) e os locks em ${objetos} objeto(s) serão liberados.${pendentes}`,
      () => this.derrubar(row)
    );
  }

  formatarDuracao(segundos: number | null | undefined): string {
    if (segundos == null) {
      return '—';
    }
    if (segundos < 60) {
      return `${segundos}s`;
    }
    const minutos = Math.floor(segundos / 60);
    if (minutos < 60) {
      return `${minutos} min`;
    }
    const horas = Math.floor(minutos / 60);
    if (horas < 24) {
      return `${horas}h ${minutos % 60}min`;
    }
    return `${Math.floor(horas / 24)}d ${horas % 24}h`;
  }

  private derrubar(row: SessaoLock) {
    this.sessaoService.matarSessoes({ sid: row.sid, serial: row.serial, instId: row.instId }).subscribe({
      next: () => {
        this.toast.success(`Sessão ${row.sid},${row.serial} de ${row.username} derrubada.`);
        this.pesquisar();
      },
      error: (erro: ErroApi) => {
        // O DELETE devolve texto puro (ORA-...), que o interceptor não consegue exibir.
        const detalhe = erro.original?.error;
        if (typeof detalhe === 'string') {
          this.toast.error(`Erro ao derrubar a sessão ${row.sid},${row.serial}:\n${detalhe}`);
        }
        this.pesquisar();
      },
    });
  }

  private montarParametros(): HttpParams {
    let params = new HttpParams();
    for (const [chave, valor] of Object.entries(this.filtro)) {
      const texto = valor == null || valor === false ? '' : String(valor).trim();
      if (texto) {
        params = params.set(chave, texto);
      }
    }
    return params;
  }

  private chaveSessao(linha: SessaoLock): string {
    return `${linha.instId}-${linha.sid}-${linha.serial}`;
  }
}
