import { TourTarget, TourScrollView } from '@/src/features/app-tour';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import AdminHeader from '../../src/components/AdminHeader';
import AppDatePicker, { parseYMD, toYMD } from '../../src/components/AppDatePicker';
import AppTextInput from '../../src/components/AppTextInput';
import LogoLoader from '../../src/components/LogoLoader';
import { useTheme } from '../../src/hooks/useTheme';
import { useAdminWebChrome } from '../../src/contexts/AdminWebChromeContext';
import { alertCompat } from '../../src/utils/crossPlatformAlert';
import {
  CandidateResponse,
  SubstituteCandidate,
  SubstitutionBoard,
  SubstitutionService,
  SubstitutionSlot,
} from '../../src/services/substitutionService';
import { SchoolService } from '../../src/services/schoolService';
import {
  downloadSubstitutionReportPdf,
  SubstitutionReportMode,
} from '../../src/utils/substitutionReportPdf';
import { downloadSubstitutionReportCsv } from '../../src/utils/substitutionReportCsv';
import {
  buildPeriodDisplayMap,
  getSlotDisplayInfo,
} from '../../src/utils/substitutionPeriodNumbering';
import { regularTeacherMetaLabel } from '../../src/utils/manualSubstitutionSlots';
import ManualPlanningBoard from '../../src/components/admin/substitutions/ManualPlanningBoard';

type BoardView = 'time' | 'class';
type AssignmentFilter = 'all' | 'pending' | 'confirmed';

function isConfirmedCover(slot: SubstitutionSlot) {
  return Boolean(slot.substitution_id && slot.substitute_teacher_name && !slot.is_auto_suggested);
}

