import { Component, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { KennelService } from '../../services/kennel.service';
import { IKennelConfig } from '../../models/kennel-config.model';
import { KennelFormComponent, KennelFormData } from '../../components/kennel-form/kennel-form.component';
import { LoadingIndicatorComponent } from '../../components/loading-indicator/loading-indicator.component';
import { ErrorVideoPopupService } from '../../services/error-video-popup.service';

@Component({
  selector: 'app-kennel-list',
  standalone: true,
  imports: [RouterLink, KennelFormComponent, LoadingIndicatorComponent],
  templateUrl: './kennel-list.component.html',
  styleUrls: ['./kennel-list.component.scss']
})
export class KennelListComponent implements OnInit {
  private kennelService = inject(KennelService);
  private router = inject(Router);
  private errorVideoPopup = inject(ErrorVideoPopupService);

  kennels = signal<IKennelConfig[]>([]);
  loading = signal(false);
  showCreateForm = signal(false);
  error = signal<string | null>(null);

  ngOnInit() {
    this.loadKennels();
  }

  onComfortVideoClick(): void {
    this.errorVideoPopup.openPopup(this.error());
  }

  loadKennels() {
    this.loading.set(true);
    this.error.set(null);
    this.kennelService.getAll().subscribe({
      next: (res) => {
        this.kennels.set(res.data ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message);
        this.loading.set(false);
      }
    });
  }

  onCreateKennel(data: KennelFormData) {
    this.kennelService.create({ id: data.id, name: data.name, description: data.description, dogIds: [] }).subscribe({
      next: (res) => {
        if (res.ok) {
          this.router.navigate(['/kennel', data.id, 'edit']);
        }
      },
      error: (err) => {
        this.error.set(err.message);
      }
    });
  }

  getExecuteUrl(kennel: IKennelConfig): string {
    let url = `/api/kennels/${kennel.id}/execute`;
    if (kennel.defaultQuery) {
      const params = new URLSearchParams();
      Object.entries(kennel.defaultQuery).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      const qs = params.toString();
      if (qs) url += '?' + qs;
    }
    return url;
  }

  hasBody(kennel: IKennelConfig): boolean {
    return kennel.defaultBody !== null && kennel.defaultBody !== undefined;
  }

  executeWithBody(kennel: IKennelConfig) {
    const newWindow = window.open('about:blank', '_blank');
    if (!newWindow) return;

    let url = `/api/kennels/${kennel.id}/execute`;
    if (kennel.defaultQuery) {
      const params = new URLSearchParams();
      Object.entries(kennel.defaultQuery).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      const qs = params.toString();
      if (qs) url += '?' + qs;
    }

    this.kennelService.execute(kennel.id, kennel.defaultBody, kennel.defaultQuery).subscribe({
      next: (result) => {
        if (typeof result === 'string') {
          newWindow.document.write(result);
          newWindow.document.close();
        } else {
          newWindow.document.write('<pre>' + JSON.stringify(result, null, 2) + '</pre>');
          newWindow.document.close();
        }
      },
      error: () => {
        newWindow.close();
      }
    });
  }
}
