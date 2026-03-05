import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Dimensions, StatusBar } from 'react-native';
import AdminHeader from '../../src/components/AdminHeader';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useAnalytics, TimeRange } from '../../src/hooks/useAnalytics';
import { LineChart, BarChart } from 'react-native-gifted-charts';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';
const {
  width
} = Dimensions.get('window');
const KPICard = ({
  title,
  value,
  subtext,
  icon,
  color,
  delay
}: any) => {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  return <Animated.View entering={FadeInDown.delay(delay).duration(500)} style={styles.kpiCard}>
        <View style={[styles.iconBox, {
      backgroundColor: color + '20'
    }]}>
            <Ionicons name={icon} size={22} color={color} />
        </View>
        <View style={styles.kpiContent}>
            <Text style={styles.kpiLabel}>{title}</Text>
            <Text style={styles.kpiValue}>{value}</Text>
            {subtext && <Text style={[styles.kpiSub, {
        color: color
      }]}>{subtext}</Text>}
        </View>
    </Animated.View>;
};
const InsightItem = ({
  insight,
  index
}: any) => {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  return <Animated.View entering={FadeInDown.delay(600 + index * 100)} style={[styles.insightRow, insight.severity === 'high' && styles.insightHigh]}>
        <MaterialIcons name={insight.severity === 'high' ? "error-outline" : "info-outline"} size={20} color={insight.severity === 'high' ? "#EF4444" : "#3B82F6"} />
        <Text style={styles.insightText}>{insight.message}</Text>
    </Animated.View>;
};
export default function AdminReports() {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const {
    financials,
    attendance,
    insights,
    loading,
    range,
    setRange,
    refreshData
  } = useAnalytics();

  // Chart Data Preparation
  const lineData = financials?.trend?.map(t => ({
    value: t.value,
    label: t.label
  })) || [];
  const attendanceData = attendance?.trend?.map(t => ({
    value: t.value,
    label: t.label
  })) || [];
  return <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />
            <AdminHeader title="Analytics Cockpit" showBackButton={true} />

            {/* TIME RANGE SELECTOR */}
            <View style={styles.filterRow}>
                {(['month', 'quarter', 'year'] as TimeRange[]).map(r => {
return <TouchableOpacity key={r} style={[styles.filterBtn, range === r && styles.filterBtnActive]} onPress={() => setRange(r)}>
                        <Text style={[styles.filterText, range === r && styles.filterTextActive]}>
                            {r === 'month' ? 'This Month' : r === 'quarter' ? 'This Quarter' : 'Year To Date'}
                        </Text>
                    </TouchableOpacity>;
      })}
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshData}  tintColor="transparent" colors={['transparent']} progressBackgroundColor="transparent" />}>
                {loading && (
                    <View style={{ width: '100%', alignItems: 'center', paddingVertical: 20 }}>
                        <LogoLoader size={30} />
                    </View>
                )}
                {/* 1. FINANCIALS SECTION */}
                <Text style={styles.sectionHeader}>Financial Health</Text>
                <View style={styles.kpiGrid}>
                    <KPICard title="Collected" value={financials ? `₹${(financials.total_collected / 1000).toFixed(1)}k` : '--'} subtext=" Revenue" icon="wallet-outline" color="#10B981" delay={100} />
                    <KPICard title="Outstanding" value={financials ? `₹${(financials.outstanding_dues / 1000).toFixed(1)}k` : '--'} subtext="Pending" icon="alert-circle-outline" color="#EF4444" delay={200} />
                    <KPICard title="Efficiency" value={financials ? `${financials.collection_efficiency}%` : '--'} subtext="Collection Rate" icon="trending-up-outline" color="#6366F1" delay={300} />
                </View>

                {/* FINANCIAL CHART */}
                <Animated.View entering={FadeInDown.delay(400)} style={styles.chartCard}>
                    <Text style={styles.chartTitle}>Revenue Trend ({range})</Text>
                    {loading ? <LogoLoader color="#6366F1" /> : <LineChart data={lineData} color="#6366F1" thickness={3} startFillColor="rgba(99, 102, 241, 0.3)" endFillColor="rgba(99, 102, 241, 0.01)" startOpacity={0.9} endOpacity={0.2} initialSpacing={10} noOfSections={4} yAxisTextStyle={{
          color: '#9CA3AF',
          fontSize: 10
        }} xAxisLabelTextStyle={{
          color: '#9CA3AF',
          fontSize: 10
        }} width={width - 80} height={180} hideDataPoints={false} curved isAnimated />}
                </Animated.View>

                {/* 2. ATTENDANCE SECTION */}
                <Text style={styles.sectionHeader}>Attendance & Engagement</Text>
                <View style={styles.kpiGrid}>
                    <KPICard title="Avg Attendance" value={attendance ? `${attendance.avg_attendance}%` : '--'} subtext="Student Presence" icon="people-outline" color="#3B82F6" delay={500} />
                    <KPICard title="Chronic Absent" value={attendance ? attendance.chronic_absentees : '--'} subtext="At Risk Students" icon="warning-outline" color="#F59E0B" delay={600} />
                </View>

                {/* ATTENDANCE CHART */}
                <Animated.View entering={FadeInDown.delay(700)} style={styles.chartCard}>
                    <Text style={styles.chartTitle}>Attendance Volatility</Text>
                    {loading ? <LogoLoader color="#3B82F6" /> : <BarChart data={attendanceData} barWidth={22} barBorderRadius={4} frontColor="#3B82F6" yAxisTextStyle={{
          color: '#9CA3AF',
          fontSize: 10
        }} xAxisLabelTextStyle={{
          color: '#9CA3AF',
          fontSize: 10
        }} width={width - 80} height={180} noOfSections={3} maxValue={100} />}
                </Animated.View>

                {/* 3. AI INSIGHTS */}
                <Text style={styles.sectionHeader}>AI Anomalies & Insights</Text>
                <View style={[styles.chartCard, {
        padding: 10
      }]}>
                    {insights.length === 0 ? <Text style={styles.emptyText}>No anomalies detected in this period.</Text> : insights.map((ins, i) => <InsightItem key={i} insight={ins} index={i} />)}
                </View>

                <View style={{
        height: 40
      }} />
            </ScrollView>
        </View>;
}
const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.card
  },
  scrollContent: {
    padding: 16
  },
  // Filter Row
  filterRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    padding: 4,
    margin: 16,
    borderRadius: 12,
    elevation: 1
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8
  },
  filterBtnActive: {
    backgroundColor: '#EEF2FF'
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary
  },
  filterTextActive: {
    color: '#6366F1'
  },
  // KPIs
  sectionHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    marginTop: 8
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  kpiCard: {
    width: '31%',
    // Fits 3 in a row logic if adjusted, here 2 rows likely or wrap
    minWidth: '48%',
    // Fallback 2 per row
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: theme.colors.text,
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.05,
    shadowRadius: 4
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8
  },
  kpiContent: {},
  kpiLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 2
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827'
  },
  kpiSub: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2
  },
  // Charts
  chartCard: {
    backgroundColor: theme.colors.background,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: theme.colors.text,
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    alignItems: 'center',
    // Center chart
    overflow: 'hidden'
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
    alignSelf: 'flex-start',
    paddingLeft: 4
  },
  // Insights
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8
  },
  insightHigh: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444'
  },
  insightText: {
    marginLeft: 10,
    fontSize: 13,
    color: '#374151',
    flex: 1
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textTertiary,
    padding: 20
  }
});