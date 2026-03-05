import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Alert } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AdminHeader from '../../src/components/AdminHeader';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { TransportService, BusItem } from '../../src/services/commonServices';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';
export default function AdminTransport() {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const [transportData, setTransportData] = useState<BusItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchTransportData();
  }, []);
  const fetchTransportData = async () => {
    try {
      setLoading(true);
      const data = await TransportService.getAllBuses();
      setTransportData(data);
    } catch (error) {

      Alert.alert('Error', 'Failed to load transport data');
    } finally {
      setLoading(false);
    }
  };
  const renderItem = ({
    item,
    index

  }: {item: BusItem;index: number;}) => {
    return <Animated.View entering={FadeInDown.delay(index * 100).duration(500)}>
            <TouchableOpacity style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.routeContainer}>
                        <View style={styles.iconBox}>
                            <Ionicons name="bus" size={24} color="#fff" />
                        </View>
                        <View>
                            <Text style={styles.routeTitle}>{item.route_name || 'Unassigned'}</Text>
                            <Text style={styles.vehicleText}>{item.bus_no}</Text>
                        </View>
                    </View>
                    <View style={[styles.statusBadge, item.is_active ? styles.statusOnTime : styles.statusDelayed]}>
                        <Text style={[styles.statusText, item.is_active ? {
              color: '#065F46'
            } : {
              color: '#92400E'
            }]}>{item.is_active ? 'Active' : 'Inactive'}</Text>
                    </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.detailsContainer}>
                    <View style={styles.detailRow}>
                        <Ionicons name="person" size={16} color="#6B7280" style={styles.detailIcon} />
                        <Text style={styles.detailText}>{item.driver_name || 'No Driver'} ({item.registration_no})</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Ionicons name="people" size={16} color="#6B7280" style={styles.detailIcon} />
                        <Text style={styles.detailText}>Capacity: {item.capacity}</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.trackButton} onPress={() => Alert.alert('Live Track', `Tracking ${item.bus_no}...`)}>
                    <Text style={styles.trackButtonText}>Live Track</Text>
                    <MaterialIcons name="gps-fixed" size={16} color="#6366F1" />
                </TouchableOpacity>
            </TouchableOpacity>
        </Animated.View>;
  };
  return <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />
            <AdminHeader title="Transport" showBackButton={true} />
            {loading ? <View style={styles.centerContainer}>
                    <LogoLoader size={60} color="#6366F1" />
                </View> : <FlatList data={transportData} keyExtractor={(item) => item.id.toString()} renderItem={renderItem} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} refreshing={loading} onRefresh={fetchTransportData} ListEmptyComponent={<Text style={styles.emptyText}>No buses found</Text>} />}
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
    elevation: 1
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  iconBox: {
    width: 45,
    height: 45,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  routeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937'
  },
  vehicleText: {
    fontSize: 13,
    color: theme.colors.textSecondary
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20
  },
  statusOnTime: {
    backgroundColor: '#D1FAE5'
  },
  statusDelayed: {
    backgroundColor: '#FEF3C7'
  },
  statusArrived: {
    backgroundColor: '#DBEAFE'
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600'
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.card,
    marginBottom: 12
  },
  detailsContainer: {
    marginBottom: 15
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6
  },
  detailIcon: {
    marginRight: 8
  },
  detailText: {
    fontSize: 14,
    color: theme.colors.textSecondary
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C7D2FE'
  },
  trackButtonText: {
    color: '#6366F1',
    fontWeight: '600',
    marginRight: 8
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    color: theme.colors.textTertiary,
    fontSize: 16
  }
});