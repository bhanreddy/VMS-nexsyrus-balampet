import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import DiaryGeminiHelp from './DiaryGeminiHelp';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shareDiaryPdf, shareDiaryPhoto } from './document/diaryPhotoFiles';

type Props = { photos: string[]; initialIndex?: number; onClose: () => void; allowGemini?: boolean; initialGeminiOpen?: boolean };
type Viewport = { zoom: number; x: number; y: number };
const initialViewport = { zoom: 1, x: 0, y: 0 };

export default function DiaryPhotoViewer(props: Props) {
  const [geminiOpen, setGeminiOpen] = useState(Boolean(props.allowGemini && props.initialGeminiOpen));
  const close = () => { if (geminiOpen) setGeminiOpen(false); else props.onClose(); };
  if (!props.photos.length) return null;
  return <Modal visible animationType="fade" onRequestClose={close} statusBarTranslucent>
    <PhotoViewerContent {...props} geminiOpen={geminiOpen} setGeminiOpen={setGeminiOpen} />
  </Modal>;
}

function PhotoViewerContent({ photos, initialIndex = 0, onClose, allowGemini, geminiOpen, setGeminiOpen }: Props & { geminiOpen: boolean; setGeminiOpen: (open: boolean) => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(Math.max(0, Math.min(initialIndex, photos.length - 1)));
  const [viewport, setViewport] = useState<Viewport>(initialViewport);
  const [rotation, setRotation] = useState(0);
  const [fitWidth, setFitWidth] = useState(false);
  const [light, setLight] = useState(false);
  const [stage, setStage] = useState({ width: 1, height: 1 });
  const [imageSize, setImageSize] = useState({ width: 1000, height: 1400 });
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retry, setRetry] = useState(0);
  const [action, setAction] = useState<string | null>(null);
  const actionRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const uri = photos[index];
  const imageLoaded = useCallback((event: any) => {
    const source = event.nativeEvent?.source || event.nativeEvent?.target || event.target;
    const width = source?.naturalWidth || source?.width, height = source?.naturalHeight || source?.height;
    if (width && height) setImageSize({ width, height });
    setStatus('ready');
  }, []);
  const imageFailed = useCallback(() => setStatus('error'), []);
  const swapped = rotation % 180 !== 0;
  const orientedWidth = swapped ? imageSize.height : imageSize.width;
  const orientedHeight = swapped ? imageSize.width : imageSize.height;
  const ratio = fitWidth ? stage.width / orientedWidth : Math.min(stage.width / orientedWidth, stage.height / orientedHeight);
  const geometry = { width: orientedWidth * ratio, height: orientedHeight * ratio, stage };
  const live = useRef({ viewport, geometry });
  live.current = { viewport, geometry };
  const updateViewport = useCallback((next: Viewport) => {
    const { geometry: g } = live.current;
    const zoom = Math.max(1, Math.min(8, next.zoom));
    const maxX = Math.max(0, (g.width * zoom - g.stage.width) / 2);
    const maxY = Math.max(0, (g.height * zoom - g.stage.height) / 2);
    const value = { zoom, x: Math.max(-maxX, Math.min(maxX, next.x)), y: Math.max(-maxY, Math.min(maxY, next.y)) };
    live.current.viewport = value;
    setViewport(value);
  }, []);
  const reset = useCallback(() => { setViewport(initialViewport); setFitWidth(false); setRotation(0); }, []);
  useEffect(() => { reset(); setStatus('loading'); setError(null); }, [uri, retry, reset]);
  useEffect(() => { updateViewport(live.current.viewport); }, [stage.width, stage.height, ratio, rotation, updateViewport]);

  const zoomBy = useCallback((factor: number) => {
    const value = live.current.viewport;
    const zoom = Math.min(8, Math.max(1, value.zoom * factor));
    updateViewport({ zoom, x: value.x * zoom / value.zoom, y: value.y * zoom / value.zoom });
  }, [updateViewport]);
  const navigate = useCallback((delta: number) => setIndex((value) => Math.min(photos.length - 1, Math.max(0, value + delta))), [photos.length]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const key = (event: KeyboardEvent) => {
      if (geminiOpen) { if (event.key === 'Escape') setGeminiOpen(false); return; }
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight') { event.preventDefault(); navigate(1); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); navigate(-1); }
      else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomBy(1.25); }
      else if (event.key === '-') { event.preventDefault(); zoomBy(.8); }
      else if (event.key === '0') reset();
      else if (event.key.toLowerCase() === 'r') { setRotation((value) => (value + 90) % 360); setViewport(initialViewport); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [navigate, onClose, reset, zoomBy, geminiOpen, setGeminiOpen]);

  const gesture = useRef<{ start: Viewport; x: number; y: number; distance: number; moved: boolean } | null>(null);
  const lastTap = useRef(0);
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      const touches = event.nativeEvent.touches, a = touches[0], b = touches[1];
      if (!a) return;
      gesture.current = { start: { ...live.current.viewport }, x: b ? (a.pageX + b.pageX) / 2 : a.pageX, y: b ? (a.pageY + b.pageY) / 2 : a.pageY, distance: b ? Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) : 0, moved: false };
    },
    onPanResponderMove: (event) => {
      const g = gesture.current, touches = event.nativeEvent.touches, a = touches[0], b = touches[1];
      if (!g || !a) return;
      const x = b ? (a.pageX + b.pageX) / 2 : a.pageX, y = b ? (a.pageY + b.pageY) / 2 : a.pageY;
      if (b && !g.distance) { g.start = { ...live.current.viewport }; g.distance = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY); g.x = x; g.y = y; }
      if (!b && g.distance) { g.start = { ...live.current.viewport }; g.distance = 0; g.x = x; g.y = y; }
      const zoom = b && g.distance ? Math.max(1, Math.min(8, g.start.zoom * Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) / g.distance)) : g.start.zoom;
      if (Math.abs(x - g.x) + Math.abs(y - g.y) > 5 || b) g.moved = true;
      updateViewport({ zoom, x: g.start.x * zoom / g.start.zoom + x - g.x, y: g.start.y * zoom / g.start.zoom + y - g.y });
    },
    onPanResponderRelease: () => {
      if (!gesture.current?.moved) {
        const now = Date.now();
        if (now - lastTap.current < 300) { if (live.current.viewport.zoom > 1) updateViewport(initialViewport); else zoomBy(2.5); lastTap.current = 0; }
        else lastTap.current = now;
      }
      gesture.current = null;
    },
    onPanResponderTerminate: () => { gesture.current = null; },
  }), [updateViewport, zoomBy]);

  const runAction = async (kind: 'photo' | 'pdf') => {
    if (actionRef.current) return;
    actionRef.current = true; setAction(kind); setError(null);
    try { if (kind === 'photo') await shareDiaryPhoto(uri); else await shareDiaryPdf(photos); }
    catch (failure: any) { setError(failure?.message || 'Could not save the diary. Please try again.'); }
    finally { actionRef.current = false; setAction(null); }
  };

  return <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: light ? '#E2E8F0' : '#080F1D' }]} accessibilityViewIsModal>
    <View style={styles.header}>
      <View style={{ flex: 1 }}><Text style={styles.title}>Diary photos</Text><Text style={styles.caption}>Page {index + 1} of {photos.length} · {Math.round(viewport.zoom * 100)}%</Text></View>
      <Tool label="Close photo viewer" icon="close" onPress={onClose} />
    </View>
    <ScrollView horizontal style={styles.toolbar} contentContainerStyle={styles.toolbarContent} showsHorizontalScrollIndicator={false}>
      {allowGemini ? <Tool label={t('studentDiary.gemini.button', 'Ask Gemini · Telugu')} icon="sparkles-outline" onPress={() => setGeminiOpen(true)} disabled={!!action || status !== 'ready'} /> : null}
      <Tool label="Zoom out" icon="remove" onPress={() => zoomBy(.8)} disabled={viewport.zoom <= 1} />
      <Tool label="Zoom in" icon="add" onPress={() => zoomBy(1.25)} disabled={viewport.zoom >= 8} />
      <Tool label="Rotate" icon="refresh" onPress={() => { setRotation((value) => (value + 90) % 360); setViewport(initialViewport); }} />
      <Tool label={fitWidth ? 'Fit page' : 'Fit width'} icon="expand" onPress={() => { setFitWidth((value) => !value); setViewport(initialViewport); }} />
      <Tool label="Reset view" icon="scan-outline" onPress={reset} />
      <Tool label={light ? 'Dark background' : 'Light background'} icon={light ? 'moon-outline' : 'sunny-outline'} onPress={() => setLight((value) => !value)} />
      <Tool label={Platform.OS === 'web' ? 'Save photo' : 'Save / share'} icon="download-outline" onPress={() => void runAction('photo')} disabled={!!action || status !== 'ready'} />
      <Tool label="All pages PDF" icon="document-outline" onPress={() => void runAction('pdf')} disabled={!!action || status !== 'ready'} />
    </ScrollView>
    <View style={[styles.stage, Platform.OS === 'web' ? { touchAction: 'none', userSelect: 'none' } as any : null]}
      onLayout={(event) => setStage(event.nativeEvent.layout)} {...responder.panHandlers}
      {...(Platform.OS === 'web' ? { onWheel: (event: any) => { zoomBy(event.deltaY > 0 ? .9 : 1.1); } } : {})}>
      <View pointerEvents="none" style={{ width: imageSize.width * ratio, height: imageSize.height * ratio, transform: [{ translateX: viewport.x }, { translateY: viewport.y }, { scale: viewport.zoom }, { rotate: `${rotation}deg` }] }}>
      <Image key={`${uri}:${retry}`} source={{ uri }} resizeMode="contain" accessibilityLabel={`Diary page ${index + 1}`}
        style={{ width: '100%', height: '100%' }}
        onLoad={imageLoaded}
        onError={imageFailed} />
      </View>
      {status === 'loading' ? <View pointerEvents="none" style={styles.status}><ActivityIndicator color="#67E8F9" /><Text style={styles.statusText}>Loading photo…</Text></View> : null}
      {status === 'error' ? <View style={styles.status}><Text style={styles.statusText}>Photo unavailable. Check your connection and retry.</Text><Tool label="Retry photo" icon="reload" onPress={() => setRetry((value) => value + 1)} /></View> : null}
    </View>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {action ? <View style={styles.action}><ActivityIndicator color="#67E8F9" /><Text style={styles.caption}>Preparing {action === 'pdf' ? 'all pages PDF' : 'photo'}…</Text></View> : null}
    <Text style={[styles.help, light && { color: '#334155' }]}>Pinch or scroll to zoom · drag to pan · double tap to zoom</Text>
    {photos.length > 1 ? <>
      <ScrollView horizontal style={styles.thumbnails} contentContainerStyle={styles.thumbnailContent} showsHorizontalScrollIndicator={false}>
        {photos.map((photo, photoIndex) => <Pressable key={`${photoIndex}:${photo}`} accessibilityRole="button" accessibilityLabel={`View page ${photoIndex + 1}`} accessibilityState={{ selected: photoIndex === index }} onPress={() => setIndex(photoIndex)} style={[styles.thumb, photoIndex === index && styles.selectedThumb]}>
          <Image source={{ uri: photo }} style={styles.thumbImage} resizeMode="contain" /><Text style={styles.thumbNumber}>{photoIndex + 1}</Text>
        </Pressable>)}
      </ScrollView>
      <View style={styles.navigation}><Tool label="Previous page" icon="chevron-back" onPress={() => navigate(-1)} disabled={index === 0} /><Text style={styles.caption}>{index + 1} / {photos.length}</Text><Tool label="Next page" icon="chevron-forward" onPress={() => navigate(1)} disabled={index === photos.length - 1} /></View>
    </> : null}
    {allowGemini && geminiOpen ? <DiaryGeminiHelp uri={uri} onClose={() => setGeminiOpen(false)} /> : null}
  </View>;
}

