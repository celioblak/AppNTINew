import { HttpEvent, HttpEventType, HttpResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { EMPTY, catchError, concatMap, filter, finalize, from, map, mergeMap, tap, toArray } from 'rxjs';

import { Arquivo, PacoteAnalise } from '../atualizacao.models';
import { AtualizacaoService } from '../atualizacao.service';

const ENVIOS_SIMULTANEOS = 4;

function resposta(evento: HttpEvent<Arquivo>): evento is HttpResponse<Arquivo> {
  return evento.type === HttpEventType.Response;
}

/** Arquivo de pasta com o caminho relativo à pasta escolhida ou solta (ex.: ATEND/admpac/forms/X.fmx). */
interface ArquivoDaPasta {
  arquivo: File;
  caminho: string;
}

/**
 * Pacote do fabricante para dentro de JARs: zip (extraído no servidor) ou pastas (cada arquivo com o caminho).
 * O seletor do navegador só escolhe uma pasta por vez; várias de uma vez, só arrastando (ex.: ATEND e FATURCONV
 * selecionadas no Explorer). Os envios se acumulam no mesmo pacote. Depois de enviar, reconhece as pastas pelos
 * mapeamentos do sistema e devolve a análise.
 */
@Component({
  selector: 'app-pacote-conteudo',
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule],
  template: `
    <div
      class="pacote"
      [class.pacote--arrastando]="arrastando()"
      (dragover)="sobre($event)"
      (dragleave)="arrastando.set(false)"
      (drop)="soltar($event)">
      <input #zip type="file" accept=".zip" multiple hidden (change)="enviarZips(zip)" />
      <input #pasta type="file" webkitdirectory multiple hidden (change)="escolherPasta(pasta)" />
      <div class="pacote__acoes">
        <button mat-stroked-button type="button" [disabled]="ocupado() || desabilitado()" (click)="zip.click()">
          <mat-icon>archive</mat-icon>
          Enviar zip
        </button>
        <button mat-stroked-button type="button" [disabled]="ocupado() || desabilitado()" (click)="pasta.click()">
          <mat-icon>drive_folder_upload</mat-icon>
          {{ pastas().length ? 'Adicionar pasta' : 'Enviar pasta' }}
        </button>
        @if (codArquivos().length && !ocupado()) {
          <span class="suave">{{ codArquivos().length }} arquivo(s) no pacote</span>
          <button mat-button type="button" (click)="limpar()">Limpar</button>
        }
      </div>
      <span class="suave">
        <strong>Várias pastas de uma vez: selecione no Explorer e arraste para este quadro.</strong>
        Pelo botão, o navegador deixa escolher uma pasta por vez — repita para somar ao pacote. Vale a raiz (a que contém ATEND,
        FATURCONV…) ou as próprias pastas; elas são reconhecidas pelos mapeamentos de JAR do sistema.
      </span>

      @if (pastas().length) {
        <div class="pacote__pastas">
          @for (p of pastas(); track p.nome) {
            <span class="pasta"><mat-icon>folder</mat-icon> {{ p.nome }} <span class="suave">· {{ p.arquivos }}</span></span>
          }
        </div>
      }

      @if (ocupado()) {
        <div class="pacote__progresso">
          <span class="suave">{{ etapa() }}</span>
          <mat-progress-bar [mode]="progresso() === null ? 'indeterminate' : 'determinate'" [value]="progresso() ?? 0" />
        </div>
      }

      @if (falhas().length) {
        <div class="pacote__falhas">
          <strong>{{ falhas().length }} arquivo(s) não foram enviados</strong>
          <span class="suave">Os demais entraram no pacote. Envie estes de novo (a mesma pasta pode ser enviada outra vez).</span>
          <ul>
            @for (f of falhasVisiveis(); track f) {
              <li><code>{{ f }}</code></li>
            }
          </ul>
          @if (falhas().length > falhasVisiveis().length) {
            <span class="suave">… e mais {{ falhas().length - falhasVisiveis().length }}.</span>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .pacote {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px 12px;
      border: 1px dashed var(--mat-sys-outline, rgba(0, 0, 0, .38));
      border-radius: 10px;
      transition: background-color .15s, border-color .15s;
    }

    .pacote--arrastando {
      border-color: var(--mat-sys-primary, #1976d2);
      background: color-mix(in srgb, var(--mat-sys-primary, #1976d2) 8%, transparent);
    }

    .pacote__acoes,
    .pacote__pastas {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .pasta {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 10px 2px 6px;
      border-radius: 12px;
      background: var(--mat-sys-surface-container, rgba(0, 0, 0, .05));
      font-size: .8rem;

      mat-icon {
        width: 16px;
        height: 16px;
        font-size: 16px;
      }
    }

    .pacote__progresso,
    .pacote__falhas {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .pacote__falhas {
      padding: 8px 10px;
      border-left: 3px solid #d32f2f;
      border-radius: 6px;
      background: color-mix(in srgb, #d32f2f 8%, transparent);
      font-size: .82rem;

      ul {
        max-height: 120px;
        margin: 0;
        padding-left: 18px;
        overflow: auto;
      }
    }

    .suave {
      font-size: .78rem;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PacoteConteudoComponent {
  private readonly service = inject(AtualizacaoService);

  readonly codAtualizacao = input.required<number>();
  readonly desabilitado = input(false);
  readonly analisado = output<PacoteAnalise | null>();

  readonly codArquivos = signal<number[]>([]);
  readonly ocupado = signal(false);
  readonly etapa = signal('');
  readonly progresso = signal<number | null>(null);
  readonly arrastando = signal(false);
  /** Pastas de primeiro nível já enviadas, com a quantidade de arquivos. */
  readonly pastas = signal<{ nome: string; arquivos: number }[]>([]);
  readonly falhas = signal<string[]>([]);
  readonly falhasVisiveis = computed(() => this.falhas().slice(0, 20));

  enviarZips(entrada: HTMLInputElement) {
    const zips = Array.from(entrada.files ?? []);
    entrada.value = '';
    this.enviarListaDeZips(zips);
  }

  /** Seletor do navegador: uma pasta por vez; webkitRelativePath já começa pelo nome dela. */
  escolherPasta(entrada: HTMLInputElement) {
    const arquivos = Array.from(entrada.files ?? []).map(arquivo => ({ arquivo, caminho: arquivo.webkitRelativePath || arquivo.name }));
    entrada.value = '';
    this.enviarPastas(arquivos);
  }

  sobre(evento: DragEvent) {
    if (this.ocupado() || this.desabilitado()) {
      return;
    }
    evento.preventDefault();
    this.arrastando.set(true);
  }

  /**
   * Várias pastas soltas de uma vez. As entradas precisam ser lidas ainda dentro do evento (depois o navegador
   * invalida o dataTransfer); a leitura do conteúdo das pastas é assíncrona.
   */
  soltar(evento: DragEvent) {
    evento.preventDefault();
    this.arrastando.set(false);
    if (this.ocupado() || this.desabilitado()) {
      return;
    }
    const entradas = Array.from(evento.dataTransfer?.items ?? [])
      .filter(item => item.kind === 'file')
      .map(item => item.webkitGetAsEntry())
      .filter((e): e is FileSystemEntry => !!e);
    if (!entradas.length) {
      return;
    }
    this.iniciar('Lendo as pastas…');
    Promise.all(entradas.map(e => lerEntrada(e)))
      .then(listas => {
        const todos = listas.flat();
        const zips = todos.filter(a => a.caminho.indexOf('/') < 0 && a.arquivo.name.toLowerCase().endsWith('.zip')).map(a => a.arquivo);
        const soltos = todos.filter(a => !zips.includes(a.arquivo));
        this.ocupado.set(false);
        if (soltos.length) {
          this.enviarPastas(soltos, zips);
        } else {
          this.enviarListaDeZips(zips);
        }
      })
      .catch(() => {
        this.ocupado.set(false);
        this.falhas.set(['Não foi possível ler as pastas soltas. Tente pelo botão "Enviar pasta".']);
      });
  }

  limpar() {
    this.codArquivos.set([]);
    this.pastas.set([]);
    this.falhas.set([]);
    this.analisado.emit(null);
  }

  private enviarListaDeZips(zips: File[]) {
    if (!zips.length) {
      return;
    }
    const cod = this.codAtualizacao();
    this.iniciar('Enviando zip…');
    from(zips)
      .pipe(
        concatMap(zip => this.service.enviarArquivo(cod, zip).pipe(filter(resposta), map(r => r.body!))),
        concatMap(zip => {
          this.etapa.set(`Extraindo ${zip.nome}…`);
          return this.service.extrairZip(cod, zip.codArquivo);
        }),
        toArray()
      )
      .subscribe({
        next: listas => this.adicionar(listas.flat().map(a => a.codArquivo)),
        error: () => this.ocupado.set(false),
      });
  }

  /** Envia os arquivos das pastas; um arquivo com erro não derruba os outros. Zips soltos junto vão depois. */
  private enviarPastas(arquivos: ArquivoDaPasta[], zipsDepois: File[] = []) {
    if (!arquivos.length) {
      return;
    }
    const cod = this.codAtualizacao();
    const falhas: string[] = [];
    let enviados = 0;
    this.falhas.set([]);
    this.iniciar(`Enviando 0 de ${arquivos.length}`);
    this.progresso.set(0);
    this.registrarPastas(arquivos);
    from(arquivos)
      .pipe(
        mergeMap(
          ({ arquivo, caminho }) =>
            this.service.enviarArquivo(cod, arquivo, caminho).pipe(
              filter(resposta),
              map(r => r.body!),
              catchError(() => {
                falhas.push(caminho);
                return EMPTY;
              }),
              finalize(() => {
                enviados++;
                this.etapa.set(`Enviando ${enviados} de ${arquivos.length}${falhas.length ? ` · ${falhas.length} com erro` : ''}`);
                this.progresso.set(Math.round((100 * enviados) / arquivos.length));
              })
            ),
          ENVIOS_SIMULTANEOS
        ),
        toArray()
      )
      .subscribe(lista => {
        this.falhas.set(falhas);
        if (lista.length) {
          this.adicionar(lista.map(a => a.codArquivo), zipsDepois);
        } else {
          this.ocupado.set(false);
        }
      });
  }

  private registrarPastas(arquivos: ArquivoDaPasta[]) {
    const contagem = new Map(this.pastas().map(p => [p.nome, p.arquivos]));
    for (const { caminho } of arquivos) {
      const nome = caminho.includes('/') ? caminho.split('/')[0] : '(arquivos soltos)';
      contagem.set(nome, (contagem.get(nome) ?? 0) + 1);
    }
    this.pastas.set([...contagem].map(([nome, qtd]) => ({ nome, arquivos: qtd })).sort((a, b) => a.nome.localeCompare(b.nome)));
  }

  private adicionar(novos: number[], zipsDepois: File[] = []) {
    this.codArquivos.update(lista => [...new Set([...lista, ...novos])]);
    if (zipsDepois.length) {
      this.enviarListaDeZips(zipsDepois);
      return;
    }
    this.etapa.set('Reconhecendo as pastas…');
    this.progresso.set(null);
    this.service
      .analisarPacote(this.codAtualizacao(), this.codArquivos())
      .pipe(finalize(() => this.ocupado.set(false)))
      .subscribe({ next: analise => this.analisado.emit(analise), error: () => {} });
  }

  private iniciar(etapa: string) {
    this.ocupado.set(true);
    this.etapa.set(etapa);
    this.progresso.set(null);
  }
}

/** Lê um arquivo ou uma pasta solta (recursivamente), com o caminho a partir do item solto: PASTA/sub/arquivo. */
async function lerEntrada(entrada: FileSystemEntry): Promise<ArquivoDaPasta[]> {
  const caminho = entrada.fullPath.replace(/^\/+/, '');
  if (entrada.isFile) {
    const arquivo = await new Promise<File>((ok, erro) => (entrada as FileSystemFileEntry).file(ok, erro));
    return [{ arquivo, caminho }];
  }
  const leitor = (entrada as FileSystemDirectoryEntry).createReader();
  const filhos: FileSystemEntry[] = [];
  // readEntries devolve em lotes (≈100 no Chrome): repete até vir vazio.
  for (;;) {
    const lote = await new Promise<FileSystemEntry[]>((ok, erro) => leitor.readEntries(ok, erro));
    if (!lote.length) {
      break;
    }
    filhos.push(...lote);
  }
  const listas = await Promise.all(filhos.map(f => lerEntrada(f)));
  return listas.flat();
}
