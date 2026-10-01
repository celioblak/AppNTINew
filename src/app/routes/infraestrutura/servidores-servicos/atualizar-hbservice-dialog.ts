import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { lastValueFrom } from 'rxjs';

import { EtapaAtualizacao, HbserviceService, ResultadoAtualizacao } from '@core/hbservice/hb.service';
import { TesteFonte } from '../infraestrutura.models';
import { InfraestruturaService } from '../infraestrutura.service';

export interface AtualizarHbServiceDialogData {
  codServidor: number;
  nome: string;
  host: string;
}

/**
 * Atualizar os agentes do servidor (docs/infraestrutura.md, R-59 a R-61): o ntiapi conduz — o HB Service troca o
 * atualizador, depois o atualizador troca o HB Service, cada um só depois do outro confirmado e com volta automática
 * se o novo não subir. A tela mostra as etapas e, no fim, testa a leitura. Fecha com true quando atualizou.
 */
@Component({
  selector: 'app-atualizar-hbservice-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule, MatProgressBarModule],
  template: `
    <h2 mat-dialog-title>Atualizar HB Service · {{ data.nome }}</h2>
    <mat-dialog-content>
      <p class="dica">
        O NTI atualiza os dois agentes de <b>{{ data.host }}</b>, um de cada vez: primeiro o <b>atualizador</b> (trocado pelo
        HB Service), depois o <b>HB Service</b> (trocado pelo atualizador). Um sempre fica no ar, e quem troca volta o
        anterior sozinho se o novo não subir. Os dois baixam os exe do próprio NTI.
      </p>

      @if (rodando()) {
        <mat-progress-bar mode="indeterminate" />
      }
      @if (etapas().length) {
        <ul class="etapas">
          @for (e of etapas(); track $index) {
            <li class="etapa etapa--{{ e.tipo.toLowerCase() }}">
              <mat-icon inline>{{ icone(e) }}</mat-icon>
              <div>
                {{ e.mensagem }}
                @if (e.orientacao) {
                  <small>{{ e.orientacao }}</small>
                }
              </div>
            </li>
          }
        </ul>
      }

      @if (resultado(); as r) {
        <div class="resultado" [class.resultado--ok]="r.sucesso" [class.resultado--erro]="!r.sucesso">
          <mat-icon>{{ r.sucesso ? 'check_circle' : 'error' }}</mat-icon>
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
      <!-- Antes: Fechar + Atualizar. Sucesso: só Fechar. Erro: Fechar + Tentar de novo. -->
      @let r = resultado();
      @if (r?.sucesso) {
        <button mat-flat-button (click)="fechar()">Fechar</button>
      } @else {
        <button mat-button (click)="fechar()" [disabled]="rodando()">Fechar</button>
        <button mat-flat-button (click)="atualizar()" [disabled]="rodando()">
          <mat-icon>{{ r ? 'replay' : 'system_update' }}</mat-icon> {{ r ? 'Tentar de novo' : 'Atualizar' }}
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: `
    .dica { margin: 0 0 10px; font-size: .85rem; }
    .etapas { list-style: none; margin: 10px 0 0; padding: 0; font-size: .82rem; }
    .etapa { display: flex; gap: 6px; align-items: flex-start; padding: 3px 0; }
    .etapa small { display: block; opacity: .8; }
    .etapa--ok mat-icon { color: #2e9e5b; }
    .etapa--aviso mat-icon { color: #e08a00; }
    .etapa--erro { color: #c62828; }
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

  readonly rodando = signal(false);
  readonly etapas = signal<EtapaAtualizacao[]>([]);
  readonly resultado = signal<ResultadoAtualizacao | null>(null);
  private atualizou = false;

  icone(e: EtapaAtualizacao): string {
    return e.tipo === 'OK' ? 'check_circle' : e.tipo === 'AVISO' ? 'warning' : e.tipo === 'ERRO' ? 'error' : 'info';
  }

  async atualizar() {
    this.rodando.set(true);
    this.etapas.set([]);
    this.resultado.set(null);
    this.ref.disableClose = true;
    try {
      const r = await this.hbService
        .atualizarAgentes(this.data.host, e => this.etapas.update(lista => [...lista, e]))
        .catch(
          (erro): ResultadoAtualizacao => ({
            sucesso: false,
            mensagem: `Não foi possível falar com o NTI: ${erro?.message ?? erro}.`,
            orientacao: 'Confira se o ntiapi está no ar e tente de novo.',
            versaoHbService: null,
            versaoAtualizador: null,
          })
        );
      if (!r.sucesso) {
        this.resultado.set(r);
        return;
      }
      this.atualizou = true;
      this.etapas.update(lista => [...lista, { tipo: 'INFO', mensagem: 'Conferindo a leitura pelo HB Service novo...', orientacao: null }]);
      const testes = await lastValueFrom(this.infra.testarLeitura(this.data.codServidor)).catch(() => [] as TesteFonte[]);
      const agente = testes.find(t => t.fonte === 'HBSERVICE');
      this.resultado.set(
        agente && !agente.ok
          ? { ...r, sucesso: false, mensagem: `${r.mensagem} Mas a leitura ainda falha: ${agente.mensagem}`, orientacao: agente.orientacao }
          : r
      );
    } finally {
      this.rodando.set(false);
      this.ref.disableClose = false;
    }
  }

  fechar() {
    this.ref.close(this.atualizou);
  }
}
