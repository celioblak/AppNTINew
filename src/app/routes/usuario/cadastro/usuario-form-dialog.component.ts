import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { HotToastService } from '@ngxpert/hot-toast';
import { ExpedienteTelegram } from '@shared/components/expediente-telegram/expediente-telegram';

import { UsuarioCadastro, UsuarioCadastroService } from './usuario-cadastro.service';

interface DadosDialogUsuario {
  modo: 'adicionar' | 'editar';
  usuario: UsuarioCadastro;
}

@Component({
  selector: 'dialog-usuario',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatExpansionModule,
    ExpedienteTelegram,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.modo === 'adicionar' ? 'Novo Usuário' : 'Editar Usuário' }}</h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="form-usuario">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Nome</mat-label>
          <input matInput formControlName="nome" maxlength="120" autocomplete="off" />
          @if (form.get('nome')?.hasError('required') && form.get('nome')?.touched) {
            <mat-error>Informe o nome</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Login</mat-label>
          <input matInput formControlName="login" maxlength="60" autocomplete="off" />
          @if (data.modo === 'editar') {
            <mat-hint>O login não pode ser alterado</mat-hint>
          }
          @if (form.get('login')?.hasError('required') && form.get('login')?.touched) {
            <mat-error>Informe o login</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>E-mail</mat-label>
          <input matInput type="email" formControlName="email" maxlength="120" autocomplete="off" />
          @if (form.get('email')?.hasError('email')) {
            <mat-error>E-mail inválido</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="meia">
          <mat-label>Matrícula</mat-label>
          <input matInput type="number" formControlName="matricula" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="meia">
          <mat-label>ID Telegram</mat-label>
          <input matInput type="number" formControlName="telegramId" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Usuário GLPI (GLPI_USER_ID)</mat-label>
          <input matInput formControlName="glpiUserId" maxlength="60" autocomplete="off" />
          <mat-hint>Deixe em branco para desvincular do GLPI</mat-hint>
        </mat-form-field>

        <div class="toggles">
          <mat-slide-toggle formControlName="snAtivo">Ativo</mat-slide-toggle>
          <mat-slide-toggle formControlName="snAdmin">Administrador</mat-slide-toggle>
          <mat-slide-toggle formControlName="snPlantonista">Plantonista</mat-slide-toggle>
          <mat-slide-toggle
            formControlName="snMsgTelegram"
            [matTooltip]="form.get('snMsgTelegram')?.disabled ? 'Informe o ID Telegram para habilitar' : ''"
          >
            Mensagens Telegram
          </mat-slide-toggle>
          <mat-slide-toggle
            formControlName="snLoginAd"
            matTooltip="Permite entrar com o usuário e a senha da rede (Active Directory)"
          >
            Login pela rede (AD)
          </mat-slide-toggle>
        </div>

        @if (form.get('snLoginAd')?.value) {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Conta da rede (AD)</mat-label>
            <input
              matInput
              formControlName="loginAd"
              maxlength="100"
              autocomplete="off"
              [placeholder]="(form.getRawValue().login || '').toLowerCase()"
            />
            <mat-hint>Em branco = mesma conta do login. Quem souber a senha dessa conta entra como este usuário.</mat-hint>
          </mat-form-field>

          <div class="full-width">
            <mat-slide-toggle
              formControlName="snLoginAutomatico"
              matTooltip="Em computadores do domínio entra sem senha, com o usuário do Windows; fora deles vale o formulário"
            >
              Login automático com o usuário do Windows
            </mat-slide-toggle>
          </div>
        }
      </form>

      @if (data.modo === 'editar' && data.usuario.codUsuario != null) {
        <mat-expansion-panel class="expediente">
          <mat-expansion-panel-header>
            <mat-panel-title>Notificações e horário de trabalho</mat-panel-title>
          </mat-expansion-panel-header>
          <p class="expediente__dica">
            Salvo à parte, pelo botão abaixo. Mudou o ID Telegram ou "Mensagens Telegram"? Salve o usuário antes.
          </p>
          <app-expediente-telegram [codUsuario]="data.usuario.codUsuario" />
        </mat-expansion-panel>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="cancelar()" [disabled]="salvando">Cancelar</button>
      <button
        mat-raised-button
        color="primary"
        type="button"
        (click)="salvar()"
        [disabled]="salvando || form.invalid"
      >
        Salvar
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      :host {
        display: block;
        max-width: 560px;
      }
      .form-usuario {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 4px 16px;
        padding-top: 8px;
      }
      .full-width {
        grid-column: 1 / -1;
      }
      .toggles {
        grid-column: 1 / -1;
        display: flex;
        flex-wrap: wrap;
        gap: 12px 24px;
        margin: 8px 0 4px;
      }
      .expediente {
        margin-top: 12px;
      }
      .expediente__dica {
        margin: 0 0 8px;
        font-size: 12px;
        color: var(--mat-sys-on-surface-variant);
      }
      @media (max-width: 599px) {
        .form-usuario {
          grid-template-columns: 1fr;
        }
        .meia {
          grid-column: 1 / -1;
        }
      }
    `,
  ],
})
export class UsuarioFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(UsuarioCadastroService);
  private readonly toast = inject(HotToastService);
  private readonly dialogRef = inject(MatDialogRef<UsuarioFormDialogComponent>);
  readonly data = inject<DadosDialogUsuario>(MAT_DIALOG_DATA);

  salvando = false;

  readonly form = this.fb.group({
    nome: ['', [Validators.required, Validators.maxLength(120)]],
    login: ['', [Validators.required, Validators.maxLength(60)]],
    email: ['', [Validators.email, Validators.maxLength(120)]],
    matricula: [null as number | null],
    glpiUserId: ['', [Validators.maxLength(60)]],
    telegramId: [null as number | null],
    snAtivo: [true],
    snAdmin: [false],
    snPlantonista: [false],
    snMsgTelegram: [false],
    snLoginAd: [false],
    loginAd: ['', [Validators.maxLength(100)]],
    snLoginAutomatico: [false],
  });

  constructor() {
    const u = this.data.usuario ?? ({} as UsuarioCadastro);
    this.form.patchValue({
      nome: u.nome ?? '',
      login: u.login ?? '',
      email: u.email ?? '',
      matricula: u.matricula ?? null,
      glpiUserId: u.glpiUserId ?? '',
      telegramId: u.telegramId ?? null,
      snAtivo: u.codUsuario != null ? !!u.snAtivo : true,
      snAdmin: !!u.snAdmin,
      snPlantonista: !!u.snPlantonista,
      snMsgTelegram: !!u.snMsgTelegram,
      snLoginAd: !!u.snLoginAd,
      loginAd: u.loginAd ?? '',
      snLoginAutomatico: !!u.snLoginAutomatico,
    });

    // "Mensagens Telegram" só é habilitado quando há um ID Telegram informado.
    this.sincronizarToggleTelegram();
    this.form.get('telegramId')!.valueChanges.subscribe(() => this.sincronizarToggleTelegram());

    if (this.data.modo === 'editar') {
      this.form.get('login')!.disable();

      // Recarrega o registro completo (matrícula/GLPI/Telegram nem sempre vêm na lista)
      if (u.codUsuario != null) {
        this.service.obter(u.codUsuario).subscribe({
          next: completo =>
            this.form.patchValue({
              nome: completo.nome ?? '',
              email: completo.email ?? '',
              matricula: completo.matricula ?? null,
              glpiUserId: completo.glpiUserId ?? '',
              telegramId: completo.telegramId ?? null,
              snAtivo: !!completo.snAtivo,
              snAdmin: !!completo.snAdmin,
              snPlantonista: !!completo.snPlantonista,
              snMsgTelegram: !!completo.snMsgTelegram,
              snLoginAd: !!completo.snLoginAd,
              loginAd: completo.loginAd ?? '',
              snLoginAutomatico: !!completo.snLoginAutomatico,
            }),
          error: () => {
            /* mantém dados da lista */
          },
        });
      }
    }
  }

  private sincronizarToggleTelegram(): void {
    const temId = this.form.get('telegramId')!.value != null && `${this.form.get('telegramId')!.value}`.trim() !== '';
    const toggle = this.form.get('snMsgTelegram')!;
    if (temId) {
      if (toggle.disabled) {
        toggle.enable({ emitEvent: false });
      }
    } else {
      toggle.setValue(false, { emitEvent: false });
      toggle.disable({ emitEvent: false });
    }
  }

  salvar(): void {
    if (this.form.invalid || this.salvando) {
      this.form.markAllAsTouched();
      return;
    }

    const bruto = this.form.getRawValue();
    const id = this.data.usuario?.codUsuario ?? null;
    const dto: UsuarioCadastro = {
      codUsuario: id,
      nome: bruto.nome!.trim(),
      login: bruto.login!.trim(),
      email: bruto.email?.trim() || null,
      matricula: bruto.matricula ?? null,
      glpiUserId: bruto.glpiUserId?.trim() || null,
      telegramId: bruto.telegramId ?? null,
      snAtivo: !!bruto.snAtivo,
      snAdmin: !!bruto.snAdmin,
      snPlantonista: !!bruto.snPlantonista,
      snMsgTelegram: !!bruto.snMsgTelegram,
      snLoginAd: !!bruto.snLoginAd,
      loginAd: bruto.loginAd?.trim() || null,
      // Login automático só vale com o login pela rede
      snLoginAutomatico: !!bruto.snLoginAd && !!bruto.snLoginAutomatico,
    };

    this.salvando = true;
    const requisicao$ =
      id != null ? this.service.atualizar(id, dto) : this.service.criar(dto);

    requisicao$.subscribe({
      next: () => {
        this.salvando = false;
        this.toast.success(id != null ? 'Usuário atualizado com sucesso!' : 'Usuário cadastrado com sucesso!');
        this.dialogRef.close(true);
      },
      error: err => {
        this.salvando = false;
        if (err?.status === 409) {
          // Conta da rede em uso chega com mensagem do backend, já exibida pelo interceptor
          if (!err?.original?.error?.message) {
            this.toast.error(`O login "${dto.login}" já está em uso`);
          }
        } else {
          this.toast.error('Não foi possível salvar o usuário');
        }
      },
    });
  }

  cancelar(): void {
    this.dialogRef.close('cancelado');
  }
}
