import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AdminHeader from '../../src/components/AdminHeader';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { EventService, EventItem } from '../../src/services/commonServices';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';
export default function AdminEvents() {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'UPCOMING' | 'PAST'>('UPCOMING');
  useEffect(() => {
    fetchEvents();
  }, [activeTab]);
  const fetchEvents = async () => {
    try {
      setLoading(true);
      const data = await EventService.getAll({
        upcoming_only: activeTab === 'UPCOMING',
        to_date: activeTab === 'PAST' ? new Date(Date.now() - 86400000).toISOString().split('T')[0] : undefined
      });
      setEvents(data);
    } catch (error) {

      Alert.alert('Error', 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };
  const getMonth = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('default', {
      month: 'short'
    }).toUpperCase();
  };
  const getDay = (dateString: string) => {
    const date = new Date(dateString);
    return date.getDate().toString().padStart(2, '0');
  };
  const getDayName = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('default', {
      weekday: 'long'
    });
  };
  const getEventTypeStyle = (type: string) => {
    switch (type.toLowerCase()) {
      case 'holiday':
        return {
          bg: '#FEE2E2',
          text: '#991B1B'
        };
      // Red
      case 'event':
        return {
          bg: '#DBEAFE',
          text: '#1E40AF'
        };
      // Blue
      case 'meeting':
        return {
          bg: '#FEF3C7',
          text: '#92400E'
        };
      // Yellow
      case 'exam':
        return {
          bg: '#E0E7FF',
          text: '#3730A3'
        };
      // Indigo
      default:
        return {
          bg: '#F3F4F6',
          text: '#374151'
        };
      // Gray
    }
  };
  const renderItem = ({
    item,
    index

  }: {item: EventItem;index: number;}) => {
    const typeStyle = getEventTypeStyle(item.event_type);
    return <Animated.View entering={FadeInDown.delay(index * 100).duration(500)}>
                <View style={styles.card}>
                    <View style={styles.dateBox}>
                        <Text style={styles.dateText}>{getDay(item.start_date)}</Text>
                        <Text style={styles.monthText}>{getMonth(item.start_date)}</Text>
                    </View>
                    <View style={styles.contentBox}>
                        <View style={styles.titleRow}>
                            <Text style={styles.title}>{item.title}</Text>
                            <View style={[styles.typeBadge, {
              backgroundColor: typeStyle.bg
            }]}>
                                <Text style={[styles.typeText, {
                color: typeStyle.text
              }]}>
                                    {item.event_type.charAt(0).toUpperCase() + item.event_type.slice(1)}
                                </Text>
                            </View>
                        </View>
                        <Text style={styles.dayText}>{getDayName(item.start_date)}</Text>
                        {item.location && <View style={styles.locationRow}>
                                <Ionicons name="location-sharp" size={14} color="#9CA3AF" />
                                <Text style={styles.locationText}>{item.location}</Text>
                            </View>}
                    </View>
                </View>
            </Animated.View>;
  };
  return <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />
            <AdminHeader title="Event Calendar" showBackButton={true} />
            <View style={styles.tabs}>
                <TouchableOpacity style={[styles.tab, activeTab === 'UPCOMING' && styles.activeTab]} onPress={() => setActiveTab('UPCOMING')}>
                    <Text style={[styles.tabText, activeTab === 'UPCOMING' && styles.activeTabText]}>Upcoming</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'PAST' && styles.activeTab]} onPress={() => setActiveTab('PAST')}>
                    <Text style={[styles.tabText, activeTab === 'PAST' && styles.activeTabText]}>Past</Text>
                </TouchableOpacity>
            </View>
            {loading ? <View style={styles.centerContainer}>
                    <LogoLoader size={60} color="#6366F1" />
                </View> : <FlatList data={events} keyExtractor={(item) => item.id} renderItem={renderItem} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} ListEmptyComponent={<Text style={styles.emptyText}>No events found</Text>} refreshing={loading} onRefresh={fetchEvents} />}
            <TouchableOpacity style={styles.fab} onPress={() => Alert.alert('Create Event', 'Feature coming soon')}>
                <Ionicons name="add" size={30} color="#fff" />
            </TouchableOpacity>
        </View>;
}
const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.card
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  tabs: {
    flexDirection: 'row',
    padding: 15
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: theme.colors.border
  },
  activeTab: {
    backgroundColor: '#6366F1'
  },
  tabText: {
    color: theme.colors.textSecondary,
    fontWeight: '600'
  },
  activeTabText: {
    color: theme.colors.background
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 80
  },
  card: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    padding: 15,
    marginBottom: 15,
    shadowColor: theme.colors.text,
    shadowOffset: {
      width: 0,
      height: 1
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    alignItems: 'center'
  },
  dateBox: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 15,
    alignItems: 'center',
    marginRight: 15,
    minWidth: 60
  },
  dateText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937'
  },
  monthText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase'
  },
  contentBox: {
    flex: 1
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
    marginRight: 8
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  typeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#374151'
  },
  dayText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  locationText: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    marginLeft: 4
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#6366F1",
    shadowOffset: {
      width: 0,
      height: 4
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    color: theme.colors.textTertiary,
    fontSize: 16
  }
});