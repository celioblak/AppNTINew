import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-sql-text-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="sql-editor-wrapper" (click)="focusTextarea()">
      <div class="line-numbers">
        @for (line of lineNumbers; track line) {
          <span>{{line}}</span>
        }
      </div>
      <textarea #sqlTextarea
                [value]="value"
                (input)="onInput($event)"
                [readOnly]="readonly"
                (keydown)="onKeyDown($event)"
                spellcheck="false"
                autocorrect="off"
                autocapitalize="off"></textarea>
    </div>
  `,
  styles: [`
    .sql-editor-wrapper {
      position: relative;
      width: 100%;
      height: 100%;
      border: 1px solid #ddd;
      border-radius: 4px;
      overflow: hidden;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
      font-size: 14px;
      line-height: 1.5;
    }

    .line-numbers {
      position: absolute;
      left: 0;
      top: 0;
      width: 40px;
      height: 100%;
      background-color: #f5f5f5;
      border-right: 1px solid #ddd;
      color: #999;
      text-align: right;
      padding: 8px 4px;
      overflow: hidden;
      user-select: none;
      display: flex;
      flex-direction: column;
    }

    .line-numbers span {
      height: 1.5em;
      line-height: 1.5em;
    }

    textarea {
      position: absolute;
      left: 40px;
      top: 0;
      width: calc(100% - 40px);
      height: 100%;
      border: none;
      padding: 8px;
      margin: 0;
      background: transparent;
      color: #333;
      caret-color: #333;
      resize: none;
      font-family: inherit;
      font-size: inherit;
      line-height: inherit;
      white-space: pre;
      overflow: auto;
      tab-size: 2;
    }

    textarea:focus {
      outline: none;
    }

    textarea[readonly] {
      background-color: #f9f9f9;
      color: #666;
      cursor: not-allowed;
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SqlTextEditorComponent),
      multi: true
    }
  ]
})
export class SqlTextEditorComponent implements ControlValueAccessor {
  @ViewChild('sqlTextarea') textarea!: ElementRef<HTMLTextAreaElement>;

  @Input() value: string = '';
  @Input() readonly: boolean = false;

  @Output() valueChange = new EventEmitter<string>();

  lineNumbers: number[] = [1];

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  onInput(event: Event) {
    const newValue = (event.target as HTMLTextAreaElement).value;
    this.value = newValue;
    this.onChange(newValue);
    this.valueChange.emit(newValue);
    this.updateLineNumbers();
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Tab') {
      event.preventDefault();
      this.insertTab();
    }
  }

  focusTextarea() {
    if (this.textarea) {
      this.textarea.nativeElement.focus();
    }
  }

  private insertTab() {
    if (!this.textarea) return;

    const textarea = this.textarea.nativeElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // Insere 2 espaços no lugar do tab
    const newValue = this.value.substring(0, start) + '  ' + this.value.substring(end);
    this.value = newValue;
    this.onChange(newValue);
    this.valueChange.emit(newValue);

    // Move o cursor
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + 2;
      this.updateLineNumbers();
    });
  }

  private updateLineNumbers() {
    const lines = this.value.split('\n').length;
    this.lineNumbers = Array.from({ length: Math.max(1, lines) }, (_, i) => i + 1);
  }

  // ControlValueAccessor methods
  writeValue(value: string): void {
    this.value = value || '';
    this.updateLineNumbers();
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.readonly = isDisabled;
  }
}
