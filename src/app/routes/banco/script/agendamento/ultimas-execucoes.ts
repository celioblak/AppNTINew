import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { MtxGridColumn, MtxGridModule } from '@ng-matero/extensions/grid';
import { HotToastService } from '@ngxpert/hot-toast';

import { ScriptAgendamentoService } from './script-agendamento.service';
import { DialogHistoricoExecucaoComponent } from './script-agendamento';
import { UltimaExecucaoAgendamento } from '@core';
import {
  escaparAspas,
  escaparHtml,
  formatarDataHoraExecucao,
  formatarCustoOracle,
  formatarTamanhoArquivo,
  calcularDuracaoExecucao,
} from './execucao-formatters';

/**
 * Tela de acompanhamento geral: mostra a última execução de TODOS os
 * agendamentos de uma vez, pra não precisar abrir agendamento por
 * agendamento pra saber se algo falhou ou parou de rodar. Clique no nome
 * do agendamento abre o histórico completo (mesmo dialog usado na tela
 * principal de agendamentos).
 *
 * ultimaExecucao só vem null quando o agendamento nunca executou de
 * verdade — "Limpar histórico" e a exclusão individual sempre preservam a
 * execução mais recente (ver ScriptAgendamentoService no backend), então
 * essa tela nunca regride pra "nunca executado" só por causa de uma
 * limpeza de histórico.
 */
