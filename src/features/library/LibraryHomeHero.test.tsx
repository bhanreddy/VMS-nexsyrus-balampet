/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import LibraryHomeHero from './LibraryHomeHero';
import StaffHero from '../../components/staff-hero/StaffHero';
const { create, act } = require('react-test-renderer');
const mockPush = jest.fn();
const mockSlides = [{ id: 'school-slide' }];
const mockStories = [{ author_id: 'school-author' }];
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../../components/staff-hero/StaffHero', () => ({ __esModule: true, default: () => null }));
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'librarian-1', displayName: 'Anita Rao', photoUrl: 'photo' } }) }));
jest.mock('../../hooks/usePersistedSWR', () => ({ usePersistedSWR: ({ cacheKey }: any) => ({ data: cacheKey.includes('hero-slides') ? mockSlides : mockStories }) }));
jest.mock('../../services/schoolHeroSlidesService', () => ({ schoolHeroSlidesService: {} }));
jest.mock('../../services/schoolStoriesService', () => ({ schoolStoriesService: {} }));
it('reuses the staff hero with librarian identity, school media and shared notifications', () => {
  let tree: any;
  act(() => { tree = create(<LibraryHomeHero />); });
  const props = tree.root.findByType(StaffHero).props;
  expect(props.firstName).toBe('Anita');
  expect(props.roleLine).toBe('Librarian');
  expect(props.slides).toBe(mockSlides);
  expect(props.stories).toBe(mockStories);
  expect(props.canAddStories).toBeUndefined();
  props.onViewNotifications();
  expect(mockPush).toHaveBeenCalledWith('/notifications');
  act(() => tree.unmount());
});
