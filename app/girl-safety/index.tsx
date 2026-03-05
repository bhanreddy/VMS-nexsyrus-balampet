import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { GirlSafetyService, GirlSafetyComplaint } from '../../src/services/girlSafetyService';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, withSequence, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function GirlSafetyTab() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [complaints, setComplaints] = useState<GirlSafetyComplaint[]>([]);
  const [loading, setLoading] = useState(true);

  // Animation values
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(1);
  const slideIn = useSharedValue(50);
  const fadeFade = useSharedValue(0);

  useFocusEffect(
    React.useCallback(() => {
      fetchComplaints();
      // Start Entry Animation
      slideIn.value = withSpring(0, { damping: 15 });
      fadeFade.value = withTiming(1, { duration: 600 });
      return () => {
        slideIn.value = 50;
        fadeFade.value = 0;
      };
    }, [])
  );

  useEffect(() => {
    // Continuous Pulse Animation for the shield/call button
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const data = await GirlSafetyService.getComplaints();
      setComplaints(data);
    } catch (error) {

    } finally {
      setLoading(false);
    }
  };

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value
  }));

  const entryStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideIn.value }],
    opacity: fadeFade.value
  }));

  if (user?.gender !== 'Female') {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
                <View style={styles.noAccessCard}>
                    <View style={styles.noAccessIconContainer}>
                        <Ionicons name="lock-closed" size={48} color="#EF4444" />
                    </View>
                    <Text style={styles.noAccessTitle}>Access Restricted</Text>
                    <Text style={styles.noAccessText}>
                        The Girl Safety feature is strictly reserved for female students. This space is maintained to provide confidential support and assistance exclusively to girls.
                    </Text>
                    <TouchableOpacity
            style={styles.goBackButton}
            onPress={() => router.back()}>

                        <Text style={styles.goBackText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </View>);

  }

  const handleCallHelpline = () => {
    // Example National Women Helpline
    Linking.openURL(Platform.OS === 'android' ? 'tel:1091' : 'telprompt:1091');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':return '#F59E0B'; // Amber
      case 'in_review':return '#3B82F6'; // Blue
      case 'resolved':return '#10B981'; // Green
      default:return '#6B7280'; // Gray
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':return 'Pending';
      case 'in_review':return 'In Review';
      case 'resolved':return 'Resolved';
      default:return status;
    }
  };

  const renderItem = ({ item }: {item: GirlSafetyComplaint;}) =>
  <TouchableOpacity
    style={styles.card}
    activeOpacity={0.7}
    onPress={() => router.push(`/girl-safety/${item.id}` as any)}>

            <View style={styles.cardHeader}>
                <Text style={styles.category}>{item.category}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{getStatusText(item.status)}</Text>
                </View>
            </View>
            <Text style={styles.ticketNo}>Ticket: {item.ticket_no}</Text>
            <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            {item.is_anonymous &&
    <View style={styles.anonBadge}>
                    <Ionicons name="eye-off-outline" size={12} color="#7C3AED" />
                    <Text style={styles.anonText}>Anonymous</Text>
                </View>
    }
        </TouchableOpacity>;

  return (
    <View style={styles.container}>
            {/* Soft, calming header gradient */}
            <LinearGradient
        colors={['#EDE9FE', '#F3E8FF', '#FFFFFF']}
        style={[styles.headerGradient, { paddingTop: insets.top + 20 }]}>

                <View style={styles.headerTop}>
                    <View>
                        <Text style={styles.title}>Girl Safety</Text>
                        <Text style={styles.subtitle}>Confidential Support & Assistance</Text>
                    </View>
                    <Animated.View style={[pulseStyle]}>
                        <TouchableOpacity style={styles.sosButton} onPress={handleCallHelpline}>
                            <Ionicons name="call" size={20} color="#FFFFFF" />
                            <Text style={styles.sosText}>SOS</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
                <Animated.View style={[styles.banner, entryStyle]}>
                    <Ionicons name="shield-checkmark" size={24} color="#7C3AED" />
                    <Text style={styles.bannerText}>
                        Your safety is our priority. All complaints are highly confidential and routed directly to a trusted Lady Admin.
                    </Text>
                </Animated.View>
            </LinearGradient>
            <View style={styles.content}>
                <View style={styles.listHeader}>
                    <Text style={styles.listTitle}>Past Reports</Text>
                </View>
                <FlatList
          data={complaints}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={fetchComplaints}
          ListEmptyComponent={
          !loading ?
          <View style={styles.emptyState}>
                                <Ionicons name="leaf-outline" size={48} color="#C4B5FD" />
                                <Text style={styles.emptyTitle}>You have no reports</Text>
                                <Text style={styles.emptySubtitle}>If you feel unsafe or have been harassed, do not hesitate to reach out. We are here to help.</Text>
                            </View> :
          null
          } />

            </View>
            {/* Raise Complaint Button */}
            <Animated.View style={[styles.fabContainer, entryStyle]}>
                <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.8}
          onPress={() => router.push('/girl-safety/raise' as any)}>

                    <LinearGradient
            colors={['#8B5CF6', '#6D28D9']}
            style={styles.fabGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}>

                        <Ionicons name="add" size={24} color="#FFF" />
                        <Text style={styles.fabText}>Raise a Complaint</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </Animated.View>
        </View>);

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    zIndex: 10
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#4C1D95',
    letterSpacing: -0.5
  },
  subtitle: {
    fontSize: 14,
    color: '#6D28D9',
    opacity: 0.8,
    marginTop: 4
  },
  sosButton: {
    flexDirection: 'row',
    backgroundColor: '#EF4444',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  sosText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14
  },
  banner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.1)'
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    color: '#4C1D95',
    lineHeight: 18
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20
  },
  listHeader: {
    marginBottom: 16
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B'
  },
  listContent: {
    paddingBottom: 100 // Space for FAB
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  category: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155'
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  ticketNo: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 4
  },
  date: {
    fontSize: 12,
    color: '#94A3B8'
  },
  anonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    backgroundColor: '#F3E8FF',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  anonText: {
    fontSize: 11,
    color: '#7C3AED',
    fontWeight: '600'
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#475569',
    marginTop: 16
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 20
  },
  fabContainer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    alignItems: 'center'
  },
  fab: {
    width: '100%',
    shadowColor: '#6D28D9',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8
  },
  fabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 100,
    gap: 8
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700'
  },
  noAccessCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: '#FEE2E2'
  },
  noAccessIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24
  },
  noAccessTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 12,
    textAlign: 'center'
  },
  noAccessText: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32
  },
  goBackButton: {
    backgroundColor: '#1E293B',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 100,
    width: '100%'
  },
  goBackText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center'
  }
});