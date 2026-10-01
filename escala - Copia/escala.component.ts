import { Component, OnInit, ChangeDetectorRef, OnDestroy, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

import { Plantao, TipoPlantao, Usuario, VistaEscala, Escala, PreferenciaFolga, AuthService,PermissaoUsuarioEscala } from '@core';
import { EscalaService } from './escala.service';
import { TipoPlantaoService } from './tipo-plantao.service';
import { UsuarioService } from '@core/authentication/usuario.service';
import { FeriadoService } from './feriado.service';
import { FeriasService } from './ferias.service';
import { PreferenciaFolgaService } from './preferencia-folga/preferencia-folga.service';
import { SeletorTipoPlantaoDialog } from './seletor-tipo-plantao/seletor-tipo-plantao-dialog';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-escala',
  templateUrl: './escala.component.html',
  styleUrls: ['./escala.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule
  ]
})
export class EscalaComponent implements OnInit, OnDestroy {

  private atualizandoParcialmente = false;
  private destroy$ = new Subject<void>();
  private snackBar = inject(MatSnackBar);
  private readonly auth = inject(AuthService);

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

  plantaoForm: FormGroup;

  usuarioLogado =  toSignal(this.auth.user());
   //user = toSignal(this.auth.user());



  constructor(
    private cdRef: ChangeDetectorRef,
    private fb: FormBuilder,
    private escalaService: EscalaService,
    private tipoPlantaoService: TipoPlantaoService,
    private funcionarioService: UsuarioService,
    private feriadoService: FeriadoService,
    private feriasService: FeriasService,
    private preferenciaFolgaService: PreferenciaFolgaService,
    private dialog: MatDialog
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
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
    if (this.podeEditar()) {
      this.mostrarToast('Usuários com permissão de edição só podem mover plantões, não adicionar ou remover.', 'warning');
      return false;
    }
    this.mostrarToast('Você não tem permissão para alterar esta escala.', 'warning');
    return false;
  }

  private podeMoverPlantao(): boolean {
    if (this.escalaNaoExiste) return false;
    return this.podeCriar() || this.podeEditar();
  }

