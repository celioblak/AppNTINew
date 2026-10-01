import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatOptionModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { HotToastService } from '@ngxpert/hot-toast';
import { GoogleDriveConfigService } from './google-drive-config-service';
import { GoogleDriveConfig } from '@core';

@Component({
  selector: 'app-google-drive-config',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatOptionModule,
    MatSelectModule,
    MatSlideToggleModule,
  ],
  templateUrl: './google-drive-config.html',
  styleUrl: './google-drive-config.scss',
})
export class GoogleDriveConfigComponent implements OnInit {
  private readonly service = inject(GoogleDriveConfigService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(HotToastService);

  config: GoogleDriveConfig | null = null;
  autorizando = false;

  form = this.fb.nonNullable.group({
    habilitado: [false],
    modoAuth: ['OAUTH_USUARIO', [Validators.required]],
    credenciaisPath: [''],
    pastaId: [''],
    tipoPermissao: ['anyone', [Validators.required]],
    dominio: [''],
    expurgoDias: [3, [Validators.required, Validators.min(1)]],
    oauthClientId: [''],
    oauthClientSecret: [''],
    oauthRedirectUri: [''],
  });

  ngOnInit() {
    this.carregar();
  }

  carregar() {
    this.service.obterConfig().subscribe({
      next: (config) => {
        this.config = config;
        this.form.patchValue({
          habilitado: config.habilitado,
          modoAuth: config.modoAuth,
          credenciaisPath: config.credenciaisPath || '',
          pastaId: config.pastaId || '',
          tipoPermissao: config.tipoPermissao,
          dominio: config.dominio || '',
          expurgoDias: config.expurgoDias || 3,
          oauthClientId: config.oauthClientId || '',
          oauthClientSecret: config.oauthClientSecret || '',
          oauthRedirectUri: config.oauthRedirectUri || '',
        });
      },
      error: (error) => {
        this.toast.error('Falha ao carregar configuração do Google Drive');
        console.error(error);
      }
    });
  }

  salvar() {
    if (this.form.invalid) {
      this.toast.warning('Preencha os campos obrigatórios');
      return;
    }

    // Campos dentro de *ngIf são removidos do FormGroup pelo Angular quando
    // ficam escondidos (comportamento conhecido do Reactive Forms) — por
    // isso getRawValue() pode vir sem essas chaves. Mesclando com a última
    // config carregada do servidor, um campo escondido no momento do salvar
    // mantém o valor anterior em vez de virar null/undefined.
    const valoresForm = this.form.getRawValue();
    const valores: GoogleDriveConfig = {
      ...(this.config as GoogleDriveConfig),
      ...valoresForm,
    } as GoogleDriveConfig;

    this.service.salvarConfig(valores).subscribe({
      next: (config) => {
        this.config = config;
        this.toast.success('Configuração salva com sucesso');
        // O secret sempre volta mascarado — evita reenviar o placeholder como se fosse um valor novo.
        this.form.patchValue({ oauthClientSecret: config.oauthClientSecret || '' });
      },
      error: (error) => {
        const msg = error?.error?.message || 'Falha ao salvar configuração';
        this.toast.error(msg);
        console.error(error);
      }
    });
  }

  autorizar() {
    const clientId = this.form.get('oauthClientId')!.value;
    const redirectUri = this.form.get('oauthRedirectUri')!.value;
    if (!clientId || !redirectUri) {
      this.toast.warning('Preencha e salve Client ID e Redirect URI antes de autorizar');
      return;
    }

    this.autorizando = true;
    this.service.obterUrlAutorizacao().subscribe({
      next: (resultado) => {
        this.autorizando = false;
        window.open(resultado.url, '_blank');
        this.toast.info('Complete o login na aba que abriu, depois volte aqui e clique em Salvar/recarregar.');
      },
      error: (error) => {
        this.autorizando = false;
        const msg = error?.error?.message || 'Falha ao iniciar autorização';
        this.toast.error(msg);
        console.error(error);
      }
    });
  }
}
