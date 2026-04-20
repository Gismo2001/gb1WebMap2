import WMSCapabilities from 'ol-ext/control/WMSCapabilities';
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
cap.on('select', function(e) {
  
  // Hier könnte man manuell prüfen, ob die Buttons nun existieren
  setTimeout(() => {
    const loadBtn = document.querySelector('.ol-load');
    if (loadBtn) {
        loadBtn.style.display = 'block';
        loadBtn.style.visibility = 'visible';
    }
  }, 100);
});
}

