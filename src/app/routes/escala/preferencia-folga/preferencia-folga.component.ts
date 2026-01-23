import { Component, OnInit, ViewChild, ElementRef, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, MAT_DATE_LOCALE, DateAdapter, MAT_DATE_FORMATS } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';

import { PreferenciaFolga, PreferenciaFolgaRequest, User } from '@core';
import { PreferenciaFolgaService } from './preferencia-folga.service';
import { UsuarioService } from '@core/authentication/usuario.service';
import { AuthService } from '@core/authentication/auth.service';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';

// Configuração de data para o Brasil
export const MY_DATE_FORMATS = {
  parse: {
    dateInput: 'DD/MM/YYYY',
  },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

@Component({
  selector: 'app-preferencia-folga',
  templateUrl: './preferencia-folga.component.html',
  styleUrls: ['./preferencia-folga.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatTableModule,
    MatCardModule
  ],
  providers: [
    DatePipe,
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' },
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS },
  ]
})
export class PreferenciaFolgaComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef;

  // Services
  private fb = inject(FormBuilder);
  private preferenciaService = inject(PreferenciaFolgaService);
  private usuarioService = inject(UsuarioService);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private cdRef = inject(ChangeDetectorRef);
  private datePipe = inject(DatePipe);

  // Formulários
  preferenciaForm!: FormGroup;
  filtroForm!: FormGroup;

  // Dados
  usuarios: User[] = [];
  usuariosCarregados = false;
  preferencias: PreferenciaFolga[] = [];
  preferenciasFiltradas: PreferenciaFolga[] = [];

