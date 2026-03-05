import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, Alert, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ADMIN_THEME } from '../../src/constants/adminTheme';
import AdminHeader from '../../src/components/AdminHeader';
import { ClassService, ClassInfo, Section } from '../../src/services/classService';
import { ResultService, Subject } from '../../src/services/commonServices';
import { StaffService, Staff } from '../../src/services/staffService';
import { TimetableService, TimetableSlot, Period } from '../../src/services/timetableService';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';

// Constants
// No days array anymore, simple daily timetable
export default function TimetableManagement() {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const [loading, setLoading] = useState(false);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);

  // Dynamic Periods
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodsLoading, setPeriodsLoading] = useState(true);

  // Dropdown Data
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);

  // Selection State
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [classSectionId, setClassSectionId] = useState<string | null>(null);
  const [yearId, setYearId] = useState<string>(''); // Current year ID
  const [classTeacherName, setClassTeacherName] = useState<string>('');

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [activeSlotData, setActiveSlotData] = useState<{
    period: number;
  } | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // Periods Management Modal
  const [managePeriodsVisible, setManagePeriodsVisible] = useState(false);
  const [editedPeriods, setEditedPeriods] = useState<Period[]>([]);

  // Single Period Edit
  const [editPeriodModalVisible, setEditPeriodModalVisible] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);

  // Create Period
  const [createPeriodVisible, setCreatePeriodVisible] = useState(false);
  const [newPeriodName, setNewPeriodName] = useState('');
  const [newPeriodStart, setNewPeriodStart] = useState('');
  const [newPeriodEnd, setNewPeriodEnd] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);
  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [cls, sec, sub, st, year, pds] = await Promise.all([ClassService.getClasses(), ClassService.getSections(), ResultService.getSubjects(), StaffService.getAll({
        status_id: 1
      }), ClassService.getCurrentAcademicYear(), TimetableService.getPeriods()]);
      setClasses(cls);
      setSections(sec);
      setSubjects(sub);
      setStaff(st);
      setPeriods(pds);
      if (year) setYearId(year.id);
    } catch (error) {

      Alert.alert('Error', 'Failed to load metadata');
    } finally {
      setLoading(false);
      setPeriodsLoading(false);
    }
  };

  // Load Slots when Class+Section is selected
  useEffect(() => {
    if (selectedClassId && selectedSectionId) {
      findClassSectionAndLoadSlots();
    }
  }, [selectedClassId, selectedSectionId]);
  const findClassSectionAndLoadSlots = async () => {
    if (!yearId) return;
    setLoading(true);
    try {
      const mappings = await ClassService.getClassSections(yearId);
      const match = mappings.find((m) => m.class_id === selectedClassId && m.section_id === selectedSectionId);
      if (match) {
        setClassSectionId(match.id);
        setClassTeacherName(match.class_teacher_name || '');
        const data = await TimetableService.getClassSlots(match.id, yearId);
        setSlots(data);
      } else {
        setClassSectionId(null);
        setClassTeacherName('');
        setSlots([]);
        Alert.alert('Notice', 'No Class-Section mapping found. Please assign section to class in "Academic Structure" first.');
      }
    } catch (error) {

    } finally {
      setLoading(false);
    }
  };
  const handlePeriodPressForSlot = (periodNumber: number) => {
    if (!classSectionId) {
      Alert.alert('Select Class', 'Please select a class and section first');
      return;
    }
    const existing = slots.find((s) => s.period_number === periodNumber);
    const periodDef = periods.find((p) => p.sort_order === periodNumber);

    setActiveSlotData({
      period: periodNumber
    });
    setStartTime(existing?.start_time || periodDef?.start_time || '09:00:00');
    setEndTime(existing?.end_time || periodDef?.end_time || '10:00:00');
    setSelectedSubjectId(existing?.subject_id || '');

    // Auto-assign class teacher for Period 1
    if (periodNumber === 1 && !existing && classTeacherName) {
      const classTeacherStaff = staff.find((s) =>
      (s.display_name || s.first_name || '') === classTeacherName
      );
      setSelectedTeacherId(classTeacherStaff?.id || '');
    } else {
      setSelectedTeacherId(existing?.teacher_id || '');
    }

    setModalVisible(true);
  };
  const handleSaveSlot = async () => {
    if (!classSectionId || !activeSlotData || !selectedSubjectId) {
      Alert.alert('Error', 'Please select a subject');
      return;
    }
    try {
      await TimetableService.createSlot({
        academic_year_id: yearId,
        class_section_id: classSectionId,
        period_number: activeSlotData.period,
        subject_id: selectedSubjectId,
        teacher_id: selectedTeacherId || undefined,
        start_time: startTime,
        end_time: endTime
      });
      setModalVisible(false);
      // Refresh
      const data = await TimetableService.getClassSlots(classSectionId, yearId);
      setSlots(data);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || error.message || 'Failed to save slot');
    }
  };
  const handleDeleteSlot = async () => {
    const existing = slots.find((s) => activeSlotData && s.period_number === activeSlotData.period);
    if (existing) {
      try {
        await TimetableService.deleteSlot(existing.id);
        setModalVisible(false);
        // Refresh
        if (classSectionId) {
          const data = await TimetableService.getClassSlots(classSectionId, yearId);
          setSlots(data);
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to delete');
      }
    }
  };
  const getSlotDisplay = (periodNumber: number) => {
    const slot = slots.find((s) => s.period_number === periodNumber);
    if (!slot) return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name="add-circle-outline" size={16} color="#6366F1" />
        <Text style={{ color: '#6366F1', fontSize: 13, fontWeight: '500' }}>Tap to assign</Text>
      </View>);

    return (
      <View style={styles.slotContent}>
        <Text style={styles.slotSubject} numberOfLines={1}>{slot.subject_name}</Text>
        {slot.teacher_name && <Text style={styles.slotTeacher} numberOfLines={1}>{slot.teacher_name}</Text>}
      </View>);

  };

  // --- Period Management ---
  const openManagePeriods = () => {
    setEditedPeriods(JSON.parse(JSON.stringify(periods))); // Deep copy
    setManagePeriodsVisible(true);
  };
  const handleSavePeriods = async () => {
    try {
      setLoading(true);
      await TimetableService.updatePeriods(editedPeriods);
      setPeriods(editedPeriods); // Optimistic update
      setManagePeriodsVisible(false);
      Alert.alert('Success', 'Timings updated successfully');
    } catch (error) {

      Alert.alert('Error', 'Failed to update periods');
    } finally {
      setLoading(false);
    }
  };
  const updatePeriodTime = (index: number, field: 'start_time' | 'end_time', value: string) => {
    const updated = [...editedPeriods];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setEditedPeriods(updated);
  };
  const handlePeriodPress = (period: Period) => {
    setEditingPeriod({
      ...period
    });
    setEditPeriodModalVisible(true);
  };
  const handleSaveSinglePeriod = async () => {
    if (!editingPeriod) return;
    try {
      setLoading(true);
      await TimetableService.updatePeriods([editingPeriod]);

      // Optimistic update
      const updatedPeriods = periods.map((p) => p.id === editingPeriod.id ? editingPeriod : p);
      setPeriods(updatedPeriods);
      setEditPeriodModalVisible(false);
      Alert.alert('Success', 'Period updated successfully');
    } catch (error) {

      Alert.alert('Error', 'Failed to update period');
    } finally {
      setLoading(false);
    }
  };
  const handleDeletePeriod = () => {
    if (!editingPeriod) return;
    Alert.alert(
      'Delete Period',
      `Are you sure you want to delete "${editingPeriod.name}"? This will also remove all timetable slots assigned to this period across all classes.`,
      [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            setLoading(true);
            await TimetableService.deletePeriod(editingPeriod.id);
            setPeriods(periods.filter((p) => p.id !== editingPeriod.id));
            setEditPeriodModalVisible(false);
            // Refresh slots if a class is selected
            if (classSectionId) {
              const data = await TimetableService.getClassSlots(classSectionId, yearId);
              setSlots(data);
            }
            Alert.alert('Success', 'Period deleted successfully');
          } catch (error) {

            Alert.alert('Error', 'Failed to delete period');
          } finally {
            setLoading(false);
          }
        }
      }]

    );
  };

  // --- Dynamic Render Logic (Breaks) ---
  const renderTableRows = () => {
    // Filter out explicit "Break" or "Lunch" rows from DB if user wants pure time-based gaps?
    // Actually, the user said "if there is any gap... consider it as break".
    // Let's filter to just "Instructional" periods if we can distinguish, 
    // OR just render them all and insert *additional* breaks if gaps exist.
    // Simple approach: Render periods in order. calculate gap.

    // Sorting
    const sortedPeriods = [...periods].sort((a, b) => a.start_time.localeCompare(b.start_time));
    const rows = [];
    for (let i = 0; i < sortedPeriods.length; i++) {
      const period = sortedPeriods[i];

      // Render Actual Period
      rows.push(
        <View
          key={period.id}
          style={styles.rowCard}>

          <TouchableOpacity
            style={styles.periodCell}
            onPress={() => handlePeriodPress(period)}
            activeOpacity={0.6}>

            <Text style={styles.periodText}>{period.name}</Text>
            <Text style={styles.timeText}>{period.start_time.substring(0, 5)} - {period.end_time.substring(0, 5)}</Text>
            <Ionicons name="pencil-outline" size={10} color="#818CF8" style={{ marginTop: 2 }} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cell, getSlotDisplay(period.sort_order) ? styles.filledCell : null]}
            onPress={() => handlePeriodPressForSlot(period.sort_order)}
            activeOpacity={0.6}>

            {getSlotDisplay(period.sort_order)}
          </TouchableOpacity>
        </View>
      );

      // Check for Gap
      if (i < sortedPeriods.length - 1) {
        const currentEnd = period.end_time;
        const nextStart = sortedPeriods[i + 1].start_time;
        if (nextStart > currentEnd) {
          rows.push(<View key={`break-${i}`} style={[styles.rowCard, {
            backgroundColor: '#FEF3C7',
            borderColor: '#FDE68A'
          }]}>
            <View style={[styles.periodCell, {
              backgroundColor: '#FDE68A'
            }]}>
              <Text style={[styles.periodText, {
                color: '#92400E',
                fontSize: 10
              }]}>BREAK</Text>
              <Text style={[styles.timeText, {
                color: '#92400E'
              }]}>{currentEnd.substring(0, 5)} - {nextStart.substring(0, 5)}</Text>
            </View>
            <View style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <Text style={{
                color: '#D97706',
                fontSize: 12,
                fontWeight: '600',
                letterSpacing: 1
              }}>BREAK</Text>
            </View>
          </View>);
        }
      }
    }
    return rows;
  };
  return <View style={styles.container}>
    <StatusBar barStyle="light-content" backgroundColor={ADMIN_THEME.colors.primary} />
    <AdminHeader title="Timetable Manager" showBackButton rightAction={{
      icon: 'time-outline',
      onPress: openManagePeriods
    }} />

    {/* Selectors */}
    <View style={styles.selectorContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {classes.map((c) => {
          return <TouchableOpacity key={c.id} style={[styles.chip, selectedClassId === c.id && styles.activeChip]} onPress={() => setSelectedClassId(c.id)}>
            <Text style={[styles.chipText, selectedClassId === c.id && styles.activeChipText]}>{c.name}</Text>
          </TouchableOpacity>;
        })}
      </ScrollView>
      <View style={{
        height: 10
      }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {sections.map((s) => {
          return <TouchableOpacity key={s.id} style={[styles.chip, selectedSectionId === s.id && styles.activeChip]} onPress={() => setSelectedSectionId(s.id)}>
            <Text style={[styles.chipText, selectedSectionId === s.id && styles.activeChipText]}>{s.name}</Text>
          </TouchableOpacity>;
        })}
      </ScrollView>
    </View>

    {/* Class Teacher Alert */}
    {classTeacherName ? <View style={{
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: '#ECFDF5',
      marginHorizontal: 12,
      borderRadius: 8,
      marginTop: 8
    }}>
      <Text style={{
        color: '#047857',
        fontWeight: '600',
        fontSize: 13
      }}>
        Class Teacher: {classTeacherName}
      </Text>
      <Text style={{
        color: '#047857',
        fontSize: 11
      }}>
        (Automatically assigned to Period 1)
      </Text>
    </View> : null}

    {/* Grid */}
    <ScrollView style={styles.gridContainer}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Daily Schedule</Text>
      </View>

      {periodsLoading ? <LogoLoader size={60} color={ADMIN_THEME.colors.primary} style={{
        marginTop: 20
      }} /> : renderTableRows()}

      {/* Add Period Button */}
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 14,
          marginTop: 4,
          marginBottom: 8,
          borderRadius: 10,
          borderWidth: 1.5,
          borderColor: '#C7D2FE',
          borderStyle: 'dashed',
          backgroundColor: '#EEF2FF',
          gap: 8
        }}
        onPress={() => {
          setNewPeriodName('');
          setNewPeriodStart('');
          setNewPeriodEnd('');
          setCreatePeriodVisible(true);
        }}>

        <Ionicons name="add-circle-outline" size={20} color="#6366F1" />
        <Text style={{ color: '#6366F1', fontWeight: '700', fontSize: 14 }}>Add New Period</Text>
      </TouchableOpacity>

      <View style={{
        height: 100
      }} />
    </ScrollView>

    {/* Edit Slot Modal */}
    <Modal transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)} animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>edit Slot: P{activeSlotData?.period}</Text>

          {activeSlotData?.period === 1 && <View style={{
            marginBottom: 10,
            padding: 8,
            backgroundColor: '#FEF3C7',
            borderRadius: 4
          }}>
            <Text style={{
              color: '#92400E',
              fontSize: 12
            }}>
              Note: Period 1 is reserved for the Class Teacher ({classTeacherName || 'None assigned'}).
              Any teacher selected here will be overridden by the Class Teacher.
            </Text>
          </View>}

          <Text style={styles.label}>Subject</Text>
          <ScrollView style={styles.listContainer} nestedScrollEnabled>
            {subjects.map((sub) => {
              return <TouchableOpacity key={sub.id} style={[styles.option, selectedSubjectId === sub.id && styles.activeOption]} onPress={() => setSelectedSubjectId(sub.id)}>
                <Text style={[styles.optionText, selectedSubjectId === sub.id && styles.activeOptionText]}>
                  {sub.name} ({sub.code})
                </Text>
              </TouchableOpacity>;
            })}
          </ScrollView>

          <Text style={styles.label}>Teacher</Text>
          <ScrollView style={styles.listContainer} nestedScrollEnabled>
            <TouchableOpacity onPress={() => setSelectedTeacherId('')} style={styles.option}>
              <Text style={styles.optionText}>-- No Teacher --</Text>
            </TouchableOpacity>
            {staff.map((st) => {
              return <TouchableOpacity key={st.id} style={[styles.option, selectedTeacherId === st.id && styles.activeOption]} onPress={() => setSelectedTeacherId(st.id)}>
                <Text style={[styles.optionText, selectedTeacherId === st.id && styles.activeOptionText]}>
                  {st.display_name || st.first_name || st.staff_code}
                </Text>
              </TouchableOpacity>;
            })}
          </ScrollView>

          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.modalButton, styles.deleteButton]} onPress={handleDeleteSlot}>
              <Text style={styles.deleteButtonText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSaveSlot}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

    {/* Edit Single Period Modal */}
    <Modal transparent={true} visible={editPeriodModalVisible} onRequestClose={() => setEditPeriodModalVisible(false)} animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Edit Period</Text>

          {editingPeriod && <View>
            <Text style={styles.label}>Period Name</Text>
            <TextInput style={[styles.input, {
              borderWidth: 1,
              borderColor: '#D1D5DB',
              borderRadius: 8,
              padding: 12,
              marginBottom: 12
            }]} value={editingPeriod.name} onChangeText={(t) => setEditingPeriod({
              ...editingPeriod,
              name: t
            })} placeholder="e.g. Period 1" />

            <Text style={styles.label}>Timings (HH:MM:SS)</Text>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10
            }}>
              <TextInput style={[styles.input, {
                flex: 1,
                borderWidth: 1,
                borderColor: '#D1D5DB',
                borderRadius: 8,
                padding: 12
              }]} value={editingPeriod.start_time} onChangeText={(t) => setEditingPeriod({
                ...editingPeriod,
                start_time: t
              })} placeholder="Start" />
              <Text>-</Text>
              <TextInput style={[styles.input, {
                flex: 1,
                borderWidth: 1,
                borderColor: '#D1D5DB',
                borderRadius: 8,
                padding: 12
              }]} value={editingPeriod.end_time} onChangeText={(t) => setEditingPeriod({
                ...editingPeriod,
                end_time: t
              })} placeholder="End" />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.deleteButton]} onPress={handleDeletePeriod}>
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setEditPeriodModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSaveSinglePeriod}>
                <Text style={styles.saveButtonText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>}
        </View>
      </View>
    </Modal>

    {/* Manage Periods Modal (Bulk) */}
    <Modal transparent={true} visible={managePeriodsVisible} onRequestClose={() => setManagePeriodsVisible(false)} animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, {
          maxHeight: '90%'
        }]}>
          <Text style={styles.modalTitle}>Manage All Timings</Text>
          <Text style={{
            fontSize: 12,
            color: '#6B7280',
            marginBottom: 10
          }}>
            Breaks are automatically displayed for any time gaps.
          </Text>

          <ScrollView>
            {editedPeriods.map((period, index) => {
              return <View key={period.id} style={styles.periodRowEdit}>
                <Text style={styles.periodLabelEdit}>{period.name}</Text>
                <View style={styles.timeInputContainer}>
                  <TextInput style={styles.timeInput} value={period.start_time} onChangeText={(t) => updatePeriodTime(index, 'start_time', t)} placeholder="HH:MM:SS" />
                  <Text>-</Text>
                  <TextInput style={styles.timeInput} value={period.end_time} onChangeText={(t) => updatePeriodTime(index, 'end_time', t)} placeholder="HH:MM:SS" />
                </View>
              </View>;
            })}
          </ScrollView>

          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setManagePeriodsVisible(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSavePeriods}>
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

    {/* Create Period Modal */}
    <Modal transparent={true} visible={createPeriodVisible} onRequestClose={() => setCreatePeriodVisible(false)} animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Add New Period</Text>

          <Text style={styles.label}>Period Name</Text>
          <TextInput
            style={[styles.input, { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, marginBottom: 12 }]}
            value={newPeriodName}
            onChangeText={setNewPeriodName}
            placeholder="e.g. Period 9" />

          <Text style={styles.label}>Timings (HH:MM:SS)</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TextInput
              style={[styles.input, { flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12 }]}
              value={newPeriodStart}
              onChangeText={setNewPeriodStart}
              placeholder="e.g. 14:15:00" />

            <Text>-</Text>
            <TextInput
              style={[styles.input, { flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12 }]}
              value={newPeriodEnd}
              onChangeText={setNewPeriodEnd}
              placeholder="e.g. 15:00:00" />

          </View>

          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setCreatePeriodVisible(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton]}
              onPress={async () => {
                if (!newPeriodName || !newPeriodStart || !newPeriodEnd) {
                  Alert.alert('Error', 'All fields are required');
                  return;
                }
                try {
                  setLoading(true);
                  const created = await TimetableService.createPeriod({
                    name: newPeriodName,
                    start_time: newPeriodStart,
                    end_time: newPeriodEnd
                  });
                  setPeriods([...periods, created]);
                  setCreatePeriodVisible(false);
                  Alert.alert('Success', `"${created.name}" created successfully`);
                } catch (error: any) {

                  Alert.alert('Error', error.response?.data?.error || 'Failed to create period');
                } finally {
                  setLoading(false);
                }
              }}>

              <Text style={styles.saveButtonText}>Create</Text>
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
  selectorContainer: {
    padding: 12,
    backgroundColor: theme.colors.background,
    elevation: 2
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    marginRight: 8
  },
  activeChip: {
    backgroundColor: '#6366F1'
  },
  chipText: {
    color: theme.colors.textSecondary,
    fontWeight: '600'
  },
  activeChipText: {
    color: theme.colors.background
  },
  gridContainer: {
    flex: 1,
    padding: 8
  },
  headerRow: {
    flexDirection: 'row',
    marginBottom: 4
  },
  headerTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    color: theme.colors.text,
    marginLeft: 4,
    marginBottom: 8
  },
  rowCard: {
    flexDirection: 'row',
    marginBottom: 8,
    height: 70,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: theme.colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2
  },
  periodCell: {
    width: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border
  },
  periodText: {
    fontWeight: 'bold',
    color: '#4F46E5',
    fontSize: 14
  },
  timeText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4
  },
  cell: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 16
  },
  filledCell: {
    backgroundColor: '#F8FAFC'
  },
  slotContent: {
    alignItems: 'flex-start'
  },
  slotSubject: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937'
  },
  slotTeacher: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#111827'
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
    color: '#374151'
  },
  listContainer: {
    height: 150,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    marginBottom: 4
  },
  option: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.card
  },
  activeOption: {
    backgroundColor: '#EEF2FF'
  },
  optionText: {
    color: '#374151'
  },
  activeOptionText: {
    color: theme.colors.primary,
    fontWeight: 'bold'
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 10
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  deleteButton: {
    backgroundColor: '#FEE2E2'
  },
  cancelButton: {
    backgroundColor: theme.colors.card
  },
  saveButton: {
    backgroundColor: '#6366F1'
  },
  deleteButtonText: {
    color: '#EF4444',
    fontWeight: '600'
  },
  cancelButtonText: {
    color: theme.colors.textSecondary,
    fontWeight: '600'
  },
  saveButtonText: {
    color: theme.colors.background,
    fontWeight: '600'
  },
  // Period Edit Styles
  periodRowEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.card
  },
  periodLabelEdit: {
    fontWeight: '600',
    color: '#374151',
    width: '30%'
  },
  timeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  timeInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 4,
    padding: 8,
    width: 80,
    textAlign: 'center'
  },
  input: {
    backgroundColor: theme.colors.background,
    color: '#1F2937',
    fontSize: 14
  }
});