import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Dimensions, Image } from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AdminHeader from '../../src/components/AdminHeader';
import { ADMIN_THEME } from '../../src/constants/adminTheme';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { StudentService } from '../../src/services/studentService';
import { SCHOOL_CONFIG } from '@/src/constants/schoolConfig';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';
const {
  width
} = Dimensions.get('window');

// --- Types ---
type CertificateType = 'TC' | 'BONAFIDE' | null;
interface StudentData {
  id: string;
  name: string;
  fatherName: string;
  class: string;
  dob: string;
  admissionNo: string;
  academicYear: string;
  address: string;
}
export default function CertificateGenerator() {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [selectedType, setSelectedType] = useState<CertificateType>(null);
  const [generated, setGenerated] = useState(false);

  // --- Actions ---

  const handleSearch = async () => {
    if (!studentId.trim()) {
      Alert.alert('Error', 'Please enter a Student ID or Admission No');
      return;
    }
    setLoading(true);
    setGenerated(false);
    setStudentData(null);
    setSelectedType(null);
    try {
      // 1. Try search first (Name or Admission No)
      let student = null;
      const searchResults = await StudentService.search(studentId);
      if (searchResults && searchResults.length > 0) {
        // If multiple results, ideally show a picker. For now, prefer exact match on admission_no or just take first.
        const exactMatch = searchResults.find((s) => s.admission_no === studentId);
        student = exactMatch || searchResults[0];
      }

      // 2. If no result, try getById (in case user entered a UUID)
      if (!student) {
        try {
          student = await StudentService.getById(studentId);
        } catch (e) {

          // Not found by ID either
        }}
      if (!student) {
        Alert.alert('Error', 'Student not found');
        return;
      }

      // Map backend data to UI format
      const currentEnrollment = student.current_enrollment;
      const cls = currentEnrollment?.class_code || '';
      const sec = currentEnrollment?.section_name || '';

      // Parents: backend returns flat objects with relation string
      const fatherObj = student.parents?.find((p) => p.relation === 'Father');
      const father = fatherObj ? `${fatherObj.first_name} ${fatherObj.last_name}` : 'Guardian';
      const mappedData: StudentData = {
        id: student.id,
        name: student.display_name || `${student.first_name} ${student.last_name}`,
        fatherName: father,
        class: `${cls} - ${sec}`,
        dob: student.dob ? new Date(student.dob).toLocaleDateString() : 'N/A',
        admissionNo: student.admission_no,
        academicYear: currentEnrollment?.academic_year || '2025-2026',
        address: 'Hyderabad'
      };
      setStudentData(mappedData);
    } catch (error) {

      Alert.alert('Error', 'Student not found or error fetching data.');
    } finally {
      setLoading(false);
    }
  };
  const generateCertificate = (type: CertificateType) => {
    if (!studentData) return;
    setLoading(true);
    // Simulate generation delay
    setTimeout(() => {
      setSelectedType(type);
      setGenerated(true);
      setLoading(false);
    }, 800);
  };
  const handleDownloadPDF = () => {
    Alert.alert('Download PDF', `Generating ${selectedType === 'TC' ? 'Transfer Certificate' : 'Bonafide Certificate'} for ${studentData?.name}...`, [{
      text: 'Cancel',
      style: 'cancel'
    }, {
      text: 'Simulate Download',
      onPress: () => Alert.alert('Success', 'Certificate downloaded to device.')
    }]);
    // Logic for expo-print would go here:
    // await Print.printAsync({ html: generateHTML(studentData, selectedType) });
  };

  // --- Render Helpers ---

  const renderCertificatePreview = () => {
    if (!studentData || !selectedType) return null;
    const isTC = selectedType === 'TC';
    const title = isTC ? 'TRANSFER CERTIFICATE' : 'BONAFIDE CERTIFICATE';
    return <Animated.View entering={FadeInDown.springify()} style={styles.previewContainer}>
                <View style={styles.paperEffect}>
                    {/* Header of Certificate */}
                    <View style={styles.certHeader}>
                        <View style={styles.logoPlaceholder}>
                            <Image source={SCHOOL_CONFIG.logo} style={{
              width: 80,
              height: 80,
              resizeMode: 'contain'
            }} />
                        </View>
                        <View style={styles.schoolInfo}>
                            <Text style={styles.schoolName}>{SCHOOL_CONFIG.name}</Text>
                            <Text style={styles.schoolAddress}>{SCHOOL_CONFIG.address || 'Madhapur, Hyderabad - 500081'}</Text>
                            <Text style={styles.affiliation}>Affiliated to CBSE, New Delhi (No. 123456)</Text>
                        </View>
                    </View>
                    <View style={styles.divider} />
                    <Text style={styles.certTitle}>{title}</Text>
                    <Text style={styles.certRef}>Ref No: NHS/{selectedType}/{new Date().getFullYear()}/042</Text>
                    <View style={styles.certBody}>
                        <Text style={styles.certText}>
                            This is to certify that <Text style={styles.bold}>{studentData.name}</Text>,
                            S/o <Text style={styles.bold}>{studentData.fatherName}</Text>,
                            Admission No. <Text style={styles.bold}>{studentData.admissionNo}</Text>,
                            is/was a bonafide student of this institution studying in
                            <Text style={styles.bold}> {studentData.class}</Text> during the academic year
                            <Text style={styles.bold}> {studentData.academicYear}</Text>.
                        </Text>
                        {isTC && <Text style={[styles.certText, {
            marginTop: 16
          }]}>
                                His/Her date of birth as per our records is <Text style={styles.bold}>{studentData.dob}</Text>.
                                All school dues have been cleared. We wish him/her all the best for future endeavors.
                            </Text>}
                        {!isTC && <Text style={[styles.certText, {
            marginTop: 16
          }]}>
                                He/She bears a good moral character. This certificate is issued upon his/her request for
                                general purposes.
                            </Text>}
                    </View>
                    <View style={styles.certFooter}>
                        <View style={styles.signatureBox}>
                            <Text style={styles.signLabel}>Date: {new Date().toLocaleDateString()}</Text>
                        </View>
                        <View style={styles.signatureBox}>
                            <View style={styles.signLine} />
                            <Text style={styles.signLabel}>Principal Signature</Text>
                        </View>
                    </View>
                    {/* Watermark */}
                    <View style={styles.watermark}>
                        <Image source={SCHOOL_CONFIG.logo} style={{
            width: 300,
            height: 300,
            opacity: 0.05,
            resizeMode: 'contain'
          }} />
                    </View>
                </View>
                {/* Action Buttons for Certificate */}
                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={() => setGenerated(false)}>
                        <Feather name="edit-2" size={18} color={ADMIN_THEME.colors.text.secondary} />
                        <Text style={styles.secondaryBtnText}>Edit / Close</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.downloadBtn} onPress={handleDownloadPDF}>
                        <LinearGradient colors={[ADMIN_THEME.colors.primary, '#818CF8']} start={{
            x: 0,
            y: 0
          }} end={{
            x: 1,
            y: 0
          }} style={styles.downloadGradient}>
                            <Feather name="download" size={18} color="#FFF" />
                            <Text style={styles.downloadBtnText}>Download PDF</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </Animated.View>;
  };
  return <View style={styles.root}>
            <LinearGradient colors={[ADMIN_THEME.colors.background.app, '#F0F4FF']} style={StyleSheet.absoluteFill} />
            <AdminHeader title="Certificate Gen." showBackButton />
            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.content}>
                    {/* 1. Input Section */}
                    <Text style={styles.sectionTitle}>Student Details</Text>
                    <View style={styles.searchCard}>
                        <Text style={styles.label}>Enter Student ID</Text>
                        <View style={styles.inputRow}>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="search-outline" size={20} color={ADMIN_THEME.colors.text.muted} style={styles.searchIcon} />
                                <TextInput style={styles.input} placeholder="e.g. 101, 102..." placeholderTextColor={ADMIN_THEME.colors.text.muted} value={studentId} onChangeText={setStudentId} />
                            </View>
                            <TouchableOpacity style={[styles.searchBtn, loading && styles.disabledBtn]} onPress={handleSearch} disabled={loading}>
                                {loading ? <LogoLoader size={30} color="#FFF" /> : <Feather name="arrow-right" size={20} color="#FFF" />}
                            </TouchableOpacity>
                        </View>
                    </View>
                    {/* 2. Selection Section (Visible after search) */}
                    {studentData && !generated && <Animated.View entering={FadeIn.duration(400)} style={styles.selectionSection}>
                            <View style={styles.studentInfoCard}>
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>{studentData.name.charAt(0)}</Text>
                                </View>
                                <View style={styles.infoContent}>
                                    <Text style={styles.studentName}>{studentData.name}</Text>
                                    <Text style={styles.studentSub}>{studentData.class} • {studentData.admissionNo}</Text>
                                </View>
                                <View style={styles.verifiedBadge}>
                                    <MaterialCommunityIcons name="check-decagram" size={16} color={ADMIN_THEME.colors.success} />
                                    <Text style={styles.verifiedText}>Verified</Text>
                                </View>
                            </View>
                            <Text style={[styles.sectionTitle, {
            marginTop: 24
          }]}>Select Certificate Type</Text>
                            <View style={styles.typeGrid}>
                                <TouchableOpacity style={styles.typeCard} onPress={() => generateCertificate('TC')} activeOpacity={0.8}>
                                    <LinearGradient colors={['#FFF', '#F8FAFC']} style={styles.typeCardGradient}>
                                        <View style={[styles.iconBox, {
                  backgroundColor: '#EEF2FF'
                }]}>
                                            <MaterialCommunityIcons name="file-move-outline" size={28} color="#4F46E5" />
                                        </View>
                                        <Text style={styles.typeTitle}>Transfer Certificate (TC)</Text>
                                        <Text style={styles.typeDesc}>For students leaving the school/transferring.</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.typeCard} onPress={() => generateCertificate('BONAFIDE')} activeOpacity={0.8}>
                                    <LinearGradient colors={['#FFF', '#F8FAFC']} style={styles.typeCardGradient}>
                                        <View style={[styles.iconBox, {
                  backgroundColor: '#ECFDF5'
                }]}>
                                            <MaterialCommunityIcons name="certificate-outline" size={28} color="#059669" />
                                        </View>
                                        <Text style={styles.typeTitle}>Bonafide Certificate</Text>
                                        <Text style={styles.typeDesc}>Proof of study for official purposes.</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </Animated.View>}
                    {/* 3. Generated Preview */}
                    {generated && renderCertificatePreview()}
                </View>
            </ScrollView>
        </View>;
}
const getStyles = (theme: Theme) => StyleSheet.create({
  root: {
    flex: 1
  },
  scroll: {
    paddingBottom: 40
  },
  content: {
    padding: 20
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: ADMIN_THEME.colors.text.primary,
    marginBottom: 12,
    letterSpacing: 0.5
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: ADMIN_THEME.colors.text.secondary,
    marginBottom: 8
  },
  // Search Card
  searchCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    ...ADMIN_THEME.shadows.sm
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ADMIN_THEME.colors.background.surface,
    borderWidth: 1,
    borderColor: ADMIN_THEME.colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 50
  },
  searchIcon: {
    marginRight: 8
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: ADMIN_THEME.colors.text.primary
  },
  searchBtn: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: ADMIN_THEME.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...ADMIN_THEME.shadows.sm
  },
  disabledBtn: {
    opacity: 0.7
  },
  // Info Card
  selectionSection: {
    marginTop: 24
  },
  studentInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: ADMIN_THEME.colors.primary,
    ...ADMIN_THEME.shadows.sm
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: ADMIN_THEME.colors.primary
  },
  infoContent: {
    flex: 1
  },
  studentName: {
    fontSize: 18,
    fontWeight: '700',
    color: ADMIN_THEME.colors.text.primary
  },
  studentSub: {
    fontSize: 14,
    color: ADMIN_THEME.colors.text.secondary,
    marginTop: 2
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: ADMIN_THEME.colors.success
  },
  // Type Grid
  typeGrid: {
    flexDirection: 'row',
    gap: 12
  },
  typeCard: {
    flex: 1,
    borderRadius: 16,
    ...ADMIN_THEME.shadows.sm,
    backgroundColor: '#FFF'
  },
  typeCardGradient: {
    padding: 16,
    borderRadius: 16,
    height: 160,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: ADMIN_THEME.colors.border
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  typeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: ADMIN_THEME.colors.text.primary,
    marginTop: 12
  },
  typeDesc: {
    fontSize: 12,
    color: ADMIN_THEME.colors.text.muted,
    marginTop: 4,
    lineHeight: 16
  },
  // Preview
  previewContainer: {
    marginTop: 24,
    alignItems: 'center'
  },
  paperEffect: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 2,
    // Sharp corners like paper
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: theme.colors.text,
    shadowOffset: {
      width: 0,
      height: 4
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5
  },
  certHeader: {
    alignItems: 'center',
    marginBottom: 20
  },
  logoPlaceholder: {
    marginBottom: 8
  },
  schoolInfo: {
    alignItems: 'center'
  },
  schoolName: {
    fontSize: 20,
    fontWeight: '800',
    color: ADMIN_THEME.colors.primary,
    letterSpacing: 1
  },
  schoolAddress: {
    fontSize: 12,
    color: ADMIN_THEME.colors.text.secondary,
    marginTop: 2
  },
  affiliation: {
    fontSize: 10,
    color: ADMIN_THEME.colors.text.muted,
    fontStyle: 'italic',
    marginTop: 2
  },
  divider: {
    height: 2,
    backgroundColor: ADMIN_THEME.colors.primary,
    width: '100%',
    marginVertical: 12,
    opacity: 0.2
  },
  certTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: ADMIN_THEME.colors.text.primary,
    textAlign: 'center',
    textDecorationLine: 'underline',
    marginBottom: 8
  },
  certRef: {
    fontSize: 12,
    color: ADMIN_THEME.colors.text.muted,
    textAlign: 'right',
    width: '100%',
    marginBottom: 20
  },
  certBody: {
    marginBottom: 40
  },
  certText: {
    fontSize: 15,
    lineHeight: 26,
    color: '#1E293B',
    textAlign: 'justify'
  },
  bold: {
    fontWeight: '700',
    color: '#0F172A'
  },
  certFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 40
  },
  signatureBox: {
    alignItems: 'center'
  },
  signLine: {
    width: 120,
    height: 1,
    backgroundColor: theme.colors.text,
    marginBottom: 4
  },
  signLabel: {
    fontSize: 12,
    fontWeight: '600'
  },
  watermark: {
    position: 'absolute',
    top: '25%',
    alignSelf: 'center',
    opacity: 0.5,
    pointerEvents: 'none'
  },
  // Action Row
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    width: '100%'
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: ADMIN_THEME.colors.border
  },
  secondaryBtnText: {
    fontWeight: '600',
    color: ADMIN_THEME.colors.text.primary
  },
  downloadBtn: {
    flex: 2,
    borderRadius: 12,
    ...ADMIN_THEME.shadows.md
  },
  downloadGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14
  },
  downloadBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16
  }
});