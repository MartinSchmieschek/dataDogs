/**
 * Zwei getrennte Void-Kino-Videos (gleiches Overlay, andere Embeds).
 *
 * Fehler-Klick / „flashen“: https://www.youtube.com/watch?v=Lr30oQoKeIo
 * Ladebildschirm-Iris:         https://www.youtube.com/watch?v=4PQlsyjEJSA
 */
export const ERROR_FLASH_VIDEO_EMBED_URL =
  'https://www.youtube.com/embed/Lr30oQoKeIo?autoplay=1';

export const LOADING_EASTER_EGG_EMBED_URL =
  'https://www.youtube.com/embed/4PQlsyjEJSA?autoplay=1';

/** Konfiguration für das Void-Kino (ein gemeinsames Overlay). */
export interface VideoPopupConfig {
  embedUrl: string;
  headLabel?: string;
  /** Untertitel-Zeilen im Kino */
  voidSubtitleLines?: string[];
}
