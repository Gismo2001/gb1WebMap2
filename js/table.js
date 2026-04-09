import { TabulatorFull as Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';
import Split from 'split.js';


let splitInstance = null;
let mapRef = null;   // 👈 Referenz auf map

 // 1. Tabelle initialisieren (außerhalb des Klicks)
let table = new Tabulator("#wms_data_table", {
    height: "100%",        // Wichtig für den internen Scroll-Container
    layout: "fitData",     // ÄNDERUNG: Spalten behalten ihre natürliche Breite
    autoColumns: true,
    columnDefaults:{
        tooltip:true,      // Zeigt Inhalt beim Drüberfahren
    },
});


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

  const container = document.getElementById("wms-table-container");
  container.style.display = "flex";

  if (!splitInstance) {
    splitInstance = Split(['#map', '#wms-table-container'], {
      sizes: [85, 15],
      minSize: [150, 100],
      direction: 'vertical',
      gutterSize: 5,

      onDrag: () => {
      if (mapRef) {
        mapRef.updateSize();
      }
  
      // Prüfen, ob die Tabelle existiert UND ein DOM-Element hat
      if (table && table.element && table.element.offsetWidth > 0) {
      table.redraw();
      }
      }
    });
  } else {
    splitInstance.setSizes([85, 15]);
  }
   if (data && data.length > 0) {
        if (table) table.destroy(); // Harter Reset
        
        table = new Tabulator("#wms_data_table", {
            data: data,
            height: "100%",
            layout: "fitData",
            autoColumns: true,
            // Verhindert, dass Tabulator Platz für Header-Filter reserviert, 
            // wenn diese nicht aktiv sind:
            headerVisible: true, 
            renderVertical: "basic", // Deaktiviert Virtual DOM für kleine Datenmengen (stabiler)
        });

        // Ein kleiner "Nachstoß", um das Layout zu fixieren
        setTimeout(() => {
            table.redraw(true);
        }, 10);
    }

  mapRef.updateSize();
}
export function closeTable() {
  console.log('aufgerufen');

  if (splitInstance) {
    splitInstance.destroy();
    splitInstance = null;
  }

  document.getElementById("wms-table-container").style.display = "none";

  if (mapRef) {
    mapRef.updateSize();
  }
}

export function switchLayerData(currentClickResults) {

  const selectedLayer = document.getElementById('layer-selector').value;
  const data = currentClickResults[selectedLayer];

  if (data && data.length > 0) {
    console.log('aufgerufen');
    showTable(data);
  }
}