import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

/** Uses native views and system fonts so it can render before assets load. */
export default function AppStartupScreen({
  backgroundColor = '#FFFFFF',
  color = '#3535A8',
  onLayout,
}: {
  backgroundColor?: string;
  color?: string;
  onLayout?: () => void;
}) {
  return (
    <View style={[styles.container, { backgroundColor }]} onLayout={onLayout}>
      <ActivityIndicator size="large" color={color} accessibilityLabel="Opening app" />
      <Text style={[styles.message, { color }]}>Opening your school app…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  message: { marginTop: 16, fontSize: 16, textAlign: 'center' },
});
