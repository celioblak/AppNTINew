import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  inject,
  ViewChild,
  ElementRef,
  AfterViewInit,
  ChangeDetectorRef,
  NgZone,
  signal,
} from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { MtxButtonModule } from '@ng-matero/extensions/button';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { filter, finalize } from 'rxjs/operators';

import { AuthService } from '@core/authentication';
import { LoginService, TipoLogin } from '@core/authentication/login.service';
import { preferenciasSso } from '@core/authentication/sso-preferencias';

/** Último tipo de login usado neste navegador. */
const CHAVE_TIPO_LOGIN = 'ntiapp.login.tipo';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrl: './login.scss',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MtxButtonModule,
    TranslateModule,
  ],
})
export class Login implements AfterViewInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly loginService = inject(LoginService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  @ViewChild('usernameInput') usernameInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('passwordInput') passwordInputRef!: ElementRef<HTMLInputElement>;

  isSubmitting = false;

  /** A opção "Rede (AD)" só aparece quando o administrador habilitou o login pela rede. */
  readonly adHabilitado = signal(false);
  readonly tipoLogin = signal<TipoLogin>('MV');

  /** Login automático com o usuário do Windows (Kerberos). */
  readonly ssoHabilitado = signal(false);
  readonly tentandoSso = signal(false);
  readonly avisoSso = signal<string | null>(null);
  private tentativaSso?: Subscription;

  loginForm = this.fb.nonNullable.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
    rememberMe: [false],
  });

  /** A tela só aparece depois de saber quais formas de acesso estão habilitadas (MV, AD, Windows). */
  readonly verificando = signal(true);
  readonly erroConfig = signal<string | null>(null);

  constructor() {
    this.carregarStatus();
  }

  carregarStatus() {
    this.verificando.set(true);
    this.erroConfig.set(null);
    this.loginService
      .statusLogin()
      .pipe(finalize(() => this.verificando.set(false)))
      .subscribe({
        next: status => {
          this.adHabilitado.set(status.ad);
          this.ssoHabilitado.set(status.sso);
          this.tipoLogin.set(status.ad && this.lerTipoSalvo() === 'AD' ? 'AD' : 'MV');
          // O formulário só entra no DOM agora: o autofill precisa de uma nova sincronização.
          this.agendarAutofill();
          if (status.sso && preferenciasSso.podeTentarAutomatico()) {
            this.entrarComWindows(true);
          }
        },
        error: (erro: HttpErrorResponse) => this.erroConfig.set(this.mensagemDoStatus(erro)),
      });
  }

  /** Sem essa resposta não dá para saber se o login pela rede (AD) existe: melhor avisar do que esconder a opção. */
  private mensagemDoStatus(erro: HttpErrorResponse) {
    if (erro.status === 0) {
      return 'Não foi possível falar com o servidor para verificar as formas de acesso. Confira a conexão e tente de novo.';
    }
    const detalhe = typeof erro.error === 'string' ? erro.error : (erro.error?.message ?? erro.message);
    return `Falha ao verificar as formas de acesso (HTTP ${erro.status}). ${detalhe ?? ''}`.trim();
  }

  get username() {
    return this.loginForm.get('username')!;
  }

  get password() {
    return this.loginForm.get('password')!;
  }

  get rememberMe() {
    return this.loginForm.get('rememberMe')!;
  }

  get rotuloUsuario() {
    return this.tipoLogin() === 'AD' ? 'usuário da rede' : 'usuario MV';
  }

  get rotuloSenha() {
    return this.tipoLogin() === 'AD' ? 'senha da rede' : 'senha MV';
  }

  alterarTipo(tipo: TipoLogin) {
    this.tipoLogin.set(tipo);
  }

  ngAfterViewInit() {
    this.agendarAutofill();
  }

  /** Tenta agora e de novo pouco depois, porque o navegador pode preencher os campos com atraso. */
  private agendarAutofill() {
    this.syncAutofill();
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.ngZone.run(() => {
          this.syncAutofill();
        });
      }, 300);
    });
  }

  /**
   * Sincroniza os valores preenchidos automaticamente com o formulário reativo
   * e dispara eventos para garantir que o Angular reavalie a validade.
   */
  private syncAutofill() {
    // O formulário só existe depois da verificação das formas de acesso.
    const usernameNative = this.usernameInputRef?.nativeElement;
    const passwordNative = this.passwordInputRef?.nativeElement;
    if (!usernameNative || !passwordNative) {
      return;
    }

    let changed = false;

    // Atualiza o controle de username se houver valor nativo e o controle estiver vazio
    if (usernameNative.value && !this.username.value) {
      this.username.setValue(usernameNative.value);
      // Dispara eventos de input e blur para notificar o Angular
      usernameNative.dispatchEvent(new Event('input', { bubbles: true }));
      usernameNative.dispatchEvent(new Event('blur', { bubbles: true }));
      changed = true;
    }

    // Atualiza o controle de password
    if (passwordNative.value && !this.password.value) {
      this.password.setValue(passwordNative.value);
      passwordNative.dispatchEvent(new Event('input', { bubbles: true }));
      passwordNative.dispatchEvent(new Event('blur', { bubbles: true }));
      changed = true;
    }

    if (changed) {
      // Força a reavaliação da validade de todo o formulário
      this.loginForm.updateValueAndValidity();
      // Garante que a detecção de mudanças seja executada
      this.cdr.detectChanges();
    }
  }

  login() {
    this.isSubmitting = true;
    const tipo = this.tipoLogin();

    this.auth
      .login(this.username.value, this.password.value, this.rememberMe.value, tipo)
      .pipe(filter(authenticated => authenticated))
      .subscribe({
        next: () => {
          this.salvarTipo(tipo);
          preferenciasSso.retomar();
          this.router.navigateByUrl('/');
        },
        error: (errorRes: HttpErrorResponse) => {
          console.log(errorRes);
          if (errorRes.status === 422) {
            const form = this.loginForm;
            const errors = errorRes.error.errors;
            Object.keys(errors).forEach(key => {
              form.get(key === 'email' ? 'username' : key)?.setErrors({
                remote: errors[key][0],
              });
            });
          }
          this.isSubmitting = false;
          this.cdr.detectChanges();
        },
      });
  }

  /** automatico = tentativa ao abrir a tela (silenciosa quando o computador não tem login do Windows). */
  entrarComWindows(automatico = false) {
    this.tentativaSso?.unsubscribe();
    this.avisoSso.set(null);
    this.tentandoSso.set(true);
    if (automatico) {
      preferenciasSso.registrarTentativaAutomatica();
    }

    this.tentativaSso = this.auth
      .loginSso()
      .pipe(finalize(() => this.tentandoSso.set(false)))
      .subscribe({
        next: autenticado => {
          if (!autenticado) {
            this.avisoSso.set('Não foi possível abrir a sessão pelo login do Windows. Entre com usuário e senha.');
            return;
          }
          preferenciasSso.liberar();
          this.router.navigateByUrl('/');
        },
        error: erro => this.tratarFalhaSso(erro, automatico),
      });
  }

  cancelarSso() {
    this.tentativaSso?.unsubscribe();
    this.tentandoSso.set(false);
  }

  private tratarFalhaSso(erro: any, automatico: boolean) {
    const codigo: string | undefined = erro?.error?.errorCode;
    const mensagem: string | undefined = erro?.error?.message;
    // Sem login do Windows neste computador/navegador: não enviou ticket (401), usou NTLM ou não respondeu
    const semTicket = erro?.status === 401 || erro?.status === 0 || erro?.name === 'TimeoutError' || codigo === 'SSO_NTLM';

    if (semTicket || codigo === 'SSO_USUARIO') {
      if (automatico) {
        // Silencioso: vai para o formulário e não tenta sozinho de novo neste navegador (o botão continua)
        preferenciasSso.marcarIndisponivel();
        return;
      }
      if (codigo === 'SSO_USUARIO' || codigo === 'SSO_NTLM') {
        this.avisoSso.set(mensagem ?? 'Login automático não permitido para esta conta.');
      } else {
        this.avisoSso.set(
          'Este computador não enviou o login do Windows (fora do domínio ou navegador sem permissão). Entre com usuário e senha.'
        );
      }
      return;
    }
    this.avisoSso.set(mensagem || 'Não foi possível entrar automaticamente. Entre com usuário e senha.');
  }

  private lerTipoSalvo(): TipoLogin | null {
    try {
      return localStorage.getItem(CHAVE_TIPO_LOGIN) as TipoLogin | null;
    } catch {
      return null;
    }
  }

  private salvarTipo(tipo: TipoLogin) {
    try {
      localStorage.setItem(CHAVE_TIPO_LOGIN, tipo);
    } catch {
      // armazenamento indisponível: só não lembra a escolha
    }
  }
}
