import { Component, OnInit, ChangeDetectorRef, OnDestroy, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { Plantao, TipoPlantao, User, VistaEscala, Escala, PreferenciaFolga } from '@core';
import { EscalaService } from './escala.service';
import { TipoPlantaoService } from './tipo-plantao.service';
import { UsuarioService } from '@core/authentication/usuario.service';
import { FeriadoService } from './feriado.service';
import { FeriasService } from './ferias.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PreferenciaFolgaService } from './preferencia-folga/preferencia-folga.service';

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
  feriados: any[] = [];
  ferias: any[] = [];
  preferenciasFolga: PreferenciaFolga[] = [];
  diasDoMes: number[] = [];
  funcionarios: User[] = [];
  tiposPlantao: TipoPlantao[] = [];

  // Estruturas para mapeamento rápido de preferências
  preferenciasPorUsuario: Map<number, number[]> = new Map(); // idUsuario -> [dias]
  preferenciasDias: Set<number> = new Set(); // Dias que têm preferência
  preferenciasUsuarios: Set<number> = new Set(); // Usuários que têm preferência

  plantaoForm: FormGroup;
  usuarioLogadoId = 1;

  // Flag para controlar se estamos fazendo uma atualização parcial
  private atualizandoParcialmente = false;

  private destroy$ = new Subject<void>();
  private snackBar = inject(MatSnackBar);

  constructor(
    private cdRef: ChangeDetectorRef,
    private fb: FormBuilder,
    private escalaService: EscalaService,
    private tipoPlantaoService: TipoPlantaoService,
    private funcionarioService: UsuarioService,
    private feriadoService: FeriadoService,
    private feriasService: FeriasService,
    private preferenciaFolgaService: PreferenciaFolgaService
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

    if (this.podeCriar()) {
      return true;
    }

    if (this.podeEditar()) {
      this.mostrarToast('Usuários com permissão de edição só podem mover plantões, não adicionar ou remover.', 'warning');
      return false;
    }

    this.mostrarToast('Você não tem permissão para alterar esta escala.', 'warning');
    return false;
  }

  private podeMoverPlantao(): boolean {
    if (this.escalaNaoExiste) {
      return false;
    }
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

          // ✅ ATUALIZADO: Processar preferências da vistaEscala
          this.processarPreferenciasDaVista(vista);

          if (this.escalaNaoExiste) {
            this.usuarioPodeGerarEscala = vista.permissoes?.podeCriar || true;
          } else {
            this.usuarioPodeGerarEscala = vista.permissoes?.podeCriar || false;
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

            // ✅ ATUALIZAR PREFERÊNCIAS TAMBÉM
            this.processarPreferenciasDaVista(vista);

            if (vista.escala && this.escala) {
              this.escala.publicado = vista.escala.publicado;
            }
          }

          this.atualizandoParcialmente = false;
          this.cdRef.detectChanges();
        },
        error: (error: any) => {
          console.error('Erro ao atualizar grid parcialmente:', error);
          this.atualizandoParcialmente = false;
        }
      });
  }

  private carregarDadosAdicionais(): void {
    // Carregar feriados
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

    // Carregar férias
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

    // Carregar preferências de folga do serviço (se necessário)
    this.carregarPreferenciasFolga();

    // Carregar funcionários
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

  private carregarPreferenciasFolga(): void {
    this.preferenciaFolgaService.listarPorMesAno(this.mes, this.ano)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (preferencias: PreferenciaFolga[]) => {
          this.preferenciasFolga = preferencias;
          this.processarPreferenciasServico(preferencias);
        },
        error: (error: any) => {
          console.error('Erro ao carregar preferências de folga:', error);
          this.preferenciasFolga = [];
        }
      });
  }

