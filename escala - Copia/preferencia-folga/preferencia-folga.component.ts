import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, distinctUntilChanged, debounceTime, switchMap, map, catchError } from 'rxjs/operators';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, MAT_DATE_LOCALE, MAT_DATE_FORMATS } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';

import { PreferenciaFolga, Usuario } from '@core';
import { PreferenciaFolgaService } from './preferencia-folga.service';
import { AuthService } from '@core/authentication/auth.service';
import { UsuarioService } from '@core/authentication/usuario.service';


export const MY_DATE_FORMATS = {
  parse: { dateInput: 'DD/MM/YYYY' },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

interface DiaInfo {
  date: Date;
  dia: number;
  mes: number;
  ano: number;
  diaSemana: number;
  isWeekend: boolean;
  isPreferencia: boolean;
  selecionado: boolean;
}

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
  private fb = inject(FormBuilder);
  private preferenciaService = inject(PreferenciaFolgaService);
  private authService = inject(AuthService);
  private usuarioService = inject(UsuarioService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private cdRef = inject(ChangeDetectorRef);
  private datePipe = inject(DatePipe);

  filtroForm!: FormGroup;

  usuarioLogadoId: number | null = null;

  minhasPreferencias: PreferenciaFolga[] = [];
  todasPreferencias: PreferenciaFolga[] = [];

  nomesUsuarios = signal<Map<number, string>>(new Map());

  dias: DiaInfo[] = [];

  loading = false;

  meses = [
    { valor: 1, nome: 'Janeiro' }, { valor: 2, nome: 'Fevereiro' }, { valor: 3, nome: 'Março' },
    { valor: 4, nome: 'Abril' }, { valor: 5, nome: 'Maio' }, { valor: 6, nome: 'Junho' },
    { valor: 7, nome: 'Julho' }, { valor: 8, nome: 'Agosto' }, { valor: 9, nome: 'Setembro' },
    { valor: 10, nome: 'Outubro' }, { valor: 11, nome: 'Novembro' }, { valor: 12, nome: 'Dezembro' }
  ];

  anos: number[] = [];
  mesInicial: number;
  anoInicial: number;

  colunasMinhas: string[] = ['dataFolga', 'dataCriacao'];
  colunasTodas: string[] = ['idUsuario', 'dataFolga', 'dataCriacao'];

  private destroy$ = new Subject<void>();

  constructor() {
    const hoje = new Date();
    this.mesInicial = hoje.getMonth() + 2;
    this.anoInicial = hoje.getFullYear();

    for (let i = 0; i < 6; i++) {
      this.anos.push(this.anoInicial - i);
    }
  }

  ngOnInit(): void {
     if (this.mesInicial > 12) {
      this.mesInicial = 1;
      this.anoInicial++;
    }

    this.inicializarForms();
    this.obterUsuarioLogado();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private obterUsuarioLogado(): void {
    this.authService.user()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (user: any) => {
          this.usuarioLogadoId = this.extrairIdUsuario(user);
          if (this.usuarioLogadoId) {
            this.carregarDados(this.anoInicial, this.mesInicial);
          } else {
            this.mostrarMensagem('Usuário não identificado', 'error');
          }
        },
        error: () => {
          this.mostrarMensagem('Erro ao obter usuário logado', 'error');
        }
      });
  }

  private extrairIdUsuario(usuario: any): number | null {
    if (usuario?.codusuario) return Number(usuario.codusuario);
    if (usuario?.id) return Number(usuario.id);
    if (usuario?.userId) return Number(usuario.userId);
    return null;
  }

  private inicializarForms(): void {


    this.filtroForm = this.fb.group({
      mes: [this.mesInicial],
      ano: [this.anoInicial]
    });

    this.filtroForm.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(300),
        distinctUntilChanged((prev, curr) => prev.mes === curr.mes && prev.ano === curr.ano)
      )
      .subscribe(filtro => {
        if (this.usuarioLogadoId) {
          this.carregarDados(filtro.ano, filtro.mes);
        }
      });
  }

  private carregarDados(ano: number, mes: number): void {
    if (!this.usuarioLogadoId) return;

    this.loading = true;

    this.preferenciaService.listarPorUsuarioMesAno(this.usuarioLogadoId, mes, ano)
      .pipe(
        takeUntil(this.destroy$),
        switchMap(dias => {
          this.minhasPreferencias = dias.map(dia => ({
            id: 0,
            idUsuario: this.usuarioLogadoId!,
            dataFolga: new Date(ano, mes - 1, dia),
            dataCriacao: new Date()
          }));
          this.gerarDiasDoMes(ano, mes);
          this.cdRef.detectChanges();
          return this.preferenciaService.listarPorMesAno(mes, ano);
        })
      )
      .subscribe({
        next: (todas) => {
          this.todasPreferencias = todas
            .filter(p => p.idUsuario !== this.usuarioLogadoId)
            .map(p => ({
              ...p,
              dataFolga: new Date(p.dataFolga),
              dataCriacao: p.dataCriacao ? new Date(p.dataCriacao) : undefined
            }));
          this.carregarNomesUsuarios(this.todasPreferencias);
          this.loading = false;
          this.cdRef.detectChanges();
        },
        error: (error) => {
          console.error('Erro ao carregar dados:', error);
          this.mostrarMensagem('Erro ao carregar preferências', 'error');
          this.minhasPreferencias = [];
          this.todasPreferencias = [];
          this.dias = [];
          this.loading = false;
          this.cdRef.detectChanges();
        }
      });

  }

