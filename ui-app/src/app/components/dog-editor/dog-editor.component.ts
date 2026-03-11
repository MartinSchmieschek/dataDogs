import {
  Component, Input,
  ElementRef, ViewChild, OnChanges, OnDestroy, SimpleChanges
} from '@angular/core';
import { DogEntry } from '../../models/dog-entry.model';

declare const monaco: any;

@Component({
  selector: 'app-dog-editor',
  standalone: true,
  template: `
    <div class="editor-wrapper">
      <div #editorContainer class="editor-container"></div>
    </div>
  `,
  styles: [`
    .editor-wrapper { display: flex; flex-direction: column; height: 100%; }
    .editor-container { flex: 1; min-height: 300px; }
  `]
})
export class DogEditorComponent implements OnChanges, OnDestroy {
  @ViewChild('editorContainer', { static: true }) containerRef!: ElementRef;

  @Input() dog!: DogEntry;

  private editor: any = null;
  private extraLib: any = null;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['dog'] && this.dog) {
      this.initOrUpdateEditor();
    }
  }

  ngOnDestroy() {
    this.editor?.dispose();
    this.extraLib?.dispose();
  }

  getCurrentCode(): string | null {
    if (!this.editor) return null;
    return this.unwrapCode(this.editor.getValue());
  }

  private wrapCode(rawCode: string): string {
    const unwrapped = this.unwrapCode(rawCode);
    return 'async function run() {\n' + unwrapped + '\n}';
  }

  private unwrapCode(code: string): string {
    let trimmed = code.trim();
    while (trimmed.startsWith('async function run() {')) {
      let depth = 0;
      const startPos = trimmed.indexOf('{');
      if (startPos === -1) break;
      for (let i = startPos; i < trimmed.length; i++) {
        if (trimmed[i] === '{') depth++;
        if (trimmed[i] === '}') depth--;
        if (depth === 0) {
          if (i === trimmed.length - 1) {
            trimmed = trimmed.substring(startPos + 1, i).trim();
          } else {
            break;
          }
          break;
        }
      }
      if (depth !== 0) break;
    }
    return trimmed;
  }

  private initOrUpdateEditor() {
    if (typeof monaco === 'undefined') return;

    const isSerialized = !!this.dog.codeTs;
    const content = isSerialized
      ? this.wrapCode(this.dog.codeTs!)
      : JSON.stringify(this.dog.result, null, 2);
    const language = isSerialized ? 'typescript' : 'json';

    if (this.editor) {
      const model = this.editor.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, language);
        model.setValue(content);
      }
    } else {
      this.editor = monaco.editor.create(this.containerRef.nativeElement, {
        value: content,
        language,
        theme: 'vs-dark',
        minimap: { enabled: false },
        automaticLayout: true,
        scrollBeyondLastLine: false,
        fontSize: 13,
        readOnly: !isSerialized,
      });
    }

    this.editor.updateOptions({ readOnly: !isSerialized });

    this.extraLib?.dispose();
    if (this.dog.vmContextTypeDef) {
      this.extraLib = monaco.languages.typescript.typescriptDefaults.addExtraLib(
        this.dog.vmContextTypeDef,
        `ts:context/${this.dog.id}.d.ts`
      );
    }
  }
}
