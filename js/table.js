import { TabulatorFull as Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';
import Split from 'split.js';
import { deactivateTableToggle } from './controls'; 


import { getLayerByName } from './utils'; 

let splitInstance = null;
let tableChildWindow = null; // Speichert die Referenz auf das neue Fenster
let isTableActive = false; 

export let mapRef = null;
export let table = null;

let resizeObserver = null;
let tableReady = false;
let showTableTimeout;
let lastTableData = [];
let lastLayerName = 'unknown';


import Style from 'ol/style/Style';
import Stroke from 'ol/style/Stroke';
import Fill from 'ol/style/Fill';
import CircleStyle from 'ol/style/Circle';

import { isTableEnabled } from './controls';

let highlightedFeature = null;


let interactionMode = "mouse"; 
// "mouse" | "keyboard"


const hoverHighlightStyle = new Style({
  stroke: new Stroke({
    color: '#faa600',   // OpenLayers Standard-Blau
    width: 16,
  }),
  fill: new Fill({
    color: 'rgba(51, 153, 255, 0.2)', // transparent!
  }),
  image: new CircleStyle({
    radius: 8,
    fill: new Fill({
      color: 'rgba(51, 153, 255, 0.7)',
    }),
    stroke: new Stroke({
      color: '#000000',
      width: 10
    }),
  }),
});

export function initTable(map) {
  mapRef = map;
}

export function updateSelector(names) {
  // KORREKTUR: Hole das Dokument des Fensters, in dem die Tabelle gerade lebt
  const tableDoc = getTableDocument();
  const selector = tableDoc.getElementById('layer-selector');
  
  if (!selector) return;

  // 1. Den aktuell ausgewählten Wert zwischenspeichern
  const previousSelection = selector.value;

  // 2. Das Dropdown neu aufbauen
  selector.replaceChildren();
  
  names.forEach((name) => {
    // WICHTIG: Erstelle das Element im Kontext des Ziel-Dokuments!
    const option = tableDoc.createElement('option');
    option.value = name;
    option.textContent = name;
    selector.appendChild(option);
  });

  // 3. Prüfen, ob der alte Wert in der neuen Liste noch existiert
  if (names.includes(previousSelection)) {
    selector.value = previousSelection;
  } else {
    console.log("Vorheriger Layer nicht mehr in der Liste.");
  }
}

export function showTable(data) {
  if (!Array.isArray(data)) {
    data = data ? [data] : []; 
  } 
  
  data = data.map(item => {
    const clean = {};
    Object.entries(item).forEach(([key, value]) => {
      // komplexe Objekte überspringen
      if (typeof value === 'object' && value !== null) {
        return;
      }
      clean[key] = value;
    });
    return clean;
  });

  isTableActive = true;

  // 1. Das aktuell richtige Dokument holen (Hauptfenster oder Popout)
  const tableDoc = getTableDocument();

  // 2. ALLE Elemente aus diesem spezifischen Dokument heraussuchen
  const container = tableDoc.getElementById("table-container");
  if (!container) return; // Sicherheits-Check vorgezogen

  // 👉 Klone/Doppelte Header-Elemente im Container verhindern
  const existingHeaders = container.querySelectorAll("#table-header");
  if (existingHeaders.length > 1) {
    for (let i = 1; i < existingHeaders.length; i++) {
      existingHeaders[i].remove();
    }
  }

  const tableElement = tableDoc.getElementById("wms_data_table");
  const filterBtn = tableDoc.getElementById("filter-toggle");      
  const resetBtn = tableDoc.getElementById("table-reset");        

  // Sicherheitscheck: Wenn das Tabellen-Element im aktuellen Fenster nicht existiert, abbrechen
  if (!tableElement) return;

  container.style.display = "flex";
  container.style.pointerEvents = "auto";
  
  // Split.js darf NUR ausgeführt werden, wenn die Tabelle im Hauptfenster eingebettet ist!
  // Wenn tableDoc !== document, sind wir im Popout-Fenster, dort brauchen wir kein Split.js.
  if (tableDoc === document) {
    const mapElement = document.getElementById("map");
    if (mapElement) mapElement.style.height = "";

    if (!splitInstance) {
      splitInstance = Split(['#map', '#table-container'], {
        sizes: [70, 30],
        minSize: [100, 0],
        direction: 'vertical',
        gutterSize: 10,
        onDrag: () => { if (mapRef) mapRef.updateSize(); },
        onDragEnd: (sizes) => { if (sizes[1] <= 5) closeTable(); }
      });
    }
  }
  if (mapRef) mapRef.updateSize();

  // 👉 2. Layer & Daten bestimmen (KORREKTUR: Suche im tableDoc!)
  const selector = tableDoc.getElementById('layer-selector');
  const layerName = selector ? selector.value : "unknown";
  lastLayerName = layerName;
  const normalizedName = layerName.toLowerCase();
  let idKey;

  // 3. Deine expliziten Zuweisungen
  if (normalizedName === 'fsk') {
    idKey = 'OBJECTID';
  } else if (normalizedName.startsWith('shapefile')) {
    idKey = 'objectid';
  } else {
    // 2. Dynamische Erkennung für WMS und unbekannte Layer
    if (data && data.length > 0) {
      const firstItem = data.find(item => item !== null && typeof item === 'object');
      if (firstItem) {
        const commonKeys = ['ID_con', 'id', 'gml_id', 'OBJECTID', 'objectid', 'FID'];
        idKey = commonKeys.find(key => key in firstItem);
        if (!idKey) {
          idKey = Object.keys(firstItem)[0]; 
          console.warn(`Kein bekannter ID-Key gefunden. Nutze Fallback: ${idKey}`);
        }
      } else {
        idKey = 'ID_con';
      }
    } else {
        idKey = 'ID_con';
    }
  }

 // 👉 3. Reset-Button Logik
  if (resetBtn) {
    resetBtn.onclick = () => {
      if (table) {
        const storageId = "tabulator-wms_table_" + normalizedName;
        localStorage.removeItem(storageId);
        
        // Löschen der Instanz erzwingen
        table.destroy();
        table = null; 
        
        // Tabelle komplett neu aufbauen lassen
        showTable(data); 
        console.log("tabelle angezeigt durch resetbutton")
        console.log(`Layout für Layer ${normalizedName} zurückgesetzt.`);
      }
    };
  }

  // 👉 4. Filter-Button Logik
  if (filterBtn) {
    filterBtn.onclick = () => {
      tableElement.classList.toggle("hide-filters");
      const filtersHidden = tableElement.classList.contains("hide-filters");
      filtersHidden ? filterBtn.classList.remove("active") : filterBtn.classList.add("active");
      if (table) table.redraw();
    };
    if (!tableElement.classList.contains("hide-filters")) filterBtn.classList.add("active");
  }
  // Hole den aktuellen Layernamen aus dem Selektor des richtigen Fensters
  //const selector = tableDoc.getElementById('layer-selector');
  const activeLayerName = selector ? selector.value : "unknown";

  // 👉 5. Daten vorbereiten (und Layernamen fest in jedes Objekt reinschreiben!)
  const uniqueData = (data || [])
    .map(item => {
      if (!item) return null;
      // Wir klonen das Objekt und fügen 'origin_layer' hinzu, falls es fehlt!
      return {
        ...item,
        origin_layer: item.origin_layer || activeLayerName
      };
    })
    .filter((item, index, self) => {
      if (!item) return false;
      const val = item[idKey];
      return index === self.findIndex((t) => {
        return t && t[idKey] === val;
      });
    });

  lastTableData = uniqueData;
  
  // =================================================================
  // 6. Tabellen-Logik: Absolut krisensicheres Instanz-Management
  // =================================================================
  
  // Wir prüfen, ob im Gedächtnis bereits eine Tabulator-Instanz existiert
  if (table) {

    // Wenn die Instanz existiert, aktualisieren wir einfach NUR die Daten!
    // Das verhindert den berüchtigten "this.dataLoader.load is not a function" Fehler im Popout.
    table.replaceData(uniqueData);

    // Wir merken uns den aktuellen Layer auf dem Element
    tableElement.setAttribute("data-current-layer", normalizedName);
    
  } else {
    // NUR WENN NOCH GAR KEINE TABELLE EXISTIERT, BAUEN WIR SIE EINMALIG NEU:
    tableElement.innerHTML = "";
    tableElement.setAttribute("data-current-layer", normalizedName);
    
    try {
      // Wir übergeben das direkte HTML-Element
      table = new Tabulator(tableElement, {
        data: uniqueData,
        height: "100%",
        layout: "fitDataStretch",
        persistenceID: "wms_table_" + normalizedName,
        movableColumns: true,
        placeholder: "Keine Objekte im Sichtbereich.",
        autoColumns: true,
        selectable: 1,
        selectableRows: true,
        persistence: {
          sort: true,
          filter: true,
          columns: true,
          scroll: true,
        },
        persistenceMode: "local",
        resizableColumns: true,
        columnDefaults: {
          resizable: true,
          headerSort: true,
        },
        autoColumnsDefinitions: function(definitions) {
          definitions.forEach((column) => {
            column.formatter = function(cell) {
              const value = cell.getValue();
              if (!value) return value;
              if (isUrl(value)) {
                return `<span class="table-link">${cell.getColumn().getDefinition().title}</span>`;
              }
              return value;
            };
            column.headerContextMenu = [
              { label: "Spalte ausblenden", action: (e, col) => col.hide() },
              { label: "🔄 Alles zurücksetzen", action: () => resetBtn.click() }
            ];
            column.headerFilter = "input";
            column.headerFilterPlaceholder = "Suche...";
            if (column.field === "stat_von") column.sorter = "number";
            column.headerFilterFunc = function(headerValue, rowValue) {
              if (!headerValue) return true;
              const val = String(rowValue || "").trim();
              const search = String(headerValue).trim();
              const match = search.match(/^(<=|>=|<|>)\s*(\d+(?:\.\d+)?)$/);
              if (match) {
                const op = match[1], numS = parseFloat(match[2]), numR = parseFloat(val);
                if (isNaN(numR)) return false;
                if (op === "<") return numR < numS;
                if (op === ">") return numR > numS;
                if (op === "<=") return numR <= numS;
                if (op === ">=") return numR >= numS;
              }
              return new RegExp(search.replace(/\*/g, ".*"), "i").test(val);
            };
          });
          return definitions;
        },
      });
    } catch (err) {
      console.error("Tabulator Initialisierungs-Fehler:", err);
    }
   
  }

setupTableEvents(table, tableElement, idKey, activeLayerName);
}
// Hilfsfunktion für die Events (um showTable übersichtlich zu halten)
function setupTableEvents(table, tableElement, idKey, layerName) {
  
  table.on("tableBuilt", () => {
    tableElement.setAttribute("tabindex", "0");
    focusTable(tableElement);
  });
 
  // ROW SELECTION
  table.on("rowSelectionChanged", (data, rows) => {
    if (!rows.length) return;
    const row = rows[0];
    highlightFeatureForRow(row.getData());
  });
 
  // MOUSE OVER
 
  table.on("rowMouseOver", (e, row) => {
    if (interactionMode === "keyboard") return;
    highlightFeatureForRow(row.getData());
  });
  table.on("rowMouseOut", () => {
    if (interactionMode === "keyboard") return;
    clearHighlightedFeature();
  });
  // =====================================================
  // ROW CLICK
  // =====================================================
  table.on("rowClick", (e, row) => {
    interactionMode = "mouse";
    selectAndHighlightRow(table, row);
    focusTable(tableElement);
  });
  // =====================================================
  // DOUBLE CLICK → ZOOM
  // =====================================================
  table.on("rowDblClick", (e, row) => {
    const rowData = row.getData();
    zoomToFeature(layerName, rowData);
  });
  // =====================================================
  // ROW Cell CLICK
  // =====================================================
  table.on("cellClick", (e, cell) => {
    const value = cell.getValue();
    if (!value) return;
    // 👉 URL öffnen
    if (isUrl(value)) {
      e.stopPropagation();
      window.open(
        value.startsWith("http")
          ? value
          : "https://" + value,
        "_blank"
      );
      return;
    }

    // 👉 normale Tabellenlogik
    const row = cell.getRow();
    highlightFeatureForRow(row.getData());
  });

  // =====================================================
  // KEYBOARD NAVIGATION
  // =====================================================
  tableElement.onkeydown = (e) => {
    const rows = table.getRows();
    if (!rows.length) return;
    const selected = table.getSelectedRows()[0];

    // -------------------------------------------------
    // UP / DOWN
    // -------------------------------------------------
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      interactionMode = "keyboard";
      e.preventDefault();
      let nextRow;
      if (!selected) {
        nextRow = rows[0];
      } else {
        nextRow = e.key === "ArrowDown"
          ? selected.getNextRow()
          : selected.getPrevRow();
      }

      if (nextRow) {
        selectAndHighlightRow(table, nextRow);
      }
    }

    // -------------------------------------------------
    // ENTER → ZOOM
    // -------------------------------------------------

    if (e.key === "Enter") {
      e.preventDefault();
      zoomSelectedRow(table, layerName);
    }

    // -------------------------------------------------
    // ESC → Highlight entfernen
    // -------------------------------------------------
    if (e.key === "Escape") {
      clearHighlightedFeature();
      table.deselectRow();
    }
  };

  // =====================================================
  // MOUSEMOVE → zurück zu Mausmodus
  // =====================================================

  tableElement.addEventListener("mousemove", () => {
    interactionMode = "mouse";
  });

  let pressTimer;
  table.on("rowTouchStart", (e, row) => {
    pressTimer = setTimeout(() => {
      zoomToFeature(layerName, row.getData());
    }, 50);
  });

  table.on("rowTouchEnd", () => {
    clearTimeout(pressTimer);
  });

  table.on("rowTouchMove", () => {
    clearTimeout(pressTimer);
  });
  // 👉 MOBILE TAP
  table.on("cellTap", (e, cell) => {
    const value = cell.getValue();
    // 👉 URL?
    if (value && isUrl(value)) {
        e.stopPropagation();
        window.open(
        value.startsWith("http")
          ? value
          : "https://" + value,
        "_blank"
      );
      return;
    }
    const row = cell.getRow();
    table.deselectRow();
    row.select();
    highlightFeatureForRow(row.getData());
  });
  // 👉 MOBILE DOUBLE TAP
  table.on("cellDblTap", (e, cell) => {
    const row = cell.getRow();
    zoomToFeature(layerName, row.getData());
  });
  
}