function timeLabel(value?: string) {
  if (!value) return '';
  const [hourRaw, minute = '00'] = value.split(':');
  const hour = Number(hourRaw);
  if (Number.isNaN(hour)) return value.slice(0, 5);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${suffix}`;
}

function classLabel(slot: SubstitutionSlot) {
  return `${slot.class_name}-${slot.section_name}`;
}

function initials(name?: string | null) {
  const words = String(name || 'Teacher').trim().split(/\s+/);
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join('');
}

function scoreColor(score: number, isDark: boolean) {
  if (score >= 85) return isDark ? '#6EE7B7' : '#047857';
  if (score >= 70) return isDark ? '#A5B4FC' : '#4338CA';
  return isDark ? '#FBBF24' : '#B45309';
}

export default function DailySubstitutionsScreen() {
  const { isDark } = useTheme();
  const { shellActive } = useAdminWebChrome();
  const { width } = useWindowDimensions();
  const c = useMemo(() => colors(isDark), [isDark]);
  const styles = useMemo(() => makeStyles(c), [c]);
  const today = useMemo(() => toYMD(new Date()), []);

  const [date, setDate] = useState(today);
  const [view, setView] = useState<BoardView>('time');
  const [board, setBoard] = useState<SubstitutionBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>('all');
  const [coverNotice, setCoverNotice] = useState<string | null>(null);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportMode, setReportMode] = useState<SubstitutionReportMode>('complete');
  const [reportDownloading, setReportDownloading] = useState(false);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [targetSlot, setTargetSlot] = useState<SubstitutionSlot | null>(null);
  const [candidateData, setCandidateData] = useState<CandidateResponse | null>(null);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<SubstituteCandidate | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [assignmentSource, setAssignmentSource] = useState<'board' | 'manual'>('board');
  const [planningOpen, setPlanningOpen] = useState(false);
  const [planningBoard, setPlanningBoard] = useState<SubstitutionBoard | null>(null);
  const [, setPlanningLoading] = useState(false);
  const [planningRefreshing, setPlanningRefreshing] = useState(false);
  const [planningError, setPlanningError] = useState<string | null>(null);
  const [planningNotice, setPlanningNotice] = useState<{ slotId: string; title: string; detail: string } | null>(null);
  const planningBoardRef = useRef<SubstitutionBoard | null>(null);
  const planningRequestRef = useRef(0);
  const assignLock = useRef(false);
  const openingRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  const loadBoard = useCallback(async (nextDate = date, pull = false) => {
    if (pull) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);
    try {
      const data = await SubstitutionService.getBoard(nextDate, 'affected');
      setBoard(data);
    } catch (error: any) {
      const msg = error?.message || 'Please try again.';
      setLoadError(msg);
      alertCompat('Could not load substitutions', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [date]);

  const loadPlanning = useCallback(async (nextDate: string) => {
    const requestId = ++planningRequestRef.current;
    const hasCurrent = planningBoardRef.current?.date === nextDate;
    if (hasCurrent) setPlanningRefreshing(true);
    else setPlanningLoading(true);
    setPlanningError(null);
    try {
      const data = await SubstitutionService.getBoard(nextDate, 'all');
      if (planningRequestRef.current !== requestId) return;
      planningBoardRef.current = data;
      setPlanningBoard(data);
    } catch (error: any) {
      if (planningRequestRef.current !== requestId) return;
      setPlanningError(error?.message || 'Please try again.');
      if (!hasCurrent) {
        planningBoardRef.current = null;
        setPlanningBoard(null);
      }
    } finally {
      if (planningRequestRef.current === requestId) {
        setPlanningLoading(false);
        setPlanningRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    setTeacherFilter('');
    setCoverNotice(null);
    setSheetVisible(false);
    setAssignmentSource('board');
    setPlanningNotice(null);
    loadBoard(date);
  }, [date, loadBoard]);

  useEffect(() => {
    if (!planningOpen) return;
    loadPlanning(date);
  }, [planningOpen, date, loadPlanning]);

  const periodMap = useMemo(() => buildPeriodDisplayMap(board?.periods || []), [board?.periods]);

  const filteredSlots = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (board?.slots || []).filter((slot) => {
      if (teacherFilter && slot.regular_teacher_id !== teacherFilter) return false;
      if (assignmentFilter === 'pending' && isConfirmedCover(slot)) return false;
      if (assignmentFilter === 'confirmed' && !isConfirmedCover(slot)) return false;
      if (!q) return true;
      return [
        slot.class_name,
        slot.section_name,
        slot.subject_name,
        slot.regular_teacher_name,
        slot.substitute_teacher_name,
      ].some((value) => String(value || '').toLowerCase().includes(q));
    });
  }, [board?.slots, query, teacherFilter, assignmentFilter]);

  const pendingSlots = useMemo(
    () => (board?.slots || []).filter((slot) => !isConfirmedCover(slot)),
    [board?.slots]
  );
  const nextPendingSlot = filteredSlots
    .filter((slot) => !isConfirmedCover(slot) && slot.regular_teacher_id)
    .sort((a, b) => a.period_number - b.period_number)[0];

  const groups = useMemo(() => {
    if (view === 'time') {
      return (board?.periods || [])
        .map((period) => {
          const info = getSlotDisplayInfo(period, periodMap);
          return {
            key: `period-${period.sort_order}`,
            title: info.displayLabel || period.name || `Period ${period.sort_order}`,
            subtitle: `${timeLabel(period.start_time)} – ${timeLabel(period.end_time)}`,
            icon: (info.isBreak ? 'cafe-outline' : 'time-outline') as keyof typeof Ionicons.glyphMap,
            slots: filteredSlots
              .filter((slot) => slot.period_number === period.sort_order)
              .sort((a, b) => Number(isConfirmedCover(a)) - Number(isConfirmedCover(b))),
          };
        })
        .filter((group) => group.slots.length > 0);
    }

    const map = new Map<string, SubstitutionSlot[]>();
    for (const slot of filteredSlots) {
      const key = `${slot.class_section_id}::${classLabel(slot)}`;
      const list = map.get(key) || [];
      list.push(slot);
      map.set(key, list);
    }
    return [...map.entries()]
      .map(([key, slots]) => ({
        key,
        title: classLabel(slots[0]),
        subtitle: `${slots.length} teaching period${slots.length === 1 ? '' : 's'}`,
        icon: 'school-outline' as const,
        slots: [...slots].sort((a, b) =>
          Number(isConfirmedCover(a)) - Number(isConfirmedCover(b)) || a.period_number - b.period_number
        ),
      }))
      .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
  }, [board?.periods, filteredSlots, periodMap, view]);

  const assignedSlots = useMemo(
    () => (board?.slots || []).filter(isConfirmedCover),
    [board?.slots]
  );

  const downloadReport = async () => {
    if (!board || assignedSlots.length === 0 || reportDownloading) return;
    setReportDownloading(true);
    try {
      const schoolProfile = await SchoolService.getProfile().catch(() => null);
      await downloadSubstitutionReportPdf(board, reportMode, {
        schoolName: schoolProfile?.name,
        logoUrl: schoolProfile?.logo_url,
      });
      setReportVisible(false);
    } catch (error: any) {
      alertCompat('Could not create report', error?.message || 'Please try again.');
    } finally {
      setReportDownloading(false);
    }
  };

  const downloadCsv = async () => {
    if (!board || assignedSlots.length === 0 || reportDownloading) return;
    setReportDownloading(true);
    try {
      await downloadSubstitutionReportCsv(board);
      setReportVisible(false);
    } catch (error: any) {
      alertCompat('Could not export CSV', error?.message || 'Please try again.');
    } finally {
      setReportDownloading(false);
    }
  };

  const closeCandidateSheet = () => {
    if (saving) return;
    setSheetVisible(false);
    setAssignmentSource('board');
  };

  const openPlanning = () => {
    if (planningBoardRef.current?.date !== date) setPlanningLoading(true);
    setPlanningError(null);
    setPlanningOpen(true);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: true }));
  };

  const closePlanning = () => {
    if (saving) return;
    setSheetVisible(false);
    setPlanningOpen(false);
    setAssignmentSource('board');
    setPlanningNotice(null);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: false }));
  };

  const openAssignment = async (slot: SubstitutionSlot, source: 'board' | 'manual' = 'board') => {
    if (openingRef.current || saving) return;
    if (!slot.regular_teacher_id) {
      alertCompat('Regular teacher required', 'Assign a regular teacher in the timetable before arranging cover.');
      return;
    }
    openingRef.current = true;
    setAssignmentSource(source);
    setTargetSlot(slot);
    setCandidateData(null);
    setSelectedCandidate(null);
    setReason(isConfirmedCover(slot) ? (slot.reason || '') : '');
    setSheetVisible(true);
    setCandidatesLoading(true);
    try {
      const data = await SubstitutionService.getCandidates(date, slot.slot_id);
      setCandidateData(data);
      if (data.candidates.length > 0) setSelectedCandidate(data.candidates[0]);
    } catch (error: any) {
      alertCompat('Could not find available teachers', error?.message || 'Please try again.');
      setSheetVisible(false);
      setAssignmentSource('board');
    } finally {
      setCandidatesLoading(false);
      openingRef.current = false;
    }
  };

  const assign = async () => {
    if (!targetSlot || !selectedCandidate || assignLock.current || saving) return;
    assignLock.current = true;
    setSaving(true);
    const fromPlanning = assignmentSource === 'manual';
    const slotSnapshot = targetSlot;
    const teacherName = selectedCandidate.teacher_name;
    try {
      await SubstitutionService.assign({
        date,
        slot_id: slotSnapshot.slot_id,
        substitute_teacher_id: selectedCandidate.id,
        reason: reason.trim(),
        supersede_substitution_id:
          slotSnapshot.substitution_id && !slotSnapshot.is_auto_suggested
            ? slotSnapshot.substitution_id
            : undefined,
      });
      setSheetVisible(false);
      setAssignmentSource('board');
      if (fromPlanning) {
        setPlanningNotice({
          slotId: slotSnapshot.slot_id,
          title: 'Cover assigned',
          detail: `${teacherName} will cover ${classLabel(slotSnapshot)} for this date only. The regular timetable resumes the next day.`,
        });
        await Promise.all([loadBoard(date), loadPlanning(date)]);
      } else {
        setCoverNotice(`${teacherName} is assigned to ${classLabel(slotSnapshot)} · ${getSlotDisplayInfo(slotSnapshot, periodMap).displayLabel}. Cover applies to this date only.`);
        await loadBoard(date, true);
      }
    } catch (error: any) {
      alertCompat('Could not assign cover', error?.message || 'Please refresh and try again.');
    } finally {
      assignLock.current = false;
      setSaving(false);
    }
  };

  const cancelAssignment = (slot: SubstitutionSlot) => {
    if (!slot.substitution_id) return;
    alertCompat(
      'Cancel this substitution?',
      `${slot.substitute_teacher_name} will be removed from ${classLabel(slot)} for ${date}.`,
      [
        { text: 'Keep assignment', style: 'cancel' },
        {
          text: 'Cancel substitution',
          style: 'destructive',
          onPress: async () => {
            try {
              await SubstitutionService.cancel(slot.substitution_id!);
              await loadBoard(date);
            } catch (error: any) {
              alertCompat('Could not cancel', error?.message || 'Please try again.');
            }
          },
        },
      ]
    );
  };

  const cardBasis = width >= 1200 ? '31.8%' : width >= 760 ? '48.5%' : '100%';
  const selectedDateLabel = parseYMD(date).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <TourTarget id="screen.admin-substitutions.overview" native><View style={styles.screen}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {!shellActive && <AdminHeader title="Daily Substitutions" showBackButton />}

      <TourTarget id="screen.admin-substitutions.workspace" native><TourScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              loadBoard(date, true);
              if (planningOpen) loadPlanning(date);
            }}
            tintColor={c.primary}
          />
        }
      >
        {!planningOpen ? (
          <LinearGradient
            colors={isDark ? ['#1E1B4B', '#172554'] : ['#312E81', '#4F46E5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroGlowOne} />
            <View style={styles.heroGlowTwo} />
            <View style={styles.heroTop}>
              <View style={styles.heroCopy}>
                <View style={styles.eyebrow}>
                  <Ionicons name="sparkles" size={13} color="#C7D2FE" />
                  <Text style={styles.eyebrowText}>SMART COVER DESK</Text>
                </View>
                <Text style={styles.heroTitle}>Daily substitutions</Text>
                <Text style={styles.heroSubtitle}>
                  Review pending classes, choose an available teacher, and confirm one-day cover.
                </Text>
              </View>
              {nextPendingSlot && !loading && !loadError ? (
                <View style={styles.heroActionGroup}>
                  <Pressable
                    onPress={() => openAssignment(nextPendingSlot)}
                    disabled={saving || candidatesLoading}
                    accessibilityRole="button"
                    accessibilityLabel={`Review next pending class, ${classLabel(nextPendingSlot)}, ${getSlotDisplayInfo(nextPendingSlot, periodMap).displayLabel}`}
                    style={({ pressed }) => [styles.heroAction, pressed && styles.heroActionPressed, (saving || candidatesLoading) && styles.actionDisabled]}
                  >
                    <Ionicons name="person-add-outline" size={20} color={c.action} />
                    <Text style={styles.heroActionText}>Assign next class</Text>
                    <Ionicons name="arrow-forward" size={18} color={c.action} />
                  </Pressable>
                  <Text style={styles.heroActionHint}>{classLabel(nextPendingSlot)} · {getSlotDisplayInfo(nextPendingSlot, periodMap).displayLabel} · one-day cover</Text>
                </View>
              ) : (
                <View style={styles.resetBadge}>
                  <Ionicons name="refresh-circle" size={22} color="#A7F3D0" />
                  <View>
                    <Text style={styles.resetTitle}>Auto resets</Text>
                    <Text style={styles.resetText}>Regular timetable resumes next day</Text>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.heroStats}>
              <Stat value={assignedSlots.length} label="Confirmed" />
              <View style={styles.statDivider} />
              <Stat
                value={pendingSlots.length}
                label="Awaiting assignment"
              />
              <View style={styles.statDivider} />
              <Stat
                value={board?.summary.unavailable_teachers_count ?? (board?.unavailable_teachers?.length || 0)}
                label="Unavailable staff"
              />
            </View>
          </LinearGradient>
        ) : null}

        {planningOpen ? (
          <View style={styles.planningTopBar}>
            <TouchableOpacity
              onPress={closePlanning}
              activeOpacity={0.8}
              style={styles.planningBackTopBtn}
              accessibilityRole="button"
              accessibilityLabel="Back to daily substitutions overview"
            >
              <Ionicons name="arrow-back" size={18} color={c.primary} />
              <Text style={styles.planningBackTopText}>Back to overview</Text>
            </TouchableOpacity>

            <View style={styles.planningDateWrap}>
              <Text style={styles.planningDateLabel}>COVER DATE</Text>
              <AppDatePicker
                value={date}
                onChange={setDate}
                label={selectedDateLabel}
                isDark={isDark}
                containerStyle={{ marginBottom: 0 }}
                wrapperStyle={styles.datePicker}
                accentColor={c.primary}
              />
            </View>
          </View>
        ) : (
          <View style={styles.controlCard}>
            <View style={styles.controlTop}>
              <View style={styles.dateCell}>
                <Text style={styles.controlLabel}>COVER DATE</Text>
                <AppDatePicker
                  value={date}
                  onChange={setDate}
                  label={selectedDateLabel}
                  isDark={isDark}
                  containerStyle={{ marginBottom: 0 }}
                  wrapperStyle={styles.datePicker}
                  accentColor={c.primary}
                />
              </View>
              <View style={styles.viewCell}>
                <Text style={styles.controlLabel}>ORGANISE BY</Text>
                <View style={styles.segment}>
                  <SegmentButton
                    active={view === 'time'}
                    icon="time-outline"
                    label="Time wise"
                    onPress={() => setView('time')}
                    c={c}
                  />
                  <SegmentButton
                    active={view === 'class'}
                    icon="school-outline"
                    label="Class wise"
                    onPress={() => setView('class')}
                    c={c}
                  />
                </View>
              </View>
            </View>

            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={18} color={c.muted} />
              <AppTextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search class, subject or teacher"
                placeholderTextColor={c.muted}
                style={styles.searchInput}
                accessibilityLabel="Search classes, subjects or teachers"
              />
              {query ? (
                <TouchableOpacity onPress={() => setQuery('')} style={styles.clearSearch} accessibilityRole="button" accessibilityLabel="Clear search">
                  <Ionicons name="close" size={15} color={c.muted} />
                </TouchableOpacity>
              ) : null}
            </View>

            <Text style={[styles.controlLabel, { marginTop: 18 }]}>UNAVAILABLE TEACHER</Text>
            <TourScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.teacherChips}>
              <FilterChip
                label="All teachers"
                active={!teacherFilter}
                onPress={() => setTeacherFilter('')}
                c={c}
              />
              {(board?.unavailable_teachers && board.unavailable_teachers.length > 0
                ? board.unavailable_teachers
                : (board?.teachers || []).map((t) => ({ id: t.id, teacher_name: t.teacher_name, source_label: 'Unavailable' }))
              ).map((teacher) => (
                <FilterChip
                  key={teacher.id}
                  label={teacher.teacher_name}
                  sublabel={teacher.source_label}
                  active={teacherFilter === teacher.id}
                  onPress={() => setTeacherFilter(teacherFilter === teacher.id ? '' : teacher.id)}
                  c={c}
                />
              ))}
            </TourScrollView>

            <View style={styles.controlActions}>
              <TouchableOpacity
                onPress={openPlanning}
                activeOpacity={0.85}
                style={styles.secondaryControlButton}
                accessibilityRole="button"
                accessibilityLabel="Add manual substitution"
              >
                <Ionicons name="add-circle-outline" size={18} color={c.controlText} />
                <Text style={styles.secondaryControlText}>Add manual substitution</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setReportVisible(true)}
                disabled={loading || assignedSlots.length === 0}
                activeOpacity={0.82}
                style={[styles.secondaryControlButton, (loading || assignedSlots.length === 0) && styles.actionDisabled]}
                accessibilityRole="button"
                accessibilityLabel={`Download ${assignedSlots.length} confirmed assignments`}
                accessibilityHint={assignedSlots.length === 0 ? 'Confirm an assignment to enable downloads.' : 'Choose PDF or CSV for the duty register.'}
              >
                <Ionicons name="download-outline" size={18} color={c.controlText} />
                <Text style={styles.secondaryControlText}>Download list ({assignedSlots.length})</Text>
              </TouchableOpacity>
            </View>
            {!loading && assignedSlots.length === 0 ? <Text style={styles.downloadHint}>Confirm an assignment to enable PDF and CSV downloads.</Text> : null}
          </View>
        )}

        {planningOpen ? (
          <ManualPlanningBoard
            dateLabel={selectedDateLabel}
            board={planningBoard?.date === date ? planningBoard : null}
            loading={!(planningBoard?.date === date) && !planningError}
            refreshing={planningRefreshing && planningBoard?.date === date}
            error={planningError}
            notice={planningNotice}
            onDismissNotice={() => setPlanningNotice(null)}
            onRetry={() => loadPlanning(date)}
            onBack={closePlanning}
            onSelectSlot={(slot) => openAssignment(slot, 'manual')}
          />
        ) : (
        <>
        {coverNotice ? (
          <View style={styles.coverNotice} role="status" accessibilityLiveRegion="polite">
            <Ionicons name="checkmark-circle" size={22} color={c.successText} />
            <View style={{ flex: 1 }}>
              <Text style={styles.coverNoticeTitle}>Substitute assigned</Text>
              <Text style={styles.coverNoticeText}>{coverNotice}</Text>
            </View>
            <TouchableOpacity onPress={() => setCoverNotice(null)} style={styles.noticeDismiss} accessibilityRole="button" accessibilityLabel="Dismiss assignment confirmation">
              <Ionicons name="close" size={20} color={c.successText} />
            </TouchableOpacity>
          </View>
        ) : null}

        {board && !loading && !loadError && board.slots.length > 0 ? (
          <View style={styles.boardToolbar}>
            <View style={styles.statusFilters} accessibilityRole="tablist" accessibilityLabel="Filter classes by assignment status">
              {([
                { key: 'all', label: 'All classes', count: board.slots.length },
                { key: 'pending', label: 'Needs cover', count: pendingSlots.length },
                { key: 'confirmed', label: 'Confirmed', count: assignedSlots.length },
              ] as const).map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => setAssignmentFilter(item.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: assignmentFilter === item.key }}
                  aria-selected={assignmentFilter === item.key}
                  accessibilityLabel={`${item.label}, ${item.count}`}
                  style={[styles.statusFilter, assignmentFilter === item.key && styles.statusFilterActive]}
                >
                  <Text style={[styles.statusFilterText, assignmentFilter === item.key && styles.statusFilterTextActive]}>{item.label}</Text>
                  <Text style={[styles.statusFilterCount, assignmentFilter === item.key && styles.statusFilterTextActive]}>{item.count}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.resultsLabel}>{filteredSlots.length} of {board.slots.length} classes shown</Text>
          </View>
        ) : null}

        {/* Informational Banner: Attendance not recorded */}
        {board && board.attendance_recorded === false ? (
          <View style={styles.attendanceBanner}>
            <Ionicons name="information-circle-outline" size={20} color={c.infoText} />
            <View style={{ flex: 1 }}>
              <Text style={styles.attendanceBannerTitle}>Staff attendance not recorded for this date</Text>
              <Text style={styles.attendanceBannerText}>
                Unavailable teachers and affected classes are identified automatically using approved staff leave records.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Advisory Banner: Classes needing substitute cover */}
        {board && !loading && !loadError && pendingSlots.length > 0 ? (
          <View style={styles.advisoryBanner}>
            <Ionicons name="alert-circle" size={22} color={c.warningText} />
            <View style={{ flex: 1, minWidth: 180 }}>
              <Text style={styles.advisoryBannerTitle}>
                {pendingSlots.length} {pendingSlots.length === 1 ? 'class still needs' : 'classes still need'} cover
              </Text>
              <Text style={styles.advisoryBannerText}>
                Open a class below to review available teachers, then confirm the assignment.
              </Text>
            </View>
            {nextPendingSlot ? (
              <Pressable
                onPress={() => openAssignment(nextPendingSlot)}
                disabled={saving || candidatesLoading}
                accessibilityRole="button"
                accessibilityLabel={`Assign next class, ${classLabel(nextPendingSlot)}, ${getSlotDisplayInfo(nextPendingSlot, periodMap).displayLabel}`}
                style={({ pressed }) => [styles.nextClassButton, pressed && styles.assignButtonPressed, (saving || candidatesLoading) && styles.actionDisabled]}
              >
                <Text style={styles.nextClassButtonText}>Assign next class</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </Pressable>
            ) : null}
          </View>
        ) : board && !loading && !loadError && board.slots.length > 0 && pendingSlots.length === 0 ? (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={22} color={c.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.successBannerTitle}>All affected classes covered</Text>
              <Text style={styles.successBannerText}>
                All {board.slots.length} affected {board.slots.length === 1 ? 'period has' : 'periods have'} confirmed substitute teachers for this date.
              </Text>
            </View>
          </View>
        ) : null}

        {loadError ? (
          <Animated.View entering={FadeIn.duration(220)} style={styles.errorState}>
            <View style={styles.errorIcon}>
              <Ionicons name="cloud-offline-outline" size={32} color={c.danger} />
            </View>
            <Text style={styles.errorTitle}>Unable to load cover board</Text>
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity onPress={() => loadBoard(date)} style={styles.retryButton}>
              <Ionicons name="refresh" size={16} color="#FFFFFF" />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : loading ? (
          <View style={styles.loadingState}>
            <LogoLoader size={52} color={c.primary} />
            <Text style={styles.loadingText}>Analyzing teacher availability and timetable…</Text>
          </View>
        ) : (board?.unavailable_teachers?.length || 0) === 0 && (board?.slots?.length || 0) === 0 ? (
          <Animated.View entering={FadeIn.duration(220)} style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: c.successSoft }]}>
              <Ionicons name="checkmark-done-circle" size={32} color={c.success} />
            </View>
            <Text style={styles.emptyTitle}>All teachers available</Text>
            <Text style={styles.emptyText}>
              No teachers are on approved leave or marked absent for {selectedDateLabel}. You can still add a manual substitution for any scheduled class. It applies to this date only, and the regular timetable resumes the next day.
            </Text>
            <TouchableOpacity
              onPress={openPlanning}
              activeOpacity={0.85}
              style={[styles.manualButton, { marginTop: 16 }]}
              accessibilityRole="button"
              accessibilityLabel="Add manual substitution"
            >
              <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.manualButtonText}>Add manual substitution</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (board?.unavailable_teachers?.length || 0) > 0 && (board?.slots?.length || 0) === 0 ? (
          <Animated.View entering={FadeIn.duration(220)} style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: c.infoSoft }]}>
              <Ionicons name="people-outline" size={32} color={c.infoText} />
            </View>
            <Text style={styles.emptyTitle}>No affected classes require cover</Text>
            <Text style={styles.emptyText}>
              {board?.unavailable_teachers?.length} {board?.unavailable_teachers?.length === 1 ? 'teacher is' : 'teachers are'} unavailable on {selectedDateLabel} ({board?.unavailable_teachers?.map((t) => `${t.teacher_name} [${t.source_label}]`).join(', ')}), but none have teaching periods scheduled in the timetable for this day.
            </Text>
          </Animated.View>
        ) : groups.length === 0 ? (
          <Animated.View entering={FadeIn.duration(220)} style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="calendar-outline" size={30} color={c.primary} />
            </View>
            <Text style={styles.emptyTitle}>{assignmentFilter === 'pending' && pendingSlots.length === 0 ? 'All cover is confirmed' : assignmentFilter === 'confirmed' && assignedSlots.length === 0 ? 'No confirmed assignments yet' : 'No matching classes'}</Text>
            <Text style={styles.emptyText}>
              {assignmentFilter === 'pending' && pendingSlots.length === 0 ? 'Every affected class has a substitute. View all classes to review or change an assignment.' : assignmentFilter === 'confirmed' && assignedSlots.length === 0 ? 'Choose Needs cover to assign a substitute. Confirmed assignments will appear here.' : 'Try another search or clear your filters to see all classes.'}
            </Text>
            <TouchableOpacity onPress={() => { setQuery(''); setTeacherFilter(''); setAssignmentFilter('all'); }} style={styles.clearFilterButton} accessibilityRole="button">
              <Text style={styles.clearFilterButtonText}>Show all classes</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <View style={styles.groups}>
            {groups.map((group, groupIndex) => (
              <Animated.View
                key={group.key}
                entering={FadeInDown.delay(Math.min(groupIndex, 5) * 45).duration(280)}
                style={styles.group}
              >
                <View style={styles.groupHeader}>
                  <View style={styles.groupIcon}>
                    <Ionicons name={group.icon} size={17} color={c.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.groupTitle}>{group.title}</Text>
                    <Text style={styles.groupSubtitle}>{group.subtitle}</Text>
                  </View>
                  <View style={styles.groupCount}>
                    <Text style={styles.groupCountText}>{group.slots.length}</Text>
                  </View>
                </View>
                <View style={styles.slotGrid}>
                  {group.slots.map((slot) => {
                    const slotPeriodInfo = getSlotDisplayInfo(slot, periodMap);
                    return (
                      <SubstitutionCard
                        key={slot.slot_id}
                        slot={slot}
                        periodDisplayLabel={slotPeriodInfo.displayLabel}
                        basis={cardBasis}
                        c={c}
                        styles={styles}
                        onAssign={() => openAssignment(slot)}
                        onCancel={() => cancelAssignment(slot)}
                        busy={saving || candidatesLoading}
                      />
                    );
                  })}
                </View>
              </Animated.View>
            ))}
          </View>
        )}
        </>
        )}
      </TourScrollView></TourTarget>

      <CandidateSheet
        visible={sheetVisible}
        target={targetSlot}
        data={candidateData}
        loading={candidatesLoading}
        selected={selectedCandidate}
        onSelect={setSelectedCandidate}
        reason={reason}
        onReasonChange={setReason}
        saving={saving}
        onAssign={assign}
        onClose={closeCandidateSheet}
        isDark={isDark}
        c={c}
      />

      <ReportSheet
        visible={reportVisible}
        mode={reportMode}
        onModeChange={setReportMode}
        assignedSlots={assignedSlots}
        periods={board?.periods || []}
        downloading={reportDownloading}
        onDownloadPdf={downloadReport}
        onDownloadCsv={downloadCsv}
        onClose={() => !reportDownloading && setReportVisible(false)}
        c={c}
      />
    </View></TourTarget>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={staticStyles.stat}>
      <Text style={staticStyles.statValue}>{value}</Text>
      <Text style={staticStyles.statLabel}>{label}</Text>
    </View>
  );
}

function SegmentButton({
  active,
  icon,
  label,
  onPress,
  c,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  c: ReturnType<typeof colors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      aria-pressed={active}
      style={[staticStyles.segmentButton, active && { backgroundColor: c.primary }]}
    >
      <Ionicons name={icon} size={15} color={active ? '#FFFFFF' : c.muted} />
      <Text style={[staticStyles.segmentLabel, { color: active ? '#FFFFFF' : c.text }]}>{label}</Text>
    </Pressable>
  );
}

function FilterChip({
  label,
  sublabel,
  active,
  onPress,
  c,
}: {
  label: string;
  sublabel?: string | null;
  active: boolean;
  onPress: () => void;
  c: ReturnType<typeof colors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      aria-pressed={active}
      style={[
        staticStyles.filterChip,
        { backgroundColor: active ? c.primarySoft : c.card, borderColor: active ? c.primary : c.border },
      ]}
    >
      {active ? <Ionicons name="checkmark-circle" size={14} color={c.primary} /> : null}
      <Text style={[staticStyles.filterChipText, { color: active ? c.controlText : c.text }]} numberOfLines={1}>
        {label}
      </Text>
      {sublabel ? (
        <View style={[staticStyles.chipSublabel, { backgroundColor: active ? c.primary : c.cardAlt }]}>
          <Text style={[staticStyles.chipSublabelText, { color: active ? '#FFFFFF' : c.muted }]} numberOfLines={1}>
            {sublabel}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const REPORT_OPTIONS: {
  value: SubstitutionReportMode;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    value: 'complete',
    title: 'Complete list',
    description: 'Every assigned duty in chronological order',
    icon: 'list-outline',
  },
  {
    value: 'teacher',
    title: 'Teacher wise',
    description: 'Group duties under each substitute teacher',
    icon: 'people-outline',
  },
  {
    value: 'period',
    title: 'Period wise',
    description: 'Group duties by bell period and time',
    icon: 'time-outline',
  },
  {
    value: 'class',
    title: 'Class wise',
    description: 'Group duties by class and section',
    icon: 'school-outline',
  },
];

function ReportSheet({
  visible,
  mode,
  onModeChange,
  assignedSlots,
  periods,
  downloading,
  onDownloadPdf,
  onDownloadCsv,
  onClose,
  c,
}: {
  visible: boolean;
  mode: SubstitutionReportMode;
  onModeChange: (mode: SubstitutionReportMode) => void;
  assignedSlots: SubstitutionSlot[];
  periods: SubstitutionBoard['periods'];
  downloading: boolean;
  onDownloadPdf: () => void;
  onDownloadCsv: () => void;
  onClose: () => void;
  c: ReturnType<typeof colors>;
}) {
  const [format, setFormat] = useState<'pdf' | 'csv'>('pdf');
  if (!visible) return null;
  const styles = makeStyles(c);
  const teacherCount = new Set(
    assignedSlots.map((slot) => slot.substitute_teacher_id || slot.substitute_teacher_name)
  ).size;
  const assignedPeriodCount = new Set(assignedSlots.map((slot) => slot.period_number)).size;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />
      <Animated.View
        entering={SlideInDown.springify().damping(24).stiffness(260)}
        exiting={SlideOutDown.duration(180)}
        style={[styles.sheet, styles.reportSheet]}
      >
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <View style={styles.reportSheetHeading}>
            <View style={styles.reportSheetIcon}>
              <Ionicons name={format === 'pdf' ? "document-text-outline" : "grid-outline"} size={22} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetEyebrow}>SUBSTITUTION REPORT EXPORT</Text>
              <Text style={styles.sheetTitle}>Download duty register</Text>
              <Text style={styles.sheetSubtitle}>Choose export format and layout for confirmed duties.</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} disabled={downloading} style={styles.sheetClose}>
            <Ionicons name="close" size={19} color={c.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.reportSheetBody} showsVerticalScrollIndicator={false}>
          <View style={styles.formatSegment}>
            <Pressable
              onPress={() => setFormat('pdf')}
              style={[styles.formatBtn, format === 'pdf' && styles.formatBtnActive]}
            >
              <Ionicons name="document-text-outline" size={16} color={format === 'pdf' ? '#FFFFFF' : c.muted} />
              <Text style={[styles.formatBtnText, format === 'pdf' && styles.formatBtnTextActive]}>Branded PDF</Text>
            </Pressable>
            <Pressable
              onPress={() => setFormat('csv')}
              style={[styles.formatBtn, format === 'csv' && styles.formatBtnActive]}
            >
              <Ionicons name="grid-outline" size={16} color={format === 'csv' ? '#FFFFFF' : c.muted} />
              <Text style={[styles.formatBtnText, format === 'csv' && styles.formatBtnTextActive]}>CSV Spreadsheet</Text>
            </Pressable>
          </View>

          <View style={styles.reportSummary}>
            <ReportMetric value={assignedSlots.length} label="Assignments" c={c} />
            <ReportMetric value={teacherCount} label="Substitutes" c={c} />
            <ReportMetric value={assignedPeriodCount} label={`of ${periods.length} periods`} c={c} />
          </View>

          {format === 'pdf' ? (
            <>
              <View style={styles.reportOptions}>
                {REPORT_OPTIONS.map((option) => {
                  const active = mode === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => onModeChange(option.value)}
                      style={[
                        styles.reportOption,
                        active && { borderColor: c.action, backgroundColor: c.primarySoft },
                      ]}
                    >
                      <View style={[styles.reportOptionIcon, active && { backgroundColor: c.primary }]}>
                        <Ionicons name={option.icon} size={18} color={active ? '#FFFFFF' : c.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reportOptionTitle}>{option.title}</Text>
                        <Text style={styles.reportOptionText}>{option.description}</Text>
                      </View>
                      <Ionicons
                        name={active ? 'radio-button-on' : 'radio-button-off'}
                        size={21}
                        color={active ? c.action : c.muted}
                      />
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.reportBrandNote}>
                <Ionicons name="shield-checkmark-outline" size={15} color={c.success} />
                <Text style={styles.reportBrandNoteText}>
                  Teaching periods are continuously numbered (breaks do not increment). School logo and branding are included automatically.
                </Text>
              </View>

              <TouchableOpacity
                onPress={onDownloadPdf}
                disabled={downloading || assignedSlots.length === 0}
                activeOpacity={0.85}
                style={{ opacity: downloading || assignedSlots.length === 0 ? 0.55 : 1 }}
              >
                <LinearGradient colors={['#312E81', '#4F46E5']} style={styles.confirmButton}>
                  {downloading ? (
                    <View style={styles.savingLabel}><LogoLoader size={22} color="#FFFFFF" /><Text style={styles.confirmText}>Assigning…</Text></View>
                  ) : (
                    <>
                      <Ionicons name="download-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.confirmText}>Create premium PDF</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.csvExplainer}>
                <View style={styles.csvExplainerIcon}>
                  <Ionicons name="document-attach-outline" size={24} color={c.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.csvExplainerTitle}>Spreadsheet export (CSV)</Text>
                  <Text style={styles.csvExplainerText}>
                    Exports confirmed assignments in chronological timetable order with continuous teaching period numbers (Period 1, Period 2, etc.). Breaks and non-teaching slots are excluded from period numbers.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={onDownloadCsv}
                disabled={downloading || assignedSlots.length === 0}
                activeOpacity={0.85}
                style={{ opacity: downloading || assignedSlots.length === 0 ? 0.55 : 1 }}
              >
                <LinearGradient colors={['#059669', '#10B981']} style={styles.confirmButton}>
                  {downloading ? (
                    <View style={styles.savingLabel}><LogoLoader size={22} color="#FFFFFF" /><Text style={styles.confirmText}>Assigning…</Text></View>
                  ) : (
                    <>
                      <Ionicons name="download-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.confirmText}>Export CSV spreadsheet</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

function ReportMetric({ value, label, c }: { value: number; label: string; c: ReturnType<typeof colors> }) {
  return (
    <View style={[staticStyles.reportMetric, { borderColor: c.border, backgroundColor: c.cardAlt }]}>
      <Text style={[staticStyles.reportMetricValue, { color: c.text }]}>{value}</Text>
      <Text style={[staticStyles.reportMetricLabel, { color: c.muted }]}>{label}</Text>
    </View>
  );
}

function SubstitutionCard({
  slot,
  periodDisplayLabel,
  basis,
  c,
  styles,
  onAssign,
  onCancel,
  busy = false,
}: {
  slot: SubstitutionSlot;
  periodDisplayLabel?: string;
  basis: string;
  c: ReturnType<typeof colors>;
  styles: ReturnType<typeof makeStyles>;
  onAssign: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const suggested = Boolean(slot.is_auto_suggested);
  const covered = isConfirmedCover(slot);
  const isUncovered = !covered;

  return (
    <View
      style={[
        styles.slotCard,
        { flexBasis: basis as any },
        isUncovered && styles.slotCardUncovered,
      ]}
    >
      <View
        style={[
          styles.slotAccent,
          { backgroundColor: covered ? c.success : c.warning },
        ]}
      />
      <View style={styles.slotTop}>
        <View style={styles.slotTopLeft}>
          <View style={[styles.classBadge, { backgroundColor: covered ? c.successSoft : c.primarySoft }]}>
            <Ionicons name="school" size={12} color={covered ? c.success : c.primary} />
            <Text style={[styles.classBadgeText, { color: covered ? c.success : c.primary }]}>
              {classLabel(slot)}
            </Text>
          </View>
          {periodDisplayLabel ? (
            <View style={styles.periodPill}>
              <Text style={styles.periodPillText}>{periodDisplayLabel}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.slotTopRight}>
          <Text style={styles.slotTime}>{timeLabel(slot.start_time)}</Text>
          {isUncovered ? (
            <View style={styles.uncoveredBadge}>
              <Ionicons name="time-outline" size={13} color={c.warningText} />
              <Text style={styles.uncoveredBadgeText}>Awaiting assignment</Text>
            </View>
          ) : null}
        </View>
      </View>

      <Text style={styles.subjectName}>{slot.subject_name}</Text>
      <View style={styles.teacherRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(slot.regular_teacher_name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.metaLabel}>{regularTeacherMetaLabel(slot)}</Text>
          <Text style={styles.teacherName} numberOfLines={1}>
            {slot.regular_teacher_name || 'Teacher not assigned'}
          </Text>
          {slot.unavailability_label ? (
            <View style={styles.unavailabilitySourcePill}>
              <Ionicons name="information-circle-outline" size={11} color={c.warningText} />
              <Text style={styles.unavailabilitySourceText}>{slot.unavailability_label}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {covered ? (
        <View style={styles.coverPanel}>
          <View style={styles.coverCheck}>
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.coverLabel}>COVER CONFIRMED</Text>
            <Text style={styles.coverName}>{slot.substitute_teacher_name}</Text>
            {slot.reason ? <Text style={styles.coverReason} numberOfLines={1}>{slot.reason}</Text> : null}
          </View>
          <View style={styles.coverActions}>
            <TouchableOpacity onPress={onAssign} disabled={busy} style={styles.changeButton} accessibilityRole="button" accessibilityLabel="Change substitute">
              <Ionicons name="create-outline" size={16} color={c.primary} />
              <Text style={styles.changeButtonText}>Change</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onCancel} disabled={busy} style={styles.cancelButton} accessibilityRole="button" accessibilityLabel="Cancel substitution">
              <Ionicons name="close" size={18} color={c.danger} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.assignmentPanel}>
          {suggested ? (
            <View style={styles.suggestionInfo}>
              <View style={styles.suggestionIcon}>
                <Ionicons name="flash" size={18} color={c.warningText} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.suggestionTitle}>Auto-suggested · review required</Text>
                {slot.substitute_teacher_name ? (
                  <Text style={styles.suggestionName}>{slot.substitute_teacher_name}</Text>
                ) : null}
                <Text style={styles.suggestionHint}>Review available teachers and confirm cover for this period.</Text>
              </View>
            </View>
          ) : null}
          <Pressable
            onPress={onAssign}
            disabled={busy}
            accessibilityState={{ disabled: busy }}
            accessibilityRole="button"
            accessibilityLabel={suggested ? 'Review and assign substitute' : 'Find and assign substitute'}
            accessibilityHint="Opens available teachers so you can review and confirm an assignment."
            style={({ pressed }) => [styles.assignButton, pressed && styles.assignButtonPressed, busy && styles.actionDisabled]}
          >
            <Ionicons name="person-add-outline" size={20} color="#FFFFFF" />
            <Text style={styles.assignButtonText}>
              {suggested ? 'Review & assign substitute' : 'Find & assign substitute'}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      )}
    </View>
  );
}


function CandidateSheet({
  visible,
  target,
  data,
  loading,
  selected,
  onSelect,
  reason,
  onReasonChange,
  saving,
  onAssign,
  onClose,
  isDark,
  c,
}: {
  visible: boolean;
  target: SubstitutionSlot | null;
  data: CandidateResponse | null;
  loading: boolean;
  selected: SubstituteCandidate | null;
  onSelect: (candidate: SubstituteCandidate) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  saving: boolean;
  onAssign: () => void;
  onClose: () => void;
  isDark: boolean;
  c: ReturnType<typeof colors>;
}) {
  if (!visible || !target) return null;
  const styles = makeStyles(c);

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel="Close candidate sheet" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetContainer}
      >
        <Animated.View
          entering={SlideInDown.springify().damping(24).stiffness(260)}
          exiting={SlideOutDown.duration(180)}
          style={styles.sheet}
        >
          {/* Header */}
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.sheetEyebrow}>CHOOSE A SUBSTITUTE</Text>
              <Text style={styles.sheetTitle} numberOfLines={1}>{classLabel(target)} · {target.subject_name}</Text>
              <Text style={styles.sheetSubtitle} numberOfLines={1}>
                {timeLabel(target.start_time)}–{timeLabel(target.end_time)} · replacing {target.regular_teacher_name}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} disabled={saving} style={styles.sheetClose} accessibilityLabel="Close">
              <Ionicons name="close" size={19} color={c.text} />
            </TouchableOpacity>
          </View>

          {/* Middle Body */}
          <ScrollView
            style={styles.sheetBody}
            contentContainerStyle={styles.sheetBodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.candidateLoading}>
                <LogoLoader size={46} color={c.primary} />
                <Text style={styles.loadingText}>Checking every teacher’s timetable…</Text>
              </View>
            ) : (data?.candidates.length || 0) === 0 ? (
              <View style={styles.noCandidate}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="people-outline" size={28} color={c.primary} />
                </View>
                <Text style={styles.emptyTitle}>No teacher is free</Text>
                <Text style={styles.emptyText}>
                  Everyone eligible is teaching, on leave, marked absent, or already covering another class in this period.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.rankExplainer}>
                  <Ionicons name="analytics-outline" size={16} color={c.primary} />
                  <Text style={styles.rankExplainerText}>
                    Only available teachers are shown. The best match is selected for you; choose another teacher if needed.
                  </Text>
                </View>

                <View style={styles.candidateList}>
                  {data?.candidates.map((candidate, index) => {
                    const active = selected?.id === candidate.id;
                    const accent = scoreColor(candidate.score, isDark);
                    return (
                      <Pressable
                        key={candidate.id}
                        onPress={() => onSelect(candidate)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active }}
                        aria-checked={active}
                        accessibilityLabel={`Select ${candidate.teacher_name}, ${candidate.recommendation}, ${candidate.reasons.join(', ')}`}
                        style={[
                          styles.candidateCard,
                          active && { borderColor: c.action, backgroundColor: c.primarySoft },
                        ]}
                      >
                        <View style={[styles.rankBadge, index === 0 && { backgroundColor: '#FEF3C7' }]}>
                          <Text style={[styles.rankText, index === 0 && { color: '#B45309' }]}>#{index + 1}</Text>
                        </View>
                        <View style={[styles.candidateAvatar, { backgroundColor: `${accent}20` }]}>
                          <Text style={[styles.candidateAvatarText, { color: accent }]}>
                            {initials(candidate.teacher_name)}
                          </Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={styles.candidateNameRow}>
                            <Text style={styles.candidateName}>{candidate.teacher_name}</Text>
                            <Text style={[styles.recommendation, { color: accent }]}>{candidate.recommendation}</Text>
                          </View>
                          <View style={styles.reasonChips}>
                            {candidate.reasons.map((item) => (
                              <View key={item} style={styles.reasonChip}>
                                <Text style={styles.reasonChipText}>{item}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                        <Ionicons
                          name={active ? 'radio-button-on' : 'radio-button-off'}
                          size={21}
                          color={active ? c.action : c.muted}
                        />
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.reasonField}>
                  <Text style={styles.controlLabel}>NOTE / REASON (OPTIONAL)</Text>
                  <AppTextInput
                    value={reason}
                    onChangeText={onReasonChange}
                    placeholder="e.g. Called into a parent meeting"
                    placeholderTextColor={c.muted}
                    maxLength={500}
                    style={styles.reasonInput}
                    accessibilityLabel="Optional note or reason"
                  />
                </View>
              </>
            )}
          </ScrollView>

          {/* Pinned Bottom Footer (Always visible) */}
          {Boolean(data?.candidates?.length) && !loading ? (
            <View style={styles.sheetFooter}>
              {selected ? (
                <View style={styles.selectionSummary}>
                  <Text style={styles.selectionLabel}>SELECTED SUBSTITUTE</Text>
                  <Text style={styles.selectionName}>{selected.teacher_name}</Text>
                  <Text style={styles.selectionDetail}>{classLabel(target)} · {timeLabel(target.start_time)}–{timeLabel(target.end_time)}</Text>
                </View>
              ) : null}
              <TouchableOpacity
                onPress={onAssign}
                disabled={!selected || saving}
                activeOpacity={0.85}
                style={{ opacity: !selected || saving ? 0.55 : 1 }}
                accessibilityRole="button"
                accessibilityLabel={selected ? `Confirm assignment of ${selected.teacher_name} to ${classLabel(target)}` : 'Select a teacher to assign'}
                accessibilityState={{ disabled: !selected || saving, busy: saving }}
              >
                <LinearGradient colors={[c.action, c.actionPressed]} style={styles.confirmButton}>
                  {saving ? (
                    <View style={styles.savingLabel}><LogoLoader size={22} color="#FFFFFF" /><Text style={styles.confirmText}>Assigning…</Text></View>
                  ) : (
                    <>
                      <Ionicons name="shield-checkmark-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.confirmText}>
                        {selected ? 'Confirm assignment' : 'Select a teacher above'}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
              <Text style={styles.expiryNote}>
                <Ionicons name="information-circle-outline" size={12} /> Attendance access applies only to this class and date.
              </Text>
            </View>
          ) : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function colors(isDark: boolean) {
  return {
    page: isDark ? '#080C16' : '#F3F5FA',
    card: isDark ? '#111827' : '#FFFFFF',
    cardAlt: isDark ? '#172033' : '#F8FAFC',
    text: isDark ? '#F8FAFC' : '#0F172A',
    subtext: isDark ? '#A8B2C5' : '#475569',
    muted: isDark ? '#6B7890' : '#94A3B8',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.09)',
    primary: '#5B5CE2',
    primarySoft: isDark ? 'rgba(91,92,226,0.16)' : '#EEF2FF',
    controlText: isDark ? '#A5B4FC' : '#4338CA',
    action: '#1D4ED8',
    actionPressed: '#1E40AF',
    success: '#10B981',
    successText: isDark ? '#6EE7B7' : '#047857',
    successSoft: isDark ? 'rgba(16,185,129,0.15)' : '#ECFDF5',
    warning: '#F59E0B',
    warningSoft: isDark ? 'rgba(245,158,11,0.16)' : '#FEF3C7',
    warningText: isDark ? '#FBBF24' : '#B45309',
    infoSoft: isDark ? 'rgba(59,130,246,0.14)' : '#EFF6FF',
    infoText: isDark ? '#93C5FD' : '#1D4ED8',
    danger: '#EF4444',
    shadow: isDark ? '#000000' : '#64748B',
  };
}

function makeStyles(c: ReturnType<typeof colors>) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.page },
    content: { padding: 20, paddingBottom: 80, width: '100%', maxWidth: 1280, alignSelf: 'center' },
    hero: { borderRadius: 24, padding: 20, overflow: 'hidden', marginBottom: 16 },
    heroGlowOne: { position: 'absolute', width: 230, height: 230, borderRadius: 115, backgroundColor: 'rgba(129,140,248,0.24)', right: -70, top: -90 },
    heroGlowTwo: { position: 'absolute', width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(14,165,233,0.15)', left: '38%', bottom: -120 },
    heroTop: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, justifyContent: 'space-between' },
    heroCopy: { flex: 1, minWidth: 260, maxWidth: 710 },
    eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
    eyebrowText: { color: '#C7D2FE', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
    heroTitle: { color: '#FFFFFF', fontSize: Platform.OS === 'web' ? 27 : 24, fontWeight: '900', letterSpacing: -0.9 },
    heroSubtitle: { color: '#DDE4FF', fontSize: 14, lineHeight: 21, marginTop: 8, maxWidth: 650 },
    heroActionGroup: { gap: 8, alignSelf: 'flex-start', maxWidth: '100%' },
    heroAction: { minHeight: 52, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 14, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    heroActionPressed: { backgroundColor: '#DBEAFE' },
    heroActionText: { color: c.action, fontSize: 14, fontWeight: '800', flexShrink: 1 },
    heroActionHint: { color: '#E0E7FF', fontSize: 12, lineHeight: 18 },
    resetBadge: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, alignSelf: 'flex-start' },
    resetTitle: { color: '#D1FAE5', fontSize: 12, fontWeight: '900' },
    resetText: { color: '#E0E7FF', fontSize: 10, marginTop: 2 },
    heroStats: { flexDirection: 'row', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.13)' },
    statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.14)', marginHorizontal: 18 },
    controlCard: { backgroundColor: c.card, borderRadius: 24, borderWidth: 1, borderColor: c.border, padding: 18, marginBottom: 20, shadowColor: c.shadow, shadowOpacity: Platform.OS === 'web' ? 0.08 : 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
    controlTop: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    dateCell: { flex: 1.2, minWidth: 220 },
    viewCell: { flex: 1, minWidth: 220 },
    controlLabel: { color: c.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginBottom: 8 },
    datePicker: { backgroundColor: c.cardAlt, borderRadius: 14, minHeight: 48 },
    segment: { flexDirection: 'row', padding: 4, backgroundColor: c.cardAlt, borderRadius: 14, minHeight: 48 },
    searchWrap: { height: 48, marginTop: 16, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, backgroundColor: c.cardAlt, borderWidth: 1, borderColor: c.border },
    searchInput: { flex: 1, color: c.text, fontSize: 14, borderWidth: 0, paddingHorizontal: 0, backgroundColor: 'transparent', height: 46 },
    clearSearch: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: c.card },
    teacherChips: { gap: 8, paddingRight: 10 },
    controlActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: c.border },
    secondaryControlButton: { flex: 1, minWidth: 180, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.cardAlt, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
    secondaryControlText: { color: c.controlText, fontSize: 12, fontWeight: '800', flexShrink: 1 },
    downloadHint: { color: c.subtext, fontSize: 11, lineHeight: 16, marginTop: 10 },
    manualButton: { marginTop: 16, minHeight: 46, borderRadius: 14, backgroundColor: c.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
    manualButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
    planningTopBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      backgroundColor: c.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      marginBottom: 16,
      flexWrap: 'wrap',
    },
    planningBackTopBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: c.primarySoft,
      borderWidth: 1,
      borderColor: c.border,
    },
    planningBackTopText: {
      color: c.primary,
      fontSize: 13,
      fontWeight: '800',
    },
    planningDateWrap: {
      flex: 1,
      minWidth: 200,
      maxWidth: 320,
    },
    planningDateLabel: {
      color: c.muted,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.1,
      marginBottom: 4,
    },
    attendanceBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: c.infoSoft, borderWidth: 1, borderColor: 'rgba(59,130,246,0.25)', marginBottom: 16 },
    attendanceBannerTitle: { color: c.infoText, fontSize: 13, fontWeight: '800' },
    attendanceBannerText: { color: c.subtext, fontSize: 11, marginTop: 2, lineHeight: 16 },
    advisoryBanner: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: c.warningSoft, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)', marginBottom: 16 },
    advisoryBannerTitle: { color: c.warningText, fontSize: 13, fontWeight: '900' },
    advisoryBannerText: { color: c.subtext, fontSize: 11, marginTop: 2, lineHeight: 16 },
    boardToolbar: { gap: 10, marginBottom: 16 },
    statusFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    statusFilter: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, flexDirection: 'row', alignItems: 'center', gap: 8 },
    statusFilterActive: { borderColor: c.action, backgroundColor: c.action },
    statusFilterText: { color: c.subtext, fontSize: 13, fontWeight: '700' },
    statusFilterCount: { color: c.subtext, fontSize: 13, fontWeight: '900' },
    statusFilterTextActive: { color: '#FFFFFF' },
    resultsLabel: { color: c.subtext, fontSize: 12 },
    nextClassButton: { minHeight: 48, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: c.action, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    nextClassButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
    actionDisabled: { opacity: 0.55 },
    coverNotice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, backgroundColor: c.successSoft, borderWidth: 1, borderColor: c.successText, marginBottom: 16 },
    coverNoticeTitle: { color: c.successText, fontSize: 14, fontWeight: '800' },
    coverNoticeText: { color: c.subtext, fontSize: 12, lineHeight: 18, marginTop: 3 },
    noticeDismiss: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    selectionSummary: { gap: 4 },
    selectionLabel: { color: c.subtext, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
    selectionName: { color: c.text, fontSize: 16, fontWeight: '800' },
    selectionDetail: { color: c.subtext, fontSize: 12 },
    savingLabel: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    successBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: c.successSoft, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', marginBottom: 16 },
    successBannerTitle: { color: c.success, fontSize: 13, fontWeight: '900' },
    successBannerText: { color: c.subtext, fontSize: 11, marginTop: 2, lineHeight: 16 },
    errorState: { minHeight: 280, alignItems: 'center', justifyContent: 'center', padding: 30, backgroundColor: c.card, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', gap: 10 },
    errorIcon: { width: 62, height: 62, borderRadius: 22, backgroundColor: 'rgba(239,68,68,0.12)', alignItems: 'center', justifyContent: 'center' },
    errorTitle: { color: c.danger, fontSize: 18, fontWeight: '900' },
    errorText: { color: c.subtext, fontSize: 13, textAlign: 'center', maxWidth: 460, lineHeight: 19 },
    retryButton: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: c.primary },
    retryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
    loadingState: { minHeight: 280, alignItems: 'center', justifyContent: 'center', gap: 14 },
    loadingText: { color: c.subtext, fontSize: 13, fontWeight: '600' },
    emptyState: { minHeight: 270, alignItems: 'center', justifyContent: 'center', padding: 30, backgroundColor: c.card, borderRadius: 24, borderWidth: 1, borderColor: c.border },
    emptyIcon: { width: 62, height: 62, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primarySoft, marginBottom: 14 },
    emptyTitle: { color: c.text, fontSize: 18, fontWeight: '900' },
    emptyText: { color: c.subtext, fontSize: 13, lineHeight: 20, textAlign: 'center', maxWidth: 460, marginTop: 6 },
    clearFilterButton: { marginTop: 14, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 11, backgroundColor: c.cardAlt, borderWidth: 1, borderColor: c.border },
    clearFilterButtonText: { color: c.primary, fontSize: 12, fontWeight: '800' },
    groups: { gap: 26 },
    group: { gap: 12 },
    groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    groupIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primarySoft },
    groupTitle: { color: c.text, fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
    groupSubtitle: { color: c.muted, fontSize: 11, marginTop: 2 },
    groupCount: { minWidth: 30, height: 30, borderRadius: 11, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    groupCountText: { color: c.primary, fontWeight: '900', fontSize: 12 },
    slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    slotCard: { minWidth: 0, flexGrow: 1, backgroundColor: c.card, borderRadius: 20, borderWidth: 1, borderColor: c.border, padding: 17, overflow: 'hidden', shadowColor: c.shadow, shadowOpacity: Platform.OS === 'web' ? 0.06 : 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
    slotCardUncovered: { borderColor: 'rgba(245,158,11,0.45)', backgroundColor: c.card },
    slotAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
    slotTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    slotTopLeft: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    slotTopRight: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    classBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6 },
    classBadgeText: { fontSize: 11, fontWeight: '900' },
    periodPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, backgroundColor: c.cardAlt },
    periodPillText: { color: c.subtext, fontSize: 10, fontWeight: '800' },
    slotTime: { color: c.muted, fontSize: 11, fontWeight: '800' },
    uncoveredBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7, backgroundColor: c.warningSoft },
    uncoveredBadgeText: { color: c.warningText, fontSize: 11, fontWeight: '800' },
    unavailabilitySourcePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.warningSoft, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, marginTop: 4, alignSelf: 'flex-start' },
    unavailabilitySourceText: { color: c.warningText, fontSize: 9, fontWeight: '800' },
    subjectName: { color: c.text, fontSize: 18, fontWeight: '900', marginTop: 14, marginBottom: 13, letterSpacing: -0.4 },
    teacherRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 14 },
    avatar: { width: 36, height: 36, borderRadius: 12, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: c.primary, fontSize: 11, fontWeight: '900' },
    metaLabel: { color: c.muted, fontSize: 8, fontWeight: '900', letterSpacing: 0.9 },
    teacherName: { color: c.subtext, fontSize: 13, fontWeight: '800', marginTop: 2 },
    assignmentPanel: { gap: 12, marginTop: 'auto' },
    suggestionInfo: { padding: 14, borderRadius: 13, backgroundColor: c.warningSoft, borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)', flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    suggestionIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' },
    suggestionTitle: { color: c.warningText, fontSize: 12, fontWeight: '800', lineHeight: 18 },
    suggestionName: { color: c.text, fontSize: 14, fontWeight: '800', marginTop: 4 },
    suggestionHint: { color: c.subtext, fontSize: 12, lineHeight: 18, marginTop: 4 },
    assignButton: { minHeight: 52, borderRadius: 12, backgroundColor: c.action, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
    assignButtonPressed: { backgroundColor: c.actionPressed },
    assignButtonText: { color: '#FFFFFF', fontSize: 14, lineHeight: 20, fontWeight: '800', flex: 1, textAlign: 'center' },
    coverPanel: { flexWrap: 'wrap', minHeight: 54, padding: 10, borderRadius: 13, backgroundColor: c.successSoft, flexDirection: 'row', alignItems: 'center', gap: 10 },
    coverCheck: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: c.success },
    coverLabel: { color: c.successText, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
    coverName: { color: c.text, fontSize: 12, fontWeight: '900', marginTop: 1 },
    coverReason: { color: c.subtext, fontSize: 9, marginTop: 2 },
    coverActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    changeButton: { minHeight: 44, paddingHorizontal: 12, borderRadius: 10, backgroundColor: c.card, flexDirection: 'row', alignItems: 'center', gap: 4 },
    changeButtonText: { color: c.primary, fontSize: 12, fontWeight: '900' },
    cancelButton: { width: 44, height: 44, borderRadius: 10, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' },
    reasonHint: { color: c.muted, fontSize: 10, marginTop: 6 },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,6,23,0.58)' },
    sheetContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'transparent' },
    sheet: { width: '100%', maxWidth: 820, height: '88%', maxHeight: '92%', alignSelf: 'center', backgroundColor: c.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: c.border, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
    sheetBody: { flex: 1 },
    sheetBodyContent: { padding: 18, gap: 12, paddingBottom: 24 },
    sheetFooter: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 34 : 18, backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.border, shadowColor: c.shadow, shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: -3 }, elevation: 6 },
    reportSheet: { maxWidth: 680, height: 'auto', maxHeight: '92%', padding: 22, paddingBottom: Platform.OS === 'ios' ? 34 : 24 },
    reportSheetBody: { flexShrink: 1 },
    sheetHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: c.border, alignSelf: 'center', marginTop: 12, marginBottom: 12 },
    sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: c.border },
    reportSheetHeading: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    reportSheetIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
    sheetEyebrow: { color: c.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
    sheetTitle: { color: c.text, fontSize: 20, fontWeight: '900', marginTop: 4, letterSpacing: -0.5 },
    sheetSubtitle: { color: c.subtext, fontSize: 11, marginTop: 5 },
    sheetClose: { width: 44, height: 44, borderRadius: 13, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center' },
    formatSegment: { flexDirection: 'row', backgroundColor: c.cardAlt, borderRadius: 13, padding: 4, gap: 6, marginBottom: 14 },
    formatBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 10, borderRadius: 10 },
    formatBtnActive: { backgroundColor: c.primary },
    formatBtnText: { color: c.muted, fontSize: 12, fontWeight: '800' },
    formatBtnTextActive: { color: '#FFFFFF' },
    candidateLoading: { minHeight: 280, alignItems: 'center', justifyContent: 'center', gap: 14 },
    noCandidate: { minHeight: 280, alignItems: 'center', justifyContent: 'center', padding: 24 },
    rankExplainer: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.primarySoft, padding: 11, borderRadius: 12, marginBottom: 12 },
    rankExplainerText: { color: c.subtext, fontSize: 12, lineHeight: 18, flex: 1, fontWeight: '600' },
    candidateList: { gap: 10 },
    candidateCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.cardAlt },
    rankBadge: { width: 27, height: 27, borderRadius: 9, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' },
    rankText: { color: c.muted, fontSize: 10, fontWeight: '900' },
    candidateAvatar: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    candidateAvatarText: { fontSize: 12, fontWeight: '900' },
    candidateNameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
    candidateName: { color: c.text, fontSize: 14, fontWeight: '900', flexShrink: 1 },
    recommendation: { fontSize: 9, fontWeight: '900' },
    reasonChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
    reasonChip: { backgroundColor: c.card, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: c.border },
    reasonChipText: { color: c.subtext, fontSize: 11, fontWeight: '700' },
    reasonField: { marginTop: 14 },
    reasonInput: { color: c.text, backgroundColor: c.cardAlt, borderRadius: 13, borderWidth: 1, borderColor: c.border, paddingHorizontal: 13, minHeight: 46 },
    confirmButton: { minHeight: 50, borderRadius: 15, marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
    confirmText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
    expiryNote: { color: c.subtext, fontSize: 11, textAlign: 'center', marginTop: 9 },
    reportSummary: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    reportOptions: { gap: 9 },
    reportOption: { minHeight: 66, padding: 11, borderRadius: 15, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.cardAlt, flexDirection: 'row', alignItems: 'center', gap: 11 },
    reportOptionIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
    reportOptionTitle: { color: c.text, fontSize: 12, fontWeight: '900' },
    reportOptionText: { color: c.subtext, fontSize: 9, lineHeight: 13, marginTop: 2 },
    reportBrandNote: { marginTop: 13, padding: 10, borderRadius: 12, backgroundColor: c.successSoft, flexDirection: 'row', alignItems: 'center', gap: 8 },
    reportBrandNoteText: { flex: 1, color: c.subtext, fontSize: 9, lineHeight: 13, fontWeight: '600' },
    csvExplainer: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, backgroundColor: c.cardAlt, borderWidth: 1, borderColor: c.border, marginTop: 8, marginBottom: 14 },
    csvExplainerIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
    csvExplainerTitle: { color: c.text, fontSize: 13, fontWeight: '900' },
    csvExplainerText: { color: c.subtext, fontSize: 10, lineHeight: 15, marginTop: 3 },
  });
}

const staticStyles = StyleSheet.create({
  stat: { flex: 1 },
  statValue: { color: '#FFFFFF', fontSize: 23, fontWeight: '900' },
  statLabel: { color: '#C7D2FE', fontSize: 10, marginTop: 3, fontWeight: '700' },
  segmentButton: { flex: 1, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 10, minHeight: 40 },
  segmentLabel: { fontSize: 11, fontWeight: '900' },
  filterChip: { minHeight: 44, maxWidth: 210, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterChipText: { fontSize: 11, fontWeight: '800', maxWidth: 120 },
  chipSublabel: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  chipSublabelText: { fontSize: 8, fontWeight: '800' },
  reportMetric: { flex: 1, minWidth: 0, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1 },
  reportMetricValue: { fontSize: 16, fontWeight: '900' },
  reportMetricLabel: { fontSize: 8, fontWeight: '800', marginTop: 2 },
});
