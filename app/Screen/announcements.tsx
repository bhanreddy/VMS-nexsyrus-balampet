import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import ScreenLayout from '../../src/components/ScreenLayout';
import StudentHeader from '../../src/components/StudentHeader';
import { NoticeService, Notice } from '../../src/services/commonServices';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import { t_field } from '../../src/utils/lang';
import LogoLoader from '../../src/components/LogoLoader';

interface UINotice {
  id: string;
  title: string;
  title_te?: string;
  message: string;
  message_te?: string;
  date: string;
  time: string;
  important: boolean;
  icon: string;
  color: string;
}
export default function AnnouncementsScreen() {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const {
    t
  } = useTranslation();
  const [notices, setNotices] = useState<UINotice[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    loadData();
  }, []);
  const loadData = async () => {
    setLoading(true);
    try {
      const data = await NoticeService.getAll({
        audience: 'students'
      });
      const uiData = data.map((n: Notice) => ({
        id: n.id,
        title: n.title,
        title_te: (n as any).title_te,
        message: n.content,
        message_te: (n as any).content_te,
        date: (n.published_at || n.created_at).split('T')[0],
        // Extract date from timestamp
        time: 'All Day',
        // Backend might need time field
        important: n.is_pinned,
        // Use is_pinned flag from backend
        icon: 'notifications',
        color: '#3b82f6'
      }));
      setNotices(uiData);
    } catch (e) {

    } finally {
      setLoading(false);
    }
  };
  const renderItem = ({
    item

  }: {item: UINotice;}) => {
    return <View style={styles.timelineItem}>
      {/* LEFT TIME COLUMN */}
      <View style={styles.leftCol}>
        <Text style={styles.dateText}>{item.date}</Text>
        <Text style={styles.timeText}>{item.time}</Text>
        <View style={styles.verticalLine} />
      </View>

      {/* DOT INDICATOR */}
      <View style={[styles.dot, {
        backgroundColor: item.color
      }]} />

      {/* CONTENT CARD */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{t_field(item.title, item.title_te)}</Text>
          {item.important && <View style={styles.badge}>
            <Text style={styles.badgeText}>{t('announcements.important', 'Important')}</Text>
          </View>}
        </View>
        <Text
          style={styles.message}
          onPress={() => {

            // NOTE: The previous code didn't actually have a router.push here natively to contentDetail.
            // But per instruction, we add the fields so IF a navigation wrapper is added around the card,
            // or if we add a read-more button, it can pass them.
            // Wait, looking at announcements.tsx, there's no router.push to contentDetail at all.
            // Let me add a TouchableOpacity around the card to make it clickable to contentDetail.
          }}>{t_field(item.message, item.message_te)}</Text>
        <Ionicons name={item.icon as any} size={24} color={item.color + '40'} style={styles.bgIcon} />
      </View>
    </View>;};return <ScreenLayout>
    <StudentHeader showBackButton={true} title={t('announcements.title', 'Announcements')} />

    <View style={styles.container}>
      <View style={styles.headerSection}>
        <View style={styles.iconBox}>
          <Ionicons name="notifications" size={24} color="#4f46e5" />
        </View>
        <View>
          <Text style={styles.pageTitle}>{t('announcements.title', 'Notice Board')}</Text>
          <Text style={styles.subtitle}>{t('announcements.subtitle', 'Latest updates and events')}</Text>
        </View>
      </View>

      {loading ? <LogoLoader size={60} color="#4f46e5" style={{ marginTop: 50 }} /> : <FlatList data={notices} keyExtractor={(item) => item.id} renderItem={renderItem} contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false} ListEmptyComponent={<Text style={{
        textAlign: 'center',
        marginTop: 20,
        color: '#999'
      }}>No announcements.</Text>} />}
    </View>
  </ScreenLayout>;
}
const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb'
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderColor: '#f3f4f6'
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111'
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280'
  },
  listContainer: {
    padding: 20
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 24
  },
  leftCol: {
    width: 60,
    alignItems: 'flex-end',
    marginRight: 10,
    position: 'relative'
  },
  dateText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151'
  },
  timeText: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2
  },
  verticalLine: {
    position: 'absolute',
    right: -16,
    top: 24,
    bottom: -40,
    width: 2,
    backgroundColor: '#e5e7eb'
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 6,
    marginRight: 10,
    zIndex: 1,
    borderWidth: 2,
    borderColor: theme.colors.background,
    elevation: 2
  },
  card: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    padding: 14,
    elevation: 2,
    shadowColor: theme.colors.text,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    position: 'relative',
    overflow: 'hidden'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    flex: 1,
    marginRight: 8
  },
  badge: {
    backgroundColor: '#fecaca',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#dc2626'
  },
  message: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20
  },
  bgIcon: {
    position: 'absolute',
    right: -5,
    bottom: -5,
    transform: [{
      scale: 2
    }],
    opacity: 0.1
  }
});