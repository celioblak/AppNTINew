import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatListModule } from '@angular/material/list';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { RouterLink } from '@angular/router';
import { Chamado, SettingsService } from '@core';
import { MtxAlertModule } from '@ng-matero/extensions/alert';
import { MtxProgressModule } from '@ng-matero/extensions/progress';
import { Subscription } from 'rxjs';

import { ChamadoService } from '@core/chamado.service';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef } from '@angular/core';
import { EstatisticaService } from './estatistica.service';
import { DashboardService } from '../ticket/sprint/dashboard/dashboard.service';

interface ChamadoUser {
  total: string;
  total_requisicao: string;
  total_incidente: string;
  nome: string;
  login: string;
  foto: string;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.Default,
  providers: [DashboardService],
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatListModule,
    MatGridListModule,
    MatTableModule,
    MatTabsModule,
    MatDividerModule,
    MatIconModule,
    MatBadgeModule,
    MtxAlertModule,

  ],
})
export class Dashboard implements OnInit, AfterViewInit, OnDestroy {
  private readonly ngZone = inject(NgZone);
  private readonly settings = inject(SettingsService);
  private readonly dashboardSrv = inject(DashboardService);
  private readonly chamadoService = inject(ChamadoService);
  private readonly estatisticaService = inject(EstatisticaService);
   private readonly cdRef = inject(ChangeDetectorRef);

  public chamados: Chamado[] = [];
  public chamadosAnaRequisitos: Chamado[] = [];
  public chamadosParaExecucao: Chamado[] = [];
  public chamadosEmExecucao: Chamado[] = [];
  public chamadosEmAnalise: Chamado[] = [];
  public chamadosPausado: Chamado[] = [];
  public chamadosAprovacaoGestor: Chamado[] = [];
  public chamadosValidacao: Chamado[] = [];
  public ChamadosUsuarios: ChamadoUser[] = [];

  // Colunas para as tabelas
  displayedColumnsAnaRequisitos = ['id', 'titulo', 'tecnico', 'sla'];
  displayedColumnsSimples = ['id', 'titulo'];
  displayedColumnsEmExecucao = ['id', 'titulo', 'tecnico'];

  showContent = false;

  // ── Auto atualização (auto refresh) ───────────────────────────────────────
  // Signals: em app zoneless, a escrita marca a view para atualizar automaticamente.
  readonly autoRefreshAtivo = signal(false);
  readonly intervaloSegundos = signal(30);
  readonly ultimaAtualizacao = signal<Date | null>(null);
  readonly opcoesIntervalo: { label: string; valor: number }[] = [
    { label: '5 segundos', valor: 5 },
    { label: '10 segundos', valor: 10 },
    { label: '15 segundos', valor: 15 },
    { label: '30 segundos', valor: 30 },
    { label: '1 minuto', valor: 60 },
    { label: '2 minutos', valor: 120 },
    { label: '5 minutos', valor: 300 },
    { label: '10 minutos', valor: 600 },
  ];
  private autoRefreshHandle: any = null;
  private readonly AUTO_REFRESH_KEY = 'dashboard.autoRefresh';

  ngOnInit() {
    this.restaurarPreferenciaAutoRefresh();
  }

  ngAfterViewInit() {
    this.carregarRequisicoes();
    this.carregarChamadosUsuarios();
    this.ultimaAtualizacao.set(new Date());
    if (this.autoRefreshAtivo()) {
      this.iniciarAutoRefresh();
    }
  }

  ngOnDestroy() {
    this.pararAutoRefresh();
  }

  // ── API pública do auto refresh (usada pelo template) ─────────────────────

  toggleAutoRefresh() {
    const ativo = !this.autoRefreshAtivo();
    this.autoRefreshAtivo.set(ativo);
    this.persistirPreferenciaAutoRefresh();
    if (ativo) {
      this.iniciarAutoRefresh();
    } else {
      this.pararAutoRefresh();
    }
  }

  onIntervaloChange(valor: string | number) {
    const segundos = Number(valor);
    if (!Number.isFinite(segundos) || segundos <= 0) {
      return;
    }
    this.intervaloSegundos.set(segundos);
    this.persistirPreferenciaAutoRefresh();
    if (this.autoRefreshAtivo()) {
      this.iniciarAutoRefresh(); // reinicia com o novo intervalo
    }
  }

  /** Atualização manual ("Atualizar agora"): recarrega tudo. */
  atualizarDashboard() {
    this.carregarRequisicoes(true);
    this.carregarChamadosUsuarios();
    // Escrita no signal marca a view para atualizar (app zoneless).
    this.ultimaAtualizacao.set(new Date());
    this.cdRef.detectChanges();
  }

  /**
   * Ciclo do auto refresh: atualiza apenas as listas de chamados.
   * O card "Chamados finalizados no mês (Participações)" NÃO é recarregado aqui.
   */
  private atualizarSomenteListas() {
    this.carregarRequisicoes(true);
    this.ultimaAtualizacao.set(new Date());
    this.cdRef.detectChanges();
  }

  // ── Implementação interna ────────────────────────────────────────────────

  private iniciarAutoRefresh() {
    this.pararAutoRefresh();
    this.autoRefreshHandle = setInterval(
      () => this.atualizarSomenteListas(),
      this.intervaloSegundos() * 1000
    );
  }

  private pararAutoRefresh() {
    if (this.autoRefreshHandle) {
      clearInterval(this.autoRefreshHandle);
      this.autoRefreshHandle = null;
    }
  }

