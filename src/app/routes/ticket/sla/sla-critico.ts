// src/app/routes/sprint/sla-critico/sla-critico.component.ts
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { interval, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';

// Material
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';

import { MtxGridModule, MtxGridColumn } from '@ng-matero/extensions/grid';

// NgxEcharts
import { NgxEchartsModule } from 'ngx-echarts';
import { DashboardSlaCritico, SlaCriticoDetalhado } from '@core';
import { SlaCriticoService } from './slaCriticoService';


@Component({
  selector: 'app-sla-critico',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatChipsModule,
    MatTooltipModule,
    MtxGridModule,
    NgxEchartsModule
  ],
  templateUrl: './sla-critico.html',
  styleUrls: ['./sla-critico.scss']
})
export class SlaCriticoComponent implements OnInit, OnDestroy {
  private slaCriticoService = inject(SlaCriticoService);

  dashboard?: DashboardSlaCritico;
  loading = false;
  autoRefreshSubscription?: Subscription;

  // Opções para gráficos
  chartOptionsNivel1: any;
  chartOptionsNivel2: any;

  // Configuração das Grids
  columnsNivel1: MtxGridColumn[] = this.createColumns();
  columnsNivel2: MtxGridColumn[] = this.createColumns();

  ngOnInit(): void {
    this.carregarDashboard();
    this.iniciarAutoRefresh();
  }

  ngOnDestroy(): void {
    if (this.autoRefreshSubscription) {
      this.autoRefreshSubscription.unsubscribe();
    }
  }

  createColumns(): MtxGridColumn[] {
    return [
      {
        header: 'ID Ticket',
        field: 'idTicket',
        width: '120px',
        sortable: true
      },
      {
        header: 'Título',
        field: 'titulo',
        sortable: true,
        minWidth: 200
      },
      {
        header: 'Nível',
        field: 'nivel',
        width: '80px',
        type: 'tag',
        tag: {
          1: { text: 'N1', color: 'red-500' },
          2: { text: 'N2', color: 'orange-500' }
        }
      },
      {
        header: 'Status',
        field: 'status',
        width: '120px',
        sortable: true
      },
      {
        header: 'Responsável',
        field: 'responsavel',
        sortable: true,
        width: '150px'
      },
      {
        header: 'Data Abertura',
        field: 'dataAbertura',
        width: '150px',
        sortable: true,
        type: 'date',
        typeParameter: {
          format: 'dd/MM/yyyy HH:mm'
        }
      },
      {
        header: 'Limite Paliativo',
        field: 'dataLimitePaliativo',
        width: '150px',
        sortable: true,
        type: 'date',
        typeParameter: {
          format: 'dd/MM/yyyy HH:mm'
        }
      },
      {
        header: 'Hrs Restantes (P)',
        field: 'horasRestantesPaliativo',
        width: '140px',
        sortable: true,
        formatter: (data: any) => this.formatarHorasRestantes(data.horasRestantesPaliativo)
      },
      {
        header: 'Status Paliativo',
        field: 'statusSlaPaliativo',
        width: '140px',
        type: 'tag',
        tag: {
          PENDENTE: { text: 'Pendente', color: 'blue-500' },
          NO_PRAZO: { text: 'No Prazo', color: 'green-500' },
          ATRASADO: { text: 'Atrasado', color: 'red-500' }
        }
      },
      {
        header: 'Limite Definitivo',
        field: 'dataLimiteDefinitivo',
        width: '150px',
        sortable: true,
        type: 'date',
        typeParameter: {
          format: 'dd/MM/yyyy HH:mm'
        }
      },
      {
        header: 'Hrs Restantes (D)',
        field: 'horasRestantesDefinitivo',
        width: '140px',
        sortable: true,
        formatter: (data: any) => this.formatarHorasRestantes(data.horasRestantesDefinitivo)
      },
      {
        header: 'Status Definitivo',
        field: 'statusSlaDefinitivo',
        width: '140px',
        type: 'tag',
        tag: {
          PENDENTE: { text: 'Pendente', color: 'blue-500' },
          NO_PRAZO: { text: 'No Prazo', color: 'green-500' },
          ATRASADO: { text: 'Atrasado', color: 'red-500' }
        }
      },
      {
        header: 'Ações',
        field: 'actions',
        width: '100px',
        type: 'button',
        buttons: [
          {
            type: 'icon',
            icon: 'check_circle',
            tooltip: 'Registrar Paliativo',
            color: 'primary',
            click: (record: any) => this.registrarPaliativo(record),
            iif: (record: any) => !record.dataPaliativoReal
          }
        ]
      }
    ];
  }

