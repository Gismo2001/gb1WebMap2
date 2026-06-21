
export function switcherToggle(layerSwitcher) {
  layerSwitcher.on('drawlist', (evt) => {
    var clickedLayer = evt.layer;
    const labelElement = evt.li.querySelector('label');
    const listItem = evt.li;

    listItem._olLayer = clickedLayer;

    // Timer für das Gedrückthalten auf dem Handy
    let touchTimer;
    let isLongPress = false;

    // =========================================================================
    // 📱 HANDY-STEUERUNG: Long-Press aktiviert den Gruppen-Verschiebemodus
    // =========================================================================
    labelElement.addEventListener('touchstart', (e) => {
      isLongPress = false;
      const isGroup = typeof clickedLayer.getLayers === 'function';

      // Wenn der Nutzer den Finger 600ms hält...
      touchTimer = setTimeout(() => {
        isLongPress = true;

        // Gruppen müssen nicht verschoben werden, das betrifft nur Einzellayer
        if (!isGroup) {
          // 💡 SCHALTE DEN MODUS SCHARF (Ersetzt den Rechtsklick auf dem Handy!)
          window.layerToMove = clickedLayer;
          
          alert(`Verschiebemodus aktiv: Bitte tippe jetzt auf die Ziel-Gruppe für "${clickedLayer.get('title') || 'Layer'}".`);
          
          const switcherEl = layerSwitcher.element;
          if (switcherEl) switcherEl.classList.add('targeting-group-mode');
        }
      }, 600); 
    }, { passive: true });

    labelElement.addEventListener('touchend', () => {
      // Finger rechtzeitig angehoben -> Kein Long-Press
      clearTimeout(touchTimer);
    });

    labelElement.addEventListener('touchmove', () => {
      // Wenn der Nutzer scrollt, Aktion abbrechen
      clearTimeout(touchTimer);
    });

    // =========================================================================
    // 💻 CLICK-STEUERUNG: Normales Auswählen ODER Ziel-Gruppe einrasten lassen
    // =========================================================================
    labelElement.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Wenn das Event gerade eben schon als Long-Press gefeuert hat, hier stoppen
      if (isLongPress) return;

      // -----------------------------------------------------------------------
      // AKTIV: Wenn wir uns im Verschiebemodus befinden (Handy & Desktop)
      // -----------------------------------------------------------------------
      if (window.layerToMove) {
        const isTargetGroup = typeof clickedLayer.getLayers === 'function';

        if (!isTargetGroup) {
          alert("Fehler: Bitte wähle eine LAYER-GRUPPE (Ordner) als Ziel aus!");
          return;
        }

        if (window.layerToMove === clickedLayer) {
          alert("Ein Layer kann nicht in sich selbst verschoben werden.");
          return;
        }

        const map = layerSwitcher.getMap();
        
        // Hilfsfunktion zum Entfernen aus dem alten Verzeichnis
        function removeLayerFromTree(layerToRemove, currentGroup) {
          const layersInGroup = currentGroup.getLayers();
          if (layersInGroup.getArray().includes(layerToRemove)) {
            layersInGroup.remove(layerToRemove);
            return true;
          }
          for (let i = 0; i < layersInGroup.getLength(); i++) {
            const subLayer = layersInGroup.item(i);
            if (typeof subLayer.getLayers === 'function') {
              if (removeLayerFromTree(layerToRemove, subLayer)) return true;
            }
          }
          return false;
        }

        // Verschieben durchführen
        removeLayerFromTree(window.layerToMove, map.getLayerGroup());
        clickedLayer.getLayers().push(window.layerToMove);

        console.log(`Layer erfolgreich in Gruppe "${clickedLayer.get('title')}" verschoben!`);

        // Modus beenden & aufräumen
        window.layerToMove = null;
        const switcherEl = layerSwitcher.element;
        if (switcherEl) switcherEl.classList.remove('targeting-group-mode');

        layerSwitcher.render();
        map.changed();
        return; 
      }

      // -----------------------------------------------------------------------
      // STANDARD: Normales Auswählen (Einzelauswahl / Desktop-Mehrfachauswahl)
      // -----------------------------------------------------------------------
      const isMultiSelectKey = e.shiftKey; // Shift für PC-Mehrfachauswahl

      if (isMultiSelectKey) {
        labelElement.classList.toggle('is-selected');
      } else {
        const allLabels = layerSwitcher.element.querySelectorAll('label');
        allLabels.forEach(lbl => {
          if (lbl !== labelElement) lbl.classList.remove('is-selected');
        });
        labelElement.classList.toggle('is-selected');
      }
    });

    labelElement.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  });
}

