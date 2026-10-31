import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DocumentSurface from './document/DocumentSurface';
import { buildScannerHtml } from './document/scannerHtml';
import { persistDiaryScan } from './document/diaryPhotoFiles';

type Props = { uri: string; pageLabel?: string; onSave: (uri: string) => void; onCancel: () => void };

export default function DiaryPhotoEditor(props: Props) {
  const insets = useSafeAreaInsets();
  const savingRef = useRef(false);
  return <Modal visible animationType="slide" onRequestClose={() => { if (!savingRef.current) props.onCancel(); }}>
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]} accessibilityViewIsModal>
      <EditorContent {...props} savingRef={savingRef} />
    </View>
  </Modal>;
}

function EditorContent({ uri, pageLabel, onSave, onCancel, savingRef }: Props & { savingRef: React.RefObject<boolean> }) {
  const [data, setData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    setData(null); setError(null);
    void (async () => {
      try {
        const size = await new Promise<{ width: number; height: number }>((resolve, reject) => Image.getSize(uri, (width, height) => resolve({ width, height }), reject));
        const actions = Math.max(size.width, size.height) > 3200
          ? [{ resize: size.width > size.height ? { width: 3200 } : { height: 3200 } }] : [];
        const image = await ImageManipulator.manipulateAsync(uri, actions, { base64: true, compress: 1, format: ImageManipulator.SaveFormat.JPEG });
        if (!image.base64) throw new Error('Photo could not be prepared.');
        if (active) setData(`data:image/jpeg;base64,${image.base64}`);
      } catch (failure: any) { if (active) setError(failure?.message || 'Photo could not be opened. Please try again.'); }
    })();
    return () => { active = false; };
  }, [uri, attempt]);
  const html = useMemo(() => data ? buildScannerHtml(data) : '', [data]);
  const receive = useCallback((message: string) => {
    if (savingRef.current) return;
    try {
      const event = JSON.parse(message);
      if (event.type === 'cancel') { onCancel(); return; }
      if (event.type === 'error') { setError(String(event.message)); return; }
      if (event.type !== 'save' || typeof event.dataUri !== 'string') return;
      savingRef.current = true; setSaving(true); setError(null);
      void persistDiaryScan(event.dataUri).then((savedUri) => { if (mounted.current) onSave(savedUri); })
        .catch((failure) => { if (mounted.current) setError(failure?.message || 'Could not save the photo. Please retry.'); })
        .finally(() => { savingRef.current = false; if (mounted.current) setSaving(false); });
    } catch { setError('The editor returned an invalid photo. Please try again.'); }
  }, [onSave, onCancel, savingRef]);
  return <>
    <View style={styles.header}>
      <View style={{ flex: 1 }}><Text style={styles.title}>Edit diary photo</Text><Text style={styles.subtitle}>{pageLabel || 'Crop • straighten • rotate • enhance'}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Cancel photo editing" disabled={saving} onPress={onCancel} style={styles.button}><Text style={styles.text}>Cancel</Text></Pressable>
    </View>
    {error ? <View style={styles.error}><Text style={styles.text} accessibilityRole="alert">{error}</Text>{!data ? <Pressable accessibilityRole="button" onPress={() => setAttempt((value) => value + 1)} style={styles.button}><Text style={styles.text}>Retry</Text></Pressable> : null}</View> : null}
    {data ? <DocumentSurface html={html} onMessage={receive} /> : !error ? <View style={styles.loading}><ActivityIndicator color="#67E8F9" /><Text style={styles.text}>Preparing photo…</Text></View> : null}
    {saving ? <View style={styles.saving}><ActivityIndicator color="#67E8F9" /><Text style={styles.text}>Saving photo…</Text></View> : null}
  </>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, backgroundColor: '#162237' },
  title: { fontSize: 18, fontWeight: '700', color: '#F8FAFC' },
  subtitle: { fontSize: 12, color: '#CBD5E1', marginTop: 4 },
  button: { minWidth: 60, minHeight: 44, alignItems: 'center', justifyContent: 'center', padding: 8 },
  text: { color: '#F8FAFC', fontSize: 14 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  error: { backgroundColor: '#7F1D1D', padding: 12, gap: 8 },
  saving: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0F172ACC', alignItems: 'center', justifyContent: 'center', gap: 12 },
});
