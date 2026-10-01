import { ComponentType } from '@angular/cdk/portal';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { MtxDialog } from '@ng-matero/extensions/dialog';
import { HotToastService } from '@ngxpert/hot-toast';
import { Observable, filter, finalize, of, switchMap, tap } from 'rxjs';

import {
  AMBIENTE_ROTULO,
  Alvo,
  Ambiente,
  Arquivo,
  Artefato,
  AtualizacaoDetalhe,
  CHOQUE_ROTULO,
  Catalogo,
  ETAPAS,
  EVENTOS_DESTAQUE,
  EVENTO_ROTULO,
  ExecucaoAutomatica,
  GRAVIDADE_TOM,
  GerarJarResultado,
  METODO_ROTULO,
  MOMENTO_ROTULO,
  SITUACAO_INFO,
  SituacaoAtualizacao,
  hashCurto,
  nomeDoJar,
  tamanhoLegivel,
} from '../atualizacao.models';
import { AtualizacaoService, salvarDownload } from '../atualizacao.service';
import { AplicacaoDialogComponent, AplicacaoDialogData } from '../compartilhado/aplicacao-dialog';
import { ArtefatoDialogComponent, ArtefatoDialogData } from '../compartilhado/artefato-dialog';
import { ArtefatosLoteDialogComponent, ArtefatosLoteDialogData } from '../compartilhado/artefatos-lote-dialog';
import { BackupDialogComponent, BackupDialogData } from '../compartilhado/backup-dialog';
import { DadosDialogComponent, DadosDialogData } from '../compartilhado/dados-dialog';
import { AcaoInclusoes, InclusoesDialogComponent, InclusoesDialogData } from '../compartilhado/inclusoes-dialog';
import { JanelaDialogComponent, JanelaDialogData, ModoJanela } from '../compartilhado/janela-dialog';
import { LoteDialogComponent, LoteDialogData, ModoLote } from '../compartilhado/lote-dialog';
import { MotivoDialogComponent, MotivoDialogData } from '../compartilhado/motivo-dialog';
import { EtiquetaComponent, SituacaoChipComponent } from '../compartilhado/situacao-chip';
import { ValidacaoDialogComponent, ValidacaoDialogData } from '../compartilhado/validacao-dialog';
import { ConsoleDialogComponent, ConsoleDialogData } from '../compartilhado/console-dialog';
import { VersaoDialogComponent, VersaoDialogData } from '../compartilhado/versao-dialog';
import { ABA_ROTULO, AcaoPasso, Aba, passoAtual } from './passo-atual';

/** Posição de cada situação na barra do ciclo (desvios ficam na etapa em que acontecem). */
const ETAPA_DA_SITUACAO: Record<SituacaoAtualizacao, number> = {
  RASCUNHO: 0,
  EM_HOMOLOGACAO: 1,
  AGUARDANDO_CORRECAO: 1,
  VALIDADA: 2,
  AGUARDANDO_APROVACAO: 3,
  APROVADA: 4,
  PARCIAL: 5,
  EM_PRODUCAO: 5,
  CONCLUIDA: 6,
  CANCELADA: -1,
};

