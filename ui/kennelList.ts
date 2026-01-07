/**
 * HTML-Generator für Kennel-Liste und Kennel-Detail-Seite
 */
export class KennelList {
  /**
   * Erstellt HTML für die Kennel-Liste
   */
  public static buildKennelListHtml(kennels: Array<{ id: string; name?: string; description?: string; defaultQuery?: Record<string, string>; defaultBody?: any }>): string {
    const kennelsHtml = kennels.length > 0
      ? kennels.map(kennel => {
          // Baue Query-String aus defaultQuery
          let queryString = '';
          if (kennel.defaultQuery) {
            const params = new URLSearchParams();
            for (const key in kennel.defaultQuery) {
              if (kennel.defaultQuery.hasOwnProperty(key)) {
                const value = kennel.defaultQuery[key];
                if (value !== null && value !== undefined && value !== '') {
                  params.append(key, String(value));
                }
              }
            }
            const paramString = params.toString();
            if (paramString) {
              queryString = '?' + paramString;
            }
          }
          
          // Ausführen-Link mit Query-Parametern
          const executeUrl = '/' + kennel.id + queryString;
          
          // Für POST mit Body: JavaScript-Funktion
          const hasBody = kennel.defaultBody !== null && kennel.defaultBody !== undefined;
          const bodyJson = hasBody ? JSON.stringify(kennel.defaultBody).replace(/'/g, "\\'") : '';
          // Query-Parameter als JavaScript-Objekt-Literal (nicht als JSON-String)
          let queryJson = '{}';
          if (kennel.defaultQuery && typeof kennel.defaultQuery === 'object' && Object.keys(kennel.defaultQuery).length > 0) {
            const queryPairs = Object.keys(kennel.defaultQuery).map(key => {
              const value = kennel.defaultQuery![key];
              const escapedKey = String(key).replace(/'/g, "\\'").replace(/"/g, '\\"');
              const escapedValue = String(value).replace(/'/g, "\\'").replace(/"/g, '\\"');
              return `"${escapedKey}": "${escapedValue}"`;
            });
            queryJson = '{' + queryPairs.join(', ') + '}';
          }
          const executeButton = hasBody 
            ? `<button onclick="executeKennelWithBody('${kennel.id}', ${bodyJson}, ${queryJson})" style="padding: 6px 12px; background: #0066cc; color: #fff; border: none; border-radius: 3px; font-size: 12px; cursor: pointer;">Ausführen (POST)</button>`
            : `<a href="${executeUrl}" style="padding: 6px 12px; background: #0066cc; color: #fff; text-decoration: none; border-radius: 3px; font-size: 12px;">Ausführen</a>`;
          
          const descriptionHtml = kennel.description ? `<div style="color: #ccc; margin-top: 5px;">${kennel.description}</div>` : '';
          
          return `
        <div style="padding: 15px; margin-bottom: 10px; border: 1px solid #333; background: #1a1a1a; border-radius: 5px;">
          <h3 style="margin: 0 0 5px 0;">
            <a href="${executeUrl}" style="color: #0066cc; text-decoration: none;">${kennel.name || kennel.id}</a>
          </h3>
          <div style="color: #999; font-size: 12px; margin-bottom: 5px;">ID: ${kennel.id}</div>
          ${descriptionHtml}
          <div style="margin-top: 10px; display: flex; gap: 10px;">
            ${executeButton}
            <a href="/edit/${kennel.id}" style="padding: 6px 12px; background: #666; color: #fff; text-decoration: none; border-radius: 3px; font-size: 12px;">Bearbeiten</a>
          </div>
        </div>
      `;
        }).join('')
      : '<div style="color: #666; text-align: center; padding: 40px;">Keine Kennels gefunden</div>';

    return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Kennel Liste</title>
  <style>
    body {
      font-family: 'Courier New', monospace;
      background: #000;
      color: #fff;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    h1 {
      color: #fff;
      border-bottom: 2px solid #333;
      padding-bottom: 10px;
    }
    .create-btn {
      display: inline-block;
      padding: 10px 20px;
      background: #00cc00;
      color: #fff;
      text-decoration: none;
      border-radius: 5px;
      margin-bottom: 20px;
    }
    .create-btn:hover {
      background: #00ff00;
    }
    a {
      color: #0066cc;
    }
    a:hover {
      color: #0099ff;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Kennel Liste</h1>
    <button id="create-kennel-btn" class="create-btn" style="border: none; cursor: pointer;">+ Neuen Kennel erstellen</button>
    <div id="create-kennel-form" style="display: none; margin-top: 20px; padding: 20px; border: 1px solid #333; background: #1a1a1a; border-radius: 5px;">
      <h2 style="margin-top: 0;">Neuen Kennel erstellen</h2>
      <form id="kennel-create-form">
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; color: #ccc;">Kennel ID *</label>
          <input type="text" id="kennel-id" name="id" required placeholder="z.B. my-kennel" style="width: 100%; padding: 8px; background: #000; color: #fff; border: 1px solid #333; font-family: 'Courier New', monospace; box-sizing: border-box;">
        </div>
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; color: #ccc;">Name</label>
          <input type="text" id="kennel-name" name="name" placeholder="Optional" style="width: 100%; padding: 8px; background: #000; color: #fff; border: 1px solid #333; font-family: 'Courier New', monospace; box-sizing: border-box;">
        </div>
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; color: #ccc;">Description</label>
          <textarea id="kennel-description" name="description" placeholder="Optional" rows="3" style="width: 100%; padding: 8px; background: #000; color: #fff; border: 1px solid #333; font-family: 'Courier New', monospace; box-sizing: border-box; resize: vertical;"></textarea>
        </div>
        <div style="display: flex; gap: 10px;">
          <button type="submit" class="create-btn" style="border: none; cursor: pointer;">Erstellen</button>
          <button type="button" id="cancel-create-btn" style="padding: 10px 20px; background: #666; color: #fff; border: none; border-radius: 5px; cursor: pointer;">Abbrechen</button>
        </div>
        <div id="error-message" style="color: #f00; margin-top: 10px; display: none;"></div>
      </form>
    </div>
    <div style="margin-top: 20px;">
      ${kennelsHtml}
    </div>
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #333;">
      <a href="/" style="color: #999;">← Zurück zur Hauptseite</a>
    </div>
  </div>
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      const createBtn = document.getElementById('create-kennel-btn');
      const formDiv = document.getElementById('create-kennel-form');
      const cancelBtn = document.getElementById('cancel-create-btn');
      const form = document.getElementById('kennel-create-form');
      const errorDiv = document.getElementById('error-message');
      
      if (createBtn && formDiv) {
        createBtn.addEventListener('click', () => {
          formDiv.style.display = formDiv.style.display === 'none' ? 'block' : 'none';
        });
      }
      
      if (cancelBtn && formDiv) {
        cancelBtn.addEventListener('click', () => {
          formDiv.style.display = 'none';
          if (errorDiv) errorDiv.style.display = 'none';
          if (form) form.reset();
        });
      }
      
      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const formData = new FormData(form);
          const data = {
            id: formData.get('id'),
            name: formData.get('name') || '',
            description: formData.get('description') || '',
            dogIds: []
          };
          
          try {
            const response = await fetch('/api/kennels', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            
            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.error || 'Fehler beim Erstellen');
            }
            
            const result = await response.json();
            if (result.ok) {
              window.location.href = '/edit/' + data.id;
            } else {
              throw new Error(result.error || 'Fehler beim Erstellen');
            }
          } catch (err) {
            if (errorDiv) {
              errorDiv.textContent = err.message;
              errorDiv.style.display = 'block';
            }
          }
        });
      }
    });
  </script>