//Eventhandler für Layerswitcher Click 
export function switcherDrawList(layerSwitcher) {
  layerSwitcher.on('drawlist', (evt) => {
  var layer = evt.layer;
  evt.li.querySelector('label').addEventListener('click', () => {
    console.log('Layerswitcher Click')
  });
});
}


import ContextMenu from 'ol-contextmenu'; // Falls du es als Modul importierst
import { transform } from 'ol/proj';
// Importiere hier ggf. benötigte Hilfsfunktionen wie:
import { createNewGroupFromLayers } from './layers.js';
import { convertToDMS } from './utils.js';
import { isDrawingActive } from './myDraw.js';

export function initMapContextMenu(map, layerSwitcher) {
  
  // 1. Instanz des Kontextmenüs erstellen
  const contextMenu = new ContextMenu({
    width: 190,
    defaultItems: false // Keine Standard-Einträge
  });

  map.addControl(contextMenu);

  // 2. Event-Listener für das Öffnen des Menüs
  contextMenu.on('open', function (evt) {
    const koordinaten = evt.coordinate;
    contextMenu.clear();

    const targetElement = evt.originalEvent.target;
    const isInsideSwitcher = targetElement.closest('.ol-layerswitcher');

    // =========================================================================
    // 📂 FALL A: RECHTSKLICK IM LAYER-SWITCHER
    // =========================================================================
    if (isInsideSwitcher) {
      handleLayerSwitcherMenu(evt, targetElement, map, layerSwitcher, contextMenu);
      return; 
    }

    // =========================================================================
    // 🌍 FALL B: RECHTSKLICK AUF FREIE KARTE (Koordinaten-Menü)
    // =========================================================================
    handleMapFreeClickMenu(koordinaten, contextMenu);
  });

  // 3. Touch- & Mobile-Schutz registrieren
  setupMobileProtection(map);
}

