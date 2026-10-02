import { Component, OnInit, ChangeDetectorRef, OnDestroy, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

import { Plantao, TipoPlantao, Usuario, VistaEscala, Escala, PreferenciaFolga, AuthService,PermissaoUsuarioEscala, TipoAusencia, Ausencia } from '@core';
import { EscalaService, LogPlantao } from './escala.service';
import { EscalaRealtimeService, EscalaEvento } from './escala-realtime.service';
import { TipoPlantaoService } from './tipo-plantao.service';
import { UsuarioService } from '@core/authentication/usuario.service';
import { FeriadoService } from './feriado.service';
import { FeriasService } from './ferias.service';
import { PreferenciaFolgaService } from './preferencia-folga/preferencia-folga.service';
import { SeletorTipoPlantaoDialog } from './seletor-tipo-plantao/seletor-tipo-plantao-dialog';
import { toSignal } from '@angular/core/rxjs-interop';
import { TipoAusenciaService } from './tipo-ausencia/tipo-ausencia.service';
import { SeletorAusenciaDialog } from './tipo-ausencia/seletor-tipo-ausencia/seletor-tipo-ausencia-dialog';
import html2canvas from 'html2canvas';
import { AvisoEscalaDialogComponent } from './aviso-escala-dialog';

@Component({
  selector: 'app-escala',
  templateUrl: './escala.component.html',
  // mobile.scss depois do principal: os ajustes de celular/toque prevalecem sobre os estilos-base
  styleUrls: ['./escala.component.scss', './escala.component.mobile.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    FormsModule,
  ]
})
export class EscalaComponent implements OnInit, OnDestroy {

  private atualizandoParcialmente = false;
  private destroy$ = new Subject<void>();

  // ── Tempo real (WebSocket/STOMP) ──────────────────────────────────────────
  private realtime = inject(EscalaRealtimeService);
  private realtimeSub: Subscription | null = null;
  private realtimeMesAtual: number | null = null;
  private realtimeRefreshTimer: any = null;
  private snackBar = inject(MatSnackBar);
  private readonly auth = inject(AuthService);
  private _conflitosCache: boolean | null = null;
  private _quantidadeConflitosCache: number | null = null;

  ano: number = new Date().getFullYear();
  mes: number = new Date().getMonth() + 1;
  loading: boolean = false;
  erro: string = '';

  escalaNaoExiste: boolean = false;

  vistaEscala: VistaEscala | null = null;
  escala: Escala | null = null;
  feriados: any[] = [];
  ferias: any[] = [];
  preferenciasFolga: PreferenciaFolga[] = [];
  diasDoMes: number[] = [];
  funcionarios: Usuario[] = [];
  tiposPlantao: TipoPlantao[] = [];

  preferenciasPorUsuario: Map<number, number[]> = new Map();
  preferenciasDias: Set<number> = new Set();
  preferenciasUsuarios: Set<number> = new Set();
  permissoesUsuario: Partial<PermissaoUsuarioEscala> = {};
  permissoesConfigurada:boolean = false;

  plantaoForm: FormGroup;

  usuarioLogado =  toSignal(this.auth.user());
   //user = toSignal(this.auth.user());

  tiposAusencia: TipoAusencia[] = [];
  gridAusencias: Record<number, Record<number, Ausencia>> = {};

  mostrarTipos: boolean = true; // Inicia visível

  capturandoImagem: boolean = false;

  funcionarioSelecionadoId: number | null = null;
  ocultarNaoPlantonistas: boolean = false;
  funcionariosFiltrados: Usuario[] = [];

  // ── Telas de toque (celular/tablet) ───────────────────────────────────────
  /** Sem mouse não há hover, o duplo clique não é confiável e arrastar e soltar não funciona. */
  readonly telaToque = typeof window !== 'undefined' && !!window.matchMedia?.('(hover: none) and (pointer: coarse)')?.matches;
  /** Célula tocada: detalhes e ações em um painel inferior. No desktop fica sempre null. */
  acoesToque: {
    tipo: 'vazio' | 'plantao' | 'ausencia' | 'ferias';
    funcionarioId: number;
    nome: string;
    dia: number;
    id: number | null;
    detalhes: string;
  } | null = null;
  private acoesToqueAbertasEm = 0;

  // ── Painel de Histórico ────────────────────────────────────────────────────
  historicoPainelAberto = false;

  // ── Log de Alterações Pós-Publicação ─────────────────────────────────────
  logPainelAberto     = false;
  logCarregando       = false;
  logItens: LogPlantao[] = [];
  logFiltroAcao: 'TODOS' | 'ADICIONAR' | 'ALTERAR' | 'REMOVER' = 'TODOS';
  get logTotalAlteracoes(): number { return this.logItens.length; }
  historicoCarregando   = false;
  historicoItems: HistoricoItem[] = [];
  historicoFiltro: 'todos' | 'ponte' | 'unico_sem_ferias' = 'todos';


  constructor(
    private cdRef: ChangeDetectorRef,
    private fb: FormBuilder,
    private escalaService: EscalaService,
    private tipoPlantaoService: TipoPlantaoService,
    private funcionarioService: UsuarioService,
    private feriadoService: FeriadoService,
    private feriasService: FeriasService,
    private preferenciaFolgaService: PreferenciaFolgaService,
    private dialog: MatDialog,
    private tipoAusenciaService: TipoAusenciaService,
  ) {
    this.plantaoForm = this.fb.group({
      dia: ['', [Validators.required, Validators.min(1), Validators.max(31)]],
      idUsuario: ['', Validators.required],
      idTipoPlantao: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.carregarPermissoes();
    this.carregarEscalaCompleta();
    this.carregarTiposPlantao();
    this.carregarTiposAusencia();
    this.limparCacheConflitos();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.realtimeRefreshTimer) {
      clearTimeout(this.realtimeRefreshTimer);
      this.realtimeRefreshTimer = null;
    }
    this.realtimeSub?.unsubscribe();
    this.realtimeSub = null;
  }

  /**
   * (Re)assina o canal de tempo real para o mês informado. Tolerante a falhas:
   * qualquer problema no WebSocket não afeta o funcionamento da tela.
   */
  private assinarTempoReal(mesEscala: number): void {
    if (this.realtimeMesAtual === mesEscala && this.realtimeSub) return;
    this.realtimeSub?.unsubscribe();
    this.realtimeMesAtual = mesEscala;
    try {
      this.realtimeSub = this.realtime.observarMes(mesEscala)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: evt => this.onEventoTempoReal(evt),
          error: err => console.warn('Tempo real da escala indisponível:', err),
        });
    } catch (e) {
      console.warn('Não foi possível iniciar o tempo real da escala:', e);
    }
  }

  private onEventoTempoReal(evt: EscalaEvento): void {
    // Ignora o eco das próprias alterações.
    const meuId = Number((this.usuarioLogado() as any)?.codUsuario);
    if (evt.autorId != null && Number(evt.autorId) === meuId) return;

    // Coalesce rajadas de eventos num único refresh silencioso.
    if (this.realtimeRefreshTimer) clearTimeout(this.realtimeRefreshTimer);
    this.realtimeRefreshTimer = setTimeout(() => {
      this.realtimeRefreshTimer = null;
      this.atualizarGridParcialmente();
      const quem = evt.autorNome ? `${evt.autorNome} ` : 'Outro usuário ';
      const acao =
        evt.tipo === 'ESCALA_PUBLICADA' ? 'publicou a escala' :
        evt.tipo === 'ESCALA_REVERTIDA' ? 'reverteu a publicação' :
        evt.tipo?.startsWith('AUSENCIA') ? 'atualizou uma ausência' :
        'alterou um plantão';
      this.mostrarToast(`${quem}${acao}. Vista atualizada.`, 'info');
    }, 400);
  }

  private mostrarToast(mensagem: string, tipo: 'success' | 'error' | 'warning' | 'info' = 'info'): void {
    this.snackBar.open(mensagem, 'Fechar', {
      duration: 3000,
      panelClass: tipo === 'success' ? 'snackbar-success' :
                 tipo === 'error' ? 'snackbar-error' :
                 tipo === 'warning' ? 'snackbar-warning' : 'snackbar-info',
      horizontalPosition: 'right',
      verticalPosition: 'top'
    });
  }

  private podeEditarEscala(): boolean {
    if (this.escalaNaoExiste) {
      this.mostrarToast('Gere a escala primeiro antes de realizar operações.', 'warning');
      return false;
    }
    return this.podeCriar() || this.podeEditar();
  }

  private podeAdicionarRemoverPlantao(): boolean {
    if (this.escalaNaoExiste) {
      this.mostrarToast('Gere a escala primeiro antes de realizar operações.', 'warning');
      return false;
    }
    if (this.podeCriar()) return true;
    if (this.podeEditar()) return true;

    if (this.podeReorganizar()) {
      this.mostrarToast('Usuários com permissão de Reorganizar só podem mover plantões, não adicionar ou remover.', 'warning');
      return false;
    }

    this.mostrarToast('Você não tem permissão para alterar esta escala.', 'warning');
    return false;
  }

  private podeMoverPlantao(): boolean {
    if (this.escalaNaoExiste) return false;
    return this.podeReorganizar() || this.podeCriar() || this.podeEditar();
  }

  carregarEscalaCompleta(): void {
    this.limparCacheConflitos();

    // Invalida o histórico sempre que o mês de referência mudar.
    // Se o painel já estiver aberto, recarrega imediatamente.
    this.historicoItems = [];
    if (this.historicoPainelAberto) {
      this.carregarHistorico();
    }

    if (this.atualizandoParcialmente) return;

    this.loading = true;
    this.erro = '';
    this.escalaNaoExiste = false;

    const mesEscala = this.ano * 100 + this.mes;

    this.escalaService.getEscala(mesEscala)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (vista: VistaEscala) => {
          this.vistaEscala = vista;
          this.escala = vista.escala || null;
          this.assinarTempoReal(mesEscala);
          this.diasDoMes = this.gerarDiasDoMes();
          this.escalaNaoExiste = !vista.escala;
          this.processarPreferenciasDaVista(vista);
          this.processarAusenciasDaVista(vista);
          if (!this.escalaNaoExiste) {
            this.carregarDadosAdicionais();
          } else {
            this.loading = false;
          }
           this.aplicarFiltroFuncionarios();
           this.cdRef.detectChanges(); // Força atualização da view
        },
        error: (error: any) => {
          if (error.status === 404) {
            this.escalaNaoExiste = true;
          } else {
            this.erro = 'Erro ao comunicar com o servidor';
            this.mostrarToast(this.erro, 'error');
          }
          this.loading = false;
          this.aplicarFiltroFuncionarios();
          this.cdRef.detectChanges(); // Força atualização da view
        }
      });
  }

  private atualizarGridParcialmente(): void {
     this.limparCacheConflitos();
    this.atualizandoParcialmente = true;
    const mesEscala = this.ano * 100 + this.mes;

    this.escalaService.getEscala(mesEscala, true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (vista: VistaEscala) => {
          if (this.vistaEscala && vista) {
            this.vistaEscala.grid = vista.grid;
            this.vistaEscala.contagens = vista.contagens;
            this.vistaEscala.totais = vista.totais;
            this.processarPreferenciasDaVista(vista);
            this.processarAusenciasDaVista(vista);
            if (vista.escala && this.escala) this.escala.publicado = vista.escala.publicado;
          }
          this.atualizandoParcialmente = false;
          this.cdRef.detectChanges();
        },
        error: (error: any) => {
          console.error('Erro ao atualizar grid parcialmente:', error);
          this.atualizandoParcialmente = false;
          this.cdRef.detectChanges();
        }
      });
  }

    private carregarPermissoes(): void {
    this.loading = true;
    this.escalaService.getPermissao()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (permissao) => {
          this.permissoesUsuario = permissao;
           this.permissoesConfigurada = true;
          this.cdRef.detectChanges();
        },
        error: (erro) => {
          console.log(erro.status);
          if(erro.status = 403){
            this.permissoesConfigurada = false;
          }
          this.permissoesUsuario = {} as PermissaoUsuarioEscala;
          this.cdRef.detectChanges();
        }
      });

       this.cdRef.detectChanges();
    }

  private carregarDadosAdicionais(): void {
    this.feriadoService.getFeriados(this.ano, this.mes)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (feriados) => {
          this.feriados = feriados;
           this.limparCacheConflitos();
          this.cdRef.detectChanges();
        },
        error: () => {
          this.feriados = [];
           this.limparCacheConflitos();
          this.cdRef.detectChanges();
        }
      });

    this.feriasService.getFeriasPorPeriodo(this.ano, this.mes)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (ferias) => {
          this.ferias = ferias;
           this.limparCacheConflitos();
          this.cdRef.detectChanges();
        },
        error: () => {
          this.ferias = [];
           this.limparCacheConflitos();
          this.cdRef.detectChanges();
        }
      });

    this.carregarPreferenciasFolga();

    /*this.funcionarioService.getTodos()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (funcionarios: any) => {
          if (Array.isArray(funcionarios)) this.funcionarios = funcionarios;
          else if (funcionarios?.data) this.funcionarios = funcionarios.data;
          else this.funcionarios = [];
          this.loading = false;
          this.cdRef.detectChanges();
          console.table(funcionarios);
        },
        error: () => {
          this.funcionarios = [];
          this.loading = false;
          this.cdRef.detectChanges();
        }
      });*/

       this.loading = false;
  }

  private carregarPreferenciasFolga(): void {
    this.preferenciaFolgaService.listarPorMesAno(this.mes, this.ano)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (preferencias) => {
          this.preferenciasFolga = preferencias;
          this.processarPreferenciasServico(preferencias);
          this.cdRef.detectChanges();
        },
        error: () => {
          this.preferenciasFolga = [];
          this.cdRef.detectChanges();
        }
      });
  }

  private processarPreferenciasServico(preferencias: PreferenciaFolga[]): void {
    preferencias.forEach(pref => {
      let data: Date;
      if (typeof pref.dataFolga === 'string') {
        const parts = pref.dataFolga.split('-');
        data = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      } else if (pref.dataFolga instanceof Date) {
        data = pref.dataFolga;
      } else {
        data = new Date(pref.dataFolga);
      }
      const dia = data.getDate();
      const dataMes = data.getMonth() + 1;
      const dataAno = data.getFullYear();
      const idUsuario = pref.idUsuario;

      if (dataMes === this.mes && dataAno === this.ano) {
        this.preferenciasDias.add(dia);
        this.preferenciasUsuarios.add(idUsuario);
        if (!this.preferenciasPorUsuario.has(idUsuario)) this.preferenciasPorUsuario.set(idUsuario, []);
        if (!this.preferenciasPorUsuario.get(idUsuario)!.includes(dia)) {
          this.preferenciasPorUsuario.get(idUsuario)!.push(dia);
        }
      }
    });
  }

  private processarPreferenciasDaVista(vista: VistaEscala): void {
    this.preferenciasPorUsuario.clear();
    this.preferenciasDias.clear();
    this.preferenciasUsuarios.clear();
    if (vista.preferenciasPorUsuario) {
      Object.entries(vista.preferenciasPorUsuario).forEach(([userId, dias]: [string, any]) => {
        const idUsuario = parseInt(userId);
        const diasArray = Array.isArray(dias) ? dias : [];
        diasArray.forEach((dia: number) => {
          this.preferenciasDias.add(dia);
          this.preferenciasUsuarios.add(idUsuario);
          if (!this.preferenciasPorUsuario.has(idUsuario)) this.preferenciasPorUsuario.set(idUsuario, []);
          if (!this.preferenciasPorUsuario.get(idUsuario)!.includes(dia)) {
            this.preferenciasPorUsuario.get(idUsuario)!.push(dia);
          }
        });
      });
    }
  }

  private carregarTiposPlantao(): void {
    this.tipoPlantaoService.getTiposPlantao()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tipos) => this.tiposPlantao = tipos,
        error: () => this.tiposPlantao = []
      });
      this.cdRef.detectChanges();
  }

  temPreferenciaFolga(funcionarioId: number, dia: number): boolean {
    return this.preferenciasPorUsuario.get(funcionarioId)?.includes(dia) ?? false;
  }

  getTextoPreferencia(): string { return 'PF'; }

  contarTotalPreferencias(): number {
    return this.vistaEscala?.preferencias?.length || 0;
  }

  contarUsuariosComPreferencia(): number {
    return this.preferenciasUsuarios.size;
  }

  gerarEscala(): void {
    if (confirm(`Deseja gerar a escala para ${this.getNomeMes()}/${this.ano}?`)) {
      this.loading = true;
      this.escalaService.gerarEscala(this.ano, this.mes, 1)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.mostrarToast(`Escala para ${this.getNomeMes()}/${this.ano} gerada com sucesso!`, 'success');
            this.carregarEscalaCompleta();
          },
          error: (error) => {
            this.erro = error.message || 'Erro ao gerar escala';
            this.mostrarToast(this.erro, 'error');
            this.loading = false;
          }
        });
    }
  }

  adicionarPlantao(): void {
    if (!this.podeAdicionarRemoverPlantao()) return;
    if (this.plantaoForm.invalid) {
      this.marcarCamposComoSujos(this.plantaoForm);
      this.mostrarToast('Preencha todos os campos obrigatórios.', 'warning');
      return;
    }
    if (!this.escala?.id) {
      this.mostrarToast('Erro: Escala não carregada ou sem ID.', 'error');
      return;
    }
    const formValue = this.plantaoForm.value;
    const mesEscala = this.ano * 100 + this.mes;
    if (this.estaDeFerias(formValue.idUsuario, formValue.dia)) {
      this.mostrarToast('Não é possível adicionar plantão: funcionário está de férias neste dia!', 'warning');
      return;
    }

    const plantao: Plantao = {
      mesEscala,
      dia: formValue.dia,
      idUsuario: formValue.idUsuario,
      idTipoPlantao: formValue.idTipoPlantao,
      idEscala: this.escala.id
    };

    this.escalaService.salvarPlantao(plantao, this.escala.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (resposta: any) => {
          this.plantaoForm.reset();
          this.mostrarToast('Plantão salvo com sucesso!', 'success');
          const plantaoSalvo = { ...plantao, id: resposta.id };
          this.atualizarGridLocal(null, plantaoSalvo);
          this.cdRef.detectChanges(); // Força atualização imediata
        },
        error: (error) => {
          this.mostrarToast(error.message, 'error');
        }
      });
      this.limparCacheConflitos();
  }

  editarPlantao(plantao: Plantao): void {
    if (!this.podeMoverPlantao()) return;
    if (this.estaDeFerias(plantao.idUsuario, plantao.dia)) {
      this.mostrarToast('Não é possível atualizar plantão: funcionário está de férias neste dia!', 'warning');
      return;
    }

    const posicaoOriginal = this.encontrarPosicaoPlantaoPorId(plantao.id!);
    const plantaoOriginal = posicaoOriginal
      ? this.getPlantao(posicaoOriginal.funcionarioId, posicaoOriginal.dia)
      : null;

    const plantaoParaEnviar: Plantao = {
      id: plantao.id,
      mesEscala: plantao.mesEscala,
      dia: plantao.dia,
      idUsuario: plantao.idUsuario,
      idTipoPlantao: plantao.idTipoPlantao,
      idEscala: this.escala!.id
    };

    this.escalaService.salvarPlantao(plantaoParaEnviar, this.escala!.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (resposta: any) => {
          this.mostrarToast('Plantão atualizado com sucesso!', 'success');
          const plantaoAtualizado = { ...plantaoParaEnviar, id: resposta.id };
          this.atualizarGridLocal(plantaoOriginal, plantaoAtualizado);
          this.cdRef.detectChanges(); // Força atualização imediata
        },
        error: (error) => {
          this.mostrarToast(error.message, 'error');
        }
      });
  }

  removerPlantao(plantaoId: number, event?: Event): void {
    if (event) event.stopPropagation();
    if (!this.podeAdicionarRemoverPlantao()) return;
    if (!confirm('Deseja remover este plantão?')) return;

    let plantaoRemovido: Plantao | null = null;
    for (const [idUsuario, dias] of Object.entries(this.vistaEscala?.grid || {})) {
      for (const [dia, p] of Object.entries(dias)) {
        if (p?.id === plantaoId) {
          plantaoRemovido = p;
          break;
        }
      }
    }

    if (!plantaoRemovido) {
      this.mostrarToast('Plantão não encontrado.', 'error');
      return;
    }

    this.escalaService.removerPlantao(plantaoId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.mostrarToast('Plantão removido com sucesso!', 'success');
          if (this.vistaEscala?.grid[plantaoRemovido!.idUsuario]) {
            delete this.vistaEscala.grid[plantaoRemovido!.idUsuario][plantaoRemovido!.dia];
          }
          this.recalcularContagens();
          this.cdRef.detectChanges(); // Força atualização imediata
        },
        error: (error) => {
          const errorMessage = error?.message || 'Erro ao processar a requisição';
          this.mostrarToast(errorMessage, 'error');
        }
      });
      this.limparCacheConflitos();
  }

  publicarEscala(): void {
    if (!this.escala) return;
    if (!this.podeCriar()) {
      this.mostrarToast('Você não tem permissão para publicar a escala.', 'warning');
      return;
    }
    if (confirm('Tem certeza que deseja publicar a escala? Esta ação não pode ser desfeita.')) {
      const mesEscala = this.ano * 100 + this.mes;
      this.escalaService.publicarEscala(mesEscala,'Escala publicada')
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.mostrarToast('Escala publicada com sucesso!', 'success');
            if (this.escala) this.escala.publicado = true;
            this.cdRef.detectChanges();
          },
          error: (error) => this.mostrarToast(error.message, 'error')
        });
    }
  }

  reverterPublicacao(): void {
    if (!this.escala) return;
    if (!this.podeCriar()) {
      this.mostrarToast('Você não tem permissão para reverter a publicação.', 'warning');
      return;
    }
    if (confirm('Tem certeza que deseja reverter a publicação da escala?')) {
      const mesEscala = this.ano * 100 + this.mes;
      this.escalaService.reverterPublicacao(mesEscala)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.mostrarToast('Publicação revertida com sucesso!', 'success');
            if (this.escala) this.escala.publicado = false;
            this.cdRef.detectChanges();
          },
          error: (error) => this.mostrarToast(error.message, 'error')
        });
    }
  }

  mesAnterior(): void {
    if (this.mes === 1) { this.mes = 12; this.ano--; } else { this.mes--; }
    this.carregarEscalaCompleta();
  }

  proximoMes(): void {
    if (this.mes === 12) { this.mes = 1; this.ano++; } else { this.mes++; }
    this.carregarEscalaCompleta();
  }

  gerarDiasDoMes(): number[] {
    const diasNoMes = new Date(this.ano, this.mes, 0).getDate();
    return Array.from({ length: diasNoMes }, (_, i) => i + 1);
  }

  getNomeMes(): string {
    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    return meses[this.mes - 1];
  }

  getDiaSemana(dia: number): string {
    try {
      const data = new Date(this.ano, this.mes - 1, dia);
      return ['DOM','SEG','TER','QUA','QUI','SEX','SAB'][data.getDay()];
    } catch { return ''; }
  }

  ehSabado(dia: number): boolean {
    try { return new Date(this.ano, this.mes - 1, dia).getDay() === 6; } catch { return false; }
  }

  ehDomingo(dia: number): boolean {
    try { return new Date(this.ano, this.mes - 1, dia).getDay() === 0; } catch { return false; }
  }

  ehFimDeSemana(dia: number): boolean {
    return this.ehSabado(dia) || this.ehDomingo(dia);
  }

  contarFinsDeSemana(): number {
    return this.diasDoMes.filter(dia => this.ehFimDeSemana(dia)).length;
  }

  ehFeriado(dia: number): boolean {
    if (!this.feriados?.length) return false;
    const dataDia = new Date(this.ano, this.mes - 1, dia);
    const dataDiaISO = dataDia.toISOString().split('T')[0];
    return this.feriados.some(f => (f.data && f.data === dataDiaISO) || (f.dia !== undefined && f.dia === dia));
  }

  getDescricaoFeriado(dia: number): string {
    if (!this.feriados?.length) return 'Feriado';
    const dataDia = new Date(this.ano, this.mes - 1, dia);
    const dataDiaISO = dataDia.toISOString().split('T')[0];
    const feriado = this.feriados.find(f => (f.data && f.data === dataDiaISO) || (f.dia !== undefined && f.dia === dia));
    return feriado?.nome || feriado?.descricao || 'Feriado';
  }

  estaDeFerias(funcionarioId: number, dia: number): boolean {
    if (!this.ferias?.length) return false;
    const dataDia = new Date(this.ano, this.mes - 1, dia);
    const dataDiaISO = dataDia.toISOString().split('T')[0];
    return this.ferias.some(f => f.idUsuario === funcionarioId &&
           this.dataEstaNoPeriodo(dataDiaISO, f.dataInicio, f.dataFim));
  }

  private dataEstaNoPeriodo(data: string, inicio: string, fim: string): boolean {
    return new Date(data) >= new Date(inicio) && new Date(data) <= new Date(fim);
  }

  contarFuncionariosFerias(): number {
    return new Set(this.ferias.map(f => f.idUsuario)).size;
  }

  getTitleCelula(funcionarioId: number, dia: number): string {
    const partes = [`${this.getDiaSemana(dia)} - ${dia}/${this.mes}`];
    if (this.ehFeriado(dia)) partes.push(`Feriado: ${this.getDescricaoFeriado(dia)}`);
    if (this.estaDeFerias(funcionarioId, dia)) partes.push('FÉRIAS');
    if (this.temPreferenciaFolga(funcionarioId, dia)) partes.push('Pref. Folga');
    if (!this.escalaNaoExiste) {
      const plantao = this.getPlantao(funcionarioId, dia);
      if (plantao) partes.push(`Plantão: ${this.getNomeTipoPlantao(plantao.idTipoPlantao)}`);
    }
    return partes.join(' | ');
  }

  getPlantao(funcionarioId: number, dia: number): Plantao | null {
    if (!this.vistaEscala?.grid || this.escalaNaoExiste) return null;
    const id = typeof funcionarioId === 'string' ? parseInt(funcionarioId) : funcionarioId;
    return this.vistaEscala.grid[id]?.[dia] || null;
  }

  getCorPlantao(tipoPlantaoId: number): string {
    return this.tiposPlantao.find(t => t.id === tipoPlantaoId)?.cor || '#cccccc';
  }

  getExibicaoPlantao(tipoPlantaoId: number): string {
    const tipo = this.tiposPlantao.find(t => t.id === tipoPlantaoId);
    if (!tipo) return '?';
    return window.innerWidth < 768 ? tipo.nome.substring(0,2).toUpperCase() : tipo.nome.substring(0,5);
  }

  getTooltipPlantao(tipoPlantaoId: number): string {
    return this.tiposPlantao.find(t => t.id === tipoPlantaoId)?.nome || 'Plantão';
  }

  getHorarioTipoPlantao(tipo: TipoPlantao): string {
    return tipo.duracao ? `${tipo.duracao}h` : '';
  }

  /**
   * Retorna true se o tipo de plantão é remunerado (snRemunerado = true/1).
   *
   * Regras:
   *   snRemunerado = true/1              → remunerado
   *   snRemunerado = false/0             → não remunerado
   *   snRemunerado = undefined/null      → assume remunerado (campo ausente na API)
   *   tipo não encontrado em nenhuma fonte → assume remunerado
   *
   * Busca em tiposPlantao (fonte completa) antes da legenda da vista.
   */
  private isPlantaoRemunerado(idTipoPlantao: number): boolean {
    const id = Number(idTipoPlantao);

    const tipo = this.tiposPlantao.find(t => Number(t.id) === id);
    if (tipo) {
      if (tipo.snRemunerado === undefined || tipo.snRemunerado === null) return true;
      return !!tipo.snRemunerado;
    }

    const tipoLegenda = this.vistaEscala?.legenda?.find(t => Number(t.id) === id);
    if (tipoLegenda) {
      if (tipoLegenda.snRemunerado === undefined || tipoLegenda.snRemunerado === null) return true;
      return !!tipoLegenda.snRemunerado;
    }

    return true; // tipo não encontrado — assume remunerado
  }

  /**
   * Retorna a quantidade de plantões REMUNERADOS do funcionário (exibido ao lado do nome).
   * Plantões com snRemunerado = false não são contabilizados.
   */
  getQuantidadePlantoesFuncionario(funcionarioId: number): number {
    if (!this.vistaEscala?.grid || this.escalaNaoExiste) return 0;
    const id = typeof funcionarioId === 'string' ? parseInt(funcionarioId) : funcionarioId;
    const dias = this.vistaEscala.grid[id];
    if (!dias) return 0;
    return Object.values(dias)
      .filter(p => p != null && this.isPlantaoRemunerado(p.idTipoPlantao)).length;
  }

  getFuncionariosOrdenados(): Usuario[] {
    // Se o filtro está ativo e já temos funcionários filtrados
    if (this.ocultarNaoPlantonistas && this.funcionariosFiltrados.length > 0) {
      return this.funcionariosFiltrados.sort((a, b) =>
        (a.nome || '').localeCompare(b.nome || '')
      );
    }

    // Caso contrário, retorna todos os funcionários ordenados
    if (!this.vistaEscala || !this.vistaEscala.funcionarios) {
      return [];
    }

    return [...this.vistaEscala.funcionarios].sort((a, b) =>
      (a.nome || '').localeCompare(b.nome || '')
    );
  }

  getFuncionarios(): any[] { return this.getFuncionariosOrdenados(); }

  /**
   * Total de plantões REMUNERADOS na escala — exibido no rodapé.
   * Plantões com snRemunerado = false não entram no total.
   */
  getTotalPlantoes(): number {
    if (!this.vistaEscala?.grid || this.escalaNaoExiste) return 0;
    let total = 0;
    for (const dias of Object.values(this.vistaEscala.grid)) {
      for (const plantao of Object.values(dias)) {
        if (plantao && this.isPlantaoRemunerado(plantao.idTipoPlantao)) total++;
      }
    }
    return total;
  }

  podeCriar(): boolean { return this.permissoesUsuario.podeCriar || false; }

  /** Prévia e envio do aviso da escala antes de fim de semana e feriado (imagem no Telegram). */
  abrirAvisoFimDeSemana(): void {
    this.dialog.open(AvisoEscalaDialogComponent, { width: '720px', maxWidth: '96vw', maxHeight: '92vh' });
  }
  podeEditar(): boolean { return this.permissoesUsuario.podeEditar || false; }
  podeExcluir(): boolean {
    if (this.isEscalaPublicada()) return this.podeCriar();
    return this.permissoesUsuario.podeExcluir || false;
  }
  podeReorganizar(): boolean { return this.permissoesUsuario.podeReorganizar || false; }
  isEscalaPublicada(): boolean { return this.escala?.publicado || false; }
  getNomeTipoPlantao(tipoPlantaoId: number): string {
    return this.tiposPlantao.find(t => t.id === tipoPlantaoId)?.nome || 'Plantão';
  }

  // DRAG & DROP
  onDragStart(event: DragEvent, plantao: Plantao, funcionarioId: number, dia: number): void {
    if (!this.podeMoverPlantao()) { event.preventDefault(); this.mostrarToast('Sem permissão para mover.', 'warning'); return; }
    const dragData = { type: 'plantao', plantao, funcionarioId, dia };
    event.dataTransfer?.setData('text/plain', JSON.stringify(dragData));
    event.dataTransfer!.effectAllowed = 'move';
    (event.target as HTMLElement).classList.add('dragging');
  }

  onDragStartTipo(event: DragEvent, tipo: TipoPlantao): void {

    if (!this.podeAdicionarRemoverPlantao()) { event.preventDefault(); return; }
    const dragData = { type: 'tipo', tipo };
    event.dataTransfer?.setData('text/plain', JSON.stringify(dragData));
    event.dataTransfer!.effectAllowed = 'copy';
    (event.target as HTMLElement).classList.add('dragging');
  }

  onDragStartTipoAusencia(event: DragEvent, tipo: TipoAusencia): void {
    if (!this.podeAdicionarRemoverPlantao()) { event.preventDefault(); return; }
    const dragData = { type: 'tipoAusencia', tipo };
    event.dataTransfer?.setData('text/plain', JSON.stringify(dragData));
    event.dataTransfer!.effectAllowed = 'copy';
    (event.target as HTMLElement).classList.add('dragging');
  }

  onDragStartAusencia(event: DragEvent, ausencia: Ausencia, funcionarioId: number, dia: number): void {
    if (!this.podeMoverPlantao()) { event.preventDefault(); return; }
    const dragData = { type: 'ausencia', ausencia, funcionarioId, dia };
    event.dataTransfer?.setData('text/plain', JSON.stringify(dragData));
    event.dataTransfer!.effectAllowed = 'move';
    (event.target as HTMLElement).classList.add('dragging');
  }

  onDragOver(event: DragEvent): void {

    if (!this.podeMoverPlantao()) { event.preventDefault(); return; }
    event.preventDefault();
    event.stopPropagation();
    (event.target as HTMLElement).closest('.celula')?.classList.add('drag-over');
  }

  onDragEnter(event: DragEvent): void { event.preventDefault(); event.stopPropagation(); }
  onDragLeave(event: DragEvent): void {
    event.preventDefault(); event.stopPropagation();
    const cell = (event.target as HTMLElement).closest('.celula');
    if (cell && !cell.contains(event.relatedTarget as Node)) cell.classList.remove('drag-over');
  }

  onDragEnd(event: DragEvent): void {
    document.querySelectorAll('.dragging, .drag-over').forEach(el => el.classList.remove('dragging', 'drag-over'));
  }

  onDropPlantao(event: DragEvent, funcionarioId: number, dia: number): void {
    event.preventDefault(); event.stopPropagation();
    (event.target as HTMLElement).closest('.celula')?.classList.remove('drag-over');

    if (this.estaDeFerias(funcionarioId, dia)) {
      this.mostrarToast('Não é possível alocar: funcionário está de férias!', 'warning');
      this.onDragEnd(event); return;
    }

    try {
      const dragDataText = event.dataTransfer?.getData('text/plain');
      if (!dragDataText) return;
      const dragData = JSON.parse(dragDataText);

      if (dragData.type === 'plantao') {
         console.log('È PLANTÃO');
        if (!this.podeMoverPlantao()) {
          this.mostrarToast('Sem permissão para mover.', 'warning');
          this.onDragEnd(event);
          return;
        }

        this.moverPlantao(dragData, funcionarioId, dia);
      }

      else if (dragData.type === 'ausencia') {
        if (!this.podeMoverPlantao()) {
          this.mostrarToast('Sem permissão para mover.', 'warning');
          this.onDragEnd(event);
          return;
        }
        this.moverAusencia(dragData, funcionarioId, dia);
      }
      else if (dragData.type === 'tipo') {
        if (!this.podeAdicionarRemoverPlantao()) {
          this.onDragEnd(event);
          return;
        }
        this.adicionarPlantaoDrag(dragData.tipo, funcionarioId, dia);
      }
      else if (dragData.type === 'tipoAusencia') {
        if (!this.podeAdicionarRemoverPlantao()) {
          this.onDragEnd(event);
          return;
        }
        this.adicionarAusenciaDrag(dragData.tipo, funcionarioId, dia);
      }
    } catch (error) {
      console.error('Erro no drop:', error);
      this.mostrarToast('Erro ao processar a operação.', 'error');
    }
    this.onDragEnd(event);
  }

  private moverPlantao(dragData: any, novoFuncionarioId: number, novoDia: number): void {
    const { plantao, funcionarioId: funcionarioOrigem, dia: diaOrigem } = dragData;
    if (funcionarioOrigem === novoFuncionarioId && diaOrigem === novoDia) {
      this.mostrarToast('Plantão já está nesta posição.', 'info');
      return;
    }
    if (this.getPlantao(novoFuncionarioId, novoDia)) {
      this.mostrarToast('Já existe um plantão neste dia/funcionário!', 'warning');
      return;
    }
    if (this.temAusencia(novoFuncionarioId, novoDia)) {
      this.mostrarToast('Já existe uma ausência neste dia! Remova a ausência primeiro.', 'warning');
      return;
    }
    const plantaoAtualizado: Plantao = {
      ...plantao,
      idUsuario: novoFuncionarioId,
      dia: novoDia,
      mesEscala: this.ano * 100 + this.mes,
      idEscala: this.escala?.id
    };
    this.editarPlantao(plantaoAtualizado);
  }

  private moverAusencia(dragData: any, novoFuncionarioId: number, novoDia: number): void {
    const { ausencia, funcionarioId: funcionarioOrigem, dia: diaOrigem } = dragData;

    if (funcionarioOrigem === novoFuncionarioId && diaOrigem === novoDia) {
      this.mostrarToast('Ausência já está nesta posição.', 'info');
      return;
    }

    if (this.getPlantao(novoFuncionarioId, novoDia)) {
      this.mostrarToast('Já existe um plantão neste dia! Remova o plantão primeiro.', 'warning');
      return;
    }

    if (this.temAusencia(novoFuncionarioId, novoDia)) {
      this.mostrarToast('Já existe uma ausência neste dia/funcionário!', 'warning');
      return;
    }

    if (this.temPreferenciaFolga(novoFuncionarioId, novoDia)) {
      if (!confirm('⚠️ ATENÇÃO: Este funcionário marcou este dia como preferência de folga.\n\nDeseja continuar mesmo assim?')) {
        return;
      }
    }

    const ausenciaAtualizada: Ausencia = {
      ...ausencia,
      idUsuario: novoFuncionarioId,
      dia: novoDia,
      mesEscala: this.ano * 100 + this.mes,
      idEscala: this.escala?.id
    };

    this.editarAusencia(ausenciaAtualizada, funcionarioOrigem, diaOrigem);
  }

  private adicionarPlantaoDrag(tipo: TipoPlantao, funcionarioId: number, dia: number): void {
    if (this.getPlantao(funcionarioId, dia)) {
      this.mostrarToast('Já existe um plantão neste dia!', 'warning');
      return;
    }
    if (this.temAusencia(funcionarioId, dia)) {
      this.mostrarToast('Já existe uma ausência neste dia!', 'warning');
      return;
    }
    const novoPlantao: Plantao = {
      idUsuario: funcionarioId,
      idTipoPlantao: tipo.id,
      dia: dia,
      mesEscala: this.ano * 100 + this.mes,
      idEscala: this.escala?.id
    };
    this.adicionarPlantaoFromDrag(novoPlantao);
  }

  private adicionarAusenciaDrag(tipo: TipoAusencia, funcionarioId: number, dia: number): void {
    if (this.getPlantao(funcionarioId, dia)) {
      this.mostrarToast('Já existe um plantão neste dia! Remova o plantão primeiro.', 'warning');
      return;
    }
    if (this.temAusencia(funcionarioId, dia)) {
      this.mostrarToast('Já existe uma ausência neste dia!', 'warning');
      return;
    }
    if (this.temPreferenciaFolga(funcionarioId, dia)) {
      if (!confirm('⚠️ ATENÇÃO: Este funcionário marcou este dia como preferência de folga.\n\nDeseja continuar mesmo assim?')) {
        return;
      }
    }
    const novaAusencia: Ausencia = {
      idUsuario: funcionarioId,
      idTipoAusencia: tipo.id,
      dia: dia,
      mesEscala: this.ano * 100 + this.mes,
      idEscala: this.escala?.id ?? 0
    };
    this.adicionarAusencia(novaAusencia);
  }

  private adicionarPlantaoFromDrag(plantao: Plantao): void {
    if (!this.escala?.id) {
      this.mostrarToast('Erro: Escala não carregada ou sem ID.', 'error');
      return;
    }
    const plantaoParaEnviar: Plantao = {
      id: plantao.id,
      mesEscala: plantao.mesEscala,
      dia: plantao.dia,
      idUsuario: plantao.idUsuario,
      idTipoPlantao: plantao.idTipoPlantao,
      idEscala: this.escala.id
    };
    this.escalaService.salvarPlantao(plantaoParaEnviar, this.escala.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (resposta: any) => {
          this.mostrarToast('Plantão adicionado com sucesso!', 'success');
          const plantaoSalvo = { ...plantaoParaEnviar, id: resposta.id };
          this.atualizarGridLocal(null, plantaoSalvo);
          this.cdRef.detectChanges(); // Força atualização imediata
        },
        error: (error) => this.mostrarToast(error.message, 'error')
      });
  }

  // ========== MÉTODOS PARA ATUALIZAÇÃO LOCAL ==========
  private encontrarPosicaoPlantaoPorId(plantaoId: number): { funcionarioId: number; dia: number } | null {
    if (!this.vistaEscala?.grid) return null;
    for (const [idUsuarioStr, dias] of Object.entries(this.vistaEscala.grid)) {
      for (const [diaStr, p] of Object.entries(dias)) {
        if (p?.id === plantaoId) return { funcionarioId: Number(idUsuarioStr), dia: Number(diaStr) };
      }
    }
    return null;
  }

  private atualizarGridLocal(plantaoAntigo: Plantao | null, plantaoNovo: Plantao): void {
    if (!this.vistaEscala?.grid) return;
    if (plantaoAntigo?.id) {
      const gridAntigo = this.vistaEscala.grid[plantaoAntigo.idUsuario];
      if (gridAntigo && gridAntigo[plantaoAntigo.dia]) delete gridAntigo[plantaoAntigo.dia];
    }
    const idUsuario = plantaoNovo.idUsuario;
    const dia = plantaoNovo.dia;
    if (!this.vistaEscala.grid[idUsuario]) this.vistaEscala.grid[idUsuario] = {};
    this.vistaEscala.grid[idUsuario][dia] = plantaoNovo;
    this.recalcularContagens();
  }

  private recalcularContagens(): void {
    if (!this.vistaEscala) return;
    const contagens: Record<number, number> = {};
    let totalPlantoes = 0;
    const funcionariosComPlantao = new Set<number>();
    const diasComCobertura = new Set<number>();

    for (const [idUsuarioStr, dias] of Object.entries(this.vistaEscala.grid)) {
      const idUsuario = Number(idUsuarioStr);
      const plantoes  = Object.values(dias).filter(p => p != null);

      // Contagem apenas de remunerados (exibida ao lado do nome e no rodapé)
      const quantidadeRemunerada = plantoes
        .filter(p => this.isPlantaoRemunerado(p!.idTipoPlantao)).length;

      contagens[idUsuario] = quantidadeRemunerada;
      totalPlantoes += quantidadeRemunerada;

      // funcionariosComPlantao e cobertura usam todos os plantões (não só remunerados)
      if (plantoes.length > 0) funcionariosComPlantao.add(idUsuario);
      Object.keys(dias).forEach(diaStr => diasComCobertura.add(Number(diaStr)));
    }

    this.vistaEscala.contagens = contagens;

    let totalHoras = 0;
    for (const dias of Object.values(this.vistaEscala.grid)) {
      for (const plantao of Object.values(dias)) {
        if (plantao) {
          const tipo = this.tiposPlantao.find(t => t.id === plantao.idTipoPlantao);
          if (tipo?.duracao) totalHoras += tipo.duracao;
        }
      }
    }

    if (this.vistaEscala.totais) {
      this.vistaEscala.totais.totalPlantoes = totalPlantoes;
      this.vistaEscala.totais.totalHoras    = totalHoras;
      this.vistaEscala.totais.funcionariosAtivos = funcionariosComPlantao.size;
      this.vistaEscala.totais.coberturaDias      = diasComCobertura.size;
    } else {
      this.vistaEscala.totais = {
        totalPlantoes, totalHoras,
        funcionariosAtivos: funcionariosComPlantao.size,
        coberturaDias:      diasComCobertura.size
      };
    }
  }

  onContextMenuPlantao(event: MouseEvent, plantao: Plantao): void {
  event.preventDefault(); // Impede o menu de contexto do navegador
  if (plantao.id) {
    this.removerPlantao(plantao.id, event);
  } else {
    this.mostrarToast('Plantão inválido para remoção.', 'error');
  }
}

  private marcarCamposComoSujos(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      if (control) {
        control.markAsDirty();
        control.markAsTouched();
        control.updateValueAndValidity();
      }
    });
  }

  limparErro(): void { this.erro = ''; }

  abrirSeletorPlantaoDialog(funcionarioId: number, dia: number, event?: MouseEvent): void {
    event?.preventDefault();
    if (!this.podeAdicionarRemoverPlantao()) {
      this.mostrarToast('Você não tem permissão para adicionar plantões.', 'warning');
      return;
    }
    if (this.estaDeFerias(funcionarioId, dia)) {
      this.mostrarToast('Funcionário está de férias neste dia.', 'warning');
      return;
    }
    if (this.temPreferenciaFolga(funcionarioId, dia)) {
      if (!confirm('⚠️ ATENÇÃO: Este funcionário marcou este dia como preferência de folga.\n\nDeseja continuar mesmo assim?')) return;
    }
    if (!this.tiposPlantao.length) {
      this.mostrarToast('Nenhum tipo de plantão disponível.', 'warning');
      return;
    }
    const dialogRef = this.dialog.open(SeletorTipoPlantaoDialog, {
      width: '400px',
      data: { tipos: this.tiposPlantao }
    });
    dialogRef.afterClosed().subscribe((tipoSelecionado: TipoPlantao | undefined) => {
      if (!tipoSelecionado) return;
      if (this.getPlantao(funcionarioId, dia)) {
        this.mostrarToast('Esta célula foi preenchida enquanto você escolhia.', 'warning');
        return;
      }
      const plantao: Plantao = {
        idUsuario: funcionarioId,
        idTipoPlantao: tipoSelecionado.id,
        dia: dia,
        mesEscala: this.ano * 100 + this.mes,
        idEscala: this.escala?.id
      };
      this.adicionarPlantaoFromDrag(plantao);
    });
  }

  abrirDialogEditarPlantao(plantaoAtual: Plantao, event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();

    if (!this.podeEditarEscala()) {
      this.mostrarToast('Você não tem permissão para editar plantões.', 'warning');
      return;
    }

    if (!this.tiposPlantao.length) {
      this.mostrarToast('Nenhum tipo de plantão disponível.', 'warning');
      return;
    }

    const dialogRef = this.dialog.open(SeletorTipoPlantaoDialog, {
      width: '400px',
      data: { tipos: this.tiposPlantao }
    });

    dialogRef.afterClosed().subscribe((tipoSelecionado: TipoPlantao | undefined) => {
      if (!tipoSelecionado) return;

      // Se o tipo selecionado for o mesmo, não faz nada
      if (tipoSelecionado.id === plantaoAtual.idTipoPlantao) {
        this.mostrarToast('Tipo de plantão não foi alterado.', 'info');
        return;
      }

      // Atualiza o plantão com o novo tipo
      const plantaoAtualizado: Plantao = {
        ...plantaoAtual,
        idTipoPlantao: tipoSelecionado.id
      };

      this.editarPlantao(plantaoAtualizado);
    });
  }

  private carregarTiposAusencia(): void {
  this.tipoAusenciaService.getTiposAusencia()
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (tipos) => {
        this.tiposAusencia = tipos;
        this.cdRef.detectChanges();
      },
      error: () => {
        this.tiposAusencia = [];
        this.cdRef.detectChanges();
      }
    });
  }

  private processarAusenciasDaVista(vista: VistaEscala): void {
  if ((vista as any).gridAusencias) {
    this.gridAusencias = (vista as any).gridAusencias;
  } else {
    this.gridAusencias = {};
  }
}