/** Atualização — cadastro e detalhe (T-02), com homologação, validação (T-04) e produção em modo manual (T-03). */
@Component({
  selector: 'app-atualizacao-detalhe',
  imports: [
    DatePipe,
    NgTemplateOutlet,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressBarModule,
    MatTabsModule,
    MatTooltipModule,
    EtiquetaComponent,
    SituacaoChipComponent,
  ],
  templateUrl: './atualizacao-detalhe.html',
  styleUrls: ['../compartilhado/atualizacao-pagina.scss', './atualizacao-detalhe.scss'],
  // Esc fecha o painel da linha do tempo.
  host: { '(document:keydown.escape)': 'tempoAberto.set(false)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AtualizacaoDetalheComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(AtualizacaoService);
  private readonly dialog = inject(MatDialog);
  private readonly mtxDialog = inject(MtxDialog);
  private readonly toast = inject(HotToastService);

  readonly etapas = ETAPAS;
  readonly situacaoInfo = SITUACAO_INFO;
  readonly momentoRotulo = MOMENTO_ROTULO;
  readonly metodoRotulo = METODO_ROTULO;
  readonly ambienteRotulo = AMBIENTE_ROTULO;
  readonly eventoRotulo = EVENTO_ROTULO;
  readonly choqueRotulo = CHOQUE_ROTULO;
  readonly gravidadeTom = GRAVIDADE_TOM;
  readonly destaque = EVENTOS_DESTAQUE;
  readonly hash = hashCurto;
  readonly tamanho = tamanhoLegivel;
  readonly nomeJar = nomeDoJar;

  readonly detalhe = signal<AtualizacaoDetalhe | null>(null);
  readonly carregando = signal(true);
  readonly naoEncontrada = signal(false);
  /** Chave "codArtefato|ambiente|chaveAlvo" do JAR sendo montado. */
  readonly gerando = signal<string | null>(null);
  private catalogo: Catalogo | null = null;

  readonly etapaAtual = computed(() => {
    const situacao = this.detalhe()?.situacao;
    return situacao ? ETAPA_DA_SITUACAO[situacao] : -1;
  });

  readonly desvio = computed(() => {
    const situacao = this.detalhe()?.situacao;
    return situacao === 'AGUARDANDO_CORRECAO' || situacao === 'PARCIAL' || situacao === 'CANCELADA';
  });

  readonly reprovacoes = computed(() => (this.detalhe()?.validacoes ?? []).filter(v => v.resultado === 'REPROVADA').length);
  readonly temConteudoJar = computed(() => (this.detalhe()?.artefatos ?? []).some(a => a.montaJar));
  readonly choquesCriticos = computed(() => (this.detalhe()?.choques ?? []).filter(c => c.gravidade === 'CRITICO').length);

  /** O que fazer agora, onde e o que vem depois. */
  readonly passo = computed(() => {
    const d = this.detalhe();
    return d ? passoAtual(d) : null;
  });
  readonly abaRotulo = ABA_ROTULO;
  readonly aba = signal<Aba>(0);
  /** Atualização + passo em que a aba foi escolhida: só muda de aba sozinho quando o passo muda. */
  private abaDoPasso = '';

  constructor() {
    // Wizard: abre na aba do passo atual e avança quando uma ação muda o passo. Troca manual de aba é respeitada.
    effect(() => {
      const d = this.detalhe();
      const passo = this.passo();
      if (!d || !passo) {
        return;
      }
      const chave = `${d.codAtualizacao}|${passo.id}`;
      if (chave !== this.abaDoPasso) {
        this.abaDoPasso = chave;
        untracked(() => this.aba.set(passo.aba));
      }
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(parametros => {
      const id = Number(parametros.get('id'));
      if (id) {
        this.carregar(id);
      } else {
        this.carregando.set(false);
        this.naoEncontrada.set(true);
      }
    });
  }

  carregar(id: number) {
    this.carregando.set(true);
    this.naoEncontrada.set(false);
    this.service
      .detalhe(id)
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({
        next: detalhe => {
          this.detalhe.set(detalhe);
          this.carregarExecucoes();
        },
        error: () => {
          this.detalhe.set(null);
          this.naoEncontrada.set(true);
        },
      });
  }

  // ------------------------------------------------------------------ automação por SSH, sem reinício (F-3a)

  /** Execuções automáticas da atualização (a mais recente primeiro). */
  readonly execucoes = signal<ExecucaoAutomatica[]>([]);

  carregarExecucoes() {
    const d = this.detalhe();
    if (d) {
      this.service.execucoes(d.codAtualizacao).subscribe({ next: lista => this.execucoes.set(lista), error: () => {} });
    }
  }

  /** Execução do artefato que ainda pede atenção: em andamento, aguardando reinício ou parada no meio (restaurar). */
  execucaoAberta(artefato: Artefato) {
    return this.execucoes().find(
      e =>
        e.codArtefato === artefato.codArtefato &&
        (e.situacao === 'EM_ANDAMENTO' || e.situacao === 'AGUARDANDO_REINICIO' || e.restauravel)
    );
  }

  /** Execuções que pararam no meio (servidor da aplicação caiu) ou com retorno incompleto: aviso em destaque ao abrir. */
  readonly restauraveis = computed(() => this.execucoes().filter(e => e.restauravel));

  /** Registros de "continuar sem eles": arquivos do pacote sem mapeamento de JAR que ficaram de fora. */
  readonly foraDoMapeamento = computed(() => (this.detalhe()?.eventos ?? []).filter(e => e.tipo === 'PACOTE_FORA_MAPEAMENTO'));

  nomesDosNos(execucao: ExecucaoAutomatica) {
    return execucao.nos.map(n => n.nome).join(', ');
  }

  restaurarExecucao(execucao: ExecucaoAutomatica) {
    const d = this.detalhe()!;
    this.mtxDialog.confirm(
      `Restaurar os backups de "${execucao.artefato}"?`,
      'O sistema confere o arquivo real de cada nó e devolve o backup (a cópia no repositório do servidor) onde estiver o arquivo ' +
        'novo. Nó que estiver com um terceiro arquivo não é tocado e aparece no console. Depois dá para aplicar de novo.',
      () =>
        this.service.restaurarExecucao(d.codAtualizacao, execucao.id).subscribe({
          next: restaurando => this.abrirConsole(restaurando),
          error: () => {},
        })
    );
  }

  ultimaExecucao(artefato: Artefato) {
    return this.execucoes().find(e => e.codArtefato === artefato.codArtefato) ?? null;
  }

  /** Só no ambiente em que a atualização é homologada (D-16) e só arquivos; nada em andamento na atualização. */
  podeAutomatizar(artefato: Artefato, ambiente: Ambiente) {
    const d = this.detalhe();
    return (
      !!d?.acoes.registrarHomologacao &&
      ambiente === 'HOMOLOGACAO' &&
      artefato.metodo === 'ARQUIVO' &&
      artefato.versaoVigente?.situacao !== 'REPROVADA' &&
      !this.todosAplicados(artefato.homologacao) &&
      !this.execucoes().some(e => e.situacao === 'EM_ANDAMENTO') &&
      !this.execucaoAberta(artefato)
    );
  }

  /** Backup de todos em andamento (execução sem artefato), para mostrar o console no lugar do botão. */
  readonly execucaoDeTodos = computed(
    () => this.execucoes().find(e => e.codArtefato === null && (e.situacao === 'EM_ANDAMENTO' || e.restauravel)) ?? null
  );

  /** Artefatos (arquivos) sem backup que o backup automático de todos cobre; 0 esconde o botão. */
  readonly semBackupAutomatizaveis = computed(() => {
    const d = this.detalhe();
    if (!d?.acoes.registrarHomologacao || this.execucoes().some(e => e.situacao === 'EM_ANDAMENTO' || e.restauravel)) {
      return 0;
    }
    return d.artefatos.filter(a => {
      const pendentes = a.homologacao.filter(alvo => alvo.ultimaAplicacao?.resultado !== 'SUCESSO');
      return a.metodo === 'ARQUIVO' && pendentes.length > 0 && !pendentes[0].backup;
    }).length;
  });

  backupAutomaticoDeTodos() {
    const d = this.detalhe()!;
    const n = this.semBackupAutomatizaveis();
    this.mtxDialog.confirm(
      `Fazer o backup automático de ${n} artefato(s)?`,
      'Para cada artefato sem backup, o sistema entra por SSH no primeiro nó (se o arquivo não estiver lá, nos demais), baixa o ' +
        'arquivo atual, confere o hash e registra o backup para todos os nós. Nada é alterado nos servidores; se um artefato ' +
        'falhar, os demais continuam.',
      () =>
        this.service.backupAutomaticoDeTodos(d.codAtualizacao).subscribe({
          next: execucao => this.abrirConsole(execucao),
          error: () => {},
        })
    );
  }

  backupAutomatico(artefato: Artefato) {
    const d = this.detalhe()!;
    this.mtxDialog.confirm(
      `Fazer o backup de "${artefato.nome}" automaticamente?`,
      'O sistema entra por SSH no primeiro nó (se o arquivo não estiver lá, nos demais), baixa o arquivo atual, confere o hash e ' +
        'registra o backup para todos os nós. Nada é alterado nos servidores.',
      () =>
        this.service.backupAutomatico(d.codAtualizacao, artefato.codArtefato).subscribe({
          next: execucao => this.abrirConsole(execucao),
          error: () => {},
        })
    );
  }

  aplicacaoAutomatica(artefato: Artefato) {
    const d = this.detalhe()!;
    const nos = artefato.homologacao.filter(a => a.ultimaAplicacao?.resultado !== 'SUCESSO').map(a => a.alvo);
    this.mtxDialog.confirm(
      `Aplicar "${artefato.nome}" automaticamente em ${nos.join(', ')}?`,
      'Confere todos os nós antes de mexer em qualquer um, guarda uma cópia do arquivo atual no repositório de cada servidor, ' +
        'envia o novo e troca nó por nó. Qualquer erro devolve o arquivo antigo aos nós já trocados — nenhum nó fica diferente. ' +
        'Nada é reiniciado: depois, reinicie por fora e confirme.',
      () =>
        this.service.aplicacaoAutomatica(d.codAtualizacao, artefato.codArtefato).subscribe({
          next: execucao => this.abrirConsole(execucao),
          error: () => {},
        })
    );
  }

  abrirConsole(execucao: ExecucaoAutomatica) {
    const d = this.detalhe()!;
    this.carregarExecucoes();
    this.dialog
      .open<ConsoleDialogComponent, ConsoleDialogData, boolean>(ConsoleDialogComponent, {
        data: { codAtualizacao: d.codAtualizacao, execucao },
        maxWidth: '96vw',
        disableClose: true,
      })
      .afterClosed()
      .subscribe(() => {
        this.carregarSilencioso();
        this.carregarExecucoes();
      });
  }

  voltar() {
    this.router.navigate(['/atualizacao/atualizacoes']);
  }

  abrirAtualizacao(codAtualizacao: number) {
    this.router.navigate(['/atualizacao/atualizacoes-detalhe'], { queryParams: { id: codAtualizacao } });
  }

  // ------------------------------------------------------------------ regras de botão (a API revalida)

  podeBackupHomologacao(artefato: Artefato, alvo: Alvo) {
    return (
      !!this.detalhe()?.acoes.registrarHomologacao &&
      artefato.versaoVigente?.situacao !== 'REPROVADA' &&
      alvo.ultimaAplicacao?.resultado !== 'SUCESSO'
    );
  }

  podeAplicarHomologacao(artefato: Artefato, alvo: Alvo) {
    return this.podeBackupHomologacao(artefato, alvo) && !!alvo.backup && this.jarPronto(artefato, alvo);
  }

  podeBackupValidacao() {
    const d = this.detalhe();
    return !!d?.acoes.registrarBackupProducao && d.situacao === 'VALIDADA';
  }

  podeRenovarBackup(alvo: Alvo) {
    return !!this.detalhe()?.acoes.registrarProducao && alvo.ultimaAplicacao?.resultado !== 'SUCESSO';
  }

  podeAplicarProducao(artefato: Artefato, alvo: Alvo) {
    return this.podeRenovarBackup(alvo) && (!!alvo.backup || !!alvo.backupRenovado) && this.jarPronto(artefato, alvo);
  }

  /** Conteúdo para JAR: gera a partir do backup (JAR atual) do destino, antes de aplicar. */
  podeGerarJar(artefato: Artefato, alvo: Alvo, ambiente: Ambiente) {
    if (!artefato.montaJar || alvo.jarGerado?.baseAtual) {
      return false;
    }
    const base = ambiente === 'HOMOLOGACAO' ? alvo.backup : (alvo.backupRenovado ?? alvo.backup);
    const permitido = ambiente === 'HOMOLOGACAO' ? this.podeBackupHomologacao(artefato, alvo) : this.podeRenovarBackup(alvo);
    return permitido && !!base?.arquivo;
  }

  /** Um destino pode ser retirado se sobrar outro no ambiente (em homologação emergencial pode ficar sem). */
  podeRetirarDestino(alvos: Alvo[], ambiente: Ambiente) {
    const d = this.detalhe();
    return !!d?.acoes.alterarArtefato && (alvos.length > 1 || (ambiente === 'HOMOLOGACAO' && d.emergencial));
  }

  /** O diretório costuma ser o mesmo em todos os processos: aí aparece uma vez só, fora da lista. */
  diretorioComum(alvos: Alvo[]): string | null {
    const diretorio = alvos[0]?.diretorio ?? null;
    return diretorio && alvos.every(a => a.diretorio === diretorio) ? diretorio : null;
  }

  // ------------------------------------------------------------------ cluster (revisão 9: backup, JAR e aplicação por sistema + ambiente)

  /** Nó que representa o cluster nas ações: o primeiro, na ordem, que ainda não recebeu a versão (ou o primeiro). */
  representante(alvos: Alvo[]): Alvo {
    return alvos.find(a => a.ultimaAplicacao?.resultado !== 'SUCESSO') ?? alvos[0];
  }

  /** O backup do cluster (é o mesmo em todos os nós); em produção, o da validação. */
  backupDoCluster(alvos: Alvo[]) {
    return this.representante(alvos)?.backup ?? alvos.find(a => a.backup)?.backup ?? null;
  }

  backupRenovadoDoCluster(alvos: Alvo[]) {
    return this.representante(alvos)?.backupRenovado ?? alvos.find(a => a.backupRenovado)?.backupRenovado ?? null;
  }

  jarDoCluster(alvos: Alvo[]) {
    return this.representante(alvos)?.jarGerado ?? alvos.find(a => a.jarGerado)?.jarGerado ?? null;
  }

  todosAplicados(alvos: Alvo[]) {
    return alvos.length > 0 && alvos.every(a => a.ultimaAplicacao?.resultado === 'SUCESSO');
  }

  chaveGeracao(artefato: Artefato, alvo: Alvo, ambiente: Ambiente) {
    return `${artefato.codArtefato}|${ambiente}|${alvo.chave}`;
  }

  private jarPronto(artefato: Artefato, alvo: Alvo) {
    return !artefato.montaJar || !!alvo.jarGerado?.baseAtual;
  }

  // ------------------------------------------------------------------ comandos

  executarPasso(acao: AcaoPasso) {
    switch (acao) {
      case 'incluirArtefatos':
        return this.incluirArtefatos();
      case 'backupsHomologacao':
        return this.backupsEmLote('HOMOLOGACAO');
      case 'backupsProducao':
        return this.backupsEmLote('PRODUCAO');
      case 'validar':
        return this.registrarValidacao();
      case 'solicitar':
        return this.janela('solicitar');
      case 'aprovar':
        return this.janela('aprovar');
      case 'concluir':
        return this.concluir();
    }
  }

  editarDados() {
    const detalhe = this.detalhe()!;
    this.comCatalogo(catalogo =>
      this.abrirDialogo<DadosDialogComponent, DadosDialogData>(DadosDialogComponent, { catalogo, detalhe }, 'Dados salvos.', {
        width: '720px',
      })
    );
  }

  incluirArtefatos() {
    const detalhe = this.detalhe()!;
    this.comCatalogo(catalogo =>
      this.abrirDialogo<ArtefatosLoteDialogComponent, ArtefatosLoteDialogData>(
        ArtefatosLoteDialogComponent,
        { detalhe, catalogo },
        'Artefatos incluídos.'
      )
    );
  }

  alterarArtefato(artefato: Artefato) {
    this.abrirDialogo<ArtefatoDialogComponent, ArtefatoDialogData>(
      ArtefatoDialogComponent,
      { detalhe: this.detalhe()!, artefato },
      'Artefato alterado.'
    );
  }

  enviarVersaoCorrigida(artefato: Artefato) {
    this.abrirDialogo<VersaoDialogComponent, VersaoDialogData>(
      VersaoDialogComponent,
      { detalhe: this.detalhe()!, artefato },
      'Versão corrigida recebida. Aplique em homologação e valide de novo.'
    );
  }

  removerArtefato(artefato: Artefato) {
    this.mtxDialog.confirm(`Remover o artefato "${artefato.nome}"?`, 'Só é possível enquanto não há backup nem aplicação registrados.', () =>
      this.executar(this.service.removerArtefato(artefato.codArtefato), 'Artefato removido.')
    );
  }

  podeRecalcular(artefato: Artefato) {
    return !!this.detalhe()?.acoes.alterarArtefato && artefato.recalculavel;
  }

  recalcularDestinos(artefato: Artefato) {
    // Com homologação registrada (não removível), o backend refaz só a produção e não reabre.
    if (!artefato.removivel) {
      this.mtxDialog.confirm(
        `Recalcular os destinos de produção de "${artefato.nome}"?`,
        'Os destinos de produção passam a ser os do cadastro atual do sistema (Configuração › Sistemas por ambiente). ' +
          'A homologação e a validação já registradas continuam valendo.',
        () => this.executar(this.service.recalcularDestinos(artefato.codArtefato), 'Destinos de produção recalculados.')
      );
      return;
    }
    const reabre = this.detalhe()!.situacao !== 'RASCUNHO';
    this.mtxDialog.confirm(
      `Recalcular os destinos de "${artefato.nome}"?`,
      'Os destinos passam a ser os do cadastro atual do sistema (Configuração › Sistemas por ambiente)' +
        (reabre ? '. Se mudarem, a atualização volta para homologação e validação, backup de produção e aprovação são cancelados.' : '.'),
      () => this.executar(this.service.recalcularDestinos(artefato.codArtefato), 'Destinos recalculados.')
    );
  }

  retirarDestino(artefato: Artefato, alvo: Alvo, ambiente: Ambiente) {
    this.dialog
      .open<MotivoDialogComponent, MotivoDialogData, string>(MotivoDialogComponent, {
        maxWidth: '95vw',
        data: {
          titulo: `Retirar ${alvo.alvo}`,
          descricao:
            `${artefato.nome} não será aplicado neste destino de ${AMBIENTE_ROTULO[ambiente].toLowerCase()}. ` +
            'O destino continua registrado com a justificativa.',
          rotulo: 'Por que este destino não recebe o artefato',
          botao: 'Retirar destino',
        },
      })
      .afterClosed()
      .pipe(
        filter((motivo): motivo is string => !!motivo),
        switchMap(motivo => this.service.removerDestino(alvo.codDestino, motivo))
      )
      .subscribe({ next: detalhe => this.atualizar(detalhe, 'Destino retirado.'), error: () => {} });
  }

  gerarJar(artefato: Artefato, alvo: Alvo, ambiente: Ambiente, opcoes: { cienteInclusoes?: boolean; corrigirCaminhos?: boolean } = {}) {
    const detalhe = this.detalhe()!;
    this.gerando.set(this.chaveGeracao(artefato, alvo, ambiente));
    this.service
      .gerarJar(detalhe.codAtualizacao, {
        codArtefato: artefato.codArtefato,
        ambiente,
        chaveAlvo: alvo.chave,
        cienteInclusoes: opcoes.cienteInclusoes ?? false,
        corrigirCaminhos: opcoes.corrigirCaminhos ?? false,
      })
      .pipe(finalize(() => this.gerando.set(null)))
      .subscribe({
        next: resultado => {
          this.detalhe.set(resultado.detalhe);
          // Arquivo que não existe no JAR atual costuma ser destino errado: mostra a lista antes de gravar.
          if (resultado.precisaConfirmar) {
            this.confirmarInclusoes(artefato, alvo, ambiente, resultado);
            return;
          }
          if (resultado.assinado) {
            this.toast.warning('JAR gerado, mas o original era assinado: a assinatura ficou inválida. Teste antes de seguir.', { duration: 8000 });
          } else {
            this.toast.success(`JAR gerado: ${resultado.substituidas} substituído(s), ${resultado.incluidas} incluído(s).`);
          }
        },
        error: () => {},
      });
  }

  private confirmarInclusoes(artefato: Artefato, alvo: Alvo, ambiente: Ambiente, resultado: GerarJarResultado) {
    this.dialog
      .open<InclusoesDialogComponent, InclusoesDialogData, AcaoInclusoes>(InclusoesDialogComponent, {
        maxWidth: '95vw',
        data: { artefato, alvo, resultado },
      })
      .afterClosed()
      .subscribe(acao => {
        if (acao === 'corrigir') {
          this.gerarJar(artefato, alvo, ambiente, { corrigirCaminhos: true });
        } else if (acao === 'gerar') {
          this.gerarJar(artefato, alvo, ambiente, { cienteInclusoes: true });
        }
      });
  }

  registrarBackup(artefato: Artefato, alvo: Alvo, ambiente: Ambiente) {
    this.abrirDialogo<BackupDialogComponent, BackupDialogData>(
      BackupDialogComponent,
      { detalhe: this.detalhe()!, artefato, alvo, ambiente },
      artefato.conteudoJar ? 'Backup registrado. Gere o JAR para este destino.' : 'Backup registrado.'
    );
  }

  registrarAplicacao(artefato: Artefato, alvo: Alvo, ambiente: Ambiente) {
    this.abrirDialogo<AplicacaoDialogComponent, AplicacaoDialogData>(
      AplicacaoDialogComponent,
      { detalhe: this.detalhe()!, artefato, alvo, ambiente },
      'Aplicação registrada.'
    );
  }

  /** Vários JARs de backup de uma vez; o backend descobre o destino de cada um pelo nome. */
  backupsEmLote(ambiente: Ambiente) {
    this.abrirLote('backups', ambiente);
  }

  gerarJarsEmLote(ambiente: Ambiente) {
    this.abrirLote('jars', ambiente);
  }

  /** O diálogo mostra o relatório (o que entrou, o que não entrou e o que falta) e devolve o detalhe atualizado. */
  private abrirLote(modo: ModoLote, ambiente: Ambiente) {
    this.dialog
      .open<LoteDialogComponent, LoteDialogData, AtualizacaoDetalhe>(LoteDialogComponent, {
        maxWidth: '95vw',
        disableClose: true,
        data: { detalhe: this.detalhe()!, ambiente, modo },
      })
      .afterClosed()
      .subscribe(atualizada => {
        if (atualizada) {
          this.detalhe.set(atualizada);
        }
      });
  }

  registrarValidacao() {
    const detalhe = this.detalhe()!;
    // O catálogo traz a verificação padrão de cada tipo, usada para sugerir o roteiro.
    this.comCatalogo(catalogo =>
      this.abrirDialogo<ValidacaoDialogComponent, ValidacaoDialogData>(
        ValidacaoDialogComponent,
        { detalhe, catalogo },
        'Validação registrada.'
      )
    );
  }

  janela(modo: ModoJanela) {
    const mensagens: Record<ModoJanela, string> = {
      solicitar: 'Aprovação solicitada.',
      aprovar: 'Produção aprovada.',
      recusar: 'Produção recusada.',
      cancelar: 'Atualização cancelada.',
    };
    this.abrirDialogo<JanelaDialogComponent, JanelaDialogData>(JanelaDialogComponent, { modo, detalhe: this.detalhe()! }, mensagens[modo]);
  }

  concluir() {
    const detalhe = this.detalhe()!;
    this.mtxDialog.confirm(`Concluir ${detalhe.numero}?`, 'Encerra o período de observação. Depois disso, novos artefatos entram como complemento.', () =>
      this.executar(this.service.concluir(detalhe.codAtualizacao), 'Atualização concluída.')
    );
  }

  criarComplemento() {
    const detalhe = this.detalhe()!;
    this.mtxDialog.confirm(
      `Criar complemento de ${detalhe.numero}?`,
      'Uma nova atualização vinculada, com o mesmo sistema, motivo e ticket, para os artefatos que chegaram depois da produção.',
      () =>
        this.service.criarComplemento(detalhe.codAtualizacao).subscribe({
          next: complemento => {
            this.toast.success(`Complemento ${complemento.numero} criado.`);
            this.abrirAtualizacao(complemento.codAtualizacao);
          },
          error: () => {},
        })
    );
  }

  baixar(arquivo: Arquivo | null | undefined) {
    if (!arquivo) {
      return;
    }
    this.service.baixar(arquivo.codArquivo).subscribe({
      next: resposta => {
        salvarDownload(resposta, arquivo.nome);
        // O download entra na linha do tempo: recarrega só os eventos pelo detalhe.
        this.carregarSilencioso();
      },
      error: () => this.toast.error('Não foi possível baixar o arquivo. Ele pode ter sido alterado no repositório (hash diferente).'),
    });
  }

  /** Linha do tempo recolhida por padrão (só quantidade e último evento); aberta, cada evento numa linha. */
  readonly tempoAberto = signal(false);
  /** "Expandir todos" da linha do tempo: abre o detalhe de todos os eventos de uma vez. */
  readonly eventosAbertos = signal(false);

  /** Todos os JARs gerados do ambiente que falta aplicar, num zip com uma pasta por destino. */
  readonly baixandoJars = signal<Ambiente | null>(null);

  baixarJars(ambiente: Ambiente) {
    const d = this.detalhe()!;
    this.baixandoJars.set(ambiente);
    this.service
      .baixarJars(d.codAtualizacao, ambiente)
      .pipe(finalize(() => this.baixandoJars.set(null)))
      .subscribe({
        next: resposta => {
          salvarDownload(resposta, `${d.numero}-jars.zip`);
          this.carregarSilencioso();
        },
        // O erro vem como blob: lê a mensagem do backend (ex.: nenhum JAR gerado, arquivo alterado no repositório).
        error: async erro => {
          let mensagem = 'Não foi possível baixar os JARs gerados.';
          try {
            const corpo = erro?.error instanceof Blob ? JSON.parse(await erro.error.text()) : erro?.error;
            mensagem = corpo?.message ?? corpo?.mensagem ?? mensagem;
          } catch {
            // Corpo fora do formato: fica a mensagem padrão.
          }
          this.toast.error(mensagem);
        },
      });
  }

  // ------------------------------------------------------------------ apoio

  private executar(pedido: Observable<AtualizacaoDetalhe>, mensagem: string) {
    pedido.subscribe({ next: detalhe => this.atualizar(detalhe, mensagem), error: () => {} });
  }

  private atualizar(detalhe: AtualizacaoDetalhe, mensagem: string) {
    this.detalhe.set(detalhe);
    this.toast.success(mensagem);
  }

  private carregarSilencioso() {
    const atual = this.detalhe();
    if (atual) {
      this.service.detalhe(atual.codAtualizacao).subscribe({ next: d => this.detalhe.set(d), error: () => {} });
    }
  }

  private comCatalogo(acao: (catalogo: Catalogo) => void) {
    const origem: Observable<Catalogo> = this.catalogo ? of(this.catalogo) : this.service.catalogo().pipe(tap(c => (this.catalogo = c)));
    origem.subscribe({ next: acao, error: () => {} });
  }

  private abrirDialogo<C, D>(componente: ComponentType<C>, data: D, mensagem: string, config: MatDialogConfig<D> = {}) {
    this.dialog
      .open<C, D, AtualizacaoDetalhe>(componente, { maxWidth: '95vw', autoFocus: 'first-tabbable', ...config, data })
      .afterClosed()
      .subscribe(atualizada => {
        if (atualizada) {
          this.atualizar(atualizada, mensagem);
        }
      });
  }
}
