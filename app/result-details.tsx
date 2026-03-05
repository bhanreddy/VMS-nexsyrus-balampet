import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, StatusBar, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import StudentHeader from '../src/components/StudentHeader';
import { useTranslation } from 'react-i18next';
import { StudentService } from '../src/services/studentService';
import { ResultService, ExamListEntry, StudentResultDetail } from '../src/services/resultService';
import { useAuth } from '../src/hooks/useAuth';
import { useTheme } from '../src/hooks/useTheme';
import { Theme } from '../src/theme/themes';
import LogoLoader from '../src/components/LogoLoader';

const {
  width
} = Dimensions.get('window');
export default function ResultDetails() {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const {
    type,
    title,
    examId
  } = useLocalSearchParams();
  const router = useRouter();
  const {
    user
  } = useAuth();
  const {
    t
  } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [examList, setExamList] = useState<ExamListEntry[]>([]);
  const [detail, setDetail] = useState<StudentResultDetail | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');

  useEffect(() => {
    loadData();
  }, [user?.id, type, examId]);
  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const student = await StudentService.getProfile();
      if (!student?.id) {
        setLoading(false);
        return;
      }
      if (examId) {
        // Fetch specific exam detail
        const data = await ResultService.getStudentResult(student.id, examId as string);
        setDetail(data.results[0] || null); // API returns array of results (grouped by exam, but here filtered by one exam)
        setViewMode('detail');
      } else if (type) {
        // Fetch list of exams for this type
        const list = await ResultService.getExamList(student.id, type as string);

        // If only one exam, we could show details immediately, but let's stick to list for consistency unless required
        // actually, for better UX:
        if (list.length === 1) {
          const data = await ResultService.getStudentResult(student.id, list[0].id);
          setDetail(data.results[0] || null);
          setViewMode('detail');
        } else {
          setExamList(list);
          setViewMode('list');
        }
      }
    } catch (error) {

    } finally {
      setLoading(false);
    }
  };
  const handleExamPress = (exam: ExamListEntry) => {
    router.push({
      pathname: '/result-details',
      params: {
        examId: exam.id,
        title: exam.name
      }
    });
  };
  const getGrade = (pct: number) => {
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B';
    if (pct >= 60) return 'C';
    return 'D';
  };
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  if (loading) {
    return <View style={styles.container}>
      <StudentHeader showBackButton={true} title={title as string || 'Loading...'} />
      <View style={styles.centerContainer}>
        <LogoLoader size={60} color="#4F46E5" />
      </View>
    </View>;
  }

  // --- LIST VIEW ---
  if (viewMode === 'list') {
    return <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <StudentHeader showBackButton={true} title={title as string || 'Results'} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {examList.length === 0 ? <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No exams found for this category.</Text>
        </View> : <View style={styles.listContainer}>
          {examList.map((exam: ExamListEntry, index: number) => {
            return <Animated.View key={exam.id} entering={FadeInDown.delay(100 * index)}>
              <TouchableOpacity style={styles.examCard} onPress={() => handleExamPress(exam)}>
                <View style={styles.examHeader}>
                  <Text style={styles.examTitle}>{exam.name}</Text>
                  <Text style={styles.examDate}>{formatDate(exam.start_date)}</Text>
                </View>

                <View style={styles.examStats}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Subjects</Text>
                    <Text style={styles.statValue}>{exam.subjects_count}</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Percentage</Text>
                    <Text style={[styles.statValue, {
                      color: exam.percentage >= 35 ? '#10B981' : '#EF4444'
                    }]}>
                      {exam.percentage}%
                    </Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Grade</Text>
                    <Text style={styles.statValue}>{getGrade(exam.percentage)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>;
          })}
        </View>}
      </ScrollView>
    </View>;
  }

  // --- DETAIL VIEW ---
  if (!detail) {
    return <View style={styles.container}>
      <StudentHeader showBackButton={true} title={title as string || 'Result Details'} />
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>Result details not found.</Text>
      </View>
    </View>;
  }
  return <View style={styles.container}>
    <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
    <StudentHeader showBackButton={true} title={detail.exam_name || title as string || 'Result Details'} />

    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

      {/* Summary Card */}
      <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.summaryCard}>
        <LinearGradient colors={['#1F2937', '#111827']} style={styles.gradientCard} start={{
          x: 0,
          y: 0
        }} end={{
          x: 1,
          y: 1
        }}>
          <View style={styles.summaryContent}>
            <View>
              <Text style={styles.summaryLabel}>Overall Percentage</Text>
              <Text style={styles.percentageText}>{detail.percentage}%</Text>
              <Text style={styles.gradeText}>Grade: {getGrade(detail.percentage)}</Text>
            </View>
            <View style={styles.circularProgress}>
              <Text style={styles.totalScoreText}>{detail.total_obtained}</Text>
              <Text style={styles.maxScoreText}>/ {detail.total_max}</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Subject List */}
      <View style={styles.listContainer}>
        <Text style={styles.sectionTitle}>Subject Breakdown</Text>

        {(detail?.subjects || []).map((item: any, index: number) => {
          return <Animated.View key={item.subject} entering={FadeInDown.delay(300 + index * 100).duration(600)} style={styles.resultItem}>
            <View style={[styles.iconBox, {
              backgroundColor: item.is_absent ? '#FEE2E2' : '#EFF6FF'
            }]}>
              <MaterialIcons name={item.is_absent ? "event-busy" : "menu-book"} size={24} color={item.is_absent ? '#EF4444' : '#3B82F6'} />
            </View>

            <View style={styles.contentBox}>
              <View style={styles.row}>
                <Text style={styles.subjectName}>{item.subject}</Text>
                <Text style={styles.scoreText}>
                  {item.is_absent ? <Text style={[styles.scoreValue, {
                    color: '#EF4444'
                  }]}>Absent</Text> : <>
                    <Text style={[styles.scoreValue, {
                      color: '#1F2937'
                    }]}>{item.marks_obtained}</Text>
                    <Text style={styles.scoreTotal}> / {item.max_marks}</Text>
                  </>}
                </Text>
              </View>

              {!item.is_absent && <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, {
                  width: `${item.marks_obtained / item.max_marks * 100}%`,
                  backgroundColor: item.passed ? '#10B981' : '#EF4444'
                }]} />
              </View>}
            </View>
          </Animated.View>;
        })}
      </View>

    </ScrollView>
  </View>;
}
const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.card,
    paddingTop: Platform.OS === 'android' ? 30 : 0
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 50
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary
  },
  // List View Styles
  examCard: {
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: theme.colors.text,
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2
  },
  examHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  examTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827'
  },
  examDate: {
    fontSize: 14,
    color: theme.colors.textSecondary
  },
  examStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    padding: 12,
    borderRadius: 12
  },
  statItem: {
    alignItems: 'center',
    flex: 1
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: theme.colors.border
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937'
  },
  // Detailed View Styles
  summaryCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 30,
    elevation: 10,
    shadowColor: '#3B82F6',
    shadowOffset: {
      width: 0,
      height: 10
    },
    shadowOpacity: 0.3,
    shadowRadius: 20
  },
  gradientCard: {
    padding: 25,
    minHeight: 160,
    justifyContent: 'center'
  },
  summaryContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  summaryLabel: {
    color: theme.colors.textTertiary,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 5
  },
  percentageText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: theme.colors.background,
    includeFontPadding: false
  },
  gradeText: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10
  },
  circularProgress: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 8,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  totalScoreText: {
    color: theme.colors.background,
    fontSize: 24,
    fontWeight: 'bold'
  },
  maxScoreText: {
    color: theme.colors.textTertiary,
    fontSize: 12
  },
  // List Container (Shared)
  listContainer: {
    gap: 15
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 10
  },
  resultItem: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    padding: 15,
    borderRadius: 16,
    alignItems: 'center',
    gap: 15,
    shadowColor: theme.colors.text,
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center'
  },
  contentBox: {
    flex: 1,
    gap: 8
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937'
  },
  scoreText: {
    fontSize: 14
  },
  scoreValue: {
    fontWeight: 'bold',
    fontSize: 16
  },
  scoreTotal: {
    color: theme.colors.textTertiary,
    fontSize: 12
  },
  progressBarBg: {
    height: 6,
    backgroundColor: theme.colors.card,
    borderRadius: 3,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3
  }
});