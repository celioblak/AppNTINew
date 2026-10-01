import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Notificacao, NotificacaoService, resumir, textoSimples } from '@shared/services/notificacao.service';

/** Sino do cabeçalho: não lidas e as 10 mais recentes (docs/telegram-expediente.md, T-04). */
@Component({
  selector: 'app-notification',
  template: `
    <button matIconButton [matMenuTriggerFor]="menu" [matTooltip]="dica()">
      <mat-icon
        [matBadge]="svc.naoLidas() > 99 ? '99+' : svc.naoLidas()"
        [matBadgeHidden]="svc.naoLidas() === 0"
        matBadgeColor="warn"
        aria-hidden="false"
      >{{ svc.naoLidas() ? 'notifications_active' : 'notifications_none' }}</mat-icon>
    </button>

    <mat-menu #menu="matMenu" class="menu-notificacoes" xPosition="before">
      <div class="topo" (click)="$event.stopPropagation()">
        <b>Notificações</b>
        @if (svc.naoLidas()) {
          <button matButton type="button" (click)="marcarTodas()">Marcar todas como lidas</button>
        }
      </div>
      <mat-divider />
      @for (n of svc.ultimas(); track n.codigo) {
        <button mat-menu-item class="item" [class.item--lida]="n.lida" (click)="abrir(n)">
          <mat-icon [class]="'g-' + classe(n)">{{ icone(n) }}</mat-icon>
          <span class="texto">
            <span class="titulo">{{ titulo(n) }}</span>
            <span class="trecho">{{ trecho(n) }}</span>
            <small>{{ n.quando | date: 'dd/MM HH:mm' }}</small>
          </span>
        </button>
      } @empty {
        <p class="vazio">Nenhuma notificação nos últimos {{ svc.diasHistorico() }} dias.</p>
      }
      <mat-divider />
      <button mat-menu-item (click)="svc.abrirCentral()">
        <mat-icon>list</mat-icon> Ver todas
      </button>
    </mat-menu>
  `,
  styles: `
    :host ::ng-deep .mat-badge-content {
      --mat-badge-background-color: #ef0000;
      --mat-badge-text-color: #fff;
    }
    ::ng-deep .menu-notificacoes { max-width: 380px !important; }
    .topo { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px 12px 4px 16px; }
    .item { height: auto !important; min-height: 56px; padding-top: 6px; padding-bottom: 6px; }
    .item--lida { opacity: .6; }
    .texto { display: flex; flex-direction: column; line-height: 1.3; white-space: normal; }
    .titulo { font-weight: 500; font-size: 13px; }
    .trecho { font-size: 12px; color: var(--mat-sys-on-surface-variant); }
    .texto small { font-size: 11px; color: var(--mat-sys-on-surface-variant); }
    .vazio { padding: 12px 16px; margin: 0; font-size: 13px; color: var(--mat-sys-on-surface-variant); }
    .g-erro { color: var(--mat-sys-error) !important; }
    .g-alerta { color: #e65100 !important; }
    .g-info { color: var(--mat-sys-primary) !important; }
  `,
  imports: [DatePipe, MatBadgeModule, MatButtonModule, MatDividerModule, MatIconModule, MatMenuModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationButton implements OnInit {
  readonly svc = inject(NotificacaoService);

  ngOnInit() {
    this.svc.iniciar();
  }

  dica() {
    const n = this.svc.naoLidas();
    return n ? `${n} notificação(ões) não lida(s)` : 'Notificações';
  }

  abrir(n: Notificacao) {
    if (!n.lida) this.svc.marcarLida(n).subscribe({ error: () => {} });
    this.svc.abrirCentral();
  }

  marcarTodas() {
    this.svc.marcarTodas().subscribe({ error: () => {} });
  }

  titulo(n: Notificacao) {
    return resumir(textoSimples(n.titulo) || n.tipo || 'Notificação', 80);
  }

  trecho(n: Notificacao) {
    return resumir(textoSimples(n.mensagem), 110);
  }

  classe(n: Notificacao) {
    return classeGravidade(n.gravidade);
  }

  icone(n: Notificacao) {
    return iconeGravidade(n.gravidade);
  }
}

export function classeGravidade(g: string | null) {
  const v = (g || '').toUpperCase();
  if (v === 'ERRO' || v === 'ERROR') return 'erro';
  if (v === 'ALERTA') return 'alerta';
  return 'info';
}

export function iconeGravidade(g: string | null) {
  const c = classeGravidade(g);
  return c === 'erro' ? 'error' : c === 'alerta' ? 'warning' : 'info';
}
