import { Injectable, signal } from '@angular/core';
import {
  COMFORT_VIDEO_EMBED_URL,
  LOADING_EASTER_EGG_EMBED_URL,
  type VideoPopupConfig,
} from '../data/video-popup';
import { VOID_PHILOSOPHY_LINES } from '../data/void-philosophy';

@Injectable({ providedIn: 'root' })
export class ErrorVideoPopupService {
  readonly open = signal(false);
  readonly variant = signal<'error' | 'void'>('error');
  readonly embedUrl = signal<string>(COMFORT_VIDEO_EMBED_URL);
  readonly headLabel = signal<string | undefined>(undefined);
  readonly heading = signal<string | undefined>(undefined);
  readonly message = signal<string | undefined>(undefined);
  readonly videoCaption = signal<string | undefined>(undefined);
  readonly voidSubtitleLines = signal<string[] | undefined>(undefined);

  /** Volle Kontrolle — z. B. später „fancy“-Varianten aus einem Theme. */
  openWithConfig(config: VideoPopupConfig): void {
    this.variant.set(config.variant ?? 'error');
    this.embedUrl.set(config.embedUrl);
    this.headLabel.set(config.headLabel);
    this.heading.set(config.heading);
    this.message.set(config.message);
    this.videoCaption.set(config.videoCaption);
    this.voidSubtitleLines.set(config.voidSubtitleLines);
    this.open.set(true);
  }

  openPopup(errorText?: string | null): void {
    this.openWithConfig({
      embedUrl: COMFORT_VIDEO_EMBED_URL,
      variant: 'error',
      headLabel: 'Fehler',
      heading: 'Fehlermeldung',
      message: (errorText ?? '').trim() || '(Kein Fehlertext)',
      videoCaption: 'Kurz ablenken',
    });
  }

  /** Ladebildschirm-Iris — eigenes Video, Texte standardmäßig aus (nur Kopfzeile). */
  openLoadingEasterEgg(): void {
    this.openWithConfig({
      embedUrl: LOADING_EASTER_EGG_EMBED_URL,
      variant: 'void',
      headLabel: 'Fernes Signal',
      voidSubtitleLines: [...VOID_PHILOSOPHY_LINES],
    });
  }

  closePopup(): void {
    this.open.set(false);
    this.reset();
  }

  private reset(): void {
    this.variant.set('error');
    this.embedUrl.set(COMFORT_VIDEO_EMBED_URL);
    this.headLabel.set(undefined);
    this.heading.set(undefined);
    this.message.set(undefined);
    this.videoCaption.set(undefined);
    this.voidSubtitleLines.set(undefined);
  }
}