  private restaurarPreferenciaAutoRefresh() {
    try {
      const bruto = localStorage.getItem(this.AUTO_REFRESH_KEY);
      if (!bruto) {
        return;
      }
      const pref = JSON.parse(bruto) as { ativo?: boolean; intervalo?: number };
      if (typeof pref.ativo === 'boolean') {
        this.autoRefreshAtivo.set(pref.ativo);
      }
      if (
        typeof pref.intervalo === 'number' &&
        this.opcoesIntervalo.some(o => o.valor === pref.intervalo)
      ) {
        this.intervaloSegundos.set(pref.intervalo);
      }
    } catch {
      /* preferência ausente ou inválida – mantém os padrões */
    }
  }

  private persistirPreferenciaAutoRefresh() {
    try {
      localStorage.setItem(
        this.AUTO_REFRESH_KEY,
        JSON.stringify({ ativo: this.autoRefreshAtivo(), intervalo: this.intervaloSegundos() })
      );
    } catch {
      /* localStorage indisponível – ignora */
    }
  }

  carregarChamadosUsuarios() {
    this.ChamadosUsuarios = [];
    this.estatisticaService.getFinalizadosUsuarioMes().then(response => {
      for (let chamadoUser of response) {
        if (!chamadoUser.foto || chamadoUser.foto === 'null') {
          chamadoUser.foto = 'assets/img/avatars/noAvatar.jpg';
        }
        // mantém como string simples – a sanitização é feita automaticamente pelo binding
      }
      this.ChamadosUsuarios = response;
      this.cdRef.detectChanges();
    }).catch((error: any) => {
      console.log('Deu Ruim ' + error);
    });
  }

  carregarRequisicoes(silencioso = false) {
    this.cdRef.detectChanges();
    if (!silencioso) {
      this.showContent = false;
    }
    this.chamadoService.getTicketPendenteRequisicao().then(response => {
      this.chamados = [];
      this.chamadosAnaRequisitos = [];
      this.chamadosParaExecucao = [];
      this.chamadosEmExecucao = [];
      this.chamadosEmAnalise = [];
      this.chamadosPausado = [];
      this.chamadosAprovacaoGestor = [];
      this.chamadosValidacao = [];

      if (!(response instanceof Array)) {
        return;
      }
      for (let chamado of response) {
        for (let tecnico of chamado.tecnicos) {
          if (tecnico != null) {
            if (!tecnico.foto || tecnico.foto === 'null') {
              tecnico.foto = 'assets/img/avatars/noAvatar.jpg';
            }
            // mantém como string
          }
        }

        if (chamado.status === 'AGUARDANDO_ANALISE') {
          this.chamadosAnaRequisitos.push(chamado);
        } else if (chamado.status === 'AGUARDANDO_EXECUCAO') {
          this.chamadosParaExecucao.push(chamado);
        } else if (chamado.status === 'EM_EXECUCAO') {
          this.chamadosEmExecucao.push(chamado);
        } else if (chamado.status === 'EM_ANALISE') {
          this.chamadosAnaRequisitos.push(chamado);
        } else if (chamado.status === 'AGUARDANDO_APROVACAO_GESTOR') {
          this.chamadosAprovacaoGestor.push(chamado);
        } else if (chamado.status === 'PAUSADO') {
          this.chamadosPausado.push(chamado);
        } else if (chamado.status === 'AGUARDANDO_VALIDACAO') {
          this.chamadosValidacao.push(chamado);
        } else {
          this.chamados.push(chamado);
        }
      }
      this.showContent = true;
      this.cdRef.detectChanges();
    }).catch((error: any) => {
      console.log('Deu Ruim ' + error);
    });
  }

  scrooltoElement(elementId: any) {
    console.log(elementId);
    let element = document.getElementById(elementId) as HTMLElement;
    console.log(element);
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  tempoChamado(ch: Chamado): number {
    return this.calculateDiffDatas(ch.dthrAbertura ? ch.dthrAbertura : new Date(), new Date());
  }

  slaRequisitosTempoAnalise(ch: Chamado): number {
    return this.calculateDiffDatas(
      ch.dthrAprovacaoGestao ? ch.dthrAprovacaoGestao : new Date(),
      new Date()
    );
  }

  slaRequisitosCor(ch: Chamado): string {
  const tempo = this.slaRequisitosTempoAnalise(ch);
  if (tempo >= 5) {
    return 'warn';      // vermelho
  } else if (tempo >= 3) {
    return 'accent';    // laranja/amarelo (depende do tema)
  } else {
    return 'primary';   // verde/azul
  }
 }

   slaRequisitosCorAnalise(ch:Chamado):string{
    var tempo:number = this.slaRequisitosTempoAnalise(ch);

    if (tempo >= 0 && tempo <=2){
      return 'slaDentro';
    }else if (tempo >= 3  && tempo <= 4){
      return 'slaAVencer';
    }else if (tempo >= 5 ){
      return 'slaVencido';
    }
    return '';
  }

  slaRequisitosPercentual(ch: Chamado): number {
    var tempo = this.calculateDiffDatas(
      ch.dthrAprovacaoGestao ? ch.dthrAprovacaoGestao : new Date(),
      new Date()
    );
    if (tempo == 0) {
      return 0;
    } else if (tempo == 1) {
      return 20;
    } else if (tempo == 2) {
      return 40;
    } else if (tempo == 3) {
      return 60;
    } else if (tempo == 4) {
      return 80;
    } else if (tempo >= 4) {
      return 100;
    }
    return 0;
  }

  calculateDiffDatas(dateIni: Date, dateFim: Date): number {
    let currentDate = new Date(dateFim);
    let dateSent = new Date(dateIni);
    var calculo = Math.floor(
      (Date.UTC(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate()
      ) -
        Date.UTC(
          dateSent.getFullYear(),
          dateSent.getMonth(),
          dateSent.getDate()
        )) /
        (1000 * 60 * 60 * 24)
    );
    return calculo;
  }
}
