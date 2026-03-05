import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AdminHeader from '../../src/components/AdminHeader';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ComplaintService, Complaint } from '../../src/services/commonServices';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';
export default function AdminComplaints() {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'ALL' | 'OPEN' | 'IN PROGRESS' | 'CLOSED'>('ALL');
  useEffect(() => {
    fetchComplaints();
  }, []);
  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const data = await ComplaintService.getAll();
      setComplaints(data);
    } catch (error) {

      Alert.alert('Error', 'Failed to load complaints');
    } finally {
      setLoading(false);
    }
  };
  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'resolved':
        return {
          bg: '#D1FAE5',
          text: '#065F46'
        };
      case 'escalated':
        return {
          bg: '#FEE2E2',
          text: '#991B1B'
        };
      case 'closed':
        return {
          bg: '#F3F4F6',
          text: '#374151'
        };
      default:
        return {
          bg: '#FEF3C7',
          text: '#92400E'
        };
      // Pending/Open
    }
  };
  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'disciplinary':
        return '#EF4444';
      case 'facility':
        return '#3B82F6';
      case 'academic':
        return '#8B5CF6';
      default:
        return '#6B7280';
    }
  };
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  const filteredData = complaints.filter((item) => {
    if (filterType === 'ALL') return true;
    if (filterType === 'IN PROGRESS') return item.status?.toLowerCase() === 'in progress';
    return (item.status || 'open').toUpperCase() === filterType;
  });
  const handleResolve = async (id: string) => {
    try {
      setLoading(true);
      await ComplaintService.update(id, { status: 'resolved' });
      Alert.alert('Success', 'Complaint resolved successfully');
      fetchComplaints();
    } catch (error) {

      Alert.alert('Error', 'Failed to resolve complaint');
      setLoading(false);
    }
  };

  const handleAssign = () => {
    // Placeholder for Assignment Modal/Logic
    Alert.alert('Assign', 'Assignment functionality coming soon.');
  };

  const renderItem = ({
    item,
    index

  }: { item: Complaint; index: number; }) => {
    const category = item.category || 'General';
    const statusStyle = getStatusStyle(item.status);
    const color = getCategoryColor(category);
    return <Animated.View entering={FadeInDown.delay(index * 100).duration(500)}>
      <View style={styles.card}>
        <View style={[styles.accentBar, {
          backgroundColor: color
        }]} />

        <View style={styles.headerRow}>
          <View style={styles.typeBadge}>
            <Ionicons name={category.toLowerCase() === 'disciplinary' ? 'person-circle-outline' : 'business-outline'} size={14} color="#6B7280" />
            <Text style={styles.category}>{category.toUpperCase()}</Text>
          </View>
          <View style={[styles.statusBadge, {
            backgroundColor: statusStyle.bg
          }]}>
            <Text style={[styles.statusText, {
              color: statusStyle.text
            }]}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.titleRow}>
          <View style={[styles.iconBox, {
            backgroundColor: `${color}15`
          }]}>
            <Ionicons name="alert-circle" size={20} color={color} />
          </View>
          <View style={{
            flex: 1
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.title}>{item.title}</Text>
              {item.priority?.toLowerCase() === 'high' &&
                <View style={[styles.priorityBadge, { backgroundColor: '#FEF2F2' }]}>
                  <Text style={{ fontSize: 10, color: '#EF4444', fontWeight: 'bold' }}>HIGH</Text>
                </View>
              }
            </View>
            <Text style={styles.targetText}>Ticket: <Text style={{
              fontWeight: '700'
            }}>#{item.id?.substring(0, 6) || item.ticket_no}</Text></Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.metaInfo}>
            <Ionicons name="person-outline" size={12} color="#6B7280" />
            <Text style={styles.fromText}>Filed by: {(item as any).raised_by_name || item.raised_by || 'Anonymous'}</Text>
          </View>
          <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: '#10B981' }]} onPress={() => handleResolve(item.id)}>
            <Text style={[styles.actionBtnText, { color: '#10B981' }]}>Resolve</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: '#3B82F6', marginLeft: 8 }]} onPress={() => handleAssign()}>
            <Text style={[styles.actionBtnText, { color: '#3B82F6' }]}>Assign</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>;
  };
  return <View style={styles.container}>
    <StatusBar barStyle="dark-content" backgroundColor="#fff" />
    <AdminHeader title="Complaints Box" showBackButton={true} />

    <View style={styles.filterSection}>
      <View style={styles.tabContainer}>
        {['ALL', 'OPEN', 'IN PROGRESS', 'CLOSED'].map((type) => {
          return <TouchableOpacity key={type} style={[styles.tab, filterType === type && styles.activeTab]} onPress={() => setFilterType(type as any)}>
            <Text style={[styles.tabText, filterType === type && styles.activeTabText]}>
              {type}
            </Text>
          </TouchableOpacity>;
        })}
      </View>
    </View>

    {loading ? <View style={styles.centerContainer}>
      <LogoLoader size={60} color="#6366F1" />
    </View> : <FlatList data={filteredData} keyExtractor={(item) => item.id} renderItem={renderItem} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} ListHeaderComponent={() => {
      return <Text style={styles.listHeader}>Recent Reports ({filteredData.length})</Text>;
    }} ListEmptyComponent={<Text style={styles.emptyText}>No complaints found</Text>} refreshing={loading} onRefresh={fetchComplaints} />}
    <TouchableOpacity style={styles.fab}>
      <Ionicons name="add" size={24} color="#fff" />
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
  filterSection: {
    paddingVertical: 15,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: 20
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 4
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 12
  },
  activeTab: {
    backgroundColor: theme.colors.background,
    shadowColor: theme.colors.text,
    shadowOffset: {
      width: 0,
      height: 1
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary
  },
  activeTabText: {
    color: '#111827',
    fontWeight: '700'
  },
  listContent: {
    padding: 20
  },
  listHeader: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 15,
    letterSpacing: -0.5
  },
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: theme.colors.text,
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    overflow: 'hidden'
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingLeft: 10
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  category: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  titleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
    paddingLeft: 10
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937'
  },
  targetText: {
    fontSize: 12,
    color: theme.colors.textSecondary
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.card,
    paddingLeft: 10
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  fromText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500'
  },
  dateText: {
    fontSize: 11,
    color: theme.colors.textTertiary,
    fontWeight: '500'
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    color: theme.colors.textTertiary,
    fontSize: 16
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 12,
    justifyContent: 'flex-end'
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700'
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary || '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.primary || '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  }
});