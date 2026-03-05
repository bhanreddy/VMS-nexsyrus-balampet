import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Assuming Expo
import ScreenLayout from '../../src/components/ScreenLayout';
import AdminHeader from '../../src/components/AdminHeader';
import { ADMIN_THEME } from '../../src/constants/adminTheme';
import { useAuth } from '../../src/hooks/useAuth';
import { api } from '../../src/services/apiClient';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';
const COLORS = ADMIN_THEME.colors;
const SHADOWS = ADMIN_THEME.shadows;
interface ClassItem {
  id: string;
  name: string;
}
interface PreviewStats {
  total_students: number;
  sample_message: string;
  batch_id?: string;
}
const FeeRemindersAdmin = () => {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const {
    user
  } = useAuth();
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('default', {
    month: 'long'
  }));
  const [previewStats, setPreviewStats] = useState<PreviewStats | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  useEffect(() => {
    fetchClasses();
  }, []);
  useEffect(() => {
    if (selectedMonth) {
      fetchPreview();
    }
  }, [selectedMonth, selectedClass]);
  const fetchClasses = async () => {
    try {
      // Fetch classes from your existing API
      // For now, mocking or using a known endpoint if available. 
      // Assuming /academics/classes exists based on routes.
      const response = await api.get('/academics/classes');
      setClasses(response as ClassItem[]);
    } catch (error) {

    }
  };
  const fetchPreview = async () => {
    setLoading(true);
    try {
      const payload = {
        month: selectedMonth,
        filters: selectedClass ? {
          class_id: selectedClass
        } : {},
        dryRun: true
      };
      const response = await api.post('/admin/notifications/fees/send-all', payload);
      setPreviewStats(response as PreviewStats);
    } catch (error: any) {

      if (error.statusCode === 429) {
        Alert.alert('Limit Reached', 'Daily limit reached for this batch type.');
      }
    } finally {
      setLoading(false);
    }
  };
  const handleSendAll = async () => {
    setModalVisible(false);
    setLoading(true);
    try {
      const payload = {
        month: selectedMonth,
        filters: selectedClass ? {
          class_id: selectedClass
        } : {},
        dryRun: false
      };
      const response = await api.post('/admin/notifications/fees/send-all', payload);
      const data = response as {
        batch_id: string;
      };
      setBatchId(data.batch_id);
      Alert.alert('Success', `Batch processing started. Batch ID: ${data.batch_id}`);
      // Optionally redirect to a "Batch Status" page or just reset
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send notifications');
    } finally {
      setLoading(false);
    }
  };
  return <ScreenLayout>
            <AdminHeader title="Fee Reminders" showBackButton={true} />
            <ScrollView style={styles.container}>
                {/* Month Selection */}
                <View style={styles.section}>
                    <Text style={styles.label}>Select Month</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthSelector}>
                        {months.map((month) => {
            return <TouchableOpacity key={month} style={[styles.monthChip, selectedMonth === month && styles.selectedMonth]} onPress={() => setSelectedMonth(month)}>
                                <Text style={[styles.monthText, selectedMonth === month && styles.selectedMonthText]}>{month}</Text>
                            </TouchableOpacity>;
          })}
                    </ScrollView>
                </View>
                {/* Class Filter */}
                <View style={styles.section}>
                    <Text style={styles.label}>Filter by Class (Optional)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.classSelector}>
                        <TouchableOpacity style={[styles.classChip, !selectedClass && styles.selectedClass]} onPress={() => setSelectedClass(null)}>
                            <Text style={[styles.classText, !selectedClass && styles.selectedClassText]}>All Classes</Text>
                        </TouchableOpacity>
                        {classes.map((cls) => {
            return <TouchableOpacity key={cls.id} style={[styles.classChip, selectedClass === cls.id && styles.selectedClass]} onPress={() => setSelectedClass(cls.id)}>
                                <Text style={[styles.classText, selectedClass === cls.id && styles.selectedClassText]}>{cls.name}</Text>
                            </TouchableOpacity>;
          })}
                    </ScrollView>
                </View>
                {/* Preview Stats */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Preview</Text>
                    {loading && !previewStats ? <LogoLoader /> : <View>
                            <View style={styles.statRow}>
                                <Text>Target Students:</Text>
                                <Text style={styles.statValue}>{previewStats?.total_students || 0}</Text>
                            </View>
                            <View style={styles.divider} />
                            <Text style={styles.sampleLabel}>Sample Message:</Text>
                            <Text style={styles.sampleText}>{previewStats?.sample_message || '-'}</Text>
                        </View>}
                </View>
                {/* Send Button */}
                <TouchableOpacity style={[styles.sendButton, (loading || !previewStats?.total_students) && styles.disabledButton]} disabled={loading || !previewStats?.total_students} onPress={() => setModalVisible(true)}>
                    <Text style={styles.sendButtonText}>{loading ? 'Processing...' : 'SEND ALL REMINDERS'}</Text>
                </TouchableOpacity>
                {/* Confirmation Modal */}
                <Modal visible={modalVisible} transparent animationType="slide">
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Ionicons name="warning" size={48} color={COLORS.danger || 'red'} />
                            <Text style={styles.modalTitle}>Confirm Bulk Send?</Text>
                            <Text style={styles.modalText}>
                                You are about to send fee reminders to <Text style={{
                fontWeight: 'bold'
              }}>{previewStats?.total_students}</Text> students for <Text style={{
                fontWeight: 'bold'
              }}>{selectedMonth}</Text>.
                            </Text>
                            <Text style={styles.modalSubText}>This action cannot be undone.</Text>
                            <View style={styles.modalActions}>
                                <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                                    <Text style={styles.cancelButtonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.confirmButton} onPress={handleSendAll}>
                                    <Text style={styles.confirmButtonText}>CONFIRM SEND</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </ScrollView>
        </ScreenLayout>;
};
export default FeeRemindersAdmin;
const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    padding: 16
  },
  section: {
    marginBottom: 20
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: theme.colors.text
  },
  monthSelector: {
    flexDirection: 'row'
  },
  monthChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#eee',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ddd'
  },
  selectedMonth: {
    backgroundColor: '#007bff',
    borderColor: '#0056b3'
  },
  monthText: {
    color: theme.colors.text
  },
  selectedMonthText: {
    color: theme.colors.background
  },
  classSelector: {
    flexDirection: 'row'
  },
  classChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#eee',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ddd'
  },
  selectedClass: {
    backgroundColor: '#007bff',
    borderColor: '#0056b3'
  },
  classText: {
    color: theme.colors.text
  },
  selectedClassText: {
    color: theme.colors.background
  },
  card: {
    backgroundColor: theme.colors.background,
    padding: 20,
    borderRadius: 10,
    ...SHADOWS.md,
    marginBottom: 20
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007bff'
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 15
  },
  sampleLabel: {
    fontWeight: 'bold',
    marginBottom: 5,
    color: theme.colors.textSecondary
  },
  sampleText: {
    fontStyle: 'italic',
    color: '#444'
  },
  sendButton: {
    backgroundColor: COLORS.primary || '#007bff',
    padding: 18,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 40
  },
  disabledButton: {
    backgroundColor: '#ccc'
  },
  sendButtonText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: 'bold'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    width: '85%',
    backgroundColor: theme.colors.background,
    borderRadius: 20,
    padding: 25,
    alignItems: 'center'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 10
  },
  modalText: {
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 5,
    color: theme.colors.text
  },
  modalSubText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginBottom: 20
  },
  modalActions: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between'
  },
  cancelButton: {
    flex: 1,
    padding: 15,
    alignItems: 'center',
    marginRight: 10
  },
  cancelButtonText: {
    color: theme.colors.textSecondary,
    fontWeight: 'bold'
  },
  confirmButton: {
    flex: 1,
    backgroundColor: 'red',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center'
  },
  confirmButtonText: {
    color: theme.colors.background,
    fontWeight: 'bold'
  }
});