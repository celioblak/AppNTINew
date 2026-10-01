import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { HotToastService } from '@ngxpert/hot-toast';
import { finalize } from 'rxjs';

import { AtualizacaoDetalhe, SITUACAO_INFO, hashCurto } from '../atualizacao.models';
import { AtualizacaoService } from '../atualizacao.service';
import { JanelaDialogComponent, JanelaDialogData } from '../compartilhado/janela-dialog';
import { EtiquetaComponent, SituacaoChipComponent } from '../compartilhado/situacao-chip';

/** Atualizações > Aprovação para produção (T-05): o que o aprovador precisa ver para liberar a janela. */
@Component({
  selector: 'app-atualizacoes-aprovacao',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatProgressBarModule, MatTooltipModule, EtiquetaComponent, SituacaoChipComponent],
  template: `
    <div class="pagina">
      <div class="barra">
        <span class="suave">Aguardando aprovação primeiro; depois as aprovadas e parciais, pela janela.</span>
        <span class="espaco"></span>
        <button mat-stroked-button type="button" (click)="carregar()"><mat-icon>refresh</mat-icon> Atualizar</button>
      </div>
      @if (carregando()) {
        <mat-progress-bar mode="indeterminate" />
      }

      @for (d of ordenadas(); track d.codAtualizacao) {
        <section class="secao cartao" [class.cartao--pendente]="d.situacao === 'AGUARDANDO_APROVACAO'">
          <h2 class="secao__titulo">
            <span class="mono">{{ d.numero }}</span>
            <app-situacao-atualizacao [situacao]="d.situacao" />
            @if (d.emergencial) {
              <app-etiqueta tom="critico">Emergencial</app-etiqueta>
            }
            <span class="espaco"></span>
            <span>Janela: <strong>{{ d.janela ? (d.janela | date: 'dd/MM/yyyy HH:mm') : '—' }}</strong></span>
          </h2>
          <p class="titulo">{{ d.titulo }}</p>

          <div class="colunas">
            <dl class="dl">
              <dt>Sistema</dt>
              <dd>{{ d.sistema ?? '—' }}</dd>
              <dt>Motivo</dt>
              <dd>{{ d.ticketMv ? 'Ticket MV ' + d.ticketMv + (d.tituloTicketMv ? ': ' + d.tituloTicketMv : '') : '' }}{{ d.motivo ? (d.ticketMv ? '\n' : '') + d.motivo : '' }}</dd>
              <dt>Responsável</dt>
              <dd>{{ d.nomeResponsavel }}</dd>
              @if (d.emergencial) {
                <dt>Justificativa</dt>
                <dd class="falha">{{ d.justificativaEmergencial }}</dd>
              }
              <dt>Validação</dt>
              <dd>
                @if (validacaoAtiva(d); as v) {
                  <span [class.ok]="v.resultado === 'APROVADA'" [class.falha]="v.resultado === 'REPROVADA'">
                    {{ v.resultado === 'APROVADA' ? 'Aprovada' : 'Reprovada' }}
                  </span>
                  por {{ v.nomeUsuario }} em {{ v.data | date: 'dd/MM/yyyy HH:mm' }}
                } @else {
                  <span class="pendente">Sem validação{{ d.emergencial ? ' (emergencial: homologação fica pendente)' : '' }}</span>
                }
              </dd>
              <dt>Reprovações anteriores</dt>
              <dd>{{ reprovacoes(d) }}</dd>
              @if (d.nomeAprovador) {
                <dt>Aprovada por</dt>
                <dd>{{ d.nomeAprovador }} em {{ d.dataAprovacao | date: 'dd/MM/yyyy HH:mm' }}</dd>
              }
            </dl>

            <div class="rolagem">
              <table class="tabela">
                <thead>
                  <tr>
                    <th>Artefato</th>
                    <th>Destino de produção</th>
                    <th>Reinício</th>
                    <th>Backup de produção</th>
                  </tr>
                </thead>
                <tbody>
                  @for (a of d.artefatos; track a.codArtefato) {
                    @for (alvo of a.producao; track alvo.chave; let primeiro = $first) {
                      <tr>
                        <td>
                          @if (primeiro) {
                            <div class="celula">
                              <span class="mono">{{ a.nome }}</span>
                              <span class="suave">v{{ a.versaoVigente?.numero }} · <code>{{ hash(a.versaoVigente?.arquivo?.sha256) }}…</code></span>
                            </div>
                          }
                        </td>
                        <td>{{ alvo.alvo }}</td>
                        <td>{{ alvo.exigeReinicio ? 'Sim' : alvo.exigeReinicio === false ? 'Não' : '—' }}</td>
                        <td>
                          @if (alvo.backup; as b) {
                            <div class="celula">
                              <span class="ok">{{ b.data | date: 'dd/MM/yy HH:mm' }}</span>
                              <code>{{ b.semArquivo ? 'sem arquivo anterior' : hash(b.arquivo?.sha256) + '…' }}</code>
                            </div>
                          } @else {
                            <span [class.pendente]="!d.emergencial" [class.suave]="d.emergencial">
                              {{ d.emergencial ? 'Na janela' : 'Pendente' }}
                            </span>
                          }
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>
          </div>

          @if (d.conflitos.length) {
            <p class="aviso">
              Outras atualizações nos mesmos destinos:
              @for (c of d.conflitos; track c.codAtualizacao; let ultimo = $last) {
                {{ c.numero }}{{ c.janela ? ' (' + (c.janela | date: 'dd/MM HH:mm') + ')' : '' }}{{ ultimo ? '' : ', ' }}
              }
            </p>
          }
          @if (d.choques.length) {
            <ul class="choques">
              @for (c of d.choques; track $index) {
                <li [class.falha]="c.gravidade === 'CRITICO'" [class.pendente]="c.gravidade === 'ALERTA'">
                  {{ c.mensagem }} <span class="suave">· {{ situacaoInfo[c.situacao].rotulo }}{{ c.responsavel ? ' · ' + c.responsavel : '' }}</span>
                </li>
              }
            </ul>
          }

          <div class="barra">
            <button mat-button type="button" (click)="abrir(d)"><mat-icon>open_in_new</mat-icon> Abrir detalhe</button>
            <span class="espaco"></span>
            @if (d.acoes.aprovar) {
              <button mat-stroked-button type="button" (click)="decidir(d, 'recusar')">Recusar</button>
              <button mat-flat-button type="button" (click)="decidir(d, 'aprovar')"><mat-icon>verified_user</mat-icon> Aprovar</button>
            }
          </div>
        </section>
      } @empty {
        @if (!carregando()) {
          <p class="vazio">Nenhuma atualização aguardando aprovação ou a caminho da produção.</p>
        }
      }
    </div>
  `,
  styleUrls: ['../compartilhado/atualizacao-pagina.scss'],
  styles: `
    .cartao {
      gap: 10px;
    }

    .choques {
      margin: 0;
      padding-left: 18px;
      font-size: .82rem;
    }

    .cartao--pendente {
      border-left: 3px solid #e08a00;
    }

    .titulo {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 500;
    }

    .colunas {
      display: grid;
      grid-template-columns: minmax(260px, 2fr) minmax(0, 3fr);
      gap: 16px;
    }

    @media (max-width: 900px) {
      .colunas {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AtualizacoesAprovacaoComponent implements OnInit {
  private readonly service = inject(AtualizacaoService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly toast = inject(HotToastService);

  readonly hash = hashCurto;
  readonly situacaoInfo = SITUACAO_INFO;
  readonly lista = signal<AtualizacaoDetalhe[]>([]);
  readonly carregando = signal(true);

  readonly ordenadas = computed(() =>
    [...this.lista()].sort((a, b) => {
      const pendenteA = a.situacao === 'AGUARDANDO_APROVACAO' ? 0 : 1;
      const pendenteB = b.situacao === 'AGUARDANDO_APROVACAO' ? 0 : 1;
      return pendenteA - pendenteB || (a.janela ?? '').localeCompare(b.janela ?? '');
    })
  );

  ngOnInit() {
    this.carregar();
  }

  carregar() {
    this.carregando.set(true);
    this.service
      .aprovacoes()
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({ next: lista => this.lista.set(lista), error: () => this.lista.set([]) });
  }

  validacaoAtiva(d: AtualizacaoDetalhe) {
    return d.validacoes.find(v => v.ativa) ?? null;
  }

  reprovacoes(d: AtualizacaoDetalhe) {
    return d.validacoes.filter(v => v.resultado === 'REPROVADA').length;
  }

  abrir(d: AtualizacaoDetalhe) {
    this.router.navigate(['/atualizacao/atualizacoes-detalhe'], { queryParams: { id: d.codAtualizacao } });
  }

  decidir(d: AtualizacaoDetalhe, modo: 'aprovar' | 'recusar') {
    this.dialog
      .open<JanelaDialogComponent, JanelaDialogData, AtualizacaoDetalhe>(JanelaDialogComponent, { maxWidth: '95vw', data: { modo, detalhe: d } })
      .afterClosed()
      .subscribe(atualizada => {
        if (atualizada) {
          this.toast.success(modo === 'aprovar' ? `${atualizada.numero} aprovada.` : `${atualizada.numero} recusada.`);
          this.carregar();
        }
      });
  }
}
