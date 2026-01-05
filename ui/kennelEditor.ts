import { buildKennelConfigEditor } from './components/kennelConfig';
import { buildKennelConfigHandler } from './scripts/kennelConfigHandler';
import { buildHead } from './layout/head';
import { buildStyles } from './layout/styles';

/**
 * Erstellt die HTML-Seite für den Kennel-Editor
 */
export class KennelEditor {
  public static buildEditorPage(kennelId: string, kennelConfig?: any): string {
    const kennelConfigJson = kennelConfig ? JSON.stringify(kennelConfig).replace(/<\/script>/gi, "<\\/script>") : 'null';
    
    return `
<!DOCTYPE html>
<html lang="de">
<head>
${buildHead()}
${buildStyles()}
<style>
  body {
    font-family: 'Courier New', monospace;
    background: #000;
    color: #fff;
    margin: 0;
    padding: 20px;
  }
  .container {
    max-width: 1200px;
    margin: 0 auto;
  }
  h1 {
    color: #fff;
    border-bottom: 2px solid #333;
    padding-bottom: 10px;
  }
  .back-link {
    display: inline-block;
    margin-bottom: 20px;
    color: #0066cc;
    text-decoration: none;
  }
  .back-link:hover {
    color: #0099ff;
  }
  #kennel-config-editor {
    display: block !important;
  }
</style>
</head>
<body>
  <div class="container">
    <a href="/${kennelId}" class="back-link">← Zurück zum Kennel</a>
    <h1>Kennel Editor: ${kennelId}</h1>
    ${buildKennelConfigEditor()}
  </div>

  <script id="kennel-config-data" type="application/json">
${kennelConfigJson}
</script>

  <script>
${buildKennelConfigHandler()}
    
    // Lade Kennel-Config beim Laden der Seite
    document.addEventListener('DOMContentLoaded', () => {
      const kennelId = '${kennelId}';
      const idInput = document.getElementById('kennel-config-id');
      if (idInput) {
        idInput.value = kennelId;
      }
      
      // Lade Config
      if (typeof loadKennelConfig === 'function') {
        loadKennelConfig(kennelId);
      }
      
      // Lade verfügbare SerializedDogs
      if (typeof loadAvailableSerializedDogs === 'function') {
        loadAvailableSerializedDogs();
      }
    });
  </script>
</body>
</html>
    `;
  }
}