// Obter ausência de um funcionário em um dia
getAusencia(funcionarioId: number, dia: number): Ausencia | null {
  return this.gridAusencias[funcionarioId]?.[dia] || null;
}

// Verificar se tem ausência
temAusencia(funcionarioId: number, dia: number): boolean {
  return !!this.getAusencia(funcionarioId, dia);
}

// Obter cor da ausência
getCorAusencia(idTipoAusencia: number): string {
  const tipo = this.tiposAusencia.find(t => t.id === idTipoAusencia);
  return tipo?.cor || '#999999';
}

getExibicaoAusencia(idTipoAusencia: number): string {
  const tipo = this.tiposAusencia?.find(t => t.id === idTipoAusencia);
  return tipo?.sigla || tipo?.nome || 'AUS';
}


// Obter sigla da ausência
getSiglaAusencia(idTipoAusencia: number): string {
  const tipo = this.tiposAusencia.find(t => t.id === idTipoAusencia);
  return tipo?.sigla || '?';
}



// Obter tooltip da ausência
getTooltipAusencia(idTipoAusencia: number): string {
  const tipo = this.tiposAusencia.find(t => t.id === idTipoAusencia);
  return tipo ? `${tipo.nome}${tipo.descricao ? ' - ' + tipo.descricao : ''}` : 'Ausência';
}

