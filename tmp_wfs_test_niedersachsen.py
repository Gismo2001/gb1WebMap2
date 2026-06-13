import urllib.parse
import urllib.request
import time

base = 'https://opendata.lgln.niedersachsen.de/doorman/noauth/verwaltungsgrenzen_wfs'

params_list = [
    {
        'name': 'WFS 1.1.0, typeName, EPSG:4326, GML 3.1.1, maxFeatures=5',
        'params': {
            'service': 'WFS',
            'version': '1.1.0',
            'request': 'GetFeature',
            'typeName': 'ms:ni_landkreise',
            'outputFormat': 'text/xml; subtype=gml/3.1.1',
            'srsName': 'EPSG:4326',
            'bbox': '9.5,52.0,10.5,53.0,EPSG:4326',
            'maxFeatures': '5'
        }
    },
    {
        'name': 'WFS 1.1.0, typeName, EPSG:4326, GML 3.2.1, maxFeatures=5',
        'params': {
            'service': 'WFS',
            'version': '1.1.0',
            'request': 'GetFeature',
            'typeName': 'ms:ni_landkreise',
            'outputFormat': 'text/xml; subtype=gml/3.2.1',
            'srsName': 'EPSG:4326',
            'bbox': '9.5,52.0,10.5,53.0,EPSG:4326',
            'maxFeatures': '5'
        }
    },
    {
        'name': 'WFS 2.0.0, typeNames, EPSG:4326, GML 3.2.1, count=5',
        'params': {
            'service': 'WFS',
            'version': '2.0.0',
            'request': 'GetFeature',
            'typeNames': 'ms:ni_landkreise',
            'outputFormat': 'text/xml; subtype=gml/3.2.1',
            'srsName': 'urn:ogc:def:crs:EPSG::4326',
            'bbox': '9.5,52.0,10.5,53.0,urn:ogc:def:crs:EPSG::4326',
            'count': '5'
        }
    },
    {
        'name': 'WFS 2.0.0, typeNames, EPSG:3857, GML 3.2.1, count=5',
        'params': {
            'service': 'WFS',
            'version': '2.0.0',
            'request': 'GetFeature',
            'typeNames': 'ms:ni_landkreise',
            'outputFormat': 'text/xml; subtype=gml/3.2.1',
            'srsName': 'urn:ogc:def:crs:EPSG::3857',
            'bbox': '600000,5400000,1400000,6200000,urn:ogc:def:crs:EPSG::3857',
            'count': '5'
        }
    }
]

for item in params_list:
    q = urllib.parse.urlencode(item['params'], safe=':,;')
    url = base + '?' + q
    print('\n' + '=' * 80)
    print(item['name'])
    print(url)
    try:
        with urllib.request.urlopen(url, timeout=20) as resp:
            print('status', resp.status)
            body = resp.read(4000)
            print(body.decode('utf-8', errors='replace'))
    except Exception as e:
        print('ERROR', repr(e))
    time.sleep(1)
