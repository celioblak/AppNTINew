import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnChanges,
  SimpleChanges,
  OnDestroy,
  NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sql-professional-editor',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="sql-editor-root">
      <div class="editor-toolbar">
        <button
          class="toolbar-btn"
          (click)="indentCode()"
          [disabled]="!editorReady">
          🧱 Re-identar código
        </button>
        <span *ngIf="!editorReady" class="loading-text">Carregando editor...</span>
      </div>

      <div #editorContainer class="editor-container"></div>
    </div>
  `,
  styles: [`
    .sql-editor-root {
      width: 100%;
      height: 100%;
      background: #1e1e1e;
      border: 1px solid #374151;
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .editor-toolbar {
      background: #252526;
      padding: 6px 10px;
      border-bottom: 1px solid #333;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .toolbar-btn {
      background: #0e639c;
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      color: #ffffff;
      font-size: 13px;
      cursor: pointer;
      font-family: 'Segoe UI', sans-serif;
    }
    .toolbar-btn:hover:not(:disabled) {
      background: #1177bb;
    }
    .toolbar-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .loading-text {
      color: #888;
      font-size: 12px;
    }

    .editor-container {
      flex: 1;
      width: 100%;
    }
  `]
})
export class SqlProfessionalEditorComponent
  implements AfterViewInit, OnChanges, OnDestroy {

  @ViewChild('editorContainer', { static: true })
  editorContainer!: ElementRef<HTMLDivElement>;

  @Input() value: string = '';
  @Input() readonly: boolean = false;

  @Output() valueChange = new EventEmitter<string>();
  @Output() execute = new EventEmitter<string>();

  private editor: any;
  private monaco: any;
  private model: any;
  private isApplyingIndent = false;
  public editorReady = false;

  constructor(private ngZone: NgZone) {}

  async ngAfterViewInit(): Promise<void> {
    await this.loadMonacoEditor();
  }

  private async loadMonacoEditor(): Promise<void> {
    try {
      // Carrega Monaco via script tag
      if (!(window as any).monaco) {
        await this.loadMonacoScript();
      }

      this.monaco = (window as any).monaco;

      // Aguarda Monaco estar totalmente carregado
      await this.waitForMonaco();

      this.ngZone.run(() => {
        this.setupSyntaxHighlighting();
        this.initializeEditor();
      });
    } catch (error) {
      console.error('Erro ao carregar Monaco Editor:', error);
    }
  }

  private loadMonacoScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      const baseUrl = 'assets/monaco-editor/min/vs';

      // Configura o loader
      const loaderScript = document.createElement('script');
      loaderScript.src = `${baseUrl}/loader.js`;
      loaderScript.onload = () => {
        const require = (window as any).require;

        require.config({
          paths: { vs: baseUrl },
          'vs/nls': { availableLanguages: { '*': 'pt-br' } }
        });

        require(['vs/editor/editor.main'], () => {
          resolve();
        }, (error: any) => {
          reject(error);
        });
      };
      loaderScript.onerror = reject;
      document.head.appendChild(loaderScript);
    });
  }

  private waitForMonaco(): Promise<void> {
    return new Promise((resolve) => {
      const checkMonaco = () => {
        if ((window as any).monaco && (window as any).monaco.editor) {
          resolve();
        } else {
          setTimeout(checkMonaco, 50);
        }
      };
      checkMonaco();
    });
  }

  private setupSyntaxHighlighting(): void {
    if (!this.monaco) return;

    // Registra linguagem personalizada
    this.monaco.languages.register({ id: 'plsql-custom' });

    // Define tokens
    this.monaco.languages.setMonarchTokensProvider('plsql-custom', {
      ignoreCase: true,

      controlKeywords: [
        'LOOP', 'END', 'IF', 'THEN', 'ELSE', 'ELSIF', 'CASE', 'WHEN',
        'BEGIN', 'DECLARE', 'EXCEPTION', 'WHILE', 'FOR', 'REVERSE',
        'EXIT', 'CONTINUE', 'GOTO', 'RETURN', 'COMMIT', 'ROLLBACK', 'PRAGMA'
      ],

      sqlKeywords: [
        'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE',
        'INTO', 'VALUES', 'SET', 'GROUP', 'ORDER', 'BY', 'HAVING',
        'DISTINCT', 'AS', 'IN', 'IS', 'ON', 'UNION', 'ALL', 'JOIN',
        'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS', 'AND', 'OR', 'NOT',
        'NULL', 'LIKE', 'BETWEEN', 'EXISTS'
      ],

      builtinFunctions: [
        'TRUNC', 'NVL', 'TO_DATE', 'TO_CHAR', 'SYSDATE', 'COUNT', 'SUM',
        'MAX', 'MIN', 'AVG', 'DECODE', 'SUBSTR', 'LENGTH', 'UPPER', 'LOWER',
        'NUMBER', 'VARCHAR2', 'DATE', 'INTEGER', 'BOOLEAN'
      ],

      tokenizer: {
        root: [
          [/[a-zA-Z_]\w*/, {
            cases: {
              '@controlKeywords': 'keyword.control',
              '@sqlKeywords': 'keyword.sql',
              '@builtinFunctions': 'predefined',
              '@default': 'identifier'
            }
          }],
          [/\d+/, 'number'],
          [/'[^']*'/, 'string'],
          [/--.*$/, 'comment'],
        ]
      }
    });

    // Define tema
    this.monaco.editor.defineTheme('plsql-dark-theme', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword.control', foreground: 'C586C0', fontStyle: 'bold' },
        { token: 'keyword.sql', foreground: '569CD6', fontStyle: 'bold' },
        { token: 'predefined', foreground: 'DCDCAA' },
        { token: 'identifier', foreground: '9CDCFE' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'comment', foreground: '6A9955' },
        { token: 'number', foreground: 'B5CEA8' }
      ],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.lineHighlightBackground': '#2d2d30'
      }
    });
  }

  private initializeEditor(): void {
    // Cria o model
    this.model = this.monaco.editor.createModel(this.value || '', 'plsql-custom');

    // Cria o editor
    this.editor = this.monaco.editor.create(this.editorContainer.nativeElement, {
      model: this.model,
      theme: 'plsql-dark-theme',
      automaticLayout: true,
      readOnly: this.readonly,
      minimap: { enabled: false },
      wordWrap: 'off',
      scrollbar: {
        horizontal: 'visible',
        vertical: 'visible',
        alwaysConsumeMouseWheel: false
      },
      fontSize: 14,
      lineHeight: 22,
      fontFamily: 'Consolas, "Courier New", monospace',
      scrollBeyondLastLine: false,
      renderLineHighlight: 'all',
    });

    // Event Listeners
    this.model.onDidChangeContent(() => {
      if (this.isApplyingIndent) return;
      this.ngZone.run(() => {
        const val = this.model.getValue();
        this.value = val;
        this.valueChange.emit(val);
      });
    });

    this.editor.addCommand(
      this.monaco.KeyMod.CtrlCmd | this.monaco.KeyCode.Enter,
      () => {
        this.ngZone.run(() => {
          this.execute.emit(this.model.getValue());
        });
      }
    );

    this.editorReady = true;

    // Formata na carga inicial se houver valor
    if (this.value && this.value.trim()) {
      setTimeout(() => this.indentCode(), 200);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.editor || !this.model) return;

    if (changes['value']) {
      const incomingValue = changes['value'].currentValue || '';
      const currentValue = this.model.getValue();

      if (incomingValue !== currentValue) {
        this.model.setValue(incomingValue);
        if (incomingValue.trim()) {
          setTimeout(() => this.indentCode(), 100);
        }
      }
    }

    if (changes['readonly']) {
      this.editor.updateOptions({ readOnly: this.readonly });
    }
  }

  public indentCode(): void {
    if (!this.model || !this.editorReady) return;
    this.isApplyingIndent = true;
    let sql = this.model.getValue();

    if (!sql || !sql.trim()) {
      this.isApplyingIndent = false;
      return;
    }

    sql = this.formatPlSql(sql);
    this.model.setValue(sql);

    setTimeout(() => {
      this.isApplyingIndent = false;
    }, 100);
  }

  private formatPlSql(sql: string): string {
    let text = this.preserveCommentsAndBreaks(sql);

    const replacements: { [key: string]: string } = {
      'END IF': '___END_IF___',
      'END LOOP': '___END_LOOP___',
      'END CASE': '___END_CASE___',
      'INSERT INTO': '___INSERT_INTO___',
      'GROUP BY': '___GROUP_BY___',
      'ORDER BY': '___ORDER_BY___',
      'LEFT JOIN': '___LEFT_JOIN___',
      'RIGHT JOIN': '___RIGHT_JOIN___',
      'INNER JOIN': '___INNER_JOIN___',
      'OUTER JOIN': '___OUTER_JOIN___',
      'IS NOT NULL': '___IS_NOT_NULL___'
    };

    Object.keys(replacements).forEach(key => {
      const regex = new RegExp(`\\b${key.replace(/ /g, '\\s+')}\\b`, 'gi');
      text = text.replace(regex, replacements[key]);
    });

    const keywords = [
      'SELECT', 'DISTINCT', 'FROM', 'WHERE', 'AND', 'OR',
      'UPDATE', 'SET', 'VALUES', 'DELETE',
      'HAVING', 'BEGIN', 'END', 'LOOP', 'IF', 'ELSE', 'ELSIF', 'THEN',
      'DECLARE', 'CURSOR', 'IS', 'AS', 'ON', 'COMMIT', 'ROLLBACK', 'EXCEPTION',
      'TRUNC', 'NVL', 'TO_DATE', 'TO_CHAR', 'NUMBER', 'VARCHAR2', 'DATE',
      'EXIT', 'WHILE', 'FOR'
    ];

    keywords.forEach(k => {
      const r = new RegExp(`\\b${k}\\b`, 'gi');
      text = text.replace(r, k);
    });

    const breakers = [
      'SELECT', 'FROM', 'WHERE', '___GROUP_BY___', '___ORDER_BY___', 'HAVING',
      'UPDATE', 'SET', '___INSERT_INTO___', 'VALUES', 'DELETE',
      'BEGIN', 'DECLARE', 'LOOP', 'IF', 'ELSE', 'ELSIF', 'EXCEPTION',
      'COMMIT', 'ROLLBACK',
      '___END_IF___', '___END_LOOP___', '___END_CASE___'
    ];

    breakers.forEach(b => {
      const r = new RegExp(`([^\\n])\\s*\\b${b}\\b`, 'g');
      text = text.replace(r, `$1\n${b}`);
    });

    text = text
      .replace(/([^\n])\s*\bAND\b/g, '$1\n  AND')
      .replace(/([^\n])\s*\bOR\b/g, '$1\n  OR');

    let lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const out: string[] = [];

    for (let line of lines) {
      if (line.startsWith('--')) {
        out.push(line);
        continue;
      }

      let processedLine = line;
      Object.keys(replacements).forEach(key => {
        const token = replacements[key];
        const regex = new RegExp(token, 'g');
        processedLine = processedLine.replace(regex, key);
      });

      if (processedLine.startsWith('SELECT') ||
          processedLine.startsWith('SET') ||
          processedLine.startsWith('FROM') ||
          processedLine.startsWith('GROUP BY') ||
          processedLine.startsWith('ORDER BY')) {

        const firstSpace = processedLine.indexOf(' ');
        if (firstSpace > -1) {
          const keyword = processedLine.substring(0, firstSpace);
          const body = processedLine.substring(firstSpace + 1);
          const parts = this.splitCommaListSafe(body);

          if (parts.length > 0) {
            out.push(`${keyword} ${parts[0]}`);
            for (let i = 1; i < parts.length; i++) {
              out.push(`  , ${parts[i]}`);
            }
          } else {
            out.push(processedLine);
          }
        } else {
          out.push(processedLine);
        }
      } else {
        out.push(processedLine);
      }
    }

    return out.join('\n');
  }

  private preserveCommentsAndBreaks(sql: string): string {
    let result = sql.replace(/\r\n/g, '\n');
    const lines = result.split('\n');
    const processedLines: string[] = [];

    for (let line of lines) {
      const commentIndex = line.indexOf('--');
      if (commentIndex > 0) {
        const before = line.substring(0, commentIndex).trim();
        const comment = line.substring(commentIndex).trim();
        processedLines.push(before + ' ___INLINE_COMMENT___' + comment);
      } else {
        processedLines.push(line.trim());
      }
    }

    result = processedLines.join(' ');
    result = result.replace(/\s+/g, ' ').trim();
    result = result.replace(/\bBEGIN\b\s*/gi, 'BEGIN\n');
    result = result.replace(/;\s*/g, ';\n');
    result = result.replace(/\n\s*\n+/g, '\n');
    result = result.replace(/\s*___INLINE_COMMENT___\s*/g, ' ');

    return result;
  }

  private splitCommaListSafe(str: string): string[] {
    const results: string[] = [];
    let parenthesesLevel = 0;
    let currentChunk = '';

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (char === '(') parenthesesLevel++;
      if (char === ')') parenthesesLevel--;

      if (char === ',' && parenthesesLevel === 0) {
        results.push(currentChunk.trim());
        currentChunk = '';
      } else {
        currentChunk += char;
      }
    }
    if (currentChunk.trim()) {
      results.push(currentChunk.trim());
    }
    return results;
  }

  ngOnDestroy(): void {
    this.editor?.dispose();
    this.model?.dispose();
  }
}