// Abrir dialog para selecionar tipo de ausência
abrirSeletorAusenciaDialog(funcionarioId: number, dia: number, event?: MouseEvent): void {
  event?.preventDefault();

  if (!this.podeAdicionarRemoverPlantao()) {
    this.mostrarToast('Você não tem permissão para marcar ausências.', 'warning');
    return;
  }

  if (this.estaDeFerias(funcionarioId, dia)) {
    this.mostrarToast('Funcionário já está de férias neste dia.', 'warning');
    return;
  }

  if (this.getPlantao(funcionarioId, dia)) {
    this.mostrarToast('Já existe um plantão neste dia. Remova o plantão primeiro.', 'warning');
    return;
  }

  if (this.temAusencia(funcionarioId, dia)) {
    this.mostrarToast('Já existe uma ausência marcada neste dia.', 'warning');
    return;
  }

  if (!this.tiposAusencia.length) {
    this.mostrarToast('Nenhum tipo de ausência disponível.', 'warning');
    return;
  }

  const dialogRef = this.dialog.open(SeletorAusenciaDialog, {
    width: '600px',
    data: { tipos: this.tiposAusencia }
  });

  dialogRef.afterClosed().subscribe((tipoSelecionado: TipoAusencia | undefined) => {
    if (!tipoSelecionado) return;

    const ausencia: Ausencia = {
      idUsuario: funcionarioId,
      idTipoAusencia: tipoSelecionado.id,
      dia: dia,
      mesEscala: this.ano * 100 + this.mes,
      idEscala: this.escala?.id ?? 0
    };

    this.adicionarAusencia(ausencia);
  });
}

