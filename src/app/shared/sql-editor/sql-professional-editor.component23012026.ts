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
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as monaco from 'monaco-editor';

@Component({
  selector: 'app-sql-professional-editor',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="sql-editor-root">
      <div class="editor-toolbar">
        <button
          class="toolbar-btn"
          (click)="indentCode()">
          🧱 Re-identar código
        </button>
      </div>

      <div #editorContainer class="editor-container"></div>
    </div>
  `,
  styles: [`
    .sql-editor-root {
      width: 100%;
      height: 100%;
      background: #1e1e1e; /* Ajustado para bater com o tema Dark do Monaco */
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
    .toolbar-btn:hover {
      background: #1177bb;
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

  private editor!: monaco.editor.IStandaloneCodeEditor;
  private model!: monaco.editor.ITextModel;
  private isApplyingIndent = false;

  ngAfterViewInit(): void {
    // 1️⃣ Configura a Linguagem PL/SQL e o Tema ANTES de criar o editor
    this.setupSyntaxHighlighting();

    // 2️⃣ Cria o model usando a nova linguagem 'plsql-custom'
    this.model = monaco.editor.createModel(this.value || '', 'plsql-custom');

    // 3️⃣ Cria o editor usando o novo tema 'plsql-dark-theme'
    this.editor = monaco.editor.create(this.editorContainer.nativeElement, {
      model: this.model,
      theme: 'plsql-dark-theme', // Usa nosso tema customizado
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

    // 4️⃣ Event Listeners
    this.model.onDidChangeContent(() => {
      if (this.isApplyingIndent) return;
      const val = this.model.getValue();
      this.value = val;
      this.valueChange.emit(val);
    });

    this.editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      () => this.execute.emit(this.model.getValue())
    );

    // Formata na carga inicial se houver valor
    if (this.value && this.value.trim()) {
      this.indentCode();
    }
  }

  /**
   * 🎨 Configura Highlight de Sintaxe PL/SQL e Cores
   * Define Loop/If como Roxo e Select/From como Azul
   */
  private setupSyntaxHighlighting(): void {
    // Registra uma nova linguagem chamada 'plsql-custom'
    monaco.languages.register({ id: 'plsql-custom' });

    // Define as regras de tokenização (RegEx para identificar palavras)
    monaco.languages.setMonarchTokensProvider('plsql-custom', {
      ignoreCase: true,

      // Palavras de Controle de Fluxo (Roxo/Rosa)
      controlKeywords: [
        'LOOP', 'END', 'IF', 'THEN', 'ELSE', 'ELSIF', 'CASE', 'WHEN',
        'BEGIN', 'DECLARE', 'EXCEPTION', 'WHILE', 'FOR', 'REVERSE',
        'EXIT', 'CONTINUE', 'GOTO', 'RETURN', 'COMMIT', 'ROLLBACK', 'PRAGMA'
      ],

      // Palavras de Dados SQL (Azul)
      sqlKeywords: [
        'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE',
        'INTO', 'VALUES', 'SET', 'GROUP', 'ORDER', 'BY', 'HAVING',
        'DISTINCT', 'AS', 'IN', 'IS', 'ON', 'UNION', 'ALL', 'JOIN',
        'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS', 'AND', 'OR', 'NOT',
        'NULL', 'LIKE', 'BETWEEN', 'EXISTS'
      ],

      // Funções e Tipos (Amarelo/Laranja)
      builtinFunctions: [
        'TRUNC', 'NVL', 'TO_DATE', 'TO_CHAR', 'SYSDATE', 'COUNT', 'SUM',
        'MAX', 'MIN', 'AVG', 'DECODE', 'SUBSTR', 'LENGTH', 'UPPER', 'LOWER',
        'NUMBER', 'VARCHAR2', 'DATE', 'INTEGER', 'BOOLEAN'
      ],

      tokenizer: {
        root: [
          // Identifica as palavras definidas acima
          [/[a-zA-Z_]\w*/, {
            cases: {
              '@controlKeywords': 'keyword.control', // Token específico para controle
              '@sqlKeywords': 'keyword.sql',         // Token específico para SQL padrão
              '@builtinFunctions': 'predefined',     // Token para funções
              '@default': 'identifier'
            }
          }],

          // Números
          [/\d+/, 'number'],

          // Strings
          [/'[^']*'/, 'string'],

          // Comentários
          [/--.*$/, 'comment'],
        ]
      }
    });

    // Define o Tema de Cores
    monaco.editor.defineTheme('plsql-dark-theme', {
      base: 'vs-dark',
      inherit: true, // Herda do tema Dark padrão
      rules: [
        // CONTROLE DE FLUXO (LOOP, IF, END) -> ROXO (Estilo VS Code)
        { token: 'keyword.control', foreground: 'C586C0', fontStyle: 'bold' },

        // SQL PADRÃO (SELECT, FROM) -> AZUL
        { token: 'keyword.sql', foreground: '569CD6', fontStyle: 'bold' },

        // FUNÇÕES E TIPOS -> AMARELO CLARO
        { token: 'predefined', foreground: 'DCDCAA' },

        // IDENTIFICADORES (Nomes de tabelas/colunas) -> BRANCO/CINZA CLARO
        { token: 'identifier', foreground: '9CDCFE' },

        // STRINGS -> LARANJA
        { token: 'string', foreground: 'CE9178' },

        // COMENTÁRIOS -> VERDE
        { token: 'comment', foreground: '6A9955' },

        // NÚMEROS -> VERDE CLARO
        { token: 'number', foreground: 'B5CEA8' }
      ],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.lineHighlightBackground': '#2d2d30'
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.editor) return;

    if (changes['value']) {
      const incomingValue = changes['value'].currentValue || '';
      const currentValue = this.model.getValue();

      if (incomingValue !== currentValue) {
        this.model.setValue(incomingValue);
        if (incomingValue.trim()) {
           this.indentCode();
        }
      }
    }

    if (changes['readonly']) {
      this.editor.updateOptions({ readOnly: this.readonly });
    }
  }

  public indentCode(): void {
    if (!this.model) return;
    this.isApplyingIndent = true;
    let sql = this.model.getValue();

    if (!sql || !sql.trim()) {
      this.isApplyingIndent = false;
      return;
    }

    sql = this.formatPlSql(sql);
    this.model.setValue(sql);
    this.isApplyingIndent = false;
  }

  // --- MANTIDA A MESMA LÓGICA DE FORMATAÇÃO ANTERIOR ---
  private formatPlSql(sql: string): string {
    let text = this.preserveCommentsAndBreaks(sql);

    // Proteção de Tokens
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

    // Uppercase
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

    // Breakers
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

    // Indent AND/OR
    text = text
      .replace(/([^\n])\s*\bAND\b/g, '$1\n  AND')
      .replace(/([^\n])\s*\bOR\b/g, '$1\n  OR');

    // Split Lines
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

  // 🔹 QUEBRA DE LINHA APÓS BEGIN (correção solicitada)
  result = result.replace(/\bBEGIN\b\s*/gi, 'BEGIN\n');

  // 🔹 QUEBRA DE LINHA APÓS ; (correção solicitada)
  result = result.replace(/;\s*/g, ';\n');

  // Remove quebras duplicadas
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
