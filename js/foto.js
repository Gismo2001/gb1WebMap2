import { toLonLat } from 'ol/proj';
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
  const photoDescription = document.getElementById('photo-description');
  const photoStorageStatus = document.getElementById('photo-storage-status');
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

  function downloadPhoto(file) {
    const timestamp = new Date().toISOString().replace(/[.:]/g, '-');
    const extension = file.type === 'image/jpeg' || file.type === 'image/jpg'
      ? 'jpg'
      : file.type.split('/')[1] || 'jpg';
    const downloadUrl = URL.createObjectURL(file);
    const downloadLink = document.createElement('a');

    downloadLink.href = downloadUrl;
    downloadLink.download = `foto-${timestamp}.${extension}`;
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
    const capturedAt = new Date();

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
      downloadPhoto(photoWithMetadata);
      await savePhoto(photoWithMetadata, pendingPhoto.description, {
        title: pendingPhoto.title,
        latitude: photoLocation.latitude,
        longitude: photoLocation.longitude,
        direction,
        capturedAt: capturedAt.toISOString()
      });
      photoStorageStatus.textContent = photoWithMetadata.type === 'image/jpeg'
        ? 'Foto mit EXIF- und IPTC-Daten gespeichert.'
        : 'Foto gespeichert. Metadaten liegen separat vor; EXIF/IPTC werden nur für JPEG geschrieben.';
      photoTitle.value = '';
      photoDescription.value = '';
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
  cancelPhotoLocationBtn.addEventListener('click', () => {
    pendingPhoto = null;
    photoLocation = null;
    setPhotoLocationMode(false);
    updatePhotoSelectionControls();
    photoStorageStatus.textContent = 'Standortauswahl abgebrochen.';
  });
  cameraInput.addEventListener('change', () => {
    const [file] = cameraInput.files;
    if (!file) return;

    pendingPhoto = {
      file,
      title: photoTitle.value.trim(),
      description: photoDescription.value.trim()
    };
    photoLocation = null;
    photoSelectionStage = 'location';
    setPhotoLocationMode(true);
    updatePhotoSelectionControls();
    photoStorageStatus.textContent = 'Klicke auf die Karte, um den Aufnahmestandort zu wählen.';
    cameraInput.value = '';
  });
}
