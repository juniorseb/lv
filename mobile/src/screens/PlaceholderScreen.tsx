import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';

// Écran d'attente réutilisable pour les parcours encore à construire
// (création de livraison, feed livreur, portefeuille…).
export default function PlaceholderScreen({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.navy,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 22,
  },
});
