import { CommonModule } from '@angular/common';
import { Clipboard } from '@angular/cdk/clipboard';
import { Component, Inject, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatOptionModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { MtxGridColumn, MtxGridModule } from '@ng-matero/extensions/grid';
import { FormlyFieldConfig, FormlyModule } from '@ngx-formly/core';
import { HotToastService } from '@ngxpert/hot-toast';
import { finalize } from 'rxjs';

import { ScriptAgendamentoService } from './script-agendamento.service';
import { ScriptService } from '../script.service';
import {
  Script,
  ScriptAgendamento,
  ScriptAgendamentoCreate,
  ParametroAgendamento,
  DestinatarioDTO,
  AgendamentoExecucao
} from '@core';
import { extrairBindsUnicos } from '../sql-bind-parser';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import {
  escaparAspas,
  escaparHtml,
  formatarDataHoraExecucao,
  formatarCustoOracle,
  formatarTamanhoArquivo,
  calcularDuracaoExecucao,
} from './execucao-formatters';


@Component({
  selector: 'app-script-agendamento',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MtxGridModule,
    MatDialogModule,
    RouterLink,
  ],
  templateUrl: './script-agendamento.html',
  styleUrl: './script-agendamento.scss',
})
export class ScriptAgendamentoComponent implements OnInit, OnDestroy {
  private readonly toast = inject(HotToastService);
  private readonly agendamentoService = inject(ScriptAgendamentoService);
  private readonly scriptService = inject(ScriptService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialog = inject(MatDialog);

  isMobile = window.innerWidth < 768;

  list: ScriptAgendamento[] = [];
  scripts: Script[] = [];
  selecionado: ScriptAgendamento = {} as ScriptAgendamento;
  noResult = 'Nenhum agendamento cadastrado';

  /** Todo dialog aberto por este componente é registrado aqui, pra poder ser
   * fechado no ngOnDestroy — evita ficar "fantasma" aberto por cima da tela
   * de login se a sessão expirar e o Angular navegar pra fora desta rota. */
  private openDialogRefs: MatDialogRef<any>[] = [];

  columns: MtxGridColumn[] = [
    { header: 'Nome', field: 'nomeAgendamento', width: '22%' },
    { header: 'Script', field: 'scriptNome', width: '16%' },
    {
      header: 'Frequência',
      field: 'cronExpressionDescription',
      width: '16%',
      formatter: (data: ScriptAgendamento) => this.formatarFrequencia(data)
    },
    { header: 'Status Job', field: 'jobStatus', width: '11%' },
    {
      header: 'Próxima Execução',
      field: 'proximaExecucao',
      width: '19%',
      formatter: (data: ScriptAgendamento) => this.formatarProximaExecucao(data)
    },
    {
      header: 'Status',
      field: 'ativo',
      width: '9%',
      formatter: (data: ScriptAgendamento) => this.formatarStatusAtivo(data)
    },
  ];

  ngOnInit() {
    this.search();
    this.scriptService.carregarScripts().subscribe((lista: Script[]) => {
      this.scripts = lista;
    });
  }

  ngOnDestroy() {
    this.openDialogRefs.forEach(ref => ref.close());
    this.openDialogRefs = [];
  }

  /**
   * Texto puro com emoji, SEM tags HTML — a tentativa anterior com HTML+style
   * inline via formatter também não funcionou (provavelmente o sanitizador
   * de HTML do mtx-grid preserva a tag mas descarta o atributo style). Emoji
   * colorido é renderizado nativamente pelo SO/navegador, sem depender de
   * HTML/CSS sobreviver a nenhuma sanitização.
   */
  private formatarStatusAtivo(data: ScriptAgendamento): string {
    return data.ativo ? '🟢 Ativo' : '⏸️ Pausado';
  }

  /** Mostra a tradução do cron; cai pra expressão crua se a tradução falhar. Tooltip sempre mostra o cron original. */
  private formatarFrequencia(data: ScriptAgendamento): string {
    const texto = data.cronExpressionDescription || data.cronExpression || '-';
    const cron = data.cronExpression || '';
    return `<span title="${cron.replace(/"/g, '&quot;')}">${texto}</span>`;
  }

  /** Abre e registra o dialog pra rastreamento — usar sempre isto em vez de this.dialog.open direto. */
  private abrirDialogRastreado<T, R = any>(componente: any, config: any): MatDialogRef<T, R> {
    const ref = this.dialog.open<T, any, R>(componente, config);
    this.openDialogRefs.push(ref);
    ref.afterClosed().subscribe(() => {
      this.openDialogRefs = this.openDialogRefs.filter(r => r !== ref);
    });
    return ref;
  }

  search() {
    this.agendamentoService.carregarAgendamentos().subscribe(dados => {
      this.list = dados;
      this.selecionado = {} as ScriptAgendamento;
      this.cdr.detectChanges();
    });
  }

  onRowClick(event: any) {
    this.selecionado = event.rowData ? { ...event.rowData } : ({} as ScriptAgendamento);
  }

  formatarProximaExecucao(agendamento: ScriptAgendamento): string {
    if (!agendamento.ativo) {
      return '<span style="opacity: 0.6;">Pausado</span>';
    }
    if (!agendamento.proximaExecucao) {
      return '-';
    }
    const data = new Date(agendamento.proximaExecucao);
    const dataFormatada = data.toLocaleDateString('pt-BR');
    const horaFormatada = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${dataFormatada} ${horaFormatada}`;
  }

  openAddDialog() {
    const dialogRef = this.abrirDialogRastreado(DialogAgendamentoComponent, {
      data: { modo: 'adicionar', agendamento: {}, scripts: this.scripts },
      maxWidth: '90vw',
      maxHeight: '90vh',
      height: '90%',
      width: this.isMobile ? '95%' : '700px',
      panelClass: 'full-screen-modal',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result !== 'cancelado') {
        this.search();
        this.toast.success('Agendamento criado com sucesso!');
      }
    });
  }

  openEditDialog() {
    if (!this.selecionado.codAgendamento) {
      this.toast.warning('Selecione um agendamento para editar!');
      return;
    }

    const dialogRef = this.abrirDialogRastreado(DialogAgendamentoComponent, {
      data: { modo: 'editar', agendamento: this.selecionado, scripts: this.scripts },
      maxWidth: '90vw',
      maxHeight: '90vh',
      height: '90%',
      width: this.isMobile ? '95%' : '700px',
      panelClass: 'full-screen-modal',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result !== 'cancelado') {
        this.search();
        this.toast.success('Agendamento atualizado com sucesso!');
      }
    });
  }

  ativar() {
    if (!this.selecionado.codAgendamento) return;
    this.agendamentoService.ativarAgendamento(this.selecionado.codAgendamento).subscribe({
      next: () => {
        this.toast.success('Agendamento ativado');
        this.search();
      },
      error: (error) => {
        this.toast.error('Erro ao ativar agendamento!');
        console.error(error);
      }
    });
  }

  desativar() {
    if (!this.selecionado.codAgendamento) return;
    this.agendamentoService.desativarAgendamento(this.selecionado.codAgendamento).subscribe({
      next: () => {
        this.toast.success('Agendamento pausado');
        this.search();
      },
      error: (error) => {
        this.toast.error('Erro ao pausar agendamento!');
        console.error(error);
      }
    });
  }

  executarAgora() {
    if (!this.selecionado.codAgendamento) return;
    this.agendamentoService.executarAgora(this.selecionado.codAgendamento)
      .pipe(finalize(() => {}))
      .subscribe({
        next: () => {
          this.toast.success('Execução disparada. Acompanhe no Histórico de Execuções.');
        },
        error: (error) => {
          this.toast.error('Erro ao disparar execução!');
          console.error(error);
        }
      });
  }

  abrirHistorico() {
    if (!this.selecionado.codAgendamento) return;
    this.abrirDialogRastreado(DialogHistoricoExecucaoComponent, {
      data: { codAgendamento: this.selecionado.codAgendamento, nomeAgendamento: this.selecionado.nomeAgendamento },
      maxWidth: '98vw',
      maxHeight: '92vh',
      width: this.isMobile ? '98%' : '1500px',
    });
  }

  openDeleteDialog() {
    if (!this.selecionado.codAgendamento) {
      this.toast.warning('Selecione um agendamento para excluir!');
      return;
    }

    const dialogRef = this.abrirDialogRastreado(ConfirmDialogComponent, {
      data: {
        title: 'Confirmar Exclusão',
        message: `Tem certeza que deseja excluir o agendamento "${this.selecionado.nomeAgendamento}"? O job será removido do Quartz e o histórico de execuções será apagado.`,
        confirmButtonText: 'Excluir'
      },
      width: this.isMobile ? '90%' : '400px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.agendamentoService.deletarAgendamento(this.selecionado.codAgendamento!).subscribe({
          next: () => {
            this.toast.success('Agendamento excluído com sucesso!');
            this.search();
          },
          error: (error) => {
            this.toast.error('Erro ao excluir agendamento!');
            console.error(error);
          }
        });
      }
    });
  }
}


// -------------------------------------------------------- Dialog Add/Edit
@Component({
  selector: 'dialog-agendamento',
  templateUrl: 'dialog-agendamento.html',
  styleUrl: './dialog-agendamento.scss',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatOptionModule,
    MatListModule,
    MatDividerModule,
    MatTooltipModule,
    FormlyModule,
  ],
})
export class DialogAgendamentoComponent {
  private readonly agendamentoService = inject(ScriptAgendamentoService);
  private readonly scriptService = inject(ScriptService);
  private readonly toast = inject(HotToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  form = new FormGroup({});
  model: any = {};
  fields: FormlyFieldConfig[] = [];

  scripts: Script[] = [];
  parametros: ParametroAgendamento[] = [];
  tipoSqlSelecionado: 'QUERY' | 'PROCEDURE' | 'FUNCTION' | null = null;
  destinatarios: DestinatarioDTO[] = [];

  novoDestinatarioEmail = '';
  novoDestinatarioTipo: 'TO' | 'CC' | 'CCO' = 'TO';

  // ------------------------------------------------------- Frequência (cron)
  tipoFrequencia: 'diario' | 'semanal' | 'mensal' | 'personalizado' = 'diario';
  horario = '06:00';
  diaDoMes = 1;
  cronPersonalizado = '';

  diasSemanaLista = [
    { codigo: 'MON', label: 'Seg' },
    { codigo: 'TUE', label: 'Ter' },
    { codigo: 'WED', label: 'Qua' },
    { codigo: 'THU', label: 'Qui' },
    { codigo: 'FRI', label: 'Sex' },
    { codigo: 'SAT', label: 'Sáb' },
    { codigo: 'SUN', label: 'Dom' },
  ];
  diasSemana: { [codigo: string]: boolean } = {
    MON: false, TUE: false, WED: false, THU: false, FRI: false, SAT: false, SUN: false,
  };

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<DialogAgendamentoComponent>
  ) {
    this.scripts = data.scripts || [];
    this.initializeForm();
  }

  private initializeForm() {
    const agendamento = this.data.agendamento || {};

    this.model = {
      nomeAgendamento: agendamento.nomeAgendamento || '',
      codSql: agendamento.codSql || null,
      cronExpression: agendamento.cronExpression || '',
      nomeArquivo: agendamento.nomeArquivo || '',
      // Novos agendamentos: recupera por padrão. Edição: mantém o que veio.
      recuperarMisfire: agendamento.recuperarMisfire ?? true,
    };

    this.destinatarios = agendamento.destinatarios ? [...agendamento.destinatarios] : [];

    this.fields = [
      {
        key: 'nomeAgendamento',
        type: 'input',
        templateOptions: {
          label: 'Nome do Agendamento',
          required: true,
          maxLength: 200
        }
      },
      {
        key: 'codSql',
        type: 'select',
        templateOptions: {
          label: 'Script',
          placeholder: 'Selecione o script a ser exportado',
          required: true,
          options: this.scripts.map(s => ({ value: s.codSql, label: s.nome }))
        },
        expressionProperties: {
          'templateOptions.disabled': () => this.data.modo === 'editar',
        },
        hooks: {
          onInit: (field) => {
            field?.formControl?.valueChanges.subscribe((codSql: number | string) => {
              this.onScriptChange(codSql);
            });
          }
        }
      },
      {
        key: 'nomeArquivo',
        type: 'input',
        templateOptions: {
          label: 'Nome do Arquivo (opcional)',
          placeholder: 'ex: DRE_{DATA} — se em branco, usa o nome do agendamento',
          description: 'Tokens disponíveis: {DATA} (dd-mm-aaaa), {HORA} (hhmmss), {DATAHORA}. Extensão (.xlsx/.zip) é adicionada automaticamente.'
        }
      }
    ];

    if (agendamento.cronExpression) {
      this.interpretarCronExistente(agendamento.cronExpression);
    } else {
      this.atualizarCronExpression();
    }

    if (agendamento.codSql) {
      this.onScriptChange(agendamento.codSql, agendamento.parametros);
    }
  }

  // ------------------------------------------------------- Frequência (cron)

  onTipoFrequenciaChange() {
    if (this.tipoFrequencia === 'personalizado') {
      this.cronPersonalizado = this.model.cronExpression || '';
    } else {
      this.atualizarCronExpression();
    }
  }

  /** Monta a expressão cron do Quartz a partir dos campos "humanos" (horário, dias, dia do mês). */
  atualizarCronExpression() {
    const [horaStr, minStr] = (this.horario || '00:00').split(':');
    const hora = parseInt(horaStr, 10) || 0;
    const min = parseInt(minStr, 10) || 0;

    if (this.tipoFrequencia === 'diario') {
      this.model.cronExpression = `0 ${min} ${hora} * * ?`;
    } else if (this.tipoFrequencia === 'semanal') {
      const dias = this.diasSemanaLista.filter(d => this.diasSemana[d.codigo]).map(d => d.codigo);
      this.model.cronExpression = dias.length ? `0 ${min} ${hora} ? * ${dias.join(',')}` : '';
    } else if (this.tipoFrequencia === 'mensal') {
      const dia = this.diaDoMes && this.diaDoMes >= 1 && this.diaDoMes <= 31 ? this.diaDoMes : 1;
      this.model.cronExpression = `0 ${min} ${hora} ${dia} * ?`;
    }
  }

  onCronPersonalizadoChange(valor: string) {
    this.model.cronExpression = valor;
  }

  descricaoFrequencia(): string {
    if (this.tipoFrequencia === 'diario') {
      return `Todos os dias às ${this.horario}`;
    }
    if (this.tipoFrequencia === 'semanal') {
      const selecionados = this.diasSemanaLista.filter(d => this.diasSemana[d.codigo]).map(d => d.label);
      return selecionados.length
        ? `${selecionados.join(', ')} às ${this.horario}`
        : 'Selecione ao menos um dia da semana';
    }
    if (this.tipoFrequencia === 'mensal') {
      return `Todo dia ${this.diaDoMes} de cada mês às ${this.horario}`;
    }
    return '';
  }

  /**
   * Ao editar um agendamento existente, tenta reconhecer o padrão do cron
   * salvo (gerado por este mesmo construtor) e pré-popular os campos
   * "humanos". Qualquer coisa fora dos três padrões conhecidos cai no modo
   * "Cron Avançado" mostrando a expressão original, sem tentar adivinhar.
   */
  private interpretarCronExistente(cron: string) {
    const partes = cron.trim().split(/\s+/);
    if (partes.length < 6) {
      this.tipoFrequencia = 'personalizado';
      this.cronPersonalizado = cron;
      this.model.cronExpression = cron;
      return;
    }

    const [seg, min, hora, dom, mes, dow] = partes;

    if (seg !== '0' || mes !== '*' || isNaN(parseInt(min, 10)) || isNaN(parseInt(hora, 10))) {
      this.tipoFrequencia = 'personalizado';
      this.cronPersonalizado = cron;
      this.model.cronExpression = cron;
      return;
    }

    this.horario = `${hora.padStart(2, '0')}:${min.padStart(2, '0')}`;

    if (dom === '*' && dow === '?') {
      this.tipoFrequencia = 'diario';
    } else if (dom === '?' && dow !== '?' && dow !== '*') {
      this.tipoFrequencia = 'semanal';
      const codigos = dow.split(',');
      this.diasSemanaLista.forEach(d => this.diasSemana[d.codigo] = codigos.includes(d.codigo));
    } else if (dow === '?' && /^\d+$/.test(dom)) {
      this.tipoFrequencia = 'mensal';
      this.diaDoMes = parseInt(dom, 10);
    } else {
      this.tipoFrequencia = 'personalizado';
      this.cronPersonalizado = cron;
      this.model.cronExpression = cron;
      return;
    }

    this.atualizarCronExpression();
  }

  /**
   * Monta a lista de parâmetros do agendamento a partir do script escolhido.
   * QUERY: binds :NOME detectados automaticamente do texto do SQL (nome fica
   * readonly). PROCEDURE/FUNCTION: entrada manual, na ordem da assinatura.
   * Em edição, mescla os detectados com os já salvos (preserva tipo/valor).
   */
  onScriptChange(codSql: number | string, parametrosSalvos?: ParametroAgendamento[]) {
    const salvos = parametrosSalvos ? parametrosSalvos.map(p => ({ ...p })) : [];
    if (!codSql) {
      this.parametros = [];
      this.tipoSqlSelecionado = null;
      return;
    }

    const script = this.scripts.find(s => String(s.codSql) === String(codSql));
    this.tipoSqlSelecionado = (script?.tipoSql as any) || 'QUERY';

    if (this.tipoSqlSelecionado === 'QUERY') {
      const binds = extrairBindsUnicos(script?.sql || '');
      const porNome = new Map(salvos.map(p => [String(p.nome).toUpperCase(), p]));
      this.parametros = binds.map((nome, i) => {
        const existente = porNome.get(nome);
        return {
          nome,
          tipo: existente?.tipo || 'VARCHAR2',
          valor: existente?.valor ?? '',
          ordem: i + 1,
          detectado: true,
        } as ParametroAgendamento;
      });
    } else {
      // PROCEDURE/FUNCTION: sem texto pra analisar — lista manual (edição pré-preenche).
      this.parametros = salvos.map((p, i) => ({ ...p, ordem: p.ordem ?? i + 1, detectado: false }));
    }
    // Sem cdr.detectChanges() aqui: este método agora é 100% síncrono (a
    // detecção de binds analisa o texto localmente, sem HTTP) e é chamado
    // inclusive do construtor via initializeForm — detectChanges nesse ponto
    // dispara "ASSERTION ERROR: Should be run in update mode", pois a view
    // ainda está sendo criada. Como não há callback assíncrono, o ciclo
    // normal de change detection do Angular já rende a lista corretamente.
  }

  redetectarParametros() {
    this.onScriptChange(this.model.codSql, this.parametros);
  }

  adicionarParametroManual() {
    this.parametros.push({
      nome: '',
      tipo: 'VARCHAR2',
      valor: '',
      ordem: this.parametros.length + 1,
      detectado: false,
    });
  }

  removerParametro(index: number) {
    this.parametros.splice(index, 1);
  }

  adicionarDestinatario() {
    const email = this.novoDestinatarioEmail.trim();
    if (!email) {
      this.toast.warning('Informe um e-mail');
      return;
    }
    if (!email.includes('@')) {
      this.toast.warning('E-mail inválido');
      return;
    }
    this.destinatarios.push({ email, tipo: this.novoDestinatarioTipo });
    this.novoDestinatarioEmail = '';
    this.novoDestinatarioTipo = 'TO';
  }

  removerDestinatario(index: number) {
    this.destinatarios.splice(index, 1);
  }

  submit() {
    if (!this.form.valid) {
      return;
    }

    if (!this.model.cronExpression || !this.model.cronExpression.trim()) {
      if (this.tipoFrequencia === 'semanal') {
        this.toast.warning('Selecione ao menos um dia da semana');
      } else {
        this.toast.warning('Defina a frequência do agendamento');
      }
      return;
    }

    const temTo = this.destinatarios.some(d => d.tipo === 'TO');
    if (!temTo) {
      this.toast.warning('É necessário ao menos um destinatário do tipo TO');
      return;
    }

    // Todo parâmetro precisa de nome; valor pode ficar vazio (vira bind NULL).
    const nomesVistos = new Set<string>();
    for (const p of this.parametros) {
      const nome = (p.nome || '').trim().toUpperCase();
      if (!nome) {
        this.toast.warning('Há um parâmetro sem nome preenchido');
        return;
      }
      if (nomesVistos.has(nome)) {
        this.toast.warning(`Parâmetro "${nome}" está duplicado`);
        return;
      }
      nomesVistos.add(nome);
      p.nome = nome;
    }

    const dto: ScriptAgendamentoCreate = {
      codSql: this.model.codSql,
      nomeAgendamento: this.model.nomeAgendamento,
      cronExpression: this.model.cronExpression,
      formatoSaida: 'XLSX_ZIP',
      nomeArquivo: this.model.nomeArquivo || undefined,
      recuperarMisfire: this.model.recuperarMisfire !== false,
      parametros: this.parametros,
      destinatarios: this.destinatarios,
    };

    const operacao = this.data.modo === 'editar'
      ? this.agendamentoService.atualizarAgendamento(this.data.agendamento.codAgendamento, dto)
      : this.agendamentoService.salvarAgendamento(dto);

    operacao.subscribe({
      next: () => {
        this.dialogRef.close('sucesso');
      },
      error: (error) => {
        const msg = error?.error?.message ||
          (this.data.modo === 'editar' ? 'Falha ao atualizar agendamento' : 'Falha ao criar agendamento');
        this.toast.error(msg);
        console.error(error);
      }
    });
  }

  cancelar() {
    this.dialogRef.close('cancelado');
  }
}


// -------------------------------------------------------- Dialog Histórico
@Component({
  selector: 'dialog-historico-execucao',
  templateUrl: 'dialog-historico-execucao.html',
  styleUrl: './dialog-historico-execucao.scss',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatTooltipModule,
    MatSlideToggleModule,
    MtxGridModule,
  ],
})
export class DialogHistoricoExecucaoComponent implements OnInit, OnDestroy {
  private readonly agendamentoService = inject(ScriptAgendamentoService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly clipboard = inject(Clipboard);
  private readonly toast = inject(HotToastService);
  private readonly dialog = inject(MatDialog);

  execucoes: AgendamentoExecucao[] = [];
  carregando = false;
  autoAtualizar = true;
  ultimaAtualizacao: Date | null = null;
  /** codExecucao cujo download está em andamento (mostra spinner na linha). */
  baixandoCodExecucao: number | null = null;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private static readonly INTERVALO_MS = 5000;
  private static readonly STATUS_EM_ANDAMENTO = ['EXECUTANDO', 'GERANDO_ARQUIVO', 'ENVIANDO'];
  /** Espelha ScriptAgendamentoService.STATUS_ABERTOS no backend — execuções nesses status não podem ser excluídas. */
  private static readonly STATUS_BLOQUEIA_EXCLUSAO = ['EXECUTANDO', 'GERANDO_ARQUIVO', 'ENVIANDO', 'AGUARDANDO_REENVIO'];
  private static readonly DESCRICAO_STATUS: { [status: string]: string } = {
    CONCLUIDO: 'Execução concluída com sucesso',
    ERRO: 'Execução falhou — clique na linha para copiar o erro completo',
    EXECUTANDO: 'Extraindo dados do banco',
    GERANDO_ARQUIVO: 'Gerando o arquivo Excel/Zip',
    ENVIANDO: 'Enviando por e-mail (ou Google Drive)',
    AGUARDANDO_REENVIO: 'Arquivo gerado, mas o envio do e-mail falhou (rede/relay) — a fila de reenvio está tentando novamente',
  };

  columns: MtxGridColumn[] = [
    { header: 'Início', field: 'dtInicio', width: '11%', formatter: (data: AgendamentoExecucao) => formatarDataHoraExecucao(data.dtInicio) },
    { header: 'Fim', field: 'dtFim', width: '11%', formatter: (data: AgendamentoExecucao) => formatarDataHoraExecucao(data.dtFim) },
    { header: 'Duração', field: 'duracao', width: '8%', formatter: (data: AgendamentoExecucao) => calcularDuracaoExecucao(data.dtInicio, data.dtFim) },
    { header: 'Status', field: 'status', width: '11%', formatter: (data: AgendamentoExecucao) => this.formatarStatus(data) },
    { header: 'Linhas', field: 'qtdLinhas', width: '6%' },
    { header: 'Tamanho', field: 'tamanhoArquivoKb', width: '7%', formatter: (data: AgendamentoExecucao) => formatarTamanhoArquivo(data.tamanhoArquivoKb) },
    { header: 'Custo Oracle', field: 'custoOracle', width: '12%', formatter: (data: AgendamentoExecucao) => formatarCustoOracle(data) },
    { header: 'Instância', field: 'instanceId', width: '8%' },
    { header: 'Arquivo', field: 'download', width: '7%', formatter: (data: AgendamentoExecucao) => this.formatarDownload(data) },
    { header: 'Drive', field: 'driveLink', width: '6%', formatter: (data: AgendamentoExecucao) => this.formatarDriveLink(data) },
    { header: 'Erro', field: 'msgErro', width: '13%', formatter: (data: AgendamentoExecucao) => this.formatarErro(data) },
    { header: 'Excluir', field: 'excluir', width: '6%', formatter: (data: AgendamentoExecucao) => this.formatarExcluir(data) },
  ];

  constructor(
    @Inject(MAT_DIALOG_DATA) public dataDialog: { codAgendamento: number; nomeAgendamento: string },
    private dialogRef: MatDialogRef<DialogHistoricoExecucaoComponent>
  ) {}

  ngOnInit() {
    this.carregar();
    this.iniciarAutoAtualizacao();
  }

  ngOnDestroy() {
    this.pararAutoAtualizacao();
  }

  /**
   * Emoji (garantido, é só texto) + classe CSS global via ::ng-deep (não
   * style inline — a tentativa anterior com style="color:..." não emplacou,
   * provavelmente removido por sanitização de HTML do mtx-grid; o atributo
   * "class" costuma sobreviver a esse tipo de sanitização, "style" não).
   * title="" é atributo nativo do HTML (tooltip do navegador) — sobrevive a
   * qualquer sanitização, então é a forma mais confiável de dar contexto
   * extra sem depender de nada específico do Angular/mtx-grid.
   */
  private formatarStatus(data: AgendamentoExecucao): string {
    const classe = data.status === 'CONCLUIDO' ? 'hist-status-ok'
      : data.status === 'ERRO' ? 'hist-status-erro'
      : data.status === 'AGUARDANDO_REENVIO' ? 'hist-status-reenvio'
      : DialogHistoricoExecucaoComponent.STATUS_EM_ANDAMENTO.includes(data.status) ? 'hist-status-andamento'
      : '';
    const emAndamento = DialogHistoricoExecucaoComponent.STATUS_EM_ANDAMENTO.includes(data.status);
    const icone = data.status === 'CONCLUIDO' ? 'check_circle'
      : data.status === 'ERRO' ? 'cancel'
      : data.status === 'AGUARDANDO_REENVIO' ? 'schedule_send'
      : emAndamento ? 'autorenew'
      : 'help_outline';
    const classeIcone = emAndamento ? 'hist-icon hist-icon-spin' : 'hist-icon';
    const descricao = DialogHistoricoExecucaoComponent.DESCRICAO_STATUS[data.status] || '';

    // Contador de tentativas de reenvio — só faz sentido mostrar quando há
    // reenvio em jogo (aguardando nova tentativa, ou falhou depois de várias).
    // Nos demais status seria sempre "1" e viraria ruído.
    const mostraTentativas = (data.status === 'AGUARDANDO_REENVIO' || data.status === 'ERRO')
      && (data.qtdTentativas ?? 0) > 1;
    const sufixoTentativas = mostraTentativas
      ? ` <span class="hist-tentativas" title="Tentativas de envio já realizadas">(${data.qtdTentativas}x)</span>`
      : '';

    return `<span class="${classe}" title="${escaparAspas(descricao)}">` +
      `<span class="material-icons ${classeIcone}">${icone}</span> ${data.status}</span>${sufixoTentativas}`;
  }

  /**
   * Ícone dentro de sua própria classe (hist-drive-link-btn) — o clique só
   * dispara ação quando o elemento clicado é (ou está dentro d)ele, não a
   * linha inteira (ver onRowClickExecucao).
   */
  private formatarDriveLink(data: AgendamentoExecucao): string {
    if (!data.driveLink) {
      return '';
    }
    return `<span class="hist-drive-link-btn hist-cod-${data.codExecucao}" title="Clique para abrir no Google Drive">` +
      `<span class="material-icons hist-icon hist-icon-bounce">open_in_new</span> Abrir</span>`;
  }

  /**
   * Botão de baixar o arquivo da execução. Disponível para execuções que
   * geraram arquivo (concluídas ou aguardando reenvio). O ícone vira um
   * spinner enquanto o download desta linha está em andamento.
   *
   * O codExecucao vai embutido na CLASSE (hist-cod-N), não em data-cod: o
   * mtx-grid sanitiza o HTML do formatter removendo atributos (data-*, style),
   * mas PRESERVA class. Por isso o clique lê o cod a partir da lista de
   * classes do elemento (ver onCliqueContainer).
   */
  private formatarDownload(data: AgendamentoExecucao): string {
    const gerouArquivo = data.status === 'CONCLUIDO' || data.status === 'AGUARDANDO_REENVIO'
      || data.status === 'ERRO';
    if (!gerouArquivo) {
      return '';
    }
    if (this.baixandoCodExecucao === data.codExecucao) {
      return `<span class="hist-download-btn hist-cod-${data.codExecucao}" title="Baixando…">` +
        `<span class="material-icons hist-icon hist-icon-spin">autorenew</span></span>`;
    }
    return `<span class="hist-download-btn hist-cod-${data.codExecucao}" title="Baixar arquivo (.zip)">` +
      `<span class="material-icons hist-icon">download</span> Baixar</span>`;
  }

  /** Ícone de copiar + mensagem truncada, com o texto completo disponível no hover (title nativo). */
  private formatarErro(data: AgendamentoExecucao): string {
    if (!data.msgErro) {
      return '';
    }
    const truncado = data.msgErro.length > 40 ? data.msgErro.substring(0, 40) + '…' : data.msgErro;
    return `<span class="hist-erro-btn hist-cod-${data.codExecucao}" title="${escaparAspas(data.msgErro)} — clique para copiar">` +
      `<span class="material-icons hist-icon">content_copy</span> ${escaparHtml(truncado)}</span>`;
  }

  /**
   * Botão de excluir a linha — oculto para execuções em andamento, e
   * substituído por um cadeado para a execução mais recente (backend também
   * bloqueia ambos os casos; isso é só o front refletindo a mesma regra sem
   * esperar o usuário clicar e levar um erro).
   */
  private formatarExcluir(data: AgendamentoExecucao): string {
    if (DialogHistoricoExecucaoComponent.STATUS_BLOQUEIA_EXCLUSAO.includes(data.status)) {
      return '';
    }
    const maisRecente = this.execucoes[0]?.codExecucao === data.codExecucao;
    if (maisRecente) {
      return `<span class="hist-excluir-disabled" title="Execução mais recente — preservada para a tela de acompanhamento">` +
        `<span class="material-icons hist-icon">lock_outline</span></span>`;
    }
    return `<span class="hist-excluir-btn hist-cod-${data.codExecucao}" title="Excluir esta execução do histórico">` +
      `<span class="material-icons hist-icon">delete_outline</span></span>`;
  }


  /**
   * Handler de clique NATIVO no container do grid (ver dialog-historico-execucao.html:
   * (click)="onCliqueContainer($event)"). Não depende do evento (rowClick) do
   * mtx-grid — cuja estrutura variou entre versões e deixava o clique "sem ação".
   * Em vez disso lê o event.target real do DOM e encontra o botão pelo data-cod
   * embutido no HTML gerado pelos formatters, casando com a execução na lista.
   */
  onCliqueContainer(event: MouseEvent) {
    const alvo = event.target as HTMLElement | null;
    if (!alvo || typeof alvo.closest !== 'function') {
      return;
    }

    const botao = alvo.closest('.hist-download-btn, .hist-drive-link-btn, .hist-erro-btn, .hist-excluir-btn') as HTMLElement | null;
    if (!botao) {
      return;
    }

    // O cod vem embutido numa classe "hist-cod-N" (atributos data-* são
    // removidos pela sanitização do mtx-grid; classes sobrevivem).
    const cod = this.extrairCodDaClasse(botao);
    const row = cod != null ? this.execucoes.find(e => e.codExecucao === cod) : undefined;
    if (!row) {
      return;
    }

    if (botao.classList.contains('hist-download-btn')) {
      this.baixarArquivo(row);
    } else if (botao.classList.contains('hist-drive-link-btn') && row.driveLink) {
      window.open(row.driveLink, '_blank', 'noopener');
    } else if (botao.classList.contains('hist-erro-btn') && row.msgErro) {
      this.clipboard.copy(row.msgErro);
      this.toast.success('Mensagem de erro copiada para a área de transferência');
    } else if (botao.classList.contains('hist-excluir-btn')) {
      this.excluirExecucaoLinha(row);
    }
  }

  /** Exclui UMA execução do histórico, com confirmação. */
  excluirExecucaoLinha(row: AgendamentoExecucao) {
    if (row.codExecucao == null) {
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Excluir execução',
        message: `Excluir o registro desta execução (${formatarDataHoraExecucao(row.dtInicio)})? Essa ação não pode ser desfeita.`,
        confirmButtonText: 'Excluir'
      },
      width: '400px'
    });

    dialogRef.afterClosed().subscribe(confirmado => {
      if (!confirmado) {
        return;
      }
      this.agendamentoService.excluirExecucao(row.codExecucao).subscribe({
        next: () => {
          this.toast.success('Execução excluída do histórico.');
          this.carregar();
        },
        error: (error) => {
          const msg = error?.error?.message || 'Falha ao excluir execução';
          this.toast.error(msg);
          console.error(error);
        }
      });
    });
  }

  /** Limpa TODO o histórico deste agendamento (execuções em andamento são preservadas pelo backend), com confirmação. */
  excluirTodoHistorico() {
    if (this.execucoes.length === 0) {
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Limpar histórico',
        message: `Excluir o histórico de execuções de "${this.dataDialog.nomeAgendamento}"? ` +
          `A execução mais recente e as que estiverem em andamento (se houver) são sempre preservadas. ` +
          `Essa ação não pode ser desfeita.`,
        confirmButtonText: 'Limpar histórico'
      },
      width: '420px'
    });

    dialogRef.afterClosed().subscribe(confirmado => {
      if (!confirmado) {
        return;
      }
      this.agendamentoService.excluirHistorico(this.dataDialog.codAgendamento).subscribe({
        next: () => {
          this.toast.success('Histórico de execuções excluído.');
          this.carregar();
        },
        error: (error) => {
          const msg = error?.error?.message || 'Falha ao excluir histórico';
          this.toast.error(msg);
          console.error(error);
        }
      });
    });
  }

  private extrairCodDaClasse(el: HTMLElement): number | null {
    for (const cls of Array.from(el.classList)) {
      if (cls.startsWith('hist-cod-')) {
        const n = Number(cls.substring('hist-cod-'.length));
        return Number.isNaN(n) ? null : n;
      }
    }
    return null;
  }

  baixarArquivo(row: AgendamentoExecucao) {
    if (row.codExecucao == null) {
      return;
    }
    if (this.baixandoCodExecucao != null) {
      // Já há um download em andamento — avisa em vez de ignorar em silêncio
      // (o formatter do mtx-grid não repinta só com detectChanges, então o
      // spinner na célula pode não aparecer; o toast é o feedback confiável).
      this.toast.warning('Um download já está em andamento, aguarde a conclusão.');
      return;
    }
    this.baixandoCodExecucao = row.codExecucao;
    this.cdr.detectChanges();

    // Feedback imediato e garantido (não depende do grid repintar a célula).
    const toastRef = this.toast.loading('Preparando o arquivo para download…');

    this.agendamentoService.baixarArquivoExecucao(row.codExecucao).subscribe({
      next: (resp) => {
        toastRef.close();
        const blob = resp.body;
        if (!blob) {
          this.toast.error('Arquivo vazio retornado pelo servidor');
          this.baixandoCodExecucao = null;
          this.cdr.detectChanges();
          return;
        }

        // Se o arquivo original já foi expurgado, o backend regenera com os
        // dados ATUAIS do banco — avisa o usuário, pois pode diferir do original.
        if (resp.headers.get('X-Arquivo-Regerado') === 'true') {
          this.toast.warning(
            'O arquivo original expirou. Foi gerada uma nova extração com os dados atuais do banco ' +
            '(pode diferir do envio original).'
          );
        }

        const nome = this.extrairNomeArquivo(resp.headers.get('Content-Disposition'))
          || `export_${row.codExecucao}.zip`;

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

  carregar() {
    this.carregando = true;
    this.cdr.detectChanges();
    this.agendamentoService.carregarHistorico(this.dataDialog.codAgendamento).subscribe({
      next: (lista) => this.aplicarResultado(() => {
        this.execucoes = lista;
        this.ultimaAtualizacao = new Date();
        this.carregando = false;
      }),
      error: (error) => {
        this.aplicarResultado(() => {
          this.carregando = false;
        });

        // Sessão expirou (ou acesso perdido) — sem isso, o auto-refresh de 5s
        // ficaria tentando pra sempre com o dialog "fantasma" aberto por cima
        // da tela de login.
        if (error?.status === 401 || error?.status === 403) {
          this.pararAutoAtualizacao();
          this.dialogRef.close();
        }
      }
    });
  }

  /**
   * Adia a atualização dos campos ligados ao template pro próximo macrotask E
   * força o detectChanges nesse novo ciclo — evita NG0100 quando a resposta
   * chega rápido demais e cai ainda dentro da janela de verificação do
   * Angular que iniciou a chamada (ver mesmo comentário em
   * UltimasExecucoesComponent.aplicarResultado).
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
    this.intervalId = setInterval(() => this.carregar(), DialogHistoricoExecucaoComponent.INTERVALO_MS);
  }

  private pararAutoAtualizacao() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  closeDialog() {
    this.dialogRef.close();
  }

}
