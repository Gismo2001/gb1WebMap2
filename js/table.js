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
    width: 4,
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
    // Optional: Falls der alte Layer weg ist, beim ersten bleiben 
    // oder eine Standardaktion ausführen.
    //console.log("Vorheriger Layer nicht mehr in der Liste.");
  }
}
export function showTable(data) {
  isTableActive = true;
  const container = document.getElementById("wms-table-container");
  const tableElement = document.getElementById("wms_data_table");
  
  const filterBtn = document.getElementById("filter-toggle");
  
  if (!container || !tableElement) return;
  if (filterBtn && tableElement) {
   const filterBtn = document.getElementById("filter-toggle");
const tableElement = document.getElementById("wms_data_table");

if (filterBtn && tableElement) {
    filterBtn.onclick = () => {
        // 1. Filter in der Tabelle umschalten
        tableElement.classList.toggle("hide-filters");

        // 2. Button-Hintergrund umschalten
        // Wenn 'hide-filters' aktiv ist, ist der Filter weg -> also Button NICHT aktiv
        const filtersHidden = tableElement.classList.contains("hide-filters");
        
        if (filtersHidden) {
            filterBtn.classList.remove("active");
        } else {
            filterBtn.classList.add("active");
        }

        // 3. Tabelle neu berechnen
        if (table) {
            table.redraw(); 
        }
    };

    // INITIALER ZUSTAND: 
    // Falls die Tabelle beim Start 'hide-filters' hat, darf der Button kein 'active' haben.
    // Falls sie ohne 'hide-filters' startet, füge 'active' hinzu:
    if (!tableElement.classList.contains("hide-filters")) {
        filterBtn.classList.add("active");
    }
}
}
  // 👉 Anzeige
  container.style.display = "flex";
  const mapElement = document.getElementById("map");
  if (mapElement) {
    mapElement.style.height = "";
  }
  // 👉 Layer-Info
  const selector = document.getElementById('layer-selector');
  const layerName = selector ? selector.value : "unknown";
  const idKey = (layerName === 'fsk') ? 'OBJECTID' : 'ID_con';

  // 👉 Daten deduplizieren
  const uniqueData = (data || []).filter((item, index, self) => {
    const val = item[idKey];
    if (val === null || val === undefined) return true;
    return index === self.findIndex((t) => t[idKey] === val);
  });

  // 👉 Split.js
  if (!splitInstance) {
    splitInstance = Split(['#map', '#wms-table-container'], {
      sizes: [70, 30],
      minSize: [100, 0],
      direction: 'vertical',
      gutterSize: 10,
      onDrag: () => { if (mapRef) mapRef.updateSize(); },
      onDragEnd: (sizes) => {
        if (sizes[1] <= 5) closeTable();
      }
    });
  }
if (mapRef) mapRef.updateSize();
  // 👉 Tabelle neu aufbauen
  if (table) {
    table.destroy();
    table = null;
  }

  tableElement.innerHTML = "";
  try {
    table = new Tabulator("#wms_data_table", {
      data: uniqueData,
      height: "100%",
      layout: "fitData",
      placeholder: "Keine Objekte im Sichtbereich. Klicken Sie auf ein Objekt für Details.",
      autoColumns: true,
      autoColumnsDefinitions: function(definitions) {
        definitions.forEach((column) => {
          column.headerFilter = "input";
          column.headerFilterPlaceholder = "Suche...";
          // Wenn das Feld "stat_von" heißt, erzwinge numerische Sortierung
          if (column.field === "stat_von") {
            column.sorter = "number";
            column.headerFilterPlaceholder = "z.B. <5000";
          }
          column.headerFilterFunc = function(headerValue, rowValue, rowData, filterParams) {
            // Falls leer, alles anzeigen
            if (headerValue === null || headerValue === undefined || headerValue === "") return true;
            if (rowValue === null || rowValue === undefined) return false;

            const val = String(rowValue).trim();
            const search = String(headerValue).trim();

            // 1. Check auf mathematische Operatoren (<, >, <=, >=)
            const match = search.match(/^(<=|>=|<|>)\s*(\d+(?:\.\d+)?)$/);
            if (match) {
              const operator = match[1];
              const numSearch = parseFloat(match[2]);
              const numRow = parseFloat(val);

              if (isNaN(numRow)) return false;

              switch (operator) {
                case "<":  return numRow < numSearch;
                case ">":  return numRow > numSearch;
                case "<=": return numRow <= numSearch;
                case ">=": return numRow >= numSearch;
              }
            }

            // 2. Fallback: Deine Platzhalter-Logik (*) oder Teilstring-Suche
            const regexString = search.replace(/\*/g, ".*");
            try {
              const regex = new RegExp(regexString, "i");
              return regex.test(val);
            } catch (e) {
              return val.includes(search);
            }
          };
        });
        if (layerName !== 'fsk') {
          const statKey = "stat_von";
          const idCol = definitions.find(col => col.field === idKey);
          const statCol = definitions.find(col => col.field === statKey);
          const remainingCols = definitions.filter(col => col.field !== idKey && col.field !== statKey);
          const newOrder = [];
          if (idCol) newOrder.push(idCol);
          if (statCol) newOrder.push(statCol);

          return newOrder.concat(remainingCols);
        }
        return definitions;
      },
      headerVisible: true,
      selectable: 1,
      scrollToRowIfVisible: false,
    });

    // ==============================
    // 👉 INTERAKTION
    // ==============================

    let isKeyboardNavigation = false;
    let lastHighlightedId = null;

    table.on("tableBuilt", () => {
      requestAnimationFrame(() => {
        const isMobile = window.innerWidth <= 768;
        if (!isMobile) {
          tableElement.focus({ preventScroll: true });
        }
      });

      const tableHolder = tableElement.querySelector(".tabulator-tableholder");

      if (tableHolder) {

        // 👉 Doppelklick = Zoom
        tableHolder.ondblclick = (e) => {
          const rowElement = e.target.closest(".tabulator-row");
          if (rowElement) {
            const row = table.getRow(rowElement);
            if (row && mapRef) {
              zoomToFeature(layerName, row.getData());
            }
          }
        };

        // 👉 Tastatur aktivieren
        tableElement.setAttribute("tabindex", "0");

        tableElement.onkeydown = (e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            isKeyboardNavigation = true;
            e.preventDefault();

            const selected = table.getSelectedRows();
            let next;

            if (selected.length > 0) {
              next = (e.key === "ArrowDown")
                ? selected[0].getNextRow()
                : selected[0].getPrevRow();
            } else {
              next = table.getRows()[0];
            }

            if (next) {
              table.deselectRow();
              next.select();

              const rowElement = next.getElement();
              rowElement.scrollIntoView({
                block: "nearest",
                inline: "nearest",
                behavior: "auto"
              });

              const rowData = next.getData();

              // 👉 Highlight nur wenn neues Feature
              if (rowData[idKey] !== lastHighlightedId) {
                highlightFeatureForRow(rowData);
                lastHighlightedId = rowData[idKey];
              }
            }
          }

          // 👉 ENTER = Zoom
          if (e.key === "Enter") {
            e.preventDefault();

            const selected = table.getSelectedRows();
            if (selected.length > 0 && mapRef) {
              zoomToFeature(layerName, selected[0].getData());
            }
          }
        };
      }

      // 👉 Maus bewegt → zurück zu Mausmodus
      tableElement.addEventListener("mousemove", () => {
        isKeyboardNavigation = false;
      });
    });

    // 👉 Hover nur wenn nicht Tastatur aktiv
    table.on("rowMouseOver", (e, row) => {
      if (!isKeyboardNavigation) {
        highlightFeatureForRow(row.getData());
      }
    });

    table.on("rowMouseOut", () => {
      if (!isKeyboardNavigation) {
        clearHighlightedFeature();
      }
    });

    // 👉 Klick
    table.on("rowClick", function(e, row) {
      isKeyboardNavigation = false;

      table.deselectRow();
      row.select();

      const isMobile = window.innerWidth <= 768;
      if (!isMobile) {
        tableElement.focus({ preventScroll: true });
      }

      const rowData = row.getData();
      highlightFeatureForRow(rowData);
    });

    // 👉 Link-Klick
    table.on("cellClick", function (e, cell) {
      const value = cell.getValue();

      if (typeof value === "string" && /^https?:\/\//i.test(value)) {
        e.stopPropagation();
        window.open(value, "_blank", "noopener,noreferrer");
        return;
      }

      const row = cell.getRow();
      table.deselectRow();
      row.select();

      const rowData = row.getData();
      highlightFeatureForRow(rowData);
    });

  } catch (err) {
    console.error("Fehler beim Erstellen der Tabulator-Instanz:", err);
  }
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