import LayerSwitcher from 'ol-ext/control/LayerSwitcher';
import Bar from 'ol-ext/control/Bar';
import Toggle from 'ol-ext/control/Toggle';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';
import 'ol/ol.css';
import 'ol-ext/dist/ol-ext.css';   // 👈 unbedingt notwendig!
import { updateTableFromVisibleLayers } from './mapEvents.js';
import { closeTable, getTableChildWindow, getTableDocument } from './table.js';

import { isGpsTrackingActive, startGpsTracking, stopGpsTracking } from './gps.js';
import { handleCRSChange, ptnDelFindCoord, initPtn } from './ptn.js';

import { createDgmKachelLayer, createDomKachelLayer } from './layers.js';
import { createProfilSource, createProfilLayer } from './layers';
import { dgmGroup, domGroup } from './layers.js';
import { enableProfileDrawing, disableProfileDrawing } from './chart';

import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import PrintDialog from 'ol-ext/control/PrintDialog';
import CanvasAttribution from 'ol-ext/control/CanvasAttribution';
import CanvasTitle from 'ol-ext/control/CanvasTitle';
import CanvasScaleLine from 'ol-ext/control/CanvasScaleLine';

import { fileToggleInput } from './mapEvents.js';


import { isDgmActive, setDgmActive, disableDgmInteraction  } from './dgmdom.js';
import { isDomActive, setDomActive, disableDomInteraction  } from './dgmdom.js';

import { layerSwitcher } from '../main.js';
import SearchPhoton from 'ol-ext/control/SearchPhoton';

import Permalink from 'ol-ext/control/Permalink';
import WMSCapabilities from 'ol-ext/control/WMSCapabilities';
import { deactivateDrawing } from './myDraw.js'; 

import VectorLayer from 'ol/layer/Vector';

import { drawSource,drawLayer } from './myDraw.js'; // 💡 Import der drawSource für die Reanimation des Layers


let searchPlaceControl = null; //Erstmal die Ortssuche auf null
export let isTableActive = false;
let tableToggleBtnInstance = null;
let gpsToggleBtnInstance = null;
let ptnToogleBtnInstance = null;
let mainTableBtnInstance = null;

let printControlInstance = null;
let printToogleBtnInstance = null;


let drawToggleBtnInstance = null; // 💡 Instanz-Variablen für die Steuerung
let wfsToggleBtnInstance = null;

// Initialisierung (außerhalb der create-Funktion)
export const profileSource = createProfilSource();
export const profileLayer = createProfilLayer(profileSource);
let profileMode = false;

let isDrawActive = false; 
let isWfsActive = false; 


//export const permalinkControl = null; 

import { Style, Stroke, Fill, Circle as CircleStyle, Text } from 'ol/style';
export const selectStyle = new Style({
  stroke: new Stroke({
    color: '#00ffff', // Cyan/Hellblau leuchtend
    width: 4
  }),
  fill: new Fill({
    color: 'rgba(0, 255, 255, 0.2)' // Leicht transparent gefüllt
  }),
  image: new CircleStyle({
    radius: 7,
    fill: new Fill({ color: '#00ffff' })
  })
});

// --- Control definieren ---
const permalinkControl = new Permalink({
  className: 'ol-permalink permalinkControl', // Eigene Klasse hinzufügen
  refreshDelay:100,
  visible: true,
  localStorage: false,
  onclick: function(url) {
    navigator.clipboard.writeText(url).then(function() {alert("Link kopiert!"); });
  }
});

