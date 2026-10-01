import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, distinctUntilChanged, debounceTime, catchError, map } from 'rxjs/operators';
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
  date: Date | null;
  dia: number | '';
  mes: number;
  ano: number;
  diaSemana: number;
  isWeekend: boolean;
  isPreferencia: boolean;
  selecionado: boolean;
  isEmpty?: boolean;
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
  todasPreferencias: any[] = [];

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

  // ✅ GETTER: retorna true somente quando há alterações não salvas no calendário
  get temAlteracoes(): boolean {
    return this.dias.some(d => !d.isEmpty && d.selecionado !== d.isPreferencia);
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

  // ✅ CORRIGIDO: usa forkJoin para fazer as duas chamadas em paralelo.
  //    listarPorUsuarioMesAno garante que o calendário funcione (endpoint específico do usuário).
  //    listarPorMesAno enriquece minhasPreferencias com a dataCriacao real do servidor.
  private carregarDados(ano: number, mes: number): void {
    if (!this.usuarioLogadoId) return;

    this.loading = true;

    forkJoin({
      meusDias: this.preferenciaService.listarPorUsuarioMesAno(this.usuarioLogadoId, mes, ano),
      todas:    this.preferenciaService.listarPorMesAno(mes, ano)
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: ({ meusDias, todas }) => {
        // Tenta localizar dataCriacao real para cada dia do usuário
        const minhasDoMes = todas.filter(p => p.idUsuario === this.usuarioLogadoId);

        this.minhasPreferencias = meusDias.map(dia => {
          const diaStr = String(dia).padStart(2, '0');
          const mesStr = String(mes).padStart(2, '0');
          const prefixo = `${ano}-${mesStr}-${diaStr}`;

          const encontrado = minhasDoMes.find(p => {
            const df = p.dataFolga;
            if (typeof df === 'string') return (df as string).startsWith(prefixo);
            const dt = df as Date;
            return dt.getDate() === dia && dt.getMonth() + 1 === mes && dt.getFullYear() === ano;
          });

          return {
            id:          encontrado?.id        ?? 0,
            idUsuario:   this.usuarioLogadoId!,
            dataFolga:   new Date(ano, mes - 1, dia),   // Date local para o calendário
            dataCriacao: (encontrado as any)?.criadoEm ?? encontrado?.dataCriacao ?? null
          } as PreferenciaFolga;
        });

        // Preferências de outros usuários preservando strings originais
        this.todasPreferencias = todas
          .filter(p => p.idUsuario !== this.usuarioLogadoId)
          .map(p => ({ ...p }));

        this.gerarDiasDoMes(ano, mes);
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

  private carregarNomesUsuarios(preferencias: any[]): void {
    const idsUnicos = [...new Set(preferencias.map(p => p.idUsuario))];
    if (idsUnicos.length === 0) return;

    const requests = idsUnicos.map(id =>
      this.usuarioService.getUsuario(id).pipe(
        map((usuario: Usuario) => ({
          id,
          nome: usuario?.nome?.trim() || 'Desconhecido'
        })),
        catchError(() => of({ id, nome: 'Desconhecido' }))
      )
    );

    forkJoin(requests).subscribe({
      next: (resultados) => {
        this.nomesUsuarios.update(currentMap => {
          const novoMap = new Map(currentMap);
          resultados.forEach(result => novoMap.set(result.id, result.nome));
          return novoMap;
        });
      },
      error: (err) => console.error('Erro ao carregar nomes de usuários:', err)
    });
  }

  getNomeUsuario(id: number): string {
    return this.nomesUsuarios().get(id) ?? 'Desconhecido';
  }

  private gerarDiasDoMes(ano: number, mes: number): void {
    const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay();
    const ultimoDia = new Date(ano, mes, 0).getDate();

    const diasArray: DiaInfo[] = [];

    for (let i = 0; i < primeiroDiaSemana; i++) {
      diasArray.push({
        date: null,
        dia: '',
        mes,
        ano,
        diaSemana: i,
        isWeekend: false,
        isPreferencia: false,
        selecionado: false,
        isEmpty: true
      });
    }

    for (let d = 1; d <= ultimoDia; d++) {
      const date = new Date(ano, mes - 1, d);
      const diaSemana = date.getDay();
      const isWeekend = diaSemana === 0 || diaSemana === 6;

      // ✅ CORRIGIDO: compara dataFolga independente de ser string ISO ou Date
      const isPreferencia = this.minhasPreferencias.some(p => {
        const dataFolga = p.dataFolga;
        if (typeof dataFolga === 'string') {
          const match = (dataFolga as string).match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (match) {
            return parseInt(match[3], 10) === d
              && parseInt(match[2], 10) === mes
              && parseInt(match[1], 10) === ano;
          }
          return false;
        } else {
          const dt = dataFolga as Date;
          return dt.getDate() === d && dt.getMonth() + 1 === mes && dt.getFullYear() === ano;
        }
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
    if (dia.isEmpty) return;
    dia.selecionado = !dia.selecionado;
  }

  resetarSelecao(): void {
    this.dias.forEach(d => {
      if (!d.isEmpty) d.selecionado = d.isPreferencia;
    });
  }

  salvarPreferencias(): void {
    if (!this.usuarioLogadoId) return;

    const alteracoes = this.dias.filter(d => !d.isEmpty && d.selecionado !== d.isPreferencia);
    if (alteracoes.length === 0) {
      this.mostrarMensagem('Nenhuma alteração para salvar', 'info');
      return;
    }

    const adicionar = alteracoes.filter(d => d.selecionado && !d.isPreferencia).map(d => d.date!);
    const remover = alteracoes.filter(d => !d.selecionado && d.isPreferencia).map(d => d.date!);

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
        // ✅ CORRIGIDO: recarrega do servidor para obter dataCriacao real
        const filtro = this.filtroForm.value;
        this.carregarDados(filtro.ano, filtro.mes);
        this.mostrarMensagem('Preferências salvas com sucesso!', 'success');
      },
      error: (err) => {
        console.error('Erro ao salvar preferências:', err);
        this.mostrarMensagem('Erro ao salvar preferências', 'error');
        this.loading = false;
        this.cdRef.detectChanges();
      }
    });
  }

  formatarData(data: string | Date | null): string {
    if (!data) return '-';

    if (typeof data === 'string') {
      const match = data.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const [, ano, mes, dia] = match;
        return `${dia}/${mes}/${ano}`;
      }
      try {
        const date = new Date(data);
        if (!isNaN(date.getTime())) {
          return this.datePipe.transform(date, 'dd/MM/yyyy') || '-';
        }
      } catch {
        return '-';
      }
      return data;
    } else {
      return this.datePipe.transform(data, 'dd/MM/yyyy') || '-';
    }
  }

  formatarDataHora(data: string | Date | null): string {
    if (!data) return '-';

    if (typeof data === 'string') {
      const isoMatch = data.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
      if (isoMatch) {
        const [, ano, mes, dia, hora, minuto] = isoMatch;
        return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
      }
      const customMatch = data.match(/^(\d{2})-([A-Z]{3})-(\d{2})\s+(\d{2})\.(\d{2})\.(\d{2})\.\d{6}\s+(AM|PM)/i);
      if (customMatch) {
        const [, dia, mesAbrev, ano2, hora, minuto, , periodo] = customMatch;
        const meses: { [key: string]: string } = {
          'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04', 'MAY': '05', 'JUN': '06',
          'JUL': '07', 'AUG': '08', 'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
        };
        const mesNum = meses[mesAbrev.toUpperCase()];
        if (mesNum) {
          const anoFull = parseInt(ano2) + 2000;
          return `${dia}/${mesNum}/${anoFull} ${hora}:${minuto}`;
        }
      }
      try {
        const date = new Date(data);
        if (!isNaN(date.getTime())) {
          return this.datePipe.transform(date, 'dd/MM/yyyy HH:mm') || '-';
        }
      } catch {
        return '-';
      }
      return data;
    } else {
      return this.datePipe.transform(data, 'dd/MM/yyyy HH:mm') || '-';
    }
  }

  formatarDataCSV(date: Date): string {
    const ano = date.getFullYear();
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const dia = String(date.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  getDiaSemana(data: string | Date): string {
    if (!data) return '';

    let ano: number, mes: number, dia: number;
    if (typeof data === 'string') {
      const match = data.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        ano = parseInt(match[1], 10);
        mes = parseInt(match[2], 10) - 1;
        dia = parseInt(match[3], 10);
      } else {
        const d = new Date(data);
        if (isNaN(d.getTime())) return '';
        ano = d.getFullYear();
        mes = d.getMonth();
        dia = d.getDate();
      }
    } else {
      ano = data.getFullYear();
      mes = data.getMonth();
      dia = data.getDate();
    }

    const dataObj = new Date(ano, mes, dia);
    const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return diasSemana[dataObj.getDay()];
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
