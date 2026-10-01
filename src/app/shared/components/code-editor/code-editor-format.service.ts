import { Injectable } from '@angular/core';
import { format as formatSQL } from 'sql-formatter';

import prettier from 'prettier/standalone';

import parserBabel from 'prettier/plugins/babel';
import parserTypescript from 'prettier/plugins/typescript';
import parserHtml from 'prettier/plugins/html';
import parserPostcss from 'prettier/plugins/postcss';
import parserMarkdown from 'prettier/plugins/markdown';
import parserYaml from 'prettier/plugins/yaml';
import parserGraphql from 'prettier/plugins/graphql';


// ✅ Extrai tipo REAL da lib instalada
type SqlDialect = NonNullable<
  Parameters<typeof formatSQL>[1]
>['language'];


@Injectable({ providedIn: 'root' })
export class CodeEditorFormatService {

  private sqlLanguages: SqlDialect[] = [
    'sql',
    'plsql',
    'postgresql',
    'mysql',
    'mariadb',
    'sqlite',
    'bigquery',
    'snowflake'
  ];

  private prettierPlugins = [
    parserBabel,
    parserTypescript,
    parserHtml,
    parserPostcss,
    parserMarkdown,
    parserYaml,
    parserGraphql
  ];

  async format(code: string, language: string): Promise<string> {

    if (!code?.trim()) return code;

    const lang = language.toLowerCase();

    try {

      // ===== SQL =====
      if (this.sqlLanguages.includes(lang as SqlDialect) || lang === 'oracle') {

        const dialect = this.resolveSqlDialect(lang);

        return formatSQL(code, {
          language: dialect,
          tabWidth: 2,
          keywordCase: 'upper'
        });

      }

      // ===== Prettier =====
      return await prettier.format(code, {
        parser: this.resolveParser(lang),
        plugins: this.prettierPlugins,
        tabWidth: 2,
        semi: true,
        singleQuote: true
      });

    } catch (e) {

      console.error('Formatter error:', e);
      return code;

    }
  }


  private resolveSqlDialect(lang: string): SqlDialect {

    const map: Record<string, SqlDialect> = {
      oracle: 'plsql',
      plsql: 'plsql',
      postgres: 'postgresql',
      postgresql: 'postgresql',
      mysql: 'mysql',
      mariadb: 'mariadb',
      sqlite: 'sqlite'
    };

    return map[lang] || 'sql';
  }


  private resolveParser(lang: string): string {

    const map: Record<string, string> = {
      js: 'babel',
      javascript: 'babel',
      ts: 'typescript',
      typescript: 'typescript',
      json: 'json',
      html: 'html',
      css: 'css',
      scss: 'scss',
      markdown: 'markdown',
      yaml: 'yaml'
    };

    return map[lang] || 'babel';
  }

}
