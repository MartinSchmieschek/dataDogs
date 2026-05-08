import { Component, EventEmitter, Output, inject } from '@angular/core';
import { kennelDisplayNameBlockedReason, kennelLineageIdBlockedReason } from '../../config/kennel-reserved-names';
import { ErrorVideoPopupService } from '../../services/error-video-popup.service';
import { FormsModule } from '@angular/forms';
import { KennelEmojiPickerComponent } from '../kennel-emoji-picker/kennel-emoji-picker.component';

export interface KennelFormData {
  id: string;
  name: string;
  description: string;
  /** Ein Emoji (optional) */
  emoji: string;
  visibility: 'public' | 'private';
}

@Component({
  selector: 'app-kennel-form',
  standalone: true,
  imports: [FormsModule, KennelEmojiPickerComponent],
  template: `
    <div class="kennel-form">
      <h2>Neuen Kennel erstellen</h2>
      <form (ngSubmit)="onSubmit()">
        <div class="form-group">
          <label for="kennel-id">Kennel ID *</label>
          <input id="kennel-id" [(ngModel)]="formData.id" name="id" required placeholder="z.B. my-kennel">
        </div>
        <div class="form-group">
          <label for="kennel-name">Name</label>
          <input id="kennel-name" [(ngModel)]="formData.name" name="name" placeholder="Optional">
        </div>
        <div class="form-group">
          <label>Emoji (optional)</label>
          <app-kennel-emoji-picker [(emoji)]="formData.emoji" />
        </div>
        <div class="form-group">
          <label for="kennel-desc">Description</label>
          <textarea id="kennel-desc" [(ngModel)]="formData.description" name="description" placeholder="Optional" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label>Sichtbarkeit</label>
          <div class="visibility-row">
            <label class="visibility-option">
              <input type="radio" name="visibility" value="private" [(ngModel)]="formData.visibility" />
              <span>🔒 Private</span>
            </label>
            <label class="visibility-option">
              <input type="radio" name="visibility" value="public" [(ngModel)]="formData.visibility" />
              <span>🌐 Public</span>
            </label>
          </div>
          <small class="hint-line">Public — jeder kann lesen und ausführen. Private — nur Owner, Editors und Viewers.</small>
        </div>
        @if (error) {
          <div
            class="error comfort-error-trigger"
            role="button"
            tabindex="0"
            title="Klick: Fernes Signal"
            (click)="onComfortVideoClick()"
            (keydown.enter)="onComfortVideoClick()"
            (keydown.space)="$event.preventDefault(); onComfortVideoClick()">{{ error }}</div>
        }
        <div class="actions">
          <button type="submit" class="btn-primary">Erstellen</button>
          <button type="button" class="btn-secondary" (click)="cancelled.emit()">Abbrechen</button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .kennel-form {
      padding: 20px;
      border: 1px solid #333;
      background: #1a1a1a;
      border-radius: 5px;
      margin-top: 20px;
    }
    h2 { margin-top: 0; }
    .form-group {
      margin-bottom: 15px;
    }
    label {
      display: block;
      margin-bottom: 5px;
      color: #ccc;
    }
    input, textarea {
      width: 100%;
      padding: 8px;
      background: #000;
      color: #fff;
      border: 1px solid #333;
      font-family: 'Courier New', monospace;
      box-sizing: border-box;
    }
    textarea { resize: vertical; }
    .error {
      color: #f00;
      margin-bottom: 10px;
    }
    .actions {
      display: flex;
      gap: 10px;
    }
    .btn-primary, .btn-secondary {
      padding: 10px 20px;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      color: #fff;
    }
    .btn-primary { background: #00cc00; }
    .btn-primary:hover { background: #00ff00; }
    .btn-secondary { background: #666; }
    .btn-secondary:hover { background: #888; }
    .visibility-row { display: flex; gap: 12px; }
    .visibility-option {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border: 1px solid #333;
      border-radius: 6px;
      cursor: pointer;
      color: #ccc;
      background: #000;
    }
    .visibility-option input { width: auto; }
    .hint-line { display: block; margin-top: 6px; color: #888; font-size: 12px; }
  `]
})
export class KennelFormComponent {
  private errorVideoPopup = inject(ErrorVideoPopupService);

  @Output() submitted = new EventEmitter<KennelFormData>();
  @Output() cancelled = new EventEmitter<void>();

  formData: KennelFormData = { id: '', name: '', description: '', emoji: '', visibility: 'private' };
  error = '';

  onComfortVideoClick(): void {
    this.errorVideoPopup.openPopup(this.error);
  }

  onSubmit() {
    if (!this.formData.id.trim()) {
      this.error = 'Kennel ID ist erforderlich';
      return;
    }
    const idErr = kennelLineageIdBlockedReason(this.formData.id);
    if (idErr) {
      this.error = idErr;
      return;
    }
    if (this.formData.name.trim()) {
      const nameErr = kennelDisplayNameBlockedReason(this.formData.name);
      if (nameErr) {
        this.error = nameErr;
        return;
      }
    }
    this.error = '';
    this.submitted.emit({
      ...this.formData,
      emoji: this.formData.emoji.trim(),
    });
  }
}
