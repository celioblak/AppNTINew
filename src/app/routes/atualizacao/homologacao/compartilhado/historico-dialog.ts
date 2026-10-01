import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';

import { MotivoDialogComponent, MotivoDialogData } from '../../compartilhado/motivo-dialog';
import { EtiquetaComponent } from '../../compartilhado/situacao-chip';
import { ArquivoHom, HistoricoItem, HomologacaoDetalhe, ItemHom, RESULTADO_INFO, ResultadoHom } from '../homologacao.models';
import { HomologacaoService } from '../homologacao.service';

export interface HistoricoDialogData {
  item: ItemHom;
}

/** Histórico do item: todos os registros (distribuição e gerais), evidências, ticket e trocas de impeditivo. */
@Component({
  selector: 'app-hom-historico-dialog',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTooltipModule,
    EtiquetaComponent,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.item.titulo }}</h2>
    <mat-dialog-content class="conteudo">
      @if (data.item.passos) {
        <p class="rotulo">Como testar</p>
        <p class="texto">{{ data.item.passos }}</p>
      }
      @if (data.item.resultadoEsperado) {
        <p class="rotulo">Resultado esperado</p>
        <p class="texto">{{ data.item.resultadoEsperado }}</p>
      }
      @if (data.item.foraEscopo) {
        <p class="aviso">Fora do escopo: {{ data.item.motivoForaEscopo }}</p>
      }
      <p class="rotulo">Registros (o mais novo primeiro)</p>
      @if (carregando()) {
        <mat-progress-bar mode="indeterminate" />
      }
      @for (r of historico()?.resultados ?? []; track r.codResultado) {
        <article class="registro" [class.registro--antigo]="!r.vigente">
          <header>
            <app-etiqueta [tom]="info[r.resultado].tom">{{ info[r.resultado].rotulo }}</app-etiqueta>
            @if (r.resultado === 'REPROVADO' && r.impeditivo) {
              <app-etiqueta tom="critico">impeditivo</app-etiqueta>
            }
            <span class="trilha">{{ r.trilha === 'GERAL' ? 'Geral de ' + r.nomeTrilha : 'Distribuição' }}</span>
            @if (r.vigente) {
              <span class="vigente">vale</span>
            }
            <span class="espaco"></span>
            <span class="suave">{{ r.nomeUsuario }} · {{ r.data | date: 'dd/MM/yy HH:mm' }}</span>
          </header>
          @if (r.observacao) {
            <p class="texto">{{ r.observacao }}</p>
          }
          @if (r.entrega) {
            <p class="suave">Entrega vigente: {{ r.entrega }}</p>
          }
          @if (r.resultado === 'REPROVADO' || r.resultado === 'BLOQUEADO') {
            <div class="ticket">
              @if (editando() === r.codResultado) {
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Ticket do fabricante</mat-label>
                  <input matInput maxlength="100" [(ngModel)]="ticket" />
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="glpi">
                  <mat-label>GLPI</mat-label>
                  <input matInput type="number" [(ngModel)]="glpi" />
                </mat-form-field>
                <button mat-flat-button type="button" (click)="salvarTicket(r)">Salvar</button>
                <button mat-button type="button" (click)="editando.set(null)">Voltar</button>
              } @else {
                @if (r.ticketFabricante) {
                  <span>Ticket do fabricante: <strong>{{ r.ticketFabricante }}</strong></span>
                } @else if (r.resultado === 'REPROVADO') {
                  <span class="alerta"><mat-icon inline>warning</mat-icon> Sem ticket no fabricante</span>
                }
                @if (r.chamadoGlpi) {
                  <span>GLPI {{ r.chamadoGlpi }}</span>
                }
                @if (r.podeInformarTicket) {
                  <button mat-button type="button" (click)="editarTicket(r)"><mat-icon>edit</mat-icon> Informar ticket</button>
                }
              }
            </div>
          }
          @if (r.podeTrocarImpeditivo) {
            <button mat-button type="button" (click)="trocarImpeditivo(r)">
              <mat-icon>swap_horiz</mat-icon> {{ r.impeditivo ? 'Deixar de ser impeditivo' : 'Marcar como impeditivo' }}
            </button>
          }
          @for (t of r.trocasImpeditivo; track $index) {
            <p class="suave">{{ t.nomeUsuario }} {{ t.depois ? 'marcou como impeditivo' : 'tirou a marca de impeditivo' }} em {{ t.data | date: 'dd/MM HH:mm' }}: {{ t.motivo }}</p>
          }
          @if (r.evidencias.length) {
            <div class="evidencias">
              @for (a of r.evidencias; track a.codArquivo) {
                <button mat-stroked-button type="button" (click)="abrir(a)" [matTooltip]="'Enviado por ' + a.nomeEnvio">
                  <mat-icon>{{ a.contentType?.startsWith('image/') ? 'image' : 'attach_file' }}</mat-icon>{{ a.nome }}
                </button>
              }
            </div>
          }
        </article>
      } @empty {
        @if (!carregando()) {
          <p class="suave">Nenhum registro ainda.</p>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="fechar()">Fechar</button>
    </mat-dialog-actions>
  `,
  styles: `
    .conteudo {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: min(720px, 90vw);
    }

    .rotulo {
      margin: 6px 0 0;
      font-size: .72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .03em;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
    }

    .texto {
      margin: 0;
      white-space: pre-wrap;
      font-size: .85rem;
    }

    .aviso {
      margin: 0;
      padding: 6px 10px;
      border-radius: 8px;
      font-size: .8rem;
      background: color-mix(in srgb, #e08a00 14%, transparent);
    }

    .registro {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px 12px;
      border: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, .12));
      border-radius: 10px;

      &--antigo {
        opacity: .72;
      }

      header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
      }
    }

    .trilha {
      font-size: .78rem;
      font-weight: 500;
    }

    .vigente {
      padding: 0 6px;
      border-radius: 4px;
      font-size: .7rem;
      background: color-mix(in srgb, #1976d2 16%, transparent);
    }

    .espaco {
      flex: 1;
    }

    .suave {
      margin: 0;
      font-size: .76rem;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
    }

    .ticket {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      font-size: .82rem;
    }

    .glpi {
      width: 120px;
    }

    .alerta {
      color: #b26a00;
    }

    .evidencias {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoricoDialogComponent implements OnInit {
  readonly data = inject<HistoricoDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<HistoricoDialogComponent, HomologacaoDetalhe | undefined>>(MatDialogRef);
  private readonly dialog = inject(MatDialog);
  private readonly service = inject(HomologacaoService);

  readonly info = RESULTADO_INFO;
  readonly historico = signal<HistoricoItem | null>(null);
  readonly carregando = signal(true);
  readonly editando = signal<number | null>(null);
  ticket = '';
  glpi: number | null = null;
  /** Detalhe devolvido pela última alteração, para a tela recarregar ao fechar. */
  private atualizado: HomologacaoDetalhe | undefined;

  ngOnInit() {
    this.carregar();
  }

  private carregar() {
    this.carregando.set(true);
    this.service
      .historico(this.data.item.codItem)
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({ next: h => this.historico.set(h), error: () => {} });
  }

  editarTicket(r: ResultadoHom) {
    this.ticket = r.ticketFabricante ?? '';
    this.glpi = r.chamadoGlpi;
    this.editando.set(r.codResultado);
  }

  salvarTicket(r: ResultadoHom) {
    this.service.informarTicket(r.codResultado, this.ticket.trim() || null, this.glpi || null).subscribe({
      next: detalhe => {
        this.atualizado = detalhe;
        this.editando.set(null);
        this.carregar();
      },
      error: () => {},
    });
  }

  trocarImpeditivo(r: ResultadoHom) {
    this.dialog
      .open<MotivoDialogComponent, MotivoDialogData, string>(MotivoDialogComponent, {
        data: {
          titulo: r.impeditivo ? 'Deixar de ser impeditivo' : 'Marcar como impeditivo',
          descricao: 'O parecer do sistema é recalculado na hora. A troca fica registrada (R-18).',
          rotulo: 'Motivo (ex.: o fabricante combinou corrigir depois da implantação)',
          botao: 'Confirmar',
        },
      })
      .afterClosed()
      .subscribe(motivo => {
        if (!motivo) return;
        this.service.trocarImpeditivo(r.codResultado, !r.impeditivo, motivo).subscribe({
          next: detalhe => {
            this.atualizado = detalhe;
            this.carregar();
          },
          error: () => {},
        });
      });
  }

  /** Imagem e PDF abrem numa aba; o resto é baixado. O hash é conferido no servidor. */
  abrir(arquivo: ArquivoHom) {
    this.service.baixar(arquivo.codArquivo).subscribe({
      next: blob => {
        const url = URL.createObjectURL(new Blob([blob], { type: arquivo.contentType || blob.type }));
        const tipo = arquivo.contentType ?? '';
        if (tipo.startsWith('image/') || tipo === 'application/pdf' || tipo.startsWith('video/')) {
          window.open(url, '_blank');
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } else {
          const link = document.createElement('a');
          link.href = url;
          link.download = arquivo.nome;
          link.click();
          URL.revokeObjectURL(url);
        }
      },
      error: () => {},
    });
  }

  fechar() {
    this.dialogRef.close(this.atualizado);
  }
}
