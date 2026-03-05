import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Alert, Switch, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { GirlSafetyService } from '../../src/services/girlSafetyService';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const CATEGORIES = [
    'Harassment',
    'Bullying',
    'Unsafe Environment',
    'Transport Safety',
    'Hostel Issue',
    'Other'
];

export default function RaiseComplaintScreen() {
    const router = useRouter();
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!category) {
            Alert.alert('Required', 'Please select a category');
            return;
        }
        if (!description.trim()) {
            Alert.alert('Required', 'Please describe the incident');
            return;
        }

        Alert.alert(
            'Confirm Submission',
            'Are you sure you want to submit this complaint? Your data is secure and will only be seen by authorized staff.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Submit',
                    style: 'default',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            await GirlSafetyService.raiseComplaint({
                                category,
                                description: description.trim(),
                                is_anonymous: isAnonymous
                            });
                            Alert.alert('Success', 'Your complaint has been submitted confidentially.', [
                                { text: 'OK', onPress: () => router.back() }
                            ]);
                        } catch (error: any) {
                            Alert.alert('Error', error?.message || 'Failed to submit complaint');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        >
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

                <View style={styles.infoBox}>
                    <Ionicons name="information-circle-outline" size={20} color="#4C1D95" />
                    <Text style={styles.infoText}>This form is strictly confidential. If you choose to submit anonymously, your name will not be shared with the authority resolving it.</Text>
                </View>

                <Text style={styles.label}>Category <Text style={styles.req}>*</Text></Text>
                <View style={styles.chipContainer}>
                    {CATEGORIES.map(cat => (
                        <TouchableOpacity
                            key={cat}
                            style={[styles.chip, category === cat && styles.chipActive]}
                            onPress={() => setCategory(cat)}
                        >
                            <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{cat}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={styles.label}>Description of the Incident <Text style={styles.req}>*</Text></Text>
                <TextInput
                    style={styles.textArea}
                    placeholder="Please provide details of what happened, where, and when..."
                    placeholderTextColor="#94A3B8"
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                    value={description}
                    onChangeText={setDescription}
                />

                {/* Simulated Photo attachment button since expo-image-picker isn't assumed available */}
                <TouchableOpacity style={styles.attachButton} activeOpacity={0.7}>
                    <Ionicons name="image-outline" size={20} color="#64748B" />
                    <Text style={styles.attachText}>Attach Photo Evidence (Optional)</Text>
                </TouchableOpacity>
                <Text style={styles.hintText}>Feature coming soon in next update</Text>

                <View style={styles.switchContainer}>
                    <View style={styles.switchTextContainer}>
                        <Text style={styles.switchLabel}>Submit Anonymously</Text>
                        <Text style={styles.switchDesc}>Hide my identity from the resolving authority</Text>
                    </View>
                    <Switch
                        value={isAnonymous}
                        onValueChange={setIsAnonymous}
                        trackColor={{ false: '#E2E8F0', true: '#C4B5FD' }}
                        thumbColor={isAnonymous ? '#7C3AED' : '#F8FAFC'}
                    />
                </View>

            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.submitBtnContainer}
                    disabled={loading}
                    onPress={handleSubmit}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={loading ? ['#9CA3AF', '#9CA3AF'] : ['#8B5CF6', '#6D28D9']}
                        style={styles.submitBtn}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <Text style={styles.submitBtnText}>Submit Complaint</Text>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAF9',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: '#F3E8FF',
        padding: 12,
        borderRadius: 12,
        marginBottom: 24,
        alignItems: 'flex-start',
        borderWidth: 1,
        borderColor: '#E9D5FF',
    },
    infoText: {
        flex: 1,
        marginLeft: 10,
        fontSize: 13,
        color: '#4C1D95',
        lineHeight: 18,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
        marginBottom: 10,
    },
    req: {
        color: '#EF4444',
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 24,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    chipActive: {
        backgroundColor: '#F3E8FF',
        borderColor: '#A78BFA',
    },
    chipText: {
        fontSize: 14,
        color: '#475569',
        fontWeight: '500',
    },
    chipTextActive: {
        color: '#6D28D9',
        fontWeight: '600',
    },
    textArea: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        padding: 16,
        fontSize: 15,
        color: '#0F172A',
        minHeight: 120,
        marginBottom: 20,
    },
    attachButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderStyle: 'dashed',
        justifyContent: 'center',
        gap: 8,
    },
    attachText: {
        color: '#64748B',
        fontSize: 15,
        fontWeight: '500',
    },
    hintText: {
        textAlign: 'center',
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 6,
        marginBottom: 24,
    },
    switchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    switchTextContainer: {
        flex: 1,
        paddingRight: 16,
    },
    switchLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
        marginBottom: 4,
    },
    switchDesc: {
        fontSize: 13,
        color: '#64748B',
    },
    footer: {
        padding: 20,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderColor: '#F1F5F9',
    },
    submitBtnContainer: {
        width: '100%',
    },
    submitBtn: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    }
});
