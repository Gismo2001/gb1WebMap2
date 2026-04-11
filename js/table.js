import { TabulatorFull as Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';
import Split from 'split.js';
import { deactivateTableToggle } from './controls';

let splitInstance = null;
let isTableActive = false; 
let mapRef = null;
let table = null;
let resizeObserver = null;
let tableReady = false;
let showTableTimeout;

export function initTable(map) {
  mapRef = map;
}

export function updateSelector(names) {
  const selector = document.getElementById('layer-selector');
  if (!selector) return;

  // 1. Den aktuell ausgewählten Wert zwischenspeichern
  const previousSelection = selector.value;
// 2. Das Dropdown neu aufbauen
  selector.innerHTML = names.map(name =>
    `<option value="${name}">${name}</option>`
  ).join('');
  // 3. Prüfen, ob der alte Wert in der neuen Liste noch existiert
  if (names.includes(previousSelection)) {
    selector.value = previousSelection;
  } else {
    // Optional: Falls der alte Layer weg ist, beim ersten bleiben 
    // oder eine Standardaktion ausführen.
    console.log("Vorheriger Layer nicht mehr in der Liste.");
  }
}


// 👇 außerhalb der Funktion!
let clickTimeout = null;

export function showTable(data) {
  isTableActive = true;
  const container = document.getElementById("wms-table-container");
  const tableElement = document.getElementById("wms_data_table");
  if (!container || !tableElement) return;
  container.style.display = "flex";
  if (!splitInstance) {
    splitInstance = Split(['#map', '#wms-table-container'], {
      sizes: [70, 30],
      minSize: [150, 100],
      direction: 'vertical',
      gutterSize: 10,
      onDrag: () => {
        if (mapRef) mapRef.updateSize();
      }
    });
  } else {
    //splitInstance.setSizes([70, 30]);
  }

  if (mapRef) mapRef.updateSize();

  if (!data || data.length === 0) {
    console.warn("Keine Daten für die Tabelle übergeben.");
    return;
  }

  const uniqueData = data.filter((item, index, self) => {
    if (!item.ID_con) return true;
    return index === self.findIndex((t) => t.ID_con === item.ID_con);
  });

  if (table) {
    table.destroy();
    table = null;
  }

  tableReady = false;
  tableElement.innerHTML = "";

  table = new Tabulator("#wms_data_table", {
    data: uniqueData,
    height: "100%",
    layout: "fitData",
    autoColumns: true,
    headerVisible: true,
   
  });

  table.on("tableBuilt", () => {
    tableReady = true;
    if (!resizeObserver) {
      initResizeObserver();
    }
    // 👉 MANUELLER DOPPELKLICK-BYPASS
      const tableHolder = tableElement.querySelector(".tabulator-tableholder");
      if (tableHolder) {
        tableHolder.ondblclick = (e) => {
          const rowElement = e.target.closest(".tabulator-row");
          if (rowElement) {
            const row = table.getRow(rowElement);
            if (row) {
              const rowData = row.getData();
              const selector = document.getElementById('layer-selector');
              const layerName = selector ? selector.value : null;

              console.log("Manueller Doppelclick auf ID_con:", rowData.ID_con);
              if (mapRef && layerName) {
                zoomToFeature(layerName, rowData);
              }
            }
          }
        };
        }
  });
}
export function closeTable() {
  isTableActive = false;
  if (splitInstance) {
    splitInstance.destroy();
    splitInstance = null;
  }
  if (resizeObserver) {
  resizeObserver.disconnect();
  resizeObserver = null;
  }
  

  document.getElementById("wms-table-container").style.display = "none";
  deactivateTableToggle();
  
  if (mapRef) {
    // WICHTIG: Karte muss wieder den ganzen Platz einnehmen
    const mapElement = document.getElementById("map");
    if (mapElement) mapElement.style.height = "100%";
    mapRef.updateSize();
  }
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

export function showTableDebounced(data) {

  clearTimeout(showTableTimeout);

  showTableTimeout = setTimeout(() => {
    showTable(data);
  }, 150);  // 👈 150ms perfekt
}

function zoomToFeature(layerName, rowData) {
  console.log("--- Zoom-Vorgang gestartet ---");
  console.log("Layer:", layerName, "ID_con gesucht:", rowData.ID_con);
  if (!mapRef) return;
  // Layer finden
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
  console.log("Anzahl Features im Source:", features.length);

  // Suche nach ID_con
  const foundFeature = features.find(f => {
    const props = f.getProperties();
    // String-Vergleich um Typ-Konflikte (Zahl vs Text) zu vermeiden
    return props.ID_con && String(props.ID_con) === String(rowData.ID_con);
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
    console.warn("ID_con '" + rowData.ID_con + "' nicht in den Source-Features gefunden.");
    if (features.length > 0) {
      console.log("Beispiel-ID aus erstem Feature:", features[0].get('ID_con'));
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