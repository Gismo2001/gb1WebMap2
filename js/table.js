import { TabulatorFull as Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';
import Split from 'split.js';
import { deactivateTableToggle } from './controls'; 

import { getLayerByName } from './utils'; 

let splitInstance = null;
let isTableActive = false; 

export let mapRef = null;
export let table = null;

let resizeObserver = null;
let tableReady = false;
let showTableTimeout;


import Style from 'ol/style/Style';
import Stroke from 'ol/style/Stroke';
import Fill from 'ol/style/Fill';
import CircleStyle from 'ol/style/Circle';

import { isTableEnabled } from './controls';

let highlightedFeature = null;
let clickTimeout = null;

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
  
  const selector = document.getElementById('layer-selector');
  if (!selector) return;
  // 1. Den aktuell ausgewählten Wert zwischenspeichern
  const previousSelection = selector.value;
  // 2. Das Dropdown neu aufbauen
  selector.replaceChildren();
  names.forEach((name) => {
    const option = document.createElement('option');
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
  if (!Array.isArray(data)) {data = data ? [data] : []; } data = data.map(item => {
    const clean = {};
    Object.entries(item).forEach(([key, value]) => {
    // komplexe Objekte überspringen
      if (
        typeof value === 'object' &&
        value !== null
      ) {
        return;
      }
      clean[key] = value;
    });
    return clean;
  });
  isTableActive = true;
  const container = document.getElementById("wms-table-container");
  const tableElement = document.getElementById("wms_data_table");
  const filterBtn = document.getElementById("filter-toggle");
  const resetBtn = document.getElementById("table-reset");

  if (!container || !tableElement) return;

  // 👉 1. UI-Zustand (Container & Split)
  container.style.display = "flex";
  const mapElement = document.getElementById("map");
  if (mapElement) mapElement.style.height = "";

  if (!splitInstance) {
    splitInstance = Split(['#map', '#wms-table-container'], {
      sizes: [70, 30],
      minSize: [100, 0],
      direction: 'vertical',
      gutterSize: 10,
      onDrag: () => { if (mapRef) mapRef.updateSize(); },
      onDragEnd: (sizes) => { if (sizes[1] <= 5) closeTable(); }
    });
  }
  if (mapRef) mapRef.updateSize();

  // 👉 2. Layer & Daten bestimmen (Muss vor dem Reset-Button kommen!)
  const selector = document.getElementById('layer-selector');
  const layerName = selector ? selector.value : "unknown";
  const normalizedName = layerName.toLowerCase();
  let idKey;

  // 1. Deine expliziten Zuweisungen
  if (normalizedName === 'fsk') {
    idKey = 'OBJECTID';
  } else if (normalizedName.startsWith('shapefile')) {
    idKey = 'objectid';
  } else {
    // 2. Dynamische Erkennung für WMS und unbekannte Layer
    if (data && data.length > 0) {
      // Wir nehmen das erste Element, das tatsächlich ein Objekt ist
      const firstItem = data.find(item => item !== null && typeof item === 'object');
      if (firstItem) {
        const commonKeys = ['ID_con', 'id', 'gml_id', 'OBJECTID', 'objectid', 'FID'];
        // Sicherer Check mit dem optionalen Chaining oder Prüfung von firstItem
        idKey = commonKeys.find(key => key in firstItem);
        if (!idKey) {
          idKey = Object.keys(firstItem)[0]; 
          console.warn(`Kein bekannter ID-Key gefunden. Nutze Fallback: ${idKey}`);
        }
      } else {
        // Fallback, wenn data nur aus null/undefined besteht
        idKey = 'ID_con';
      }
    } else {
        idKey = 'ID_con';
    }
  }
  // 👉 3. Reset-Button Logik (Jetzt kennt er normalizedName korrekt)
  if (resetBtn) {
    resetBtn.onclick = () => {
      if (table) {
        const storageId = "tabulator-wms_table_" + normalizedName;
        localStorage.removeItem(storageId);
        table.destroy();
        table = null;
        showTable(data); 
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
  // 👉 5. Daten vorbereiten (mit Safety-Check)
  const uniqueData = (data || []).filter((item, index, self) => {
    // 1. Check: Existiert das Item überhaupt?
    if (!item) return false;
    const val = item[idKey];
    // 2. Check: Wenn das Item den Key gar nicht hat, trotzdem behalten (oder filtern)
    // Wir erlauben das Item, wenn val null/undefined ist, aber wir müssen 
    // beim findIndex extrem vorsichtig sein:
    return index === self.findIndex((t) => {
      return t && t[idKey] === val; // t && stellt sicher, dass t nicht undefined ist
    });
  });
  
  // 👉 6. Tabellen-Logik: Update oder Neubau
  const previousLayer = tableElement.getAttribute("data-current-layer");

  if (table && previousLayer === normalizedName) {
    table.replaceData(uniqueData);
  } else {
    if (table) { table.destroy(); table = null; }
    tableElement.innerHTML = "";
    tableElement.setAttribute("data-current-layer", normalizedName);
    try {
      table = new Tabulator("#wms_data_table", {
        data: uniqueData,
        height: "100%",
        layout: "fitData",
        persistenceID: "wms_table_" + normalizedName,
        movableColumns: true,
        placeholder: "Keine Objekte im Sichtbereich.",
        autoColumns: true,
        selectable: 1,
        selectableRows:true, //make rows selectable
        persistence: {
          sort: true,
          filter: true,
          columns: true,
          scroll: true,
        },
        persistenceMode: "local", 
        autoColumnsDefinitions: function(definitions) {
          definitions.forEach((column) => {
            // URL‑Formatter
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
     
      setupTableEvents(table, tableElement, idKey, layerName);

    } catch (err) {
      console.error("Tabulator Fehler:", err);
    }
  }
}
// Hilfsfunktion für die Events (um showTable übersichtlich zu halten)
function setupTableEvents(table, tableElement, idKey, layerName) {
  // =====================================================
  // TABLE BUILT
  // =====================================================
  table.on("tableBuilt", () => {
    tableElement.setAttribute("tabindex", "0");
    focusTable(tableElement);
  });
  // =====================================================
  // ROW SELECTION
  // =====================================================
  table.on("rowSelectionChanged", (data, rows) => {
    if (!rows.length) return;
    const row = rows[0];
    highlightFeatureForRow(row.getData());
  });
  // =====================================================
  // MOUSE OVER
  // =====================================================
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
    }, 600);
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
  }, 150);  // 👈 150ms perfekt
}
// Tabelle schließen
export function closeTable() {
  isTableActive = false; 
  clearHighlightedFeature(); 
  if (splitInstance) { 
    splitInstance.destroy(); 
    splitInstance = null; 
  }
  document.getElementById("wms-table-container").style.display = "none";
  deactivateTableToggle();
}
export function switchLayerData(results) {
  const selector = document.getElementById('layer-selector');
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
                    (document.getElementById('layer-selector') ? document.getElementById('layer-selector').value : null);
  if (!layerName) {
    console.warn("Highlight abgebrochen: Kein LayerName in rowData oder Selector gefunden.", rowData);
    return;
  }
  let idKey = null;
  clearHighlightedFeature();
  if (!mapRef) return;
  const selector = document.getElementById('layer-selector');
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
