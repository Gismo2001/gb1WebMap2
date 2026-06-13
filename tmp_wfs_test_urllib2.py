import urllib.parse
import urllib.request

base = 'https://opendata.lgln.niedersachsen.de/doorman/noauth/verwaltungsgrenzen_wfs'
params_list = [
    {
        'service': 'WFS',
        'version': '1.1.0',
        'request': 'GetFeature',
        'typeName': 'ms:ni_landkreise',
        'outputFormat': 'text/xml; subtype=gml/3.1.1',
        'srsName': 'urn:ogc:def:crs:EPSG::3857',
        'bbox': '600000,5400000,1400000,6200000,urn:ogc:def:crs:EPSG::3857',
        'maxFeatures': '20'
    },
    {
        'service': 'WFS',
        'version': '1.1.0',
        'request': 'GetFeature',
        'typename': 'ms:ni_landkreise',
        'outputFormat': 'text/xml; subtype=gml/3.1.1',
        'srsName': 'urn:ogc:def:crs:EPSG::3857',
        'bbox': '600000,5400000,1400000,6200000,urn:ogc:def:crs:EPSG::3857',
        'maxFeatures': '20'
    }
]

for params in params_list:
    q = urllib.parse.urlencode(params, safe=':,;')
    url = base + '?' + q
    print('URL:', url)
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            print('status', resp.status)
            text = resp.read(2000)
            print(text.decode('utf-8', errors='replace'))
    except Exception as e:
        print('ERROR', e)
    print('\n' + '-'*80 + '\n')
