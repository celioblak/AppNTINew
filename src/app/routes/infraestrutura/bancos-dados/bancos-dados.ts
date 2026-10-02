import { Clipboard } from '@angular/cdk/clipboard';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MtxDialog } from '@ng-matero/extensions/dialog';
import { HotToastService } from '@ngxpert/hot-toast';
import { catchError, finalize, forkJoin, of } from 'rxjs';

import { normalizar } from '../../dispositivo/terminal-ssh/comandos';
import {
  AcessoBanco,
  Ambiente,
  Banco,
  Credencial,
  Disponibilidade,
  InstanciaBanco,
  Pendencia,
  ROTULO_FINALIDADE,
  ROTULO_FORMA_ACESSO,
  ROTULO_SITUACAO_BANCO,
  SituacaoBanco,
  duracao,
} from '../infraestrutura.models';
import { InfraestruturaService } from '../infraestrutura.service';
import { HistoricoDialogComponent, HistoricoDialogData } from '../servidores-servicos/historico-dialog';
import {
  AcessoDialogComponent,
  AcessoDialogData,
  BancoDialogComponent,
  BancoDialogData,
  ImportarDialogData,
  ImportarInstanciasDialogComponent,
  ScriptBancoDialogComponent,
  ScriptDialogData,
  TesteBancoDialogComponent,
  TesteBancoDialogData,
} from './banco-dialogs';

const SENHA_VISIVEL_MS = 30_000;

/**
 * Infraestrutura › Bancos de Dados (docs/infraestrutura.md, seção 13, F-3a): banco lógico (um RAC = um banco),
 * pontos de acesso (SCAN, endereços, descritor do tnsnames), credencial de monitoramento, instâncias e situação.
 */
