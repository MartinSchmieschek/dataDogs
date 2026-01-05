export function buildNodeCrud(): string {
  // @ts-ignore - JavaScript code as string
  return `async function createNode() {
  const baseId = prompt("Basis-ID für neue Node (z.B. 'my-node'):");
  if (!baseId) return;
  
  const defaultCode = "// Neue Node\\nconst result = { message: 'Hello from new node' };\\nreturn result;";
  
  try {
    const response = await fetch("/api/nodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        baseId: baseId,
        tsCode: defaultCode,
        parentsRequired: [],
        parentsOptional: []
      })
    });

    if (!response.ok) {
      throw new Error("Create fehlgeschlagen: " + response.status);
    }

    const result = await response.json();
    if (result.ok) {
      alert("Node erstellt!");
      location.reload(); // Seite neu laden um neue Node zu sehen
    } else {
      throw new Error(result.error || "Unbekannter Fehler");
    }
  } catch (e) {
    console.error("Create error:", e);
    alert("Fehler beim Erstellen");
  }
}

async function moveNodeToFirst() {
  // Verwende selectedNodeElement statt DOM-Query (funktioniert mit vis.js)
  const activeNode = (typeof selectedNodeElement !== 'undefined' && selectedNodeElement) ? selectedNodeElement : null;
  if (!activeNode) {
    alert("Keine Node ausgewählt");
    return;
  }

  const nodeId = activeNode._nodeId || (activeNode.dataset ? activeNode.dataset.id : null);
  if (!nodeId) {
    alert("Node-ID nicht gefunden");
    return;
  }

  // Prüfe ob SerializedDog (hat _config) oder Basis-Dog
  const isSerializedDog = !!activeNode._config;
  const possibleBaseDogTypes = ['RandomRecipesRetriever', 'CountryFlagBlackLab', 'DishFlagBlackLab', 'RandomEveryThingRetriever', 'TalkingDog'];
  const nodeName = activeNode._json?.name || nodeId;
  const isBaseDog = !isSerializedDog && possibleBaseDogTypes.includes(nodeName);
  
  if (!isSerializedDog && !isBaseDog) {
    alert("Diese Node kann nicht verschoben werden (nur SerializedDogs oder Basis-Dogs)");
    return;
  }

  try {
    // Lade KennelConfig
    let kennelConfig = null;
    let kennelId = null;
    
    try {
      const kennelConfigScript = document.getElementById('kennel-config-data');
      if (kennelConfigScript && kennelConfigScript.textContent) {
        kennelConfig = JSON.parse(kennelConfigScript.textContent);
        kennelId = kennelConfig?.id || null;
      }
    } catch (e) {
      console.warn('[MoveToFirst] Fehler beim Laden der KennelConfig aus HTML:', e);
    }
    
    if (!kennelId) {
      const pathParts = window.location.pathname.split('/').filter(p => p);
      if (pathParts.length > 0 && pathParts[0] !== 'api' && pathParts[0] !== 'kennel') {
        kennelId = pathParts[0];
      }
    }
    
    if (!kennelId) {
      alert("KennelConfig nicht gefunden");
      return;
    }
    
    if (!kennelConfig || kennelConfig.id !== kennelId) {
      const getResponse = await fetch(\`/api/kennels/\${kennelId}\`);
      if (!getResponse.ok) throw new Error('HTTP ' + getResponse.status);
      
      const getResult = await getResponse.json();
      if (!getResult.ok || !getResult.data) {
        throw new Error(getResult.error || 'KennelConfig nicht gefunden');
      }
      
      kennelConfig = getResult.data;
    }
    
    const dogIds = kennelConfig.dogIds || [];
    
    // Finde die ID in dogIds
    let targetId = null;
    if (isBaseDog) {
      targetId = 'base:' + nodeName;
    } else {
      // Für SerializedDogs: finde die passende ID (kann versioniert sein)
      const nodeBaseId = nodeId.replace(/-v\\d+$/, '');
      targetId = dogIds.find(id => {
        if (id.startsWith('base:')) return false;
        const idBaseId = id.replace(/-v\\d+$/, '');
        return id === nodeId || idBaseId === nodeBaseId;
      });
    }
    
    if (!targetId) {
      alert("Node ist nicht in der KennelConfig");
      return;
    }
    
    // Entferne aus aktueller Position und füge am Anfang hinzu
    const filteredDogIds = dogIds.filter(id => id !== targetId);
    filteredDogIds.unshift(targetId);
    
    const baseId = kennelConfig.id ? kennelConfig.id.replace(/-v\\d+$/, '') : kennelId.replace(/-v\\d+$/, '');
    
    const updateData = {
      id: baseId,
      name: kennelConfig.name,
      description: kennelConfig.description,
      dogIds: filteredDogIds
    };
    
    const putResponse = await fetch(\`/api/kennels/\${baseId}\`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    
    if (!putResponse.ok) {
      throw new Error('HTTP ' + putResponse.status);
    }

    const putResult = await putResponse.json();
    
    if (putResult.ok) {
      alert("Node an erste Stelle verschoben!");
      // Lade Seite neu um Änderungen zu sehen
      const savedId = putResult.id || putResult.data?.id;
      const finalBaseId = savedId ? savedId.replace(/-v\\d+$/, '') : baseId;
      window.location.href = \`/edit/\${finalBaseId}\`;
    } else {
      throw new Error(putResult.error || 'Fehler beim Speichern');
    }
  } catch (e) {
    console.error("MoveToFirst error:", e);
    alert("Fehler beim Verschieben: " + e.message);
  }
}

async function deleteNode() {
  // Verwende selectedNodeElement statt DOM-Query (funktioniert mit vis.js)
  const activeNode = (typeof selectedNodeElement !== 'undefined' && selectedNodeElement) ? selectedNodeElement : null;
  if (!activeNode) {
    alert("Keine Node ausgewählt");
    return;
  }

  const nodeId = activeNode._nodeId || (activeNode.dataset ? activeNode.dataset.id : null);
  if (!nodeId) {
    alert("Node-ID nicht gefunden");
    return;
  }

  // Prüfe ob SerializedDog (hat _config) oder Basis-Dog (hat keinen _config)
  const isSerializedDog = !!activeNode._config;
  // Basis-Dogs haben keinen _config, aber einen Namen der einem Dog-Typ entspricht
  // Mögliche Basis-Dog-Typen: RandomRecipesRetriever, CountryFlagBlackLab, DishFlagBlackLab, RandomEveryThingRetriever, TalkingDog
  const possibleBaseDogTypes = ['RandomRecipesRetriever', 'CountryFlagBlackLab', 'DishFlagBlackLab', 'RandomEveryThingRetriever', 'TalkingDog'];
  const nodeName = activeNode._json?.name || nodeId;
  const isBaseDog = !isSerializedDog && possibleBaseDogTypes.includes(nodeName);
  
  if (!isSerializedDog && !isBaseDog) {
    alert("Diese Node kann nicht aus der KennelConfig entfernt werden (nur SerializedDogs oder Basis-Dogs)");
    return;
  }

  const confirmMessage = isSerializedDog 
    ? "SerializedDog wirklich aus der KennelConfig entfernen?"
    : "Basis-Dog wirklich aus der KennelConfig entfernen?";
  
  if (!confirm(confirmMessage)) {
    return;
  }

  try {
    // Lade KennelConfig aus eingebettetem JSON oder über API
    let kennelConfig = null;
    let kennelId = null;
    
    try {
      const kennelConfigScript = document.getElementById('kennel-config-data');
      if (kennelConfigScript && kennelConfigScript.textContent) {
        kennelConfig = JSON.parse(kennelConfigScript.textContent);
        kennelId = kennelConfig?.id || null;
        console.log('[DeleteNode] Geladene KennelConfig aus HTML:', kennelConfig);
      }
    } catch (e) {
      console.warn('[DeleteNode] Fehler beim Laden der KennelConfig aus HTML:', e);
    }
    
    // Fallback: Versuche Kennel-ID aus URL zu extrahieren
    if (!kennelId) {
      const pathParts = window.location.pathname.split('/').filter(p => p);
      if (pathParts.length > 0 && pathParts[0] !== 'api' && pathParts[0] !== 'kennel') {
        kennelId = pathParts[0];
      }
    }
    
    if (!kennelId) {
      alert("KennelConfig nicht gefunden. Bitte eine KennelConfig auswählen.");
      return;
    }
    
    // Lade KennelConfig falls nicht eingebettet
    if (!kennelConfig || kennelConfig.id !== kennelId) {
      const getResponse = await fetch(\`/api/kennels/\${kennelId}\`);
      if (!getResponse.ok) throw new Error('HTTP ' + getResponse.status);
      
      const getResult = await getResponse.json();
      if (!getResult.ok || !getResult.data) {
        throw new Error(getResult.error || 'KennelConfig nicht gefunden');
      }
      
      kennelConfig = getResult.data;
    }
    
    const dogIds = kennelConfig.dogIds || [];
    
    let filteredDogIds = dogIds;
    let somethingRemoved = false;
    
    if (isSerializedDog) {
      // Entferne SerializedDog aus dogIds (berücksichtige sowohl Basis-ID als auch versionierte IDs)
      const nodeBaseId = nodeId.replace(/-v\\d+$/, '');
      filteredDogIds = dogIds.filter(id => {
        // Überspringe Basis-Dogs (haben Präfix "base:")
        if (id.startsWith('base:')) return true;
        const idBaseId = id.replace(/-v\\d+$/, '');
        // Entferne wenn exakt gleich oder Basis-ID gleich
        return id !== nodeId && idBaseId !== nodeBaseId;
      });
      
      if (filteredDogIds.length === dogIds.length) {
        alert("SerializedDog ist nicht in der KennelConfig");
        return;
      }
      
      somethingRemoved = true;
      console.log('[DeleteNode] Entferne SerializedDog:', nodeId);
      console.log('[DeleteNode] Vorher dogIds:', dogIds);
      console.log('[DeleteNode] Nachher dogIds:', filteredDogIds);
    } else if (isBaseDog) {
      // Entferne Basis-Dog aus dogIds (hat Präfix "base:")
      // Der nodeId sollte der Name des Basis-Dog-Typs sein (z.B. "RandomRecipesRetriever")
      const nodeName = activeNode._json?.name || nodeId;
      const baseDogId = 'base:' + nodeName;
      filteredDogIds = dogIds.filter(id => id !== baseDogId);

      if (filteredDogIds.length === dogIds.length) {
        alert("Basis-Dog ist nicht in der KennelConfig");
        return;
      }
      
      somethingRemoved = true;
      console.log('[DeleteNode] Entferne Basis-Dog:', nodeName);
      console.log('[DeleteNode] Vorher dogIds:', dogIds);
      console.log('[DeleteNode] Nachher dogIds:', filteredDogIds);
    }
    
    if (!somethingRemoved) {
      alert("Node konnte nicht aus der KennelConfig entfernt werden");
      return;
    }
    
    // Extrahiere Basis-ID (ohne Version) für Versionsverwaltung
    const baseId = kennelConfig.id ? kennelConfig.id.replace(/-v\\d+$/, '') : kennelId.replace(/-v\\d+$/, '');
    
    // Speichere aktualisierte KennelConfig (verwende Basis-ID, damit neue Version erstellt wird)
    const updateData = {
      id: baseId,  // Basis-ID verwenden, damit Versionsverwaltung funktioniert
      name: kennelConfig.name,
      description: kennelConfig.description,
      dogIds: filteredDogIds
    };
    
    const putResponse = await fetch(\`/api/kennels/\${baseId}\`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    
    if (!putResponse.ok) {
      const errorText = await putResponse.text();
      console.error('[DeleteNode] PUT Response Error:', errorText);
      throw new Error('HTTP ' + putResponse.status + ': ' + errorText);
    }

    const putResult = await putResponse.json();
    console.log('[DeleteNode] PUT Result:', JSON.stringify(putResult, null, 2));
    
    if (putResult.ok) {
      // Extrahiere Basis-ID aus der gespeicherten ID (kann versioniert sein)
      const savedId = putResult.id || putResult.data?.id;
      const baseId = savedId ? savedId.replace(/-v\\d+$/, '') : kennelId.replace(/-v\\d+$/, '');
      
      const successMessage = isSerializedDog 
        ? "SerializedDog aus der KennelConfig entfernt!"
        : "Basis-Dog aus der KennelConfig entfernt!";
      alert(successMessage);
      
      // Lade neueste Version der KennelConfig und lade Seite neu
      window.location.href = \`/edit/\${baseId}\`;
    } else {
      throw new Error(putResult.error || 'Fehler beim Speichern');
    }
  } catch (e) {
    console.error("Delete error:", e);
    alert("Fehler beim Entfernen: " + e.message);
  }
}`;
}

