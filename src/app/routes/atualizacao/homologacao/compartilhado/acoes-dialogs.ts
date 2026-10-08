import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

import { normalizarTexto } from '../../atualizacao.models';
import {
  AgrupamentoHom,
  CancelarRequest,
  DivergenciaHom,
  EditarItemRequest,
  HomologacaoDetalhe,
  ItemHom,
  ItemRequest,
  ModuloHom,
  MotivoCancelamento,
  RESULTADO_INFO,
  ResolucaoDivergencia,
  RoteiroResumo,
  UsuarioHom,
  hojeIso,
  porModulo,
} from '../homologacao.models';
import { HomologacaoService } from '../homologacao.service';

const ESTILO = `
  .campos {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: min(560px, 88vw);
    padding-top: 8px !important;
  }

  .linha {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    > * {
      flex: 1;
      min-width: 160px;
    }
  }

  .dica {
    margin: 0;
    font-size: .8rem;
    color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
  }

  .aviso {
    margin: 0;
    padding: 6px 10px;
    border-radius: 8px;
    font-size: .8rem;
    background: color-mix(in srgb, #e08a00 14%, transparent);
  }

  mat-radio-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
`;

// ================================================================== iniciar

export interface IniciarDialogData {
  homologacao: HomologacaoDetalhe;
}

/**
 * Iniciar: confirma que o fabricante instalou (R-15). As versões vêm do cadastro de sistemas por ambiente (D-06):
 * atual = Produção, homologada = ambiente da homologação; ficam congeladas a partir daqui.
 */
