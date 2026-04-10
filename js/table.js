import { TabulatorFull as Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';
import Split from 'split.js';
import { deactivateTableToggle } from './controls';

let splitInstance = null;

let isTableActive = false; 
let mapRef = null;   // 👈 Referenz auf map
let table = null;



// 👉 Map setzen (wichtig!)
export function initTable(map) {
  mapRef = map;
}

export function updateSelector(names) {
  const selector = document.getElementById('layer-selector');
  selector.innerHTML = names.map(name =>
    `<option value="${name}">${name}</option>`
  ).join('');
}

export function showTable(data) {
  isTableActive = true;
  const container = document.getElementById("wms-table-container");
  
  // 1. Container sichtbar machen
  container.style.display = "flex";

  // 2. Ein minimaler Timeout gibt dem Browser Zeit für das Layout-Rendering
  setTimeout(() => {
    
    // 3. Split.js initialisieren
    if (!splitInstance) {
      splitInstance = Split(['#map', '#wms-table-container'], {
        sizes: [85, 15],
        minSize: [150, 100],
        direction: 'vertical',
        gutterSize: 10,
        onDrag: () => {
          if (mapRef) mapRef.updateSize();
          if (table && table.element) table.redraw();
        }
      });
    }

    // 4. Tabelle erst HIER erstellen, wenn sie noch nicht existiert
    if (!table) {
      table = new Tabulator("#wms_data_table", {
        height: "100%",
        layout: "fitData",
        autoColumns: true,
        columnDefaults: { tooltip: true }
      });
    }

    // 5. Daten setzen
    if (data && data.length > 0) {
      table.setData(data)
        .then(() => {
          table.redraw(true);
        })
        .catch(err => console.warn("Tabulator Redraw Error:", err));
    }

    if (mapRef) mapRef.updateSize();
  }, 10); // 10ms reichen meistens aus
}

export function closeTable() {
  isTableActive = false;
  if (splitInstance) {
    splitInstance.destroy();
    splitInstance = null;
  }
  document.getElementById("wms-table-container").style.display = "none";
  deactivateTableToggle();
  if (mapRef) mapRef.updateSize();
}

export function switchLayerData(results) {
  const selector = document.getElementById('layer-selector');
  if (!selector) return;

  const selectedLayer = selector.value;
  const data = results[selectedLayer];

  if (data && data.length > 0) {
    // Wir rufen showTable auf. 
    // Da table schon existiert, wird darin nur setData() ausgeführt.
    showTable(data);
  }
}

export function getTableActive() {
  return isTableActive;
}