import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
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

import { ApiError } from '../api/client';
import { uploadImage } from '../api/uploads';
import { usersApi } from '../api/users';
import { IdDocumentType } from '../api/types';
import PrimaryButton from '../components/PrimaryButton';
import { useAuthStore } from '../store/authStore';
import { pickImage } from '../utils/image';
import { colors } from '../theme/colors';
import type { AppStackParamList } from '../navigation/types';

const DOC_TYPES: { value: IdDocumentType; label: string }[] = [
  { value: 'cni', label: 'CNI' },
  { value: 'passeport', label: 'Passeport' },
];

type Props = NativeStackScreenProps<AppStackParamList, 'Verification'>;

// Confiance et sécurité par palier (dossier §6).
//  - Niveau 1 : nom, commune, selfie → badge « Profil non vérifié » (standard)
//  - Niveau 2 : CNI soumise → validée manuellement par un admin → « Vérifié »
export default function VerificationScreen(_props: Props) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [commune, setCommune] = useState(user?.commune ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [dateNaissance, setDateNaissance] = useState(user?.dateNaissance ?? '');
  const [emName, setEmName] = useState(user?.emergencyContactName ?? '');
  const [emPhone, setEmPhone] = useState(user?.emergencyContactPhone ?? '');
  const [savingContact, setSavingContact] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docType, setDocType] = useState<IdDocumentType>('cni');

  const isVerified = user?.verificationLevel === 'verifie';
  const docPending = !isVerified && (user?.hasIdDocument ?? false);

  const saveProfile = async () => {
    const dob = dateNaissance.trim();
    if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      Alert.alert('Date de naissance', 'Format attendu : AAAA-MM-JJ.');
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await usersApi.updateProfile({
        fullName: fullName.trim() || undefined,
        commune: commune.trim() || undefined,
        email: email.trim() || undefined,
        dateNaissance: dob || undefined,
      });
      setUser(updated);
      Alert.alert('Profil', 'Informations enregistrées.');
    } catch (e) {
      Alert.alert('Erreur', e instanceof ApiError ? e.message : 'Réessayez.');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveContact = async () => {
    const phone = emPhone.trim();
    if (phone && !/^\+?\d{8,15}$/.test(phone)) {
      Alert.alert('Contact d’urgence', 'Numéro invalide (ex: +2250700000000).');
      return;
    }
    setSavingContact(true);
    try {
      const updated = await usersApi.updateProfile({
        emergencyContactName: emName.trim() || undefined,
        emergencyContactPhone: phone || undefined,
      });
      setUser(updated);
      Alert.alert('Contact d’urgence', 'Enregistré.');
    } catch (e) {
      Alert.alert('Erreur', e instanceof ApiError ? e.message : 'Réessayez.');
    } finally {
      setSavingContact(false);
    }
  };

  const uploadSelfie = async () => {
    const uri = await pickImage();
    if (!uri) return;
    setUploadingSelfie(true);
    try {
      const url = await uploadImage(uri);
      const updated = await usersApi.setSelfie(url);
      setUser(updated);
      Alert.alert('Selfie', 'Selfie enregistré.');
    } catch (e) {
      Alert.alert('Erreur', e instanceof ApiError ? e.message : 'Réessayez.');
    } finally {
      setUploadingSelfie(false);
    }
  };

  const uploadIdDocument = async () => {
    const uri = await pickImage();
    if (!uri) return;
    setUploadingDoc(true);
    try {
      const url = await uploadImage(uri);
      const updated = await usersApi.submitIdDocument(url, docType);
      setUser(updated);
      Alert.alert(
        'Pièce envoyée',
        'Votre pièce sera vérifiée par notre équipe sous peu.',
      );
    } catch (e) {
      Alert.alert('Erreur', e instanceof ApiError ? e.message : 'Réessayez.');
    } finally {
      setUploadingDoc(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {isVerified ? '✅ Compte vérifié' : '🔵 Profil non vérifié'}
          </Text>
        </View>

        <Text style={styles.section}>Niveau 1 — Informations</Text>
        <Text style={styles.label}>Nom complet</Text>
        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Votre nom"
          placeholderTextColor={colors.gray}
        />
        <Text style={styles.label}>Commune</Text>
        <TextInput
          style={styles.input}
          value={commune}
          onChangeText={setCommune}
          placeholder="Ex: Cocody"
          placeholderTextColor={colors.gray}
        />
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="vous@exemple.com"
          placeholderTextColor={colors.gray}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Text style={styles.label}>Date de naissance</Text>
        <TextInput
          style={styles.input}
          value={dateNaissance}
          onChangeText={setDateNaissance}
          placeholder="AAAA-MM-JJ"
          placeholderTextColor={colors.gray}
        />
        <PrimaryButton
          label="Enregistrer"
          onPress={saveProfile}
          loading={savingProfile}
          style={styles.action}
        />

        <Text style={styles.section}>Contact d'urgence</Text>
        <Text style={styles.help}>
          En cas d'alerte SOS pendant une livraison (Livrechap Protect), cette
          personne est prévenue par SMS avec votre position.
        </Text>
        <Text style={styles.label}>Nom du contact</Text>
        <TextInput
          style={styles.input}
          value={emName}
          onChangeText={setEmName}
          placeholder="Ex: un proche"
          placeholderTextColor={colors.gray}
        />
        <Text style={styles.label}>Numéro du contact</Text>
        <TextInput
          style={styles.input}
          value={emPhone}
          onChangeText={setEmPhone}
          placeholder="+2250700000000"
          placeholderTextColor={colors.gray}
          keyboardType="phone-pad"
        />
        <PrimaryButton
          label="Enregistrer le contact"
          variant="secondary"
          onPress={saveContact}
          loading={savingContact}
          style={styles.action}
        />

        <View style={styles.uploadRow}>
          <View style={styles.flex}>
            <Text style={styles.uploadTitle}>Selfie</Text>
            <Text style={styles.uploadSub}>
              {user?.hasSelfie ? 'Fourni ✓' : 'Requis pour le Niveau 1'}
            </Text>
          </View>
          {uploadingSelfie ? (
            <ActivityIndicator color={colors.orange} />
          ) : (
            <PrimaryButton
              label={user?.hasSelfie ? 'Changer' : 'Ajouter'}
              variant="secondary"
              onPress={uploadSelfie}
              style={styles.uploadButton}
            />
          )}
        </View>

        <Text style={styles.section}>Niveau 2 — Pièce d'identité</Text>
        <Text style={styles.help}>
          Obligatoire au-delà d'un certain montant ou pour les colis de valeur.
          Votre pièce (CNI ou passeport) est vérifiée manuellement.
        </Text>

        {!isVerified && (
          <View style={styles.docTypeRow}>
            {DOC_TYPES.map((t) => {
              const selected = docType === t.value;
              return (
                <Pressable
                  key={t.value}
                  onPress={() => setDocType(t.value)}
                  style={[styles.docType, selected && styles.docTypeSelected]}
                >
                  <Text
                    style={[
                      styles.docTypeText,
                      selected && styles.docTypeTextSelected,
                    ]}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {docPending && (
          <Text style={styles.pending}>
            Pièce reçue, en attente de validation. ⏳
          </Text>
        )}

        {uploadingDoc ? (
          <ActivityIndicator color={colors.orange} style={styles.action} />
        ) : (
          <PrimaryButton
            label={
              isVerified
                ? 'Pièce validée'
                : docPending
                  ? 'Renvoyer une pièce'
                  : 'Envoyer ma pièce'
            }
            onPress={uploadIdDocument}
            disabled={isVerified}
            style={styles.action}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  content: { padding: 24 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.grayLight,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 20,
  },
  badgeText: { color: colors.navy, fontWeight: '600', fontSize: 14 },
  section: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.navy,
    marginTop: 24,
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.navy,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.navy,
  },
  action: { marginTop: 16 },
  help: { fontSize: 13, color: colors.gray, marginBottom: 4, lineHeight: 19 },
  docTypeRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  docType: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  docTypeSelected: { borderColor: colors.orange, backgroundColor: '#FFF6EF' },
  docTypeText: { fontSize: 15, fontWeight: '600', color: colors.navy },
  docTypeTextSelected: { color: colors.orange },
  pending: { fontSize: 13, color: colors.warning, marginTop: 12 },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 12,
  },
  uploadTitle: { fontSize: 15, fontWeight: '600', color: colors.navy },
  uploadSub: { fontSize: 13, color: colors.gray, marginTop: 2 },
  uploadButton: { paddingHorizontal: 20 },
});
