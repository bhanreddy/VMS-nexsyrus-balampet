import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AdminHeader from '../../../src/components/AdminHeader';
import { useAuth } from '../../../src/hooks/useAuth';
import { FeeService as FeesService } from '../../../src/services/feeService';
import { useTheme } from '../../../src/hooks/useTheme';
import { generateReceiptPDF } from '../../../src/utils/pdfGenerator';
import LogoLoader from '../../../src/components/LogoLoader';
export const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

export default function CollectFeesScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { user } = useAuth();
    const { theme, isDark } = useTheme();
    const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
    const [loading, setLoading] = useState(false);

    // Params from list
    const feeId = params.feeId as string;
    const studentName = params.name as string;
    const admissionNo = params.admissionNo as string;
    const feeType = params.feeType as string;
    const dueAmount = params.due as string;

    const [amount, setAmount] = useState('');
    const [mode, setMode] = useState('Cash');
    const [remarks, setRemarks] = useState('');

    const handleCollect = async () => {
        const amountNum = parseFloat(amount);
        if (!amount || isNaN(amountNum) || amountNum <= 0) {
            Alert.alert("Invalid Amount", "Please enter a valid amount greater than zero.");
            return;
        }

        // Overpayment protection
        const dueNum = parseFloat(dueAmount);
        if (!isNaN(dueNum) && amountNum > dueNum) {
            Alert.alert("Overpayment", `Amount ₹${amountNum} exceeds due amount ₹${dueNum}. Please enter a valid amount.`);
            return;
        }

        // Max cap safety
        if (amountNum > 1000000) {
            Alert.alert("Invalid Amount", "Amount exceeds maximum limit of ₹10,00,000.");
            return;
        }

        if (!feeId) {
            Alert.alert("Error", "Fee record identifier is missing.");
            return;
        }

        // Financial Confirmation Flow
        Alert.alert(
            "Confirm Payment",
            `Are you sure you want to record a payment of ₹${amountNum} via ${mode}? This action is permanent and will be logged.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Confirm & Record",
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const result = await FeesService.collectFee({
                                student_fee_id: feeId,
                                amount: amountNum,
                                payment_method: mode.toLowerCase() as any,
                                transaction_ref: generateUUID(),
                                remarks
                            });

                            Alert.alert(
                                "Payment Successful",
                                `Receipt Reference: ${result.transaction_ref || result.id}\n\nThe ledger has been updated.`,
                                [
                                    {
                                        text: "Print Receipt",
                                        onPress: async () => {
                                            await generateReceiptPDF({
                                                ...result,
                                                student_name: studentName,
                                                admission_no: admissionNo,
                                                fee_type: feeType,
                                                paid_at: new Date().toISOString() // Current time since we just paid
                                            });
                                            router.back();
                                        }
                                    },
                                    { text: "Done", onPress: () => router.back() }
                                ]
                            );
                        } catch (error: any) {
                            Alert.alert(
                                "Financial Mutation Failed",
                                error.message || "The payment could not be processed. Please check backend logs."
                            );
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <AdminHeader title="Collect Fee" showBackButton={true} />
            <ScrollView contentContainerStyle={styles.content}>

                <View style={styles.infoCard}>
                    <Text style={styles.label}>Student Name</Text>
                    <Text style={styles.value}>{studentName || 'Unknown'}</Text>

                    <View style={styles.divider} />

                    <Text style={styles.label}>Due Amount</Text>
                    <Text style={[styles.value, { color: '#EF4444' }]}>₹{dueAmount || '0'}</Text>
                </View>

                <View style={styles.form}>
                    <Text style={styles.sectionTitle}>Payment Details</Text>

                    <Text style={styles.inputLabel}>Amount (₹)</Text>
                    <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={amount}
                        onChangeText={setAmount}
                        placeholder="Enter amount"
                    />

                    <Text style={styles.inputLabel}>Payment Mode</Text>
                    <View style={styles.modeRow}>
                        {['Cash', 'UPI', 'Cheque'].map((m) => (
                            <TouchableOpacity
                                key={m}
                                style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
                                onPress={() => setMode(m)}
                            >
                                <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>{m}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.inputLabel}>Remarks (Optional)</Text>
                    <TextInput
                        style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                        multiline
                        value={remarks}
                        onChangeText={setRemarks}
                        placeholder="e.g. Receipt No. 1234"
                    />

                    <TouchableOpacity
                        style={styles.payBtn}
                        onPress={handleCollect}
                        disabled={loading}
                    >
                        {loading ? <LogoLoader color="#fff" /> : (
                            <Text style={styles.payBtnText}>Collect Payment</Text>
                        )}
                    </TouchableOpacity>

                </View>
            </ScrollView>
        </View>
    );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    content: {
        padding: 20,
    },
    infoCard: {
        backgroundColor: theme.colors.card,
        padding: 20,
        borderRadius: 16,
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    label: {
        fontSize: 13,
        color: theme.colors.textSecondary,
        marginBottom: 4,
    },
    value: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    divider: {
        height: 1,
        backgroundColor: theme.colors.border,
        marginVertical: 15,
    },
    form: {
        backgroundColor: theme.colors.card,
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 20,
        color: theme.colors.text,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 8,
    },
    input: {
        backgroundColor: isDark ? theme.colors.background : '#F9FAFB',
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 10,
        padding: 12,
        fontSize: 16,
        color: theme.colors.text,
        marginBottom: 20,
    },
    modeRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 20,
    },
    modeBtn: {
        flex: 1,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 8,
        alignItems: 'center',
        backgroundColor: theme.colors.card,
    },
    modeBtnActive: {
        backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF',
        borderColor: '#3B82F6',
    },
    modeText: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        fontWeight: '500',
    },
    modeTextActive: {
        color: '#3B82F6',
        fontWeight: '700',
    },
    payBtn: {
        backgroundColor: '#10B981',
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
    },
    payBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
