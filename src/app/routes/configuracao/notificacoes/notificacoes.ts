import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '@env/environment';
import { HotToastService } from '@ngxpert/hot-toast';
import { finalize } from 'rxjs';

type Regra = 'EXPEDIENTE' | 'COBERTURA' | 'SEMPRE_SOM';

interface RegraDTO {
  codigo: string;
  descricao: string | null;
  regra: Regra;
  telegram: boolean;
  app: boolean;
  painel: boolean;
  padrao: boolean;
  mensagens30Dias: number;
  ultimaMensagem: string | null;
  alteradoPor: string | null;
  alteradoEm: string | null;
}

interface Edicao {
  regra: Regra;
  descricao: string;
  telegram: boolean;
  app: boolean;
  painel: boolean;
}

interface Linha extends RegraDTO {
  edicao: Edicao;
}

const ROTULO: Record<Regra, string> = {
  EXPEDIENTE: 'Segue o expediente',
  COBERTURA: 'Garante alguém',
  SEMPRE_SOM: 'Sempre com som',
};

const EXPLICACAO: Record<Regra, string> = {
  EXPEDIENTE: 'Fora do expediente chega sem som, mesmo sem ninguém de plantão.',
  COBERTURA: 'Fora do expediente chega sem som; se nenhum destinatário está em expediente ou plantão, toca para todos.',
  SEMPRE_SOM: 'Sempre toca, mesmo para quem ligou "Telegram sem som fora do expediente".',
};

/** Tipos que não viram mensagem no aplicativo nem no painel (só Telegram). */
const SO_TELEGRAM = new Set(['AVISO_PLANTAO']);

/**
 * Configurações › Notificações: por tipo de mensagem, os canais (Telegram, aplicativo, painel) e o som do
 * Telegram fora do expediente; e o histórico da central (docs/telegram-expediente.md, T-03).
 */
