import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { finalize, interval } from 'rxjs';

import { normalizar } from '../terminal-ssh/comandos';
import {
  Mapa,
  NoMapa,
  ROTULO_SISTEMA,
  ROTULO_SITUACAO,
  ServidorMapa,
  SituacaoItem,
  SituacaoSistema,
} from './mapa-servicos.models';
import { MapaServicosService } from './mapa-servicos.service';
import { NoOrganogramaComponent } from './no-organograma';

/** De quanto em quanto tempo a tela se atualiza sozinha. */
const ATUALIZAR_MS = 30_000;

/** Nomes pesquisáveis de um nó e de tudo abaixo dele. */
function textosDoNo(no: NoMapa): (string | null)[] {
  return [no.nome, no.servidor, no.worker, ...no.filhos.flatMap(textosDoNo)];
}

type Visao = 'sistemas' | 'servidores';

/**
 * Dispositivos > Mapa de serviços: organograma de cada sistema (sistema →
 * entradas → balanceadores em quantos níveis houver → serviços) e a visão por
 * servidor (servidor → serviços → sistemas que dependem dele), com a situação
 * de cada item.
 *
 * O organograma sai do cadastro em Balanceadores dos sistemas.
 */
@Component({
  selector: 'app-mapa-servicos',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    MatTooltipModule,
    NoOrganogramaComponent,
    RouterLink,
  ],
  templateUrl: './mapa-servicos.html',
  styleUrl: './mapa-servicos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapaServicosComponent implements OnInit {
  private readonly service = inject(MapaServicosService);
  private readonly destroyRef = inject(DestroyRef);

  readonly mapa = signal<Mapa | null>(null);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);

  readonly visao = signal<Visao>('sistemas');
  readonly filtro = signal('');
  readonly soProblemas = signal(false);

  readonly rotuloSituacao = ROTULO_SITUACAO;
  readonly rotuloSistema = ROTULO_SISTEMA;

  readonly sistemasCadastrados = computed(() =>
    (this.mapa()?.sistemas ?? []).filter(s => s.situacao !== 'SEM_CADASTRO')
  );

  readonly sistemasSemCadastro = computed(() =>
    (this.mapa()?.sistemas ?? []).filter(s => s.situacao === 'SEM_CADASTRO')
  );

  readonly sistemasVisiveis = computed(() => {
    const termo = normalizar(this.filtro().trim());
    return this.sistemasCadastrados().filter(s => {
      if (this.soProblemas() && (s.situacao === 'OK' || s.situacao === 'ATENCAO')) return false;
      if (!termo) return true;
      const textos = [s.nome, ...s.entradas.flatMap(textosDoNo)];
      return normalizar(textos.filter(Boolean).join(' ')).includes(termo);
    });
  });

  readonly servidoresVisiveis = computed(() => {
    const termo = normalizar(this.filtro().trim());
    return (this.mapa()?.servidores ?? []).filter(s => {
      if (this.soProblemas() && s.situacao !== 'FORA' && !s.servicos.some(sv => sv.situacao === 'FORA')) return false;
      if (!termo) return true;
      const textos = [s.nome, s.ip, s.grupo, ...s.sistemas, ...s.servicos.map(sv => sv.nome)];
      return normalizar(textos.filter(Boolean).join(' ')).includes(termo);
    });
  });

  ngOnInit() {
    this.carregar();
    interval(ATUALIZAR_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.carregar(true));
  }

  carregar(silencioso = false) {
    if (this.carregando()) return;
    this.carregando.set(!silencioso || !this.mapa());
    this.service
      .mapa()
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({
        next: mapa => {
          this.mapa.set(mapa);
          this.erro.set(null);
        },
        // Segura o último mapa bom; o aviso diz que a leitura falhou.
        error: () => this.erro.set('Não foi possível atualizar o mapa. Exibindo a última leitura.'),
      });
  }

  /** Classe de cor de servidor/serviço. */
  corItem(situacao: SituacaoItem | string): string {
    return `sit sit--${situacao.toLowerCase()}`;
  }

  /** Sistema usa a mesma paleta: parado = fora, parcial/atenção = alerta. */
  corSistema(situacao: SituacaoSistema | string): string {
    const mapa: Record<string, string> = {
      TOTAL: 'fora',
      PARCIAL: 'alerta',
      ATENCAO: 'alerta',
      OK: 'ok',
      SEM_CADASTRO: 'desconhecido',
    };
    return `sit sit--${mapa[situacao] ?? 'desconhecido'}`;
  }

  rotuloItem(situacao: SituacaoItem | string): string {
    return this.rotuloSituacao[situacao as SituacaoItem] ?? situacao;
  }

  rotuloDoSistema(situacao: SituacaoSistema | string): string {
    return this.rotuloSistema[situacao as SituacaoSistema] ?? situacao;
  }

  iconeSistema(situacao: SituacaoSistema | string): string {
    switch (situacao) {
      case 'TOTAL':
        return 'error';
      case 'PARCIAL':
        return 'warning';
      case 'ATENCAO':
        return 'info';
      default:
        return 'check_circle';
    }
  }

  servicosFora(servidor: ServidorMapa): number {
    return servidor.servicos.filter(s => s.situacao === 'FORA').length;
  }
}