// Adicionar ausência
private adicionarAusencia(ausencia: Ausencia): void {
  if (!this.escala?.id) {
    this.mostrarToast('Erro: Escala não carregada ou sem ID.', 'error');
    return;
  }

  const ausenciaParaEnviar: Ausencia = {
    id: ausencia.id,
    mesEscala: ausencia.mesEscala,
    dia: ausencia.dia,
    idUsuario: ausencia.idUsuario,
    idTipoAusencia: ausencia.idTipoAusencia,
    idEscala: this.escala.id,
    observacao: ausencia.observacao
  };

  this.escalaService.salvarAusencia(ausenciaParaEnviar, this.escala.id)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (resposta: any) => {
        this.mostrarToast('Ausência marcada com sucesso!', 'success');
        const ausenciaSalva = { ...ausenciaParaEnviar, id: resposta.id };
        this.atualizarGridLocalAusencia(null, ausenciaSalva);
        this.cdRef.detectChanges();
      },
      error: (error) => this.mostrarToast(error.message, 'error')
    });
}

private editarAusencia(ausenciaAtualizada: Ausencia, funcionarioAnterior: number, diaAnterior: number): void {
  if (!this.escala?.id) {
    this.mostrarToast('Erro: Escala não carregada.', 'error');
    return;
  }

  const ausenciaParaEnviar: Ausencia = {
    ...ausenciaAtualizada,
    idEscala: this.escala.id
  };

  this.escalaService.salvarAusencia(ausenciaParaEnviar, this.escala.id)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (resposta: any) => {
        this.mostrarToast('Ausência movida com sucesso!', 'success');

        // Remove da posição antiga
        if (this.gridAusencias[funcionarioAnterior]?.[diaAnterior]) {
          delete this.gridAusencias[funcionarioAnterior][diaAnterior];
          if (Object.keys(this.gridAusencias[funcionarioAnterior]).length === 0) {
            delete this.gridAusencias[funcionarioAnterior];
          }
        }

        // Adiciona na posição nova
        const ausenciaSalva = { ...ausenciaParaEnviar, id: resposta.id || ausenciaAtualizada.id };
        if (!this.gridAusencias[ausenciaSalva.idUsuario]) {
          this.gridAusencias[ausenciaSalva.idUsuario] = {};
        }
        this.gridAusencias[ausenciaSalva.idUsuario][ausenciaSalva.dia] = ausenciaSalva;

        this.cdRef.detectChanges();
      },
      error: (error) => this.mostrarToast(error.message, 'error')
    });
}

