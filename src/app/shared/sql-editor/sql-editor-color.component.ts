// sql-color-editor.component.ts - Sem dependências externas
import { Component, ElementRef, ViewChild, Input, Output, EventEmitter, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-sql-color-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="sql-color-editor">
      <div class="editor-header">
        <button (click)="formatCode()">🔧 Formatar</button>
        <button (click)="executeCode()" class="execute-btn">▶️ Executar</button>
        <button (click)="toggleTheme()">{{ isDarkTheme ? '🌞' : '🌙' }} Tema</button>
      </div>

      <div class="editor-body">
        <div class="line-numbers">
          <span *ngFor="let line of getLines()">{{ line }}</span>
        </div>

        <div class="code-editor" (click)="focusTextarea()">
          <!-- Highlight overlay -->
          <div class="highlight-overlay" #highlightOverlay [innerHTML]="getHighlightedCode()"></div>

          <!-- Textarea para edição -->
          <textarea
            #textarea
            [(ngModel)]="value"
            (ngModelChange)="onCodeChange()"
            [readonly]="readonly"
            (scroll)="syncScroll($event)"
            (keydown)="handleKeydown($event)"
            spellcheck="false"
          ></textarea>
        </div>
      </div>

      <div class="editor-footer">
        <span>Linhas: {{ getLineCount() }}</span>
        <span>SQL Editor Profissional</span>
      </div>
    </div>
  `,
  styles: [`
    .sql-color-editor {
      height: 100%;
      border: 1px solid #ccc;
      border-radius: 4px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: white;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 14px;
    }

    .sql-color-editor.dark {
      background: #1e1e1e;
      border-color: #333;
    }

    .editor-header {
      padding: 8px;
      background: #f5f5f5;
      border-bottom: 1px solid #ddd;
      display: flex;
      gap: 8px;
    }

    .dark .editor-header {
      background: #252526;
      border-color: #333;
    }

    .editor-header button {
      padding: 6px 12px;
      border: 1px solid #ccc;
      background: white;
      border-radius: 3px;
      cursor: pointer;
      font-family: inherit;
    }

    .dark .editor-header button {
      background: #3c3c3c;
      border-color: #555;
      color: #ccc;
    }

    .execute-btn {
      background: #4CAF50 !important;
      color: white !important;
      border-color: #45a049 !important;
    }

    .editor-body {
      flex: 1;
      display: flex;
      overflow: hidden;
      position: relative;
    }

    .line-numbers {
      width: 50px;
      background: #f9f9f9;
      border-right: 1px solid #ddd;
      padding: 8px 4px;
      text-align: right;
      color: #666;
      font-size: 13px;
      line-height: 1.5;
      user-select: none;
      overflow: hidden;
    }

    .dark .line-numbers {
      background: #2d2d30;
      border-color: #333;
      color: #858585;
    }

    .line-numbers span {
      display: block;
      height: 21px;
    }

    .code-editor {
      flex: 1;
      position: relative;
      overflow: auto;
    }

    .highlight-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 8px;
      font-family: inherit;
      font-size: inherit;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
      pointer-events: none;
      color: transparent;
      tab-size: 2;
    }

    textarea {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      padding: 8px;
      margin: 0;
      border: none;
      background: transparent;
      font-family: inherit;
      font-size: inherit;
      line-height: 1.5;
      color: transparent;
      caret-color: #333;
      resize: none;
      outline: none;
      tab-size: 2;
      white-space: pre;
      overflow: auto;
    }

    .dark textarea {
      caret-color: #fff;
    }

    /* Syntax highlighting styles */
    .sql-keyword {
      color: #0000ff;
      font-weight: bold;
    }

    .dark .sql-keyword {
      color: #569cd6;
    }

    .sql-function {
      color: #795e26;
    }

    .dark .sql-function {
      color: #dcdcaa;
    }

    .sql-string {
      color: #a31515;
    }

    .dark .sql-string {
      color: #ce9178;
    }

    .sql-number {
      color: #098658;
    }

    .dark .sql-number {
      color: #b5cea8;
    }

    .sql-comment {
      color: #008000;
      font-style: italic;
    }

    .dark .sql-comment {
      color: #6a9955;
    }

    .sql-operator {
      color: #000000;
    }

    .dark .sql-operator {
      color: #d4d4d4;
    }

    .editor-footer {
      padding: 4px 8px;
      background: #f5f5f5;
      border-top: 1px solid #ddd;
      font-size: 12px;
      color: #666;
      display: flex;
      justify-content: space-between;
    }

    .dark .editor-footer {
      background: #252526;
      border-color: #333;
      color: #858585;
    }
  `]
})
export class SqlColorEditorComponent implements AfterViewInit {
  @ViewChild('textarea') textarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('highlightOverlay') highlightOverlay!: ElementRef<HTMLDivElement>;

  @Input() value: string = '';
  @Input() readonly: boolean = false;

  @Output() valueChange = new EventEmitter<string>();
  @Output() execute = new EventEmitter<string>();

  isDarkTheme = false;

  ngAfterViewInit() {
    this.syncScroll();
  }

  onCodeChange() {
    this.valueChange.emit(this.value);
  }

  formatCode() {
    this.value = this.formatSQL(this.value);
    this.valueChange.emit(this.value);
  }

  executeCode() {
    this.execute.emit(this.value);
  }

  toggleTheme() {
    this.isDarkTheme = !this.isDarkTheme;
  }

  focusTextarea() {
    this.textarea.nativeElement.focus();
  }

  syncScroll(event?: Event) {
    const textarea = this.textarea.nativeElement;
    const overlay = this.highlightOverlay.nativeElement;
    overlay.scrollTop = textarea.scrollTop;
    overlay.scrollLeft = textarea.scrollLeft;
  }

  handleKeydown(event: KeyboardEvent) {
    if (event.ctrlKey && event.shiftKey && event.key === 'F') {
      event.preventDefault();
      this.formatCode();
    }

    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault();
      this.executeCode();
    }
  }

  getLines(): number[] {
    const lines = this.value.split('\n').length;
    return Array.from({ length: Math.max(1, lines) }, (_, i) => i + 1);
  }

  getLineCount(): number {
    return this.getLines().length;
  }

  getHighlightedCode(): string {
    if (!this.value) return '';

    let html = this.value;

    // Palavras-chave SQL
    const keywords = [
      'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER',
      'ON', 'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'IS', 'NULL',
      'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'UNION',
      'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE',
      'TABLE', 'ALTER', 'DROP', 'INDEX', 'VIEW', 'TRIGGER'
    ];

    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b(${keyword})\\b`, 'gi');
      html = html.replace(regex, '<span class="sql-keyword">$1</span>');
    });

    // Funções
    const functions = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CONCAT', 'SUBSTRING'];
    functions.forEach(func => {
      const regex = new RegExp(`\\b(${func})\\b\\(`, 'gi');
      html = html.replace(regex, '<span class="sql-function">$1</span>(');
    });

    // Strings (entre aspas simples)
    html = html.replace(/'([^']*)'/g, '<span class="sql-string">\'$1\'</span>');

    // Números
    html = html.replace(/\b(\d+)\b/g, '<span class="sql-number">$1</span>');

    // Comentários
    html = html.replace(/--(.*)$/gm, '<span class="sql-comment">--$1</span>');
    html = html.replace(/\/\*([\s\S]*?)\*\//g, '<span class="sql-comment">/*$1*/</span>');

    // Operadores
    const operators = ['=', '>', '<', '>=', '<=', '<>', '!=', '+', '-', '*', '/'];
    operators.forEach(op => {
      const regex = new RegExp(`\\${op}`, 'g');
      html = html.replace(regex, `<span class="sql-operator">${op}</span>`);
    });

    // Preservar quebras de linha e espaços
    html = html.replace(/\n/g, '<br>');
    html = html.replace(/ /g, '&nbsp;');
    html = html.replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');

    return html;
  }

  private formatSQL(sql: string): string {
    // Mesmo algoritmo de formatação anterior
    if (!sql.trim()) return '';

    let formatted = sql.trim();

    const keywords = [
      'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN',
      'ON', 'AND', 'OR', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT',
      'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM'
    ];

    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      formatted = formatted.replace(regex, keyword);
    });

    formatted = formatted
      .replace(/\b(SELECT|FROM|WHERE|JOIN|GROUP BY|ORDER BY|HAVING|LIMIT)\b/gi, '\n$1')
      .replace(/,/g, ',\n  ')
      .replace(/\b(ON|AND|OR)\b/gi, '\n  $1');

    const lines = formatted.split('\n');
    let indent = 0;
    const result = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';

      if (trimmed.match(/^(FROM|WHERE|GROUP BY|ORDER BY|HAVING|LIMIT)/)) {
        indent = 0;
      }

      const indented = '  '.repeat(indent) + trimmed;

      if (trimmed.match(/^SELECT/)) {
        indent = 1;
      }

      return indented;
    }).filter(line => line).join('\n');

    return result;
  }
}
