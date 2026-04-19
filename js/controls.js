import LayerSwitcher from 'ol-ext/control/LayerSwitcher';
import Bar from 'ol-ext/control/Bar';
import Toggle from 'ol-ext/control/Toggle';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';
import 'ol/ol.css';
import 'ol-ext/dist/ol-ext.css';   // 👈 unbedingt notwendig!
import { updateTableFromVisibleLayers } from './mapEvents.js';
import { closeTable } from './table.js';

import { isGpsTrackingActive, startGpsTracking, stopGpsTracking } from './gps.js';
import { handleCRSChange, ptnDelFindCoord, initPtn } from './ptn.js';



import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import PrintDialog from 'ol-ext/control/PrintDialog';
import CanvasAttribution from 'ol-ext/control/CanvasAttribution';
import CanvasTitle from 'ol-ext/control/CanvasTitle';
import CanvasScaleLine from 'ol-ext/control/CanvasScaleLine';

import { fileToggleInput } from './mapEvents.js';
import { Style, Text } from 'ol/style';






let isTableActive = false;
let tableToggleBtnInstance = null;
let gpsToggleBtnInstance = null;
let ptnToogleBtnInstance = null;
let mainTableBtnInstance = null;

let printControlInstance = null;
let printToogleBtnInstance = null;


export function createLayerSwitcher(map) {
  return new LayerSwitcher({
    reordering: true, // Erlaubt Neuanordnung
    trash: true,
    activationMode: 'click',
    reverse: true,
    //trash: true,
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
export function createSubBarI(map) { // GPS - Punkt setzen
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
        ptnDelFindCoord(); // Funktion zum löschen des Punktes aus (ptn.js)
      }
    },
  });
  ptnToogleBtnInstance = ptnToogleBtn;

  const fileToogleBtn = new Toggle({
    html: '<i class="fa fa-file"></i>',
    title: 'Datei laden',
    onToggle: function (active) { 
        if (active) {
           
            fileToggleInput(map); 
            
            // WICHTIG: Da es ein "Aktions-Button" ist, 
            // setzen wir ihn sofort wieder auf inaktiv
            setTimeout(() => {
                this.setActive(false);
            }, 100);
        }
    },
});

return new Bar({ toggleOne: true, controls: [gpsToggleBtn, ptnToogleBtn, fileToogleBtn ] });
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

let searchPlaceControl = null; //Erstmal die Ortssuche auf null

export function searchPlaceControlFunc() {
  let searchPlaceControl = new SearchPhoton({
  reverse: true,
  position: true	
  });
  return searchPlaceControl;

}

//Print

export function initPrintControl(map) {
  
  // 1. Zusätzliche Canvas-Controls für das Druckbild hinzufügen
  map.addControl(new CanvasAttribution());
  map.addControl(new CanvasTitle({ 
    title: '', 
    visible: false,
    style: new Style({ 
      text: new Text({ font: 'bold 12pt Arial, sans-serif' })
    }),
  }));
  map.addControl(new CanvasScaleLine());

  // 2. Den eigentlichen PrintDialog erstellen
  printControlInstance = new PrintDialog({
    title: 'Drucken',
    lang: 'de',
    className: 'ol-print-dialog' // Für eigenes CSS
  });
  map.addControl(printControlInstance);
  // Finde das HTML-Element des Controls und entferne den Button
  const printButton = printControlInstance.element.querySelector('.ol-print-button');
  if (printButton) {
    printButton.remove(); // Button aus dem DOM entfernen
  }

  
  printControlInstance.setSize('A4');
  printControlInstance.setOrientation('portrait');

  // 3. Den Dialog der Karte hinzufügen
  map.addControl(printControlInstance);

  // 4. Print-Event Handler
  printControlInstance.on(['print', 'error'], function(e) {
    if (e.image) {
      if (e.pdf) {
        const pdf = new jsPDF({
          orientation: e.print.orientation,
          unit: e.print.unit,
          format: e.print.size
        });
        pdf.addImage(e.image, 'JPEG', e.print.position[0], e.print.position[1], e.print.imageWidth, e.print.imageHeight);
        pdf.save(e.print.legend ? 'legende.pdf' : 'karte.pdf');
      } else {
        // Bild-Export
        e.canvas.toBlob(function(blob) {
          const name = (e.print.legend ? 'legende.' : 'karte.') + e.imageType.replace('image/', '');
          saveAs(blob, name);
        }, e.imageType, e.quality);
      }
    } else {
      console.warn('Kein Canvas zum Exportieren gefunden');
    }
  });

  // Wenn der Dialog manuell geschlossen wird (X-Button), Toggle deaktivieren
  printControlInstance.on('hide', () => {
    if (printToogleBtnInstance) printToogleBtnInstance.setActive(false);
  });
}


