import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '@env/environment';
import { HotToastService } from '@ngxpert/hot-toast';
import { NotificacaoService } from '@shared/services/notificacao.service';
import { finalize } from 'rxjs';

interface HorarioDTO {
  diaSemana: number;
  inicio: string;
  fim: string;
}

interface ExpedienteDTO {
  codUsuario: number;
  nome: string;
  recebeTelegram: boolean;
  faltaTelegram: string | null;
  silenciarForaExpediente: boolean;
  horarios: HorarioDTO[];
  agora: { emExpediente: boolean; emPlantao: boolean; motivo: string; mensagensComSom: boolean };
  proximosPlantoes: { inicio: string; fim: string; descricao: string }[];
  somAplicativo: boolean;
  notificacaoWindows: boolean;
}

interface Faixa {
  inicio: string;
  fim: string;
}

interface Dia {
  diaSemana: number;
  nome: string;
  faixas: [Faixa, Faixa];
}

const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

/**
 * "Telegram sem som fora do expediente" e horário de trabalho (docs/telegram-expediente.md).
 * Sem codUsuario: o usuário logado, no perfil (T-01). Com codUsuario: cadastro do administrador (T-02).
 */
@Component({
  selector: 'app-expediente-telegram',
  imports: [DatePipe, FormsModule, MatButtonModule, MatIconModule, MatProgressBarModule, MatSlideToggleModule, MatTooltipModule],
  template: `
    @if (processando()) {
      <mat-progress-bar mode="indeterminate" />
    }

    @if (dados(); as d) {
      <h4 class="secao"><mat-icon inline>notifications</mat-icon> Aplicativo</h4>
      <div class="opcao">
        <mat-slide-toggle [checked]="som()" [disabled]="processando()" (change)="som.set($event.checked)">
          Som no aplicativo
        </mat-slide-toggle>
        <span class="dica">Notificação de erro toca dois bipes; de alerta, um. Informações não tocam.</span>
      </div>
      <div class="opcao">
        <mat-slide-toggle [checked]="windows()" [disabled]="processando()" (change)="alterarWindows($event.checked)">
          Notificação do Windows
        </mat-slide-toggle>
        <span class="dica">Com o NTI minimizado ou em outra aba, a notificação aparece no canto da tela. Precisa do aplicativo aberto.</span>
        @if (proprio() && windows()) {
          @switch (permissao()) {
            @case ('denied') {
              <span class="erro"><mat-icon inline>block</mat-icon> O navegador bloqueou as notificações deste site. Clique no cadeado ao lado do endereço, em Notificações escolha Permitir e recarregue a página.</span>
            }
            @case ('default') {
              <span class="erro"><mat-icon inline>info</mat-icon> Falta permitir no navegador. <button matButton type="button" (click)="pedirPermissao()">Permitir notificações</button></span>
            }
            @case ('indisponivel') {
              <span class="erro"><mat-icon inline>info</mat-icon> Este navegador não mostra notificações do Windows.</span>
            }
          }
        }
      </div>
      @if (proprio()) {
        <div class="acoes acoes--esquerda">
          <button matButton="outlined" type="button" (click)="testar()" matTooltip="Toca o som e mostra uma notificação de exemplo (usa o que está salvo)">
            <mat-icon>volume_up</mat-icon> Testar
          </button>
        </div>
      }

      <h4 class="secao"><mat-icon inline>send</mat-icon> Telegram</h4>
      @if (d.faltaTelegram) {
        <p class="aviso"><mat-icon>info</mat-icon> {{ d.faltaTelegram }}</p>
      }

      <div class="opcao">
        <mat-slide-toggle
          [checked]="silenciar()"
          [disabled]="!d.recebeTelegram || processando()"
          (change)="silenciar.set($event.checked)"
        >
          Telegram sem som fora do expediente
        </mat-slide-toggle>
        <span class="dica">
          Fora do seu horário de trabalho e dos seus plantões, as mensagens chegam sem som nem notificação; leia quando
          quiser. Se ninguém que recebe a mensagem estiver em expediente ou plantão, ela toca para todos.
        </span>
        @if (silenciar() && !temHorario()) {
          <span class="erro"><mat-icon inline>warning</mat-icon> Cadastre ao menos um horário de trabalho abaixo para ligar esta opção.</span>
        }
      </div>

      <div class="agora" [class.agora--fora]="!d.agora.emExpediente">
        <mat-icon>{{ d.agora.emExpediente ? 'notifications_active' : 'notifications_off' }}</mat-icon>
        <span>
          <b>Agora: {{ d.agora.emExpediente ? 'em expediente' : 'fora do expediente' }}</b> ({{ d.agora.motivo }})
          — mensagens chegam {{ d.agora.mensagensComSom ? 'com som' : 'sem som' }}.
        </span>
      </div>

      <div class="horario__topo">
        <h4><mat-icon inline>schedule</mat-icon> Horário de trabalho</h4>
        <button matButton type="button" [disabled]="processando()" (click)="copiarSegunda()"
                matTooltip="Copia as faixas de segunda para terça, quarta, quinta e sexta">
          <mat-icon>content_copy</mat-icon> Copiar segunda para os dias úteis
        </button>
      </div>
      <p class="dica">Até duas faixas por dia. Fim menor que o início é turno que vira a meia-noite (ex.: 22:00 a 06:00).</p>

      <div class="dias">
        @for (dia of dias(); track dia.diaSemana) {
          <div class="dia">
            <span class="dia__nome">{{ dia.nome }}</span>
            @for (f of dia.faixas; track $index; let i = $index) {
              <span class="faixa">
                <input type="time" [ngModel]="f.inicio" (ngModelChange)="alterar(dia.diaSemana, i, 'inicio', $event)"
                       [attr.aria-label]="dia.nome + ' início ' + (i + 1)" />
                <span>às</span>
                <input type="time" [ngModel]="f.fim" (ngModelChange)="alterar(dia.diaSemana, i, 'fim', $event)"
                       [attr.aria-label]="dia.nome + ' fim ' + (i + 1)" />
                @if (viraMeiaNoite(f)) {
                  <small class="seguinte" matTooltip="Turno que vira a meia-noite">+1 dia</small>
                }
                @if (f.inicio || f.fim) {
                  <button matIconButton type="button" class="limpar" matTooltip="Limpar faixa" (click)="limpar(dia.diaSemana, i)">
                    <mat-icon>close</mat-icon>
                  </button>
                }
              </span>
            }
          </div>
        }
      </div>

      @if (d.proximosPlantoes.length) {
        <h4><mat-icon inline>event</mat-icon> Próximos plantões <small>(nesses horários o celular toca)</small></h4>
        <ul class="plantoes">
          @for (p of d.proximosPlantoes; track $index) {
            <li>{{ p.inicio | date: 'dd/MM HH:mm' }} até {{ p.fim | date: 'dd/MM HH:mm' }} — {{ p.descricao }}</li>
          }
        </ul>
      }

      <div class="acoes">
        <button matButton="filled" type="button" [disabled]="processando() || !alterado()" (click)="salvar()">
          <mat-icon>save</mat-icon> Salvar
        </button>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .aviso, .agora {
      display: flex; align-items: center; gap: 8px; margin: 0 0 12px; padding: 8px 12px; border-radius: 8px;
      background: var(--mat-sys-surface-container); color: var(--mat-sys-on-surface-variant); font-size: 13px;
    }
    .agora mat-icon { color: var(--mat-sys-primary); }
    .agora--fora mat-icon { color: var(--mat-sys-on-surface-variant); }
    .opcao { display: flex; flex-direction: column; gap: 4px; margin: 0 0 12px; }
    .dica { font-size: 12px; color: var(--mat-sys-on-surface-variant); margin: 0 0 8px; }
    .erro { font-size: 12px; color: var(--mat-sys-error); }
    .horario__topo { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
    h4 { display: flex; align-items: center; gap: 6px; margin: 12px 0 4px; font-weight: 500; }
    h4 small { font-weight: 400; color: var(--mat-sys-on-surface-variant); }
    .dias { display: flex; flex-direction: column; gap: 4px; }
    .dia { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 16px; padding: 2px 0; }
    .dia__nome { width: 64px; font-size: 13px; }
    .faixa { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--mat-sys-on-surface-variant); }
    .faixa input {
      width: 92px; padding: 4px 6px; border: 1px solid var(--mat-sys-outline-variant); border-radius: 6px;
      background: transparent; color: var(--mat-sys-on-surface); font: inherit; font-size: 13px;
    }
    .seguinte { color: var(--mat-sys-primary); font-weight: 500; }
    .limpar { width: 28px; height: 28px; padding: 2px; --mat-icon-button-state-layer-size: 28px; }
    .limpar mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .plantoes { margin: 0; padding-left: 20px; font-size: 13px; }
    .acoes { display: flex; justify-content: flex-end; margin-top: 12px; }
    .acoes--esquerda { justify-content: flex-start; margin: 0 0 8px; }
    .secao { margin-top: 4px; color: var(--mat-sys-primary); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpedienteTelegram implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(HotToastService);
  private readonly notificacoes = inject(NotificacaoService);

  /** Vazio = usuário logado (perfil); informado = cadastro do administrador. */
  readonly codUsuario = input<number | null>(null);

  readonly processando = signal(false);
  readonly dados = signal<ExpedienteDTO | null>(null);
  readonly silenciar = signal(false);
  readonly som = signal(true);
  readonly windows = signal(true);
  readonly permissao = signal<string>(this.notificacoes.permissaoWindows());
  /** Perfil do próprio usuário (sem codUsuario): só aí dá para pedir permissão e testar neste navegador. */
  readonly proprio = computed(() => this.codUsuario() == null);
  readonly dias = signal<Dia[]>(DIAS.map((nome, i) => ({ diaSemana: i + 1, nome, faixas: [vazia(), vazia()] })));
  private readonly original = signal('');

  readonly temHorario = computed(() => this.faixasPreenchidas().length > 0);
  readonly alterado = computed(() => this.assinatura() !== this.original());

  private get url() {
    const cod = this.codUsuario();
    return cod == null ? `${environment.ApiBaseUrl}perfil/expediente` : `${environment.ApiBaseUrl}usuario-expediente/${cod}`;
  }

  ngOnInit() {
    this.processando.set(true);
    this.http
      .get<ExpedienteDTO>(this.url)
      .pipe(finalize(() => this.processando.set(false)))
      .subscribe({ next: d => this.aplicar(d), error: () => {} }); // mensagem exibida pelo interceptor
  }

  alterar(diaSemana: number, indice: number, campo: keyof Faixa, valor: string) {
    this.dias.update(dias =>
      dias.map(d => {
        if (d.diaSemana !== diaSemana) return d;
        const faixas = [...d.faixas] as [Faixa, Faixa];
        faixas[indice] = { ...faixas[indice], [campo]: valor ?? '' };
        return { ...d, faixas };
      })
    );
  }

  limpar(diaSemana: number, indice: number) {
    this.alterar(diaSemana, indice, 'inicio', '');
    this.alterar(diaSemana, indice, 'fim', '');
  }

  copiarSegunda() {
    const segunda = this.dias()[0].faixas;
    this.dias.update(dias =>
      dias.map(d => (d.diaSemana >= 2 && d.diaSemana <= 5 ? { ...d, faixas: [{ ...segunda[0] }, { ...segunda[1] }] } : d))
    );
  }

  alterarWindows(ligar: boolean) {
    this.windows.set(ligar);
    if (ligar && this.proprio() && this.permissao() === 'default') this.pedirPermissao();
  }

  pedirPermissao() {
    void this.notificacoes.pedirPermissaoWindows().then(p => this.permissao.set(p));
  }

  testar() {
    this.notificacoes.testar();
    if (this.windows() && this.permissao() !== 'granted') {
      this.toast.info('A notificação do Windows só aparece depois de permitir no navegador.');
    }
  }

  viraMeiaNoite(f: Faixa) {
    return !!f.inicio && !!f.fim && f.fim < f.inicio;
  }

  salvar() {
    this.processando.set(true);
    this.http
      .put<ExpedienteDTO>(this.url, {
        silenciarForaExpediente: this.silenciar(),
        horarios: this.faixasPreenchidas(),
        somAplicativo: this.som(),
        notificacaoWindows: this.windows(),
      })
      .pipe(finalize(() => this.processando.set(false)))
      .subscribe({
        next: d => {
          this.aplicar(d);
          this.toast.success('Preferências de notificação e horário de trabalho salvos.');
          if (this.proprio()) this.notificacoes.atualizar();
        },
        error: () => {}, // mensagem (com o que corrigir) exibida pelo interceptor
      });
  }

  private aplicar(d: ExpedienteDTO) {
    this.dados.set(d);
    this.silenciar.set(d.silenciarForaExpediente);
    this.som.set(d.somAplicativo);
    this.windows.set(d.notificacaoWindows);
    this.dias.set(
      DIAS.map((nome, i) => {
        const doDia = d.horarios.filter(h => h.diaSemana === i + 1);
        return {
          diaSemana: i + 1,
          nome,
          faixas: [faixa(doDia[0]), faixa(doDia[1])] as [Faixa, Faixa],
        };
      })
    );
    this.original.set(this.assinatura());
  }

  private faixasPreenchidas(): HorarioDTO[] {
    return this.dias().flatMap(d =>
      d.faixas.filter(f => f.inicio || f.fim).map(f => ({ diaSemana: d.diaSemana, inicio: f.inicio, fim: f.fim }))
    );
  }

  private assinatura() {
    return JSON.stringify([this.silenciar(), this.som(), this.windows(), this.faixasPreenchidas()]);
  }
}

function vazia(): Faixa {
  return { inicio: '', fim: '' };
}

function faixa(h: HorarioDTO | undefined): Faixa {
  return h ? { inicio: h.inicio, fim: h.fim } : vazia();
}
