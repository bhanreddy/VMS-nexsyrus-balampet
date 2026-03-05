import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, StatusBar, Modal, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import AdminHeader from '../../src/components/AdminHeader';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useExpenses } from '../../src/hooks/useExpenses';
import { useAuth } from '../../src/hooks/useAuth';
import { CreateExpenseRequest, Expense } from '../../src/types/expenses';
import { PolicyService } from '../../src/services/policyService';
import NetBalanceTab from '../../src/components/NetBalanceTab'; // Import new component
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';

// --- CONSTANTS ---
const CATEGORIES = ['Education', 'Maintenance', 'Sports', 'Utility', 'Events', 'Salary', 'Other'];
export default function AdminExpenses() {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const {
    expenses,
    loading,
    fetchExpenses,
    createExpense,
    updateStatus
  } = useExpenses();
  const {
    user
  } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'balance'>('list'); // Tab State

  // --- MODAL STATES ---
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null); // For Details Modal

  // --- DELETE STATE ---
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  // --- FORM STATES ---
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);
  const [newAmount, setNewAmount] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- EFFECT ---
  useEffect(() => {
    if (activeTab === 'list') {
      fetchExpenses(searchQuery);
    }
  }, [searchQuery, activeTab]);

  // --- HANDLERS ---
  const handleAddExpense = async () => {
    if (!newTitle || !newAmount) {
      Alert.alert('Validation', 'Please fill in Title and Amount');
      return;
    }
    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Validation', 'Invalid amount');
      return;
    }
    setIsSubmitting(true);
    const payload: CreateExpenseRequest = {
      title: newTitle,
      category: newCategory,
      amount,
      expense_date: new Date().toISOString().split('T')[0],
      // Today
      description: newDescription
    };
    const success = await createExpense(payload);
    setIsSubmitting(false);
    if (success) {
      setIsAddModalVisible(false);
      resetForm();
      Alert.alert('Success', 'Expense created successfully');
    }
  };
  const resetForm = () => {
    setNewTitle('');
    setNewCategory(CATEGORIES[0]);
    setNewAmount('');
    setNewDescription('');
  };
  const handleApprove = async (expense: Expense) => {
    Alert.alert('Confirm Approve', 'Are you sure you want to approve this expense?', [{
      text: 'Cancel',
      style: 'cancel'
    }, {
      text: 'Approve',
      onPress: async () => {
        const success = await updateStatus(expense.id, 'approved');
        if (success) setSelectedExpense(null);
      }
    }]);
  };
  const handlePay = async (expense: Expense) => {
    Alert.alert('Confirm Payment', 'Mark this expense as Paid?', [{
      text: 'Cancel',
      style: 'cancel'
    }, {
      text: 'Mark Paid',
      onPress: async () => {
        const success = await updateStatus(expense.id, 'paid');
        if (success) setSelectedExpense(null);
      }
    }]);
  };
  const handleDeletePress = () => {
    setIsDeleteModalVisible(true);
  };
  const confirmDelete = async () => {
    if (!selectedExpense) return;
    if (!deleteReason.trim()) {
      Alert.alert('Required', 'Please provide a reason for deletion.');
      return;
    }
    setDeleting(true);
    try {
      await PolicyService.deleteWithReason('expenses', selectedExpense.id, deleteReason);
      setIsDeleteModalVisible(false);
      setSelectedExpense(null);
      setDeleteReason('');
      fetchExpenses(searchQuery);
      Alert.alert('Success', 'Expense deleted.');
    } catch (error) {

      Alert.alert('Error', 'Failed to delete expense.');
    } finally {
      setDeleting(false);
    }
  };

  // --- RENDER ITEM ---
  const renderItem = ({
    item,
    index

  }: {item: Expense;index: number;}) => {
    return <Animated.View entering={FadeInDown.delay(index * 50).duration(400)}>
            <TouchableOpacity style={styles.card} onPress={() => setSelectedExpense(item)} activeOpacity={0.7}>
                <View style={styles.headerRow}>
                    <View style={styles.iconBox}>
                        <FontAwesome5 name="receipt" size={16} color="#6366F1" />
                    </View>
                    <View style={styles.titleBox}>
                        <Text style={styles.title}>{item.title}</Text>
                        <Text style={styles.date}>{item.expense_date} • {item.category}</Text>
                    </View>
                    <Text style={styles.amount}>₹{item.amount.toLocaleString('en-IN')}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.footer}>
                    {item.description ? <Text style={styles.descText} numberOfLines={1}>{item.description}</Text> : <View style={{
            flex: 1
          }} />}
                    <View style={[styles.statusBadge, item.status === 'approved' ? styles.sApproved : item.status === 'paid' ? styles.sPaid : styles.sPending]}>
                        <Text style={[styles.statusText, item.status === 'approved' ? {
              color: '#065F46'
            } : item.status === 'paid' ? {
              color: '#1E40AF'
            } : {
              color: '#92400E'
            }]}>{item.status.toUpperCase()}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>;
  };
  return <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />
            <AdminHeader title="Admin Expense Tracker" showBackButton={true} />
            {/* TAB SWITCHER */}
            <View style={styles.tabContainer}>
                <TouchableOpacity style={[styles.tabBtn, activeTab === 'list' && styles.activeTabBtn]} onPress={() => setActiveTab('list')}>
                    <Text style={[styles.tabText, activeTab === 'list' && styles.activeTabText]}>Expenses List</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabBtn, activeTab === 'balance' && styles.activeTabBtn]} onPress={() => setActiveTab('balance')}>
                    <Text style={[styles.tabText, activeTab === 'balance' && styles.activeTabText]}>Net Balance</Text>
                </TouchableOpacity>
            </View>
            {activeTab === 'list' ? <>
                    {/* SEARCH */}
                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
                        <TextInput style={styles.searchInput} placeholder="Search expenses..." value={searchQuery} onChangeText={setSearchQuery} />
                    </View>
                    {/* LIST */}
                    {loading && expenses.length === 0 ? <View style={styles.centered}><LogoLoader size={60} color="#6366F1" /></View> : <FlatList data={expenses} keyExtractor={(item) => item.id} renderItem={renderItem} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} ListEmptyComponent={<View style={styles.centered}>
                                    <Text style={styles.emptyText}>No expenses found</Text>
                                </View>} refreshing={loading} onRefresh={() => fetchExpenses(searchQuery)} />}
                    {/* FAB (Admins can also add expenses) */}
                    <TouchableOpacity style={styles.fab} onPress={() => setIsAddModalVisible(true)}>
                        <Ionicons name="add" size={30} color="#fff" />
                    </TouchableOpacity>
                </> : <NetBalanceTab />}
            {/* --- ADD EXPENSE MODAL --- */}
            <Modal visible={isAddModalVisible} animationType="slide" transparent={true}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>New Expense Request</Text>
                            <TouchableOpacity onPress={() => setIsAddModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#374151" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.label}>Title</Text>
                        <TextInput style={styles.input} placeholder="e.g. Lab Equipment" value={newTitle} onChangeText={setNewTitle} />
                        <Text style={styles.label}>Amount (₹)</Text>
                        <TextInput style={styles.input} placeholder="0.00" keyboardType="numeric" value={newAmount} onChangeText={setNewAmount} />
                        <Text style={styles.label}>Category</Text>
                        <View style={styles.categoryRow}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {CATEGORIES.map((cat) => {
                return <TouchableOpacity key={cat} style={[styles.catChip, newCategory === cat && styles.catChipActive]} onPress={() => setNewCategory(cat)}>
                                        <Text style={[styles.catText, newCategory === cat && styles.catTextActive]}>{cat}</Text>
                                    </TouchableOpacity>;
              })}
                            </ScrollView>
                        </View>
                        <Text style={styles.label}>Description (Optional)</Text>
                        <TextInput style={[styles.input, {
            height: 80
          }]} multiline placeholder="Details..." value={newDescription} onChangeText={setNewDescription} />
                        <TouchableOpacity style={styles.submitBtn} onPress={handleAddExpense} disabled={isSubmitting}>
                            {isSubmitting ? <LogoLoader color="#fff" /> : <Text style={styles.submitBtnText}>Submit Expense</Text>}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
            {/* --- DETAILS MODAL --- */}
            <Modal visible={!!selectedExpense} animationType="fade" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.detailsCard}>
                        {selectedExpense && <>
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalTitle}>Expense Oversight</Text>
                                    <TouchableOpacity onPress={() => setSelectedExpense(null)}>
                                        <Ionicons name="close" size={24} color="#374151" />
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Title</Text>
                                    <Text style={styles.detailValue}>{selectedExpense.title}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Amount</Text>
                                    <Text style={[styles.detailValue, {
                color: '#EF4444',
                fontWeight: 'bold'
              }]}>
                                        ₹{selectedExpense.amount.toLocaleString('en-IN')}
                                    </Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Category</Text>
                                    <Text style={styles.detailValue}>{selectedExpense.category}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Date</Text>
                                    <Text style={styles.detailValue}>{selectedExpense.expense_date}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Status</Text>
                                    <View style={[styles.statusBadge, selectedExpense.status === 'approved' ? styles.sApproved : selectedExpense.status === 'paid' ? styles.sPaid : styles.sPending]}>
                                        <Text style={[styles.statusText, selectedExpense.status === 'approved' ? {
                  color: '#065F46'
                } : selectedExpense.status === 'paid' ? {
                  color: '#1E40AF'
                } : {
                  color: '#92400E'
                }]}>{selectedExpense.status.toUpperCase()}</Text>
                                    </View>
                                </View>
                                {selectedExpense.description && <View style={styles.detailRowVertical}>
                                        <Text style={styles.detailLabel}>Description</Text>
                                        <Text style={styles.detailLog}>{selectedExpense.description}</Text>
                                    </View>}
                                <View style={styles.actionRow}>
                                    {selectedExpense.status === 'pending' && <>
                                            {/* Admin can always approve */}
                                            <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => handleApprove(selectedExpense)}>
                                                <MaterialIcons name="check" size={20} color="#fff" />
                                                <Text style={styles.actionText}>Approve</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={[styles.actionBtn, {
                  backgroundColor: '#EF4444'
                }]} onPress={handleDeletePress}>
                                                <MaterialIcons name="delete" size={20} color="#fff" />
                                                <Text style={styles.actionText}>Reject/Delete</Text>
                                            </TouchableOpacity>
                                        </>}
                                    {selectedExpense.status === 'approved' && <TouchableOpacity style={[styles.actionBtn, styles.payBtn]} onPress={() => handlePay(selectedExpense)}>
                                            <MaterialIcons name="attach-money" size={20} color="#fff" />
                                            <Text style={styles.actionText}>Mark Paid</Text>
                                        </TouchableOpacity>}
                                </View>
                            </>}
                    </View>
                </View>
            </Modal>
            {/* --- DELETE REASON MODAL --- */}
            <Modal visible={isDeleteModalVisible} transparent={true} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Delete/Reject Expense</Text>
                        <Text style={styles.modalSubtitle}>Please provide a reason for the audit log.</Text>
                        <TextInput style={[styles.input, {
            height: 80,
            textAlignVertical: 'top'
          }]} placeholder="Reason (e.g. Unjustified, Budget exceeded)" multiline value={deleteReason} onChangeText={setDeleteReason} />
                        <View style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: 10,
            marginTop: 20
          }}>
                            <TouchableOpacity onPress={() => setIsDeleteModalVisible(false)} style={{
              padding: 10
            }}>
                                <Text style={{
                color: '#666'
              }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={confirmDelete} style={{
              backgroundColor: '#EF4444',
              padding: 10,
              borderRadius: 8
            }} disabled={deleting}>
                                {deleting ? <LogoLoader color="#fff" size={30} /> : <Text style={{
                color: '#fff',
                fontWeight: 'bold'
              }}>Confirm Action</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
    alignItems: 'center'
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    margin: 20,
    paddingHorizontal: 15,
    borderRadius: 12,
    height: 50,
    elevation: 2
  },
  searchIcon: {
    marginRight: 10
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937'
  },
  listContent: {
    padding: 20,
    paddingBottom: 100
  },
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    padding: 15,
    marginBottom: 15,
    elevation: 1
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  titleBox: {
    flex: 1
  },
  title: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1F2937'
  },
  date: {
    fontSize: 12,
    color: theme.colors.textSecondary
  },
  amount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#EF4444'
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.card,
    marginBottom: 10
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  descText: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    maxWidth: '70%'
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  sApproved: {
    backgroundColor: '#D1FAE5'
  },
  sPending: {
    backgroundColor: '#FEF3C7'
  },
  sPaid: {
    backgroundColor: '#DBEAFE'
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700'
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
    elevation: 5
  },
  emptyText: {
    color: theme.colors.textTertiary,
    fontSize: 16
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    width: '90%',
    backgroundColor: theme.colors.background,
    borderRadius: 20,
    padding: 20,
    elevation: 5,
    marginTop: 50
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827'
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 10
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 5,
    marginTop: 10
  },
  input: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#1F2937'
  },
  categoryRow: {
    flexDirection: 'row',
    paddingVertical: 5
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  catChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1'
  },
  catText: {
    fontSize: 13,
    color: theme.colors.textSecondary
  },
  catTextActive: {
    color: '#6366F1',
    fontWeight: 'bold'
  },
  submitBtn: {
    backgroundColor: theme.colors.primary,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20
  },
  submitBtnText: {
    color: theme.colors.background,
    fontWeight: 'bold',
    fontSize: 16
  },
  detailsCard: {
    width: '85%',
    backgroundColor: theme.colors.background,
    borderRadius: 20,
    padding: 25,
    elevation: 10
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    alignItems: 'center'
  },
  detailRowVertical: {
    marginBottom: 15
  },
  detailLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827'
  },
  detailLog: {
    backgroundColor: theme.colors.card,
    padding: 10,
    borderRadius: 8,
    marginTop: 5,
    fontSize: 14,
    color: '#374151'
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 20,
    justifyContent: 'space-around'
  },
  actionBtn: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    gap: 8
  },
  approveBtn: {
    backgroundColor: '#059669'
  },
  payBtn: {
    backgroundColor: '#2563EB'
  },
  actionText: {
    color: theme.colors.background,
    fontWeight: 'bold'
  },
  // Tab Styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    padding: 10,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 12,
    elevation: 1
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8
  },
  activeTabBtn: {
    backgroundColor: '#EEF2FF'
  },
  tabText: {
    fontWeight: '600',
    color: theme.colors.textSecondary
  },
  activeTabText: {
    color: '#6366F1',
    fontWeight: 'bold'
  }
});