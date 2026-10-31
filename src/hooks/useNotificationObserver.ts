import { useCallback, useEffect, useRef } from 'react';
import { getApp } from '@react-native-firebase/app';
import { getMessaging, getInitialNotification, onNotificationOpenedApp } from '@react-native-firebase/messaging';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from './useAuth';
import { notificationInboxService } from '../services/notificationInboxService';
import {
  pushNotificationRoute,
  resolveNotificationRoute,
} from '../utils/notificationRoutes';

export { resolveNotificationRoute } from '../utils/notificationRoutes';

interface PendingNotification {
  data: Record<string, any>;
}

// Stored when notification tapped before auth is ready.
let pendingNotification: PendingNotification | null = null;

function payloadFromUnknown(input: unknown): Record<string, any> {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, any>;
  }
  return {};
}

function resolveRecipientUserId(data: Record<string, any> | null | undefined): string | null {
  if (!data) return null;
  // `recipientUserId` is emitted by the current backend. Only use explicit
  // recipient fields: a generic `user_id` in an older notification can refer
  // to a sender or another entity, not the account that received the alert.
  const value = data.recipientUserId || data.recipient_user_id;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function roleCodeFromUser(user: { role?: unknown } | null | undefined): string | null {
  const role = user?.role;
  if (typeof role === 'string') return role;
  if (role && typeof role === 'object' && 'code' in role) {
    const code = (role as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}

export function useNotificationObserver() {
  const router = useRouter();
  const { user, loading, switchAccount } = useAuth();
  const authRef = useRef({ user, loading, switchAccount });
  const navigatingRef = useRef(false);
  const lastOpenedRef = useRef<{ key: string; at: number } | null>(null);

  // Native listeners read the latest identity without being re-registered.
  authRef.current = { user, loading, switchAccount };

  const drainPending = useCallback(async () => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    try {
      while (pendingNotification && authRef.current.user && !authRef.current.loading) {
        const { data } = pendingNotification;
        pendingNotification = null;
        const recipientUserId = resolveRecipientUserId(data);
        const notificationId = String(data.notificationId || '') || null;
        const notificationKey = notificationId
          ? `${recipientUserId || authRef.current.user.userId}:${notificationId}`
          : null;
        // FCM and Expo can both deliver the same tap. Do not switch/open twice.
        if (notificationKey && notificationKey === lastOpenedRef.current?.key &&
            Date.now() - lastOpenedRef.current.at < 2000) continue;

        try {
          let recipient = authRef.current.user;
          if (recipientUserId && recipientUserId !== recipient.userId) {
            const result = await authRef.current.switchAccount(recipientUserId);
            if (result.error || result.session?.validatedUser?.userId !== recipientUserId) {
              console.warn('[Notifications] Could not switch to notification recipient:', result.error || 'recipient session unavailable');
              continue;
            }
            recipient = result.session.validatedUser;
            // React may not have rendered yet. Use the committed identity for
            // this route and any tap queued during the switch.
            authRef.current = { ...authRef.current, user: recipient };
          }

          // A newer tap supersedes this destination. Drain it immediately,
          // including when a failed switch did not trigger a React render.
          if (pendingNotification) continue;
          const resolved = resolveNotificationRoute(data, roleCodeFromUser(recipient));
          pushNotificationRoute(router, resolved);
          lastOpenedRef.current = notificationKey ? { key: notificationKey, at: Date.now() } : null;
          if (notificationId) {
            void notificationInboxService.markRead(notificationId).catch(() => {});
          }
        } catch (err) {
          console.log('[Notifications] Navigation error:', err);
        }
      }
    } finally {
      navigatingRef.current = false;
    }
  }, [router]);

  const navigate = useCallback((raw: Record<string, any> | null | undefined) => {
    pendingNotification = { data: payloadFromUnknown(raw) };
    void drainPending();
  }, [drainPending]);

  // NavigationReady mounts after the root navigator. Auth readiness, rather
  // than a fixed timer, determines when a cold-start tap can be opened.
  useEffect(() => {
    if (user && !loading) void drainPending();
  }, [user, loading, drainPending]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let isMounted = true;
    const app = getApp();
    const msg = getMessaging(app);

    // CASE 1 — App KILLED, user tapped FCM notification
    getInitialNotification(msg).then((remoteMessage) => {
      if (!remoteMessage || !isMounted) return;
      navigate(payloadFromUnknown(remoteMessage.data));
    });

    // CASE 2 — App BACKGROUNDED, user tapped FCM notification
    const unsubFCM = onNotificationOpenedApp(msg, (remoteMessage) => {
      void navigate(payloadFromUnknown(remoteMessage.data));
    });

    // CASE 3 — User tapped expo-notifications notification (all states)
    const unsubExpo = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        void navigate(payloadFromUnknown(response.notification.request.content.data));
      }
    );

    // CASE 4 — App KILLED, user tapped expo-notifications notification
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response || !isMounted) return;
      void navigate(payloadFromUnknown(response.notification.request.content.data));
    });

    return () => {
      isMounted = false;
      unsubFCM();
      unsubExpo.remove();
    };
  }, [navigate]);
}
