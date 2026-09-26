import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SdVoidCinemaComponent } from './components/sd-void-cinema/sd-void-cinema.component';
import { AuthBadgeComponent } from './components/auth-badge/auth-badge.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SdVoidCinemaComponent, AuthBadgeComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {}
