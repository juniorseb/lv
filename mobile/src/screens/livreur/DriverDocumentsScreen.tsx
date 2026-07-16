import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '../../api/client';
import { profilesApi } from '../../api/profiles';
import { uploadImage } from '../../api/uploads';
import {
  DriverDocument,
  DriverDocumentStatus,
  DriverDocumentType,
  VehicleType,
} from '../../api/types';
import { captureImage, pickImage } from '../../utils/image';
import { colors } from '../../theme/colors';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'DriverDocuments'>;

const LABEL: Record<DriverDocumentType, string> = {
  cni_recto: "Pièce d'identité — recto",
  cni_verso: "Pièce d'identité — verso",
  selfie_live: 'Selfie (photo en direct)',
  permis: 'Permis de conduire',
  carte_grise: 'Carte grise',
  assurance: 'Assurance',
  visite_technique: 'Visite technique',
};

const COMMON: DriverDocumentType[] = ['cni_recto', 'cni_verso', 'selfie_live'];

// Documents avec une date d'expiration à renseigner.
const EXPIRABLE: DriverDocumentType[] = ['assurance', 'visite_technique'];

// Documents requis selon le véhicule (spec-onboarding-livreur-v2 §1 étape 4).
function requiredDocs(vehicle: VehicleType): DriverDocumentType[] {
  if (vehicle === 'moto') return [...COMMON, 'permis'];
  if (vehicle === 'voiture' || vehicle === 'camionnette') {
    return [...COMMON, 'permis', 'carte_grise', 'assurance', 'visite_technique'];
  }
  return COMMON; // vélo, à pied
}

const STATUS_STYLE: Record<
  DriverDocumentStatus | 'manquant',
  { label: string; color: string }
> = {
  valide: { label: '✓ Validé', color: colors.success },
  en_attente: { label: '⏳ En attente', color: colors.warning },
  rejete: { label: '✗ Rejeté — à renvoyer', color: colors.danger },
  manquant: { label: 'À fournir', color: colors.gray },
};

// Alerte d'expiration (spec-onboarding-livreur-v2 §5) : rappel dès 30 jours,
// message d'expiration passée sinon. null si pas de date ou expiration lointaine.
function expiryNotice(
  dateExpiration: string | null,
): { text: string; color: string } | null {
  if (!dateExpiration) return null;
  const exp = new Date(dateExpiration + 'T00:00:00');
  if (Number.isNaN(exp.getTime())) return null;
  const days = Math.ceil((exp.getTime() - Date.now()) / 86_400_000);
  if (days < 0) {
    return { text: `⚠️ Document expiré le ${dateExpiration}`, color: colors.danger };
  }
  if (days <= 30) {
    return {
      text: `⚠️ Expire dans ${days} jour${days > 1 ? 's' : ''} (${dateExpiration})`,
      color: colors.warning,
    };
  }
  return { text: `Valide jusqu'au ${dateExpiration}`, color: colors.gray };
}

