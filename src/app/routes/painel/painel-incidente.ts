import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Subscription, firstValueFrom, timer } from 'rxjs';

import { ServidorDto } from '@core';
import { ChamadoCard, TomChamado } from './chamado-card';
import { PainelEventosService } from './painel-eventos.service';
import { idadeTexto, numero } from './painel-formato';
import { ChamadoPainel, ProblemaPainel, SessaoLockPainel, SistemaImpactado } from './painel.models';
import { RodizioPaginas } from './painel-rodizio';
import { PainelService } from './painel.service';

/** Load por núcleo em que a máquina passa da capacidade (mesmo limite do alerta do backend). */
const LOAD_POR_CPU_ALTO = 1.0;

/** Load por núcleo com fila de espera sustentada: a barra chega a 100% aqui. */
const LOAD_POR_CPU_CRITICO = 2.0;

/** Acima disso sobra menos de 20% de disco: mesmo ponto em que o backend gera ALERTA. */
const DISCO_ALERTA = 80;

/** Acima disso sobra menos de 10%: mesmo ponto em que o backend gera ERRO. */
const DISCO_CRITICO = 90;

/** Lock só aparece na TV depois de alguns minutos parado. */
const LOCK_MINUTOS_MINIMO = 3;

/** Acima disso o painel avisa que há lock antigo. */
const LOCK_MINUTOS_CRITICO = 10;

/**
 * Cards por página. É este número que define a altura do card: a grade divide a
 * altura disponível por ele, então aumentar aqui deixa o item menor (e mostra
 * mais chamado por página).
 */
const CHAMADOS_POR_PAGINA = 10;

/** Quanto tempo um chamado recém-chegado fica destacado. */
const MS_DESTAQUE_NOVO = 6000;

/** Servidores listados no bloco de monitoramento. */
const MAX_SERVIDORES = 4;

/** Locks detalhados; o resto vira contagem no resumo. */
const MAX_LOCKS = 3;

/** Problemas (servidor/serviço fora) detalhados; o resto vira contagem. */
const MAX_PROBLEMAS = 3;

/** Situação de um indicador do servidor; vale para a cor e para entrar na lista. */
type NivelIndicador = 'ok' | 'alerta' | 'critico';

/** Cor e significado das faixas dos cards, explicados na legenda da tela. */
interface ItemLegenda {
  cor: string;
  texto: string;
}

@Component({
  selector: 'app-painel-incidente',
  standalone: true,
  imports: [ChamadoCard],
  templateUrl: './painel-incidente.html',
  styleUrl: './painel-incidente.scss',
})
export class PainelIncidente implements OnInit, OnDestroy {
  private readonly painelService = inject(PainelService);
  private readonly eventos = inject(PainelEventosService);

  readonly chamados = signal<ChamadoPainel[]>([]);
  readonly servidores = signal<ServidorDto[]>([]);
  readonly locks = signal<SessaoLockPainel[]>([]);
  readonly problemas = signal<ProblemaPainel[]>([]);
  readonly lockMaisLongo = signal(0);
  readonly novos = signal<ReadonlySet<string>>(new Set());

