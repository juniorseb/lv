import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { ABIDJAN_CENTER, MAPBOX_TOKEN } from '../config';
import { PlaceSuggestion, ReverseAddress } from '../api/mapbox';
import { LatLng } from '../api/types';
import { addressSearch } from '../services/addressSearch';
import {
  SavedAddress,
  getFavoriteAddresses,
  getRecentAddresses,
  isFavorite,
  rememberAddress,
  toggleFavorite,
} from '../services/addressHistory';
import { LIVRECHAP_MAP_STYLE } from '../map/livrechapStyle';
import { colors } from '../theme/colors';

export interface PickedPoint {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  neighborhood: string | null;
  city: string | null;
  // Repère humain pour le livreur, attaché à CETTE adresse (spec §7 :
  // « Ajouter un repère » sous l'adresse ; ticket-precision-livreur).
  landmark: string;
}

type Props = {
  visible: boolean;
  initial?: LatLng | null;
  // Repère déjà saisi pour cette adresse : le picker et le formulaire éditent
  // la même valeur (une seule source de vérité, deux points d'entrée).
  landmark?: string;
  onCancel: () => void;
  onConfirm: (point: PickedPoint) => void;
};

const LANDMARK_PLACEHOLDER =
  'Ex. : portail orange, à côté de la pharmacie, après le carrefour…';

// Au-delà de cette précision GPS rapportée, la position est jugée approximative
// et on invite l'utilisateur à ajuster la carte (spec §5).
const LOW_ACCURACY_METERS = 50;