export default function DriverDocumentsScreen(_props: Props) {
  const queryClient = useQueryClient();
  const [uploadingType, setUploadingType] = useState<DriverDocumentType | null>(
    null,
  );
  const [expiry, setExpiry] = useState<
    Partial<Record<DriverDocumentType, string>>
  >({});

  const profileQuery = useQuery({
    queryKey: ['driver-profile'],
    queryFn: () => profilesApi.getMyDriverProfile(),
  });
  const docsQuery = useQuery({
    queryKey: ['driver-documents'],
    queryFn: () => profilesApi.getDriverDocuments(),
  });

  if (profileQuery.isLoading || docsQuery.isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={colors.orange} size="large" />
      </SafeAreaView>
    );
  }

  const profile = profileQuery.data;
  if (!profile) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.help}>Aucun profil livreur.</Text>
      </SafeAreaView>
    );
  }

  const docs = docsQuery.data ?? [];
  const byType = new Map<DriverDocumentType, DriverDocument>(
    docs.map((d) => [d.type, d]),
  );
  const required = requiredDocs(profile.vehicleType);
  const allValidated = required.every((t) => byType.get(t)?.status === 'valide');

  const effectiveExpiry = (type: DriverDocumentType): string =>
    expiry[type] ?? byType.get(type)?.dateExpiration ?? '';

  const submit = async (type: DriverDocumentType, uri: string) => {
    let exp: string | undefined;
    if (EXPIRABLE.includes(type)) {
      const value = effectiveExpiry(type).trim();
      if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        Alert.alert("Date d'expiration", 'Format attendu : AAAA-MM-JJ.');
        return;
      }
      exp = value || undefined;
    }
    setUploadingType(type);
    try {
      const url = await uploadImage(uri);
      await profilesApi.submitDriverDocument(type, url, exp);
      await queryClient.invalidateQueries({ queryKey: ['driver-documents'] });
    } catch (e) {
      Alert.alert('Erreur', e instanceof ApiError ? e.message : 'Réessayez.');
    } finally {
      setUploadingType(null);
    }
  };

  const onAdd = (type: DriverDocumentType) => {
    // Le selfie doit être pris en direct (caméra frontale). Les autres pièces
    // peuvent être photographiées ou choisies dans la galerie.
    const handle = (uri: string | null) => {
      if (uri) void submit(type, uri);
    };
    if (type === 'selfie_live') {
      void captureImage({ front: true }).then(handle);
      return;
    }
    Alert.alert(LABEL[type], 'Comment ajouter ce document ?', [
      {
        text: 'Prendre une photo',
        onPress: () => void captureImage().then(handle),
      },
      {
        text: 'Choisir dans la galerie',
        onPress: () => void pickImage().then(handle),
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.help}>
          Ajoutez les documents demandés pour votre véhicule. Notre équipe les
          vérifie avant d'activer votre compte.
        </Text>

        {allValidated && (
          <View style={styles.allOk}>
            <Text style={styles.allOkText}>
              ✅ Tous vos documents sont validés.
            </Text>
          </View>
        )}

        {required.map((type) => {
          const doc = byType.get(type);
          const state = STATUS_STYLE[doc?.status ?? 'manquant'];
          const busy = uploadingType === type;
          const provided = Boolean(doc);
          const expirable = EXPIRABLE.includes(type);
          return (
            <View key={type} style={styles.row}>
              <View style={styles.rowTop}>
                <View style={styles.flex}>
                  <Text style={styles.docLabel}>{LABEL[type]}</Text>
                  <Text style={[styles.docStatus, { color: state.color }]}>
                    {state.label}
                  </Text>
                  {(() => {
                    const notice = expiryNotice(doc?.dateExpiration ?? null);
                    return notice ? (
                      <Text style={[styles.docExpiry, { color: notice.color }]}>
                        {notice.text}
                      </Text>
                    ) : null;
                  })()}
                </View>
                {busy ? (
                  <ActivityIndicator color={colors.orange} />
                ) : (
                  <Pressable
                    style={[styles.addBtn, provided && styles.addBtnSecondary]}
                    onPress={() => onAdd(type)}
                  >
                    <Text
                      style={[
                        styles.addBtnText,
                        provided && styles.addBtnTextSecondary,
                      ]}
                    >
                      {provided ? 'Remplacer' : 'Ajouter'}
                    </Text>
                  </Pressable>
                )}
              </View>
              {expirable && (
                <TextInput
                  style={styles.expiry}
                  value={effectiveExpiry(type)}
                  onChangeText={(v) =>
                    setExpiry((prev) => ({ ...prev, [type]: v }))
                  }
                  placeholder="Date d'expiration (AAAA-MM-JJ)"
                  placeholderTextColor={colors.gray}
                />
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  centered: {
    flex: 1,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  content: { padding: 24 },
  help: { fontSize: 14, color: colors.gray, lineHeight: 20, marginBottom: 8 },
  allOk: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  allOkText: { color: colors.success, fontWeight: '700', fontSize: 14 },
  row: {
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
    paddingVertical: 16,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  expiry: {
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.navy,
  },
  docLabel: { fontSize: 15, fontWeight: '600', color: colors.navy },
  docStatus: { fontSize: 13, marginTop: 3, fontWeight: '600' },
  docExpiry: { fontSize: 12, marginTop: 3, fontWeight: '600' },
  addBtn: {
    backgroundColor: colors.orange,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  addBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.grayLight,
  },
  addBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  addBtnTextSecondary: { color: colors.navy },
});
