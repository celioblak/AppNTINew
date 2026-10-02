import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { environment } from '@env/environment';
import { HotToastService } from '@ngxpert/hot-toast';
import { finalize } from 'rxjs';

interface PreviaAviso {
  referencia: string;
  diaDeAviso: boolean;
  proximoAviso: string | null;
  inicio: string | null;
  fim: string | null;
  titulo: string | null;
  destinatarios: number;
  comTelegram: number;
  nomes: string[];
  enviadoEm: string | null;
  enviadoPor: string | null;
  resultado: string | null;
  imagemBase64: string | null;
  /** Calendário do mês (e do seguinte, se o aviso pega dias dele), enviado logo depois, sem som. */
  calendarios: string[];
}

interface ResultadoAviso {
  destinatarios: number;
  telegram: number;
  falhas: number;
  mensagem: string;
}

/**
 * Prévia e "enviar agora" do aviso da escala antes de fim de semana e feriado (ntiapi docs/plantao-escala-aviso.md,
 * R-08): a mesma imagem que a equipe de plantão recebe no Telegram.
 */
@Component({
  selector: 'app-aviso-escala-dialog',
  imports: [DatePipe, MatButtonModule, MatDialogModule, MatIconModule, MatProgressBarModule],
  template: `
    <h2 mat-dialog-title>Aviso do fim de semana / feriado</h2>
    <mat-dialog-content>
      @if (carregando()) {
        <mat-progress-bar mode="indeterminate" />
      }
      @if (previa(); as p) {
        @if (!p.titulo) {
          <p class="dica">Nenhum fim de semana ou feriado nos próximos 40 dias.</p>
        } @else {
          <p class="dica">
            @if (p.diaDeAviso) {
              Hoje é dia de aviso: às 18h a equipe recebe esta escala.
            } @else {
              Próximo aviso: <b>{{ p.proximoAviso | date: 'EEEE dd/MM' }}</b>, às 18h.
            }
            Vai para <b>{{ p.destinatarios }}</b> plantonista(s) da escala ({{ p.comTelegram }} com Telegram ligado) e para o aplicativo.
            Quem está de plantão no período recebe sempre com som.
          </p>
          @if (p.enviadoEm) {
            <p class="enviado">Enviado em {{ p.enviadoEm | date: 'dd/MM HH:mm' }} por {{ p.enviadoPor }}: {{ p.resultado }}</p>
          }
          @if (p.imagemBase64) {
            <img class="imagem" [src]="'data:image/png;base64,' + p.imagemBase64" alt="Escala do período" />
          }
          @for (c of p.calendarios; track $index) {
            <p class="dica">Em seguida, sem som: calendário do mês (alta resolução, para dar zoom).</p>
            <img class="imagem" [src]="'data:image/png;base64,' + c" alt="Calendário da escala" />
          }
          <p class="dica nomes">Equipe: {{ p.nomes.join(', ') }}</p>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button mat-dialog-close>Fechar</button>
      <button mat-flat-button (click)="enviar()" [disabled]="enviando() || !previa()?.titulo">
        <mat-icon>send</mat-icon> {{ previa()?.enviadoEm ? 'Reenviar agora' : 'Enviar agora' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .dica { margin: 0 0 10px; font-size: .85rem; color: var(--mat-sys-on-surface-variant, rgba(0,0,0,.6)); }
    .enviado { margin: 0 0 10px; font-size: .82rem; color: #1e7a45; }
    .imagem { display: block; width: 100%; max-width: 640px; margin: 0 auto 10px; border-radius: 8px;
              border: 1px solid var(--mat-sys-outline-variant, #d5d8de); }
    .nomes { font-size: .78rem; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvisoEscalaDialogComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(HotToastService);
  private readonly api = `${environment.ApiBaseUrl}escala/aviso`;

  readonly carregando = signal(false);
  readonly enviando = signal(false);
  readonly previa = signal<PreviaAviso | null>(null);

  ngOnInit() {
    this.carregar();
  }

  private carregar() {
    this.carregando.set(true);
    this.http
      .get<PreviaAviso>(`${this.api}/previa`)
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({ next: p => this.previa.set(p), error: () => {} });
  }

  enviar() {
    const p = this.previa();
    if (!p) return;
    this.enviando.set(true);
    this.http
      .post<ResultadoAviso>(`${this.api}/enviar`, {}, { params: { data: p.referencia } })
      .pipe(finalize(() => this.enviando.set(false)))
      .subscribe({
        next: r => {
          if (r.falhas > 0) this.toast.warning(r.mensagem);
          else this.toast.success(r.mensagem);
          this.carregar();
        },
        error: () => {},
      });
  }
}
