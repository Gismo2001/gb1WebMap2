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


import Style from 'ol/style/Style';
import Stroke from 'ol/style/Stroke';
import Fill from 'ol/style/Fill';
import CircleStyle from 'ol/style/Circle';

let highlightedFeature = null;

const hoverHighlightStyle = new Style({
  stroke: new Stroke({
    color: '#ff9900',
    width: 4,
  }),
  fill: new Fill({
    color: 'rgba(255, 153, 0, 0.2)',
  }),
  image: new CircleStyle({
    radius: 8,
    fill: new Fill({ color: '#ff9900' }),
    stroke: new Stroke({ color: '#ffffff', width: 2 }),
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
    // Optional: Falls der alte Layer weg ist, beim ersten bleiben 
    // oder eine Standardaktion ausführen.
    console.log("Vorheriger Layer nicht mehr in der Liste.");
  }
}

// 👇 außerhalb der Funktion!
let clickTimeout = null;

export function showTable(data) {
  console.log("showTable aufgerufen mit", data ? data.length : 0, "Zeilen");
  
  isTableActive = true;
  const container = document.getElementById("wms-table-container");
  const tableElement = document.getElementById("wms_data_table");
  
  if (!container || !tableElement) {
    console.error("Tabellen-Container im HTML nicht gefunden!");
    return;
  }

  // 1. Daten-Check
  if (!data || data.length === 0) {
    console.warn("Keine Daten geliefert.");
    closeTable();
    return;
  }

  // 2. Container SOFORT anzeigen (damit die App nicht hängen bleibt)
  container.style.display = "flex";

  // 3. ID-Key sicher bestimmen
  const selector = document.getElementById('layer-selector');
  const layerName = selector ? selector.value : "unknown";
  const idKey = (layerName === 'fsk') ? 'OBJECTID' : 'ID_con';
  
  console.log(`Nutze Layer: ${layerName}, ID-Feld: ${idKey}`);

  // 4. Dubletten-Filter (mit Sicherheits-Check)
  const uniqueData = data.filter((item, index, self) => {
    const val = item[idKey];
    if (val === null || val === undefined) return true; // Ohne ID immer behalten
    return index === self.findIndex((t) => t[idKey] === val);
  });

  // 5. Split.js (nur falls nötig)
  if (!splitInstance) {
    splitInstance = Split(['#map', '#wms-table-container'], {
      sizes: [70, 30],
      minSize: [150, 100],
      direction: 'vertical',
      gutterSize: 10,
      onDrag: () => { if (mapRef) mapRef.updateSize(); }
    });
  }

  if (mapRef) mapRef.updateSize();

  // 6. Alte Tabelle sauber löschen
  if (table) {
    table.destroy();
    table = null;
  }
  tableElement.innerHTML = "";

  // 7. Neue Tabelle erstellen
  try {
    table = new Tabulator("#wms_data_table", {
      data: uniqueData,
      height: "100%",
      layout: "fitData",
      autoColumns: true,
      headerVisible: true,
      selectable: 1, // Wichtig für Pfeiltasten!
      scrollToRowIfVisible: false, // Verhindert, dass Tabulator eigenmächtig scrollt
    });

    table.on("tableBuilt", () => {
      console.log("Tabulator ist bereit.");
      
      // Fokus für Pfeiltasten
      requestAnimationFrame(() => {
        tableElement.focus();
      });

      const tableHolder = tableElement.querySelector(".tabulator-tableholder");
      if (tableHolder) {
        // DOPPELKLICK
        tableHolder.ondblclick = (e) => {
          const rowElement = e.target.closest(".tabulator-row");
          if (rowElement) {
            const row = table.getRow(rowElement);
            if (row && mapRef) zoomToFeature(layerName, row.getData());
          }
        };

        // TASTATUR-STEUERUNG
        tableElement.setAttribute("tabindex", "0");
        // TASTATUR-STEUERUNG (korrigiert)
        // TASTATUR-STEUERUNG (Horizontaler Sprung fixiert)
        tableElement.onkeydown = (e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          const selected = table.getSelectedRows();
          let next;
            if (selected.length > 0) {
              next = (e.key === "ArrowDown") ? selected[0].getNextRow() : selected[0].getPrevRow();
            } else {
              next = table.getRows()[0];
            }

            if (next) {
              table.deselectRow();
              next.select();
      
              // FIX: Statt table.scrollToRow nutzen wir die native Funktion:
              const rowElement = next.getElement();
              rowElement.scrollIntoView({ 
                block: "nearest",   // Vertikal: So wenig wie möglich bewegen
                inline: "nearest",  // Horizontal: Nur springen, wenn das Feld gar nicht im Bild ist!
                behavior: "auto"    // "smooth" könnte bei schnellem Tippen ruckeln
              });
              const rowData = next.getData();
              highlightFeatureForRow(rowData);
            }
          }
        };  
        // Beim Klick auf eine Zeile: Selektieren, Fokus setzen und Karte highlighten
table.on("rowClick", function(e, row) {
    // 1. Zeile in der Tabelle selektieren (macht Tabulator bei selectable:1 oft selbst, 
    // aber wir gehen sicher)
    table.deselectRow();
    row.select();

    // 2. Den Fokus auf das Tabellen-Element erzwingen, 
    // damit die Pfeiltasten sofort funktionieren
    tableElement.focus();

    // 3. Highlight auf der Karte setzen
    const rowData = row.getData();
    highlightFeatureForRow(rowData);
});
      }
    });

    // MOUSE OVER
    table.on("rowMouseOver", (e, row) => highlightFeatureForRow(row.getData()));
    table.on("rowMouseOut", () => clearHighlightedFeature());

  } catch (err) {
    console.error("Fehler beim Erstellen der Tabulator-Instanz:", err);
  }
}
export function closeTable() {
  isTableActive = false;
  clearHighlightedFeature();
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
  //console.log("--- Zoom-Vorgang gestartet ---");
  //console.log("Layer:", layerName, "ID_con gesucht:", rowData.ID_con);
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

function highlightFeatureForRow(rowData) {
  clearHighlightedFeature();
  if (!mapRef) return;

  const selector = document.getElementById('layer-selector');
  const layerName = selector ? selector.value : null;
  if (!layerName) return;

  // 1. Layer suchen (wie gehabt)
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

  // 2. Den richtigen ID-Schlüssel bestimmen
  // Wenn der Layer 'fsk' heißt, nutze 'OBJECTID', sonst 'ID_con'
  const idKey = (layerName === 'fsk') ? 'OBJECTID' : 'ID_con';

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