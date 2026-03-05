import { useEffect, useState } from 'react';
import { notificationManager } from '../services/notificationManager';
import { useAuth } from './useAuth';

export const useNotifications = () => {
  const { user } = useAuth();
  const [token, setToken] = useState<string | undefined>();

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        // If user is logged in, we must register/sync the token with the backend
        if (user) {
          const t = await notificationManager.registerForPushNotificationsAsync();
          if (isMounted) setToken(t);
          notificationManager.setupListeners();
        }
      } catch (error) {

      }
    };

    if (user) {
      init();
    }

    return () => {
      isMounted = false;
      // Only cleanup listeners on unmount, not on every user change to avoid flicker
      // actually setupListeners is idempotent safe usually
      notificationManager.cleanupListeners();
    };
  }, [user]); // Re-run when user changes (Login/Logout/Role Switch)

  return { token };
};