private processarPreferenciasServico(preferencias: PreferenciaFolga[]): void {
  preferencias.forEach(pref => {
    let data: Date;

    if (typeof pref.dataFolga === 'string') {
      // CORREÇÃO: Usar método que evita problemas de fuso horário
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

    // Verificar se a data está no mês/ano correto
    if (dataMes === this.mes && dataAno === this.ano) {
      console.log(`DEBUG: Preferência encontrada - Usuário: ${idUsuario}, Dia: ${dia}`);

      this.preferenciasDias.add(dia);
      this.preferenciasUsuarios.add(idUsuario);

      if (!this.preferenciasPorUsuario.has(idUsuario)) {
        this.preferenciasPorUsuario.set(idUsuario, []);
      }
      if (!this.preferenciasPorUsuario.get(idUsuario)!.includes(dia)) {
        this.preferenciasPorUsuario.get(idUsuario)!.push(dia);
      }
    }
  });
}

  // ✅ CORREÇÃO: Processar preferências da vistaEscala (do backend)
  private processarPreferenciasDaVista(vista: VistaEscala): void {
    // Limpar estruturas existentes
    this.preferenciasPorUsuario.clear();
    this.preferenciasDias.clear();
    this.preferenciasUsuarios.clear();

    // Processar preferenciasPorUsuario do backend
    if (vista.preferenciasPorUsuario) {
      Object.entries(vista.preferenciasPorUsuario).forEach(([userId, dias]: [string, any]) => {
        const idUsuario = parseInt(userId);
        const diasArray = Array.isArray(dias) ? dias : [];

        diasArray.forEach((dia: number) => {
          this.preferenciasDias.add(dia);
          this.preferenciasUsuarios.add(idUsuario);

          if (!this.preferenciasPorUsuario.has(idUsuario)) {
            this.preferenciasPorUsuario.set(idUsuario, []);
          }
          if (!this.preferenciasPorUsuario.get(idUsuario)!.includes(dia)) {
            this.preferenciasPorUsuario.get(idUsuario)!.push(dia);
          }
        });
      });
    }

    // Também processar array simples de preferencias
    /*if (vista.preferencias && Array.isArray(vista.preferencias)) {
      vista.preferencias.forEach(dia => {
        this.preferenciasDias.add(dia);
      });
    }*/
  }

  private carregarTiposPlantao(): void {
    this.tipoPlantaoService.getTiposPlantao()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tipos: TipoPlantao[]) => {
          this.tiposPlantao = tipos;
        },
        error: (error: any) => {
          this.tiposPlantao = [];
        }
      });
  }

  // ✅ VERIFICAR PREFERÊNCIA
  temPreferenciaFolga(funcionarioId: number, dia: number): boolean {
    const preferenciasUsuario = this.preferenciasPorUsuario.get(funcionarioId);
    return preferenciasUsuario ? preferenciasUsuario.includes(dia) : false;
  }

  // ✅ TEXTO "PF" PARA PREFERÊNCIA
  getTextoPreferencia(): string {
    return 'PF';
  }

  // ✅ CONTAGEM DE PREFERÊNCIAS
  contarTotalPreferencias(): number {
    if (this.vistaEscala?.preferencias) {
      return this.vistaEscala.preferencias.length;
    }
    return 0;
  }

  contarUsuariosComPreferencia(): number {
    return this.preferenciasUsuarios.size;
  }

  // MÉTODOS PÚBLICOS (restante do código mantido igual)
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

    /*if (this.temPreferenciaFolga(formValue.idUsuario, formValue.dia)) {
      if (!confirm('⚠️ ATENÇÃO: Este funcionário marcou este dia como preferência de folga.\n\nDeseja continuar mesmo assim?')) {
        return;
      }
    }*/

    const plantao: Plantao = {
      mesEscala: mesEscala,
      dia: formValue.dia,
      idUsuario: formValue.idUsuario,
      idTipoPlantao: formValue.idTipoPlantao,
      idEscala: this.escala.id
    };

    this.loading = true;

    this.escalaService.salvarPlantao(plantao, this.usuarioLogadoId, this.escala.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          this.plantaoForm.reset();
          this.mostrarToast('Plantão salvo com sucesso!', 'success');
          this.atualizarGridParcialmente();
          this.loading = false;
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
    if (!this.podeEditarEscala()) return;

    if (this.estaDeFerias(plantao.idUsuario, plantao.dia)) {
      this.mostrarToast('Não é possível atualizar plantão: funcionário está de férias neste dia!', 'warning');
      return;
    }

    /*if (this.temPreferenciaFolga(plantao.idUsuario, plantao.dia)) {
      if (!confirm('⚠️ ATENÇÃO: Este funcionário marcou este dia como preferência de folga.\n\nDeseja continuar mesmo assim?')) {
        return;
      }
    }*/

    const plantaoParaEnviar: Plantao = {
      id: plantao.id,
      mesEscala: plantao.mesEscala,
      dia: plantao.dia,
      idUsuario: plantao.idUsuario,
      idTipoPlantao: plantao.idTipoPlantao,
      idEscala: this.escala!.id
    };

    this.loading = true;

    this.escalaService.salvarPlantao(plantaoParaEnviar, this.usuarioLogadoId, this.escala!.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (plantaoAtualizado: Plantao) => {
          this.mostrarToast('Plantão atualizado com sucesso!', 'success');
          this.atualizarGridParcialmente();
          this.loading = false;
        },
        error: (error: any) => {
          this.mostrarToast(error.message, 'error');
          this.loading = false;
          this.cdRef.detectChanges();
        }
      });
  }

  removerPlantao(plantaoId: number, event?: Event): void {
    if (event) event.stopPropagation();

    if (!this.podeAdicionarRemoverPlantao()) return;

    if (!confirm('Deseja remover este plantão?')) return;

    this.loading = true;

    this.escalaService.removerPlantao(plantaoId, this.usuarioLogadoId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.mostrarToast('Plantão removido com sucesso!', 'success');
          this.atualizarGridParcialmente();
          this.loading = false;
        },
        error: (error: any) => {
          const errorMessage = error?.message ||
                              error?.error?.erro ||
                              error?.error?.message ||
                              'Erro ao processar a requisição';
          this.mostrarToast(errorMessage, 'error');
          this.loading = false;
          this.cdRef.detectChanges();
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

      this.escalaService.publicarEscala(mesEscala, this.usuarioLogadoId, 'Escala publicada')
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.mostrarToast('Escala publicada com sucesso!', 'success');
            if (this.escala) this.escala.publicado = true;
            this.cdRef.detectChanges();
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

    if (!this.podeCriar()) {
      this.mostrarToast('Você não tem permissão para reverter a publicação.', 'warning');
      return;
    }

    if (confirm('Tem certeza que deseja reverter a publicação da escala?')) {
      const mesEscala = this.ano * 100 + this.mes;

      this.escalaService.reverterPublicacao(mesEscala, this.usuarioLogadoId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.mostrarToast('Publicação revertida com sucesso!', 'success');
            if (this.escala) this.escala.publicado = false;
            this.cdRef.detectChanges();
          },
          error: (error: any) => {
            this.mostrarToast(error.message, 'error');
            this.cdRef.detectChanges();
          }
        });
    }
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

  gerarDiasDoMes(): number[] {
    const diasNoMes = new Date(this.ano, this.mes, 0).getDate();
    return Array.from({ length: diasNoMes }, (_, i) => i + 1);
  }

  getNomeMes(): string {
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return meses[this.mes - 1];
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

  contarFinsDeSemana(): number {
    return this.diasDoMes.filter(dia => this.ehFimDeSemana(dia)).length;
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

  private dataEstaNoPeriodo(data: string, inicio: string, fim: string): boolean {
    const dataObj = new Date(data);
    const inicioObj = new Date(inicio);
    const fimObj = new Date(fim);
    return dataObj >= inicioObj && dataObj <= fimObj;
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
      partes.push('FÉRIAS');
    }

    if (this.temPreferenciaFolga(funcionarioId, dia)) {
      partes.push('Pref. Folga');
    }

    if (!this.escalaNaoExiste) {
      const plantao = this.getPlantao(funcionarioId, dia);
      if (plantao) {
        const tipo = this.getNomeTipoPlantao(plantao.idTipoPlantao);
        partes.push(`Plantão: ${tipo}`);
      }
    }

    return partes.join(' | ');
  }

  getPlantao(funcionarioId: number, dia: number): Plantao | null {
    if (!this.vistaEscala?.grid || this.escalaNaoExiste) return null;
    const id = typeof funcionarioId === 'string' ? parseInt(funcionarioId) : funcionarioId;
    const usuarioGrid = this.vistaEscala.grid[id];
    return usuarioGrid?.[dia] || null;
  }

  getCorPlantao(tipoPlantaoId: number): string {
    const tipo = this.tiposPlantao.find(t => t.id === tipoPlantaoId);
    return tipo?.cor || '#cccccc';
  }

  getExibicaoPlantao(tipoPlantaoId: number): string {
    const tipo = this.tiposPlantao.find(t => t.id === tipoPlantaoId);
    if (!tipo) return '?';

    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      return tipo.nome.substring(0, 2).toUpperCase();
    }

    return tipo.nome.substring(0, 5);
  }

  getTooltipPlantao(tipoPlantaoId: number): string {
    const tipo = this.tiposPlantao.find(t => t.id === tipoPlantaoId);
    if (!tipo) return 'Plantão';
    return tipo.nome;
  }

  getHorarioTipoPlantao(tipo: TipoPlantao): string {
    return tipo.duracao ? `${tipo.duracao}h` : '';
  }

  getQuantidadePlantoesFuncionario(funcionarioId: number): number {
    if (!this.vistaEscala?.contagens || this.escalaNaoExiste) return 0;

    const id = typeof funcionarioId === 'string' ? parseInt(funcionarioId) : funcionarioId;

    if (this.vistaEscala.contagens[id]) {
      const contagem = this.vistaEscala.contagens[id];
      if (typeof contagem === 'number') {
        return contagem;
      } else if (contagem && typeof contagem === 'object') {
        return (contagem as any).plantoes || 0;
      }
    }

    const plantoesFuncionario = this.vistaEscala.grid?.[id];
    if (!plantoesFuncionario) return 0;

    return Object.values(plantoesFuncionario).filter(plantao =>
      plantao && plantao.idTipoPlantao
    ).length;
  }

  getFuncionariosOrdenados(): any[] {
    if (this.vistaEscala?.funcionarios?.length) {
      return [...this.vistaEscala.funcionarios].sort((a, b) => {
        const nomeA = a.nome || '';
        const nomeB = b.nome || '';
        return nomeA.localeCompare(nomeB);
      });
    }

    const funcionarios = this.funcionarios.map(user => ({
      id: user.codusuario,
      nome: user.nome || '',
      setor: user.setor || 'Não informado'
    }));

    return [...funcionarios].sort((a, b) => a.nome.localeCompare(b.nome));
  }

  getFuncionarios(): any[] {
    return this.getFuncionariosOrdenados();
  }

  getTotalPlantoes(): number {
    if (!this.vistaEscala?.contagens || this.escalaNaoExiste) return 0;

    if (this.vistaEscala.totais?.totalPlantoes !== undefined) {
      return this.vistaEscala.totais.totalPlantoes;
    }

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
    if (this.isEscalaPublicada()) {
      return this.podeCriar();
    }
    return this.vistaEscala?.permissoes?.podeExcluir || false;
  }

  podeReorganizar(): boolean {
    return this.vistaEscala?.permissoes?.podeReorganizar || false;
  }

  isEscalaPublicada(): boolean {
    return this.escala?.publicado || false;
  }

  getNomeTipoPlantao(tipoPlantaoId: number): string {
    const tipo = this.tiposPlantao.find(t => t.id === tipoPlantaoId);
    return tipo?.nome || 'Plantão';
  }

  // DRAG & DROP (mantido igual)
  onDragStart(event: DragEvent, plantao: Plantao, funcionarioId: number, dia: number): void {
    if (!this.podeMoverPlantao()) {
      event.preventDefault();
      this.mostrarToast('Você não tem permissão para mover plantões.', 'warning');
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
    if (!this.podeAdicionarRemoverPlantao()) {
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
    event.preventDefault();
    event.stopPropagation();

    const cell = (event.target as HTMLElement).closest('.celula');
    if (cell) cell.classList.remove('drag-over');

    if (this.estaDeFerias(funcionarioId, dia)) {
      this.mostrarToast('Não é possível alocar plantão: funcionário está de férias neste dia!', 'warning');
      this.onDragEnd(event);
      return;
    }

    /*if (this.temPreferenciaFolga(funcionarioId, dia)) {
      if (!confirm('⚠️ ATENÇÃO: Este funcionário marcou este dia como preferência de folga.\n\nDeseja continuar mesmo assim?')) {
        this.onDragEnd(event);
        return;
      }
    }*/

    try {
      const dragDataText = event.dataTransfer?.getData('text/plain');
      if (!dragDataText) return;

      const dragData = JSON.parse(dragDataText);

      if (dragData.type === 'plantao') {
        if (!this.podeMoverPlantao()) {
          this.mostrarToast('Você não tem permissão para mover plantões.', 'warning');
          this.onDragEnd(event);
          return;
        }
        this.moverPlantao(dragData, funcionarioId, dia);
      } else if (dragData.type === 'tipo') {
        if (!this.podeAdicionarRemoverPlantao()) {
          this.onDragEnd(event);
          return;
        }
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
      idEscala: this.escala?.id
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

    this.loading = true;

    this.escalaService.salvarPlantao(plantaoParaEnviar, this.usuarioLogadoId, this.escala.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (plantaoSalvo: Plantao) => {
          this.mostrarToast('Plantão adicionado com sucesso!', 'success');
          this.atualizarGridParcialmente();
          this.loading = false;
        },
        error: (error: any) => {
          this.mostrarToast(error.message, 'error');
          this.loading = false;
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

  limparErro(): void {
    this.erro = '';
  }
}
