import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-edit-section',
  standalone: true,
  template: `
    <div class="edit-section">
      <div class="section-header" (click)="collapsed = !collapsed">
        <span class="toggle">{{ collapsed ? '▸' : '▾' }}</span>
        <span class="section-title">{{ title }}</span>
      </div>
      <div class="section-body" [class.hidden]="collapsed">
        <ng-content />
      </div>
    </div>
  `,
  styles: [`
    .edit-section {
      border: 1px solid #333;
      border-radius: 4px;
      margin-bottom: 8px;
      background: #0a0a0a;
      overflow: hidden;
    }
    .section-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      cursor: pointer;
      user-select: none;
      background: #111;
      &:hover { background: #1a1a1a; }
    }
    .toggle {
      font-size: 10px;
      color: #666;
      width: 12px;
    }
    .section-title {
      font-size: 12px;
      font-weight: bold;
      color: #ccc;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .section-body {
      padding: 12px;
      border-top: 1px solid #222;
    }
    .section-body.hidden {
      display: none;
    }
  `]
})
export class EditSectionComponent {
  @Input() title = '';
  @Input() collapsed = false;
}
