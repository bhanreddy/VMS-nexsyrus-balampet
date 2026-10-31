import React, { useCallback, useMemo, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from '../../utils/haptics';
import { alertCompat } from '../../utils/crossPlatformAlert';
import { getMediaUrl } from '../../utils/media';
import type { SchoolStoryAuthor } from '../../services/schoolStoriesService';
import StoryViewerModal from '../student-hero/StoryViewerModal';
import AddStoryComposer from './AddStoryComposer';

const RING = '#F5C518';

interface SchoolStoriesStripProps {
  stories: SchoolStoryAuthor[];
  canAdd?: boolean;
  addPhotoUrl?: string | null;
  tone?: 'onDark' | 'onLight';
  /** Unseen-story ring. Defaults to the shared gold used by other heroes. */
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
  onStoryViewed?: (storyId: string) => void;
  onPublished?: () => void | Promise<void>;
}

export default function SchoolStoriesStrip({
  stories,
  canAdd = false,
  addPhotoUrl,
  tone = 'onDark',
  accentColor = RING,
  style,
  onStoryViewed,
  onPublished,
}: SchoolStoriesStripProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerAuthor, setViewerAuthor] = useState(0);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const authors = useMemo(
    () => stories.map((author) => ({
      ...author,
      stories: author.stories.map((story) => (
        seenIds.has(story.id) ? { ...story, seen: true } : story
      )),
      has_unseen: author.stories.some((story) => !story.seen && !seenIds.has(story.id)),
    })),
    [stories, seenIds],
  );

  const seenRing = tone === 'onLight' ? 'rgba(15,23,42,0.22)' : 'rgba(255,255,255,0.35)';
  const addFill = tone === 'onLight' ? '#EEF2FF' : 'rgba(255,255,255,0.12)';
  const addIcon = tone === 'onLight' ? '#1E3A8A' : '#FFFFFF';
  const addLabel = tone === 'onLight' ? '#334155' : 'rgba(255,255,255,0.82)';
  const addPhoto = getMediaUrl(addPhotoUrl);

  const openStory = (index: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setViewerAuthor(index);
    setViewerOpen(true);
  };

  const choosePhoto = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        alertCompat('Photos permission needed', 'Allow photo library access to post a school story.');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.92,
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets?.[0]) setPicked(result.assets[0]);
  }, []);

  if (!canAdd && authors.length === 0) return null;

  return (
    <View style={style}>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {canAdd ? (
          <Pressable
            onPress={() => void choosePhoto()}
            style={styles.item}
            accessibilityRole="button"
            accessibilityLabel="Add school story"
          >
            <View style={[styles.ring, { borderColor: accentColor }]}>
              {addPhoto ? (
                <Image source={{ uri: addPhoto }} style={styles.avatar} />
              ) : (
                <View style={[styles.fallback, { backgroundColor: addFill }]}>
                  <Ionicons name="add" size={28} color={addIcon} />
                </View>
              )}
              <View style={styles.addBadge}>
                <Ionicons name="add" size={12} color="#FFFFFF" />
              </View>
            </View>
            <Text style={[styles.addText, { color: addLabel }]}>Add</Text>
          </Pressable>
        ) : null}

        {authors.map((author, index) => {
          const avatar = getMediaUrl(author.author_photo_url);
          return (
            <Pressable
              key={`${author.author_id || 'author'}-${index}`}
              onPress={() => openStory(index)}
              style={styles.item}
              accessibilityRole="button"
              accessibilityLabel={`${author.author_name} school story`}
            >
              <View style={[styles.ring, { borderColor: author.has_unseen ? accentColor : seenRing }]}>
                {avatar ? (
                  <Image source={{ uri: avatar }} style={styles.avatar} />
                ) : (
                  <View style={styles.fallback}>
                    <Text style={styles.fallbackText}>{(author.author_name || 'S').slice(0, 1)}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <StoryViewerModal
        visible={viewerOpen}
        authors={authors}
        startAuthorIndex={viewerAuthor}
        onClose={() => setViewerOpen(false)}
        onViewed={(id) => {
          setSeenIds((current) => {
            const next = new Set(current);
            next.add(id);
            return next;
          });
          onStoryViewed?.(id);
        }}
      />

      <AddStoryComposer
        visible={!!picked}
        photo={picked}
        onClose={() => setPicked(null)}
        onPublished={async () => {
          setPicked(null);
          await onPublished?.();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingTop: 4, paddingRight: 8, gap: 12, alignItems: 'flex-start' },
  item: { alignItems: 'center', width: 68 },
  ring: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { width: '100%', height: '100%', borderRadius: 99 },
  fallback: {
    width: '100%',
    height: '100%',
    borderRadius: 99,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: { color: '#FFF', fontWeight: '800', fontSize: 18 },
  addBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { marginTop: 6, fontSize: 11, fontWeight: '700' },
});
