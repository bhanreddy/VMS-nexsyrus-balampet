import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AdminHeader from '../../src/components/AdminHeader';
import { ADMIN_THEME } from '../../src/constants/adminTheme';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { StudentService } from '../../src/services/studentService';
import { SCHOOL_CONFIG } from '@/src/constants/schoolConfig';
import { Image } from 'react-native';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';

// --- Types ---
interface SubjectMark {
  subject: string;
  maxMarks: number;
  obtained: number;
  grade: string;
}
interface StudentResult {
  id: string;
  name: string;
  fatherName: string;
  class: string;
  rollNo: string;
  dob: string;
  academicYear: string;
  attendance: string;
  marks: SubjectMark[];
  // Calculated fields
  totalMax?: number;
  totalObtained?: number;
  percentage?: number;
  result?: 'PASS' | 'FAIL';
  division?: string;
}
const MOCK_MARKS = [{
  subject: 'English',
  maxMarks: 100,
  obtained: 85,
  grade: 'A'
}, {
  subject: 'Mathematics',
  maxMarks: 100,
  obtained: 92,
  grade: 'A+'
}, {
  subject: 'Science',
  maxMarks: 100,
  obtained: 78,
  grade: 'B+'
}, {
  subject: 'Social Studies',
  maxMarks: 100,
  obtained: 88,
  grade: 'A'
}, {
  subject: 'Hindi',
  maxMarks: 100,
  obtained: 80,
  grade: 'A'
}];
export default function ProgressReportGenerator() {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultData, setResultData] = useState<StudentResult | null>(null);
  const handleSearch = async () => {
    if (!studentId.trim()) {
      Alert.alert('Error', 'Please enter a Student ID or Admission No');
      return;
    }
    setLoading(true);
    setResultData(null);
    try {
      // 1. Try search first (Name or Admission No)
      let student = null;
      const searchResults = await StudentService.search(studentId);
      if (searchResults && searchResults.length > 0) {
        const exactMatch = searchResults.find((s) => s.admission_no === studentId);
        student = exactMatch || searchResults[0];
      }

      // 2. Fallback to getById
      if (!student) {
        try {
          student = await StudentService.getById(studentId);
        } catch (e) {

          // Not found by ID
        }}
      if (!student) {
        Alert.alert('Error', 'Student not found');
        return;
      }

      // Fetch results
      // TODO: actually implement getResults on backend. For now we might just get empty array or mock from service if implemented.
      const results = await StudentService.getResults(student.id).catch(() => []);
      const marks: SubjectMark[] = results && results.length > 0 ? results : MOCK_MARKS;
      let totalMax = 0;
      let totalObtained = 0;
      let hasFailed = false;
      marks.forEach((m) => {
        totalMax += m.maxMarks;
        totalObtained += m.obtained;
        if (m.obtained < 35) hasFailed = true;
      });
      const percentage = totalMax > 0 ? totalObtained / totalMax * 100 : 0;
      const result = hasFailed ? 'FAIL' : 'PASS';
      let division = '-';
      if (result === 'PASS') {
        if (percentage >= 75) division = 'Distinction';else if (percentage >= 60) division = 'First Class';else if (percentage >= 50) division = 'Second Class';else division = 'Third Class';
      }
      const currentEnrollment = student.current_enrollment;
      const cls = currentEnrollment?.class_code || 'N/A';
      const sec = currentEnrollment?.section_name || '';
      const fatherObj = student.parents?.find((p) => p.relation === 'Father');
      const father = fatherObj ? `${fatherObj.first_name} ${fatherObj.last_name}` : 'Guardian';
      const data: StudentResult = {
        id: student.id,
        name: student.display_name || `${student.first_name} ${student.last_name}`,
        fatherName: father,
        class: `${cls} ${sec}`,
        rollNo: currentEnrollment?.roll_number || 'N/A',
        dob: student.dob ? new Date(student.dob).toLocaleDateString() : 'N/A',
        academicYear: '2025-2026',
        attendance: '85%',
        // TODO: Fetch real attendance %
        marks,
        totalMax,
        totalObtained,
        percentage: parseFloat(percentage.toFixed(2)),
        result,
        division
      };
      setResultData(data);
    } catch (error) {

      Alert.alert('Error', 'Student not found or error fetching data.');
    } finally {
      setLoading(false);
    }
  };
  const handlePrint = () => {
    Alert.alert('Print', 'Sending report to printer / generating PDF...');
    // Logic for Print.printAsync goes here
  };

  // --- Render Components ---

  const renderReportCard = () => {
    if (!resultData) return null;
    const isPass = resultData.result === 'PASS';
    return <Animated.View entering={FadeInDown.springify()} style={styles.previewContainer}>
                {/* Visual Paper Sheet */}
                <View style={styles.paperSheet}>
                    {/* Header */}
                    <View style={styles.headerSection}>
                        <View style={styles.logoCircle}>
                            <Image source={SCHOOL_CONFIG.logo} style={{
              width: 40,
              height: 40,
              resizeMode: 'contain'
            }} />
                        </View>
                        <View style={{
            alignItems: 'center'
          }}>
                            <Text style={styles.schoolName}>{SCHOOL_CONFIG.name}</Text>
                            <Text style={styles.schoolSub}>ANNUAL PROGRESS REPORT</Text>
                            <Text style={styles.academicYear}>{resultData.academicYear}</Text>
                        </View>
                        <View style={{
            width: 40
          }} />
                    </View>
                    {/* Student Details Grid */}
                    <View style={styles.detailsGrid}>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Student Name:</Text>
                            <Text style={styles.detailValue}>{resultData.name}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Class & Sec:</Text>
                            <Text style={styles.detailValue}>{resultData.class}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Roll No:</Text>
                            <Text style={styles.detailValue}>{resultData.rollNo}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Father's Name:</Text>
                            <Text style={styles.detailValue}>{resultData.fatherName}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>D.O.B:</Text>
                            <Text style={styles.detailValue}>{resultData.dob}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Attendance:</Text>
                            <Text style={styles.detailValue}>{resultData.attendance}</Text>
                        </View>
                    </View>
                    {/* Marks Table */}
                    <View style={styles.tableContainer}>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.colSubject, styles.th]}>Subject</Text>
                            <Text style={[styles.colMarks, styles.th]}>Max</Text>
                            <Text style={[styles.colMarks, styles.th]}>Obt</Text>
                            <Text style={[styles.colGrade, styles.th]}>Grade</Text>
                        </View>
                        {resultData.marks.map((m, i) => {
            return <View key={i} style={[styles.tableRow, i % 2 === 0 && styles.rowAlt]}>
                                <Text style={[styles.colSubject, styles.td]}>{m.subject}</Text>
                                <Text style={[styles.colMarks, styles.td]}>{m.maxMarks}</Text>
                                <Text style={[styles.colMarks, styles.td, m.obtained < 35 && styles.textDanger]}>
                                    {m.obtained}
                                </Text>
                                <Text style={[styles.colGrade, styles.td]}>{m.grade}</Text>
                            </View>;
          })}
                    </View>
                    {/* Summary Section */}
                    <View style={styles.summarySection}>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Total Marks:</Text>
                            <Text style={styles.summaryValue}>{resultData.totalObtained} / {resultData.totalMax}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Percentage:</Text>
                            <Text style={styles.summaryValue}>{resultData.percentage}%</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Result:</Text>
                            <View style={[styles.resultBadge, isPass ? styles.badgePass : styles.badgeFail]}>
                                <Text style={[styles.resultText, isPass ? styles.textPass : styles.textFail]}>
                                    {resultData.result}
                                </Text>
                            </View>
                        </View>
                        {isPass && <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Division:</Text>
                                <Text style={styles.summaryValue}>{resultData.division}</Text>
                            </View>}
                    </View>
                    <View style={styles.divider} />
                    {/* Footer / Signatures */}
                    <View style={styles.footerSignatures}>
                        <View style={styles.signBox}>
                            <Text style={styles.signLabel}>Class Teacher</Text>
                        </View>
                        <View style={styles.signBox}>
                            <Text style={styles.signLabel}>Principal</Text>
                        </View>
                        <View style={styles.signBox}>
                            <Text style={styles.signLabel}>Parent</Text>
                        </View>
                    </View>
                    {/* School Watermark (Decorative) */}
                    <View style={styles.watermark}>
                        <Image source={SCHOOL_CONFIG.logo} style={{
            width: 200,
            height: 200,
            opacity: 0.05,
            resizeMode: 'contain'
          }} />
                    </View>
                </View>
                {/* Print Button */}
                <TouchableOpacity style={styles.printBtn} onPress={handlePrint} activeOpacity={0.8}>
                    <LinearGradient colors={[ADMIN_THEME.colors.primary, '#6366F1']} style={styles.printGradient}>
                        <Feather name="printer" size={20} color="#FFF" />
                        <Text style={styles.printText}>Print Report Card</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </Animated.View>;
  };
  return <View style={styles.root}>
            <LinearGradient colors={[ADMIN_THEME.colors.background.app, '#F0F4FF']} style={StyleSheet.absoluteFill} />
            <AdminHeader title="Progress Reports" showBackButton />
            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.content}>
                    {/* Search Section */}
                    <Text style={styles.sectionTitle}>Generate Report</Text>
                    <View style={styles.searchCard}>
                        <Text style={styles.label}>Enter Student ID</Text>
                        <View style={styles.inputRow}>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="search-outline" size={20} color={ADMIN_THEME.colors.text.muted} style={styles.searchIcon} />
                                <TextInput style={styles.input} placeholder="e.g. 01, 101, John Doe" placeholderTextColor={ADMIN_THEME.colors.text.muted} value={studentId} onChangeText={setStudentId} />
                            </View>
                            <TouchableOpacity style={[styles.searchBtn, loading && styles.disabledBtn]} onPress={handleSearch} disabled={loading}>
                                {loading ? <LogoLoader size={30} color="#FFF" /> : <Feather name="arrow-right" size={20} color="#FFF" />}
                            </TouchableOpacity>
                        </View>
                    </View>
                    {/* Report Render */}
                    {renderReportCard()}
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
    ...ADMIN_THEME.shadows.sm,
    marginBottom: 20
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
  // Report Card Paper
  previewContainer: {
    alignItems: 'center',
    marginTop: 10
  },
  paperSheet: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 4,
    padding: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 4,
    shadowColor: theme.colors.text,
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.1,
    shadowRadius: 8
  },
  headerSection: {
    backgroundColor: ADMIN_THEME.colors.primary,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  schoolName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 1
  },
  schoolSub: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
    letterSpacing: 2
  },
  academicYear: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
    fontStyle: 'italic'
  },
  // Student Details
  detailsGrid: {
    padding: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#F8FAFC'
  },
  detailRow: {
    width: '50%',
    marginBottom: 12
  },
  detailLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  detailValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '700',
    marginTop: 2
  },
  // Table
  tableContainer: {
    padding: 20
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8
  },
  th: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  rowAlt: {
    backgroundColor: '#F8FAFC'
  },
  td: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '500'
  },
  colSubject: {
    flex: 2
  },
  colMarks: {
    flex: 1,
    textAlign: 'center'
  },
  colGrade: {
    flex: 1,
    textAlign: 'center'
  },
  textDanger: {
    color: ADMIN_THEME.colors.danger,
    fontWeight: '700'
  },
  // Summary
  summarySection: {
    padding: 20,
    paddingTop: 0,
    gap: 12
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  summaryLabel: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600'
  },
  summaryValue: {
    fontSize: 16,
    color: '#0F172A',
    fontWeight: '800'
  },
  resultBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12
  },
  badgePass: {
    backgroundColor: '#ECFDF5'
  },
  badgeFail: {
    backgroundColor: '#FEF2F2'
  },
  textPass: {
    color: ADMIN_THEME.colors.success
  },
  textFail: {
    color: ADMIN_THEME.colors.danger
  },
  resultText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 10
  },
  // Footer
  footerSignatures: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 30,
    paddingTop: 40
  },
  signBox: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#94A3B8',
    width: '28%',
    paddingTop: 8
  },
  signLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600'
  },
  watermark: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    zIndex: -1
  },
  // Print Button
  printBtn: {
    width: '100%',
    marginTop: 24,
    borderRadius: 12,
    ...ADMIN_THEME.shadows.md
  },
  printGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10
  },
  printText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700'
  }
});