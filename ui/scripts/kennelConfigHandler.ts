/**
 * Handler für KennelConfig-Verwaltung
 * Lädt, bearbeitet und speichert KennelConfigs
 */
export function buildKennelConfigHandler(): string {
  // @ts-ignore - JavaScript code as string
  return `
let currentKennelConfig = null;
let availableSerializedDogs = [];

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
          baseDogTypes: []
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
  
  const config = {
    id: idInput?.value || currentKennelConfig.id,
    name: nameInput?.value || '',
    description: descInput?.value || '',
    dogIds: allDogIds
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

// Event Listeners
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const loadBtn = document.getElementById('kennel-config-load');
    const saveBtn = document.getElementById('kennel-config-save');
    const closeBtn = document.getElementById('kennel-config-close');
    const editor = document.getElementById('kennel-config-editor');
    
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
    
    
    // Lade verfügbare SerializedDogs beim Öffnen
    if (editor && editor.style.display !== 'none') {
      loadAvailableSerializedDogs();
    }
  });
}
`;
}

