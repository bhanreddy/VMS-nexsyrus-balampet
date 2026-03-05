import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, TextInput, Alert } from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AdminHeader from '../../src/components/AdminHeader';
import { ADMIN_THEME } from '../../src/constants/adminTheme';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { AdminService, StudentRiskProfile, HeatmapData } from '../../src/services/adminService';
import { useTheme } from '../../src/hooks/useTheme';
import LogoLoader from '../../src/components/LogoLoader';
const {
  width
} = Dimensions.get('window');
type RiskLevel = 'SAFE' | 'WARNING' | 'CRITICAL';

// --- Helper Functions ---

const getRiskColor = (level: RiskLevel) => {
  switch (level) {
    case 'CRITICAL':
      return '#EF4444';
    case 'WARNING':
      return '#F59E0B';
    case 'SAFE':
      return '#10B981';
    default:
      return '#64748B';
  }
};

// --- Components ---

function TabButton({
  title,
  active,
  onPress

}: {title: string;active: boolean;onPress: () => void;}) {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(), []);
  return <TouchableOpacity onPress={onPress} style={[styles.tabBtn, active && styles.tabBtnActive]} activeOpacity={0.7}>
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{title}</Text>
        </TouchableOpacity>;
}
export default function SmartInsights() {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(), []);
  const [activeTab, setActiveTab] = useState<'RISK' | 'TALKING_POINTS' | 'HEATMAP'>('RISK');
  const [searchId, setSearchId] = useState('');
  const [generatedPoints, setGeneratedPoints] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [riskData, setRiskData] = useState<StudentRiskProfile[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  useEffect(() => {
    loadData();
  }, []);
  const loadData = async () => {
    setLoading(true);
    try {
      const [risk, heatmap] = await Promise.all([AdminService.getRiskProfiles(), AdminService.getAcademicHeatmap()]);
      setRiskData(risk);
      setHeatmapData(heatmap);
    } catch (error) {

      Alert.alert("Error", "Failed to load smart insights.");
    } finally {
      setLoading(false);
    }
  };

  // Filtered Risk Data
  const criticalStudents = useMemo(() => riskData.filter((s) => s.riskLevel === 'CRITICAL'), [riskData]);
  const warningStudents = useMemo(() => riskData.filter((s) => s.riskLevel === 'WARNING'), [riskData]);
  const safeStudents = useMemo(() => riskData.filter((s) => s.riskLevel === 'SAFE'), [riskData]);

  // Handlers
  const handleGeneratePoints = async () => {
    if (!searchId) {
      Alert.alert('Enter ID', 'Please enter a valid student ID (e.g. 103)');
      return;
    }
    setGenerating(true);
    try {
      const points = await AdminService.generateTalkingPoints(searchId);
      setGeneratedPoints(points);
    } catch (error) {
      Alert.alert('Not Found', 'Student ID not found or analysis failed.');
      setGeneratedPoints(null);
    } finally {
      setGenerating(false);
    }
  };

  // --- Render Sections ---

  const renderRiskDashboard = () => {
    return <Animated.View entering={FadeInDown.duration(400)}>
            {/* Overview Cards */}
            <View style={styles.riskOverview}>
                <View style={[styles.riskCard, {
          backgroundColor: '#FEF2F2',
          borderColor: '#FECACA',
          borderWidth: 1
        }]}>
                    <Text style={[styles.riskNum, {
            color: '#EF4444'
          }]}>{criticalStudents.length}</Text>
                    <Text style={styles.riskLabel}>Critical Risk</Text>
                </View>
                <View style={[styles.riskCard, {
          backgroundColor: '#FFFBEB',
          borderColor: '#FDE68A',
          borderWidth: 1
        }]}>
                    <Text style={[styles.riskNum, {
            color: '#F59E0B'
          }]}>{warningStudents.length}</Text>
                    <Text style={styles.riskLabel}>Warning Zone</Text>
                </View>
                <View style={[styles.riskCard, {
          backgroundColor: '#ECFDF5',
          borderColor: '#A7F3D0',
          borderWidth: 1
        }]}>
                    <Text style={[styles.riskNum, {
            color: '#10B981'
          }]}>{safeStudents.length}</Text>
                    <Text style={styles.riskLabel}>On Track</Text>
                </View>
            </View>
            <Text style={styles.sectionTitle}>Students Needing Attention</Text>
            {criticalStudents.length === 0 && warningStudents.length === 0 && <Text style={{
        textAlign: 'center',
        color: '#666',
        marginVertical: 20
      }}>No students in critical or warning zones.</Text>}
            {criticalStudents.map((student) => {
        return <TouchableOpacity key={student.id} style={styles.studentListCard}>
                    <View style={styles.studentListLeft}>
                        <View style={[styles.riskDot, {
              backgroundColor: getRiskColor(student.riskLevel)
            }]} />
                        <View>
                            <Text style={styles.stName}>{student.name}</Text>
                            <Text style={styles.stClass}>{student.class} • ID: {student.id}</Text>
                        </View>
                    </View>
                    <View style={styles.factorsContainer}>
                        {student.factors.map((f, idx) => {
              return <View key={idx} style={styles.factorBadge}>
                                <Text style={styles.factorText}>{f}</Text>
                            </View>;
            })}
                    </View>
                    <Feather name="chevron-right" size={20} color="#CBD5E1" />
                </TouchableOpacity>;
      })}
            {warningStudents.map((student) => {
        return <TouchableOpacity key={student.id} style={styles.studentListCard}>
                    <View style={styles.studentListLeft}>
                        <View style={[styles.riskDot, {
              backgroundColor: getRiskColor(student.riskLevel)
            }]} />
                        <View>
                            <Text style={styles.stName}>{student.name}</Text>
                            <Text style={styles.stClass}>{student.class} • ID: {student.id}</Text>
                        </View>
                    </View>
                    <View style={styles.factorsContainer}>
                        {student.factors.map((f, idx) => {
              return <View key={idx} style={styles.factorBadge}>
                                <Text style={styles.factorText}>{f}</Text>
                            </View>;
            })}
                    </View>
                    <Feather name="chevron-right" size={20} color="#CBD5E1" />
                </TouchableOpacity>;
      })}
        </Animated.View>;
  };
  const renderTalkingPoints = () => {
    return <Animated.View entering={FadeInRight.duration(400)}>
            <Text style={styles.helperText}>
                Identify key discussion points for parent meetings instantly.
            </Text>
            <View style={styles.searchBox}>
                <Ionicons name="search" size={20} color="#94A3B8" />
                <TextInput style={styles.searchInput} placeholder="Enter Student ID (e.g. 103)" placeholderTextColor="#94A3B8" value={searchId} onChangeText={setSearchId} />
                <TouchableOpacity style={styles.generateBtn} onPress={handleGeneratePoints} disabled={generating}>
                    {generating ? <LogoLoader size={30} color="#FFF" /> : <MaterialCommunityIcons name="magic-staff" size={20} color="#FFF" />}
                </TouchableOpacity>
            </View>
            {generatedPoints && <View style={styles.pointsResult}>
                    <Text style={styles.pointsTitle}>✨ AI Summary for Student {searchId}</Text>
                    {generatedPoints.map((point, i) => {
          return <View key={i} style={styles.pointRow}>
                            <Feather name="check-circle" size={18} color={ADMIN_THEME.colors.primary} style={{
              marginTop: 2
            }} />
                            <Text style={styles.pointText}>{point}</Text>
                        </View>;
        })}
                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.actionBtn}>
                            <Feather name="copy" size={16} color="#64748B" />
                            <Text style={styles.actionBtnText}>Copy</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn}>
                            <Feather name="printer" size={16} color="#64748B" />
                            <Text style={styles.actionBtnText}>Print Brief</Text>
                        </TouchableOpacity>
                    </View>
                </View>}
        </Animated.View>;
  };
  const renderHeatmap = () => {
    if (!heatmapData) return <Text>No Data</Text>;
    return <Animated.View entering={FadeInRight.duration(400)}>
                <Text style={styles.helperText}>
                    Compare section performance across subjects. Darker colors indicate lower performance.
                </Text>
                <View style={styles.heatmapGrid}>
                    {/* Header Row */}
                    <View style={styles.hmRow}>
                        <View style={[styles.hmCell, styles.hmHeaderCell]}>
                            <Text style={styles.hmHeaderText}>Class \ Sub</Text>
                        </View>
                        {heatmapData.subjects.map((sub, i) => {
            return <View key={i} style={[styles.hmCell, styles.hmHeaderCell]}>
                                <Text style={styles.hmHeaderText}>{sub.substring(0, 3)}</Text>
                            </View>;
          })}
                    </View>
                    {/* Data Rows */}
                    {heatmapData.classes.map((className, i) => {
          return <View key={i} style={styles.hmRow}>
                            <View style={[styles.hmCell, styles.hmLabelCell]}>
                                <Text style={styles.hmLabelText}>{className}</Text>
                            </View>
                            {heatmapData.subjects.map((sub, j) => {
              const val = heatmapData.data[className][sub];
              // Color logic: < 70 Red, 70-80 Yellow, > 80 Green
              let bg = '#ECFDF5'; // Green-50
              let text = '#065F46';
              if (val < 70) {
                bg = '#FEF2F2';
                text = '#991B1B';
              } // Red
              else if (val < 80) {
                bg = '#FFFBEB';
                text = '#92400E';
              } // Yellow

              return <View key={j} style={[styles.hmCell, {
                backgroundColor: bg
              }]}>
                                        <Text style={[styles.hmValueText, {
                  color: text
                }]}>{val}%</Text>
                                    </View>;
            })}
                        </View>;
        })}
                </View>
                <View style={styles.legend}>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendBox, {
            backgroundColor: '#ECFDF5',
            borderColor: '#10B981'
          }]} />
                        <Text style={styles.legendText}>&gt; 80% (Safe)</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendBox, {
            backgroundColor: '#FFFBEB',
            borderColor: '#F59E0B'
          }]} />
                        <Text style={styles.legendText}>70-80% (Avg)</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendBox, {
            backgroundColor: '#FEF2F2',
            borderColor: '#EF4444'
          }]} />
                        <Text style={styles.legendText}>&lt; 70% (Weak)</Text>
                    </View>
                </View>
            </Animated.View>;
  };
  if (loading) {
    return <View style={[styles.root, {
      justifyContent: 'center',
      alignItems: 'center'
    }]}>
                <LogoLoader size={60} color={ADMIN_THEME.colors.primary} />
            </View>;
  }
  return <View style={styles.root}>
            <LinearGradient colors={[ADMIN_THEME.colors.background.app, '#F8FAFC']} style={StyleSheet.absoluteFill} />
            <AdminHeader title="Smart Insights Beta" showBackButton />
            {/* Tabs */}
            <View style={styles.tabContainer}>
                <TabButton title="Risk Analysis" active={activeTab === 'RISK'} onPress={() => setActiveTab('RISK')} />
                <TabButton title="Talk Points" active={activeTab === 'TALKING_POINTS'} onPress={() => setActiveTab('TALKING_POINTS')} />
                <TabButton title="Heatmap" active={activeTab === 'HEATMAP'} onPress={() => setActiveTab('HEATMAP')} />
            </View>
            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.content}>
                    {activeTab === 'RISK' && renderRiskDashboard()}
                    {activeTab === 'TALKING_POINTS' && renderTalkingPoints()}
                    {activeTab === 'HEATMAP' && renderHeatmap()}
                </View>
            </ScrollView>
        </View>;
}
const getStyles = () => StyleSheet.create({
  root: {
    flex: 1
  },
  scroll: {
    paddingBottom: 40
  },
  content: {
    padding: 20
  },
  // Tabs
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 12,
    marginBottom: 10
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent'
  },
  tabBtnActive: {
    borderBottomColor: ADMIN_THEME.colors.primary
  },
  tabText: {
    fontWeight: '600',
    color: ADMIN_THEME.colors.text.secondary,
    fontSize: 13
  },
  tabTextActive: {
    color: ADMIN_THEME.colors.primary,
    fontWeight: '700'
  },
  // Risk
  riskOverview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12
  },
  riskCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center'
  },
  riskNum: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4
  },
  riskLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    textAlign: 'center'
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16
  },
  studentListCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...ADMIN_THEME.shadows.sm
  },
  studentListLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  riskDot: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  stName: {
    fontWeight: '700',
    color: '#1E293B',
    fontSize: 15
  },
  stClass: {
    fontSize: 12,
    color: '#64748B'
  },
  factorsContainer: {
    alignItems: 'flex-end',
    gap: 6
  },
  factorBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  factorText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '600'
  },
  // Talking Points
  helperText: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 16
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 24,
    ...ADMIN_THEME.shadows.sm
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#1E293B'
  },
  generateBtn: {
    backgroundColor: ADMIN_THEME.colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center'
  },
  pointsResult: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    ...ADMIN_THEME.shadows.sm
  },
  pointsTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 20,
    color: ADMIN_THEME.colors.primary
  },
  pointRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16
  },
  pointText: {
    fontSize: 15,
    color: '#334155',
    flex: 1,
    lineHeight: 22
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 16
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B'
  },
  // Heatmap
  heatmapGrid: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
    ...ADMIN_THEME.shadows.sm
  },
  hmRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  hmCell: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center'
  },
  hmHeaderCell: {
    backgroundColor: '#F8FAFC'
  },
  hmHeaderText: {
    fontWeight: '700',
    color: '#64748B',
    fontSize: 12
  },
  hmLabelCell: {
    backgroundColor: '#F8FAFC',
    borderRightWidth: 1,
    borderRightColor: '#F1F5F9',
    flex: 0.8 // label column slightly smaller
  },
  hmLabelText: {
    fontWeight: '700',
    color: '#334155',
    fontSize: 13
  },
  hmValueText: {
    fontWeight: '700',
    fontSize: 14
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 24
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  legendBox: {
    width: 12,
    height: 12,
    borderRadius: 4,
    borderWidth: 1
  },
  legendText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500'
  }
});