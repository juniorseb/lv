import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PlaceSuggestion } from '../api/mapbox';
import { addressSearch } from '../services/addressSearch';
import {
  SavedAddress,
  getFavoriteAddresses,
  getRecentAddresses,
  rememberAddress,
} from '../services/addressHistory';
import { getCurrentCoords } from '../utils/location';
import { colors } from '../theme/colors';
import MapPickerModal, { PickedPoint } from './MapPickerModal';

// Adresse sélectionnée : les coordonnées ne sont renseignées que si le point
// vient d'une suggestion, du GPS ou de la carte (choix « dans les suggestions »).
// Le repère pour le livreur appartient à l'adresse : il voyage avec elle, qu'il
// soit saisi ici ou dans le sélecteur de carte (une seule source de vérité).
export interface LocationValue {
  address: string;
  latitude?: number;
  longitude?: number;
  landmark?: string;
}

const LANDMARK_PLACEHOLDER =
  'Ex. : portail orange, à côté de la pharmacie, après le carrefour…';

type Props = {
  label: string;
  placeholder: string;
  value: LocationValue;
  onChange: (value: LocationValue) => void;
};

// Champ d'adresse à autocomplétion (Mapbox, biais Abidjan) + bouton carte
// (choix du point façon inDrive) + « Ma position » (GPS).
export default function AddressField({
  label,
  placeholder,
  value,
  onChange,
}: Props) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [saved, setSaved] = useState<SavedAddress[]>([]);
  // Le champ repère s'ouvre dès qu'un repère existe (saisi ici ou sur la carte).
  const [landmarkOpen, setLandmarkOpen] = useState(
    Boolean(value.landmark?.trim()),
  );
  useEffect(() => {
    if (value.landmark?.trim()) setLandmarkOpen(true);
  }, [value.landmark]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasCoords = value.latitude !== undefined && value.longitude !== undefined;

  // Suggestions intelligentes (spec §10, P2) : favoris puis adresses récentes,
  // proposés tant que l'utilisateur n'a rien tapé. Rechargés après chaque choix
  // (le sélecteur de carte enrichit la même liste).
  const reloadSaved = async () => {
    const [favorites, recents] = await Promise.all([
      getFavoriteAddresses(),
      getRecentAddresses(),
    ]);
    setSaved([...favorites, ...recents].slice(0, 6));
  };
  useEffect(() => {
    void reloadSaved();
  }, []);

  const onChangeText = (text: string) => {
    // Modifier le texte invalide la sélection : on efface les coordonnées.
    // Le repère, lui, reste attaché à ce champ.
    onChange({ address: text, landmark: value.landmark });

    if (debounce.current) clearTimeout(debounce.current);
    if (text.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      const results = await addressSearch.suggest(text);
      setSuggestions(results);
      setSearching(false);
    }, 350);
  };

  const selectSuggestion = async (s: PlaceSuggestion) => {
    onChange({
      address: s.address,
      latitude: s.latitude,
      longitude: s.longitude,
      landmark: value.landmark,
    });
    setSuggestions([]);
    setFocused(false);
    await rememberAddress({
      latitude: s.latitude,
      longitude: s.longitude,
      formattedAddress: s.address,
      neighborhood: null,
      city: null,
    });
    void reloadSaved();
  };

  const selectSaved = (a: SavedAddress) => {
    onChange({
      address: a.formattedAddress,
      latitude: a.latitude,
      longitude: a.longitude,
      landmark: value.landmark,
    });
    setSuggestions([]);
    setFocused(false);
    void rememberAddress(a);
  };

  const useCurrentPosition = async () => {
    setLocating(true);
    setSuggestions([]);
    try {
      const coords = await getCurrentCoords();
      if (!coords) return;
      const detailed = await addressSearch.reverse(
        coords.latitude,
        coords.longitude,
      );
      onChange({
        ...coords,
        address: detailed?.formattedAddress ?? 'Ma position',
        landmark: value.landmark,
      });
    } finally {
      setLocating(false);
    }
  };

  const onPickedOnMap = (point: PickedPoint) => {
    setPickerOpen(false);
    setFocused(false);
    onChange({
      address: point.formattedAddress,
      latitude: point.latitude,
      longitude: point.longitude,
      // Le repère saisi sur la carte est celui de cette adresse.
      landmark: point.landmark || undefined,
    });
    // Le sélecteur a déjà mémorisé le point : on rafraîchit juste la liste.
    void reloadSaved();
  };

  // Aucune saisie en cours : on propose l'historique plutôt qu'une liste vide.
  const showSaved =
    focused &&
    suggestions.length === 0 &&
    value.address.trim().length < 2 &&
    saved.length > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={value.address}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          placeholder={placeholder}
          placeholderTextColor={colors.gray}
        />
        <Pressable
          style={styles.mapBtn}
          onPress={() => setPickerOpen(true)}
          hitSlop={6}
        >
          <Text style={styles.mapBtnIcon}>🗺️</Text>
        </Pressable>
      </View>

      {searching && <Text style={styles.searching}>Recherche…</Text>}

      {suggestions.length > 0 && (
        <View style={styles.suggestions}>
          {suggestions.map((s) => (
            <Pressable
              key={s.id}
              style={styles.suggestion}
              onPress={() => void selectSuggestion(s)}
            >
              <Text style={styles.suggestionName}>{s.name}</Text>
              <Text style={styles.suggestionAddr} numberOfLines={1}>
                {s.address}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {showSaved && (
        <View style={styles.suggestions}>
          <Text style={styles.savedTitle}>Adresses enregistrées</Text>
          {saved.map((a, i) => (
            <Pressable
              key={`${i}-${a.latitude}-${a.longitude}`}
              style={styles.suggestion}
              onPress={() => selectSaved(a)}
            >
              <Text style={styles.suggestionName} numberOfLines={1}>
                {a.formattedAddress}
              </Text>
              <Text style={styles.suggestionAddr} numberOfLines={1}>
                {[a.neighborhood, a.city].filter(Boolean).join(', ') ||
                  'Adresse récente'}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.actionsRow}>
        <Pressable onPress={useCurrentPosition} disabled={locating} hitSlop={6}>
          <Text style={styles.gpsLink}>
            {locating ? 'Localisation…' : '📍 Ma position'}
          </Text>
        </Pressable>
        {locating && <ActivityIndicator size="small" color={colors.orange} />}
        {hasCoords && !locating && <Text style={styles.ok}>✓</Text>}
      </View>

      {/* Repère pour le livreur, attaché à cette adresse. Même valeur que celle
          éditable dans le sélecteur de carte (ticket-precision-livreur). */}
      {hasCoords &&
        (landmarkOpen ? (
          <View style={styles.landmarkBox}>
            <Text style={styles.landmarkLabel}>Précision pour le livreur</Text>
            <TextInput
              style={styles.landmarkInput}
              value={value.landmark ?? ''}
              onChangeText={(t) => onChange({ ...value, landmark: t })}
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
        ))}

      <MapPickerModal
        visible={pickerOpen}
        initial={hasCoords ? { latitude: value.latitude!, longitude: value.longitude! } : null}
        landmark={value.landmark}
        onCancel={() => setPickerOpen(false)}
        onConfirm={onPickedOnMap}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.navy,
    marginBottom: 8,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.navy,
  },
  mapBtn: {
    width: 50,
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapBtnIcon: { fontSize: 22 },
  searching: { fontSize: 12, color: colors.gray, marginTop: 6 },
  suggestions: {
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    borderRadius: 14,
    overflow: 'hidden',
  },
  suggestion: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
  },
  savedTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gray,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 2,
  },
  suggestionName: { fontSize: 15, fontWeight: '600', color: colors.navy },
  suggestionAddr: { fontSize: 13, color: colors.gray, marginTop: 2 },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 10,
  },
  landmarkAdd: {
    color: colors.orange,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  landmarkBox: { marginTop: 10 },
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
  gpsLink: { color: colors.orange, fontSize: 14, fontWeight: '600' },
  ok: { color: colors.success, fontSize: 14, fontWeight: '700' },
});
