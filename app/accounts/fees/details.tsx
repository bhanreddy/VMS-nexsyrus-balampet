import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AdminHeader from '../../../src/components/AdminHeader';
import { FeeService } from '../../../src/services/feeService';
import { StudentFee, FeeResponse } from '../../../src/types/models';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/hooks/useTheme';
import { Theme } from '../../../src/theme/themes';
import LogoLoader from '../../../src/components/LogoLoader';
export default function StudentFeeLedger() {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const router = useRouter();
  const params = useLocalSearchParams();
  const studentId = params.studentId as string;
  const studentName = params.name as string;
  const [loading, setLoading] = useState(true);
  const [feeData, setFeeData] = useState<FeeResponse | null>(null);
  useEffect(() => {
    if (studentId) loadLedger();
  }, [studentId]);
  const loadLedger = async () => {
    setLoading(true);
    try {
      const data = await FeeService.getStudentFees(studentId);
      setFeeData(data);
    } catch (error) {
      Alert.alert("Error", "Failed to load financial ledger");
    } finally {
      setLoading(false);
    }
  };
  const handlePayment = (fee: StudentFee) => {
    router.push({
      pathname: '/accounts/fees/collect' as any,
      params: {
        feeId: fee.id,
        studentId,
        name: studentName,
        admissionNo: feeData?.student.admission_no,
        feeType: fee.fee_type,
        due: (fee.amount_due - fee.discount - fee.amount_paid).toString()
      }
    });
  };
  const handleAdjustment = (fee: StudentFee) => {
    router.push({
      pathname: '/accounts/fees/adjust' as any,
      params: {
        feeId: fee.id,
        studentId,
        name: studentName,
        feeType: fee.fee_type
      }
    });
  };
  if (loading) {
    return <View style={styles.centered}>
                <LogoLoader size={60} color="#3B82F6" />
                <Text style={styles.loadingText}>Fetching financial truth...</Text>
            </View>;
  }
  return <View style={styles.container}>
            <AdminHeader title="Fee Ledger" showBackButton={true} />

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.studentCard}>
                    <Text style={styles.studentLabel}>STUDENT</Text>
                    <Text style={styles.studentName}>{studentName}</Text>
                    <Text style={styles.studentId}>ID: {studentId.split('-')[0].toUpperCase()}</Text>
                </View>

                {/* Summary Section - AUTH RADIATED FROM BACKEND */}
                <View style={styles.summaryContainer}>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Total Due</Text>
                        <Text style={styles.summaryValue}>₹{feeData?.summary.total_due}</Text>
                    </View>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Paid</Text>
                        <Text style={[styles.summaryValue, {
            color: '#10B981'
          }]}>₹{feeData?.summary.total_paid}</Text>
                    </View>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Balance</Text>
                        <Text style={[styles.summaryValue, {
            color: '#EF4444'
          }]}>₹{feeData?.summary.balance}</Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>FEE BREAKDOWN</Text>

                {feeData?.fees.map(fee => {
const statusKey = `status${fee.status.charAt(0).toUpperCase() + fee.status.slice(1)}` as keyof typeof styles;
        return <View key={fee.id} style={styles.feeCard}>
                            <View style={styles.feeHeader}>
                                <Text style={styles.feeType}>{fee.fee_type}</Text>
                                <View style={[styles.statusBadge, styles[statusKey] as any]}>
                                    <Text style={styles.statusText}>{fee.status.toUpperCase()}</Text>
                                </View>
                            </View>

                            <View style={styles.feeRow}>
                                <View>
                                    <Text style={styles.feeLabel}>Amount</Text>
                                    <Text style={styles.feeNum}>₹{fee.amount_due}</Text>
                                </View>
                                <View>
                                    <Text style={styles.feeLabel}>Paid</Text>
                                    <Text style={[styles.feeNum, {
                color: '#10B981'
              }]}>₹{fee.amount_paid}</Text>
                                </View>
                                {fee.discount > 0 && <View>
                                        <Text style={styles.feeLabel}>Waiver</Text>
                                        <Text style={[styles.feeNum, {
                color: '#6366F1'
              }]}>-₹{fee.discount}</Text>
                                    </View>}
                                <View>
                                    <Text style={styles.feeLabel}>Due</Text>
                                    <Text style={[styles.feeNum, {
                color: '#EF4444'
              }]}>₹{fee.amount_due - fee.discount - fee.amount_paid}</Text>
                                </View>
                            </View>

                            <View style={styles.actionRow}>
                                <TouchableOpacity style={[styles.actionBtn, fee.status === 'paid' && styles.disabledBtn]} onPress={() => handlePayment(fee)} disabled={fee.status === 'paid'}>
                                    <Ionicons name="cash-outline" size={18} color={fee.status === 'paid' ? '#9CA3AF' : '#10B981'} />
                                    <Text style={[styles.actionBtnText, {
                color: fee.status === 'paid' ? '#9CA3AF' : '#10B981'
              }]}>Collect</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.actionBtn} onPress={() => handleAdjustment(fee)}>
                                    <Ionicons name="cut-outline" size={18} color="#6366F1" />
                                    <Text style={[styles.actionBtnText, {
                color: '#6366F1'
              }]}>Adjustment</Text>
                                </TouchableOpacity>
                            </View>
                        </View>;
      })}
            </ScrollView>
        </View>;
}
const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.card
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.card
  },
  loadingText: {
    marginTop: 10,
    color: theme.colors.textSecondary,
    fontWeight: '500'
  },
  scrollContent: {
    padding: 20
  },
  studentCard: {
    backgroundColor: '#1F2937',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20
  },
  studentLabel: {
    color: theme.colors.textTertiary,
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 4
  },
  studentName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.background
  },
  studentId: {
    color: theme.colors.textTertiary,
    fontSize: 12,
    marginTop: 4
  },
  summaryContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    padding: 15,
    marginBottom: 25,
    justifyContent: 'space-between',
    shadowColor: theme.colors.text,
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1
  },
  summaryLabel: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginBottom: 5,
    fontWeight: '600'
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827'
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textSecondary,
    marginBottom: 15,
    letterSpacing: 1
  },
  feeCard: {
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    padding: 15,
    marginBottom: 15
  },
  feeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15
  },
  feeType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827'
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  statusPending: {
    backgroundColor: '#FEE2E2'
  },
  statusPartial: {
    backgroundColor: '#FEF3C7'
  },
  statusPaid: {
    backgroundColor: '#D1FAE5'
  },
  statusOverdue: {
    backgroundColor: '#DC2626'
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#111827'
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.card
  },
  feeLabel: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginBottom: 3
  },
  feeNum: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937'
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 15
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700'
  },
  disabledBtn: {
    opacity: 0.5
  }
});