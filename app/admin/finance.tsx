import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import AdminHeader from '../../src/components/AdminHeader';
import Animated, { FadeInUp, useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { FeeService } from '../../src/services/feeService';
import LogoLoader from '../../src/components/LogoLoader';

export default function AdminFinanceScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState<any>({
    expected_total: 0,
    collected_total: 0,
    pending_total: 0,
    today_collection: 0,
    defaulter_count: 0
  });

  const [transactions, setTransactions] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [modeFilter, setModeFilter] = useState<string>('All');

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    }
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [dashboardStats, recentTx] = await Promise.all([
      FeeService.getDashboardStats(),
      FeeService.getRecentTransactions(10)]
      );
      setStats(dashboardStats);
      setTransactions(recentTx || []);
    } catch (error) {

    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const formatCurrency = (amount: number) => {
    return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return 'Invalid Date';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const handleFilterStatus = () => {
    const options = ['All', 'Success', 'Pending'];
    Alert.alert('Filter by Status', 'Select transaction status', [
    ...options.map((opt) => ({ text: opt, onPress: () => setStatusFilter(opt) })),
    { text: 'Cancel', style: 'cancel' }]
    );
  };

  const handleFilterMode = () => {
    const options = ['All', 'CASH', 'ONLINE', 'UPI', 'BANK_TRANSFER'];
    Alert.alert('Filter by Mode', 'Select payment mode', [
    ...options.map((opt) => ({ text: opt, onPress: () => setModeFilter(opt) })),
    { text: 'Cancel', style: 'cancel' }]
    );
  };

  const handleDefaulters = () => {
    Alert.alert('Fee Defaulters', 'This will navigate to the detailed fee defaulters list.');
  };

  const filteredTransactions = transactions.filter((tx) => {
    const txMode = (tx.payment_method || 'CASH').toUpperCase();
    if (modeFilter !== 'All' && txMode !== modeFilter.toUpperCase()) return false;

    const txStatus = tx.status || 'Success'; // DB transactions are assumed success unless specified
    if (statusFilter !== 'All') {
      if (statusFilter === 'Success' && txStatus.toLowerCase() !== 'success' && txStatus.toLowerCase() !== 'completed') return false;
      if (statusFilter === 'Pending' && txStatus.toLowerCase() !== 'pending') return false;
    }
    return true;
  });

  return (
    <View style={styles.container}>
            <AdminHeader title="Finance & Collection" showNotification scrollY={scrollY} />
            {loading && !refreshing ?
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <LogoLoader size={60} color={theme.colors.primary} />
                    <Text style={{ color: theme.colors.textSecondary, marginTop: 10 }}>Loading finance data...</Text>
                </View> :

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="transparent" colors={['transparent']} progressBackgroundColor="transparent" />}>

                {refreshing &&
        <View style={{ width: '100%', alignItems: 'center', paddingVertical: 20 }}>
                        <LogoLoader size={30} />
                    </View>
        }
                    {/* Hero Stats */}
                    <Animated.View entering={FadeInUp.delay(0).springify()} style={styles.heroCard}>
                        <Text style={styles.heroTitle}>Today's Collection</Text>
                        <Text style={styles.heroAmount}>{formatCurrency(stats.today_collection)}</Text>
                        <View style={styles.heroFooter}>
                            <View style={styles.trendBadge}>
                                <Ionicons name="cash-outline" size={14} color="#10B981" />
                                <Text style={styles.trendText}>Active Flow</Text>
                            </View>
                        </View>
                    </Animated.View>
                    {/* Secondary Stats */}
                    <View style={styles.statsRow}>
                        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.statCard}>
                            <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} style={styles.statIcon} />
                            <Text style={styles.statLabel}>Total Collected</Text>
                            <Text style={styles.statValue}>{formatCurrency(stats.collected_total || 0)}</Text>
                        </Animated.View>
                        <Animated.View entering={FadeInUp.delay(150).springify()} style={styles.statCard}>
                            <Ionicons name="stats-chart-outline" size={20} color="#10B981" style={styles.statIcon} />
                            <Text style={styles.statLabel}>This Month</Text>
                            <Text style={styles.statValue}>{formatCurrency(stats.monthly_collection || 0)}</Text>
                        </Animated.View>
                    </View>
                    <View style={styles.statsRow}>
                        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.statCard}>
                            <Ionicons name="warning-outline" size={20} color="#EF4444" style={styles.statIcon} />
                            <Text style={styles.statLabel}>Defaulters</Text>
                            <Text style={styles.statValue}>{stats.defaulter_count || 0}</Text>
                        </Animated.View>
                        <Animated.View entering={FadeInUp.delay(250).springify()} style={styles.statCard}>
                            <Ionicons name="cash-outline" size={20} color="#F59E0B" style={styles.statIcon} />
                            <Text style={styles.statLabel}>Pending Dues</Text>
                            <Text style={styles.statValue}>{formatCurrency(stats.pending_dues || 0)}</Text>
                        </Animated.View>
                    </View>
                    {/* Filters */}
                    <View style={styles.filterRow}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <TouchableOpacity style={styles.filterChip} onPress={handleFilterStatus}>
                                <Text style={styles.filterChipText}>Status: {statusFilter}</Text>
                                <Ionicons name="chevron-down" size={14} color={theme.colors.textSecondary} style={{ marginLeft: 4 }} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.filterChip} onPress={handleFilterMode}>
                                <Text style={styles.filterChipText}>Mode: {modeFilter}</Text>
                                <Ionicons name="chevron-down" size={14} color={theme.colors.textSecondary} style={{ marginLeft: 4 }} />
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.filterChip, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]} onPress={handleDefaulters}>
                                <Text style={[styles.filterChipText, { color: '#EF4444' }]}>Fee Defaulters</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                    {/* Recent Transactions */}
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Recent Transactions</Text>
                        <TouchableOpacity onPress={() => Alert.alert('Transactions', 'Navigating to full transaction history...')}>
                            <Text style={styles.seeAllText}>See All</Text>
                        </TouchableOpacity>
                    </View>
                    {filteredTransactions.length === 0 ?
        <View style={{ padding: 20, alignItems: 'center' }}>
                            <Text style={{ color: theme.colors.textSecondary }}>No recent transactions found.</Text>
                        </View> :

        filteredTransactions.map((tx, index) => {
          const isSuccess = tx.status === 'completed' || tx.status === 'success' || !tx.status; // Default to success for DB transactions if status missing
          const statusColor = isSuccess ? '#10B981' : '#F59E0B';

          // Try to get student name from possible nested structures depending on your exact DB join
          const studentName = tx.student_name || tx.student?.person?.display_name || tx.student?.first_name || 'Unknown Student';

          return (
            <Animated.View key={tx.id || index} entering={FadeInUp.delay((index % 10 + 4) * 50).springify().damping(12)} style={styles.txCard}>
                                    <View style={[styles.txIconContainer, { backgroundColor: statusColor + '15' }]}>
                                        <Ionicons name={isSuccess ? "checkmark-circle" : "time"} size={24} color={statusColor} />
                                    </View>
                                    <View style={styles.txInfo}>
                                        <Text style={styles.txName}>{studentName}</Text>
                                        <Text style={styles.txTime}>{formatTime(tx.paid_at || tx.payment_date || tx.created_at)} • {tx.payment_method?.toUpperCase() || 'CASH'}</Text>
                                    </View>
                                    <View style={styles.txAmountContainer}>
                                        <Text style={styles.txAmount}>+{formatCurrency(tx.amount)}</Text>
                                        <Text style={[styles.txStatus, { color: statusColor }]}>
                                            {isSuccess ? 'Success' : tx.status?.charAt(0).toUpperCase() + tx.status?.slice(1) || 'Pending'}
                                        </Text>
                                    </View>
                                </Animated.View>);

        })
        }
                </Animated.ScrollView>
      }
            {/* Floating Action Button */}
            <TouchableOpacity
        style={styles.fab}
        onPress={() => Alert.alert('Export', 'Generating collection report for download...')}>

                <Ionicons name="download-outline" size={24} color="#fff" />
            </TouchableOpacity>
        </View>);

}

const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  content: {
    padding: 20,
    paddingTop: 100,
    paddingBottom: 40
  },
  heroCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8
  },
  heroTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 8
  },
  heroAmount: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '800',
    marginBottom: 16
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  trendText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  statCard: {
    width: '48%',
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  statIcon: {
    marginBottom: 12
  },
  statLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    marginBottom: 4
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text
  },
  filterRow: {
    marginBottom: 24
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  filterChipText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500'
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text
  },
  seeAllText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600'
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  txIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  txInfo: {
    flex: 1
  },
  txName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2
  },
  txTime: {
    fontSize: 12,
    color: theme.colors.textSecondary
  },
  txAmountContainer: {
    alignItems: 'flex-end'
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 2
  },
  txStatus: {
    fontSize: 12,
    fontWeight: '500'
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  }
});