import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { EtiquetaComponent } from '../../compartilhado/situacao-chip';
import { BarraHomologacaoComponent } from '../compartilhado/barra-homologacao';
import {
  DivergenciaHom,
  HomologacaoDetalhe,
  ItemHom,
  PARECER_INFO,
  ParticipanteHom,
  RESULTADO_INFO,
  porModulo,
} from '../homologacao.models';

const DIA = 86_400_000;

/**
 * Acompanhamento (T-04): progresso coletivo com ritmo, ranking de quem testa mais e de quem não testa,
 * pendências, reprovados (base para cobrar o fabricante) e divergências.
 */
@Component({
  selector: 'app-hom-acompanhamento',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatTooltipModule, EtiquetaComponent, BarraHomologacaoComponent],
  template: `
    @let h = homologacao();
    <section class="secao">
      <h3 class="secao__titulo">
        Progresso coletivo
        <span class="suave">{{ h.contagem.concluidos }} de {{ h.contagem.total }} itens · esperado hoje {{ h.ritmoEsperado }}%</span>
      </h3>
      <app-barra-homologacao [contagem]="h.contagem" [ritmo]="h.situacao === 'EM_ANDAMENTO' ? h.ritmoEsperado : null" [altura]="14" [legenda]="true" />
      @for (s of h.sistemas; track s.codHomologacaoSistema) {
        <div class="sistema">
          <div class="sistema__cab">
            <strong>{{ s.nome }}</strong>
            <span class="suave">{{ s.versaoAtual ? s.versaoAtual + ' → ' : '' }}{{ s.versaoNova || 'sem versão no ambiente' }}</span>
            @if (s.parecer) {
              <app-etiqueta [tom]="parecer[s.parecer].tom">{{ parecer[s.parecer].rotulo }}</app-etiqueta>
            } @else if (s.parecerPrevisto) {
              <app-etiqueta [tom]="parecer[s.parecerPrevisto].tom">previsto: {{ parecer[s.parecerPrevisto].rotulo }}</app-etiqueta>
            }
            @if (s.falta) {
              <span class="suave">{{ s.falta }}</span>
            }
          </div>
          <app-barra-homologacao [contagem]="s.contagem" />
          @if (s.trabalhaModulo) {
            <!-- D-13/D-14: barra por módulo; o previsto do módulo é só informativo -->
            @for (m of s.modulos; track m.codModulo) {
              <div class="modulo">
                <span class="modulo__nome">
                  <strong>{{ m.nome }}</strong>
                  @if (m.parecerPrevisto && !s.parecer) {
                    <app-etiqueta [tom]="parecer[m.parecerPrevisto].tom" matTooltip="Só informativo: o parecer que vale é o do sistema">
                      {{ parecer[m.parecerPrevisto].rotulo }}
                    </app-etiqueta>
                  }
                </span>
                <app-barra-homologacao [contagem]="m.contagem" [altura]="8" />
              </div>
              <div class="agrupamentos agrupamentos--modulo">
                @for (a of agrupamentosDoModulo(s.codHomologacaoSistema, m.codModulo); track a.codAgrupamento) {
                  <span class="ag">{{ a.nome }}</span>
                  <app-barra-homologacao [contagem]="a.contagem" [altura]="6" />
                }
              </div>
            }
          } @else {
            <div class="agrupamentos">
              @for (a of agrupamentosDe(s.codHomologacaoSistema); track a.codAgrupamento) {
                <span class="ag">{{ a.nome }}</span>
                <app-barra-homologacao [contagem]="a.contagem" [altura]="6" />
              }
            </div>
          }
        </div>
      }
    </section>

    <section class="secao">
      <h3 class="secao__titulo">
        Por participante
        <span class="suave">quem está testando, quem testa mais e quem parou</span>
      </h3>
      <div class="rolagem">
        <table class="tabela ranking">
          <thead>
            <tr>
              <th>Participante</th>
              <th>Itens testados <span class="suave">(distribuição + geral)</span></th>
              <th matTooltip="Parte do que foi testado na distribuição que saiu desta pessoa">Participação</th>
              <th matTooltip="Concluídos ÷ itens com a pessoa (reservados ou atribuídos)">Do que pegou</th>
              <th>Última atividade</th>
              @if (h.eu.gestao) {
                <th></th>
              }
            </tr>
          </thead>
          <tbody>
            @for (p of ativos(); track p.codUsuario) {
              <tr>
                <td>
                  {{ p.nome }}
                  @if (!p.temAcesso) {
                    <app-etiqueta tom="alerta" matTooltip="Perdeu o acesso à tela Homologação: não recebe novas atribuições">sem acesso</app-etiqueta>
                  }
                  @if (p.geral && !p.geralDesistiu) {
                    <app-etiqueta tom="info">geral</app-etiqueta>
                  }
                </td>
                <td class="barra-celula">
                  <span class="barra-simples"><span [style.width.%]="(p.testadosDistribuicao + p.testadosGeral) * 100 / maxTestados()"></span></span>
                  <strong>{{ p.testadosDistribuicao + p.testadosGeral }}</strong>
                  <span class="suave">({{ p.testadosDistribuicao }} + {{ p.testadosGeral }})</span>
                </td>
                <td>{{ p.participacao }}%</td>
                <td>
                  {{ p.concluidosResponsabilidade }}/{{ p.sobResponsabilidade }}
                  @if (p.reprovados) {
                    <span class="suave">· {{ p.reprovados }} reprovado{{ p.reprovados > 1 ? 's' : '' }}</span>
                  }
                  @if (p.bloqueados) {
                    <span class="suave">· {{ p.bloqueados }} bloqueado{{ p.bloqueados > 1 ? 's' : '' }}</span>
                  }
                </td>
                <td [class.parado]="parado(p)">{{ p.ultimaAtividade ? (p.ultimaAtividade | date: 'dd/MM HH:mm') : '—' }}</td>
                @if (h.eu.gestao) {
                  <td>
                    @if (p.sobResponsabilidade > p.concluidosResponsabilidade && aberta()) {
                      <button mat-button type="button" (click)="removerReservasDe.emit(p)">Remover reservas</button>
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>

      <h4 class="sem-progresso">Sem progresso ({{ semProgresso().length }})</h4>
      @if (semProgresso().length) {
        <ul class="lista-sem">
          @for (p of reservaramSemTestar(); track p.codUsuario) {
            <li>
              <strong>{{ p.nome }}</strong> — reservou {{ p.sobResponsabilidade }}, testou 0
              @if (p.ultimaAtividade) {
                <span class="suave">· última atividade {{ p.ultimaAtividade | date: 'dd/MM HH:mm' }}</span>
              }
              @if (h.eu.gestao && aberta()) {
                <button mat-button type="button" (click)="removerReservasDe.emit(p)">Remover reservas</button>
              }
            </li>
          }
          @if (nemReservaram().length) {
            <li>
              <span class="suave">Não reservaram nada:</span>
              {{ nomesNemReservaram() }}
            </li>
          }
        </ul>
      } @else {
        <p class="suave">Todos já registraram algum resultado.</p>
      }
    </section>

    <section class="secao">
      <h3 class="secao__titulo">Pendências</h3>
      <ul class="pendencias">
        @for (a of agrupamentosComLivres(); track a.codAgrupamento) {
          <li>{{ a.contagem.livres }} livre{{ a.contagem.livres > 1 ? 's' : '' }} em <strong>{{ a.nome }}</strong></li>
        }
        @for (i of parados(); track i.codItem) {
          <li>
            <button mat-button type="button" class="link" (click)="abrirItem.emit(i)">{{ i.titulo }}</button>
            — com {{ i.nomeResponsavel }} desde {{ i.dataResponsavel | date: 'dd/MM' }}, sem resultado
          </li>
        }
        @for (i of bloqueados(); track i.codItem) {
          <li>
            <app-etiqueta tom="alerta">Bloqueado</app-etiqueta>
            <button mat-button type="button" class="link" (click)="abrirItem.emit(i)">{{ i.titulo }}</button>
          </li>
        }
        @if (!agrupamentosComLivres().length && !parados().length && !bloqueados().length) {
          <li class="suave">Nada parado.</li>
        }
      </ul>
    </section>

    <section class="secao">
      <h3 class="secao__titulo">
        Reprovados ({{ reprovados().length }})
        @if (h.contagem.semTicket) {
          <app-etiqueta tom="alerta">{{ h.contagem.semTicket }} sem ticket no fabricante</app-etiqueta>
        }
      </h3>
      @if (reprovados().length) {
        <div class="rolagem">
          <table class="tabela">
            <thead>
              <tr>
                <th>Item</th>
                <th>Sistema</th>
                <th>Quem</th>
                <th>Quando</th>
                <th>Ticket do fabricante</th>
                <th>Evidências</th>
              </tr>
            </thead>
            <tbody>
              @for (i of reprovados(); track i.codItem) {
                <tr>
                  <td>
                    @if (i.impeditivo) {
                      <app-etiqueta tom="critico">impeditivo</app-etiqueta>
                    }
                    <button mat-button type="button" class="link" (click)="abrirItem.emit(i)">{{ i.titulo }}</button>
                  </td>
                  <td>{{ nomeSistema(i.codHomologacaoSistema) }}</td>
                  <td>{{ i.nomeAutor }}</td>
                  <td>{{ i.dataResultado | date: 'dd/MM HH:mm' }}</td>
                  <td>
                    @if (i.ticketFabricante) {
                      {{ i.ticketFabricante }}
                    } @else {
                      <span class="alerta"><mat-icon inline>warning</mat-icon> sem ticket</span>
                    }
                  </td>
                  <td>{{ i.qtdEvidencias }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <p class="suave">Nenhum item reprovado.</p>
      }
    </section>

    <section class="secao">
      <h3 class="secao__titulo">Divergências abertas ({{ h.divergencias.length }})</h3>
      @for (d of h.divergencias; track d.codDivergencia) {
        <div class="divergencia">
          <span><strong>{{ d.item }}</strong> <span class="suave">{{ d.sistema }}</span></span>
          <span>
            Distribuição ({{ d.nomeResponsavel || '—' }}): {{ rotulo(d.resultadoDistribuicao) }}{{ d.impeditivoDistribuicao ? ' impeditivo' : '' }}
            × geral de {{ d.nomeGeral }}: {{ rotulo(d.resultadoGeral) }}{{ d.impeditivoGeral ? ' impeditivo' : '' }}
          </span>
          @if (d.podeResolver) {
            <button mat-stroked-button type="button" (click)="resolver.emit(d)">Resolver</button>
          }
        </div>
      } @empty {
        <p class="suave">Nenhuma divergência aberta.</p>
      }
    </section>

    @if (h.entregas.length) {
      <section class="secao">
        <h3 class="secao__titulo">Entregas do fabricante</h3>
        <ul class="pendencias">
          @for (e of h.entregas; track e.codEntrega) {
            <li>
              <strong>{{ e.versao }}</strong> ({{ e.sistema }}) — {{ e.data | date: 'dd/MM HH:mm' }} por {{ e.nomeUsuario }}:
              {{ e.qtdItens }} {{ e.qtdItens === 1 ? 'item voltou' : 'itens voltaram' }} para reteste.
              @if (e.observacao) {
                <span class="suave">{{ e.observacao }}</span>
              }
            </li>
          }
        </ul>
      </section>
    }
  `,
  styleUrls: ['../../compartilhado/atualizacao-pagina.scss'],
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .sistema {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-top: 10px;
      border-top: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, .1));
    }

    .sistema__cab {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .agrupamentos {
      display: grid;
      grid-template-columns: minmax(140px, 260px) 1fr;
      gap: 4px 12px;
      align-items: center;
      padding-left: 12px;
      font-size: .8rem;
    }

    .modulo {
      display: grid;
      grid-template-columns: minmax(140px, 272px) 1fr;
      gap: 12px;
      align-items: center;
      padding-left: 12px;
      margin-top: 4px;
      font-size: .85rem;
    }

    .modulo__nome {
      display: inline-flex;
      gap: 6px;
      align-items: center;
    }

    .agrupamentos--modulo {
      padding-left: 28px;
    }

    .ranking td {
      vertical-align: middle;
    }

    .barra-celula {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 240px;
    }

    .barra-simples {
      flex: 1;
      height: 8px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--mat-sys-on-surface, #000) 8%, transparent);

      span {
        display: block;
        height: 100%;
        border-radius: 999px;
        background: #1976d2;
      }
    }

    .parado {
      color: #b26a00;
    }

    .sem-progresso {
      margin: 10px 0 4px;
      font-size: .88rem;
    }

    .lista-sem,
    .pendencias {
      margin: 0;
      padding-left: 18px;
      font-size: .84rem;

      li {
        margin: 2px 0;
      }
    }

    .link {
      min-width: 0;
      padding: 0 4px;
      height: auto;
      line-height: 1.4;
    }

    .alerta {
      color: #b26a00;
    }

    .divergencia {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 14px;
      padding: 6px 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, .08));
      font-size: .84rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AcompanhamentoComponent {
  readonly homologacao = input.required<HomologacaoDetalhe>();
  readonly abrirItem = output<ItemHom>();
  readonly resolver = output<DivergenciaHom>();
  readonly removerReservasDe = output<ParticipanteHom>();

  readonly parecer = PARECER_INFO;

  readonly aberta = computed(() => ['PLANEJADA', 'EM_ANDAMENTO'].includes(this.homologacao().situacao));
  readonly ativos = computed(() => this.homologacao().participantes.filter(p => !p.semProgresso));
  readonly semProgresso = computed(() => this.homologacao().participantes.filter(p => p.semProgresso));
  readonly reservaramSemTestar = computed(() => this.semProgresso().filter(p => p.sobResponsabilidade > 0));
  readonly nemReservaram = computed(() => this.semProgresso().filter(p => p.sobResponsabilidade === 0));
  readonly nomesNemReservaram = computed(() => this.nemReservaram().map(p => p.nome).join(', '));
  readonly maxTestados = computed(() => Math.max(1, ...this.ativos().map(p => p.testadosDistribuicao + p.testadosGeral)));

  private readonly noEscopo = computed(() => this.homologacao().itens.filter(i => !i.foraEscopo));
  readonly reprovados = computed(() =>
    this.noEscopo()
      .filter(i => i.resultado === 'REPROVADO')
      .sort((a, b) => Number(b.impeditivo) - Number(a.impeditivo) || a.titulo.localeCompare(b.titulo))
  );
  readonly bloqueados = computed(() => this.noEscopo().filter(i => i.resultado === 'BLOQUEADO'));
  /** Reservados sem resultado há mais de 2 dias. */
  readonly parados = computed(() =>
    this.noEscopo().filter(
      i => i.codResponsavel && !i.resultado && i.dataResponsavel && Date.now() - new Date(i.dataResponsavel).getTime() > 2 * DIA
    )
  );
  readonly agrupamentosComLivres = computed(() => this.homologacao().agrupamentos.filter(a => a.contagem.livres > 0));

  agrupamentosDe(codHs: number) {
    return this.homologacao().agrupamentos.filter(a => a.codHomologacaoSistema === codHs);
  }

  /** Agrupamentos do módulo (nulo = "Sem módulo": os sem módulo ou de módulo fora da lista). */
  agrupamentosDoModulo(codHs: number, codModulo: number | null) {
    const sistema = this.homologacao().sistemas.find(s => s.codHomologacaoSistema === codHs);
    return porModulo(sistema?.modulos ?? [], this.agrupamentosDe(codHs)).find(g => g.codModulo === codModulo)?.itens ?? [];
  }

  nomeSistema(codHs: number) {
    return this.homologacao().sistemas.find(s => s.codHomologacaoSistema === codHs)?.nome ?? '';
  }

  rotulo(r: ItemHom['resultado']) {
    return r ? RESULTADO_INFO[r].rotulo : 'sem resultado';
  }

  parado(p: ParticipanteHom) {
    return p.sobResponsabilidade > p.concluidosResponsabilidade && !!p.ultimaAtividade && Date.now() - new Date(p.ultimaAtividade).getTime() > 2 * DIA;
  }
}
