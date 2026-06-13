import urllib.request

urls = [
    'https://opendata.lgln.niedersachsen.de/doorman/noauth/verwaltungsgrenzen_wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=ms:ni_landkreise&outputFormat=text/xml; subtype=gml/3.1.1&srsName=EPSG:3857&bbox=600000,5400000,1400000,6200000',
    'https://opendata.lgln.niedersachsen.de/doorman/noauth/verwaltungsgrenzen_wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=ms:ni_landkreise&outputFormat=' + urllib.parse.quote('text/xml; subtype=gml/3.1.1') + '&srsName=EPSG:3857&bbox=600000,5400000,1400000,6200000'
]
for url in urls:
    print('URL:', url)
    try:
        with urllib.request.urlopen(url, timeout=20) as resp:
            print('status', resp.status)
            data = resp.read(2000)
            print(data.decode('utf-8', errors='replace'))
    except Exception as e:
        print('ERROR', e)
    print('\n' + '-'*80 + '\n')