@Component({
  selector: 'app-notificacoes-config',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-icon mat-card-avatar class="avatar">notifications_active</mat-icon>
        <mat-card-title>Notificações</mat-card-title>
        <mat-card-subtitle>Por onde cada tipo de mensagem sai e quando o Telegram toca fora do expediente</mat-card-subtitle>
      </mat-card-header>

      @if (carregando()) {
        <mat-progress-bar mode="indeterminate" />
      }

      <mat-card-content class="conteudo">
        <div class="canais">
          <div class="canal"><mat-icon>send</mat-icon><b>Telegram</b><span>Mensagem no celular. O som fora do expediente segue a coluna "Som".</span></div>
          <div class="canal"><mat-icon>notifications</mat-icon><b>Aplicativo</b><span>Sino e central de notificações do NTI, inclusive para quem não tem Telegram.</span></div>
          <div class="canal"><mat-icon>tv</mat-icon><b>Painel</b><span>TV e voz. Só vale para mensagem para todos; aviso para uma pessoa nunca vai para o painel.</span></div>
        </div>

        <div class="regras">
          @for (r of regras; track r) {
            <div class="regra"><b>{{ rotulo[r] }}</b><span>{{ explicacao[r] }}</span></div>
          }
        </div>
        <p class="dica">
          O som vale só para quem ligou "Telegram sem som fora do expediente" no perfil; quem está em expediente ou plantão
          sempre recebe com som. Tipo sem regra cadastrada segue o que a origem pediu, com o aplicativo ligado e o som
          <b>Garante alguém</b>. As mudanças valem para as próximas mensagens (o aplicativo também para as que já chegaram).
        </p>

        <div class="topo">
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="filtro">
            <mat-icon matPrefix>search</mat-icon>
            <mat-label>Pesquisar</mat-label>
            <input matInput [ngModel]="filtro()" (ngModelChange)="filtro.set($event)" placeholder="Código ou descrição" />
          </mat-form-field>
          <span class="espaco"></span>
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="dias">
            <mat-label>Histórico da central (dias)</mat-label>
            <input matInput type="number" min="1" max="365" [ngModel]="dias()" (ngModelChange)="dias.set(+$event)" />
          </mat-form-field>
          <button matButton="outlined" [disabled]="dias() === diasSalvo() || salvandoDias()" (click)="salvarDias()">
            <mat-icon>save</mat-icon> Salvar histórico
          </button>
          <button matIconButton matTooltip="Atualizar" (click)="carregar()"><mat-icon>refresh</mat-icon></button>
        </div>

        <div class="tabela">
          <div class="linha linha--cabecalho">
            <span>Tipo de mensagem</span>
            <span>Últimos 30 dias</span>
            <span class="centro">Telegram</span>
            <span class="centro">Aplicativo</span>
            <span class="centro">Painel</span>
            <span>Som fora do expediente</span>
            <span></span>
          </div>
          @for (l of filtradas(); track l.codigo) {
            <div class="linha" [class.linha--padrao]="l.padrao">
              <div class="tipo">
                <code>{{ l.codigo }}</code>
                <input class="descricao" [ngModel]="l.edicao.descricao" (ngModelChange)="editar(l.codigo, { descricao: $event })"
                       placeholder="Descreva o que é esta mensagem" maxlength="200" />
                @if (l.padrao) {
                  <small class="aviso"><mat-icon inline>info</mat-icon> Sem regra: segue a origem, com aplicativo ligado</small>
                } @else if (l.alteradoPor) {
                  <small>Alterado por {{ l.alteradoPor }} em {{ l.alteradoEm | date: 'dd/MM/yyyy HH:mm' }}</small>
                }
              </div>
              <div class="uso">
                <b>{{ l.mensagens30Dias }}</b> mensagem(ns)
                @if (l.ultimaMensagem) {
                  <small>última {{ l.ultimaMensagem | date: 'dd/MM HH:mm' }}</small>
                }
              </div>
              <mat-checkbox class="centro" [ngModel]="l.edicao.telegram" (ngModelChange)="editar(l.codigo, { telegram: $event })"
                            matTooltip="Telegram" />
              <mat-checkbox class="centro" [ngModel]="l.edicao.app" (ngModelChange)="editar(l.codigo, { app: $event })"
                            [disabled]="soTelegram(l)" [matTooltip]="soTelegram(l) ? 'Este aviso só existe no Telegram' : 'Aplicativo'" />
              <mat-checkbox class="centro" [ngModel]="l.edicao.painel" (ngModelChange)="editar(l.codigo, { painel: $event })"
                            [disabled]="soTelegram(l)" [matTooltip]="soTelegram(l) ? 'Este aviso só existe no Telegram' : 'Painel (só mensagem para todos)'" />
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-select [ngModel]="l.edicao.regra" (ngModelChange)="editar(l.codigo, { regra: $event })"
                            [disabled]="!l.edicao.telegram" [matTooltip]="l.edicao.telegram ? explicacao[l.edicao.regra] : 'Só vale com o Telegram ligado'">
                  @for (r of regras; track r) {
                    <mat-option [value]="r">{{ rotulo[r] }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <button matIconButton [disabled]="!mudou(l) || salvando() === l.codigo" matTooltip="Salvar" (click)="salvar(l)">
                <mat-icon>save</mat-icon>
              </button>
            </div>
          } @empty {
            <p class="vazio">Nenhum tipo de mensagem encontrado.</p>
          }
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .avatar { display: flex; align-items: center; justify-content: center; color: var(--mat-sys-primary); }
    .conteudo { padding-top: 12px; }
    .canais, .regras { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; margin-bottom: 8px; }
    .canal, .regra { display: flex; flex-direction: column; gap: 2px; padding: 8px 12px; border-radius: 8px;
                     background: var(--mat-sys-surface-container); font-size: 13px; }
    .canal { display: grid; grid-template-columns: auto 1fr; column-gap: 8px; }
    .canal mat-icon { grid-row: span 2; color: var(--mat-sys-primary); }
    .canal span, .regra span, .dica { color: var(--mat-sys-on-surface-variant); }
    .dica { font-size: 13px; }
    .topo { display: flex; align-items: center; gap: 8px; margin: 8px 0; flex-wrap: wrap; }
    .filtro { flex: 1; min-width: 220px; max-width: 360px; }
    .espaco { flex: 1; }
    .dias { width: 190px; }
    .tabela { display: flex; flex-direction: column; }
    .linha { display: grid; grid-template-columns: minmax(0, 1fr) 130px 72px 80px 64px 200px 48px; gap: 10px;
             align-items: center; padding: 8px 4px; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .linha--cabecalho { font-size: 12px; font-weight: 500; color: var(--mat-sys-on-surface-variant); }
    .linha--padrao { background: color-mix(in srgb, var(--mat-sys-tertiary) 6%, transparent); }
    .centro { justify-self: center; text-align: center; }
    .tipo { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .tipo small { font-size: 11px; color: var(--mat-sys-on-surface-variant); }
    .tipo .aviso { color: var(--mat-sys-tertiary); }
    .descricao { border: none; border-bottom: 1px dashed var(--mat-sys-outline-variant); background: transparent;
                 color: var(--mat-sys-on-surface); font: inherit; font-size: 13px; padding: 2px 0; }
    .uso { display: flex; flex-direction: column; font-size: 13px; }
    .uso small { font-size: 11px; color: var(--mat-sys-on-surface-variant); }
    .vazio { color: var(--mat-sys-on-surface-variant); padding: 16px 4px; }
    @media (max-width: 1000px) {
      .linha { grid-template-columns: minmax(0, 1fr) repeat(3, 56px) 48px; }
      .linha--cabecalho { display: none; }
      .uso, .linha mat-form-field { grid-column: 1 / -1; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificacoesConfig implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(HotToastService);
  private readonly url = `${environment.ApiBaseUrl}notificacao-regra`;

  readonly regras: Regra[] = ['EXPEDIENTE', 'COBERTURA', 'SEMPRE_SOM'];
  readonly rotulo = ROTULO;
  readonly explicacao = EXPLICACAO;

  readonly carregando = signal(false);
  readonly salvando = signal<string | null>(null);
  readonly salvandoDias = signal(false);
  readonly filtro = signal('');
  readonly linhas = signal<Linha[]>([]);
  readonly dias = signal(30);
  readonly diasSalvo = signal(30);

  readonly filtradas = computed(() => {
    const termo = this.filtro().trim().toLowerCase();
    if (!termo) return this.linhas();
    return this.linhas().filter(l => `${l.codigo} ${l.descricao ?? ''}`.toLowerCase().includes(termo));
  });

  ngOnInit() {
    this.carregar();
  }

  carregar() {
    this.carregando.set(true);
    this.http
      .get<RegraDTO[]>(this.url)
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({ next: lista => this.linhas.set(lista.map(linha)), error: () => {} }); // erro exibido pelo interceptor
    this.http.get<{ diasHistorico: number }>(`${this.url}/configuracao`).subscribe({
      next: c => {
        this.dias.set(c.diasHistorico);
        this.diasSalvo.set(c.diasHistorico);
      },
      error: () => {},
    });
  }

  soTelegram(l: Linha) {
    return SO_TELEGRAM.has(l.codigo);
  }

  editar(codigo: string, mudanca: Partial<Edicao>) {
    this.linhas.update(ls => ls.map(l => (l.codigo === codigo ? { ...l, edicao: { ...l.edicao, ...mudanca } } : l)));
  }

  mudou(l: Linha) {
    const e = l.edicao;
    return (
      l.padrao ||
      e.regra !== l.regra ||
      e.telegram !== l.telegram ||
      e.app !== l.app ||
      e.painel !== l.painel ||
      (e.descricao ?? '') !== (l.descricao ?? '')
    );
  }

  salvar(l: Linha) {
    this.salvando.set(l.codigo);
    this.http
      .put<RegraDTO>(`${this.url}/${encodeURIComponent(l.codigo)}`, l.edicao)
      .pipe(finalize(() => this.salvando.set(null)))
      .subscribe({
        next: r => {
          this.linhas.update(ls => ls.map(x => (x.codigo === r.codigo ? linha(r) : x)));
          const canais = [r.telegram && 'Telegram', r.app && 'aplicativo', r.painel && 'painel'].filter(Boolean).join(', ');
          this.toast.success(`${r.codigo}: ${canais || 'nenhum canal'}.`);
        },
        error: () => {},
      });
  }

  salvarDias() {
    this.salvandoDias.set(true);
    this.http
      .put<{ diasHistorico: number }>(`${this.url}/configuracao`, { diasHistorico: this.dias() })
      .pipe(finalize(() => this.salvandoDias.set(false)))
      .subscribe({
        next: c => {
          this.diasSalvo.set(c.diasHistorico);
          this.toast.success(`A central de notificações mostra os últimos ${c.diasHistorico} dias.`);
        },
        error: () => {},
      });
  }
}

function linha(r: RegraDTO): Linha {
  return {
    ...r,
    edicao: { regra: r.regra, descricao: r.descricao ?? '', telegram: r.telegram, app: r.app, painel: r.painel },
  };
}