export function showTableDebounced(data) {
  clearTimeout(showTableTimeout);
  showTableTimeout = setTimeout(() => {
    showTable(data);
  }, 50);  // 👈 75ms perfekt
}
// Tabelle schließen
export function closeTable() {
  isTableActive = false; 
  clearHighlightedFeature(); 

  // 1. Split.js sauber zerstören
  if (splitInstance) { 
    splitInstance.destroy(); 
    splitInstance = null; 
    console.log('Splitinstanz zerstört')
  }

  const tableDoc = getTableDocument();
  let tableContainer = tableDoc ? tableDoc.getElementById('table-container') : null;
  if (!tableContainer && tableDoc !== document) {
    tableContainer = document.getElementById('table-container');
  }

  if (tableContainer) {
    // unsichtbar machen
    tableContainer.style.display = 'none';

    // wichtig!
    tableContainer.style.width = '';
    tableContainer.style.height = '';
    tableContainer.style.flexBasis = '';
    tableContainer.style.pointerEvents = 'none';

    console.log("tabelcontainer ausgeschaltet")
  }

  // Karte wieder auf volle Größe
  const mapDiv = document.getElementById('map');

  if (mapDiv) {
    mapDiv.style.width = '100%';
    mapDiv.style.flexBasis = '100%';
  }

  // EXTREM wichtig bei OpenLayers
  setTimeout(() => {
    mapRef.updateSize();
  }, 50);

  mapRef.updateSize();

  const childWindow = tableChildWindow;
  if (childWindow && !childWindow.closed) {
    childWindow._closingFromApp = true;
    // Zuerst die Tabelle zurück in das Hauptfenster bringen,
    // damit sie nach Schließen des Popouts wieder verfügbar ist.
    returnFromPopout();
    childWindow.close();
  }
  tableChildWindow = null;

  deactivateTableToggle();
}
export function switchLayerData(results) {
  const selector = getTableDocument().getElementById('layer-selector');
  if (!selector) return;
  const selectedLayer = selector.value;
  const entry = results[selectedLayer];
  if (!entry) return;
  // =====================================================
  // Nur echte Datensätze holen
  // =====================================================
  const data =
    Array.isArray(entry)
      ? entry
      : entry.data || [];

  // =====================================================
  // Vector + WMS vereinheitlichen
  // =====================================================

  const normalizedData =
    data.map(item =>
      item.properties || item
    );

  showTableDebounced(normalizedData);
  console.log("tabelle angezeigt durch switchLayer")
}
export function getTableActive() {
  return isTableActive;
}
function initResizeObserver() {
  const tableContainer = document.getElementById("wms_data_table");
  if (!tableContainer) return;
  resizeObserver = new ResizeObserver(() => {
    if (!tableReady) return; 
    if (!table || !table.element) return;
    if (table.element.offsetParent === null) return;
    if (table && table.element) {
      try {
        table.redraw(true);   // sanft + stabil
      } catch (e) {}
    }
    if (mapRef) {
      mapRef.updateSize();
    }
  });
  resizeObserver.observe(tableContainer);
}
export function clearHighlightedFeature() {
  if (highlightedFeature) {
    highlightedFeature.setStyle(undefined);
    highlightedFeature = null;
  }
}
export function highlightFeatureForRow(rowData) {
  const layerName = rowData.origin_layer || 
                    (getTableDocument().getElementById('layer-selector') ? getTableDocument().getElementById('layer-selector').value : null);
  if (!layerName) {
    console.warn("Highlight abgebrochen: Kein LayerName in rowData oder Selector gefunden.", rowData);
    return;
  }
  let idKey = null;
  clearHighlightedFeature();
  if (!mapRef) return;
  const selector = getTableDocument().getElementById('layer-selector');
  if (!layerName) {
    console.warn("Highlight abgebrochen: Kein LayerName gefunden");
    return;
  }
  let targetLayer = null;
  mapRef.getLayers().getArray().forEach((l) => {
    if (l.get('name') === layerName) targetLayer = l;
    if (!targetLayer && l.getLayers) {
      l.getLayers().getArray().forEach((subL) => {
        if (subL.get('name') === layerName) targetLayer = subL;
      });
    }
  });
  //nsole.log ("Targetlayer: ",targetLayer)
  if (!targetLayer) return;
  const source = targetLayer.getSource();
  if (!source || typeof source.getFeatures !== 'function') return;
  const normalizedName = layerName.toLowerCase();
  // Schlüssel bestimmen je nach Layer
  if (normalizedName === 'fsk') {
      idKey = 'OBJECTID';
  } else if (normalizedName.startsWith("shapefile")) {
      idKey = 'objectid';
  } else if (normalizedName === 'gew_umn' || normalizedName === 'umnlin') {
      idKey = 'ID_Umn';
  } else {
      idKey = 'ID_con';
  }

  // 3. Feature suchen
  const features = source.getFeatures();
  const feature = features.find((f) => {
  const props = f.getProperties();
    
  // dynamisch vergleichen mit dem Wert des jeweiligen Keys
  const featId = props[idKey];
  const rowId = rowData[idKey];
  return featId !== null && 
           featId !== undefined && 
           String(featId) === String(rowId);
  });

  if (!feature) {
    console.warn(`Feature mit ${idKey} ${rowData[idKey]} in Layer ${layerName} nicht gefunden.`);
    return;
  }

  // 4. Highlight setzen
  feature.setStyle(hoverHighlightStyle);
  highlightedFeature = feature;
}
function zoomToFeature(layerName, rowData) {
  if (!mapRef) return;
  // 👉 Layer rekursiv suchen
  const layer = getLayerByName(layerName);
  console.log("Gefundener Layer:", layer);
  if (!layer) {
    console.warn("Layer nicht gefunden:", layerName);
    return;
  }
  const source = layer.getSource();
  // 👉 Nur echte VectorLayer erlauben
  if (!source || typeof source.getFeatures !== "function") {
    console.warn("Zoom übersprungen (kein Vektorlayer):", layerName);
    return;
  }

  const features = source.getFeatures();
  if (!features.length) {
    console.warn("Keine Features im Layer:", layerName);
    return;
  }

  // 👉 passende ID bestimmen
  const idKey = rowData.ID_con !== undefined
    ? "ID_con"
    : rowData.OBJECTID !== undefined
      ? "OBJECTID"
      : null;

  if (!idKey) {
    console.warn("Keine passende ID gefunden");
    return;
  }

  // 👉 passendes Feature suchen
  const found = features.find(f =>
    String(f.get(idKey)) === String(rowData[idKey])
  );

  if (!found) {
    console.warn("Feature nicht gefunden:", rowData);
    return;
  }

  const geometry = found.getGeometry();
  if (!geometry) {
    console.warn("Feature ohne Geometrie");
    return;
  }

  const extent = geometry.getExtent();
  mapRef.getView().fit(extent, {
    padding: [50, 50, 50, 50],
    duration: 800,
    maxZoom: 16
  });
}
function zoomSelectedRow(table, layerName) {
  const selected = table.getSelectedRows()[0];
  if (!selected) return;
  
  zoomToFeature(layerName, selected.getData());
}
function selectAndHighlightRow(table, row) {
  if (!row) return;

  table.deselectRow();
  row.select();

  row.getElement().scrollIntoView({
    block: "nearest",
    inline: "nearest"
  });

  highlightFeatureForRow(row.getData());
}
function focusTable(tableElement) {
  if (window.innerWidth > 768) {
    tableElement.focus({ preventScroll: true });
  }
}
function isUrl(value) {
  if (!value) return false;
  return /^https?:\/\/|^www\./i.test(value);
}


