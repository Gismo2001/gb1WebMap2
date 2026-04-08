import { TabulatorFull as Tabulator } from 'tabulator-tables';
import Split from 'split.js';

let table = null;
let splitInstance = null;
let mapRef = null;   // 👈 Referenz auf map

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
        mapRef.updateSize();   // 👈 jetzt sauber!
        if (table) table.redraw();
      }
    });
  } else {
    splitInstance.setSizes([85, 15]);
  }

  if (!table) {
    table = new Tabulator("#wms_data_table", {
      data: data,
      height: "100%",
      layout: "fitData",
      autoColumns: true,
    });
  } else {
    table.setData(data);   // 🔥 besser als destroy!
  }

  mapRef.updateSize();
}
export function closeTable() {

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
    showTable(data);
  }
}