// Initialisiert permalinkButton
export function initPermalinkButton(map) {
  const permalink = new Permalink({
    className: 'ol-permalink-button',
    urlReplace: false, 
    refreshDelay: 100,
    localStorage: false, 
    visible: false,    
    anchor: false, 
      onclick: function(url) {
        navigator.clipboard.writeText(url).then(() => {
          const btn = document.querySelector('.ol-permalink-button button');
          console.log ("permalinkButton geclickt");
          btn.innerHTML = "✅"; 
            setTimeout(() => { btn.innerHTML = ""; }, 2000);
        });
        zeigeNachricht("Link (aus init) erstellt");
    }
  });
  map.addControl(permalink);
  return permalink;
}
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
        console.log ('layerswitcher event');
        updateTableFromVisibleLayers(map);
      }
    },
  });
}
export function createMainToolbar(map) {
  const bar = new Bar({
    className: 'main-toolbar',
  });

  // --- Toggle-Button Info ---
  const toggleBtn1 = new Toggle({
    html: 'I',
    title: 'Info Haupt',
    className: 'InfoHaupt',
    active: false,
    bar: createSubBarI(map),
  });

  //DGM/DOM Hauptbutton mit Sub-Bar ---
  const toggleBtn2 = new Toggle({
    html: 'W',
    title: 'DGM / DOM Auswahl',
    className: 'DgmDomHaupt',
    active: false,
    bar: createSubBarW(map), // Hier wird die neue Sub-Bar zugewiesen
  });

  // --- Toggle-Button Tabelle ---
  const toggleBtn3 = new Toggle({
    html: 'T',
    title: 'Verschiedenes',
    className: 'Verschiedenes',
    active: false,
    bar: createSubBarT(map),
  });

  mainTableBtnInstance = toggleBtn3;
  const allBtns = [toggleBtn1, toggleBtn2, toggleBtn3];

  // (Deine bestehende Change-Active Logik bleibt gleich...)
  allBtns.forEach((btn) => {
    btn.on('change:active', (e) => {
      if (!e.active) return;
      allBtns.filter((b) => b !== btn).forEach((b) => {
        const isInfoTableCombo = (btn === toggleBtn1 && b === toggleBtn3) || 
                                 (btn === toggleBtn3 && b === toggleBtn1);
        if (!isInfoTableCombo) {
          b.setActive(false);
        }
      });
    });
  });

  bar.addControl(toggleBtn1);
  bar.addControl(toggleBtn2);
  bar.addControl(toggleBtn3);
  bar.setPosition('top-left');

  return bar;
}

