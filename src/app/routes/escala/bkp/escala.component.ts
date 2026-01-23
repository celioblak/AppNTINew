import { Component, OnInit, ChangeDetectorRef, OnDestroy, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { Plantao, TipoPlantao, User, VistaEscala, Escala } from '@core';
import { EscalaService } from './escala.service';
import { TipoPlantaoService } from './tipo-plantao.service';
import { UsuarioService } from '@core/authentication/usuario.service';
import { FeriadoService } from './feriado.service';
import { FeriasService } from './ferias.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-escala',
  templateUrl: './escala.component.html',
  styleUrls: ['./escala.component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule]
})
export class EscalaComponent implements OnInit, OnDestroy {
  ano: number = new Date().getFullYear();
  mes: number = new Date().getMonth() + 1;
  loading: boolean = false;
  erro: string = '';

  escalaNaoExiste: boolean = false;
  usuarioPodeGerarEscala: boolean = true;

  vistaEscala: VistaEscala | null = null;
  escala: Escala | null = null;
  legenda: TipoPlantao[] = [];
  feriados: any[] = [];
  ferias: any[] = [];
  diasDoMes: number[] = [];
  funcionarios: User[] = [];
  tiposPlantao: TipoPlantao[] = [];

  plantaoForm: FormGroup;
  usuarioLogadoId = 1;

  private horariosOtimizados: {[key: string]: string} = {
    'Manhã': '07-13',
    'Tarde': '13-22',
    'Noite': '22-07',
    'Integral': '07-19',
    'Madrugada': '00-06',
    'Administrativo': 'ADM',
    'Folga': 'FOLGA',
    'Férias': 'FÉRIAS'
  };

  private abreviacoesOtimizadas: {[key: string]: string} = {
    'Manhã': 'M',
    'Tarde': 'T',
    'Noite': 'N',
    'Integral': 'I',
    'Madrugada': 'MD',
    'Administrativo': 'ADM',
    'Folga': 'FG',
    'Férias': 'FR'
  };

  private destroy$ = new Subject<void>();

  private snackBar = inject(MatSnackBar);

  constructor(
    private cdRef: ChangeDetectorRef,
    private fb: FormBuilder,
    private escalaService: EscalaService,
    private tipoPlantaoService: TipoPlantaoService,
    private funcionarioService: UsuarioService,
    private feriadoService: FeriadoService,
    private feriasService: FeriasService
  ) {
    this.plantaoForm = this.fb.group({
      dia: ['', [Validators.required, Validators.min(1), Validators.max(31)]],
      idUsuario: ['', Validators.required],
      idTipoPlantao: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.carregarEscalaCompleta();
    this.carregarTiposPlantao();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private mostrarToast(mensagem: string, tipo: 'success' | 'error' | 'warning' | 'info' = 'info'): void {
    let titulo = '';

    switch(tipo) {
      case 'success':
        titulo = 'Sucesso';
        break;
      case 'error':
        titulo = 'Erro';
        break;
      case 'warning':
        titulo = 'Aviso';
        break;
      case 'info':
        titulo = 'Informação';
        break;
    }

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

    return true;
  }

  private validarEscala(): boolean {
    if (!this.escala?.id) {
      this.mostrarToast('Erro: Escala não carregada ou sem ID.', 'error');
      return false;
    }
    return true;
  }

  carregarEscalaCompleta(): void {
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

          if (this.escalaNaoExiste) {
            this.usuarioPodeGerarEscala = (vista.permissoes as any)?.podeCriar || true;
          } else {
            this.usuarioPodeGerarEscala = (vista.permissoes as any)?.podeCriar || false;
          }

          if (!this.escalaNaoExiste) {
            this.carregarDadosAdicionais();
          } else {
            this.loading = false;
            this.cdRef.detectChanges();
          }
        },
        error: (error: any) => {
          if (error.status === 404) {
            this.escalaNaoExiste = true;
            this.usuarioPodeGerarEscala = true;
          } else {
            this.erro = 'Erro ao comunicar com o servidor';
            this.mostrarToast(this.erro, 'error');
          }
          this.loading = false;
          this.cdRef.detectChanges();
        }
      });
  }

