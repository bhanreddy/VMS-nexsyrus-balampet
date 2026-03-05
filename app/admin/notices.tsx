import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AdminHeader from '../../src/components/AdminHeader';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { NoticeService, Notice, CreateNoticeRequest } from '../../src/services/commonServices';
import { ClassService, ClassInfo } from '../../src/services/classService';
import { Modal, Switch, ScrollView } from 'react-native';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';
export default function AdminNotices() {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Create Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState<'all' | 'students' | 'staff' | 'parents' | 'class'>('all');
  const [priority, setPriority] = useState('medium');
  const [targetClassId, setTargetClassId] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    fetchNotices();
    fetchClasses();
  }, []);
  const fetchClasses = async () => {
    try {
      const data = await ClassService.getClasses();
      setClasses(data);
    } catch (e) {

    }
  };
  const fetchNotices = async () => {
    try {
      setLoading(true);
      const data = await NoticeService.getAll();
      setNotices(data);
    } catch (error) {

      Alert.alert('Error', 'Failed to load notices');
    } finally {
      setLoading(false);
    }
  };
  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
  };
  const getPriorityColor = (priority?: string) => {
    switch ((priority || '').toLowerCase()) {
      case 'high':
        return {
          bg: '#FEE2E2',
          text: '#991B1B'
        };
      case 'medium':
        return {
          bg: '#FEF3C7',
          text: '#92400E'
        };
      case 'low':
        return {
          bg: '#DBEAFE',
          text: '#1E40AF'
        };
      default:
        return {
          bg: '#F3F4F6',
          text: '#374151'
        };
    }
  };
  const filteredNotices = notices.filter((notice) => notice.title.toLowerCase().includes(searchQuery.toLowerCase()) || notice.content.toLowerCase().includes(searchQuery.toLowerCase()));
  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert('Error', 'Title and Content are required');
      return;
    }
    if (audience === 'class' && !targetClassId) {
      Alert.alert('Error', 'Please select a target class');
      return;
    }
    try {
      setCreating(true);
      const payload: CreateNoticeRequest = {
        title,
        content,
        audience,
        priority,
        is_pinned: isPinned,
        target_class_id: audience === 'class' ? targetClassId : undefined
      };
      await NoticeService.create(payload);
      Alert.alert('Success', 'Notice created successfully');
      setModalVisible(false);
      resetForm();
      fetchNotices();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to create notice');
    } finally {
      setCreating(false);
    }
  };
  const resetForm = () => {
    setTitle('');
    setContent('');
    setAudience('all');
    setPriority('medium');
    setTargetClassId('');
    setIsPinned(false);
  };
  const renderItem = ({
    item,
    index

  }: {item: Notice;index: number;}) => {
    const priorityColors = getPriorityColor(item.priority);
    return <Animated.View entering={FadeInDown.delay(index * 100).duration(500)}>
                <TouchableOpacity style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.title}>{item.title}</Text>
                        <View style={[styles.priorityBadge, {
            backgroundColor: priorityColors.bg
          }]}>
                            <Text style={[styles.priorityText, {
              color: priorityColors.text
            }]}>
                                {(item.priority || 'Normal').charAt(0).toUpperCase() + (item.priority || 'Normal').slice(1)}
                            </Text>
                        </View>
                    </View>
                    <Text style={styles.content} numberOfLines={2}>{item.content}</Text>
                    <View style={styles.footer}>
                        <View style={styles.audienceRow}>
                            <Ionicons name="people" size={14} color="#6B7280" />
                            <Text style={styles.audienceText}>
                                {item.audience.charAt(0).toUpperCase() + item.audience.slice(1)}
                            </Text>
                        </View>
                        <Text style={styles.dateText}>{formatTimeAgo(item.published_at || item.created_at)}</Text>
                    </View>
                </TouchableOpacity>
            </Animated.View>;
  };
  return <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />
            <AdminHeader title="Notice Board" showBackButton={true} />
            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
                <TextInput style={styles.searchInput} placeholder="Search notices..." value={searchQuery} onChangeText={setSearchQuery} />
            </View>
            {loading ? <View style={styles.centerContainer}>
                    <LogoLoader size={60} color="#EC4899" />
                </View> : <FlatList data={filteredNotices} keyExtractor={(item) => item.id} renderItem={renderItem} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} refreshing={loading} onRefresh={fetchNotices} ListEmptyComponent={<Text style={styles.emptyText}>No notices found</Text>} />}
            <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
                <Ionicons name="create" size={28} color="#fff" />
            </TouchableOpacity>
            <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Create Notice</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{
            paddingBottom: 20
          }}>
                            <Text style={styles.label}>Title</Text>
                            <TextInput style={styles.input} placeholder="Notice Title" value={title} onChangeText={setTitle} />
                            <Text style={styles.label}>Content</Text>
                            <TextInput style={[styles.input, styles.textArea]} placeholder="Notice Details..." value={content} onChangeText={setContent} multiline numberOfLines={4} textAlignVertical="top" />
                            <Text style={styles.label}>Audience</Text>
                            <View style={styles.pillContainer}>
                                {['all', 'students', 'staff', 'parents', 'class'].map((a) => {
                return <TouchableOpacity key={a} style={[styles.pill, audience === a && styles.activePill]} onPress={() => setAudience(a as any)}>
                                        <Text style={[styles.pillText, audience === a && styles.activePillText]}>
                                            {a.charAt(0).toUpperCase() + a.slice(1)}
                                        </Text>
                                    </TouchableOpacity>;
              })}
                            </View>
                            {audience === 'class' && <View style={{
              marginTop: 10
            }}>
                                    <Text style={styles.label}>Select Class</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{
                marginBottom: 10
              }}>
                                        {classes.map((c) => {
                  return <TouchableOpacity key={c.id} style={[styles.pill, targetClassId === c.id && styles.activePill]} onPress={() => setTargetClassId(c.id)}>
                                                <Text style={[styles.pillText, targetClassId === c.id && styles.activePillText]}>
                                                    {c.name}
                                                </Text>
                                            </TouchableOpacity>;
                })}
                                    </ScrollView>
                                </View>}
                            <Text style={styles.label}>Priority</Text>
                            <View style={styles.pillContainer}>
                                {['low', 'medium', 'high'].map((p) => {
                return <TouchableOpacity key={p} style={[styles.pill, priority === p && styles.activePill]} onPress={() => setPriority(p)}>
                                        <Text style={[styles.pillText, priority === p && styles.activePillText]}>
                                            {p.charAt(0).toUpperCase() + p.slice(1)}
                                        </Text>
                                    </TouchableOpacity>;
              })}
                            </View>
                            <View style={styles.rowBetween}>
                                <Text style={styles.label}>Pin to Top</Text>
                                <Switch value={isPinned} onValueChange={setIsPinned} trackColor={{
                false: "#767577",
                true: "#EC4899"
              }} thumbColor={isPinned ? "#fff" : "#f4f3f4"} />
                            </View>
                            <TouchableOpacity style={[styles.createBtn, creating && styles.disabledBtn]} onPress={handleCreate} disabled={creating}>
                                {creating ? <LogoLoader color="#fff" /> : <Text style={styles.createBtnText}>Publish Notice</Text>}
                            </TouchableOpacity>
                        </ScrollView>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 15,
    borderRadius: 12,
    height: 50,
    shadowColor: theme.colors.text,
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2
  },
  searchIcon: {
    marginRight: 10
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937'
  },
  listContent: {
    padding: 20,
    paddingBottom: 80
  },
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    padding: 15,
    marginBottom: 15,
    shadowColor: theme.colors.text,
    shadowOffset: {
      width: 0,
      height: 1
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
    marginRight: 10
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700'
  },
  content: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 12,
    lineHeight: 20
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  audienceRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  audienceText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginLeft: 4,
    fontWeight: '500'
  },
  dateText: {
    fontSize: 12,
    color: theme.colors.textTertiary
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EC4899',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#EC4899",
    shadowOffset: {
      width: 0,
      height: 4
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    color: theme.colors.textTertiary,
    fontSize: 16
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
    elevation: 10
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937'
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 8
  },
  input: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#1F2937'
  },
  textArea: {
    height: 100
  },
  pillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  activePill: {
    backgroundColor: '#EC4899',
    borderColor: '#EC4899'
  },
  pillText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500'
  },
  activePillText: {
    color: theme.colors.background
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20
  },
  createBtn: {
    backgroundColor: '#EC4899',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10
  },
  createBtnText: {
    color: theme.colors.background,
    fontWeight: 'bold',
    fontSize: 16
  },
  disabledBtn: {
    opacity: 0.7
  }
});