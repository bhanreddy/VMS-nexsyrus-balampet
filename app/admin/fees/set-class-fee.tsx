import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AdminHeader from '../../../src/components/AdminHeader';
import { ADMIN_THEME } from '../../../src/constants/adminTheme';
import { useAuth } from '../../../src/hooks/useAuth';
import { ClassService, AcademicYear } from '../../../src/services/classService';
import { FeeService, FeeType } from '../../../src/services/feeService';
import { api } from '../../../src/services/apiClient';
import { Class } from '../../../src/types/schema';
import { useTheme } from '../../../src/hooks/useTheme';
import { Theme } from '../../../src/theme/themes';
import LogoLoader from '../../../src/components/LogoLoader';
export default function SetClassFeeScreen() {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const router = useRouter();
  const {
    user
  } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [classes, setClasses] = useState<Class[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [amount, setAmount] = useState('');
  const [feeTypeId, setFeeTypeId] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedYearId, setSelectedYearId] = useState('');
  useEffect(() => {
    loadInitialData();
  }, []);
  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [classesData, typesData, yearsData] = await Promise.all([ClassService.getClasses(), api.get<FeeType[]>('/fees/types'),
      // Helper route if exists, or FeeService expansion
      ClassService.getAcademicYears()]);
      setClasses(classesData);
      setFeeTypes(typesData);
      setAcademicYears(yearsData);
      if (yearsData.length > 0) {
        const current = yearsData.find((y) => {
          const now = new Date();
          return new Date(y.start_date) <= now && new Date(y.end_date) >= now;
        });
        setSelectedYearId(current?.id || yearsData[0].id);
      }
    } catch (error) {

      Alert.alert('Error', 'Failed to load configuration data');
    } finally {
      setLoading(false);
    }
  };
  const handleSubmit = async () => {
    if (!selectedClassId || !amount || !feeTypeId || !selectedYearId) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }
    try {
      setSubmitting(true);
      await FeeService.createStructure({
        class_id: selectedClassId,
        amount: Number(amount),
        fee_type_id: feeTypeId,
        due_date: dueDate,
        academic_year_id: selectedYearId
      });
      Alert.alert('Success', 'Class fee structure saved successfully', [{
        text: 'OK',
        onPress: () => router.back()
      }]);
    } catch (error: any) {
      Alert.alert('Error', error.result?.error || error.message || 'Failed to save fee structure');
    } finally {
      setSubmitting(false);
    }
  };
  return <View style={styles.container}>
            <AdminHeader title="Set Class Fee" showBackButton />
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Fee Details</Text>
                    {/* Class Selector */}
                    <Text style={styles.label}>Select Class</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.classScroll}>
                        {classes.map((cls) => {
            return <TouchableOpacity key={cls.id} style={[styles.classChip, selectedClassId === cls.id && styles.classChipActive]} onPress={() => setSelectedClassId(cls.id)}>
                                <Text style={[styles.classChipText, selectedClassId === cls.id && styles.classChipTextActive]}>
                                    {cls.name}
                                </Text>
                            </TouchableOpacity>;
          })}
                    </ScrollView>
                    {/* Fee Type Selector */}
                    <Text style={styles.label}>Fee Type</Text>
                    <View style={styles.typeGrid}>
                        {feeTypes.map((type) => {
            return <TouchableOpacity key={type.id} style={[styles.typeChip, feeTypeId === type.id && styles.typeChipActive]} onPress={() => setFeeTypeId(type.id)}>
                                <Text style={[styles.typeChipText, feeTypeId === type.id && styles.typeChipTextActive]}>
                                    {type.name}
                                </Text>
                            </TouchableOpacity>;
          })}
                    </View>
                    {/* Amount Input */}
                    <Text style={styles.label}>Amount (₹)</Text>
                    <TextInput style={styles.input} value={amount} onChangeText={setAmount} placeholder="Enter amount" keyboardType="numeric" />
                    {/* Due Date Input */}
                    <Text style={styles.label}>Due Date (YYYY-MM-DD)</Text>
                    <TextInput style={styles.input} value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" />
                    {/* Academic Year Selector */}
                    <Text style={styles.label}>Academic Year</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.classScroll}>
                        {academicYears.map((ay) => {
            return <TouchableOpacity key={ay.id} style={[styles.classChip, selectedYearId === ay.id && styles.classChipActive]} onPress={() => setSelectedYearId(ay.id)}>
                                <Text style={[styles.classChipText, selectedYearId === ay.id && styles.classChipTextActive]}>
                                    {ay.code}
                                </Text>
                            </TouchableOpacity>;
          })}
                    </ScrollView>
                    <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
                        {submitting ? <LogoLoader color="#fff" /> : <Text style={styles.submitBtnText}>Save Fee Structure</Text>}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>;
}
const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ADMIN_THEME.colors.background.app
  },
  content: {
    padding: 20
  },
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    padding: 20,
    ...ADMIN_THEME.shadows.md
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: ADMIN_THEME.colors.text.primary,
    marginBottom: 20
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: ADMIN_THEME.colors.text.secondary,
    marginBottom: 8,
    marginTop: 12
  },
  input: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1F2937'
  },
  classScroll: {
    flexDirection: 'row',
    marginBottom: 10
  },
  classChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  classChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: ADMIN_THEME.colors.primary
  },
  classChipText: {
    color: theme.colors.textSecondary,
    fontWeight: '500'
  },
  classChipTextActive: {
    color: ADMIN_THEME.colors.primary,
    fontWeight: '700'
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  typeChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: ADMIN_THEME.colors.primary
  },
  typeChipText: {
    fontSize: 13,
    color: theme.colors.textSecondary
  },
  typeChipTextActive: {
    color: ADMIN_THEME.colors.primary,
    fontWeight: '600'
  },
  submitBtn: {
    backgroundColor: ADMIN_THEME.colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24
  },
  submitBtnText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: 'bold'
  }
});