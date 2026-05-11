import {
  AfterViewInit, Component, ElementRef, EventEmitter,
  Input, OnDestroy, Output, signal, ViewChild,
} from '@angular/core';

declare const monaco: any;

/**
 * Monaco-based JSON editor with explicit format & validate actions.
 * Mounts inside any container — height controlled by host.
 *
 * The format button parses → stringifies (2-space indent) the buffer.
 * If JSON.parse throws, the lint-status indicates "invalid" with the parser message.
 */
@Component({
  selector: 'app-waves-json-editor',
  standalone: true,
  templateUrl: './waves-json-editor.component.html',
  styleUrls: ['./waves-json-editor.component.scss'],
})
export class WavesJsonEditorComponent implements AfterViewInit, OnDestroy {
  @Input() set value(v: string) {
    this._initialValue = v ?? '';
    if (this.editor) {
      const cur = this.editor.getValue();
      if (cur !== this._initialValue) this.editor.setValue(this._initialValue);
    }
    this.recomputeLint(this._initialValue);
  }
  get value(): string { return this._initialValue; }

  @Input() label: string = 'Body (JSON)';
  @Input() placeholder = '{}';
  @Input() minHeight = 200;

  @Output() valueChange = new EventEmitter<string>();

  @ViewChild('container', { static: true }) container!: ElementRef<HTMLElement>;

  readonly lintStatus = signal<'valid' | 'invalid' | 'empty'>('valid');
  readonly lintMessage = signal<string | null>(null);

  private editor: any = null;
  private _initialValue = '';
  private monacoReadyHandler: (() => void) | null = null;
  private suppressChange = false;

  ngAfterViewInit(): void {
    if (typeof monaco !== 'undefined') {
      this.mountEditor();
    } else {
      this.monacoReadyHandler = () => this.mountEditor();
      window.addEventListener('monaco-ready', this.monacoReadyHandler);
    }
  }

  ngOnDestroy(): void {
    if (this.monacoReadyHandler) {
      window.removeEventListener('monaco-ready', this.monacoReadyHandler);
    }
    this.editor?.dispose();
    this.editor = null;
  }

  /** Format the buffer — JSON.parse → stringify(parsed, null, 2). */
  format(): void {
    if (!this.editor) return;
    const raw = this.editor.getValue();
    if (!raw.trim()) return;
    try {
      const parsed = JSON.parse(raw);
      const formatted = JSON.stringify(parsed, null, 2);
      if (formatted !== raw) {
        this.suppressChange = true;
        this.editor.setValue(formatted);
        this.suppressChange = false;
        this._initialValue = formatted;
        this.valueChange.emit(formatted);
      }
      this.lintStatus.set('valid');
      this.lintMessage.set(null);
    } catch (e: any) {
      this.lintStatus.set('invalid');
      this.lintMessage.set(String(e?.message ?? e));
    }
  }

  /** Minify — reverse of format. */
  minify(): void {
    if (!this.editor) return;
    const raw = this.editor.getValue();
    if (!raw.trim()) return;
    try {
      const parsed = JSON.parse(raw);
      const minified = JSON.stringify(parsed);
      this.suppressChange = true;
      this.editor.setValue(minified);
      this.suppressChange = false;
      this._initialValue = minified;
      this.valueChange.emit(minified);
      this.lintStatus.set('valid');
      this.lintMessage.set(null);
    } catch (e: any) {
      this.lintStatus.set('invalid');
      this.lintMessage.set(String(e?.message ?? e));
    }
  }

  private mountEditor(): void {
    if (!this.container?.nativeElement) return;
    this.editor = monaco.editor.create(this.container.nativeElement, {
      value: this._initialValue || this.placeholder,
      language: 'json',
      theme: 'vs',
      minimap: { enabled: false },
      automaticLayout: true,
      scrollBeyondLastLine: false,
      fontSize: 13,
      lineNumbers: 'on',
      folding: true,
      tabSize: 2,
      formatOnPaste: true,
      formatOnType: false,
      wordWrap: 'on',
      scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
      renderLineHighlight: 'gutter',
      padding: { top: 8, bottom: 8 },
    });

    this.editor.onDidChangeModelContent(() => {
      if (this.suppressChange) return;
      const v = this.editor.getValue();
      this._initialValue = v;
      this.recomputeLint(v);
      this.valueChange.emit(v);
    });

    this.recomputeLint(this._initialValue);
  }

  private recomputeLint(raw: string): void {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) {
      this.lintStatus.set('empty');
      this.lintMessage.set(null);
      return;
    }
    try {
      JSON.parse(trimmed);
      this.lintStatus.set('valid');
      this.lintMessage.set(null);
    } catch (e: any) {
      this.lintStatus.set('invalid');
      this.lintMessage.set(String(e?.message ?? e));
    }
  }
}
