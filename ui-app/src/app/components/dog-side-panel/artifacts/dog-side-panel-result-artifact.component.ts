import {
  Component,
  Input,
  signal,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  SimpleChanges,
  OnChanges,
} from '@angular/core';
import { EditSectionComponent } from '../../edit-section/edit-section.component';

declare const monaco: any;

@Component({
  selector: 'app-dog-side-panel-result-artifact',
  standalone: true,
  imports: [EditSectionComponent],
  template: `
    <app-edit-section title="Result">
      @if (resultIsHtml) {
        <div class="result-toolbar">
          <button type="button" class="btn-view-mode" (click)="cycleResultView()">{{ resultViewLabel() }}</button>
        </div>
      }
      @if (showHtmlPreview()) {
        <iframe class="result-html-frame"
          [srcdoc]="resultHtmlSrc"
          sandbox="allow-scripts"
          referrerpolicy="no-referrer"></iframe>
      } @else {
        <div #monacoHost class="result-monaco-host"></div>
      }
    </app-edit-section>
  `,
  styleUrls: ['./dog-side-panel-result-artifact.component.scss'],
})
export class DogSidePanelResultArtifactComponent implements AfterViewInit, OnDestroy, OnChanges {
  @Input() result: unknown;

  @ViewChild('monacoHost') monacoHost?: ElementRef<HTMLDivElement>;

  resultViewMode = signal<'auto' | 'html' | 'raw'>('auto');

  private editor: any = null;

  private readonly onMonacoReady = () => this.scheduleSyncMonaco();

  ngAfterViewInit() {
    window.addEventListener('monaco-ready', this.onMonacoReady);
    this.scheduleSyncMonaco();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['result']) {
      this.scheduleSyncMonaco();
    }
  }

  ngOnDestroy() {
    window.removeEventListener('monaco-ready', this.onMonacoReady);
    this.disposeEditor();
  }

  get resultIsHtml(): boolean {
    const r = this.result;
    if (typeof r !== 'string') return false;
    const trimmed = r.trim();
    return (
      trimmed.startsWith('<html') ||
      trimmed.startsWith('<!DOCTYPE') ||
      trimmed.startsWith('<!doctype') ||
      (trimmed.startsWith('<') && trimmed.includes('</'))
    );
  }

  get resultHtmlSrc(): string {
    if (!this.resultIsHtml) return '';
    return this.result as string;
  }

  showHtmlPreview(): boolean {
    const mode = this.resultViewMode();
    if (mode === 'html') return true;
    if (mode === 'raw') return false;
    return this.resultIsHtml;
  }

  cycleResultView(): void {
    const current = this.resultViewMode();
    if (current === 'auto') this.resultViewMode.set('raw');
    else if (current === 'raw') this.resultViewMode.set('html');
    else this.resultViewMode.set('auto');
    this.scheduleSyncMonaco();
  }

  resultViewLabel(): string {
    const mode = this.resultViewMode();
    if (mode === 'raw') return 'Raw';
    if (mode === 'html') return 'HTML';
    return 'Auto';
  }

  private scheduleSyncMonaco() {
    queueMicrotask(() => {
      setTimeout(() => this.syncMonaco(), 0);
    });
  }

  private disposeEditor() {
    this.editor?.dispose();
    this.editor = null;
  }

  private syncMonaco() {
    if (typeof monaco === 'undefined') return;

    if (this.showHtmlPreview()) {
      this.disposeEditor();
      return;
    }

    const host = this.monacoHost?.nativeElement;
    if (!host) return;

    const value = this.formatResultText();
    const language = this.resultLanguage();

    if (this.editor) {
      const model = this.editor.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, language);
        model.setValue(value);
      }
    } else {
      this.editor = monaco.editor.create(host, {
        value,
        language,
        theme: 'vs-dark',
        readOnly: true,
        minimap: { enabled: false },
        automaticLayout: true,
        scrollBeyondLastLine: false,
        fontSize: 13,
        wordWrap: 'on',
      });
    }
  }

  private resultLanguage(): string {
    const r = this.result;
    if (r !== null && typeof r === 'object') return 'json';
    return 'plaintext';
  }

  private formatResultText(): string {
    const r = this.result;
    if (r === undefined) return '// (kein Ergebnis)';
    if (r !== null && typeof r === 'object') {
      try {
        return JSON.stringify(r, null, 2);
      } catch {
        return String(r);
      }
    }
    if (typeof r === 'string') return r;
    return String(r);
  }
}
