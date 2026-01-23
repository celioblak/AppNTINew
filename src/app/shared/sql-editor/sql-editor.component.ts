import { Component, ElementRef, AfterViewInit, OnDestroy, ViewChild, Input, Output, EventEmitter, NgZone, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Declaração global para Monaco
declare const monaco: any;

@Component({
  selector: 'app-sql-text-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="sql-editor-container">
      <div class="editor-toolbar">
        <div class="toolbar-left">
          <button class="toolbar-btn" (click)="formatCode()" [disabled]="!editor && !fallbackTextarea" title="Formatar SQL (Ctrl+Shift+F)">
            📐 Formatar
          </button>
          <button class="toolbar-btn btn-execute" (click)="executeCode()" [disabled]="!editor && !fallbackTextarea" title="Executar (Ctrl+Enter)">
            ▶️ Executar
          </button>
          <button class="toolbar-btn" (click)="clearCode()" [disabled]="!editor && !fallbackTextarea" title="Limpar">
            🗑️ Limpar
          </button>
        </div>

        <div class="toolbar-right">
          <span class="status-indicator" [class.ready]="editor" [class.fallback]="fallbackTextarea && !editor">
            {{ editor ? 'Monaco ✓' : fallbackTextarea ? 'Básico ✓' : 'Carregando...' }}
          </span>
        </div>
      </div>

      <div #editorContainer class="editor-wrapper">
        <!-- Monaco Editor será injetado aqui -->
      </div>

      <div class="editor-footer">
        <div class="footer-left">
          <span>SQL Editor</span>
        </div>
        <div class="footer-right">
          <span>{{ getLineCount() }} linhas</span>
          <span>{{ getCharCount() }} caracteres</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .sql-editor-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
      background: white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .editor-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
      min-height: 48px;
    }

    .toolbar-left, .toolbar-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .toolbar-btn {
      padding: 6px 12px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 13px;
      color: #333;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .toolbar-btn:hover:not(:disabled) {
      background: #f0f0f0;
      border-color: #ccc;
    }

    .toolbar-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-execute {
      background: #2196F3;
      color: white;
      border-color: #1976D2;
    }

    .btn-execute:hover:not(:disabled) {
      background: #1976D2;
    }

    .status-indicator {
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
      background: #ff9800;
      color: white;
    }

    .status-indicator.ready {
      background: #4CAF50;
    }

    .status-indicator.fallback {
      background: #9E9E9E;
    }

    .editor-wrapper {
      flex: 1;
      position: relative;
      min-height: 200px;
    }

    .editor-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 12px;
      background: #f8f9fa;
      border-top: 1px solid #e0e0e0;
      font-size: 11px;
      color: #666;
      min-height: 28px;
    }

    .footer-left, .footer-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    /* Estilos para o fallback textarea */
    .fallback-textarea {
      width: 100%;
      height: 100%;
      padding: 12px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      line-height: 1.5;
      border: none;
      resize: none;
      outline: none;
      background: #fafafa;
      box-sizing: border-box;
    }

    .fallback-textarea:focus {
      background: white;
    }

    .fallback-textarea[readonly] {
      background: #f5f5f5;
      color: #666;
    }
  `]
})
export class SqlTextEditorComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('editorContainer') editorContainer!: ElementRef<HTMLDivElement>;

  @Input() value: string = '';
  @Input() readonly: boolean = false;

  @Output() valueChange = new EventEmitter<string>();
  @Output() execute = new EventEmitter<string>();

  editor: any = null;
  fallbackTextarea: HTMLTextAreaElement | null = null;
  private monacoLoaded = false;

  constructor(private ngZone: NgZone) {}

  async ngAfterViewInit() {
    // Tentar carregar Monaco
    await this.tryLoadMonaco();

    // Se Monaco não carregou, criar fallback
    if (!this.monacoLoaded && !this.editor) {
      this.createFallbackEditor();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['value'] && !changes['value'].firstChange) {
      if (this.editor) {
        const currentValue = this.editor.getValue();
        if (currentValue !== this.value) {
          this.editor.setValue(this.value);
        }
      } else if (this.fallbackTextarea) {
        if (this.fallbackTextarea.value !== this.value) {
          this.fallbackTextarea.value = this.value;
        }
      }
    }

    if (changes['readonly'] && this.editor) {
      this.editor.updateOptions({ readOnly: this.readonly });
    } else if (changes['readonly'] && this.fallbackTextarea) {
      this.fallbackTextarea.readOnly = this.readonly;
    }
  }

  ngOnDestroy() {
    this.destroyEditor();
  }

  private async tryLoadMonaco(): Promise<void> {
    try {
      // Verificar se Monaco está disponível globalmente (pode ter sido carregado por outro componente)
      if (typeof monaco !== 'undefined') {
        this.monacoLoaded = true;
        this.initializeMonacoEditor();
        return;
      }

      // Verificar se Monaco está disponível via require (se assets foram carregados)
      if (typeof (window as any).require !== 'undefined') {
        const require = (window as any).require;

        // Configurar caminho para assets locais
        require.config({ paths: { vs: './assets/monaco/vs' } });

        await new Promise<void>((resolve, reject) => {
          require(['vs/editor/editor.main'], () => {
            this.monacoLoaded = true;
            this.initializeMonacoEditor();
            resolve();
          }, reject);
        });
        return;
      }

      // Monaco não disponível
      console.log('Monaco Editor não disponível, usando editor básico');

    } catch (error) {
      console.warn('Não foi possível carregar Monaco Editor:', error);
    }
  }

  private initializeMonacoEditor(): void {
    if (!this.monacoLoaded || !this.editorContainer) {
      return;
    }

    try {
      // Configurar linguagem SQL
      this.setupSQLLanguage();

      // Criar editor
      this.editor = monaco.editor.create(this.editorContainer.nativeElement, {
        value: this.value,
        language: 'sql',
        theme: 'vs',
        readOnly: this.readonly,
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        wordWrap: 'on',
        scrollBeyondLastLine: false,
        folding: true,
        lineHeight: 20,
        padding: { top: 8 },
        tabSize: 2,
        insertSpaces: true,
        autoIndent: 'full'
      });

      // Configurar eventos
      this.editor.onDidChangeModelContent(() => {
        this.ngZone.run(() => {
          const value = this.editor.getValue();
          this.valueChange.emit(value);
        });
      });

      // Configurar atalhos de teclado
      this.editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
        () => this.formatCode()
      );

      this.editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
        () => this.executeCode()
      );

    } catch (error) {
      console.error('Erro ao inicializar Monaco Editor:', error);
      this.createFallbackEditor();
    }
  }

  private setupSQLLanguage(): void {
    // Verificar se SQL já está registrado
    const languages = monaco.languages.getLanguages();
    if (languages.some((lang: any) => lang.id === 'sql')) {
      return;
    }

    // Registrar linguagem SQL
    monaco.languages.register({ id: 'sql' });

    // Configurar syntax highlighting básico
    monaco.languages.setMonarchTokensProvider('sql', {
      tokenizer: {
        root: [
          [/[a-zA-Z_$][\w$]*/, {
            cases: {
              '@keywords': 'keyword',
              '@default': 'identifier'
            }
          }],
          [/[0-9]+/, 'number'],
          [/['][^']*[']/, 'string'],
          [/["][^"]*["]/, 'string'],
          [/[`][^`]*[`]/, 'string'],
          [/--.*$/, 'comment'],
          [/\/\*/, 'comment', '@comment'],
          [/[=><+\-*/%&|^!~]/, 'operator'],
        ],
        comment: [
          [/[^\/*]+/, 'comment'],
          [/\/\*/, 'comment', '@push'],
          ["\\*/", 'comment', '@pop'],
          [/[\/*]/, 'comment']
        ]
      },
      keywords: [
        'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER',
        'ON', 'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'IS', 'NULL',
        'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'ALL',
        'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE',
        'TABLE', 'ALTER', 'DROP', 'INDEX', 'VIEW', 'TRIGGER', 'PROCEDURE',
        'FUNCTION', 'DATABASE', 'USE', 'SHOW', 'DESCRIBE', 'EXPLAIN',
        'BEGIN', 'COMMIT', 'ROLLBACK', 'TRANSACTION', 'GRANT', 'REVOKE'
      ]
    });
  }

  private createFallbackEditor(): void {
    const container = this.editorContainer.nativeElement;

    // Limpar container
    container.innerHTML = '';

    // Criar textarea
    this.fallbackTextarea = document.createElement('textarea');
    this.fallbackTextarea.className = 'fallback-textarea';
    this.fallbackTextarea.value = this.value;
    this.fallbackTextarea.readOnly = this.readonly;
    this.fallbackTextarea.placeholder = 'Digite seu SQL aqui...\n\nAtalhos:\n• Ctrl+Shift+F = Formatar\n• Ctrl+Enter = Executar';

    // Configurar eventos
    this.fallbackTextarea.addEventListener('input', (event: Event) => {
      const target = event.target as HTMLTextAreaElement;
      this.ngZone.run(() => {
        this.valueChange.emit(target.value);
      });
    });

    // Configurar atalhos de teclado
    this.fallbackTextarea.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'F') {
        event.preventDefault();
        this.formatCode();
      }

      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        this.executeCode();
      }
    });

    container.appendChild(this.fallbackTextarea);
  }

  private destroyEditor(): void {
    if (this.editor) {
      this.editor.dispose();
      this.editor = null;
    }

    if (this.fallbackTextarea) {
      this.fallbackTextarea.remove();
      this.fallbackTextarea = null;
    }
  }

  // Métodos públicos
  formatCode(): void {
    let code = '';

    if (this.editor) {
      code = this.editor.getValue();
    } else if (this.fallbackTextarea) {
      code = this.fallbackTextarea.value;
    }

    const formatted = this.formatSQL(code);

    if (this.editor) {
      const position = this.editor.getPosition();
      this.editor.setValue(formatted);
      if (position) {
        this.editor.setPosition(position);
        this.editor.focus();
      }
    } else if (this.fallbackTextarea) {
      const start = this.fallbackTextarea.selectionStart;
      const end = this.fallbackTextarea.selectionEnd;
      this.fallbackTextarea.value = formatted;
      this.fallbackTextarea.setSelectionRange(start, end);
      this.fallbackTextarea.focus();
    }

    this.valueChange.emit(formatted);
  }

  executeCode(): void {
    let code = '';

    if (this.editor) {
      code = this.editor.getValue();
    } else if (this.fallbackTextarea) {
      code = this.fallbackTextarea.value;
    }

    if (code.trim()) {
      this.execute.emit(code);
    }
  }

  clearCode(): void {
    if (this.editor) {
      this.editor.setValue('');
    } else if (this.fallbackTextarea) {
      this.fallbackTextarea.value = '';
    }

    this.valueChange.emit('');
  }

  getLineCount(): number {
    if (this.editor) {
      const model = this.editor.getModel();
      return model ? model.getLineCount() : 0;
    } else if (this.fallbackTextarea) {
      return this.fallbackTextarea.value.split('\n').length;
    }
    return 0;
  }

  getCharCount(): number {
    if (this.editor) {
      const model = this.editor.getModel();
      return model ? model.getValueLength() : 0;
    } else if (this.fallbackTextarea) {
      return this.fallbackTextarea.value.length;
    }
    return 0;
  }

  // Algoritmo de formatação SQL
  private formatSQL(sql: string): string {
    if (!sql.trim()) return '';

    let formatted = sql.trim();

    // Converter keywords para uppercase
    const keywords = [
      'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'OUTER JOIN',
      'ON', 'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'IS', 'NULL',
      'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'UNION ALL',
      'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'CREATE',
      'TABLE', 'ALTER', 'DROP', 'INDEX', 'VIEW', 'TRIGGER', 'PROCEDURE',
      'FUNCTION', 'DATABASE', 'USE', 'SHOW', 'DESCRIBE', 'EXPLAIN',
      'BEGIN', 'COMMIT', 'ROLLBACK', 'TRANSACTION', 'GRANT', 'REVOKE'
    ];

    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword.replace(/ /g, '\\s+')}\\b`, 'gi');
      formatted = formatted.replace(regex, keyword);
    });

    // Adicionar quebras de linha
    formatted = formatted
      .replace(/\b(SELECT|FROM|WHERE|JOIN|GROUP BY|ORDER BY|HAVING|LIMIT|UNION)\b/gi, '\n$1')
      .replace(/,/g, ',\n  ')
      .replace(/\b(ON|AND|OR)\b/gi, '\n  $1')
      .replace(/\b(INNER JOIN|LEFT JOIN|RIGHT JOIN|OUTER JOIN)\b/gi, '\n$1');

    // Indentar
    const lines = formatted.split('\n');
    let indent = 0;
    const resultLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Ajustar indentação
      if (trimmed.match(/^(FROM|WHERE|GROUP BY|ORDER BY|HAVING|LIMIT|UNION)/)) {
        indent = 0;
      }

      const indentedLine = '  '.repeat(indent) + trimmed;
      resultLines.push(indentedLine);

      // Aumentar indentação após SELECT
      if (trimmed.match(/^SELECT/)) {
        indent = 1;
      }
    }

    return resultLines.join('\n');
  }
}
