import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, StatusBar, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AdminHeader from '../../src/components/AdminHeader';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LeaveService, LeaveApplication } from '../../src/services/commonServices';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';
export default function AdminLeaves() {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetchLeaves();
  }, []);
  const fetchLeaves = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await LeaveService.getAll({
        status: 'pending'
      });
      setLeaves(data);
    } catch (error) {

      setError('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };
  const handleAction = async (id: string, action: 'approved' | 'rejected') => {
    try {
      if (action === 'approved') {
        await LeaveService.approve(id);
      } else {
        await LeaveService.reject(id);
      }
      Alert.alert('Success', `Leave request ${action}`);
      fetchLeaves(); // Refresh list
    } catch (error) {

      Alert.alert('Error', `Failed to ${action} request`);
    }
  };

  // ... (helper functions remain same)

  const calculateDuration = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return `${diffDays} Day${diffDays > 1 ? 's' : ''}`;
  };
  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start).toLocaleDateString();
    const endDate = new Date(end).toLocaleDateString();
    if (startDate === endDate) return startDate;
    return `${startDate} - ${endDate}`;
  };
  const renderItem = ({
    item,
    index

  }: {item: LeaveApplication;index: number;}) => {
    return <Animated.View entering={FadeInDown.delay(index * 100).duration(500)}>
            <View style={styles.card}>
                <View style={styles.headerRow}>
                    <Image source={{
            uri: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
          }} style={styles.avatar} />
                    <View style={styles.info}>
                        <Text style={styles.name}>{item.applicant_name || 'Unknown User'}</Text>
                        <Text style={styles.role}>
                            {item.applicant_role ? item.applicant_role.charAt(0).toUpperCase() + item.applicant_role.slice(1) : 'Staff/Student'}
                        </Text>
                    </View>
                    <View style={styles.durationBadge}>
                        <Text style={styles.durationText}>{calculateDuration(item.start_date, item.end_date)}</Text>
                    </View>
                </View>
                <View style={styles.reasonBox}>
                    <Text style={styles.leaveType}>
                        {item.leave_type.toUpperCase()} • {formatDateRange(item.start_date, item.end_date)}
                    </Text>
                    <Text style={styles.reasonText}>"{item.reason}"</Text>
                </View>
                <View style={styles.actionRow}>
                    <TouchableOpacity style={[styles.actionButton, styles.rejectBtn]} onPress={() => handleAction(item.id, 'rejected')}>
                        <Ionicons name="close-circle" size={18} color="#EF4444" />
                        <Text style={[styles.actionText, {
              color: '#EF4444'
            }]}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, styles.approveBtn]} onPress={() => handleAction(item.id, 'approved')}>
                        <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                        <Text style={[styles.actionText, {
              color: '#10B981'
            }]}>Approve</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Animated.View>;
  };
  return <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />
            <AdminHeader title="Leave Management" showBackButton={true} />
            {loading ? <View style={styles.centerContainer}>
                    <LogoLoader size={60} color="#6366F1" />
                </View> : error ? <View style={styles.centerContainer}>
                    <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
                    <Text style={[styles.emptyText, {
        marginBottom: 20
      }]}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={fetchLeaves}>
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                </View> : <FlatList data={leaves} keyExtractor={(item) => item.id} renderItem={renderItem} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} ListHeaderComponent={leaves.length > 0 ? <Text style={styles.sectionTitle}>Pending Requests ({leaves.length})</Text> : null} ListEmptyComponent={<Text style={styles.emptyText}>No pending leave requests</Text>} refreshing={loading} onRefresh={fetchLeaves} />}
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
    alignItems: 'center',
    padding: 20
  },
  retryButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8
  },
  retryText: {
    color: theme.colors.background,
    fontWeight: 'bold'
  },
  listContent: {
    padding: 20
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
    marginBottom: 15,
    marginLeft: 5,
    textTransform: 'uppercase'
  },
  card: {
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
    elevation: 1
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
    backgroundColor: theme.colors.card
  },
  info: {
    flex: 1
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937'
  },
  role: {
    fontSize: 13,
    color: theme.colors.textSecondary
  },
  durationBadge: {
    backgroundColor: theme.colors.card,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8
  },
  durationText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151'
  },
  reasonBox: {
    backgroundColor: theme.colors.card,
    padding: 12,
    borderRadius: 12,
    marginBottom: 15
  },
  leaveType: {
    fontSize: 12,
    color: '#6366F1',
    fontWeight: '600',
    marginBottom: 4
  },
  reasonText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontStyle: 'italic'
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    marginHorizontal: 5
  },
  rejectBtn: {
    backgroundColor: '#FEF2F2'
  },
  approveBtn: {
    backgroundColor: '#ECFDF5'
  },
  actionText: {
    fontWeight: '600',
    marginLeft: 6
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    color: theme.colors.textTertiary,
    fontSize: 16
  }
});