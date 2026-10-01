import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { preferenciasSso } from '@core/authentication/sso-preferencias';
import { environment } from '@env/environment';
import { HotToastService } from '@ngxpert/hot-toast';
import { finalize } from 'rxjs';

interface StatusLoginAd {
  adHabilitado: boolean;
  autoAtivacaoPermitida: boolean;
  ssoHabilitado: boolean;
  snLoginAd: boolean;
  snLoginAutomatico: boolean;
  loginAd: string | null;
  login: string;
}

/** Perfil: o próprio usuário ativa (confirmando a senha da rede) ou desativa o login pelo AD e o login automático. */
@Component({
  selector: 'app-perfil-login-ad',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSlideToggleModule,
  ],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-icon mat-card-avatar class="avatar">domain</mat-icon>
        <mat-card-title>Login pela rede (Active Directory)</mat-card-title>
        <mat-card-subtitle>Entre no APP com o mesmo usuário e senha do computador</mat-card-subtitle>
      </mat-card-header>

      @if (processando()) {
        <mat-progress-bar mode="indeterminate" />
      }

      <mat-card-content class="conteudo">
        @if (status(); as s) {
          @if (!s.adHabilitado) {
            <p class="situacao"><mat-icon>info</mat-icon> O login pela rede não está habilitado pelo administrador.</p>
          } @else if (s.snLoginAd) {
            <p class="situacao ativo">
              <mat-icon>check_circle</mat-icon>
              <span>
                Ativado para a conta <strong>{{ s.loginAd || s.login }}</strong>. Na tela de login escolha
                <strong>Rede (AD)</strong>.
              </span>
            </p>

            @if (s.ssoHabilitado) {
              <div class="automatico">
                <mat-slide-toggle
                  [checked]="s.snLoginAutomatico"
                  [disabled]="processando()"
                  (change)="alterarAutomatico($event)"
                >
                  Entrar automaticamente com o usuário do Windows
                </mat-slide-toggle>
                <span class="dica">
                  Em computadores do domínio a tela de login entra sozinha; em outros computadores continua o formulário.
                </span>
              </div>
            }

            <button matButton="outlined" type="button" [disabled]="processando()" (click)="desativar()">
              Desativar login pela rede
            </button>
          } @else if (!s.autoAtivacaoPermitida) {
            <p class="situacao">
              <mat-icon>info</mat-icon> Desativado. A ativação é feita pelo administrador no cadastro de usuários.
            </p>
          } @else {
            <p class="situacao">
              <mat-icon>lock_open</mat-icon>
              <span>Desativado. Confirme sua conta e senha da rede para ativar; a senha não é gravada.</span>
            </p>
            <form class="form-ativar" (ngSubmit)="ativar()">
              <mat-form-field appearance="outline">
                <mat-label>Conta da rede</mat-label>
                <input
                  matInput
                  name="loginAd"
                  autocomplete="username"
                  [ngModel]="loginAd()"
                  (ngModelChange)="loginAd.set($event)"
                />
                <mat-hint>usuario ou DOMINIO\\usuario</mat-hint>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Senha da rede</mat-label>
                <input
                  matInput
                  type="password"
                  name="senha"
                  autocomplete="current-password"
                  [ngModel]="senha()"
                  (ngModelChange)="senha.set($event)"
                />
              </mat-form-field>
              <button matButton="filled" type="submit" class="botao" [disabled]="processando() || !senha()">
                Validar e ativar
              </button>
            </form>
          }
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--mat-sys-primary);
    }
    .conteudo {
      padding-top: 12px;
    }
    .situacao {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 16px;
      color: var(--mat-sys-on-surface-variant);
    }
    .situacao.ativo mat-icon {
      color: var(--mat-sys-primary);
    }
    .automatico {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin: 0 0 16px;
    }
    .dica {
      padding-left: 52px;
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant);
    }
    .form-ativar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
      align-items: start;
      gap: 4px 16px;
    }
    .botao {
      height: 56px;
    }
    @media (max-width: 900px) {
      .form-ativar {
        grid-template-columns: minmax(0, 1fr);
      }
      .dica {
        padding-left: 0;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PerfilLoginAd implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(HotToastService);
  private readonly apiUrl = `${environment.ApiBaseUrl}perfil/login-ad`;

  readonly status = signal<StatusLoginAd | null>(null);
  readonly processando = signal(false);
  readonly loginAd = signal('');
  readonly senha = signal('');

  ngOnInit() {
    this.processando.set(true);
    this.http
      .get<StatusLoginAd>(this.apiUrl)
      .pipe(finalize(() => this.processando.set(false)))
      .subscribe({ next: status => this.aplicar(status), error: () => {} });
  }

  ativar() {
    if (!this.senha() || this.processando()) {
      return;
    }
    this.enviar({ ativar: true, loginAd: this.loginAd().trim() || null, senha: this.senha() }, 'Login pela rede ativado.');
  }

  desativar() {
    this.enviar({ ativar: false }, 'Login pela rede desativado.');
  }

  alterarAutomatico(evento: MatSlideToggleChange) {
    const ativar = evento.checked;
    this.processando.set(true);
    this.http
      .put<StatusLoginAd>(`${this.apiUrl}/automatico`, { ativar })
      .pipe(finalize(() => this.processando.set(false)))
      .subscribe({
        next: status => {
          this.aplicar(status);
          if (status.snLoginAutomatico) {
            // Este navegador pode ter sido marcado "sem login automático" antes da ativação
            preferenciasSso.liberar();
          }
          this.toast.success(status.snLoginAutomatico ? 'Login automático ativado.' : 'Login automático desativado.');
        },
        error: () => {
          // Desfaz o toggle; a mensagem é exibida pelo interceptor
          evento.source.checked = !ativar;
        },
      });
  }

  private enviar(pedido: { ativar: boolean; loginAd?: string | null; senha?: string }, mensagemSucesso: string) {
    this.processando.set(true);
    this.http
      .put<StatusLoginAd>(this.apiUrl, pedido)
      .pipe(
        finalize(() => {
          this.processando.set(false);
          this.senha.set('');
        })
      )
      .subscribe({
        next: status => {
          this.aplicar(status);
          this.toast.success(mensagemSucesso);
        },
        error: () => {}, // mensagem exibida pelo interceptor
      });
  }

  private aplicar(status: StatusLoginAd) {
    this.status.set(status);
    this.loginAd.set(status.loginAd || (status.login || '').toLowerCase());
  }
}
