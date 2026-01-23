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

    this.editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      () => this.execute.emit(this.model.getValue())
    );
  }

  private uppercasePlSql(code: string): string {
    let result = code;

    // Primeiro proteger END IF e END LOOP como unidades únicas
    result = result.replace(/\bEND\s+IF\b/gi, 'END_IF');
    result = result.replace(/\bEND\s+LOOP\b/gi, 'END_LOOP');

    // Aplicar uppercase nas keywords
    for (const kw of this.PLSQL_KEYWORDS) {
      const r = new RegExp(`\\b${kw}\\b`, 'gi');
      result = result.replace(r, kw);
    }

    // Restaurar END IF e END LOOP com espaço
    result = result.replace(/\bEND_IF\b/g, 'END IF');
    result = result.replace(/\bEND_LOOP\b/g, 'END LOOP');

    return result;
  }

  /**
   * 🔧 Preserva comentários inline na MESMA linha
   */
  private preserveCommentsAndBreaks(sql: string): string {
    let result = sql;

    // 1️⃣ Normalizar quebras de linha
    result = result.replace(/\r\n/g, '\n');

    // 2️⃣ Processar linha por linha para preservar comentários inline
    const lines = result.split('\n');
    const processedLines: string[] = [];

    for (let line of lines) {
      // Se tem comentário inline
      const commentIndex = line.indexOf('--');

      if (commentIndex > 0) {
        // Tem código ANTES do comentário
        const beforeComment = line.substring(0, commentIndex).trim();
        const comment = line.substring(commentIndex).trim();

        // Marca o comentário para preservar
        processedLines.push(beforeComment + ' ___INLINE_COMMENT___' + comment);
      } else if (commentIndex === 0) {
        // Linha inteira é comentário
        processedLines.push(line.trim());
      } else {
        // Linha sem comentário
        processedLines.push(line.trim());
      }
    }

    result = processedLines.join(' ');

    // 3️⃣ Normalizar espaços múltiplos
    result = result.replace(/\s+/g, ' ').trim();

    // 4️⃣ Garantir quebra após ponto-e-vírgula
    result = result.replace(/;(\s*)(?=[a-zA-Z_])/g, ';\n');

    // 5️⃣ Restaurar comentários inline (na MESMA linha)
    result = result.replace(/\s*___INLINE_COMMENT___\s*/g, ' ');

    return result;
  }

  /**
   * 🎯 Indentação melhorada
   */
  private indentSql(sql: string): string {
    if (!sql || !sql.trim()) return sql;

    // 1️⃣ Preservar estrutura e comentários
    let text = this.preserveCommentsAndBreaks(sql);

    // 2️⃣ Proteger END IF e END LOOP antes do uppercase
    text = text.replace(/\bEND\s+IF\b/gi, 'END_IF');
    text = text.replace(/\bEND\s+LOOP\b/gi, 'END_LOOP');

    // 3️⃣ Uppercase de keywords compostas primeiro
    const compoundKeywords = [
      'INSERT INTO','LEFT JOIN','RIGHT JOIN','INNER JOIN','OUTER JOIN',
      'GROUP BY','ORDER BY','END_IF','END_LOOP'
    ];

    compoundKeywords.forEach(k => {
      const r = new RegExp(`\\b${k.replace(/ /g, '\\s+')}\\b`, 'gi');
      text = text.replace(r, k.replace(/_/g, ' '));
    });

    // 4️⃣ Uppercase de keywords simples
    const keywords = [
      'SELECT','DISTINCT','FROM','WHERE','AND','OR',
      'UPDATE','SET','VALUES','DELETE',
      'HAVING','BEGIN','END','LOOP','IF','ELSE','ELSIF','THEN',
      'DECLARE','CURSOR','IS','AS','ON','COMMIT','ROLLBACK'
    ];

    keywords.forEach(k => {
      const r = new RegExp(`\\b${k}\\b`, 'gi');
      text = text.replace(r, k);
    });

    // 5️⃣ Adicionar quebras antes de keywords estruturais
    const breakers = [
      'SELECT','FROM','WHERE','GROUP BY','ORDER BY','HAVING',
      'UPDATE','SET','INSERT INTO','VALUES','DELETE',
      'BEGIN','DECLARE','LOOP','IF','ELSE','ELSIF',
      'COMMIT','ROLLBACK','END IF','END LOOP'
    ];

    breakers.forEach(b => {
      const r = new RegExp(`([^\\n])\\s*\\b${b}\\b`, 'g');
      text = text.replace(r, `$1\n${b}`);
    });

    // 6️⃣ AND / OR com indent
    text = text
      .replace(/([^\n])\s*\bAND\b/g, '$1\n  AND')
      .replace(/([^\n])\s*\bOR\b/g, '$1\n  OR');

    // 7️⃣ Split e processar linhas
    let lines = text
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const out: string[] = [];
    let mode: 'SELECT' | 'FROM' | 'SET' | 'WHERE' | null = null;

    for (let line of lines) {
      // Comentários passam direto
      if (line.startsWith('--')) {
        out.push(line);
        continue;
      }

      // SELECT com colunas
      if (line.startsWith('SELECT')) {
        mode = 'SELECT';
        const body = line.replace(/^SELECT\s*/, '');
        const cols = this.splitCommaList(body);

        if (cols.length > 0) {
          out.push('SELECT ' + cols[0]);
          for (let i = 1; i < cols.length; i++) {
            out.push('  , ' + cols[i]);
          }
        } else {
          out.push(line);
        }
        continue;
      }

      // FROM com tabelas
      if (line.startsWith('FROM')) {
        mode = 'FROM';
        const body = line.replace(/^FROM\s*/, '');
        const tabs = this.splitCommaList(body);

        if (tabs.length > 0) {
          out.push('FROM ' + tabs[0]);
          for (let i = 1; i < tabs.length; i++) {
            out.push('  , ' + tabs[i]);
          }
        } else {
          out.push(line);
        }
        continue;
      }

      // SET com atribuições
      if (line.startsWith('SET')) {
        mode = 'SET';
        const body = line.replace(/^SET\s*/, '');
        const sets = this.splitCommaList(body);

        if (sets.length > 0) {
          out.push('SET ' + sets[0]);
          for (let i = 1; i < sets.length; i++) {
            out.push('  , ' + sets[i]);
          }
        } else {
          out.push(line);
        }
        continue;
      }

      // WHERE
      if (line.startsWith('WHERE')) {
        mode = 'WHERE';
        out.push('WHERE ' + line.replace(/^WHERE\s*/, ''));
        continue;
      }

      // AND / OR dentro de WHERE
      if (mode === 'WHERE' && (line.startsWith('AND') || line.startsWith('OR'))) {
        out.push('  ' + line);
        continue;
      }

      // Qualquer outra linha
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

    // 2️⃣ Indentação
    sql = this.indentSql(sql);

    // 3️⃣ Remove múltiplas linhas vazias
    sql = sql.replace(/\n\s*\n\s*\n+/g, '\n\n').trim();

    this.model.setValue(sql);
    this.isApplyingIndent = false;
  }

  ngOnDestroy(): void {
    this.editor?.dispose();
    this.model?.dispose();
  }
}
