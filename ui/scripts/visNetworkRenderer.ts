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
function collectNodeData() {
  nodeDataMap.clear();
  const nodesArray = [];
  const edgesArray = [];
  
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
      
      // Erstelle vis.js Node
      nodesArray.push({
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
        borderWidthSelected: 2
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
            roundness: 0.4
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
            roundness: 0.4
          }
        });
      });
    });
  });
  
  nodes = new vis.DataSet(nodesArray);
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
      hierarchical: {
        enabled: true,
        direction: 'UD', // Up-Down
        sortMethod: 'directed',
        levelSeparation: 150,
        nodeSpacing: 100,
        treeSpacing: 200,
        blockShifting: true,
        edgeMinimization: true,
        parentCentralization: true,
        shakeTowards: 'leaves'
      }
    },
    physics: {
      enabled: false // Deaktiviere Physik für hierarchisches Layout
    },
    interaction: {
      hover: true,
      dragNodes: true,
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
      margin: 10,
      borderWidth: 1,
      borderWidthSelected: 2
    },
    edges: {
      arrows: 'to',
      smooth: {
        type: 'cubicBezier',
        roundness: 0.4
      },
      color: {
        inherit: 'from'
      }
    }
  };
  
  network = new vis.Network(container, data, options);
  
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