// Adicione no início da classe (após as outras propriedades)
  hoje = new Date();
  // Estados
  loading = false;
  modoEdicao = false;
  preferenciaEditando: PreferenciaFolga | null = null;

  // Permissões
  isAdmin = false;
  usuarioLogadoId: number | null = null;

  // Filtros
  meses = [
    { valor: 1, nome: 'Janeiro' },
    { valor: 2, nome: 'Fevereiro' },
    { valor: 3, nome: 'Março' },
    { valor: 4, nome: 'Abril' },
    { valor: 5, nome: 'Maio' },
    { valor: 6, nome: 'Junho' },
    { valor: 7, nome: 'Julho' },
    { valor: 8, nome: 'Agosto' },
    { valor: 9, nome: 'Setembro' },
    { valor: 10, nome: 'Outubro' },
    { valor: 11, nome: 'Novembro' },
    { valor: 12, nome: 'Dezembro' }
  ];

  anos: number[] = [];
  mesAtual: number;
  anoAtual: number;

  // Configuração do calendário
  minDate: Date;
  maxDate: Date;

  // Colunas da tabela
  displayedColumns: string[] = ['usuario', 'dataFolga', 'dataCriacao', 'acoes'];

  private destroy$ = new Subject<void>();

  constructor() {
    const hoje = new Date();
    this.mesAtual = hoje.getMonth() + 1;
    this.anoAtual = hoje.getFullYear();

    // Gerar lista de anos (do ano atual até 5 anos atrás)
    for (let i = 0; i < 6; i++) {
      this.anos.push(this.anoAtual - i);
    }

    // Limites de datas (1 ano atrás até 1 ano à frente)
    this.minDate = new Date();
    this.minDate.setFullYear(this.minDate.getFullYear() - 1);
    this.maxDate = new Date();
    this.maxDate.setFullYear(this.maxDate.getFullYear() + 1);
  }

  ngOnInit(): void {
    this.inicializarForms();
    this.carregarDados();
    this.subscribeToUserChanges();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private subscribeToUserChanges(): void {
    this.authService.user()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (user: any) => {
          this.verificarPermissoes(user);
        },
        error: (error) => {
          console.warn('Erro ao obter usuário:', error);
          this.isAdmin = false;
          this.usuarioLogadoId = null;
        }
      });
  }

  private verificarPermissoes(user: any): void {
    if (user && typeof user === 'object' && Object.keys(user).length > 0) {
      // Verificar se o usuário é admin
      this.isAdmin = (
        user.snAdmin === true ||
        user.isAdmin === true ||
        user.admin === true ||
        user.perfil === 'ADMIN' ||
        user.tipo === 'ADMINISTRADOR'
      );

      // Obter ID do usuário de forma segura
      this.usuarioLogadoId = this.getSafeUserId(user);

      console.log('Permissões verificadas:', { isAdmin: this.isAdmin, usuarioId: this.usuarioLogadoId, user });

      // Atualizar o formulário se necessário
      if (this.preferenciaForm) {
        if (!this.isAdmin && this.usuarioLogadoId) {
          // Desabilitar campo para usuário comum
          this.preferenciaForm.get('idUsuario')?.disable();
          this.preferenciaForm.patchValue({
            idUsuario: this.usuarioLogadoId
          });
        } else {
          // Habilitar campo para admin
          this.preferenciaForm.get('idUsuario')?.enable();
        }
      }
    } else {
      this.isAdmin = false;
      this.usuarioLogadoId = null;
      console.log('Usuário não encontrado ou vazio');
    }
  }

  private getSafeUserId(usuario: any): number | null {
    if (usuario?.codusuario !== undefined && usuario.codusuario !== null) return Number(usuario.codusuario);
    if (usuario?.id !== undefined && usuario.id !== null) return Number(usuario.id);
    if (usuario?.userId !== undefined && usuario.userId !== null) return Number(usuario.userId);
    if (usuario?.usuarioId !== undefined && usuario.usuarioId !== null) return Number(usuario.usuarioId);

    return null;
  }

  private inicializarForms(): void {
    // Formulário de filtros
    this.filtroForm = this.fb.group({
      usuario: [''],
      mes: [this.mesAtual],
      ano: [this.anoAtual]
    });

    // Formulário principal
    this.preferenciaForm = this.fb.group({
      idUsuario: ['', Validators.required],
      dataFolga: ['', Validators.required]
    });

    // Monitorar alterações nos filtros
    this.filtroForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.aplicarFiltros();
      });
  }

  private carregarDados(): void {
    this.carregarUsuarios();
    this.carregarPreferencias();
  }

  private carregarUsuarios(): void {
    this.loading = true;
    this.usuariosCarregados = false;

    this.usuarioService.getUsuarios()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          console.log('Resposta do getUsuarios:', response);
          this.processarUsuarios(response);
        },
        error: (error: any) => {
          console.error('Erro ao carregar usuários:', error);
          this.tratarErroUsuarios(error);
        }
      });
  }

  private processarUsuarios(response: any): void {
    try {
      if (Array.isArray(response)) {
        this.usuarios = response;
      } else if (response && Array.isArray(response.data)) {
        this.usuarios = response.data;
      } else if (response && response.data && typeof response.data === 'object') {
        // Se data é um objeto, converter para array
        this.usuarios = Object.values(response.data);
      } else if (response && typeof response === 'object') {
        // Se a resposta é um objeto, converter para array
        this.usuarios = Object.values(response);
      } else {
        this.usuarios = [];
      }

      // Garantir que cada usuário tenha as propriedades necessárias
      this.usuarios = this.usuarios.map((usuario: any) => ({
        codusuario: usuario.codusuario || usuario.id || 0,
        nome: usuario.nome || 'Nome não informado',
        matricula: usuario.matricula || 'Sem matrícula',
        email: usuario.email || '',
        snAdmin: usuario.snAdmin || false,
        snAtivo: usuario.snAtivo !== false,
        ...usuario
      })).filter((usuario: any) => usuario.codusuario && usuario.nome);

      console.log('Usuários processados:', this.usuarios.length, this.usuarios);

      this.usuariosCarregados = true;
      this.loading = false;
      this.cdRef.detectChanges();
    } catch (error) {
      console.error('Erro ao processar usuários:', error);
      this.usuarios = [];
      this.usuariosCarregados = false;
      this.loading = false;
      this.cdRef.detectChanges();
    }
  }

  private tratarErroUsuarios(error: any): void {
    console.error('Erro ao carregar usuários:', error);
    this.mostrarMensagem('Erro ao carregar usuários', 'error');
    this.usuarios = [];
    this.usuariosCarregados = false;
    this.loading = false;
    this.cdRef.detectChanges();
  }

  private carregarPreferencias(): void {
    this.loading = true;

    if (this.isAdmin) {
      // Admin: carrega todas as preferências
      this.preferenciaService.listarPreferencias()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (preferencias: PreferenciaFolga[]) => {
            console.log('Preferências carregadas (admin):', preferencias);
            this.processarPreferencias(preferencias);
          },
          error: (error: any) => {
            this.tratarErroPreferencias(error);
          }
        });
    } else if (this.usuarioLogadoId) {
      // Usuário comum: carrega apenas suas preferências
      const currentDate = new Date();
      const ano = currentDate.getFullYear();
      const mes = currentDate.getMonth() + 1;

      console.log('Carregando preferências para usuário:', this.usuarioLogadoId, mes, ano);

      this.preferenciaService.listarPorUsuarioMesAno(this.usuarioLogadoId, mes, ano)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (diasPreferencia: number[]) => {
            console.log('Dias de preferência:', diasPreferencia);
            // Converter dias para objetos PreferenciaFolga
            const preferencias: PreferenciaFolga[] = diasPreferencia.map(dia => ({
              id: 0,
              idUsuario: this.usuarioLogadoId!,
              dataFolga: new Date(ano, mes - 1, dia),
              dataCriacao: new Date()
            }));
            this.processarPreferencias(preferencias);
          },
          error: (error: any) => {
            this.tratarErroPreferencias(error);
          }
        });
    } else {
      this.preferencias = [];
      this.preferenciasFiltradas = [];
      this.loading = false;
      this.cdRef.detectChanges();
    }
  }

  private processarPreferencias(preferencias: PreferenciaFolga[]): void {
    this.preferencias = preferencias.map(p => ({
      ...p,
      dataFolga: new Date(p.dataFolga),
      dataCriacao: p.dataCriacao ? new Date(p.dataCriacao) : undefined
    })).filter(p => !isNaN(p.dataFolga.getTime()));

    console.log('Preferências processadas:', this.preferencias);

    this.aplicarFiltros();
    this.loading = false;
    this.cdRef.detectChanges();
  }

  private tratarErroPreferencias(error: any): void {
    console.error('Erro ao carregar preferências:', error);
    this.mostrarMensagem('Erro ao carregar preferências', 'error');
    this.preferencias = [];
    this.preferenciasFiltradas = [];
    this.loading = false;
    this.cdRef.detectChanges();
  }

  private aplicarFiltros(): void {
    const filtro = this.filtroForm.value;

    this.preferenciasFiltradas = this.preferencias.filter(preferencia => {
      // Filtro por usuário
      if (filtro.usuario && preferencia.idUsuario !== parseInt(filtro.usuario)) {
        return false;
      }

      // Usuário comum só vê suas próprias preferências
      if (!this.isAdmin && preferencia.idUsuario !== this.usuarioLogadoId) {
        return false;
      }

      // Filtro por mês e ano
      const data = new Date(preferencia.dataFolga);
      const mesPreferencia = data.getMonth() + 1;
      const anoPreferencia = data.getFullYear();

      if (filtro.mes && mesPreferencia !== parseInt(filtro.mes)) {
        return false;
      }

      if (filtro.ano && anoPreferencia !== parseInt(filtro.ano)) {
        return false;
      }

      return true;
    });

    console.log('Preferências filtradas:', this.preferenciasFiltradas.length);
  }

  onSubmit(): void {
    if (this.preferenciaForm.invalid) {
      this.mostrarMensagem('Preencha todos os campos obrigatórios', 'warning');
      this.marcarCamposComoSujos(this.preferenciaForm);
      return;
    }

    const formData = this.preferenciaForm.value;
    const idUsuario = this.isAdmin ? parseInt(formData.idUsuario) : this.usuarioLogadoId;

    if (!idUsuario) {
      this.mostrarMensagem('Usuário não identificado', 'error');
      return;
    }

    // Formatar data para o backend
    const dataFolga = new Date(formData.dataFolga);
    if (isNaN(dataFolga.getTime())) {
      this.mostrarMensagem('Data inválida', 'error');
      return;
    }

    const dataFormatada = dataFolga.toISOString().split('T')[0];

    this.loading = true;

    if (this.modoEdicao && this.preferenciaEditando) {
      const dataAntiga = this.formatarDataCSV(this.preferenciaEditando.dataFolga);

      this.preferenciaService.removerPreferencia(this.preferenciaEditando.idUsuario, dataAntiga)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.criarPreferencia(idUsuario, dataFormatada);
          },
          error: (error: any) => {
            console.error('Erro ao excluir preferência para edição:', error);
            this.mostrarMensagem(error.message || 'Erro ao editar preferência', 'error');
            this.loading = false;
            this.cdRef.detectChanges();
          }
        });
    } else {
      this.criarPreferencia(idUsuario, dataFormatada);
    }
  }

  temPermissaoParaEditar(preferencia: PreferenciaFolga): boolean {
    return this.isAdmin || preferencia.idUsuario === this.usuarioLogadoId;
  }

  private criarPreferencia(idUsuario: number, dataFormatada: string): void {
    const jaExiste = this.preferencias.some(p =>
      p.idUsuario === idUsuario &&
      this.formatarDataCSV(p.dataFolga) === dataFormatada
    );

    if (jaExiste) {
      this.mostrarMensagem('Já existe uma preferência para esta data', 'warning');
      this.loading = false;
      this.cdRef.detectChanges();
      return;
    }

    this.preferenciaService.cadastrarPreferencia(idUsuario, dataFormatada)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (novaPreferencia: PreferenciaFolga) => {
          this.preferencias.push({
            ...novaPreferencia,
            dataFolga: new Date(novaPreferencia.dataFolga),
            dataCriacao: novaPreferencia.dataCriacao ? new Date(novaPreferencia.dataCriacao) : new Date()
          });
          this.aplicarFiltros();
          this.resetarFormulario();
          this.mostrarMensagem('Preferência de folga cadastrada com sucesso!', 'success');
          this.loading = false;
          this.cdRef.detectChanges();
        },
        error: (error: any) => {
          console.error('Erro ao criar preferência:', error);
          this.mostrarMensagem(error.message || 'Erro ao cadastrar preferência', 'error');
          this.loading = false;
          this.cdRef.detectChanges();
        }
      });
  }

  editarPreferencia(preferencia: PreferenciaFolga): void {
    if (!this.temPermissaoParaEditar(preferencia)) {
      this.mostrarMensagem('Você não tem permissão para editar esta preferência', 'error');
      return;
    }

    this.modoEdicao = true;
    this.preferenciaEditando = preferencia;

    this.preferenciaForm.patchValue({
      idUsuario: preferencia.idUsuario.toString(),
      dataFolga: new Date(preferencia.dataFolga)
    });

    if (!this.isAdmin) {
      this.preferenciaForm.get('idUsuario')?.disable();
    }

    this.scrollParaFormulario();
  }

  excluirPreferencia(preferencia: PreferenciaFolga): void {
    if (!this.temPermissaoParaEditar(preferencia)) {
      this.mostrarMensagem('Você não tem permissão para excluir esta preferência', 'error');
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        titulo: 'Confirmar Exclusão',
        mensagem: `Tem certeza que deseja excluir a preferência de folga do dia ${this.formatarData(preferencia.dataFolga)}?`,
        confirmarTexto: 'Excluir',
        cancelarTexto: 'Cancelar'
      }
    });

    dialogRef.afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe(confirmado => {
        if (confirmado) {
          this.loading = true;
          this.preferenciaService.removerPreferencia(preferencia.idUsuario, this.formatarDataCSV(preferencia.dataFolga))
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: () => {
                this.preferencias = this.preferencias.filter(p =>
                  !(p.idUsuario === preferencia.idUsuario &&
                    this.formatarDataCSV(p.dataFolga) === this.formatarDataCSV(preferencia.dataFolga))
                );
                this.aplicarFiltros();
                this.mostrarMensagem('Preferência excluída com sucesso!', 'success');
                this.loading = false;
                this.cdRef.detectChanges();
              },
              error: (error: any) => {
                console.error('Erro ao excluir preferência:', error);
                this.mostrarMensagem(error.message || 'Erro ao excluir preferência', 'error');
                this.loading = false;
                this.cdRef.detectChanges();
              }
            });
        }
      });
  }

  // MÉTODO IMPORTAR CSV
  importarCSV(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    // Verificar se é admin
    if (!this.isAdmin) {
      this.mostrarMensagem('Somente administradores podem importar CSV', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const csvText = e.target.result;
      this.processarCSV(csvText);
    };
    reader.readAsText(file);
  }

  private processarCSV(csvText: string): void {
    const linhas = csvText.split('\n');
    const preferencias: { idUsuario: number, dataFolga: string }[] = [];

    // Ignorar cabeçalho e processar linhas
    for (let i = 1; i < linhas.length; i++) {
      const linha = linhas[i].trim();
      if (!linha) continue;

      const colunas = linha.split(';'); // ou ',' dependendo do separador

      if (colunas.length >= 2) {
        const idUsuario = parseInt(colunas[0]);
        const dataFolga = colunas[1];

        if (!isNaN(idUsuario) && dataFolga) {
          // Verificar se o usuário existe na lista
          const usuarioExiste = this.usuarios.some(u =>
            u.codusuario === idUsuario ||
            (u as any).id === idUsuario
          );
          if (usuarioExiste) {
            preferencias.push({
              idUsuario: idUsuario,
              dataFolga: dataFolga
            });
          }
        }
      }
    }

    if (preferencias.length > 0) {
      this.mostrarMensagem(`${preferencias.length} preferências carregadas do CSV. Processando...`, 'info');
      this.enviarPreferenciasEmLote(preferencias);
    } else {
      this.mostrarMensagem('Nenhuma preferência válida encontrada no CSV', 'warning');
    }

    // Limpar input de arquivo
    if (this.fileInput && this.fileInput.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }

  private enviarPreferenciasEmLote(preferencias: { idUsuario: number, dataFolga: string }[]): void {
    let processadas = 0;
    let sucesso = 0;
    let erros = 0;

    const processarProxima = () => {
      if (processadas >= preferencias.length) {
        this.mostrarMensagem(`Importação concluída: ${sucesso} sucesso, ${erros} erros`, 'info');
        // Recarregar preferências
        this.carregarPreferencias();
        return;
      }

      const preferencia = preferencias[processadas];
      processadas++;

      this.preferenciaService.cadastrarPreferencia(preferencia.idUsuario, preferencia.dataFolga)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            sucesso++;
            processarProxima();
          },
          error: () => {
            erros++;
            processarProxima();
          }
        });
    };

    // Iniciar processamento em lote (limitar a 5 requisições simultâneas)
    const batchSize = 5;
    for (let i = 0; i < Math.min(batchSize, preferencias.length); i++) {
      processarProxima();
    }
  }

  // MÉTODO EXPORTAR CSV
  exportarCSV(): void {
    if (this.preferenciasFiltradas.length === 0) {
      this.mostrarMensagem('Nenhuma preferência para exportar', 'warning');
      return;
    }

    const dados = this.preferenciasFiltradas.map(p => {
      const usuario = this.getUsuarioPorId(p.idUsuario);
      return {
        'ID Usuário': p.idUsuario,
        'Nome Usuário': usuario?.nome || 'N/A',
        'Matrícula': usuario?.matricula || 'N/A',
        'Data Folga': this.formatarDataCSV(p.dataFolga),
        'Data Criação': p.dataCriacao ? this.formatarDataCSV(p.dataCriacao) : ''
      };
    });

    const csv = this.converterParaCSV(dados);
    this.downloadCSV(csv, `preferencias_folga_${this.mesAtual}_${this.anoAtual}.csv`);
  }

  private converterParaCSV(dados: any[]): string {
    if (dados.length === 0) return '';

    const cabecalho = Object.keys(dados[0]).join(';');
    const linhas = dados.map(obj => Object.values(obj).join(';'));
    return [cabecalho, ...linhas].join('\n');
  }

  private downloadCSV(csv: string, filename: string): void {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  getUsuariosFiltrados(): any[] {
    if (!this.usuariosCarregados) {
      return [];
    }

    if (this.isAdmin) {
      return this.usuarios;
    } else {
      return this.usuarios.filter(u =>
        u.codusuario === this.usuarioLogadoId ||
        (u as any).id === this.usuarioLogadoId
      );
    }
  }

  getNomeUsuario(idUsuario: number): string {
    const usuario = this.getUsuarioPorId(idUsuario);

    if (usuario) {
      return `${usuario.nome} (${usuario.matricula || 'Sem matrícula'})`;
    }

    return `ID: ${idUsuario}`;
  }

  private getUsuarioPorId(idUsuario: number): any {
    return this.usuarios.find(u =>
      u.codusuario === idUsuario ||
      (u as any).id === idUsuario
    );
  }

  formatarData(data: Date | string): string {
    try {
      const date = new Date(data);
      if (isNaN(date.getTime())) {
        return 'Data inválida';
      }
      return this.datePipe.transform(date, 'dd/MM/yyyy') || 'Data inválida';
    } catch {
      return 'Data inválida';
    }
  }

  private formatarDataCSV(data: Date | string): string {
    try {
      const date = new Date(data);
      if (isNaN(date.getTime())) {
        return '';
      }
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  }

  resetarFormulario(): void {
    this.preferenciaForm.reset();
    this.modoEdicao = false;
    this.preferenciaEditando = null;

    // Reconfigurar o formulário baseado nas permissões
    if (this.preferenciaForm) {
      if (!this.isAdmin && this.usuarioLogadoId) {
        this.preferenciaForm.get('idUsuario')?.disable();
        this.preferenciaForm.patchValue({
          idUsuario: this.usuarioLogadoId
        });
      } else {
        this.preferenciaForm.get('idUsuario')?.enable();
      }
    }
  }

  private scrollParaFormulario(): void {
    setTimeout(() => {
      const element = document.querySelector('.form-container');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  private mostrarMensagem(mensagem: string, tipo: 'success' | 'error' | 'info' | 'warning'): void {
    this.snackBar.open(mensagem, 'Fechar', {
      duration: 5000,
      panelClass: [`snackbar-${tipo}`],
      horizontalPosition: 'right',
      verticalPosition: 'top'
    });
  }

  limparFiltros(): void {
    this.filtroForm.patchValue({
      usuario: '',
      mes: this.mesAtual,
      ano: this.anoAtual
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

  getUsuariosUnicos(): number[] {
    const ids = this.preferenciasFiltradas.map(p => p.idUsuario);
    return [...new Set(ids)];
  }

  isDataValida(data: string): boolean {
    try {
      const date = new Date(data);
      return !isNaN(date.getTime());
    } catch {
      return false;
    }
  }

  // Método para estilizar datas no calendário (opcional)
  dateClass = (d: Date): string => {
    const date = d.getDate();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();

    // Verificar se a data já tem preferência
    const temPreferencia = this.preferencias.some(p => {
      const pDate = new Date(p.dataFolga);
      return pDate.getDate() === date &&
             pDate.getMonth() + 1 === month &&
             pDate.getFullYear() === year;
    });

    return temPreferencia ? 'has-preference' : '';
  }
  // Métodos auxiliares para o template
getDiaSemana(data: Date | string): string {
  try {
    const date = new Date(data);
    if (isNaN(date.getTime())) {
      return '';
    }
    const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    return dias[date.getDay()];
  } catch {
    return '';
  }
}

formatarHora(data: Date | string): string {
  try {
    const date = new Date(data);
    if (isNaN(date.getTime())) {
      return '';
    }
    return this.datePipe.transform(date, 'HH:mm') || '';
  } catch {
    return '';
  }
}
}
