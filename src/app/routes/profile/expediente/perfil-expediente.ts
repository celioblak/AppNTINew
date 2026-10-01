import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { ExpedienteTelegram } from '@shared/components/expediente-telegram/expediente-telegram';

/** Perfil: o próprio usuário configura o Telegram fora do expediente e o horário de trabalho. */
@Component({
  selector: 'app-perfil-expediente',
  imports: [MatCardModule, MatIconModule, ExpedienteTelegram],
  template: `
    <mat-card class="cartao">
      <mat-card-header>
        <mat-icon mat-card-avatar class="avatar">notifications_active</mat-icon>
        <mat-card-title>Notificações e expediente</mat-card-title>
        <mat-card-subtitle>Som e notificação do Windows no aplicativo, Telegram e seu horário de trabalho</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content class="conteudo">
        <app-expediente-telegram />
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .cartao { margin-top: 16px; }
    .avatar { display: flex; align-items: center; justify-content: center; color: var(--mat-sys-primary); }
    .conteudo { padding-top: 12px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PerfilExpediente {}
