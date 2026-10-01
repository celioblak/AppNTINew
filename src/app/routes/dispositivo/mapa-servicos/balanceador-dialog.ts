import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MtxSelectModule } from '@ng-matero/extensions/select';
import { finalize } from 'rxjs';

import {
  BalanceadorCadastro,
  JkConsulta,
  MembroJk,
  ProcessoItem,
  ProcessoOpcao,
  PAINEL_DIALOGO_MAPA,
  WorkerJk,
  comRotulo,
} from './mapa-servicos.models';
import { MapaServicosService } from './mapa-servicos.service';

export interface BalanceadorDialogData {
  /** Nulo para um balanceador novo. */
  balanceador: BalanceadorCadastro | null;
  processos: ProcessoOpcao[];
  balanceadores: BalanceadorCadastro[];
}

type TipoMembro = 'SERVICO' | 'BALANCEADOR';

/** Linha de membro em edição; `chave` só existe para o @for não confundir linhas novas. */
interface MembroEdicao {
  chave: number;
  tipo: TipoMembro;
  alvo: number | null;
  membro: string | null;
}

/**
 * Cadastro de um balanceador: o processo que o executa (opcional — sem ele é
 * um balanceador externo, como um F5), o worker do mod_jk e os membros, que
 * podem ser serviços ou outros balanceadores.
 */
