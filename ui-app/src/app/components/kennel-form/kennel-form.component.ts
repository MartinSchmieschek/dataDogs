import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface KennelFormData {
  id: string;
  name: string;
  description: string;
}

@Component({
  selector: 'app-kennel-form',
  standalone: true,
  imports: [FormsModule],
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
          <label for="kennel-desc">Description</label>
          <textarea id="kennel-desc" [(ngModel)]="formData.description" name="description" placeholder="Optional" rows="3"></textarea>
        </div>
        @if (error) {
          <div class="error">{{ error }}</div>
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
  `]
})
export class KennelFormComponent {
  @Output() submitted = new EventEmitter<KennelFormData>();
  @Output() cancelled = new EventEmitter<void>();

  formData: KennelFormData = { id: '', name: '', description: '' };
  error = '';

  onSubmit() {
    if (!this.formData.id.trim()) {
      this.error = 'Kennel ID ist erforderlich';
      return;
    }
    this.error = '';
    this.submitted.emit({ ...this.formData });
  }
}