import WMSCapabilities from 'ol-ext/control/WMSCapabilities';
// Wichtig: ol-ext CSS muss irgendwo geladen werden (z.B. in main.js oder index.html)
// import 'ol-ext/dist/ol-ext.css'
/**
 * Initialisiert das WMS-Capabilities Control
 * @param {ol/Map} map 
 */
export function initializeWMS(map) {
    const cap = new WMSCapabilities({
        target: document.body, // Oder ein spezielles Div
        srs: ['EPSG:3857', 'EPSG:4326', 'EPSG:25832'], // Deine Projektionen
        cors: true,
        popupLayer: true,
        placeholder: 'WMS link hier einfügen...',
        title: 'WMS-Dienste',
        searchLabel: 'Suche',
        services: {
        'Verwaltungsgrenzen NI ': 'https://opendata.lgln.niedersachsen.de/doorman/noauth/verwaltungsgrenzen_wms',            
        'Hydro, Umweltkarten NI ': 'https://www.umweltkarten-niedersachsen.de/arcgis/services/Hydro_wms/MapServer/WMSServer?VERSION=1.3.0.&SERVICE=WMS&REQUEST=GetCapabilities',  'WRRL, Umweltkarten NI ': 'https://www.umweltkarten-niedersachsen.de/arcgis/services/WRRL_wms/MapServer/WMSServer?VERSION=1.3.0.&SERVICE=WMS&REQUEST=GetCapabilities',
        'Natur, Umweltkarten NI': 'https://www.umweltkarten-niedersachsen.de/arcgis/services/Natur_wms/MapServer/WMSServer?VERSION=1.3.0.&SERVICE=WMS&REQUEST=GetCapabilities',
        'Natur, LK':'https://geodaten.emsland.de:443/core-services/services/lkel_fb67_naturschutz_und_forsten_wms?',
        'HW-Schutz, Umwelkarten NI':'https://www.umweltkarten-niedersachsen.de/arcgis/services/HWSchutz_wms/MapServer/WMSServer?VERSION=1.3.0.&SERVICE=WMS&REQUEST=GetCapabilities',
        'schutzgebiete, NL': 'https://service.pdok.nl/provincies/aardkundige-waarden/wms/v1_0?request=GetCapabilities&service=WMS',
        'krw wateren, NL': 'https://service.pdok.nl/ihw/gebiedsbeheer/krw-oppervlaktewaterlichamen/wms/v1_0?SERVICE=WMS&VERSION=1.3.0&request=getcapabilities',
        'EU-Waterbodies 3rd RBMP': 'https://water.discomap.eea.europa.eu/arcgis/services/WISE_WFD/WFD2022_SurfaceWaterBody_WM/MapServer/WMSServer?request=GetCapabilities&service=WMS',
        'Luft u. Lärm': 'https://www.umweltkarten-niedersachsen.de/arcgis/services/Luft_Laerm_wms/MapServer/WMSServer?VERSION=1.3.0.&SERVICE=WMS&REQUEST=GetCapabilities',
        'Boden, Umweltkarten NI': 'https://www.umweltkarten-niedersachsen.de/arcgis/services/Boden_wms/MapServer/WMSServer?VERSION=1.3.0.&SERVICE=WMS&REQUEST=GetCapabilities',
        'Pegelonline, DE': 'https://www.pegelonline.wsv.de/webservices/gis/wms/aktuell/mnwmhw?request=GetCapabilities&service=WMS&version=1.3.0',
        'Inspire Hydro': 'https://sg.geodatenzentrum.de/wms_dlm250_inspire?Request=GetCapabilities&SERVICE=WMS',
        'TopPlusOpen': 'https://sgx.geodatenzentrum.de/wms_topplus_open?request=GetCapabilities&service=wms',
        'Drenthe Geodata': 'https://services.geodataoverijssel.nl/geoserver/ows?'
        },
        trace: true
    });

    map.addControl(cap);

    // Event-Handling wenn ein Layer ausgewählt wurde
    cap.on('load', (e) => {
        const layer = e.layer;
        
        // Den Titel aus den Metadaten holen, damit er im LayerSwitcher erscheint
        const rawTitle = (e.options.data && (e.options.data.title || e.options.data.Name)) || "WMS Layer";
        
        // WICHTIG für deinen LayerSwitcher:
        layer.set('title', rawTitle);
        layer.set('name', rawTitle); // Falls du 'name' als ID nutzt
        
        // Layer der Karte hinzufügen
        map.addLayer(layer);
        
        console.log(`WMS geladen: ${rawTitle}`);
    });
}