function Tool({ label, icon, onPress, disabled }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.tool, disabled && { opacity: .35 }, pressed && { backgroundColor: '#334155' }]}><Ionicons name={icon} size={21} color="#F8FAFC" /><Text style={styles.toolLabel}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#162237' },
  title: { color: '#F8FAFC', fontSize: 18, fontWeight: '700' },
  caption: { color: '#CBD5E1', fontSize: 12, marginTop: 3 },
  toolbar: { flexGrow: 0, flexShrink: 0, backgroundColor: '#162237', maxHeight: 76 },
  toolbarContent: { paddingHorizontal: 8, paddingBottom: 8, gap: 4 },
  tool: { minHeight: 48, minWidth: 48, paddingVertical: 6, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 10, gap: 4 },
  toolLabel: { color: '#F8FAFC', fontSize: 10, fontWeight: '600' },
  stage: { flex: 1, minHeight: 80, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  status: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#080F1DEE', padding: 24, gap: 12 },
  statusText: { color: '#F8FAFC', fontSize: 14, textAlign: 'center' },
  help: { color: '#94A3B8', textAlign: 'center', fontSize: 11, padding: 8 },
  thumbnails: { flexGrow: 0, flexShrink: 0, maxHeight: 76, backgroundColor: '#162237' },
  thumbnailContent: { gap: 8, paddingHorizontal: 12, paddingVertical: 6 },
  thumb: { width: 48, height: 62, borderRadius: 8, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden', backgroundColor: '#334155' },
  selectedThumb: { borderColor: '#67E8F9' },
  thumbImage: { width: '100%', height: '100%' },
  thumbNumber: { position: 'absolute', right: 0, bottom: 0, color: '#FFF', backgroundColor: '#0F172A', fontSize: 10, paddingHorizontal: 4 },
  navigation: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#162237', paddingHorizontal: 12 },
  error: { padding: 12, backgroundColor: '#7F1D1D', color: '#FFF', fontSize: 13 },
  action: { flexDirection: 'row', gap: 10, padding: 10, justifyContent: 'center', backgroundColor: '#162237' },
});
