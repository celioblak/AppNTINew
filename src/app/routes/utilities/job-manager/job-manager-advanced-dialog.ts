import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable } from 'rxjs';
import {
  EstadoAgendador,
  ExecucaoAgendador,
  JobManagerService,
  ProblemaAgendador,
  ResultadoAgendador,
} from './job-manager.service';

/**
 * Gerenciamento avançado do agendador (Quartz em cluster).
 *
 * A recuperação é automática: o vigia de cada nó do ntiapi interrompe e
 * abandona execuções travadas, reativa gatilhos em erro, libera bloqueios,
 * agenda o que falta e retira a pausa geral. Esta tela mostra o que está
 * acontecendo, o que já é corrigido sozinho e o que depende de alguém;
 * os botões só antecipam o que o vigia faria.
 */
@Component({
  selector: 'app-job-manager-advanced-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  templateUrl: 'job-manager-advanced-dialog.html',
  styleUrl: 'job-manager-advanced-dialog.scss',
  providers: [DatePipe],
})
export class JobManagerAdvancedDialogComponent implements OnInit, OnDestroy {
  private readonly dialogRef = inject(MatDialogRef<JobManagerAdvancedDialogComponent>);
  private readonly jobService = inject(JobManagerService);
  private readonly snackBar = inject(MatSnackBar);

  /** Mesmo intervalo da lista de jobs. */
  private static readonly INTERVALO_MS = 15000;

  readonly estado = signal<EstadoAgendador | null>(null);
  readonly erroEstado = signal<string | null>(null);
  readonly carregando = signal(false);
  /** Ação em andamento (desabilita os botões). */
  readonly executando = signal<string | null>(null);
  /** Resultado da última ação, mostrado no topo da aba. */
  readonly ultimoResultado = signal<string[] | null>(null);
  readonly pilhasAbertas = signal<Set<string>>(new Set());

  readonly metaData = signal<any>(null);
  readonly saude = signal<any>(null);

  readonly problemasErro = computed(() => (this.estado()?.problemas ?? []).filter(p => p.severidade === 'ERRO'));
  readonly problemasAviso = computed(() => (this.estado()?.problemas ?? []).filter(p => p.severidade !== 'ERRO'));
  readonly travadas = computed(() => (this.estado()?.execucoes ?? []).filter(e => e.travada).length);
  readonly nosAtivos = computed(() => (this.estado()?.nos ?? []).filter(n => n.ativo).length);

  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    this.carregarEstado();
    this.carregarQuartz();
    this.timer = setInterval(() => this.carregarEstado(), JobManagerAdvancedDialogComponent.INTERVALO_MS);
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  carregarEstado() {
    if (this.carregando()) return;
    this.carregando.set(true);
    this.jobService.estadoAgendador().subscribe({
      next: e => {
        this.estado.set(e);
        this.erroEstado.set(null);
        this.carregando.set(false);
      },
      error: e => {
        this.erroEstado.set(e?.error?.message ?? 'Não foi possível ler o estado do agendador. Confira se o ntiapi está no ar.');
        this.carregando.set(false);
      },
    });
  }

  private carregarQuartz() {
    this.jobService.getSchedulerMetaData().subscribe({ next: m => this.metaData.set(m), error: () => {} });
    this.jobService.getSchedulerHealth().subscribe({ next: s => this.saude.set(s), error: () => {} });
  }

  // ---------------------------------------------------------------- ações

  corrigir(p: ProblemaAgendador) {
    switch (p.acao) {
      case 'REPARAR':
        this.executar('reparar', this.jobService.corrigirAgora());
        break;
      case 'RETIRAR_PAUSA_GERAL':
        this.executar('pausa', this.jobService.retirarPausaGeral());
        break;
      case 'LIMPAR_ORFAOS':
        this.limparOrfaos();
        break;
    }
  }

  corrigirAgora() {
    this.executar('reparar', this.jobService.corrigirAgora());
  }

  limparOrfaos() {
    if (!confirm('Tirar do agendador os jobs que não têm cadastro?\nEles param de rodar.')) return;
    this.executar('orfaos', this.jobService.limparOrfaos());
  }

  pausarTodos() {
    if (!confirm('Pausar todos os jobs?\nAs execuções em andamento terminam normalmente; nada mais dispara até retomar cada job.')) return;
    this.executando.set('pausar');
    this.jobService.cancelAllJobs().subscribe({
      next: r => this.concluir([r?.message ?? 'Todos os jobs foram pausados.']),
      error: e => this.falhou(e),
    });
  }

  interromper(e: ExecucaoAgendador) {
    if (!confirm(`Interromper a execução de "${e.jobName}" no nó ${this.nomeNo(e.instancia)}?\n\n` +
        'Se ela não parar em 2 minutos, é abandonada e o job volta à agenda.')) return;
    this.executar('interromper:' + e.entryId, this.jobService.interromperExecucao(e.entryId));
  }

  private executar(acao: string, chamada: Observable<ResultadoAgendador>) {
    this.executando.set(acao);
    chamada.subscribe({ next: r => this.concluir(r.feito), error: e => this.falhou(e) });
  }

  private concluir(feito: string[]) {
    this.executando.set(null);
    this.ultimoResultado.set(feito);
    this.snackBar.open(feito[0] ?? 'Feito.', 'Fechar', { duration: 4000 });
    this.carregarEstado();
  }

  private falhou(e: any) {
    this.executando.set(null);
    this.snackBar.open(e?.error?.message ?? e?.message ?? 'A ação falhou.', 'Fechar', { duration: 6000 });
  }

  // ---------------------------------------------------------------- apresentação

  alternarPilha(id: string) {
    const abertas = new Set(this.pilhasAbertas());
    if (abertas.has(id)) abertas.delete(id); else abertas.add(id);
    this.pilhasAbertas.set(abertas);
  }

  pilhaAberta(id: string) {
    return this.pilhasAbertas().has(id);
  }

  /** Com instanceId=AUTO o Quartz junta o nome do servidor e um carimbo de 13 dígitos. */
  nomeNo(instancia: string | null | undefined): string {
    return (instancia ?? '').replace(/\d{13}$/, '') || (instancia ?? '');
  }

  duracao(segundos: number | null | undefined): string {
    const s = Math.max(0, Math.round(segundos ?? 0));
    if (s < 60) return `${s} s`;
    const min = Math.floor(s / 60);
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    return `${h} h ${String(min % 60).padStart(2, '0')} min`;
  }

  duracaoEntre(inicio: string, fim: string): string {
    return this.duracao((new Date(fim).getTime() - new Date(inicio).getTime()) / 1000);
  }

  semSinal(segundos: number): string {
    return segundos < 2 ? 'agora' : `há ${this.duracao(segundos)}`;
  }

  usoPool(p: { ativas: number; maximo: number } | null): number {
    return p && p.maximo ? Math.round((p.ativas / p.maximo) * 100) : 0;
  }

  textoAcao(p: ProblemaAgendador): string {
    switch (p.acao) {
      case 'RETIRAR_PAUSA_GERAL': return 'Retirar pausa agora';
      case 'LIMPAR_ORFAOS': return 'Limpar órfãos';
      default: return 'Corrigir agora';
    }
  }

  fechar() {
    this.dialogRef.close(true);
  }
}
