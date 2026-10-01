import { LanguageSupport, LanguageDescription, StreamParser, StreamLanguage } from "@codemirror/language";
import { sql, StandardSQL, PostgreSQL, MySQL, SQLite, MSSQL, Cassandra, PLSQL } from "@codemirror/lang-sql";

function legacy(parser: StreamParser<unknown>): LanguageSupport {
  return new LanguageSupport(StreamLanguage.define(parser));
}

/// An array of language descriptions for known language packages.
export const languages = [
  // New-style language modes
  LanguageDescription.of({
    name: "C",
    extensions: ["c", "h", "ino"],
    load() {
      return import("@codemirror/lang-cpp").then(m => m.cpp());
    }
  }),
  LanguageDescription.of({
    name: "C++",
    alias: ["cpp"],
    extensions: ["cpp", "c++", "cc", "cxx", "hpp", "h++", "hh", "hxx"],
    load() {
      return import("@codemirror/lang-cpp").then(m => m.cpp());
    }
  }),
  LanguageDescription.of({
    name: "CQL",
    alias: ["cassandra"],
    extensions: ["cql"],
    load() {
      return Promise.resolve(sql({ dialect: Cassandra }));
    }
  }),
  LanguageDescription.of({
    name: "CSS",
    extensions: ["css"],
    load() {
      return import("@codemirror/lang-css").then(m => m.css());
    }
  }),
  LanguageDescription.of({
    name: "Go",
    extensions: ["go"],
    load() {
      return import("@codemirror/legacy-modes/mode/go").then(m => legacy(m.go));
    }
  }),
  LanguageDescription.of({
    name: "HTML",
    alias: ["xhtml"],
    extensions: ["html", "htm", "handlebars", "hbs"],
    load() {
      return import("@codemirror/lang-html").then(m => m.html());
    }
  }),
  LanguageDescription.of({
    name: "Java",
    extensions: ["java"],
    load() {
      return import("@codemirror/lang-java").then(m => m.java());
    }
  }),
  LanguageDescription.of({
    name: "JavaScript",
    alias: ["ecmascript", "js", "node"],
    extensions: ["js", "mjs", "cjs"],
    load() {
      return import("@codemirror/lang-javascript").then(m => m.javascript());
    }
  }),
  LanguageDescription.of({
    name: "Jinja",
    extensions: ["j2", "jinja", "jinja2"],
    load() {
      return import("@codemirror/legacy-modes/mode/jinja2").then(m => legacy(m.jinja2));
    }
  }),
  LanguageDescription.of({
    name: "JSON",
    alias: ["json5"],
    extensions: ["json", "map"],
    load() {
      return import("@codemirror/lang-json").then(m => m.json());
    }
  }),
  LanguageDescription.of({
    name: "JSX",
    extensions: ["jsx"],
    load() {
      return import("@codemirror/lang-javascript").then(m => m.javascript({ jsx: true }));
    }
  }),
  LanguageDescription.of({
    name: "LESS",
    extensions: ["less"],
    load() {
      return import("@codemirror/lang-less").then(m => m.less());
    }
  }),
  LanguageDescription.of({
    name: "Liquid",
    extensions: ["liquid"],
    load() {
      return import("@codemirror/lang-liquid").then(m => m.liquid());
    }
  }),

  LanguageDescription.of({
    name: "MariaDB SQL",
    load() {
      return Promise.resolve(sql({ dialect: MySQL })); // MariaDB usa o dialeto MySQL
    }
  }),

  LanguageDescription.of({
    name: "Markdown",
    extensions: ["md", "markdown", "mkd"],
    load() {
      return import("@codemirror/lang-markdown").then(m => m.markdown());
    }
  }),

  LanguageDescription.of({
    name: "MS SQL",
    load() {
      return Promise.resolve(sql({ dialect: MSSQL }));
    }
  }),

  LanguageDescription.of({
    name: "MySQL",
    load() {
      return Promise.resolve(sql({ dialect: MySQL }));
    }
  }),

  LanguageDescription.of({
    name: "PHP",
    extensions: ["php", "php3", "php4", "php5", "php7", "phtml"],
    load() {
      return import("@codemirror/lang-php").then(m => m.php());
    }
  }),

  LanguageDescription.of({
    name: "PLSQL",
    extensions: ["pls"],
    load() {
      return Promise.resolve(sql({ dialect: PLSQL }));
    }
  }),

  LanguageDescription.of({
    name: "PostgreSQL",
    load() {
      return Promise.resolve(sql({ dialect: PostgreSQL }));
    }
  }),

  LanguageDescription.of({
    name: "Python",
    extensions: ["BUILD", "bzl", "py", "pyw"],
    filename: /^(BUCK|BUILD)$/,
    load() {
      return import("@codemirror/lang-python").then(m => m.python());
    }
  }),

  LanguageDescription.of({
    name: "Rust",
    extensions: ["rs"],
    load() {
      return import("@codemirror/lang-rust").then(m => m.rust());
    }
  }),

  LanguageDescription.of({
    name: "Sass",
    extensions: ["sass"],
    load() {
      return import("@codemirror/legacy-modes/mode/sass").then(m => legacy(m.sass));  // sem ( { indented: true } )
    }
  }),

  LanguageDescription.of({
    name: "SCSS",
    extensions: ["scss"],
    load() {
      return import("@codemirror/legacy-modes/mode/sass").then(m => legacy(m.sass));
    }
  }),

  LanguageDescription.of({
    name: "SQL",
    extensions: ["sql"],
    load() {
      return Promise.resolve(sql({ dialect: StandardSQL }));
    }
  }),

  LanguageDescription.of({
    name: "SQLite",
    load() {
      return Promise.resolve(sql({ dialect: SQLite }));
    }
  }),

  LanguageDescription.of({
    name: "TSX",
    extensions: ["tsx"],
    load() {
      return import("@codemirror/lang-javascript").then(m => m.javascript({ jsx: true, typescript: true }));
    }
  }),

  LanguageDescription.of({
    name: "TypeScript",
    alias: ["ts"],
    extensions: ["ts", "mts", "cts"],
    load() {
      return import("@codemirror/lang-javascript").then(m => m.javascript({ typescript: true }));
    }
  }),

  LanguageDescription.of({
    name: "WebAssembly",
    extensions: ["wat", "wast"],
    load() {
      return import("@codemirror/lang-wast").then(m => m.wast());
    }
  }),

  LanguageDescription.of({
    name: "XML",
    alias: ["rss", "wsdl", "xsd"],
    extensions: ["xml", "xsl", "xsd", "svg"],
    load() {
      return import("@codemirror/lang-xml").then(m => m.xml());
    }
  }),

  LanguageDescription.of({
    name: "YAML",
    alias: ["yml"],
    extensions: ["yaml", "yml"],
    load() {
      return import("@codemirror/lang-yaml").then(m => m.yaml());
    }
  }),

  // Legacy modes ported from CodeMirror 5
  // (mantenha o resto do seu código original aqui – não alterei)

  LanguageDescription.of({
    name: "Vue",
    extensions: ["vue"],
    load() {
      return import("@codemirror/lang-vue").then(m => m.vue());
    }
  }),

  LanguageDescription.of({
    name: "Angular Template",
    load() {
      return import("@codemirror/lang-angular").then(m => m.angular());
    }
  })
];
