import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth } from '../src/hooks/useAuth';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/hooks/useTheme';
import { Theme } from '../src/theme/themes';
export default function NoProfileScreen() {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const {
    logout,
    user
  } = useAuth();
  return <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Ionicons name="alert-circle" size={80} color="#EF4444" />
                <Text style={styles.title}>Profile Not Found</Text>
                <Text style={styles.message}>
                    You are logged in as <Text style={{
          fontWeight: 'bold'
        }}>{user?.email}</Text>,
                    but no matching {user?.role} profile was found for your account.
                </Text>
                <Text style={styles.subMessage}>
                    Please contact the school administrator to verify your account setup.
                </Text>

                <TouchableOpacity style={styles.button} onPress={logout}>
                    <Text style={styles.buttonText}>Logout</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>;
}
const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    padding: 24
  },
  content: {
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: 32,
    borderRadius: 24,
    shadowColor: theme.colors.text,
    shadowOffset: {
      width: 0,
      height: 4
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 12
  },
  message: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8
  },
  subMessage: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32
  },
  button: {
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center'
  },
  buttonText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: '600'
  }
});