private carregarNomesUsuarios(preferencias: PreferenciaFolga[]): void {
  // Extrai IDs únicos (não permite duplicatas)
  const idsUnicos = [...new Set(preferencias.map(p => p.idUsuario))];

  // Se não tiver nenhum ID, sai cedo
  if (idsUnicos.length === 0) {
    return;
  }

  // Cria array de observables, cada um buscando um usuário
  const requests = idsUnicos.map(id =>
    this.usuarioService.getUsuario(id).pipe(
      map((usuario: Usuario) => ({
        id,
        nome: usuario?.nome?.trim() || 'Desconhecido'
      })),
      catchError(() => of({
        id,
        nome: 'Desconhecido'  // fallback em caso de erro 404, timeout, etc
      }))
    )
  );

  // forkJoin espera TODAS as requisições terminarem
  forkJoin(requests).subscribe({
    next: (resultados) => {
      // Atualiza o signal de forma imutável (boa prática)
      this.nomesUsuarios.update(currentMap => {
        const novoMap = new Map(currentMap); // copia o map atual

        resultados.forEach(result => {
          novoMap.set(result.id, result.nome);
        });

        return novoMap;
      });

      // Se ainda estiver usando ChangeDetectionStrategy.OnPush e tiver partes do template
      // que não reagem automaticamente ao signal, pode chamar:
      // this.cdRef.detectChanges();
      // Mas normalmente com signals puros não precisa
    },
    error: (err) => {
      console.error('Erro ao carregar nomes de usuários:', err);
      // Opcional: mostrar notificação pro usuário
    }
  });
}

getNomeUsuario(id: number): string {
  return this.nomesUsuarios().get(id) ?? 'Desconhecido';
}