  private carregarDadosAdicionais(): void {
    this.feriadoService.getFeriados(this.ano, this.mes)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (feriados: any[]) => {
          this.feriados = feriados;
        },
        error: (error: any) => {
          this.feriados = [];
        }
      });

    this.feriasService.getFeriasPorPeriodo(this.ano, this.mes)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (ferias: any[]) => {
          this.ferias = ferias;
        },
        error: (error: any) => {
          this.ferias = [];
        }
      });

    this.funcionarioService.getUsuarios()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (funcionarios: any) => {
          if (Array.isArray(funcionarios)) {
            this.funcionarios = funcionarios;
          } else if (funcionarios && funcionarios.data) {
            this.funcionarios = funcionarios.data;
          } else {
            this.funcionarios = [];
          }
          this.loading = false;
          this.cdRef.detectChanges();
        },
        error: (error: any) => {
          this.funcionarios = [];
          this.loading = false;
          this.cdRef.detectChanges();
        }
      });
  }

  private carregarTiposPlantao(): void {
    this.tipoPlantaoService.getTiposPlantao()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tipos: TipoPlantao[]) => {
          this.tiposPlantao = tipos;
          this.legenda = tipos;
        },
        error: (error: any) => {
          this.tiposPlantao = [];
        }
      });
  }

  gerarEscala(): void {
    if (confirm(`Deseja gerar a escala para ${this.getNomeMes()}/${this.ano}?`)) {
      this.loading = true;

      this.escalaService.gerarEscala(this.ano, this.mes, this.usuarioLogadoId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (resultado: any) => {
            this.mostrarToast(`Escala para ${this.getNomeMes()}/${this.ano} gerada com sucesso!`, 'success');
            this.carregarEscalaCompleta();
          },
          error: (error: any) => {
            this.erro = error.message || 'Erro ao gerar escala';
            this.mostrarToast(this.erro, 'error');
            this.loading = false;
            this.cdRef.detectChanges();
          }
        });
    }
  }

  estaDeFerias(funcionarioId: number, dia: number): boolean {
    if (!this.ferias || this.ferias.length === 0) {
      return false;
    }

    const dataDia = new Date(this.ano, this.mes - 1, dia);
    const dataDiaISO = dataDia.toISOString().split('T')[0];

    return this.ferias.some(ferias =>
      ferias.idUsuario === funcionarioId &&
      this.dataEstaNoPeriodo(dataDiaISO, ferias.dataInicio, ferias.dataFim)
    );
  }

  getPeriodoFerias(funcionarioId: number): any {
    if (!this.ferias || this.ferias.length === 0) {
      return null;
    }

    return this.ferias.find(ferias =>
      ferias.idUsuario === funcionarioId &&
      this.periodoIncluiMes(ferias.dataInicio, ferias.dataFim, this.ano, this.mes)
    ) || null;
  }

  getDiasFeriasFuncionario(funcionarioId: number): number[] {
    const diasFerias: number[] = [];
    const periodoFerias = this.getPeriodoFerias(funcionarioId);

    if (!periodoFerias) {
      return diasFerias;
    }

    const dataInicio = new Date(periodoFerias.dataInicio);
    const dataFim = new Date(periodoFerias.dataFim);

    for (let dia = 1; dia <= this.diasDoMes.length; dia++) {
      const dataDia = new Date(this.ano, this.mes - 1, dia);

      if (dataDia >= dataInicio && dataDia <= dataFim) {
        diasFerias.push(dia);
      }
    }

    return diasFerias;
  }

  contarFuncionariosFerias(): number {
    if (!this.ferias || this.ferias.length === 0) {
      return 0;
    }

    const funcionariosComFerias = new Set<number>();
    this.ferias.forEach(ferias => {
      funcionariosComFerias.add(ferias.idUsuario);
    });

    return funcionariosComFerias.size;
  }

  getTitleCelula(funcionarioId: number, dia: number): string {
    const partes: string[] = [];

    partes.push(`${this.getDiaSemana(dia)} - ${dia}/${this.mes}`);

    if (this.ehFeriado(dia)) {
      partes.push(`Feriado: ${this.getDescricaoFeriado(dia)}`);
    }

    if (this.estaDeFerias(funcionarioId, dia)) {
      const periodo = this.getPeriodoFerias(funcionarioId);
      if (periodo) {
        partes.push(`FÉRIAS: ${this.formatarData(periodo.dataInicio)} a ${this.formatarData(periodo.dataFim)}`);
      } else {
        partes.push('FÉRIAS');
      }
    }

    if (!this.escalaNaoExiste) {
      const plantao = this.getPlantao(funcionarioId, dia);
      if (plantao) {
        const tipo = this.getNomeTipoPlantao(plantao.idTipoPlantao);
        const horario = this.getHorarioCompleto(plantao.idTipoPlantao);
        partes.push(`Plantão: ${tipo} (${horario})`);
      }
    }

    return partes.join(' | ');
  }

  private dataEstaNoPeriodo(data: string, inicio: string, fim: string): boolean {
    const dataObj = new Date(data);
    const inicioObj = new Date(inicio);
    const fimObj = new Date(fim);

    return dataObj >= inicioObj && dataObj <= fimObj;
  }

  private periodoIncluiMes(dataInicio: string, dataFim: string, ano: number, mes: number): boolean {
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    const primeiroDiaMes = new Date(ano, mes - 1, 1);
    const ultimoDiaMes = new Date(ano, mes, 0);

    return (inicio <= ultimoDiaMes) && (fim >= primeiroDiaMes);
  }

  private formatarData(data: string): string {
    return new Date(data).toLocaleDateString('pt-BR');
  }

  isEscalaPublicada(): boolean {
    return this.escala?.publicado || false;
  }

  publicarEscala(): void {
    if (!this.escala) return;

    if (confirm('Tem certeza que deseja publicar a escala? Esta ação não pode ser desfeita.')) {
      const mesEscala = this.ano * 100 + this.mes;

      this.escalaService.publicarEscala(mesEscala, this.usuarioLogadoId, 'Escala publicada')
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.mostrarToast('Escala publicada com sucesso!', 'success');
            this.carregarEscalaCompleta();
          },
          error: (error: any) => {
            this.mostrarToast(error.message, 'error');
            this.cdRef.detectChanges();
          }
        });
    }
  }

  reverterPublicacao(): void {
    if (!this.escala) return;

    if (confirm('Tem certeza que deseja reverter a publicação da escala?')) {
      const mesEscala = this.ano * 100 + this.mes;

      this.escalaService.reverterPublicacao(mesEscala, this.usuarioLogadoId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.mostrarToast('Publicação revertida com sucesso!', 'success');
            this.carregarEscalaCompleta();
          },
          error: (error: any) => {
            this.mostrarToast(error.message, 'error');
            this.cdRef.detectChanges();
          }
        });
    }
  }

  get funcionariosDaVista(): any[] {
    if (this.vistaEscala?.funcionarios?.length) {
      return this.vistaEscala.funcionarios;
    }
    return this.funcionarios.map(user => ({
      id: user.codusuario,
      nome: user.nome,
      setor: user.setor || 'Não informado'
    }));
  }

  getFuncionariosOrdenados(): any[] {
    const funcionarios = this.funcionariosDaVista;
    return [...funcionarios].sort((a, b) => a.nome.localeCompare(b.nome));
  }

  getExibicaoPlantao(tipoPlantaoId: number): string {
    const tipo = this.tiposPlantao.find(t => t.id === tipoPlantaoId);
    if (!tipo) return '?';

    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      return this.abreviacoesOtimizadas[tipo.nome] || tipo.nome.substring(0, 2).toUpperCase();
    }

    return this.horariosOtimizados[tipo.nome] ||
           this.abreviacoesOtimizadas[tipo.nome] ||
           tipo.nome.substring(0, 5);
  }

  getTooltipPlantao(tipoPlantaoId: number): string {
    const tipo = this.tiposPlantao.find(t => t.id === tipoPlantaoId);
    if (!tipo) return 'Plantão';

    const horario = this.horariosOtimizados[tipo.nome];
    return horario ? `${tipo.nome} (${horario})` : tipo.nome;
  }

  getHorarioTipoPlantao(tipo: TipoPlantao): string {
    return this.horariosOtimizados[tipo.nome] || `${tipo.duracao}h`;
  }

  ehSabado(dia: number): boolean {
    try {
      const data = new Date(this.ano, this.mes - 1, dia);
      return data.getDay() === 6;
    } catch {
      return false;
    }
  }

  ehDomingo(dia: number): boolean {
    try {
      const data = new Date(this.ano, this.mes - 1, dia);
      return data.getDay() === 0;
    } catch {
      return false;
    }
  }

  ehFimDeSemana(dia: number): boolean {
    return this.ehSabado(dia) || this.ehDomingo(dia);
  }

  getQuantidadePlantoesFuncionario(funcionarioId: number): number {
    if (!this.vistaEscala?.contagens || this.escalaNaoExiste) return 0;

    const id = typeof funcionarioId === 'string' ? parseInt(funcionarioId) : funcionarioId;

    // Primeiro tentar usar as contagens pré-calculadas do backend
    if (this.vistaEscala.contagens[id]) {
      // A estrutura pode variar, ajuste conforme necessário
      const contagem = this.vistaEscala.contagens[id];
      if (typeof contagem === 'number') {
        return contagem;
      } else if (contagem && typeof contagem === 'object') {
        return (contagem as any).plantoes || 0;
      }
    }

    // Fallback: contar manualmente do grid
    const plantoesFuncionario = this.vistaEscala.grid?.[id];
    if (!plantoesFuncionario) return 0;

    return Object.values(plantoesFuncionario).filter(plantao =>
      plantao && plantao.idTipoPlantao
    ).length;
  }

  ehFeriado(dia: number): boolean {
    if (!this.feriados || !Array.isArray(this.feriados) || this.feriados.length === 0) {
      return false;
    }

    const dataDia = new Date(this.ano, this.mes - 1, dia);
    const dataDiaISO = dataDia.toISOString().split('T')[0];

    return this.feriados.some(feriado => {
      if (feriado.data && feriado.data === dataDiaISO) {
        return true;
      }

      if (feriado.dia !== undefined && feriado.dia === dia) {
        return true;
      }

      return false;
    });
  }

  getDescricaoFeriado(dia: number): string {
    if (!this.feriados || !Array.isArray(this.feriados)) {
      return 'Feriado';
    }

    const dataDia = new Date(this.ano, this.mes - 1, dia);
    const dataDiaISO = dataDia.toISOString().split('T')[0];

    const feriado = this.feriados.find(f =>
      (f.data && f.data === dataDiaISO) ||
      (f.dia !== undefined && f.dia === dia)
    );

    return feriado?.nome || feriado?.descricao || 'Feriado';
  }

  adicionarPlantao(): void {
    if (this.plantaoForm.invalid) {
      this.marcarCamposComoSujos(this.plantaoForm);
      this.mostrarToast('Preencha todos os campos obrigatórios.', 'warning');
      return;
    }

    if (!this.validarEscala()) return;

    const formValue = this.plantaoForm.value;
    const mesEscala = this.ano * 100 + this.mes;

    if (this.estaDeFerias(formValue.idUsuario, formValue.dia)) {
      this.mostrarToast('Não é possível adicionar plantão: funcionário está de férias neste dia!', 'warning');
      return;
    }

    const plantao: Plantao = {
      mesEscala: mesEscala,
      dia: formValue.dia,
      idUsuario: formValue.idUsuario,
      idTipoPlantao: formValue.idTipoPlantao,
      idEscala: this.escala!.id // ← USANDO idEscala
    };

    this.loading = true;

    this.escalaService.salvarPlantao(plantao, this.usuarioLogadoId, this.escala!.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (plantaoSalvo: Plantao) => {
          this.plantaoForm.reset();
          this.mostrarToast('Plantão salvo com sucesso!', 'success');
          this.carregarEscalaCompleta();
        },
        error: (error: any) => {
          this.erro = error.message;
          this.mostrarToast(this.erro, 'error');
          this.loading = false;
          this.cdRef.detectChanges();
        }
      });
  }

  editarPlantao(plantao: Plantao): void {
    if (!this.podeEditarEscala() || !this.validarEscala()) return;

    if (this.estaDeFerias(plantao.idUsuario, plantao.dia)) {
      this.mostrarToast('Não é possível atualizar plantão: funcionário está de férias neste dia!', 'warning');
      return;
    }

    const plantaoParaEnviar: Plantao = {
      id: plantao.id,
      mesEscala: plantao.mesEscala,
      dia: plantao.dia,
      idUsuario: plantao.idUsuario,
      idTipoPlantao: plantao.idTipoPlantao,
      idEscala: this.escala!.id // ← USANDO idEscala
    };

    this.escalaService.salvarPlantao(plantaoParaEnviar, this.usuarioLogadoId, this.escala!.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (plantaoAtualizado: Plantao) => {
          this.mostrarToast('Plantão atualizado com sucesso!', 'success');
          this.carregarEscalaCompleta();
        },
        error: (error: any) => {
          this.mostrarToast(error.message, 'error');
          this.cdRef.detectChanges();
        }
      });
  }

  removerPlantao(plantaoId: number, event?: Event): void {
    if (event) event.stopPropagation();

    if (!this.podeEditarEscala()) return;

    if (!confirm('Deseja remover este plantão?')) return;

    this.escalaService.removerPlantao(plantaoId, this.usuarioLogadoId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.mostrarToast('Plantão removido com sucesso!', 'success');
          this.carregarEscalaCompleta();
        },
        error: (error: any) => {
          this.mostrarToast(error.message, 'error');
          this.cdRef.detectChanges();
        }
      });
  }

  onDragStart(event: DragEvent, plantao: Plantao, funcionarioId: number, dia: number): void {
    if (!this.podeEditarEscala()) {
      event.preventDefault();
      return;
    }

    const dragData = {
      type: 'plantao',
      plantao: plantao,
      funcionarioId: funcionarioId,
      dia: dia
    };
    event.dataTransfer?.setData('text/plain', JSON.stringify(dragData));
    event.dataTransfer!.effectAllowed = 'move';
    (event.target as HTMLElement).classList.add('dragging');
  }

  onDragStartTipo(event: DragEvent, tipo: TipoPlantao): void {
    if (!this.podeEditarEscala()) {
      event.preventDefault();
      return;
    }

    const dragData = {
      type: 'tipo',
      tipo: tipo
    };
    event.dataTransfer?.setData('text/plain', JSON.stringify(dragData));
    event.dataTransfer!.effectAllowed = 'copy';
    (event.target as HTMLElement).classList.add('dragging');
  }

  onDragOver(event: DragEvent): void {
    if (!this.podeEditarEscala()) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const element = event.target as HTMLElement;
    const cell = element.closest('.celula');
    if (cell) cell.classList.add('drag-over');
  }

  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const element = event.target as HTMLElement;
    const cell = element.closest('.celula');
    if (cell && !cell.contains(event.relatedTarget as Node)) {
      cell.classList.remove('drag-over');
    }
  }

  onDragEnd(event: DragEvent): void {
    document.querySelectorAll('.dragging, .drag-over').forEach(el => {
      el.classList.remove('dragging', 'drag-over');
    });
  }

  onDropPlantao(event: DragEvent, funcionarioId: number, dia: number): void {
    if (!this.podeEditarEscala()) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const cell = (event.target as HTMLElement).closest('.celula');
    if (cell) cell.classList.remove('drag-over');

    if (this.estaDeFerias(funcionarioId, dia)) {
      this.mostrarToast('Não é possível alocar plantão: funcionário está de férias neste dia!', 'warning');
      this.onDragEnd(event);
      return;
    }

    try {
      const dragDataText = event.dataTransfer?.getData('text/plain');
      if (!dragDataText) return;

      const dragData = JSON.parse(dragDataText);
      if (dragData.type === 'plantao') {
        this.moverPlantao(dragData, funcionarioId, dia);
      } else if (dragData.type === 'tipo') {
        this.adicionarPlantaoDrag(dragData.tipo, funcionarioId, dia);
      }
    } catch (error) {
      console.error('Erro no processamento do drop:', error);
      this.mostrarToast('Erro ao processar a operação de arrastar e soltar.', 'error');
    }
    this.onDragEnd(event);
  }

  private moverPlantao(dragData: any, novoFuncionarioId: number, novoDia: number): void {
    const { plantao, funcionarioId: funcionarioOrigem, dia: diaOrigem } = dragData;

    if (funcionarioOrigem === novoFuncionarioId && diaOrigem === novoDia) {
      this.mostrarToast('Plantão já está nesta posição.', 'info');
      return;
    }

    const plantaoExistente = this.getPlantao(novoFuncionarioId, novoDia);
    if (plantaoExistente) {
      this.mostrarToast('Já existe um plantão neste dia/funcionário!', 'warning');
      return;
    }

    const plantaoAtualizado: Plantao = {
      ...plantao,
      idUsuario: novoFuncionarioId,
      dia: novoDia,
      mesEscala: this.ano * 100 + this.mes,
      idEscala: this.escala?.id // ← USANDO idEscala
    };

    this.editarPlantao(plantaoAtualizado);
  }

  private adicionarPlantaoDrag(tipo: TipoPlantao, funcionarioId: number, dia: number): void {
    const plantaoExistente = this.getPlantao(funcionarioId, dia);
    if (plantaoExistente) {
      this.mostrarToast('Já existe um plantão neste dia!', 'warning');
      return;
    }

    const mesEscala = this.ano * 100 + this.mes;
    const novoPlantao: Plantao = {
      idUsuario: funcionarioId,
      idTipoPlantao: tipo.id,
      dia: dia,
      mesEscala: mesEscala,
      idEscala: this.escala?.id // ← USANDO idEscala
    };

    this.adicionarPlantaoFromDrag(novoPlantao);
  }

  private adicionarPlantaoFromDrag(plantao: Plantao): void {
    if (!this.validarEscala()) return;

    const plantaoParaEnviar: Plantao = {
      id: plantao.id,
      mesEscala: plantao.mesEscala,
      dia: plantao.dia,
      idUsuario: plantao.idUsuario,
      idTipoPlantao: plantao.idTipoPlantao,
      idEscala: this.escala!.id // ← USANDO idEscala
    };

    this.escalaService.salvarPlantao(plantaoParaEnviar, this.usuarioLogadoId, this.escala!.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (plantaoSalvo: Plantao) => {
          this.mostrarToast('Plantão adicionado com sucesso!', 'success');
          this.carregarEscalaCompleta();
        },
        error: (error: any) => {
          this.mostrarToast(error.message, 'error');
          this.cdRef.detectChanges();
        }
      });
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

  gerarDiasDoMes(): number[] {
    const diasNoMes = new Date(this.ano, this.mes, 0).getDate();
    return Array.from({ length: diasNoMes }, (_, i) => i + 1);
  }

  getPlantao(funcionarioId: number, dia: number): Plantao | null {
    if (!this.vistaEscala?.grid || this.escalaNaoExiste) return null;
    const id = typeof funcionarioId === 'string' ? parseInt(funcionarioId) : funcionarioId;
    const usuarioGrid = this.vistaEscala.grid[id];
    return usuarioGrid?.[dia] || null;
  }

  getCorPlantao(tipoPlantaoId: number): string {
    const tipo = this.legenda?.find(t => t.id === tipoPlantaoId);
    return tipo?.cor || '#cccccc';
  }

  mesAnterior(): void {
    if (this.mes === 1) {
      this.mes = 12;
      this.ano--;
    } else {
      this.mes--;
    }
    this.carregarEscalaCompleta();
  }

  proximoMes(): void {
    if (this.mes === 12) {
      this.mes = 1;
      this.ano++;
    } else {
      this.mes++;
    }
    this.carregarEscalaCompleta();
  }

  getNomeMes(): string {
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return meses[this.mes - 1];
  }

  contarFinsDeSemana(): number {
    return this.diasDoMes.filter(dia => this.ehFimDeSemana(dia)).length;
  }

  getFuncionarios(): any[] {
    return this.funcionariosDaVista;
  }

  getTotalPlantoes(): number {
    if (!this.vistaEscala?.contagens || this.escalaNaoExiste) return 0;

    // Primeiro tentar usar totais pré-calculados
    if (this.vistaEscala.totais?.totalPlantoes !== undefined) {
      return this.vistaEscala.totais.totalPlantoes;
    }

    // Fallback: somar todas as contagens
    return Object.values(this.vistaEscala.contagens).reduce((total: number, contagem: any) => {
      if (typeof contagem === 'number') {
        return total + contagem;
      } else if (contagem && typeof contagem === 'object') {
        return total + (contagem.plantoes || 0);
      }
      return total;
    }, 0);
  }

  podeCriar(): boolean {
    return this.vistaEscala?.permissoes?.podeCriar || false;
  }

  podeEditar(): boolean {
    return this.vistaEscala?.permissoes?.podeEditar || false;
  }

  podeExcluir(): boolean {
    return this.vistaEscala?.permissoes?.podeExcluir || false;
  }

  podeReorganizar(): boolean {
    return this.vistaEscala?.permissoes?.podeReorganizar || false;
  }

  podePublicar(): boolean {
    return this.vistaEscala?.permissoes?.podePublicar || false;
  }

  limparErro(): void {
    this.erro = '';
  }

  getNomeTipoPlantao(tipoPlantaoId: number): string {
    const tipo = this.tiposPlantao.find(t => t.id === tipoPlantaoId);
    return tipo?.nome || 'Plantão';
  }

  getHorarioCompleto(tipoPlantaoId: number): string {
    const tipo = this.tiposPlantao.find(t => t.id === tipoPlantaoId);
    if (!tipo) return '';

    return this.horariosOtimizados[tipo.nome] || '';
  }

  getDiaSemana(dia: number): string {
    try {
      const data = new Date(this.ano, this.mes - 1, dia);
      const dias = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
      return dias[data.getDay()];
    } catch {
      return '';
    }
  }

  getCelulaClasses(funcionarioId: number, dia: number): string {
    let classes = 'celula';

    if (this.escala?.publicado) {
      classes += ' escala-publicada';
    }

    if (this.ehFeriado(dia)) {
      classes += ' feriado';
    }

    if (this.estaDeFerias(funcionarioId, dia)) {
      classes += ' ferias';
    }

    if (this.ehFimDeSemana(dia)) {
      classes += ' fim-de-semana';
    }

    return classes;
  }
}
