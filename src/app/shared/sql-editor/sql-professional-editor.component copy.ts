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
      <!-- Toolbar -->
      <div class="editor-toolbar">
        <button
          class="toolbar-btn"
          (click)="indentCode()">
          🧱 Identar código
        </button>
      </div>

      <!-- Editor -->
      <div #editorContainer class="editor-container"></div>
    </div>
  `,
  styles: [`
    .sql-editor-root {
      width: 100%;
      height: 100%;
      background: #0f172a;
      border: 1px solid #374151;
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .editor-toolbar {
      background: #1e293b;
      padding: 6px 10px;
      border-bottom: 1px solid #334155;
    }

    .toolbar-btn {
      background: #334155;
      border: none;
      border-radius: 6px;
      padding: 6px 12px;
      color: #e2e8f0;
      font-size: 13px;
      cursor: pointer;
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

  /** API mantida */
  @Input() value: string = '';
  @Input() readonly: boolean = false;

  @Output() valueChange = new EventEmitter<string>();
  @Output() execute = new EventEmitter<string>();

  private editor!: monaco.editor.IStandaloneCodeEditor;
  private model!: monaco.editor.ITextModel;

  private isApplyingIndent = false;

  private readonly PLSQL_KEYWORDS = [
  'DECLARE','BEGIN','END','EXCEPTION','WHEN','THEN','ELSE','ELSIF',
  'SELECT','INSERT','UPDATE','DELETE','MERGE','INTO','VALUES',
  'FROM','WHERE','JOIN','INNER','LEFT','RIGHT','FULL','OUTER','ON',
  'GROUP','BY','ORDER','HAVING','UNION','ALL','DISTINCT',
  'LOOP','FOR','WHILE','EXIT','CONTINUE','RETURN',
  'IF','CASE','NULL',
  'CURSOR','OPEN','FETCH','CLOSE',
  'RAISE','OTHERS',
  'CREATE','ALTER','DROP','TRUNCATE','REPLACE',
  'PACKAGE','BODY','PROCEDURE','FUNCTION','TRIGGER','VIEW','TABLE',
  'SEQUENCE','INDEX',
  'NUMBER','VARCHAR2','CHAR','DATE','BOOLEAN','CLOB','BLOB',
  'COMMIT','ROLLBACK','SAVEPOINT',
  'GRANT','REVOKE',
  'IN','OUT','INOUT','IS','AS','LIKE','BETWEEN','AND','OR','NOT','EXISTS',
  'SET'
];




  ngAfterViewInit(): void {
    this.model = monaco.editor.createModel(this.value || '', 'sql');

    this.editor = monaco.editor.create(this.editorContainer.nativeElement, {
      model: this.model,
      theme: 'vs-dark',
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
      fontFamily: 'Consolas, Monaco, monospace',
      scrollBeyondLastLine: false
    });

    this.model.onDidChangeContent(() => {
      if (this.isApplyingIndent) return;

      const val = this.model.getValue();
      this.value = val;
      this.valueChange.emit(val);
    });

    // Ctrl + Enter
    this.editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      () => this.execute.emit(this.model.getValue())
    );
  }

private uppercasePlSql(code: string): string {
  let result = code;

  for (const kw of this.PLSQL_KEYWORDS) {
    const r = new RegExp(`\\b${kw}\\b`, 'gi');
    result = result.replace(r, kw);
  }

  return result;
}

private breakSqlLines(sql: string): string {
  const breaks = [
    'SELECT',
    'FROM',
    'WHERE',
    'SET',
    'INSERT INTO',
    'VALUES',
    'UPDATE',
    'DELETE FROM',
    'GROUP BY',
    'ORDER BY',
    'HAVING'
  ];

  breaks.forEach(k => {
    const r = new RegExp(`\\b${k}\\b`, 'g');
    sql = sql.replace(r, `\n${k}`);
  });

  sql = sql
    .replace(/\bAND\b/g, '\n  AND')
    .replace(/\bOR\b/g, '\n  OR');

  return sql;
}

private indentSql(sql: string): string {
  if (!sql || !sql.trim()) return sql;

  // ===============================
  // 1️⃣ NORMALIZAÇÃO BASE
  // ===============================
  let text = sql
    .replace(/\r\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // ===============================
  // 2️⃣ UPPERCASE SQL / PLSQL
  // ===============================
  const keywords = [
    'SELECT','DISTINCT','FROM','WHERE','AND','OR',
    'UPDATE','SET','INSERT INTO','VALUES','DELETE',
    'GROUP BY','ORDER BY','HAVING',
    'BEGIN','END','LOOP','IF','ELSE','ELSIF',
    'JOIN','LEFT JOIN','RIGHT JOIN','INNER JOIN','OUTER JOIN','ON'
  ];

  keywords.forEach(k => {
    const r = new RegExp(`\\b${k.replace(/ /g, '\\s+')}\\b`, 'gi');
    text = text.replace(r, k);
  });

  // ===============================
  // 3️⃣ QUEBRAS ESTRUTURAIS
  // ===============================
  const breakers = [
    'SELECT',
    'FROM',
    'WHERE',
    'GROUP BY',
    'ORDER BY',
    'HAVING',
    'UPDATE',
    'SET',
    'INSERT INTO',
    'VALUES',
    'DELETE'
  ];

  breakers.forEach(b => {
    const r = new RegExp(`\\b${b}\\b`, 'g');
    text = text.replace(r, `\n${b}`);
  });

  // AND / OR sempre abaixo
  text = text
    .replace(/\bAND\b/g, '\n  AND')
    .replace(/\bOR\b/g, '\n  OR');

  // ===============================
  // 4️⃣ SPLIT EM LINHAS
  // ===============================
  let lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const out: string[] = [];
  let mode: 'SELECT' | 'FROM' | 'SET' | 'WHERE' | null = null;

  // ===============================
  // 5️⃣ FORMATAÇÃO INTELIGENTE
  // ===============================
  for (let line of lines) {

    if (line.startsWith('SELECT')) {
      mode = 'SELECT';
      const body = line.replace(/^SELECT\s*/,'');
      const cols = body.split(',').map(c => c.trim()).filter(Boolean);

      out.push('SELECT ' + cols[0]);
      for (let i = 1; i < cols.length; i++) {
        out.push('  , ' + cols[i]);
      }
      continue;
    }

    if (line.startsWith('FROM')) {
      mode = 'FROM';
      const body = line.replace(/^FROM\s*/,'');
      const tabs = body.split(',').map(t => t.trim()).filter(Boolean);

      out.push('FROM ' + tabs[0]);
      for (let i = 1; i < tabs.length; i++) {
        out.push('  , ' + tabs[i]);
      }
      continue;
    }

    if (line.startsWith('SET')) {
      mode = 'SET';
      const body = line.replace(/^SET\s*/,'');
      const sets = body.split(',').map(s => s.trim()).filter(Boolean);

      out.push('SET ' + sets[0]);
      for (let i = 1; i < sets.length; i++) {
        out.push('  , ' + sets[i]);
      }
      continue;
    }

    if (line.startsWith('WHERE')) {
      mode = 'WHERE';
      out.push('WHERE ' + line.replace(/^WHERE\s*/,''));
      continue;
    }

    if (mode === 'WHERE' && (line.startsWith('AND') || line.startsWith('OR'))) {
      out.push('  ' + line);
      continue;
    }

    out.push(line);
  }

  return out.join('\n');
}



private splitCommaList(line: string): string[] {
  return line
    .split(',')
    .map(v => v.trim())
    .filter(v => v.length > 0);
}



ngOnChanges(changes: SimpleChanges): void {
    if (!this.editor) return;

    if (
      changes['value'] &&
      changes['value'].currentValue !== this.model.getValue()
    ) {
      this.model.setValue(changes['value'].currentValue || '');
       this.indentCode();
    }

    if (changes['readonly']) {
      this.editor.updateOptions({ readOnly: this.readonly });
    }
  }

  /**
   * 🧱 Identação SEGURA
   * - NÃO reconstrói SQL
   * - NÃO remove linhas
   * - NÃO normaliza espaços
   * - NÃO move comandos
   */
public indentCode(): void {
  if (!this.model) return;

  this.isApplyingIndent = true;

  let sql = this.model.getValue();
  if (!sql.trim()) {
    this.isApplyingIndent = false;
    return;
  }

  // 1️⃣ Uppercase
  sql = this.uppercasePlSql(sql);

  // 2️⃣ Quebra de linhas
  sql = this.breakSqlLines(sql);

  // 3️⃣ Remove múltiplas linhas vazias
  sql = sql.replace(/\n\s*\n+/g, '\n').trim();

  // 4️⃣ Indentação
  sql = this.indentSql(sql);

  this.model.setValue(sql);

  this.isApplyingIndent = false;
}


ngOnDestroy(): void {
    this.editor?.dispose();
    this.model?.dispose();
  }
}
