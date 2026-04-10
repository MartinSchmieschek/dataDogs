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
import { isHtmlResultString, isMarkdownResultString } from '../../../utils/lead-result-string-format';

declare const monaco: any;

@Component({
  selector: 'app-dog-side-panel-result-artifact',
  standalone: true,
  imports: [EditSectionComponent],
  template: `
    <app-edit-section title="Result" [hideHeader]="hideHeader">
      @if (resultIsHtml || resultIsMarkdown) {
        <div class="result-toolbar">
          <button type="button" class="btn-view-mode" (click)="cycleResultView()">{{ resultViewLabel() }}</button>
        </div>
      }
      @if (showHtmlPreview()) {
        <iframe class="result-html-frame dog-node-card"
          [srcdoc]="resultHtmlSrc"
          sandbox="allow-scripts"
          referrerpolicy="no-referrer"></iframe>
      } @else {
        <div #monacoHost class="result-monaco-host dog-node-card"></div>
      }
    </app-edit-section>
  `,
  styleUrls: [
    '../../../styles/dog-node-card.scss',
    './dog-side-panel-result-artifact.component.scss',
  ],
})
export class DogSidePanelResultArtifactComponent implements AfterViewInit, OnDestroy, OnChanges {
  @Input() result: unknown;
  @Input() hideHeader = false;

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
    return typeof r === 'string' && isHtmlResultString(r);
  }

  get resultIsMarkdown(): boolean {
    const r = this.result;
    return typeof r === 'string' && isMarkdownResultString(r);
  }

  get resultHtmlSrc(): string {
    if (!this.resultIsHtml) return '';
    return this.result as string;
  }

  showHtmlPreview(): boolean {
    if (!this.resultIsHtml) return false;
    const mode = this.resultViewMode();
    if (mode === 'html') return true;
    if (mode === 'raw') return false;
    return true;
  }

  cycleResultView(): void {
    const current = this.resultViewMode();
    if (this.resultIsHtml) {
      if (current === 'auto') this.resultViewMode.set('raw');
      else if (current === 'raw') this.resultViewMode.set('html');
      else this.resultViewMode.set('auto');
    } else if (this.resultIsMarkdown) {
      this.resultViewMode.set(current === 'auto' ? 'raw' : 'auto');
    }
    this.scheduleSyncMonaco();
  }

  resultViewLabel(): string {
    const mode = this.resultViewMode();
    if (this.resultIsHtml) {
      if (mode === 'raw') return 'Raw';
      if (mode === 'html') return 'HTML';
      return 'Auto';
    }
    if (this.resultIsMarkdown) {
      return mode === 'raw' ? 'Raw' : 'Auto';
    }
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
    if (typeof r === 'string' && this.resultIsMarkdown) {
      return this.resultViewMode() === 'raw' ? 'plaintext' : 'markdown';
    }
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