private gerarDiasDoMes(ano: number, mes: number): void {
  const ultimoDia = new Date(ano, mes, 0);
  const diasNoMes = ultimoDia.getDate();
  const diasArray: DiaInfo[] = [];

  for (let d = 1; d <= diasNoMes; d++) {
    const date = new Date(ano, mes - 1, d);
    const diaSemana = date.getDay();
    const isWeekend = diaSemana === 0 || diaSemana === 6;
    const isPreferencia = this.minhasPreferencias.some(p => {
      const data = new Date(p.dataFolga);
      return data.getDate() === d &&
             data.getMonth() + 1 === mes &&
             data.getFullYear() === ano;
    });

    diasArray.push({
      date,
      dia: d,
      mes,
      ano,
      diaSemana,
      isWeekend,
      isPreferencia,
      selecionado: isPreferencia
    });
  }
  this.dias = diasArray;
}

  toggleDia(dia: DiaInfo): void {
    dia.selecionado = !dia.selecionado;
  }

  resetarSelecao(): void {
    this.dias.forEach(d => d.selecionado = d.isPreferencia);
  }

  salvarPreferencias(): void {
    if (!this.usuarioLogadoId) return;

    const alteracoes = this.dias.filter(d => d.selecionado !== d.isPreferencia);
    if (alteracoes.length === 0) {
      this.mostrarMensagem('Nenhuma alteração para salvar', 'info');
      return;
    }

    const adicionar = alteracoes.filter(d => d.selecionado && !d.isPreferencia).map(d => d.date);
    const remover = alteracoes.filter(d => !d.selecionado && d.isPreferencia).map(d => d.date);

    this.loading = true;

    const operacoes: any[] = [];

    adicionar.forEach(date => {
      const dataStr = this.formatarDataCSV(date);
      operacoes.push(this.preferenciaService.cadastrarPreferencia(this.usuarioLogadoId!, dataStr));
    });

    remover.forEach(date => {
      const dataStr = this.formatarDataCSV(date);
      operacoes.push(this.preferenciaService.removerPreferencia(this.usuarioLogadoId!, dataStr));
    });

    forkJoin(operacoes).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.minhasPreferencias = this.dias.filter(d => d.selecionado).map(d => ({
          id: 0,
          idUsuario: this.usuarioLogadoId!,
          dataFolga: d.date,
          dataCriacao: new Date()
        }));
        this.dias.forEach(d => d.isPreferencia = d.selecionado);

        const filtro = this.filtroForm.value;
        this.preferenciaService.listarPorMesAno(filtro.mes, filtro.ano)
          .pipe(takeUntil(this.destroy$))
          .subscribe(todas => {
            this.todasPreferencias = todas
              .filter(p => p.idUsuario !== this.usuarioLogadoId)
              .map(p => ({
                ...p,
                dataFolga: new Date(p.dataFolga),
                dataCriacao: p.dataCriacao ? new Date(p.dataCriacao) : undefined
              }));
            this.carregarNomesUsuarios(this.todasPreferencias);
            this.mostrarMensagem('Preferências salvas com sucesso!', 'success');
            this.loading = false;
            this.cdRef.detectChanges();
          });
      },
      error: (err) => {
        console.error('Erro ao salvar preferências:', err);
        this.mostrarMensagem('Erro ao salvar preferências', 'error');
        this.loading = false;
        this.cdRef.detectChanges();
      }
    });
  }

  formatarData(data: Date | string | null): string {
    if (!data) return '-';
    try {
      const date = new Date(data);
      return isNaN(date.getTime()) ? 'Inválida' : this.datePipe.transform(date, 'dd/MM/yyyy') || '';
    } catch {
      return 'Inválida';
    }
  }

 formatarDataHora(data: Date | string | null): string {
  console.log(data);
  if (!data) {
    return '-';
  }

  // Se já for Date, usa direto
  if (data instanceof Date) {
    return this.datePipe.transform(data, 'dd/MM/yyyy HH:mm') || '-';
  }

  // Caso seja string, vamos tentar parsear vários formatos
  const dataStr = data.trim();

  // Formato específico: 13-FEB-26 04.43.28.241552 PM
  if (/^\d{2}-[A-Z]{3}-\d{2}\s+\d{2}\.\d{2}\.\d{2}\.\d{6}\s+(AM|PM)$/i.test(dataStr)) {
    try {
      // Substitui o ponto por : nos horários e remove milissegundos se necessário
      const cleaned = dataStr
        .replace(/(\d{2})\.(\d{2})\.(\d{2})\.\d{6}/, '$1:$2:$3')  // 04.43.28.241552 → 04:43:28
        .replace(/-/g, ' ');  // 13-FEB-26 → 13 FEB 26

      // Agora parseia com new Date() — ele entende "13 FEB 26 04:43:28 PM"
      const parsedDate = new Date(cleaned);

      if (!isNaN(parsedDate.getTime())) {
        return this.datePipe.transform(parsedDate, 'dd/MM/yyyy HH:mm') || '-';
      }
    } catch (e) {
      // Se falhar, cai no parse genérico abaixo
    }
  }

  // Tentativa genérica (para outros formatos ISO, timestamp, etc)
  try {
    const date = new Date(dataStr);
    if (!isNaN(date.getTime())) {
      return this.datePipe.transform(date, 'dd/MM/yyyy HH:mm') || '-';
    }
  } catch {
    // ignora
  }

  return 'Data inválida';
}

  formatarDataCSV(data: Date | string): string {
    try {
      const date = new Date(data);
      return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  }

  getDiaSemana(data: Date | string): string {
    try {
      const date = new Date(data);
      if (isNaN(date.getTime())) return '';
      const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      return dias[date.getDay()];
    } catch {
      return '';
    }
  }

  limparFiltros(): void {
    this.filtroForm.patchValue({ mes: this.mesInicial, ano: this.anoInicial });
  }

  private mostrarMensagem(mensagem: string, tipo: 'success' | 'error' | 'info' | 'warning'): void {
    this.snackBar.open(mensagem, 'Fechar', {
      duration: 5000,
      panelClass: [`snackbar-${tipo}`],
      horizontalPosition: 'right',
      verticalPosition: 'top'
    });
  }
}