@Component({
  selector: 'app-hom-iniciar-dialog',
  imports: [FormsModule, MatButtonModule, MatCheckboxModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>Iniciar {{ h.numero }}</h2>
    <mat-dialog-content class="campos">
      @if (antesDaPrevisao) {
        <p class="aviso">A previsão de início é {{ h.previsaoInicio.split('-').reverse().join('/') }}: iniciar agora antecipa a homologação.</p>
      }
      <p class="dica">Versões do cadastro (Produção → {{ h.ambiente }}), que ficam registradas nesta homologação:</p>
      <ul class="versoes">
        @for (s of h.sistemas; track s.codHomologacaoSistema) {
          <li>
            <strong>{{ s.nome }}</strong>: {{ s.versaoAtual || '(sem versão em Produção)' }} → {{ s.versaoNova || '(sem versão em ' + h.ambiente + ')' }}
            @if (s.versaoNova && s.versaoNova === s.versaoAtual) {
              <span class="alerta">mesma versão de Produção</span>
            }
          </li>
        }
      </ul>
      @if (semVersao.length) {
        <p class="aviso">
          Sem versão cadastrada em {{ h.ambiente }}: {{ semVersao.join(', ') }}. Informe a versão instalada pelo fabricante em Atualizações › Configuração ›
          Sistemas por ambiente — é ela que está sendo homologada.
        </p>
      } @else {
        @if (mesmaVersao.length) {
          <p class="aviso">
            {{ mesmaVersao.join(', ') }}: a versão em {{ h.ambiente }} é a mesma de Produção. Se o fabricante já instalou a nova, atualize o cadastro de
            sistemas por ambiente antes de iniciar.
          </p>
        }
        <mat-checkbox [(ngModel)]="instalada">O fabricante já instalou a versão em {{ h.ambiente }}</mat-checkbox>
        <p class="dica">A instalação é do fabricante; o ntiApp controla só a validação. Com a homologação iniciada, os testes ficam liberados.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Voltar</button>
      <button mat-flat-button type="button" [disabled]="!instalada || semVersao.length > 0" (click)="dialogRef.close(true)">Iniciar</button>
    </mat-dialog-actions>
  `,
  styles: [
    ESTILO,
    `
      .versoes {
        margin: 0;
        padding-left: 20px;
        font-size: .875rem;
      }

      .alerta {
        margin-left: 6px;
        font-size: .75rem;
        color: #b26a00;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IniciarDialogComponent {
  private readonly data = inject<IniciarDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject<MatDialogRef<IniciarDialogComponent, boolean>>(MatDialogRef);
  readonly h = this.data.homologacao;
  readonly antesDaPrevisao = this.h.previsaoInicio > hojeIso();
  readonly semVersao = this.h.sistemas.filter(s => !s.versaoNova).map(s => s.nome);
  readonly mesmaVersao = this.h.sistemas.filter(s => s.versaoNova && s.versaoNova === s.versaoAtual).map(s => s.nome);
  instalada = false;
}

// ================================================================== cancelar

export interface CancelarDialogData {
  homologacao: HomologacaoDetalhe;
}

/** R-19: problemas ou outra versão do fabricante (com a homologação substituta já preenchida). */
@Component({
  selector: 'app-hom-cancelar-dialog',
  imports: [FormsModule, MatButtonModule, MatCheckboxModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatRadioModule],
  template: `
    <h2 mat-dialog-title>Cancelar {{ h.numero }}</h2>
    <mat-dialog-content class="campos">
      <mat-radio-group [(ngModel)]="motivo" aria-label="Motivo">
        <mat-radio-button value="PROBLEMA">Problemas (ambiente, versão instável, projeto suspenso...)</mat-radio-button>
        <mat-radio-button value="NOVA_VERSAO">O fabricante disponibilizou outra versão</mat-radio-button>
      </mat-radio-group>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Justificativa</mat-label>
        <textarea matInput rows="3" maxlength="2000" [(ngModel)]="justificativa"></textarea>
      </mat-form-field>
      @if (motivo === 'NOVA_VERSAO') {
        <mat-checkbox [(ngModel)]="criarSubstituta">Criar a homologação da nova versão</mat-checkbox>
        @if (criarSubstituta) {
          <p class="dica">
            A nova copia sistemas, ambiente, participantes e o roteiro desta (inclusive os itens incluídos só nela). Resultados, reservas e
            previsão não são copiados; as falhas desta versão aparecem lá para testar primeiro.
          </p>
          <p class="dica">
            A nova versão vem do cadastro de sistemas por ambiente ({{ h.ambiente }}): atualize-o em Atualizações › Configuração › Sistemas por
            ambiente quando o fabricante instalar. Até iniciar, a substituta acompanha o cadastro.
          </p>
          <div class="linha">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Previsão de início</mat-label>
              <input matInput type="date" [(ngModel)]="inicio" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Previsão de fim</mat-label>
              <input matInput type="date" [(ngModel)]="fim" [min]="inicio" />
            </mat-form-field>
          </div>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Voltar</button>
      <button mat-flat-button type="button" [disabled]="!valido()" (click)="confirmar()">Cancelar homologação</button>
    </mat-dialog-actions>
  `,
  styles: ESTILO,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CancelarDialogComponent {
  private readonly data = inject<CancelarDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<CancelarDialogComponent, CancelarRequest>>(MatDialogRef);
  readonly h = this.data.homologacao;
  motivo: MotivoCancelamento | null = null;
  justificativa = '';
  criarSubstituta = true;
  inicio = hojeIso();
  fim = '';

  valido() {
    if (!this.motivo || !this.justificativa.trim()) return false;
    if (this.motivo === 'NOVA_VERSAO' && this.criarSubstituta) {
      return !!this.inicio && !!this.fim && this.fim >= this.inicio;
    }
    return true;
  }

  confirmar() {
    const substituta = this.motivo === 'NOVA_VERSAO' && this.criarSubstituta;
    this.dialogRef.close({
      motivo: this.motivo!,
      justificativa: this.justificativa.trim(),
      criarSubstituta: substituta,
      previsaoInicio: substituta ? this.inicio : null,
      previsaoFim: substituta ? this.fim : null,
    });
  }
}

// ================================================================== entrega do fabricante

export interface EntregaDialogData {
  homologacao: HomologacaoDetalhe;
}

export interface EntregaDialogResultado {
  codHomologacaoSistema: number | null;
  versao: string;
  observacao: string | null;
  retestarReprovados: boolean;
  retestarBloqueados: boolean;
}

/** R-11: correção ou pacote do fabricante; reprovados e/ou bloqueados voltam para reteste. */
@Component({
  selector: 'app-hom-entrega-dialog',
  imports: [FormsModule, MatButtonModule, MatCheckboxModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>Entrega do fabricante</h2>
    <mat-dialog-content class="campos">
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Sistema</mat-label>
        <mat-select [(ngModel)]="codHomologacaoSistema">
          <mat-option [value]="null">Todos os sistemas</mat-option>
          @for (s of h.sistemas; track s.codHomologacaoSistema) {
            <mat-option [value]="s.codHomologacaoSistema">{{ s.nome }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Versão ou pacote entregue</mat-label>
        <input matInput maxlength="200" [(ngModel)]="versao" />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Observação (o que foi corrigido)</mat-label>
        <textarea matInput rows="2" maxlength="2000" [(ngModel)]="observacao"></textarea>
      </mat-form-field>
      <p class="dica">Voltam para reteste, com o mesmo responsável, em todas as trilhas:</p>
      <mat-checkbox [(ngModel)]="reprovados">Itens reprovados ({{ contar('reprovados') }})</mat-checkbox>
      <mat-checkbox [(ngModel)]="bloqueados">Itens bloqueados ({{ contar('bloqueados') }})</mat-checkbox>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Voltar</button>
      <button mat-flat-button type="button" [disabled]="!versao.trim()" (click)="confirmar()">Registrar entrega</button>
    </mat-dialog-actions>
  `,
  styles: ESTILO,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntregaDialogComponent {
  private readonly data = inject<EntregaDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<EntregaDialogComponent, EntregaDialogResultado>>(MatDialogRef);
  readonly h = this.data.homologacao;
  codHomologacaoSistema: number | null = null;
  versao = '';
  observacao = '';
  reprovados = true;
  bloqueados = true;

  contar(campo: 'reprovados' | 'bloqueados') {
    return this.h.sistemas
      .filter(s => this.codHomologacaoSistema === null || s.codHomologacaoSistema === this.codHomologacaoSistema)
      .reduce((total, s) => total + s.contagem[campo], 0);
  }

  confirmar() {
    this.dialogRef.close({
      codHomologacaoSistema: this.codHomologacaoSistema,
      versao: this.versao.trim(),
      observacao: this.observacao.trim() || null,
      retestarReprovados: this.reprovados,
      retestarBloqueados: this.bloqueados,
    });
  }
}

// ================================================================== atribuir

export interface AtribuirDialogData {
  homologacao: HomologacaoDetalhe;
  usuarios: UsuarioHom[];
  descricao: string;
}

/** Exceção da gestão: coloca itens com qualquer participante com acesso (D-01: sem acesso não aparece habilitado). */
@Component({
  selector: 'app-hom-atribuir-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>Atribuir a outra pessoa</h2>
    <mat-dialog-content class="campos">
      <p class="dica">{{ data.descricao }}</p>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Participante</mat-label>
        <mat-select [(ngModel)]="codUsuario">
          @for (u of opcoes; track u.codUsuario) {
            <mat-option [value]="u.codUsuario" [disabled]="!u.temAcesso">
              {{ u.nome }}{{ u.temAcesso ? '' : ' — sem acesso à tela Homologação' }}
            </mat-option>
          }
        </mat-select>
      </mat-form-field>
      @if (semAcesso) {
        <p class="dica">Quem aparece desabilitado não tem a tela Homologação: libere em Gerenciar Acesso antes (nada é liberado automaticamente).</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Voltar</button>
      <button mat-flat-button type="button" [disabled]="!codUsuario" (click)="dialogRef.close(codUsuario!)">Atribuir</button>
    </mat-dialog-actions>
  `,
  styles: ESTILO,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AtribuirDialogComponent {
  readonly data = inject<AtribuirDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject<MatDialogRef<AtribuirDialogComponent, number>>(MatDialogRef);
  readonly opcoes =
    this.data.homologacao.participacao === 'DESIGNADOS'
      ? this.data.usuarios.filter(u => this.data.homologacao.designados.includes(u.codUsuario))
      : this.data.usuarios;
  readonly semAcesso = this.opcoes.some(u => !u.temAcesso);
  codUsuario: number | null = null;
}

// ================================================================== remover reservas

export interface RemoverReservasDialogData {
  descricao: string;
}

export interface RemoverReservasResultado {
  somentePendentes: boolean;
  motivo: string;
}

/** R-21: remover reservas — só os pendentes ou tudo, com motivo. */
@Component({
  selector: 'app-hom-remover-reservas-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatRadioModule],
  template: `
    <h2 mat-dialog-title>Remover reservas</h2>
    <mat-dialog-content class="campos">
      <p class="dica">{{ data.descricao }}</p>
      <mat-radio-group [(ngModel)]="somentePendentes" aria-label="Alcance">
        <mat-radio-button [value]="true">Só os pendentes — itens sem resultado voltam a ficar livres</mat-radio-button>
        <mat-radio-button [value]="false">Tudo — os já testados também ficam sem responsável (o resultado continua valendo)</mat-radio-button>
      </mat-radio-group>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Motivo</mat-label>
        <textarea matInput rows="2" maxlength="1000" [(ngModel)]="motivo"></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Voltar</button>
      <button mat-flat-button type="button" [disabled]="!motivo.trim()" (click)="confirmar()">Remover</button>
    </mat-dialog-actions>
  `,
  styles: ESTILO,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RemoverReservasDialogComponent {
  readonly data = inject<RemoverReservasDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<RemoverReservasDialogComponent, RemoverReservasResultado>>(MatDialogRef);
  somentePendentes = true;
  motivo = '';

  confirmar() {
    this.dialogRef.close({ somentePendentes: this.somentePendentes, motivo: this.motivo.trim() });
  }
}

// ================================================================== divergência

export interface DivergenciaDialogData {
  divergencia: DivergenciaHom;
}

export interface DivergenciaDialogResultado {
  forma: ResolucaoDivergencia;
  comentario: string;
}

/** R-09: resolvem os envolvidos ou a gestão. Registrar de novo no item também fecha, quando os resultados concordam. */
@Component({
  selector: 'app-hom-divergencia-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatRadioModule],
  template: `
    <h2 mat-dialog-title>Divergência em "{{ d.item }}"</h2>
    <mat-dialog-content class="campos">
      <p>
        Distribuição ({{ d.nomeResponsavel || 'sem responsável' }}): <strong>{{ rotulo(d.resultadoDistribuicao, d.impeditivoDistribuicao) }}</strong><br />
        Homologação geral de {{ d.nomeGeral }}: <strong>{{ rotulo(d.resultadoGeral, d.impeditivoGeral) }}</strong>
      </p>
      <mat-radio-group [(ngModel)]="forma" aria-label="Como resolver">
        <mat-radio-button value="VALE_DISTRIBUICAO">Vale a distribuição — o resultado oficial fica como está</mat-radio-button>
        <mat-radio-button value="VALE_GERAL">Vale a geral — o resultado da geral passa a valer na distribuição</mat-radio-button>
        <mat-radio-button value="RETESTE">Pedir reteste — o item volta pendente, com o mesmo responsável</mat-radio-button>
      </mat-radio-group>
      <p class="dica">Também dá para testar de novo e registrar no item: a divergência fecha sozinha quando os resultados concordarem.</p>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Comentário (a decisão)</mat-label>
        <textarea matInput rows="2" maxlength="2000" [(ngModel)]="comentario"></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Voltar</button>
      <button mat-flat-button type="button" [disabled]="!forma || !comentario.trim()" (click)="confirmar()">Resolver</button>
    </mat-dialog-actions>
  `,
  styles: ESTILO,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DivergenciaDialogComponent {
  private readonly data = inject<DivergenciaDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<DivergenciaDialogComponent, DivergenciaDialogResultado>>(MatDialogRef);
  readonly d = this.data.divergencia;
  forma: ResolucaoDivergencia | null = null;
  comentario = '';

  rotulo(r: DivergenciaHom['resultadoGeral'], impeditivo: boolean) {
    if (!r) return 'sem resultado';
    return RESULTADO_INFO[r].rotulo + (r === 'REPROVADO' && impeditivo ? ' (impeditivo)' : '');
  }

  confirmar() {
    this.dialogRef.close({ forma: this.forma!, comentario: this.comentario.trim() });
  }
}

// ================================================================== previsão

export interface PrevisaoDialogData {
  homologacao: HomologacaoDetalhe;
}

export interface PrevisaoDialogResultado {
  inicio: string;
  fim: string;
  motivo: string;
}

/** R-03: depois de iniciada, a previsão muda com motivo e fica na linha do tempo. */
@Component({
  selector: 'app-hom-previsao-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>Alterar previsão</h2>
    <mat-dialog-content class="campos">
      <div class="linha">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Início</mat-label>
          <input matInput type="date" [(ngModel)]="inicio" />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Fim</mat-label>
          <input matInput type="date" [(ngModel)]="fim" [min]="inicio" />
        </mat-form-field>
      </div>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Motivo</mat-label>
        <textarea matInput rows="2" maxlength="1000" [(ngModel)]="motivo"></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Voltar</button>
      <button mat-flat-button type="button" [disabled]="!inicio || !fim || fim < inicio || !motivo.trim()" (click)="confirmar()">Salvar</button>
    </mat-dialog-actions>
  `,
  styles: ESTILO,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrevisaoDialogComponent {
  private readonly data = inject<PrevisaoDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<PrevisaoDialogComponent, PrevisaoDialogResultado>>(MatDialogRef);
  inicio = this.data.homologacao.previsaoInicio;
  fim = this.data.homologacao.previsaoFim;
  motivo = '';

  confirmar() {
    this.dialogRef.close({ inicio: this.inicio, fim: this.fim, motivo: this.motivo.trim() });
  }
}

// ================================================================== agrupamento (nome e tela)

export interface AgrupamentoDialogData {
  titulo: string;
  nome: string;
  tela: string | null;
  /** Agrupamentos que já existem (fora o próprio), para não repetir o nome — no sistema com módulos, só no mesmo módulo. */
  existentes: { nome: string; codModulo: number | null }[];
  /** Sistema que trabalha com módulos: o módulo é obrigatório (D-12). Vazio = sem módulos. */
  modulos?: ModuloHom[];
  codModulo?: number | null;
}

export interface AgrupamentoDialogResultado {
  nome: string;
  tela: string | null;
  codModulo: number | null;
}

/** Nome, tela (ex.: CAD_PAC para "Cadastro de Pacientes") e módulo de um agrupamento, do roteiro padrão ou da homologação. */
@Component({
  selector: 'app-hom-agrupamento-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>{{ data.titulo }}</h2>
    <mat-dialog-content class="campos">
      @if (modulos.length) {
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Módulo</mat-label>
          <mat-select [(ngModel)]="codModulo" placeholder="Escolha o módulo">
            @for (m of modulos; track m.codModulo) {
              <mat-option [value]="m.codModulo">{{ m.nome }}{{ m.ativo ? '' : ' (inativo)' }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }
      <div class="linha">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Nome do agrupamento</mat-label>
          <input matInput maxlength="200" [(ngModel)]="nome" cdkFocusInitial />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="tela">
          <mat-label>Tela (opcional)</mat-label>
          <input matInput maxlength="100" [(ngModel)]="tela" placeholder="Ex.: CAD_PAC" />
        </mat-form-field>
      </div>
      @if (repetido()) {
        <p class="aviso">Já existe o agrupamento "{{ repetido() }}"{{ modulos.length ? ' neste módulo' : '' }}.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Voltar</button>
      <button mat-flat-button type="button" [disabled]="!nome.trim() || !!repetido() || (modulos.length > 0 && !codModulo)" (click)="confirmar()">
        Salvar
      </button>
    </mat-dialog-actions>
  `,
  styles: [ESTILO, '.tela { flex: 0 0 160px; min-width: 140px; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgrupamentoDialogComponent {
  readonly data = inject<AgrupamentoDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<AgrupamentoDialogComponent, AgrupamentoDialogResultado>>(MatDialogRef);
  /** Ativos e o atual, mesmo inativo. */
  readonly modulos = (this.data.modulos ?? []).filter(m => m.ativo || m.codModulo === this.data.codModulo);
  nome = this.data.nome;
  tela = this.data.tela ?? '';
  codModulo: number | null = this.data.codModulo ?? null;

  repetido() {
    const alvo = normalizarTexto(this.nome.trim());
    // Com módulos, o mesmo nome pode existir em outro módulo (ex.: Cadastro de Pacientes em dois módulos).
    const mesmoModulo = (codModulo: number | null) => !this.modulos.length || codModulo === this.codModulo;
    return alvo ? (this.data.existentes.find(e => normalizarTexto(e.nome) === alvo && mesmoModulo(e.codModulo))?.nome ?? null) : null;
  }

  confirmar() {
    this.dialogRef.close({ nome: this.nome.trim(), tela: this.tela.trim().toUpperCase() || null, codModulo: this.codModulo });
  }
}

// ================================================================== incluir item

export interface ItemDialogData {
  homologacao: HomologacaoDetalhe;
  codHomologacaoSistema?: number;
  codAgrupamento?: number;
}

/**
 * Incluir item durante a homologação (R-02): só nesta ou nesta e no roteiro padrão (permissão de roteiros).
 * O sistema não vem escolhido (a não ser pelo "Incluir item aqui" ou com um sistema só) e o agrupamento sai da
 * lista; criar um novo é o botão +, para que os existentes sejam vistos antes. Agrupamento novo (ou criado nesta
 * homologação) pede o roteiro padrão de destino quando há mais de um.
 */
@Component({
  selector: 'app-hom-item-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  template: `
    <h2 mat-dialog-title>Incluir item</h2>
    <mat-dialog-content class="campos">
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Sistema</mat-label>
        <mat-select [ngModel]="codHs()" (ngModelChange)="trocarSistema($event)" placeholder="Escolha o sistema">
          @for (s of h.sistemas; track s.codHomologacaoSistema) {
            <mat-option [value]="s.codHomologacaoSistema">{{ s.nome }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      @if (!novo()) {
        <div class="agrupamento">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Agrupamento</mat-label>
            <mat-select [ngModel]="codAgrupamento()" (ngModelChange)="codAgrupamento.set($event)" [disabled]="!codHs()">
              @if (sistema()?.trabalhaModulo) {
                @for (g of agrupamentosPorModulo(); track g.nome) {
                  <mat-optgroup [label]="g.nome">
                    @for (a of g.agrupamentos; track a.codAgrupamento) {
                      <mat-option [value]="a.codAgrupamento">{{ a.nome }}{{ a.tela ? ' · ' + a.tela : '' }}</mat-option>
                    }
                  </mat-optgroup>
                }
              } @else {
                @for (a of agrupamentos(); track a.codAgrupamento) {
                  <mat-option [value]="a.codAgrupamento">{{ a.nome }}{{ a.tela ? ' · ' + a.tela : '' }}</mat-option>
                }
              }
            </mat-select>
            @if (codHs() && !agrupamentos().length) {
              <mat-hint>Este sistema ainda não tem agrupamentos: crie um no +.</mat-hint>
            }
          </mat-form-field>
          <button mat-icon-button type="button" [disabled]="!codHs()" matTooltip="Novo agrupamento" aria-label="Novo agrupamento" (click)="criarAgrupamento()">
            <mat-icon>add</mat-icon>
          </button>
        </div>
      } @else {
        <div class="novo-agrupamento">
          @if (sistema()?.trabalhaModulo) {
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Módulo</mat-label>
              <mat-select [ngModel]="novoModulo()" (ngModelChange)="novoModulo.set($event)" placeholder="Escolha o módulo">
                @for (m of modulosAtivos(); track m.codModulo) {
                  <mat-option [value]="m.codModulo">{{ m.nome }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          }
          <div class="linha">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Nome do novo agrupamento</mat-label>
              <input matInput maxlength="200" [ngModel]="novoAgrupamento()" (ngModelChange)="novoAgrupamento.set($event)" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="tela">
              <mat-label>Tela (opcional)</mat-label>
              <input matInput maxlength="100" [(ngModel)]="novaTela" placeholder="Ex.: CAD_PAC" />
            </mat-form-field>
          </div>
          @if (repetido()) {
            <p class="aviso">Já existe "{{ repetido()!.nome }}" {{ sistema()?.trabalhaModulo ? 'neste módulo de' : 'em' }} {{ sistema()?.nome }}: use o existente.</p>
          } @else if (parecidos().length) {
            <p class="aviso">Parecidos em {{ sistema()?.nome }}: {{ parecidos().join(', ') }}. Confira se não é um deles.</p>
          }
          <button mat-button type="button" class="voltar" (click)="usarExistente()"><mat-icon>arrow_back</mat-icon> Escolher um existente</button>
        </div>
      }
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>O que testar (Item)</mat-label>
        <input matInput maxlength="300" [(ngModel)]="titulo" />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Como testar (Processos)</mat-label>
        <textarea matInput rows="3" maxlength="4000" [(ngModel)]="passos"></textarea>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Resultado esperado</mat-label>
        <textarea matInput rows="2" maxlength="2000" [(ngModel)]="esperado"></textarea>
      </mat-form-field>
      <mat-checkbox [(ngModel)]="critico">Crítico — reprovado já vem marcado como impeditivo</mat-checkbox>

      <mat-radio-group [ngModel]="noPadrao()" (ngModelChange)="noPadrao.set($event)" aria-label="Alcance">
        <mat-radio-button [value]="false" [disabled]="!h.eu.podeIncluirSoNesta">Só nesta homologação</mat-radio-button>
        <mat-radio-button [value]="true" [disabled]="!h.eu.roteiros">Nesta e no roteiro padrão (reaproveitar nas próximas)</mat-radio-button>
      </mat-radio-group>
      @if (!h.eu.roteiros) {
        <p class="dica">Gravar no roteiro padrão exige a tela Roteiros de homologação.</p>
      }
      @if (precisaDestino()) {
        <p class="dica">O agrupamento não veio de um roteiro padrão: escolha onde gravar.</p>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Roteiro padrão de destino</mat-label>
          <mat-select [(ngModel)]="codRoteiroDestino">
            @for (r of roteirosDoSistema(); track r.codRoteiro) {
              <mat-option [value]="r.codRoteiro">{{ r.nome }}{{ r.ativo ? '' : ' (inativo)' }}</mat-option>
            }
            <mat-option [value]="0">+ Novo roteiro</mat-option>
          </mat-select>
        </mat-form-field>
        @if (codRoteiroDestino === 0) {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Nome do novo roteiro (ex.: Versão completa)</mat-label>
            <input matInput maxlength="200" [(ngModel)]="novoRoteiro" />
          </mat-form-field>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Voltar</button>
      <button mat-flat-button type="button" [disabled]="!valido()" (click)="confirmar()">Incluir</button>
    </mat-dialog-actions>
  `,
  styles: [
    ESTILO,
    `
      .agrupamento {
        display: flex;
        gap: 4px;
        align-items: center;

        > mat-form-field {
          flex: 1;
        }
      }

      .novo-agrupamento {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px;
        border: 1px dashed var(--mat-sys-outline-variant, rgba(0, 0, 0, .2));
        border-radius: 8px;
      }

      .tela {
        flex: 0 0 160px;
        min-width: 140px;
      }

      .voltar {
        align-self: flex-start;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemDialogComponent implements OnInit {
  private readonly data = inject<ItemDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ItemDialogComponent, ItemRequest>>(MatDialogRef);
  private readonly service = inject(HomologacaoService);
  readonly h = this.data.homologacao;

  /** Sem sistema escolhido de saída: só pelo "Incluir item aqui" ou quando a homologação tem um sistema só. */
  readonly codHs = signal<number | null>(
    this.data.codHomologacaoSistema ?? (this.h.sistemas.length === 1 ? this.h.sistemas[0].codHomologacaoSistema : null)
  );
  readonly codAgrupamento = signal<number | null>(this.data.codAgrupamento ?? null);
  /** Criando agrupamento novo (botão +) em vez de escolher um existente. */
  readonly novo = signal(false);
  readonly novoAgrupamento = signal('');
  readonly noPadrao = signal(!this.h.eu.podeIncluirSoNesta);
  readonly roteiros = signal<RoteiroResumo[]>([]);
  novaTela = '';
  readonly novoModulo = signal<number | null>(null);
  titulo = '';
  passos = '';
  esperado = '';
  critico = false;
  codRoteiroDestino: number | null = null;
  novoRoteiro = '';

  readonly agrupamentos = computed(() => this.h.agrupamentos.filter(a => a.codHomologacaoSistema === this.codHs()));
  readonly sistema = computed(() => this.h.sistemas.find(s => s.codHomologacaoSistema === this.codHs()));
  /** Sistema com módulos: a lista de agrupamentos vem separada por módulo (D-13). */
  readonly agrupamentosPorModulo = computed(() =>
    porModulo(this.sistema()?.modulos ?? [], this.agrupamentos()).map(g => ({ nome: g.nome, agrupamentos: g.itens }))
  );
  readonly modulosAtivos = computed(() => (this.sistema()?.modulos ?? []).filter(m => m.codModulo !== null && m.ativo));
  readonly roteirosDoSistema = computed(() => this.roteiros().filter(r => r.codSistema === this.sistema()?.codSistema));
  /**
   * Com quem o nome novo é comparado: no sistema com módulos, só os agrupamentos do módulo escolhido — o mesmo processo
   * (ex.: Cadastro de Pacientes) pode existir em módulos diferentes; sem módulos, todos do sistema.
   */
  private readonly comparaveis = computed(() => {
    if (!this.sistema()?.trabalhaModulo) return this.agrupamentos();
    const modulo = this.novoModulo();
    return modulo === null ? [] : this.agrupamentos().filter(a => a.codModulo === modulo);
  });
  /** Mesmo nome (sem acento e caixa) de um agrupamento que já existe (no mesmo módulo): não cria de novo. */
  readonly repetido = computed(() => {
    const alvo = normalizarTexto(this.novoAgrupamento().trim());
    return alvo ? this.comparaveis().find(a => normalizarTexto(a.nome) === alvo) : undefined;
  });
  /** Nomes que contêm (ou estão contidos n)o que foi digitado, para conferir antes de criar. */
  readonly parecidos = computed(() => {
    const alvo = normalizarTexto(this.novoAgrupamento().trim());
    if (alvo.length < 3) return [];
    return this.comparaveis()
      .filter(a => {
        const nome = normalizarTexto(a.nome);
        return nome.includes(alvo) || alvo.includes(nome);
      })
      .map(a => a.nome);
  });
  /** Agrupamento novo ou sem origem no padrão, com o sistema sem exatamente um roteiro: precisa escolher o destino. */
  readonly precisaDestino = computed(() => {
    if (!this.noPadrao() || (!this.novo() && !this.codAgrupamento())) return false;
    const ag = this.novo() ? undefined : this.agrupamentos().find(a => a.codAgrupamento === this.codAgrupamento());
    return (!ag || !ag.doPadrao) && (this.sistema()?.codRoteiros.length ?? 0) !== 1;
  });

  ngOnInit() {
    if (this.h.eu.roteiros) {
      this.service.roteiros().subscribe({ next: r => this.roteiros.set(r), error: () => {} });
    }
  }

  trocarSistema(cod: number) {
    this.codHs.set(cod);
    this.codAgrupamento.set(null);
    this.novoModulo.set(null);
  }

  criarAgrupamento() {
    this.novo.set(true);
    this.codAgrupamento.set(null);
  }

  usarExistente() {
    this.novo.set(false);
    this.novoAgrupamento.set('');
    this.novaTela = '';
  }

  valido() {
    if (!this.titulo.trim() || !this.codHs()) return false;
    if (this.novo() ? !this.novoAgrupamento().trim() || !!this.repetido() : !this.codAgrupamento()) return false;
    if (this.novo() && this.sistema()?.trabalhaModulo && !this.novoModulo()) return false;
    if (this.precisaDestino() && (this.codRoteiroDestino === null || (this.codRoteiroDestino === 0 && !this.novoRoteiro.trim()))) return false;
    return true;
  }

  confirmar() {
    const destino = this.precisaDestino();
    const novo = this.novo();
    this.dialogRef.close({
      codHomologacaoSistema: this.codHs()!,
      codAgrupamento: novo ? null : this.codAgrupamento(),
      novoAgrupamento: novo ? this.novoAgrupamento().trim() : null,
      novoAgrupamentoTela: novo ? this.novaTela.trim().toUpperCase() || null : null,
      novoAgrupamentoModulo: novo && this.sistema()?.trabalhaModulo ? this.novoModulo() : null,
      titulo: this.titulo.trim(),
      passos: this.passos.trim() || null,
      resultadoEsperado: this.esperado.trim() || null,
      critico: this.critico,
      noPadrao: this.noPadrao(),
      codRoteiroDestino: destino && this.codRoteiroDestino ? this.codRoteiroDestino : null,
      novoRoteiro: destino && this.codRoteiroDestino === 0 ? this.novoRoteiro.trim() : null,
    });
  }
}

// ================================================================== mover itens entre agrupamentos

export interface MoverItensDialogData {
  homologacao: HomologacaoDetalhe;
  itens: ItemHom[];
}

/** Reorganizar: leva os itens para outro agrupamento do mesmo sistema (separado por módulo, quando houver). */
@Component({
  selector: 'app-hom-mover-itens-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>Mover {{ data.itens.length === 1 ? 'item' : data.itens.length + ' itens' }}</h2>
    <mat-dialog-content class="campos">
      @if (data.itens.length === 1) {
        <p class="dica">"{{ data.itens[0].titulo }}" — responsável, resultados e histórico vão junto.</p>
      } @else {
        <p class="dica">Responsáveis, resultados e histórico vão junto com cada item.</p>
      }
      @if (sistema) {
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Para o agrupamento ({{ sistema.nome }})</mat-label>
          <mat-select [(ngModel)]="codAgrupamento">
            @for (g of grupos; track g.nome) {
              @if (g.nome) {
                <mat-optgroup [label]="g.nome">
                  @for (a of g.itens; track a.codAgrupamento) {
                    <mat-option [value]="a.codAgrupamento">{{ a.nome }}{{ a.tela ? ' · ' + a.tela : '' }}</mat-option>
                  }
                </mat-optgroup>
              } @else {
                @for (a of g.itens; track a.codAgrupamento) {
                  <mat-option [value]="a.codAgrupamento">{{ a.nome }}{{ a.tela ? ' · ' + a.tela : '' }}</mat-option>
                }
              }
            }
          </mat-select>
        </mat-form-field>
      } @else {
        <p class="aviso">Os itens escolhidos são de sistemas diferentes: itens só mudam de agrupamento dentro do mesmo sistema.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Voltar</button>
      <button mat-flat-button type="button" [disabled]="!codAgrupamento" (click)="dialogRef.close(codAgrupamento!)">Mover</button>
    </mat-dialog-actions>
  `,
  styles: ESTILO,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoverItensDialogComponent {
  readonly data = inject<MoverItensDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject<MatDialogRef<MoverItensDialogComponent, number>>(MatDialogRef);
  private readonly codHs = new Set(this.data.itens.map(i => i.codHomologacaoSistema));
  readonly sistema = this.codHs.size === 1 ? this.data.homologacao.sistemas.find(s => this.codHs.has(s.codHomologacaoSistema)) : undefined;
  /** Destinos: agrupamentos do sistema, menos o de origem quando é um só. */
  private readonly origens = new Set(this.data.itens.map(i => i.codAgrupamento));
  readonly grupos = (() => {
    if (!this.sistema) return [];
    const destinos = this.data.homologacao.agrupamentos.filter(
      a => a.codHomologacaoSistema === this.sistema!.codHomologacaoSistema && !(this.origens.size === 1 && this.origens.has(a.codAgrupamento))
    );
    return this.sistema.trabalhaModulo ? porModulo(this.sistema.modulos, destinos) : [{ codModulo: null, nome: '', itens: destinos }];
  })();
  codAgrupamento: number | null = null;
}

// ================================================================== trocar agrupamento de sistema / módulo

export interface TrocarAgrupamentoDialogData {
  homologacao: HomologacaoDetalhe;
  agrupamento: AgrupamentoHom;
}

export interface TrocarAgrupamentoResultado {
  codHomologacaoSistema: number;
  codModulo: number | null;
}

/** Leva o agrupamento (com itens, resultados e reservas) para outro sistema desta homologação e/ou outro módulo. */
@Component({
  selector: 'app-hom-trocar-agrupamento-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>Trocar sistema / módulo</h2>
    <mat-dialog-content class="campos">
      <p class="dica">
        "{{ a.nome }}" ({{ qtdItens }} {{ qtdItens === 1 ? 'item' : 'itens' }}) vai com itens, resultados, reservas e histórico. O parecer dos sistemas
        envolvidos é recalculado.
      </p>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Sistema</mat-label>
        <mat-select [ngModel]="codHs()" (ngModelChange)="trocarSistema($event)">
          @for (s of h.sistemas; track s.codHomologacaoSistema) {
            <mat-option [value]="s.codHomologacaoSistema">{{ s.nome }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      @if (sistema()?.trabalhaModulo) {
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Módulo</mat-label>
          <mat-select [ngModel]="codModulo()" (ngModelChange)="codModulo.set($event)" placeholder="Escolha o módulo">
            @for (m of modulos(); track m.codModulo) {
              <mat-option [value]="m.codModulo">{{ m.nome }}{{ m.ativo ? '' : ' (inativo)' }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        @if (a.doPadrao) {
          <p class="dica">Veio do roteiro padrão: o módulo escolhido aqui vale nesta homologação, sem mudar o padrão.</p>
        }
      }
      @if (repetido()) {
        <p class="aviso">Já existe "{{ a.nome }}" {{ sistema()?.trabalhaModulo ? 'nesse módulo' : 'nesse sistema' }}: renomeie um dos dois antes.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Voltar</button>
      <button mat-flat-button type="button" [disabled]="!valido()" (click)="confirmar()">Trocar</button>
    </mat-dialog-actions>
  `,
  styles: ESTILO,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrocarAgrupamentoDialogComponent {
  readonly data = inject<TrocarAgrupamentoDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<TrocarAgrupamentoDialogComponent, TrocarAgrupamentoResultado>>(MatDialogRef);
  readonly h = this.data.homologacao;
  readonly a = this.data.agrupamento;
  readonly qtdItens = this.h.itens.filter(i => i.codAgrupamento === this.a.codAgrupamento).length;

  readonly codHs = signal(this.a.codHomologacaoSistema);
  readonly codModulo = signal<number | null>(this.a.codModulo);
  readonly sistema = computed(() => this.h.sistemas.find(s => s.codHomologacaoSistema === this.codHs()));
  /** Módulos do sistema escolhido: os ativos e o atual (mesmo inativo). */
  readonly modulos = computed(() =>
    (this.sistema()?.modulos ?? []).filter(m => m.codModulo !== null && (m.ativo || m.codModulo === this.a.codModulo))
  );
  /** Mesmo nome no destino (no mesmo módulo, quando o sistema trabalha com módulos). */
  readonly repetido = computed(() => {
    const alvo = normalizarTexto(this.a.nome);
    const comModulo = !!this.sistema()?.trabalhaModulo;
    return this.h.agrupamentos.some(
      x =>
        x.codAgrupamento !== this.a.codAgrupamento &&
        x.codHomologacaoSistema === this.codHs() &&
        normalizarTexto(x.nome) === alvo &&
        (!comModulo || x.codModulo === this.codModulo())
    );
  });

  trocarSistema(codHs: number) {
    this.codHs.set(codHs);
    // Módulo é do sistema: ao trocar de sistema, escolhe de novo.
    this.codModulo.set(codHs === this.a.codHomologacaoSistema ? this.a.codModulo : null);
  }

  valido() {
    const mudou = this.codHs() !== this.a.codHomologacaoSistema || this.codModulo() !== this.a.codModulo;
    return mudou && !this.repetido() && (!this.sistema()?.trabalhaModulo || this.codModulo() !== null);
  }

  confirmar() {
    this.dialogRef.close({ codHomologacaoSistema: this.codHs(), codModulo: this.sistema()?.trabalhaModulo ? this.codModulo() : null });
  }
}

// ================================================================== editar item "só nesta"

export interface EditarItemDialogData {
  item: ItemHom;
}

/** Renomear item incluído só nesta homologação; os resultados já registrados continuam valendo. */
@Component({
  selector: 'app-hom-editar-item-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>Editar item</h2>
    <mat-dialog-content class="campos">
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>O que testar (Item)</mat-label>
        <input matInput maxlength="300" [(ngModel)]="titulo" cdkFocusInitial />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Como testar (Processos)</mat-label>
        <textarea matInput rows="3" maxlength="4000" [(ngModel)]="passos"></textarea>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Resultado esperado</mat-label>
        <textarea matInput rows="2" maxlength="2000" [(ngModel)]="esperado"></textarea>
      </mat-form-field>
      @if (data.item.resultado) {
        <p class="dica">O item já tem resultado: ele continua valendo e a mudança fica na linha do tempo.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Voltar</button>
      <button mat-flat-button type="button" [disabled]="!titulo.trim()" (click)="confirmar()">Salvar</button>
    </mat-dialog-actions>
  `,
  styles: ESTILO,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditarItemDialogComponent {
  readonly data = inject<EditarItemDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<EditarItemDialogComponent, EditarItemRequest>>(MatDialogRef);
  titulo = this.data.item.titulo;
  passos = this.data.item.passos ?? '';
  esperado = this.data.item.resultadoEsperado ?? '';

  confirmar() {
    this.dialogRef.close({ titulo: this.titulo.trim(), passos: this.passos.trim() || null, resultadoEsperado: this.esperado.trim() || null });
  }
}
