import { Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HotToastService } from '@ngxpert/hot-toast';
import { finalize } from 'rxjs';

import {
  AcessoBanco,
  AcessoEdicao,
  Ambiente,
  Banco,
  BancoEdicao,
  EntradaTns,
  FinalidadeAcesso,
  FormaAcesso,
  ImportacaoInstancia,
  ROTULO_FINALIDADE,
  ROTULO_FORMA_ACESSO,
  ROTULO_SITUACAO_BANCO,
  ScriptBanco,
  TesteBanco,
  TesteNo,
} from '../infraestrutura.models';
import { InfraestruturaService } from '../infraestrutura.service';

const ESTILOS = `
  .grade { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; }
  .grade .inteira { grid-column: 1 / -1; }
  .dica { margin: 0 0 10px; font-size: .8rem; color: var(--mat-sys-on-surface-variant, rgba(0,0,0,.6)); }
  .linha { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 10px; }
  .espaco { flex: 1; }
  .script, .descritor-lido { max-height: 40vh; overflow: auto; margin: 0; padding: 10px 12px; border-radius: 8px; font-size: .75rem;
    line-height: 1.4; white-space: pre; background: var(--mat-sys-surface-container, #eef0f3); }
  .descritor-lido { white-space: pre-wrap; word-break: break-all; max-height: 120px; }
  .resultado { display: flex; gap: 8px; align-items: flex-start; margin-top: 8px; padding: 8px 10px; border-radius: 8px; font-size: .85rem; }
  .resultado p { margin: 4px 0 0; }
  .resultado--ok { background: color-mix(in srgb, #2e9e5b 14%, transparent); color: #1e7a45; }
  .resultado--erro { background: color-mix(in srgb, #d93636 12%, transparent); color: #c62828; }
  .resultado--aviso { background: color-mix(in srgb, #e08a00 14%, transparent); color: #8a5600; }
  .rede { margin: 6px 0 0; padding-left: 18px; font-size: .78rem; font-family: monospace; }
  .entrada { display: block; width: 100%; text-align: left; margin-bottom: 6px; padding: 8px 10px; border-radius: 8px; cursor: pointer;
    border: 1px solid var(--mat-sys-outline-variant, #d5d8de); background: var(--mat-sys-surface-container-low, #f7f7f9); font: inherit; color: inherit; }
  .entrada:hover { background: var(--mat-sys-surface-container, #eef0f3); }
  .entrada small { display: block; color: var(--mat-sys-on-surface-variant, rgba(0,0,0,.6)); }
  .passos { margin: 0 0 8px; padding-left: 20px; font-size: .85rem; line-height: 1.5; }
  .acesso-teste { margin-bottom: 10px; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--mat-sys-outline-variant, #d5d8de); }
  .acesso-teste h4 { display: flex; align-items: center; gap: 6px; margin: 0 0 4px; font-size: .9rem; }
  .ok { color: #2e9e5b; } .erro { color: #d93636; } .aviso { color: #e08a00; }
  .tabela { width: 100%; border-collapse: collapse; font-size: .82rem; }
  .tabela td, .tabela th { padding: 4px 6px; border-bottom: 1px solid var(--mat-sys-outline-variant, #e3e5e9); text-align: left; vertical-align: top; }
  .marca { padding: 1px 6px; border-radius: 6px; font-size: .7rem; font-weight: 600; background: var(--mat-sys-surface-container-high, #e6e8ec); }
`;

// ===================================================================================================== banco

export interface BancoDialogData {
  banco: Banco | null;
  ambientes: Ambiente[];
}

