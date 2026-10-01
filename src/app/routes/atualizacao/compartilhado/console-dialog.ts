import { DatePipe } from '@angular/common';
import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { ExecucaoAutomatica, LinhaConsole, SituacaoExecucao } from '../atualizacao.models';
import { AtualizacaoService } from '../atualizacao.service';

export interface ConsoleDialogData {
  codAtualizacao: number;
  execucao: ExecucaoAutomatica;
}

const SITUACAO_ROTULO: Record<SituacaoExecucao, string> = {
  EM_ANDAMENTO: 'Em andamento',
  AGUARDANDO_REINICIO: 'Aguardando reinício',
  CONCLUIDA: 'Concluída',
  FALHA: 'Falhou',
  INTERROMPIDA: 'Interrompida',
  RESTAURADA: 'Restaurada',
};

/**
 * Console da execução automática (F-3a): cada comando no nó, a saída, o erro e o código de retorno, ao vivo. Busca as
 * linhas novas a cada segundo enquanto a execução roda (funciona em qualquer nó do cluster da aplicação).
 * Devolve true ao fechar se algo mudou na atualização, para o detalhe recarregar.
 */
@Component({
  selector: 'app-atualizacao-console-dialog',
  imports: [DatePipe, FormsModule, MatButtonModule, MatCheckboxModule, MatDialogModule, MatIconModule, MatProgressBarModule],
  template: `
    <h2 mat-dialog-title class="titulo">
      <mat-icon>code</mat-icon>
      {{ execucao().operacao === 'BACKUP' ? 'Backup automático' : 'Aplicação automática' }} · {{ execucao().artefato }}
      <span class="situacao" [attr.data-situacao]="execucao().situacao">{{ rotulo[execucao().situacao] }}</span>
    </h2>
    <mat-dialog-content class="conteudo">
      <div class="cabecalho">
        <span>{{ execucao().numero }} · iniciada por {{ execucao().usuario }} em {{ execucao().inicio | date: 'dd/MM/yyyy HH:mm:ss' }}</span>
        <span class="nos">
          @for (n of execucao().nos; track n.chave) {
            <span class="no" [class.no--trocado]="n.trocado" [class.no--preparado]="n.preparado && !n.trocado">
              {{ n.nome }}{{ n.trocado ? ' · trocado' : n.preparado ? ' · preparado' : '' }}
            </span>
          }
        </span>
      </div>
      @if (execucao().restauravel) {
        <div class="abandonada">
          <mat-icon>report</mat-icon>
          <div>
            @if (execucao().abandonada) {
              <strong>A execução parou no meio: o servidor da aplicação caiu (sem sinal de vida desde {{ execucao().ultimaPulsacao | date: 'dd/MM HH:mm:ss' }}).</strong>
            } @else {
              <strong>A execução terminou com o retorno incompleto.</strong>
            }
            <span>
              Os nós podem estar diferentes. Restaurar confere o arquivo real de cada nó e devolve o backup onde estiver o novo; depois dá
              para tentar de novo.
            </span>
          </div>
        </div>
      } @else if (execucao().situacao === 'EM_ANDAMENTO') {
        <mat-progress-bar mode="indeterminate" />
      }

      <div #terminal class="terminal" (scroll)="rolou()">
        @for (l of linhas(); track l.seq) {
          <div class="linha" [attr.data-tipo]="l.tipo">
            <span class="hora">{{ l.data | date: 'HH:mm:ss' }}</span>
            @if (l.no) {
              <span class="no-linha">[{{ l.no }}]</span>
            }
            <span class="prefixo">{{ prefixo(l) }}</span>
            <span class="texto">{{ l.texto }}</span>
          </div>
        } @empty {
          <div class="linha"><span class="texto">Iniciando…</span></div>
        }
      </div>

      @if (execucao().mensagem && execucao().situacao !== 'EM_ANDAMENTO') {
        <p class="mensagem" [attr.data-situacao]="execucao().situacao">{{ execucao().mensagem }}</p>
      }

      @if (execucao().situacao === 'AGUARDANDO_REINICIO') {
        <div class="reinicio">
          <mat-icon>replay</mat-icon>
          <div>
            <strong>Nada foi reiniciado.</strong>
            <span>Reinicie {{ nomesDosNos() }} por fora e confirme: só então a aplicação é registrada (D-15).</span>
            <mat-checkbox [(ngModel)]="reiniciou">Reiniciei {{ nomesDosNos() }} e a aplicação subiu normalmente</mat-checkbox>
          </div>
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (execucao().restauravel) {
        <button mat-flat-button type="button" class="perigo" [disabled]="restaurando()" (click)="restaurar()">
          <mat-icon>settings_backup_restore</mat-icon> {{ restaurando() ? 'Restaurando…' : 'Restaurar os backups' }}
        </button>
      } @else if (execucao().situacao === 'EM_ANDAMENTO') {
        <button mat-stroked-button type="button" class="perigo-contorno" [disabled]="interrompendo()" (click)="interromper()"
          title="Para depois do passo em curso; nunca no meio de uma troca. Os nós já trocados voltam ao backup.">
          <mat-icon>stop</mat-icon> {{ interrompendo() ? 'Interrompendo…' : 'Interromper' }}
        </button>
      }
      @if (execucao().situacao === 'AGUARDANDO_REINICIO') {
        <button mat-flat-button type="button" [disabled]="!reiniciou || confirmando()" (click)="confirmarReinicio()">
          <mat-icon>check_circle</mat-icon> Confirmar reinício e registrar a aplicação
        </button>
      }
      <button mat-button type="button" (click)="fechar()">{{ execucao().situacao === 'EM_ANDAMENTO' ? 'Fechar (continua rodando)' : 'Fechar' }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    .titulo {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .situacao {
      margin-left: auto;
      padding: 2px 10px;
      border-radius: 12px;
      background: var(--mat-sys-surface-container-high, #eee);
      font-size: .78rem;
      font-weight: 500;
    }

    .situacao[data-situacao='CONCLUIDA'] {
      background: color-mix(in srgb, #2e7d32 18%, transparent);
      color: #2e7d32;
    }

    .situacao[data-situacao='FALHA'],
    .situacao[data-situacao='INTERROMPIDA'] {
      background: color-mix(in srgb, #d32f2f 16%, transparent);
      color: #d32f2f;
    }

    .situacao[data-situacao='AGUARDANDO_REINICIO'] {
      background: color-mix(in srgb, #ed6c02 18%, transparent);
      color: #b35300;
    }

    .conteudo {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: min(1100px, 94vw);
      max-height: calc(90vh - 130px);
    }

    .cabecalho {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 6px 16px;
      font-size: .8rem;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
    }

    .nos {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .no {
      padding: 1px 8px;
      border-radius: 10px;
      background: var(--mat-sys-surface-container, rgba(0, 0, 0, .06));
    }

    .no--preparado {
      background: color-mix(in srgb, #1976d2 14%, transparent);
    }

    .no--trocado {
      background: color-mix(in srgb, #2e7d32 16%, transparent);
    }

    .terminal {
      height: min(56vh, 560px);
      padding: 10px 12px;
      overflow: auto;
      border-radius: 8px;
      background: #1e1e1e;
      color: #d4d4d4;
      font-family: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: .78rem;
      line-height: 1.45;
    }

    .linha {
      display: flex;
      gap: 6px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .hora {
      flex-shrink: 0;
      color: #6a6a6a;
    }

    .no-linha {
      flex-shrink: 0;
      color: #569cd6;
    }

    .prefixo {
      flex-shrink: 0;
    }

    .linha[data-tipo='FASE'] {
      margin-top: 6px;
      color: #dcdcaa;
      font-weight: 600;
    }

    .linha[data-tipo='COMANDO'] .texto,
    .linha[data-tipo='COMANDO'] .prefixo {
      color: #ffffff;
    }

    .linha[data-tipo='SAIDA'] {
      color: #9e9e9e;
    }

    .linha[data-tipo='ERRO'] {
      color: #f48771;
    }

    .linha[data-tipo='OK'] .texto,
    .linha[data-tipo='OK'] .prefixo {
      color: #89d185;
    }

    .linha[data-tipo='FALHA'] .texto,
    .linha[data-tipo='FALHA'] .prefixo {
      color: #f14c4c;
      font-weight: 600;
    }

    .mensagem {
      margin: 0;
      padding: 8px 12px;
      border-left: 4px solid #2e7d32;
      border-radius: 6px;
      background: color-mix(in srgb, #2e7d32 8%, transparent);
      font-size: .86rem;
    }

    .mensagem[data-situacao='FALHA'],
    .mensagem[data-situacao='INTERROMPIDA'] {
      border-left-color: #d32f2f;
      background: color-mix(in srgb, #d32f2f 8%, transparent);
    }

    .mensagem[data-situacao='AGUARDANDO_REINICIO'] {
      border-left-color: #ed6c02;
      background: color-mix(in srgb, #ed6c02 8%, transparent);
    }

    .abandonada {
      display: flex;
      gap: 10px;
      padding: 10px 12px;
      border: 1px solid #d32f2f;
      border-left-width: 4px;
      border-radius: 8px;
      background: color-mix(in srgb, #d32f2f 8%, transparent);
      font-size: .86rem;

      > mat-icon {
        flex-shrink: 0;
        color: #d32f2f;
      }

      div {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
    }

    .perigo {
      --mat-button-filled-container-color: #d32f2f;
      --mdc-filled-button-container-color: #d32f2f;
    }

    .situacao[data-situacao='RESTAURADA'] {
      background: color-mix(in srgb, #1976d2 16%, transparent);
      color: #1565c0;
    }

    .reinicio {
      display: flex;
      gap: 10px;
      padding: 10px 12px;
      border: 1px solid #ed6c02;
      border-radius: 8px;
      font-size: .86rem;

      > mat-icon {
        flex-shrink: 0;
        color: #ed6c02;
      }

      div {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsoleDialogComponent implements AfterViewChecked {
  readonly data = inject<ConsoleDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ConsoleDialogComponent, boolean>>(MatDialogRef);
  private readonly service = inject(AtualizacaoService);
  private readonly terminal = viewChild<ElementRef<HTMLDivElement>>('terminal');

  readonly rotulo = SITUACAO_ROTULO;
  readonly execucao = signal<ExecucaoAutomatica>(this.data.execucao);
  readonly linhas = signal<LinhaConsole[]>([]);
  readonly interrompendo = signal(false);
  readonly confirmando = signal(false);
  readonly restaurando = signal(false);
  readonly nomesDosNos = computed(() => this.execucao().nos.map(n => n.nome).join(', '));
  reiniciou = false;

  /** Algo mudou na atualização (backup, aplicação, evento): o detalhe recarrega ao fechar. */
  private mudou = false;
  /** Rola sozinho para o fim, a menos que o usuário tenha subido para ler. */
  private seguirFim = true;
  private novasLinhas = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private ativo = true;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.ativo = false;
      if (this.timer) {
        clearTimeout(this.timer);
      }
    });
    this.buscar();
  }

  ngAfterViewChecked() {
    const terminal = this.terminal()?.nativeElement;
    if (terminal && this.novasLinhas && this.seguirFim) {
      terminal.scrollTop = terminal.scrollHeight;
    }
    this.novasLinhas = false;
  }

  rolou() {
    const terminal = this.terminal()?.nativeElement;
    if (terminal) {
      this.seguirFim = terminal.scrollHeight - terminal.scrollTop - terminal.clientHeight < 40;
    }
  }

  prefixo(linha: LinhaConsole) {
    switch (linha.tipo) {
      case 'COMANDO':
        return '$';
      case 'OK':
        return '✓';
      case 'FALHA':
        return '✗';
      case 'ERRO':
        return '!';
      case 'FASE':
        return '==';
      default:
        return '';
    }
  }

  interromper() {
    this.interrompendo.set(true);
    this.service.interromperExecucao(this.data.codAtualizacao, this.execucao().id).subscribe({ error: () => this.interrompendo.set(false) });
  }

  confirmarReinicio() {
    this.confirmando.set(true);
    this.service.confirmarReinicio(this.data.codAtualizacao, this.execucao().id).subscribe({
      next: execucao => {
        this.mudou = true;
        this.execucao.set(execucao);
        this.confirmando.set(false);
        this.buscar();
      },
      error: () => this.confirmando.set(false),
    });
  }

  restaurar() {
    this.restaurando.set(true);
    this.service.restaurarExecucao(this.data.codAtualizacao, this.execucao().id).subscribe({
      next: execucao => {
        this.mudou = true;
        this.execucao.set(execucao);
        this.restaurando.set(false);
        if (this.timer) {
          clearTimeout(this.timer);
        }
        this.buscar();
      },
      error: () => this.restaurando.set(false),
    });
  }

  fechar() {
    this.dialogRef.close(this.mudou || this.execucao().situacao !== 'EM_ANDAMENTO');
  }

  private buscar() {
    const desde = this.linhas().at(-1)?.seq ?? 0;
    this.service.console(this.data.codAtualizacao, this.execucao().id, desde).subscribe({
      next: resposta => {
        if (resposta.linhas.length) {
          this.linhas.update(atuais => [...atuais, ...resposta.linhas]);
          this.novasLinhas = true;
        }
        if (resposta.execucao.situacao !== this.execucao().situacao) {
          this.mudou = true;
        }
        this.execucao.set(resposta.execucao);
        // Abandonada não anda mais: só confere de vez em quando (outro nó pode ter restaurado).
        const rodando = resposta.execucao.situacao === 'EM_ANDAMENTO';
        this.agendar(rodando ? (resposta.execucao.abandonada ? 5000 : 1000) : 0);
      },
      error: () => this.agendar(3000),
    });
  }

  private agendar(ms: number) {
    if (this.ativo && ms > 0) {
      this.timer = setTimeout(() => this.buscar(), ms);
    }
  }
}
