import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { schedulerJobInfoDetail } from '@core';
import { Subject, debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs';

import { CronValidacao, JobClasse, JobEdicao, JobManagerService } from './job-manager.service';

export interface JobCadastroDialogData {
  /** Nulo = novo job. */
  job: schedulerJobInfoDetail | null;
  /** Grupos já usados, para sugerir. */
  grupos: string[];
}

/** Atalhos de agendamento, em cron do Quartz (segundos primeiro, "?" no dia do mês ou da semana). */
const ATALHOS: { rotulo: string; cron: string }[] = [
  { rotulo: 'A cada minuto', cron: '0 * * * * ?' },
  { rotulo: 'A cada 2 min', cron: '0 */2 * * * ?' },
  { rotulo: 'A cada 5 min', cron: '0 */5 * * * ?' },
  { rotulo: 'A cada 15 min', cron: '0 */15 * * * ?' },
  { rotulo: 'A cada hora', cron: '0 0 * * * ?' },
  { rotulo: 'Todo dia às 7h', cron: '0 0 7 * * ?' },
  { rotulo: 'Dias úteis às 7h', cron: '0 0 7 ? * MON-FRI' },
  { rotulo: 'Toda madrugada (2h)', cron: '0 0 2 * * ?' },
];

/**
 * Cadastro e edição de job. Nome e grupo identificam o job no histórico e
 * não mudam depois; cron, descrição e classe podem mudar (job pausado
 * continua pausado).
 */
@Component({
  selector: 'app-job-cadastro-dialog',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ editando ? 'Editar job ' + data.job?.jobName : 'Novo job' }}</h2>
    <mat-dialog-content class="campos">
      @if (carregando()) {
        <mat-progress-bar mode="indeterminate" />
      }

      <mat-form-field appearance="outline">
        <mat-label>O que o job executa</mat-label>
        <mat-select [ngModel]="classe()" (ngModelChange)="escolherClasse($event)">
          @for (c of classes(); track c.classe) {
            <mat-option [value]="c.classe" [disabled]="!c.cadastravel" [matTooltip]="c.motivo ?? ''">
              <div class="opcao">
                <b>{{ c.nome }}</b>
                @if (c.descricao) {
                  <small>{{ c.descricao }}</small>
                }
                @if (!c.cadastravel) {
                  <small class="bloqueado">{{ c.motivo }}</small>
                }
              </div>
            </mat-option>
          }
        </mat-select>
        @if (classeAtual(); as c) {
          <mat-hint>{{ c.classe }}</mat-hint>
        }
      </mat-form-field>

      <div class="linha">
        <mat-form-field appearance="outline">
          <mat-label>Nome</mat-label>
          <input matInput [(ngModel)]="nome" [disabled]="editando" maxlength="80" />
          <mat-hint>{{ editando ? 'O nome identifica o job no histórico e não muda.' : 'Como aparece na lista de jobs.' }}</mat-hint>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Grupo</mat-label>
          <input matInput [(ngModel)]="grupo" [disabled]="editando" maxlength="80" list="grupos-job" />
          <datalist id="grupos-job">
            @for (g of data.grupos; track g) {
              <option [value]="g"></option>
            }
          </datalist>
        </mat-form-field>
      </div>

      <div class="cron">
        <mat-form-field appearance="outline" class="cron__campo">
          <mat-label>Quando executar (cron do Quartz)</mat-label>
          <input matInput [ngModel]="cron()" (ngModelChange)="mudarCron($event)" placeholder="0 * * * * ?" />
          <mat-hint>segundos minutos horas dia-do-mês mês dia-da-semana</mat-hint>
        </mat-form-field>
        <div class="atalhos">
          @for (a of atalhos; track a.cron) {
            <button mat-stroked-button type="button" [class.ativo]="cron() === a.cron" (click)="mudarCron(a.cron)">{{ a.rotulo }}</button>
          }
          @if (classeAtual()?.cronSugerido; as sugerido) {
            <button mat-stroked-button type="button" [class.ativo]="cron() === sugerido" (click)="mudarCron(sugerido)"
                    matTooltip="Frequência recomendada para este job">
              <mat-icon>star</mat-icon> Sugerido ({{ sugerido }})
            </button>
          }
        </div>
        @if (validacao(); as v) {
          @if (v.valida) {
            <div class="validacao validacao--ok">
              <mat-icon>schedule</mat-icon>
              <span>Próximas execuções: {{ proximasTexto(v) }}</span>
            </div>
          } @else {
            <div class="validacao validacao--erro"><mat-icon>error</mat-icon><span>{{ v.mensagem }}</span></div>
          }
        }
      </div>

      <mat-form-field appearance="outline">
        <mat-label>Descrição</mat-label>
        <textarea matInput [(ngModel)]="descricao" rows="2" maxlength="255"></textarea>
      </mat-form-field>

      @if (!editando) {
        <mat-checkbox [(ngModel)]="iniciarPausado">Criar pausado (retomo depois, na lista)</mat-checkbox>
      } @else if (data.job?.trigger_state === 'PAUSADO' || data.job?.trigger_state === 'PAUSED') {
        <p class="dica"><mat-icon inline>pause_circle</mat-icon> Este job está pausado e continua pausado depois de salvar.</p>
      }

      @if (erro()) {
        <div class="validacao validacao--erro"><mat-icon>error</mat-icon><span>{{ erro() }}</span></div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button (click)="salvar()" [disabled]="!podeSalvar()">Salvar</button>
    </mat-dialog-actions>
  `,
  styles: `
    .campos { display: flex; flex-direction: column; gap: 6px; padding-top: 8px !important; }
    .linha { display: flex; gap: 12px; flex-wrap: wrap; }
    .linha > * { flex: 1 1 220px; }
    .opcao { display: flex; flex-direction: column; line-height: 1.25; padding: 4px 0; }
    .opcao small { font-size: .75rem; color: var(--mat-sys-on-surface-variant, rgba(0,0,0,.6)); white-space: normal; }
    .opcao .bloqueado { color: #a86400; }
    .cron { display: flex; flex-direction: column; gap: 6px; }
    .cron__campo { width: 100%; }
    .atalhos { display: flex; flex-wrap: wrap; gap: 6px; }
    .atalhos button { font-size: .75rem; }
    .atalhos .ativo { border-color: var(--mat-sys-primary, #3f51b5); color: var(--mat-sys-primary, #3f51b5); }
    .validacao { display: flex; gap: 8px; align-items: flex-start; padding: 8px 10px; border-radius: 8px; font-size: .82rem; }
    .validacao--ok { background: color-mix(in srgb, #2e9e5b 12%, transparent); color: #2e7d4f; }
    .validacao--erro { background: color-mix(in srgb, #d93636 12%, transparent); color: #c62828; }
    .dica { margin: 0; font-size: .8rem; color: var(--mat-sys-on-surface-variant, rgba(0,0,0,.6)); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobCadastroDialogComponent implements OnInit {
  readonly data = inject<JobCadastroDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<JobCadastroDialogComponent, boolean>>(MatDialogRef);
  private readonly service = inject(JobManagerService);
  private readonly destroyRef = inject(DestroyRef);
  // Formato só numérico: não depende do locale registrado na aplicação.
  private readonly datePipe = new DatePipe('en-US');

  readonly editando = !!this.data.job?.jobId;
  readonly atalhos = ATALHOS;

  readonly classes = signal<JobClasse[]>([]);
  readonly classe = signal<string | null>(this.data.job?.jobClass ?? null);
  readonly cron = signal(this.data.job?.cronExpression ?? '');
  readonly validacao = signal<CronValidacao | null>(null);
  readonly carregando = signal(false);
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);

  nome = this.data.job?.jobName ?? '';
  grupo = this.data.job?.jobGroup ?? 'NTI';
  descricao = this.data.job?.descricao ?? '';
  iniciarPausado = false;

  readonly classeAtual = computed(() => this.classes().find(c => c.classe === this.classe()) ?? null);

  private readonly cronDigitado = new Subject<string>();

  ngOnInit() {
    this.carregando.set(true);
    this.service
      .classes()
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({
        next: lista => {
          // Classe atual que não está mais na lista (job antigo) continua visível para não sumir.
          const atual = this.classe();
          if (atual && !lista.some(c => c.classe === atual)) {
            lista = [{ classe: atual, nome: atual.split('.').pop() ?? atual, descricao: 'Classe não encontrada nesta versão.',
                       cronSugerido: null, cadastravel: false, motivo: 'Escolha outra classe para voltar a agendar.' }, ...lista];
          }
          this.classes.set(lista);
        },
        error: e => this.erro.set(e?.error?.message ?? 'Não foi possível carregar as classes de job.'),
      });

    this.cronDigitado
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        switchMap(cron => this.service.validarCron(cron)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({ next: v => this.validacao.set(v), error: () => this.validacao.set(null) });

    if (this.cron()) this.cronDigitado.next(this.cron());
  }

  escolherClasse(classe: string) {
    this.classe.set(classe);
    const c = this.classeAtual();
    if (!c) return;
    if (!this.editando && !this.nome.trim()) this.nome = c.nome;
    if (!this.descricao.trim() && c.descricao) this.descricao = c.descricao;
    if (!this.cron() && c.cronSugerido) this.mudarCron(c.cronSugerido);
  }

  mudarCron(valor: string) {
    this.cron.set(valor);
    this.cronDigitado.next(valor);
  }

  proximasTexto(v: CronValidacao): string {
    return v.proximas.map(d => this.datePipe.transform(d, 'dd/MM HH:mm:ss')).join(' · ');
  }

  podeSalvar(): boolean {
    return !this.salvando() && !!this.classe() && !!this.nome.trim() && !!this.validacao()?.valida;
  }

  salvar() {
    const dados: JobEdicao = {
      jobName: this.nome.trim(),
      jobGroup: this.grupo.trim() || 'NTI',
      jobClass: this.classe()!,
      cronExpression: this.cron().trim(),
      descricao: this.descricao.trim() || null,
      iniciarPausado: this.iniciarPausado,
    };
    this.salvando.set(true);
    this.erro.set(null);
    const chamada = this.editando ? this.service.editar(this.data.job!.jobId!, dados) : this.service.criar(dados);
    chamada.pipe(finalize(() => this.salvando.set(false))).subscribe({
      next: () => this.ref.close(true),
      error: e => this.erro.set(e?.error?.message ?? 'Não foi possível salvar o job.'),
    });
  }
}