// --- Hilfsfunktion: Menü für Layer-Switcher aufbauen ---
function handleLayerSwitcherMenu(evt, targetElement, map, layerSwitcher, contextMenu) {
  const listItem = targetElement.closest('li');
  const clickedLayer = listItem ? listItem._olLayer : null;
  //const labelText = listItem ? listItem.querySelector('label').innerText.trim() : 'Unbekannt';

  if (!clickedLayer) return;

  const isGroup = typeof clickedLayer.getLayers === 'function';

  // Gemeinsame Aktion: Umbenennen
  const renameAction = {
    text: 'Umbenennen...',
    icon: '/data/rename.svg',
    callback: function () {
      //const currentTitle = clickedLayer.get('title') || labelText;
      const newTitle = prompt(`Neuen Namen für "${currentTitle}" eingeben:`, currentTitle);
      if (newTitle && newTitle.trim() !== "") {
        clickedLayer.set('title', newTitle.trim());
        if (layerSwitcher && typeof layerSwitcher.render === 'function') layerSwitcher.render();
      }
    }
  };

  const switcherEl = targetElement.closest('.ol-layerswitcher');
  const selectedLabels = switcherEl ? switcherEl.querySelectorAll('label.is-selected') : [];
  const isMultiSelectActive = selectedLabels.length >= 2;

  // 1. Mehrfachauswahl aktiv
  if (isMultiSelectActive) {
    contextMenu.extend([
      //{ text: `Aktion für ${selectedLabels.length} gewählte Layer:`, classname: 'menu-layer-header', disabled: true },
      //'-',
      {
        text: 'In neue Gruppe',
        icon: '/data/folderopen.svg',
        callback: () => {
          const layersToGroup = [];
          selectedLabels.forEach(lbl => {
            const li = lbl.closest('li');
            if (li && li._olLayer) layersToGroup.push(li._olLayer);
          });
          createNewGroupFromLayers(layersToGroup, map, layerSwitcher);
        }
      },
      {
        text: 'Auswahl aufheben',
        icon: '/data/unselect.svg',
        callback: () => selectedLabels.forEach(lbl => lbl.classList.remove('is-selected'))
      }
    ]);
  } 
  // 2. Rechtsklick auf Gruppe (Ordner)
  else if (isGroup) {
    contextMenu.extend([
      
      
      renameAction,
      '-',
      {
        text: 'Alle Layer ein',
        icon: '/data/checked.svg',
        callback: () => {
          clickedLayer.getLayers().forEach(sl => {
            sl.setVisible(true);
            if (typeof sl.getLayers === 'function') sl.getLayers().forEach(gsl => gsl.setVisible(true));
          });
          map.changed();
        }
      },
      {
        text: 'Alle Layer aus',
        icon: '/data/unchecked.svg',
        callback: () => {
          clickedLayer.getLayers().forEach(sl => {
            sl.setVisible(false);
            if (typeof sl.getLayers === 'function') sl.getLayers().forEach(gsl => gsl.setVisible(false));
          });
          map.changed();
        }
      }
    ]);
  } 
  // 3. Rechtsklick auf Einzellayer
  else {
    contextMenu.extend([
    
    
      renameAction,
      '-',
      {
        text: 'Zu Gruppe',
        icon: '/data/add_folder.svg',
        //icon: 'fa fa-share', // 👈 Ganz sauber, ohne Anführungszeichen-Trick!
        callback: () => {
          window.layerToMove = clickedLayer;
          alert(`Bitte klicke jetzt im Layer-Switcher auf die Ziel-Gruppe...`);
          if (switcherEl) switcherEl.classList.add('targeting-group-mode');
        }
      },
      '-',
      {
  text: 'Filtern',
  icon: '/data/filterlist.svg',
  callback: () => {
    const source = clickedLayer.getSource();
    if (!source || typeof source.getFeatures !== 'function') {
      alert('Filtern ist nur für Vektor-Layer verfügbar!');
      return;
    }

    // 1. Nutzer nach dem Filterwert fragen
    const aktuellerFilter = clickedLayer.get('currentFilter') || '';
    const filterWert = prompt('Nach welchem Attributwert soll gefiltert werden? (Leerlassen zum Zurücksetzen):', aktuellerFilter);

    // 2. Filterwert auf dem Layer speichern (für spätere Abfragen)
    if (filterWert === null) return; // Abbrechen gedrückt
    
    const bereinigterFilter = filterWert.trim().toLowerCase();
    clickedLayer.set('currentFilter', bereinigterFilter);

    // 3. Den Style-Funktion des Layers anpassen
    // Wir merken uns den originalen Style, falls noch nicht geschehen
    if (!clickedLayer.get('originalStyle')) {
      clickedLayer.set('originalStyle', clickedLayer.getStyle());
    }

    const originalStyle = clickedLayer.get('originalStyle');

    // Wenn der Filter leer ist, setzen wir den Original-Style zurück
    if (bereinigterFilter === '') {
      clickedLayer.setStyle(originalStyle);
      return;
    }

    // 4. Dynamischen Style-Filter setzen
    clickedLayer.setStyle(function (feature, resolution) {
      // Hole alle Eigenschaften des Features (z. B. { name: 'Schleuse', typ: 'Kanal' })
      const properties = feature.getProperties();
      
      // Prüfen, ob IRGENDEIN Textfeld den Suchbegriff enthält
      const treffer = Object.values(properties).some(val => {
        if (typeof val === 'string' || typeof val === 'number') {
          return String(val).toLowerCase().includes(bereinigterFilter);
        }
        return false;
      });

      if (treffer) {
        // Feature entspricht dem Filter -> Normal zeichnen
        // Falls originalStyle eine Funktion ist, rufen wir sie auf, sonst geben wir ihn direkt zurück
        return typeof originalStyle === 'function' ? originalStyle(feature, resolution) : originalStyle;
      } else {
        // Feature entspricht NICHT dem Filter -> Nicht zeichnen (unsichtbar)
        return null; 
      }
    });
  }
},
      '-',
      {
  text: 'Filter aufheben',
  icon: '/data/filter_clear.svg', // Falls du ein passendes Icon hast
  // Der Button ist ausgegraut (disabled), wenn aktuell gar kein Filter gesetzt ist
  disabled: !clickedLayer.get('currentFilter'), 
  callback: () => {
    const originalStyle = clickedLayer.get('originalStyle');

    if (originalStyle) {
      // 1. Den originalen Style wieder auf den Layer anwenden
      clickedLayer.setStyle(originalStyle);
      
      // 2. Die Filter-Merker vom Layer löschen
      clickedLayer.unset('currentFilter');
      
      // Optional: Karte einmal explizit updaten, falls die Features nicht sofort erscheinen
      map.changed();
    }
  }
},
      {
        text: 'Auf Layer zoomen',
        icon: '/data/zoomborder.svg',
        callback: () => {
          const source = clickedLayer.getSource();
          if (source && typeof source.getExtent === 'function') {
            map.getView().fit(source.getExtent(), { duration: 800, padding: [50, 50, 50, 50] });
          }
        }
      },
      { text: 'Transparenz: 50%', icon: '/data/transparenz.svg', callback: () => clickedLayer.setOpacity(0.5) },
      { text: 'Voll sichtbar (100%)', icon: '/data/untransparenz.svg', callback: () => clickedLayer.setOpacity(1.0) }
    ]);
  }
}

