// sql-basic-editor.component.ts - Versão SUPER SIMPLES sem Monaco
import { Component, ViewChild, ElementRef, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-sql-basic-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="sql-basic-editor">
      <div class="editor-toolbar">
        <button (click)="formatCode()" title="Formatar SQL">
          🔧 Formatar
        </button>
        <button (click)="executeCode()" title="Executar SQL" class="execute-btn">
          ▶️ Executar
        </button>
        <button (click)="clearCode()" title="Limpar">
          🗑️ Limpar
        </button>

        <div class="toolbar-info">
          <small>Atalhos: Ctrl+Shift+F = Formatar | Ctrl+Enter = Executar</small>
        </div>
      </div>

      <textarea
        #textarea
        [(ngModel)]="code"
        (ngModelChange)="onCodeChange()"
        [readonly]="readonly"
        placeholder="Digite seu SQL aqui..."
        (keydown.control.shift.f)="formatCode(); $event.preventDefault()"
        (keydown.control.enter)="executeCode(); $event.preventDefault()"
      ></textarea>

      <div class="editor-status">
        <span>Linhas: {{ getLineCount() }}</span>
        <span>Caracteres: {{ getCharCount() }}</span>
      </div>
    </div>
  `,
  styles: [`
    .sql-basic-editor {
      display: flex;
      flex-direction: column;
      height: 100%;
      border: 1px solid #ccc;
      border-radius: 4px;
      overflow: hidden;
    }

    .editor-toolbar {
      padding: 8px;
      background: #f5f5f5;
      border-bottom: 1px solid #ddd;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }

    .editor-toolbar button {
      padding: 6px 12px;
      border: 1px solid #bbb;
      background: white;
      border-radius: 3px;
      cursor: pointer;
      font-size: 14px;
    }

    .editor-toolbar button:hover {
      background: #eee;
    }

    .execute-btn {
      background: #28a745 !important;
      color: white;
      border-color: #218838 !important;
    }

    .execute-btn:hover {
      background: #218838 !important;
    }

    .toolbar-info {
      margin-left: auto;
      color: #666;
    }

    textarea {
      flex: 1;
      padding: 12px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      border: none;
      resize: none;
      outline: none;
      background: #fafafa;
      line-height: 1.5;
    }

    textarea:focus {
      background: white;
    }

    textarea[readonly] {
      background: #f0f0f0;
    }

    .editor-status {
      padding: 4px 8px;
      background: #f5f5f5;
      border-top: 1px solid #ddd;
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #666;
    }
  `]
})
export class SqlBasicEditorComponent {
  @ViewChild('textarea') textarea!: ElementRef<HTMLTextAreaElement>;

  @Input()
  get value(): string {
    return this.code;
  }
  set value(val: string) {
    this.code = val;
  }

  @Input() readonly: boolean = false;

  @Output() valueChange = new EventEmitter<string>();
  @Output() execute = new EventEmitter<string>();

  code: string = '';

  onCodeChange() {
    this.valueChange.emit(this.code);
  }

  formatCode() {
    this.code = this.formatSQL(this.code);
    this.valueChange.emit(this.code);
  }

  executeCode() {
    if (this.code.trim()) {
      this.execute.emit(this.code);
    }
  }

  clearCode() {
    this.code = '';
    this.valueChange.emit('');
  }

  getLineCount(): number {
    return this.code.split('\n').length;
  }

  getCharCount(): number {
    return this.code.length;
  }

  private formatSQL(sql: string): string {
    if (!sql.trim()) return '';

    let formatted = sql.trim();

    // Palavras-chave para uppercase
    const keywords = [
      'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN',
      'ON', 'AND', 'OR', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT',
      'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM'
    ];

    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      formatted = formatted.replace(regex, keyword);
    });

    // Adicionar quebras de linha
    formatted = formatted
      .replace(/\b(SELECT|FROM|WHERE|JOIN|GROUP BY|ORDER BY|HAVING|LIMIT)\b/gi, '\n$1')
      .replace(/,/g, ',\n  ')
      .replace(/\b(ON|AND|OR)\b/gi, '\n  $1');

    // Indentar
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
