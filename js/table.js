import { TabulatorFull as Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';
import Split from 'split.js';
import { deactivateTableToggle } from './controls'; 

let splitInstance = null;
let isTableActive = false; 
let mapRef = null;
export let table = null;
let resizeObserver = null;
let tableReady = false;
let showTableTimeout;


import Style from 'ol/style/Style';
import Stroke from 'ol/style/Stroke';
import Fill from 'ol/style/Fill';
import CircleStyle from 'ol/style/Circle';

let highlightedFeature = null;
let clickTimeout = null;


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

  let idKey = (normalizedName === 'fsk') ? 'OBJECTID' : 
             (normalizedName.startsWith('shapefile')) ? 'objectid' : 'ID_con';

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

  // 👉 5. Daten vorbereiten
  const uniqueData = (data || []).filter((item, index, self) => {
    const val = item[idKey];
    if (val === null || val === undefined) return true;
    return index === self.findIndex((t) => t[idKey] === val);
  });

  // 👉 6. Tabellen-Logik: Update oder Neubau
  const previousLayer = tableElement.getAttribute("data-current-layer");

  if (table && previousLayer === normalizedName) {
    table.replaceData(uniqueData);
  } else {
    if (table) {
      table.destroy();
      table = null;
    }
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
        persistence: {
          sort: true,
          filter: true,
          columns: true,
          scroll: true,
        },
        persistenceMode: "local", 
        autoColumnsDefinitions: function(definitions) {
          definitions.forEach((column) => {
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
  let isKeyboard = false;

  table.on("tableBuilt", () => {
    tableElement.setAttribute("tabindex", "0");
    if (window.innerWidth > 768) tableElement.focus({ preventScroll: true });
  });

  table.on("rowMouseOver", (e, row) => { if (!isKeyboard) highlightFeatureForRow(row.getData()); });
  table.on("rowMouseOut", () => { if (!isKeyboard) clearHighlightedFeature(); });
  
  table.on("rowClick", (e, row) => {
    isKeyboard = false;
    table.deselectRow();
    row.select();
    highlightFeatureForRow(row.getData());
  });

  tableElement.onkeydown = (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      isKeyboard = true;
      e.preventDefault();
      const selected = table.getSelectedRows()[0];
      const next = (e.key === "ArrowDown") ? (selected?.getNextRow() || table.getRows()[0]) : selected?.getPrevRow();
      if (next) {
        table.deselectRow();
        next.select();
        next.getElement().scrollIntoView({ block: "nearest" });
        highlightFeatureForRow(next.getData());
      }
    }
    if (e.key === "Enter") {
      const selected = table.getSelectedRows()[0];
      if (selected) zoomToFeature(layerName, selected.getData());
    }
  };
  
  tableElement.addEventListener("mousemove", () => { isKeyboard = false; });
}
export function showTableDebounced(data) {
  clearTimeout(showTableTimeout);
  showTableTimeout = setTimeout(() => {
    showTable(data);
  }, 150);  // 👈 150ms perfekt
}


// Tabelle schließen
export function closeTable() {
  isTableActive = false; // Status auf false setzen
  clearHighlightedFeature(); // Alle Hervorhebungen in der Karte entfernen
  if (splitInstance) { // Wenn eine Split.js-Instanz existiert
    splitInstance.destroy(); // Split.js-Instanz zerstören, damit die Karte wieder 100% bekommt
    splitInstance = null; // Referenz zurücksetzen
  }
  // ... restliche Aufräumarbeiten wie gehabt
  document.getElementById("wms-table-container").style.display = "none";
  deactivateTableToggle();
  // ... Karte auf 100% setzen
}

export function switchLayerData(results) {
  const selector = document.getElementById('layer-selector');
  if (!selector) return;
  const selectedLayer = selector.value;
  const data = results[selectedLayer];
  if (data) {
    // Da sich beim Layer-Wechsel die Spalten ändern, 
    // nutzen wir showTable, um die Tabelle sauber neu zu initialisieren.
    showTableDebounced(data);
  }
}

export function getTableActive() {
  return isTableActive;
}


function zoomToFeature(layerName, rowData) {
  if (!mapRef) return;
  let targetLayer = null;
  mapRef.getLayers().getArray().forEach(l => {
    if (l.get('name') === layerName) targetLayer = l;
    // Falls Layer in Gruppen sind:
    if (!targetLayer && l.getLayers) {
       l.getLayers().getArray().forEach(subL => {
         if (subL.get('name') === layerName) targetLayer = subL;
       });
    }
  });

  if (!targetLayer) {
    console.error("Layer '" + layerName + "' nicht auf Karte gefunden.");
    return;
  }

  const source = targetLayer.getSource();
  const features = source.getFeatures();
  //console.log("Anzahl Features im Source:", features.length);

  // Suche nach ID_con
  const foundFeature = features.find(f => {
    const props = f.getProperties();
    // String-Vergleich um Typ-Konflikte (Zahl vs Text) zu vermeiden
    return props.ID_con !== null &&
      props.ID_con !== undefined &&
      String(props.ID_con) === String(rowData.ID_con);
  });

  if (foundFeature) {
    console.log("Feature gefunden! Zoome...");
    const extent = foundFeature.getGeometry().getExtent();
    mapRef.getView().fit(extent, {
      padding: [50, 50, 50, 50],
      duration: 800,
      maxZoom: 20
    });
  } else {
    //console.warn("ID_con '" + rowData.ID_con + "' nicht in den Source-Features gefunden.");
    if (features.length > 0) {
      //console.log("Beispiel-ID aus erstem Feature:", features[0].get('ID_con'));
    }
  }
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

function clearHighlightedFeature() {
  if (highlightedFeature) {
    highlightedFeature.setStyle(undefined);
    highlightedFeature = null;
  }
}

export function highlightFeatureForRow(rowData) {
  let idKey = null;
  clearHighlightedFeature();
  if (!mapRef) return;
  const selector = document.getElementById('layer-selector');
  const layerName = selector ? selector.value : null;
  
  
  if (!layerName) return;
  let targetLayer = null;
  
  mapRef.getLayers().getArray().forEach((l) => {
   
    if (l.get('name') === layerName) targetLayer = l;
    
    if (!targetLayer && l.getLayers) {
      
      l.getLayers().getArray().forEach((subL) => {
        if (subL.get('name') === layerName) targetLayer = subL;
      });
    }
  });
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
    
    // Wir vergleichen dynamisch den Wert des jeweiligen Keys
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