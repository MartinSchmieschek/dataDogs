/**
 * Detaillierte Laufzeit-Logs (Configs, Cache-Treffer, TRACK-Zugriffe, fillKennel-Schritte).
 *
 * Standard: **aus** in allen Umgebungen (auch development).
 * Einschalten: `DATADOGS_LOG_LEVEL=verbose` oder `DATADOGS_VERBOSE=1`.
 * Erzwingen leise: `DATADOGS_LOG_LEVEL=quiet` oder `DATADOGS_QUIET=1`.
 */
export function isRuntimeLogVerbose(): boolean {
    const level = (process.env.DATADOGS_LOG_LEVEL || '').toLowerCase().trim();
    if (level === 'verbose' || level === 'debug') return true;
    if (level === 'quiet' || level === 'minimal') return false;
    if (process.env.DATADOGS_VERBOSE === '1') return true;
    if (process.env.DATADOGS_QUIET === '1') return false;
    return false;
}
