import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { LayoutAnimation, Platform, UIManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabaseConfig'; // Assuming you have a supabase client export
import { lightTheme, darkTheme, Theme } from '../theme/themes';

interface ThemeContextProps {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (mode: 'light' | 'dark') => void;
}

export const ThemeContext = createContext<ThemeContextProps>({
  theme: lightTheme,
  isDark: false,
  toggleTheme: () => {},
  setTheme: () => {}
});
// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const ThemeProvider = ({ children }: {children: ReactNode;}) => {
  const { user } = useAuth();
  const [isDark, setIsDark] = useState<boolean>(false);
  const [loaded, setLoaded] = useState(false);

  const theme = isDark ? darkTheme : lightTheme;

  // Load local preference on mount
  useEffect(() => {
    const loadLocalTheme = async () => {
      try {
        const storedTheme = await AsyncStorage.getItem('app_theme');
        if (storedTheme) {
          setIsDark(storedTheme === 'dark');
        }
      } catch (e) {

      } finally {
        setLoaded(true);
      }
    };
    loadLocalTheme();
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
        eq('id', user.id) // Assuming user.id is the UUID in users table
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
        eq('id', user.id);
      }
    } catch (error) {

    }
  };

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  if (!loaded) {
    return null; // Or a splash screen
  }

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>);

};