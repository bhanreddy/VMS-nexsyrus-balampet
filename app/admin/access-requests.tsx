import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AdminHeader from '../../src/components/AdminHeader';
import { ADMIN_THEME } from '../../src/constants/adminTheme';
import { AccessControlService, AccessRequest } from '../../src/services/accessControlService';
import { useAuth } from '../../src/hooks/useAuth';
import PremiumButton from '../../src/components/PremiumButton';
import { supabase } from '../../src/services/supabaseConfig';
import Animated, { FadeInUp } from 'react-native-reanimated';

export default function AccessRequestsScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { user } = useAuth();
    const [requests, setRequests] = useState<AccessRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const loadRequests = async () => {
        setLoading(true);
        try {
            const data = await AccessControlService.getPendingRequests();
            setRequests(data);
        } catch (error) {
            console.error('Failed to load requests:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRequests();

        // Subscribe to real-time updates for new requests
        const channel = supabase
            .channel('access_requests_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'access_requests' }, payload => {
                loadRequests(); // Reload to get fresh joined data
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleGrant = async (request: AccessRequest) => {
        if (!user) return;
        setProcessingId(request.id);
        try {
            await AccessControlService.grantAccess(user.id, request.id);
            Alert.alert('Success', 'Access granted until 11:59 PM tonight');
            setRequests(prev => prev.filter(r => r.id !== request.id));
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to grant access');
        } finally {
            setProcessingId(null);
        }
    };

    const handleDeny = async (request: AccessRequest) => {
        if (!user) return;
        setProcessingId(request.id);
        try {
            await AccessControlService.denyRequest(user.id, request.id);
            Alert.alert('Request Denied', 'The request has been dismissed.');
            setRequests(prev => prev.filter(r => r.id !== request.id));
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to deny request');
        } finally {
            setProcessingId(null);
        }
    };

    const renderItem = ({ item, index }: { item: AccessRequest, index: number }) => {
        const date = new Date(item.created_at);
        const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return (
            <Animated.View entering={FadeInUp.delay(index * 100).springify().damping(15)}>
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.userInfo}>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>{item.user?.display_name?.charAt(0) || 'A'}</Text>
                            </View>
                            <View>
                                <Text style={styles.userName}>{item.user?.display_name || 'Unknown User'}</Text>
                                <Text style={styles.timestamp}>{formattedDate}</Text>
                            </View>
                        </View>
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{item.department.toUpperCase()}</Text>
                        </View>
                    </View>

                    {item.request_note && (
                        <View style={styles.reasonBox}>
                            <Text style={styles.reasonLabel}>Reason for access:</Text>
                            <Text style={styles.reasonText}>{item.request_note}</Text>
                        </View>
                    )}

                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={[styles.outlineBtn, processingId === item.id && { opacity: 0.5 }]}
                            onPress={() => handleDeny(item)}
                            disabled={processingId === item.id}
                        >
                            <Text style={styles.outlineBtnText}>Deny</Text>
                        </TouchableOpacity>
                        <PremiumButton
                            title="Grant Access"
                            onPress={() => handleGrant(item)}
                            loading={processingId === item.id}
                            colors={['#10B981', '#059669']}
                            style={{ flex: 1, marginLeft: 12 }}
                            icon={<Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{ marginLeft: 8 }} />}
                        />
                    </View>
                </View>
            </Animated.View>
        );
    };

    return (
        <View style={styles.container}>
            <AdminHeader title="Access Requests" showBackButton />

            <FlatList
                data={requests}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="shield-checkmark-outline" size={64} color={ADMIN_THEME.colors.border} />
                            <Text style={styles.emptyTitle}>No pending requests</Text>
                            <Text style={styles.emptyDesc}>All out-of-hours access requests are currently resolved.</Text>
                        </View>
                    ) : null
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: ADMIN_THEME.colors.background.surface,
    },
    listContent: {
        padding: 16,
        paddingBottom: 40,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3,
        borderWidth: 1,
        borderColor: ADMIN_THEME.colors.border,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#4F46E5',
    },
    userName: {
        fontSize: 16,
        fontWeight: '700',
        color: ADMIN_THEME.colors.text.primary,
        marginBottom: 2,
    },
    timestamp: {
        fontSize: 12,
        color: ADMIN_THEME.colors.text.secondary,
    },
    badge: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#D97706',
    },
    reasonBox: {
        backgroundColor: ADMIN_THEME.colors.background.subtle,
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    reasonLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: ADMIN_THEME.colors.text.secondary,
        marginBottom: 4,
    },
    reasonText: {
        fontSize: 14,
        color: ADMIN_THEME.colors.text.primary,
        fontStyle: 'italic',
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    outlineBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#EF4444',
        alignItems: 'center',
        justifyContent: 'center',
    },
    outlineBtnText: {
        color: '#EF4444',
        fontSize: 15,
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: ADMIN_THEME.colors.text.primary,
        marginTop: 16,
        marginBottom: 8,
    },
    emptyDesc: {
        fontSize: 14,
        color: ADMIN_THEME.colors.text.secondary,
        textAlign: 'center',
        maxWidth: '80%',
    },
});