  carregarDashboard(): void {
    this.loading = true;
    this.slaCriticoService.obterDashboard().subscribe({
      next: (data) => {
        this.dashboard = data;
        this.configurarGraficos();
        this.loading = false;
      },
      error: (err) => {
        console.error('Erro ao carregar dashboard SLA', err);
        this.loading = false;
      }
    });
  }

  iniciarAutoRefresh(): void {
    // Atualiza a cada 1 minuto (SLA crítico precisa de atualização mais frequente)
    this.autoRefreshSubscription = interval(60000)
      .pipe(switchMap(() => this.slaCriticoService.obterDashboard()))
      .subscribe({
        next: (data) => {
          this.dashboard = data;
          this.configurarGraficos();
        },
        error: (err) => console.error('Erro no auto-refresh SLA', err)
      });
  }

  atualizarStatus(): void {
    this.loading = true;
    this.slaCriticoService.atualizarStatus().subscribe({
      next: () => {
        this.carregarDashboard();
      },
      error: (err) => {
        console.error('Erro ao atualizar status', err);
        this.loading = false;
      }
    });
  }

  registrarPaliativo(ticket: SlaCriticoDetalhado): void {
    if (confirm(`Confirma registro de paliativo aplicado para o ticket ${ticket.idTicket}?`)) {
      this.slaCriticoService.registrarPaliativo(ticket.idTicket).subscribe({
        next: () => {
          alert('Paliativo registrado com sucesso!');
          this.carregarDashboard();
        },
        error: (err) => {
          console.error('Erro ao registrar paliativo', err);
          alert('Erro ao registrar paliativo: ' + err.message);
        }
      });
    }
  }

  formatarHorasRestantes(horas?: number): string {
    if (horas === undefined || horas === null) {
      return '-';
    }

    if (horas < 0) {
      return `<span class="text-red-600 font-bold">${Math.abs(horas).toFixed(1)}h ATRASADO</span>`;
    }

    if (horas < 2) {
      return `<span class="text-orange-600 font-bold">${horas.toFixed(1)}h</span>`;
    }

    return `${horas.toFixed(1)}h`;
  }

  configurarGraficos(): void {
    if (!this.dashboard) return;

    // Gráfico Nível 1
    this.chartOptionsNivel1 = {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        left: 'left'
      },
      series: [
        {
          name: 'Nível 1',
          type: 'pie',
          radius: '60%',
          data: [
            {
              value: this.dashboard.noPrazoNivel1,
              name: 'No Prazo',
              itemStyle: { color: '#22c55e' }
            },
            {
              value: this.dashboard.atrasadosNivel1,
              name: 'Atrasados',
              itemStyle: { color: '#ef4444' }
            }
          ],
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ]
    };

    // Gráfico Nível 2
    this.chartOptionsNivel2 = {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        left: 'left'
      },
      series: [
        {
          name: 'Nível 2',
          type: 'pie',
          radius: '60%',
          data: [
            {
              value: this.dashboard.noPrazoNivel2,
              name: 'No Prazo',
              itemStyle: { color: '#22c55e' }
            },
            {
              value: this.dashboard.atrasadosNivel2,
              name: 'Atrasados',
              itemStyle: { color: '#ef4444' }
            }
          ],
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ]
    };
  }

  calcularPercentualNoPrazo(noPrazo: number, total: number): number {
    return total > 0 ? Math.round((noPrazo / total) * 100) : 0;
  }
}
