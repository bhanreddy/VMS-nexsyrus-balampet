import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AdminHeader from '../../../src/components/AdminHeader';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuth } from '../../../src/hooks/useAuth';
import { FeeService } from '../../../src/services/feeService';
import { useTheme } from '../../../src/hooks/useTheme';
import LogoLoader from '../../../src/components/LogoLoader';

export default function AccountsFees() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await FeeService.getStudentFeeSummaries();

      const uiData = data.map((d: any) => ({
        id: d.student_id,
        name: d.student_name,
        admissionNo: d.admission_no || '',
        class: d.class_name,
        status: d.status,
        total: d.total_amount,
        paid: d.paid_amount,
        due: d.due_amount,
        rawId: d.student_id
      }));
      setStudents(uiData);
    } catch (e) {

    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter((student) =>
  student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
  student.admissionNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
  student.class.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleViewLedger = (student: any) => {
    router.push({
      pathname: '/accounts/fees/details' as any,
      params: {
        studentId: student.id,
        name: student.name
      }
    });
  };

  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);

  const renderItem = ({ item, index }: {item: any;index: number;}) =>
  <Animated.View entering={FadeInDown.delay(index * 100).duration(500)}>
            <TouchableOpacity style={styles.card} onPress={() => handleViewLedger(item)}>
                <View style={styles.cardHeader}>
                    <View>
                        <Text style={styles.studentName}>{item.name}</Text>
                        <Text style={styles.studentClass}>{item.class}</Text>
                    </View>
                    <View style={[styles.statusBadge,
        item.status === 'Paid' ? styles.statusPaid :
        item.status === 'Partial' ? styles.statusPartial : styles.statusPending]
        }>
                        <Text style={[styles.statusText,
          item.status === 'Paid' ? { color: '#065F46' } :
          item.status === 'Partial' ? { color: '#92400E' } : { color: '#991B1B' }]
          }>{item.status}</Text>
                    </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.feeDetails}>
                    <View style={styles.feeItem}>
                        <Text style={styles.feeLabel}>Total</Text>
                        <Text style={styles.feeValue}>₹{item.total}</Text>
                    </View>
                    <View style={styles.feeItem}>
                        <Text style={styles.feeLabel}>Paid</Text>
                        <Text style={[styles.feeValue, { color: '#10B981' }]}>₹{item.paid}</Text>
                    </View>
                    <View style={styles.feeItem}>
                        <Text style={styles.feeLabel}>Due</Text>
                        <Text style={[styles.feeValue, { color: '#EF4444' }]}>₹{item.due}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>;

  return (
    <View style={styles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
            <AdminHeader title="Fee Management" showBackButton={true} />
            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
                <TextInput
          style={styles.searchInput}
          placeholder="Search Student Name or ID..."
          value={searchQuery}
          onChangeText={setSearchQuery} />

            </View>
            {loading ? <LogoLoader size={60} color="#3B82F6" style={{ marginTop: 50 }} /> :
      <FlatList
        data={filteredStudents}
        keyExtractor={(item) => item.id + '_' + item.rawId} // unique key
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<Text style={styles.emptyText}>No students found</Text>} />

      }
        </View>);

}

const getStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    margin: 20,
    paddingHorizontal: 15,
    borderRadius: 12,
    height: 50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  searchIcon: {
    marginRight: 10
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20
  },
  card: {
    backgroundColor: theme.colors.card,
    padding: 15,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  studentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text
  },
  studentClass: {
    fontSize: 14,
    color: theme.colors.textSecondary
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  statusPaid: { backgroundColor: isDark ? 'rgba(6, 95, 70, 0.4)' : '#D1FAE5' },
  statusPartial: { backgroundColor: isDark ? 'rgba(146, 64, 14, 0.4)' : '#FEF3C7' },
  statusPending: { backgroundColor: isDark ? 'rgba(153, 27, 27, 0.4)' : '#FEE2E2' },
  statusText: {
    fontSize: 12,
    fontWeight: '600'
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginBottom: 10
  },
  feeDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  feeItem: {
    alignItems: 'center'
  },
  feeLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 2
  },
  feeValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: theme.colors.text
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    color: theme.colors.textSecondary,
    fontSize: 16
  }
});