export function createSubBarI(map) {
  // 1. Erst prüfen, ob permalinkControl (die globale Variable von ganz oben) existiert. Wenn nicht: frisch erstellen!
  if (!permalinkControl) {
    console.log("Permalink wird initialisiert");
    permalinkControl = new Permalink({
        className: 'ol-permalink-button',
        urlReplace: false, 
        refreshDelay: 100,
        localStorage: false, 
        visible: false,    
        anchor: false,     
        onclick: function(url) {
            navigator.clipboard.writeText(url).then(() => {
                const btn = document.querySelector('.ol-permalink-button button');
                if (btn) {
                    btn.innerHTML = "✅"; 
                    setTimeout(() => { btn.innerHTML = ""; }, 2000);
                }
              
            });
            zeigeNachricht("Link (aus Button) erstellt");
        }
    });
  }

  // --- DIE ALTE SUCHE WURDE HIER ENTFERNT ---

  const gpsToggleBtn = new Toggle({
    html: '<i class="fa fa-map-marker"></i>',
    title: 'GPS Position anzeigen',
    onToggle: function (active) {
      if (active) {
        const started = startGpsTracking(map, {
          onUnavailable: () => alert('Geolocation wird nicht unterstützt.'),
          onError: (error) => alert(`ERROR: ${error.message}`),
        });
        if (!started) gpsToggleBtn.setActive(false);
        return;
      }
      if (isGpsTrackingActive()) stopGpsTracking();
    },
  });

  const ptnToogleBtn = new Toggle({
    html: '<i class="fa fa-circle"></i>',
    title: 'Punkt setzen',
    onToggle: function (active) { 
      if (active) {
        initPtn(map); 
        handleCRSChange();
      } else {  
        ptnDelFindCoord();
      }
    },
  });

  const fileToogleBtn = new Toggle({
    html: '<i class="fa fa-file"></i>',
    title: 'Datei laden',
    onToggle: function (active) { 
        if (active) {
            fileToggleInput(map); 
            setTimeout(() => { this.setActive(false); }, 100);
        }
    },  
  });

  // --- Permalink Toggle Button ---
  const permalinkToggleBtn = new Toggle({
    html: '🔗',
    title: 'Permalink / Teilen aktivieren',
    onToggle: function (active) {
      if (active) {
        //Control zur Karte hinzufügen (erstellt das HTML-Element!)
        map.addControl(permalinkControl);
        permalinkControl.setUrlReplace(true);
         // Das Element im DOM suchen
        const permalinkButton = document.querySelector('.ol-permalink-button');
        //Sichtbar machen
        if (permalinkButton) {
          permalinkButton.style.display = 'block';
        }
      } else {
        // suchen, von der Karte löschen
        const permalinkButton = document.querySelector('.ol-permalink-button');
        if (permalinkButton) {permalinkButton.style.display = 'none';}
        permalinkControl.setUrlReplace(false);
        map.removeControl(permalinkControl);
        //window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  });

  return new Bar({ 
    toggleOne: true, 
    controls: [gpsToggleBtn, ptnToogleBtn, fileToogleBtn, permalinkToggleBtn] 
  });
}

// Hilfsfunktion (falls noch nicht vorhanden), um zu prüfen ob das Popout-Fenster wirklich offen ist
function isTableChildWindowOpen() {
  // Wenn ein Kind-Fenster aktiv ist, ist die Tabelle ausgelagert
  if (typeof getTableChildWindow === 'function') {
    const child = getTableChildWindow();
    if (child && !child.closed) return true;
  }
  // Falls kein Kind-Fenster verfügbar ist, prüfen wir, ob das Dokument anders ist
  if (typeof getTableDocument === 'function') {
    return getTableDocument() !== document;
  }
  return false;
}

export function createSubBarW(map) {
  const DgmKachelLayer = createDgmKachelLayer();
  const DomKachelLayer = createDomKachelLayer();
  const profilChart = createProfilLayer();

  // Button für DGM
 const dgmSubBtn = new Toggle({
    html: '<i class="fa fa-map"></i>',
    title: "DGM laden",
    onToggle: function (active) {
        // 1. Sicherstellen, dass die Gruppe in der Map existiert
        const layers = map.getLayers().getArray();
        if (!layers.includes(dgmGroup)) {
            map.addLayer(dgmGroup);
            // Falls der Switcher in main.js exportiert wurde:
            if (layerSwitcher) layerSwitcher.render();
        }

        // 2. Kachel-Layer (Übersicht) innerhalb der Gruppe verwalten
        // Wir prüfen, ob der Layer schon in der Gruppe (nicht in der Map!) ist
        const groupLayers = dgmGroup.getLayers().getArray();
        if (!groupLayers.includes(DgmKachelLayer)) {
            dgmGroup.getLayers().push(DgmKachelLayer);
        }

        // 3. Sichtbarkeit und Interaktion steuern
        if (active) {
            DgmKachelLayer.setVisible(true);
            // Falls du willst, dass die Kacheln im Switcher unter der Gruppe auftauchen:
            DgmKachelLayer.set('displayInLayerSwitcher', true);
            setDgmActive(true); 
        } else {
            DgmKachelLayer.setVisible(false);
            setDgmActive(false); 
            disableDgmInteraction();
        }

        // 4. LayerSwitcher explizit aktualisieren
        if (typeof layerSwitcher !== 'undefined') {
            layerSwitcher.render();
        }
    },
});

  // Button für DOM
  const domSubBtn = new Toggle({
    html: '<i class="fa-solid fa-file"></i>',
    title: "DOM laden",
    onToggle: function (active) {
        // 1. Sicherstellen, dass die Gruppe in der Map existiert
        const layers = map.getLayers().getArray();
        if (!layers.includes(domGroup)) {
            map.addLayer(domGroup);
            // Falls der Switcher in main.js exportiert wurde:
            if (layerSwitcher) layerSwitcher.render();
        }

        // 2. Kachel-Layer (Übersicht) innerhalb der Gruppe verwalten
        // Wir prüfen, ob der Layer schon in der Gruppe (nicht in der Map!) ist
        const groupLayers = domGroup.getLayers().getArray();
        if (!groupLayers.includes(DomKachelLayer)) {
            domGroup.getLayers().push(DomKachelLayer);
        }

        // 3. Sichtbarkeit und Interaktion steuern
        if (active) {
            DomKachelLayer.setVisible(true);
            // Falls du willst, dass die Kacheln im Switcher unter der Gruppe auftauchen:
            DomKachelLayer.set('displayInLayerSwitcher', true);
            setDomActive(true); 
        } else {
            DomKachelLayer.setVisible(false);
            setDomActive(false); 
            disableDomInteraction();
        }

        // 4. LayerSwitcher explizit aktualisieren
        if (typeof layerSwitcher !== 'undefined') {
            layerSwitcher.render();
        }
    },
  });

  // Button für Profil
 // Innerhalb deines Sub-Buttons:
  const profilSubBtn = new Toggle({
    html: '<i class="fa fa-area-chart"></i>',
    title: "Höhenprofil",
    onToggle: function (active) {
        if (active) {
            if (!map.getLayers().getArray().includes(profileLayer)) {
                map.addLayer(profileLayer);
            }
            profileLayer.setVisible(true);
            profileSource.clear();
            enableProfileDrawing(map, profileSource);
        } else {
            profileLayer.setVisible(false);
            disableProfileDrawing(map);
        }
    },
  });

  return new Bar({ 
    toggleOne: true, // Stellt sicher, dass man nicht DGM und DOM gleichzeitig in dieser Bar aktiviert
    controls: [dgmSubBtn, domSubBtn, profilSubBtn] 
  });
}

export function createSubBarT(map) {
  // 1. TABELLEN-BUTTON
  const tableToggleBtn = new Toggle({
    html: '<i class="fa fa-table" aria-hidden="true"></i>',
    title: 'Tabelle anzeigen',
    className: 'tabelle',
    onToggle: function (active) {
      isTableActive = active;
      if (active) {
        // Andere Sub-Buttons ausschalten
        if (isDrawActive && drawToggleBtnInstance) drawToggleBtnInstance.setActive(false);
        if (isWfsActive && wfsToggleBtnInstance) wfsToggleBtnInstance.setActive(false);

        if (mainTableBtnInstance) {
          const mainBtnEl = mainTableBtnInstance.element.querySelector('button') || mainTableBtnInstance.element;
          mainBtnEl.classList.add('is-running');
        }
        updateTableFromVisibleLayers(map);
      } else {
        if (!isDrawActive && !isWfsActive && mainTableBtnInstance) {
          const mainBtnEl = mainTableBtnInstance.element.querySelector('button') || mainTableBtnInstance.element;
          mainBtnEl.classList.remove('is-running');
        }
        closeTable(); 
      }
    },
  });
  tableToggleBtnInstance = tableToggleBtn;
  
  // 2. ZEICHEN-BUTTON
  const drawToggleBtn = new Toggle({
    html: '<i class="fa fa-pencil"></i>',
    title: 'Zeichenmodus',
    className: 'zeichnen',  
    onToggle: function (active) {
      isDrawActive = active;
      const drawBtns = document.getElementById('draw-bar');
      const wfsContainer = document.getElementById('wfs-loader'); // 💡 WFS-Container holen
      //  Den drawLayer aus der Karte suchen
      const drawLayer = map.getLayers().getArray().find(l => l.get('name') === 'drawLayer');
      if (active) {
        // Andere Sub-Buttons ausschalten
        if (isTableActive && tableToggleBtnInstance) tableToggleBtnInstance.setActive(false);
        if (isWfsActive && wfsToggleBtnInstance) wfsToggleBtnInstance.setActive(false);

        //  WFS-Eingabefenster explizit ausblenden und Liste leeren, falls noch offen
        if (wfsContainer) {
          wfsContainer.style.setProperty('display', 'none', 'important');
          const list = document.getElementById('wfs-layer-list');
          if (list) list.innerHTML = '';
        }

        // Zeichenleiste einblenden
        if (drawBtns) {
          drawBtns.style.setProperty('display', 'flex', 'important');
          drawBtns.classList.add('is-running');
          // drawLayer im Layer-Switcher einschalten
          if (drawLayer) {
            // Fall A: Layer existiert auf der Karte, nur einschalten
            drawLayer.set('displayInLayerSwitcher', true);
            drawLayer.setVisible(true);
          } else {
            // Fall B: 💡 Der Layer wurde vom Switcher gelöscht.
            // Wir bauen ihn hier einfach live neu und binden ihn an deine drawSource!
            const recreatedDrawLayer = new VectorLayer({ 
              source: drawSource, // Deine drawSource aus myDraw.js (die ist ja bekannt)
              title: 'drawLayer',
              name: 'drawLayer',
              displayInLayerSwitcher: true,
              visible: true
            });
            map.addLayer(recreatedDrawLayer);
            console.log("drawLayer wurde erfolgreich reanimiert und an die drawSource gekoppelt!");
          }
        }
        if (mainTableBtnInstance) {
          const mainBtnEl = mainTableBtnInstance.element.querySelector('button') || mainTableBtnInstance.element;
          mainBtnEl.classList.add('is-running');
        }
  } else {
        // 💡 1. Sicherheitsabfrage: Prüfen, ob gezeichnete Objekte vorhanden sind
        let hatFeatures = false;
        
        if (typeof drawSource !== 'undefined' && drawSource) {
            hatFeatures = drawSource.getFeatures().length > 0;
        } else if (drawLayer && typeof drawLayer.getSource === 'function') {
            const source = drawLayer.getSource();
            if (source && typeof source.getFeatures === 'function') {
                hatFeatures = source.getFeatures().length > 0;
            }
        }

        // 💡 2. Wenn Objekte da sind, den Nutzer um Bestätigung bitten
        if (hatFeatures) {
            const abbrechenBestaetigen = confirm(
                "Möchtest du die Zeichenleiste wirklich schließen?\n\nAlle noch nicht gespeicherten Elemente gehen dabei unwiderruflich verloren!"
            );
            
            // Wenn der Nutzer auf "Abbrechen" klickt, beenden wir die Funktion vorzeitig
            if (!abbrechenBestaetigen) {
                console.log("Schließen abgebrochen, Daten gesichert.");
                return; 
            }
        }

        // --- Ab hier läuft dein bisheriger Code unverändert weiter, falls die Karte leer war ODER bestätigt wurde ---

        // Zeichenleiste ausblenden
        if (drawBtns) { 
          drawBtns.style.setProperty('display', 'none', 'important');
          drawBtns.classList.remove('is-running');
          if (drawLayer) {
            // 💡 HIER DIE QUELLE LEEREN:
            if (typeof drawSource !== 'undefined' && drawSource) {
              drawSource.clear(); 
              console.log("drawSource erfolgreich geleert.");
            } else {
              const source = drawLayer.getSource();
              if (source && typeof source.clear === 'function') {
                source.clear();
                console.log("Source über drawLayer erfolgreich geleert.");
              }
            }
            drawLayer.set('displayInLayerSwitcher', false);
            drawLayer.setVisible(false); // 👈 Schaltet die Darstellung auf der Karte ab
            
            map.changed(); 
          }
        }
        deactivateDrawing();
        if (!isTableActive && !isWfsActive && mainTableBtnInstance) {
          const mainBtnEl = mainTableBtnInstance.element.querySelector('button') || mainTableBtnInstance.element;
          mainBtnEl.classList.remove('is-running');
        }
    }
    // Ende ontoggle
    }
  // Ende drawToggleBtn
  });
  drawToggleBtnInstance = drawToggleBtn;

  // 3. WFS-LOADER-BUTTON
  const wfsToggleBtn = new Toggle({
    html: '<i class="fa fa-cloud-download" aria-hidden="true"></i>',
    title: 'WFS-Dienst laden',
    className: 'wfs-loader-btn',
    onToggle: function (active) {
      isWfsActive = active;
      const wfsContainer = document.getElementById('wfs-loader');
      const drawBtns = document.getElementById('draw-bar'); // 💡 Zeichenleiste holen

      if (active) {
        // Andere Sub-Buttons ausschalten
        if (isTableActive && tableToggleBtnInstance) tableToggleBtnInstance.setActive(false);
        if (isDrawActive && drawToggleBtnInstance) drawToggleBtnInstance.setActive(false);

        // 💡 NEU: Zeichenleiste explizit ausblenden, falls sie noch aktiv war
        if (drawBtns) {
          drawBtns.style.setProperty('display', 'none', 'important');
          drawBtns.classList.remove('is-running');
        }
        deactivateDrawing();

        // WFS-Eingabefenster anzeigen
        if (wfsContainer) {
          wfsContainer.style.setProperty('display', 'flex', 'important');
        }
        
        if (mainTableBtnInstance) {
          const mainBtnEl = mainTableBtnInstance.element.querySelector('button') || mainTableBtnInstance.element;
          mainBtnEl.classList.add('is-running');
        }
      } else {
        // WFS-Eingabefenster ausblenden
        if (wfsContainer) {
          wfsContainer.style.setProperty('display', 'none', 'important');
          const list = document.getElementById('wfs-layer-list');
          if (list) list.innerHTML = '';
        }
        
        if (!isTableActive && !isDrawActive && mainTableBtnInstance) {
          const mainBtnEl = mainTableBtnInstance.element.querySelector('button') || mainTableBtnInstance.element;
          mainBtnEl.classList.remove('is-running');
        }
      }
    }
  });
  wfsToggleBtnInstance = wfsToggleBtn;

  return new Bar({ 
    toggleOne: false, 
    controls: [tableToggleBtn, drawToggleBtn, wfsToggleBtn] 
  });
}

export function createDataTable(map) {
  const table = new Tabulator('#wms_data_table', {
    height: '100%',
    placeholder: "Warte auf Daten...",
  });
  return table;
}

export function isTableEnabled() {
  return isTableActive;
}

// In control.js oder table.js (wo deactivateTableToggle definiert ist)
export function deactivateTableToggle() {
  isTableActive = false;
  // 1. Dem Toggle-Button auf der Karte sagen, dass er wieder "deaktiviert" ist
  if (tableToggleBtnInstance && typeof tableToggleBtnInstance.setActive === 'function') {
    // Falls deine Toggle-Bibliothek (z.B. ol-ext) "setActive" nutzt:
    tableToggleBtnInstance.setActive(false); 
  } else if (tableToggleBtnInstance && tableToggleBtnInstance.element) {
    // Fallback: Falls die Bibliothek die CSS-Klasse manuell verwaltet:
    tableToggleBtnInstance.element.classList.remove('active');
    tableToggleBtnInstance.element.classList.remove('ol-active');
  }

  // 2. Den Hauptbutton optisch zurücksetzen (dein bestehender Code)
  if (mainTableBtnInstance) {
    mainTableBtnInstance.element.classList.remove('is-running');
  }
}

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
  //map.addControl(new CanvasAttribution());
  map.addControl(new CanvasTitle({ 
    title: 'Print-Preview', 
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


 
export function initializeWMS(map) {
  var cap = new WMSCapabilities({
    target: document.body, // Oder ein spezielles Div
    srs: ['EPSG:3857', 'EPSG:4326', 'EPSG:25832'], // Deine Projektionen
    cors: true,
    popupLayer: true,
    placeholder: 'WMS link hier einfügen...',
    title: 'WMS-Dienste',
    name: 'WMS-Dienste',
    searchLabel: 'Suche',
    optional: 'token',
    services: {
      'Verwaltungsgrenzen NI ': 'https://opendata.lgln.niedersachsen.de/doorman/noauth/verwaltungsgrenzen_wms',            
        'Hydro, Umweltkarten NI ': 'https://www.umweltkarten-niedersachsen.de/arcgis/services/Hydro_wms/MapServer/WMSServer?VERSION=1.3.0.&SERVICE=WMS&REQUEST=GetCapabilities',  
        'WRRL, Umweltkarten NI ': 'https://www.umweltkarten-niedersachsen.de/arcgis/services/WRRL_wms/MapServer/WMSServer?VERSION=1.3.0.&SERVICE=WMS&REQUEST=GetCapabilities',
        'Natur, Umweltkarten NI': 'https://www.umweltkarten-niedersachsen.de/arcgis/services/Natur_wms/MapServer/WMSServer?VERSION=1.3.0.&SERVICE=WMS&REQUEST=GetCapabilities',
        'Natur, LK':'https://geodaten.emsland.de:443/core-services/services/lkel_fb67_naturschutz_und_forsten_wms?',
        'HW-Schutz, Umwelkarten NI':'https://www.umweltkarten-niedersachsen.de/arcgis/services/HWSchutz_wms/MapServer/WMSServer?VERSION=1.3.0.&SERVICE=WMS&REQUEST=GetCapabilities',
        'schutzgebiete, NL': 'https://service.pdok.nl/provincies/aardkundige-waarden/wms/v1_0?request=GetCapabilities&service=WMS',
        'krw wateren, NL': 'https://service.pdok.nl/ihw/gebiedsbeheer/krw-oppervlaktewaterlichamen/wms/v1_0?SERVICE=WMS&VERSION=1.3.0&request=getcapabilities',
        'luchtfotos, NL': 'https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0?',
        'EU-Waterbodies 3rd RBMP': 'https://water.discomap.eea.europa.eu/arcgis/services/WISE_WFD/WFD2022_SurfaceWaterBody_WM/MapServer/WMSServer?request=GetCapabilities&service=WMS',
        //'Luft u. Lärm': 'https://www.umweltkarten-niedersachsen.de/arcgis/services/Luft_Laerm_wms/MapServer/WMSServer?VERSION=1.3.0.&SERVICE=WMS&REQUEST=GetCapabilities',
        'Boden, Umweltkarten NI': 'https://www.umweltkarten-niedersachsen.de/arcgis/services/Boden_wms/MapServer/WMSServer?VERSION=1.3.0.&SERVICE=WMS&REQUEST=GetCapabilities',
        'Pegelonline, DE': 'https://www.pegelonline.wsv.de/webservices/gis/wms/aktuell/mnwmhw?request=GetCapabilities&service=WMS&version=1.3.0',
        'Inspire Hydro': 'https://sg.geodatenzentrum.de/wms_dlm250_inspire?Request=GetCapabilities&SERVICE=WMS',
        'Drenthe Geodata': 'https://services.geodataoverijssel.nl/geoserver/ows?'
    },
  trace: true
  });

  map.addControl(cap);
  // Event-Handling wenn ein Layer ausgewählt wurde
    cap.on('load', (e) => {
      const layer = e.layer;
      const rawTitle = (e.options.data && (e.options.data.title || e.options.data.Name)) || "WMS Layer";
      const permalinkId = rawTitle.toLowerCase().replace(/\s+/g, '_');
      layer.set('permalink', permalinkId);
      console.log(`Permalink für Layer "${rawTitle}": ${permalinkId}`);
      layer.set('title', rawTitle);
      layer.set('name', rawTitle); // Falls du 'name' als ID nutzt
      // Layer der Karte hinzufügen
      map.addLayer(layer);
      console.log('externer WMS-Layer hinzugefügt:', layer);
      setTimeout(() => {
        if (typeof permaFunktionality !== 'undefined' && permaFunktionality) {
          permaFunktionality.changed();
        }
      }, 250); // Etwas großzügigerer Puffer für die Stabilität
  });
}

export function zeigeNachricht(txt) {
  var x = document.getElementById("myShortMessage");
  x.className = "toast show";
  x.textContent = txt;
  console.log (x);
  // Nach 3 Sekunden (3000ms) wieder ausblenden
  setTimeout(function(){ 
    x.className = x.className.replace("toast show", "toast");   
  }, 2000);
}

export function initializeWFS(map) {
  
  const wfsUrl = prompt("Bitte WFS URL eingeben:");
  if (!wfsUrl) {
    alert("Keine URL eingegeben!");
    return;
  } else {
    // Hier könntest du die URL validieren, bevor du fortfährst
    const vectorLayer = new VectorLayer({     
      source: new VectorSource({
        format: new GeoJSON(),
        url: wfsUrl,  
        strategy: bboxStrategy
      }),
      style: new Style({
        fill: new Fill({ color: 'rgba(255, 0, 0, 0.5)' }),
        stroke: new Stroke({ color: 'red', width: 1 })
      })
    })
  };
    map.addLayer(vectorLayer);    
  }
  

  