// Remover ausência
removerAusencia(ausenciaId: number, event?: MouseEvent): void {
  event?.preventDefault();
  event?.stopPropagation();

  if (!this.podeAdicionarRemoverPlantao()) {
    this.mostrarToast('Você não tem permissão para remover ausências.', 'warning');
    return;
  }

  if (!confirm('Tem certeza que deseja remover esta ausência?')) {
    return;
  }

  this.escalaService.removerAusencia(ausenciaId)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: () => {
        this.mostrarToast('Ausência removida!', 'success');
        this.atualizarGridParcialmente();
      },
      error: (error) => this.mostrarToast(error.message, 'error')
    });
}

// Atualizar grid local de ausências
private atualizarGridLocalAusencia(ausenciaAntiga: Ausencia | null, ausenciaNova: Ausencia): void {
  if (ausenciaAntiga?.id) {
    const gridAntigo = this.gridAusencias[ausenciaAntiga.idUsuario];
    if (gridAntigo && gridAntigo[ausenciaAntiga.dia]) {
      delete gridAntigo[ausenciaAntiga.dia];
    }
  }

  const idUsuario = ausenciaNova.idUsuario;
  const dia = ausenciaNova.dia;

  if (!this.gridAusencias[idUsuario]) {
    this.gridAusencias[idUsuario] = {};
  }

  this.gridAusencias[idUsuario][dia] = ausenciaNova;
}

