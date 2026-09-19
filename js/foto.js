import { toLonLat, transform } from 'ol/proj';
import Feature from 'ol/Feature';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style';
import piexif from 'piexifjs';

export function initPhotoCapture(map) {
  const takePhotoBtn = document.getElementById('take-photo-btn');
  const cameraInput = document.getElementById('camera-input');
  const photoTitle = document.getElementById('photo-title');
  const photoKilometer = document.getElementById('photo-kilometer');
  const photoGewSeite = document.getElementById('photo-gew-seite');
  const photoGewRi = document.getElementById('photo-gew-ri');
  const photoDescription = document.getElementById('photo-description');
  const photoStorageStatus = document.getElementById('photo-storage-status');
  const exportPhotoCsvBtn = document.getElementById('export-photo-csv-btn');
  const exportPhotoGeojsonBtn = document.getElementById('export-photo-geojson-btn');
  const clearPhotoDatabaseBtn = document.getElementById('clear-photo-database-btn');
  const cancelPhotoLocationBtn = document.getElementById('cancel-photo-location-btn');
  const photoLocationActions = document.getElementById('photo-location-actions');
  const choosePhotoLocationBtn = document.getElementById('choose-photo-location-btn');
  const choosePhotoDirectionBtn = document.getElementById('choose-photo-direction-btn');
  const savePhotoBtn = document.getElementById('save-photo-btn');
  let pendingPhoto = null;
  let photoLocation = null;
  let photoSelectionStage = 'location';

  const photoSelectionSource = new VectorSource();
  const photoSelectionLayer = new VectorLayer({
    source: photoSelectionSource,
    zIndex: 1001,
    displayInLayerSwitcher: true,
    style: (feature) => feature.get('selectionType') === 'direction'
      ? new Style({
        stroke: new Stroke({ color: '#d62f2f', width: 4 }),
        image: new CircleStyle({ radius: 7, fill: new Fill({ color: '#d62f2f' }), stroke: new Stroke({ color: '#fff', width: 2 }) })
      })
      : new Style({
        image: new CircleStyle({ radius: 9, fill: new Fill({ color: '#1976d2' }), stroke: new Stroke({ color: '#fff', width: 3 }) })
      }),
    title: 'Foto',
    name: 'Foto'
  });
  map.addLayer(photoSelectionLayer);

  function setPhotoLocationMode(active) {
    window.photoLocationSelectionActive = active;
    cancelPhotoLocationBtn.hidden = !active;
    photoLocationActions.hidden = !active;
    if (!active) photoSelectionSource.clear();
  }

  function updatePhotoSelectionDisplay() {
    photoSelectionSource.clear();
    if (!photoLocation) return;

    photoSelectionSource.addFeature(new Feature({
      geometry: new Point(photoLocation.mapCoordinate),
      selectionType: 'location'
    }));

    if (photoLocation.directionCoordinate) {
      photoSelectionSource.addFeature(new Feature({
        geometry: new LineString([photoLocation.mapCoordinate, photoLocation.directionCoordinate]),
        selectionType: 'direction'
      }));
    }
  }

  function updatePhotoSelectionControls() {
    savePhotoBtn.disabled = !photoLocation?.directionCoordinate;
    choosePhotoLocationBtn.classList.toggle('active', photoSelectionStage === 'location');
    choosePhotoDirectionBtn.classList.toggle('active', photoSelectionStage === 'direction');
  }

  function normalizeGewSeite(value) {
    const normalized = (value || '').trim().toUpperCase();
    if (normalized === 'R' || normalized === 'L' || normalized === 'M') return normalized;
    return '';
  }

  function normalizeGewRi(value) {
    const normalized = (value || '').trim();
    if (/^gF$/i.test(normalized)) return 'gF';
    if (/^iF$/i.test(normalized)) return 'iF';
    return '';
  }

  function readPhotoMetadata() {
    const kilometerValue = Number.parseInt(photoKilometer.value, 10);
    const descriptionValue = photoDescription.value.trim().slice(0, 255);
    return {
      kilometer: Number.isInteger(kilometerValue) && kilometerValue >= 0 ? kilometerValue : '',
      gewSeite: normalizeGewSeite(photoGewSeite.value),
      gewRi: normalizeGewRi(photoGewRi.value),
      bbeschreib1: descriptionValue
    };
  }

  function decimalToExifCoordinate(value) {
    const absoluteValue = Math.abs(value);
    const degrees = Math.floor(absoluteValue);
    const minutesValue = (absoluteValue - degrees) * 60;
    const minutes = Math.floor(minutesValue);
    const seconds = Math.round((minutesValue - minutes) * 60000);
    return [[degrees, 1], [minutes, 1], [seconds, 1000]];
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
  function exifRationalToNumber(value) {
    if (Array.isArray(value)) {
      if (value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
        return value[1] ? value[0] / value[1] : NaN;
      }
      return value.map(exifRationalToNumber);
    }
    return Number(value);
  }

  function parseExifDate(value) {
    if (typeof value !== 'string') return null;

    const match = value.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!match) return null;

    const [, year, month, day, hours, minutes, seconds] = match;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds)
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  async function readPhotoExif(file) {
    if (file.type !== 'image/jpeg' && file.type !== 'image/jpg') return null;

    try {
      const exif = piexif.load(await fileToDataUrl(file));
      const capturedAt = parseExifDate(
        exif.Exif?.[piexif.ExifIFD.DateTimeOriginal]
        || exif['0th']?.[piexif.ImageIFD.DateTime]
      );
      const gps = exif.GPS || {};
      const latitude = exifRationalToNumber(gps[piexif.GPSIFD.GPSLatitude]);
      const longitude = exifRationalToNumber(gps[piexif.GPSIFD.GPSLongitude]);
      const latitudeRef = gps[piexif.GPSIFD.GPSLatitudeRef];
      const longitudeRef = gps[piexif.GPSIFD.GPSLongitudeRef];
      const hasPosition = Array.isArray(latitude) && Array.isArray(longitude)
        && latitude.length === 3 && longitude.length === 3;
      if (!hasPosition) return { capturedAt };

      const signedLatitude = (latitude[0] + latitude[1] / 60 + latitude[2] / 3600)
        * (latitudeRef === 'S' ? -1 : 1);
      const signedLongitude = (longitude[0] + longitude[1] / 60 + longitude[2] / 3600)
        * (longitudeRef === 'W' ? -1 : 1);
      if (!Number.isFinite(signedLatitude) || !Number.isFinite(signedLongitude)
        || Math.abs(signedLatitude) > 90 || Math.abs(signedLongitude) > 180) {
        return { capturedAt };
      }

      const directionValue = exifRationalToNumber(gps[piexif.GPSIFD.GPSImgDirection]);
      return {
        latitude: signedLatitude,
        longitude: signedLongitude,
        direction: Number.isFinite(directionValue) ? (directionValue + 360) % 360 : null,
        capturedAt
      };
    } catch (error) {
      console.warn('GPS-Daten des Fotos konnten nicht gelesen werden:', error);
      return null;
    }
  }

  function createDefaultPhotoLocation(gps) {
    const mapCoordinate = transform(
      [gps.longitude, gps.latitude],
      'EPSG:4326',
      map.getView().getProjection()
    );
    const location = {
      mapCoordinate,
      latitude: gps.latitude,
      longitude: gps.longitude,
      directionPixel: null,
      directionCoordinate: null
    };

    if (gps.direction !== null) {
      const locationPixel = map.getPixelFromCoordinate(mapCoordinate);
      const directionPixel = [
        locationPixel[0] + Math.sin(gps.direction * Math.PI / 180) * 80,
        locationPixel[1] - Math.cos(gps.direction * Math.PI / 180) * 80
      ];
      location.directionPixel = directionPixel;
      location.directionCoordinate = map.getCoordinateFromPixel(directionPixel);
    }
    return location;
  }

  function encodeExifTitle(title) {
    const encodedTitle = new Uint8Array((title.length + 1) * 2);
    for (let index = 0; index < title.length; index += 1) {
      const code = title.charCodeAt(index);
      encodedTitle[index * 2] = code & 0xff;
      encodedTitle[index * 2 + 1] = code >> 8;
    }
    console.log('Encoded title:', Array.from(encodedTitle));
    return Array.from(encodedTitle);
  }

  function formatExifDate(date) {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}:${pad(date.getMonth() + 1)}:${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  async function addGpsExif(file, latitude, longitude, direction, title, capturedAt) {
    if (file.type !== 'image/jpeg' && file.type !== 'image/jpg') return file;

    const dataUrl = await fileToDataUrl(file);
    const exifDate = formatExifDate(capturedAt);
    const exifData = {
      '0th': {
        [piexif.ImageIFD.ImageDescription]: title,
        [piexif.ImageIFD.XPTitle]: encodeExifTitle(title),
        [piexif.ImageIFD.DateTime]: exifDate
      },
      Exif: {
        [piexif.ExifIFD.DateTimeOriginal]: exifDate,
        [piexif.ExifIFD.DateTimeDigitized]: exifDate
      },
      GPS: {
        [piexif.GPSIFD.GPSVersionID]: [2, 3, 0, 0],
        [piexif.GPSIFD.GPSLatitudeRef]: latitude >= 0 ? 'N' : 'S',
        [piexif.GPSIFD.GPSLatitude]: decimalToExifCoordinate(latitude),
        [piexif.GPSIFD.GPSLongitudeRef]: longitude >= 0 ? 'E' : 'W',
        [piexif.GPSIFD.GPSLongitude]: decimalToExifCoordinate(longitude),
        [piexif.GPSIFD.GPSImgDirectionRef]: 'T',
        [piexif.GPSIFD.GPSImgDirection]: [Math.round(direction * 100), 100]
      }
    };
    const exifBytes = piexif.dump(exifData);
    const imageWithExif = piexif.insert(exifBytes, dataUrl);
    const imageBlob = await fetch(imageWithExif).then((response) => response.blob());
    return new File([imageBlob], file.name, { type: 'image/jpeg', lastModified: file.lastModified });
  }

  function createXmpPacket(title) {
    const escapedTitle = document.createElement('div');
    escapedTitle.textContent = title;
    return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="gb1WebMap2">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${escapedTitle.innerHTML}</rdf:li></rdf:Alt></dc:title>
      <xmp:Title>${escapedTitle.innerHTML}</xmp:Title>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
  }

  function updateXmpTitle(xmpXml, title) {
    const xmlDocument = new DOMParser().parseFromString(xmpXml, 'application/xml');
    if (xmlDocument.querySelector('parsererror')) return null;

    const dcNamespace = 'http://purl.org/dc/elements/1.1/';
    const xmpNamespace = 'http://ns.adobe.com/xap/1.0/';
    const rdfNamespace = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
    const dcTitles = xmlDocument.getElementsByTagNameNS(dcNamespace, 'title');
    const xmpTitles = xmlDocument.getElementsByTagNameNS(xmpNamespace, 'Title');

    Array.from(dcTitles).forEach((dcTitle) => {
      const defaultTitle = Array.from(dcTitle.getElementsByTagNameNS(rdfNamespace, 'li'))
        .find((item) => item.getAttribute('xml:lang') === 'x-default');
      (defaultTitle || dcTitle).textContent = title;
    });
    Array.from(xmpTitles).forEach((xmpTitle) => { xmpTitle.textContent = title; });

    if (!dcTitles.length || !xmpTitles.length) return null;
    return new XMLSerializer().serializeToString(xmlDocument);
  }

  async function addXmpTitle(file, title) {
    if ((file.type !== 'image/jpeg' && file.type !== 'image/jpg') || !title) return file;

    const imageBytes = new Uint8Array(await file.arrayBuffer());
    const xmpSignature = new TextEncoder().encode('http://ns.adobe.com/xap/1.0/\0');
    let offset = 2;
    let xmpSegmentStart = -1;
    let xmpSegmentEnd = -1;
    while (offset + 4 <= imageBytes.length && imageBytes[offset] === 0xff) {
      const marker = imageBytes[offset + 1];
      if (marker === 0xda || marker === 0xd9) break;
      const segmentLength = (imageBytes[offset + 2] << 8) | imageBytes[offset + 3];
      const segmentEnd = offset + 2 + segmentLength;
      if (marker === 0xe1 && segmentEnd <= imageBytes.length) {
        const segmentData = imageBytes.subarray(offset + 4, segmentEnd);
        if (segmentData.length >= xmpSignature.length
          && xmpSignature.every((byte, index) => segmentData[index] === byte)) {
          xmpSegmentStart = offset;
          xmpSegmentEnd = segmentEnd;
          break;
        }
      }
      offset = segmentEnd;
    }

    const xmpXml = xmpSegmentStart >= 0
      ? new TextDecoder().decode(imageBytes.subarray(xmpSegmentStart + 4 + xmpSignature.length, xmpSegmentEnd))
      : createXmpPacket(title);
    const updatedXml = xmpSegmentStart >= 0 ? updateXmpTitle(xmpXml, title) : xmpXml;
    const replacementXml = updatedXml || createXmpPacket(title);
    const replacementData = new Uint8Array(xmpSignature.length + new TextEncoder().encode(replacementXml).length);
    replacementData.set(xmpSignature);
    replacementData.set(new TextEncoder().encode(replacementXml), xmpSignature.length);
    const replacementSegment = new Uint8Array(4 + replacementData.length);
    replacementSegment.set([0xff, 0xe1, (replacementData.length + 2) >> 8, (replacementData.length + 2) & 0xff]);
    replacementSegment.set(replacementData, 4);

    const insertAt = xmpSegmentStart >= 0 ? xmpSegmentStart : 2;
    const removeLength = xmpSegmentStart >= 0 ? xmpSegmentEnd - xmpSegmentStart : 0;
    const result = new Uint8Array(imageBytes.length - removeLength + replacementSegment.length);
    result.set(imageBytes.subarray(0, insertAt));
    result.set(replacementSegment, insertAt);
    result.set(imageBytes.subarray(insertAt + removeLength), insertAt + replacementSegment.length);
    return new File([result], file.name, { type: 'image/jpeg', lastModified: file.lastModified });
  }

  function createIptcDataset(record, dataset, value) {
    const valueBytes = new TextEncoder().encode(value);
    const datasetBytes = new Uint8Array(5 + valueBytes.length);
    datasetBytes.set([0x1c, record, dataset, valueBytes.length >> 8, valueBytes.length & 0xff]);
    datasetBytes.set(valueBytes, 5);
    return datasetBytes;
  }

  function createIptcResource(title, captionAbstract) {
    const datasets = [createIptcDataset(1, 90, '\u001b%G')];
    if (title) datasets.push(createIptcDataset(2, 5, title));
    if (captionAbstract) datasets.push(createIptcDataset(2, 120, captionAbstract));

    const iptcDataLength = datasets.reduce((total, dataset) => total + dataset.length, 0);
    const iptcData = new Uint8Array(iptcDataLength);
    let offset = 0;
    datasets.forEach((dataset) => {
      iptcData.set(dataset, offset);
      offset += dataset.length;
    });

    const resourceName = new Uint8Array([0]);
    const paddedNameLength = 2;
    const paddedDataLength = iptcData.length + (iptcData.length % 2);
    const resource = new Uint8Array(4 + 2 + paddedNameLength + 4 + paddedDataLength);
    resource.set([0x38, 0x42, 0x49, 0x4d, 0x04, 0x04], 0);
    resource.set(resourceName, 6);
    new DataView(resource.buffer).setUint32(8, iptcData.length);
    resource.set(iptcData, 12);
    return resource;
  }

  async function addIptcMetadata(file, title, captionAbstract) {
    if (file.type !== 'image/jpeg' && file.type !== 'image/jpg') return file;
    if (!title && !captionAbstract) return file;

    const imageBytes = new Uint8Array(await file.arrayBuffer());
    const resource = createIptcResource(title, captionAbstract);
    const photoshopHeader = new TextEncoder().encode('Photoshop 3.0\0');
    const app13Payload = new Uint8Array(photoshopHeader.length + resource.length);
    app13Payload.set(photoshopHeader);
    app13Payload.set(resource, photoshopHeader.length);

    const app13Segment = new Uint8Array(4 + app13Payload.length);
    app13Segment.set([0xff, 0xed, (app13Payload.length + 2) >> 8, (app13Payload.length + 2) & 0xff]);
    app13Segment.set(app13Payload, 4);

    const result = new Uint8Array(imageBytes.length + app13Segment.length);
    result.set(imageBytes.subarray(0, 2));
    result.set(app13Segment, 2);
    result.set(imageBytes.subarray(2), 2 + app13Segment.length);
    return new File([result], file.name, { type: 'image/jpeg', lastModified: file.lastModified });
  }

  function openPhotoDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('gb1WebMap2', 1);

      request.onupgradeneeded = () => {
        request.result.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function getSavedPhotos() {
    return openPhotoDatabase().then((database) => new Promise((resolve, reject) => {
      const transaction = database.transaction('photos', 'readonly');
      const request = transaction.objectStore('photos').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => database.close();
      transaction.onerror = () => reject(transaction.error);
    }));
  }

  function formatGeoJsonDate(value) {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const pad = (number) => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
      + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  function downloadPhotoGeoJson(features) {
    const geoJson = {
      type: 'FeatureCollection',
      name: 'Fotostandorte',
      crs: {
        type: 'name',
        properties: { name: 'EPSG:25832' }
      },
      features
    };
    const blob = new Blob([JSON.stringify(geoJson, null, 2)], { type: 'application/geo+json' });
    const downloadUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[.:]/g, '-');
    downloadLink.href = downloadUrl;
    downloadLink.download = `fotostandorte-${timestamp}.geojson`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    URL.revokeObjectURL(downloadUrl);
  }

  function escapeCsvValue(value) {
    const stringValue = value == null ? '' : String(value);
    return /["\t\n\r]/.test(stringValue)
      ? `"${stringValue.replace(/"/g, '""')}"`
      : stringValue;
  }

  function formatCsvNumber(value) {
    if (value === '' || value === null || value === undefined) return '';
    const number = Number(value);
    if (!Number.isFinite(number)) return '';
    return number.toString().replace('.', ',');
  }

  function downloadCsvFile(rows, fileName) {
    const headers = [
      'BName',
      'BOrdner',
      'Altitude',
      'Direction',
      'Longitude',
      'Latitude',
      'DateTime',
      'RWert',
      'HWert',  
      'GEW',
      'Stat_von',
      'GEW_Seite',
      'GEW_Ri',
      'title',
      'BBeschreib1'
    ];

    const csvContent = [
      headers.join('\t'),
      ...rows.map((row) => headers.map((header) => {
        const value = row[header];
        if (typeof value === 'number') return escapeCsvValue(formatCsvNumber(value));
        return escapeCsvValue(value);
      }).join('\t'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function exportPhotoCsv() {
    try {
      const photos = await getSavedPhotos();
      if (!photos.length) {
        photoStorageStatus.textContent = 'Keine gespeicherten Fotostandorte vorhanden.';
        return;
      }

      const rows = photos.map((photo) => {
        const [rwert, hwert] = transform(
          [photo.longitude, photo.latitude],
          'EPSG:4326',
          'EPSG:25832'
        );

        return {
          BName: photo.originalName || '',
          BOrdner: '',
          Altitude: Number(Number(photo.altitude || 0).toFixed(2)),
          Direction: photo.direction ?? '',
          Longitude: Number(Number(photo.longitude).toFixed(6)),
          Latitude: Number(Number(photo.latitude).toFixed(6)),
          DateTime: formatGeoJsonDate(photo.capturedAt),
          RWert: Number(rwert.toFixed(2)),
          HWert: Number(hwert.toFixed(2)),
          GEW: photo.gew || photo.title || '',
          Stat_von: photo.statVon ?? photo.kilometer ?? '',
          GEW_Seite: photo.gewSeite || '',
          GEW_Ri: photo.gewRi || '',
          title: photo.title || '',
          BBeschreib1: photo.BBeschreib1 || photo.bbBeschreib1 || photo.description || ''
        };
      });

      const timestamp = new Date().toISOString().replace(/[.:]/g, '-');
      downloadCsvFile(rows, `fotostandorte-${timestamp}.csv`);
      photoStorageStatus.textContent = `${rows.length} Fotostandort(e) als CSV exportiert. Importierbar in PostgreSQL/pgAdmin.`;
    } catch (error) {
      console.error('Fotostandorte konnten nicht als CSV exportiert werden:', error);
      photoStorageStatus.textContent = 'Fotostandorte konnten nicht als CSV exportiert werden.';
    }
  }

  async function exportPhotoGeoJson() {
    try {
      const photos = await getSavedPhotos();
      if (!photos.length) {
        photoStorageStatus.textContent = 'Keine gespeicherten Fotostandorte vorhanden.';
        return;
      }

      const features = photos.map((photo) => {
        const [rwert, hwert] = transform(
          [photo.longitude, photo.latitude],
          'EPSG:4326',
          'EPSG:25832'
        );
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [rwert, hwert] },
          properties: {
            ID: photo.id,
            Path: '',
            BName: photo.originalName || '',
            BOrdner: '',
            Altitude: Number(Number(photo.altitude || 0).toFixed(2)),
            Direction: photo.direction,
            Longitude: Number(Number(photo.longitude).toFixed(6)),
            Latitude: Number(Number(photo.latitude).toFixed(6)),
            DateTime: formatGeoJsonDate(photo.capturedAt),
            RWert: Number(rwert.toFixed(2)),
            HWert: Number(hwert.toFixed(2)),
            GEW: photo.gew || photo.title || '',
            Stat_von: photo.statVon ?? photo.kilometer ?? '',
            GEW_Seite: photo.gewSeite || '',
            GEW_Ri: photo.gewRi || '',
            BBeschreib1: photo.BBeschreib1 || photo.bbBeschreib1 || photo.description || ''
          }
        };
      });

      downloadPhotoGeoJson(features);
      photoStorageStatus.textContent = `${features.length} Fotostandort(e) als GeoJSON exportiert.`;
    } catch (error) {
      console.error('Fotostandorte konnten nicht exportiert werden:', error);
      photoStorageStatus.textContent = 'Fotostandorte konnten nicht exportiert werden.';
    }
  }

  async function clearPhotoDatabase() {
    if (!window.confirm('Alle gespeicherten Fotodaten aus der IndexedDB löschen?')) return;

    try {
      const database = await openPhotoDatabase();
      await new Promise((resolve, reject) => {
        const transaction = database.transaction('photos', 'readwrite');
        transaction.objectStore('photos').clear();
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error('Transaktion abgebrochen'));
      });
      database.close();
      photoStorageStatus.textContent = 'Fotodatenbank wurde bereinigt.';
    } catch (error) {
      console.error('Fotodatenbank konnte nicht bereinigt werden:', error);
      photoStorageStatus.textContent = 'Fotodatenbank konnte nicht bereinigt werden.';
    }
  }

  async function savePhoto(file, description, location = {}) {
    const database = await openPhotoDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction('photos', 'readwrite');
      transaction.objectStore('photos').add({
        photo: file,
        description,
        originalName: file.name,
        type: file.type,
        capturedAt: new Date().toISOString(),
        gew: location.gew || location.title || '',
        BBeschreib1: location.BBeschreib1 || location.bbBeschreib1 || description || '',
        ...location
      });
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error);
      };
    });
  }

  function getPhotoDownloadName(file, capturedAt = new Date()) {
    const extension = file.type === 'image/jpeg' || file.type === 'image/jpg'
      ? 'jpg'
      : file.type.split('/')[1] || 'jpg';
    const pad = (value, length = 2) => String(value).padStart(length, '0');
    const timestamp = `${capturedAt.getFullYear()}-${pad(capturedAt.getMonth() + 1)}-${pad(capturedAt.getDate())}`
      + `_${pad(capturedAt.getHours())}_${pad(capturedAt.getMinutes())}_${pad(capturedAt.getSeconds(), 4)}`;
    return `foto-${timestamp}.${extension}`;
  }

  function downloadPhoto(file, fileName = getPhotoDownloadName(file)) {
    const downloadUrl = URL.createObjectURL(file);
    const downloadLink = document.createElement('a');

    downloadLink.href = downloadUrl;
    downloadLink.download = fileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    URL.revokeObjectURL(downloadUrl);
  }

  async function finishPhotoLocationSelection() {
    const directionPoint = map.getCoordinateFromPixel(photoLocation.directionPixel);
    const dx = directionPoint[0] - photoLocation.mapCoordinate[0];
    const dy = directionPoint[1] - photoLocation.mapCoordinate[1];
    const direction = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
    const capturedAt = pendingPhoto.capturedAt || new Date();

    try {
      const photoWithExif = await addGpsExif(
        pendingPhoto.file,
        photoLocation.latitude,
        photoLocation.longitude,
        direction,
        pendingPhoto.title,
        capturedAt
      );
      const photoWithXmp = await addXmpTitle(photoWithExif, pendingPhoto.title);
      const photoWithMetadata = await addIptcMetadata(
        photoWithXmp,
        pendingPhoto.title,
        pendingPhoto.description
      );
      const photoFileName = getPhotoDownloadName(photoWithMetadata, capturedAt);
      const photoForStorage = new File([photoWithMetadata], photoFileName, {
        type: photoWithMetadata.type,
        lastModified: photoWithMetadata.lastModified
      });
      downloadPhoto(photoForStorage, photoFileName);
      await savePhoto(photoForStorage, pendingPhoto.description, {
        title: pendingPhoto.title,
        gew: pendingPhoto.title,
        statVon: pendingPhoto.kilometer,
        gewSeite: pendingPhoto.gewSeite,
        gewRi: pendingPhoto.gewRi,
        BBeschreib1: pendingPhoto.bbBeschreib1 || pendingPhoto.description || '',
        latitude: photoLocation.latitude,
        longitude: photoLocation.longitude,
        direction,
        capturedAt: capturedAt.toISOString()
      });
      photoStorageStatus.textContent = photoWithMetadata.type === 'image/jpeg'
        ? 'Foto mit EXIF- und IPTC-Daten gespeichert.'
        : 'Foto gespeichert. Metadaten liegen separat vor; EXIF/IPTC werden nur für JPEG geschrieben.';
    } catch (error) {
      console.error('Foto konnte nicht gespeichert werden:', error);
      photoStorageStatus.textContent = 'Foto konnte nicht gespeichert werden.';
    } finally {
      pendingPhoto = null;
      photoLocation = null;
      setPhotoLocationMode(false);
    }
  }

  map.on('singleclick', (event) => {
    if (!pendingPhoto) return;

    if (photoSelectionStage === 'location') {
      const [longitude, latitude] = toLonLat(event.coordinate);
      photoLocation = {
        mapCoordinate: event.coordinate,
        latitude,
        longitude,
        directionPixel: null,
        directionCoordinate: null
      };
      photoSelectionStage = 'direction';
      updatePhotoSelectionDisplay();
      updatePhotoSelectionControls();
      photoStorageStatus.textContent = 'Standort markiert. Klicke jetzt in die Blickrichtung.';
      return;
    }

    if (photoLocation) {
      photoLocation.directionPixel = event.pixel;
      photoLocation.directionCoordinate = event.coordinate;
      updatePhotoSelectionDisplay();
      updatePhotoSelectionControls();
      photoStorageStatus.textContent = 'Standort und Richtung markiert. Du kannst die Auswahl ändern oder das Foto speichern.';
    }
  });

  takePhotoBtn.addEventListener('click', () => cameraInput.click());
  choosePhotoLocationBtn.addEventListener('click', () => {
    photoSelectionStage = 'location';
    photoStorageStatus.textContent = 'Klicke auf der Karte auf den Aufnahmestandort.';
    updatePhotoSelectionControls();
  });
  choosePhotoDirectionBtn.addEventListener('click', () => {
    if (!photoLocation) return;
    photoSelectionStage = 'direction';
    photoStorageStatus.textContent = 'Klicke auf der Karte in die Blickrichtung.';
    updatePhotoSelectionControls();
  });
  savePhotoBtn.addEventListener('click', finishPhotoLocationSelection);
  exportPhotoCsvBtn.addEventListener('click', exportPhotoCsv);
  exportPhotoGeojsonBtn.addEventListener('click', exportPhotoGeoJson);
  clearPhotoDatabaseBtn.addEventListener('click', clearPhotoDatabase);
  cancelPhotoLocationBtn.addEventListener('click', () => {
    pendingPhoto = null;
    photoLocation = null;
    setPhotoLocationMode(false);
    updatePhotoSelectionControls();
    photoStorageStatus.textContent = 'Standortauswahl abgebrochen.';
  });
  cameraInput.addEventListener('change', async () => {
    const [file] = cameraInput.files;
    if (!file) return;

    const metadata = readPhotoMetadata();
    pendingPhoto = {
      file,
      title: photoTitle.value.trim(),
      description: photoDescription.value.trim().slice(0, 255),
      kilometer: metadata.kilometer,
      gewSeite: metadata.gewSeite,
      gewRi: metadata.gewRi,
      bbBeschreib1: metadata.bbeschreib1
    };
    photoLocation = null;
    photoSelectionStage = 'location';
    const exif = await readPhotoExif(file);
    pendingPhoto.capturedAt = exif?.capturedAt || new Date(file.lastModified);
    photoLocation = exif?.latitude !== undefined ? createDefaultPhotoLocation(exif) : null;
    photoSelectionStage = photoLocation ? 'direction' : 'location';
    setPhotoLocationMode(true);
    updatePhotoSelectionControls();
    if (photoLocation) {
      map.getView().animate({ center: photoLocation.mapCoordinate, duration: 400 });
      updatePhotoSelectionDisplay();
      photoStorageStatus.textContent = photoLocation.directionCoordinate
        ? 'GPS-Standort und Blickrichtung übernommen. Du kannst die Auswahl ändern oder das Foto speichern.'
        : 'GPS-Standort übernommen. Klicke jetzt in die Blickrichtung.';
    } else {
      photoStorageStatus.textContent = 'Klicke auf die Karte, um den Aufnahmestandort zu wählen.';
    }
    cameraInput.value = '';
  });
}
