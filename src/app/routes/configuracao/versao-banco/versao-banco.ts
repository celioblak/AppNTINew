import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '@env/environment';
import { finalize } from 'rxjs';

/** Uma migração do Flyway. estado: SUCCESS, PENDING, FAILED, BASELINE, OUT_OF_ORDER... */
interface Migracao {
  versao: string | null;
  descricao: string;
  tipo: string;
  arquivo: string;
  estado: string;
  aplicada: boolean;
  falhou: boolean;
  aplicadaEm: string | null;
  aplicadaPor: string | null;
  tempoMs: number | null;
}

interface VersaoBanco {
  modo: string;
  versaoAtual: string | null;
  pendentes: number;
  falhas: number;
  migracoes: Migracao[];
  aviso: string | null;
}

const ROTULO_ESTADO: Record<string, string> = {
  SUCCESS: 'Aplicada',
  PENDING: 'Pendente',
  FAILED: 'Falhou',
  BASELINE: 'Ponto de partida',
  BELOW_BASELINE: 'Antes do ponto de partida',
  OUT_OF_ORDER: 'Aplicada fora de ordem',
  IGNORED: 'Ignorada',
  MISSING_SUCCESS: 'Aplicada (arquivo não está neste WAR)',
  FUTURE_SUCCESS: 'Aplicada (de uma versão mais nova)',
};

const ROTULO_MODO: Record<string, string> = {
  aplicar: 'aplica as migrações na subida',
  reparar: 'repara a falha e aplica (voltar para aplicar depois)',
  conferir: 'só confere: não aplica (o Tomcat publicado aplica)',
};

/**
 * Configurações › Versão do banco (docs/migracao-banco.md, R-12): migrações do Flyway aplicadas, pendentes e com
 * falha. Só leitura.
 */
@Component({
  selector: 'app-versao-banco',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatProgressBarModule, MatTooltipModule],
  template: `
    <div class="pagina">
      @if (carregando()) { <mat-progress-bar mode="indeterminate" /> }
      <div class="topo">
        <h2>Versão do banco</h2>
        <span class="espaco"></span>
        <button mat-icon-button matTooltip="Atualizar" (click)="carregar()"><mat-icon>refresh</mat-icon></button>
      </div>
      @if (dados(); as d) {
        <div class="resumo">
          <span>Versão atual: <b>{{ d.versaoAtual ?? '—' }}</b></span>
          <span [class.aviso]="d.pendentes > 0"><b>{{ d.pendentes }}</b> pendente(s)</span>
          <span [class.alerta]="d.falhas > 0"><b>{{ d.falhas }}</b> com falha</span>
          <span>Este servidor: <b>{{ d.modo }}</b> — {{ rotuloModo[d.modo] ?? '' }}</span>
        </div>
        @if (d.aviso) {
          <div class="caixa" [class.caixa--erro]="d.falhas > 0">{{ d.aviso }}</div>
        }
        <p class="dica">
          Scripts de banco são migrações em <code>ntiapi/src/main/resources/db/migration</code>
          (<code>V&lt;AAAAMMDDHHmm&gt;__descricao.sql</code>), aplicadas na subida do ntiapi publicado. Migração aplicada não muda:
          a correção é uma migração nova.
        </p>
        <table class="tabela">
          <tr>
            <th>Versão</th>
            <th>Descrição</th>
            <th>Situação</th>
            <th>Aplicada em</th>
            <th>Por</th>
            <th>Tempo</th>
          </tr>
          @for (m of d.migracoes; track m.versao + m.arquivo) {
            <tr [class.linha--erro]="m.falhou" [class.linha--pendente]="!m.aplicada && !m.falhou">
              <td>{{ m.versao ?? 'repetível' }}</td>
              <td [matTooltip]="m.arquivo">{{ m.descricao }}</td>
              <td>{{ rotuloEstado[m.estado] ?? m.estado }}</td>
              <td>{{ m.aplicadaEm | date: 'dd/MM/yyyy HH:mm:ss' }}</td>
              <td>{{ m.aplicadaPor }}</td>
              <td>{{ m.tempoMs !== null ? m.tempoMs + ' ms' : '' }}</td>
            </tr>
          } @empty {
            <tr><td colspan="6" class="dica">Nenhuma migração.</td></tr>
          }
        </table>
      }
    </div>
  `,
  styles: `
    .pagina { padding: 8px 16px 24px; }
    .topo { display: flex; align-items: center; gap: 12px; }
    .topo h2 { margin: 0; }
    .espaco { flex: 1; }
    .resumo { display: flex; flex-wrap: wrap; gap: 8px 24px; margin: 8px 0; font-size: .9rem; }
    .aviso { color: #8a5600; }
    .alerta { color: #c62828; }
    .caixa { margin: 8px 0; padding: 8px 12px; border-radius: 8px; font-size: .85rem;
      background: color-mix(in srgb, #e08a00 14%, transparent); color: #8a5600; }
    .caixa--erro { background: color-mix(in srgb, #d93636 12%, transparent); color: #c62828; }
    .dica { margin: 8px 0 12px; font-size: .82rem; color: var(--mat-sys-on-surface-variant, rgba(0,0,0,.6)); }
    .tabela { width: 100%; border-collapse: collapse; font-size: .85rem; }
    .tabela th, .tabela td { padding: 6px 8px; border-bottom: 1px solid var(--mat-sys-outline-variant, #e3e5e9); text-align: left; }
    .tabela th { font-weight: 500; color: var(--mat-sys-on-surface-variant, rgba(0,0,0,.6)); }
    .linha--erro td { color: #c62828; font-weight: 600; }
    .linha--pendente td { color: #8a5600; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VersaoBancoComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.ApiBaseUrl}configuracao/versao-banco`;

  readonly rotuloEstado = ROTULO_ESTADO;
  readonly rotuloModo = ROTULO_MODO;
  readonly carregando = signal(false);
  readonly dados = signal<VersaoBanco | null>(null);

  ngOnInit() {
    this.carregar();
  }

  carregar() {
    this.carregando.set(true);
    this.http
      .get<VersaoBanco>(this.api)
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({ next: d => this.dados.set(d), error: () => {} });
  }
}
