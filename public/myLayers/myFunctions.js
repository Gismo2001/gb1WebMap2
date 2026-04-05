import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';
import { getArea } from 'ol/sphere';
import { transform } from 'ol/proj';
import Style from 'ol/style/Style';
import Stroke from 'ol/style/Stroke';
import Fill from 'ol/style/Fill';

proj4.defs('EPSG:25832', '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs');
register(proj4); // OpenLayers weiß jetzt, wie EPSG:25832 funktioniert

export function UTMToLatLon_Fix(east, north, zone, isNorthernHemisphere) {
    const a = 6378137;
    const e = 0.081819191;
    const k0 = 0.9996;
    const pi = Math.PI;

    if (!isNorthernHemisphere) {
        north -= 10000000;
    }

    let longOrigin = (zone - 1) * 6 - 180 + 3;
    let M = north / k0;
    let e1 = (1 - Math.sqrt(1 - e ** 2)) / (1 + Math.sqrt(1 - e ** 2));
    let mu = M / (a * (1 - e ** 2 / 4 - 3 * (e ** 4) / 64 - 5 * (e ** 6) / 256));

    let phi1Rad = mu + (3 * e1 / 2 - 27 * (e1 ** 3) / 32) * Math.sin(2 * mu)
                + (21 * (e1 ** 2) / 16 - 55 * (e1 ** 4) / 32) * Math.sin(4 * mu)
                + (151 * (e1 ** 3) / 96) * Math.sin(6 * mu);

    let N1 = a / Math.sqrt(1 - e ** 2 * Math.sin(phi1Rad) ** 2);
    let T1 = Math.tan(phi1Rad) ** 2;
    let C1 = (e ** 2) * Math.cos(phi1Rad) ** 2 / (1 - e ** 2);
    let R1 = a * (1 - e ** 2) / Math.pow(1 - e ** 2 * Math.sin(phi1Rad) ** 2, 1.5);
    let D = (east - 500000) / (N1 * k0);

    let lat = (phi1Rad - (N1 * Math.tan(phi1Rad) / R1) * (D ** 2 / 2
        - (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * e ** 2) * (D ** 4) / 24
        + (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * e ** 2 - 3 * C1 ** 2) * (D ** 6) / 720)) * 180 / pi;

    let lon = longOrigin + ((D - (1 + 2 * T1 + C1) * (D ** 3) / 6
        + (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * e ** 2 + 24 * T1 ** 2) * (D ** 5) / 120) / Math.cos(phi1Rad)) * 180 / pi;

    return `${lat.toFixed(6)},${lon.toFixed(6)}`;
}
export function myFuncInfoDiv(results, popup, content, selectInteraction, coordinates, map) {
                  
  const resultsContainer = document.getElementById('search-results-container');
  const resultsList = document.getElementById('search-results');
  resultsList.innerHTML = '';
  resultsContainer.style.display = 'block';
  for (let i = 0; i < results.length; i++) {
    const { feature, layer } = results[i];
   
    const layerTitle = layer?.get?.('title') || 'Unbekannter Layer';
   
    const name = feature.get('name') || feature.get('ID_Umn') || '-';

    let bwId;

    if (layer?.get?.('name') === 'gew_umn') {
      bwId = feature.get('IDUabschn') || '—';
    } else {
      bwId = feature.get('bw_id') || '—';
    }

   
    popup.setPosition(coordinates);
    //console.log('Map:', map);
    content.innerHTML = generatePopupHTML(feature, layer, coordinates, popup);
    const listItem = createResultListItem(layer, layerTitle, name, bwId, feature, map, popup, content, selectInteraction);
    resultsList.appendChild(listItem);
    
  }
}
function createFotoLink(url, label) {
  if (url && url.trim() !== '') {
    return `<a href="${url}" onclick="window.open('${url}', '_blank'); return false;">${label}</a>`;
  }
  return label;
}
function getBeschreibLangHTML(value) {
  if (value && value.trim() !== '') {
    return `<br><u>Beschreib (lang): </u>${value}`;
  }
  return '';
}
export function generatePopupHTML(feature, layer) {
  
  const layerName = layer?.get?.('name') || 'unbekannt';
  let latLonResult;
  const rwert = feature.get('rwert');
  const hwert = feature.get('hwert');
 
  
  if (rwert && hwert) {
    latLonResult = UTMToLatLon_Fix(rwert, hwert, 32, true);
  } else {
    // Hier noch weitere Ausgaben für weitere Koordinatensysteme einfügen, falls benötigt
    const geom = feature.getGeometry();
    const center = geom.getType() === 'Point'
      ? geom.getCoordinates()
      : ol.extent.getCenter(geom.getExtent());
    const [lon, lat] = ol.proj.toLonLat(center);
    latLonResult = `${lat.toFixed(5)},${lon.toFixed(5)}`;
  }
 // Spezialfälle FSK, UMN, editbar, geojson, fot und kml: Nur spezieller Inhalt, kein allgemeiner Block
if (layerName === 'fsk') {
  const eigenschaft = (feature.get('Art') === 'o' || feature.get('Art') === 'l') ? 'öffentl.' : 'privat';
  const geometry = feature.getGeometry();
  const fsk_bemerk = feature.get('fsk_bemerk');
  // Variante A: getArea (EPSG:25832 – flächentreu)
  const geom25832 = geometry.clone().transform('EPSG:3857', 'EPSG:25832');
  const flaeche = geom25832.getArea();

  // Variante B (Vergleich): getArea über Sphere-Methode (EPSG:3857 – brauchbar, aber ungenauer)
  // const flaeche = getAreaSphere(geometry, { projection: 'EPSG:3857' });

  let flaecheText = '';
  if (flaeche > 1_000_000) {
    flaecheText = (flaeche / 1_000_000).toFixed(4).replace('.', ',') + ' km²';
  } else if (flaeche > 10_000) {
    flaecheText = (flaeche / 10_000).toFixed(4).replace('.', ',') + ' ha';
  } else {
    flaecheText = flaeche.toFixed(2).replace('.', ',') + ' m²';
  }

return `
  <div style="max-height: 300px; overflow-y: auto;">
    <p><strong>gemark Flur Flurstück:</strong><br>${feature.get('Suche')}</p>
    <p>FSK: ${feature.get('fsk')}</p>
    <p>FSK(ASL): ${feature.get('FSK_ASL')}</p>
    <p>Eig.(${eigenschaft}): ${feature.get('Eig1')}</p>
    ${fsk_bemerk != null && fsk_bemerk !== '' ? `<p>fsk_bemerk: ${fsk_bemerk}</p>` : ''}
    <p>Fläche: ${flaecheText}</p>
  </div>
`;


} else if (layerName === 'gew_umn') {
  
  return `
    <div style="max-height: 300px; overflow-y: auto;">
      <p><strong>Abschnitt:</strong><br>${feature.get('IDUabschn')} (${feature.get('gew_seite')})</p>
      <p>von km:${feature.get('Von_km')} bis km: (${feature.get('Bis_km')})</p>
      <p><u>Bezeichnung:</u> ${feature.get('UMnArtBez')}</p>
      <p><u>Gruppe:</u> ${feature.get('UMNGrBez')}</p>
      <a href="${feature.get('BSB')}" onclick="window.open('${feature.get('BSB')}', '_blank'); return false;">BSB</a>
      <a href="${feature.get('MNB')}" onclick="window.open('${feature.get('MNB')}', '_blank'); return false;">MNB</a><br>
      <p>Kat: ${feature.get('Kat')}</p>
      <p><u>Bemerkung:</u>: ${feature.get('UMn_Bemerk')}</p>
      <p><u><strong>Beschreibung:</strong></u> ${feature.get('beschreib')}</p>
    </div>
  `;
  
} else if (layerName.toLowerCase().startsWith('geojson')) {
  const geom = feature.getGeometry();
  const type = geom.getType();
  let html = `<p><strong>Geometrie-Typ:</strong> ${type}</p>`;

  if (type === 'Point') {
    const coords = ol.proj.toLonLat(geom.getCoordinates());
    html += `<p><strong>Koordinaten:</strong> ${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}</p>`;
  } else if (type === 'LineString') {
    const length = ol.sphere.getLength(geom);
    html += `<p><strong>Länge:</strong> ${length.toFixed(2)} m</p>`;
  } else if (type === 'Polygon') {
    const area = ol.sphere.getArea(geom);
    html += `<p><strong>Fläche:</strong> ${area.toFixed(2)} m²</p>`;
  }
  // Attributliste erzeugen
  const att = feature.getProperties();
  html += `<strong>Attributwerte:</strong><br><ul>`;
  for (let key in att) {
    if (key !== 'geometry') {
      html += `<li><strong>${key}:</strong> ${att[key]}</li>`;
    }
  }
  html += `</ul>`;

  return `
    <div style="max-height: 300px; overflow-y: auto;">
      ${html}
    </div>
  `;
} else if (layerName.toLowerCase().startsWith('fot')) {
  const geom = feature.getGeometry();
  const type = geom.getType();
  let rwert = feature.get('RWert');
  let hwert = feature.get('HWert');
  let result = UTMToLatLon_Fix(rwert, hwert, 32, true);  // result = "lat,lon" ?
  let html = `<p><strong>Foto:</strong></p>`;
  html += `<p>Foto-Ordner: ${feature.get('BOrdner')}</p>`;
  html += `<p><a href="https://www.google.com/maps?q=${result}" target="_blank" rel="noopener noreferrer">Google Maps link</a></p>`;
  html += `<p><a href="https://www.google.com/maps?q=&layer=c&cbll=${result}&cbp=12,90,0,0,1" target="_blank" rel="noopener noreferrer">streetview</a></p>`;
  html += `<p>ID: ${feature.get('REFOBJ_ID')}</p>`;
  html += `<p><strong>Koordinaten:</strong> ${result}</p>`;
  html += `<p>Datum Uhrzeit: ${feature.get('DateTime_')}</p>`;
  html += `
    <p>
      ${createFotoLink(feature.get('Path'), 'Foto 1')}
      ${createFotoLink(feature.get('tmp'), 'Foto 2')}
    </p>
  `;
  html += `<p>Foto Dateiname: ${feature.get('BName')}</p>`;
  // Optional: Attributliste (nicht abgeschlossen im Code)
  // const att = feature.getProperties();
  // html += '<ul>';
  // for (let key in att) {
  //   html += `<li>${key}: ${att[key]}</li>`;
  // }
  // html += '</ul>';
  
  return `
    <div style="max-height: 300px; overflow-y: auto;">
      ${html}
    </div>
  `;
} else if (layerName.toLowerCase().startsWith('kml')) {
  const geom = feature.getGeometry();
  const type = geom.getType();
  let html = `<p><strong>Geometrie-Typ:</strong> ${type}</p>`;

  if (type === 'Point') {
    const coords = ol.proj.toLonLat(geom.getCoordinates());
    html += `<p><strong>Koordinaten:</strong> ${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}</p>`;
  } else if (type === 'LineString') {
    const length = ol.sphere.getLength(geom); // in Metern
    html += `<p><strong>Länge:</strong> ${length.toFixed(2)} m</p>`;
  } else if (type === 'Polygon') {
    const area = ol.sphere.getArea(geom); // in m²
    html += `<p><strong>Fläche:</strong> ${area.toFixed(2)} m²</p>`;
  }

  // Attributwerte ausgeben
  const att = feature.getProperties();
  html += `<strong>Attributwerte:</strong><br><ul>`;
  for (let key in att) {
    if (key !== 'geometry') {
      html += `<li><strong>${key}:</strong> ${att[key]}</li>`;
    }
  }
  html += `</ul>`;

  return `
    <div style="max-height: 300px; overflow-y: auto;">
      ${html}
    </div>
  `;
} else if (layerName === 'editbar') {  
  const geom = feature.getGeometry();
  const type = geom.getType();
  let content = `<p><strong>Geometrie-Typ:</strong> ${type}</p>`;

  if (type === 'Point') {
    const coords = ol.proj.toLonLat(geom.getCoordinates());
    content += `<p><strong>Koordinaten:</strong> ${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}</p>`;
  } else if (type === 'LineString') {
    const length = ol.sphere.getLength(geom); // in Metern
    content += `<p><strong>Länge:</strong> ${length.toFixed(2)} m</p>`;
  } else if (type === 'Polygon') {
    const area = ol.sphere.getArea(geom); // in m²
    content += `<p><strong>Fläche:</strong> ${area.toFixed(2)} m²</p>`;
  }

  return `
    <div style="max-height: 300px; overflow-y: auto;">
      ${content}
    </div>
  `;
}
  // Erster allgemeiner Block
  let html = `
    <div style="max-height:200px;overflow-y:auto;">
      <p style="font-weight:bold;text-decoration:underline;">
        ${feature.get('name')}
      </p>
      <p>Id = ${feature.get('bw_id')} (${feature.get('KTR') || 'k.A.'})</p>
      <p>U-Pflicht = ${feature.get('upflicht')}</p>
      <p>Bemerk = ${feature.get('bemerk') || 'k.A.'}</p>
      <p>Bauj. = ${feature.get('baujahr') || 'k.A.'}</p>
      <p>Art = ${feature.get('bauart') || 'k.A.'}</p>
      <p>
        <a href="https://www.google.com/maps?q=${latLonResult}"
          target="_blank" rel="noopener noreferrer">
          Google Maps link
        </a>
      </p>
      <p>
        <a href="https://www.google.com/maps?q=&layer=c&cbll=${latLonResult}&cbp=12,90,0,0,1"
          target="_blank" rel="noopener noreferrer">
          Streetview
        </a>
      </p>
      <p>
        ${createFotoLink(feature.get('foto1'), 'Foto 1')}
        ${createFotoLink(feature.get('foto2'), 'Foto 2')}
        ${createFotoLink(feature.get('foto3'), 'Foto 3')}
        ${createFotoLink(feature.get('foto4'), 'Foto 4')}
        
      </p>
  `;
  // Layer-spezifischer Zusatz
  switch (layerName) {
    case 'weh':
      html += `
         <br><p>Art:WSP1 (OW)= ${feature.get('Ziel_OW1')} m; WSP2 (OW)= ${feature.get('Ziel_OW2')} m</p>         
      `;
      break;
    case 'bru_nlwkn':
      html += `
        <br><p>Klasse: ${feature.get('bw_bru_bruklasse')}</p>
      `;
      break;
    case 'bru_andere':
      html += `
        <br><p>Klasse: ${feature.get('bw_bru_bruklasse') || '(k.A.)'}</p>        
      `;
      break;
    case 'sle':
      html += `
        <br><p>WSP (OW)= ${feature.get('WSP_OW')}; WSP (UW)= ${feature.get('WSP_UW')}</p>
      `;
      break;
    case 'ein':
      html += `
        <br><p>Ordn.: ${feature.get('Ein_ord')|| '(k.A.)'}; DN: ${feature.get('Ein_DN')|| '(k.A.)'}; Br: ${feature.get('Breite')|| '(k.A.)'}; H: ${feature.get('Hoehe')|| '(k.A.)'}; Sohlhöhe: ${feature.get('NN_Sohle') || '(k.A.)'}; GWZ: ${feature.get('Ein_GWZ') || '(k.A.)'} </p>               
      `;
      break;
    case 'que':
      html += `
        <br><p>DN: ${feature.get('Bw_QUE_DN')|| '(k.A.)'}; Sohlhöhe: ${feature.get('BW_QUE_Shoehe_nn') || '(k.A.)'}; Schild: ${feature.get('Schild') || '(k.A.)'} </p>               
      `;
      break;
    case 'due':
      html += `        
        <br><p>Höhe: ${feature.get('Hoehe')|| '(k.A.)'}; Breite: ${feature.get('Breite') || '(k.A.)'}; DN: ${feature.get('DN') || '(k.A.)'} </p>               
      `;
      break;
    case 'son_lin':
      html += `
        <br><p>von km: ${feature.get('stat_von')|| '(k.A.)'}; bis km: ${feature.get('stat_bis') || '(k.A.)'} </p> 
      `;
      break;
    case 'son_pun':
      /* html += `
        <br><p>sonstiger punkt </p>               
      `; */
      break;
      case 'gew_info':  
      const urlWKDB = feature.get('URL_WKDB');
      const url_wk_sb = feature.get('URL_WKSB');
      
    
      const urlWKDBHtml = (urlWKDB && urlWKDB.trim() !== '') 
        ? `<a href="${urlWKDB}" onclick="window.open('${urlWKDB}', '_blank'); return false;">NLWKN-WK</a>` 
        : 'NLWKN-WK';
    
      const url_wk_sb_Html = (url_wk_sb && url_wk_sb.trim() !== '') 
        ? `<a href="${url_wk_sb}" onclick="window.open('${url_wk_sb}', '_blank'); return false;">BfG-WK</a>` 
        : 'BfG-WK';
    
      html += `
        <p>Name: ${feature.get('IDUabschn')}<br>
        von ${feature.get('Bez_Anfang')} bis ${feature.get('Bez_Ende')}</p>
        <p>
          <a href="${feature.get('U_Steckbrief')}" onclick="window.open('${feature.get('U_Steckbrief')}', '_blank'); return false;">NLWKN-SB</a> 
          ${url_wk_sb_Html} ${urlWKDBHtml}
        </p>
        <p>
          <a href="${feature.get('BSB')}" onclick="window.open('${feature.get('BSB')}', '_blank'); return false;">BSB</a>
          <a href="${feature.get('MNB')}" onclick="window.open('${feature.get('MNB')}', '_blank'); return false;">MNB</a><br>
          Kat: ${feature.get('Kat')}<br>
          Info: ${feature.get('beschreib_kurz') || '(k.A.)'}
        </p>
      `;
      break;
    
    
    default:
      html += `
        <p style="font-style:italic;">Kein spezifischer Zusatzinhalt für diesen Layer.</p>
      `;
  }

  // Zweiter allgemeiner Block
  html += `
      <br><u>Beschreibung (kurz):</u> ${feature.get('beschreib')}
      <p>${getBeschreibLangHTML(feature.get('beschreib_lang'))}</p>
    </div>
  `;
  return html;
}
function createResultListItem(layer, layerTitle, name, bwId, feature, map, popup, content, selectInteraction) {
  const listItem = document.createElement('li');
  if (layerTitle === 'fot') {
  listItem.innerHTML = `
    <strong>${layerTitle}</strong>
    <em>ID:</em> ${feature.get('BName')}
  `;
  } else {
  listItem.innerHTML = `
    <strong>${layerTitle}</strong><br>
    ${name}<br>
    <em>ID:</em> ${bwId}
  `;
  }
  listItem.style.cursor = 'pointer';
  // Einfacher Klick → Popup anzeigen

  listItem.addEventListener('click', () => {
    const geometry = feature.getGeometry();
    let coordinates;
  
    // 🔍 Geometrie-Typ prüfen
    const type = geometry.getType();
    if (type === 'Point') {
      coordinates = geometry.getCoordinates();
    } else {
      // 📍 Bei Linien oder Flächen: Schwerpunkt verwenden
      const extent = geometry.getExtent();
      coordinates = [
        (extent[0] + extent[2]) / 2, // Mittelpunkt X
        (extent[1] + extent[3]) / 2  // Mittelpunkt Y
      ];
    }
  
    popup.setPosition(coordinates);
    content.innerHTML = generatePopupHTML(feature, layer, coordinates, popup);
  
    // 🔴 Feature visuell markieren
    selectInteraction.getFeatures().clear();
    selectInteraction.getFeatures().push(feature);
  });
    
  listItem.addEventListener('dblclick', () => zoomToFeature(feature, map));
  return listItem;
}
export function zoomToFeature(feature, map) {
  
  const geometry = feature.getGeometry();
  const extent = geometry.getExtent();

  // Zoomen auf das Feature
  map.getView().fit(extent, {
    duration: 1000,
    padding: [50, 50, 50, 50],
    maxZoom: 20
  });

  // Temporärer Highlight-Stil
  const highlightStyle = new Style({
    stroke: new Stroke({
      color: 'yellow',
      width: 4,
    }),
    fill: new Fill({
      color: 'rgba(255, 255, 0, 0.3)',
    }),
  });

  const originalStyle = feature.getStyle?.(); // Falls vorhanden

  feature.setStyle(highlightStyle);

  // Nach 1,5 Sekunden wieder auf den ursprünglichen Stil zurück
  setTimeout(() => {
    feature.setStyle(originalStyle || null); // null verwendet den Layer-Stil
  }, 1500);
}
export function makeDivDraggable(div, handle) {
  let offsetX = 0, offsetY = 0, startX = 0, startY = 0;

  function dragStart(e) {
    // Nicht starten, wenn auf das close-icon geklickt wurde
    if (e.target.closest('.close-icon')) return;
    e.preventDefault();
    if (e.type === 'touchstart') {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    } else {
      startX = e.clientX;
      startY = e.clientY;
    }
    document.addEventListener('mousemove', dragMove);
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('touchmove', dragMove, { passive: false });
    document.addEventListener('touchend', dragEnd);
  }

  function dragMove(e) {
    e.preventDefault();
    let clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    let clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
    offsetX = clientX - startX;
    offsetY = clientY - startY;
    startX = clientX;
    startY = clientY;
    div.style.top = (div.offsetTop + offsetY) + "px";
    div.style.left = (div.offsetLeft + offsetX) + "px";
  }

  function dragEnd() {
    document.removeEventListener('mousemove', dragMove);
    document.removeEventListener('mouseup', dragEnd);
    document.removeEventListener('touchmove', dragMove);
    document.removeEventListener('touchend', dragEnd);
  }

  handle.addEventListener('mousedown', dragStart);
  handle.addEventListener('touchstart', dragStart, { passive: false });
}



  