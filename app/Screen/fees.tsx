import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Platform, StatusBar, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { StudentService } from '../../src/services/studentService';
import { FeeResponse, StudentFee } from '../../src/types/models';
import { useAuth } from '../../src/hooks/useAuth';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';

const FeesScreen = () => {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const {
    t
  } = useTranslation();
  const router = useRouter();
  const {
    user
  } = useAuth();
  const [feeData, setFeeData] = useState<FeeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadFees();
  }, [user]);
  const loadFees = async () => {
    if (!user) return;
    try {
      const data = await StudentService.getFees(user.id);
      setFeeData(data);
    } catch (error) {

    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  const onRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadFees();
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return '#10b981';
      case 'pending':
        return '#f59e0b';
      case 'overdue':
        return '#ef4444';
      case 'partial':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };
  const renderFeeItem = ({
    item,
    index

  }: {item: StudentFee;index: number;}) => {
    const color = getStatusColor(item.status);
    return <Animated.View entering={FadeInUp.delay(index * 100).duration(500)} style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.feeType}>{item.fee_type}</Text>
          <Text style={styles.date}>Due: {new Date(item.due_date).toLocaleDateString()}</Text>
        </View>
        <View style={[styles.statusBadge, {
          backgroundColor: color + '20'
        }]}>
          <Text style={[styles.statusText, {
            color: color
          }]}>{item.status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.amountRow}>
        <View>
          <Text style={styles.amountLabel}>Total Due</Text>
          <Text style={styles.amountValue}>₹{item.amount_due.toLocaleString()}</Text>
        </View>
        <View style={{
          alignItems: 'flex-end'
        }}>
          <Text style={styles.amountLabel}>Paid</Text>
          <Text style={[styles.amountValue, {
            color: '#10b981'
          }]}>₹{item.amount_paid.toLocaleString()}</Text>
        </View>
      </View>

      {(item.status === 'pending' || item.status === 'overdue' || item.status === 'partial') && <TouchableOpacity style={styles.payButton} onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        // Future: Integrate Payment Gateway
        alert("Payment gateway integration pending.");
      }}>
        <Text style={styles.payButtonText}>Pay Now</Text>
        <Ionicons name="arrow-forward" size={16} color="#fff" />
      </TouchableOpacity>}
    </Animated.View>;
  };
  if (loading) {
    return <View style={styles.loadingContainer}>
      <LogoLoader size={60} color="#4F46E5" />
    </View>;
  }
  return <SafeAreaView style={styles.container}>
    <StatusBar barStyle="light-content" backgroundColor="#4F46E5" />

    {/* Header */}
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Fees</Text>
        <View style={{
          width: 40
        }} />
      </View>

      {/* Summary Card */}
      {feeData && <Animated.View entering={FadeInDown.duration(600)} style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryLabel}>Total Due</Text>
            <Text style={styles.summaryValue}>₹{feeData.summary.total_due.toLocaleString()}</Text>
          </View>
          <View style={{
            height: 40,
            width: 1,
            backgroundColor: 'rgba(255,255,255,0.2)'
          }} />
          <View>
            <Text style={styles.summaryLabel}>Outstanding</Text>
            <Text style={[styles.summaryValue, {
              color: '#fca5a5'
            }]}>₹{feeData.summary.balance.toLocaleString()}</Text>
          </View>
        </View>
      </Animated.View>}
    </View>

    <FlatList contentContainerStyle={styles.list} data={feeData?.fees || []} renderItem={renderFeeItem} keyExtractor={(item) => item.id} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />} ListEmptyComponent={<View style={styles.emptyContainer}>
      <Ionicons name="wallet-outline" size={64} color="#ccc" />
      <Text style={styles.emptyText}>No fee records found.</Text>
    </View>} />
  </SafeAreaView>;
};
export default FeesScreen;
const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.card
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  header: {
    backgroundColor: theme.colors.primary,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 20 : 0,
    paddingBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: theme.colors.primary,
    shadowOffset: {
      width: 0,
      height: 10
    },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
    zIndex: 10
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 20,
    height: 48
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.background
  },
  summaryCard: {
    marginHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center'
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginBottom: 4
  },
  summaryValue: {
    color: theme.colors.background,
    fontSize: 20,
    fontWeight: '700'
  },
  list: {
    padding: 16,
    paddingTop: 24,
    paddingBottom: 40
  },
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: theme.colors.text,
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  feeType: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4
  },
  date: {
    fontSize: 12,
    color: theme.colors.textSecondary
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700'
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.card,
    marginVertical: 12
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  amountLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 2
  },
  amountValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937'
  },
  payButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8
  },
  payButtonText: {
    color: theme.colors.background,
    fontWeight: '600',
    fontSize: 14
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60
  },
  emptyText: {
    marginTop: 16,
    color: theme.colors.textTertiary,
    fontSize: 16
  }
});