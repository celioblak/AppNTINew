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
import { MatTabsModule } from '@angular/material/tabs';
import { finalize } from 'rxjs';

import { Opcoes, ROTULO_TIPO_LOCAL, Servidor, ServidorEdicao, TipoLocal } from '../infraestrutura.models';
import { InfraestruturaService } from '../infraestrutura.service';

export interface ServidorDialogData {
  servidor: Servidor | null;
  opcoes: Opcoes;
}

/**
 * Cadastro do servidor (local de execução). As senhas não vêm para a tela:
 * campo vazio mantém a senha atual; "apagar" remove.
 */
@Component({
  selector: 'app-servidor-dialog',
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
    MatTabsModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.servidor ? 'Servidor ' + data.servidor.nome : 'Novo servidor' }}</h2>
    <mat-dialog-content>
      <mat-tab-group animationDuration="0ms">
        <mat-tab label="Dados">
          <div class="campos">
            <div class="linha">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Nome</mat-label>
                <input matInput [(ngModel)]="s.nome" maxlength="200" required />
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Tipo de local</mat-label>
                <mat-select [(ngModel)]="s.tipoLocal">
                  @for (t of tiposLocal; track t) {
                    <mat-option [value]="t">{{ rotuloLocal[t] }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>
            @if (s.tipoLocal === 'HOST_DOCKER' || s.tipoLocal === 'CLUSTER_K8S') {
              <p class="aviso">Docker e Kubernetes já podem ser cadastrados; a leitura automática de containers chega numa próxima fase.</p>
            }
            <div class="linha">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>IP ou nome de rede</mat-label>
                <input matInput [(ngModel)]="s.ip" maxlength="100" />
                <mat-hint>Usado pelo monitoramento (SSH) e pelo acesso remoto</mat-hint>
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Nome da máquina</mat-label>
                <input matInput [(ngModel)]="s.maquina" maxlength="200" />
              </mat-form-field>
            </div>
            <div class="linha">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Sistema operacional</mat-label>
                <mat-select [(ngModel)]="s.so">
                  <mat-option [value]="null">—</mat-option>
                  <mat-option value="LINUX">Linux</mat-option>
                  <mat-option value="WINDOWS">Windows</mat-option>
                  <mat-option value="OUTRO">Outro</mat-option>
                </mat-select>
                <mat-hint>Linux é lido por SSH; Windows, pelo WinRM</mat-hint>
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Ambiente padrão dos serviços</mat-label>
                <mat-select [(ngModel)]="s.ambiente">
                  <mat-option [value]="null">— sem padrão (cada serviço informa o seu) —</mat-option>
                  @for (a of ambientesAtivos; track a.codigo) {
                    <mat-option [value]="a.codigo">{{ a.nome }}</mat-option>
                  }
                </mat-select>
                <mat-hint>Servidor com serviços de mais de um ambiente: deixe sem padrão</mat-hint>
              </mat-form-field>
            </div>
            @if (s.so === 'WINDOWS') {
              <div class="linha">
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>WinRM (leitura de CPU, memória e discos)</mat-label>
                  <mat-select [(ngModel)]="s.winrm">
                    <mat-option value="HTTPS">HTTPS · porta 5986 (recomendado)</mat-option>
                    <mat-option value="HTTP">HTTP · porta 5985</mat-option>
                  </mat-select>
                  <mat-hint>Nos dois a mensagem vai criptografada; o HTTPS protege também o canal</mat-hint>
                </mat-form-field>
                <p class="aviso">
                  Depois de salvar, use <b>Preparar WinRM</b> no servidor: o script liga o WinRM, libera a porta só para o
                  NTI e confere o usuário. Ao terminar, <b>Testar WinRM</b>.
                </p>
              </div>
            }
            <div class="linha">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Hospedagem</mat-label>
                <mat-select [(ngModel)]="s.codHospedagem">
                  <mat-option [value]="null">—</mat-option>
                  @for (h of hospedagensAtivas; track h.codHospedagem) {
                    <mat-option [value]="h.codHospedagem">{{ h.nome }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Grupo</mat-label>
                <mat-select [(ngModel)]="s.codGrupo">
                  <mat-option [value]="null">—</mat-option>
                  @for (g of data.opcoes.grupos; track g.codGrupo) {
                    <mat-option [value]="g.codGrupo">{{ g.nome }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Observação</mat-label>
              <textarea matInput [(ngModel)]="s.observacao" rows="2"></textarea>
            </mat-form-field>
            <div class="chaves">
              <mat-slide-toggle [(ngModel)]="s.ativo">Ativo</mat-slide-toggle>
              <mat-slide-toggle [(ngModel)]="s.monitorado">Monitorado (conexão, load, disco e os serviços dele)</mat-slide-toggle>
            </div>
          </div>
        </mat-tab>

        <mat-tab label="Credenciais">
          <div class="campos">
            <p class="dica">
              As senhas não aparecem aqui. Deixe em branco para manter a atual; para ver a senha use o botão
              "Mostrar" no cofre do servidor (cada consulta fica registrada).
            </p>
            <h4>Administrador (monitoramento: SSH no Linux, WinRM no Windows)</h4>
            <div class="linha">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Usuário</mat-label>
                <input matInput [(ngModel)]="s.usuarioAdmin" maxlength="100" autocomplete="off" />
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>{{ data.servidor?.senhaAdminCadastrada ? 'Nova senha (vazio = manter)' : 'Senha' }}</mat-label>
                <input matInput type="password" [(ngModel)]="senhaAdmin" autocomplete="new-password" [disabled]="apagarAdmin" />
              </mat-form-field>
            </div>
            @if (data.servidor?.senhaAdminCadastrada) {
              <mat-checkbox [(ngModel)]="apagarAdmin">Apagar a senha de administrador cadastrada</mat-checkbox>
            }

            <h4>Acesso remoto (VNC/RDP)</h4>
            <div class="linha">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Tipo de acesso</mat-label>
                <mat-select [(ngModel)]="s.tipoAcessoRemoto">
                  <mat-option [value]="null">—</mat-option>
                  <mat-option value="VNC">VNC</mat-option>
                  <mat-option value="RDP">RDP</mat-option>
                  <mat-option value="SSH">SSH</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Usuário</mat-label>
                <input matInput [(ngModel)]="s.usuarioAcessoRemoto" maxlength="100" autocomplete="off" />
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>{{ data.servidor?.senhaAcessoRemotoCadastrada ? 'Nova senha (vazio = manter)' : 'Senha' }}</mat-label>
                <input matInput type="password" [(ngModel)]="senhaRemoto" autocomplete="new-password" [disabled]="apagarRemoto" />
              </mat-form-field>
            </div>
            @if (data.servidor?.senhaAcessoRemotoCadastrada) {
              <mat-checkbox [(ngModel)]="apagarRemoto">Apagar a senha de acesso remoto cadastrada</mat-checkbox>
            }
          </div>
        </mat-tab>
      </mat-tab-group>

      @if (erro()) {
        <div class="erro"><mat-icon>error</mat-icon><span>{{ erro() }}</span></div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button (click)="salvar()" [disabled]="salvando() || !s.nome">Salvar</button>
    </mat-dialog-actions>
  `,
  styles: `
    .campos { display: flex; flex-direction: column; gap: 14px; padding-top: 12px; }
    .linha { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-start; }
    .linha > * { flex: 1 1 200px; }
    .chaves { display: flex; gap: 24px; flex-wrap: wrap; }
    h4 { margin: 8px 0 4px; }
    .dica { margin: 0 0 6px; font-size: .8rem; color: var(--mat-sys-on-surface-variant, rgba(0,0,0,.6)); }
    .aviso { margin: 0 0 8px; padding: 6px 10px; border-radius: 8px; font-size: .8rem;
             background: var(--mat-sys-surface-container, #eef0f3); }
    .erro { display: flex; gap: 8px; align-items: flex-start; margin-top: 8px; padding: 8px 10px; border-radius: 8px;
            font-size: .85rem; background: color-mix(in srgb, #d93636 12%, transparent); color: #c62828; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServidorDialogComponent {
  readonly data = inject<ServidorDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<ServidorDialogComponent, Servidor>>(MatDialogRef);
  private readonly service = inject(InfraestruturaService);

  readonly rotuloLocal = ROTULO_TIPO_LOCAL;
  readonly tiposLocal = Object.keys(ROTULO_TIPO_LOCAL) as TipoLocal[];
  readonly ambientesAtivos = this.data.opcoes.ambientes.filter(a => a.ativo || a.codigo === this.data.servidor?.ambiente);
  readonly hospedagensAtivas = this.data.opcoes.hospedagens.filter(
    h => h.ativo || h.codHospedagem === this.data.servidor?.codHospedagem
  );

  s: ServidorEdicao = (() => {
    const v = this.data.servidor;
    const padraoHospedagem = this.data.opcoes.hospedagens.find(h => h.ativo)?.codHospedagem ?? null;
    return {
      nome: v?.nome ?? '',
      ip: v?.ip ?? null,
      maquina: v?.maquina ?? null,
      so: v?.so ?? 'LINUX',
      tipoLocal: v?.tipoLocal ?? 'SERVIDOR',
      ambiente: v?.ambiente ?? null,
      codHospedagem: v ? v.codHospedagem : padraoHospedagem,
      codGrupo: v?.codGrupo ?? null,
      observacao: v?.observacao ?? null,
      ativo: v?.ativo ?? true,
      monitorado: v?.monitorado ?? true,
      tipoAcessoRemoto: v?.tipoAcessoRemoto ?? null,
      usuarioAdmin: v?.usuarioAdmin ?? null,
      senhaAdmin: null,
      usuarioAcessoRemoto: v?.usuarioAcessoRemoto ?? null,
      senhaAcessoRemoto: null,
      winrm: v?.winrm ?? 'HTTPS',
    };
  })();

  senhaAdmin = '';
  senhaRemoto = '';
  apagarAdmin = false;
  apagarRemoto = false;

  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);

  salvar() {
    const dados: ServidorEdicao = {
      ...this.s,
      // null = manter; '' = apagar; texto = trocar
      senhaAdmin: this.apagarAdmin ? '' : this.senhaAdmin ? this.senhaAdmin : null,
      senhaAcessoRemoto: this.apagarRemoto ? '' : this.senhaRemoto ? this.senhaRemoto : null,
      winrm: this.s.so === 'WINDOWS' ? this.s.winrm : null,
    };
    this.salvando.set(true);
    this.erro.set(null);
    this.service
      .salvarServidor(this.data.servidor?.codServidor ?? null, dados)
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({
        next: salvo => this.ref.close(salvo),
        error: e => this.erro.set(e?.error?.message ?? 'Não foi possível salvar.'),
      });
  }
}
