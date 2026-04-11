import LayerSwitcher from 'ol-ext/control/LayerSwitcher';
import Bar from 'ol-ext/control/Bar';
import Toggle from 'ol-ext/control/Toggle';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';
import { updateTableFromVisibleLayers } from './mapEvents.js';
import { closeTable } from './table.js';
import { isGpsTrackingActive, startGpsTracking, stopGpsTracking } from './gps.js';

let isTableActive = false;

let tableToggleBtnInstance = null;
let gpsToggleBtnInstance = null;

export function createLayerSwitcher(map) {
  return new LayerSwitcher({
    activationMode: 'click',
    reverse: true,
    trash: true,
    tipLabel: 'Legende',
    onchangeCheck: function () {
      if (isTableEnabled()) {
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

  const allBtns = [toggleBtn1, toggleBtn2, toggleBtn3];

  allBtns.forEach((btn) => {
    btn.on('change:active', (e) => {
      if (!e.active) return;

      allBtns.filter((b) => b !== btn).forEach((b) => b.setActive(false));

      if (btn === toggleBtn1 && tableToggleBtnInstance) {
        tableToggleBtnInstance.setActive(false);
        closeTable();
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
    title: 'Tabelle anzeigen',
    onToggle: function (active) {
      isTableActive = active;

      if (active) {
        updateTableFromVisibleLayers(map);
      } else {
        closeTable();
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
  return new Bar({ toggleOne: true, controls: [gpsToggleBtn] });
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
}
