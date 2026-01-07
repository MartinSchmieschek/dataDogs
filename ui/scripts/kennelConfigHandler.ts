/**
 * Handler für KennelConfig-Verwaltung
 * Lädt, bearbeitet und speichert KennelConfigs
 */
export function buildKennelConfigHandler(): string {
  // @ts-ignore - JavaScript code as string
  return `
let currentKennelConfig = null;
let availableSerializedDogs = [];
let bodyEditor = null;

async function loadKennelConfig(id) {
  try {
    const response = await fetch(\`/api/kennels/\${id}\`);
    if (!response.ok) {
      if (response.status === 404) {
        // Config existiert nicht, erstelle neue
        currentKennelConfig = {
          id: id,
          name: '',
          description: '',
          dogIds: [],
          baseDogTypes: [],
          defaultQuery: {},
          defaultBody: null
        };
        renderKennelConfig();
        return;
      }
      throw new Error(\`HTTP \${response.status}\`);
    }
    
    const result = await response.json();
    if (result.ok && result.data) {
      currentKennelConfig = result.data;
      renderKennelConfig();
    } else {
      throw new Error(result.error || 'Fehler beim Laden');
    }
  } catch (e) {
    console.error('Fehler beim Laden der KennelConfig:', e);
    alert('Fehler beim Laden: ' + e.message);
  }
}

async function loadAvailableSerializedDogs() {
  try {
    const response = await fetch('/api/nodes');
    if (!response.ok) {
      throw new Error(\`HTTP \${response.status}\`);
    }
    
    const result = await response.json();
    if (result.ok && result.data) {
      // Extrahiere alle eindeutigen Basis-IDs (neueste Versionen)
      const dogsMap = new Map();
      result.data.forEach(dog => {
        if (dog.id) {
          // Extrahiere Basis-ID (ohne Version)
          const baseId = dog.id.replace(/-v\\d+$/, '');
          if (!dogsMap.has(baseId) || (dog.version || 0) > (dogsMap.get(baseId).version || 0)) {
            dogsMap.set(baseId, dog);
          }
        }
      });
      
      availableSerializedDogs = Array.from(dogsMap.values());
      renderAvailableDogs();
    } else {
      throw new Error(result.error || 'Fehler beim Laden');
    }
  } catch (e) {
    console.error('Fehler beim Laden der SerializedDogs:', e);
    document.getElementById('kennel-config-available-dogs').innerHTML = 
      '<div style="color: #f00; text-align: center; padding: 20px;">Fehler beim Laden: ' + e.message + '</div>';
  }
}

function renderKennelConfig() {
  if (!currentKennelConfig) return;
  
  // Setze Formular-Werte
  const idInput = document.getElementById('kennel-config-id');
  const nameInput = document.getElementById('kennel-config-name');
  const descInput = document.getElementById('kennel-config-description');
  if (idInput) idInput.value = currentKennelConfig.id || '';
  if (nameInput) nameInput.value = currentKennelConfig.name || '';
  if (descInput) descInput.value = currentKennelConfig.description || '';
  
  // Setze Base Dog Types (aus dogIds mit base:-Präfix)
  const baseDogIds = (currentKennelConfig.dogIds || []).filter(id => id.startsWith('base:'));
  document.querySelectorAll('.base-dog-type').forEach(checkbox => {
    const baseDogId = 'base:' + checkbox.value;
    checkbox.checked = baseDogIds.includes(baseDogId);
  });
  
  // Render Selected Dogs
  renderSelectedDogs();
  
  // Render Query Chips
  renderQueryChips();
  
  // Render Body Editor
  renderBodyEditor();
}

function renderAvailableDogs() {
  const container = document.getElementById('kennel-config-available-dogs');
  if (!container) return;
  
  if (availableSerializedDogs.length === 0) {
    container.innerHTML = '<div style="color: #666; text-align: center; padding: 20px;">Keine SerializedDogs gefunden</div>';
    return;
  }
  
  const selectedIds = currentKennelConfig?.dogIds || [];
  
  container.innerHTML = availableSerializedDogs.map(dog => {
    const isSelected = selectedIds.includes(dog.id) || selectedIds.some(id => {
      const baseId = id.replace(/-v\\d+$/, '');
      const dogBaseId = dog.id.replace(/-v\\d+$/, '');
      return baseId === dogBaseId;
    });
    
    return \`
      <div style="padding: 8px; margin-bottom: 5px; border: 1px solid #333; background: \${isSelected ? '#333' : '#000'}; cursor: pointer;" 
           onclick="toggleDogSelection('\${dog.id}')">
        <div style="font-weight: bold;">\${dog.id}</div>
        <div style="font-size: 12px; color: #999;">Version: \${dog.version || 'unknown'}</div>
      </div>
    \`;
  }).join('');
}

function renderSelectedDogs() {
  const container = document.getElementById('kennel-config-selected-dogs');
  if (!container || !currentKennelConfig) return;
  
  const selectedIds = currentKennelConfig.dogIds || [];
  
  if (selectedIds.length === 0) {
    container.innerHTML = '<div style="color: #666; text-align: center; padding: 20px;">Keine ausgewählt</div>';
    return;
  }
  
  container.innerHTML = selectedIds.map((id, index) => {
    const dog = availableSerializedDogs.find(d => d.id === id || d.id.replace(/-v\\d+$/, '') === id.replace(/-v\\d+$/, ''));
    const isFirst = index === 0;
    const borderColor = isFirst ? '#00cc00' : '#333';
    const bgColor = isFirst ? '#001a00' : '#000';
    const firstStar = isFirst ? '<span style="color: #00cc00;">⭐</span>' : '';
    const firstLabel = isFirst ? '<span style="color: #00cc00; font-size: 11px;">(Erster - liefert Ergebnisse)</span>' : '';
    const firstButton = !isFirst ? '<button onclick="moveDogToFirst(' + index + ')" style="padding: 4px 8px; background: #00cc00; color: #fff; border: none; cursor: pointer;" title="An erste Stelle">⭐</button>' : '';
    const versionText = dog ? 'Version: ' + (dog.version || 'unknown') : '';
    const escapedId = id.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    
    return '<div style="padding: 8px; margin-bottom: 5px; border: 1px solid ' + borderColor + '; background: ' + bgColor + '; display: flex; justify-content: space-between; align-items: center;">' +
      '<div style="flex: 1;">' +
        '<div style="font-weight: bold; display: flex; align-items: center; gap: 5px;">' +
          firstStar +
          '<span>' + id + '</span>' +
          firstLabel +
        '</div>' +
        '<div style="font-size: 12px; color: #999;">' + versionText + '</div>' +
      '</div>' +
      '<div style="display: flex; gap: 5px; align-items: center;">' +
        firstButton +
        '<button onclick="removeDogFromSelection(\\'' + escapedId + '\\')" style="padding: 4px 8px; background: #cc0000; color: #fff; border: none; cursor: pointer;" title="Entfernen">×</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

window.moveDogToFirst = function(index) {
  if (!currentKennelConfig || !currentKennelConfig.dogIds || index === 0) return;
  
  const dogIds = currentKennelConfig.dogIds;
  const dog = dogIds[index];
  dogIds.splice(index, 1);
  dogIds.unshift(dog);
  
  renderSelectedDogs();
};

window.toggleDogSelection = function(dogId) {
  if (!currentKennelConfig) return;
  
  if (!currentKennelConfig.dogIds) {
    currentKennelConfig.dogIds = [];
  }
  
  // Prüfe ob bereits ausgewählt (exakt oder Basis-ID)
  const baseId = dogId.replace(/-v\\d+$/, '');
  const index = currentKennelConfig.dogIds.findIndex(id => {
    const idBaseId = id.replace(/-v\\d+$/, '');
    return id === dogId || idBaseId === baseId;
  });
  
  if (index >= 0) {
    // Entfernen
    currentKennelConfig.dogIds.splice(index, 1);
  } else {
    // Hinzufügen
    currentKennelConfig.dogIds.push(dogId);
  }
  
  renderAvailableDogs();
  renderSelectedDogs();
};

window.removeDogFromSelection = function(dogId) {
  if (!currentKennelConfig || !currentKennelConfig.dogIds) return;
  
  const index = currentKennelConfig.dogIds.indexOf(dogId);
  if (index >= 0) {
    currentKennelConfig.dogIds.splice(index, 1);
    renderAvailableDogs();
    renderSelectedDogs();
  }
};

async function saveKennelConfig() {
  if (!currentKennelConfig) return;
  
  // Sammle Formular-Daten
  const idInput = document.getElementById('kennel-config-id');
  const nameInput = document.getElementById('kennel-config-name');
  const descInput = document.getElementById('kennel-config-description');
  
  // Verwende die aktuelle Reihenfolge aus currentKennelConfig.dogIds
  // Die Reihenfolge wurde vom Benutzer im Editor eingestellt (mit Up/Down Buttons)
  let allDogIds = [...(currentKennelConfig.dogIds || [])];
  
  // Prüfe welche BaseDogs ausgewählt sind
  const selectedBaseDogTypes = Array.from(document.querySelectorAll('.base-dog-type:checked')).map(cb => cb.value);
  const baseDogIds = selectedBaseDogTypes.map(type => 'base:' + type);
  
  // Entferne BaseDogs, die nicht mehr ausgewählt sind (behalte Reihenfolge)
  allDogIds = allDogIds.filter(id => {
    if (id.startsWith('base:')) {
      return baseDogIds.includes(id);
    }
    return true; // SerializedDogs behalten
  });
  
  // Füge neue BaseDogs am Ende hinzu, die noch nicht in der Liste sind
  // (nur wenn sie wirklich neu sind, nicht wenn sie nur an anderer Position waren)
  baseDogIds.forEach(baseDogId => {
    if (!allDogIds.includes(baseDogId)) {
      allDogIds.push(baseDogId);
    }
  });
  
  // Sammle Query-Parameter
  const queryData = {};
  const queryChips = document.querySelectorAll('#kennel-config-query-chips .query-chip');
  queryChips.forEach(chip => {
    const key = chip.dataset.key;
    const value = chip.dataset.value;
    if (key) {
      queryData[key] = value || '';
    }
  });
  
  // Sammle Body-Daten
  let bodyData = null;
  if (bodyEditor) {
    try {
      const bodyText = bodyEditor.getValue().trim();
      if (bodyText) {
        bodyData = JSON.parse(bodyText);
      }
    } catch (e) {
      alert('Body ist kein gültiges JSON: ' + e.message);
      return;
    }
  }
  
  const config = {
    id: idInput?.value || currentKennelConfig.id,
    name: nameInput?.value || '',
    description: descInput?.value || '',
    dogIds: allDogIds,
    defaultQuery: Object.keys(queryData).length > 0 ? queryData : undefined,
    defaultBody: bodyData !== null ? bodyData : undefined
  };
  
  try {
    const response = await fetch(\`/api/kennels/\${config.id}\`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    
    if (!response.ok) {
      throw new Error(\`HTTP \${response.status}\`);
    }
    
    const result = await response.json();
    if (result.ok) {
      alert('KennelConfig gespeichert!');
      currentKennelConfig = result.data;
      renderKennelConfig();
    } else {
      throw new Error(result.error || 'Fehler beim Speichern');
    }
  } catch (e) {
    console.error('Fehler beim Speichern:', e);
    alert('Fehler beim Speichern: ' + e.message);
  }
}

function renderQueryChips() {
  const container = document.getElementById('kennel-config-query-chips');
  if (!container || !currentKennelConfig) return;
  
  const queryData = currentKennelConfig.defaultQuery || {};
  const keys = Object.keys(queryData);
  
  if (keys.length === 0) {
    container.innerHTML = '<div style="color: #666; text-align: center; width: 100%;">Keine Query-Parameter</div>';
    return;
  }
  
  container.innerHTML = keys.map(key => {
    const value = queryData[key];
    const escapedKey = key.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const escapedValue = (value || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    return \`
      <div class="query-chip" data-key="\${escapedKey}" data-value="\${escapedValue}" style="display: flex; align-items: center; gap: 5px; padding: 4px 8px; background: #333; border: 1px solid #555; border-radius: 4px;">
        <span style="color: #00cc00;">\${key}:</span>
        <span style="color: #fff;">\${value || ''}</span>
        <button onclick="removeQueryChip('\${escapedKey}')" style="padding: 2px 6px; background: #cc0000; color: #fff; border: none; cursor: pointer; border-radius: 3px; font-size: 12px;">×</button>
      </div>
    \`;
  }).join('');
}

function renderBodyEditor() {
  const container = document.getElementById('kennel-config-body-editor');
  if (!container || !currentKennelConfig) return;
  
  const bodyData = currentKennelConfig.defaultBody;
  const bodyJson = bodyData ? JSON.stringify(bodyData, null, 2) : '';
  
  // Initialisiere Monaco Editor für Body
  if (typeof monaco !== 'undefined' && monaco && monaco.editor) {
    if (bodyEditor) {
      bodyEditor.dispose();
    }
    bodyEditor = monaco.editor.create(container, {
      value: bodyJson,
      language: 'json',
      theme: 'vs-dark',
      automaticLayout: true,
      minimap: { enabled: false }
    });
  } else {
    // Fallback: Textarea
    container.innerHTML = \`<textarea style="width: 100%; height: 100%; background: #000; color: #fff; border: none; padding: 10px; font-family: 'Courier New', monospace; resize: none;">\${bodyJson}</textarea>\`;
  }
}

window.removeQueryChip = function(key) {
  if (!currentKennelConfig) return;
  if (!currentKennelConfig.defaultQuery) {
    currentKennelConfig.defaultQuery = {};
  }
  delete currentKennelConfig.defaultQuery[key];
  renderQueryChips();
};

// Event Listeners
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const loadBtn = document.getElementById('kennel-config-load');
    const saveBtn = document.getElementById('kennel-config-save');
    const closeBtn = document.getElementById('kennel-config-close');
    const editor = document.getElementById('kennel-config-editor');
    const queryAddBtn = document.getElementById('kennel-config-query-add');
    
    if (loadBtn) {
      loadBtn.addEventListener('click', () => {
        const idInput = document.getElementById('kennel-config-id');
        if (idInput) {
          loadKennelConfig(idInput.value);
        }
      });
    }
    
    if (saveBtn) {
      saveBtn.addEventListener('click', saveKennelConfig);
    }
    
    if (closeBtn && editor) {
      closeBtn.addEventListener('click', () => {
        editor.style.display = 'none';
      });
    }
    
    if (queryAddBtn) {
      queryAddBtn.addEventListener('click', () => {
        const keyInput = document.getElementById('kennel-config-query-key');
        const valueInput = document.getElementById('kennel-config-query-value');
        if (!keyInput || !valueInput) return;
        
        const key = keyInput.value.trim();
        if (!key) {
          alert('Key darf nicht leer sein');
          return;
        }
        
        if (!currentKennelConfig) {
          currentKennelConfig = { defaultQuery: {} };
        }
        if (!currentKennelConfig.defaultQuery) {
          currentKennelConfig.defaultQuery = {};
        }
        
        currentKennelConfig.defaultQuery[key] = valueInput.value.trim();
        keyInput.value = '';
        valueInput.value = '';
        renderQueryChips();
      });
    }
    
    // Lade verfügbare SerializedDogs beim Öffnen
    if (editor && editor.style.display !== 'none') {
      loadAvailableSerializedDogs();
    }
    
    // Initialisiere Body Editor nach Monaco-Laden
    if (typeof window !== 'undefined') {
      const initBodyEditor = () => {
        if (typeof monaco !== 'undefined' && monaco && monaco.editor && currentKennelConfig) {
          renderBodyEditor();
        } else {
          setTimeout(initBodyEditor, 100);
        }
      };
      setTimeout(initBodyEditor, 500);
    }
  });
}
`;
}

