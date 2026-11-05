import React, { useEffect } from 'react';
import type { ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/** Expo Router passes an error as a prop; it does not render children here. */
export default function RouteErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});
    console.error('[APP_STARTUP_ERROR]', error);
  }, [error]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Unable to open the app</Text>
      <Text style={styles.message}>Please try again. Your saved login is still on this device.</Text>
      <Pressable accessibilityRole="button" onPress={() => { void retry().catch(() => {}); }} style={styles.button}>
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', padding: 28, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', textAlign: 'center' },
  message: { fontSize: 16, color: '#4B5563', textAlign: 'center', marginTop: 12, marginBottom: 24 },
  button: { backgroundColor: '#3535A8', borderRadius: 12, paddingHorizontal: 28, paddingVertical: 16 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
