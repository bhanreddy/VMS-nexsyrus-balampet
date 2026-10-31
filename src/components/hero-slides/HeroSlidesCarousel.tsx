import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getMediaUrl } from '../../utils/media';
import type { HeroSlideItem } from '../../services/schoolHeroSlidesService';
import type { CelebrationSlideItem, CelebrationPerson } from '../../services/celebrationTypes';
import CelebrationSlideCard from './CelebrationSlideCard';
import BirthdayStarsModal from './BirthdayStarsModal';
import { useCelebrationAudio } from '../../hooks/useCelebrationAudio';
import { filterActiveHeroSlides } from '../../features/hero-slides/celebrationSlides';

interface HeroSlidesCarouselProps {
  slides: Array<HeroSlideItem | CelebrationSlideItem>;
  /** Dot contrast for the surface behind the carousel. */
  dotTone?: 'onDark' | 'onLight';
  /** Active pager dot. Defaults to the shared gold used by other heroes. */
  activeDotColor?: string;
  style?: StyleProp<ViewStyle>;
}

export default function HeroSlidesCarousel({
  slides,
  dotTone = 'onDark',
  activeDotColor = '#FACC15',
  style,
}: HeroSlidesCarouselProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalStars, setModalStars] = useState<CelebrationPerson[]>([]);
  const indexRef = useRef(0);
  const slideWidth = Math.max(width, 1);

  const activeSlides = useMemo(
    () => filterActiveHeroSlides(slides as CelebrationSlideItem[]),
    [slides],
  );

  // Audio Playback: triggers short celebratory jingle once per user per day (Steps 15, 16, 17)
  useCelebrationAudio(activeSlides);

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!slideWidth) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
    indexRef.current = next;
    setIndex(next);
  };

  useEffect(() => {
    if (activeSlides.length < 2 || !slideWidth) return;
    const timer = setInterval(() => {
      const next = (indexRef.current + 1) % activeSlides.length;
      indexRef.current = next;
      setIndex(next);
      scrollRef.current?.scrollTo({ x: next * slideWidth, animated: true });
    }, 4500);
    return () => clearInterval(timer);
  }, [activeSlides.length, slideWidth]);

  if (activeSlides.length === 0) return null;

  const handleOpenGroupModal = (slide: CelebrationSlideItem) => {
    if (slide.stars && slide.stars.length > 0) {
      setModalStars(slide.stars);
      setModalVisible(true);
    }
  };

  return (
    <View style={style} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        nestedScrollEnabled
        decelerationRate="fast"
        snapToInterval={slideWidth || undefined}
        snapToAlignment="start"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        scrollEventThrottle={16}
      >
        {activeSlides.map((slide) => {
          if (slide.slide_type === 'CELEBRATION') {
            return (
              <CelebrationSlideCard
                key={slide.id}
                slide={slide}
                width={width || undefined}
                onOpenGroupModal={handleOpenGroupModal}
              />
            );
          }

          const uri = slide.image_url ? getMediaUrl(slide.image_url) : null;
          return (
            <View key={slide.id} style={[styles.slideCard, width ? { width } : null]}>
              {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
              {(slide.title || slide.caption) ? (
                <LinearGradient colors={['transparent', 'rgba(8,15,40,0.72)']} style={styles.slideShade}>
                  {!!slide.title && <Text style={styles.slideTitle}>{slide.title}</Text>}
                  {!!slide.caption && <Text style={styles.slideCaption}>{slide.caption}</Text>}
                </LinearGradient>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
      {activeSlides.length > 1 ? (
        <View style={styles.dots}>
          {activeSlides.map((slide, dotIndex) => (
            <View
              key={slide.id}
              style={[
                styles.dot,
                dotTone === 'onLight' ? styles.dotOnLight : styles.dotOnDark,
                dotIndex === index && styles.dotActive,
                dotIndex === index && { backgroundColor: activeDotColor },
              ]}
            />
          ))}
        </View>
      ) : null}

      {/* Birthday Stars Modal for Multiple Birthdays */}
      <BirthdayStarsModal
        visible={modalVisible}
        stars={modalStars}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  slideCard: {
    height: 148,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    justifyContent: 'flex-end',
  },
  slideShade: { paddingHorizontal: 14, paddingVertical: 12 },
  slideTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  slideCaption: { color: 'rgba(255,255,255,0.86)', fontSize: 12, fontWeight: '600', marginTop: 2 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotOnDark: { backgroundColor: 'rgba(255,255,255,0.28)' },
  dotOnLight: { backgroundColor: 'rgba(15,23,42,0.22)' },
  dotActive: { width: 16, backgroundColor: '#FACC15' },
});
