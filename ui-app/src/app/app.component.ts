import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ErrorVideoPopupComponent } from './components/error-video-popup/error-video-popup.component';
import { AuthBadgeComponent } from './components/auth-badge/auth-badge.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ErrorVideoPopupComponent, AuthBadgeComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {}
