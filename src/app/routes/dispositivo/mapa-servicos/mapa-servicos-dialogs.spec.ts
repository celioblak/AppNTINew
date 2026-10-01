import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { BalanceadorDialogComponent } from './balanceador-dialog';
import { BalanceadorCadastro, PAINEL_DIALOGO_MAPA, ProcessoOpcao, SistemaCadastro } from './mapa-servicos.models';
import { MapaServicosService } from './mapa-servicos.service';
import { SistemaMapaDialogComponent } from './sistema-mapa-dialog';

const PROCESSOS: ProcessoOpcao[] = [
  { codProcesso: 1, nome: 'Apache', codServidor: 10, servidor: 'srv-web', tipo: 'Apache', porta: '80', temJkStatus: true },
  { codProcesso: 2, nome: 'Soul 1', codServidor: 11, servidor: 'srv-app1', tipo: 'Tomcat', porta: '8080', temJkStatus: false },
  { codProcesso: 3, nome: 'Soul 2', codServidor: 12, servidor: 'srv-app2', tipo: 'Tomcat', porta: '8080', temJkStatus: false },
];

const BALANCEADOR: BalanceadorCadastro = {
  codBalanceador: 100,
  nome: 'Apache Soul',
  codProcesso: 1,
  worker: null,
  observacao: null,
  membros: [],
  sistemas: [],
  pais: [],
};

const SISTEMA: SistemaCadastro = {
  codSistema: 7,
  sistema: 'MV Soul',
  sistemaAtivo: true,
  cadastrado: false,
  urlAcesso: null,
  exibePainel: true,
  observacao: null,
  entradas: [],
  servicosAtualizacao: [],
};

const servicoFalso = {
  jkStatus: () => of({ acessivel: false, erro: 'teste', url: null, workers: [] }),
  salvarSistema: (s: SistemaCadastro) => of(s),
  salvarBalanceador: (b: BalanceadorCadastro) => of(b),
};

const esperar = () => new Promise(r => setTimeout(r, 50));

/**
 * Abre um combo do diálogo e devolve as opções que o usuário realmente vê:
 * cada opção precisa estar na frente de tudo no ponto onde é desenhada
 * (no <body>, o overlay do diálogo cobria a lista e o combo parecia vazio).
 */
async function opcoesVisiveis(indice: number): Promise<string[]> {
  const combos = document.querySelectorAll(`.${PAINEL_DIALOGO_MAPA} .ng-select-container`);
  const combo = combos[indice] as HTMLElement;
  expect(combo).withContext(`combo ${indice} dentro do diálogo`).toBeTruthy();
  combo.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  await esperar();
  TestBed.tick();

  const opcoes = Array.from(document.querySelectorAll<HTMLElement>('.ng-dropdown-panel .ng-option'));
  const visiveis = opcoes.filter(o => {
    const r = o.getBoundingClientRect();
    const naFrente = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!naFrente && o.contains(naFrente);
  });
  combo.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); // fecha
  await esperar();
  return visiveis.map(o => (o.textContent ?? '').trim());
}

describe('Mapa de serviços - diálogos', () => {
  let dialog: MatDialog;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        { provide: MapaServicosService, useValue: servicoFalso },
      ],
    }).compileComponents();
    dialog = TestBed.inject(MatDialog);
  });

  afterEach(async () => {
    dialog.closeAll();
    await esperar();
  });

  /** Abre como a tela abre: MatDialog real, com a classe do painel. */
  async function abrir<T>(componente: new (...args: any[]) => T, data: unknown) {
    const ref = dialog.open(componente, { panelClass: PAINEL_DIALOGO_MAPA, width: '900px', data });
    await esperar();
    TestBed.tick();
    return ref.componentInstance;
  }

  it('balanceador: a lista de processos aparece na frente do diálogo', async () => {
    await abrir(BalanceadorDialogComponent, { balanceador: null, processos: PROCESSOS, balanceadores: [] });
    const opcoes = await opcoesVisiveis(0);
    expect(opcoes.length).withContext(JSON.stringify(opcoes)).toBe(3);
  });

  it('sistema: a lista de serviços aparece na frente do diálogo', async () => {
    await abrir(SistemaMapaDialogComponent, { sistema: SISTEMA, processos: PROCESSOS, balanceadores: [] });
    const opcoes = await opcoesVisiveis(0);
    expect(opcoes.length).withContext(JSON.stringify(opcoes)).toBe(3);
  });

  it('sistema: trocar para serviço direto mostra os serviços e sugere o de Atualizações', async () => {
    const sistema = { ...SISTEMA, servicosAtualizacao: [3] };
    const tela = await abrir(SistemaMapaDialogComponent, { sistema, processos: PROCESSOS, balanceadores: [BALANCEADOR] });
    expect(tela.entradas()[0].tipo).toBe('BALANCEADOR');

    const botoes = document.querySelectorAll<HTMLElement>(`.${PAINEL_DIALOGO_MAPA} .mat-button-toggle-button`);
    botoes[1].click(); // "Serviço direto"
    await esperar();
    TestBed.tick();

    expect(tela.entradas()[0].tipo).toBe('SERVICO');
    expect(tela.entradas()[0].alvo).withContext('sugestão de Atualizações').toBe(3);
    const opcoes = await opcoesVisiveis(0);
    expect(opcoes.length).withContext(JSON.stringify(opcoes)).toBe(3);
    expect(opcoes[0]).withContext('vinculado vem primeiro').toContain('Soul 2');
  });

  it('sistema novo sem balanceadores já abre com os serviços de Atualizações', async () => {
    const sistema = { ...SISTEMA, servicosAtualizacao: [2, 3] };
    const tela = await abrir(SistemaMapaDialogComponent, { sistema, processos: PROCESSOS, balanceadores: [] });
    expect(tela.entradas().map(e => [e.tipo, e.alvo])).toEqual([
      ['SERVICO', 2],
      ['SERVICO', 3],
    ]);
  });

  it('dialogo do componente solto (sem MatDialog) continua funcionando', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [BalanceadorDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        { provide: MAT_DIALOG_DATA, useValue: { balanceador: null, processos: PROCESSOS, balanceadores: [] } },
        { provide: MatDialogRef, useValue: { close: () => {} } },
        { provide: MapaServicosService, useValue: servicoFalso },
      ],
    }).compileComponents();
    const fixture: ComponentFixture<BalanceadorDialogComponent> = TestBed.createComponent(BalanceadorDialogComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.candidatosProcesso.length).toBe(3);
  });
});
