import LayerSwitcher from 'ol-ext/control/LayerSwitcher';
import Bar from 'ol-ext/control/Bar';
import Toggle from 'ol-ext/control/Toggle';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';
import { getVisibleVectorFeatures } from './mapEvents.js';
import { updateTableFromVisibleLayers } from './mapEvents.js';
import { closeTable } from './table.js';


let isTableActive = false;
let tableToggleBtnInstance = null;


export function createLayerSwitcher(map) {
  return new LayerSwitcher({
    activationMode: 'click',
    reverse: true,
    trash: true,
    tipLabel: 'Legende',

    onchangeCheck: function(layer, checked) {

      if (isTableEnabled()) {
        
        updateTableFromVisibleLayers(map);
      }

      
    }
  });
}

/* function showAllVisibleData(map) {

  const results = getVisibleVectorFeatures(map);

  const layerNames = Object.keys(results);

  if (layerNames.length > 0) {
    updateSelector(layerNames);
    showTableDebounced((results[layerNames[0]]);
  } else {
    closeTable();
  }
} */


export function createMainToolbar(map) {
  const bar = new Bar({
     className: 'main-toolbar'
  });

  // 1. Buttons definieren
  const toggleBtn1 = new Toggle({ html: "I", title: 'Info' });
  const toggleBtn2 = new Toggle({ html: 'W', title: 'Dateien' });

  const toggleBtn3 = new Toggle({ 
    html: 'T', 
    title: 'Tabelle Haupt', 
    className: 'TabelleHaupt',
    active: false,
    bar: createSubBarT(map) 
  });

  const allBtns = [toggleBtn1, toggleBtn2, toggleBtn3];

  // 2. Logik hinzufügen
  allBtns.forEach(btn => {
    btn.on('change:active', (e) => {
      if (e.active) {
        // Alle anderen Haupt-Buttons deaktivieren
        allBtns.filter(b => b !== btn).forEach(b => b.setActive(false));

        // 👉 SPEZIAL-LOGIK: Wenn Info-Button (toggleBtn1) aktiviert wird
        if (btn === toggleBtn1) {
          
          // A) Den kleinen Tabellen-Button in der Sub-Bar deaktivieren
          // (tableToggleBtnInstance muss dafür exportiert/global in der Datei sein)
          if (typeof tableToggleBtnInstance !== 'undefined' && tableToggleBtnInstance) {
            tableToggleBtnInstance.setActive(false);
          }

          // B) Die Tabelle physisch schließen und Split.js zerstören
          closeTable();
        }
      }
    });
  });

  bar.addControl(toggleBtn1);
  bar.addControl(toggleBtn2);
  bar.addControl(toggleBtn3);
  bar.setPosition('top-left');
  
  return bar;
}
export function createSubBarT(map) {
  const tableToggleBtn = new Toggle({
    html: '<i class="fa fa-table" aria-hidden="true"></i>',
    title: "Tabelle anzeigen",
    onToggle: function (active) {
      isTableActive = active; // Status-Variable in controls.js setzen
      if (active) {
        // 👉 Startet die Kette: Daten sammeln -> Selector füllen -> showTable()
        updateTableFromVisibleLayers(map);
      } else {
        // 👉 Räumt Split.js auf und versteckt den Container
        closeTable();
      }
    }
  });

  tableToggleBtnInstance = tableToggleBtn;
  return new Bar({ toggleOne: true, controls: [tableToggleBtn] });
}

export function createDataTable(map) {
  const table = new Tabulator("#wms_data_table", {
    height: "100%",
    layout: "fitData",
    autoColumns: true,
    columnDefaults: { tooltip: true },
  });

  // Karte an den neuen Platz anpassen
  setTimeout(() => map.updateSize(), 50);
  return table;
}

export function isTableEnabled() {
  return isTableActive;
}

// Funktion zum Deaktivieren von außen
export function deactivateTableToggle() {
  if (tableToggleBtnInstance) {
    tableToggleBtnInstance.setActive(false);
    
  }
}

