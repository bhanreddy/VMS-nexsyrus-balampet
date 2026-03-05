import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, FlatList, Alert, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import AdminHeader from '../../src/components/AdminHeader';
import { ADMIN_THEME } from '../../src/constants/adminTheme';
import { ClassService, ClassInfo, Section, AcademicYear } from '../../src/services/classService';
import { ResultService, Subject } from '../../src/services/commonServices';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';
type TabType = 'classes' | 'sections' | 'years' | 'subjects' | 'mappings';
export default function AcademicManagement() {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const [activeTab, setActiveTab] = useState<TabType>('classes');
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [mappings, setMappings] = useState<any[]>([]);

  // Form states
  const [newItemName, setNewItemName] = useState('');
  const [newItemCode, setNewItemCode] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Mapping Form
  const [selClassId, setSelClassId] = useState('');
  const [selSectionId, setSelSectionId] = useState('');
  const [selYearId, setSelYearId] = useState('');
  useEffect(() => {
    fetchData();
  }, [activeTab]);
  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'classes') {
        const data = await ClassService.getClasses();
        setClasses(data);
      } else if (activeTab === 'sections') {
        const data = await ClassService.getSections();
        setSections(data);
      } else if (activeTab === 'years') {
        const data = await ClassService.getAcademicYears();
        setYears(data);
      } else if (activeTab === 'subjects') {
        const data = await ResultService.getSubjects();
        setSubjects(data);
      } else if (activeTab === 'mappings') {
        // We need metadata for the form too
        const [m, c, s, y] = await Promise.all([ClassService.getClassSections(), ClassService.getClasses(), ClassService.getSections(), ClassService.getAcademicYears()]);
        setMappings(m);
        setClasses(c);
        setSections(s);
        setYears(y);
        // Default year
        const current = y.find((yr) => new Date(yr.start_date) <= new Date() && new Date(yr.end_date) >= new Date());
        if (current) setSelYearId(current.id);
      }
    } catch (error) {

      Alert.alert('Error', 'Failed to load academic data');
    } finally {
      setLoading(false);
    }
  };
  const handleAdd = async () => {
    if (!newItemName.trim() && activeTab !== 'years' && activeTab !== 'mappings') return;
    if (activeTab === 'years' && !newItemCode.trim()) return;
    try {
      if (activeTab === 'classes') {
        await ClassService.createClass({
          name: newItemName,
          code: newItemCode
        });
      } else if (activeTab === 'sections') {
        await ClassService.createSection({
          name: newItemName,
          code: newItemCode
        });
      } else if (activeTab === 'years') {
        await ClassService.createAcademicYear({
          code: newItemCode,
          start_date: startDate,
          end_date: endDate
        });
      } else if (activeTab === 'subjects') {
        await ResultService.createSubject({
          name: newItemName,
          code: newItemCode
        });
      } else if (activeTab === 'mappings') {
        if (!selClassId || !selSectionId || !selYearId) {
          Alert.alert('Error', 'Please select Class, Section and Academic Year');
          return;
        }
        await ClassService.createClassSection({
          class_id: selClassId,
          section_id: selSectionId,
          academic_year_id: selYearId
        });
      }
      Alert.alert('Success', `${activeTab.slice(0, -1)} created successfully`);
      setModalVisible(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create item');
    }
  };
  const resetForm = () => {
    setNewItemName('');
    setNewItemCode('');
    setStartDate('');
    setEndDate('');
  };
  const renderHeader = () => {
    return <View style={styles.tabContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {(['classes', 'sections', 'years', 'subjects', 'mappings'] as TabType[]).map((tab) => {
          return <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={[styles.tab, activeTab === tab && styles.activeTab, {
            minWidth: 100
          }]}>
                        <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </Text>
                    </TouchableOpacity>;
        })}
            </ScrollView>
        </View>;
  };
  const handleDelete = async (id: string, name: string) => {
    Alert.alert('Confirm Delete', `Are you sure you want to delete ${activeTab.slice(0, -1)} "${name}"? This action cannot be undone and will fail if there are linked dependencies.`, [{
      text: 'Cancel',
      style: 'cancel'
    }, {
      text: 'Delete',
      style: 'destructive',
      onPress: async () => {
        try {
          if (activeTab === 'classes') await ClassService.deleteClass(id);else if (activeTab === 'sections') await ClassService.deleteSection(id);else if (activeTab === 'years') await ClassService.deleteAcademicYear(id);else if (activeTab === 'subjects') await ResultService.deleteSubject(id);
          Alert.alert('Deleted', `${activeTab.slice(0, -1)} deleted successfully`);
          fetchData();
        } catch (error: any) {

        }
      }
    }]);
  };
  const renderItem = ({
    item,
    index

  }: {item: any;index: number;}) => {
    return <Animated.View entering={FadeInDown.delay(index * 50)} layout={Layout.springify()} style={styles.itemCard}>
            <View style={styles.itemInfo}>
                <Text style={styles.itemTitle}>{item.class_name ? `${item.class_name} - ${item.section_name}` : item.name || item.code}</Text>
                {item.code && item.name && <Text style={styles.itemSub}>{item.code}</Text>}
                {activeTab === 'mappings' && <Text style={styles.itemSub}>{item.academic_year}</Text>}
                {activeTab === 'years' && <Text style={styles.itemSub}>{item.start_date} to {item.end_date}</Text>}
            </View>
            <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id, item.name || item.code)}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
        </Animated.View>;
  };
  const handleOpenModal = () => {
    if (activeTab === 'years' && years.length > 0) {
      // Smart Pre-fill: Find latest end date and set next start date = end date + 1 day
      try {
        // strict sort by end_date descending
        const sorted = [...years].sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime());
        const latestEnd = new Date(sorted[0].end_date);

        // Next start = Latest End + 1 Day
        const nextStart = new Date(latestEnd);
        nextStart.setDate(nextStart.getDate() + 1);

        // Next End = Next Start + 1 Year - 1 Day (Standard Academic Year)
        const nextEnd = new Date(nextStart);
        nextEnd.setFullYear(nextEnd.getFullYear() + 1);
        nextEnd.setDate(nextEnd.getDate() - 1);
        setStartDate(nextStart.toISOString().split('T')[0]);
        setEndDate(nextEnd.toISOString().split('T')[0]);

        // Guess code
        const startYear = nextStart.getFullYear();
        const endYear = nextEnd.getFullYear();
        setNewItemCode(`${startYear}-${endYear}`);
      } catch (e) {

      }
    }
    setModalVisible(true);
  };
  return <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={ADMIN_THEME.colors.primary} />
            <AdminHeader title="Academic Structure" showBackButton />
            {renderHeader()}
            <View style={styles.content}>
                {loading ? <LogoLoader size={60} color={ADMIN_THEME.colors.primary} style={{
        marginTop: 50
      }} /> : <FlatList data={activeTab === 'classes' ? classes : activeTab === 'sections' ? sections : activeTab === 'years' ? years : activeTab === 'subjects' ? subjects : mappings} keyExtractor={(item) => item.id} renderItem={renderItem} contentContainerStyle={{
        paddingBottom: 100
      }} ListEmptyComponent={<Text style={styles.emptyText}>No {activeTab} found</Text>} />}
            </View>
            <TouchableOpacity style={styles.fab} onPress={handleOpenModal}>
                <LinearGradient colors={['#6366F1', '#4F46E5']} style={styles.fabGradient}>
                    <Ionicons name="add" size={30} color="#fff" />
                </LinearGradient>
            </TouchableOpacity>
            <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Add New {activeTab.slice(0, -1)}</Text>
                        {activeTab !== 'years' && activeTab !== 'mappings' && <TextInput style={styles.input} placeholder="Name (e.g. Class 10)" value={newItemName} onChangeText={setNewItemName} />}
                        {activeTab !== 'mappings' && <TextInput style={styles.input} placeholder={activeTab === 'years' ? "Code (e.g. 2023-24)" : "Code (optional)"} value={newItemCode} onChangeText={setNewItemCode} />}
                        {activeTab === 'years' && <>
                                <TextInput style={styles.input} placeholder="Start Date (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} />
                                <TextInput style={styles.input} placeholder="End Date (YYYY-MM-DD)" value={endDate} onChangeText={setEndDate} />
                            </>}
                        {activeTab === 'mappings' && <>
                                <Text style={{
              fontWeight: 'bold',
              marginBottom: 5
            }}>Class</Text>
                                <ScrollView horizontal style={{
              marginBottom: 10
            }}>
                                    {classes.map((c) => {
                return <TouchableOpacity key={c.id} onPress={() => setSelClassId(c.id)} style={[styles.tab, {
                  backgroundColor: selClassId === c.id ? '#6366F1' : '#ddd',
                  paddingHorizontal: 10,
                  marginRight: 5
                }]}>
                                            <Text style={{
                    color: selClassId === c.id ? '#fff' : '#000'
                  }}>{c.name}</Text>
                                        </TouchableOpacity>;
              })}
                                </ScrollView>
                                <Text style={{
              fontWeight: 'bold',
              marginBottom: 5
            }}>Section</Text>
                                <ScrollView horizontal style={{
              marginBottom: 10
            }}>
                                    {sections.map((s) => {
                return <TouchableOpacity key={s.id} onPress={() => setSelSectionId(s.id)} style={[styles.tab, {
                  backgroundColor: selSectionId === s.id ? '#6366F1' : '#ddd',
                  paddingHorizontal: 10,
                  marginRight: 5
                }]}>
                                            <Text style={{
                    color: selSectionId === s.id ? '#fff' : '#000'
                  }}>{s.name}</Text>
                                        </TouchableOpacity>;
              })}
                                </ScrollView>
                                <Text style={{
              fontWeight: 'bold',
              marginBottom: 5
            }}>Academic Year</Text>
                                <ScrollView horizontal style={{
              marginBottom: 10
            }}>
                                    {years.map((y) => {
                return <TouchableOpacity key={y.id} onPress={() => setSelYearId(y.id)} style={[styles.tab, {
                  backgroundColor: selYearId === y.id ? '#6366F1' : '#ddd',
                  paddingHorizontal: 10,
                  marginRight: 5
                }]}>
                                            <Text style={{
                    color: selYearId === y.id ? '#fff' : '#000'
                  }}>{y.code}</Text>
                                        </TouchableOpacity>;
              })}
                                </ScrollView>
                            </>}
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setModalVisible(false)}>
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleAdd}>
                                <Text style={styles.saveButtonText}>Save</Text>
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    padding: 4,
    margin: 16,
    borderRadius: 12,
    elevation: 2
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8
  },
  activeTab: {
    backgroundColor: '#6366F1'
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary
  },
  activeTabText: {
    color: theme.colors.background
  },
  content: {
    flex: 1,
    paddingHorizontal: 16
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    alignItems: 'center',
    elevation: 1
  },
  itemInfo: {
    flex: 1
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937'
  },
  itemSub: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2
  },
  deleteButton: {
    padding: 8
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: theme.colors.textTertiary
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    elevation: 5
  },
  fabGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderRadius: 24,
    padding: 24,
    elevation: 5
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 20
  },
  input: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 16
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  cancelButton: {
    backgroundColor: theme.colors.card
  },
  saveButton: {
    backgroundColor: '#6366F1'
  },
  cancelButtonText: {
    color: theme.colors.textSecondary,
    fontWeight: '600'
  },
  saveButtonText: {
    color: theme.colors.background,
    fontWeight: '600'
  }
});