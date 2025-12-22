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
      // Verteile Nodes gleichmäßig um die Mitte (z.B. -400 bis +400 für 5 Nodes)
      const spacing = 200; // Abstand zwischen Nodes
      const totalWidth = (totalNodesInWave - 1) * spacing;
      const initialX = (nodeIndexInWave * spacing) - (totalWidth / 2); // Zentriert um 0
      
      nodesArrayGlobal.push({
        id: node.id,
        label: node.name || node.id,
        // Skaliere Node-Größe basierend auf Anzahl der Verbindungen
        value: Math.max(10, (parentsRequired.length + parentsOptional.length) * 5 + 20),
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
        margin: 10,
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
        springLength: 200,
        springConstant: 0.05, // Reduziert für weniger Bewegung
        damping: 0.99, // Extrem hohe Dämpfung um Drift zu verhindern
        avoidOverlap: 1
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
      margin: 15, // Mehr Margin um Überschneidungen zu vermeiden
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
  
  // Nach Stabilisierung: Physik reduzieren, aber aktiv lassen für Stabilität
  network.on("stabilizationEnd", function() {
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
          springLength: 200,
          springConstant: 0.01, // Sehr schwach
          damping: 0.99, // Extrem hohe Dämpfung
          avoidOverlap: 1
        },
        maxVelocity: 0.1, // Sehr langsam
        minVelocity: 0.0001
      }
    });
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
  });
  
  // Event-Handler für Node-Selektion
  network.on("selectNode", function (params) {
    if (params.nodes.length > 0) {
      const selectedNodeId = params.nodes[0];
      selectNodeFromNetwork(selectedNodeId);
    }
  });
  
  // Expose nodeDataMap global für nodeSelection
  if (typeof window !== 'undefined') {
    window.nodeDataMap = nodeDataMap;
    window.visNetwork = network;
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
