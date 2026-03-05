import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, StatusBar, KeyboardAvoidingView,
  Platform, Alert, Modal, FlatList, Keyboard, Pressable,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, {
  FadeInDown, FadeIn,
  useAnimatedStyle, useSharedValue,
  withTiming, withSpring, interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import AdminHeader from '../../src/components/AdminHeader';
import { ADMIN_THEME } from '../../src/constants/adminTheme';
import { StudentService, CreateStudentRequest } from '../../src/services/studentService';
import { ClassService, ClassInfo, Section, AcademicYear } from '../../src/services/classService';
import { GENDERS, BLOOD_GROUPS, RELIGIONS, STUDENT_CATEGORIES, STUDENT_STATUSES } from '../../src/constants/references';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';

const { width: SW } = Dimensions.get('window');

// ─── Section accent colors ────────────────────────────────────────────────────
const SECTION_COLORS = {
  personal: { accent: '#3B82F6', light: '#EFF6FF', dark: '#1E3A5F' },
  academic: { accent: '#10B981', light: '#ECFDF5', dark: '#064E3B' },
  parents: { accent: '#F59E0B', light: '#FFFBEB', dark: '#78350F' },
  additional: { accent: '#8B5CF6', light: '#F5F3FF', dark: '#2E1065' },
  credentials: { accent: '#EF4444', light: '#FEF2F2', dark: '#7F1D1D' },
};

// ─── Avatar gradient palettes per gender ─────────────────────────────────────
const AVATAR_GRADS: Record<number, [string, string]> = {
  1: ['#3B82F6', '#6366F1'],  // Male — blue/indigo
  2: ['#EC4899', '#F43F5E'],  // Female — pink/rose
  3: ['#10B981', '#14B8A6'],  // Other — teal
};

// ─── Floating Label InputField ────────────────────────────────────────────────
const InputField = ({
  label, placeholder, value, onChangeText,
  keyboardType = 'default', icon, required = false,
  secureTextEntry = false, editable = true, accentColor = '#3B82F6',
}: any) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);

  const focused = useSharedValue(0);
  const hasValue = value && value.length > 0;

  const borderAnim = useAnimatedStyle(() => ({
    borderColor: focused.value === 1
      ? accentColor
      : isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
    borderWidth: focused.value === 1 ? 1.5 : 1,
  }));

  const iconAnim = useAnimatedStyle(() => ({
    opacity: interpolate(focused.value, [0, 1], [0.45, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.label, hasValue || focused ? { color: isDark ? '#94A3B8' : '#64748B' } : {}]}>
        {label}{required && <Text style={{ color: '#EF4444' }}> *</Text>}
      </Text>
      <Animated.View style={[styles.inputWrapper, borderAnim, !editable && styles.inputWrapperDisabled]}>
        <Animated.View style={[{ marginRight: 10 }, iconAnim]}>
          <Ionicons name={icon} size={18} color={focused.value === 1 ? accentColor : (isDark ? '#64748B' : '#94A3B8')} />
        </Animated.View>
        <TextInput
          style={[styles.input, !editable && styles.inputDisabled]}
          placeholder={placeholder}
          placeholderTextColor={isDark ? '#374151' : '#CBD5E1'}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType as any}
          secureTextEntry={secureTextEntry}
          editable={editable}
          onFocus={() => { focused.value = withTiming(1, { duration: 180 }); }}
          onBlur={() => { focused.value = withTiming(0, { duration: 200 }); }}
        />
        {!editable && (
          <Ionicons name="lock-closed-outline" size={14} color={isDark ? '#374151' : '#CBD5E1'} />
        )}
      </Animated.View>
    </View>
  );
};

