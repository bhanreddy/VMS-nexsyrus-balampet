import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import ScreenLayout from '../../src/components/ScreenLayout';
import StudentHeader from '../../src/components/StudentHeader';
import { useAuth } from '../../src/hooks/useAuth';
import { useTheme } from '../../src/hooks/useTheme';
const dcgdOptions = ['CSE Foundation', 'JEE Foundation', 'IPMAT Foundation', 'NEET Foundation', 'Navodaya', 'Gurukula'];
const DCGDScreen = () => {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(), []);
  const {
    user
  } = useAuth();
  return <ScreenLayout>

            {/* ===== HEADER ===== */}
            <StudentHeader showBackButton={true} title="Discipline & Conduct" />

            {/* ===== CONTENT ===== */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>

                {/* TITLE */}
                <Text style={styles.pageTitle}>DCGD</Text>
                <Text style={styles.subtitle}>
                    Department of Career Growth and Development
                </Text>

                {/* STUDENT INFO CARD */}
                <View style={styles.studentCard}>
                    <View style={styles.avatar} />
                    <View>
                        <Text style={styles.infoText}>Name: {user?.name || 'Student'}</Text>
                        <Text style={styles.infoText}>Class/sec: {user?.classId || 'N/A'}</Text>
                        <Text style={styles.infoText}>Roll No: {user?.rollNo || 'N/A'}</Text>
                        <Text style={styles.infoText}>Admission No: {(user as any)?.admissionNo || 'N/A'}</Text>
                    </View>
                </View>

                {/* OPTIONS TITLE */}
                <Text style={styles.sectionTitle}>Options</Text>

                {/* OPTIONS LIST */}
                {dcgdOptions.map((option, index) => {
return <TouchableOpacity key={index} style={styles.optionCard} activeOpacity={0.85} onPress={() => {
          // TODO: navigate to option detail
        }}>
                        <Text style={styles.optionText}>{option}</Text>
                        <Text style={styles.arrow}>›</Text>
                    </TouchableOpacity>;
      })}

            </ScrollView>

        </ScreenLayout>;
};
export default DCGDScreen;

/* ============================ STYLES ============================ */

const getStyles = () => StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 30
  },
  /* Titles */
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
    marginBottom: 14
  },
  /* Student Info */
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d8ecef',
    padding: 14,
    borderRadius: 16,
    marginBottom: 18,
    elevation: 3
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#9ca3af',
    marginRight: 12
  },
  infoText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2
  },
  /* Section title */
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10
  },
  /* Option card */
  optionCard: {
    backgroundColor: '#cfe9ef',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    elevation: 2
  },
  optionText: {
    fontSize: 18,
    fontWeight: '700'
  },
  arrow: {
    fontSize: 22,
    fontWeight: '700',
    color: '#555'
  }
});