  readonly qtdChamados = computed(() => this.chamados().length);
  readonly totalLocks = computed(() => this.locks().length);
  readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.qtdChamados() / CHAMADOS_POR_PAGINA))
  );

  /** Primeira página (os mais antigos) fica mais tempo na tela. */
  private readonly rodizio = new RodizioPaginas(() => this.totalPaginas());
  readonly pagina = this.rodizio.pagina;

  /**
   * Página visível. A lista antiga tinha overflow escondido: o que passava da
   * altura da TV simplesmente sumia e ninguém sabia. Agora tudo aparece, em
   * rodízio, com o indicador de página ao lado do título.
   */
  readonly chamadosDaPagina = computed(() => {
    const inicio = this.pagina() * CHAMADOS_POR_PAGINA;
    return this.chamados().slice(inicio, inicio + CHAMADOS_POR_PAGINA);
  });

  /**
   * Sem isto, a cor da faixa do card não quer dizer nada para quem só olha a TV.
   *
   * Pendente vem por último no rótulo porque sobrepõe o tipo: um incidente
   * pendente aparece em âmbar, não em vermelho (ver `tomDoChamado`).
   */
  readonly legenda: ItemLegenda[] = [
    { cor: 'incidente', texto: 'Incidente' },
    { cor: 'requisicao', texto: 'Requisição' },
    { cor: 'pendente', texto: 'Pendente (de qualquer tipo)' },
  ];

  /** Faixas de tempo dos locks (ver `nivelLock`), em roxo para não confundir com os chamados. */
  readonly legendaLocks: ItemLegenda[] = [
    { cor: 'lock-ok', texto: 'Até 5 min' },
    { cor: 'lock-alerta', texto: '6 a 9 min' },
    { cor: 'lock-critico', texto: `${LOCK_MINUTOS_CRITICO} min ou mais` },
  ];

  /** Linhas fixas da grade: o card mantém o tamanho padrão mesmo com a página vazia. */
  readonly porPagina = CHAMADOS_POR_PAGINA;

  /** Bolinhas do indicador de página. */
  readonly indicesPagina = computed(() =>
    Array.from({ length: this.totalPaginas() }, (_, i) => i)
  );

  readonly temMonitoramento = computed(
    () => this.problemas().length > 0 || this.servidores().length > 0 || this.totalLocks() > 0
  );
  readonly problemasVisiveis = computed(() => this.problemas().slice(0, MAX_PROBLEMAS));
  readonly problemasOcultos = computed(() => Math.max(0, this.problemas().length - MAX_PROBLEMAS));

  /** Sistemas distintos afetados, para o número grande do cabeçalho. */
  readonly sistemasAfetados = computed(() => {
    const porId = new Map<number, SistemaImpactado>();
    for (const p of this.problemas()) {
      for (const s of p.sistemas) {
        const atual = porId.get(s.codSistema);
        if (!atual || s.situacao === 'TOTAL') porId.set(s.codSistema, s);
      }
    }
    return [...porId.values()];
  });
  readonly sistemasParados = computed(() => this.sistemasAfetados().filter(s => s.situacao === 'TOTAL').length);
  readonly locksAntigos = computed(() => this.lockMaisLongo() >= LOCK_MINUTOS_CRITICO);
  readonly locksOcultos = computed(() => Math.max(0, this.totalLocks() - MAX_LOCKS));
  readonly locksVisiveis = computed(() => this.locks().slice(0, MAX_LOCKS));

  private assinaturas = new Subscription();
  private vistos = new Set<string>();
  private destaqueTimer: ReturnType<typeof setTimeout> | null = null;
  private carregandoChamados = false;
  private carregandoServidores = false;
  private carregandoLocks = false;
  private carregandoImpactos = false;

  ngOnInit(): void {
    void this.atualizar();
    this.assinaturas.add(timer(2000, 2000).subscribe(() => void this.atualizar()));
    this.assinaturas.add(this.eventos.atualizacoes().subscribe(() => void this.atualizar()));
    this.rodizio.iniciar();
  }

  ngOnDestroy(): void {
    this.assinaturas.unsubscribe();
    this.rodizio.parar();
    if (this.destaqueTimer) clearTimeout(this.destaqueTimer);
  }

  /**
   * Um ciclo só conta como atualizado quando as três consultas voltaram bem.
   * Se qualquer uma falhar, a tela segura o último dado bom e o relógio de
   * "dados de X s atrás" começa a subir — é assim que se percebe que o painel
   * parou, em vez de ver uma tela limpa e achar que não há problema nenhum.
   */
  private async atualizar(): Promise<void> {
    const resultados = await Promise.all([
      this.carregarChamados(),
      this.carregarServidores(),
      this.carregarLocks(),
      this.carregarImpactos(),
    ]);

    if (resultados.every(Boolean)) this.eventos.registrarCarga();
  }

  // ───────────────────────── chamados ─────────────────────────

  private async carregarChamados(): Promise<boolean> {
    // O ciclo é de 2s e as consultas podem demorar mais que isso: sem esta trava
    // duas cargas terminam fora de ordem e a lista pisca com itens repetidos.
    if (this.carregandoChamados) return true;
    this.carregandoChamados = true;

    try {
      const incidentes = await firstValueFrom(this.painelService.incidentes());
      let itens = incidentes?.item ?? [];

      // Com poucos incidentes sobra espaço na TV, então completa com as requisições do dia.
      if ((incidentes?.total ?? 0) < 5) {
        const doDia = await firstValueFrom(this.painelService.requisicoesDoDia());
        itens = this.juntarSemRepetir(itens, doDia?.item ?? []);
      }

      itens = this.ordenar(itens);
      this.marcarNovidades(itens);
      this.chamados.set(itens);

      // A página pode ter ficado além do fim quando a lista encolhe.
      this.rodizio.ajustar();

      return true;
    } catch (erro) {
      console.error('Painel: falha ao carregar chamados', erro);
      return false;
    } finally {
      this.carregandoChamados = false;
    }
  }

  /**
   * Junta as duas listas por idChamado.
   *
   * /api/painel/incidentes devolve "INCIDENTE sem técnico OU chamado novo
   * (SN_STATUS_NOVO = 'S')", e esse segundo caso inclui requisições abertas hoje —
   * exatamente as que /api/painel/requisicao/hoje traz. Concatenar as duas listas
   * fazia a requisição do dia aparecer duas vezes na TV.
   */
  private juntarSemRepetir(...listas: ChamadoPainel[][]): ChamadoPainel[] {
    const porId = new Map<string, ChamadoPainel>();

    for (const lista of listas) {
      for (const chamado of lista) {
        const id = String(chamado?.idChamado ?? '').trim();
        if (!id || porId.has(id)) continue;
        porId.set(id, chamado);
      }
    }

    return [...porId.values()];
  }

  /** Incidente antes de requisição e, dentro de cada grupo, o mais antigo primeiro. */
  private ordenar(itens: ChamadoPainel[]): ChamadoPainel[] {
    return [...itens].sort((a, b) => {
      const tipoA = a.tipo === 'INCIDENTE' ? 0 : 1;
      const tipoB = b.tipo === 'INCIDENTE' ? 0 : 1;
      if (tipoA !== tipoB) return tipoA - tipoB;
      return (b.minutosAberto ?? 0) - (a.minutosAberto ?? 0);
    });
  }

  /** Marca por alguns segundos o que acabou de entrar, para o olho achar a novidade. */
  private marcarNovidades(itens: ChamadoPainel[]): void {
    const idsAtuais = new Set(itens.map(c => String(c.idChamado)));
    const novos = new Set([...idsAtuais].filter(id => !this.vistos.has(id)));

    // Só guarda o que está na tela: chamado que sai e volta é novidade de novo.
    this.vistos = idsAtuais;

    if (!novos.size) return;

    this.novos.set(novos);
    if (this.destaqueTimer) clearTimeout(this.destaqueTimer);
    this.destaqueTimer = setTimeout(() => this.novos.set(new Set()), MS_DESTAQUE_NOVO);
  }

  tomDoChamado(chamado: ChamadoPainel): TomChamado {
    if (chamado.snPendente === 'S') return 'pendente';
    return chamado.tipo === 'INCIDENTE' ? 'incidente' : 'requisicao';
  }

  ehNovo(chamado: ChamadoPainel): boolean {
    return this.novos().has(String(chamado.idChamado));
  }

  // ───────────────────────── servidores ─────────────────────────

  private async carregarServidores(): Promise<boolean> {
    if (this.carregandoServidores) return true;
    this.carregandoServidores = true;

    try {
      const dados = await firstValueFrom(this.painelService.servidores());
      const lista = Array.isArray(dados) ? dados : [];

      // Crítico primeiro (mais relevante), depois atenção; dentro do nível, a ordem da consulta (load, disco).
      const peso = (s: ServidorDto) => (this.nivelServidor(s) === 'critico' ? 0 : this.nivelServidor(s) === 'alerta' ? 1 : 2);
      this.servidores.set(
        lista
          .filter(s => !!s)
          .filter(s => this.emAtencao(s))
          .map((s, i) => ({ s, i }))
          .sort((x, y) => peso(x.s) - peso(y.s) || x.i - y.i)
          .map(x => x.s)
          .slice(0, MAX_SERVIDORES)
      );

      return true;
    } catch (erro) {
      console.error('Painel: falha ao carregar servidores', erro);
      return false;
    } finally {
      this.carregandoServidores = false;
    }
  }

  /**
   * Load de 5 min já dividido pelos núcleos, calculado no backend (LOADPORCPU).
   * null quando o load ainda não foi coletado ou o nº de CPUs é desconhecido —
   * nesse caso não dá para dizer se está alto, e a tela mostra só o texto do uptime.
   */
  loadPorCpu(servidor: ServidorDto | undefined): number | null {
    const valor = servidor?.loadporcpu;
    return typeof valor === 'number' && isFinite(valor) ? valor : null;
  }

  /** Barra cheia quando o load por núcleo chega no crítico (2 processos por núcleo na fila). */
  larguraLoad(servidor: ServidorDto | undefined): number {
    const porCpu = this.loadPorCpu(servidor);
    if (porCpu === null) return 0;
    return Math.min(Math.round((porCpu / LOAD_POR_CPU_CRITICO) * 100), 100);
  }

  /** "0,85 / núcleo" — o valor que realmente diz se a máquina está apertada. */
  loadTexto(servidor: ServidorDto | undefined): string {
    const porCpu = this.loadPorCpu(servidor);
    return porCpu === null ? (servidor?.cpuload ?? '—') : `${numero(porCpu)} / núcleo`;
  }

  cpusTexto(servidor: ServidorDto | undefined): string {
    const cpus = servidor?.qtcpu;
    if (!cpus) return 'CPUs não coletadas';
    return `${cpus} CPU${cpus > 1 ? 's' : ''} · load ${servidor?.cpuload ?? '—'}`;
  }

  /**
   * Situação do load: o mesmo corte usado no alerta do backend, sempre por núcleo.
   * Sem o nº de CPUs não dá para julgar, então fica em 'ok'.
   */
  nivelLoad(servidor: ServidorDto | undefined): NivelIndicador {
    const porCpu = this.loadPorCpu(servidor);
    if (porCpu === null) return 'ok';
    if (porCpu >= LOAD_POR_CPU_CRITICO) return 'critico';
    if (porCpu >= LOAD_POR_CPU_ALTO) return 'alerta';
    return 'ok';
  }

  /**
   * Situação do disco: o nível que o backend já calculou pela regra do alerta (% e GB juntos, boot fora); sem
   * ele (registro antigo), os cortes por porcentagem.
   */
  nivelDiscoServidor(servidor: ServidorDto | undefined): NivelIndicador {
    const nivel = servidor?.niveldisco;
    if (nivel === 'CRITICO' || nivel === 'EXTREMO') return 'critico';
    if (nivel === 'ATENCAO') return 'alerta';
    if (nivel === 'OK') return 'ok';
    return this.nivelDisco(servidor?.usodisco);
  }

  /** Situação do disco, nos mesmos cortes do alerta do backend (20% e 10% livres). */
  nivelDisco(usoTexto: string | undefined): NivelIndicador {
    const uso = this.usoDisco(usoTexto);
    if (uso > DISCO_CRITICO) return 'critico';
    if (uso > DISCO_ALERTA) return 'alerta';
    return 'ok';
  }

  /**
   * Servidor só entra na lista se algum indicador saiu do verde.
   *
   * A lista usava um corte próprio (disco acima de 60%) enquanto a barra só saía
   * do verde em 80%, então apareciam servidores "em atenção" com tudo bom.
   */
  emAtencao(servidor: ServidorDto | undefined): boolean {
    return this.nivelLoad(servidor) !== 'ok' || this.nivelDiscoServidor(servidor) !== 'ok';
  }

  /** Pior dos dois indicadores: define a cor da borda e o rótulo do card. */
  nivelServidor(servidor: ServidorDto | undefined): NivelIndicador {
    const niveis = [this.nivelLoad(servidor), this.nivelDiscoServidor(servidor)];
    if (niveis.includes('critico')) return 'critico';
    if (niveis.includes('alerta')) return 'alerta';
    return 'ok';
  }

  /** Rótulo em texto: cor sozinha não serve para quem não distingue âmbar de vermelho. */
  rotuloNivel(nivel: NivelIndicador): string {
    if (nivel === 'critico') return 'CRÍTICO';
    if (nivel === 'alerta') return 'ATENÇÃO';
    return 'OK';
  }

  usoDisco(usoTexto: string | undefined): number {
    if (!usoTexto) return 0;
    return parseInt(usoTexto.replace('%', ''), 10) || 0;
  }

  // ───────────────────────── sistemas impactados ─────────────────────────

  private async carregarImpactos(): Promise<boolean> {
    if (this.carregandoImpactos) return true;
    this.carregandoImpactos = true;

    try {
      const resposta = await firstValueFrom(this.painelService.impactos());
      this.problemas.set(resposta?.problemas ?? []);
      return true;
    } catch (erro) {
      // Segura a última lista boa. Não marca o ciclo como falho: chamados, servidores
      // e locks continuam atualizando, e o relógio de "dados de X s atrás" acusaria
      // o painel inteiro parado por causa só deste bloco.
      console.error('Painel: falha ao carregar sistemas impactados', erro);
      return true;
    } finally {
      this.carregandoImpactos = false;
    }
  }

  /** Manchete do problema, em linguagem de quem olha a TV. */
  rotuloProblema(problema: ProblemaPainel): string {
    switch (problema.tipo) {
      case 'SERVIDOR':
        return 'Servidor fora do ar';
      case 'BALANCEADOR':
        return 'Balanceador sem resposta';
      default:
        return 'Serviço parado';
    }
  }

  iconeProblema(problema: ProblemaPainel): string {
    switch (problema.tipo) {
      case 'SERVIDOR':
        return '▣';
      case 'BALANCEADOR':
        return '⇄';
      default:
        return '⚙';
    }
  }

  /** "parado" ou "parcial · 1 de 3 no ar". */
  situacaoSistema(sistema: SistemaImpactado): string {
    if (sistema.situacao === 'TOTAL') return 'fora do ar';
    return `parcial · ${sistema.nosAtivos} de ${sistema.nosTotal} no ar`;
  }

  desdeProblema(problema: ProblemaPainel): string {
    if (!problema.desde) return '';
    const inicio = new Date(problema.desde).getTime();
    if (!isFinite(inicio)) return '';
    return idadeTexto(Math.max(0, Math.trunc((Date.now() - inicio) / 60000)));
  }

  // ───────────────────────── locks ─────────────────────────

  private async carregarLocks(): Promise<boolean> {
    if (this.carregandoLocks) return true;
    this.carregandoLocks = true;

    try {
      const resposta = await firstValueFrom(this.painelService.locks());
      const agora = new Date();
      const emLock: SessaoLockPainel[] = [];
      let maior = 0;

      for (const sessao of resposta?.item ?? []) {
        if (!sessao?.last_status_date) continue;

        const minutos = this.minutosDesde(agora, new Date(sessao.last_status_date));
        sessao.tempoLock = minutos;

        if (minutos >= LOCK_MINUTOS_MINIMO) emLock.push(sessao);
        if (minutos > maior) maior = minutos;
      }

      emLock.sort((a, b) => (b.tempoLock ?? 0) - (a.tempoLock ?? 0));

      this.locks.set(emLock);
      this.lockMaisLongo.set(maior);

      return true;
    } catch (erro) {
      console.error('Painel: falha ao carregar locks', erro);
      return false;
    } finally {
      this.carregandoLocks = false;
    }
  }

  private minutosDesde(agora: Date, inicio: Date): number {
    return Math.trunc((agora.getTime() - inicio.getTime()) / 1000 / 60);
  }

  nivelLock(sessao: SessaoLockPainel | undefined): NivelIndicador {
    const tempo = sessao?.tempoLock ?? 0;
    if (tempo >= LOCK_MINUTOS_CRITICO) return 'critico';
    if (tempo > 5) return 'alerta';
    return 'ok';
  }

  tempoLock(sessao: SessaoLockPainel | undefined): number {
    return sessao?.tempoLock ?? 0;
  }
}
