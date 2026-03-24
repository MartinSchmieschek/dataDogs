/**
 * Zentrale URLs — Embeds frei wählbar (Watch-URL → /embed/VIDEO_ID?autoplay=1).
 * Fehler: https://www.youtube.com/watch?v=Lr30oQoKeIo
 * Loading-Iris: https://www.youtube.com/watch?v=4PQlsyjEJSA
 */
export const COMFORT_VIDEO_EMBED_URL =
  'https://www.youtube.com/embed/Lr30oQoKeIo?autoplay=1';

export const LOADING_EASTER_EGG_EMBED_URL =
  'https://www.youtube.com/embed/4PQlsyjEJSA?autoplay=1';

/** Optionale Texte — leer/weg lassen, um Bereiche im Dialog auszublenden. */
export interface VideoPopupConfig {
  embedUrl: string;
  variant?: 'error' | 'void';
  headLabel?: string;
  heading?: string;
  message?: string;
  videoCaption?: string;
  /** Kino-Untertitel nur bei {@link variant} `'void'` (mehrere Zeilen). */
  voidSubtitleLines?: string[];
}
