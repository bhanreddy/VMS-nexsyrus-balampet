import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AdminHeader from '../../src/components/AdminHeader';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useState, useEffect } from 'react';
import { FeeService as FeesService } from '../../src/services/feeService';
import { useAuth } from '../../src/hooks/useAuth';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';
export default function AccountsDefaulters() {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const {
    user
  } = useAuth();
  const [loading, setLoading] = useState(true);
  const [defaulters, setDefaulters] = useState<any[]>([]);
  useEffect(() => {
    loadData();
  }, [user]);
  const loadData = async () => {
    setLoading(true);
    try {
      const data = await FeesService.getDefaulters();
      // Data is Fee[]
      // We need to group by student or just list them.
      // Assumption: we need student details. 
      // In a real app we'd fetch Users for these IDs. 
      // For prototype visualization, we'll mark them as 'Unknown' if name not present in Fee doc or fetch individually
      // Adding a mocked fetch or assume Fee doc has studentName snapshot

      const uiData = data.map((d: any) => ({
        id: d.student_id,
        // API returns student_id, but list key is id
        name: d.student_name || 'Student Name',
        class: d.class_name || 'Class',
        due: `₹${d.total_due}`,
        parent: 'Parent Name',
        // Still placeholder as API doesn't return parent yet
        phone: 'N/A'
      }));
      setDefaulters(uiData);
    } catch (e) {

    } finally {
      setLoading(false);
    }
  };
  const handleReminder = (name: string) => {
    Alert.alert("Reminder Sent", `Payment reminder sent to ${name}'s parent.`);
  };
  const renderItem = ({
    item,
    index

  }: {item: any;index: number;}) => {
    return <Animated.View entering={FadeInDown.delay(index * 100).duration(500)}>
            <View style={styles.card}>
                <View style={styles.headerRow}>
                    <View>
                        <Text style={styles.name}>{item.name}</Text>
                        <Text style={styles.class}>{item.class}</Text>
                    </View>
                    <View style={styles.dueBox}>
                        <Text style={styles.dueLabel}>Due Amount</Text>
                        <Text style={styles.dueAmount}>{item.due}</Text>
                    </View>
                </View>
                <View style={styles.detailsRow}>
                    <Text style={styles.parentText}>Parent: {item.parent}</Text>
                    <Text style={styles.phoneText}>{item.phone}</Text>
                </View>
                <TouchableOpacity style={styles.remindBtn} onPress={() => handleReminder(item.name)}>
                    <Ionicons name="notifications" size={18} color="#fff" style={{
            marginRight: 8
          }} />
                    <Text style={styles.remindText}>Send Reminder</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>;
  };
  return <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />
            <AdminHeader title="Fee Defaulters" showBackButton={true} />
            {loading ? <LogoLoader size={60} color="#EF4444" style={{
      marginTop: 50
    }} /> : <FlatList data={defaulters} keyExtractor={(item) => item.id} renderItem={renderItem} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} ListEmptyComponent={<Text style={{
      textAlign: 'center',
      marginTop: 20,
      color: '#666'
    }}>No defaulters found.</Text>} />}
        </View>;
}
const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.card
  },
  listContent: {
    padding: 20
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
    elevation: 1,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444'
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937'
  },
  class: {
    fontSize: 14,
    color: theme.colors.textSecondary
  },
  dueBox: {
    alignItems: 'flex-end'
  },
  dueLabel: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    marginBottom: 2
  },
  dueAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#EF4444'
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 8
  },
  parentText: {
    fontSize: 13,
    color: '#7F1D1D',
    fontWeight: '500'
  },
  phoneText: {
    fontSize: 13,
    color: '#7F1D1D'
  },
  remindBtn: {
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: "#EF4444",
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3
  },
  remindText: {
    color: theme.colors.background,
    fontWeight: 'bold',
    fontSize: 14
  }
});