import React, { useEffect } from 'react';
import {
  BackHandler,
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PlayStoreUpdateController } from '../hooks/usePlayStoreUpdate';

export default function ForceUpdateScreen({ update }: { update: PlayStoreUpdateController }) {
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  const waiting = update.busy || update.downloading || update.installing;
  const buttonLabel = update.downloaded ? 'Restart & Update' : 'Update Now';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <Ionicons name="cloud-download-outline" size={42} color="#2563EB" />
        </View>
        <Text style={styles.title}>Update Required</Text>
        <Text style={styles.message}>
          {update.downloaded ? 'Your update is ready. Restart the app to finish installing it.'
            : update.downloading ? `Downloading your update${update.progress === null ? '…' : ` · ${update.progress}%`}`
            : update.installing ? 'Installing your update…'
            : 'A newer version of this school app is required to continue. Please update from Google Play.'}
        </Text>
        {update.error ? <Text style={styles.error} accessibilityLiveRegion="polite">{update.error}</Text> : null}
        <Pressable accessibilityRole="button" disabled={waiting}
          onPress={() => { void (update.downloaded ? update.completeUpdate() : update.startUpdate()); }}
          style={[styles.button, waiting && { opacity: 0.7 }]}>
          <Text style={styles.buttonText}>{waiting ? 'Updating…' : buttonLabel}</Text>
          {waiting ? <ActivityIndicator color="#FFFFFF" />
            : <Ionicons name="cloud-download-outline" size={18} color="#FFFFFF" />}
        </Pressable>
        <Pressable accessibilityRole="link" onPress={() => { void update.openStore(); }} style={styles.storeLink}>
          <Text style={styles.storeLinkText}>Open Google Play</Text>
        </Pressable>
        {Platform.OS !== 'android' && (
          <Text style={styles.helper}>If the store does not open, contact your school administrator.</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  iconWrap: {
    width: 86,
    height: 86,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DBEAFE',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
    textAlign: 'center',
    maxWidth: 360,
    marginBottom: 28,
  },
  button: {
    minHeight: 52,
    minWidth: 190,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  helper: {
    marginTop: 16,
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
  },
  error: { color: '#B91C1C', textAlign: 'center', marginBottom: 16 },
  storeLink: { padding: 16 },
  storeLinkText: { color: '#2563EB', fontSize: 14, fontWeight: '600' },
});
