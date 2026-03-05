import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, StatusBar, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO } from 'date-fns';
import * as Haptics from 'expo-haptics';
import StaffHeader from '../../src/components/StaffHeader';
import { DiaryService, DiaryEntry, TeacherService, TeacherClassAssignment } from '../../src/services/commonServices';
import { useAuth } from '../../src/hooks/useAuth';
import { useTheme } from '../../src/hooks/useTheme';
import { Shadows, Radii, Spacing, Typography, Theme } from '../../src/theme/themes';
import { api } from '../../src/services/apiClient';
import LogoLoader from '../../src/components/LogoLoader';
export default function StaffDiary() {
  const {
    user
  } = useAuth();
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [assignments, setAssignments] = useState<TeacherClassAssignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<TeacherClassAssignment | null>(null);
  const [existingEntry, setExistingEntry] = useState<DiaryEntry | null>(null);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const scrollRef = React.useRef<ScrollView>(null);

  // Load teacher assignments on mount
  useEffect(() => {
    fetchAssignments();
  }, []);
  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const data = await TeacherService.getMyClasses();
      setAssignments(data);
      if (data.length > 0) {
        setSelectedAssignment(data[0]);
      }
    } catch (error: any) {

      try {
        await api.post('/log', {
          msg: 'StaffDiary: fetchAssignments Failed',
          error: error.message
        }, {
          silent: true
        });
      } catch (e) {
        if (__DEV__) {}
      }
      Alert.alert('Error', 'Could not load your assigned classes.');
    } finally {
      setLoading(false);
    }
  };

  // Keep global history and current context updated
  useEffect(() => {
    if (assignments.length > 0) {
      fetchDiaryHistory();
    }
    if (selectedAssignment) {
      checkExistingHomework();
    }
  }, [selectedAssignment, assignments]);
  const fetchDiaryHistory = async () => {
    try {
      // New "Global History" backend behavior (no class_section_id passed)
      const allEntries = await DiaryService.getAll({});
      setDiaryEntries(allEntries);
    } catch (error: any) {

      try {
        await api.post('/log', {
          msg: 'StaffDiary: fetchDiaryHistory Failed',
          error: error.message
        }, {
          silent: true
        });
      } catch (e) {
        if (__DEV__) {}
      }
    }
  };
  const checkExistingHomework = async () => {
    if (!selectedAssignment) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await DiaryService.getAll({
        class_section_id: selectedAssignment.class_section_id,
        entry_date: today,
        subject_id: selectedAssignment.subject_id
      });

      // Find if there's an entry for the specific subject today
      const match = data.find((e) => e.subject_id === selectedAssignment.subject_id);
      if (match) {
        setExistingEntry(match);
        setTitle(match.title || '');
        setDescription(match.content || '');
        if (match.homework_due_date) {
          try {
            setDueDate(parseISO(match.homework_due_date));
          } catch (e) {
            setDueDate(new Date());
          }
        }
      } else {
        setExistingEntry(null);
        setTitle('');
        setDescription('');
        setDueDate(new Date());
      }
    } catch (error) {

    }
  };
  const handleEdit = (entry: DiaryEntry) => {
    // 1. Find the assignment matching this entry
    const matchingAssignment = assignments.find((a) => a.class_section_id === entry.class_section_id && a.subject_id === entry.subject_id);
    if (matchingAssignment) {
      // 2. Switch context & Lock
      setSelectedAssignment(matchingAssignment);
      setIsEditing(true);

      // 3. Populate form
      setExistingEntry(entry);
      setTitle(entry.title || '');
      setDescription(entry.content || '');
      if (entry.homework_due_date) {
        try {
          setDueDate(parseISO(entry.homework_due_date));
        } catch (e) {
          setDueDate(new Date());
        }
      }

      // 4. Scroll to top
      scrollRef.current?.scrollTo({
        y: 0,
        animated: true
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Alert.alert("Notice", "This assignment is no longer in your active list.");
    }
  };
  const handlePost = async () => {
    try {
      await api.post('/log', {
        msg: 'StaffDiary: handlePost initiated',
        isEditing,
        hasExisting: !!existingEntry,
        classId: selectedAssignment?.class_section_id
      }, {
        silent: true
      });
    } catch (e) {
      if (__DEV__) {}
    }
    if (!selectedAssignment) {
      Alert.alert('Error', 'Please select a class and subject');
      return;
    }
    if (!description) {
      Alert.alert('Error', 'Please enter homework description');
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    const dueStr = format(dueDate, 'yyyy-MM-dd');

    // Optional Enhancement: Duplicate Check
    if (!existingEntry) {
      const duplicate = diaryEntries.find((e) => e.class_section_id === selectedAssignment.class_section_id && e.subject_id === selectedAssignment.subject_id && e.homework_due_date === dueStr);
      if (duplicate) {
        Alert.alert("Duplicate found", "Homework already exists for this class, subject, and due date. Update the existing one instead?", [{
          text: "Cancel",
          style: "cancel"
        }, {
          text: "Update Existing",
          onPress: () => handleEdit(duplicate)
        }]);
        return;
      }
    }
    try {
      setSubmitting(true);
      const payload = {
        class_section_id: selectedAssignment.class_section_id,
        entry_date: existingEntry?.entry_date || today,
        subject_id: selectedAssignment.subject_id,
        title: title || `${selectedAssignment.subject_name} Homework`,
        content: description,
        homework_due_date: dueStr,
        created_by: user?.id || ''
      };
      if (existingEntry) {
        await DiaryService.update(existingEntry.id, payload);
        Alert.alert("Success", "Homework updated successfully!");
      } else {
        await DiaryService.create(payload as any);
        Alert.alert("Success", "Homework posted successfully!");
      }
      setIsEditing(false);
      fetchDiaryHistory();
      if (!isEditing) checkExistingHomework();
    } catch (error: any) {

      try {
        await api.post('/log', {
          msg: 'StaffDiary: handlePost Failed',
          error: error.message,
          stack: error.stack
        }, {
          silent: true
        });
      } catch (e) {
        if (__DEV__) {}
      }
      Alert.alert('Error', 'Failed to save homework');
    } finally {
      setSubmitting(false);
    }
  };
  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDueDate(selectedDate);
    }
  };
  if (loading && assignments.length === 0) {
    return <View style={[styles.container, {
      justifyContent: 'center',
      alignItems: 'center'
    }]}>
                <LogoLoader size={60} color={theme.colors.primary} />
            </View>;
  }
  return <View style={[styles.container, {
    backgroundColor: theme.colors.background
  }]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
            <StaffHeader title="Diary & Homework" showBackButton={true} />
            <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Assignment Selection */}
                <View style={[styles.selectionSection, isEditing && {
        opacity: 0.6
      }]}>
                    <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
                        <Text style={[styles.sectionTitle, {
            color: theme.colors.textStrong
          }]}>Select Class & Subject</Text>
                        {isEditing && <TouchableOpacity onPress={() => {
            setIsEditing(false);
            setExistingEntry(null);
            setTitle('');
            setDescription('');
          }}>
                                <Text style={{
              color: theme.colors.primary,
              fontWeight: '600',
              fontSize: 13
            }}>Cancel Edit</Text>
                            </TouchableOpacity>}
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.assignmentsScroll} pointerEvents={isEditing ? 'none' : 'auto'}>
                        {assignments.map((assign) => {
            return <TouchableOpacity key={assign.assignment_id} disabled={isEditing} style={[styles.assignmentChip, {
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.card
            }, selectedAssignment?.assignment_id === assign.assignment_id && {
              borderColor: theme.colors.primary,
              backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : '#EEF2FF'
            }]} onPress={() => setSelectedAssignment(assign)}>
                                <Text style={[styles.assignmentText, {
                color: theme.colors.textSecondary
              }, selectedAssignment?.assignment_id === assign.assignment_id && {
                color: theme.colors.primary,
                fontWeight: '700'
              }]}>
                                    {assign.class_name}-{assign.section_name} : {assign.subject_name}
                                </Text>
                            </TouchableOpacity>;
          })}
                    </ScrollView>
                </View>
                {/* Form Card */}
                <Animated.View entering={FadeInDown.delay(100).duration(600)} style={[styles.formCard, {
        backgroundColor: theme.colors.card,
        borderColor: theme.colors.border
      }]}>
                    <View style={styles.formHeader}>
                        <Text style={[styles.cardTitle, {
            color: theme.colors.textStrong
          }]}>
                            {existingEntry ? 'Modify Homework' : 'Post New Homework'}
                        </Text>
                        {existingEntry && <View style={styles.existingBadge}>
                                <Text style={styles.existingBadgeText}>Existing Entry</Text>
                            </View>}
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, {
            color: theme.colors.textSecondary
          }]}>Title (Optional)</Text>
                        <TextInput style={[styles.input, {
            backgroundColor: isDark ? theme.colors.background : '#F9FAFB',
            borderColor: theme.colors.border,
            color: theme.colors.text
          }]} placeholder="e.g. Chapter 5 Summary" placeholderTextColor="#94A3B8" value={title} onChangeText={setTitle} />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, {
            color: theme.colors.textSecondary
          }]}>Description</Text>
                        <TextInput style={[styles.input, styles.textArea, {
            backgroundColor: isDark ? theme.colors.background : '#F9FAFB',
            borderColor: theme.colors.border,
            color: theme.colors.text
          }]} placeholder="Details about the homework..." placeholderTextColor="#94A3B8" multiline numberOfLines={4} value={description} onChangeText={setDescription} textAlignVertical="top" />
                    </View>
                    <View style={styles.row}>
                        <View style={[styles.inputGroup, {
            flex: 1
          }]}>
                            <Text style={[styles.label, {
              color: theme.colors.textSecondary
            }]}>Due Date</Text>
                            <TouchableOpacity style={[styles.input, styles.dateInput, {
              backgroundColor: isDark ? theme.colors.background : '#F9FAFB',
              borderColor: theme.colors.border
            }]} onPress={() => setShowDatePicker(true)}>
                                <Ionicons name="calendar-outline" size={18} color={theme.colors.primary} />
                                <Text style={[styles.dateValue, {
                color: theme.colors.text
              }]}>{format(dueDate, 'PPP')}</Text>
                            </TouchableOpacity>
                        </View>
                        {showDatePicker && <DateTimePicker value={dueDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onDateChange} minimumDate={new Date()} />}
                    </View>
                    <TouchableOpacity style={[styles.postButton, {
          backgroundColor: theme.colors.primary,
          opacity: submitting ? 0.7 : 1
        }]} activeOpacity={0.8} onPress={handlePost} disabled={submitting}>
                        {submitting ? <LogoLoader color="#fff" /> : <>
                                <Text style={styles.postButtonText}>{existingEntry ? 'Update Homework' : 'Post Homework'}</Text>
                                <Ionicons name={existingEntry ? "save-outline" : "send"} size={18} color="#fff" style={{
              marginLeft: 8
            }} />
                            </>}
                    </TouchableOpacity>
                </Animated.View>
                {/* Recent History */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, {
          color: theme.colors.textStrong
        }]}>Recent Homework Tasks</Text>
                </View>
                <View style={styles.listContainer}>
                    {diaryEntries.length === 0 ? <View style={styles.emptyState}>
                            <Ionicons name="book-outline" size={48} color={theme.colors.border} />
                            <Text style={[styles.emptyText, {
            color: theme.colors.textSecondary
          }]}>No recent homework found</Text>
                        </View> : Object.keys(diaryEntries.reduce((groups, item) => {
          const date = item.entry_date;
          if (!groups[date]) groups[date] = [];
          groups[date].push(item);
          return groups;
        }, {} as Record<string, DiaryEntry[]>)).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()).map((date) => {
          return <View key={date} style={styles.dateGroup}>
                                    <View style={styles.dateHeader}>
                                        <View style={[styles.dateLine, {
                backgroundColor: theme.colors.border
              }]} />
                                        <Text style={[styles.dateLabel, {
                color: theme.colors.textSecondary
              }]}>
                                            {format(parseISO(date), 'PPPP')}
                                        </Text>
                                        <View style={[styles.dateLine, {
                backgroundColor: theme.colors.border
              }]} />
                                    </View>
                                    {diaryEntries.filter((e) => e.entry_date === date).map((item, index) => {
              return <Animated.View key={item.id} entering={FadeInDown.delay(100 + index * 50).duration(600)} style={[styles.postCard, {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border
              }]}>
                                            <View style={styles.postHeader}>
                                                <View style={{
                    flex: 1
                  }}>
                                                    <View style={{
                      flexDirection: 'row',
                      gap: 6,
                      alignItems: 'center',
                      marginBottom: 4
                    }}>
                                                        <View style={[styles.classBadge, {
                        backgroundColor: theme.colors.primary + '20'
                      }]}>
                                                            <Text style={[styles.postClass, {
                          color: theme.colors.primary,
                          marginBottom: 0
                        }]}>
                                                                {item.class_name}-{item.section_name}
                                                            </Text>
                                                        </View>
                                                        <Text style={[styles.postSubject, {
                        color: theme.colors.textSecondary
                      }]}>{item.subject_name}</Text>
                                                    </View>
                                                    <Text style={[styles.postTitle, {
                      color: theme.colors.textStrong
                    }]}>{item.title}</Text>
                                                    <Text style={[styles.postContent, {
                      color: theme.colors.textSecondary
                    }]} numberOfLines={2}>{item.content}</Text>
                                                </View>
                                            </View>
                                            <View style={[styles.divider, {
                  backgroundColor: theme.colors.border
                }]} />
                                            <View style={styles.postFooter}>
                                                <View style={styles.footerInfo}>
                                                    <Text style={styles.dueText}>Due: {item.homework_due_date ? format(parseISO(item.homework_due_date), 'MMM d') : 'N/A'}</Text>
                                                    <Text style={[styles.createdText, {
                      color: theme.colors.textSecondary
                    }]}>Posted: {format(parseISO(item.created_at), 'p')}</Text>
                                                </View>
                                                <TouchableOpacity onPress={() => handleEdit(item)}>
                                                    <View style={styles.editButton}>
                                                        <Ionicons name="create-outline" size={16} color={theme.colors.primary} />
                                                        <Text style={[styles.editText, {
                        color: theme.colors.primary
                      }]}>Edit</Text>
                                                    </View>
                                                </TouchableOpacity>
                                            </View>
                                        </Animated.View>;
            })}
                                </View>;
        })}
                </View>
            </ScrollView>
        </View>;
}
const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 50
  },
  selectionSection: {
    marginBottom: Spacing.xl
  },
  sectionTitle: {
    ...Typography.title,
    marginBottom: Spacing.md
  },
  assignmentsScroll: {
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg
  },
  assignmentChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.pill,
    borderWidth: 1,
    marginRight: Spacing.sm,
    ...Shadows.sm
  },
  assignmentText: {
    fontSize: 13
  },
  formCard: {
    borderRadius: Radii.xl,
    padding: Spacing.lg,
    ...Shadows.md,
    borderWidth: 1,
    marginBottom: Spacing.xxl
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg
  },
  cardTitle: {
    ...Typography.title
  },
  existingBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.pill
  },
  existingBadgeText: {
    fontSize: 10,
    color: '#16A34A',
    fontWeight: 'bold',
    textTransform: 'uppercase'
  },
  inputGroup: {
    marginBottom: Spacing.md
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8
  },
  input: {
    borderWidth: 1,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    fontSize: 14
  },
  textArea: {
    height: 100
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '500'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 15,
    marginBottom: Spacing.lg
  },
  postButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: Radii.xl,
    ...Shadows.md,
    height: 56
  },
  postButtonText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: 'bold'
  },
  sectionHeader: {
    marginBottom: Spacing.md
  },
  listContainer: {
    gap: Spacing.md
  },
  postCard: {
    borderRadius: Radii.lg,
    padding: Spacing.lg,
    ...Shadows.sm,
    borderWidth: 1
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm
  },
  postClass: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase'
  },
  postTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6
  },
  postContent: {
    fontSize: 14,
    lineHeight: 20
  },
  dateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.sm,
    alignItems: 'center'
  },
  dateText: {
    fontSize: 12,
    fontWeight: '700'
  },
  divider: {
    height: 1,
    marginVertical: Spacing.md
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  dueText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600'
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: Radii.md
  },
  editText: {
    fontSize: 13,
    fontWeight: '600'
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500'
  },
  dateGroup: {
    marginBottom: Spacing.xl
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.lg,
    gap: 10
  },
  dateLine: {
    flex: 1,
    height: 1
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  classBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.sm
  },
  postSubject: {
    fontSize: 14,
    fontWeight: '600'
  },
  footerInfo: {
    flex: 1,
    gap: 2
  },
  createdText: {
    fontSize: 11,
    fontWeight: '500'
  }
});