@Component({
  selector: 'app-balanceador-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTooltipModule,
    MtxSelectModule,
  ],
  templateUrl: './balanceador-dialog.html',
  styleUrl: './balanceador-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BalanceadorDialogComponent {
  readonly data = inject<BalanceadorDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<BalanceadorDialogComponent, BalanceadorCadastro>>(MatDialogRef);
  private readonly service = inject(MapaServicosService);

  /** A lista dos combos abre dentro do diálogo (ver PAINEL_DIALOGO_MAPA). */
  readonly painelDoDialogo = '.' + PAINEL_DIALOGO_MAPA;

  private proximaChave = 1;
  private readonly original = this.data.balanceador;

  readonly processos: ProcessoItem[] = comRotulo(this.data.processos);

  /** Apaches com JK_STATUS primeiro: são os que dá para ler ao vivo. */
  readonly candidatosProcesso: ProcessoItem[] = [...this.processos].sort(
    (a, b) => Number(b.temJkStatus) - Number(a.temJkStatus) || a.rotulo.localeCompare(b.rotulo)
  );

  /** Outros balanceadores que podem ser membros (ciclos são barrados no backend). */
  readonly candidatosBalanceador = this.data.balanceadores.filter(
    b => b.codBalanceador !== this.original?.codBalanceador
  );

  nome = this.original?.nome ?? '';
  readonly codProcesso = signal<number | null>(this.original?.codProcesso ?? null);
  readonly worker = signal<string | null>(this.original?.worker ?? null);
  observacao = this.original?.observacao ?? '';

  readonly membros = signal<MembroEdicao[]>(
    (this.original?.membros ?? []).map(m => ({
      chave: this.proximaChave++,
      tipo: m.codBalanceadorFilho ? 'BALANCEADOR' : 'SERVICO',
      alvo: m.codBalanceadorFilho ?? m.codProcesso,
      membro: m.membro,
    }))
  );

  readonly jk = signal<JkConsulta | null>(null);
  readonly lendoJk = signal(false);
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);

  readonly processoEscolhido = computed(() => this.processos.find(p => p.codProcesso === this.codProcesso()) ?? null);

  readonly workers = computed<string[]>(() => {
    const nomes = (this.jk()?.workers ?? []).map(w => w.nome);
    const atual = this.worker();
    return atual && !nomes.includes(atual) ? [atual, ...nomes] : nomes;
  });

  readonly workerLido = computed<WorkerJk | null>(
    () => this.jk()?.workers.find(w => w.nome.toLowerCase() === (this.worker() ?? '').toLowerCase()) ?? null
  );

  /** Membros do worker lido; os já cadastrados continuam na lista para não sumirem da linha. */
  readonly nomesMembroJk = computed<string[]>(() => {
    const lidos = (this.workerLido()?.membros ?? []).map(m => m.membro.nome);
    const cadastrados = this.membros()
      .map(m => m.membro)
      .filter((m): m is string => !!m && !lidos.includes(m));
    return [...lidos, ...cadastrados];
  });

  /** Serviços possíveis como membro: tudo menos o processo do próprio balanceador. */
  readonly candidatosServico = computed(() => this.processos.filter(p => p.codProcesso !== this.codProcesso()));

  constructor() {
    if (this.codProcesso() && this.processoEscolhido()?.temJkStatus) this.lerJk();
  }

  trocarProcesso(cod: number | null) {
    this.codProcesso.set(cod);
    this.jk.set(null);
    if (!this.nome.trim() && cod) {
      const p = this.processoEscolhido();
      if (p) this.nome = `${p.nome} (${p.servidor})`;
    }
    if (cod && this.processoEscolhido()?.temJkStatus) this.lerJk();
  }

  lerJk() {
    const cod = this.codProcesso();
    if (!cod) return;
    this.lendoJk.set(true);
    this.service
      .jkStatus(cod)
      .pipe(finalize(() => this.lendoJk.set(false)))
      .subscribe({
        next: jk => {
          this.jk.set(jk);
          if (jk.acessivel && !this.worker() && jk.workers.length === 1) this.worker.set(jk.workers[0].nome);
        },
        error: () => this.jk.set({ acessivel: false, erro: 'Falha ao consultar o balanceador', url: null, workers: [] }),
      });
  }

  /** Traz os membros do worker: Tomcat sugerido, ou balanceador se o membro for outro Apache cadastrado. */
  importarMembros() {
    const worker = this.workerLido();
    if (!worker) return;
    const atuais = this.membros();
    const novos = [...atuais];
    for (const s of worker.membros) {
      const tipo: TipoMembro = s.codBalanceadorSugerido ? 'BALANCEADOR' : 'SERVICO';
      const alvo = s.codBalanceadorSugerido ?? s.codProcessoSugerido;
      const jaTem = atuais.some(
        m => m.membro?.toLowerCase() === s.membro.nome.toLowerCase() || (alvo && m.tipo === tipo && m.alvo === alvo)
      );
      if (!jaTem) novos.push({ chave: this.proximaChave++, tipo, alvo, membro: s.membro.nome });
    }
    this.membros.set(novos);
  }

  adicionar(tipo: TipoMembro) {
    this.membros.update(lista => [...lista, { chave: this.proximaChave++, tipo, alvo: null, membro: null }]);
  }

  remover(chave: number) {
    this.membros.update(lista => lista.filter(m => m.chave !== chave));
  }

  alterar(chave: number, mudanca: Partial<MembroEdicao>) {
    this.membros.update(lista => lista.map(m => (m.chave === chave ? { ...m, ...mudanca } : m)));
  }

  trocarTipo(chave: number, tipo: TipoMembro) {
    this.alterar(chave, { tipo, alvo: null });
  }

  /** Estado ao vivo do membro, para conferir a ligação na hora de cadastrar. */
  membroLido(nome: string | null): MembroJk | null {
    if (!nome) return null;
    return this.workerLido()?.membros.find(m => m.membro.nome.toLowerCase() === nome.toLowerCase())?.membro ?? null;
  }

  readonly pendencias = computed(() => {
    const lista: string[] = [];
    const membros = this.membros();
    if (membros.some(m => !m.alvo)) lista.push('Escolha o serviço ou balanceador de todas as linhas (ou remova a linha).');
    const chaves = membros.filter(m => m.alvo).map(m => `${m.tipo}:${m.alvo}`);
    if (new Set(chaves).size !== chaves.length) lista.push('O mesmo membro aparece em mais de uma linha.');
    return lista;
  });

  salvar() {
    if (!this.nome.trim() || this.pendencias().length) return;
    this.salvando.set(true);
    this.erro.set(null);
    const cadastro: BalanceadorCadastro = {
      codBalanceador: this.original?.codBalanceador ?? null,
      nome: this.nome.trim(),
      codProcesso: this.codProcesso(),
      worker: this.worker()?.trim() || null,
      observacao: this.observacao.trim() || null,
      membros: this.membros().map(m => ({
        codProcesso: m.tipo === 'SERVICO' ? m.alvo : null,
        codBalanceadorFilho: m.tipo === 'BALANCEADOR' ? m.alvo : null,
        membro: m.membro?.trim() || null,
      })),
      sistemas: [],
      pais: [],
    };
    this.service
      .salvarBalanceador(cadastro)
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({
        next: salvo => this.dialogRef.close(salvo),
        error: e => this.erro.set(e?.error?.message ?? 'Não foi possível salvar.'),
      });
  }
}
