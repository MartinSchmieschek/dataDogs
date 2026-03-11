import { Component } from '@angular/core';

@Component({
  selector: 'app-loading-indicator',
  standalone: true,
  template: `
    <div class="loading-overlay">
      <div class="spinner"></div>
    </div>
  `,
  styles: [`
    .loading-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid #333;
      border-top-color: #0066cc;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class LoadingIndicatorComponent {}
