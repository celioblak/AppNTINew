import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

export interface ConexaoAvulsa {
  host: string;
  porta: number;
  usuario: string;
  senha: string;
}

@Component({
  selector: 'app-conexao-avulsa-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>Conexão SSH avulsa</h2>
    <form #form="ngForm" (ngSubmit)="conectar()">
      <mat-dialog-content class="campos">
        <mat-form-field appearance="outline" class="host">
          <mat-label>Host ou IP</mat-label>
          <input matInput name="host" [(ngModel)]="conexao.host" required autocomplete="off" cdkFocusInitial>
        </mat-form-field>
        <mat-form-field appearance="outline" class="porta">
          <mat-label>Porta</mat-label>
          <input matInput type="number" name="porta" [(ngModel)]="conexao.porta" required min="1" max="65535">
        </mat-form-field>
        <mat-form-field appearance="outline" class="inteiro">
          <mat-label>Usuário</mat-label>
          <input matInput name="usuario" [(ngModel)]="conexao.usuario" required autocomplete="off">
        </mat-form-field>
        <mat-form-field appearance="outline" class="inteiro">
          <mat-label>Senha</mat-label>
          <input matInput [type]="mostrarSenha ? 'text' : 'password'" name="senha" [(ngModel)]="conexao.senha"
                 required autocomplete="new-password">
          <button mat-icon-button matSuffix type="button" [attr.aria-label]="mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'"
                  (click)="mostrarSenha = !mostrarSenha">
            <mat-icon>{{ mostrarSenha ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
        </mat-form-field>
        <p class="aviso inteiro">A senha fica só na memória desta página e não é gravada.</p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="form.invalid">
          <mat-icon>terminal</mat-icon>
          Conectar
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .campos {
      display: grid;
      grid-template-columns: 1fr 110px;
      gap: 0 12px;
    }

    .inteiro {
      grid-column: 1 / -1;
    }

    .aviso {
      margin: 0;
      font-size: .75rem;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConexaoAvulsaDialogComponent {
  private readonly dialogRef = inject<MatDialogRef<ConexaoAvulsaDialogComponent, ConexaoAvulsa>>(MatDialogRef);

  conexao: ConexaoAvulsa = { host: '', porta: 22, usuario: '', senha: '' };
  mostrarSenha = false;

  conectar() {
    this.dialogRef.close({ ...this.conexao, host: this.conexao.host.trim(), usuario: this.conexao.usuario.trim() });
  }
}
