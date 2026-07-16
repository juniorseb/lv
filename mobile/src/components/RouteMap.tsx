import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { MAPBOX_TOKEN } from '../config';
import { LatLng } from '../api/types';
import { LIVRECHAP_MAP_STYLE } from '../map/livrechapStyle';

type Props = {
  // Position du livreur (mobile), animée à chaque mise à jour.
  driver: LatLng | null;
  // Cible courante (récupération, puis destination).
  destination: LatLng | null;
  // Tracé de l'itinéraire (GeoJSON [lng, lat][]).
  route: [number, number][] | null;
  style?: object;
};

// Carte de suivi (WebView + Mapbox GL JS) : marqueur livreur (orange, halo),
// marqueur destination (bleu nuit), itinéraire orange. Couleurs de marque
// (livrechap-map-integration.md). Le livreur est interpolé pour un mouvement
// fluide plutôt que des sauts.
export default function RouteMap({ driver, destination, route, style }: Props) {
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);

  // Source stable : sinon la carte se rechargeait à CHAQUE mise à jour de la
  // position du livreur (nouvel objet source à chaque rendu). Les mises à jour
  // passent uniquement par injectJavaScript.
  const source = useMemo(() => ({ html: buildHtml(MAPBOX_TOKEN) }), []);

  useEffect(() => {
    if (!ready) return;
    const payload = JSON.stringify({ driver, destination, route });
    webRef.current?.injectJavaScript(`window.__update(${payload}); true;`);
  }, [ready, driver, destination, route]);

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        onMessage={(e) => {
          if (e.nativeEvent.data === 'ready') setReady(true);
        }}
        source={source}
        style={styles.web}
      />
    </View>
  );
}

function buildHtml(token: string): string {
  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.css" rel="stylesheet" />
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.js"></script>
  <style>
    html,body,#map{margin:0;padding:0;height:100%;width:100%;}
    .mapboxgl-ctrl-logo,.mapboxgl-ctrl-attrib{display:none !important;}
    .driver-halo{width:38px;height:38px;border-radius:19px;background:rgba(249,115,22,0.25);display:flex;align-items:center;justify-content:center;}
    .driver-dot{width:16px;height:16px;border-radius:8px;background:#F97316;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3);}
    .dest-dot{width:18px;height:18px;border-radius:9px;background:#14213D;border:3px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3);}
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    mapboxgl.accessToken = ${JSON.stringify(token)};
    var map = new mapboxgl.Map({
      container: 'map',
      style: ${JSON.stringify(LIVRECHAP_MAP_STYLE)},
      center: [-4.0083, 5.3599],
      zoom: 12,
      attributionControl: false
    });

    var driverMarker = null, destMarker = null, animId = null;

    function el(cls, inner){ var d=document.createElement('div'); d.className=cls; if(inner) d.appendChild(inner); return d; }

    function ensureRoute(coords){
      var gj = { type:'Feature', geometry:{ type:'LineString', coordinates: coords } };
      if(map.getSource('route')){ map.getSource('route').setData(gj); }
      else {
        map.addSource('route', { type:'geojson', data: gj });
        map.addLayer({ id:'route', type:'line', source:'route',
          layout:{ 'line-cap':'round','line-join':'round' },
          paint:{ 'line-color':'#F97316','line-width':5 } }, firstSymbolId());
      }
    }
    function firstSymbolId(){
      var layers = map.getStyle().layers;
      for (var i=0;i<layers.length;i++){ if(layers[i].type==='symbol') return layers[i].id; }
      return undefined;
    }

    function animateDriver(to){
      var inner = el('driver-dot');
      if(!driverMarker){
        driverMarker = new mapboxgl.Marker({ element: el('driver-halo', inner) }).setLngLat(to).addTo(map);
        return;
      }
      var from = driverMarker.getLngLat();
      var start = null, dur = 1200;
      if(animId) cancelAnimationFrame(animId);
      function step(ts){
        if(!start) start = ts;
        var t = Math.min(1,(ts-start)/dur);
        var lng = from.lng + (to[0]-from.lng)*t;
        var lat = from.lat + (to[1]-from.lat)*t;
        driverMarker.setLngLat([lng,lat]);
        if(t<1) animId = requestAnimationFrame(step);
      }
      animId = requestAnimationFrame(step);
    }

    var fitted = false;
    window.__update = function(data){
      try {
        if(data.destination){
          var d=[data.destination.longitude, data.destination.latitude];
          if(!destMarker) destMarker = new mapboxgl.Marker({ element: el('dest-dot') }).setLngLat(d).addTo(map);
          else destMarker.setLngLat(d);
        }
        if(data.driver){
          animateDriver([data.driver.longitude, data.driver.latitude]);
        }
        if(data.route && data.route.length){ ensureRoute(data.route); }

        // Cadrer une fois sur l'ensemble driver+destination(+route).
        if(!fitted && data.driver && data.destination){
          var b = new mapboxgl.LngLatBounds();
          b.extend([data.driver.longitude, data.driver.latitude]);
          b.extend([data.destination.longitude, data.destination.latitude]);
          (data.route||[]).forEach(function(c){ b.extend(c); });
          map.fitBounds(b, { padding: 60, maxZoom: 15, duration: 600 });
          fitted = true;
        }
      } catch(e){}
    };

    map.on('load', function(){ window.ReactNativeWebView.postMessage('ready'); });
  </script>
</body>
</html>`;
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', borderRadius: 16 },
  web: { flex: 1, backgroundColor: '#F5F5F3' },
});
