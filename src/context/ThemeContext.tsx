import React, { createContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { LayoutAnimation, Platform, UIManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabaseConfig';
import { schoolTheme } from '../constants/schoolConfig';
import type { SchoolTheme } from '../theme/types';

interface ThemeContextProps {
  theme: SchoolTheme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (mode: 'light' | 'dark') => void;
}

export const ThemeContext = createContext<ThemeContextProps>({
  theme: schoolTheme.light,
  isDark: false,
  toggleTheme: () => {},
  setTheme: () => {}
});

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const ThemeProvider = ({ children }: {children: ReactNode;}) => {
  const { user } = useAuth();
  const [isDark, setIsDark] = useState<boolean>(false);

  const theme = useMemo(() => isDark ? schoolTheme.dark : schoolTheme.light, [isDark]);

  // Load local preference on mount
  useEffect(() => {
    let mounted = true;
    const loadLocalTheme = async () => {
      try {
        const storedTheme = await AsyncStorage.getItem('app_theme');
        if (mounted && storedTheme) {
          setIsDark(storedTheme === 'dark');
        }
      } catch {
        // Keep the default theme; a preference read must not block startup.
      }
    };
    loadLocalTheme();
    return () => { mounted = false; };
  }, []);

  // Sync with Supabase when user logs in
  useEffect(() => {
    if (!user) return;

    const syncWithBackend = async () => {
      try {
        // Fetch user's theme preference
        const { data } = await supabase.
        from('users').
        select('theme').
        eq('id', user.userId) // Assuming user.userId is the UUID in users table
        .single();

        if (data && data.theme) {
          const backendIsDark = data.theme === 'dark';
          if (backendIsDark !== isDark) {
            setIsDark(backendIsDark);
            await AsyncStorage.setItem('app_theme', data.theme);
          }
        }
      } catch (error) {

      }
    };

    syncWithBackend();
  }, [user]);

  const setTheme = async (mode: 'light' | 'dark') => {
    const newIsDark = mode === 'dark';

    // Add smooth animation when theme changes
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    setIsDark(newIsDark);
    try {
      await AsyncStorage.setItem('app_theme', mode);
      if (user) {
        await supabase.
        from('users').
        update({ theme: mode }).
        eq('id', user.userId);
      }
    } catch (error) {

    }
  };

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>);

};