@Component({
  selector: 'app-ultimas-execucoes-agendamento',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatTooltipModule,
    MatSlideToggleModule,
    MatDialogModule,
    MtxGridModule,
    RouterLink,
  ],
  templateUrl: './ultimas-execucoes.html',
  styleUrl: './ultimas-execucoes.scss',
})
export class UltimasExecucoesComponent implements OnInit, OnDestroy {
  private readonly agendamentoService = inject(ScriptAgendamentoService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(HotToastService);

  isMobile = window.innerWidth < 768;

  lista: UltimaExecucaoAgendamento[] = [];
  carregando = false;
  autoAtualizar = true;
  ultimaAtualizacao: Date | null = null;
  /** codExecucao cujo download está em andamento (mostra spinner na linha). */
  baixandoCodExecucao: number | null = null;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  // Intervalo maior que o do dialog de histórico individual (5s) — aqui é uma
  // consulta agregada de TODOS os agendamentos, não precisa ser tão frequente.
  private static readonly INTERVALO_MS = 15000;

  private openDialogRefs: MatDialogRef<any>[] = [];

  private static readonly STATUS_LABEL: { [status: string]: string } = {
    CONCLUIDO: '✅ Concluído',
    ERRO: '❌ Erro',
    EXECUTANDO: '🔄 Executando',
    GERANDO_ARQUIVO: '🔄 Gerando arquivo',
    ENVIANDO: '🔄 Enviando',
    AGUARDANDO_REENVIO: '📧 Aguardando reenvio',
  };

  columns: MtxGridColumn[] = [
    { header: 'Agendamento', field: 'nomeAgendamento', width: '15%', formatter: (d: UltimaExecucaoAgendamento) => this.formatarAbrir(d) },
    { header: 'Script', field: 'scriptNome', width: '12%' },
    { header: 'Situação', field: 'ativo', width: '7%', formatter: (d: UltimaExecucaoAgendamento) => this.formatarAtivo(d) },
    { header: 'Início da Última Execução', field: 'inicio', width: '13%', formatter: (d: UltimaExecucaoAgendamento) => this.formatarInicio(d) },
    { header: 'Status', field: 'status', width: '11%', formatter: (d: UltimaExecucaoAgendamento) => this.formatarStatus(d) },
    { header: 'Duração', field: 'duracao', width: '8%', formatter: (d: UltimaExecucaoAgendamento) => this.formatarDuracao(d) },
    { header: 'Linhas', field: 'linhas', width: '6%', formatter: (d: UltimaExecucaoAgendamento) => this.formatarLinhas(d) },
    { header: 'Tamanho', field: 'tamanho', width: '6%', formatter: (d: UltimaExecucaoAgendamento) => formatarTamanhoArquivo(d.ultimaExecucao?.tamanhoArquivoKb) },
    { header: 'Custo Oracle', field: 'custoOracle', width: '10%', formatter: (d: UltimaExecucaoAgendamento) => this.formatarCusto(d) },
    { header: 'Arquivo', field: 'download', width: '6%', formatter: (d: UltimaExecucaoAgendamento) => this.formatarDownload(d) },
    { header: 'Drive', field: 'driveLink', width: '5%', formatter: (d: UltimaExecucaoAgendamento) => this.formatarDriveLink(d) },
    { header: 'Erro', field: 'erro', width: '11%', formatter: (d: UltimaExecucaoAgendamento) => this.formatarErro(d) },
  ];

  ngOnInit() {
    this.carregar();
    this.iniciarAutoAtualizacao();
  }

  ngOnDestroy() {
    this.pararAutoAtualizacao();
    this.openDialogRefs.forEach(ref => ref.close());
    this.openDialogRefs = [];
  }

  carregar() {
    this.carregando = true;
    this.cdr.detectChanges();
    this.agendamentoService.carregarUltimasExecucoes().subscribe({
      next: (lista) => this.aplicarResultado(() => {
        this.lista = lista;
        this.ultimaAtualizacao = new Date();
        this.carregando = false;
      }),
      error: (error) => {
        this.aplicarResultado(() => {
          this.carregando = false;
        });

        // Sessão expirou — para o auto-refresh pra não ficar tentando pra sempre.
        if (error?.status === 401 || error?.status === 403) {
          this.pararAutoAtualizacao();
        }
        console.error(error);
      }
    });
  }

  /**
   * Adia a atualização dos campos ligados ao template pro próximo macrotask E
   * força o detectChanges nesse novo ciclo. O backend local às vezes responde
   * rápido o bastante pra o subscribe.next cair AINDA dentro da mesma janela
   * de verificação do Angular que iniciou a chamada (ngOnInit, clique no
   * botão "Atualizar agora" ou o próprio setInterval) — mudar
   * carregando/ultimaAtualizacao nesse instante dispara NG0100
   * (ExpressionChangedAfterItHasBeenCheckedError). setTimeout(0) garante um
   * ciclo novo, e o detectChanges() dentro dele evita depender do tick
   * automático da zone (que é exatamente a fonte da corrida original).
   */
  private aplicarResultado(atualizar: () => void) {
    setTimeout(() => {
      atualizar();
      this.cdr.detectChanges();
    });
  }

  onToggleAutoAtualizar() {
    if (this.autoAtualizar) {
      this.iniciarAutoAtualizacao();
    } else {
      this.pararAutoAtualizacao();
    }
  }

  private iniciarAutoAtualizacao() {
    this.pararAutoAtualizacao();
    if (!this.autoAtualizar) {
      return;
    }
    this.intervalId = setInterval(() => this.carregar(), UltimasExecucoesComponent.INTERVALO_MS);
  }

  private pararAutoAtualizacao() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /** Abre o histórico completo daquele agendamento (mesmo dialog da tela principal). */
  private abrirHistorico(row: UltimaExecucaoAgendamento) {
    const ref = this.dialog.open(DialogHistoricoExecucaoComponent, {
      data: { codAgendamento: row.codAgendamento, nomeAgendamento: row.nomeAgendamento },
      maxWidth: '98vw',
      maxHeight: '92vh',
      width: this.isMobile ? '98%' : '1500px',
    });
    this.openDialogRefs.push(ref);
    ref.afterClosed().subscribe(() => {
      this.openDialogRefs = this.openDialogRefs.filter(r => r !== ref);
      // O dialog permite excluir execuções — recarrega pra refletir eventual mudança.
      this.carregar();
    });
  }

  /**
   * Handler de clique NATIVO no container do grid — mesma técnica do dialog
   * de histórico individual (não usa (rowClick) do mtx-grid: misturar
   * (rowClick) com botões dentro da célula dispararia os dois, já que o
   * clique borbulha e o listener da linha roda antes de qualquer
   * stopPropagation daqui). O mtx-grid sanitiza o HTML dos formatters,
   * removendo atributos (data-*, style), mas preserva "class" — por isso os
   * códigos vão embutidos em classes ("hist-cod-N" p/ execução,
   * "hist-cod-ag-N" p/ agendamento) e são lidos a partir delas.
   */
  onCliqueContainer(event: MouseEvent) {
    const alvo = event.target as HTMLElement | null;
    if (!alvo || typeof alvo.closest !== 'function') {
      return;
    }

    const botao = alvo.closest('.hist-download-btn, .hist-drive-link-btn, .hist-abrir-btn') as HTMLElement | null;
    if (!botao) {
      return;
    }

    if (botao.classList.contains('hist-abrir-btn')) {
      const codAg = this.extrairCodDaClasse(botao, 'hist-cod-ag-');
      const row = codAg != null ? this.lista.find(l => l.codAgendamento === codAg) : undefined;
      if (row) {
        this.abrirHistorico(row);
      }
      return;
    }

    const cod = this.extrairCodDaClasse(botao, 'hist-cod-');
    const row = cod != null ? this.lista.find(l => l.ultimaExecucao?.codExecucao === cod) : undefined;
    if (!row?.ultimaExecucao) {
      return;
    }

    if (botao.classList.contains('hist-download-btn')) {
      this.baixarArquivo(row.ultimaExecucao.codExecucao);
    } else if (botao.classList.contains('hist-drive-link-btn') && row.ultimaExecucao.driveLink) {
      window.open(row.ultimaExecucao.driveLink, '_blank', 'noopener');
    }
  }

  private extrairCodDaClasse(el: HTMLElement, prefixo: string): number | null {
    // "hist-cod-" é prefixo de "hist-cod-ag-" também — por isso as classes
    // candidatas são checadas na ordem certa pelo chamador (prefixo mais
    // específico primeiro não é necessário aqui pois cada botão só carrega
    // UMA das duas classes, nunca as duas ao mesmo tempo).
    for (const cls of Array.from(el.classList)) {
      if (cls.startsWith(prefixo)) {
        const n = Number(cls.substring(prefixo.length));
        return Number.isNaN(n) ? null : n;
      }
    }
    return null;
  }

  baixarArquivo(codExecucao: number) {
    if (this.baixandoCodExecucao != null) {
      this.toast.warning('Um download já está em andamento, aguarde a conclusão.');
      return;
    }
    this.baixandoCodExecucao = codExecucao;
    this.cdr.detectChanges();

    const toastRef = this.toast.loading('Preparando o arquivo para download…');

    this.agendamentoService.baixarArquivoExecucao(codExecucao).subscribe({
      next: (resp) => {
        toastRef.close();
        const blob = resp.body;
        if (!blob) {
          this.toast.error('Arquivo vazio retornado pelo servidor');
          this.baixandoCodExecucao = null;
          this.cdr.detectChanges();
          return;
        }

        if (resp.headers.get('X-Arquivo-Regerado') === 'true') {
          this.toast.warning(
            'O arquivo original expirou. Foi gerada uma nova extração com os dados atuais do banco ' +
            '(pode diferir do envio original).'
          );
        }

        const nome = this.extrairNomeArquivo(resp.headers.get('Content-Disposition'))
          || `export_${codExecucao}.zip`;

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = nome;
        link.click();
        window.URL.revokeObjectURL(url);

        this.toast.success('Download iniciado.');
        this.baixandoCodExecucao = null;
        this.cdr.detectChanges();
      },
      error: (err) => {
        toastRef.close();
        this.baixandoCodExecucao = null;
        this.cdr.detectChanges();
        const msg = err?.error?.message || 'Falha ao baixar o arquivo';
        this.toast.error(msg);
        console.error(err);
      }
    });
  }

  private extrairNomeArquivo(contentDisposition: string | null): string | null {
    if (!contentDisposition) {
      return null;
    }
    const match = /filename="?([^"]+)"?/.exec(contentDisposition);
    return match ? match[1] : null;
  }

  /** Nome do agendamento como "link" clicável — abre o histórico completo (ver onCliqueContainer). */
  private formatarAbrir(data: UltimaExecucaoAgendamento): string {
    return `<span class="hist-abrir-btn hist-cod-ag-${data.codAgendamento}" title="Ver histórico completo">` +
      `${escaparHtml(data.nomeAgendamento)}</span>`;
  }

  private formatarAtivo(data: UltimaExecucaoAgendamento): string {
    return data.ativo ? '🟢 Ativo' : '⏸️ Pausado';
  }

  private formatarInicio(data: UltimaExecucaoAgendamento): string {
    if (data.ultimaExecucao?.dtInicio) {
      return formatarDataHoraExecucao(data.ultimaExecucao.dtInicio);
    }
    return '<span style="opacity:0.6">Nunca executado</span>';
  }

  private formatarStatus(data: UltimaExecucaoAgendamento): string {
    const status = data.ultimaExecucao?.status;
    if (!status) {
      return '-';
    }
    return UltimasExecucoesComponent.STATUS_LABEL[status] || status;
  }

  private formatarDuracao(data: UltimaExecucaoAgendamento): string {
    if (!data.ultimaExecucao?.dtInicio) {
      return '-';
    }
    return calcularDuracaoExecucao(data.ultimaExecucao.dtInicio, data.ultimaExecucao.dtFim);
  }

  private formatarLinhas(data: UltimaExecucaoAgendamento): string {
    const linhas = data.ultimaExecucao?.qtdLinhas;
    return linhas != null ? linhas.toLocaleString('pt-BR') : '-';
  }

  private formatarCusto(data: UltimaExecucaoAgendamento): string {
    if (!data.ultimaExecucao) {
      return '-';
    }
    return formatarCustoOracle(data.ultimaExecucao);
  }

  /** Botão de baixar o arquivo — mesmo padrão visual/interativo do dialog de histórico individual. */
  private formatarDownload(data: UltimaExecucaoAgendamento): string {
    const exec = data.ultimaExecucao;
    if (!exec) {
      return '';
    }
    const gerouArquivo = exec.status === 'CONCLUIDO' || exec.status === 'AGUARDANDO_REENVIO' || exec.status === 'ERRO';
    if (!gerouArquivo) {
      return '';
    }
    if (this.baixandoCodExecucao === exec.codExecucao) {
      return `<span class="hist-download-btn hist-cod-${exec.codExecucao}" title="Baixando…">` +
        `<span class="material-icons hist-icon hist-icon-spin">autorenew</span></span>`;
    }
    return `<span class="hist-download-btn hist-cod-${exec.codExecucao}" title="Baixar arquivo (.zip)">` +
      `<span class="material-icons hist-icon">download</span></span>`;
  }

  private formatarDriveLink(data: UltimaExecucaoAgendamento): string {
    const exec = data.ultimaExecucao;
    if (!exec?.driveLink) {
      return '';
    }
    return `<span class="hist-drive-link-btn hist-cod-${exec.codExecucao}" title="Abrir no Google Drive">` +
      `<span class="material-icons hist-icon">open_in_new</span></span>`;
  }

  private formatarErro(data: UltimaExecucaoAgendamento): string {
    const erro = data.ultimaExecucao?.msgErro;
    if (!erro) {
      return '';
    }
    const truncado = erro.length > 30 ? erro.substring(0, 30) + '…' : erro;
    return `<span title="${escaparAspas(erro)}" style="color:#c62828;cursor:help">${escaparHtml(truncado)}</span>`;
  }
}