  carregarEscalaCompleta(): void {
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
          this.diasDoMes = this.gerarDiasDoMes();
          this.escalaNaoExiste = !vista.escala;
          this.processarPreferenciasDaVista(vista);
          if (!this.escalaNaoExiste) {
            this.carregarDadosAdicionais();
          } else {
            this.loading = false;
            this.cdRef.detectChanges(); // Força atualização da view
          }
        },
        error: (error: any) => {
          if (error.status === 404) {
            this.escalaNaoExiste = true;
          } else {
            this.erro = 'Erro ao comunicar com o servidor';
            this.mostrarToast(this.erro, 'error');
          }
          this.loading = false;
          this.cdRef.detectChanges(); // Força atualização da view
        }
      });
  }

  private atualizarGridParcialmente(): void {
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
            if (vista.escala && this.escala) this.escala.publicado = vista.escala.publicado;
          }
          this.atualizandoParcialmente = false;
        },
        error: (error: any) => {
          console.error('Erro ao atualizar grid parcialmente:', error);
          this.atualizandoParcialmente = false;
        }
      });
  }

    private carregarPermissoes(): void {
    this.escalaService.getPermissao()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (permissao) => {
          this.permissoesUsuario = permissao;
          this.cdRef.detectChanges();
        },
        error: () => {
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
          this.cdRef.detectChanges();
        },
        error: () => {
          this.feriados = [];
          this.cdRef.detectChanges();
        }
      });

    this.feriasService.getFeriasPorPeriodo(this.ano, this.mes)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (ferias) => {
          this.ferias = ferias;
          this.cdRef.detectChanges();
        },
        error: () => {
          this.ferias = [];
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
  }

  editarPlantao(plantao: Plantao): void {
    if (!this.podeEditarEscala()) return;
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
  }

  publicarEscala(): void {
    if (!this.escala) return;
    if (!this.podeCriar()) {
      this.mostrarToast('Você não tem permissão para publicar a escala.', 'warning');
      return;
    }
    if (confirm('Tem certeza que deseja publicar a escala? Esta ação não pode ser desfeita.')) {
      const mesEscala = this.ano * 100 + this.mes;
      this.escalaService.publicarEscala(mesEscala, 1, 'Escala publicada')
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
      this.escalaService.reverterPublicacao(mesEscala, 1)
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

  getQuantidadePlantoesFuncionario(funcionarioId: number): number {
    if (!this.vistaEscala?.contagens || this.escalaNaoExiste) return 0;
    const id = typeof funcionarioId === 'string' ? parseInt(funcionarioId) : funcionarioId;
    if (this.vistaEscala.contagens[id]) {
      const c = this.vistaEscala.contagens[id];
      return typeof c === 'number' ? c : (c as any).plantoes || 0;
    }
    return Object.values(this.vistaEscala.grid?.[id] || {}).filter(p => p).length;
  }

  getFuncionariosOrdenados(): any[] {
    if (this.vistaEscala?.funcionarios?.length) {
      return [...this.vistaEscala.funcionarios].sort((a, b) =>
        (a.nome || '').localeCompare(b.nome || '')
      );
    }
    return this.funcionarios.map(u => ({ id: u.codusuario, nome: u.nome || '' }))
               .sort((a, b) => a.nome.localeCompare(b.nome));
  }

  getFuncionarios(): any[] { return this.getFuncionariosOrdenados(); }

  getTotalPlantoes(): number {
    if (!this.vistaEscala?.contagens || this.escalaNaoExiste) return 0;
    if (this.vistaEscala.totais?.totalPlantoes !== undefined) return this.vistaEscala.totais.totalPlantoes;

    let total = 0;
    for (const key in this.vistaEscala.contagens) {
      const contagem = this.vistaEscala.contagens[key];
      if (typeof contagem === 'number') {
        total += contagem;
      } else if (contagem && typeof contagem === 'object' && 'plantoes' in contagem) {
        total += (contagem as any).plantoes || 0;
      }
    }
    return total;
  }

  podeCriar(): boolean { return this.permissoesUsuario.podeCriar || false; }
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

  onDragOver(event: DragEvent): void {
    if (!this.podeEditarEscala()) { event.preventDefault(); return; }
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
      this.mostrarToast('Não é possível alocar plantão: funcionário está de férias!', 'warning');
      this.onDragEnd(event); return;
    }
    try {
      const dragDataText = event.dataTransfer?.getData('text/plain');
      if (!dragDataText) return;
      const dragData = JSON.parse(dragDataText);
      if (dragData.type === 'plantao') {
        if (!this.podeMoverPlantao()) { this.mostrarToast('Sem permissão para mover.', 'warning'); this.onDragEnd(event); return; }
        this.moverPlantao(dragData, funcionarioId, dia);
      } else if (dragData.type === 'tipo') {
        if (!this.podeAdicionarRemoverPlantao()) { this.onDragEnd(event); return; }
        this.adicionarPlantaoDrag(dragData.tipo, funcionarioId, dia);
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
    const plantaoAtualizado: Plantao = {
      ...plantao,
      idUsuario: novoFuncionarioId,
      dia: novoDia,
      mesEscala: this.ano * 100 + this.mes,
      idEscala: this.escala?.id
    };
    this.editarPlantao(plantaoAtualizado);
  }

  private adicionarPlantaoDrag(tipo: TipoPlantao, funcionarioId: number, dia: number): void {
    if (this.getPlantao(funcionarioId, dia)) {
      this.mostrarToast('Já existe um plantão neste dia!', 'warning');
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
      const plantoes = Object.values(dias).filter(p => p != null);
      const quantidade = plantoes.length;
      contagens[idUsuario] = quantidade;
      totalPlantoes += quantidade;
      if (quantidade > 0) funcionariosComPlantao.add(idUsuario);
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
      this.vistaEscala.totais.totalHoras = totalHoras;
      this.vistaEscala.totais.funcionariosAtivos = funcionariosComPlantao.size;
      this.vistaEscala.totais.coberturaDias = diasComCobertura.size;
    } else {
      this.vistaEscala.totais = {
        totalPlantoes,
        totalHoras,
        funcionariosAtivos: funcionariosComPlantao.size,
        coberturaDias: diasComCobertura.size
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
}
