import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';

import {
  FormaExecucao,
  Opcoes,
  Parametro,
  ROTULO_FORMA,
  ROTULO_PAPEL,
  Servico,
  ServicoEdicao,
  Servidor,
} from '../infraestrutura.models';
import { InfraestruturaService } from '../infraestrutura.service';

export interface ServicoDialogData {
  servidor: Servidor;
  servico: Servico | null;
  opcoes: Opcoes;
}

/** O que cada parâmetro faz, mostrado ao lado do campo. */
const AJUDA_PARAMETRO: Record<string, string> = {
  HTTP_PORT: 'Porta HTTP do serviço (ex.: 8080). O monitoramento do Tomcat casa o status do tomcatctl por ela.',
  JK_STATUS: 'Só para Apache com mod_jk e status worker ativo (ex.: /jkstatus). Opcional: sem ele o mapa usa a situação de cada serviço membro.',
  WEB_MONITOR: 'Página verificada pelo monitoramento web (resposta e tempo). URL completa (http://192.168.20.47:8083/editor) ou só o caminho (/editor), que usa o IP do servidor e a HTTP_PORT.',
  PRINT_SPOOL: 'Serviço de impressão acompanhado pela fila de impressão.',
};

interface LinhaParametro extends Parametro {
  chave: number;
}

