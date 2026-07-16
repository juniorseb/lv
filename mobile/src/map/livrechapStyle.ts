// Style de carte Livrechap (fourni par l'utilisateur) — utilisable directement
// par Mapbox GL JS comme objet `style`. Fond neutre facon Yandex + labels aux
// couleurs de la marque.
/* eslint-disable */
export const LIVRECHAP_MAP_STYLE: any =
{
  "version": 8,
  "name": "Livrechap - Yandex-inspired",
  "metadata": {
    "livrechap:notes": "70% inspiration Yandex/Yango (fond neutre, lisibilite) + 30% identite Livrechap (accents orange/bleu nuit reserves aux elements interactifs). A importer dans Mapbox Studio via 'Nouveau style > Importer' ou a referencer directement via l'URL de style dans le SDK Mapbox (mapbox://styles/<compte>/<style-id>)."
  },
  "sprite": "mapbox://sprites/mapbox/streets-v12",
  "glyphs": "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
  "sources": {
    "composite": {
      "url": "mapbox://mapbox.mapbox-streets-v8",
      "type": "vector"
    }
  },
  "layers": [
    {
      "id": "background",
      "type": "background",
      "paint": {
        "background-color": "#F5F5F3"
      }
    },
    {
      "id": "landuse-park",
      "type": "fill",
      "source": "composite",
      "source-layer": "landuse",
      "filter": ["==", ["get", "class"], "park"],
      "paint": {
        "fill-color": "#EFEFE9",
        "fill-opacity": 0.6
      }
    },
    {
      "id": "landuse-general",
      "type": "fill",
      "source": "composite",
      "source-layer": "landuse",
      "filter": ["!=", ["get", "class"], "park"],
      "paint": {
        "fill-color": "#EFEFEA",
        "fill-opacity": 0.4
      }
    },
    {
      "id": "water",
      "type": "fill",
      "source": "composite",
      "source-layer": "water",
      "paint": {
        "fill-color": "#D9E8F0"
      }
    },
    {
      "id": "waterway",
      "type": "line",
      "source": "composite",
      "source-layer": "waterway",
      "paint": {
        "line-color": "#D9E8F0",
        "line-width": 1
      }
    },
    {
      "id": "building",
      "type": "fill",
      "source": "composite",
      "source-layer": "building",
      "minzoom": 14,
      "paint": {
        "fill-color": "#E8E8E4",
        "fill-outline-color": "#DCDCD6",
        "fill-opacity": 0.9
      }
    },
    {
      "id": "road-path",
      "type": "line",
      "source": "composite",
      "source-layer": "road",
      "filter": ["==", ["get", "class"], "path"],
      "paint": {
        "line-color": "#E4E4DE",
        "line-width": 1
      }
    },
    {
      "id": "road-minor-casing",
      "type": "line",
      "source": "composite",
      "source-layer": "road",
      "filter": ["in", ["get", "class"], ["literal", ["street", "service", "track"]]],
      "layout": { "line-join": "round", "line-cap": "round" },
      "paint": {
        "line-color": "#D6D6D0",
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1.2, 16, 4]
      }
    },
    {
      "id": "road-minor",
      "type": "line",
      "source": "composite",
      "source-layer": "road",
      "filter": ["in", ["get", "class"], ["literal", ["street", "service", "track"]]],
      "layout": { "line-join": "round", "line-cap": "round" },
      "paint": {
        "line-color": "#FFFFFF",
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.6, 16, 2.6]
      }
    },
    {
      "id": "road-secondary-casing",
      "type": "line",
      "source": "composite",
      "source-layer": "road",
      "filter": ["in", ["get", "class"], ["literal", ["secondary", "tertiary"]]],
      "layout": { "line-join": "round", "line-cap": "round" },
      "paint": {
        "line-color": "#C9C9C2",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.5, 16, 6]
      }
    },
    {
      "id": "road-secondary",
      "type": "line",
      "source": "composite",
      "source-layer": "road",
      "filter": ["in", ["get", "class"], ["literal", ["secondary", "tertiary"]]],
      "layout": { "line-join": "round", "line-cap": "round" },
      "paint": {
        "line-color": "#FFFFFF",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1, 16, 4.5]
      }
    },
    {
      "id": "road-primary-casing",
      "type": "line",
      "source": "composite",
      "source-layer": "road",
      "filter": ["==", ["get", "class"], "primary"],
      "layout": { "line-join": "round", "line-cap": "round" },
      "paint": {
        "line-color": "#B9B9B0",
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1.5, 16, 8]
      }
    },
    {
      "id": "road-primary",
      "type": "line",
      "source": "composite",
      "source-layer": "road",
      "filter": ["==", ["get", "class"], "primary"],
      "layout": { "line-join": "round", "line-cap": "round" },
      "paint": {
        "line-color": "#FFFFFF",
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1, 16, 6.5]
      }
    },
    {
      "id": "road-motorway-trunk-casing",
      "type": "line",
      "source": "composite",
      "source-layer": "road",
      "filter": ["in", ["get", "class"], ["literal", ["motorway", "trunk"]]],
      "layout": { "line-join": "round", "line-cap": "round" },
      "paint": {
        "line-color": "#A8A89E",
        "line-width": ["interpolate", ["linear"], ["zoom"], 6, 2, 16, 10]
      }
    },
    {
      "id": "road-motorway-trunk",
      "type": "line",
      "source": "composite",
      "source-layer": "road",
      "filter": ["in", ["get", "class"], ["literal", ["motorway", "trunk"]]],
      "layout": { "line-join": "round", "line-cap": "round" },
      "paint": {
        "line-color": "#FFFFFF",
        "line-width": ["interpolate", ["linear"], ["zoom"], 6, 1.5, 16, 8.5]
      }
    },
    {
      "id": "admin-boundary",
      "type": "line",
      "source": "composite",
      "source-layer": "admin",
      "filter": ["<=", ["get", "admin_level"], 2],
      "paint": {
        "line-color": "#C4C4BC",
        "line-width": 1,
        "line-dasharray": [3, 2]
      }
    },
    {
      "id": "poi-major-only",
      "type": "symbol",
      "source": "composite",
      "source-layer": "poi_label",
      "filter": ["in", ["get", "maki"], ["literal", ["airport", "hospital", "college", "school", "bus", "ferry"]]],
      "layout": {
        "text-field": ["get", "name_fr"],
        "text-font": ["Open Sans Regular"],
        "text-size": 11,
        "icon-size": 0.9,
        "text-offset": [0, 1.1],
        "text-anchor": "top"
      },
      "paint": {
        "text-color": "#6B6B63",
        "text-halo-color": "#F5F5F3",
        "text-halo-width": 1.2
      }
    },
    {
      "id": "road-label-major",
      "type": "symbol",
      "source": "composite",
      "source-layer": "road",
      "minzoom": 13,
      "filter": ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary"]]],
      "layout": {
        "symbol-placement": "line",
        "text-field": ["get", "name_fr"],
        "text-font": ["Open Sans Regular"],
        "text-size": 11
      },
      "paint": {
        "text-color": "#7A7A70",
        "text-halo-color": "#FFFFFF",
        "text-halo-width": 1.4
      }
    },
    {
      "id": "neighbourhood-label",
      "type": "symbol",
      "source": "composite",
      "source-layer": "place_label",
      "filter": ["==", ["get", "type"], "neighbourhood"],
      "layout": {
        "text-field": ["get", "name_fr"],
        "text-font": ["Open Sans Semibold"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 11, 12, 15, 16],
        "text-transform": "uppercase",
        "text-letter-spacing": 0.05
      },
      "paint": {
        "text-color": "#14213D",
        "text-halo-color": "#F5F5F3",
        "text-halo-width": 1.5
      }
    },
    {
      "id": "settlement-label",
      "type": "symbol",
      "source": "composite",
      "source-layer": "place_label",
      "filter": ["in", ["get", "type"], ["literal", ["city", "town"]]],
      "layout": {
        "text-field": ["get", "name_fr"],
        "text-font": ["Open Sans Bold"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 6, 12, 12, 18]
      },
      "paint": {
        "text-color": "#14213D",
        "text-halo-color": "#F5F5F3",
        "text-halo-width": 1.6
      }
    }
  ]
}
;