// Menu de contexto para ausência (botão direito)
onContextMenuAusencia(event: MouseEvent, ausencia: Ausencia): void {
  event.preventDefault();
  if (ausencia.id) {
    this.removerAusencia(ausencia.id, event);
  } else {
    this.mostrarToast('Ausência inválida para remoção.', 'error');
  }
}

toggleTipos() {
    this.mostrarTipos = !this.mostrarTipos;
  }

private limparCacheConflitos(): void {
  this._conflitosCache = null;
  this._quantidadeConflitosCache = null;
}



/**
 * Obtém todos os plantões da escala atual
 * @returns Array de plantões
 */
private getTodosPlantoes(): Plantao[] {
  if (!this.vistaEscala?.grid) return [];

  const plantoes: Plantao[] = [];

  // Percorre o grid de plantões: { [idUsuario]: { [dia]: Plantao } }
  Object.keys(this.vistaEscala.grid).forEach(idUsuario => {
    const diasFuncionario = this.vistaEscala!.grid[Number(idUsuario)];

    if (diasFuncionario) {
      Object.keys(diasFuncionario).forEach(dia => {
        const plantao = diasFuncionario[Number(dia)];
        if (plantao) {
          plantoes.push(plantao);
        }
      });
    }
  });

  return plantoes;
}

/**
 * Verifica se existem conflitos de plantões durante férias
 * @returns true se houver pelo menos um plantão durante férias
 */
temConflitosFeriasPlantao(): boolean {
  // Retorna do cache se disponível
  if (this._conflitosCache !== null) {
    return this._conflitosCache;
  }

  const plantoes = this.getTodosPlantoes();
  if (plantoes.length === 0) {
    this._conflitosCache = false;
    return false;
  }

  const temConflitos = plantoes.some(plantao => {
    const funcionarioId = plantao.idUsuario;
    const dia = plantao.dia;
    return this.estaDeFerias(funcionarioId, dia);
  });

  this._conflitosCache = temConflitos;
  return temConflitos;
}

/**
 * Conta quantos conflitos de plantão durante férias existem (com cache)
 * @returns número de conflitos encontrados
 */
getQuantidadeConflitos(): number {
  // Retorna do cache se disponível
  if (this._quantidadeConflitosCache !== null) {
    return this._quantidadeConflitosCache;
  }

  const plantoes = this.getTodosPlantoes();
  if (plantoes.length === 0) {
    this._quantidadeConflitosCache = 0;
    return 0;
  }

  const quantidade = plantoes.filter(plantao => {
    const funcionarioId = plantao.idUsuario;
    const dia = plantao.dia;
    return this.estaDeFerias(funcionarioId, dia);
  }).length;

  this._quantidadeConflitosCache = quantidade;
  return quantidade;
}

/**
 * Obtém lista detalhada dos conflitos para exibição
 * @returns array com informações dos conflitos
 */
getDetalhesConflitos(): Array<{
  funcionario: string;
  dia: number;
  tipoPlantao: string;
  idPlantao?: number;
}> {
  const plantoes = this.getTodosPlantoes();
  if (plantoes.length === 0) return [];

  const conflitos = plantoes
    .filter(plantao => {
      const funcionarioId = plantao.idUsuario;
      const dia = plantao.dia;
      return this.estaDeFerias(funcionarioId, dia);
    })
    .map(plantao => {
      // Busca o funcionário na lista (codusuario pode ser string ou number)
      const funcionario = this.vistaEscala?.funcionarios.find(f => {
        const codUsuario = typeof f.codUsuario === 'string' ? parseInt(f.codUsuario, 10) : f.codUsuario;
        return codUsuario === plantao.idUsuario;
      });

      // Busca o tipo de plantão na legenda
      const tipoPlantao = this.vistaEscala?.legenda.find(t => t.id === plantao.idTipoPlantao);

      return {
        funcionario: funcionario?.nome || 'Desconhecido',
        dia: plantao.dia,
        tipoPlantao: tipoPlantao?.nome || 'Desconhecido',
        idPlantao: plantao.id
      };
    })
    .sort((a, b) => a.dia - b.dia); // Ordena por dia

  return conflitos;
}

/**
 * Valida a escala antes de publicar
 * Verifica se há conflitos de plantão durante férias
 */
validarEPublicar(): void {
  // Verifica conflitos
  if (this.temConflitosFeriasPlantao()) {
    console.log("conflito");
    const quantidade = this.getQuantidadeConflitos();
    const detalhes = this.getDetalhesConflitos();

    // Monta mensagem detalhada
    let mensagem = `⚠️ NÃO É POSSÍVEL PUBLICAR A ESCALA\n\n`;
    mensagem += `Existem ${quantidade} plantão(ões) agendado(s) durante período de férias:\n\n`;

    detalhes.forEach((conflito, index) => {
      mensagem += `${index + 1}. ${conflito.funcionario} - Dia ${conflito.dia} (${conflito.tipoPlantao})\n`;
    });

    mensagem += `\n⚠️ Por favor, remova os plantões em conflito antes de publicar a escala.`;
    mensagem += `\n\n💡 Dica: Os plantões em conflito estão destacados em VERMELHO com borda pulsante.`;
    mensagem += `\nO botão × de remoção está sempre visível nestes plantões.`;

    alert(mensagem);
    return;
  }

  // Se não houver conflitos, procede com a publicação
  this.publicarEscala();
}

/**
 * Valida conflitos antes de adicionar férias
 * @param funcionarioId ID do funcionário (codusuario)
 * @param dataInicio Data de início das férias
 * @param dataFim Data de fim das férias
 * @returns true se pode adicionar, false caso contrário
 */
validarAntesDeAdicionarFerias(
  funcionarioId: number,
  dataInicio: Date,
  dataFim: Date
): boolean {
  if (!this.vistaEscala?.grid) return true;

  // Obtém os plantões do funcionário específico
  const diasFuncionario = this.vistaEscala.grid[funcionarioId];
  if (!diasFuncionario) return true;

  const plantoesNoPeriodo: Plantao[] = [];

  // Verifica cada dia do funcionário
  Object.keys(diasFuncionario).forEach(dia => {
    const plantao = diasFuncionario[Number(dia)];
    if (!plantao) return;

    // Cria data do plantão para comparação
    const dataPlantao = new Date(this.ano, this.mes - 1, plantao.dia);

    if (dataPlantao >= dataInicio && dataPlantao <= dataFim) {
      plantoesNoPeriodo.push(plantao);
    }
  });

  if (plantoesNoPeriodo.length > 0) {
    // Busca nome do funcionário (codusuario pode ser string ou number)
    const funcionario = this.vistaEscala.funcionarios?.find(f => {
      const codUsuario = typeof f.codUsuario === 'string' ? parseInt(f.codUsuario, 10) : f.codUsuario;
      return codUsuario === funcionarioId;
    });
    const nomeFuncionario = funcionario?.nome || 'Funcionário';

    // Monta lista de plantões
    const tiposPlan = plantoesNoPeriodo
      .map(p => {
        const tipo = this.vistaEscala?.legenda.find(t => t.id === p.idTipoPlantao);
        return `• Dia ${p.dia}: ${tipo?.nome || 'Plantão'}`;
      })
      .join('\n');

    const mensagem = `⚠️ ATENÇÃO: CONFLITO DETECTADO\n\n` +
      `${nomeFuncionario} possui ${plantoesNoPeriodo.length} plantão(ões) no período de férias:\n\n` +
      `${tiposPlan}\n\n` +
      `As férias serão adicionadas, mas os plantões ficarão em CONFLITO.\n` +
      `Você precisará removê-los antes de publicar a escala.\n\n` +
      `Os plantões em conflito ficarão destacados em VERMELHO.\n\n` +
      `Deseja continuar mesmo assim?`;

    return confirm(mensagem);
  }

  return true;
}

/**
 * Obtém mensagem de tooltip para célula com plantão em férias
 * @param funcionarioId ID do funcionário
 * @param dia Dia do mês
 * @returns Mensagem para exibir no tooltip
 */
getTooltipPlantaoEmFerias(funcionarioId: number, dia: number): string {
  const plantao = this.getPlantao(funcionarioId, dia);
  if (!plantao) return '';

  const tipoPlantao = this.vistaEscala?.legenda.find(t => t.id === plantao.idTipoPlantao);
  const nomeTipo = tipoPlantao?.nome || 'Plantão';

  return `⚠️ CONFLITO: Plantão (${nomeTipo}) durante FÉRIAS!\n` +
         `Remova este plantão antes de publicar a escala.\n` +
         `Duplo clique para editar ou clique no × para remover.`;
}

/**
 * Verifica se um plantão específico está em conflito com férias
 * @param plantaoId ID do plantão
 * @returns true se o plantão está durante férias
 */
plantaoEstaEmConflito(plantaoId: number): boolean {
  const plantoes = this.getTodosPlantoes();

  const plantao = plantoes.find(p => p.id === plantaoId);
  if (!plantao) return false;

  return this.estaDeFerias(plantao.idUsuario, plantao.dia);
}

/**
 * Obtém estatísticas dos conflitos para exibição no resumo
 * @returns objeto com estatísticas
 */
getEstatisticasConflitos(): {
  totalConflitos: number;
  funcionariosAfetados: number;
  diasAfetados: number[];
} {
  const conflitos = this.getDetalhesConflitos();

  const funcionariosUnicos = new Set(conflitos.map(c => c.funcionario));
  const diasUnicos = new Set(conflitos.map(c => c.dia));

  return {
    totalConflitos: conflitos.length,
    funcionariosAfetados: funcionariosUnicos.size,
    diasAfetados: Array.from(diasUnicos).sort((a, b) => a - b)
  };
}

/**
 * Verifica se há conflitos em um dia específico
 * @param dia Dia do mês
 * @returns true se houver pelo menos um conflito neste dia
 */
