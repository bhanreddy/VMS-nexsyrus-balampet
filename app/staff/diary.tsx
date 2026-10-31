import { TourTarget, TourScrollView } from '@/src/features/app-tour';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
  Platform,
  Modal,
  Image,
  useWindowDimensions,
  RefreshControl,
  Keyboard,
  TouchableOpacity,
} from 'react-native';
import AppTextInput from '@/src/components/AppTextInput';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  FadeIn,
  FadeOut,
  SlideInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import {
  KeyboardAvoidingView,
  KeyboardAwareScrollView,
} from 'react-native-keyboard-controller';
import AppDatePicker from '@/src/components/AppDatePicker';
import * as Haptics from '@/src/utils/haptics';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import Toast from 'react-native-toast-message';
import StaffHeader from '../../src/components/StaffHeader';
import ViewAsBanner from '../../src/components/ViewAsBanner';
import { useEffectiveStaffId } from '../../src/hooks/useEffectiveStaffId';
import { useLocalSearchParams } from 'expo-router';
import { DiaryService, DiaryEntry, TeacherService, TeacherClassAssignment } from '../../src/services/commonServices';
import { AcademicPlannerService } from '../../src/services/academicPlannerService';
import { SmartDiaryService, type ClassDiaryEntry, type ClassTeacherSection, type DiaryTemplate, type SmartCurrentClass, type SmartRecentEntry } from '../../src/services/smartDiaryService';
import { enqueueDiary, flushDiaryQueue, startDiaryQueueListener, readPendingClassDiary, writePendingClassDiary } from '../../src/services/diaryOfflineQueue';
import { persistentQueryCache } from '../../src/services/persistentQueryCache';
import { useAuth } from '../../src/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../src/hooks/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radii, Spacing, Typography, Theme, Surfaces } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';
import { alertCompat } from '../../src/utils/crossPlatformAlert';
import {
  DiaryHistoryTabSwitcher,
  DiaryHistoryDatePickerSheet,
  DiaryHistoryDateSelectorButton,
  priorHistoryYmds,
  DIARY_PHOTO_HISTORY_PRIOR_DAYS,
  toYmd,
  type DiaryHistoryTabId,
} from '../../src/components/diary/DiaryHistoryChrome';
import { classLabel, formatClock, greetingForHour, parseTimeToMinutes } from '../../src/utils/smartDiary/currentClass';
import {
  composeDiaryContent,
  composeHomeworkLine,
  mergeTemplateCatalog,
  QUICK_TEMPLATE_IDS,
  renderTemplateContent,
  SYSTEM_TEMPLATES,
  uncertainFields,
  type DiaryExtraction,
} from '../../src/utils/smartDiary/compose';
import { isDiaryUuid, newDiaryId } from '../../src/utils/smartDiary/ids';
import { isPhotoFallbackContent, normalizeDiaryAttachments } from '../../src/utils/smartDiary/attachments';
import DiaryPhotoEditor from '../../src/components/diary/DiaryPhotoEditor';
import DiaryPhotoViewer from '../../src/components/diary/DiaryPhotoViewer';

function clay(isDark: boolean, raised: 'sm' | 'md' | 'lg' = 'md'): any {
  const spread = raised === 'lg' ? 20 : raised === 'sm' ? 10 : 14;
  const dy = raised === 'lg' ? 8 : raised === 'sm' ? 4 : 6;
  if (Platform.OS === 'web') {
    const drop = isDark ? 'rgba(0,0,0,0.45)' : 'rgba(148,163,184,0.28)';
    const light = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.95)';
    return { boxShadow: `0 ${dy}px ${spread}px ${drop}, 0 -1px 0 ${light}` };
  }
  return {
    shadowColor: isDark ? '#000000' : '#94A3B8',
    shadowOffset: { width: 0, height: dy },
    shadowOpacity: isDark ? 0.35 : 0.16,
    shadowRadius: spread,
    elevation: raised === 'lg' ? 5 : raised === 'sm' ? 2 : 3,
  };
}

function clayCard(isDark: boolean, raised: 'sm' | 'md' | 'lg' = 'md'): any {
  return {
    backgroundColor: isDark ? '#161E2E' : '#F7F8FC',
    borderRadius: raised === 'lg' ? Radii.xxl + 4 : raised === 'sm' ? Radii.xl : Radii.xxl,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1.5,
    borderBottomColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(76,90,120,0.10)',
    overflow: 'hidden' as const,
    ...clay(isDark, raised),
  };
}

type SubjectStyle = {
  color: string;
  soft: string;
  softDark: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  gradient: readonly [string, string];
};

function getSubjectStyle(subject: string = ''): SubjectStyle {
  const s = subject.toLowerCase();
  if (s.includes('math')) return { color: '#2563EB', soft: '#EFF6FF', softDark: 'rgba(37,99,235,0.16)', icon: 'calculate', gradient: ['#1D4ED8', '#3B82F6'] };
  if (s.includes('science') || s.includes('bio') || s.includes('phys') || s.includes('chem')) return { color: '#7C3AED', soft: '#F5F3FF', softDark: 'rgba(124,58,237,0.16)', icon: 'biotech', gradient: ['#6D28D9', '#8B5CF6'] };
  if (s.includes('english')) return { color: '#D97706', soft: '#FFFBEB', softDark: 'rgba(217,119,6,0.16)', icon: 'menu-book', gradient: ['#B45309', '#F59E0B'] };
  if (s.includes('telugu') || s.includes('hindi') || s.includes('sanskrit')) return { color: '#DC2626', soft: '#FEF2F2', softDark: 'rgba(220,38,38,0.16)', icon: 'translate', gradient: ['#B91C1C', '#F87171'] };
  if (s.includes('social') || s.includes('history') || s.includes('civics')) return { color: '#DB2777', soft: '#FDF2F8', softDark: 'rgba(219,39,119,0.16)', icon: 'public', gradient: ['#BE185D', '#F472B6'] };
  return { color: '#4F46E5', soft: '#EEF2FF', softDark: 'rgba(79,70,229,0.16)', icon: 'description', gradient: ['#4338CA', '#6366F1'] };
}

function diaryDisplayTitle(entry: DiaryEntry): string {
  return entry.title_te?.trim() || entry.title || '';
}
function diaryDisplayContent(entry: DiaryEntry): string {
  return entry.content_te?.trim() || entry.content || '';
}
const toDateKey = (d?: string | null): string => (d ? String(d).slice(0, 10) : '');
function normalizeDiaryEntry(e: DiaryEntry): DiaryEntry {
  return { ...e, entry_date: toDateKey(e.entry_date) };
}

function PressScale({ onPress, children, disabled, style, fill }: { onPress?: () => void; children: React.ReactNode; disabled?: boolean; style?: any; fill?: boolean }) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        { display: 'flex' } as any,
        fill ? { flex: 1, minWidth: 0, alignSelf: 'stretch' } : null,
        style,
        disabled && { opacity: 0.4 },
        Platform.OS === 'web' ? { cursor: disabled ? 'default' : 'pointer' } as any : null,
      ]}
      onPressIn={() => { if (!disabled) scale.value = withSpring(0.97, { damping: 18, stiffness: 360 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 16, stiffness: 240 }); }}
    >
      <Animated.View style={[aStyle, fill ? { width: '100%', flex: 1 } : null]}>{children}</Animated.View>
    </Pressable>
  );
}

