import { TabulatorFull as Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';
import Split from 'split.js';
import { deactivateTableToggle } from './controls';

let splitInstance = null;
let isTableActive = false; 
let mapRef = null;
let table = null;

export function initTable(map) {
  mapRef = map;
}

export function updateSelector(names) {
  const selector = document.getElementById('layer-selector');
  if (!selector) return;
  selector.innerHTML = names.map(name =>
    `<option value="${name}">${name}</option>`
  ).join('');
}

export function showTable(data) {
  isTableActive = true;
  const container = document.getElementById("wms-table-container");
  const tableElement = document.getElementById("wms_data_table");
  if (!container || !tableElement) return;
  container.style.display = "flex";
  // 2. Split.js initialisieren (nur wenn noch nicht vorhanden)
  if (!splitInstance) {
    splitInstance = Split(['#map', '#wms-table-container'], {
      sizes: [70, 30],
      minSize: [150, 100],
      direction: 'vertical',
      gutterSize: 10,
      onDrag: () => {
        if (mapRef) mapRef.updateSize();
        if (table) table.redraw();
      }
    });
  }
  // 3. Karte an die neue Größe anpassen
  if (mapRef) mapRef.updateSize();
  // 4. Radikaler Aufräumprozess für Tabulator
  if (table) {
    table.destroy();
    table = null;
  }
  tableElement.innerHTML = ""; // Löscht alle alten Event-Reste aus dem DOM
  // 5. Kurze Verzögerung, damit das DOM sich beruhigen kann
  setTimeout(() => {
    if (!data || data.length === 0) {
      console.warn("Keine Daten für die Tabelle übergeben.");
      return;
    }
    // 6. Tabelle neu erstellen
    table = new Tabulator("#wms_data_table", {
      data: data,
      height: "100%",
      layout: "fitData",
      autoColumns: true,
      headerVisible: true,
      renderVertical: "basic",
    });

    // 7. Sobald die Tabelle fertig gebaut ist...
    table.on("tableBuilt", () => {
      console.log("Tabulator Built erfolgreich.");
      table.redraw(true);

      // 👉 MANUELLER DOPPELKLICK-BYPASS
      // Wir suchen den Bereich, in dem die Datenzeilen liegen
      const tableHolder = tableElement.querySelector(".tabulator-tableholder");
      if (tableHolder) {
        // Sicherstellen, dass wir keine alten Listener mitschleifen
        tableHolder.ondblclick = (e) => {
          // Finde das Zeilen-Element (Row), das angeklickt wurde
          const rowElement = e.target.closest(".tabulator-row");
          if (rowElement) {
            // Hole die Daten der Zeile über die Tabulator-Instanz
            const row = table.getRow(rowElement);
            if (row) {
              const rowData = row.getData();
              const selector = document.getElementById('layer-selector');
              const layerName = selector ? selector.value : null;
              console.log("Manueller Doppelclick auf ID_con:", rowData.ID_con);
              if (mapRef && layerName) {
                // Hier rufst du deine Zoom-Funktion auf
                zoomToFeature(layerName, rowData);
              }
            }
          }
        };
      }
    });

  }, 100); // 100ms Timeout für maximale Stabilität
}

export function closeTable() {
  isTableActive = false;
  if (splitInstance) {
    splitInstance.destroy();
    splitInstance = null;
  }
  
  if (table) {
    table.destroy();
    table = null;
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
    showTable(data);
  }
}

export function getTableActive() {
  return isTableActive;
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