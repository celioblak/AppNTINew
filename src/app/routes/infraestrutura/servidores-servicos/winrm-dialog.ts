import { Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { HotToastService } from '@ngxpert/hot-toast';
import { finalize } from 'rxjs';

import { TesteWinRm } from '../infraestrutura.models';
import { InfraestruturaService } from '../infraestrutura.service';

export interface WinRmDialogData {
  codServidor: number;
  nome: string;
  protocolo: string | null;
}

/**
 * Preparar WinRM (docs/infraestrutura.md, R-44): o script PowerShell já montado para o servidor
 * e os IPs do NTI, o passo a passo e o teste de leitura.
 */
@Component({
  selector: 'app-winrm-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule, MatProgressBarModule],
  template: `
    <h2 mat-dialog-title>Preparar WinRM · {{ data.nome }}</h2>
    <mat-dialog-content>
      <ol class="passos">
        <li>Copie ou baixe o script abaixo (já vem com o servidor, o protocolo <b>{{ data.protocolo ?? 'HTTPS' }}</b> e os IPs do NTI).</li>
        <li>No servidor, abra o <b>PowerShell como administrador</b> e rode o script. Pode rodar de novo sem problema.</li>
        <li>Leia os avisos em amarelo no fim (usuário fora do grupo de administradores, regra de firewall aberta para todos).</li>
        <li>Volte aqui e clique em <b>Testar WinRM</b>.</li>
      </ol>
      <p class="dica">
        Script baixado bloqueado pela política? Rode antes, na mesma janela:
        <code>Set-ExecutionPolicy -Scope Process Bypass</code>
      </p>

      @if (carregando()) {
        <mat-progress-bar mode="indeterminate" />
      } @else if (erroScript()) {
        <div class="resultado resultado--erro"><mat-icon>error</mat-icon><span>{{ erroScript() }}</span></div>
      } @else {
        <pre class="script">{{ script() }}</pre>
      }

      @if (testando()) {
        <mat-progress-bar mode="indeterminate" />
      }
      @if (teste(); as t) {
        <div class="resultado" [class.resultado--ok]="t.ok" [class.resultado--erro]="!t.ok">
          <mat-icon>{{ t.ok ? 'check_circle' : 'error' }}</mat-icon>
          <div>
            <b>{{ t.mensagem }}</b>
            @if (t.orientacao) {
              <p>{{ t.orientacao }}</p>
            }
          </div>
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-stroked-button (click)="copiar()" [disabled]="!script()"><mat-icon>content_copy</mat-icon> Copiar</button>
      <button mat-stroked-button (click)="baixar()" [disabled]="!script()"><mat-icon>file_download</mat-icon> Baixar .ps1</button>
      <span class="espaco"></span>
      <button mat-button mat-dialog-close>Fechar</button>
      <button mat-flat-button (click)="testar()" [disabled]="testando()"><mat-icon>network_check</mat-icon> Testar WinRM</button>
    </mat-dialog-actions>
  `,
  styles: `
    .passos { margin: 0 0 6px; padding-left: 20px; font-size: .85rem; line-height: 1.5; }
    .dica { margin: 0 0 8px; font-size: .8rem; color: var(--mat-sys-on-surface-variant, rgba(0,0,0,.6)); }
    .script { max-height: 42vh; overflow: auto; margin: 0; padding: 10px 12px; border-radius: 8px; font-size: .75rem;
              line-height: 1.4; white-space: pre; background: var(--mat-sys-surface-container, #eef0f3); }
    .resultado { display: flex; gap: 8px; align-items: flex-start; margin-top: 10px; padding: 8px 10px; border-radius: 8px;
                 font-size: .85rem; }
    .resultado p { margin: 4px 0 0; }
    .resultado--ok { background: color-mix(in srgb, #2e9e5b 14%, transparent); color: #1e7a45; }
    .resultado--erro { background: color-mix(in srgb, #d93636 12%, transparent); color: #c62828; }
    .espaco { flex: 1; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WinRmDialogComponent {
  readonly data = inject<WinRmDialogData>(MAT_DIALOG_DATA);
  private readonly service = inject(InfraestruturaService);
  private readonly clipboard = inject(Clipboard);
  private readonly toast = inject(HotToastService);

  readonly script = signal<string | null>(null);
  readonly carregando = signal(true);
  readonly erroScript = signal<string | null>(null);
  readonly testando = signal(false);
  readonly teste = signal<TesteWinRm | null>(null);

  constructor() {
    this.service
      .scriptWinRm(this.data.codServidor)
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({
        next: s => this.script.set(s),
        error: e => this.erroScript.set(mensagemErro(e, 'Não foi possível montar o script.')),
      });
  }

  copiar() {
    const s = this.script();
    if (!s) return;
    this.clipboard.copy(s);
    this.toast.success('Script copiado. Cole no PowerShell (administrador) do servidor.');
  }

  baixar() {
    const s = this.script();
    if (!s) return;
    // BOM: o PowerShell 5.1 lê o arquivo sem BOM como ANSI e estraga os acentos.
    const blob = new Blob(['﻿' + s.replace(/\r?\n/g, '\r\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `preparar-winrm-${this.data.nome.replace(/[^\w.-]+/g, '_')}.ps1`;
    a.click();
    URL.revokeObjectURL(url);
  }

  testar() {
    this.testando.set(true);
    this.teste.set(null);
    this.service
      .testarWinRm(this.data.codServidor)
      .pipe(finalize(() => this.testando.set(false)))
      .subscribe({
        next: t => this.teste.set(t),
        error: e =>
          this.teste.set({
            ok: false,
            mensagem: mensagemErro(e, 'O teste não chegou a rodar.'),
            orientacao: 'Confira se o ntiapi está no ar e tente de novo.',
            protocolo: this.data.protocolo ?? 'HTTPS',
            memoriaTotalKb: null,
            nucleos: null,
            discos: null,
          }),
      });
  }
}

/**
 * Mensagem do erro. O errorInterceptor já devolve um Error com a mensagem do ApiErrorResponse
 * (e o HttpErrorResponse em `original`); sem ele, lê o corpo (texto JSON na chamada de texto).
 */
function mensagemErro(e: any, padrao: string): string {
  let corpo = e?.original?.error ?? e?.error;
  if (typeof corpo === 'string') {
    try {
      corpo = JSON.parse(corpo);
    } catch {
      corpo = null;
    }
  }
  return corpo?.message ?? e?.message ?? padrao;
}