function ClaySheen({ isDark, radius }: { isDark: boolean; radius?: number }) {
  return (
    <LinearGradient
      colors={isDark ? ['rgba(255,255,255,0.07)', 'rgba(255,255,255,0)'] : ['rgba(255,255,255,0.78)', 'rgba(255,255,255,0)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.55, y: 0.95 }}
      style={[StyleSheet.absoluteFill, radius ? { borderRadius: radius } : null]}
      pointerEvents="none"
    />
  );
}

function teacherFirstName(name?: string | null) {
  const clean = String(name || '').trim();
  if (!clean) return 'Teacher';
  const parts = clean.split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0];
}

function classScheduleLine(current: SmartCurrentClass | null): string {
  if (!current) return 'Pick the class this homework is for';
  const period = current.period_number ? `Period ${current.period_number}` : '';
  const start = formatClock(parseTimeToMinutes(current.start_time));
  const end = formatClock(parseTimeToMinutes(current.end_time));
  const window = start && end ? `${start} – ${end}` : start;
  const when =
    current.match === 'current' ? 'Now' :
    current.match === 'next' ? 'Up next' :
    current.match === 'previous' ? 'Earlier today' :
    '';
  const line = [when, period, window].filter(Boolean).join(' · ');
  return line || 'Homework goes to this class';
}

function relativeDayLabel(ymd: string) {
  const today = toYmd(new Date());
  const yesterday = toYmd(new Date(Date.now() - 86400000));
  if (ymd === today) return 'Today';
  if (ymd === yesterday) return 'Yesterday';
  return ymd;
}

const QUICK_TAGS = [
  { label: '📖 Ex:', text: 'Exercise: ' },
  { label: '📄 Pg:', text: 'Page: ' },
  { label: '✍️ Qs:', text: 'Questions: ' },
  { label: '📌 Ch:', text: 'Chapter: ' },
  { label: '📝 Revise', text: 'Revise: ' },
  { label: '🎯 Complete', text: 'Complete: ' },
  { label: '⏰ Tomorrow', text: 'Due tomorrow. ' },
];

const PHOTO_PAGE_LIMIT = 4;
const DUE_SHORTCUTS = [
  { label: 'Tomorrow', days: 1 },
  { label: 'In 2 Days', days: 2 },
  { label: 'Next Week', days: 7 },
];

export default function StaffDiary() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ academicPlanItemId?: string }>();
  const [linkedPlanItemId, setLinkedPlanItemId] = useState<string | null>(null);
  const { t } = useTranslation();
  const TE = t('staffDiary', { returnObjects: true }) as any;
  const { theme, isDark } = useTheme();
  const { isViewingAsAdmin, viewAsName, userId: viewedUserId } = useEffectiveStaffId();
  const { width: windowWidth } = useWindowDimensions();
  const isWide = windowWidth >= 900;
  const styles = useMemo(() => getStyles(theme, isDark, isWide), [theme, isDark, isWide]);
  const teacherId = (isViewingAsAdmin ? viewedUserId : user?.userId) || '';
  const openedAtRef = useRef(Date.now());

  const [assignments, setAssignments] = useState<TeacherClassAssignment[]>([]);
  const [current, setCurrent] = useState<SmartCurrentClass | null>(null);
  const [recent, setRecent] = useState<SmartRecentEntry[]>([]);
  const [templates, setTemplates] = useState<DiaryTemplate[]>([...SYSTEM_TEMPLATES] as unknown as DiaryTemplate[]);
  const [myTemplates, setMyTemplates] = useState<DiaryTemplate[]>([]);
  const [schoolTemplates, setSchoolTemplates] = useState<DiaryTemplate[]>([]);
  const [favourites, setFavourites] = useState<DiaryTemplate[]>([]);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [suggestionId, setSuggestionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const todayAnchor = useMemo(() => new Date(), []);
  const todayYmd = useMemo(() => toYmd(todayAnchor), [todayAnchor]);
  const priorDates = useMemo(() => priorHistoryYmds(todayAnchor, DIARY_PHOTO_HISTORY_PRIOR_DAYS), [todayAnchor]);
  const [activeTab, setActiveTab] = useState<DiaryHistoryTabId>('today');
  const [historyDate, setHistoryDate] = useState(() => todayYmd);
  const [pickerVisible, setPickerVisible] = useState(false);

  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photoMode, setPhotoMode] = useState<'idle' | 'review'>('idle');
  const [photoConfirmOpen, setPhotoConfirmOpen] = useState(false);
  const [photoSourceOpen, setPhotoSourceOpen] = useState(false);
  const [photoNote, setPhotoNote] = useState('');
  const [photoTitle, setPhotoTitle] = useState('');
  const [photoDue, setPhotoDue] = useState('');
  const [photoTargets, setPhotoTargets] = useState<string[]>([]);
  const [photoEditor, setPhotoEditor] = useState<{
    uris: string[]; index: number; edited: string[]; complete: (uris: string[]) => void;
  } | null>(null);
  const [photoViewer, setPhotoViewer] = useState<{ photos: string[]; index: number } | null>(null);
  const openPhotoViewer = (photos: string[], index = 0) => setPhotoViewer({ photos, index });
  const editPickedPages = (uris: string[], complete: (pages: string[]) => void) => {
    if (uris.length) setPhotoEditor({ uris, index: 0, edited: [], complete });
  };
  const saveEditedPage = (uri: string) => {
    if (!photoEditor) return;
    const edited = [...photoEditor.edited, uri];
    if (photoEditor.index + 1 < photoEditor.uris.length) {
      setPhotoEditor({ ...photoEditor, edited, index: photoEditor.index + 1 });
    } else {
      setPhotoEditor(null);
      photoEditor.complete(edited);
    }
  };
  const [busyLabel, setBusyLabel] = useState('Working…');
  const [extraction, setExtraction] = useState<DiaryExtraction | null>(null);
  const [previewContent, setPreviewContent] = useState('');
  const [ocrMessage, setOcrMessage] = useState<string | null>(null);

  const [voiceMode, setVoiceMode] = useState<'idle' | 'recording' | 'review'>('idle');
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [voiceText, setVoiceText] = useState('');

  // Primary "Type / Edit" Composer state
  const [manualOpen, setManualOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [manualTitle, setManualTitle] = useState('');
  const [manualContent, setManualContent] = useState('');
  const [manualDue, setManualDue] = useState(todayYmd);
  const [manualTargets, setManualTargets] = useState<string[]>([]);

  useEffect(() => {
    const planItemId = Array.isArray(params.academicPlanItemId) ? params.academicPlanItemId[0] : params.academicPlanItemId;
    if (!planItemId) return;
    setLinkedPlanItemId(planItemId);
    AcademicPlannerService.getDiaryTopic(planItemId)
      .then((details: any) => {
        if (details?.topic_title) {
          setManualTitle(`${details.chapter_title} — ${details.topic_title}`);
          setManualOpen(true);
        }
      })
      .catch(() => {});
  }, [params.academicPlanItemId]);

  const [classPickerOpen, setClassPickerOpen] = useState(false);
  const [sendToOpen, setSendToOpen] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [reuseSource, setReuseSource] = useState<SmartRecentEntry | DiaryEntry | null>(null);
  const [templatePrompt, setTemplatePrompt] = useState<DiaryTemplate | null>(null);
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});
  const [moreTemplates, setMoreTemplates] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [copyFromOpen, setCopyFromOpen] = useState(false);
  const [viewEntry, setViewEntry] = useState<SmartRecentEntry | DiaryEntry | null>(null);
  const [classTeacherSections, setClassTeacherSections] = useState<ClassTeacherSection[]>([]);
  const [classDiaryClass, setClassDiaryClass] = useState<ClassTeacherSection | null>(null);
  const [classDiaryPickerOpen, setClassDiaryPickerOpen] = useState(false);
  const [classDiarySourceOpen, setClassDiarySourceOpen] = useState(false);
  const [classDiaryReviewOpen, setClassDiaryReviewOpen] = useState(false);
  const [classDiaryFailedOpen, setClassDiaryFailedOpen] = useState(false);
  const [classDiaryEntries, setClassDiaryEntries] = useState<ClassDiaryEntry[]>([]);
  const [classDiaryImage, setClassDiaryImage] = useState<string | null>(null);
  const [classDiaryLocalUri, setClassDiaryLocalUri] = useState<string | null>(null);
  const [classDiarySubmissionId, setClassDiarySubmissionId] = useState<string | null>(null);
  const [classDiarySubjects, setClassDiarySubjects] = useState<{ id: string; name: string }[]>([]);
  const [classDiaryMessage, setClassDiaryMessage] = useState<string | null>(null);
  const [pendingClassReady, setPendingClassReady] = useState(false);
  const [editClassIndex, setEditClassIndex] = useState<number | null>(null);

  const datesWithData = useMemo(() => [...new Set(diaryEntries.map((e) => e.entry_date))], [diaryEntries]);
  const calendarAvailableYmds = useMemo(() => [...new Set([...datesWithData, ...priorDates])], [datesWithData, priorDates]);
  const ss = getSubjectStyle(current?.subject_name);
  const greeting = `${greetingForHour()}, ${teacherFirstName(user?.displayName)}`;
  const canWrite = !isViewingAsAdmin || user?.role?.code === 'admin' || user?.roles?.includes('admin') === true;
  const scheduleLine = classScheduleLine(current);

  // Today's entries & class completion stats
  const todayEntries = useMemo(() => diaryEntries.filter((e) => e.entry_date === todayYmd), [diaryEntries, todayYmd]);
  const postedClassIds = useMemo(() => {
    const ids = new Set<string>();
    todayEntries.forEach((e) => { if (e.class_section_id) ids.add(e.class_section_id); });
    return ids;
  }, [todayEntries]);
  const postedClassesCount = useMemo(() => assignments.filter((a) => postedClassIds.has(a.class_section_id)).length, [assignments, postedClassIds]);

  // Sibling sections for multi-class assignment (same subject)
  const siblingSections = useMemo(() => {
    if (!current) return [];
    return assignments.filter(
      (a) => a.class_section_id !== current.class_section_id &&
             (a.subject_id === current.subject_id || a.subject_name === current.subject_name)
    );
  }, [assignments, current]);

  const cacheContext = useCallback(async (data: { current: SmartCurrentClass | null; recent: SmartRecentEntry[] }) => {
    if (!teacherId) return;
    persistentQueryCache.write(teacherId, 'smart_diary_context', data, Date.now());
  }, [teacherId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!teacherId) return;
      const cached = await persistentQueryCache.read<{ current: SmartCurrentClass | null; recent: SmartRecentEntry[] }>(teacherId, 'smart_diary_context');
      if (cached?.data && alive) {
        setCurrent(cached.data.current);
        setRecent(cached.data.recent || []);
        setLoading(false);
      }
      const pending = await readPendingClassDiary(teacherId);
      if (alive && pending?.entries) setPendingClassReady(true);
    })();
    return () => { alive = false; };
  }, [teacherId]);

  useEffect(() => {
    if (!teacherId) return;
    return startDiaryQueueListener(teacherId);
  }, [teacherId]);

  const loadLive = useCallback(async (showIndicator = false) => {
    if (showIndicator) setRefreshing(true);
    try {
      const [context, assignmentData, history, templateData] = await Promise.all([
        SmartDiaryService.getContext().catch(() => null),
        TeacherService.getMyClasses().catch(() => []),
        DiaryService.getAll({ from_date: priorDates[priorDates.length - 1], to_date: todayYmd }).catch(() => []),
        SmartDiaryService.getTemplates().catch(() => null),
      ]);
      const unique = Array.isArray(assignmentData) ? assignmentData : [];
      setAssignments(unique);
      if (context?.current) setCurrent(context.current);
      else if (!current && unique[0]) {
        setCurrent({
          class_section_id: unique[0].class_section_id,
          class_name: unique[0].class_name,
          section_name: unique[0].section_name,
          subject_id: unique[0].subject_id,
          subject_name: unique[0].subject_name,
          display_class: classLabel(unique[0]),
          source: 'manual',
        });
      }
      if (context?.recent) setRecent(context.recent);
      if (context?.suggestion) {
        setSuggestion(context.suggestion.label);
        setSuggestionId(context.suggestion.diary_id);
      }
      if (context?.class_teacher_sections) {
        setClassTeacherSections(context.class_teacher_sections);
        if (!classDiaryClass && context.class_teacher_sections[0]) {
          setClassDiaryClass(context.class_teacher_sections[0]);
        }
      }
      setDiaryEntries(Array.isArray(history) ? history.map(normalizeDiaryEntry) : []);
      if (templateData) {
        setTemplates(mergeTemplateCatalog(SYSTEM_TEMPLATES as unknown as DiaryTemplate[], templateData));
        setMyTemplates(templateData.mine || []);
        setSchoolTemplates(templateData.school || []);
        setFavourites(templateData.favourites || []);
      }
      void cacheContext({ current: context?.current || current, recent: context?.recent || [] });
    } catch {
      // Cached UI remains interactive.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cacheContext, current, priorDates, todayYmd, classDiaryClass]);

  useEffect(() => { void loadLive(); }, []);

  const toast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    Toast.show({ type, text1: message, visibilityTime: 2600 });
  };

  const requireClass = () => {
    if (current?.class_section_id) return true;
    alertCompat('Choose a class', 'Pick the class this diary is for.');
    setClassPickerOpen(true);
    return false;
  };

  const publishNow = async (input: {
    content: string;
    title?: string;
    extraction?: DiaryExtraction | null;
    attachments?: string[];
    localUris?: string[];
    entrySource: string;
    templateId?: string;
    sourceDiaryId?: string;
    classSectionIds?: string[];
    typing?: boolean;
    extractAsync?: boolean;
    due?: string | null;
  }) => {
    if (!canWrite) {
      alertCompat('Notice', TE.noticeReadOnly);
      return;
    }
    if (!requireClass()) return;
    const classSectionIds = input.classSectionIds?.length ? input.classSectionIds : [current!.class_section_id];
    const submissionIds = classSectionIds.map(() => newDiaryId());
    const payload = {
      class_section_id: classSectionIds[0],
      class_section_ids: classSectionIds,
      subject_id: current?.subject_id,
      subject_name: current?.subject_name,
      class_name: current?.class_name,
      section_name: current?.section_name,
      entry_date: todayYmd,
      title: input.title || `${current?.subject_name || 'Diary'} Homework`,
      content: input.content,
      homework_due_date: input.due !== undefined ? (input.due || null) : (input.extraction?.dueDate || null),
      attachments: input.localUris?.length ? [] : (input.attachments || []),
      extraction: input.extraction || undefined,
      entry_source: input.entrySource,
      template_id: input.templateId,
      source_diary_id: input.sourceDiaryId,
      submission_id: submissionIds[0],
      submission_ids: submissionIds,
      typing_required: Boolean(input.typing),
      extract_async: Boolean(input.extractAsync),
      time_to_publish_ms: Date.now() - openedAtRef.current,
      input_language: 'auto',
      academic_plan_item_id: linkedPlanItemId || undefined,
    };
    setBusyLabel(input.localUris?.length ? 'Uploading diary…' : 'Posting homework…');
    setBusy(true);
    try {
      await enqueueDiary(teacherId, payload, input.localUris || []);
      const netResult = await flushDiaryQueue(teacherId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (netResult.flushed > 0) {
        toast(classSectionIds.length > 1
          ? `Diary posted to ${classSectionIds.length} classes. Parent alerts: 5:30 PM IST.`
          : 'Diary posted. Parent alerts: 5:30 PM IST.'
        );
      } else {
        toast('Saved. Will sync automatically.', 'info');
      }
      resetFlows();
      void loadLive();
    } catch {
      toast('Saved. Will sync automatically.', 'info');
      resetFlows();
    } finally {
      setBusy(false);
    }
  };

  const resetFlows = () => {
    setPhotoUris([]);
    setPhotoIndex(0);
    setPhotoMode('idle');
    setPhotoConfirmOpen(false);
    setPhotoSourceOpen(false);
    setPhotoEditor(null);
    setPhotoViewer(null);
    setPhotoNote('');
    setPhotoTitle('');
    setPhotoDue('');
    setPhotoTargets([]);
    setExtraction(null);
    setPreviewContent('');
    setOcrMessage(null);
    setVoiceMode('idle');
    setVoiceText('');
    setManualOpen(false);
    setEditingEntryId(null);
    setManualTargets([]);
    setSendToOpen(false);
    setReuseSource(null);
    setTemplatePrompt(null);
    setSaveTemplateOpen(false);
    setCopyFromOpen(false);
    setViewEntry(null);
  };

  const pickDiaryImages = async (fromLibrary = false, limit = PHOTO_PAGE_LIMIT): Promise<string[]> => {
    const pageLimit = Math.max(1, Math.min(PHOTO_PAGE_LIMIT, limit));
    const pickFromLibrary = async () => {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        alertCompat('Photos', 'Please allow photo library access to attach a diary page.');
        return [];
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.92,
        allowsMultipleSelection: pageLimit > 1,
        selectionLimit: pageLimit,
      });
      if (result.canceled || !result.assets?.length) return [];
      return result.assets.map((a) => a.uri).slice(0, pageLimit);
    };
    if (fromLibrary) return pickFromLibrary();
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        alertCompat('Camera', 'Please allow camera access to take a photo of the diary.');
        return [];
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.92 });
      if (result.canceled || !result.assets?.[0]) return [];
      return [result.assets[0].uri];
    } catch (error) {
      if (Platform.OS !== 'web') throw error;
      toast('Camera is not available in this browser. Choose a photo from your files.', 'info');
      return pickFromLibrary();
    }
  };

  const openPhotoUpload = (uris: string[]) => {
    const pages = uris.filter(Boolean).slice(0, PHOTO_PAGE_LIMIT);
    if (!pages.length) return;
    setPhotoUris(pages);
    setPhotoIndex(0);
    setPhotoNote('');
    setPhotoTitle('');
    setPhotoDue('');
    setPhotoTargets([]);
    setPhotoMode('idle');
    setExtraction(null);
    setPreviewContent('');
    setOcrMessage(null);
    setPhotoConfirmOpen(true);
  };

  const openPhotoSource = () => {
    if (!canWrite || busy || !requireClass()) return;
    setPhotoSourceOpen(true);
  };

  const choosePhotoSource = (fromLibrary: boolean) => {
    setPhotoSourceOpen(false);
    void capturePhoto(fromLibrary);
  };

  const capturePhoto = async (fromLibrary = false) => {
    if (!canWrite || !requireClass()) return;
    try {
      const uris = await pickDiaryImages(fromLibrary, PHOTO_PAGE_LIMIT);
      if (!uris.length) return;
      editPickedPages(uris, openPhotoUpload);
    } catch {
      toast('Could not open photos. You can still type homework.', 'error');
    }
  };

  const addPhotoPages = async (fromLibrary = false) => {
    const room = PHOTO_PAGE_LIMIT - photoUris.length;
    if (room <= 0) {
      toast(`You can attach up to ${PHOTO_PAGE_LIMIT} pages.`, 'info');
      return;
    }
    try {
      const uris = await pickDiaryImages(fromLibrary, room);
      if (!uris.length) return;
      editPickedPages(uris, (edited) => {
        const next = [...photoUris, ...edited].slice(0, PHOTO_PAGE_LIMIT);
        setPhotoUris(next);
        setPhotoIndex(Math.max(0, next.length - 1));
      });
    } catch {
      toast('Could not add that photo.', 'error');
    }
  };

  const replacePhotoPage = async (fromLibrary = false) => {
    if (!photoUris.length) return;
    try {
      const uris = await pickDiaryImages(fromLibrary, 1);
      const uri = uris[0];
      if (!uri) return;
      const index = Math.min(photoIndex, photoUris.length - 1);
      editPickedPages([uri], ([edited]) => {
        setPhotoUris((prev) => prev.map((item, itemIndex) => (itemIndex === index ? edited : item)));
        setExtraction(null); setOcrMessage(null);
      });
    } catch {
      toast('Could not replace that photo.', 'error');
    }
  };

  const removePhotoPage = (index: number) => {
    Haptics.selectionAsync();
    const next = photoUris.filter((_, itemIndex) => itemIndex !== index);
    setPhotoUris(next);
    if (!next.length) {
      setPhotoConfirmOpen(false);
      setPhotoNote('');
      setPhotoTitle('');
      setPhotoDue('');
      setPhotoTargets([]);
    }
    setPhotoIndex((current) => {
      if (current > index) return current - 1;
      if (current === index) return Math.max(0, index - 1);
      return current;
    });
  };

  const sendConfirmedPhoto = async () => {
    if (!photoUris.length || !current) return;
    const note = photoNote.trim();
    const content = note || 'Please view the attached diary photo.';
    const classSectionIds = [current.class_section_id, ...photoTargets.filter((id) => id !== current.class_section_id)];
    await publishNow({
      content,
      title: photoTitle.trim() || `${current.subject_name || 'Diary'} Homework`,
      due: photoDue || null,
      entrySource: 'PHOTO',
      attachments: photoUris,
      localUris: photoUris,
      classSectionIds: classSectionIds.length > 1 ? classSectionIds : undefined,
    });
  };

  const closePhotoConfirm = () => {
    if (busy) return;
    setPhotoConfirmOpen(false);
    if (photoMode === 'review') return;
    setPhotoUris([]);
    setPhotoIndex(0);
    setPhotoNote('');
    setPhotoTitle('');
    setPhotoDue('');
    setPhotoTargets([]);
  };

  const extractPhoto = async (uris = photoUris) => {
    if (!uris.length) return;
    setBusyLabel('Reading the photo…');
    setBusy(true);
    try {
      const result = await SmartDiaryService.extractPhotos(uris, {
        class_name: current?.class_name,
        section_name: current?.section_name,
        subject_name: current?.subject_name,
      });
      setExtraction(result.extraction);
      const text = result.preview?.content || composeDiaryContent(result.extraction);
      setPreviewContent(text);
      setPhotoTitle((currentTitle) => currentTitle || result.preview?.title || result.extraction?.title || '');
      if (result.extraction?.dueDate) setPhotoDue(result.extraction.dueDate);
      setOcrMessage(result.message || null);
      setPhotoConfirmOpen(false);
      setPhotoMode('review');
    } catch {
      toast("Couldn't read text cleanly. You can still send the photo or type.", 'info');
      setPhotoConfirmOpen(true);
    } finally {
      setBusy(false);
    }
  };

  const sendExtractedHomework = async (includePhoto = false) => {
    const content = previewContent || composeDiaryContent(extraction || {}, {});
    if (!String(content || '').trim()) {
      alertCompat('No homework text', 'Edit the extracted text, or send the original photo instead.');
      return;
    }
    const classSectionIds = current
      ? [current.class_section_id, ...photoTargets.filter((id) => id !== current.class_section_id)]
      : undefined;
    await publishNow({
      content,
      title: photoTitle.trim() || extraction?.title || `${current?.subject_name || 'Diary'} Homework`,
      due: photoDue || null,
      extraction,
      attachments: includePhoto ? photoUris : [],
      localUris: includePhoto ? photoUris : [],
      entrySource: includePhoto ? 'PHOTO' : 'MANUAL',
      extractAsync: false,
      classSectionIds: classSectionIds && classSectionIds.length > 1 ? classSectionIds : undefined,
    });
  };

  const startVoice = async () => {
    if (!canWrite || !requireClass()) return;
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        alertCompat('Microphone', 'Please allow microphone access to record diary voice notes.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      recordingRef.current = rec;
      setVoiceMode('recording');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      toast('Could not start microphone recording.', 'error');
      setVoiceMode('idle');
    }
  };

  const applyTemplate = async (template: DiaryTemplate) => {
    if (!canWrite || !requireClass()) return;
    const variables = template.variables || [];
    if (variables.length > 0) {
      const defaults: Record<string, string> = {};
      variables.forEach((item) => {
        defaults[item.key] = item.default || (item.key === 'subject' ? (current?.subject_name || '') : '');
      });
      setTemplateValues(defaults);
      setTemplatePrompt(template);
      return;
    }
    const content = renderTemplateContent(template.content, { subject: current?.subject_name || '' });
    await publishNow({ content, entrySource: 'TEMPLATE', templateId: isDiaryUuid(template.id) ? template.id : undefined });
  };

  const sendTemplatePrompt = async () => {
    if (!templatePrompt) return;
    const content = renderTemplateContent(templatePrompt.content, templateValues);
    await publishNow({
      content,
      entrySource: 'TEMPLATE',
      templateId: isDiaryUuid(templatePrompt.id) ? templatePrompt.id : undefined,
    });
  };

  const reuseEntry = async (entry: SmartRecentEntry | DiaryEntry, mode: 'reuse' | 'edit' | 'send') => {
    const content = 'content' in entry ? String(entry.content || '') : '';
    setReuseSource(entry);
    if (mode === 'edit') {
      if (!canWrite) return;
      setEditingEntryId(entry.id);
      setCurrent({
        class_section_id: entry.class_section_id,
        class_name: entry.class_name,
        section_name: entry.section_name,
        subject_id: entry.subject_id,
        subject_name: entry.subject_name,
        display_class: `${entry.class_name || ''}${entry.section_name || ''}`,
      });
      setManualTitle(diaryDisplayTitle(entry as DiaryEntry));
      setManualContent(diaryDisplayContent(entry as DiaryEntry));
      setManualDue(toDateKey(entry.homework_due_date) || todayYmd);
      setManualTargets([]);
      setManualOpen(true);
      return;
    }
    if (mode === 'send') {
      setSelectedTargets([]);
      setSendToOpen(true);
      return;
    }
    await publishNow({
      content,
      title: entry.title,
      entrySource: 'REUSED',
      sourceDiaryId: entry.id,
      attachments: 'attachments' in entry ? (entry.attachments as string[] | undefined) : undefined,
    });
  };

  const sendToClasses = async () => {
    if (!reuseSource || selectedTargets.length === 0) return;
    const content = 'content' in reuseSource ? String(reuseSource.content || '') : '';
    await publishNow({
      content,
      title: reuseSource.title,
      entrySource: 'COPIED',
      sourceDiaryId: reuseSource.id,
      classSectionIds: selectedTargets,
    });
  };

  const saveManual = async () => {
    if (!canWrite || busy) return;
    if (!manualContent.trim()) {
      alertCompat('Add homework text', 'Please write the homework before sending.');
      return;
    }
    if (editingEntryId) {
      setBusy(true);
      try {
        await DiaryService.update(editingEntryId, {
          title: manualTitle.trim(),
          content: manualContent.trim(),
          homework_due_date: manualDue,
          input_language: 'auto',
        });
        toast('Diary updated.');
        resetFlows();
        void loadLive();
      } catch (error: any) {
        alertCompat('Could not update diary', error?.message || 'Please try again.');
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!requireClass()) return;
    const targetClasses = [current!.class_section_id, ...manualTargets.filter((id) => id !== current!.class_section_id)];
    await publishNow({
      title: manualTitle.trim(),
      content: manualContent.trim(),
      due: manualDue,
      entrySource: reuseSource ? 'COPIED' : 'MANUAL',
      sourceDiaryId: reuseSource?.id,
      typing: !reuseSource,
      classSectionIds: targetClasses.length > 1 ? targetClasses : undefined,
    });
  };

  const appendQuickTag = (tagText: string) => {
    Haptics.selectionAsync();
    setManualContent((prev) => {
      const trimmed = prev.trimEnd();
      if (!trimmed) return tagText;
      return `${trimmed}\n${tagText}`;
    });
  };

  const setDueShortcut = (days: number) => {
    Haptics.selectionAsync();
    const d = new Date();
    d.setDate(d.getDate() + days);
    setManualDue(toYmd(d));
  };

  const saveCustomTemplate = async () => {
    if (!saveTemplateName.trim() || !manualContent.trim()) return;
    try {
      await SmartDiaryService.createTemplate({ name: saveTemplateName.trim(), content: manualContent.trim(), scope: 'TEACHER' });
      toast('Saved as a quick template.');
      setSaveTemplateOpen(false);
      void loadLive();
    } catch {
      toast('Could not save the template right now.', 'error');
    }
  };

  const handleDelete = (entry: DiaryEntry) => {
    alertCompat(TE.confirmDeleteTitle, TE.confirmDeleteMessage, [
      { text: TE.cancelEdit, style: 'cancel' },
      {
        text: TE.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await DiaryService.delete(entry.id);
            toast(TE.successDelete);
            void loadLive();
          } catch (error: any) {
            alertCompat('Error', error.message || TE.errDelete);
          }
        },
      },
    ]);
  };

  const beginClassDiaryUpload = () => {
    if (!canWrite) return;
    if (classTeacherSections.length === 1) {
      setClassDiaryClass(classTeacherSections[0]);
      setClassDiarySourceOpen(true);
      return;
    }
    setClassDiaryPickerOpen(true);
  };

  const startClassDiaryCapture = (section: ClassTeacherSection, fromLibrary = false) => {
    setClassDiaryPickerOpen(false);
    setClassDiarySourceOpen(false);
    void captureClassDiary(section, fromLibrary);
  };

  const captureClassDiary = async (section: ClassTeacherSection, fromLibrary = false) => {
    if (!canWrite) return;
    try {
      const perm = fromLibrary || Platform.OS === 'web'
        ? await ImagePicker.requestMediaLibraryPermissionsAsync()
        : await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        alertCompat('Photos', 'Please allow camera or gallery access to upload the class diary.');
        return;
      }
      const result = fromLibrary || Platform.OS === 'web'
        ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.92 })
        : await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.92 });
      if (result.canceled || !result.assets?.[0]) return;
      const uri = result.assets[0].uri;
      editPickedPages([uri], ([edited]) => void processClassDiaryCapture(section, edited));
    } catch {
      toast('Could not open the camera. You can still type the diary.', 'error');
    }
  };

  const processClassDiaryCapture = async (section: ClassTeacherSection, uri: string) => {
    const submissionId = newDiaryId();
    setClassDiaryClass(section);
    setClassDiaryLocalUri(uri);
    setClassDiaryImage(uri);
    setClassDiarySubmissionId(submissionId);
    setClassDiaryEntries([]);
    setBusyLabel('Reading the class diary…');
    setBusy(true);
    try {
      const extracted = await SmartDiaryService.extractClassDiary(uri, {
        class_section_id: section.class_section_id,
        entry_date: todayYmd,
        submission_id: submissionId,
      });
      setClassDiaryImage(extracted.image_url || uri);
      setClassDiaryEntries(extracted.entries || []);
      setClassDiarySubjects(extracted.subjects || []);
      setClassDiaryMessage(extracted.message || null);
      await writePendingClassDiary(teacherId, extracted);
      if ((extracted.entries || []).length) {
        setClassDiaryReviewOpen(true);
      } else {
        setClassDiaryFailedOpen(true);
      }
    } catch {
      await enqueueDiary(teacherId, {
        kind: 'class_diary',
        class_section_id: section.class_section_id,
        class_name: section.class_name,
        section_name: section.section_name,
        entry_date: todayYmd,
        submission_id: submissionId,
      }, [uri]);
      toast('Saved — waiting to sync.', 'info');
    } finally {
      setBusy(false);
    }
  };

  const openPendingClassDiary = async () => {
    const pending = await readPendingClassDiary(teacherId);
    if (!pending) return;
    setClassDiaryClass({
      class_section_id: pending.class_section_id,
      class_name: pending.class_name,
      section_name: pending.section_name,
    });
    setClassDiaryImage(pending.image_url || null);
    setClassDiaryEntries(pending.entries || []);
    setClassDiarySubjects(pending.subjects || []);
    setClassDiarySubmissionId(pending.submission_id || null);
    setClassDiaryMessage(pending.message || null);
    setPendingClassReady(false);
    if ((pending.entries || []).length) setClassDiaryReviewOpen(true);
    else setClassDiaryFailedOpen(true);
  };

  const publishClassDiaryNow = async (sendOriginal = false) => {
    if (!classDiaryClass || !classDiarySubmissionId) return;
    const selected = classDiaryEntries.filter((item) => item.selected !== false && !item.unknown);
    if (!sendOriginal && selected.length === 0) {
      alertCompat('Select subjects', 'Tick the subjects to publish, or send the original photo.');
      return;
    }
    setBusy(true);
    try {
      await SmartDiaryService.publishClassDiary({
        class_section_id: classDiaryClass.class_section_id,
        entry_date: todayYmd,
        submission_id: classDiarySubmissionId,
        image_url: classDiaryImage,
        entries: selected,
        send_original: sendOriginal,
      });
      await writePendingClassDiary(teacherId, null);
      setPendingClassReady(false);
      setClassDiaryReviewOpen(false);
      setClassDiaryFailedOpen(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast(sendOriginal ? 'Class diary photo posted. Parent alerts: 5:30 PM IST.' : 'Class diary published. Parent alerts: 5:30 PM IST.');
      void loadLive();
    } catch {
      await enqueueDiary(teacherId, {
        kind: 'class_diary',
        class_section_id: classDiaryClass.class_section_id,
        entry_date: todayYmd,
        submission_id: classDiarySubmissionId,
        image_url: classDiaryImage,
        entries: selected,
        send_original: sendOriginal,
      }, classDiaryLocalUri ? [classDiaryLocalUri] : []);
      toast('Saved — waiting to sync.', 'info');
      setClassDiaryReviewOpen(false);
      setClassDiaryFailedOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const confirmSendOriginalClassDiary = () => {
    alertCompat(
      'Send original photo?',
      'Parents will see this photo. We keep diary photos for 1 month, then delete them.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send photo', onPress: () => void publishClassDiaryNow(true) },
      ],
    );
  };

  const pageBg = isDark ? Surfaces.dark.base : '#E9EDF6';
  const activePhotoUri = photoUris[Math.min(photoIndex, Math.max(photoUris.length - 1, 0))] || '';
  const selectedClassDiaryCount = classDiaryEntries.filter((item) => item.selected !== false && !item.unknown).length;
  const uploadSheetOpen = manualOpen || photoConfirmOpen || photoMode === 'review' || voiceMode === 'review' || !!templatePrompt || classDiaryReviewOpen || classDiaryFailedOpen || saveTemplateOpen || editClassIndex != null;
  const quickTemplates = templates.filter((item) => QUICK_TEMPLATE_IDS.includes(item.id as any) || QUICK_TEMPLATE_IDS.some((id) => item.name === SYSTEM_TEMPLATES.find((sys) => sys.id === id)?.name)).slice(0, 7);

  if (loading && !current && assignments.length === 0) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: pageBg }]}>
        <LogoLoader size={60} color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: pageBg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <TourTarget id="screen.staff-diary.overview"><StaffHeader title="Smart Diary" showBackButton /></TourTarget>
      {isViewingAsAdmin && <ViewAsBanner name={viewAsName} />}

      <TourScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadLive(true)}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        <Animated.View entering={FadeInDown.delay(40).duration(280)} style={styles.tabWrap}>
          <TourTarget id="screen.staff-diary.workspace"><DiaryHistoryTabSwitcher
            active={activeTab}
            onChange={(tab) => { setActiveTab(tab); Haptics.selectionAsync(); }}
            todayLabel={TE.today}
            historyLabel={TE.history}
          /></TourTarget>
        </Animated.View>

        {activeTab === 'today' ? (
          <>
            <Animated.View entering={FadeInDown.delay(70).duration(280)} style={styles.greetingHeader}>
              <Text style={[styles.greeting, { color: theme.colors.textStrong }]}>{greeting}</Text>
              <Text style={[styles.greetingHint, { color: theme.colors.textTertiary }]}>
                Write the homework, or photograph the board.
              </Text>
              {assignments.length > 0 && (
                <View style={styles.progressBlock}>
                  <View style={styles.progressMeta}>
                    <Text style={[styles.progressLabel, { color: postedClassesCount === assignments.length ? '#059669' : theme.colors.textSecondary }]}>
                      {postedClassesCount === assignments.length ? 'All classes posted' : `${postedClassesCount} of ${assignments.length} classes posted`}
                    </Text>
                  </View>
                  <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(79,70,229,0.10)' }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.round((postedClassesCount / assignments.length) * 100)}%`,
                          backgroundColor: postedClassesCount === assignments.length ? '#059669' : theme.colors.primary,
                        },
                      ]}
                    />
                  </View>
                </View>
              )}
            </Animated.View>

            <TourTarget id="staff.diary.class" native><Animated.View entering={FadeInDown.delay(100).duration(280)} style={[styles.currentCard, clayCard(isDark, 'md')]}>
              <ClaySheen isDark={isDark} radius={Radii.xxl} />
              <View style={styles.currentTop}>
                <View style={[styles.currentIcon, { backgroundColor: isDark ? ss.softDark : ss.soft }]}>
                  <MaterialIcons name={ss.icon} size={22} color={ss.color} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.currentKicker}>POSTING TO</Text>
                    {current && postedClassIds.has(current.class_section_id) && (
                      <View style={styles.cardStatusChip}>
                        <Ionicons name="checkmark" size={10} color="#059669" />
                        <Text style={styles.cardStatusText}>Posted</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.currentTitle, { color: theme.colors.textStrong }]} numberOfLines={1}>
                    {current ? `${classLabel(current)} · ${current.subject_name || 'Subject'}` : 'Choose a class'}
                  </Text>
                  <Text style={[styles.currentMeta, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                    {scheduleLine}
                  </Text>
                </View>
                <PressScale onPress={() => setClassPickerOpen(true)}>
                  <View style={[styles.changeChip, { backgroundColor: isDark ? 'rgba(79,70,229,0.18)' : '#EEF2FF' }]}>
                    <Text style={[styles.changeText, { color: theme.colors.primary }]}>Switch</Text>
                  </View>
                </PressScale>
              </View>

              {assignments.length > 1 && (
                <TourScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.classStripScroll}>
                  {assignments.map((item) => {
                    const isSelected =
                      current?.class_section_id === item.class_section_id &&
                      (current?.subject_id || '') === (item.subject_id || '');
                    const itemStyle = getSubjectStyle(item.subject_name);
                    const isPosted = postedClassIds.has(item.class_section_id);
                    return (
                      <PressScale
                        key={item.assignment_id}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setCurrent({
                            class_section_id: item.class_section_id,
                            class_name: item.class_name,
                            section_name: item.section_name,
                            subject_id: item.subject_id,
                            subject_name: item.subject_name,
                            display_class: classLabel(item),
                            source: 'manual',
                          });
                        }}
                      >
                        <View
                          style={[
                            styles.classStripPill,
                            {
                              backgroundColor: isSelected
                                ? (isDark ? itemStyle.softDark : itemStyle.soft)
                                : (isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC'),
                              borderColor: isSelected
                                ? itemStyle.color
                                : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(148,163,184,0.28)'),
                            },
                          ]}
                        >
                          <View style={[styles.classPillDot, { backgroundColor: itemStyle.color }]} />
                          <Text
                            style={[
                              styles.classPillText,
                              { color: isSelected ? itemStyle.color : theme.colors.textSecondary },
                              isSelected && { fontWeight: '800' },
                            ]}
                            numberOfLines={1}
                          >
                            {item.class_name}{item.section_name} · {item.subject_name}
                          </Text>
                          {isPosted ? (
                            <Ionicons name="checkmark-circle" size={14} color="#059669" />
                          ) : null}
                        </View>
                      </PressScale>
                    );
                  })}
                </TourScrollView>
              )}
            </Animated.View></TourTarget>

            {suggestion && suggestionId ? (
              <PressScale onPress={() => {
                const found = recent.find((item) => item.id === suggestionId);
                if (found) void reuseEntry(found, 'reuse');
              }}>
                <View style={[styles.suggestRow, clayCard(isDark, 'sm')]}>
                  <ClaySheen isDark={isDark} radius={Radii.xl} />
                  <Ionicons name="sparkles" size={16} color={theme.colors.primary} />
                  <Text style={[styles.suggestText, { color: theme.colors.textSecondary }]} numberOfLines={2}>{suggestion}</Text>
                  <Text style={[styles.changeText, { color: theme.colors.primary }]}>Use</Text>
                </View>
              </PressScale>
            ) : null}

            {pendingClassReady ? (
              <PressScale onPress={() => void openPendingClassDiary()}>
                <View style={[styles.suggestRow, clayCard(isDark, 'sm')]}>
                  <ClaySheen isDark={isDark} radius={Radii.xl} />
                  <Ionicons name="checkmark-circle" size={18} color="#059669" />
                  <Text style={[styles.suggestText, { color: theme.colors.textSecondary }]}>Class diary ready. Review detected subjects.</Text>
                  <Text style={[styles.changeText, { color: theme.colors.primary }]}>Review</Text>
                </View>
              </PressScale>
            ) : null}

            {/* Enhanced Hero Action Bento Grid */}
            <TourTarget id="staff.diary.compose" native><Animated.View entering={FadeInDown.delay(140).duration(280)} style={styles.heroGrid}>
              <PressScale
                fill
                style={styles.heroGridItem}
                onPress={() => {
                  setReuseSource(null);
                  setEditingEntryId(null);
                  setManualTitle('');
                  setManualContent('');
                  setManualDue(todayYmd);
                  setManualTargets([]);
                  setManualOpen(true);
                }}
                disabled={!canWrite}
              >
                <View style={[styles.typeCtaCard, clayCard(isDark, 'md'), { backgroundColor: isDark ? '#1A2332' : '#FFFFFF' }]}>
                  <View style={[styles.heroIconBadge, { backgroundColor: isDark ? 'rgba(79,70,229,0.22)' : '#EEF2FF' }]}>
                    <Ionicons name="create-outline" size={22} color={theme.colors.primary} />
                  </View>
                  <View>
                    <Text style={[styles.heroCardTitle, { color: theme.colors.textStrong }]}>Type Diary</Text>
                    <Text style={[styles.heroCardHint, { color: theme.colors.textTertiary }]}>
                      Write it here
                    </Text>
                  </View>
                  <View style={[styles.heroCardPill, { backgroundColor: isDark ? 'rgba(79,70,229,0.18)' : '#EEF2FF' }]}>
                    <Text style={[styles.heroCardPillText, { color: theme.colors.primary }]}>Open editor</Text>
                    <Ionicons name="arrow-forward" size={12} color={theme.colors.primary} />
                  </View>
                </View>
              </PressScale>

              <PressScale fill style={styles.heroGridItem} onPress={openPhotoSource} disabled={!canWrite || busy}>
                <View style={styles.photoCtaCard}>
                  <LinearGradient colors={['#312E81', '#4F46E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                  <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
                  <View style={styles.photoIconWrap}>
                    <Ionicons name="camera-outline" size={22} color="#FFFFFF" />
                  </View>
                  <View>
                    <Text style={styles.photoCtaTitle}>Photo Diary</Text>
                    <Text style={styles.photoCtaHint}>Up to 4 pages</Text>
                  </View>
                  <View style={styles.photoCardPill}>
                    <Text style={styles.photoActionText}>Add a photo</Text>
                    <Ionicons name="arrow-forward" size={12} color="#FFFFFF" />
                  </View>
                </View>
              </PressScale>
            </Animated.View></TourTarget>

            {classTeacherSections.length > 0 ? (
              <PressScale onPress={beginClassDiaryUpload} disabled={!canWrite || busy}>
                <View style={[styles.classDiaryCta, clayCard(isDark, 'sm')]}>
                  <ClaySheen isDark={isDark} radius={Radii.xl} />
                  <View style={[styles.secondaryIcon, { backgroundColor: isDark ? 'rgba(2,132,199,0.18)' : '#E0F2FE' }]}>
                    <Ionicons name="scan-outline" size={20} color="#0284C7" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.secondaryTitle, { color: theme.colors.textStrong }]}>Upload class diary</Text>
                    <Text style={[styles.heroCardHint, { color: theme.colors.textTertiary }]} numberOfLines={2}>
                      {classTeacherSections.length === 1
                        ? `${classLabel(classTeacherSections[0])} · one photo covers every subject`
                        : `${classTeacherSections.length} homeroom classes · one photo covers every subject`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
                </View>
              </PressScale>
            ) : null}

            {/* Today&apos;s Posted Homework Feed */}
            <View style={styles.sectionBlock}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.sectionTitle, { color: theme.colors.textStrong, marginVertical: 0 }]}>
                  Today&apos;s homework
                </Text>
                {todayEntries.length > 0 && (
                  <View style={[styles.countPill, { backgroundColor: theme.colors.primary }]}>
                    <Text style={styles.countPillText}>{todayEntries.length}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.alertTimeNotice, { color: theme.colors.textTertiary }]}>
                Parents are notified at 5:30 PM
              </Text>
            </View>

            {todayEntries.length === 0 ? (
              <View style={[styles.emptyRecent, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.55)' }]}>
                <Text style={[styles.emptyTitle, { color: theme.colors.textStrong }]}>Nothing posted yet</Text>
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary, textAlign: 'center' }]}>
                  Use Type or Photo above. It will show up here.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 10, marginBottom: Spacing.md }}>
                {todayEntries.map((item) => {
                  const entryStyle = getSubjectStyle(item.subject_name);
                  const photos = normalizeDiaryAttachments(item.attachments);
                  const photoOnly = photos.length > 0 && isPhotoFallbackContent(item.content);
                  return (
                    <View key={item.id} style={[styles.todayCard, clayCard(isDark, 'sm')]}>
                      <ClaySheen isDark={isDark} radius={Radii.xl} />
                      <View style={[styles.todayAccentBar, { backgroundColor: entryStyle.color }]} />
                      <View style={{ flex: 1, padding: 14 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={[styles.classBadgeMini, { backgroundColor: isDark ? entryStyle.softDark : entryStyle.soft }]}>
                              <Text style={[styles.classBadgeMiniText, { color: entryStyle.color }]}>
                                {item.class_name}-{item.section_name} • {item.subject_name}
                              </Text>
                            </View>
                          </View>
                          {item.homework_due_date ? (
                            <Text style={[styles.dueBadgeText, { color: theme.colors.textTertiary }]}>
                              Due: {relativeDayLabel(toDateKey(item.homework_due_date))}
                            </Text>
                          ) : null}
                        </View>

                        <Text style={[styles.todayTitleText, { color: theme.colors.textStrong }]}>
                          {diaryDisplayTitle(item)}
                        </Text>

                        {photos[0] ? (
                          <Pressable onPress={() => openPhotoViewer(photos)} style={styles.photoFrame}>
                            <Image source={{ uri: photos[0] }} style={[styles.todayPhotoThumb, { marginVertical: 0 }]} />
                            {photos.length > 1 ? (
                              <View style={styles.photoCountBadge}>
                                <Text style={styles.photoCountText}>{photos.length} pages</Text>
                              </View>
                            ) : null}
                          </Pressable>
                        ) : null}

                        {photoOnly ? null : (
                          <Text style={[styles.todayContentText, { color: theme.colors.textSecondary }]} numberOfLines={3}>
                            {diaryDisplayContent(item)}
                          </Text>
                        )}

                        <View style={styles.todayActionsRow}>
                          <PressScale onPress={() => void reuseEntry(item, 'edit')}>
                            <View style={[styles.actionPill, { backgroundColor: isDark ? 'rgba(79,70,229,0.18)' : '#EEF2FF' }]}>
                              <Ionicons name="pencil-outline" size={13} color={theme.colors.primary} style={{ marginRight: 4 }} />
                              <Text style={[styles.actionPillText, { color: theme.colors.primary }]}>Edit</Text>
                            </View>
                          </PressScale>
                          <PressScale onPress={() => void reuseEntry(item, 'send')}>
                            <View style={[styles.actionPill, { backgroundColor: isDark ? 'rgba(148,163,184,0.12)' : '#F1F5F9' }]}>
                              <Ionicons name="copy-outline" size={13} color={theme.colors.textSecondary} style={{ marginRight: 4 }} />
                              <Text style={[styles.actionPillText, { color: theme.colors.textSecondary }]}>Send to Class</Text>
                            </View>
                          </PressScale>
                          <PressScale onPress={() => handleDelete(item)}>
                            <View style={[styles.actionPill, { backgroundColor: isDark ? 'rgba(220,38,38,0.12)' : '#FEF2F2' }]}>
                              <Ionicons name="trash-outline" size={13} color="#DC2626" style={{ marginRight: 4 }} />
                              <Text style={[styles.actionPillText, { color: '#DC2626' }]}>Delete</Text>
                            </View>
                          </PressScale>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Quick Templates Panel */}
            <View style={[styles.panel, clayCard(isDark, 'sm')]}>
              <ClaySheen isDark={isDark} radius={Radii.xl} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm }}>
                <Text style={[styles.sectionTitle, { color: theme.colors.textStrong, marginVertical: 0 }]}>Quick Templates</Text>
                <PressScale onPress={() => setMoreTemplates(true)}>
                  <Text style={[styles.changeText, { color: theme.colors.primary }]}>View All ({templates.length})</Text>
                </PressScale>
              </View>
              <View style={styles.chipWrap}>
                {quickTemplates.map((item) => (
                  <PressScale key={item.id} onPress={() => void applyTemplate(item)}>
                    <View style={[styles.templateChip, { backgroundColor: isDark ? '#161E2E' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(148,163,184,0.22)' }]}>
                      <Text style={[styles.templateChipText, { color: theme.colors.textStrong }]}>{item.name}</Text>
                    </View>
                  </PressScale>
                ))}
              </View>
              {favourites.length > 0 && (
                <>
                  <Text style={[styles.sectionHint, { color: theme.colors.textTertiary, marginTop: 12 }]}>My Favourites</Text>
                  <View style={styles.chipWrap}>
                    {favourites.slice(0, 6).map((item) => (
                      <PressScale key={`fav-${item.id}`} onPress={() => void applyTemplate(item)}>
                        <View style={[styles.templateChip, { backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : '#FFFBEB', borderColor: isDark ? 'rgba(245,158,11,0.25)' : '#FDE68A' }]}>
                          <Text style={[styles.templateChipText, { color: isDark ? '#FBBF24' : '#92400E' }]}>★ {item.name}</Text>
                        </View>
                      </PressScale>
                    ))}
                  </View>
                </>
              )}
            </View>

            {/* Recent Section (Fast Reuse) */}
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textStrong, marginVertical: 0 }]}>Recent Entries</Text>
              <PressScale onPress={() => setCopyFromOpen(true)}>
                <View style={[styles.changeChip, { backgroundColor: isDark ? 'rgba(79,70,229,0.18)' : '#EEF2FF' }]}>
                  <Text style={[styles.changeText, { color: theme.colors.primary }]}>Copy from</Text>
                </View>
              </PressScale>
            </View>

            {recent.length === 0 ? (
              <View style={[styles.emptyRecent, clayCard(isDark, 'sm')]}>
                <ClaySheen isDark={isDark} radius={Radii.xl} />
                <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(79,70,229,0.16)' : '#EEF2FF' }]}>
                  <Ionicons name="time-outline" size={22} color={theme.colors.primary} />
                </View>
                <Text style={[styles.emptyTitle, { color: theme.colors.textStrong }]}>No previous entries</Text>
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary, textAlign: 'center' }]}>
                  After you send homework, past entries will appear here for 1-tap reuse.
                </Text>
              </View>
            ) : recent.slice(0, 6).map((item) => {
              const photos = normalizeDiaryAttachments(item.attachments);
              const photoOnly = photos.length > 0 && isPhotoFallbackContent(item.content);
              return (
                <View key={item.id} style={[styles.recentCard, clayCard(isDark, 'sm')]}>
                  <ClaySheen isDark={isDark} radius={Radii.xl} />
                  <Text style={[styles.recentMeta, { color: theme.colors.textTertiary }]}>
                    {relativeDayLabel(toDateKey(item.entry_date))} · {item.class_name}{item.section_name} {item.subject_name}
                  </Text>
                  {photos[0] ? (
                    <Pressable onPress={() => openPhotoViewer(photos)}>
                      <Image source={{ uri: photos[0] }} style={styles.recentPhoto} />
                    </Pressable>
                  ) : null}
                  {photoOnly ? null : (
                    <Text style={[styles.recentBody, { color: theme.colors.textStrong }]} numberOfLines={2}>
                      {composeHomeworkLine({ homework: item.content }) || item.content || item.title}
                    </Text>
                  )}
                  <View style={styles.recentActions}>
                    <PressScale onPress={() => void reuseEntry(item, 'reuse')}>
                      <View style={[styles.actionPill, { backgroundColor: isDark ? 'rgba(79,70,229,0.18)' : '#EEF2FF' }]}>
                        <Text style={[styles.actionPillText, { color: theme.colors.primary }]}>Reuse</Text>
                      </View>
                    </PressScale>
                    <PressScale onPress={() => void reuseEntry(item, 'send')}>
                      <View style={[styles.actionPill, { backgroundColor: isDark ? 'rgba(148,163,184,0.12)' : '#F1F5F9' }]}>
                        <Text style={[styles.actionPillText, { color: theme.colors.textSecondary }]}>Send to Class</Text>
                      </View>
                    </PressScale>
                    <PressScale onPress={() => void reuseEntry(item, 'edit')}>
                      <View style={[styles.actionPill, { backgroundColor: isDark ? 'rgba(148,163,184,0.12)' : '#F1F5F9' }]}>
                        <Text style={[styles.actionPillText, { color: theme.colors.textSecondary }]}>Edit</Text>
                      </View>
                    </PressScale>
                    <PressScale onPress={() => setViewEntry(item)}>
                      <View style={[styles.actionPill, { backgroundColor: isDark ? 'rgba(148,163,184,0.12)' : '#F1F5F9' }]}>
                        <Text style={[styles.actionPillText, { color: theme.colors.textSecondary }]}>View</Text>
                      </View>
                    </PressScale>
                  </View>
                </View>
              );
            })}
          </>
        ) : (
          <>
            <DiaryHistoryDateSelectorButton selectedYmd={historyDate} onPress={() => setPickerVisible(true)} onSelect={setHistoryDate} />
            <HomeworkDayList
              theme={theme}
              isDark={isDark}
              styles={styles}
              diaryEntries={diaryEntries}
              displayYmd={historyDate}
              onEdit={(entry) => {
                void reuseEntry(entry, 'edit');
                setActiveTab('today');
              }}
              onDelete={handleDelete}
              onOpenPhoto={openPhotoViewer}
              labels={TE}
            />
          </>
        )}
      </TourScrollView>

      {/* Date picker for History tab */}
      <DiaryHistoryDatePickerSheet visible={pickerVisible} selectedYmd={historyDate} availableYmds={calendarAvailableYmds} onSelect={setHistoryDate} onClose={() => setPickerVisible(false)} subtitle={TE.calendarHint} />

      {/* ========================================================================= */}
      {/* 1. PRIMARY "TYPE / EDIT" MODAL (Fully Keyboard-Aware)                     */}
      {/* ========================================================================= */}
      <Sheet
        visible={manualOpen}
        onClose={() => { setManualOpen(false); setEditingEntryId(null); }}
        closeDisabled={busy}
        isDark={isDark}
        title={editingEntryId ? "Edit Homework" : "Write Homework"}
        subtitle="Students and parents will receive this in their diary"
        badge={current ? {
          text: `${classLabel(current)} • ${current.subject_name || 'General'}`,
          color: ss.color,
          bg: isDark ? ss.softDark : ss.soft,
          icon: ss.icon,
        } : undefined}
      >
        {/* Sibling class sections multi-assign checkbox row */}
        {!editingEntryId && siblingSections.length > 0 && (
          <View style={styles.multiTargetWrap}>
            <Text style={[styles.multiTargetLabel, { color: theme.colors.textSecondary }]}>Also assign to:</Text>
            <TourScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {siblingSections.map((sec) => {
                const isSelected = manualTargets.includes(sec.class_section_id);
                return (
                  <TouchableOpacity
                    key={sec.class_section_id}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setManualTargets((prev) =>
                        isSelected ? prev.filter((id) => id !== sec.class_section_id) : [...prev, sec.class_section_id]
                      );
                    }}
                    style={[
                      styles.targetChip,
                      {
                        backgroundColor: isSelected ? (isDark ? 'rgba(79,70,229,0.22)' : '#EEF2FF') : (isDark ? '#1F293D' : '#F1F5F9'),
                        borderColor: isSelected ? theme.colors.primary : 'transparent',
                      },
                    ]}
                  >
                    <Ionicons
                      name={isSelected ? 'checkbox' : 'square-outline'}
                      size={15}
                      color={isSelected ? theme.colors.primary : theme.colors.textTertiary}
                    />
                    <Text
                      style={[
                        styles.targetChipText,
                        { color: isSelected ? theme.colors.primary : theme.colors.textSecondary },
                        isSelected && { fontWeight: '700' },
                      ]}
                    >
                      {sec.class_name}-{sec.section_name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </TourScrollView>
          </View>
        )}

        <Text style={[styles.reviewLabel, { color: theme.colors.textTertiary }]}>Title / Topic (Optional)</Text>
        <AppTextInput
          value={manualTitle}
          onChangeText={setManualTitle}
          placeholder="e.g. Chapter 4: Linear Equations"
          style={[styles.inputBox, { backgroundColor: isDark ? '#1C2638' : '#FFFFFF', color: theme.colors.textStrong }]}
        />

        {/* Quick Format Tags Bar */}
        <View style={styles.quickTagsHeader}>
          <Text style={[styles.reviewLabel, { color: theme.colors.textTertiary, marginBottom: 0 }]}>
            Homework / Classwork
          </Text>
          <Text style={[styles.charCountText, { color: theme.colors.textTertiary }]}>
            {manualContent.trim().length} chars
          </Text>
        </View>

        <View style={styles.quickTagsRow}>
          <TourScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {QUICK_TAGS.map((tag) => (
              <TouchableOpacity
                key={tag.label}
                onPress={() => appendQuickTag(tag.text)}
                style={[styles.tagPill, { backgroundColor: isDark ? '#1E293B' : '#EEF2FF' }]}
              >
                <Text style={[styles.tagPillText, { color: isDark ? '#93C5FD' : '#2563EB' }]}>{tag.label}</Text>
              </TouchableOpacity>
            ))}
          </TourScrollView>
        </View>

        <AppTextInput
          value={manualContent}
          onChangeText={setManualContent}
          placeholder="What should students complete? e.g. Read pages 42-45 and solve Exercise 4.1 questions 1 to 5."
          multiline
          style={[
            styles.inputBox,
            styles.multilineInput,
            { backgroundColor: isDark ? '#1C2638' : '#FFFFFF', color: theme.colors.textStrong },
          ]}
        />

        {/* Due Date Row with Quick Shortcuts */}
        <Text style={[styles.reviewLabel, { color: theme.colors.textTertiary, marginTop: 12 }]}>Due Date</Text>
        <View style={styles.dueShortcutsRow}>
          {[
            { label: 'Tomorrow', days: 1 },
            { label: 'In 2 Days', days: 2 },
            { label: 'Next Week', days: 7 },
          ].map((sc) => {
            const scYmd = toYmd(new Date(Date.now() + sc.days * 86400000));
            const isSelected = manualDue === scYmd;
            return (
              <TouchableOpacity
                key={sc.label}
                onPress={() => setDueShortcut(sc.days)}
                style={[
                  styles.dueShortcutChip,
                  {
                    backgroundColor: isSelected ? (isDark ? 'rgba(79,70,229,0.22)' : '#EEF2FF') : (isDark ? '#1E293B' : '#F1F5F9'),
                    borderColor: isSelected ? theme.colors.primary : 'transparent',
                  },
                ]}
              >
                <Text style={[styles.dueShortcutText, { color: isSelected ? theme.colors.primary : theme.colors.textSecondary }]}>
                  {sc.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <AppDatePicker label="Specific date" value={manualDue} onChange={setManualDue} isDark={isDark} />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 14 }}>
          <PressScale onPress={() => setSaveTemplateOpen(true)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="bookmark-outline" size={15} color={theme.colors.primary} />
              <Text style={[styles.galleryLink, { color: theme.colors.primary, marginBottom: 0 }]}>Save as quick template</Text>
            </View>
          </PressScale>
          {manualContent.length > 0 && (
            <TouchableOpacity onPress={() => setManualContent('')}>
              <Text style={{ fontSize: 13, color: theme.colors.textTertiary, fontWeight: '600' }}>Clear text</Text>
            </TouchableOpacity>
          )}
        </View>

        <PressScale onPress={() => void saveManual()} disabled={busy}>
          <View style={styles.primaryBtn}>
            <LinearGradient colors={['#4F46E5', '#4338CA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <Text style={styles.primaryBtnText}>
              {busy ? (editingEntryId ? 'Saving…' : 'Sending…') : editingEntryId ? 'Save Changes' : manualTargets.length > 0 ? `Post to ${manualTargets.length + 1} Classes` : 'Post Homework'}
            </Text>
          </View>
        </PressScale>
      </Sheet>

      <Sheet
        visible={photoSourceOpen}
        onClose={() => setPhotoSourceOpen(false)}
        isDark={isDark}
        title="Photo Diary"
        subtitle="Take a photo or choose one from the gallery"
        badge={current ? {
          text: `${classLabel(current)} • ${current.subject_name || 'Diary'}`,
          color: ss.color,
          bg: isDark ? ss.softDark : ss.soft,
          icon: ss.icon,
        } : undefined}
      >
        <View style={styles.sheetActions}>
          <PressScale onPress={() => choosePhotoSource(false)} disabled={busy}>
            <View style={styles.primaryBtn}>
              <LinearGradient colors={['#4F46E5', '#4338CA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Text style={styles.primaryBtnText}>Camera</Text>
            </View>
          </PressScale>
          <PressScale onPress={() => choosePhotoSource(true)} disabled={busy}>
            <View style={styles.ghostBtn}>
              <Text style={[styles.ghostBtnText, { color: theme.colors.primary }]}>Gallery</Text>
            </View>
          </PressScale>
        </View>
      </Sheet>

      {/* ========================================================================= */}
      {/* 2. PHOTO CONFIRMATION MODAL                                              */}
      {/* ========================================================================= */}
      <Sheet
        visible={photoConfirmOpen && !photoEditor && !photoViewer}
        onClose={closePhotoConfirm}
        isDark={isDark}
        closeDisabled={busy}
        title="Upload Photo Diary"
        subtitle={photoUris.length > 1 ? `${photoUris.length} pages ready to send` : 'Check the page, then send or read the text'}
        badge={current ? {
          text: `${classLabel(current)} • ${current.subject_name || 'Diary'}`,
          color: ss.color,
          bg: isDark ? ss.softDark : ss.soft,
          icon: ss.icon,
        } : undefined}
      >
        {activePhotoUri ? (
          <Pressable onPress={() => openPhotoViewer(photoUris, Math.min(photoIndex, photoUris.length - 1))} style={styles.photoFrame}>
            <Image source={{ uri: activePhotoUri }} style={styles.uploadPreview} resizeMode="cover" />
            <View style={styles.photoCountBadge}>
              <Text style={styles.photoCountText}>
                Page {Math.min(photoIndex, photoUris.length - 1) + 1} of {photoUris.length}
              </Text>
            </View>
          </Pressable>
        ) : null}

        {photoUris.length > 0 ? (
          <TourScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbStrip}>
            {photoUris.map((uri, index) => {
              const selected = index === Math.min(photoIndex, photoUris.length - 1);
              return (
                <View key={`${uri}-${index}`} style={styles.thumbSlot}>
                  <Pressable onPress={() => setPhotoIndex(index)}>
                    <Image
                      source={{ uri }}
                      style={[
                        styles.confirmThumb,
                        styles.uploadThumb,
                        { borderColor: selected ? theme.colors.primary : 'transparent', borderWidth: 2 },
                      ]}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => removePhotoPage(index)}
                    disabled={busy}
                    style={[styles.thumbRemove, { backgroundColor: isDark ? '#0F172A' : '#FFFFFF' }]}
                  >
                    <Ionicons name="close" size={12} color={isDark ? '#F8FAFC' : '#0F172A'} />
                  </Pressable>
                </View>
              );
            })}
          </TourScrollView>
        ) : null}

        <PressScale onPress={() => {
          if (!activePhotoUri) return;
          const index = Math.min(photoIndex, photoUris.length - 1);
          editPickedPages([activePhotoUri], ([edited]) => {
            setPhotoUris((pages) => pages.map((page, pageIndex) => pageIndex === index ? edited : page));
            setExtraction(null); setOcrMessage(null);
          });
        }} disabled={busy || !activePhotoUri}>
          <View style={[styles.ghostBtn, { flexDirection: 'row', gap: 8, marginBottom: 10 }]}>
            <Ionicons name="crop-outline" size={18} color={theme.colors.primary} />
            <Text style={[styles.ghostBtnText, { color: theme.colors.primary }]}>Crop, rotate & enhance</Text>
          </View>
        </PressScale>

        <View style={styles.uploadToolRow}>
          <PressScale fill onPress={() => void addPhotoPages(false)} disabled={busy || photoUris.length >= PHOTO_PAGE_LIMIT}>
            <View style={styles.uploadTool}>
              <Ionicons name="camera-outline" size={15} color={theme.colors.primary} />
              <Text style={[styles.uploadToolText, { color: theme.colors.primary }]}>Add</Text>
            </View>
          </PressScale>
          <PressScale fill onPress={() => void addPhotoPages(true)} disabled={busy || photoUris.length >= PHOTO_PAGE_LIMIT}>
            <View style={styles.uploadTool}>
              <Ionicons name="images-outline" size={15} color={theme.colors.primary} />
              <Text style={[styles.uploadToolText, { color: theme.colors.primary }]}>Gallery</Text>
            </View>
          </PressScale>
          <PressScale fill onPress={() => void replacePhotoPage(false)} disabled={busy || !photoUris.length}>
            <View style={styles.uploadTool}>
              <Ionicons name="refresh-outline" size={15} color={theme.colors.primary} />
              <Text style={[styles.uploadToolText, { color: theme.colors.primary }]}>Retake</Text>
            </View>
          </PressScale>
        </View>

        <PressScale onPress={() => void extractPhoto()} disabled={busy || !photoUris.length}>
          <View style={[styles.ghostBtn, { flexDirection: 'row', gap: 6 }]}>
            <Ionicons name="sparkles-outline" size={16} color={theme.colors.primary} />
            <Text style={[styles.ghostBtnText, { color: theme.colors.primary }]}>
              {busy ? busyLabel : 'Read text from photo'}
            </Text>
          </View>
        </PressScale>

        <View style={[styles.retentionNote, clayCard(isDark, 'sm')]}>
          <ClaySheen isDark={isDark} radius={Radii.xl} />
          <Ionicons name="time-outline" size={18} color={theme.colors.primary} />
          <Text style={[styles.retentionText, { color: theme.colors.textSecondary }]}>
            Parents can view these pages. Alerts go out at 5:30 PM IST. Photos are kept for 1 month.
          </Text>
        </View>

        {!editingEntryId && siblingSections.length > 0 ? (
          <View style={styles.multiTargetWrap}>
            <Text style={[styles.multiTargetLabel, { color: theme.colors.textSecondary }]}>Also send to</Text>
            <TourScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {siblingSections.map((sec) => {
                const isSelected = photoTargets.includes(sec.class_section_id);
                return (
                  <TouchableOpacity
                    key={`photo-${sec.class_section_id}`}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setPhotoTargets((prev) => (
                        isSelected ? prev.filter((id) => id !== sec.class_section_id) : [...prev, sec.class_section_id]
                      ));
                    }}
                    style={[
                      styles.targetChip,
                      {
                        backgroundColor: isSelected ? (isDark ? 'rgba(79,70,229,0.22)' : '#EEF2FF') : (isDark ? '#1F293D' : '#F1F5F9'),
                        borderColor: isSelected ? theme.colors.primary : 'transparent',
                      },
                    ]}
                  >
                    <Ionicons name={isSelected ? 'checkbox' : 'square-outline'} size={15} color={isSelected ? theme.colors.primary : theme.colors.textTertiary} />
                    <Text style={[styles.targetChipText, { color: isSelected ? theme.colors.primary : theme.colors.textSecondary }]}>
                      {sec.class_name}-{sec.section_name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </TourScrollView>
          </View>
        ) : null}

        <Text style={[styles.reviewLabel, { color: theme.colors.textTertiary }]}>Title</Text>
        <AppTextInput
          value={photoTitle}
          onChangeText={setPhotoTitle}
          placeholder={`${current?.subject_name || 'Diary'} Homework`}
          editable={!busy}
          style={[styles.inputBox, { backgroundColor: isDark ? '#1C2638' : '#FFFFFF', color: theme.colors.textStrong }]}
        />

        <View style={styles.quickTagsHeader}>
          <Text style={[styles.reviewLabel, { color: theme.colors.textTertiary, marginBottom: 0 }]}>Note for parents</Text>
          <Text style={[styles.charCountText, { color: theme.colors.textTertiary }]}>{photoNote.trim().length} chars</Text>
        </View>
        <AppTextInput
          value={photoNote}
          onChangeText={setPhotoNote}
          placeholder="Optional. Leave blank to send the photo on its own."
          editable={!busy}
          multiline
          style={[styles.inputBox, styles.noteInput, { backgroundColor: isDark ? '#1C2638' : '#FFFFFF', color: theme.colors.textStrong }]}
        />

        <Text style={[styles.reviewLabel, { color: theme.colors.textTertiary, marginTop: 12 }]}>Due date</Text>
        <View style={styles.dueShortcutsRow}>
          <TouchableOpacity
            onPress={() => setPhotoDue('')}
            style={[
              styles.dueShortcutChip,
              {
                backgroundColor: !photoDue ? (isDark ? 'rgba(79,70,229,0.22)' : '#EEF2FF') : (isDark ? '#1E293B' : '#F1F5F9'),
                borderColor: !photoDue ? theme.colors.primary : 'transparent',
              },
            ]}
          >
            <Text style={[styles.dueShortcutText, { color: !photoDue ? theme.colors.primary : theme.colors.textSecondary }]}>None</Text>
          </TouchableOpacity>
          {DUE_SHORTCUTS.map((shortcut) => {
            const shortcutYmd = toYmd(new Date(Date.now() + shortcut.days * 86400000));
            const isSelected = photoDue === shortcutYmd;
            return (
              <TouchableOpacity
                key={shortcut.label}
                onPress={() => setPhotoDue(shortcutYmd)}
                style={[
                  styles.dueShortcutChip,
                  {
                    backgroundColor: isSelected ? (isDark ? 'rgba(79,70,229,0.22)' : '#EEF2FF') : (isDark ? '#1E293B' : '#F1F5F9'),
                    borderColor: isSelected ? theme.colors.primary : 'transparent',
                  },
                ]}
              >
                <Text style={[styles.dueShortcutText, { color: isSelected ? theme.colors.primary : theme.colors.textSecondary }]}>{shortcut.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <AppDatePicker label="Specific date" value={photoDue} onChange={setPhotoDue} isDark={isDark} />

        <View style={styles.sheetActions}>
          <PressScale onPress={closePhotoConfirm} disabled={busy}>
            <View style={styles.ghostBtn}>
              <Text style={[styles.ghostBtnText, { color: theme.colors.primary }]}>Cancel</Text>
            </View>
          </PressScale>
          <PressScale onPress={() => void sendConfirmedPhoto()} disabled={busy || !photoUris.length}>
            <View style={styles.primaryBtn}>
              <LinearGradient colors={['#4F46E5', '#4338CA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Text style={styles.primaryBtnText}>
                {busy ? busyLabel : photoTargets.length > 0 ? `Send to ${photoTargets.length + 1} classes` : 'Send Photo Diary'}
              </Text>
            </View>
          </PressScale>
        </View>
      </Sheet>

      {/* ========================================================================= */}
      {/* 3. OCR REVIEW & EDIT MODAL (Keyboard-Aware)                              */}
      {/* ========================================================================= */}
      <Sheet
        visible={photoMode === 'review' && !photoConfirmOpen && !photoEditor && !photoViewer}
        onClose={resetFlows}
        isDark={isDark}
        closeDisabled={busy}
        title="Review Extracted Homework"
        subtitle="Check the reading, then send the text, the photo, or both."
        badge={current ? {
          text: `${classLabel(current)} • ${current.subject_name || 'Diary'}`,
          color: ss.color,
          bg: isDark ? ss.softDark : ss.soft,
          icon: ss.icon,
        } : undefined}
      >
        {activePhotoUri ? (
          <Pressable onPress={() => openPhotoViewer(photoUris, Math.min(photoIndex, photoUris.length - 1))} style={styles.photoFrame}>
            <Image source={{ uri: activePhotoUri }} style={styles.uploadPreview} resizeMode="cover" />
            {photoUris.length > 1 ? (
              <View style={styles.photoCountBadge}>
                <Text style={styles.photoCountText}>{photoUris.length} pages</Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}

        <Text style={[styles.reviewLabel, { color: theme.colors.textTertiary }]}>Title</Text>
        <AppTextInput
          value={photoTitle}
          onChangeText={setPhotoTitle}
          placeholder="Homework title"
          style={[styles.inputBox, { backgroundColor: isDark ? '#1C2638' : '#FFFFFF', color: theme.colors.textStrong }]}
        />

        <View style={styles.quickTagsHeader}>
          <Text style={[styles.reviewLabel, { color: theme.colors.textTertiary, marginBottom: 0 }]}>
            Homework Text
          </Text>
          <Text style={[styles.charCountText, { color: theme.colors.textTertiary }]}>
            {previewContent.trim().length} chars
          </Text>
        </View>

        <AppTextInput
          value={previewContent}
          onChangeText={setPreviewContent}
          placeholder="Edit the extracted homework text"
          multiline
          style={[
            styles.inputBox,
            styles.multilineInput,
            { backgroundColor: isDark ? '#1C2638' : '#FFFFFF', color: theme.colors.textStrong },
          ]}
        />

        <Text style={[styles.reviewLabel, { color: theme.colors.textTertiary, marginTop: 12 }]}>
          Due date{extraction && uncertainFields(extraction).includes('dueDate') ? ' · please verify' : ''}
        </Text>
        <View style={styles.dueShortcutsRow}>
          <TouchableOpacity
            onPress={() => setPhotoDue('')}
            style={[
              styles.dueShortcutChip,
              {
                backgroundColor: !photoDue ? (isDark ? 'rgba(79,70,229,0.22)' : '#EEF2FF') : (isDark ? '#1E293B' : '#F1F5F9'),
                borderColor: !photoDue ? theme.colors.primary : 'transparent',
              },
            ]}
          >
            <Text style={[styles.dueShortcutText, { color: !photoDue ? theme.colors.primary : theme.colors.textSecondary }]}>None</Text>
          </TouchableOpacity>
          {DUE_SHORTCUTS.map((shortcut) => {
            const shortcutYmd = toYmd(new Date(Date.now() + shortcut.days * 86400000));
            const isSelected = photoDue === shortcutYmd;
            return (
              <TouchableOpacity
                key={`review-${shortcut.label}`}
                onPress={() => setPhotoDue(shortcutYmd)}
                style={[
                  styles.dueShortcutChip,
                  {
                    backgroundColor: isSelected ? (isDark ? 'rgba(79,70,229,0.22)' : '#EEF2FF') : (isDark ? '#1E293B' : '#F1F5F9'),
                    borderColor: isSelected ? theme.colors.primary : 'transparent',
                  },
                ]}
              >
                <Text style={[styles.dueShortcutText, { color: isSelected ? theme.colors.primary : theme.colors.textSecondary }]}>{shortcut.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <AppDatePicker label="Specific date" value={photoDue} onChange={setPhotoDue} isDark={isDark} />

        {ocrMessage ? <Text style={[styles.warnText, { color: theme.colors.textSecondary }]}>{ocrMessage}</Text> : null}

        <View style={styles.sheetActions}>
          <PressScale onPress={() => void sendExtractedHomework(true)} disabled={busy || !photoUris.length}>
            <View style={styles.primaryBtn}>
              <LinearGradient colors={['#4F46E5', '#4338CA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Text style={styles.primaryBtnText}>{busy ? 'Sending…' : 'Send text and photo'}</Text>
            </View>
          </PressScale>
          <PressScale onPress={() => void sendExtractedHomework(false)} disabled={busy}>
            <View style={styles.ghostBtn}>
              <Text style={[styles.ghostBtnText, { color: theme.colors.primary }]}>Send text only</Text>
            </View>
          </PressScale>
          <PressScale onPress={() => setPhotoConfirmOpen(true)} disabled={busy}>
            <View style={styles.ghostBtn}>
              <Text style={[styles.ghostBtnText, { color: theme.colors.primary }]}>Send original photo instead</Text>
            </View>
          </PressScale>
        </View>
      </Sheet>

      {/* ========================================================================= */}
      {/* 4. VOICE REVIEW MODAL                                                     */}
      {/* ========================================================================= */}
      <Sheet
        visible={voiceMode === 'review'}
        onClose={resetFlows}
        isDark={isDark}
        title="Voice Diary"
        subtitle="Review transcribed homework"
        badge={current ? {
          text: `${classLabel(current)} • ${current.subject_name || 'Diary'}`,
          color: ss.color,
          bg: isDark ? ss.softDark : ss.soft,
          icon: ss.icon,
        } : undefined}
      >
        <Text style={[styles.reviewBody, { color: theme.colors.textStrong }]}>
          {previewContent || voiceText || 'No speech captured.'}
        </Text>
        {ocrMessage ? <Text style={[styles.warnText, { color: theme.colors.textSecondary }]}>{ocrMessage}</Text> : null}
        <View style={styles.sheetActions}>
          <PressScale onPress={() => void startVoice()}><View style={styles.ghostBtn}><Text style={[styles.ghostBtnText, { color: theme.colors.primary }]}>Speak Again</Text></View></PressScale>
          <PressScale onPress={() => { setManualContent(previewContent || voiceText); setManualOpen(true); }}><View style={styles.ghostBtn}><Text style={[styles.ghostBtnText, { color: theme.colors.primary }]}>Edit Text</Text></View></PressScale>
          <PressScale onPress={() => void publishNow({ content: previewContent || voiceText, extraction, entrySource: 'VOICE' })}>
            <View style={styles.primaryBtn}><Text style={styles.primaryBtnText}>Send Voice Diary</Text></View>
          </PressScale>
        </View>
      </Sheet>

      {/* ========================================================================= */}
      {/* 5. TEMPLATE PROMPT MODAL (Keyboard-Aware)                                 */}
      {/* ========================================================================= */}
      <Sheet
        visible={!!templatePrompt}
        onClose={() => setTemplatePrompt(null)}
        isDark={isDark}
        title={templatePrompt?.name || "Template"}
        subtitle="Fill in the template details"
        badge={current ? {
          text: `${classLabel(current)} • ${current.subject_name || 'Diary'}`,
          color: ss.color,
          bg: isDark ? ss.softDark : ss.soft,
          icon: ss.icon,
        } : undefined}
      >
        {(templatePrompt?.variables || []).map((field) => (
          <View key={field.key} style={{ marginBottom: 10 }}>
            <Text style={[styles.reviewLabel, { color: theme.colors.textTertiary }]}>{field.label}</Text>
            <AppTextInput
              value={templateValues[field.key] || ''}
              onChangeText={(text) => setTemplateValues((prev) => ({ ...prev, [field.key]: text }))}
              placeholder={`Enter ${field.label.toLowerCase()}`}
              style={[styles.inputBox, { backgroundColor: isDark ? '#1C2638' : '#FFFFFF', color: theme.colors.textStrong }]}
            />
          </View>
        ))}

        <Text style={[styles.reviewLabel, { color: theme.colors.textTertiary, marginTop: 4 }]}>Preview:</Text>
        <Text style={[styles.reviewBody, { color: theme.colors.textSecondary, marginBottom: 14 }]}>
          {renderTemplateContent(templatePrompt?.content || '', templateValues)}
        </Text>

        <PressScale onPress={() => void sendTemplatePrompt()} disabled={busy}>
          <View style={styles.primaryBtn}><Text style={styles.primaryBtnText}>{busy ? 'Sending…' : 'Send Homework'}</Text></View>
        </PressScale>
      </Sheet>

      {/* ========================================================================= */}
      {/* 6. CLASS PICKER MODAL                                                    */}
      {/* ========================================================================= */}
      <Sheet
        visible={classPickerOpen}
        onClose={() => setClassPickerOpen(false)}
        isDark={isDark}
        title="Select Class"
        subtitle="Choose which class to view or assign homework"
      >
        {assignments.map((item) => {
          const itemStyle = getSubjectStyle(item.subject_name);
          const isSelected = current?.class_section_id === item.class_section_id;
          const isPosted = postedClassIds.has(item.class_section_id);
          return (
            <PressScale
              key={item.assignment_id}
              onPress={() => {
                setCurrent({
                  class_section_id: item.class_section_id,
                  class_name: item.class_name,
                  section_name: item.section_name,
                  subject_id: item.subject_id,
                  subject_name: item.subject_name,
                  display_class: classLabel(item),
                  source: 'manual',
                });
                setClassPickerOpen(false);
              }}
            >
              <View
                style={[
                  styles.pickerRow,
                  isSelected && { backgroundColor: isDark ? 'rgba(79,70,229,0.18)' : '#EEF2FF', borderRadius: Radii.lg },
                ]}
              >
                <View style={[styles.classPillDot, { backgroundColor: itemStyle.color, marginRight: 10 }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reviewBody, { color: theme.colors.textStrong, marginBottom: 0 }]}>
                    {item.class_name}{item.section_name} • {item.subject_name}
                  </Text>
                </View>
                {isPosted && (
                  <View style={styles.postedBadge}>
                    <Ionicons name="checkmark" size={12} color="#059669" />
                    <Text style={{ fontSize: 11, color: '#059669', fontWeight: '700', marginLeft: 2 }}>Posted</Text>
                  </View>
                )}
              </View>
            </PressScale>
          );
        })}
      </Sheet>

      {/* ========================================================================= */}
      {/* 7. SEND TO CLASSES MODAL                                                 */}
      {/* ========================================================================= */}
      <Sheet
        visible={sendToOpen}
        onClose={() => setSendToOpen(false)}
        isDark={isDark}
        title="Send to Classes"
        subtitle="Select multiple sections to broadcast this homework"
      >
        {assignments.map((item) => {
          const selected = selectedTargets.includes(item.class_section_id);
          return (
            <PressScale
              key={`send-${item.assignment_id}`}
              onPress={() => {
                setSelectedTargets((prev) => selected ? prev.filter((id) => id !== item.class_section_id) : [...prev, item.class_section_id]);
              }}
            >
              <View style={[styles.pickerRow, selected && { backgroundColor: isDark ? 'rgba(79,70,229,0.16)' : '#EEF2FF', borderRadius: Radii.lg }]}>
                <Ionicons name={selected ? "checkbox" : "square-outline"} size={20} color={selected ? theme.colors.primary : theme.colors.textTertiary} style={{ marginRight: 10 }} />
                <Text style={[styles.reviewBody, { color: theme.colors.textStrong, marginBottom: 0 }]}>
                  {item.class_name}{item.section_name} • {item.subject_name}
                </Text>
              </View>
            </PressScale>
          );
        })}
        <PressScale onPress={() => void sendToClasses()} disabled={busy || selectedTargets.length === 0}>
          <View style={[styles.primaryBtn, { marginTop: 12 }]}>
            <Text style={styles.primaryBtnText}>
              {busy ? 'Sending…' : `Send to ${selectedTargets.length} Classes`}
            </Text>
          </View>
        </PressScale>
      </Sheet>

      {/* ========================================================================= */}
      {/* 8. ALL TEMPLATES MODAL                                                    */}
      {/* ========================================================================= */}
      <Sheet visible={moreTemplates} onClose={() => setMoreTemplates(false)} isDark={isDark} title="All Templates" subtitle="Pick a pre-made template">
        {myTemplates.length > 0 && <Text style={[styles.reviewLabel, { color: theme.colors.textTertiary }]}>My Templates</Text>}
        {myTemplates.map((item) => (
          <PressScale key={`mine-${item.id}`} onPress={() => { setMoreTemplates(false); void applyTemplate(item); }}>
            <View style={styles.pickerRow}><Text style={[styles.reviewBody, { color: theme.colors.textStrong }]}>{item.name}</Text></View>
          </PressScale>
        ))}
        {schoolTemplates.length > 0 && <Text style={[styles.reviewLabel, { color: theme.colors.textTertiary, marginTop: 8 }]}>School Templates</Text>}
        {schoolTemplates.map((item) => (
          <PressScale key={`school-${item.id}`} onPress={() => { setMoreTemplates(false); void applyTemplate(item); }}>
            <View style={styles.pickerRow}><Text style={[styles.reviewBody, { color: theme.colors.textStrong }]}>{item.name}</Text></View>
          </PressScale>
        ))}
        <Text style={[styles.reviewLabel, { color: theme.colors.textTertiary, marginTop: 8 }]}>Standard Templates</Text>
        {templates.filter((item) => !myTemplates.some((mine) => mine.id === item.id) && !schoolTemplates.some((school) => school.id === item.id)).map((item) => (
          <PressScale key={`more-${item.id}`} onPress={() => { setMoreTemplates(false); void applyTemplate(item); }}>
            <View style={styles.pickerRow}><Text style={[styles.reviewBody, { color: theme.colors.textStrong }]}>{item.name}</Text></View>
          </PressScale>
        ))}
      </Sheet>

      {/* ========================================================================= */}
      {/* 9. COPY FROM RECENT MODAL                                                 */}
      {/* ========================================================================= */}
      <Sheet visible={copyFromOpen} onClose={() => setCopyFromOpen(false)} isDark={isDark} title="Copy Previous Entry" subtitle={`Copy into ${classLabel(current)}`}>
        {recent.map((item) => (
          <PressScale key={`copy-${item.id}`} onPress={() => {
            setReuseSource(item);
            setEditingEntryId(null);
            setManualTitle(item.title || '');
            setManualContent(item.content || '');
            setManualDue(toDateKey(item.homework_due_date) || todayYmd);
            setManualTargets([]);
            setCopyFromOpen(false);
            setManualOpen(true);
          }}>
            <View style={styles.pickerRow}>
              <Text style={[styles.recentMeta, { color: theme.colors.textTertiary }]}>{relativeDayLabel(toDateKey(item.entry_date))} • {item.class_name}{item.section_name} {item.subject_name}</Text>
              <Text style={[styles.reviewBody, { color: theme.colors.textStrong }]} numberOfLines={2}>{item.content || item.title}</Text>
            </View>
          </PressScale>
        ))}
      </Sheet>

      {/* ========================================================================= */}
      {/* 10. VIEW ENTRY MODAL                                                      */}
      {/* ========================================================================= */}
      <Sheet visible={!!viewEntry} onClose={() => setViewEntry(null)} isDark={isDark} title={viewEntry?.title || 'Diary Entry'}>
        <Text style={[styles.recentMeta, { color: theme.colors.textTertiary }]}>
          {viewEntry ? `${relativeDayLabel(toDateKey(viewEntry.entry_date))} • ${viewEntry.class_name || ''}${viewEntry.section_name || ''} ${viewEntry.subject_name || ''}` : ''}
        </Text>
        <Text style={[styles.reviewBody, { color: theme.colors.textStrong, marginVertical: 12 }]}>{viewEntry && 'content' in viewEntry ? String(viewEntry.content || '') : ''}</Text>
        <PressScale onPress={() => { if (viewEntry) void reuseEntry(viewEntry, 'reuse'); }}><View style={styles.primaryBtn}><Text style={styles.primaryBtnText}>Reuse This Entry</Text></View></PressScale>
      </Sheet>

      {/* ========================================================================= */}
      {/* 11. SAVE AS TEMPLATE MODAL (Keyboard-Aware)                               */}
      {/* ========================================================================= */}
      <Sheet visible={saveTemplateOpen} onClose={() => setSaveTemplateOpen(false)} isDark={isDark} title="Save as Template" subtitle="Name this reusable homework template">
        <Text style={[styles.reviewLabel, { color: theme.colors.textTertiary }]}>Template Name</Text>
        <AppTextInput
          value={saveTemplateName}
          onChangeText={setSaveTemplateName}
          placeholder="e.g. Corrections + Parent Signature"
          style={[styles.inputBox, { backgroundColor: isDark ? '#1C2638' : '#FFFFFF', color: theme.colors.textStrong, marginBottom: 14 }]}
        />
        <PressScale onPress={() => void saveCustomTemplate()}><View style={styles.primaryBtn}><Text style={styles.primaryBtnText}>Save Template</Text></View></PressScale>
      </Sheet>

      {/* ========================================================================= */}
      {/* 12. HOMEROOM CLASS DIARY SHEETS                                           */}
      {/* ========================================================================= */}
      <Sheet visible={classDiaryPickerOpen} onClose={() => setClassDiaryPickerOpen(false)} isDark={isDark} title="Upload class diary" subtitle="Choose the homeroom, then take or pick a photo">
        {classTeacherSections.length === 0 ? (
          <Text style={[styles.reviewBody, { color: theme.colors.textSecondary }]}>No homeroom class is assigned to this login.</Text>
        ) : classTeacherSections.map((item) => (
          <PressScale key={item.class_section_id} onPress={() => {
            setClassDiaryClass(item);
            setClassDiaryPickerOpen(false);
            setClassDiarySourceOpen(true);
          }}>
            <View style={styles.pickerRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.reviewBody, { color: theme.colors.textStrong, marginBottom: 0 }]}>{classLabel(item)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
            </View>
          </PressScale>
        ))}
      </Sheet>

      <Sheet
        visible={classDiarySourceOpen}
        onClose={() => setClassDiarySourceOpen(false)}
        isDark={isDark}
        title="Upload class diary"
        subtitle={classDiaryClass ? `${classLabel(classDiaryClass)} · every subject on the board` : 'Photograph the board'}
      >
        <View style={[styles.retentionNote, clayCard(isDark, 'sm')]}>
          <ClaySheen isDark={isDark} radius={Radii.xl} />
          <Ionicons name="information-circle-outline" size={18} color={theme.colors.primary} />
          <Text style={[styles.retentionText, { color: theme.colors.textSecondary }]}>
            We read each subject from the photo. You can edit the list before parents see it. Photos are kept for 1 month. Alerts go out at 5:30 PM IST.
          </Text>
        </View>
        <View style={styles.sheetActions}>
          {Platform.OS === 'web' ? (
            <PressScale onPress={() => classDiaryClass && startClassDiaryCapture(classDiaryClass, true)} disabled={!classDiaryClass || busy}>
              <View style={styles.primaryBtn}>
                <LinearGradient colors={['#4F46E5', '#4338CA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                <Text style={styles.primaryBtnText}>Choose photo</Text>
              </View>
            </PressScale>
          ) : (
            <>
              <PressScale onPress={() => classDiaryClass && startClassDiaryCapture(classDiaryClass, false)} disabled={!classDiaryClass || busy}>
                <View style={styles.primaryBtn}>
                  <LinearGradient colors={['#4F46E5', '#4338CA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                  <Text style={styles.primaryBtnText}>Take photo</Text>
                </View>
              </PressScale>
              <PressScale onPress={() => classDiaryClass && startClassDiaryCapture(classDiaryClass, true)} disabled={!classDiaryClass || busy}>
                <View style={styles.ghostBtn}>
                  <Text style={[styles.ghostBtnText, { color: theme.colors.primary }]}>Choose from gallery</Text>
                </View>
              </PressScale>
            </>
          )}
        </View>
      </Sheet>

      <Sheet
        visible={classDiaryReviewOpen && !photoEditor && !photoViewer}
        onClose={() => setClassDiaryReviewOpen(false)}
        isDark={isDark}
        closeDisabled={busy}
        title={`Class diary · ${classLabel(classDiaryClass)}`}
        subtitle={classDiaryEntries.length
          ? `${selectedClassDiaryCount} of ${classDiaryEntries.length} subjects selected`
          : 'Detected subjects from the board'}
      >
        {classDiaryImage ? (
          <Pressable onPress={() => openPhotoViewer([classDiaryImage])} style={styles.photoFrame}>
            <Image source={{ uri: classDiaryImage }} style={styles.uploadPreview} resizeMode="cover" />
            <View style={styles.photoCountBadge}>
              <Text style={styles.photoCountText}>Tap to enlarge</Text>
            </View>
          </Pressable>
        ) : null}
        {classDiaryMessage ? <Text style={[styles.warnText, { color: theme.colors.textSecondary }]}>{classDiaryMessage}</Text> : null}
        {classDiaryEntries.map((item, index) => {
          const included = item.selected !== false;
          const entryStyle = getSubjectStyle(item.subject);
          return (
            <View key={`${item.subject}-${index}`} style={[styles.classEntryCard, !included && { opacity: 0.5 }, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(148,163,184,0.28)', backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC' }]}>
              <View style={styles.classEntryHead}>
                <PressScale onPress={() => {
                  setClassDiaryEntries((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, selected: row.selected === false } : row)));
                }}>
                  <Ionicons name={included ? 'checkbox' : 'square-outline'} size={22} color={included ? entryStyle.color : theme.colors.textTertiary} />
                </PressScale>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.reviewLabel, { color: entryStyle.color, marginBottom: 0 }]}>
                    {(item.unknown ? 'Unknown subject' : item.subject).toUpperCase()}
                  </Text>
                  <Text style={[styles.currentMeta, { color: theme.colors.textSecondary }]}>
                    {included ? (item.confidence_label || 'Looks good') : 'Left out'}
                  </Text>
                </View>
                {item.unknown ? null : (
                  <PressScale onPress={() => setEditClassIndex(index)}>
                    <Text style={[styles.linkBtn, { color: theme.colors.primary }]}>Edit</Text>
                  </PressScale>
                )}
              </View>
              <Text style={[styles.reviewBody, { color: theme.colors.textStrong, marginBottom: 0 }]}>
                {item.homework || item.classwork || 'No text detected'}
              </Text>
              {item.homework && item.classwork ? (
                <Text style={[styles.currentMeta, { color: theme.colors.textSecondary }]}>Classwork: {item.classwork}</Text>
              ) : null}
              {item.unknown ? (
                <View style={styles.chipWrap}>
                  {classDiarySubjects.map((subject) => (
                    <PressScale key={subject.id} onPress={() => {
                      setClassDiaryEntries((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, subject: subject.name, subject_id: subject.id, unknown: false, selected: true } : row)));
                    }}>
                      <View style={[styles.templateChip, { backgroundColor: isDark ? '#161E2E' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(148,163,184,0.22)' }]}>
                        <Text style={[styles.templateChipText, { color: theme.colors.textStrong }]}>{subject.name}</Text>
                      </View>
                    </PressScale>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
        <PressScale onPress={() => void publishClassDiaryNow(false)} disabled={busy || selectedClassDiaryCount === 0}>
          <View style={styles.primaryBtn}>
            <LinearGradient colors={['#4F46E5', '#4338CA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <Text style={styles.primaryBtnText}>
              {busy ? 'Publishing…' : `Publish ${selectedClassDiaryCount} subject${selectedClassDiaryCount === 1 ? '' : 's'}`}
            </Text>
          </View>
        </PressScale>
        <PressScale onPress={confirmSendOriginalClassDiary} disabled={busy}>
          <View style={[styles.ghostBtn, { marginTop: 8 }]}>
            <Text style={[styles.ghostBtnText, { color: theme.colors.primary }]}>Send original photo</Text>
          </View>
        </PressScale>
      </Sheet>

      <Sheet visible={classDiaryFailedOpen && !photoEditor && !photoViewer} onClose={() => setClassDiaryFailedOpen(false)} isDark={isDark} title="Could not read the board" subtitle={classDiaryMessage || 'Send the photo as it is, or type the homework'}>
        {classDiaryImage ? (
          <Pressable onPress={() => openPhotoViewer([classDiaryImage])}>
            <Image source={{ uri: classDiaryImage }} style={styles.uploadPreview} resizeMode="cover" />
          </Pressable>
        ) : null}
        <View style={styles.sheetActions}>
          <PressScale onPress={confirmSendOriginalClassDiary} disabled={busy}>
            <View style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Send original photo</Text>
            </View>
          </PressScale>
          <PressScale onPress={() => classDiaryClass && void captureClassDiary(classDiaryClass, false)} disabled={busy}>
            <View style={styles.ghostBtn}>
              <Text style={[styles.ghostBtnText, { color: theme.colors.primary }]}>Take another photo</Text>
            </View>
          </PressScale>
          <PressScale onPress={() => classDiaryClass && void captureClassDiary(classDiaryClass, true)} disabled={busy}>
            <View style={styles.ghostBtn}>
              <Text style={[styles.ghostBtnText, { color: theme.colors.primary }]}>Choose a different photo</Text>
            </View>
          </PressScale>
          <PressScale onPress={() => { setClassDiaryFailedOpen(false); setManualOpen(true); }}>
            <View style={styles.ghostBtn}>
              <Text style={[styles.ghostBtnText, { color: theme.colors.primary }]}>Type it instead</Text>
            </View>
          </PressScale>
        </View>
      </Sheet>

      <Sheet visible={editClassIndex != null} onClose={() => setEditClassIndex(null)} isDark={isDark} title={editClassIndex != null ? `Edit ${classDiaryEntries[editClassIndex]?.subject}` : 'Edit'}>
        {editClassIndex != null ? (
          <>
            <Text style={[styles.reviewLabel, { color: theme.colors.textTertiary }]}>Homework</Text>
            <AppTextInput
              value={classDiaryEntries[editClassIndex]?.homework || ''}
              onChangeText={(text) => setClassDiaryEntries((prev) => prev.map((row, index) => index === editClassIndex ? { ...row, homework: text } : row))}
              multiline
              style={[styles.inputBox, styles.multilineInput, { backgroundColor: isDark ? '#1C2638' : '#FFFFFF', color: theme.colors.textStrong }]}
            />
            <Text style={[styles.reviewLabel, { color: theme.colors.textTertiary, marginTop: 10 }]}>Classwork</Text>
            <AppTextInput
              value={classDiaryEntries[editClassIndex]?.classwork || ''}
              onChangeText={(text) => setClassDiaryEntries((prev) => prev.map((row, index) => index === editClassIndex ? { ...row, classwork: text } : row))}
              style={[styles.inputBox, { backgroundColor: isDark ? '#1C2638' : '#FFFFFF', color: theme.colors.textStrong }]}
            />
            <Text style={[styles.reviewLabel, { color: theme.colors.textTertiary, marginTop: 10 }]}>Chapter</Text>
            <AppTextInput
              value={classDiaryEntries[editClassIndex]?.chapter || ''}
              onChangeText={(text) => setClassDiaryEntries((prev) => prev.map((row, index) => index === editClassIndex ? { ...row, chapter: text } : row))}
              style={[styles.inputBox, { backgroundColor: isDark ? '#1C2638' : '#FFFFFF', color: theme.colors.textStrong }]}
            />
            <PressScale onPress={() => setEditClassIndex(null)}>
              <View style={[styles.primaryBtn, { marginTop: 12 }]}><Text style={styles.primaryBtnText}>Done</Text></View>
            </PressScale>
          </>
        ) : null}
      </Sheet>

      {busy && !uploadSheetOpen ? (
        <View style={styles.busyOverlay}>
          <View style={[styles.busyCard, clayCard(isDark, 'lg')]}>
            <LogoLoader size={48} color={theme.colors.primary} />
            <Text style={[styles.busyTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>{busyLabel}</Text>
            <Text style={[styles.busyHint, { color: theme.colors.textSecondary }]}>
              Keep this screen open. It will finish on its own.
            </Text>
          </View>
        </View>
      ) : null}

      {photoEditor ? <DiaryPhotoEditor
        key={`${photoEditor.index}:${photoEditor.uris[photoEditor.index]}`}
        uri={photoEditor.uris[photoEditor.index]}
        pageLabel={`Page ${photoEditor.index + 1} of ${photoEditor.uris.length} · adjust corners before uploading`}
        onSave={saveEditedPage}
        onCancel={() => setPhotoEditor(null)}
      /> : null}
      {photoViewer ? <DiaryPhotoViewer photos={photoViewer.photos} initialIndex={photoViewer.index} onClose={() => setPhotoViewer(null)} /> : null}
    </View>
  );
}

// ─── Sheet Component with Robust Native Keyboard Avoidance ─────────────────────

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  isDark: boolean;
  children: React.ReactNode;
  closeDisabled?: boolean;
  title?: string;
  subtitle?: string;
  badge?: {
    text: string;
    color: string;
    bg: string;
    icon?: keyof typeof MaterialIcons.glyphMap;
  };
  maxWidth?: number;
}

function Sheet({
  visible,
  onClose,
  isDark,
  children,
  closeDisabled,
  title,
  subtitle,
  badge,
  maxWidth = 520,
}: SheetProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  if (!visible) return null;
  const requestClose = closeDisabled ? () => {} : onClose;
  const side = 12;
  const bottom = Math.max(12, insets.bottom || (Platform.OS === 'web' ? 16 : 12));
  const cardWidth = Math.min(maxWidth, Math.max(280, width - side * 2));
  const availableH = height - (keyboardHeight > 0 ? keyboardHeight : bottom) - (Platform.OS === 'ios' ? 44 : 32);
  const maxCardH = Math.min(height * 0.92, Math.max(300, availableH));

  return (
    <Modal
      transparent
      animationType="fade"
      visible
      onRequestClose={requestClose}
      statusBarTranslucent
    >
      <View style={sheetStyles.modalBackdrop}>
        <Pressable
          style={sheetStyles.overlay}
          onPress={closeDisabled ? undefined : onClose}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={sheetStyles.kav}
          pointerEvents="box-none"
        >
          <Animated.View
            entering={SlideInDown.springify().damping(24).stiffness(320)}
            style={[
              sheetStyles.card,
              {
                width: cardWidth,
                maxHeight: maxCardH,
                backgroundColor: isDark ? '#141D2E' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.95)',
                marginBottom: bottom,
              },
              clayCard(isDark, 'lg'),
            ]}
          >
            <ClaySheen isDark={isDark} radius={Radii.xxl} />
            {/* Grab handle */}
            <View style={sheetStyles.handleRow}>
              <View
                style={[
                  sheetStyles.handlePill,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(15,23,42,0.14)' },
                ]}
              />
            </View>

            {/* Optional Header */}
            {(title || badge) ? (
              <View style={sheetStyles.headerRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  {badge ? (
                    <View style={[sheetStyles.headerBadge, { backgroundColor: badge.bg }]}>
                      {badge.icon ? (
                        <MaterialIcons name={badge.icon} size={14} color={badge.color} style={{ marginRight: 5 }} />
                      ) : null}
                      <Text style={[sheetStyles.headerBadgeText, { color: badge.color }]} numberOfLines={1}>
                        {badge.text}
                      </Text>
                    </View>
                  ) : null}
                  {title ? (
                    <Text style={[sheetStyles.headerTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                      {title}
                    </Text>
                  ) : null}
                  {subtitle ? (
                    <Text style={[sheetStyles.headerSubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
                <PressScale onPress={requestClose} disabled={closeDisabled}>
                  <View
                    style={[
                      sheetStyles.closeBtn,
                      { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' },
                    ]}
                  >
                    <Ionicons name="close" size={18} color={isDark ? '#CBD5E1' : '#475569'} />
                  </View>
                </PressScale>
              </View>
            ) : null}

            {/* Keyboard dismiss indicator when typing */}
            {keyboardHeight > 0 ? (
              <View style={sheetStyles.keyboardDoneBar}>
                <Pressable onPress={() => Keyboard.dismiss()} style={sheetStyles.keyboardDoneBtn}>
                  <Ionicons name="chevron-down" size={15} color={isDark ? '#93C5FD' : '#2563EB'} />
                  <Text style={[sheetStyles.keyboardDoneText, { color: isDark ? '#93C5FD' : '#2563EB' }]}>
                    Hide Keyboard
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {/* Native Keyboard-Aware Scrollable Body */}
            {Platform.OS === 'web' ? (
              <TourScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                bounces={false}
                contentContainerStyle={sheetStyles.scrollContent}
              >
                {children}
              </TourScrollView>
            ) : (
              <KeyboardAwareScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                bounces={false}
                bottomOffset={Platform.OS === 'ios' ? 44 : 28}
                extraKeyboardSpace={16}
                contentContainerStyle={sheetStyles.scrollContent}
              >
                {children}
              </KeyboardAwareScrollView>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function HomeworkDayList({
  theme, isDark, styles, diaryEntries, displayYmd, onEdit, onDelete, onOpenPhoto, labels,
}: {
  theme: Theme; isDark: boolean; styles: ReturnType<typeof getStyles>;
  diaryEntries: DiaryEntry[]; displayYmd: string;
  onEdit: (entry: DiaryEntry) => void; onDelete: (entry: DiaryEntry) => void;
  onOpenPhoto: (photos: string[]) => void;
  labels: Record<string, string>;
}) {
  const items = diaryEntries.filter((e) => e.entry_date === displayYmd);
  if (items.length === 0) {
    return (
      <View style={[styles.emptyRecent, clayCard(isDark, 'sm')]}>
        <ClaySheen isDark={isDark} radius={Radii.xl} />
        <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(79,70,229,0.16)' : '#EEF2FF' }]}>
          <Ionicons name="book-outline" size={22} color={theme.colors.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: theme.colors.textStrong }]}>{labels.emptyTitle}</Text>
        <Text style={[styles.emptyText, { color: theme.colors.textSecondary, textAlign: 'center' }]}>{labels.noHomework}</Text>
      </View>
    );
  }
  return (
    <View style={styles.listContainer}>
      {items.map((item) => {
        const ss = getSubjectStyle(item.subject_name);
        return (
          <View key={item.id} style={[styles.postCard, clayCard(isDark, 'sm')]}>
            <View style={[styles.postAccent, { backgroundColor: ss.color }]} />
            <View style={styles.postBody}>
              <Text style={[styles.postClass, { color: ss.color }]}>{item.class_name}-{item.section_name} • {item.subject_name}</Text>
              <Text style={[styles.postTitle, { color: theme.colors.textStrong }]}>{diaryDisplayTitle(item)}</Text>
              {normalizeDiaryAttachments(item.attachments)[0] ? (
                <Pressable onPress={() => onOpenPhoto(normalizeDiaryAttachments(item.attachments))}>
                  <Image source={{ uri: normalizeDiaryAttachments(item.attachments)[0] }} style={styles.recentPhoto} />
                </Pressable>
              ) : null}
              {isPhotoFallbackContent(diaryDisplayContent(item)) && normalizeDiaryAttachments(item.attachments).length > 0 ? null : (
                <Text style={[styles.postContent, { color: theme.colors.textSecondary }]} numberOfLines={3}>{diaryDisplayContent(item)}</Text>
              )}
              <View style={styles.actionRow}>
                <PressScale onPress={() => onEdit(item)}><Text style={[styles.editText, { color: theme.colors.primary }]}>{labels.edit}</Text></PressScale>
                <PressScale onPress={() => onDelete(item)}><Text style={[styles.editText, { color: theme.colors.danger }]}>{labels.delete}</Text></PressScale>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const sheetStyles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,16,32,0.65)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  kav: {
    width: '100%',
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  card: {
    borderRadius: Radii.xxl + 4,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
    alignSelf: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  handleRow: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handlePill: {
    width: 38,
    height: 4.5,
    borderRadius: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 10,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.25)',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: Radii.pill,
    marginBottom: 4,
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerTitle: {
    ...Typography.subheading,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  keyboardDoneBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 4,
    marginBottom: 4,
  },
  keyboardDoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(59,130,246,0.12)',
    gap: 4,
  },
  keyboardDoneText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 12,
  },
});

const getStyles = (theme: Theme, isDark: boolean, isWide: boolean) => StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  scrollContent: {
    paddingHorizontal: isWide ? Spacing.xl : Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: 88,
    maxWidth: isWide ? 1040 : 720,
    width: '100%',
    alignSelf: 'center',
  },
  tabWrap: { marginBottom: Spacing.md },

  // Greeting & Progress Header
  greetingHeader: {
    marginBottom: Spacing.md,
    gap: 4,
  },
  greeting: { ...Typography.heading, fontWeight: '800', letterSpacing: -0.6 },
  greetingHint: { ...Typography.caption, fontWeight: '500', lineHeight: 18 },
  progressBlock: { marginTop: 10, gap: 8 },
  progressMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressLabel: { fontSize: 12, fontWeight: '700', letterSpacing: -0.1 },
  progressTrack: { height: 6, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, minWidth: 0 },

  // Active Class Card
  currentCard: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: 14,
  },
  currentTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  currentIcon: {
    width: 48,
    height: 48,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentKicker: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: theme.colors.textTertiary,
  },
  cardStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(5,150,105,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: Radii.pill,
  },
  cardStatusText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#059669',
  },
  currentTitle: {
    ...Typography.title,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  currentMeta: {
    ...Typography.caption,
    fontWeight: '500',
    marginTop: 2,
  },
  changeChip: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeText: { fontSize: 13, fontWeight: '800' },

  // Horizontal Class Switcher Strip
  classStripScroll: {
    gap: 8,
    paddingRight: 4,
  },
  classStripPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.pill,
    borderWidth: 1,
    gap: 6,
    maxWidth: 220,
  },
  classPillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  classPillText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  postedDot: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: 'rgba(5,150,105,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, padding: Spacing.sm, marginBottom: Spacing.sm },
  suggestText: { flex: 1, fontSize: 13, fontWeight: '600' },

  // Hero Bento Action Grid
  heroGrid: {
    flexDirection: isWide ? 'row' : 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  heroGridItem: {
    flex: 1,
    minWidth: 0,
  },
  typeCtaCard: {
    flex: 1,
    padding: Spacing.md,
    minHeight: 168,
    justifyContent: 'space-between',
    borderRadius: Radii.xxl,
  },
  heroIconBadge: {
    width: 44,
    height: 44,
    borderRadius: Radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  heroCardHint: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    marginTop: 2,
  },
  heroCardPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.pill,
  },
  heroCardPillText: {
    fontSize: 11.5,
    fontWeight: '800',
  },

  photoCtaCard: {
    flex: 1,
    padding: Spacing.md,
    minHeight: 168,
    justifyContent: 'space-between',
    borderRadius: Radii.xxl,
    overflow: 'hidden',
  },
  photoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCtaTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  photoCtaHint: { color: 'rgba(255,255,255,0.82)', fontSize: 12, fontWeight: '600', marginTop: 2 },
  photoCardPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  photoActions: { flexDirection: 'row', gap: 8 },
  photoAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    width: '100%',
    paddingVertical: 7,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  photoActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  // Secondary Action Row (OCR + Voice)
  secondaryActionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  miniCtaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: Radii.xl,
    gap: 10,
  },
  miniIconWrap: {
    width: 38,
    height: 38,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCtaTitle: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  miniCtaHint: {
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 1,
  },

  classDiaryCta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, marginBottom: Spacing.md, minHeight: 76 },
  secondaryIcon: { width: 40, height: 40, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
  secondaryTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  classEntryRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(148,163,184,0.25)' },

  // Today's posted entries styling
  todayCard: {
    flexDirection: 'row',
    borderRadius: Radii.xl,
    overflow: 'hidden',
  },
  todayAccentBar: {
    width: 4.5,
  },
  classBadgeMini: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radii.pill,
  },
  classBadgeMiniText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  dueBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  todayTitleText: {
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  todayContentText: {
    fontSize: 13.5,
    lineHeight: 19,
    marginBottom: 6,
  },
  todayPhotoThumb: {
    width: '100%',
    height: 140,
    borderRadius: Radii.lg,
    marginVertical: 6,
    backgroundColor: 'rgba(15,23,42,0.06)',
  },
  todayActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },

  panel: { padding: Spacing.md, marginBottom: Spacing.md },
  sectionTitle: { ...Typography.title, fontWeight: '800', letterSpacing: -0.3, marginBottom: 10 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, marginBottom: Spacing.sm },
  sectionBlock: { marginTop: 4, marginBottom: Spacing.sm, gap: 2 },
  sectionHint: { fontSize: 12, fontWeight: '700', marginBottom: Spacing.xs, marginTop: Spacing.sm },
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radii.pill,
  },
  countPillText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  alertTimeNotice: {
    fontSize: 12,
    fontWeight: '600',
  },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: 0 },
  templateChip: { minHeight: 40, paddingHorizontal: 13, borderRadius: Radii.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  templateChipText: { fontSize: 13, fontWeight: '700' },

  recentCard: { padding: Spacing.md, marginBottom: Spacing.sm },
  recentPhoto: { width: '100%', height: 168, borderRadius: Radii.lg, marginTop: 8, marginBottom: 8, backgroundColor: 'rgba(15,23,42,0.06)' },
  recentMeta: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  recentBody: { fontSize: 14.5, fontWeight: '700', letterSpacing: -0.2 },
  recentActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: Radii.pill,
  },
  actionPillText: { fontSize: 12, fontWeight: '800' },
  linkBtn: { fontSize: 13, fontWeight: '800', minHeight: 32, textAlignVertical: 'center' },
  emptyRecent: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: Spacing.lg, gap: 6, marginBottom: Spacing.md },
  emptyIcon: { width: 48, height: 48, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 15, fontWeight: '800' },
  emptyText: { fontSize: 13, fontWeight: '500' },

  previewImage: { width: '100%', height: isWide ? 180 : 132, borderRadius: Radii.lg, marginBottom: Spacing.sm, backgroundColor: 'rgba(15,23,42,0.06)' },
  confirmThumbs: { marginBottom: Spacing.sm },
  confirmThumb: { width: 148, height: 148, borderRadius: Radii.lg, marginRight: 8, backgroundColor: 'rgba(15,23,42,0.06)' },
  retentionNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, paddingHorizontal: 14, marginBottom: Spacing.md },
  retentionText: { flex: 1, flexShrink: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  reviewLabel: { ...Typography.label, marginBottom: 4, fontWeight: '700' },
  reviewBody: { fontSize: 15, fontWeight: '600', lineHeight: 22, marginBottom: 8 },
  warnText: { fontSize: 13, fontWeight: '500', marginBottom: 10 },
  sheetActions: { gap: 10, marginTop: 10 },
  primaryBtn: { height: 50, borderRadius: Radii.lg, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15.5, fontWeight: '800' },
  ghostBtn: { height: 46, borderRadius: Radii.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(79,70,229,0.12)' : '#EEF2FF' },
  ghostBtnText: { fontSize: 14.5, fontWeight: '800' },
  pickerRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(148,163,184,0.25)' },
  postedBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radii.pill, backgroundColor: 'rgba(5,150,105,0.12)' },
  listContainer: { gap: 12 },
  postCard: { flexDirection: 'row', overflow: 'hidden' },
  postAccent: { width: 4 },
  postBody: { flex: 1, padding: 14 },
  postClass: { fontSize: 12, fontWeight: '800', marginBottom: 4 },
  postTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  postContent: { fontSize: 14, lineHeight: 20 },
  actionRow: { flexDirection: 'row', gap: 14, marginTop: 10 },
  editText: { fontSize: 13, fontWeight: '800' },
  galleryLink: { fontSize: 13, fontWeight: '700' },

  // Enhanced Inputs & Formatting
  inputBox: {
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14.5,
  },
  multilineInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  quickTagsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 4,
  },
  charCountText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  quickTagsRow: {
    marginBottom: 8,
  },
  tagPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radii.pill,
  },
  tagPillText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  dueShortcutsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  dueShortcutChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    borderWidth: 1,
  },
  dueShortcutText: {
    fontSize: 12,
    fontWeight: '700',
  },
  multiTargetWrap: {
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.2)',
  },
  multiTargetLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  targetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.pill,
    borderWidth: 1,
  },
  targetChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  uploadPreview: {
    width: '100%',
    height: isWide ? 240 : 210,
    borderRadius: Radii.lg,
    backgroundColor: 'rgba(15,23,42,0.06)',
  },
  photoFrame: {
    borderRadius: Radii.lg,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  photoCountBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(15,23,42,0.72)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.pill,
  },
  photoCountText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  thumbStrip: {
    gap: 10,
    paddingTop: 8,
    paddingRight: 4,
    marginBottom: Spacing.sm,
  },
  thumbSlot: {
    position: 'relative',
  },
  uploadThumb: {
    width: 72,
    height: 72,
    marginRight: 0,
    marginBottom: 0,
  },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
  },
  uploadToolRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  uploadTool: {
    minHeight: 40,
    borderRadius: Radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    backgroundColor: isDark ? 'rgba(79,70,229,0.12)' : '#EEF2FF',
    paddingHorizontal: 8,
  },
  uploadToolText: {
    fontSize: 12,
    fontWeight: '800',
  },
  noteInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  classEntryCard: {
    padding: 12,
    borderRadius: Radii.lg,
    borderWidth: 1,
    marginBottom: 10,
    gap: 6,
  },
  classEntryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,16,32,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 30,
  },
  busyCard: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 22,
    gap: 8,
  },
  busyTitle: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 4,
  },
  busyHint: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,16,32,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  viewerImage: {
    width: '100%',
    height: '78%',
  },
  viewerHint: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
  },
});