/** Cadastro do banco: nome, ambiente e credencial de monitoramento (a senha normalmente vem do script, D-52). */
@Component({
  selector: 'app-banco-dialog',
  imports: [FormsModule, MatButtonModule, MatCheckboxModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatSlideToggleModule],
  template: `
    <h2 mat-dialog-title>{{ data.banco ? 'Editar banco' : 'Novo banco' }}</h2>
    <mat-dialog-content>
      <p class="dica">
        O modelo (RAC, multitenant, Data Guard, ASM, versão) não se informa: é lido do banco no primeiro Testar.
      </p>
      <div class="grade">
        <mat-form-field appearance="outline">
          <mat-label>Nome</mat-label>
          <input matInput [(ngModel)]="form.nome" maxlength="100" placeholder="hbprod" required />
          <mat-hint>Como a equipe chama (ex.: o DB_UNIQUE_NAME).</mat-hint>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Ambiente</mat-label>
          <mat-select [(ngModel)]="form.ambiente">
            <mat-option [value]="null">Sem ambiente</mat-option>
            @for (a of data.ambientes; track a.codigo) {
              <mat-option [value]="a.codigo">{{ a.nome }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" class="inteira">
          <mat-label>Observação</mat-label>
          <textarea matInput [(ngModel)]="form.observacao" rows="2" maxlength="1000" placeholder="DW, réplica de relatórios..."></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Usuário de monitoramento</mat-label>
          <input matInput [(ngModel)]="form.usuarioMonitor" maxlength="128" placeholder="automático" />
          <mat-hint>Vazio: o Testar descobre (NTI_MONITOR ou C##NTI_MONITOR).</mat-hint>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ data.banco?.temSenha ? 'Trocar a senha' : 'Senha' }}</mat-label>
          <input matInput type="password" [(ngModel)]="form.senhaMonitor" maxlength="100" autocomplete="new-password"
                 [disabled]="form.apagarSenha" placeholder="gerada pelo script" />
          <mat-hint>Só se o DBA escolheu a senha; o normal é usar o "Script do usuário".</mat-hint>
        </mat-form-field>
        @if (data.banco?.temSenha) {
          <mat-checkbox class="inteira" [(ngModel)]="form.apagarSenha">Apagar a senha guardada</mat-checkbox>
        }
        <div class="linha inteira">
          <mat-slide-toggle [(ngModel)]="form.ativo">Ativo</mat-slide-toggle>
          <mat-slide-toggle [(ngModel)]="form.monitorado">Monitorado</mat-slide-toggle>
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button (click)="salvar()" [disabled]="salvando() || !form.nome.trim()">Salvar</button>
    </mat-dialog-actions>
  `,
  styles: ESTILOS,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BancoDialogComponent {
  readonly data = inject<BancoDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<BancoDialogComponent, Banco>);
  private readonly service = inject(InfraestruturaService);
  readonly salvando = signal(false);

  form: BancoEdicao = {
    nome: this.data.banco?.nome ?? '',
    ambiente: this.data.banco?.ambiente ?? null,
    observacao: this.data.banco?.observacao ?? null,
    usuarioMonitor: this.data.banco?.usuarioMonitor ?? null,
    senhaMonitor: null,
    apagarSenha: false,
    ativo: this.data.banco?.ativo ?? true,
    monitorado: this.data.banco?.monitorado ?? true,
  };

  salvar() {
    this.salvando.set(true);
    this.service
      .salvarBanco(this.data.banco?.codBanco ?? null, this.form)
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({ next: b => this.ref.close(b), error: () => {} });
  }
}

// ===================================================================================================== ponto de acesso

export interface AcessoDialogData {
  codBanco: number;
  acesso: AcessoBanco | null;
}

/**
 * Ponto de acesso (R-73): SCAN, endereço (um ou vários hosts) ou descritor do tnsnames.ora (colado; D-42). O teste
 * de rede não precisa de usuário: resolve o DNS e testa a porta de cada IP.
 */
@Component({
  selector: 'app-acesso-dialog',
  imports: [FormsModule, MatButtonModule, MatButtonToggleModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule,
    MatProgressBarModule, MatSelectModule, MatSlideToggleModule],
  template: `
    <h2 mat-dialog-title>{{ data.acesso ? 'Editar ponto de acesso' : 'Novo ponto de acesso' }}</h2>
    <mat-dialog-content>
      <p class="dica">É o que os sistemas colocam na string de conexão. Cadastre como eles usam: o SCAN, os endereços ou o descritor do tnsnames.</p>
      <div class="linha">
        <mat-button-toggle-group [(ngModel)]="form.forma" hideSingleSelectionIndicator>
          @for (f of formas; track f) {
            <mat-button-toggle [value]="f">{{ rotuloForma[f] }}</mat-button-toggle>
          }
        </mat-button-toggle-group>
      </div>
      <div class="grade">
        <mat-form-field appearance="outline">
          <mat-label>Nome</mat-label>
          <input matInput [(ngModel)]="form.nome" maxlength="100" placeholder="SCAN produção" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Finalidade</mat-label>
          <mat-select [(ngModel)]="form.finalidade">
            @for (f of finalidades; track f) {
              <mat-option [value]="f">{{ rotuloFinalidade[f] }}</mat-option>
            }
          </mat-select>
          <mat-hint>Só os principais contam na situação do banco.</mat-hint>
        </mat-form-field>

        @if (form.forma === 'DESCRITOR') {
          <mat-form-field appearance="outline" class="inteira">
            <mat-label>Trecho do tnsnames.ora ou descritor</mat-label>
            <textarea matInput [(ngModel)]="colado" rows="6" placeholder="HBPROD = (DESCRIPTION = (ADDRESS_LIST = (LOAD_BALANCE = on) ..."></textarea>
            <mat-hint>Cole uma ou várias entradas; comentários (#) são ignorados.</mat-hint>
          </mat-form-field>
          <div class="linha inteira">
            <button mat-stroked-button (click)="lerTnsnames()" [disabled]="!colado.trim() || lendo()"><mat-icon>code</mat-icon> Ler o trecho</button>
            @if (form.descritor) {
              <span class="dica">Descritor escolhido{{ form.alias ? ' (' + form.alias + ')' : '' }}:</span>
            }
          </div>
          @for (e of entradas(); track $index) {
            <button class="entrada inteira" (click)="escolher(e)">
              <b>{{ e.alias ?? 'Sem alias' }}</b> — {{ e.servico ? 'serviço ' + e.servico : 'SID ' + e.sid }}
              <small>{{ e.enderecos.join(', ') }}{{ e.balanceia ? ' · LOAD_BALANCE' : '' }}{{ e.failover ? ' · FAILOVER' : '' }}</small>
            </button>
          }
          @if (form.descritor) {
            <pre class="descritor-lido inteira">{{ form.descritor }}</pre>
          }
        } @else {
          <mat-form-field appearance="outline" class="inteira">
            <mat-label>{{ form.forma === 'SCAN' ? 'Nome SCAN' : 'Host (vários: separe por vírgula)' }}</mat-label>
            <input matInput [(ngModel)]="form.host" maxlength="255"
                   [placeholder]="form.forma === 'SCAN' ? 'rac-scan.hospital.local' : 'rac1-vip, rac2-vip'" />
            @if (form.forma === 'SCAN') {
              <mat-hint>Guardado pelo nome: o DNS é consultado a cada teste, então IP novo entra sozinho.</mat-hint>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Porta</mat-label>
            <input matInput type="number" [(ngModel)]="form.porta" min="1" max="65535" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Serviço (SERVICE_NAME)</mat-label>
            <input matInput [(ngModel)]="form.servico" maxlength="128" placeholder="hbprod" />
          </mat-form-field>
        }
        <mat-form-field appearance="outline">
          <mat-label>Alias no tnsnames (referência)</mat-label>
          <input matInput [(ngModel)]="form.alias" maxlength="128" />
        </mat-form-field>
        <div class="linha">
          <mat-slide-toggle [(ngModel)]="form.monitorado">Monitorado</mat-slide-toggle>
        </div>
      </div>

      @if (testandoRede()) {
        <mat-progress-bar mode="indeterminate" />
      }
      @if (rede().length) {
        <div class="resultado" [class.resultado--ok]="redeOk()" [class.resultado--aviso]="!redeOk()">
          <mat-icon>{{ redeOk() ? 'check_circle' : 'warning' }}</mat-icon>
          <div>
            <b>Rede (sem usuário)</b>
            <ul class="rede">
              @for (l of rede(); track $index) {
                <li>{{ l }}</li>
              }
            </ul>
          </div>
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-stroked-button (click)="testarRede()" [disabled]="testandoRede()"><mat-icon>network_check</mat-icon> Testar rede</button>
      <span class="espaco"></span>
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button (click)="salvar()" [disabled]="salvando()">Salvar</button>
    </mat-dialog-actions>
  `,
  styles: ESTILOS,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AcessoDialogComponent {
  readonly data = inject<AcessoDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<AcessoDialogComponent, Banco>);
  private readonly service = inject(InfraestruturaService);
  private readonly toast = inject(HotToastService);

  readonly formas: FormaAcesso[] = ['SCAN', 'SIMPLES', 'DESCRITOR'];
  readonly finalidades: FinalidadeAcesso[] = ['PRINCIPAL', 'LEITURA', 'ADMINISTRACAO'];
  readonly rotuloForma = ROTULO_FORMA_ACESSO;
  readonly rotuloFinalidade = ROTULO_FINALIDADE;

  readonly salvando = signal(false);
  readonly lendo = signal(false);
  readonly testandoRede = signal(false);
  readonly entradas = signal<EntradaTns[]>([]);
  readonly rede = signal<string[]>([]);
  readonly redeOk = signal(false);

  colado = this.data.acesso?.descritor ?? '';
  form: AcessoEdicao = {
    nome: this.data.acesso?.nome ?? '',
    forma: this.data.acesso?.forma ?? 'SCAN',
    host: this.data.acesso?.host ?? null,
    porta: this.data.acesso?.porta ?? 1521,
    servico: this.data.acesso?.servico ?? null,
    descritor: this.data.acesso?.descritor ?? null,
    alias: this.data.acesso?.alias ?? null,
    finalidade: this.data.acesso?.finalidade ?? 'PRINCIPAL',
    monitorado: this.data.acesso?.monitorado ?? true,
  };

  lerTnsnames() {
    this.lendo.set(true);
    this.service
      .lerTnsnames(this.colado)
      .pipe(finalize(() => this.lendo.set(false)))
      .subscribe({
        next: lista => {
          this.entradas.set(lista);
          if (lista.length === 1) this.escolher(lista[0]);
        },
        error: () => {},
      });
  }

  escolher(e: EntradaTns) {
    this.form.descritor = e.descritor;
    this.form.alias = e.alias;
    if (!this.form.nome.trim()) this.form.nome = e.alias ? `tnsnames ${e.alias}` : 'Descritor';
    this.entradas.set([]);
    this.toast.success(`Descritor${e.alias ? ' ' + e.alias : ''} escolhido.`);
  }

  private dados(): AcessoEdicao {
    // Sem "Ler o trecho": o texto colado já é o descritor (o backend valida).
    if (this.form.forma === 'DESCRITOR' && !this.form.descritor && this.colado.trim()) return { ...this.form, descritor: this.colado };
    return this.form;
  }

  testarRede() {
    this.testandoRede.set(true);
    this.service
      .testarRedeBanco(this.dados())
      .pipe(finalize(() => this.testandoRede.set(false)))
      .subscribe({
        next: linhas => {
          this.rede.set(linhas);
          this.redeOk.set(linhas.some(l => l.includes('responde')) && !linhas.some(l => l.startsWith('Atenção') || l.startsWith('Nenhum')));
        },
        error: () => {},
      });
  }

  salvar() {
    this.salvando.set(true);
    this.service
      .salvarAcesso(this.data.codBanco, this.data.acesso?.codAcesso ?? null, this.dados())
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({ next: b => this.ref.close(b), error: () => {} });
  }
}

// ===================================================================================================== script

export interface ScriptDialogData {
  banco: Banco;
}

/** Script do usuário de monitoramento (R-81, D-44, D-52): um só para qualquer Oracle; o DBA roda uma vez. */
@Component({
  selector: 'app-script-banco-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule, MatProgressBarModule],
  template: `
    <h2 mat-dialog-title>Script do usuário de monitoramento · {{ data.banco.nome }}</h2>
    <mat-dialog-content>
      <ol class="passos">
        <li>Copie ou baixe o script (a senha já está nele e guardada no NTI, criptografada).</li>
        <li>O <b>DBA</b> roda uma vez, como <b>SYS ou SYSTEM</b> (SQL*Plus ou SQL Developer). RAC: em um nó só. Data Guard: só no primário.
          Multitenant: no container raiz (CDB$ROOT).</li>
        <li>O script descobre sozinho se o banco é multitenant e cria <b>{{ resultado()?.usuarioPrevisto ?? 'o usuário' }}</b>.
          Só leitura: CREATE SESSION e SELECT nas views do dicionário.</li>
        <li>Volte aqui e clique em <b>Testar</b>.</li>
      </ol>
      @if (carregando()) {
        <mat-progress-bar mode="indeterminate" />
      }
      @if (resultado(); as r) {
        @if (r.aviso) {
          <div class="resultado resultado--aviso"><mat-icon>warning</mat-icon><span>{{ r.aviso }}</span></div>
        }
        <pre class="script">{{ r.script }}</pre>
        <p class="dica">Ver este script fica registrado no cofre (quem viu e quando), como a senha.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-stroked-button (click)="copiar()" [disabled]="!resultado()"><mat-icon>content_copy</mat-icon> Copiar</button>
      <button mat-stroked-button (click)="baixar()" [disabled]="!resultado()"><mat-icon>file_download</mat-icon> Baixar .sql</button>
      <button mat-button (click)="novaSenha()" [disabled]="carregando()">Gerar nova senha</button>
      <span class="espaco"></span>
      <button mat-button mat-dialog-close>Fechar</button>
      <button mat-flat-button [mat-dialog-close]="'testar'"><mat-icon>play_arrow</mat-icon> Testar</button>
    </mat-dialog-actions>
  `,
  styles: ESTILOS,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScriptBancoDialogComponent implements OnInit {
  readonly data = inject<ScriptDialogData>(MAT_DIALOG_DATA);
  private readonly service = inject(InfraestruturaService);
  private readonly clipboard = inject(Clipboard);
  private readonly toast = inject(HotToastService);

  readonly carregando = signal(false);
  readonly resultado = signal<ScriptBanco | null>(null);
  private confirmouNova = false;

  ngOnInit() {
    this.carregar(false);
  }

  private carregar(senhaNova: boolean) {
    this.carregando.set(true);
    this.service
      .scriptBanco(this.data.banco.codBanco, senhaNova)
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({ next: r => this.resultado.set(r), error: () => {} });
  }

  novaSenha() {
    if (!this.confirmouNova) {
      this.confirmouNova = true;
      this.toast.warning('Se o DBA já rodou o script anterior, ele terá de rodar o novo. Clique de novo em "Gerar nova senha" para confirmar.');
      return;
    }
    this.confirmouNova = false;
    this.carregar(true);
  }

  copiar() {
    this.clipboard.copy(this.resultado()?.script ?? '');
    this.toast.success('Script copiado.');
  }

  baixar() {
    const blob = new Blob([this.resultado()?.script ?? ''], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nti_monitor_${this.data.banco.nome.replace(/[^A-Za-z0-9_-]/g, '_')}.sql`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}

// ===================================================================================================== testar

export interface TesteBancoDialogData {
  banco: Banco;
}

/** Testar: a mesma verificação do job, com o detalhe de cada ponto de acesso; e o teste nó a nó (D-47). */
@Component({
  selector: 'app-teste-banco-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule, MatProgressBarModule, MatTooltipModule],
  template: `
    <h2 mat-dialog-title>Testar · {{ data.banco.nome }}</h2>
    <mat-dialog-content>
      @if (testando()) {
        <p class="dica">Conectando por cada ponto de acesso (até 10 s cada)...</p>
        <mat-progress-bar mode="indeterminate" />
      }
      @if (teste(); as t) {
        <div class="resultado" [class.resultado--ok]="t.banco.situacao === 'OK'"
             [class.resultado--erro]="t.banco.situacao === 'FORA' || t.banco.situacao === 'SEM_ACESSO'"
             [class.resultado--aviso]="t.banco.situacao === 'PARCIAL' || t.banco.situacao === 'DESCONHECIDO'">
          <mat-icon>{{ t.banco.situacao === 'OK' ? 'check_circle' : t.banco.situacao === 'PARCIAL' ? 'warning' : 'error' }}</mat-icon>
          <div>
            <b>{{ rotuloSituacao[t.banco.situacao ?? 'DESCONHECIDO'] }}</b> — {{ t.banco.detalhe }}
            @if (t.banco.orientacao) {
              <p>{{ t.banco.orientacao }}</p>
            }
            <p>{{ t.banco.modelo }}</p>
          </div>
        </div>

        <h3>Pontos de acesso</h3>
        @for (a of t.acessos; track a.codAcesso) {
          <div class="acesso-teste">
            <h4>
              <mat-icon [class.ok]="a.resultado === 'OK'" [class.erro]="a.resultado !== 'OK'">
                {{ a.resultado === 'OK' ? 'check_circle' : 'error' }}
              </mat-icon>
              {{ a.nome }} <span class="marca">{{ rotuloFinalidade[a.finalidade] }}</span>
            </h4>
            <div>{{ a.mensagem }}</div>
            @if (a.orientacao) {
              <div class="dica">{{ a.orientacao }}</div>
            }
            @if (a.rede.length) {
              <ul class="rede">
                @for (l of a.rede; track $index) {
                  <li>{{ l }}</li>
                }
              </ul>
            }
            @for (at of a.atencoes; track $index) {
              <div class="aviso"><mat-icon inline>warning</mat-icon> {{ at }}</div>
            }
          </div>
        } @empty {
          <p class="dica">Nenhum ponto de acesso monitorado.</p>
        }

        @if (t.grantsFaltando.length) {
          <div class="resultado resultado--aviso">
            <mat-icon>warning</mat-icon>
            <div>
              <b>Faltam permissões de leitura</b>
              <p>Rode de novo o script do usuário, ou peça ao DBA:</p>
              <pre class="script">{{ t.grantsFaltando.join('\\n') }}</pre>
            </div>
          </div>
        }

        @if (nos().length || testandoNos()) {
          <h3>Nó a nó (listener local de cada instância)</h3>
          @if (testandoNos()) {
            <mat-progress-bar mode="indeterminate" />
          }
          <table class="tabela">
            @for (n of nos(); track n.instancia) {
              <tr>
                <td><mat-icon inline [class.ok]="n.resultado === 'OK'" [class.erro]="n.resultado !== 'OK'">
                  {{ n.resultado === 'OK' ? 'check_circle' : 'error' }}</mat-icon></td>
                <td><b>{{ n.instancia }}</b><br /><small>{{ n.host }}:{{ n.porta }}</small></td>
                <td>{{ n.mensagem }}@if (n.orientacao) {<br /><small class="dica">{{ n.orientacao }}</small>}</td>
              </tr>
            }
          </table>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-stroked-button (click)="testarNos()" [disabled]="testando() || testandoNos() || !teste()?.banco?.instancias?.length"
              matTooltip="Conecta direto em cada instância (host do nó + INSTANCE_NAME): mostra o listener local que o SCAN esconde">
        <mat-icon>device_hub</mat-icon> Testar nó a nó
      </button>
      <span class="espaco"></span>
      <button mat-stroked-button (click)="testar()" [disabled]="testando()"><mat-icon>refresh</mat-icon> Testar de novo</button>
      <button mat-flat-button (click)="fechar()">Fechar</button>
    </mat-dialog-actions>
  `,
  styles: ESTILOS,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TesteBancoDialogComponent implements OnInit {
  readonly data = inject<TesteBancoDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<TesteBancoDialogComponent, Banco | undefined>);
  private readonly service = inject(InfraestruturaService);

  readonly rotuloSituacao = ROTULO_SITUACAO_BANCO;
  readonly rotuloFinalidade = ROTULO_FINALIDADE;
  readonly testando = signal(false);
  readonly testandoNos = signal(false);
  readonly teste = signal<TesteBanco | null>(null);
  readonly nos = signal<TesteNo[]>([]);

  ngOnInit() {
    this.testar();
  }

  testar() {
    this.testando.set(true);
    this.nos.set([]);
    this.service
      .testarBanco(this.data.banco.codBanco)
      .pipe(finalize(() => this.testando.set(false)))
      .subscribe({ next: t => this.teste.set(t), error: () => {} });
  }

  testarNos() {
    this.testandoNos.set(true);
    this.service
      .testarNos(this.data.banco.codBanco)
      .pipe(finalize(() => this.testandoNos.set(false)))
      .subscribe({ next: n => this.nos.set(n), error: () => {} });
  }

  fechar() {
    this.ref.close(this.teste()?.banco);
  }
}

// ===================================================================================================== importar

export interface ImportarDialogData {
  banco: Banco;
}

/** Importar instâncias (R-77): cada instância vira o serviço "Oracle - instância" no servidor do nó. */
@Component({
  selector: 'app-importar-instancias-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule, MatProgressBarModule],
  template: `
    <h2 mat-dialog-title>Importar instâncias · {{ data.banco.nome }}</h2>
    <mat-dialog-content>
      <p class="dica">
        Cada instância vira o serviço "Oracle - instância" no servidor do nó, no ambiente do banco, e aparece no mapa. A situação dela vem da
        leitura do banco (não do SSH).
      </p>
      @if (carregando()) {
        <mat-progress-bar mode="indeterminate" />
      }
      <table class="tabela">
        @for (i of previa(); track i.codInstancia) {
          <tr>
            <td><b>{{ i.instancia }}</b><br /><small>{{ i.host }}</small></td>
            <td>{{ i.servidor ?? '—' }}</td>
            <td><span class="marca">{{ rotuloAcao[i.acao] }}</span></td>
            <td><small>{{ i.motivo }}</small></td>
          </tr>
        } @empty {
          @if (!carregando()) {
            <tr><td>Nenhuma instância lida ainda: clique em Testar primeiro.</td></tr>
          }
        }
      </table>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button (click)="importar()" [disabled]="importando() || !temOQueImportar()">Importar</button>
    </mat-dialog-actions>
  `,
  styles: ESTILOS,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportarInstanciasDialogComponent implements OnInit {
  readonly data = inject<ImportarDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<ImportarInstanciasDialogComponent, Banco>);
  private readonly service = inject(InfraestruturaService);

  readonly rotuloAcao: Record<ImportacaoInstancia['acao'], string> = {
    CRIAR: 'Criar serviço',
    LIGAR: 'Ligar ao serviço',
    JA_IMPORTADA: 'Já importada',
    SEM_SERVIDOR: 'Nó sem servidor',
  };
  readonly carregando = signal(false);
  readonly importando = signal(false);
  readonly previa = signal<ImportacaoInstancia[]>([]);

  ngOnInit() {
    this.carregando.set(true);
    this.service
      .previaImportacao(this.data.banco.codBanco)
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({ next: p => this.previa.set(p), error: () => {} });
  }

  temOQueImportar() {
    return this.previa().some(i => i.acao === 'CRIAR' || i.acao === 'LIGAR');
  }

  importar() {
    this.importando.set(true);
    this.service
      .importarInstancias(this.data.banco.codBanco)
      .pipe(finalize(() => this.importando.set(false)))
      .subscribe({ next: b => this.ref.close(b), error: () => {} });
  }
}