@Component({
  selector: 'app-bancos-dados',
  imports: [DatePipe, FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule,
    MatSlideToggleModule, MatTooltipModule],
  templateUrl: './bancos-dados.html',
  styleUrls: ['../servidores-servicos/servidores-servicos.scss', './bancos-dados.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BancosDadosComponent implements OnInit, OnDestroy {
  private readonly service = inject(InfraestruturaService);
  private readonly dialog = inject(MatDialog);
  private readonly mtxDialog = inject(MtxDialog);
  private readonly toast = inject(HotToastService);
  private readonly clipboard = inject(Clipboard);

  readonly rotuloSituacao = ROTULO_SITUACAO_BANCO;
  readonly rotuloForma = ROTULO_FORMA_ACESSO;
  readonly rotuloFinalidade = ROTULO_FINALIDADE;

  readonly carregando = signal(false);
  readonly bancos = signal<Banco[]>([]);
  readonly ambientes = signal<Ambiente[]>([]);
  readonly selecionado = signal<number | null>(null);
  readonly filtro = signal('');
  readonly mostrarInativos = signal(false);
  readonly senha = signal<Credencial | null>(null);
  private temporizador?: ReturnType<typeof setTimeout>;

  readonly filtrados = computed(() => {
    const termo = normalizar(this.filtro().trim());
    return this.bancos().filter(b => {
      if (!this.mostrarInativos() && !b.ativo) return false;
      if (!termo) return true;
      const textos = [b.nome, b.modelo, b.nomeAmbiente ?? '', ...b.acessos.map(a => `${a.nome} ${a.host ?? ''} ${a.servico ?? ''} ${a.alias ?? ''}`),
        ...b.instancias.map(i => `${i.nome} ${i.host ?? ''}`)];
      return normalizar(textos.join(' ')).includes(termo);
    });
  });

  readonly atual = computed(() => this.bancos().find(b => b.codBanco === this.selecionado()) ?? null);

  readonly resumo = computed(() => {
    const lista = this.bancos().filter(b => b.ativo);
    return {
      bancos: lista.length,
      fora: lista.filter(b => b.situacao === 'FORA').length,
      parciais: lista.filter(b => b.situacao === 'PARCIAL').length,
      semAcesso: lista.filter(b => b.situacao === 'SEM_ACESSO').length,
      pendencias: lista.reduce((n, b) => n + b.pendencias.filter(p => p.gravidade !== 'INFO').length, 0),
    };
  });

  ngOnInit() {
    this.carregar();
  }

  ngOnDestroy() {
    clearTimeout(this.temporizador);
  }

  carregar(mostrarCarregando = true) {
    if (mostrarCarregando) this.carregando.set(true);
    forkJoin({
      bancos: this.service.bancos(),
      // Só para escolher o ambiente no cadastro: sem a tela de Ambientes, segue sem.
      opcoes: this.service.opcoes().pipe(catchError(() => of(null))),
    })
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({
        next: r => {
          this.bancos.set(r.bancos);
          this.ambientes.set(r.opcoes?.ambientes.filter(a => a.ativo) ?? []);
          if (!this.selecionado() && r.bancos.length) this.selecionar((r.bancos.find(b => b.ativo) ?? r.bancos[0]).codBanco);
        },
        error: () => {},
      });
  }

  selecionar(codBanco: number) {
    this.selecionado.set(codBanco);
    this.esconderSenha();
  }

  private aplicar(b: Banco) {
    this.bancos.update(lista => (lista.some(x => x.codBanco === b.codBanco) ? lista.map(x => (x.codBanco === b.codBanco ? b : x)) : [...lista, b]));
  }

  // ---------------------------------------------------------------- banco

  novoBanco() {
    this.abrirBanco(null);
  }

  abrirBanco(banco: Banco | null) {
    this.dialog
      .open<BancoDialogComponent, BancoDialogData, Banco>(BancoDialogComponent, {
        width: '640px',
        maxWidth: '96vw',
        data: { banco, ambientes: this.ambientes() },
      })
      .afterClosed()
      .subscribe(b => {
        if (!b) return;
        this.aplicar(b);
        this.selecionar(b.codBanco);
        this.toast.success(banco ? 'Banco salvo.' : 'Banco cadastrado. Agora o ponto de acesso e o script do usuário.');
      });
  }

  excluirBanco(b: Banco) {
    this.mtxDialog.confirm(`Excluir o banco "${b.nome}"? Pontos de acesso e instâncias lidas saem junto.`, '', () =>
      this.service.excluirBanco(b.codBanco).subscribe({
        next: () => {
          this.bancos.update(l => l.filter(x => x.codBanco !== b.codBanco));
          this.selecionado.set(null);
          this.toast.success('Banco excluído.');
        },
        error: () => {},
      })
    );
  }

  // ---------------------------------------------------------------- pontos de acesso

  abrirAcesso(b: Banco, acesso: AcessoBanco | null) {
    this.dialog
      .open<AcessoDialogComponent, AcessoDialogData, Banco>(AcessoDialogComponent, {
        width: '720px',
        maxWidth: '96vw',
        data: { codBanco: b.codBanco, acesso },
      })
      .afterClosed()
      .subscribe(atualizado => {
        if (!atualizado) return;
        this.aplicar(atualizado);
        this.toast.success('Ponto de acesso salvo.');
      });
  }

  excluirAcesso(b: Banco, a: AcessoBanco) {
    this.mtxDialog.confirm(`Excluir o ponto de acesso "${a.nome}"?`, '', () =>
      this.service.excluirAcesso(b.codBanco, a.codAcesso).subscribe({
        next: atualizado => {
          this.aplicar(atualizado);
          this.toast.success('Ponto de acesso excluído.');
        },
        error: () => {},
      })
    );
  }

  // ---------------------------------------------------------------- credencial, script e teste

  script(b: Banco) {
    this.dialog
      .open<ScriptBancoDialogComponent, ScriptDialogData, string>(ScriptBancoDialogComponent, {
        width: '820px',
        maxWidth: '96vw',
        maxHeight: '92vh',
        data: { banco: b },
      })
      .afterClosed()
      .subscribe(acao => {
        // A senha pode ter sido gerada agora: recarrega para "credencial cadastrada".
        this.service.banco(b.codBanco).subscribe({ next: x => this.aplicar(x), error: () => {} });
        if (acao === 'testar') this.testar(b);
      });
  }

  testar(b: Banco) {
    this.dialog
      .open<TesteBancoDialogComponent, TesteBancoDialogData, Banco | undefined>(TesteBancoDialogComponent, {
        width: '820px',
        maxWidth: '96vw',
        maxHeight: '92vh',
        data: { banco: b },
      })
      .afterClosed()
      .subscribe(atualizado => {
        if (atualizado) this.aplicar(atualizado);
      });
  }

  revelarSenha(b: Banco, copiar = false) {
    const ja = this.senha();
    if (ja && copiar) {
      this.copiarSenha(ja);
      return;
    }
    this.service.revelarCredencialBanco(b.codBanco).subscribe({
      next: cred => {
        if (cred.aviso) this.toast.warning(cred.aviso);
        if (copiar) {
          this.copiarSenha(cred);
          return;
        }
        this.senha.set(cred);
        clearTimeout(this.temporizador);
        this.temporizador = setTimeout(() => this.esconderSenha(), SENHA_VISIVEL_MS);
      },
      error: () => {},
    });
  }

  esconderSenha() {
    clearTimeout(this.temporizador);
    this.senha.set(null);
  }

  private copiarSenha(cred: Credencial) {
    if (!cred.senha) {
      this.toast.warning('Não há senha cadastrada para copiar.');
      return;
    }
    this.clipboard.copy(cred.senha);
    this.toast.success('Senha copiada para a área de transferência.');
  }

  // ---------------------------------------------------------------- instâncias

  importar(b: Banco) {
    this.dialog
      .open<ImportarInstanciasDialogComponent, ImportarDialogData, Banco>(ImportarInstanciasDialogComponent, {
        width: '760px',
        maxWidth: '96vw',
        data: { banco: b },
      })
      .afterClosed()
      .subscribe(atualizado => {
        if (!atualizado) return;
        this.aplicar(atualizado);
        this.toast.success('Instâncias importadas como serviços.');
      });
  }

  esquecer(b: Banco, i: InstanciaBanco) {
    this.mtxDialog.confirm(
      `Esquecer a instância ${i.nome}?`,
      'Use quando o nó foi desativado de vez (ou num RAC One Node que mudou o nome da instância). O serviço no servidor fica: exclua-o em Servidores e Serviços se não existir mais.',
      () =>
        this.service.esquecerInstancia(b.codBanco, i.codInstancia).subscribe({
          next: atualizado => {
            this.aplicar(atualizado);
            this.toast.success('Instância esquecida.');
          },
          error: () => {},
        })
    );
  }

  historico(b: Banco) {
    this.dialog.open<HistoricoDialogComponent, HistoricoDialogData>(HistoricoDialogComponent, {
      width: '760px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      data: { tipo: 'BANCO', codItem: b.codBanco, nome: `Banco ${b.nome}`, disponibilidade: b.disponibilidade },
    });
  }

  // ---------------------------------------------------------------- apresentação

  classe(situacao: SituacaoBanco | null) {
    switch (situacao) {
      case 'OK':
        return 'sit--ok';
      case 'PARCIAL':
        return 'sit--alerta';
      case 'FORA':
      case 'SEM_ACESSO':
        return 'sit--fora';
      default:
        return 'sit--desconhecido';
    }
  }

  rotulo(b: Banco) {
    if (!b.ativo) return 'Inativo';
    if (!b.situacao) return b.temSenha ? 'Ainda não testado' : 'Sem credencial';
    return this.rotuloSituacao[b.situacao];
  }

  classeAcesso(a: AcessoBanco) {
    if (!a.resultado) return 'sit--desconhecido';
    return a.resultado === 'OK' ? 'sit--ok' : 'sit--fora';
  }

  classeInstancia(i: InstanciaBanco) {
    if (!i.noAr) return 'sit--fora';
    return i.situacao === 'OPEN' ? 'sit--ok' : 'sit--alerta';
  }

  percentual(d: Disponibilidade | null): string {
    if (!d || d.percentual === null) return '—';
    return `${d.percentual.toFixed(d.percentual === 100 ? 0 : 2).replace('.', ',')}%`;
  }

  tooltipDisponibilidade(d: Disponibilidade | null): string {
    if (!d) return 'Sem histórico';
    if (d.percentual === null) return d.observacao ?? 'Sem dados';
    return [
      `Últimos 30 dias: ${d.paradas} parada(s), ${duracao(d.minutosParado)} fora`,
      d.minutosDegradado ? `${duracao(d.minutosDegradado)} parcial` : '',
      d.observacao ?? '',
    ]
      .filter(Boolean)
      .join(' · ');
  }

  classeDisponibilidade(d: Disponibilidade | null): string {
    if (!d || d.percentual === null) return 'disp disp--sem';
    if (d.percentual >= 99.9) return 'disp disp--ok';
    if (d.percentual >= 99) return 'disp disp--alerta';
    return 'disp disp--ruim';
  }

  iconePendencia(p: Pendencia): string {
    return p.gravidade === 'ALTA' ? 'error' : p.gravidade === 'MEDIA' ? 'warning' : 'info';
  }

  enderecoResumo(a: AcessoBanco): string {
    if (a.forma === 'DESCRITOR') return a.enderecos.join(', ') + (a.servico ? ` / ${a.servico}` : '');
    return `${a.host}:${a.porta}/${a.servico}`;
  }
}
