import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, TextInput, StatusBar, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AdminHeader from '../../src/components/AdminHeader';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { StaffService } from '../../src/services/staffService';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';
interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  designation: string;
  status: string;
  photo_url: string | null;
  phone: string;
}
export default function ManageStaff() {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const [searchQuery, setSearchQuery] = useState('');
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchStaff();
  }, []);
  const fetchStaff = async () => {
    try {
      setLoading(true);
      const data = await StaffService.getAll();

      // Map backend data to frontend model
      // The StaffService.getAll returns Staff[] which has the fields we need (joined).
      // But we might need to handle nulls.
      const mappedStaff: StaffMember[] = data.map((item) => ({
        id: item.id,
        first_name: item.first_name || '',
        last_name: item.last_name || '',
        display_name: item.display_name || (item.first_name || '') + ' ' + (item.last_name || ''),
        designation: item.designation_name || 'Staff',
        status: item.status_name || 'Present',
        // Default to present if null
        photo_url: item.photo_url || null,
        phone: item.phone || ''
        // But let's assume it's blank or we need a specific call. 
        // For list view, we might not have phone if it's not joined.
        // Leaving blank to avoid errors.
      }));
      setStaffList(mappedStaff);
    } catch (error) {

      Alert.alert('Error', 'Failed to load staff list');
    } finally {
      setLoading(false);
    }
  };
  const filteredStaff = staffList.filter((staff) => (staff.display_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || (staff.designation?.toLowerCase() || '').includes(searchQuery.toLowerCase()));
  const handleCall = (phone: string, name: string) => {
    if (!phone) {
      Alert.alert("No Phone", `No phone number available for ${name}`);
      return;
    }
    Alert.alert("Call Staff", `Calling ${name} at ${phone}...`);
    // Linking.openURL(`tel:${phone}`);
  };
  const handleDeleteVal = async (id: string, name: string) => {
    Alert.alert('Confirm Deletion', `Are you sure you want to delete staff member "${name}"? This action cannot be undone.`, [{
      text: 'Cancel',
      style: 'cancel'
    }, {
      text: 'Delete',
      style: 'destructive',
      onPress: async () => {
        try {
          setLoading(true);
          await StaffService.delete(id);
          Alert.alert('Success', 'Staff member deleted successfully');
          fetchStaff();
        } catch (error: any) {
          Alert.alert('Error', error.message || 'Failed to delete staff');
        } finally {
          setLoading(false);
        }
      }
    }]);
  };
  const renderItem = ({
    item,
    index

  }: {item: StaffMember;index: number;}) => {
    return <Animated.View entering={FadeInDown.delay(index * 50).duration(400)}>
            <TouchableOpacity style={styles.card}>
                <Image source={{
          uri: item.photo_url || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
        }} style={styles.avatar} />
                <View style={styles.info}>
                    <Text style={styles.name}>{item.display_name}</Text>
                    <Text style={styles.role}>{item.designation}</Text>
                    <View style={[styles.statusBadge, item.status === 'Present' ? styles.statusPresent : item.status === 'Leave' ? styles.statusLeave : styles.statusAbsent]}>
                        <Text style={[styles.statusText, item.status === 'Present' ? {
              color: '#065F46'
            } : item.status === 'Leave' ? {
              color: '#92400E'
            } : {
              color: '#991B1B'
            }]}>{item.status}</Text>
                    </View>
                </View>
                <View style={styles.actions}>
                    <TouchableOpacity style={[styles.actionButton, styles.callButton]} onPress={() => handleCall(item.phone, item.display_name)}>
                        <Ionicons name="call" size={18} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={() => handleDeleteVal(item.id, item.display_name)}>
                        <Ionicons name="trash" size={18} color="#fff" />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Animated.View>;
  };
  return <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />
            <AdminHeader title="Manage Staff" showBackButton={true} />
            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
                <TextInput style={styles.searchInput} placeholder="Search Staff..." value={searchQuery} onChangeText={setSearchQuery} />
            </View>
            {loading ? <View style={styles.centerContainer}>
                    <LogoLoader size={60} color="#6366F1" />
                </View> : <FlatList data={filteredStaff} keyExtractor={(item) => item.id} renderItem={renderItem} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} ListEmptyComponent={<Text style={styles.emptyText}>No staff found</Text>} refreshing={loading} onRefresh={fetchStaff} />}
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
    margin: 20,
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
    paddingHorizontal: 20,
    paddingBottom: 20
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: 15,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: theme.colors.text,
    shadowOffset: {
      width: 0,
      height: 1
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
    backgroundColor: theme.colors.card
  },
  info: {
    flex: 1
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937'
  },
  role: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start'
  },
  statusPresent: {
    backgroundColor: '#D1FAE5'
  },
  statusLeave: {
    backgroundColor: '#FEF3C7'
  },
  statusAbsent: {
    backgroundColor: '#FEE2E2'
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600'
  },
  actions: {
    flexDirection: 'row',
    gap: 8
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center'
  },
  callButton: {
    backgroundColor: '#6366F1'
  },
  deleteButton: {
    backgroundColor: '#EF4444'
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    color: theme.colors.textTertiary,
    fontSize: 16
  }
});