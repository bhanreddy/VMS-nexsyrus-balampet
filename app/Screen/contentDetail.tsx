import React, {  } from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import ScreenLayout from '../../src/components/ScreenLayout';
import StudentHeader from '../../src/components/StudentHeader';
import { useTranslation } from 'react-i18next';
import { t_field } from '../../src/utils/lang';
import { useTheme } from '../../src/hooks/useTheme';

// Fallback if markdown package not present, but using it as per standard modern stack
// If not installed, I will change to simple Text in next step or user can install.
// Given strict instructions "not to add packages", I will check if it's there. 
// If not, I'll write a simple regex parser or just Text.

export default function ContentDetailScreen() {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(), []);
  const params = useLocalSearchParams();

  const { i18n } = useTranslation();

  // We expect params: { title, content, image } or fetch by ID if needed.
  // For now, let's assume we pass the data or fetch it.
  // Simpler for this iteration: Pass data via params/navigation state or fetch by ID.
  // Fetching by ID is safer for large content.
  const {
    title,
    title_te,
    content_body,
    content_te,
    image_url,
    headerColor
  } = params as any;

  return <ScreenLayout>
    <StudentHeader showBackButton={true} title={t_field(title as string, title_te as string) || 'Module'} />
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

      {!!image_url && <Image source={{
        uri: image_url
      }} style={styles.bannerImage} resizeMode="cover" />}

      <View style={styles.contentContainer}>
        <Text style={[styles.title, {
          color: headerColor || '#333'
        }]}>{t_field(title as string, title_te as string)}</Text>

        {content_body ? <View style={styles.body}>
          {/* Simple text rendering if markdown not available, or use Markdown component if confirmed */}
          <Text style={styles.text}>{t_field(content_body as string, content_te as string)}</Text>
        </View> : <Text style={styles.emptyText}>No content available.</Text>}
      </View>
    </ScrollView>
  </ScreenLayout>;
}
const getStyles = () => StyleSheet.create({
  container: {
    paddingBottom: 40
  },
  bannerImage: {
    width: '100%',
    height: 200,
    borderRadius: 0
  },
  contentContainer: {
    padding: 20
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16
  },
  body: {
    marginTop: 8
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    color: '#374151'
  },
  emptyText: {
    fontStyle: 'italic',
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 20
  }
});