/** Cadastro de serviço (processo, container ou workload) com seus parâmetros de monitoramento. */
@Component({
  selector: 'app-servico-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.servico ? 'Serviço ' + data.servico.nome : 'Novo serviço' }} <small>em {{ data.servidor.nome }}</small></h2>
    <mat-dialog-content class="campos">
      <div class="linha">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Descrição</mat-label>
          <input matInput [(ngModel)]="s.descricao" maxlength="200" placeholder="MV Soul - nó 1" />
          <mat-hint>Como o serviço aparece no mapa e no painel</mat-hint>
        </mat-form-field>
        @if (s.formaExecucao === 'PROCESSO') {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Nome do processo</mat-label>
            <input matInput [(ngModel)]="s.nmProcesso" maxlength="200" placeholder="soulmv-8080 / httpd" />
            <mat-hint>Tomcat: nome no tomcatctl. Apache: serviço do systemctl</mat-hint>
          </mat-form-field>
        }
      </div>
      <div class="linha">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Tipo</mat-label>
          <mat-select [(ngModel)]="s.codTipoProcesso">
            @for (t of data.opcoes.tipos; track t.codTipoProcesso) {
              <mat-option [value]="t.codTipoProcesso">
                {{ t.nome }} <span class="papel">{{ t.papel ? '· ' + rotuloPapel[t.papel] : '· papel a definir' }}</span>
              </mat-option>
            }
          </mat-select>
          <mat-hint>O que roda (Tomcat, Apache, Oracle...), mesmo em container</mat-hint>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Forma de execução</mat-label>
          <mat-select [(ngModel)]="s.formaExecucao">
            @for (f of formas; track f) {
              <mat-option [value]="f">{{ rotuloForma[f] }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Ambiente</mat-label>
          <mat-select [(ngModel)]="s.ambiente">
            <mat-option [value]="null">Herdar do servidor ({{ nomeAmbienteServidor }})</mat-option>
            @for (a of ambientes; track a.codigo) {
              <mat-option [value]="a.codigo">{{ a.nome }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>
      @if (tipoSemPapel()) {
        <p class="aviso">O tipo escolhido ainda não tem papel (aplicação, balanceador...). Defina na aba "Tipos de serviço".</p>
      }

      @if (s.formaExecucao !== 'PROCESSO') {
        <div class="linha">
          @if (s.formaExecucao === 'WORKLOAD_K8S') {
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Namespace</mat-label>
              <input matInput [(ngModel)]="s.namespace" maxlength="100" />
            </mat-form-field>
          }
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ s.formaExecucao === 'CONTAINER' ? 'Nome do container' : 'Deployment / StatefulSet' }}</mat-label>
            <input matInput [(ngModel)]="s.recurso" maxlength="200" required
                   [placeholder]="s.formaExecucao === 'CONTAINER' ? 'soulmv-app1' : 'soulmv'" />
            <mat-hint>{{ s.formaExecucao === 'CONTAINER' ? 'Coluna NAMES do docker ps' : 'kubectl get deploy -n NAMESPACE' }}</mat-hint>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Imagem</mat-label>
            <input matInput [(ngModel)]="s.imagem" maxlength="400" placeholder="repositorio/app:1.2.3" />
          </mat-form-field>
        </div>
        <p class="aviso">
          A leitura automática de {{ s.formaExecucao === 'CONTAINER' ? 'containers' : 'Kubernetes' }} chega numa próxima fase.
          Até lá o serviço entra no mapa, mas tomcatctl e systemctl não são usados para ele. Para acompanhar se está
          respondendo, cadastre o parâmetro WEB_MONITOR com a URL completa pela porta publicada no host (o lado esquerdo de
          <code>-p 8081:8080</code>, ex.: http://servidor:8081/).
        </p>
      } @else {
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Caminho</mat-label>
          <input matInput [(ngModel)]="s.caminho" maxlength="400" placeholder="/opt/mv/tomcat-8080" />
        </mat-form-field>
      }

      <mat-slide-toggle [(ngModel)]="s.monitorado">Monitorado (situação e disponibilidade)</mat-slide-toggle>

      <div class="parametros">
        <div class="parametros__topo">
          <h4>Parâmetros de monitoramento</h4>
          <span class="espaco"></span>
          <button mat-stroked-button (click)="adicionarParametro()"><mat-icon>add</mat-icon> Parâmetro</button>
        </div>
        @for (p of parametros(); track p.chave) {
          <div class="parametro">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Parâmetro</mat-label>
              <mat-select [ngModel]="p.tipo" (ngModelChange)="alterar(p.chave, { tipo: $event })">
                @for (t of data.opcoes.tiposParametro; track t) {
                  <mat-option [value]="t">{{ t }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Valor</mat-label>
              <input matInput [ngModel]="p.valor" (ngModelChange)="alterar(p.chave, { valor: $event })" />
            </mat-form-field>
            <mat-checkbox [ngModel]="p.monitorado" (ngModelChange)="alterar(p.chave, { monitorado: $event })">Monitorado</mat-checkbox>
            <button mat-icon-button (click)="remover(p.chave)" matTooltip="Remover"><mat-icon>delete</mat-icon></button>
            @if (ajuda[p.tipo]) {
              <span class="parametro__ajuda">{{ ajuda[p.tipo] }}</span>
            }
          </div>
        } @empty {
          <p class="dica">Nenhum parâmetro. Tomcat precisa de HTTP_PORT; balanceador Apache, de JK_STATUS.</p>
        }
      </div>

      @if (erro()) {
        <div class="erro"><mat-icon>error</mat-icon><span>{{ erro() }}</span></div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button (click)="salvar()" [disabled]="salvando()">Salvar</button>
    </mat-dialog-actions>
  `,
  styles: `
    .campos { display: flex; flex-direction: column; gap: 14px; padding-top: 8px !important; }
    h2 small { font-size: .8rem; font-weight: 400; color: var(--mat-sys-on-surface-variant, rgba(0,0,0,.6)); }
    .linha { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-start; }
    .linha > * { flex: 1 1 200px; }
    .papel { font-size: .75rem; color: var(--mat-sys-on-surface-variant, rgba(0,0,0,.6)); }
    .dica { margin: 0; font-size: .8rem; color: var(--mat-sys-on-surface-variant, rgba(0,0,0,.6)); }
    .aviso { margin: 0 0 8px; padding: 6px 10px; border-radius: 8px; font-size: .8rem;
             background: var(--mat-sys-surface-container, #eef0f3); }
    .espaco { flex: 1; }
    .parametros { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
    .parametros__topo { display: flex; align-items: center; }
    .parametros__topo h4 { margin: 0; }
    .parametro { display: grid; grid-template-columns: 200px 1fr auto auto; gap: 8px; align-items: center; }
    .parametro__ajuda { grid-column: 1 / -1; margin-top: -4px; font-size: .75rem;
                        color: var(--mat-sys-on-surface-variant, rgba(0,0,0,.6)); }
    .erro { display: flex; gap: 8px; align-items: flex-start; padding: 8px 10px; border-radius: 8px; font-size: .85rem;
            background: color-mix(in srgb, #d93636 12%, transparent); color: #c62828; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicoDialogComponent {
  readonly data = inject<ServicoDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<ServicoDialogComponent, Servico>>(MatDialogRef);
  private readonly service = inject(InfraestruturaService);

  readonly rotuloForma = ROTULO_FORMA;
  readonly rotuloPapel = ROTULO_PAPEL;
  readonly formas = Object.keys(ROTULO_FORMA) as FormaExecucao[];
  readonly ajuda = AJUDA_PARAMETRO;
  readonly ambientes = this.data.opcoes.ambientes.filter(a => a.ativo || a.codigo === this.data.servico?.ambiente);
  readonly nomeAmbienteServidor =
    this.data.opcoes.ambientes.find(a => a.codigo === this.data.servidor.ambiente)?.nome ?? 'sem padrão';

  private chave = 1;

  s: ServicoEdicao = (() => {
    const v = this.data.servico;
    return {
      nmProcesso: v?.nmProcesso ?? null,
      descricao: v?.descricao ?? null,
      caminho: v?.caminho ?? null,
      codTipoProcesso: v?.codTipoProcesso ?? null,
      formaExecucao: v?.formaExecucao ?? 'PROCESSO',
      ambiente: v?.ambiente ?? null,
      recurso: v?.recurso ?? null,
      namespace: v?.namespace ?? null,
      imagem: v?.imagem ?? null,
      monitorado: v?.monitorado ?? true,
      parametros: [],
    };
  })();

  readonly parametros = signal<LinhaParametro[]>(
    (this.data.servico?.parametros ?? []).map(p => ({ ...p, chave: this.chave++ }))
  );

  /** Método (não computed): codTipoProcesso é campo comum, ligado por ngModel. */
  tipoSemPapel(): boolean {
    const t = this.data.opcoes.tipos.find(x => x.codTipoProcesso === this.s.codTipoProcesso);
    return !!t && !t.papel;
  }

  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);

  adicionarParametro() {
    this.parametros.update(l => [...l, { chave: this.chave++, codParametro: null, tipo: '', valor: '', monitorado: true }]);
  }

  alterar(chave: number, mudanca: Partial<Parametro>) {
    this.parametros.update(l => l.map(p => (p.chave === chave ? { ...p, ...mudanca } : p)));
  }

  remover(chave: number) {
    this.parametros.update(l => l.filter(p => p.chave !== chave));
  }

  salvar() {
    const dados: ServicoEdicao = {
      ...this.s,
      parametros: this.parametros().map(({ chave, ...p }) => p),
    };
    this.salvando.set(true);
    this.erro.set(null);
    this.service
      .salvarServico(this.data.servidor.codServidor, this.data.servico?.codProcesso ?? null, dados)
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({
        next: salvo => this.ref.close(salvo),
        error: e => this.erro.set(e?.error?.message ?? 'Não foi possível salvar.'),
      });
  }
}
