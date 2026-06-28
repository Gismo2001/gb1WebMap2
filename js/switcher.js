
import ContextMenu from 'ol-contextmenu';
import { transform } from 'ol/proj';
import { createNewGroupFromLayers } from './layers.js';
import { convertToDMS } from './utils.js';
import { isDrawingActive } from './myDraw.js';
import { swipeControl, activateLayerSwipe, deactivateLayerSwipe } from './controls.js';

const MOBILE_PRESS_DELAY = 600;

function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

function isMobileScreen() {
  return window.innerWidth <= 768 || isTouchDevice();
}

function showSwitcherInfo(message) {
  const toastElement = document.getElementById('myShortMessage');
  if (toastElement) {
    toastElement.textContent = message;
    toastElement.className = 'toast show';
    window.setTimeout(() => {
      toastElement.className = toastElement.className.replace('toast show', 'toast');
    }, 2500);
    return;
  }
  console.log('[Switcher] ' + message);
}

function cancelTargetingMode(layerSwitcher) {
  window.layerToMove = null;
  const switcherEl = layerSwitcher && layerSwitcher.element;
  if (switcherEl) switcherEl.classList.remove('targeting-group-mode');
}

export function switcherToggle(layerSwitcher) {
  layerSwitcher.on('drawlist', (evt) => {
    const clickedLayer = evt.layer;
    const labelElement = evt.li.querySelector('label');
    const listItem = evt.li;
    const isGroup = typeof clickedLayer.getLayers === 'function';

    if (!labelElement || !listItem) return;

    listItem._olLayer = clickedLayer;
    labelElement.style.touchAction = 'manipulation';
    labelElement.style.userSelect = 'none';

    let touchTimer = null;
    let isLongPress = false;

    const clearTouchTimer = () => {
      if (touchTimer !== null) {
        window.clearTimeout(touchTimer);
        touchTimer = null;
      }
    };

    const startLongPress = () => {
      isLongPress = false;
      clearTouchTimer();
      touchTimer = window.setTimeout(() => {
        isLongPress = true;
        if (!isGroup) {
          window.layerToMove = clickedLayer;
          showSwitcherInfo(`Verschiebemodus aktiv: Tippe jetzt auf die Ziel-Gruppe für "${clickedLayer.get('title') || 'Layer'}".`);
          const switcherEl = layerSwitcher.element;
          if (switcherEl) switcherEl.classList.add('targeting-group-mode');
        }
      }, MOBILE_PRESS_DELAY);
    };

    const stopLongPress = () => {
      clearTouchTimer();
    };

    const touchStartHandler = (event) => {
      if (!isMobileScreen()) return;
      startLongPress(event);
    };

    if (window.PointerEvent) {
      labelElement.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') touchStartHandler(e);
      }, { passive: true });
      labelElement.addEventListener('pointerup', (e) => {
        if (e.pointerType === 'touch') stopLongPress();
      });
      labelElement.addEventListener('pointercancel', (e) => {
        if (e.pointerType === 'touch') stopLongPress();
      });
      labelElement.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'touch') stopLongPress();
      }, { passive: true });
    } else {
      labelElement.addEventListener('touchstart', touchStartHandler, { passive: true });
      labelElement.addEventListener('touchend', stopLongPress);
      labelElement.addEventListener('touchcancel', stopLongPress);
      labelElement.addEventListener('touchmove', stopLongPress, { passive: true });
    }

    labelElement.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (isLongPress) {
        isLongPress = false;
        return;
      }

      if (window.layerToMove) {
        const isTargetGroup = typeof clickedLayer.getLayers === 'function';

        if (!isTargetGroup) {
          showSwitcherInfo('Fehler: Bitte wähle eine Layer-Gruppe als Ziel aus!');
          return;
        }

        if (window.layerToMove === clickedLayer) {
          showSwitcherInfo('Ein Layer kann nicht in sich selbst verschoben werden.');
          return;
        }

        const map = layerSwitcher.getMap();

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

        removeLayerFromTree(window.layerToMove, map.getLayerGroup());
        clickedLayer.getLayers().push(window.layerToMove);

        showSwitcherInfo(`Layer erfolgreich in Gruppe "${clickedLayer.get('title')}" verschoben!`);
        cancelTargetingMode(layerSwitcher);
        layerSwitcher.render();
        map.changed();
        return;
      }

      const isMultiSelectKey = e.shiftKey;

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
    const layer = evt.layer;
    evt.li.querySelector('label').addEventListener('click', () => {
      console.log('Layerswitcher Click');
    });
  });
}

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

    setupOutsideClickClose(contextMenu);

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
  const labelText = listItem ? listItem.querySelector('label')?.innerText.trim() : 'Unbekannt';
  const currentTitle = clickedLayer ? clickedLayer.get('title') || labelText : labelText;
  if (!clickedLayer) return;
  // 🎯 SCHRITT 0: Das Kontextmenü komplett leeren, damit keine alten Einträge überleben!
  if (typeof contextMenu.clear === 'function') {
    contextMenu.clear();
  }
  // 1. ZUERST prüfen, ob es eine Gruppe ist
  const isGroup = typeof clickedLayer.getLayers === 'function';
  
  // 2. getSource() NUR aufrufen, wenn es KEINE Gruppe ist
  const source = !isGroup && typeof clickedLayer.getSource === 'function' ? clickedLayer.getSource() : null;

  // 3. Jetzt ist die Prüfung auf WMS sicher
  const legendUrl = getWmsLegendUrl(source);
  const isWms = !!legendUrl;

  // Gemeinsame Aktion: Umbenennen
  const renameAction = {
    text: 'Umbenennen...',
    icon: '/data/rename.svg',
    callback: function () {
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
  else 
  {
    
    // Prüfen, ob GENAU DIESER clickedLayer gerade im Swipe-Control aktiv ist
    const istImSplit = swipeControl && 
                   typeof swipeControl.getLayers === 'function' && 
                   swipeControl.getLayers().includes(clickedLayer);
    contextMenu.extend([
      renameAction,
      '-',
      // Legende anzeigen (nur bei WMS-Layern)
      ...(isWms ? 
        [{
      text: 'Legende anzeigen',
      icon: '/data/legend.svg', 
      callback: () => showLegendModal(currentTitle, legendUrl)
      }, '-'] : []
      ),
      '-',
     // 🎯 DYNAMISCHE SPLIT-WEICHE
  ...(isWms ? [
    istImSplit ? {
      text: 'Split aufheben',
      icon: '/data/splitscreen.svg', // Falls du ein passendes Icon hast
      callback: () => deactivateLayerSwipe(map) // Funktion zum Entfernen des Controls
    } : {
      text: 'im Split anzeigen',
      icon: '/data/splitscreen.svg', 
      callback: () => activateLayerSwipe(map, clickedLayer)
    },
    '-'
  ] : []),
      {
      text: 'Zu Gruppe',
      icon: '/data/add_folder.svg',
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
          const lon = transformierteKoordinaten[0];
          const lat = transformierteKoordinaten[1];
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

// --- Hilfsfunktion: Menü bei Klick außerhalb schließen ---
function setupOutsideClickClose(contextMenu) {
  const closeOnOutsideClick = (evt) => {
    if (!contextMenu.isOpen()) return;

    const menuElement = contextMenu.element;
    const target = evt.target;

    if (target instanceof Node && menuElement && menuElement.contains(target)) {
      return;
    }

    contextMenu.closeMenu();
  };

  document.removeEventListener('mousedown', closeOnOutsideClick, true);
  document.addEventListener('mousedown', closeOnOutsideClick, true);

  contextMenu.once('close', () => {
    document.removeEventListener('mousedown', closeOnOutsideClick, true);
  });
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

// --- Hilfsfunktion: wms-Legende URL holen ---
function getWmsLegendUrl(source, layerNameOverride) {
  if (!source || typeof source.getUrls !== 'function' && typeof source.getUrl !== 'function') {
    return null;
  }

  // Basis-URL holen (TileWMS hat getUrls(), ImageWMS hat getUrl())
  let baseUrl;
  if (typeof source.getUrls === 'function') {
    const urls = source.getUrls();
    baseUrl = urls && urls[0];
  } else if (typeof source.getUrl === 'function') {
    baseUrl = source.getUrl();
  }
  if (!baseUrl) return null;

  const params = source.getParams ? source.getParams() : {};
  const layerName = layerNameOverride || params['LAYERS'];
  if (!layerName) return null;

  // Falls mehrere Layer kommagetrennt sind: nur den ersten für die Legende nehmen
  const firstLayer = layerName.split(',')[0];

  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=1.1.1&FORMAT=image/png&LAYER=${encodeURIComponent(firstLayer)}`;
}

// --- Hilfsfunktion: wms-Legende URL anzeigen ---
function showLegendModal(layerTitle, url) {
  // Falls bereits ein Modal offen ist, entfernen
  const altesModal = document.getElementById('wms-legend-modal');
  if (altesModal) altesModal.remove();

  // Modal-HTML erstellen
  const modal = document.createElement('div');
  modal.id = 'wms-legend-modal';
  modal.style = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    background: white; padding: 5px; border-radius: 2px; z-index: 9999;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3); max-width: 90%; max-height: 80%; overflow: auto;
  `;

  modal.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
      <h3 style="margin: 0; font-size: 16px;">Legende: ${layerTitle || 'WMS Layer'}</h3>
      <button id="close-legend-btn" style="cursor: pointer; background: none; border: none; font-size: 20px;">&times;</button>
    </div>
    <div style="text-align: center;">
      <img src="${url}" alt="Lade Legende..." style="max-width: 100%;" />
    </div>
  `;

  document.body.appendChild(modal);

  // Schließen-Event
  document.getElementById('close-legend-btn').onclick = () => modal.remove();
}
