import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Linking, StatusBar, TextInput, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import StudentHeader from '../../src/components/StudentHeader';
import { api } from '../../src/services/apiClient';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';
interface LMSMaterial {
  id: string;
  title: string; // subTopic
  description: string;
  content_url: string; // videoUrl
  duration: string;
  material_type: string;
  created_at: string;
  course_title: string; // topic
  class_name: string;
  teacher_name: string;
}
export default function LMSPage() {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [materials, setMaterials] = useState<LMSMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const SUBJECTS = ['All', 'Mathematics', 'Science', 'English', 'Social Science', 'Hindi', 'Telugu', 'Physics', 'Biology'];
  useEffect(() => {
    fetchLMSFeed();
  }, []);
  const fetchLMSFeed = async () => {
    try {
      setLoading(true);
      // Fetch flattened feed of materials (latest first)
      const data: any[] = await api.get('/lms/all-materials');

      // Map to UI model
      const mapped: LMSMaterial[] = data.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        content_url: m.content_url,
        duration: m.duration,
        material_type: m.material_type,
        created_at: new Date(m.created_at).toLocaleDateString(),
        course_title: m.course_title,
        class_name: m.class_name || 'Class',
        teacher_name: m.instructor_name || 'Teacher'
      }));
      setMaterials(mapped);
    } catch (error) {

    } finally {
      setLoading(false);
    }
  };
  const filteredContent = materials.filter((item) => {
    const matchesSearch = item.course_title.toLowerCase().includes(searchQuery.toLowerCase()) || item.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject = selectedSubject === 'All' || item.course_title === selectedSubject;
    return matchesSearch && matchesSubject;
  });
  const handleOpenVideo = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };
  const renderItem = ({
    item,
    index

  }: {item: LMSMaterial;index: number;}) => {
    return <Animated.View entering={FadeInDown.delay(index * 100).duration(600)}>
      <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => handleOpenVideo(item.content_url)}>
        <View style={styles.thumbnailContainer}>
          <Image source={{
            uri: `https://img.youtube.com/vi/${item.content_url.split('v=')[1]?.split('&')[0]}/hqdefault.jpg`
          }} style={styles.thumbnail} resizeMode="cover" />
          <View style={styles.playButtonOverlay}>
            <View style={styles.playButton}>
              <Ionicons name="play" size={24} color="#FFF" style={{
                marginLeft: 4
              }} />
            </View>
          </View>
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.thumbnailGradient} />
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{item.duration || '10:00'}</Text>
          </View>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.badgesRow}>
            <View style={styles.topicBadge}>
              <Text style={styles.topicText}>{item.course_title}</Text>
            </View>
            <View style={styles.classBadge}>
              <Text style={styles.classBadgeText}>{item.class_name}</Text>
            </View>
          </View>
          <Text style={styles.subTopic} numberOfLines={2}>{item.title}</Text>

          {item.description ? <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text> : null}

          <View style={styles.footer}>
            <View style={styles.teacherInfo}>
              <MaterialIcons name="person" size={14} color="#6B7280" />
              <Text style={styles.teacherName}>{item.teacher_name}</Text>
            </View>
            <Text style={styles.date}>{item.created_at}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>;
  };
  return <View style={styles.container}>
    <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
    <StudentHeader showBackButton={true} title="LMS" />

    <View style={styles.tabsContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
        {SUBJECTS.map((subject) => {
          return <TouchableOpacity key={subject} style={[styles.tabItem, selectedSubject === subject && styles.activeTabItem]} onPress={() => setSelectedSubject(subject)}>
            <Text style={[styles.tabText, selectedSubject === subject && styles.activeTabText]}>
              {subject}
            </Text>
          </TouchableOpacity>;
        })}
      </ScrollView>
    </View>

    <View style={styles.searchContainer}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color="#9CA3AF" />
        <TextInput style={styles.searchInput} placeholder="Search topics..." value={searchQuery} onChangeText={setSearchQuery} placeholderTextColor="#9CA3AF" />
      </View>
    </View>

    {loading ? <View style={{
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <LogoLoader size={60} color="#3B82F6" />
    </View> : <FlatList data={filteredContent} renderItem={renderItem} keyExtractor={(item) => item.id} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} ListEmptyComponent={<View style={styles.emptyState}>
      <MaterialIcons name="video-library" size={64} color="#E5E7EB" />
      <Text style={styles.emptyText}>No content found</Text>
    </View>} />}
  </View>;
}
const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.card
  },
  // Tabs
  tabsContainer: {
    backgroundColor: theme.colors.background,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.card
  },
  tabsContent: {
    paddingHorizontal: 20,
    gap: 10
  },
  tabItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  activeTabItem: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6'
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary
  },
  activeTabText: {
    color: theme.colors.background
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: theme.colors.card
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937'
  },
  listContent: {
    padding: 20,
    paddingTop: 0,
    gap: 20
  },
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: theme.colors.text,
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 5
  },
  thumbnailContainer: {
    height: 180,
    backgroundColor: theme.colors.border,
    position: 'relative'
  },
  thumbnail: {
    width: '100%',
    height: '100%'
  },
  thumbnailGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60
  },
  playButtonOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1
  },
  playButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF'
  },
  durationBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  durationText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold'
  },
  cardContent: {
    padding: 15
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  topicBadge: {
    backgroundColor: '#E0F2FE',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  topicText: {
    color: '#0284C7',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  classBadge: {
    backgroundColor: theme.colors.card,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  classBadgeText: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: '600'
  },
  subTopic: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 6,
    lineHeight: 22
  },
  description: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 12,
    lineHeight: 18
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.card
  },
  teacherInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  teacherName: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500'
  },
  date: {
    fontSize: 12,
    color: theme.colors.textTertiary
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60
  },
  emptyText: {
    marginTop: 10,
    color: theme.colors.textTertiary,
    fontSize: 16
  }
});