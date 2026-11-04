import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PlayStoreUpdateController } from '../hooks/usePlayStoreUpdate';

export default function AppUpdateBanner({ update }: { update: PlayStoreUpdateController }) {
  if (!update.showBanner) return null;
  const waiting = update.busy || update.downloading || update.installing;
  const title = update.installing ? 'Finishing your update'
    : update.downloaded ? 'Your update is ready'
    : update.downloading ? 'Updating your app' : 'Update available';
  const description = update.installing ? 'Your app will be ready shortly.'
    : update.downloaded ? 'Restart the app to enjoy the latest version.'
    : update.downloading ? 'You can keep using the app while it downloads.'
    : 'Get the latest version for a better app experience.';
  const status = update.installing ? 'Installing…'
    : update.downloading ? 'Downloading…' : 'Opening Google Play…';
  const progress = update.progress === null ? null : Math.max(0, Math.min(100, update.progress));

  return (
    <View style={styles.container}>
      <View style={styles.banner} accessibilityLiveRegion="polite" testID="app-update-banner">
        <View style={styles.header}>
          <View style={styles.iconTile}>
            <Ionicons name={update.downloaded && !update.installing ? 'checkmark-done' : 'cloud-download-outline'} size={25} color="#BDB4FF" />
          </View>
          <Text style={styles.eyebrow}>APP UPDATE</Text>
          {!waiting && !update.downloaded ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Dismiss update reminder"
              onPress={update.dismiss} hitSlop={4}
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
              <Ionicons name="close" size={20} color="#C7CBE0" />
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        <Text style={styles.description}>{description}</Text>
        {update.error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={18} color="#FECDD3" />
            <Text style={styles.error}>{update.error}</Text>
          </View>
        ) : null}
        {waiting ? (
          <View style={styles.statusBlock}>
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color="#C5BDFF" accessibilityLabel={status} />
              <Text style={styles.status}>{status}</Text>
              {update.downloading && progress !== null ? <Text style={styles.percentage}>{progress}%</Text> : null}
            </View>
            {update.downloading ? (
              <View style={styles.track} accessibilityRole="progressbar" accessibilityLabel="Update download progress"
                accessibilityValue={progress === null ? { text: 'Downloading' } : { min: 0, max: 100, now: progress }}>
                {progress !== null ? <View style={[styles.progress, { width: `${progress}%` }]} /> : null}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.footer}>
            <View style={styles.store}>
              <Ionicons name="logo-google-playstore" size={15} color="#B6BCD3" />
              <Text style={styles.storeText}>Google Play</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={update.downloaded ? 'Restart to install update' : 'Update app now'}
              onPress={() => { void (update.downloaded ? update.completeUpdate() : update.startUpdate()); }}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              <Text style={styles.actionText}>{update.downloaded ? 'Restart now' : 'Update now'}</Text>
              <Ionicons name={update.downloaded ? 'refresh' : 'arrow-forward'} size={17} color="#241C47" />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, width: '100%', maxWidth: 640, alignSelf: 'center' },
  banner: {
    backgroundColor: '#20223C', borderRadius: 22, padding: 20,
    borderWidth: 1, borderColor: '#383B59',
    shadowColor: '#17152C', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.16, shadowRadius: 12, elevation: 5,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  iconTile: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#343250', borderWidth: 1, borderColor: '#4B456C', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { flex: 1, color: '#C6BFFF', fontSize: 11, fontWeight: '700', letterSpacing: 1.6 },
  close: { minWidth: 44, minHeight: 44, marginRight: -8, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  title: { color: '#FFFFFF', fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.4 },
  description: { color: '#C6CADC', fontSize: 14, lineHeight: 21, marginTop: 6 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 18 },
  store: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  storeText: { color: '#B6BCD3', fontSize: 12, fontWeight: '500' },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#D5CEFF', borderRadius: 13, paddingHorizontal: 16, paddingVertical: 13, minHeight: 48 },
  actionText: { color: '#241C47', fontWeight: '700', fontSize: 14 },
  pressed: { opacity: 0.75 },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, padding: 10, borderRadius: 10, backgroundColor: '#452C40', marginTop: 12 },
  error: { flex: 1, color: '#FECDD3', fontSize: 12, lineHeight: 18 },
  statusBlock: { marginTop: 18 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 24 },
  status: { flex: 1, color: '#D9DCEC', fontSize: 13, fontWeight: '500' },
  percentage: { color: '#E4DFFF', fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  track: { height: 5, backgroundColor: '#41435F', marginTop: 12, borderRadius: 3, overflow: 'hidden' },
  progress: { height: 5, backgroundColor: '#BDB0FF', borderRadius: 3 },
});
