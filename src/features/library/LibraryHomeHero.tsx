import React from 'react';
import { useRouter } from 'expo-router';
import StaffHero from '../../components/staff-hero/StaffHero';
import { useAuth } from '../../hooks/useAuth';
import { usePersistedSWR } from '../../hooks/usePersistedSWR';
import { SCHOOL_CONFIG } from '../../constants/schoolConfig';
import { schoolHeroSlidesService } from '../../services/schoolHeroSlidesService';
import { schoolStoriesService } from '../../services/schoolStoriesService';

export default function LibraryHomeHero() {
  const { user } = useAuth();
  const router = useRouter();
  const { data: slides } = usePersistedSWR({
    cacheKey: 'library-hero-slides', userId: user?.userId, ttlMs: 120_000,
    enabled: !!user, fetcher: () => schoolHeroSlidesService.listActive(),
  });
  const { data: stories } = usePersistedSWR({
    cacheKey: 'library-school-stories', userId: user?.userId, ttlMs: 120_000,
    enabled: !!user, fetcher: () => schoolStoriesService.list(),
  });
  const notifications = () => router.push('/notifications');
  return <StaffHero
    firstName={user?.displayName?.split(' ')[0] || 'Librarian'}
    roleLine="Librarian"
    chipLabel={SCHOOL_CONFIG.name}
    photoUrl={user?.photoUrl}
    welcomeText="Where Every Reader Finds Their Next Chapter"
    slides={slides ?? []}
    stories={stories ?? []}
    onReviewLeaves={notifications}
    onViewUpdates={notifications}
    onViewNotifications={notifications}
  />;
}
