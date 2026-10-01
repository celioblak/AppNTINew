import { Component, EventEmitter, inject, Input, Output, forwardRef } from '@angular/core';
import { FormsModule, NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { CodeEditor } from '@acrodata/code-editor';
import { languages } from './language-data';
import { NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';

import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';

import { CodeEditorFormatService } from './code-editor-format.service';

@Component({
  selector: 'code-editor-app',
  standalone: true,
  imports: [FormsModule, CodeEditor, CommonModule], // adiciona CommonModule
  template: `
    <div class="editor-container">

      <code-editor
        [(ngModel)]="value"
        [languages]="languages"
        [disabled]="readonly"
        [extensions]="editorExtensions"
        [language]="language"
        (ngModelChange)="onValueChange($event)">
      </code-editor>

      <div *ngIf="enableFormat" class="toolbar">
        <button mat-raised-button color="primary" (click)="formatCode()">
          Formatar Código
        </button>
      </div>

    </div>
  `,
  styles: [`
    .editor-container {
      height: 100%;
      width: 100%;
      display: flex;
      flex-direction: column;
    }

    code-editor {
      flex: 1;
      width: 100%;
      min-height: 0;
    }

    .toolbar {
      padding-top: 8px;
      text-align: right;
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CodeEditorComponent),
      multi: true
    }
  ]
})
export class CodeEditorComponent implements ControlValueAccessor {

  @Input() value: string = '';
  @Input() language: string = 'plsql';
  @Input() readonly: boolean = false;
  @Input() enableFormat: boolean = true;
  @Output() valueChange = new EventEmitter<string>();

  languages = languages;

  private formatter = inject(CodeEditorFormatService);
  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  private onTouched: () => void = () => {};
  private onChanged: (value: string) => void = () => {};

  editorExtensions = [
    oneDark,
    EditorView.lineWrapping,
    EditorView.theme({
      "&": { height: "100%" },
      ".cm-scroller": { overflow: "auto" }
    })
  ];

  // ==========================
  // ControlValueAccessor
  // ==========================
  writeValue(value: string): void {
  this.zone.run(() => {
    this.value = value || '';
    this.onChanged(this.value);
    this.valueChange.emit(this.value);
    this.cdr.detectChanges();
  });
}

  registerOnChange(fn: any): void {
    this.onChanged = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.readonly = isDisabled;
  }

  // ==========================
  // Detecta mudanças no editor
  // ==========================
  onValueChange(newValue: string) {
    this.value = newValue;
    this.onChanged(this.value);
    this.valueChange.emit(this.value);
  }

  // ==========================
  // Formata código
  // ==========================
  async formatCode() {
    const formatted = await this.formatter.format(this.value, this.language);
    this.value = formatted;

    // Força Angular refresh
    this.cdr.detectChanges();

    // Atualiza ControlValueAccessor e EventEmitter
    this.onChanged(this.value);
    this.valueChange.emit(this.value);
  }

}