diaTemConflitos(dia: number): boolean {
  if (!this.vistaEscala?.grid) return false;

  // Percorre todos os funcionários
  return Object.keys(this.vistaEscala.grid).some(idUsuario => {
    const plantao = this.vistaEscala!.grid[Number(idUsuario)][dia];
    if (!plantao) return false;

    return this.estaDeFerias(Number(idUsuario), dia);
  });
}

/**
 * Obtém lista de funcionários com conflitos
 * @returns Array com IDs dos funcionários que têm conflitos
 */
getFuncionariosComConflitos(): number[] {
  const conflitos = this.getDetalhesConflitos();
  const idsUnicos = new Set<number>();

  conflitos.forEach(conflito => {
    const funcionario = this.vistaEscala?.funcionarios.find(f => f.nome === conflito.funcionario);
    if (funcionario?.codUsuario) {
      // Converte para number se for string
      const id = typeof funcionario.codUsuario === 'string'
        ? parseInt(funcionario.codUsuario, 10)
        : funcionario.codUsuario;
      idsUnicos.add(id);
    }
  });

  return Array.from(idsUnicos);
}

// ============================================================================
// MÉTODOS AUXILIARES PARA INTEGRAÇÃO
// ============================================================================

/**
 * Atualiza contadores após resolver conflito
 * Chame este método após remover um plantão em conflito
 */
atualizarContadoresAposResolverConflito(): void {
  // Força atualização da detecção de mudanças
  if (this.cdRef) {
    this.cdRef.detectChanges();
  }

  // Log para debug (remova em produção)
  console.log('Conflitos atualizados:', {
    quantidade: this.getQuantidadeConflitos(),
    tem: this.temConflitosFeriasPlantao()
  });
}

/**
 * Gera uma imagem da tabela da escala e faz o download
 */
gerarImagem(): void {
  const elemento = document.querySelector('.table-container');
  if (!elemento) {
    this.mostrarToast('Elemento da tabela não encontrado.', 'error');
    return;
  }

  this.capturandoImagem = true;

  html2canvas(elemento as HTMLElement, {
    scale: 1.5,               // Melhora a resolução
    backgroundColor: '#ffffff', // Força fundo branco
    allowTaint: false,
    useCORS: true,
    logging: false,
    windowWidth: elemento.scrollWidth,
    windowHeight: elemento.scrollHeight
  }).then((canvas) => {
    // Cria um link para download
    const link = document.createElement('a');
    link.download = `escala-${this.getNomeMes()}-${this.ano}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    this.capturandoImagem = false;
    this.mostrarToast('Imagem gerada com sucesso!', 'success');
  }).catch((error) => {
    console.error('Erro ao gerar imagem:', error);
    this.mostrarToast('Erro ao gerar a imagem.', 'error');
    this.capturandoImagem = false;
  });
}

/**
 * Seleciona ou desseleciona um funcionário ao clicar
 */
// ── Telas de toque: um toque na célula mostra detalhes e ações em um painel inferior ──
// No desktop não faz nada: continuam o duplo clique, os botões ao passar o mouse e o arrastar e soltar.
tocarCelula(funcionario: Usuario, dia: number): void {
  if (!this.telaToque) return;

  const funcionarioId = Number(funcionario['id']);
  const plantao = this.getPlantao(funcionarioId, dia);
  const ausencia = plantao ? null : this.getAusencia(funcionarioId, dia);
  const tipo = plantao ? 'plantao' : ausencia ? 'ausencia' : this.estaDeFerias(funcionarioId, dia) ? 'ferias' : 'vazio';

  // No toque não há tooltip: o painel mostra o mesmo texto do title da célula
  const detalhes = [this.getTitleCelula(funcionarioId, dia)];
  if (ausencia) detalhes.push(`Ausência: ${this.getTooltipAusencia(ausencia.idTipoAusencia)}`);
  if (plantao && this.estaDeFerias(funcionarioId, dia)) detalhes.push('⚠️ Plantão durante férias: remova antes de publicar');

  this.acoesToque = {
    tipo,
    funcionarioId,
    nome: [funcionario['matricula'], funcionario['nome']].filter(Boolean).join(' - '),
    dia,
    id: plantao?.id ?? ausencia?.id ?? null,
    detalhes: detalhes.join(' • '),
  };
  this.acoesToqueAbertasEm = Date.now();
}

fecharAcoesToque(): void {
  // Ignora o toque que chega logo após abrir (duplo toque por hábito)
  if (Date.now() - this.acoesToqueAbertasEm < 400) return;
  this.acoesToque = null;
}

/** plantao/ausencia = abrir o seletor (adicionar ou alterar); remover = o mesmo fluxo do botão × do desktop. */
executarAcaoToque(acao: 'plantao' | 'ausencia' | 'remover'): void {
  const alvo = this.acoesToque;
  this.acoesToque = null;
  if (!alvo) return;

  if (acao === 'remover') {
    if (alvo.id == null) return;
    if (alvo.tipo === 'plantao') this.removerPlantao(alvo.id);
    else if (alvo.tipo === 'ausencia') this.removerAusencia(alvo.id);
    return;
  }
  if (acao === 'plantao') this.abrirSeletorPlantaoDialog(alvo.funcionarioId, alvo.dia);
  else this.abrirSeletorAusenciaDialog(alvo.funcionarioId, alvo.dia);
}

selecionarFuncionario(idFuncionario: number): void {
  // Se clicar no mesmo funcionário, desseleciona
  if (this.funcionarioSelecionadoId === idFuncionario) {
    this.funcionarioSelecionadoId = null;
  } else {
    // Caso contrário, seleciona o novo funcionário
    this.funcionarioSelecionadoId = idFuncionario;
  }
}

/**
 * Aplica filtro para mostrar apenas plantonistas
 */
aplicarFiltroFuncionarios(): void {
  if (!this.vistaEscala || !this.vistaEscala.funcionarios) {
    this.funcionariosFiltrados = [];
    return;
  }

  if (this.ocultarNaoPlantonistas) {
    // Filtra apenas funcionários que são plantonistas
    this.funcionariosFiltrados = this.vistaEscala.funcionarios.filter(
      (func: Usuario) => !!func.snPlantonista || !!func.isPlantonista
    );
  } else {
    // Mostra todos os funcionários
    this.funcionariosFiltrados = [...this.vistaEscala.funcionarios];
  }
}

// ============================================================================
// PAINEL HISTÓRICO — últimos 12 meses
// Exibe funcionários que:
//   1. Trabalharam em plantão do tipo snPonte = true
//   2. Tiveram exatamente 1 plantão no mês E não estiveram de férias
// ============================================================================

abrirHistorico(): void {
  this.historicoPainelAberto = true;
  if (!this.historicoItems.length) {
    this.carregarHistorico();
  }
}

fecharHistorico(): void {
  this.historicoPainelAberto = false;
}

// ── Log de Alterações Pós-Publicação ───────────────────────────────────────

abrirLogAlteracoes(): void {
  this.logPainelAberto = true;
  this.carregarLogAlteracoes();
}

fecharLogAlteracoes(): void { this.logPainelAberto = false; }

recarregarLogAlteracoes(): void { this.carregarLogAlteracoes(); }

private carregarLogAlteracoes(): void {
  const idEscala = this.vistaEscala?.escala?.id;
  if (!idEscala) { this.logItens = []; return; }
  this.logCarregando = true;
  this.cdRef.detectChanges();
  this.escalaService.getLogEscala(idEscala)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (logs) => { this.logItens = logs || []; this.logCarregando = false; this.cdRef.detectChanges(); },
      error: () => {
        this.logItens = []; this.logCarregando = false; this.cdRef.detectChanges();
        this.mostrarToast('Erro ao carregar log de alterações.', 'error');
      }
    });
}

logItensFiltrados(): LogPlantao[] {
  return this.logFiltroAcao === 'TODOS'
    ? this.logItens
    : this.logItens.filter(l => l.acao === this.logFiltroAcao);
}

logContar(acao: string): number { return this.logItens.filter(l => l.acao === acao).length; }

formatarLogSnapshot(snapshot: string | null): string {
  if (!snapshot) return '—';
  try {
    const vals: Record<string, string> = {};
    snapshot.split('|').forEach(p => {
      const [k, v] = p.trim().split('=').map(x => x.trim()); vals[k] = v;
    });
    const nome = this.getNomeFuncionarioPorId(Number(vals['idUsuario']));
    const tipo = this.getNomeTipoPlantao(Number(vals['idTipoPlantao']));
    return `Dia ${vals['dia'] ?? '?'} • ${nome} • ${tipo}`;
  } catch { return snapshot; }
}

formatarLogData(isoString: string): string {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleDateString('pt-BR') + ' ' +
         d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

getNomeFuncionarioPorId(id: number): string {
  if (!id) return '—';
  const todas: any[] = [
    ...(this.vistaEscala?.funcionarios || []),
    ...this.funcionarios
  ];
  const f = todas.find(u => {
    const cod = typeof u.codUsuario === 'string'
      ? parseInt(u.codUsuario, 10)
      : Number(u.codUsuario ?? u.codusuario ?? u.id ?? u.idUsuario);
    return cod === id;
  });
  return f?.nome ?? f?.login ?? `Usuário #${id}`;
}

private carregarHistorico(): void {
  this.historicoCarregando = true;
  this.historicoItems  = [];
  this.historicoFiltro = 'todos'; // reset filtro ao recarregar

  // Monta lista dos últimos 12 meses até o mês atual (inclusive)
  const meses: { ano: number; mes: number }[] = [];
  let a = this.ano;
  let m = this.mes;
  for (let i = 0; i < 12; i++) {
    meses.unshift({ ano: a, mes: m });
    m--;
    if (m === 0) { m = 12; a--; }
  }

  let pendentes = meses.length;
  const mesAtual = this.ano * 100 + this.mes;

  meses.forEach(({ ano, mes }) => {
    const mesEscala = ano * 100 + mes;
    // Força refresh apenas no mês da escala atual (pode ter mudado desde o último acesso)
    const forceRefresh = mesEscala === mesAtual;
    this.escalaService.getEscala(mesEscala, forceRefresh)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (vista) => {
          this.processarHistoricoMes(vista, ano, mes);
          pendentes--;
          if (pendentes === 0) this.finalizarHistorico();
        },
        error: () => {
          pendentes--;
          if (pendentes === 0) this.finalizarHistorico();
        }
      });
  });
}

private finalizarHistorico(): void {
  // Ordena por mês/ano descendente, depois por nome
  this.historicoItems.sort((a, b) =>
    b.mesAnoOrd - a.mesAnoOrd || a.nome.localeCompare(b.nome)
  );
  this.historicoCarregando = false;
  this.cdRef.detectChanges();
}

