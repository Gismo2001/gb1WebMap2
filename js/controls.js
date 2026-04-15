import LayerSwitcher from 'ol-ext/control/LayerSwitcher';
import Bar from 'ol-ext/control/Bar';
import Toggle from 'ol-ext/control/Toggle';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';
import { updateTableFromVisibleLayers } from './mapEvents.js';
import { closeTable } from './table.js';

import { isGpsTrackingActive, startGpsTracking, stopGpsTracking } from './gps.js';
import { handleCRSChange, ptnDelFindCoord, initPtn } from './ptn.js';



let isTableActive = false;

let tableToggleBtnInstance = null;
let gpsToggleBtnInstance = null;
let ptnToogleBtnInstance = null;
let mainTableBtnInstance = null;


export function createLayerSwitcher(map) {
  return new LayerSwitcher({
    activationMode: 'click',
    reverse: true,
    trash: true,
    tipLabel: 'Legende',
    onchangeCheck: function () {
      if (isTableEnabled()) {
        //console.log ('layerswitcher event');
        updateTableFromVisibleLayers(map);
      }
    },
  });
}

export function createMainToolbar(map) {
  const bar = new Bar({
    className: 'main-toolbar',
  });

  const toggleBtn1 = new Toggle({
    html: 'I',
    title: 'Info Haupt',
    className: 'InfoHaupt',
    active: false,
    bar: createSubBarI(map),
  });

  const toggleBtn2 = new Toggle({
    html: 'W',
    title: 'Dateien',
  });

  const toggleBtn3 = new Toggle({
    html: 'T',
    title: 'Tabelle Haupt',
    className: 'TabelleHaupt',
    active: false,
    bar: createSubBarT(map),
  });
  mainTableBtnInstance = toggleBtn3; // Instanz speichern
  const allBtns = [toggleBtn1, toggleBtn2, toggleBtn3];

  allBtns.forEach((btn) => {
    btn.on('change:active', (e) => {
      if (!e.active) return;

      // --- GEÄNDERTE LOGIK ---
      allBtns.filter((b) => b !== btn).forEach((b) => {
        // Ausnahme: Wenn "I" geklickt wird, soll "T" nicht deaktiviert werden.
        // Und wenn "T" geklickt wird, soll "I" nicht deaktiviert werden.
        const isInfoTableCombo = (btn === toggleBtn1 && b === toggleBtn3) || 
                                 (btn === toggleBtn3 && b === toggleBtn1);

        if (!isInfoTableCombo) {
          b.setActive(false);
        }
      });

      // Der Block, der tableToggleBtnInstance deaktiviert und closeTable() aufruft,
      // wurde entfernt, damit die Tabelle offen bleibt.
      //console.log('Button aktiviert:', btn.get('title'));
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
    title: 'Tabelle anzeigen',
    className: 'tabelle',
    onToggle: function (active) {
      isTableActive = active;
      if (active) {
        // --- NEU: Hauptbutton optisch aktiv halten ---
        if (mainTableBtnInstance) {
          mainTableBtnInstance.element.classList.add('is-running');
        }
        updateTableFromVisibleLayers(map);
      } else {
        closeTable();
        // Das Entfernen der Klasse erfolgt zentral in deactivateTableToggle
      }
    },
  });

  tableToggleBtnInstance = tableToggleBtn;
  return new Bar({ toggleOne: true, controls: [tableToggleBtn] });
}
export function createSubBarI(map) {
  const gpsToggleBtn = new Toggle({
    html: '<i class="fa fa-map-marker"></i>',
    title: 'GPS Position anzeigen',
    onToggle: function (active) {
      if (active) {
        const started = startGpsTracking(map, {
          onUnavailable: () => {
            alert('Geolocation wird von diesem Browser nicht unterstützt.');
          },
          onError: (error) => {
            alert(`ERROR: ${error.message}`);
          },
        });

        if (!started) {
          gpsToggleBtn.setActive(false);
        }
        return;
      }

      if (isGpsTrackingActive()) {
        stopGpsTracking();
      }
    },
  });
  gpsToggleBtnInstance = gpsToggleBtn;
  const ptnToogleBtn = new Toggle({
    html: '<i class="fa fa-circle"></i>',
    title: 'Punkt setzen',
    onToggle: function (active) { 
      if (active) {
        // WICHTIG: Karte und Source übergeben (sourceEdit ist deine Source)
        initPtn(map); 
        handleCRSChange(); // Kein 'e' mehr nötig
      } else {  
        ptnDelFindCoord();
      }
    },
});
ptnToogleBtnInstance = ptnToogleBtn;
return new Bar({ toggleOne: true, controls: [gpsToggleBtn, ptnToogleBtn] });
}

export function createDataTable(map) {
  const table = new Tabulator('#wms_data_table', {
    height: '100%',
    layout: 'fitData',
    autoColumns: true,
    columnDefaults: { tooltip: true },
  });

  setTimeout(() => map.updateSize(), 50);
  return table;
}

export function isTableEnabled() {
  return isTableActive;
}

export function deactivateTableToggle() {
  if (tableToggleBtnInstance) {
    tableToggleBtnInstance.setActive(false);
  }
  // --- NEU: Blau-Markierung vom Hauptbutton entfernen ---
  if (mainTableBtnInstance) {
    mainTableBtnInstance.element.classList.remove('is-running');
  }
}

import SearchPhoton from 'ol-ext/control/SearchPhoton';

let searchControl = null;
  export function searchControlFunc() {
  let searchControl = new SearchPhoton({
  reverse: true,
  position: true	
  });
  return searchControl;

}
    