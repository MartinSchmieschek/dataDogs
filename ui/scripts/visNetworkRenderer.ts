export function buildVisNetworkRenderer(): string {
  // @ts-ignore - JavaScript code as string
  return `// vis.js Network Renderer
let network = null;
let nodes = null;
let edges = null;
let nodeDataMap = new Map();

function base64ToUtf8(b64){
  if (!b64) return "";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

// Sammle Node-Daten und erstelle vis.js Nodes und Edges
let nodesArrayGlobal = []; // Global für Zugriff nach collectNodeData

function collectNodeData() {
  nodeDataMap.clear();
  nodesArrayGlobal = []; // Reset
  const edgesArray = [];
  
  // Finde erste Wave für zentrale Ausrichtung
  const firstWave = waves.length > 0 ? waves[0] : [];
  const firstWaveNodeIds = firstWave.map(n => n.id);
  
  waves.forEach((wave, waveIndex) => {
    wave.forEach(node => {
      const config = node.serializedDogConfig || null;
      const parentsRequired = config ? (config.parentsRequired || []) : (node.parentsRequired || []);
      const parentsOptional = config ? (config.parentsOptional || []) : (node.parentsOptional || []);
      
      // Speichere Node-Daten für selectNode - ÜBERGEBE ALLE WAVE ENTRY DATEN
      // Code aus config.theRun bevorzugen, sonst codeTs dekodieren
      let codeTsValue = "// no code";
      if (config && config.theRun) {
        codeTsValue = config.theRun;
      } else if (node.codeTs) {
        // Versuche base64 zu dekodieren, falls es base64 ist
        try {
          codeTsValue = base64ToUtf8(node.codeTs);
        } catch (e) {
          // Falls Dekodierung fehlschlägt, verwende direkt den Wert
          codeTsValue = node.codeTs;
        }
      }
      
      const nodeData = {
        id: node.id,
        name: node.name || node.id,
        result: node.result,
        error: node.error || undefined,
        vmContext: node.vmContext || {},
        vmContextTypeDef: node.vmContextTypeDef || undefined,
        codeTs: codeTsValue,
        parentsRequired: parentsRequired,
        parentsOptional: parentsOptional,
        serializedDogConfig: config,
        // Übergib alle weiteren Daten aus dem Wave Entry
        ...node
      };
      nodeDataMap.set(node.id, nodeData);
      
      // Erstelle vis.js Node mit fixierter Y-Position basierend auf Wave-Level
      // Starte von oben (z.B. bei 100) und verteile nach unten
      const yPosition = 100 + (waveIndex * 250); // Start bei 100px, dann 250px Abstand pro Wave-Level
      // Initiale X-Position gleichmäßig verteilt innerhalb der Wave (zentriert um 0)
      const nodeIndexInWave = wave.findIndex(n => n.id === node.id);
      const totalNodesInWave = wave.length;
      
      // Berechne Node-Größe für Abstand-Berechnung
      const nodeName = node.name || node.id;
      const textLength = nodeName.length;
      // Berechne tatsächliche Text-Breite (ca. 8-10px pro Zeichen bei monospace font size 14)
      const textWidth = textLength * 10; // 10px pro Zeichen für monospace font
      const padding = 30; // Padding links und rechts
      const baseSize = Math.max(100, textWidth + padding); // Mindestgröße basierend auf tatsächlicher Text-Breite
      const connectionSize = (parentsRequired.length + parentsOptional.length) * 15;
      const nodeSize = Math.max(baseSize, connectionSize + 60); // Node-Größe
      
      // Abstand zwischen Nodes in derselben Wave: Mindestabstand = 4 × Node-Größe (sehr viel mehr Abstand!)
      const minSpacing = nodeSize * 4.0; // Mindestabstand = 4 × div-Größe (Nodes sollen sehr weit auseinander sein)
      const spacing = minSpacing; // Verwende Mindestabstand
      const totalWidth = (totalNodesInWave - 1) * spacing;
      const initialX = (nodeIndexInWave * spacing) - (totalWidth / 2); // Zentriert um 0
      
      // nodeName, textLength, baseSize, connectionSize und nodeSize wurden bereits oben berechnet
      
      nodesArrayGlobal.push({
        id: node.id,
        label: '🐕 ' + nodeName,
        shape: 'box',
        // Skaliere Node-Größe basierend auf Textlänge und Anzahl der Verbindungen
        value: nodeSize,
        widthConstraint: {
          minimum: nodeSize,
          maximum: nodeSize * 1.5
        },
        heightConstraint: {
          minimum: 40,
          maximum: 60
        },
        font: { 
          color: '#eee',
          size: 14,
          face: 'monospace'
        },
        color: {
          background: '#1b1b1f',
          border: '#333',
          highlight: { 
            background: '#2b2b3f', 
            border: '#4a9eff' 
          },
          hover: { 
            background: '#2b2b3f', 
            border: '#4a9eff' 
          }
        },
        margin: 35, // Sehr stark erhöhter Margin für mehr Abstand zwischen Nodes (verhindert Überlappung)
        borderWidth: 1,
        borderWidthSelected: 2,
        x: initialX, // Initiale X-Position für gleichmäßige Startverteilung
        y: yPosition, // Y-Position basierend auf Wave
        fixed: {
          x: waveIndex === 0, // Erste Wave: X-Position fixiert (keine Physik), andere Waves: X verschiebbar
          y: true // Y-Position für ALLE Waves fixiert (Nodes bleiben in ihrer Wave-Ebene)
        },
        mass: waveIndex === 0 ? 10 : 1 // Erste Wave hat höhere Masse (Anker)
      });
      
      // Erstelle Edges für Required Parents (rot, durchgezogen)
      parentsRequired.forEach(parentId => {
        edgesArray.push({
          from: parentId,
          to: node.id,
          color: {
            color: '#ff4444',
            highlight: '#ff6666',
            hover: '#ff6666'
          },
          width: 2,
          arrows: 'to',
          smooth: {
            type: 'cubicBezier',
            roundness: 0.5
          }
        });
      });
      
      // Erstelle Edges für Optional Parents (blau, gestrichelt)
      parentsOptional.forEach(parentId => {
        edgesArray.push({
          from: parentId,
          to: node.id,
          color: {
            color: '#44aaff',
            highlight: '#66ccff',
            hover: '#66ccff'
          },
          width: 1.5,
          dashes: true,
          arrows: 'to',
          smooth: {
            type: 'cubicBezier',
            roundness: 0.5
          }
        });
      });
    });
  });
  
  nodes = new vis.DataSet(nodesArrayGlobal);
  edges = new vis.DataSet(edgesArray);
}

// Initialisiere vis.js Network
function initNetwork() {
  const container = document.getElementById("network-container");
  if (!container) {
    console.error("Container für vis.js nicht gefunden!");
    return;
  }
  
  // Stelle sicher, dass Container die volle Höhe nutzt
  container.style.width = "100%";
  container.style.height = "calc(100vh - 120px)";
  container.style.minHeight = "calc(100vh - 120px)";
  
  collectNodeData();
  
  const data = {
    nodes: nodes,
    edges: edges
  };
  
  const options = {
    layout: {
      improvedLayout: true // Verbessertes Layout-Algorithmus
    },
    nodes: {
      shapeProperties: {
        useBorderWithImage: true
      }
    },
    physics: {
      enabled: true, // Aktiviere Physik für gummi-artige Ausrichtung (nur für nachfolgende Waves)
      stabilization: {
        enabled: true,
        iterations: 1000, // Noch mehr Iterationen für bessere Stabilisierung
        fit: true,
        updateInterval: 25, // Häufigere Updates während Stabilisierung
        onlyDynamicEdges: false // Stabilisiere auch statische Edges
      },
      forceAtlas2Based: {
        gravitationalConstant: -5, // Sehr stark reduziert für weniger Drift
        centralGravity: 0.0, // Komplett deaktiviert - keine zentrale Schwerkraft
        springLength: 200, // Deutlich erhöht für viel mehr Abstand zwischen verbundenen Nodes
        springConstant: 0.05, // Reduziert für weniger Zugkraft
        damping: 0.99, // Extrem hohe Dämpfung um Drift zu verhindern
        avoidOverlap: 10.0 // Extrem erhöht für maximale Abstoßung (keine Überlappung)
      },
      maxVelocity: 2, // Extrem reduziert um Drift zu verhindern
      minVelocity: 0.0001,
      solver: 'forceAtlas2Based'
    },
    interaction: {
      hover: true,
      dragNodes: true, // Erlaube Verschieben
      dragView: true,
      zoomView: true,
      selectConnectedEdges: false
    },
    nodes: {
      shape: 'box',
      font: { 
        color: '#eee',
        size: 14,
        face: 'monospace'
      },
      color: {
        background: '#1b1b1f',
        border: '#333',
        highlight: { 
          background: '#2b2b3f', 
          border: '#4a9eff' 
        },
        hover: { 
          background: '#2b2b3f', 
          border: '#4a9eff' 
        }
      },
        margin: 35, // Sehr stark erhöhter Margin um Überschneidungen zu vermeiden
      borderWidth: 1,
      borderWidthSelected: 2
    },
    edges: {
      arrows: 'to',
      smooth: {
        type: 'cubicBezier',
        roundness: 0.5 // Mehr Rundung für bessere Sichtbarkeit und weniger Kreuzungen
      },
      color: {
        inherit: 'from'
      }
    }
  };
  
  network = new vis.Network(container, data, options);
  
  // Speichere ursprüngliche Y-Positionen für alle Nodes
  const originalYPositions = new Map();
  nodesArrayGlobal.forEach(node => {
    if (node.y !== undefined) {
      originalYPositions.set(node.id, node.y);
    }
  });
  
  // Delete-Buttons Management - Buttons nur einmal erstellen, dann nur Positionen aktualisieren
  const deleteButtonsMap = new Map(); // Map von nodeId zu Button-Element
  
  function createDeleteButton(nodeId) {
    const btn = document.createElement('button');
    btn.className = 'node-delete-btn';
    btn.setAttribute('data-node-id', nodeId);
    btn.innerHTML = '×';
    btn.onclick = (e) => {
      e.stopPropagation();
      deleteNodeFromNetwork(nodeId);
    };
    return btn;
  }
  
  function updateDeleteButtons() {
    const container = document.getElementById("network-container");
    if (!container || !network) return;
    
    const positions = network.getPositions();
    if (!positions) return;
    
    // Finde alle Nodes die Delete-Buttons brauchen
    const nodesNeedingButtons = new Set();
    Object.keys(positions).forEach(nodeId => {
      const nodeData = nodeDataMap.get(nodeId);
      if (!nodeData) return;
      
      const config = nodeData.serializedDogConfig || null;
      const isSerializedDog = !!config;
      const possibleBaseDogTypes = ['RandomRecipesRetriever', 'CountryFlagBlackLab', 'DishFlagBlackLab', 'RandomEveryThingRetriever', 'TalkingDog'];
      const nodeName = nodeData.name || nodeId;
      const isBaseDog = !isSerializedDog && possibleBaseDogTypes.includes(nodeName);
      const canDelete = isSerializedDog || isBaseDog;
      
      if (canDelete) {
        nodesNeedingButtons.add(nodeId);
      }
    });
    
    // Entferne Buttons für Nodes die nicht mehr existieren oder keine Buttons mehr brauchen
    deleteButtonsMap.forEach((btn, nodeId) => {
      if (!nodesNeedingButtons.has(nodeId) || !positions[nodeId]) {
        btn.remove();
        deleteButtonsMap.delete(nodeId);
      }
    });
    
    // Erstelle oder aktualisiere Buttons
    nodesNeedingButtons.forEach(nodeId => {
      const pos = positions[nodeId];
      if (!pos) return;
      
      // Hole Button (erstellen falls nicht vorhanden)
      let btn = deleteButtonsMap.get(nodeId);
      if (!btn) {
        btn = createDeleteButton(nodeId);
        container.appendChild(btn);
        deleteButtonsMap.set(nodeId, btn);
      }
      
      // Berechne Canvas-Koordinaten zu DOM-Koordinaten
      const canvasRect = container.getBoundingClientRect();
      const scale = network.getScale();
      const viewPos = network.getViewPosition();
      
      // vis.js getPositions() gibt Koordinaten im Canvas-Koordinatensystem zurück
      // Diese müssen in DOM-Koordinaten (relativ zum Container) umgewandelt werden
      const canvasX = pos.x;
      const canvasY = pos.y;
      
      // Hole Node-Größe
      const node = nodes.get(nodeId);
      const nodeWidth = node ? (node.value || 100) : 100;
      const nodeHeight = 50; // Geschätzte Höhe
      
      // vis.js Transform: Canvas-Koordinaten zu DOM-Koordinaten
      // viewPos ist der Offset, scale ist der Zoom-Faktor
      // Container-Mitte ist der Ursprung
      const centerX = canvasRect.width / 2;
      const centerY = canvasRect.height / 2;
      
      // Transform: (Canvas-Pos - View-Offset) * Scale + Container-Mitte
      const domX = centerX + (canvasX - viewPos.x) * scale;
      const domY = centerY + (canvasY - viewPos.y) * scale;
      
      // Button-Position: Oben rechts der Node
      const btnSize = Math.max(18, 22 * scale);
      const btnX = domX + (nodeWidth * scale) / 2 - btnSize / 2;
      const btnY = domY - (nodeHeight * scale) / 2 - btnSize / 2;
      
      // Aktualisiere Position und Größe (ohne Button neu zu erstellen)
      btn.style.position = 'absolute';
      btn.style.left = btnX + 'px';
      btn.style.top = btnY + 'px';
      btn.style.width = btnSize + 'px';
      btn.style.height = btnSize + 'px';
      btn.style.background = '#ff4444';
      btn.style.color = '#fff';
      btn.style.border = 'none';
      btn.style.borderRadius = '50%';
      btn.style.cursor = 'pointer';
      btn.style.fontSize = (btnSize * 0.75) + 'px';
      btn.style.lineHeight = '1';
      btn.style.padding = '0';
      btn.style.display = 'flex';
      btn.style.alignItems = 'center';
      btn.style.justifyContent = 'center';
      btn.style.zIndex = '1000';
      btn.style.pointerEvents = 'auto';
    });
  }
  
  // Nach Stabilisierung: Physik reduzieren, aber aktiv lassen für Stabilität
  network.on("stabilizationEnd", function() {
    updateDeleteButtons();
    // Reduziere Physik drastisch, aber lasse sie aktiv für Stabilität
    network.setOptions({
      physics: {
        enabled: true,
        stabilization: {
          enabled: false
        },
        forceAtlas2Based: {
          gravitationalConstant: -1, // Sehr schwach
          centralGravity: 0.0,
          springLength: 200, // Deutlich erhöht für viel mehr Abstand zwischen verbundenen Nodes
          springConstant: 0.05, // Reduziert für weniger Zugkraft
          damping: 0.99, // Extrem hohe Dämpfung
          avoidOverlap: 10.0 // Extrem erhöht für maximale Abstoßung (keine Überlappung)
        },
        maxVelocity: 0.1, // Sehr langsam
        minVelocity: 0.0001
      }
    });
    
    // Überwache und korrigiere Abstände zwischen Nodes in derselben Wave
    setInterval(function() {
      const positions = network.getPositions();
      const updates = [];
      
      // Gruppiere Nodes nach Wave (Y-Position)
      const nodesByWave = new Map();
      originalYPositions.forEach((originalY, nodeId) => {
        if (!nodesByWave.has(originalY)) {
          nodesByWave.set(originalY, []);
        }
        nodesByWave.get(originalY).push(nodeId);
      });
      
      // Prüfe Abstände innerhalb jeder Wave
      nodesByWave.forEach((nodeIds, waveY) => {
        if (nodeIds.length < 2) return; // Nur wenn mehrere Nodes in der Wave
        
        // Sortiere Nodes nach X-Position
        const sortedNodes = nodeIds.map(id => ({
          id: id,
          x: positions[id] ? positions[id].x : 0,
          node: nodes.get(id)
        })).sort((a, b) => a.x - b.x);
        
        // Prüfe Abstände zwischen benachbarten Nodes
        for (let i = 0; i < sortedNodes.length - 1; i++) {
          const node1 = sortedNodes[i];
          const node2 = sortedNodes[i + 1];
          const distance = Math.abs(node2.x - node1.x);
          
          // Berechne Node-Größen inklusive Margin
          const node1Size = node1.node ? (node1.node.value || 50) : 50;
          const node2Size = node2.node ? (node2.node.value || 50) : 50;
          const node1Margin = node1.node && node1.node.margin ? node1.node.margin : 35;
          const node2Margin = node2.node && node2.node.margin ? node2.node.margin : 35;
          const node1Total = node1Size + (node1Margin * 2); // Größe + Margin auf beiden Seiten
          const node2Total = node2Size + (node2Margin * 2);
          // Mindestabstand = Summe der Node-Größen (damit sie sich nicht berühren) + Extra-Puffer
          const minDistance = node1Total + node2Total + 50; // Deutlich mehr Abstand zwischen Nodes in derselben Wave
          
          // Korrigiere wenn zu nah (ÜBERLAPPUNG!)
          if (distance < minDistance) {
            // Zu nah: Verschiebe Node2 weiter weg
            const correction = minDistance - distance + 30; // Extra 30px Puffer
            updates.push({
              id: node2.id,
              x: node2.x + correction
            });
          }
        }
      });
      
      if (updates.length > 0) {
        nodes.update(updates);
      }
    }, 100); // Alle 100ms überwachen (häufiger für bessere Reaktion auf Überlappungen)
  });
  
  // Event-Handler: Verhindere Überlappung der ersten Wave beim Verschieben
  network.on("dragStart", function(params) {
    if (params.nodes && params.nodes.length > 0) {
      const draggedNodeId = params.nodes[0];
      const draggedNode = nodes.get(draggedNodeId);
      const originalY = originalYPositions.get(draggedNodeId);
      const firstWaveY = 100; // Y-Position der ersten Wave
      
      if (draggedNode && originalY === firstWaveY) {
        // Node ist aus der ersten Wave
        // Temporär X-Fixierung aufheben für Verschiebung (Y bleibt fixiert)
        nodes.update([{
          id: draggedNodeId,
          fixed: {
            x: false, // X temporär verschiebbar
            y: true // Y bleibt fixiert (in der Ebene)
          }
        }]);
      }
    }
  });
  
  network.on("dragEnd", function(params) {
    if (params.nodes && params.nodes.length > 0) {
      const draggedNodeId = params.nodes[0];
      const draggedNode = nodes.get(draggedNodeId);
      const originalY = originalYPositions.get(draggedNodeId);
      const firstWaveY = 100; // Y-Position der ersten Wave
      
      if (draggedNode && originalY === firstWaveY) {
        // Node ist aus der ersten Wave
        // Prüfe auf Überlappungen mit anderen Nodes der ersten Wave
        const positions = network.getPositions();
        const currentPos = positions[draggedNodeId];
        
        Object.keys(positions).forEach(otherNodeId => {
          if (otherNodeId === draggedNodeId) return;
          const otherOriginalY = originalYPositions.get(otherNodeId);
          if (otherOriginalY === firstWaveY) {
            // Andere Node ist auch in der ersten Wave
            const otherPos = positions[otherNodeId];
            const distance = Math.abs(currentPos.x - otherPos.x); // Nur X-Abstand (Y ist gleich)
            if (distance < 150) { // Mindestabstand 150px
              // Verschiebe Node weg von Überlappung (nur X-Richtung)
              const direction = currentPos.x > otherPos.x ? 1 : -1;
              const newX = otherPos.x + direction * 150;
              nodes.update([{
                id: draggedNodeId,
                x: newX,
                y: originalY // Y bleibt in der Ebene
              }]);
            }
          }
        });
        
        // Setze Fixierung wieder (X fixiert für erste Wave, Y bleibt fixiert)
        nodes.update([{
          id: draggedNodeId,
          fixed: {
            x: true, // X wieder fixiert (keine Physik für erste Wave)
            y: true // Y bleibt fixiert (in der Ebene)
          }
        }]);
      }
    }
    
    // Update Delete-Buttons nach dem Verschieben
    requestAnimationFrame(updateDeleteButtons);
  });
  
  // Event-Handler für Node-Selektion
  network.on("selectNode", function (params) {
    if (params.nodes.length > 0) {
      const selectedNodeId = params.nodes[0];
      selectNodeFromNetwork(selectedNodeId);
    }
  });
  
  // Update Delete-Buttons bei Zoom, Pan oder Bewegung - SOFORT ohne Debouncing
  network.on("zoom", function() {
    requestAnimationFrame(updateDeleteButtons);
  });
  
  network.on("dragEnd", function() {
    requestAnimationFrame(updateDeleteButtons);
  });
  
  // Update bei jedem Frame während Bewegung (für flüssige Animation)
  let animationFrameId = null;
  function continuousUpdate() {
    updateDeleteButtons();
    animationFrameId = requestAnimationFrame(continuousUpdate);
  }
  
  network.on("startStabilizing", function() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    continuousUpdate();
  });
  
  network.on("stabilizationEnd", function() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    updateDeleteButtons();
  });
  
  // Update Buttons auch bei Window-Resize
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', function() {
      requestAnimationFrame(updateDeleteButtons);
    });
  }
  
  // Expose nodeDataMap global für nodeSelection
  if (typeof window !== 'undefined') {
    window.nodeDataMap = nodeDataMap;
    window.visNetwork = network;
  }
}

// Delete-Funktion für Nodes
async function deleteNodeFromNetwork(nodeId) {
  const nodeData = nodeDataMap.get(nodeId);
  if (!nodeData) {
    alert("Node-Daten nicht gefunden");
    return;
  }
  
  // Erstelle temporäres Element-Objekt für deleteNode
  const tempEl = {
    dataset: { id: nodeData.id },
    _json: nodeData.result,
    _ctx: nodeData.vmContext,
    _ctxTypeDef: nodeData.vmContextTypeDef,
    _ts: nodeData.codeTs,
    _req: nodeData.parentsRequired,
    _opt: nodeData.parentsOptional,
    _nodeId: nodeData.id,
    _config: nodeData.serializedDogConfig
  };
  
  // Setze selectedNodeElement für deleteNode
  if (typeof selectedNodeElement !== 'undefined') {
    selectedNodeElement = tempEl;
  }
  
  // Rufe deleteNode auf
  if (typeof deleteNode === 'function') {
    await deleteNode();
  } else {
    console.error("deleteNode Funktion nicht gefunden!");
    alert("Delete-Funktion nicht verfügbar");
  }
}

// Wähle Node aus (kompatibel mit selectNode)
function selectNodeFromNetwork(nodeId) {
  const nodeData = nodeDataMap.get(nodeId);
  if (!nodeData) return;
  
  // Erstelle temporäres Element-Objekt für Kompatibilität
  const tempEl = {
    dataset: { id: nodeData.id },
    _json: nodeData.result,
    _ctx: nodeData.vmContext,
    _ctxTypeDef: nodeData.vmContextTypeDef,
    _ts: nodeData.codeTs,
    _req: nodeData.parentsRequired,
    _opt: nodeData.parentsOptional,
    _nodeId: nodeData.id,
    _config: nodeData.serializedDogConfig
  };
  
  // Monaco Editor muss wissen, welche Node ausgewählt ist
  if (typeof selectedNodeElement !== 'undefined') {
    selectedNodeElement = tempEl;
  }
  
  // Rufe die ursprüngliche selectNode Funktion auf
  if (typeof selectNode === 'function') {
    selectNode(tempEl);
  } else {
    console.error("selectNode Funktion nicht gefunden!");
  }
}

// Render-Funktion
function renderWaves() {
  // Prüfe ob vis.js geladen ist
  if (typeof vis === 'undefined' || !vis.Network) {
    console.error("vis.js nicht geladen!");
    return;
  }
  
  // Stelle sicher, dass Container die volle Höhe nutzt
  const container = document.getElementById("network-container");
  if (container) {
    container.style.width = "100%";
    container.style.height = "calc(100vh - 120px)";
    container.style.minHeight = "calc(100vh - 120px)";
  }
  
  if (network) {
    collectNodeData();
    const data = {
      nodes: nodes,
      edges: edges
    };
    network.setData(data);
    
    // Expose nodeDataMap global
    if (typeof window !== 'undefined') {
      window.nodeDataMap = nodeDataMap;
    }
    
    // Aktualisiere Netzwerk-Größe bei Resize
    if (container) {
      network.setSize(container.offsetWidth, container.offsetHeight);
    }
  } else {
    initNetwork();
  }
}`;
}