// --- Hilfsfunktion: Menü für freie Karte aufbauen ---
function handleMapFreeClickMenu(koordinaten, contextMenu) {
  const epsgSysteme = [
    { code: 'EPSG:25832', label: 'ETRS89 / UTM 32N (25832)', digits: 2, type: 'standard' },
    { code: 'EPSG:32632', label: 'WGS84 / UTM 32N (32632)', digits: 2, type: 'standard' },
    { code: 'EPSG:4326',  label: 'WGS84 / Lat, Lon (Dezimal)', digits: 5, type: 'standard', order: 'YX' },
    { code: 'EPSG:4326',  label: 'WGS84 / Grad, Min, Sek (DMS)', type: 'DMS' },
    { code: 'EPSG:3857',  label: 'Web Mercator (3857)', digits: 2, type: 'standard' }
  ];

  const submenuItems = epsgSysteme.map(sys => {
    return {
      text: sys.label,
      classname: 'submenu-item-style',
      callback: function () {
        const transformierteKoordinaten = transform(koordinaten, 'EPSG:3857', sys.code);
        let textToCopy = "";

        if (sys.type === 'DMS') {
          const lon = transformierteCoordinates[0];
          const lat = transformierteCoordinates[1];
          textToCopy = `${convertToDMS(lat, 'LAT')}, ${convertToDMS(lon, 'LON')}`;
        } else {
          textToCopy = sys.order === 'YX' 
            ? `${transformierteKoordinaten[1].toFixed(sys.digits)}, ${transformierteKoordinaten[0].toFixed(sys.digits)}`
            : `${transformierteKoordinaten[0].toFixed(sys.digits)}, ${transformierteKoordinaten[1].toFixed(sys.digits)}`;
        }

        navigator.clipboard.writeText(textToCopy)
          .then(() => console.log("Kopiert:", textToCopy))
          .catch(() => alert(`Koordinaten: ${textToCopy}`));
      }
    };
  });

  contextMenu.extend([
    { text: 'Koordinaten anzeigen', classname: 'main-menu-item-style', icon: 'fa fa-map-marker', items: submenuItems },
    '-',
    {
        text: 'Google Maps Navigation',
        icon: '/data/navigation.png',
        //icon: 'fa fa-location-arrow',
        callback: () => {
        const coord4326 = transform(koordinaten, 'EPSG:3857', 'EPSG:4326');
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${coord4326[1]},${coord4326[0]}`, '_blank');
      }
    },
    {
      text: 'Street View öffnen',
      icon: '/data/streetview.svg',
      callback: () => {
        const coord4326 = transform(koordinaten, 'EPSG:3857', 'EPSG:4326');
        window.open(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${coord4326[1]},${coord4326[0]}`, '_blank');
      }
    }
  ]);
}

// --- Hilfsfunktion: Touch-Long-Press Unterdrückung ---
function setupMobileProtection(map) {
  map.getViewport().addEventListener('contextmenu', function (e) {
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const deleteBtn = document.getElementById('draw-clear');
    const isDeleteActive = deleteBtn && deleteBtn.classList.contains('active');
    
    if (isMobile && (isDrawingActive() || isDeleteActive)) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
}