</body>
</html>
    `;
  }

  /**
   * Erstellt HTML für die Seite zum Erstellen eines neuen Kennels
   */
  public static buildCreateKennelHtml(): string {
    return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Neuen Kennel erstellen</title>
  <style>
    body {
      font-family: 'Courier New', monospace;
      background: #000;
      color: #fff;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
    }
    h1 {
      color: #fff;
      border-bottom: 2px solid #333;
      padding-bottom: 10px;
    }
    .form-group {
      margin-bottom: 15px;
    }
    label {
      display: block;
      margin-bottom: 5px;
      color: #ccc;
    }
    input, textarea {
      width: 100%;
      padding: 8px;
      background: #1a1a1a;
      color: #fff;
      border: 1px solid #333;
      font-family: 'Courier New', monospace;
      box-sizing: border-box;
    }
    textarea {
      resize: vertical;
      min-height: 80px;
    }
    .btn {
      padding: 10px 20px;
      background: #00cc00;
      color: #fff;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-family: 'Courier New', monospace;
      font-size: 14px;
    }
    .btn:hover {
      background: #00ff00;
    }
    .btn-secondary {
      background: #666;
      margin-left: 10px;
    }
    .btn-secondary:hover {
      background: #888;
    }
    .error {
      color: #f00;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Neuen Kennel erstellen</h1>
    <form id="create-kennel-form">
      <div class="form-group">
        <label for="kennel-id">Kennel ID *</label>
        <input type="text" id="kennel-id" name="id" required placeholder="z.B. my-kennel">
      </div>
      <div class="form-group">
        <label for="kennel-name">Name</label>
        <input type="text" id="kennel-name" name="name" placeholder="Optional">
      </div>
      <div class="form-group">
        <label for="kennel-description">Description</label>
        <textarea id="kennel-description" name="description" placeholder="Optional"></textarea>
      </div>
      <div class="form-group">
        <button type="submit" class="btn">Erstellen</button>
        <a href="/" class="btn btn-secondary" style="text-decoration: none; display: inline-block;">Abbrechen</a>
      </div>
      <div id="error-message" class="error" style="display: none;"></div>
    </form>
  </div>
  <script>
    document.getElementById('create-kennel-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = {
        id: formData.get('id'),
        name: formData.get('name') || '',
        description: formData.get('description') || '',
        dogIds: []
      };
      
      try {
        const response = await fetch('/api/kennels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Fehler beim Erstellen');
        }
        
        const result = await response.json();
        if (result.ok) {
          window.location.href = '/edit/' + data.id;
        } else {
          throw new Error(result.error || 'Fehler beim Erstellen');
        }
      } catch (err) {
        const errorDiv = document.getElementById('error-message');
        errorDiv.textContent = err.message;
        errorDiv.style.display = 'block';
      }
    });
    
    // Funktion für POST-Requests mit Body
    function executeKennelWithBody(kennelId, bodyData, queryParams) {
      // Baue URL mit Query-Parametern
      let url = '/' + kennelId;
      // queryParams sollte bereits ein Objekt sein (wird als JavaScript-Objekt-Literal übergeben)
      if (queryParams && typeof queryParams === 'object' && Object.keys(queryParams).length > 0) {
        const params = new URLSearchParams();
        Object.keys(queryParams).forEach(key => {
          const value = queryParams[key];
          if (value !== null && value !== undefined) {
            params.append(key, String(value));
          }
        });
        const queryString = params.toString();
        if (queryString) {
          url += '?' + queryString;
        }
      }
      
      // Öffne leeres Fenster
      const newWindow = window.open('about:blank', '_blank');
      if (!newWindow) {
        alert('Popup wurde blockiert');
        return;
      }
      
      // Mache POST-Request
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      })
      .then(response => {
        if (response.ok) {
          return response.text();
        }
        throw new Error('Request fehlgeschlagen');
      })
      .then(html => {
        // Schreibe HTML ins Fenster
        newWindow.document.write(html);
        newWindow.document.close();
        // Setze URL mit Query-Parametern
        newWindow.history.replaceState(null, '', url);
      })
      .catch(err => {
        newWindow.close();
        alert('Fehler beim Ausführen: ' + err.message);
      });
    }
    window.executeKennelWithBody = executeKennelWithBody;
  </script>
</body>
</html>
    `;
  }
}