// Sélecteur d'adresse type Yango/Uber (spec-address-picker-map-v3) :
// pin fixe au centre, la carte glisse dessous, l'adresse du centre est résolue
// automatiquement à l'arrêt (debounce + annulation des requêtes obsolètes),
// recherche manuelle, bouton « Ma position », récents/favoris, et animation de
// soulèvement du pin pendant le déplacement.
export default function MapPickerModal({
  visible,
  initial,
  landmark: initialLandmark,
  onCancel,
  onConfirm,
}: Props) {
  const start = initial ?? ABIDJAN_CENTER;
  const webRef = useRef<WebView>(null);
  const centerRef = useRef<LatLng>(start);
  const [center, setCenter] = useState<LatLng>(start);

  // La source de la WebView DOIT être stable : si on la recrée à chaque rendu,
  // la carte se recharge en boucle (elle repost son centre → setState → rendu →
  // nouvelle source → rechargement…), ce qui faisait clignoter le bandeau.
  // On construit donc le HTML une seule fois et on recentre ensuite par flyTo.
  const initialCenterRef = useRef<LatLng>(start);
  const source = useMemo(
    () => ({ html: buildHtml(MAPBOX_TOKEN, initialCenterRef.current) }),
    [],
  );
  const [address, setAddress] = useState<ReverseAddress | null>(null);
  const [geocoding, setGeocoding] = useState(true);
  const [locating, setLocating] = useState(false);
  const [ready, setReady] = useState(false);
  const [lowAccuracy, setLowAccuracy] = useState(false);
  const [favorite, setFavorite] = useState(false);

  // Repère pour le livreur : même valeur que le champ du formulaire (le picker
  // n'est qu'un second point d'entrée, pas une seconde source de vérité).
  const [landmark, setLandmark] = useState(initialLandmark ?? '');
  const [landmarkOpen, setLandmarkOpen] = useState(
    Boolean(initialLandmark?.trim()),
  );
  useEffect(() => {
    if (!visible) return;
    setLandmark(initialLandmark ?? '');
    setLandmarkOpen(Boolean(initialLandmark?.trim()));
  }, [visible, initialLandmark]);

  // Recherche manuelle dans l'écran carte (spec §9).
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [saved, setSaved] = useState<{
    favorites: SavedAddress[];
    recents: SavedAddress[];
  }>({ favorites: [], recents: [] });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Animation du pin (P2) : il se soulève pendant que la carte glisse dessous,
  // et redescend à l'arrêt.
  const lift = useRef(new Animated.Value(0)).current;
  const animateLift = (up: boolean) => {
    Animated.spring(lift, {
      toValue: up ? -12 : 0,
      useNativeDriver: true,
      friction: 6,
      tension: 90,
    }).start();
  };

  const fly = (lat: number, lng: number) => {
    webRef.current?.injectJavaScript(`window.__flyTo(${lng}, ${lat}); true;`);
  };
  const setGpsDot = (lat: number, lng: number) => {
    webRef.current?.injectJavaScript(`window.__setGps(${lng}, ${lat}); true;`);
  };

  // Résolution de l'adresse du centre, déclenchée à l'arrêt de la carte.
  const lastResolvedRef = useRef<string | null>(null);
  const resolveCenter = (lat: number, lng: number) => {
    // La carte peut réémettre son centre sans avoir bougé : on ignore, sinon on
    // repasse en « Recherche… » pour rien (clignotement).
    const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    if (key === lastResolvedRef.current) return;
    lastResolvedRef.current = key;

    centerRef.current = { latitude: lat, longitude: lng };
    setCenter({ latitude: lat, longitude: lng });
    setGeocoding(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const result = await addressSearch.reverse(lat, lng, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setAddress(result);
      setGeocoding(false);
      setFavorite(
        result
          ? await isFavorite({
              latitude: lat,
              longitude: lng,
              formattedAddress: result.formattedAddress,
              neighborhood: result.neighborhood,
              city: result.city,
            })
          : false,
      );
    }, 500);
  };

  const onMessage = (e: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.t === 'ready') {
        setReady(true);
      } else if (msg.t === 'movestart') {
        animateLift(true);
        // Dès que l'utilisateur ajuste lui-même la carte, l'avertissement de
        // position approximative n'a plus lieu d'être.
        if (msg.user) setLowAccuracy(false);
      } else if (msg.t === 'center') {
        animateLift(false);
        resolveCenter(msg.lat, msg.lng);
      }
    } catch {
      /* ignore */
    }
  };

  // À l'ouverture (sans point initial) : dernière position connue tout de suite,
  // puis GPS précis en arrière-plan (spec §3).
  useEffect(() => {
    if (!visible || !ready || initial) return;
    let cancelled = false;
    (async () => {
      const last = await Location.getLastKnownPositionAsync();
      if (last && !cancelled) fly(last.coords.latitude, last.coords.longitude);
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status === 'granted') {
        const cur = await Location.getCurrentPositionAsync({});
        if (!cancelled) {
          fly(cur.coords.latitude, cur.coords.longitude);
          setGpsDot(cur.coords.latitude, cur.coords.longitude);
          applyAccuracy(cur.coords.accuracy);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, ready]);

  // Le HTML n'est construit qu'une fois : quand on rouvre le sélecteur sur une
  // adresse déjà choisie, on recentre la caméra plutôt que de recharger la carte.
  useEffect(() => {
    if (!visible || !ready || !initial) return;
    fly(initial.latitude, initial.longitude);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, ready, initial?.latitude, initial?.longitude]);

  // Récents + favoris, rechargés à chaque ouverture du sélecteur.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      const [favorites, recents] = await Promise.all([
        getFavoriteAddresses(),
        getRecentAddresses(),
      ]);
      if (!cancelled) setSaved({ favorites, recents });
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const applyAccuracy = (accuracy: number | null) => {
    setLowAccuracy(accuracy !== null && accuracy > LOW_ACCURACY_METERS);
  };

  const goToMyPosition = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Localisation désactivée',
        'Activez-la dans les paramètres pour utiliser cette fonction.',
      );
      return;
    }
    setLocating(true);
    try {
      const pos = await Location.getCurrentPositionAsync({});
      setGpsDot(pos.coords.latitude, pos.coords.longitude);
      fly(pos.coords.latitude, pos.coords.longitude);
      applyAccuracy(pos.coords.accuracy);
    } finally {
      setLocating(false);
    }
  };

  const onQueryChange = (text: string) => {
    setQuery(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (text.trim().length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      const results = await addressSearch.suggest(text);
      setSuggestions(results);
      setSearching(false);
    }, 350);
  };

  // Résultat de recherche choisi : la caméra se déplace (le pin reste fixe) et
  // le reverse geocoding est relancé sur la position réellement atteinte, pour
  // rester cohérent avec ce qui sera enregistré (spec §9).
  const pickSearchResult = (lat: number, lng: number) => {
    setQuery('');
    setSuggestions([]);
    setSearchFocused(false);
    setLowAccuracy(false);
    fly(lat, lng);
  };

  const onToggleFavorite = async () => {
    if (!address) return;
    const next = await toggleFavorite({
      latitude: centerRef.current.latitude,
      longitude: centerRef.current.longitude,
      formattedAddress: address.formattedAddress,
      neighborhood: address.neighborhood,
      city: address.city,
    });
    setFavorite(next);
    setSaved({
      favorites: await getFavoriteAddresses(),
      recents: await getRecentAddresses(),
    });
  };

  const canConfirm = !geocoding;
  const confirm = async () => {
    const point: PickedPoint = {
      latitude: centerRef.current.latitude,
      longitude: centerRef.current.longitude,
      formattedAddress:
        address?.formattedAddress ??
        `${centerRef.current.latitude.toFixed(5)}, ${centerRef.current.longitude.toFixed(5)}`,
      neighborhood: address?.neighborhood ?? null,
      city: address?.city ?? null,
      landmark: landmark.trim(),
    };
    await rememberAddress(point);
    onConfirm(point);
  };

  // Panneau de suggestions : résultats de recherche si l'utilisateur tape,
  // sinon ses favoris et adresses récentes.
  const showSavedPanel = searchFocused && query.trim().length < 2;
  const showResultsPanel = query.trim().length >= 2;
  const savedEntries = [...saved.favorites, ...saved.recents];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Le bandeau est collé en bas : sans ça, le clavier recouvre le champ
            « repère » quand on le saisit. La carte se réduit, le panneau monte. */}
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <View style={styles.header}>
          <Pressable onPress={onCancel} hitSlop={8}>
            <Text style={styles.cancel}>Annuler</Text>
          </Pressable>
          <Text style={styles.title}>Choisir sur la carte</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.searchRow}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={onQueryChange}
            onFocus={() => setSearchFocused(true)}
            placeholder="Rechercher une adresse, un lieu…"
            placeholderTextColor={colors.gray}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => onQueryChange('')} hitSlop={8}>
              <Text style={styles.clear}>✕</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.mapWrap}>
          <WebView
            ref={webRef}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            onMessage={onMessage}
            source={source}
            style={styles.web}
          />

          <Animated.View
            pointerEvents="none"
            style={[styles.pin, { transform: [{ translateY: lift }] }]}
          >
            <Text style={styles.pinIcon}>📍</Text>
          </Animated.View>

          {lowAccuracy && (
            <View style={styles.approxBanner} pointerEvents="none">
              <Text style={styles.approxText}>
                Position approximative, déplacez la carte pour ajuster
              </Text>
            </View>
          )}

          <Pressable
            style={styles.myPos}
            onPress={goToMyPosition}
            disabled={locating}
          >
            {locating ? (
              <ActivityIndicator size="small" color={colors.navy} />
            ) : (
              <Text style={styles.myPosIcon}>◎</Text>
            )}
          </Pressable>

          {(showResultsPanel || (showSavedPanel && savedEntries.length > 0)) && (
            <View style={styles.panel}>
              <ScrollView keyboardShouldPersistTaps="handled">
                {showResultsPanel ? (
                  <>
                    {searching && (
                      <Text style={styles.panelHint}>Recherche…</Text>
                    )}
                    {!searching && suggestions.length === 0 && (
                      <Text style={styles.panelHint}>Aucun résultat.</Text>
                    )}
                    {suggestions.map((s) => (
                      <Pressable
                        key={s.id}
                        style={styles.panelRow}
                        onPress={() => pickSearchResult(s.latitude, s.longitude)}
                      >
                        <Text style={styles.panelName}>{s.name}</Text>
                        <Text style={styles.panelAddr} numberOfLines={1}>
                          {s.address}
                        </Text>
                      </Pressable>
                    ))}
                  </>
                ) : (
                  <>
                    {saved.favorites.length > 0 && (
                      <Text style={styles.panelSection}>★ Favoris</Text>
                    )}
                    {saved.favorites.map((a, i) => (
                      <SavedRow
                        key={`fav-${i}-${a.latitude}`}
                        entry={a}
                        onPress={() => pickSearchResult(a.latitude, a.longitude)}
                      />
                    ))}
                    {saved.recents.length > 0 && (
                      <Text style={styles.panelSection}>Récentes</Text>
                    )}
                    {saved.recents.map((a, i) => (
                      <SavedRow
                        key={`rec-${i}-${a.latitude}`}
                        entry={a}
                        onPress={() => pickSearchResult(a.latitude, a.longitude)}
                      />
                    ))}
                  </>
                )}
              </ScrollView>
            </View>
          )}
        </View>

        <View style={styles.sheet}>
          {geocoding ? (
            <Text style={styles.searching}>Recherche de l'adresse…</Text>
          ) : (
            <View style={styles.addrRow}>
              <View style={styles.addrText}>
                <Text style={styles.addrMain} numberOfLines={1}>
                  {address?.main ??
                    `${center.latitude.toFixed(5)}, ${center.longitude.toFixed(5)}`}
                </Text>
                <Text style={styles.addrSub} numberOfLines={1}>
                  {[address?.neighborhood, address?.city]
                    .filter(Boolean)
                    .join(', ') || 'Position approximative'}
                </Text>
              </View>
              {address && (
                <Pressable onPress={onToggleFavorite} hitSlop={10}>
                  <Text style={[styles.star, favorite && styles.starOn]}>
                    {favorite ? '★' : '☆'}
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Repère pour le livreur, saisi au moment où l'on regarde l'endroit
              (spec §7). C'est la même valeur que dans le formulaire. */}
          {landmarkOpen ? (
            <View style={styles.landmarkBox}>
              <Text style={styles.landmarkLabel}>Précision pour le livreur</Text>
              <TextInput
                style={styles.landmarkInput}
                value={landmark}
                onChangeText={setLandmark}
                placeholder={LANDMARK_PLACEHOLDER}
                placeholderTextColor={colors.gray}
                maxLength={150}
                multiline
              />
            </View>
          ) : (
            <Pressable onPress={() => setLandmarkOpen(true)} hitSlop={8}>
              <Text style={styles.landmarkAdd}>＋ Ajouter un repère</Text>
            </Pressable>
          )}

          <Pressable
            style={[styles.confirm, !canConfirm && styles.confirmDisabled]}
            onPress={confirm}
            disabled={!canConfirm}
          >
            <Text style={styles.confirmText}>Confirmer cette adresse</Text>
          </Pressable>
        </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function SavedRow({
  entry,
  onPress,
}: {
  entry: SavedAddress;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.panelRow} onPress={onPress}>
      <Text style={styles.panelName} numberOfLines={1}>
        {entry.formattedAddress}
      </Text>
      <Text style={styles.panelAddr} numberOfLines={1}>
        {[entry.neighborhood, entry.city].filter(Boolean).join(', ') ||
          `${entry.latitude.toFixed(4)}, ${entry.longitude.toFixed(4)}`}
      </Text>
    </Pressable>
  );
}

function buildHtml(token: string, start: LatLng): string {
  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.css" rel="stylesheet" />
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.js"></script>
  <style>
    html,body,#map{margin:0;padding:0;height:100%;width:100%;}
    .mapboxgl-ctrl-logo,.mapboxgl-ctrl-attrib{display:none !important;}
    .gps-halo{width:24px;height:24px;border-radius:12px;background:rgba(20,33,61,0.18);display:flex;align-items:center;justify-content:center;}
    .gps-dot{width:12px;height:12px;border-radius:6px;background:#2F6BFF;border:2px solid #fff;}
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    mapboxgl.accessToken = ${JSON.stringify(token)};
    var map = new mapboxgl.Map({
      container: 'map',
      style: ${JSON.stringify(LIVRECHAP_MAP_STYLE)},
      center: [${start.longitude}, ${start.latitude}],
      zoom: 16,
      attributionControl: false
    });
    var gpsMarker = null;
    function send(payload){ window.ReactNativeWebView.postMessage(JSON.stringify(payload)); }
    function sendCenter(){
      var c = map.getCenter();
      send({ t:'center', lat:c.lat, lng:c.lng });
    }
    window.__flyTo = function(lng, lat){ map.flyTo({ center:[lng,lat], zoom:16, duration:700 }); };
    window.__setGps = function(lng, lat){
      var halo = document.createElement('div'); halo.className='gps-halo';
      var dot = document.createElement('div'); dot.className='gps-dot'; halo.appendChild(dot);
      if(!gpsMarker){ gpsMarker = new mapboxgl.Marker({ element: halo }).setLngLat([lng,lat]).addTo(map); }
      else { gpsMarker.setLngLat([lng,lat]); }
    };
    map.on('load', function(){
      send({ t:'ready' });
      sendCenter();
    });
    // originalEvent n'est présent que si le mouvement vient d'un geste : il
    // distingue un ajustement manuel d'une animation déclenchée par l'app.
    map.on('movestart', function(e){ send({ t:'movestart', user: !!e.originalEvent }); });
    map.on('moveend', sendCenter);
  </script>
</body>
</html>`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
  },
  cancel: { color: colors.gray, fontSize: 15, width: 60 },
  title: { fontSize: 16, fontWeight: '700', color: colors.navy },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    borderRadius: 14,
  },
  searchIcon: { fontSize: 15 },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.navy,
  },
  clear: { fontSize: 15, color: colors.gray, paddingHorizontal: 4 },
  mapWrap: { flex: 1 },
  web: { flex: 1, backgroundColor: '#F5F5F3' },
  pin: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinIcon: { fontSize: 42, marginBottom: 42 },
  approxBanner: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(20,33,61,0.85)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  approxText: { color: colors.white, fontSize: 12.5, textAlign: 'center' },
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    maxHeight: 260,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
  },
  panelSection: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gray,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
  },
  panelHint: { fontSize: 13, color: colors.gray, padding: 14 },
  panelRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
  },
  panelName: { fontSize: 15, fontWeight: '600', color: colors.navy },
  panelAddr: { fontSize: 13, color: colors.gray, marginTop: 2 },
  myPos: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  myPosIcon: { fontSize: 24, color: colors.navy },
  sheet: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.grayLight,
    gap: 6,
  },
  searching: { color: colors.gray, fontSize: 15, paddingVertical: 6 },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  addrText: { flex: 1 },
  addrMain: { fontSize: 17, fontWeight: '700', color: colors.navy },
  addrSub: { fontSize: 14, color: colors.gray },
  star: { fontSize: 26, color: colors.gray },
  starOn: { color: colors.orange },
  landmarkAdd: {
    color: colors.orange,
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 6,
  },
  landmarkBox: { marginTop: 4 },
  landmarkLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.navy,
    marginBottom: 6,
  },
  landmarkInput: {
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.navy,
    minHeight: 44,
    textAlignVertical: 'top',
  },
  confirm: {
    backgroundColor: colors.orange,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  confirmDisabled: { opacity: 0.5 },
  confirmText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