// ─── Enhanced SelectField with search ────────────────────────────────────────
const SelectField = ({
  label, value, options, onSelect, placeholder,
  icon, required = false, loading = false, accentColor = '#3B82F6',
}: any) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedOption = options.find((opt: any) => opt.id.toString() === value?.toString());
  const filtered = searchQuery.trim()
    ? options.filter((o: any) => o.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : options;

  const chevronAnim = useAnimatedStyle(() => ({
    transform: [{ rotate: modalVisible ? '180deg' : '0deg' }],
  }));

  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>
        {label}{required && <Text style={{ color: '#EF4444' }}> *</Text>}
      </Text>
      <Pressable
        style={({ pressed }) => [
          styles.inputWrapper,
          { borderColor: selectedOption ? accentColor : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)') },
          { borderWidth: selectedOption ? 1.5 : 1 },
          pressed && { opacity: 0.85 },
        ]}
        onPress={() => { Keyboard.dismiss(); if (!loading) setModalVisible(true); }}
        disabled={loading}
      >
        <View style={{ marginRight: 10 }}>
          <Ionicons name={icon} size={18} color={selectedOption ? accentColor : (isDark ? '#64748B' : '#94A3B8')} />
        </View>
        <Text style={[styles.input, !selectedOption && { color: isDark ? '#374151' : '#CBD5E1' }, { paddingTop: 0 }]}>
          {loading ? 'Loading…' : selectedOption ? selectedOption.name : placeholder}
        </Text>
        {selectedOption ? (
          <View style={[styles.selectedBadge, { backgroundColor: accentColor + '20' }]}>
            <Ionicons name="checkmark" size={12} color={accentColor} />
          </View>
        ) : (
          <Animated.View style={chevronAnim}>
            <Ionicons name="chevron-down" size={16} color={isDark ? '#64748B' : '#94A3B8'} />
          </Animated.View>
        )}
      </Pressable>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={() => { }}>
            {/* Modal handle */}
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select {label}</Text>
                <Text style={styles.modalSubtitle}>{options.length} options available</Text>
              </View>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={18} color={isDark ? '#94A3B8' : '#64748B'} />
              </Pressable>
            </View>

            {/* Search bar — only show for lists > 5 */}
            {options.length > 5 && (
              <View style={styles.modalSearchWrap}>
                <Ionicons name="search-outline" size={16} color={isDark ? '#64748B' : '#94A3B8'} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.modalSearch}
                  placeholder={`Search ${label}...`}
                  placeholderTextColor={isDark ? '#374151' : '#CBD5E1'}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={16} color={isDark ? '#64748B' : '#94A3B8'} />
                  </Pressable>
                )}
              </View>
            )}

            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item, index }) => {
                const isSelected = value?.toString() === item.id.toString();
                return (
                  <Pressable
                    style={({ pressed }) => [
                      styles.optionItem,
                      isSelected && [styles.selectedOption, { backgroundColor: accentColor + '12' }],
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() => { onSelect(item.id); setModalVisible(false); setSearchQuery(''); }}
                  >
                    {isSelected && (
                      <View style={[styles.optionAccentBar, { backgroundColor: accentColor }]} />
                    )}
                    <Text style={[styles.optionText, isSelected && { color: accentColor, fontWeight: '700' }]}>
                      {item.name}
                    </Text>
                    {isSelected && (
                      <View style={[styles.optionCheck, { backgroundColor: accentColor }]}>
                        <Ionicons name="checkmark" size={11} color="#fff" />
                      </View>
                    )}
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <View style={styles.modalEmpty}>
                  <Ionicons name="search-outline" size={28} color={isDark ? '#374151' : '#CBD5E1'} />
                  <Text style={styles.modalEmptyText}>No results for "{searchQuery}"</Text>
                </View>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

// ─── Section Card ─────────────────────────────────────────────────────────────
const SectionCard = ({
  title, icon, colorKey, delay, children,
}: {
  title: string; icon: string; colorKey: keyof typeof SECTION_COLORS; delay: number; children: React.ReactNode;
}) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  const col = SECTION_COLORS[colorKey];

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(500).springify()} style={styles.sectionCard}>
      {/* Left accent bar */}
      <View style={[styles.sectionAccentBar, { backgroundColor: col.accent }]} />

      <View style={styles.sectionInner}>
        {/* Section header */}
        <View style={styles.sectionHeaderRow}>
          <View style={[styles.sectionIconWrap, { backgroundColor: isDark ? col.dark : col.light }]}>
            <Ionicons name={icon as any} size={16} color={col.accent} />
          </View>
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>

        {children}
      </View>
    </Animated.View>
  );
};

// ─── Progress Steps ───────────────────────────────────────────────────────────
const STEPS = ['Personal', 'Academic', 'Parents', 'Details', 'Login'];

