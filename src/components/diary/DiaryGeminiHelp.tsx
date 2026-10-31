import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import AppTextInput from '../AppTextInput';
import { askGeminiWithDiaryPhoto, copyDiaryGeminiQuestion, DIARY_TELUGU_PROMPT, GEMINI_PLAY_STORE, openGeminiWebsite } from '../../services/diaryGeminiService';
import { shareDiaryPhoto } from './document/diaryPhotoFiles';

export default function DiaryGeminiHelp({ uri, onClose }: { uri: string; onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const label = (key: string) => t(`studentDiary.gemini.${key}`);
  const [prompt, setPrompt] = useState(DIARY_TELUGU_PROMPT);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(true);
  const running = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; controller.current?.abort(); };
  }, []);
  const run = async (operation: () => Promise<string | void>) => {
    if (running.current) return;
    running.current = true; setBusy(true); setError(null); setMessage(null);
    try { const result = await operation(); if (active.current && result) setMessage(result); }
    catch { if (active.current) setError(label('failed')); }
    finally { running.current = false; if (active.current) setBusy(false); }
  };
  const openWithPhoto = () => run(async () => {
    controller.current = new AbortController();
    const result = await askGeminiWithDiaryPhoto(uri, prompt, controller.current.signal);
    return label(result === 'opened' ? 'opened' : result === 'share-menu' ? 'shared' : 'manual');
  });
  const close = () => { controller.current?.abort(); onClose(); };
  return <KeyboardAvoidingView style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.panel}>
      <View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.title}>{label('title')}</Text><Text style={styles.subtitle}>{label('subtitle')}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={label('close')} onPress={close} style={styles.close}><Text style={styles.closeText}>✕</Text></Pressable></View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Image source={{ uri }} style={styles.photo} resizeMode="contain" accessibilityLabel={t('studentDiary.openPhoto')} />
        <Text style={styles.notice}>{label('notice')}</Text>
        <Text style={styles.instructions}>{label(Platform.OS === 'web' ? 'webSteps' : 'mobileSteps')}</Text>
        <Text style={styles.questionLabel}>{label('question')}</Text>
        <AppTextInput accessibilityLabel={label('question')} value={prompt} onChangeText={setPrompt} editable={!busy} multiline maxLength={4000} style={styles.input} textAlignVertical="top" />
        {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {busy ? <View style={styles.busy}><ActivityIndicator color="#67E8F9" /><Text style={styles.instructions}>{label('preparing')}</Text></View> : null}
        <View style={styles.row}>
          <Action text={label('copy')} disabled={busy || !prompt.trim()} onPress={() => void run(async () => { await copyDiaryGeminiQuestion(prompt); return label('copied'); })} />
          <Action text={label('save')} disabled={busy} onPress={() => void run(() => shareDiaryPhoto(uri))} />
        </View>
        {Platform.OS !== 'web' ? <Action primary text={label('open')} disabled={busy || !prompt.trim()} onPress={() => void openWithPhoto()} /> : null}
        <Action primary={Platform.OS === 'web'} text={label('website')} disabled={busy} onPress={() => void run(async () => { await openGeminiWebsite(); })} />
        {Platform.OS === 'android' ? <Action text={label('install')} disabled={busy} onPress={() => void run(async () => { await Linking.openURL(GEMINI_PLAY_STORE); })} /> : null}
      </ScrollView>
    </View>
  </KeyboardAvoidingView>;
}

function Action({ text, onPress, disabled, primary }: { text: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={text} onPress={onPress} disabled={disabled} style={[styles.button, primary && styles.primary, disabled && { opacity: .4 }]}><Text style={styles.buttonText}>{text}</Text></Pressable>;
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 20, backgroundColor: '#080F1D', alignItems: 'center' },
  panel: { flex: 1, width: '100%', maxWidth: 640 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomColor: '#334155', borderBottomWidth: 1 },
  title: { color: '#F8FAFC', fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#67E8F9', fontSize: 13, marginTop: 4 },
  close: { minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'center' },
  closeText: { color: '#F8FAFC', fontSize: 24 },
  body: { padding: 16, gap: 12 },
  photo: { width: '100%', height: 140, backgroundColor: '#162237', borderRadius: 12 },
  notice: { color: '#F8FAFC', fontSize: 14, lineHeight: 21 },
  instructions: { color: '#CBD5E1', fontSize: 13, lineHeight: 21 },
  questionLabel: { color: '#F8FAFC', fontWeight: '700', fontSize: 14 },
  input: { color: '#F8FAFC', backgroundColor: '#162237', borderColor: '#475569', borderWidth: 1, borderRadius: 12, minHeight: 170, maxHeight: 250, padding: 12, fontSize: 14, lineHeight: 24 },
  row: { flexDirection: 'row', gap: 8 },
  button: { flexGrow: 1, flexShrink: 1, minHeight: 48, justifyContent: 'center', alignItems: 'center', borderColor: '#475569', borderWidth: 1, borderRadius: 12, padding: 12, backgroundColor: '#243147' },
  primary: { backgroundColor: '#4F46E5', borderColor: '#818CF8' },
  buttonText: { color: '#F8FAFC', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  message: { color: '#86EFAC', fontSize: 13, lineHeight: 21 },
  error: { color: '#FDA4AF', fontSize: 13 },
  busy: { flexDirection: 'row', gap: 10, alignItems: 'center' },
});
