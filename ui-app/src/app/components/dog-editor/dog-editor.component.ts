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
    <div
      class="editor-wrapper dog-node-card"
      [class.dog-node-card--serialized]="!!dog.codeTs">
      <div #editorContainer class="editor-container"></div>
    </div>
  `,
  styleUrls: ['../../styles/dog-node-card.scss', './dog-editor.component.scss'],
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
    const ret = this.dog.vmExpectedReturnTypeName ?? 'any';
    return `async function run(): Promise<${ret}> {\n${unwrapped}\n}`;
  }

  private readonly RUN_SIGNATURE = /^async function run\(\)(?:\s*:\s*Promise<[^>]*>)?\s*\{/;

  private unwrapCode(code: string): string {
    let trimmed = code.trim();
    while (this.RUN_SIGNATURE.test(trimmed)) {
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

    if (!this.dog.codeTs) {
      this.editor?.dispose();
      this.editor = null;
      this.extraLib?.dispose();
      this.extraLib = null;
      return;
    }

    const content = this.wrapCode(this.dog.codeTs);

    if (this.editor) {
      const model = this.editor.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, 'typescript');
        model.setValue(content);
      }
    } else {
      this.editor = monaco.editor.create(this.containerRef.nativeElement, {
        value: content,
        language: 'typescript',
        theme: 'vs-dark',
        minimap: { enabled: false },
        automaticLayout: true,
        scrollBeyondLastLine: false,
        fontSize: 13,
        readOnly: false,
      });
    }

    this.editor.updateOptions({ readOnly: false });

    this.extraLib?.dispose();
    if (this.dog.vmContextTypeDef) {
      this.extraLib = monaco.languages.typescript.typescriptDefaults.addExtraLib(
        this.dog.vmContextTypeDef,
        `ts:context/${this.dog.id}.d.ts`
      );
    }
  }
}
