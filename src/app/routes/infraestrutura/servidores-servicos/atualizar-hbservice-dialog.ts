import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { lastValueFrom } from 'rxjs';

import {
  AtualizacaoResult,
  HbserviceService,
  parametrosAtualizacaoPadrao,
} from '@core/hbservice/hb.service';
import { TesteFonte } from '../infraestrutura.models';
import { InfraestruturaService } from '../infraestrutura.service';

export interface AtualizarHbServiceDialogData {
  codServidor: number;
  nome: string;
  host: string;
}

/**
 * Atualizar HB Service (docs/infraestrutura.md, R-59): o mesmo fluxo da tela do VNC — copia o hbserviceUpdate da
 * rede para o servidor, inicia, e manda ele baixar o hbService.exe atual (servido pelo próprio NTI, R-58). No fim,
 * testa a leitura para confirmar a versão nova. Fecha com true quando atualizou.
 */
@Component({
  selector: 'app-atualizar-hbservice-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
  ],
  template: `
    <h2 mat-dialog-title>Atualizar HB Service · {{ data.nome }}</h2>
    <mat-dialog-content>
      <p class="dica">
        O NTI copia o <b>hbserviceUpdate</b> da rede para o servidor <b>{{ data.host }}</b>, inicia, e ele baixa e instala o
        HB Service atual. O agente fica alguns segundos fora durante a troca.
      </p>

      <mat-expansion-panel class="opcoes" [disabled]="rodando()">
        <mat-expansion-panel-header>Opções da atualização</mat-expansion-panel-header>
        <div class="campos">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>hbserviceUpdate na rede</mat-label>
            <input matInput [(ngModel)]="params.caminhoExeRede" />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Pasta do HB Service no servidor</mat-label>
            <input matInput [(ngModel)]="params.destinoLocal" />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Endereço do hbService.exe (de onde o servidor baixa)</mat-label>
            <input matInput [(ngModel)]="params.urlUpdate" />
            <mat-hint>O servidor precisa alcançar este endereço</mat-hint>
          </mat-form-field>
        </div>
      </mat-expansion-panel>

      @if (rodando()) {
        <mat-progress-bar mode="indeterminate" />
      }
      @if (etapas().length) {
        <ol class="etapas">
          @for (e of etapas(); track $index) {
            <li>{{ e }}</li>
          }
        </ol>
      }

      @if (resultado(); as r) {
        <div class="resultado" [class.resultado--ok]="r.ok" [class.resultado--erro]="!r.ok">
          <mat-icon>{{ r.ok ? 'check_circle' : 'error' }}</mat-icon>
          <div>
            <b>{{ r.mensagem }}</b>
            @if (r.orientacao) {
              <p>{{ r.orientacao }}</p>
            }
          </div>
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="fechar()" [disabled]="rodando()">Fechar</button>
      <button mat-flat-button (click)="atualizar()" [disabled]="rodando() || !params.urlUpdate">
        <mat-icon>system_update</mat-icon> {{ resultado() && !resultado()!.ok ? 'Tentar de novo' : 'Atualizar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .dica { margin: 0 0 10px; font-size: .85rem; }
    .opcoes { margin-bottom: 10px; }
    .campos { display: flex; flex-direction: column; gap: 12px; padding-top: 4px; }
    .etapas { margin: 10px 0 0; padding-left: 20px; font-size: .82rem; line-height: 1.6; }
    .resultado { display: flex; gap: 8px; align-items: flex-start; margin-top: 10px; padding: 8px 10px; border-radius: 8px;
                 font-size: .85rem; }
    .resultado p { margin: 4px 0 0; }
    .resultado--ok { background: color-mix(in srgb, #2e9e5b 14%, transparent); color: #1e7a45; }
    .resultado--erro { background: color-mix(in srgb, #d93636 12%, transparent); color: #c62828; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AtualizarHbServiceDialogComponent {
  readonly data = inject<AtualizarHbServiceDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<AtualizarHbServiceDialogComponent, boolean>>(MatDialogRef);
  private readonly hbService = inject(HbserviceService);
  private readonly infra = inject(InfraestruturaService);

  readonly params = parametrosAtualizacaoPadrao();
  readonly rodando = signal(false);
  readonly etapas = signal<string[]>([]);
  readonly resultado = signal<{ ok: boolean; mensagem: string; orientacao: string | null } | null>(null);
  private atualizou = false;

  async atualizar() {
    this.rodando.set(true);
    this.etapas.set([]);
    this.resultado.set(null);
    this.ref.disableClose = true;
    try {
      const r = await this.hbService.atualizarHbService(this.data.host, { ...this.params }, etapa =>
        this.etapas.update(lista => [...lista, etapa])
      );
      if (!r.sucesso) {
        this.resultado.set({ ok: false, mensagem: `Falha na etapa "${r.etapa}": ${r.mensagem}`, orientacao: orientacao(r, this.params.urlUpdate) });
        return;
      }
      this.atualizou = true;
      this.etapas.update(lista => [...lista, 'Conferindo a leitura pelo HB Service novo...']);
      const testes = await lastValueFrom(this.infra.testarLeitura(this.data.codServidor)).catch(() => [] as TesteFonte[]);
      const agente = testes.find(t => t.fonte === 'HBSERVICE');
      if (agente?.ok) {
        this.resultado.set({ ok: true, mensagem: agente.mensagem, orientacao: agente.orientacao });
      } else {
        this.resultado.set({
          ok: false,
          mensagem: 'A atualização terminou, mas a leitura pelo HB Service ainda falha' + (agente ? `: ${agente.mensagem}` : '.'),
          orientacao: agente?.orientacao ?? 'Aguarde um minuto e use "Testar leitura"; o agente pode estar terminando de subir.',
        });
      }
    } finally {
      this.rodando.set(false);
      this.ref.disableClose = false;
    }
  }

  fechar() {
    this.ref.close(this.atualizou);
  }
}

/** O que fazer em cada etapa que falhou (memória: toda falha diz como corrigir). */
function orientacao(r: AtualizacaoResult, url: string): string {
  const msg = r.mensagem.toLowerCase();
  if (r.etapa === 'health-check') {
    return 'O HB Service não respondeu na porta 9071: confira no servidor se o hbService.exe está rodando e se o firewall libera a 9071 para o NTI.';
  }
  if (msg.includes('xcopy')) {
    return 'O servidor não conseguiu copiar o hbserviceUpdate da rede: confira o caminho em "Opções da atualização" e se o servidor acessa esse compartilhamento.';
  }
  if (r.etapa === 'abrir-exe') {
    return 'O hbserviceUpdate não subiu na porta 9072: veja no servidor se o antivírus bloqueou o hbServiceUpdate.exe e se o firewall libera a 9072 para o NTI.';
  }
  if (r.etapa === 'aguardar-restart') {
    return 'O HB Service não voltou: no servidor, abra o hbService.exe (ou, se ele roda como serviço, inicie o serviço "HB Service") e tente de novo.';
  }
  if (msg.includes('disparar update')) {
    return `O hbserviceUpdate não conseguiu baixar o pacote: confira se o servidor alcança ${url}.`;
  }
  return 'Tente de novo; se repetir, faça a atualização pela tela do VNC para ver o detalhe de cada etapa.';
}
