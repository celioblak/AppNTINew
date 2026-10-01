import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HotToastService } from '@ngxpert/hot-toast';
import { finalize } from 'rxjs';

import { ConfigAdService, ConfiguracaoAd, ResultadoTesteAd } from './config-ad.service';

const FILTRO_PADRAO = '(&(objectCategory=person)(objectClass=user)(sAMAccountName={0}))';
const URL_LDAP = /^\s*ldaps?:\/\/[^\s/]+\/?(\s+ldaps?:\/\/[^\s/]+\/?)*\s*$/i;
const SPN_HTTP = /^\s*HTTP\/[^\s/@]+@[^\s@]+\s*$/i;

/** Usuário > Login pela rede (AD): conexão com o Active Directory e login automático. Somente administradores. */
@Component({
  selector: 'app-config-ad',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  templateUrl: './config-ad.html',
  styleUrl: './config-ad.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigAdComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ConfigAdService);
  private readonly toast = inject(HotToastService);

  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly testando = signal(false);
  readonly ocultarSenha = signal(true);
  readonly senhaBindDefinida = signal(false);
  readonly atualizacao = signal<{ data: string; usuario: string | null } | null>(null);
  readonly resultado = signal<ResultadoTesteAd | null>(null);

  readonly form = this.fb.nonNullable.group({
    ativo: [false],
    url: ['', [Validators.pattern(URL_LDAP)]],
    dominio: [''],
    baseDn: [''],
    usuarioBind: [''],
    senhaBind: [''],
    removerSenhaBind: [false],
    filtroUsuario: [FILTRO_PADRAO, [Validators.required, Validators.pattern(/\{0\}/)]],
    grupoPermitido: [''],
    timeoutMs: [5000, [Validators.required, Validators.min(1000), Validators.max(60000)]],
    autoAtivacao: [true],
    sso: [false],
    spn: ['', [Validators.pattern(SPN_HTTP)]],
    keytab: [''],
  });

  readonly teste = this.fb.nonNullable.group({
    usuario: [''],
    senha: [''],
  });

  /** ldap:// sem TLS: a senha dos usuários trafega aberta até o AD. */
  get usaLdapSemTls(): boolean {
    return /^\s*ldap:\/\//i.test(this.form.controls.url.value);
  }

  ngOnInit() {
    this.carregar();
  }

  salvar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.salvando.set(true);
    this.service
      .salvar(this.montar())
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({
        next: configuracao => {
          this.aplicar(configuracao);
          this.toast.success('Configuração do login pela rede salva.');
        },
        error: () => {}, // mensagem exibida pelo interceptor
      });
  }

  testar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { usuario, senha } = this.teste.getRawValue();
    this.resultado.set(null);
    this.testando.set(true);
    this.service
      .testar(this.montar(), usuario.trim() || null, senha || null)
      .pipe(finalize(() => this.testando.set(false)))
      .subscribe({
        next: resultado => {
          this.resultado.set(resultado);
          this.teste.controls.senha.setValue('');
        },
        error: () => {},
      });
  }

  usarBaseDnSugerido(baseDn: string) {
    this.form.controls.baseDn.setValue(baseDn);
    this.form.markAsDirty();
  }

  restaurarFiltro() {
    this.form.controls.filtroUsuario.setValue(FILTRO_PADRAO);
    this.form.markAsDirty();
  }

  private carregar() {
    this.carregando.set(true);
    this.service
      .obter()
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({ next: configuracao => this.aplicar(configuracao), error: () => {} });
  }

  private aplicar(cfg: ConfiguracaoAd) {
    this.form.reset({
      ativo: !!cfg.ativo,
      url: cfg.url ?? '',
      dominio: cfg.dominio ?? '',
      baseDn: cfg.baseDn ?? '',
      usuarioBind: cfg.usuarioBind ?? '',
      senhaBind: '',
      removerSenhaBind: false,
      filtroUsuario: cfg.filtroUsuario || FILTRO_PADRAO,
      grupoPermitido: cfg.grupoPermitido ?? '',
      timeoutMs: cfg.timeoutMs ?? 5000,
      autoAtivacao: !!cfg.autoAtivacao,
      sso: !!cfg.sso,
      spn: cfg.spn ?? '',
      keytab: cfg.keytab ?? '',
    });
    this.senhaBindDefinida.set(!!cfg.senhaBindDefinida);
    this.atualizacao.set(cfg.dtAtualizacao ? { data: cfg.dtAtualizacao, usuario: cfg.usuarioAtualizacao ?? null } : null);
  }

  private montar(): ConfiguracaoAd {
    const v = this.form.getRawValue();
    const texto = (valor: string) => valor.trim() || null;
    return {
      ativo: v.ativo,
      url: v.url.trim().replace(/\s+/g, ' ') || null,
      dominio: texto(v.dominio),
      baseDn: texto(v.baseDn),
      usuarioBind: texto(v.usuarioBind),
      senhaBind: v.senhaBind || null,
      removerSenhaBind: v.removerSenhaBind,
      filtroUsuario: texto(v.filtroUsuario),
      grupoPermitido: texto(v.grupoPermitido),
      timeoutMs: v.timeoutMs,
      autoAtivacao: v.autoAtivacao,
      sso: v.sso,
      spn: texto(v.spn),
      keytab: texto(v.keytab),
    };
  }
}