const ProgressSteps = ({ activeStep, isDark }: { activeStep: number; isDark: boolean }) => (
  <View style={progressStyles.row}>
    {STEPS.map((step, i) => {
      const done = i < activeStep;
      const active = i === activeStep;
      return (
        <View key={step} style={progressStyles.stepWrap}>
          <View style={[
            progressStyles.dot,
            done && progressStyles.dotDone,
            active && progressStyles.dotActive,
            !done && !active && { backgroundColor: isDark ? '#1E293B' : '#E2E8F0', borderColor: isDark ? '#1E293B' : '#E2E8F0' },
          ]}>
            {done
              ? <Ionicons name="checkmark" size={9} color="#fff" />
              : <View style={[progressStyles.dotInner, active && progressStyles.dotInnerActive]} />
            }
          </View>
          <Text style={[
            progressStyles.label,
            active && progressStyles.labelActive,
            done && progressStyles.labelDone,
            !done && !active && { color: isDark ? '#374151' : '#CBD5E1' },
          ]}>{step}</Text>
          {i < STEPS.length - 1 && (
            <View style={[progressStyles.connector, done && progressStyles.connectorDone]} />
          )}
        </View>
      );
    })}
  </View>
);

const progressStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 20, marginBottom: 28, gap: 0 },
  stepWrap: { alignItems: 'center', flex: 1, position: 'relative' },
  dot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  dotActive: { borderColor: '#3B82F6', backgroundColor: '#3B82F6' },
  dotDone: { backgroundColor: '#10B981', borderColor: '#10B981' },
  dotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#CBD5E1' },
  dotInnerActive: { backgroundColor: '#fff' },
  label: { fontSize: 9, fontWeight: '600', marginTop: 5, letterSpacing: 0.2, textAlign: 'center' },
  labelActive: { color: '#3B82F6', fontWeight: '800' },
  labelDone: { color: '#10B981' },
  connector: { position: 'absolute', top: 10, left: '55%', right: '-55%', height: 2, backgroundColor: '#E2E8F0', zIndex: 0 },
  connectorDone: { backgroundColor: '#10B981' },
});

