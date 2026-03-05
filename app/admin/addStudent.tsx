import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, StatusBar, KeyboardAvoidingView, Platform, Alert, Modal, FlatList, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import AdminHeader from '../../src/components/AdminHeader';
import { ADMIN_THEME } from '../../src/constants/adminTheme';
import { StudentService, CreateStudentRequest } from '../../src/services/studentService';
import { ClassService, ClassInfo, Section, AcademicYear } from '../../src/services/classService';
import { GENDERS, BLOOD_GROUPS, RELIGIONS, STUDENT_CATEGORIES, STUDENT_STATUSES } from '../../src/constants/references';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';

// Reusable Components
const InputField = ({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType = 'default',
  icon,
  required = false,
  secureTextEntry = false
}: any) => {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  return <View style={styles.inputGroup}>
        <Text style={styles.label}>
            {label} {required && <Text style={{
        color: ADMIN_THEME.colors.danger
      }}>*</Text>}
        </Text>
        <View style={styles.inputWrapper}>
            <Ionicons name={icon} size={20} color={ADMIN_THEME.colors.text.muted} style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder={placeholder} placeholderTextColor={ADMIN_THEME.colors.text.muted} value={value} onChangeText={onChangeText} keyboardType={keyboardType as any} secureTextEntry={secureTextEntry} />
        </View>
    </View>;
};
const SelectField = ({
  label,
  value,
  options,
  onSelect,
  placeholder,
  icon,
  required = false,
  loading = false
}: any) => {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const [modalVisible, setModalVisible] = useState(false);
  const selectedOption = options.find((opt: any) => opt.id.toString() === value?.toString());
  return <View style={styles.inputGroup}>
        <Text style={styles.label}>
            {label} {required && <Text style={{
        color: ADMIN_THEME.colors.danger
      }}>*</Text>}
        </Text>
        <TouchableOpacity style={styles.inputWrapper} onPress={() => {
      Keyboard.dismiss();
      if (!loading) setModalVisible(true);
    }} disabled={loading}>
            <Ionicons name={icon} size={20} color={ADMIN_THEME.colors.text.muted} style={styles.inputIcon} />
            <Text style={[styles.input, !selectedOption && {
        color: ADMIN_THEME.colors.text.muted
      }, {
        paddingTop: 12
      }]}>
                {loading ? 'Loading...' : selectedOption ? selectedOption.name : placeholder}
            </Text>
            <Ionicons name="chevron-down" size={20} color={ADMIN_THEME.colors.text.muted} />
        </TouchableOpacity>
        <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Select {label}</Text>
                        <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{
              top: 10,
              bottom: 10,
              left: 10,
              right: 10
            }}>
                            <Ionicons name="close" size={24} color={ADMIN_THEME.colors.text.primary} />
                        </TouchableOpacity>
                    </View>
                    <FlatList data={options} keyExtractor={(item) => item.id.toString()} contentContainerStyle={{
            paddingBottom: 50
          }} renderItem={({
            item
          }) => {
            return <TouchableOpacity style={[styles.optionItem, value?.toString() === item.id.toString() && styles.selectedOption]} onPress={() => {
              onSelect(item.id);
              setModalVisible(false);
            }}>
                            <Text style={[styles.optionText, value?.toString() === item.id.toString() && styles.selectedOptionText]}>
                                {item.name}
                            </Text>
                            {value?.toString() === item.id.toString() && <Ionicons name="checkmark" size={20} color={ADMIN_THEME.colors.primary} />}
                        </TouchableOpacity>;
          }} />
                </View>
            </View>
        </Modal>
    </View>;
};
export default function AddStudentScreen() {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const router = useRouter();
  const {
    id
  } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);

  // Form State
  const [formData, setFormData] = useState<CreateStudentRequest>({
    first_name: '',
    middle_name: '',
    last_name: '',
    dob: '',
    gender_id: 1,
    // Default: Male
    admission_no: '',
    admission_date: new Date().toISOString().split('T')[0],
    status_id: 1,
    // Default: Active
    category_id: 1,
    // Default: General
    religion_id: 1,
    // Default: Hindu
    blood_group_id: 1,
    // Default: A+
    email: '',
    phone: '',
    password: '',
    role_code: 'student',
    class_id: '',
    section_id: '',
    academic_year_id: ''
  });

  // Reference Data State
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);

  // Date Picker State
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [showAdmissionDatePicker, setShowAdmissionDatePicker] = useState(false);

  // Parent State
  const [father, setFather] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    occupation: ''
  });
  const [mother, setMother] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    occupation: ''
  });
  const [guardian, setGuardian] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    relation: '',
    occupation: ''
  }); // Guardian needs custom relation? Or just 'Guardian'

  useEffect(() => {
    loadReferenceData();
    if (id) {
      setIsEditMode(true);
      loadStudentData(id as string);
    }
  }, [id]);
  const loadReferenceData = async () => {
    try {
      const [classesData, sectionsData, yearsData] = await Promise.all([ClassService.getClasses(), ClassService.getSections(), ClassService.getAcademicYears()]);
      setClasses(classesData);
      setSections(sectionsData);
      setAcademicYears(yearsData);

      // Set current academic year as default
      const currentYear = yearsData.find((y) => {
        const now = new Date();
        return new Date(y.start_date) <= now && new Date(y.end_date) >= now;
      });
      if (currentYear) {
        setFormData((prev) => ({
          ...prev,
          academic_year_id: currentYear.id
        }));
      }
    } catch (error) {

      Alert.alert('Error', 'Failed to load classes and academic years');
    } finally {
      setInitialLoading(false);
    }
  };
  const loadStudentData = async (studentId: string) => {
    try {
      const data: any = await StudentService.getById(studentId);
      if (data) {
        setFormData({
          first_name: data.first_name || '',
          middle_name: data.middle_name || '',
          last_name: data.last_name || '',
          dob: data.dob || '',
          gender_id: data.gender_id || 1,
          admission_no: data.admission_no || '',
          admission_date: data.admission_date || '',
          status_id: data.status_id || 1,
          category_id: data.category_id || 1,
          religion_id: data.religion_id || 1,
          blood_group_id: data.blood_group_id || 1,
          email: data.email || '',
          phone: data.phone || '',
          password: '',
          academic_year_id: data.current_enrollment?.academic_year_id || data.academic_year_id || formData.academic_year_id,
          role_code: 'student',
          class_id: data.current_enrollment?.class_id || '',
          section_id: data.current_enrollment?.section_id || '',
          // 🆕 Roll Number
          roll_number: data.current_enrollment?.roll_number
        } as any);
      }
    } catch (error) {

      Alert.alert('Error', 'Failed to load student details');
    }
  };
  const handleSave = async () => {
    // Validation
    if (!formData.first_name || !formData.last_name || !formData.admission_no || !formData.admission_date || !formData.class_id || !formData.section_id) {
      Alert.alert('Required Fields', 'Please fill all mandatory fields (Name, Admission No, Class, Section)');
      return;
    }
    if (!isEditMode && !formData.password) {
      Alert.alert('Security', 'Password is required for new students');
      return;
    }

    // Password length check
    if (formData.password && formData.password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters long.');
      return;
    }

    // Email format validation
    if (formData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        Alert.alert('Invalid Email', 'Please enter a valid email address.');
        return;
      }
    }

    // Phone number validation (10 digits)
    if (formData.phone) {
      const phoneClean = formData.phone.replace(/\D/g, '');
      if (phoneClean.length < 10) {
        Alert.alert('Invalid Phone', 'Phone number must be at least 10 digits.');
        return;
      }
    }

    // DOB: prevent future dates
    if (formData.dob) {
      const dobDate = new Date(formData.dob);
      if (dobDate > new Date()) {
        Alert.alert('Invalid DOB', 'Date of birth cannot be in the future.');
        return;
      }
    }
    setLoading(true);
    try {
      const parents: NonNullable<CreateStudentRequest['parents']> = [];
      if (father.first_name && father.last_name) {
        parents.push({
          ...father,
          relation: 'Father' as const,
          is_primary: true
        });
      }
      if (mother.first_name && mother.last_name) {
        parents.push({
          ...mother,
          relation: 'Mother' as const
        });
      }
      if (guardian.first_name && guardian.last_name) {
        parents.push({
          ...guardian,
          relation: 'Guardian' as const,
          is_guardian: true
        });
      }
      const payload: CreateStudentRequest = {
        ...formData,
        parents
      };
      if (isEditMode) {
        await StudentService.update(id as string, payload as any);
        Alert.alert('Success', 'Student updated successfully!', [{
          text: 'OK',
          onPress: () => router.back()
        }]);
      } else {
        await StudentService.create(payload);
        Alert.alert('Success', 'Student created successfully!', [{
          text: 'OK',
          onPress: () => router.back()
        }]);
      }
    } catch (error: any) {
      if (__DEV__) {}
      const msg = error.response?.data?.error || error.message || 'Failed to save student';
      Alert.alert('Save Failed', msg);
    } finally {
      setLoading(false);
    }
  };
  const onDobChange = (event: any, selectedDate?: Date) => {
    setShowDobPicker(false);
    if (selectedDate) {
      setFormData({
        ...formData,
        dob: selectedDate.toISOString().split('T')[0]
      });
    }
  };
  const onAdmissionDateChange = (event: any, selectedDate?: Date) => {
    setShowAdmissionDatePicker(false);
    if (selectedDate) {
      setFormData({
        ...formData,
        admission_date: selectedDate.toISOString().split('T')[0]
      });
    }
  };
  if (initialLoading) {
    return <View style={styles.loadingContainer}>
            <LogoLoader size={60} color={ADMIN_THEME.colors.primary} />
            <Text style={styles.loadingText}>Initializing form...</Text>
        </View>;
  }
  return <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <AdminHeader title={isEditMode ? "Edit Student" : "Add Student"} showBackButton={true} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{
      flex: 1
    }}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Header Info Card */}
                <LinearGradient colors={[ADMIN_THEME.colors.primary, ADMIN_THEME.colors.secondary]} style={styles.headerCard} start={{
          x: 0,
          y: 0
        }} end={{
          x: 1,
          y: 1
        }}>
                    <Ionicons name="school" size={40} color="#fff" />
                    <Text style={styles.headerTitle}>{isEditMode ? 'Update Record' : 'Enroll New Student'}</Text>
                    <Text style={styles.headerSubtitle}>
                        {isEditMode ? 'Modify existing student profile' : 'Add a new student to the school database'}
                    </Text>
                </LinearGradient>
                {/* Section: Personal Details */}
                <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.section}>
                    <Text style={styles.sectionHeader}>Personal Details</Text>
                    <View style={styles.row}>
                        <View style={styles.halfInput}>
                            <InputField label="First Name" placeholder="John" value={formData.first_name} onChangeText={(t: string) => setFormData({
                ...formData,
                first_name: t
              })} icon="person-outline" required={true} />
                        </View>
                        <View style={styles.halfInput}>
                            <InputField label="Last Name" placeholder="Doe" value={formData.last_name} onChangeText={(t: string) => setFormData({
                ...formData,
                last_name: t
              })} icon="person-outline" required={true} />
                        </View>
                    </View>
                    <InputField label="Middle Name" placeholder="Optional" value={formData.middle_name} onChangeText={(t: string) => setFormData({
            ...formData,
            middle_name: t
          })} icon="person-outline" />
                    <SelectField label="Gender" value={formData.gender_id} options={GENDERS} onSelect={(id: number) => setFormData({
            ...formData,
            gender_id: id
          })} icon="transgender-outline" required={true} />
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Date of Birth</Text>
                        <TouchableOpacity style={styles.inputWrapper} onPress={() => setShowDobPicker(true)}>
                            <Ionicons name="calendar-outline" size={20} color={ADMIN_THEME.colors.text.muted} style={styles.inputIcon} />
                            <Text style={[styles.input, !formData.dob && {
                color: ADMIN_THEME.colors.text.muted
              }, {
                paddingTop: 12
              }]}>
                                {formData.dob || 'Select Date'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
                {/* Section: Academic Info */}
                <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.section}>
                    <Text style={styles.sectionHeader}>Academic Information</Text>
                    <InputField label="Admission Number" placeholder="ADM2024001" value={formData.admission_no} onChangeText={(t: string) => setFormData({
            ...formData,
            admission_no: t
          })} icon="card-outline" required={true} />
                    {/* 🆕 Roll Number Field */}
                    <InputField label="Roll Number" placeholder="Auto-generated" value={(formData as any).roll_number ? String((formData as any).roll_number) : 'Auto-generated'} editable={false} icon="list-outline" />
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Admission Date</Text>
                        <TouchableOpacity style={styles.inputWrapper} onPress={() => setShowAdmissionDatePicker(true)}>
                            <Ionicons name="calendar-outline" size={20} color={ADMIN_THEME.colors.text.muted} style={styles.inputIcon} />
                            <Text style={[styles.input, !formData.admission_date && {
                color: ADMIN_THEME.colors.text.muted
              }, {
                paddingTop: 12
              }]}>
                                {formData.admission_date || 'Select Date'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    <SelectField label="Class" value={formData.class_id} options={classes} onSelect={(id: string) => setFormData({
            ...formData,
            class_id: id
          })} placeholder="Select Class" icon="business-outline" required={true} />
                    <SelectField label="Section" value={formData.section_id} options={sections} onSelect={(id: string) => setFormData({
            ...formData,
            section_id: id
          })} placeholder="Select Section" icon="grid-outline" required={true} />
                    <SelectField label="Student Status" value={formData.status_id} options={STUDENT_STATUSES} onSelect={(id: number) => setFormData({
            ...formData,
            status_id: id
          })} icon="shield-checkmark-outline" required={true} />
                    <SelectField label="Academic Year" value={formData.academic_year_id} options={academicYears.map((y) => ({
            id: y.id,
            name: y.code
          }))} onSelect={(id: string) => setFormData({
            ...formData,
            academic_year_id: id
          })} placeholder="Select Year" icon="time-outline" required={true} />
                </Animated.View>
                {/* Section: Parent Details */}
                <Animated.View entering={FadeInDown.delay(150).duration(500)} style={styles.section}>
                    <Text style={styles.sectionHeader}>Parent / Guardian Details</Text>
                    {/* Father */}
                    <Text style={[styles.label, {
            marginTop: 10,
            color: ADMIN_THEME.colors.primary
          }]}>Father's Details</Text>
                    <View style={styles.row}>
                        <View style={styles.halfInput}>
                            <InputField label="First Name" placeholder="Father Name" value={father.first_name} onChangeText={(t: string) => setFather({
                ...father,
                first_name: t
              })} icon="person-outline" />
                        </View>
                        <View style={styles.halfInput}>
                            <InputField label="Last Name" placeholder="Surname" value={father.last_name} onChangeText={(t: string) => setFather({
                ...father,
                last_name: t
              })} icon="person-outline" />
                        </View>
                    </View>
                    <InputField label="Phone" placeholder="Mobile Number" value={father.phone} onChangeText={(t: string) => setFather({
            ...father,
            phone: t
          })} keyboardType="phone-pad" icon="call-outline" />
                    <InputField label="Occupation" placeholder="Designation" value={father.occupation} onChangeText={(t: string) => setFather({
            ...father,
            occupation: t
          })} icon="briefcase-outline" />
                    {/* Mother */}
                    <Text style={[styles.label, {
            marginTop: 20,
            color: ADMIN_THEME.colors.primary
          }]}>Mother's Details</Text>
                    <View style={styles.row}>
                        <View style={styles.halfInput}>
                            <InputField label="First Name" placeholder="Mother Name" value={mother.first_name} onChangeText={(t: string) => setMother({
                ...mother,
                first_name: t
              })} icon="person-outline" />
                        </View>
                        <View style={styles.halfInput}>
                            <InputField label="Last Name" placeholder="Surname" value={mother.last_name} onChangeText={(t: string) => setMother({
                ...mother,
                last_name: t
              })} icon="person-outline" />
                        </View>
                    </View>
                    <InputField label="Phone" placeholder="Mobile Number" value={mother.phone} onChangeText={(t: string) => setMother({
            ...mother,
            phone: t
          })} keyboardType="phone-pad" icon="call-outline" />
                    <InputField label="Occupation" placeholder="Designation" value={mother.occupation} onChangeText={(t: string) => setMother({
            ...mother,
            occupation: t
          })} icon="briefcase-outline" />
                </Animated.View>
                {/* Section: Additional Details */}
                <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.section}>
                    <Text style={styles.sectionHeader}>Additional Details</Text>
                    <SelectField label="Category" value={formData.category_id} options={STUDENT_CATEGORIES} onSelect={(id: number) => setFormData({
            ...formData,
            category_id: id
          })} icon="list-outline" />
                    <SelectField label="Religion" value={formData.religion_id} options={RELIGIONS} onSelect={(id: number) => setFormData({
            ...formData,
            religion_id: id
          })} icon="heart-outline" />
                    <SelectField label="Blood Group" value={formData.blood_group_id} options={BLOOD_GROUPS} onSelect={(id: number) => setFormData({
            ...formData,
            blood_group_id: id
          })} icon="water-outline" />
                </Animated.View>
                {/* Section: Contact & Login */}
                <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.section}>
                    <Text style={styles.sectionHeader}>Contact & Login Credentials</Text>
                    <InputField label="Email Address (Login ID)" placeholder="student@example.com" value={formData.email} onChangeText={(t: string) => setFormData({
            ...formData,
            email: t
          })} keyboardType="email-address" icon="mail-outline" />
                    <InputField label="Phone Number" placeholder="+91 9876543210" value={formData.phone} onChangeText={(t: string) => setFormData({
            ...formData,
            phone: t
          })} keyboardType="phone-pad" icon="call-outline" />
                    {!isEditMode && <InputField label="Initial Password" placeholder="Min 6 characters" value={formData.password} onChangeText={(t: string) => setFormData({
            ...formData,
            password: t
          })} icon="lock-closed-outline" required={true} secureTextEntry={true} />}
                </Animated.View>
                {/* Submit Button */}
                <TouchableOpacity style={[styles.saveButton, loading && styles.saveButtonDisabled]} activeOpacity={0.8} onPress={handleSave} disabled={loading}>
                    {loading ? <LogoLoader color="#fff" /> : <>
                        <Text style={styles.saveButtonText}>
                            {isEditMode ? 'Update Student' : 'Create Student Profile'}
                        </Text>
                        <Ionicons name="checkmark-circle" size={24} color="#fff" style={{
              marginLeft: 8
            }} />
                    </>}
                </TouchableOpacity>
                {/* Date Pickers */}
                {showDobPicker && <DateTimePicker value={formData.dob ? new Date(formData.dob) : new Date()} mode="date" display="default" onChange={onDobChange} maximumDate={new Date()} />}
                {showAdmissionDatePicker && <DateTimePicker value={formData.admission_date ? new Date(formData.admission_date) : new Date()} mode="date" display="default" onChange={onAdmissionDateChange} maximumDate={new Date()} />}
            </ScrollView>
        </KeyboardAvoidingView>
    </View>;
}
const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ADMIN_THEME.colors.background.app
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background
  },
  loadingText: {
    marginTop: 10,
    color: ADMIN_THEME.colors.text.secondary,
    fontSize: 16
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 50
  },
  headerCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.background,
    marginTop: 12
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 8,
    textAlign: 'center'
  },
  section: {
    backgroundColor: theme.colors.background,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    ...ADMIN_THEME.shadows.sm
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: ADMIN_THEME.colors.text.primary,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_THEME.colors.border,
    paddingBottom: 8
  },
  row: {
    flexDirection: 'row',
    gap: 12
  },
  halfInput: {
    flex: 1
  },
  inputGroup: {
    marginBottom: 16
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: ADMIN_THEME.colors.text.secondary,
    marginBottom: 8
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ADMIN_THEME.colors.background.subtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ADMIN_THEME.colors.border,
    paddingHorizontal: 15,
    height: 50
  },
  inputIcon: {
    marginRight: 10
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: ADMIN_THEME.colors.text.primary
  },
  saveButton: {
    backgroundColor: ADMIN_THEME.colors.primary,
    borderRadius: 15,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    ...ADMIN_THEME.shadows.md
  },
  saveButtonDisabled: {
    opacity: 0.7
  },
  saveButtonText: {
    color: theme.colors.background,
    fontSize: 18,
    fontWeight: 'bold'
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
    maxHeight: '80%',
    width: '100%'
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
    color: ADMIN_THEME.colors.text.primary
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_THEME.colors.border
  },
  selectedOption: {
    backgroundColor: ADMIN_THEME.colors.background.subtle
  },
  optionText: {
    fontSize: 16,
    color: ADMIN_THEME.colors.text.secondary
  },
  selectedOptionText: {
    color: ADMIN_THEME.colors.primary,
    fontWeight: '600'
  }
});