private processarHistoricoMes(vista: VistaEscala, ano: number, mes: number): void {
  if (!vista?.grid || !vista.funcionarios) return;

  const nomesMeses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                      'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const mesAno    = `${nomesMeses[mes - 1]}/${ano}`;
  const mesAnoOrd = ano * 100 + mes;

  for (const [idUsuarioStr, dias] of Object.entries(vista.grid)) {
    const idUsuario = Number(idUsuarioStr);
    const plantoes  = Object.values(dias).filter(p => p != null) as Plantao[];
    if (!plantoes.length) continue;

    // Busca nome tentando todos os campos possíveis de ID
    const funcionario = vista.funcionarios.find(f => {
      const ids = [f.codUsuario, (f as any).id, (f as any).idUsuario, (f as any).cod_usuario]
        .filter(v => v != null)
        .map(v => Number(v));
      return ids.includes(idUsuario);
    });

    // Debug: se não encontrar, loga os campos do primeiro usuário da lista
    if (!funcionario && vista.funcionarios.length > 0) {
      console.warn(`[Histórico] Usuário ${idUsuario} não encontrado. Campos:`,
        Object.keys(vista.funcionarios[0]),
        'Valores:', vista.funcionarios[0]);
    }

    const nome = funcionario
      ? (funcionario.matricula
          ? `${funcionario.matricula} · ${funcionario.nome}`
          : (funcionario.nome ?? funcionario.login ?? `Usuário ${idUsuario}`))
      : `Usuário ${idUsuario}`;

    // ── Condição 1: plantão de ponte (snPonte = true) ──
    // vista.legenda pode não incluir snPonte — busca em tiposPlantao (fonte completa)
    plantoes.forEach(p => {
      const id = Number(p.idTipoPlantao);
      const tipoCompleto  = this.tiposPlantao.find(t => Number(t.id) === id);
      const tipoLegenda   = vista.legenda?.find(t => Number(t.id) === id);
      const snPonte       = tipoCompleto?.snPonte ?? (tipoLegenda as any)?.snPonte;
      const nomeTipo      = tipoCompleto?.nome ?? tipoLegenda?.nome ?? 'Plantão';

      if (!!snPonte) {
        this.historicoItems.push({
          idUsuario,
          nome,
          dia: p.dia,
          mesAno,
          mesAnoOrd,
          tipoPlantao: nomeTipo,
          motivo: 'ponte',
          motivoLabel: 'Plantão Ponte'
        });
      }
    });

    // ── Condição 2: exatamente 1 plantão e sem férias no mês ──
    const temFerias = this.funcionarioTemFeriasNaVista(vista, idUsuario, ano, mes);

    if (plantoes.length === 1 && !temFerias) {
      const p       = plantoes[0];
      const id      = Number(p.idTipoPlantao);
      const tipoCompleto = this.tiposPlantao.find(t => Number(t.id) === id);
      const tipoLegenda  = vista.legenda?.find(t => Number(t.id) === id);
      const nomeTipo     = tipoCompleto?.nome ?? tipoLegenda?.nome ?? 'Plantão';
      const jaCadastrado = this.historicoItems.some(
        h => h.nome === nome && h.mesAnoOrd === mesAnoOrd &&
             h.dia === p.dia && h.motivo === 'unico_sem_ferias'
      );
      if (!jaCadastrado) {
        this.historicoItems.push({
          idUsuario,
          nome,
          dia: p.dia,
          mesAno,
          mesAnoOrd,
          tipoPlantao: nomeTipo,
          motivo: 'unico_sem_ferias',
          motivoLabel: 'Único na Escala'
        });
      }
    }
  }
}

private funcionarioTemFeriasNaVista(
  vista: VistaEscala,
  idUsuario: number,
  ano: number,
  mes: number
): boolean {

  // ── Fonte 1: feriasPorUsuario da própria vista do mês ──
  // Chave pode ser number ou string dependendo da serialização
  const feriasMap = (vista as any).feriasPorUsuario;
  if (feriasMap) {
    const dias = feriasMap[idUsuario] ?? feriasMap[String(idUsuario)];
    if (dias && dias.length > 0) return true;
  }

  // ── Fonte 2: feriasDetalhadas da vista do mês ──
  const feriasDetalhadas = (vista as any).feriasDetalhadas;
  if (feriasDetalhadas?.length) {
    const temNaVista = feriasDetalhadas.some((f: any) => {
      const cod = f.idUsuario ?? f.funcionario?.id
               ?? f.funcionario?.codUsuario ?? f.funcionario?.codusuario
               ?? f.idFuncionario;
      return Number(cod) === idUsuario;
    });
    if (temNaVista) return true;
  }

  // ── Fonte 3: this.ferias — APENAS para o mês atual da escala ──
  // this.ferias é carregado por getFeriasPorPeriodo(this.ano, this.mes),
  // portanto só é confiável para o mês/ano corrente — jamais para histórico.
  // Além disso, verifica sobreposição de datas para garantir que o período
  // de férias realmente cobre algum dia do mês verificado.
  const ehMesAtual = ano === this.ano && mes === this.mes;
  if (ehMesAtual && this.ferias?.length) {
    const inicioMes = new Date(ano, mes - 1, 1);
    const fimMes    = new Date(ano, mes, 0); // último dia do mês

    return this.ferias.some(f => {
      const cod = f.idUsuario ?? (f as any).funcionario?.id
               ?? (f as any).funcionario?.codUsuario;
      if (Number(cod) !== idUsuario) return false;

      // Verifica se o período de férias sobrepõe o mês inteiro
      const inicioFerias = new Date(f.dataInicio);
      const fimFerias    = new Date(f.dataFim);
      return inicioFerias <= fimMes && fimFerias >= inicioMes;
    });
  }

  return false;
}

/** Recarrega o histórico (útil ao mudar de mês) */
recarregarHistorico(): void {
  this.historicoItems = [];
  this.carregarHistorico();
}

/** Lista de meses únicos no histórico (ordem descendente), respeitando o filtro ativo */
getMesesHistorico(): string[] {
  const itens = this.getItensFiltrados();
  const vistos = new Set<string>();
  const resultado: string[] = [];
  for (const item of itens) {
    if (!vistos.has(item.mesAno)) {
      vistos.add(item.mesAno);
      resultado.push(item.mesAno);
    }
  }
  return resultado;
}

/** Itens visíveis conforme filtro ativo */
getItensFiltrados(): HistoricoItem[] {
  if (this.historicoFiltro === 'todos') return this.historicoItems;
  return this.historicoItems.filter(i => i.motivo === this.historicoFiltro);
}

/** Itens filtrados pelo mês informado */
getItensPorMes(mesAno: string): HistoricoItem[] {
  return this.getItensFiltrados().filter(i => i.mesAno === mesAno);
}

/** Itens filtrados pelo mês E motivo — usado para os dois blocos separados */
getItensPorMesEMotivo(mesAno: string, motivo: HistoricoItem['motivo']): HistoricoItem[] {
  // Se há filtro ativo e não é o motivo deste bloco, retorna vazio
  if (this.historicoFiltro !== 'todos' && this.historicoFiltro !== motivo) return [];
  return this.historicoItems.filter(i => i.mesAno === mesAno && i.motivo === motivo);
}

/** Total de itens por motivo — usado no contador do topo */
getItensPorMotivo(motivo: HistoricoItem['motivo']): HistoricoItem[] {
  return this.historicoItems.filter(i => i.motivo === motivo);
}

// ── Sugestões ─────────────────────────────────────────────────────────────

/**
 * Retorna plantonistas ordenados por prioridade para o próximo plantão do tipo:
 *
 *   1º  Nunca realizou (sem registro nos últimos 12 meses) → prioridade máxima
 *   2º  Realizou há mais tempo → menor mesAnoOrd (mais antigo primeiro)
 *   Empate → ordem alfabética por nome
 *
 * Filtra apenas funcionários com snPlantonista = 1/true.
 */
getSugestoes(motivo: HistoricoItem['motivo']): Array<{ nome: string; ultimaVez: string }> {
  if (!this.vistaEscala?.funcionarios) return [];

  // !!f.snPlantonista: API retorna 1/0, não true/false
  const plantonistas = this.vistaEscala.funcionarios.filter(
    f => !!f.snPlantonista || !!f.isPlantonista
  );

  if (!plantonistas.length) return [];

  const resultado = plantonistas
    .filter(f => f.codUsuario != null)           // ignora sem id
    .map(f => {
      const id = Number(f.codUsuario);
      const nome = f.matricula
        ? `${f.matricula} · ${f.nome}`
        : (f.nome ?? f.login ?? '—');

      // Number() em ambos os lados garante comparação sem falso negativo
      const itensFuncionario = this.historicoItems.filter(
        h => Number(h.idUsuario) === id && h.motivo === motivo
      );

      if (itensFuncionario.length === 0) {
        // Nunca realizou nos últimos 12 meses → prioridade máxima
        return { id, nome, ultimoMesOrd: 0, ultimaVez: 'Nunca realizou' };
      }

      // Pega o registro mais recente do funcionário para esse motivo
      const ultimoMesOrd = Math.max(...itensFuncionario.map(h => h.mesAnoOrd));
      const ultimaVez = itensFuncionario.find(h => h.mesAnoOrd === ultimoMesOrd)?.mesAno ?? '—';

      return { id, nome, ultimoMesOrd, ultimaVez };
    });

  // Ordenação:
  //   - mesAnoOrd = 0 (nunca) vem antes de qualquer data   → sort ASC natural
  //   - entre os que fizeram, o mais antigo (menor ord) primeiro
  //   - empate → nome alfabético
  resultado.sort((a, b) => {
    if (a.ultimoMesOrd === 0 && b.ultimoMesOrd !== 0) return -1; // a nunca fez → antes
    if (b.ultimoMesOrd === 0 && a.ultimoMesOrd !== 0) return  1; // b nunca fez → antes
    if (a.ultimoMesOrd !== b.ultimoMesOrd) return a.ultimoMesOrd - b.ultimoMesOrd; // mais antigo primeiro
    return a.nome.localeCompare(b.nome);
  });

  return resultado.map(r => ({ nome: r.nome, ultimaVez: r.ultimaVez }));
}

/**
 * Alterna o filtro de exibição.
 * Clicar no mesmo filtro ativo volta para 'todos'.
 */
filtrarHistorico(motivo: 'ponte' | 'unico_sem_ferias'): void {
  this.historicoFiltro = this.historicoFiltro === motivo ? 'todos' : motivo;
}

}

// ============================================================================
// Interface auxiliar — fora da classe
// ============================================================================
export interface HistoricoItem {
  idUsuario: number;    // ← necessário para sugestão por funcionário
  nome: string;
  dia?: number;
  mesAno: string;
  mesAnoOrd: number;   // YYYYMM — usado para ordenação
  tipoPlantao: string;
  motivo: 'ponte' | 'unico_sem_ferias';
  motivoLabel: string;
}
