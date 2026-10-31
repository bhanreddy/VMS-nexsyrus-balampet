import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PlayStoreUpdateController } from '../hooks/usePlayStoreUpdate';

export default function AppUpdateBanner({ update }: { update: PlayStoreUpdateController }) {
  if (!update.showBanner) return null;
  const waiting = update.busy || update.downloading || update.installing;
  const message = update.downloaded ? 'Update ready. Restart to finish.'
    : update.downloading ? `Downloading update${update.progress === null ? '…' : ` · ${update.progress}%`}`
    : update.installing ? 'Installing update…' : 'A new version is available';

  return (
    <View style={styles.banner} accessibilityLiveRegion="polite" testID="app-update-banner">
      <View style={styles.row}>
        <Ionicons name="cloud-download-outline" size={21} color="#1D4ED8" />
        <View style={styles.copy}>
          <Text style={styles.message}>{message}</Text>
          {update.error ? <Text style={styles.error}>{update.error}</Text> : null}
        </View>
        {waiting ? <ActivityIndicator color="#1D4ED8" accessibilityLabel={message} /> : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={update.downloaded ? 'Restart to install update' : 'Update app now'}
            onPress={() => { void (update.downloaded ? update.completeUpdate() : update.startUpdate()); }}
            style={styles.action}
          >
            <Text style={styles.actionText}>{update.downloaded ? 'Restart' : 'Update now'}</Text>
          </Pressable>
        )}
        {!waiting && !update.downloaded ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss update reminder"
            onPress={update.dismiss} hitSlop={10} style={styles.close}>
            <Ionicons name="close" size={20} color="#475569" />
          </Pressable>
        ) : null}
      </View>
      {update.downloading && update.progress !== null ? (
        <View style={styles.track} accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: update.progress }}>
          <View style={[styles.progress, { width: `${update.progress}%` }]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: '#EFF6FF', borderBottomWidth: 1, borderBottomColor: '#BFDBFE', padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  copy: { flex: 1 },
  message: { color: '#1E3A8A', fontSize: 13, fontWeight: '600' },
  error: { color: '#B91C1C', fontSize: 12, marginTop: 4 },
  action: { backgroundColor: '#1D4ED8', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  actionText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  close: { padding: 4 },
  track: { height: 3, backgroundColor: '#DBEAFE', marginTop: 10, borderRadius: 2 },
  progress: { height: 3, backgroundColor: '#2563EB', borderRadius: 2 },
});