export function detachTableWindow() { // Kein Parameter mehr nötig!
    const tableContainer = document.getElementById('table-container');
    if (!tableContainer) return;

    // TRICK: Holt sich die aktive Tabulator-Instanz direkt vom HTML-Element
    const tableInstance = Tabulator.findTable("#wms_data_table")[0]; 
    if (!tableInstance) {
        alert("Bitte öffne zuerst die Tabelle über den Button auf der Karte, bevor du sie auslagerst.");
        return;
    }

    // 1. Neues Browserfenster öffnen
    tableChildWindow = window.open('', 'TablePopout', 'width=1200,height=600,scrollbars=yes,resizable=yes');
    if (!tableChildWindow) {
        alert("Pop-up-Blocker aktiv? Bitte erlaube Pop-ups für diese Seite.");
        return;
    }

    tableChildWindow.document.title = "Attributtabelle";

    // Styles der Hauptseite rüberkopieren (inkl. style.css)
    tableChildWindow.document.head.innerHTML = '';
    Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style')).forEach((styleEl) => {
        tableChildWindow.document.head.appendChild(styleEl.cloneNode(true));
    });

    // Container komplett in das neue Fenster verschieben
    tableChildWindow.document.body.style.margin = "0";
    tableChildWindow.document.body.style.padding = "0";
    tableChildWindow.document.body.appendChild(tableContainer);

    const popoutBtn = tableChildWindow.document.getElementById('popout-table-btn');
    if (popoutBtn) {
      popoutBtn.style.display = 'none';
    }

    tableContainer.style.display = 'flex'; 
    tableContainer.style.width = '100%';
    tableContainer.style.minWidth = '0';
    tableContainer.style.height = '100vh'; 

    // Tabulator im neuen Fenster die Breite neu berechnen lassen
    setTimeout(() => {
        tableInstance.redraw(true);
        requestAnimationFrame(() => {
          tableInstance.redraw(true);
          tableInstance.getColumns().forEach((col) => {
            if (typeof col.getWidth === 'function' && col.getWidth()) {
              col.setWidth(col.getWidth());
            }
          });
        });
    }, 100);

    const childSelector = tableChildWindow.document.getElementById('layer-selector');
    if (childSelector) {
      childSelector.addEventListener('change', () => {
        if (typeof window.opener !== 'undefined' && window.opener && typeof window.opener.refreshTableFromSelector === 'function') {
          window.opener.refreshTableFromSelector();
        }
      });
    }

    const childCloseBtn = tableChildWindow.document.getElementById('close-table-btn');
    if (childCloseBtn) {
      childCloseBtn.addEventListener('click', () => {
        closeTable();
        if (tableChildWindow && !tableChildWindow.closed) {
          tableChildWindow._closingFromApp = true;
          tableChildWindow.close();
        }
      });
    }

    tableChildWindow._closingFromApp = false;
    tableChildWindow.onbeforeunload = () => {
        if (tableChildWindow && tableChildWindow._closingFromApp) {
          return;
        }
        returnFromPopout();
        deactivateTableToggle();
        tableChildWindow = null;
    };
}
// Funktion, um die Tabelle wieder sauber in die Hauptseite einzugliedern
function returnFromPopout() {
    const parentWindow = (typeof window !== 'undefined' && window.opener) ? window.opener : window;
    const parentDoc = parentWindow.document;
    const mainLayout = parentDoc.getElementById('main-layout');

    let tableContainer = parentDoc.getElementById('table-container');
    if (!tableContainer && window.document) {
      tableContainer = window.document.getElementById('table-container');
    }
    if (!tableContainer && tableChildWindow && tableChildWindow.document) {
      tableContainer = tableChildWindow.document.getElementById('table-container');
    }

    if (tableContainer && mainLayout) {
        // Tabelle wieder im Hauptlayout einhängen
        mainLayout.appendChild(tableContainer);
        
        // Popout-Button wieder anzeigen, wenn er existiert
        const popoutBtn = tableContainer.querySelector('#popout-table-btn');
        if (popoutBtn) {
          popoutBtn.style.display = '';
        }

        // CSS wieder auf die Split-Größe zurücksetzen
        tableContainer.style.height = '50vh';
        tableContainer.style.display = 'flex';
        tableContainer.style.pointerEvents = 'auto';
        tableContainer.style.width = '100%';
        tableContainer.style.minWidth = '0';
        tableContainer.style.flexBasis = '';

        tableChildWindow = null;

        if (typeof mapRef?.updateSize === 'function') {
          mapRef.updateSize();
        }

        if (lastTableData.length > 0) {
          setTimeout(() => {
            showTable(lastTableData);
          }, 0);
        }

        console.log("Tabelle erfolgreich zurückgeholt.");
    }
}
// Ganz unten in table.js hinzufügen:
export function getTableChildWindow() {
    return tableChildWindow;
}

// Gibt das Document-Objekt des Fensters zurück, in dem die Tabelle GERADE lebt
export function getTableDocument() {
    if (tableChildWindow && !tableChildWindow.closed) {
        return tableChildWindow.document;
    }
    return document; // Hauptfenster-Dokument als Fallback
}

// Hilfsfunktion, um Elemente flexibel in beiden Fenstern zu finden
export function getTableElement(id) {
    const doc = getTableDocument();
    return doc.getElementById(id);
}