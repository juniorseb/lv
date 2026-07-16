import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import MenuDrawer from '../components/MenuDrawer';
import PrimaryButton from '../components/PrimaryButton';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import type { AppStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'ClientHome'>;

// Accueil du rôle client. On y arrive directement si activeRole = 'client'
// (plus de re-choix de rôle au démarrage). Le menu hamburger donne accès à
// l'historique, au profil, à la bascule de rôle, etc.
export default function ClientHomeScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const [menuOpen, setMenuOpen] = useState(false);

  const greeting = user?.fullName?.split(' ')[0] ?? 'à Livrechap';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable onPress={() => setMenuOpen(true)} hitSlop={10}>
          <Text style={styles.burger}>☰</Text>
        </Pressable>
        <Text style={styles.greeting}>Bonjour {greeting}</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.container}>
        <View style={styles.header}>
          <Image
            source={require('../../assets/logo/icon-1024.png')}
            style={styles.logo}
          />
          <Text style={styles.title}>Livrechap</Text>
          <Text style={styles.subtitle}>Publie. Trouve. Livre.</Text>
        </View>

        <PrimaryButton
          label="📦  Envoyer un colis"
          onPress={() => navigation.navigate('CreateDelivery')}
          style={styles.button}
        />
        <PrimaryButton
          label="🛵  Distribuer plusieurs colis"
          variant="secondary"
          onPress={() => navigation.navigate('CreateTour')}
          style={styles.button}
        />
        <Pressable
          onPress={() => navigation.navigate('ClientHistory')}
          style={styles.link}
        >
          <Text style={styles.linkText}>Suivre mes livraisons</Text>
        </Pressable>
      </View>

      <MenuDrawer
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        navigation={navigation}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  burger: { fontSize: 26, color: colors.navy },
  greeting: { fontSize: 15, color: colors.navy, fontWeight: '600' },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  header: { marginBottom: 48, alignItems: 'center' },
  logo: { width: 84, height: 84, borderRadius: 20, marginBottom: 16 },
  title: {
    fontSize: 40,
    fontWeight: '700',
    color: colors.orange,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.navy,
    textAlign: 'center',
    marginTop: 4,
  },
  button: { marginBottom: 16 },
  link: { alignItems: 'center', paddingVertical: 8 },
  linkText: { color: colors.orange, fontSize: 15, fontWeight: '600' },
});
