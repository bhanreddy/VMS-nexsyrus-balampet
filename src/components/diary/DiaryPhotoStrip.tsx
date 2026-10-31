import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import DiaryPhotoViewer from './DiaryPhotoViewer';
import { isPhotoFallbackContent, normalizeDiaryAttachments } from '../../utils/smartDiary/attachments';

export function diaryPhotoUrls(attachments: unknown): string[] {
  return normalizeDiaryAttachments(attachments);
}

export function isPhotoOnlyDiary(content?: string | null, attachments?: unknown): boolean {
  return diaryPhotoUrls(attachments).length > 0 && isPhotoFallbackContent(content);
}

export function diarySourceLabel(source?: string | null, hasPhoto = false): string | null {
  const value = String(source || '').toUpperCase();
  if (value === 'PHOTO' || (hasPhoto && !value)) return 'Photo';
  if (value === 'VOICE') return 'Voice';
  if (value === 'CLASS_DIARY_AI') return 'Class diary';
  if (value === 'TEMPLATE') return 'Template';
  if (value === 'REUSED' || value === 'COPIED') return 'Reused';
  if (hasPhoto) return 'Photo';
  return null;
}

export function DiaryPhotoStrip({
  attachments,
  hintColor,
}: {
  attachments?: unknown;
  hintColor?: string;
}) {
  const photos = diaryPhotoUrls(attachments);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  if (photos.length === 0) return null;

  return (
    <View>
      <View style={styles.row}>
        {photos.map((src, index) => (
          <Pressable key={`${index}:${src}`} accessibilityRole="button" accessibilityLabel={`View diary page ${index + 1}`} onPress={() => setViewerIndex(index)} style={styles.thumbWrap}>
            <Image source={{ uri: src }} style={styles.thumb} resizeMode="cover" />
          </Pressable>
        ))}
      </View>
      <Text style={[styles.hint, hintColor ? { color: hintColor } : null]}>{photos.length > 1 ? `${photos.length} diary pages · tap to view` : 'Diary photo · tap to view'}</Text>
      {viewerIndex !== null ? <DiaryPhotoViewer photos={photos} initialIndex={viewerIndex} onClose={() => setViewerIndex(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginTop: 12, gap: 8 },
  thumbWrap: { width: '100%' },
  thumb: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    backgroundColor: 'rgba(15,23,42,0.06)',
  },
  hint: { marginTop: 6, fontSize: 11, fontWeight: '700' },

});