// ─── Live Avatar ──────────────────────────────────────────────────────────────
const LiveAvatar = ({ firstName, lastName, genderId, isDark }: any) => {
  const initials = [firstName?.[0], lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?';
  const grad = AVATAR_GRADS[genderId] || AVATAR_GRADS[1];

  return (
    <Animated.View entering={FadeIn.duration(400)} style={avatarStyles.wrap}>
      <LinearGradient colors={grad} style={avatarStyles.avatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        {/* Gloss */}
        <LinearGradient colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']} style={avatarStyles.gloss} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
        <Text style={avatarStyles.initials}>{initials}</Text>
      </LinearGradient>
      <View style={[avatarStyles.statusDot, { backgroundColor: '#10B981' }]} />
    </Animated.View>
  );
};

const avatarStyles = StyleSheet.create({
  wrap: { alignItems: 'center', marginBottom: 8 },
  avatar: { width: 80, height: 80, borderRadius: 26, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  gloss: { position: 'absolute', top: 0, left: 0, right: 0, height: 40, borderRadius: 26 },
  initials: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  statusDot: { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, borderWidth: 2.5, borderColor: '#fff' },
});

// ─── DateField ────────────────────────────────────────────────────────────────
const DateField = ({ label, value, onPress, required = false, accentColor = '#3B82F6', isDark }: any) => {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  const hasVal = !!value;
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}{required && <Text style={{ color: '#EF4444' }}> *</Text>}</Text>
      <Pressable
        style={({ pressed }) => [
          styles.inputWrapper,
          { borderColor: hasVal ? accentColor : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)') },
          { borderWidth: hasVal ? 1.5 : 1 },
          pressed && { opacity: 0.8 },
        ]}
        onPress={onPress}
      >
        <Ionicons name="calendar-outline" size={18} color={hasVal ? accentColor : (isDark ? '#64748B' : '#94A3B8')} style={{ marginRight: 10 }} />
        <Text style={[styles.input, !hasVal && { color: isDark ? '#374151' : '#CBD5E1' }]}>
          {value || 'Select date'}
        </Text>
        {hasVal && (
          <View style={[styles.selectedBadge, { backgroundColor: accentColor + '20' }]}>
            <Ionicons name="checkmark" size={12} color={accentColor} />
          </View>
        )}
      </Pressable>
    </View>
  );
};

// ─── Sub-section label (Father / Mother / Guardian) ──────────────────────────
const SubSectionLabel = ({ label, accentColor }: { label: string; accentColor: string }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, marginBottom: 4 }}>
    <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: accentColor }} />
    <Text style={{ fontSize: 12, fontWeight: '800', color: accentColor, letterSpacing: 0.8, textTransform: 'uppercase' }}>{label}</Text>
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AddStudentScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const [formData, setFormData] = useState<CreateStudentRequest>({
    first_name: '', middle_name: '', last_name: '',
    dob: '', gender_id: 1,
    admission_no: '', admission_date: new Date().toISOString().split('T')[0],
    status_id: 1, category_id: 1, religion_id: 1, blood_group_id: 1,
    email: '', phone: '', password: '', role_code: 'student',
    class_id: '', section_id: '', academic_year_id: '',
  });

  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [showAdmissionDatePicker, setShowAdmissionDatePicker] = useState(false);

  const [father, setFather] = useState({ first_name: '', last_name: '', phone: '', occupation: '' });
  const [mother, setMother] = useState({ first_name: '', last_name: '', phone: '', occupation: '' });
  const [guardian, setGuardian] = useState({ first_name: '', last_name: '', phone: '', relation: '', occupation: '' });

  // Update progress step based on filled sections
  useEffect(() => {
    const p = formData.first_name && formData.last_name ? 1 : 0;
    const a = formData.class_id && formData.section_id ? 2 : p;
    const par = father.first_name || mother.first_name ? 3 : a;
    const det = formData.category_id ? 4 : par;
    setActiveStep(formData.email ? 4 : det);
  }, [formData, father, mother]);

  useEffect(() => {
    loadReferenceData();
    if (id) { setIsEditMode(true); loadStudentData(id as string); }
  }, [id]);

  const loadReferenceData = async () => {
    try {
      const [classesData, sectionsData, yearsData] = await Promise.all([
        ClassService.getClasses(), ClassService.getSections(), ClassService.getAcademicYears(),
      ]);
      setClasses(classesData); setSections(sectionsData); setAcademicYears(yearsData);
      const now = new Date();
      const currentYear = yearsData.find((y: AcademicYear) =>
        new Date(y.start_date) <= now && new Date(y.end_date) >= now
      );
      if (currentYear) setFormData(prev => ({ ...prev, academic_year_id: currentYear.id }));
    } catch { Alert.alert('Error', 'Failed to load reference data'); }
    finally { setInitialLoading(false); }
  };

  const loadStudentData = async (studentId: string) => {
    try {
      const data: any = await StudentService.getById(studentId);
      if (data) {
        setFormData({
          first_name: data.first_name || '', middle_name: data.middle_name || '',
          last_name: data.last_name || '', dob: data.dob || '',
          gender_id: data.gender_id || 1, admission_no: data.admission_no || '',
          admission_date: data.admission_date || '', status_id: data.status_id || 1,
          category_id: data.category_id || 1, religion_id: data.religion_id || 1,
          blood_group_id: data.blood_group_id || 1, email: data.email || '',
          phone: data.phone || '', password: '', role_code: 'student',
          academic_year_id: data.current_enrollment?.academic_year_id || data.academic_year_id || '',
          class_id: data.current_enrollment?.class_id || '',
          section_id: data.current_enrollment?.section_id || '',
          roll_number: data.current_enrollment?.roll_number,
        } as any);
      }
    } catch { Alert.alert('Error', 'Failed to load student details'); }
  };

  const handleSave = async () => {
    if (!formData.first_name || !formData.last_name || !formData.admission_no || !formData.class_id || !formData.section_id) {
      Alert.alert('Required Fields', 'Please fill all mandatory fields marked with *.'); return;
    }
    if (!isEditMode && !formData.password) {
      Alert.alert('Password Required', 'Set an initial password for the student account.'); return;
    }
    if (formData.password && formData.password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.'); return;
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.'); return;
    }
    if (formData.phone && formData.phone.replace(/\D/g, '').length < 10) {
      Alert.alert('Invalid Phone', 'Phone number must be at least 10 digits.'); return;
    }
    if (formData.dob && new Date(formData.dob) > new Date()) {
      Alert.alert('Invalid DOB', 'Date of birth cannot be in the future.'); return;
    }

    setLoading(true);
    try {
      const parents: NonNullable<CreateStudentRequest['parents']> = [];
      if (father.first_name && father.last_name) parents.push({ ...father, relation: 'Father' as const, is_primary: true });
      if (mother.first_name && mother.last_name) parents.push({ ...mother, relation: 'Mother' as const });
      if (guardian.first_name && guardian.last_name) parents.push({ ...guardian, relation: 'Guardian' as const, is_guardian: true });

      const payload = { ...formData, parents };
      if (isEditMode) {
        await StudentService.update(id as string, payload as any);
        Alert.alert('Updated!', 'Student record updated successfully.', [{ text: 'OK', onPress: () => router.back() }]);
      } else {
        await StudentService.create(payload);
        Alert.alert('Enrolled!', 'New student has been added to the system.', [{ text: 'OK', onPress: () => router.back() }]);
      }
    } catch (error: any) {
      Alert.alert('Save Failed', error.response?.data?.error || error.message || 'An unexpected error occurred.');
    } finally { setLoading(false); }
  };

  const update = (key: keyof CreateStudentRequest, val: any) =>
    setFormData(prev => ({ ...prev, [key]: val }));

  if (initialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <LogoLoader size={60} color={ADMIN_THEME.colors.primary} />
        <Text style={styles.loadingTitle}>Setting up form</Text>
        <Text style={styles.loadingSubtitle}>Loading classes and reference data…</Text>
      </View>
    );
  }

  const gradColors: [string, string] = isEditMode
    ? ['#1E40AF', '#3B82F6']
    : ['#065F46', '#10B981'];

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />
      <AdminHeader title={isEditMode ? 'Edit Student' : 'Add Student'} showBackButton />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── HERO HEADER CARD ── */}
          <Animated.View entering={FadeInDown.duration(500)}>
            <LinearGradient
              colors={gradColors}
              style={styles.heroCard}
              start={{ x: 0.1, y: 0 }} end={{ x: 0.95, y: 1 }}
            >
              {/* Background decoration */}
              <View style={styles.heroBlob1} />
              <View style={styles.heroBlob2} />
              <LinearGradient
                colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0)']}
                style={styles.heroGloss}
                start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
              />

              {/* Live Avatar */}
              <LiveAvatar
                firstName={formData.first_name}
                lastName={formData.last_name}
                genderId={formData.gender_id}
                isDark={isDark}
              />

              <Text style={styles.heroName}>
                {formData.first_name || formData.last_name
                  ? [formData.first_name, formData.last_name].filter(Boolean).join(' ')
                  : (isEditMode ? 'Edit Profile' : 'New Student')}
              </Text>
              <Text style={styles.heroSub}>
                {isEditMode
                  ? `Editing · Adm# ${formData.admission_no || '—'}`
                  : 'Complete all sections to enroll'}
              </Text>

              {/* Mode pill */}
              <View style={styles.modePill}>
                <Ionicons name={isEditMode ? 'pencil' : 'person-add-outline'} size={11} color="#fff" />
                <Text style={styles.modePillText}>{isEditMode ? 'EDIT MODE' : 'NEW ENROLLMENT'}</Text>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* ── PROGRESS STEPS ── */}
          <Animated.View entering={FadeInDown.delay(120).duration(400)}>
            <ProgressSteps activeStep={activeStep} isDark={isDark} />
          </Animated.View>

          {/* ── SECTION 1: PERSONAL ── */}
          <SectionCard title="Personal Details" icon="person-outline" colorKey="personal" delay={160}>
            <View style={styles.row}>
              <View style={styles.halfInput}>
                <InputField label="First Name" placeholder="John" value={formData.first_name}
                  onChangeText={(t: string) => update('first_name', t)} icon="person-outline"
                  required accentColor={SECTION_COLORS.personal.accent} />
              </View>
              <View style={styles.halfInput}>
                <InputField label="Last Name" placeholder="Doe" value={formData.last_name}
                  onChangeText={(t: string) => update('last_name', t)} icon="person-outline"
                  required accentColor={SECTION_COLORS.personal.accent} />
              </View>
            </View>
            <InputField label="Middle Name" placeholder="Optional" value={formData.middle_name}
              onChangeText={(t: string) => update('middle_name', t)} icon="person-outline"
              accentColor={SECTION_COLORS.personal.accent} />
            <SelectField label="Gender" value={formData.gender_id} options={GENDERS}
              onSelect={(v: number) => update('gender_id', v)} icon="transgender-outline"
              required accentColor={SECTION_COLORS.personal.accent} />
            <DateField label="Date of Birth" value={formData.dob}
              onPress={() => setShowDobPicker(true)} accentColor={SECTION_COLORS.personal.accent} isDark={isDark} />
          </SectionCard>

          {/* ── SECTION 2: ACADEMIC ── */}
          <SectionCard title="Academic Information" icon="school-outline" colorKey="academic" delay={220}>
            <InputField label="Admission Number" placeholder="ADM2024001" value={formData.admission_no}
              onChangeText={(t: string) => update('admission_no', t)} icon="card-outline"
              required accentColor={SECTION_COLORS.academic.accent} />
            <InputField label="Roll Number" placeholder="Auto-generated"
              value={(formData as any).roll_number ? String((formData as any).roll_number) : ''}
              editable={false} icon="list-outline" accentColor={SECTION_COLORS.academic.accent} />
            <DateField label="Admission Date" value={formData.admission_date}
              onPress={() => setShowAdmissionDatePicker(true)} required
              accentColor={SECTION_COLORS.academic.accent} isDark={isDark} />
            <View style={styles.row}>
              <View style={styles.halfInput}>
                <SelectField label="Class" value={formData.class_id} options={classes}
                  onSelect={(v: string) => update('class_id', v)} placeholder="Class"
                  icon="business-outline" required accentColor={SECTION_COLORS.academic.accent} />
              </View>
              <View style={styles.halfInput}>
                <SelectField label="Section" value={formData.section_id} options={sections}
                  onSelect={(v: string) => update('section_id', v)} placeholder="Section"
                  icon="grid-outline" required accentColor={SECTION_COLORS.academic.accent} />
              </View>
            </View>
            <SelectField label="Academic Year" value={formData.academic_year_id}
              options={academicYears.map((y: AcademicYear) => ({ id: y.id, name: y.code }))}
              onSelect={(v: string) => update('academic_year_id', v)} placeholder="Select Year"
              icon="time-outline" required accentColor={SECTION_COLORS.academic.accent} />
            <SelectField label="Student Status" value={formData.status_id} options={STUDENT_STATUSES}
              onSelect={(v: number) => update('status_id', v)} icon="shield-checkmark-outline"
              required accentColor={SECTION_COLORS.academic.accent} />
          </SectionCard>

          {/* ── SECTION 3: PARENTS ── */}
          <SectionCard title="Parent / Guardian" icon="people-outline" colorKey="parents" delay={280}>
            <SubSectionLabel label="Father" accentColor={SECTION_COLORS.parents.accent} />
            <View style={styles.row}>
              <View style={styles.halfInput}>
                <InputField label="First Name" placeholder="Father's name" value={father.first_name}
                  onChangeText={(t: string) => setFather(p => ({ ...p, first_name: t }))}
                  icon="person-outline" accentColor={SECTION_COLORS.parents.accent} />
              </View>
              <View style={styles.halfInput}>
                <InputField label="Last Name" placeholder="Surname" value={father.last_name}
                  onChangeText={(t: string) => setFather(p => ({ ...p, last_name: t }))}
                  icon="person-outline" accentColor={SECTION_COLORS.parents.accent} />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.halfInput}>
                <InputField label="Phone" placeholder="Mobile" value={father.phone}
                  onChangeText={(t: string) => setFather(p => ({ ...p, phone: t }))}
                  keyboardType="phone-pad" icon="call-outline" accentColor={SECTION_COLORS.parents.accent} />
              </View>
              <View style={styles.halfInput}>
                <InputField label="Occupation" placeholder="Job title" value={father.occupation}
                  onChangeText={(t: string) => setFather(p => ({ ...p, occupation: t }))}
                  icon="briefcase-outline" accentColor={SECTION_COLORS.parents.accent} />
              </View>
            </View>

            <SubSectionLabel label="Mother" accentColor={SECTION_COLORS.parents.accent} />
            <View style={styles.row}>
              <View style={styles.halfInput}>
                <InputField label="First Name" placeholder="Mother's name" value={mother.first_name}
                  onChangeText={(t: string) => setMother(p => ({ ...p, first_name: t }))}
                  icon="person-outline" accentColor={SECTION_COLORS.parents.accent} />
              </View>
              <View style={styles.halfInput}>
                <InputField label="Last Name" placeholder="Surname" value={mother.last_name}
                  onChangeText={(t: string) => setMother(p => ({ ...p, last_name: t }))}
                  icon="person-outline" accentColor={SECTION_COLORS.parents.accent} />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.halfInput}>
                <InputField label="Phone" placeholder="Mobile" value={mother.phone}
                  onChangeText={(t: string) => setMother(p => ({ ...p, phone: t }))}
                  keyboardType="phone-pad" icon="call-outline" accentColor={SECTION_COLORS.parents.accent} />
              </View>
              <View style={styles.halfInput}>
                <InputField label="Occupation" placeholder="Job title" value={mother.occupation}
                  onChangeText={(t: string) => setMother(p => ({ ...p, occupation: t }))}
                  icon="briefcase-outline" accentColor={SECTION_COLORS.parents.accent} />
              </View>
            </View>
          </SectionCard>

          {/* ── SECTION 4: ADDITIONAL ── */}
          <SectionCard title="Additional Details" icon="options-outline" colorKey="additional" delay={340}>
            <SelectField label="Category" value={formData.category_id} options={STUDENT_CATEGORIES}
              onSelect={(v: number) => update('category_id', v)} icon="list-outline"
              accentColor={SECTION_COLORS.additional.accent} />
            <SelectField label="Religion" value={formData.religion_id} options={RELIGIONS}
              onSelect={(v: number) => update('religion_id', v)} icon="heart-outline"
              accentColor={SECTION_COLORS.additional.accent} />
            <SelectField label="Blood Group" value={formData.blood_group_id} options={BLOOD_GROUPS}
              onSelect={(v: number) => update('blood_group_id', v)} icon="water-outline"
              accentColor={SECTION_COLORS.additional.accent} />
          </SectionCard>

          {/* ── SECTION 5: CREDENTIALS ── */}
          <SectionCard title="Contact & Login" icon="lock-closed-outline" colorKey="credentials" delay={400}>
            <InputField label="Email Address" placeholder="student@school.edu" value={formData.email}
              onChangeText={(t: string) => update('email', t)} keyboardType="email-address"
              icon="mail-outline" accentColor={SECTION_COLORS.credentials.accent} />
            <InputField label="Phone Number" placeholder="+91 9876543210" value={formData.phone}
              onChangeText={(t: string) => update('phone', t)} keyboardType="phone-pad"
              icon="call-outline" accentColor={SECTION_COLORS.credentials.accent} />
            {!isEditMode && (
              <InputField label="Initial Password" placeholder="Min 6 characters" value={formData.password}
                onChangeText={(t: string) => update('password', t)} icon="lock-closed-outline"
                required secureTextEntry accentColor={SECTION_COLORS.credentials.accent} />
            )}
          </SectionCard>

          {/* ── SAVE BUTTON ── */}
          <Animated.View entering={FadeInDown.delay(460).duration(500)}>
            <Pressable
              style={({ pressed }) => [styles.saveButtonWrap, pressed && { opacity: 0.9 }]}
              onPress={handleSave}
              disabled={loading}
            >
              <LinearGradient
                colors={isEditMode ? ['#1E40AF', '#3B82F6'] : ['#065F46', '#10B981']}
                style={styles.saveButton}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                {/* Top gloss */}
                <LinearGradient
                  colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0)']}
                  style={styles.saveGloss}
                  start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                />
                {loading
                  ? <LogoLoader color="#fff" size={22} />
                  : <>
                    <Ionicons
                      name={isEditMode ? 'save-outline' : 'person-add-outline'}
                      size={20} color="#fff"
                    />
                    <Text style={styles.saveButtonText}>
                      {isEditMode ? 'Save Changes' : 'Enroll Student'}
                    </Text>
                    <View style={styles.saveArrow}>
                      <Ionicons name="arrow-forward" size={14} color="rgba(255,255,255,0.7)" />
                    </View>
                  </>
                }
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {/* Date pickers */}
          {showDobPicker && (
            <DateTimePicker
              value={formData.dob ? new Date(formData.dob) : new Date()}
              mode="date" display="default" maximumDate={new Date()}
              onChange={(_, d) => { setShowDobPicker(false); if (d) update('dob', d.toISOString().split('T')[0]); }}
            />
          )}
          {showAdmissionDatePicker && (
            <DateTimePicker
              value={formData.admission_date ? new Date(formData.admission_date) : new Date()}
              mode="date" display="default" maximumDate={new Date()}
              onChange={(_, d) => { setShowAdmissionDatePicker(false); if (d) update('admission_date', d.toISOString().split('T')[0]); }}
            />
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const getStyles = (theme: Theme, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? '#0A0F1E' : '#F1F5F9' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#0A0F1E' : '#F1F5F9', gap: 10 },
  loadingTitle: { fontSize: 17, fontWeight: '800', color: isDark ? '#E2E8F0' : '#1E293B', marginTop: 8 },
  loadingSubtitle: { fontSize: 13, color: isDark ? '#64748B' : '#94A3B8', fontWeight: '500' },

  scrollContent: { padding: 18, paddingBottom: 60 },

  // ── Hero card ──
  heroCard: {
    borderRadius: 28, padding: 28, alignItems: 'center',
    marginBottom: 28, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.30, shadowRadius: 28, elevation: 16,
  },
  heroBlob1: { position: 'absolute', top: -50, right: -50, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.08)' },
  heroBlob2: { position: 'absolute', bottom: -30, left: -30, width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.06)' },
  heroGloss: { position: 'absolute', top: 0, left: 0, right: 0, height: 80, borderRadius: 28 },
  heroName: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginTop: 12, textAlign: 'center' },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.72)', marginTop: 4, fontWeight: '500', textAlign: 'center' },
  modePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5, marginTop: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  modePillText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 1.2 },

  // ── Section cards ──
  sectionCard: {
    flexDirection: 'row',
    backgroundColor: isDark ? '#111827' : '#FFFFFF',
    borderRadius: 22,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.30 : 0.07,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
  },
  sectionAccentBar: { width: 4, borderRadius: 0 },
  sectionInner: { flex: 1, padding: 20 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  sectionIconWrap: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: isDark ? '#E2E8F0' : '#0F172A', letterSpacing: -0.2 },

  // ── Input field ──
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '700', color: isDark ? '#64748B' : '#64748B', marginBottom: 7, letterSpacing: 0.1 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
    borderRadius: 13, paddingHorizontal: 14, height: 48,
    borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
  },
  inputWrapperDisabled: { opacity: 0.6 },
  input: { flex: 1, fontSize: 15, color: isDark ? '#E2E8F0' : '#0F172A', fontWeight: '500' },
  inputDisabled: { color: isDark ? '#475569' : '#94A3B8' },
  selectedBadge: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },

  // ── Row layout ──
  row: { flexDirection: 'row', gap: 10 },
  halfInput: { flex: 1 },

  // ── Modal ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: isDark ? '#111827' : '#FFFFFF',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 12, paddingHorizontal: 20,
    maxHeight: '82%',
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: isDark ? '#374151' : '#E2E8F0', alignSelf: 'center', marginBottom: 18 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: isDark ? '#E2E8F0' : '#0F172A', letterSpacing: -0.3 },
  modalSubtitle: { fontSize: 12, color: isDark ? '#64748B' : '#94A3B8', marginTop: 2, fontWeight: '500' },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
    justifyContent: 'center', alignItems: 'center',
  },
  modalSearchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
    borderRadius: 12, paddingHorizontal: 12, height: 42,
    marginBottom: 12,
    borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
  },
  modalSearch: { flex: 1, fontSize: 14, color: isDark ? '#E2E8F0' : '#0F172A', fontWeight: '500' },
  modalEmpty: { alignItems: 'center', paddingVertical: 36, gap: 10 },
  modalEmptyText: { fontSize: 14, color: isDark ? '#64748B' : '#94A3B8', fontWeight: '500' },
  optionItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, gap: 10,
    borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    paddingLeft: 4,
  },
  selectedOption: { borderRadius: 10, paddingHorizontal: 4 },
  optionAccentBar: { width: 3, height: 18, borderRadius: 2 },
  optionText: { flex: 1, fontSize: 15, color: isDark ? '#94A3B8' : '#475569', fontWeight: '500' },
  optionCheck: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

  // ── Save button ──
  saveButtonWrap: {
    borderRadius: 18, marginTop: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.30, shadowRadius: 20, elevation: 12,
  },
  saveButton: {
    height: 58, borderRadius: 18,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 10, overflow: 'hidden',
  },
  saveGloss: { position: 'absolute', top: 0, left: 0, right: 0, height: 30, borderRadius: 18 },
  saveButtonText: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  saveArrow: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
});