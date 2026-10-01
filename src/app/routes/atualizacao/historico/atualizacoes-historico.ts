import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { AMBIENTE_ROTULO, Arquivo, Catalogo, Historico, MOMENTO_ROTULO, MomentoBackup, SistemaAmbiente, hashCurto } from '../atualizacao.models';
import { AtualizacaoService, salvarDownload } from '../atualizacao.service';
import { AplicacaoBuscaComponent } from '../compartilhado/aplicacao-busca';
import { EtiquetaComponent } from '../compartilhado/situacao-chip';

type TipoDestino = 'APLICACAO' | 'SISTEMA' | 'BANCO';

/** Atualizações > Histórico por destino (T-07): o que mudou nesta aplicação, sistema/ambiente ou banco. */
@Component({
  selector: 'app-atualizacoes-historico',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTooltipModule,
    AplicacaoBuscaComponent,
    EtiquetaComponent,
  ],
  template: `
    <div class="pagina">
      <form class="secao filtro" (ngSubmit)="consultar()">
        <mat-button-toggle-group name="tipo" [(ngModel)]="tipo" hideSingleSelectionIndicator aria-label="Tipo de destino">
          <mat-button-toggle value="APLICACAO">Aplicação</mat-button-toggle>
          <mat-button-toggle value="SISTEMA">Sistema</mat-button-toggle>
          <mat-button-toggle value="BANCO">Banco / schema</mat-button-toggle>
        </mat-button-toggle-group>

        <div class="filtro__campo">
          @if (tipo === 'APLICACAO') {
            <app-aplicacao-busca [aplicacoes]="catalogo()?.aplicacoes ?? []" [(codProcesso)]="codProcesso" />
          } @else if (tipo === 'SISTEMA') {
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Sistema e ambiente</mat-label>
              <mat-select name="sistema" [(ngModel)]="configuracao">
                @for (a of ambientes(); track a.codSistemaAmbiente) {
                  <mat-option [value]="a">{{ a.sistema }} · {{ ambienteRotulo[a.ambiente] }}</mat-option>
                } @empty {
                  <mat-option disabled>Nenhum sistema configurado por ambiente</mat-option>
                }
              </mat-select>
            </mat-form-field>
          } @else {
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Banco / schema</mat-label>
              <input matInput name="banco" [(ngModel)]="banco" placeholder="Como configurado no sistema, ex.: DBAMV" autocomplete="off" />
            </mat-form-field>
          }
        </div>

        <button mat-flat-button type="submit" [disabled]="!podeConsultar() || carregando()"><mat-icon>history</mat-icon> Consultar</button>
      </form>

      @if (carregando()) {
        <mat-progress-bar mode="indeterminate" />
      }

      @if (historico(); as h) {
        <h2 class="destino">{{ h.destino }}</h2>

        @if (h.comparacao; as g) {
          <section class="secao">
            <h3 class="secao__titulo">Versão em cada processo do sistema</h3>
            @if (g.linhas.length) {
              <div class="rolagem">
                <table class="tabela">
                  <thead>
                    <tr>
                      <th>Artefato</th>
                      @for (nome of g.aplicacoes; track $index) {
                        <th>{{ nome }}</th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (l of g.linhas; track l.artefato) {
                      <tr [class.divergente]="l.divergente">
                        <td>
                          <div class="celula">
                            <span class="mono">{{ l.artefato }}</span>
                            @if (l.divergente) {
                              <app-etiqueta tom="alerta">Divergente</app-etiqueta>
                            }
                          </div>
                        </td>
                        @for (c of l.celulas; track $index) {
                          <td>
                            @if (c.numero) {
                              <div class="celula">
                                <span>{{ c.numero }} · v{{ c.numeroVersao }}</span>
                                <code [matTooltip]="c.sha256 ?? ''">{{ hash(c.sha256) }}…</code>
                                <span class="suave">{{ c.data | date: 'dd/MM/yy HH:mm' }}</span>
                              </div>
                            } @else {
                              <span class="falha">Sem registro</span>
                            }
                          </td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <p class="vazio">Nenhuma aplicação com sucesso registrada nos processos do sistema.</p>
            }
          </section>
        }

        <section class="secao">
          <h3 class="secao__titulo">Aplicações e backups <span class="suave">{{ h.itens.length }}</span></h3>
          @if (h.itens.length) {
            <div class="rolagem">
              <table class="tabela">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Registro</th>
                    <th>Atualização</th>
                    <th>Artefato</th>
                    <th>SHA-256</th>
                    <th>Ambiente</th>
                    <th>{{ h.comparacao ? 'Processo' : 'Destino' }}</th>
                    <th>Quem</th>
                    <th class="acoes"></th>
                  </tr>
                </thead>
                <tbody>
                  @for (i of h.itens; track $index) {
                    <tr>
                      <td>{{ i.data | date: 'dd/MM/yy HH:mm' }}</td>
                      <td>
                        @if (i.tipo === 'APLICACAO') {
                          <span [class.ok]="i.detalhe === 'SUCESSO'" [class.falha]="i.detalhe === 'FALHA'">
                            Aplicação · {{ i.detalhe === 'SUCESSO' ? 'sucesso' : 'falha' }}
                          </span>
                        } @else {
                          <span>Backup · {{ momento(i.detalhe) }}</span>
                        }
                      </td>
                      <td>
                        <div class="celula">
                          <button type="button" class="link mono" (click)="abrir(i.codAtualizacao)">{{ i.numero }}</button>
                          <span class="suave motivo" [matTooltip]="i.motivo ?? ''">{{ i.titulo }}</span>
                          @if (i.ticketMv) {
                            <span class="suave">Ticket MV {{ i.ticketMv }}</span>
                          }
                        </div>
                      </td>
                      <td>{{ i.artefato }} v{{ i.numeroVersao }}</td>
                      <td><code [matTooltip]="i.sha256 ?? ''">{{ i.sha256 ? hash(i.sha256) + '…' : '—' }}</code></td>
                      <td>{{ ambienteRotulo[i.ambiente] }}</td>
                      <td>{{ i.alvo }}</td>
                      <td>{{ i.nomeUsuario }}</td>
                      <td class="acoes">
                        @if (i.arquivo) {
                          <button
                            mat-icon-button
                            type="button"
                            (click)="baixar(i.arquivo)"
                            [matTooltip]="i.tipo === 'BACKUP' ? 'Baixar backup' : 'Baixar o arquivo aplicado'"
                            aria-label="Baixar">
                            <mat-icon>file_download</mat-icon>
                          </button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="vazio">Nada registrado para este destino.</p>
          }
        </section>
      }
    </div>
  `,
  styleUrls: ['../compartilhado/atualizacao-pagina.scss'],
  styles: `
    .filtro {
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }

    .filtro__campo {
      flex: 1 1 320px;

      mat-form-field {
        width: 100%;
      }
    }

    .destino {
      margin: 4px 0 0;
      font-size: 1.1rem;
      font-weight: 600;
    }

    .motivo {
      max-width: 280px;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    tr.divergente td {
      background: color-mix(in srgb, #e08a00 8%, transparent);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AtualizacoesHistoricoComponent implements OnInit {
  private readonly service = inject(AtualizacaoService);
  private readonly router = inject(Router);

  readonly ambienteRotulo = AMBIENTE_ROTULO;
  readonly hash = hashCurto;
  readonly catalogo = signal<Catalogo | null>(null);
  readonly historico = signal<Historico | null>(null);
  readonly carregando = signal(false);
  readonly ambientes = computed(() =>
    [...(this.catalogo()?.ambientes ?? [])].sort((a, b) => (a.sistema ?? '').localeCompare(b.sistema ?? '') || a.ambiente.localeCompare(b.ambiente))
  );

  tipo: TipoDestino = 'APLICACAO';
  readonly codProcesso = signal<number | null>(null);
  configuracao: SistemaAmbiente | null = null;
  banco = '';

  ngOnInit() {
    this.service.catalogo().subscribe({ next: c => this.catalogo.set(c), error: () => {} });
  }

  podeConsultar() {
    return this.tipo === 'APLICACAO' ? !!this.codProcesso() : this.tipo === 'SISTEMA' ? !!this.configuracao : !!this.banco.trim();
  }

  consultar() {
    this.carregando.set(true);
    const sistema = this.tipo === 'SISTEMA' ? this.configuracao : null;
    this.service
      .historico({
        codProcesso: this.tipo === 'APLICACAO' ? this.codProcesso() : null,
        codSistema: sistema?.codSistema ?? null,
        ambiente: sistema?.ambiente ?? null,
        banco: this.tipo === 'BANCO' ? this.banco.trim() : null,
      })
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({ next: h => this.historico.set(h), error: () => this.historico.set(null) });
  }

  momento(detalhe: string) {
    return MOMENTO_ROTULO[detalhe as MomentoBackup] ?? detalhe;
  }

  abrir(codAtualizacao: number) {
    this.router.navigate(['/atualizacao/atualizacoes-detalhe'], { queryParams: { id: codAtualizacao } });
  }

  baixar(arquivo: Arquivo) {
    this.service.baixar(arquivo.codArquivo).subscribe({ next: r => salvarDownload(r, arquivo.nome), error: () => {} });
  }
}
