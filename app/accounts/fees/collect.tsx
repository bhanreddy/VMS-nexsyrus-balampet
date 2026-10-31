import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import AppTextInput from '@/src/components/AppTextInput';
import { styles as ds } from '@/src/theme/styles';

import {
    View, Text, StyleSheet, TouchableOpacity,
    Animated, Pressable, Platform, Share, ActivityIndicator, Modal, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import KeyboardAwareScreen from '@/components/keyboard/KeyboardAwareScreen';
import { alertCompat } from '../../../src/utils/crossPlatformAlert';
import { useLocalSearchParams, useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import AdminHeader from '../../../src/components/AdminHeader';
import { useAccountsWebChrome } from '../../../src/contexts/AccountsWebChromeContext';
import { FeeService as FeesService } from '../../../src/services/feeService';
import { DefaulterService, DefaulterYearBreakdown } from '../../../src/services/defaulterService';
import { UpiSettingsService } from '../../../src/services/upiSettingsService';
import { APIError } from '../../../src/services/apiClient';
import { useTheme } from '../../../src/hooks/useTheme';
import { generateReceiptPDF } from '../../../src/utils/pdfGenerator';
import { showConfirm, showSuccess, showError } from '../../../src/components/CustomAlert';
import { buildUpiPayUri, parseInrAmount } from '../../../src/utils/upiDeepLink';
import LogoLoader from '../../../src/components/LogoLoader';

export const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const IS_WEB = Platform.OS === 'web';
const webCursor = IS_WEB ? ({ cursor: 'pointer' } as const) : null;

const PAYMENT_MODES = [
    { id: 'Cash', label: 'Cash', hint: 'In hand', icon: 'cash' as const, color: '#059669', soft: '#ECFDF5', softDark: 'rgba(5,150,105,0.16)' },
    { id: 'UPI', label: 'UPI', hint: 'Show QR', icon: 'qr-code' as const, color: '#4F46E5', soft: '#EEF2FF', softDark: 'rgba(79,70,229,0.18)' },
    { id: 'Cheque', label: 'Cheque', hint: 'Bank slip', icon: 'reader-outline' as const, color: '#B45309', soft: '#FFFBEB', softDark: 'rgba(180,83,9,0.16)' },
];

function feeKindIcon(feeType?: string): React.ComponentProps<typeof Ionicons>['name'] {
    const label = (feeType || '').toLowerCase();
    if (/transport|bus/.test(label)) return 'bus';
    if (/book/.test(label)) return 'book';
    if (/tuition|academic/.test(label)) return 'school';
    if (/term|installment|instalment/.test(label)) return 'calendar';
    if (/exam/.test(label)) return 'document-text';
    if (/uniform|dress/.test(label)) return 'shirt';
    if (/lab|science/.test(label)) return 'flask';
    if (/hostel|boarding/.test(label)) return 'bed';
    return 'receipt';
}

function formatInr(n: number | string): string {
    const v = Number(n);
    if (!Number.isFinite(v)) return '₹0';
    const hasPaise = Math.round(v * 100) % 100 !== 0;
    return `₹${v.toLocaleString('en-IN', {
        minimumFractionDigits: hasPaise ? 2 : 0,
        maximumFractionDigits: 2,
    })}`;
}

// ─── Animated Mode Button ────────────────────────────────────────────────────
function ModeButton({
    item, selected, onPress, isDark
}: {
    item: typeof PAYMENT_MODES[0];
    selected: boolean;
    onPress: () => void;
    theme?: any;
    isDark: boolean;
}) {
    const scale = useRef(new Animated.Value(1)).current;
    const handlePressIn = () => Animated.spring(scale, { toValue: 0.93, useNativeDriver: true }).start();
    const handlePressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

    return (
        <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
            <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                style={[
                    modeStyles.btn,
                    {
                        backgroundColor: isDark ? item.softDark : item.soft,
                        borderColor: selected ? item.color : `${item.color}55`,
                        borderWidth: selected ? 2 : 1.5,
                    },
                ]}
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
            >
                <View style={[
                    modeStyles.iconWrap,
                    { backgroundColor: selected ? item.color : (isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF') },
                ]}>
                    <Ionicons
                        name={item.icon}
                        size={20}
                        color={selected ? '#FFFFFF' : item.color}
                    />
                </View>
                <Text style={[modeStyles.label, { color: item.color }]}>{item.label}</Text>
                <Text style={[modeStyles.hint, { color: item.color }]}>{item.hint}</Text>
                {selected ? (
                    <Ionicons name="checkmark-circle" size={14} color={item.color} />
                ) : (
                    <View style={modeStyles.dotSpacer} />
                )}
            </Pressable>
        </Animated.View>
    );
}

const modeStyles = StyleSheet.create({
    btn: {
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 6,
        alignItems: 'center',
        gap: 4,
    },
    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 2,
    },
    label: { fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
    hint: { fontSize: 10, fontWeight: '700', opacity: 0.8 },
    dotSpacer: { width: 14, height: 14 },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function CollectFeesScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { theme, isDark } = useTheme();
    const { shellActive } = useAccountsWebChrome();
    const { width } = useWindowDimensions();
    const wide = width >= 980;
    const styles = useMemo(() => createStyles(theme, isDark, wide), [theme, isDark, wide]);

    const feeId = params.feeId as string;
    const studentId = params.studentId as string | undefined;
    const studentName = params.name as string;
    const admissionNo = params.admissionNo as string;
    const className = params.className as string | undefined;
    const sectionName = params.sectionName as string | undefined;
    const fatherName = params.fatherName as string | undefined;
    const fatherMobile = params.fatherMobile as string | undefined;
    const feeType = params.feeType as string;
    const dueAmount = params.due as string;

    const [loading, setLoading] = useState(false);
    const [amount, setAmount] = useState(() => {
        const n = parseFloat(dueAmount);
        return Number.isFinite(n) && n > 0 ? String(n) : '';
    });
    const [mode, setMode] = useState('Cash');
    const [remarks, setRemarks] = useState('');
    const [showRemarks, setShowRemarks] = useState(false);
    const [focused, setFocused] = useState(false);
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const [upiLoading, setUpiLoading] = useState(false);
    const [upiLoadError, setUpiLoadError] = useState<string | null>(null);
    const [schoolUpiId, setSchoolUpiId] = useState('');
    const [schoolPayeeName, setSchoolPayeeName] = useState('');

    // ── Previous-year arrears (defaulter_dues) ──
    const arrearsStyles = useMemo(() => createArrearsStyles(isDark), [isDark]);
    const [arrears, setArrears] = useState<DefaulterYearBreakdown[]>([]);
    const [arrearsLoading, setArrearsLoading] = useState(true);
    const [arrearsError, setArrearsError] = useState<string | null>(null);
    const [selectedArrear, setSelectedArrear] = useState<DefaulterYearBreakdown | null>(null);
    const [arrearsModalVisible, setArrearsModalVisible] = useState(false);
    const [arrearsAmount, setArrearsAmount] = useState('');
    const [arrearsMode, setArrearsMode] = useState('Cash');
    const [arrearsRemarks, setArrearsRemarks] = useState('');
    const [arrearsSubmitting, setArrearsSubmitting] = useState(false);
    const [arrearsModalError, setArrearsModalError] = useState<string | null>(null);

    // Entry animations
    const cardAnim = useRef(new Animated.Value(0)).current;
    const formAnim = useRef(new Animated.Value(0)).current;
    const btnAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.stagger(80, [
            Animated.spring(cardAnim, { toValue: 1, tension: 70, friction: 10, useNativeDriver: true }),
            Animated.spring(formAnim, { toValue: 1, tension: 70, friction: 10, useNativeDriver: true }),
            Animated.spring(btnAnim, { toValue: 1, tension: 70, friction: 10, useNativeDriver: true }),
        ]).start();
    }, []);

    const [upiFetchTick, setUpiFetchTick] = useState(0);

    useEffect(() => {
        if (mode !== 'UPI') return;
        let alive = true;
        setUpiLoading(true);
        setUpiLoadError(null);
        UpiSettingsService.get()
            .then((d) => {
                if (!alive) return;
                setSchoolUpiId((d.upi_id ?? '').trim());
                setSchoolPayeeName((d.display_name ?? '').trim());
            })
            .catch((e) => {
                if (!alive) return;
                setUpiLoadError(e instanceof APIError ? e.message : 'Could not load school UPI settings.');
            })
            .finally(() => {
                if (alive) setUpiLoading(false);
            });
        return () => {
            alive = false;
        };
    }, [mode, upiFetchTick]);

    const loadArrears = useCallback(async () => {
        if (!studentId) {
            setArrears([]);
            setArrearsLoading(false);
            return;
        }
        setArrearsLoading(true);
        setArrearsError(null);
        try {
            const rows = await DefaulterService.listForStudent(studentId);
            setArrears(rows);
        } catch (e) {
            setArrearsError(e instanceof APIError ? e.message : 'Could not load previous dues.');
        } finally {
            setArrearsLoading(false);
        }
    }, [studentId]);

    useEffect(() => {
        loadArrears();
    }, [loadArrears]);

    const openArrearsCollect = (due: DefaulterYearBreakdown) => {
        setSelectedArrear(due);
        setArrearsAmount(String(due.balance));
        setArrearsMode('Cash');
        setArrearsRemarks('');
        setArrearsModalError(null);
        setArrearsModalVisible(true);
    };

    const handleCollectArrears = async () => {
        if (!selectedArrear) return;
        const amt = parseFloat(arrearsAmount) || 0;
        const balance = Number(selectedArrear.balance);
        if (amt <= 0) {
            setArrearsModalError('Enter an amount greater than zero.');
            return;
        }
        if (amt > balance) {
            setArrearsModalError(`Amount cannot exceed the balance of ₹${balance.toLocaleString('en-IN')}.`);
            return;
        }
        setArrearsModalError(null);
        setArrearsSubmitting(true);
        try {
            const result = await DefaulterService.collect(selectedArrear.id, {
                amount: amt,
                payment_method: arrearsMode.toLowerCase() as 'cash' | 'upi' | 'cheque',
                transaction_ref: generateUUID(),
                remarks: arrearsRemarks.trim() || undefined,
            });
            setArrearsModalVisible(false);
            setSelectedArrear(null);
            await loadArrears();
            alertCompat(
                'Arrears collected — Receipt generated',
                `Receipt ${result.receipt.receipt_no} created for ₹${amt.toLocaleString('en-IN')}.`
            );
        } catch (e) {
            setArrearsModalError(e instanceof APIError ? e.message : 'Collection failed. Please try again.');
        } finally {
            setArrearsSubmitting(false);
        }
    };

    const arrearsAmountNum = parseFloat(arrearsAmount) || 0;
    const arrearsBalance = Number(selectedArrear?.balance || 0);
    const arrearsOverpay = arrearsAmountNum > arrearsBalance;

    const dueNum = parseFloat(dueAmount) || 0;
    const amountNum = parseFloat(amount) || 0;
    const remaining = Math.max(0, dueNum - amountNum);
    const isOverpay = amountNum > dueNum && dueNum > 0;
    const isReady = amountNum > 0 && !isOverpay;
    const isPartialPayment = isReady && dueNum > 0 && amountNum < dueNum;
    const inrAmountStr = parseInrAmount(amount);
    const upiPayUri =
        mode === 'UPI' && inrAmountStr && schoolUpiId && schoolPayeeName
            ? buildUpiPayUri(schoolUpiId, schoolPayeeName, inrAmountStr, remarks)
            : '';
    const upiQrReady = mode === 'UPI' && isReady && !!upiPayUri && !upiLoading && !upiLoadError;

    const recordPayment = async (requestApproval = false) => {
        const result = await FeesService.collectFee({
            student_fee_id: feeId,
            amount: amountNum,
            payment_method: mode.toLowerCase() as 'cash' | 'upi' | 'cheque',
            transaction_ref: generateUUID(),
            remarks,
            request_approval: requestApproval || undefined,
        });

        if (result.status === 'pending_approval') {
            setPaymentError(null);
            const msg = `${result.message}\n\nNo ledger entry was created. An admin must approve this partial payment first.`;
            const title = requestApproval ? 'Request Sent' : 'Pending Approval';
            if (Platform.OS === 'web') {
                await showSuccess(title, msg, [{ text: 'OK', onPress: () => router.back() }]);
                return;
            }
            alertCompat(title, msg, [{ text: 'OK', onPress: () => router.back() }]);
            return;
        }

        const payment = result.transaction;
        setPaymentError(null);
        if (Platform.OS === 'web') {
            await showSuccess(
                '✓ Payment Recorded',
                `Receipt: ${payment.receipt_no || 'pending'}\n\nLedger updated successfully.`,
                [
                    {
                        text: 'Print Receipt',
                        onPress: async () => {
                            await generateReceiptPDF({
                                ...payment,
                                receipt_no: payment.receipt_no,
                                student_id: payment.student_id || studentId,
                                student_name: studentName,
                                admission_no: admissionNo,
                                class_name: payment.class_name || className,
                                section_name: payment.section_name || sectionName,
                                father_name: payment.father_name || fatherName,
                                father_mobile: payment.father_mobile || fatherMobile,
                                fee_type: feeType,
                                academic_year: payment.academic_year || (payment as any).academicYear,
                                paid_at: new Date().toISOString(),
                                balance_due: payment.balance_due ?? remaining,
                                amount_due: payment.amount_due,
                                total_paid: payment.total_paid,
                                discount: payment.discount,
                            });
                        },
                    },
                    { text: 'Done' },
                ],
            );
            router.back();
            return;
        }
        alertCompat(
            '✓ Payment Recorded',
            `Receipt: ${payment.receipt_no || 'pending'}\n\nLedger updated successfully.`,
            [
                {
                    text: 'Print Receipt',
                    onPress: async () => {
                        await generateReceiptPDF({
                            ...payment,
                            receipt_no: payment.receipt_no,
                            student_id: payment.student_id || studentId,
                            student_name: studentName,
                            admission_no: admissionNo,
                            class_name: payment.class_name || className,
                            section_name: payment.section_name || sectionName,
                            father_name: payment.father_name || fatherName,
                            father_mobile: payment.father_mobile || fatherMobile,
                            fee_type: feeType,
                            academic_year: payment.academic_year || (payment as any).academicYear,
                            paid_at: new Date().toISOString(),
                            balance_due: payment.balance_due ?? remaining,
                            amount_due: payment.amount_due,
                            total_paid: payment.total_paid,
                            discount: payment.discount,
                        });
                        router.back();
                    },
                },
                { text: 'Done', onPress: () => router.back() },
            ],
        );
    };

    const handleCollect = async () => {
        setPaymentError(null);
        if (!amount || isNaN(amountNum) || amountNum <= 0) {
            const m = 'Please enter a valid amount greater than zero.';
            setPaymentError(m);
            alertCompat('Invalid Amount', m);
            return;
        }
        if (!isNaN(dueNum) && amountNum > dueNum) {
            const m = `₹${amountNum} exceeds due amount ₹${dueNum}.`;
            setPaymentError(m);
            alertCompat('Overpayment', m);
            return;
        }
        if (amountNum > 1000000) {
            const m = 'Amount exceeds maximum limit of ₹10,00,000.';
            setPaymentError(m);
            alertCompat('Invalid Amount', m);
            return;
        }
        if (!feeId) {
            const m = 'Fee record identifier is missing. Go back and open Collect from the fee ledger again.';
            setPaymentError(m);
            alertCompat('Error', m);
            return;
        }

        if (mode === 'UPI') {
            if (upiLoading) {
                const m = 'Loading school UPI settings…';
                setPaymentError(m);
                return;
            }
            if (upiLoadError) {
                setPaymentError(upiLoadError);
                return;
            }
            if (!schoolUpiId || !schoolPayeeName) {
                const m =
                    'School UPI is not configured. Ask an admin to set UPI ID under Admin → UPI fee settings, or use Cash/Cheque.';
                setPaymentError(m);
                alertCompat('UPI not configured', m);
                return;
            }
            if (!inrAmountStr) {
                const m = 'Enter a valid amount for UPI (up to 2 decimal places).';
                setPaymentError(m);
                return;
            }
            if (!upiPayUri) {
                const m = 'Could not build UPI payment link. Check amount and school UPI settings.';
                setPaymentError(m);
                return;
            }
        }

        const confirmMsg =
            mode === 'UPI'
                ? `Record ₹${amountNum.toLocaleString('en-IN')} UPI payment to the ledger?\n\nOnly confirm after the payer has completed payment in their UPI app (you should have shown them the QR above).`
                : `Record ₹${amountNum.toLocaleString('en-IN')} via ${mode}?\n\nThis action is permanent and will be logged.`;

        const confirmed = await showConfirm({
            title: 'Confirm Payment',
            message: confirmMsg,
            confirmText: 'Confirm & Record',
            cancelText: 'Cancel',
            type: 'confirm',
        });
        if (!confirmed) return;
        setLoading(true);
        try {
            await recordPayment();
        } catch (error: any) {
            const msg =
                error?.message ||
                (Platform.OS === 'web'
                    ? 'Could not process payment. Check network and permissions (fees.collect).'
                    : 'Could not process payment. Check backend logs.');
            setPaymentError(msg);
            const canRequestPartial =
                isPartialPayment &&
                error instanceof APIError &&
                (error.code === 'PARTIAL_FEE_PAYMENT_DISABLED' ||
                    msg.includes('Partial fee payments are disabled'));

            if (canRequestPartial) {
                const shouldRequest = await showConfirm({
                    title: 'Partial Payment Disabled',
                    message: `${msg}\n\nSend this partial payment to admin for approval? It will appear on the Partial Fee Collection page.`,
                    confirmText: 'Request Admin Approval',
                    cancelText: 'Cancel',
                    type: 'warning',
                });
                if (shouldRequest) {
                    try {
                        await recordPayment(true);
                    } catch (requestError: any) {
                        const requestMsg = requestError?.message || 'Could not send partial payment request.';
                        setPaymentError(requestMsg);
                        await showError('Request Failed', requestMsg);
                    }
                }
                return;
            }
            await showError('Payment Failed', msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            {!shellActive && <AdminHeader title="Collect Fee" showBackButton={true} />}

            <KeyboardAwareScreen
                variant="scroll"
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                bottomOffset={24}
            >
                <View style={styles.columns}>
                    <Animated.View style={[
                        styles.infoCard,
                        wide && styles.infoCardWide,
                        {
                            opacity: cardAnim,
                            transform: [{
                                translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] })
                            }]
                        }
                    ]}>
                        <LinearGradient
                            colors={isDark ? ['#1B1464', '#312E81'] : ['#1B1464', '#4C1D95']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.heroHead}
                        >
                            <LinearGradient
                                colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 0.8, y: 1 }}
                                style={StyleSheet.absoluteFill}
                            />
                            <View style={styles.cardBody}>
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>
                                        {(studentName || 'S').charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                                <View style={styles.cardInfo}>
                                    <Text style={styles.studentName} numberOfLines={1}>
                                        {studentName || 'Unknown Student'}
                                    </Text>
                                    <View style={styles.metaRow}>
                                        {admissionNo ? (
                                            <View style={styles.metaPill}>
                                                <Ionicons name="id-card" size={12} color="#E9D5FF" />
                                                <Text style={styles.metaPillText}>{admissionNo}</Text>
                                            </View>
                                        ) : null}
                                        {(className || sectionName) ? (
                                            <View style={styles.metaPill}>
                                                <Ionicons name="school" size={12} color="#E9D5FF" />
                                                <Text style={styles.metaPillText} numberOfLines={1}>
                                                    {[className, sectionName].filter(Boolean).join(' · ')}
                                                </Text>
                                            </View>
                                        ) : null}
                                    </View>
                                </View>
                            </View>
                            {feeType ? (
                                <View style={styles.feeTypeChip}>
                                    <Ionicons name={feeKindIcon(feeType)} size={13} color="#E9D5FF" />
                                    <Text style={styles.feeTypeChipText}>{feeType}</Text>
                                </View>
                            ) : null}
                        </LinearGradient>

                        <View style={styles.dueRow}>
                            <View style={styles.dueBlock}>
                                <View style={styles.dueLabelRow}>
                                    <Ionicons name="alert-circle" size={13} color="#DC2626" />
                                    <Text style={styles.dueLabel}>Due</Text>
                                </View>
                                <Text style={styles.dueValue}>{formatInr(dueNum)}</Text>
                            </View>
                            <View style={styles.dueSep} />
                            <View style={styles.dueBlock}>
                                <View style={styles.dueLabelRow}>
                                    <Ionicons
                                        name={remaining <= 0 && amountNum > 0 ? 'checkmark-circle' : (isOverpay ? 'alert-circle' : 'hourglass')}
                                        size={13}
                                        color={remaining <= 0 && amountNum > 0 ? '#059669' : (isOverpay ? '#DC2626' : '#D97706')}
                                    />
                                    <Text style={styles.dueLabel}>
                                        {remaining <= 0 && amountNum > 0 ? 'Cleared' : (isOverpay ? 'Over' : 'Left')}
                                    </Text>
                                </View>
                                <Text style={[
                                    styles.dueValue,
                                    { color: remaining <= 0 && amountNum > 0 ? '#059669' : (isOverpay ? '#DC2626' : '#D97706') }
                                ]}>
                                    {isOverpay ? formatInr(amountNum - dueNum) : formatInr(remaining)}
                                </Text>
                            </View>
                        </View>
                        {dueNum > 0 ? (
                            <View style={styles.dueProgressWrap}>
                                <View style={styles.dueProgressTrack}>
                                    <View style={[
                                        styles.dueProgressFill,
                                        {
                                            width: `${Math.min(100, Math.max(0, (amountNum / dueNum) * 100))}%` as any,
                                            backgroundColor: remaining <= 0 && amountNum > 0 ? '#059669' : '#D97706',
                                        },
                                    ]} />
                                </View>
                                {amountNum > 0 ? (
                                    <View style={styles.dueStatusRow}>
                                        <Ionicons
                                            name={remaining <= 0 ? 'checkmark-circle' : 'pie-chart'}
                                            size={14}
                                            color={remaining <= 0 ? '#059669' : '#D97706'}
                                        />
                                        <Text style={[
                                            styles.dueStatusText,
                                            { color: remaining <= 0 ? '#059669' : '#D97706' },
                                        ]}>
                                            {isOverpay ? 'Too much' : remaining <= 0 ? 'Clears this fee' : 'Part payment'}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>
                        ) : null}
                    </Animated.View>

                    <Animated.View style={[
                        styles.form,
                        wide && styles.formWide,
                        {
                            opacity: formAnim,
                            transform: [{
                                translateY: formAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] })
                            }]
                        }
                    ]}>
                        <View style={styles.formHeader}>
                            <View style={styles.formHeaderIcon}>
                                <Ionicons name="cash" size={16} color="#059669" />
                            </View>
                            <Text style={styles.sectionTitle}>Take payment</Text>
                        </View>

                        <View style={styles.labelRow}>
                            <Ionicons name="wallet" size={14} color={isDark ? '#6EE7B7' : '#059669'} />
                            <Text style={[styles.inputLabel, styles.inputLabelInline]}>Amount</Text>
                        </View>
                        <View style={[
                            styles.amountBox,
                            focused && styles.amountBoxFocused,
                            isOverpay && styles.amountBoxError,
                        ]}>
                            <Text style={styles.rupeeSymbol}>₹</Text>
                            <AppTextInput
                                style={[ds.inputInChrome, styles.amountInput]}
                                keyboardType="numeric"
                                value={amount}
                                onChangeText={(t) => {
                                    setPaymentError(null);
                                    setAmount(t);
                                }}
                                placeholder="0"
                                placeholderTextColor={isDark ? 'rgba(255,255,255,0.2)' : '#94A3B8'}
                                onFocus={() => setFocused(true)}
                                onBlur={() => setFocused(false)}
                            />
                            {isReady && (
                                <View style={[styles.fullPayBadge, amountNum < dueNum && styles.partialPayBadge]}>
                                    <Ionicons
                                        name={amountNum === dueNum ? 'checkmark' : 'pie-chart'}
                                        size={11}
                                        color="#FFFFFF"
                                    />
                                    <Text style={styles.fullPayText}>
                                        {amountNum === dueNum ? 'Full' : 'Part'}
                                    </Text>
                                </View>
                            )}
                        </View>
                        {isOverpay && (
                            <Text style={styles.errorHint}>
                                Exceeds due by {formatInr(amountNum - dueNum)}
                            </Text>
                        )}

                        {dueNum > 0 && (
                            <View style={styles.chipRow}>
                                {[
                                    { ratio: 0.5, label: 'Half', icon: 'pie-chart' as const },
                                    { ratio: 1, label: 'Full', icon: 'checkmark-circle' as const },
                                ].map((choice) => {
                                    const val = choice.ratio === 1 ? dueNum : Math.round(dueNum * choice.ratio);
                                    const active = choice.ratio === 1
                                        ? amountNum === dueNum
                                        : amountNum === val && val !== dueNum;
                                    const isFull = choice.ratio === 1;
                                    return (
                                        <TouchableOpacity
                                            key={choice.label}
                                            style={[
                                                styles.chip,
                                                isFull ? styles.chipFull : styles.chipHalf,
                                                active && (isFull ? styles.chipActive : styles.chipActivePartial),
                                                webCursor,
                                            ]}
                                            onPress={() => {
                                                setPaymentError(null);
                                                setAmount(String(val));
                                            }}
                                        >
                                            <Ionicons
                                                name={choice.icon}
                                                size={16}
                                                color={active || isFull ? (isFull ? '#059669' : '#D97706') : (isDark ? '#94A3B8' : '#64748B')}
                                            />
                                            <Text style={[
                                                styles.chipText,
                                                active && (isFull ? styles.chipTextActive : styles.chipTextPartial),
                                                !active && isFull && styles.chipTextActive,
                                            ]}>
                                                {choice.label}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.chipAmount,
                                                    active && (isFull ? styles.chipTextActive : styles.chipTextPartial),
                                                    !active && isFull && styles.chipTextActive,
                                                ]}
                                                numberOfLines={1}
                                            >
                                                {formatInr(val)}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}

                        <View style={styles.labelRow}>
                            <Ionicons name="card" size={14} color={isDark ? '#C4B5FD' : '#4F46E5'} />
                            <Text style={[styles.inputLabel, styles.inputLabelInline]}>How they pay</Text>
                        </View>
                        <View style={styles.modeRow}>
                            {PAYMENT_MODES.map((m) => (
                                <ModeButton
                                    key={m.id}
                                    item={m}
                                    selected={mode === m.id}
                                    onPress={() => {
                                        setPaymentError(null);
                                        setMode(m.id);
                                    }}
                                    theme={theme}
                                    isDark={isDark}
                                />
                            ))}
                        </View>

                        {showRemarks || remarks.length > 0 ? (
                            <>
                                <Text style={styles.inputLabel}>Note</Text>
                                <AppTextInput
                                    style={styles.remarksInput}
                                    multiline
                                    value={remarks}
                                    onChangeText={(t) => {
                                        setPaymentError(null);
                                        setRemarks(t);
                                    }}
                                    placeholder="Optional — e.g. partial for Q1"
                                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.2)' : '#94A3B8'}
                                />
                            </>
                        ) : (
                            <Pressable style={[styles.addNoteBtn, webCursor]} onPress={() => setShowRemarks(true)}>
                                <Ionicons name="create-outline" size={16} color={isDark ? '#A5B4FC' : '#6366F1'} />
                                <Text style={styles.addNoteText}>Add a note</Text>
                            </Pressable>
                        )}
                    </Animated.View>
                </View>

                {/* ── Pay now. Old dues stay below so they don't block this fee. ── */}
                <Animated.View style={[
                    {
                        opacity: btnAnim,
                        transform: [{
                            translateY: btnAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] })
                        }]
                    }
                ]}>
                    {mode === 'UPI' && isReady ? (
                        <View style={styles.upiQrSection}>
                            <View style={styles.upiQrHead}>
                                <View style={styles.upiQrIcon}>
                                    <Ionicons name="qr-code" size={18} color="#4F46E5" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.upiQrTitle}>Show this QR</Text>
                                    <Text style={styles.upiQrSub}>Parent scans. Then tap Collect.</Text>
                                </View>
                            </View>
                            {upiLoading ? (
                                <View style={styles.upiQrCenter}>
                                    <ActivityIndicator color="#4F46E5" />
                                    <Text style={styles.upiQrMuted}>Loading UPI…</Text>
                                </View>
                            ) : upiLoadError ? (
                                <View style={styles.upiQrWarn}>
                                    <Ionicons name="alert-circle" size={16} color="#DC2626" />
                                    <Text style={styles.upiQrWarnText}>{upiLoadError}</Text>
                                    <TouchableOpacity onPress={() => setUpiFetchTick((n) => n + 1)} style={{ marginTop: 10 }}>
                                        <Text style={styles.upiQrLink}>Retry</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setMode('Cash')}>
                                        <Text style={[styles.upiQrLink, { marginTop: 6 }]}>Use Cash</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : !schoolUpiId || !schoolPayeeName ? (
                                <View style={styles.upiQrWarn}>
                                    <Ionicons name="alert-circle" size={16} color="#D97706" />
                                    <Text style={styles.upiQrWarnText}>
                                        UPI is not set. Use Cash or Cheque.
                                    </Text>
                                </View>
                            ) : !inrAmountStr ? (
                                <Text style={styles.upiQrMuted}>Enter an amount to show the QR.</Text>
                            ) : (
                                <>
                                    <View style={styles.upiQrFrame}>
                                        <QRCode value={upiPayUri} size={200} color="#0f172a" backgroundColor="#FFFFFF" />
                                    </View>
                                    <View style={styles.upiQrMeta}>
                                        <View style={styles.upiMetaRow}>
                                            <Ionicons name="at" size={14} color={isDark ? '#FCD34D' : '#B45309'} />
                                            <Text style={styles.upiQrMetaLine}>{schoolUpiId}</Text>
                                        </View>
                                        <View style={styles.upiMetaRow}>
                                            <Ionicons name="cash" size={14} color="#059669" />
                                            <Text style={styles.upiQrMetaLine}>₹{inrAmountStr}</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.upiShareBtn}
                                        onPress={() => Share.share({ message: upiPayUri, title: 'UPI payment' }).catch(() => { })}
                                    >
                                        <Ionicons name="share-social" size={15} color="#4F46E5" />
                                        <Text style={styles.upiShareBtnText}>Share link</Text>
                                    </TouchableOpacity>
                                    <View style={styles.upiHintRow}>
                                        <Ionicons name="checkmark-circle" size={14} color="#059669" />
                                        <Text style={styles.upiLedgerHint}>Money in? Tap the green button.</Text>
                                    </View>
                                </>
                            )}
                        </View>
                    ) : null}

                    {paymentError ? (
                        <View style={[styles.errorBanner, { borderColor: isDark ? 'rgba(248,113,113,0.5)' : '#FECACA', backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#FEF2F2' }]}>
                            <Ionicons name="alert-circle" size={16} color={isDark ? '#FECACA' : '#991B1B'} />
                            <Text style={[styles.errorBannerText, { color: isDark ? '#FECACA' : '#991B1B' }]}>{paymentError}</Text>
                        </View>
                    ) : null}

                    {!wide ? (
                        <TouchableOpacity
                            style={[
                                styles.payBtn,
                                isPartialPayment && isReady && styles.payBtnPartial,
                                (!isReady || loading || (mode === 'UPI' && !upiQrReady)) && styles.payBtnDisabled,
                                webCursor,
                            ]}
                            onPress={handleCollect}
                            disabled={!isReady || loading || (mode === 'UPI' && !upiQrReady)}
                            activeOpacity={0.85}
                        >
                            {loading ? (
                                <LogoLoader color="#fff" />
                            ) : (
                                <View style={styles.payBtnInner}>
                                    <Ionicons
                                        name={!isReady ? 'wallet-outline' : mode === 'UPI' ? 'qr-code' : 'checkmark-circle'}
                                        size={18}
                                        color={(!isReady || (mode === 'UPI' && !upiQrReady)) ? (isDark ? '#94A3B8' : '#64748B') : '#FFFFFF'}
                                    />
                                    <Text style={[
                                        styles.payBtnText,
                                        (!isReady || (mode === 'UPI' && !upiQrReady)) && styles.payBtnTextDisabled,
                                    ]}>
                                        {!isReady
                                            ? 'Enter amount'
                                            : `Collect ${formatInr(amountNum)}`}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    ) : null}
                </Animated.View>

                {!arrearsLoading && !arrearsError && arrears.length === 0 ? (
                    <View style={arrearsStyles.clearChip}>
                        <Ionicons name="checkmark-circle" size={16} color="#059669" />
                        <Text style={arrearsStyles.clearText}>No old dues</Text>
                    </View>
                ) : (
                    <View style={arrearsStyles.section}>
                        <View style={arrearsStyles.headerRow}>
                            <Ionicons name="time" size={16} color={isDark ? '#FCD34D' : '#B45309'} />
                            <Text style={arrearsStyles.headerTitle}>Old dues</Text>
                        </View>

                        {arrearsLoading ? (
                            <>
                                <View style={arrearsStyles.skeletonRow} />
                                <View style={arrearsStyles.skeletonRow} />
                            </>
                        ) : arrearsError ? (
                            <TouchableOpacity style={arrearsStyles.errorRow} onPress={loadArrears} activeOpacity={0.7}>
                                <Ionicons name="refresh" size={16} color={isDark ? '#FECACA' : '#991B1B'} />
                                <Text style={arrearsStyles.errorText}>Could not load. Tap to retry.</Text>
                            </TouchableOpacity>
                        ) : (
                            arrears.map((due) => {
                                const isPartial = due.status === 'partially_paid';
                                const balanceColor = isPartial ? '#D97706' : '#DC2626';
                                return (
                                    <View key={due.id} style={arrearsStyles.dueRow}>
                                        <View style={arrearsStyles.dueTopRow}>
                                            <View style={arrearsStyles.yearBadge}>
                                                <Ionicons name="calendar" size={13} color="#B45309" />
                                                <Text style={arrearsStyles.yearBadgeText}>{due.due_academic_year}</Text>
                                            </View>
                                            <View style={[
                                                arrearsStyles.statusBadge,
                                                { backgroundColor: isPartial ? '#FEF3C7' : '#FEE2E2' },
                                            ]}>
                                                <Ionicons
                                                    name={isPartial ? 'pie-chart' : 'alert-circle'}
                                                    size={12}
                                                    color={balanceColor}
                                                />
                                                <Text style={[arrearsStyles.statusBadgeText, { color: balanceColor }]}>
                                                    {isPartial ? 'Part' : 'Unpaid'}
                                                </Text>
                                            </View>
                                        </View>
                                        <Text style={[arrearsStyles.balanceHero, { color: balanceColor }]}>
                                            {formatInr(due.balance)}
                                        </Text>
                                        <Text style={arrearsStyles.balanceCaption}>
                                            of {formatInr(due.original_amount)} · paid {formatInr(due.paid_amount)}
                                        </Text>
                                        <TouchableOpacity
                                            style={arrearsStyles.collectBtn}
                                            onPress={() => openArrearsCollect(due)}
                                            activeOpacity={0.85}
                                        >
                                            <Ionicons name="cash" size={16} color="#FFFFFF" />
                                            <Text style={arrearsStyles.collectBtnText}>
                                                Take {formatInr(due.balance)}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                );
                            })
                        )}
                    </View>
                )}

                <View style={{ height: wide ? 128 : 28 }} />
            </KeyboardAwareScreen>

            {wide ? (
                <View style={styles.stickyBar}>
                    <View style={styles.stickyMode}>
                        <Ionicons
                            name={(PAYMENT_MODES.find((item) => item.id === mode) || PAYMENT_MODES[0]).icon}
                            size={18}
                            color={(PAYMENT_MODES.find((item) => item.id === mode) || PAYMENT_MODES[0]).color}
                        />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.stickyLabel}>
                            {remaining <= 0 && isReady ? 'Clears this fee' : isReady ? `${formatInr(remaining)} left` : mode}
                        </Text>
                        <Text style={styles.stickyAmount} numberOfLines={1}>
                            {isReady ? formatInr(amountNum) : 'Enter an amount'}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={[
                            styles.payBtn,
                            styles.stickyPayBtn,
                            isPartialPayment && isReady && styles.payBtnPartial,
                            (!isReady || loading || (mode === 'UPI' && !upiQrReady)) && styles.payBtnDisabled,
                            webCursor,
                        ]}
                        onPress={handleCollect}
                        disabled={!isReady || loading || (mode === 'UPI' && !upiQrReady)}
                        activeOpacity={0.85}
                    >
                        {loading ? (
                            <LogoLoader color="#fff" />
                        ) : (
                            <View style={styles.payBtnInner}>
                                <Ionicons
                                    name={!isReady ? 'wallet-outline' : 'checkmark-circle'}
                                    size={18}
                                    color={(!isReady || (mode === 'UPI' && !upiQrReady)) ? '#94A3B8' : '#FFFFFF'}
                                />
                                <Text style={[
                                    styles.payBtnText,
                                    (!isReady || (mode === 'UPI' && !upiQrReady)) && styles.payBtnTextDisabled,
                                ]}>
                                    {!isReady ? 'Enter amount' : `Collect ${formatInr(amountNum)}`}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            ) : null}

            {/* ── Arrears Collection Modal ── */}
            <Modal
                visible={arrearsModalVisible}
                animationType="slide"
                transparent
                statusBarTranslucent
                onRequestClose={() => setArrearsModalVisible(false)}
            >
                <Pressable
                    style={arrearsStyles.modalBackdrop}
                    onPress={() => !arrearsSubmitting && setArrearsModalVisible(false)}
                >
                    <Pressable style={arrearsStyles.modalSheet} onPress={(e) => e.stopPropagation()}>
                        <View style={arrearsStyles.modalHandle} />
                        <View style={arrearsStyles.modalTitleRow}>
                            <Ionicons name="time" size={18} color="#B45309" />
                            <Text style={arrearsStyles.modalTitle}>Old dues</Text>
                        </View>
                        {selectedArrear ? (
                            <View style={arrearsStyles.modalChipRow}>
                                <View style={arrearsStyles.modalChip}>
                                    <Ionicons name="person" size={12} color="#4F46E5" />
                                    <Text style={arrearsStyles.modalChipText}>{studentName || 'Student'}</Text>
                                </View>
                                <View style={arrearsStyles.modalChip}>
                                    <Ionicons name="calendar" size={12} color="#B45309" />
                                    <Text style={arrearsStyles.modalChipText}>{selectedArrear.due_academic_year}</Text>
                                </View>
                                <View style={[arrearsStyles.modalChip, arrearsStyles.modalChipDue]}>
                                    <Ionicons name="alert-circle" size={12} color="#DC2626" />
                                    <Text style={[arrearsStyles.modalChipText, { color: '#BE123C' }]}>
                                        {formatInr(arrearsBalance)}
                                    </Text>
                                </View>
                            </View>
                        ) : null}

                        <View style={arrearsStyles.modalLabelRow}>
                            <Ionicons name="wallet" size={14} color="#B45309" />
                            <Text style={arrearsStyles.modalLabel}>Amount · max {formatInr(arrearsBalance)}</Text>
                        </View>
                        <View style={[arrearsStyles.modalAmountBox, arrearsOverpay && arrearsStyles.modalAmountBoxError]}>
                            <Text style={arrearsStyles.modalRupee}>₹</Text>
                            <AppTextInput
                                style={[ds.inputInChrome, arrearsStyles.modalAmountInput]}
                                keyboardType="numeric"
                                value={arrearsAmount}
                                onChangeText={(t) => { setArrearsModalError(null); setArrearsAmount(t); }}
                                placeholder="0"
                            />
                        </View>
                        {arrearsOverpay ? (
                            <View style={arrearsStyles.modalErrorHintRow}>
                                <Ionicons name="alert-circle" size={13} color="#DC2626" />
                                <Text style={arrearsStyles.modalErrorHint}>
                                    Over by {formatInr(arrearsAmountNum - arrearsBalance)}
                                </Text>
                            </View>
                        ) : null}

                        <View style={arrearsStyles.modalLabelRow}>
                            <Ionicons name="card" size={14} color="#4F46E5" />
                            <Text style={arrearsStyles.modalLabel}>How they pay</Text>
                        </View>
                        <View style={arrearsStyles.modalModeRow}>
                            {PAYMENT_MODES.map((m) => (
                                <ModeButton
                                    key={m.id}
                                    item={m}
                                    selected={arrearsMode === m.id}
                                    onPress={() => { setArrearsModalError(null); setArrearsMode(m.id); }}
                                    theme={theme}
                                    isDark={isDark}
                                />
                            ))}
                        </View>

                        <View style={arrearsStyles.modalLabelRow}>
                            <Ionicons name="create-outline" size={14} color="#64748B" />
                            <Text style={arrearsStyles.modalLabel}>Note</Text>
                        </View>
                        <AppTextInput
                            style={arrearsStyles.modalRemarks}
                            multiline
                            value={arrearsRemarks}
                            onChangeText={setArrearsRemarks}
                            placeholder="e.g. Cleared 2023-24 dues"
                        />

                        {arrearsModalError ? (
                            <View style={arrearsStyles.modalErrorBanner}>
                                <Text style={arrearsStyles.modalErrorBannerText}>{arrearsModalError}</Text>
                            </View>
                        ) : null}

                        <TouchableOpacity
                            style={[
                                arrearsStyles.modalSubmit,
                                (arrearsSubmitting || arrearsOverpay || arrearsAmountNum <= 0) && arrearsStyles.modalSubmitDisabled,
                            ]}
                            onPress={handleCollectArrears}
                            disabled={arrearsSubmitting || arrearsOverpay || arrearsAmountNum <= 0}
                            activeOpacity={0.85}
                        >
                            {arrearsSubmitting ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <View style={arrearsStyles.modalSubmitInner}>
                                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                                    <Text style={arrearsStyles.modalSubmitText}>
                                        {arrearsAmountNum > 0 && !arrearsOverpay
                                            ? `Take ${formatInr(arrearsAmountNum)}`
                                            : 'Enter amount'}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

// ─── Previous Year Pending Fees Styles ────────────────────────────────────────
const createArrearsStyles = (isDark: boolean) => {
    const cardBg = isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF';
    const border = isDark ? 'rgba(255,255,255,0.10)' : '#F1F5F9';
    const labelColor = isDark ? 'rgba(255,255,255,0.5)' : '#6B7280';
    const valueColor = isDark ? 'rgba(255,255,255,0.85)' : '#374151';
    return StyleSheet.create({
        section: {
        marginTop: 8,
            backgroundColor: cardBg,
            borderRadius: 16,
            borderLeftWidth: 4,
            borderLeftColor: '#F59E0B',
            borderWidth: 1,
            borderColor: border,
            padding: 16,
        },
        clearChip: {
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : '#ECFDF5',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(16,185,129,0.28)' : '#A7F3D0',
        },
        clearText: { fontSize: 13, fontWeight: '800', color: isDark ? '#6EE7B7' : '#047857' },
        headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
        headerTitle: { fontSize: 15, fontWeight: '800', color: isDark ? '#FCD34D' : '#B45309', letterSpacing: 0.2 },
        skeletonRow: {
            height: 92,
            borderRadius: 12,
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
            marginBottom: 10,
        },
        emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
        emptyCheck: { fontSize: 14, color: isDark ? 'rgba(255,255,255,0.4)' : '#9CA3AF', fontWeight: '700' },
        emptyText: { fontSize: 13, color: isDark ? 'rgba(255,255,255,0.4)' : '#9CA3AF' },
        errorRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 14,
            paddingHorizontal: 12,
            borderRadius: 12,
            backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#FEF2F2',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(248,113,113,0.4)' : '#FECACA',
        },
        errorText: { fontSize: 13, color: isDark ? '#FECACA' : '#991B1B', fontWeight: '600', textAlign: 'center' },
        dueRow: {
            borderRadius: 12,
            borderWidth: 1,
            borderColor: border,
            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FAFBFF',
            padding: 12,
            marginBottom: 10,
        },
        dueTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
        yearBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            backgroundColor: isDark ? 'rgba(245,158,11,0.16)' : '#FFFBEB',
            paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
        },
        yearBadgeText: { fontSize: 13, fontWeight: '800', color: isDark ? '#FCD34D' : '#B45309' },
        statusBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
        },
        statusBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
        balanceHero: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
        balanceCaption: { fontSize: 12, fontWeight: '600', color: labelColor, marginTop: 2, marginBottom: 12 },
        amountGrid: { flexDirection: 'row', marginBottom: 12 },
        amountCell: { flex: 1 },
        amountLabel: { fontSize: 11, color: labelColor, marginBottom: 2, fontWeight: '500' },
        amountValue: { fontSize: 14, color: valueColor, fontWeight: '700' },
        balanceValue: { fontSize: 14, fontWeight: '800' },
        collectBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            backgroundColor: '#D97706',
            borderRadius: 12,
            paddingVertical: 12,
        },
        collectBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13, letterSpacing: 0.3 },
        // Modal
        modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
        modalSheet: {
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 20,
            paddingBottom: 32,
        },
        modalHandle: {
            width: 40, height: 4, borderRadius: 2, alignSelf: 'center',
            backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : '#E5E7EB', marginBottom: 14,
        },
        modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        modalTitle: { fontSize: 18, fontWeight: '800', color: isDark ? '#FFFFFF' : '#0F172A' },
        modalChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
        modalChip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
        },
        modalChipDue: {
            backgroundColor: isDark ? 'rgba(220,38,38,0.14)' : '#FFF1F2',
            borderColor: isDark ? 'rgba(220,38,38,0.35)' : '#FECDD3',
        },
        modalChipText: { fontSize: 12, fontWeight: '700', color: isDark ? '#E2E8F0' : '#334155', flexShrink: 1 },
        modalLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, marginBottom: 6 },
        modalLabel: { fontSize: 13, fontWeight: '700', color: valueColor },
        modalErrorHintRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
        modalSubmitInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        modalAmountBox: {
            flexDirection: 'row', alignItems: 'center',
            borderWidth: 1.5, borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E5E7EB',
            borderRadius: 12, paddingHorizontal: 12,
        },
        modalAmountBoxError: { borderColor: '#DC2626' },
        modalRupee: { fontSize: 18, fontWeight: '700', color: labelColor, marginRight: 6 },
        modalAmountInput: { flex: 1, fontSize: 18, fontWeight: '700', paddingVertical: 12, color: valueColor },
        modalErrorHint: { fontSize: 12, color: '#DC2626', fontWeight: '700' },
        modalModeRow: { flexDirection: 'row', gap: 10 },
        modalRemarks: {
            borderWidth: 1.5, borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E5E7EB',
            borderRadius: 12, padding: 12, minHeight: 60, textAlignVertical: 'top',
            color: valueColor,
        },
        modalErrorBanner: {
            marginTop: 14, padding: 12, borderRadius: 10,
            backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#FEF2F2',
            borderWidth: 1, borderColor: isDark ? 'rgba(248,113,113,0.4)' : '#FECACA',
        },
        modalErrorBannerText: { fontSize: 13, color: isDark ? '#FECACA' : '#991B1B', fontWeight: '600' },
        modalSubmit: {
            marginTop: 18, backgroundColor: '#F59E0B', borderRadius: 14,
            paddingVertical: 16, alignItems: 'center',
        },
        modalSubmitDisabled: { opacity: 0.5 },
        modalSubmitText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
    });
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const createStyles = (theme: any, isDark: boolean, wide = false) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    content: {
        padding: wide ? 22 : 16,
        paddingBottom: wide ? 140 : 16,
        gap: 16,
        maxWidth: 1120,
        width: '100%',
        alignSelf: 'center',
    },
    columns: {
        flexDirection: wide ? 'row' : 'column',
        gap: 16,
        alignItems: wide ? 'flex-start' : 'stretch',
    },

    // ── Info Card ──
    infoCard: {
        backgroundColor: isDark ? '#1A2130' : '#FFFFFF',
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(76,90,120,0.08)',
        ...Platform.select({
            ios: {
                shadowColor: '#1B1464',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: isDark ? 0.3 : 0.12,
                shadowRadius: 18,
            },
            android: { elevation: 5 },
        }),
    },
    infoCardWide: {
        flex: 1,
        minWidth: 0,
    },
    heroHead: {
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 16,
    },
    cardAccent: {
        height: 4,
        backgroundColor: '#3B82F6',
    },
    cardBody: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.14)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
    },
    avatarText: {
        fontSize: 22,
        fontWeight: '800',
        color: '#F8FAFC',
    },
    cardInfo: { flex: 1, minWidth: 0 },
    studentName: {
        fontSize: 18,
        fontWeight: '800',
        color: '#F8FAFC',
        marginBottom: 4,
        letterSpacing: -0.3,
    },
    metaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    metaPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        maxWidth: '100%',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.12)',
    },
    metaPillText: {
        flexShrink: 1,
        fontSize: 11,
        fontWeight: '700',
        color: '#F3E8FF',
    },
    feeTypeChip: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 14,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.16)',
    },
    feeTypeChipText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#E9D5FF',
    },
    tagRow: { flexDirection: 'row', gap: 6 },
    tag: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#F3F4F6',
    },
    tagBlue: {
        backgroundColor: isDark ? 'rgba(59,130,246,0.12)' : '#EFF6FF',
    },
    tagText: {
        fontSize: 11,
        fontWeight: '700',
        color: isDark ? 'rgba(255,255,255,0.5)' : '#6B7280',
        letterSpacing: 0.3,
    },
    dueRow: {
        flexDirection: 'row',
        paddingHorizontal: 18,
        paddingTop: 16,
        paddingBottom: 8,
    },
    dueBlock: { flex: 1 },
    dueSep: {
        width: 1,
        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)',
        marginHorizontal: 12,
    },
    dueLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 6,
    },
    dueLabel: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.4,
        color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B',
        textTransform: 'uppercase',
    },
    dueValue: {
        fontSize: 22,
        fontWeight: '800',
        color: '#DC2626',
        letterSpacing: -0.4,
    },
    dueProgressWrap: {
        paddingHorizontal: 18,
        paddingBottom: 18,
        gap: 8,
    },
    dueProgressTrack: {
        height: 8,
        borderRadius: 99,
        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#EEF2FF',
        overflow: 'hidden',
    },
    dueProgressFill: {
        height: '100%',
        borderRadius: 99,
        backgroundColor: '#059669',
    },
    dueStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    dueStatusText: {
        fontSize: 12,
        fontWeight: '800',
    },

    // ── Form ──
    form: {
        backgroundColor: isDark ? '#1A2130' : '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(76,90,120,0.08)',
        gap: 4,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isDark ? 0.3 : 0.06,
                shadowRadius: 12,
            },
            android: { elevation: 3 },
        }),
    },
    formWide: {
        flex: 1.12,
    },
    formHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 14,
    },
    formHeaderIcon: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isDark ? 'rgba(16,185,129,0.16)' : '#ECFDF5',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: isDark ? '#F8FAFC' : '#0F172A',
        letterSpacing: -0.3,
    },
    sectionHint: {
        fontSize: 13,
        fontWeight: '500',
        color: isDark ? 'rgba(255,255,255,0.45)' : '#64748B',
        lineHeight: 18,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.6,
        color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B',
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    inputLabelInline: {
        marginBottom: 0,
    },

    // ── Amount Input ──
    amountBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB',
        borderWidth: 1.5,
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
        borderRadius: 14,
        paddingHorizontal: 16,
        marginBottom: 10,
    },
    amountBoxFocused: {
        borderColor: '#059669',
        backgroundColor: isDark ? 'rgba(5,150,105,0.08)' : '#ECFDF5',
    },
    amountBoxError: {
        borderColor: '#EF4444',
        backgroundColor: isDark ? 'rgba(239,68,68,0.06)' : '#FFF5F5',
    },
    rupeeSymbol: {
        fontSize: 22,
        fontWeight: '700',
        color: isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF',
        marginRight: 6,
    },
    amountInput: {
        flex: 1,
        fontSize: 32,
        fontWeight: '800',
        color: isDark ? '#F9FAFB' : '#111827',
        paddingVertical: 14,
    },
    fullPayBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#059669',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
    },
    partialPayBadge: {
        backgroundColor: '#D97706',
    },
    fullPayText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 0.8,
    },
    errorHint: {
        fontSize: 12,
        color: '#EF4444',
        fontWeight: '600',
        marginTop: -6,
        marginBottom: 10,
    },

    // ── Chips ──
    chipRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 20,
    },
    chip: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 16,
        alignItems: 'center',
        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
        borderWidth: 1.5,
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
        gap: 2,
    },
    chipHalf: {
        borderColor: isDark ? 'rgba(217,119,6,0.35)' : '#FDE68A',
        backgroundColor: isDark ? 'rgba(217,119,6,0.08)' : '#FFFDF5',
    },
    chipFull: {
        borderColor: isDark ? 'rgba(5,150,105,0.4)' : '#A7F3D0',
        backgroundColor: isDark ? 'rgba(5,150,105,0.1)' : '#F0FDF4',
    },
    chipActive: {
        backgroundColor: isDark ? 'rgba(5,150,105,0.2)' : '#ECFDF5',
        borderColor: '#059669',
        borderWidth: 2,
    },
    chipActivePartial: {
        backgroundColor: isDark ? 'rgba(217,119,6,0.18)' : '#FFFBEB',
        borderColor: '#D97706',
        borderWidth: 2,
    },
    chipText: {
        fontSize: 13,
        fontWeight: '800',
        color: isDark ? 'rgba(255,255,255,0.7)' : '#334155',
    },
    chipAmount: {
        fontSize: 12,
        fontWeight: '700',
        color: isDark ? 'rgba(255,255,255,0.55)' : '#64748B',
    },
    chipTextActive: {
        color: '#059669',
    },
    chipTextPartial: {
        color: '#D97706',
    },

    // ── Mode Row ──
    modeRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 20,
    },

    // ── Remarks ──
    remarksInput: {
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#CBD5E1',
        borderRadius: 14,
        padding: 14,
        fontSize: 14,
        color: isDark ? '#F9FAFB' : '#111827',
        height: 80,
        textAlignVertical: 'top',
        marginBottom: 4,
    },
    addNoteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 10,
        alignSelf: 'flex-start',
    },
    addNoteText: {
        fontSize: 13,
        fontWeight: '700',
        color: isDark ? '#A5B4FC' : '#4F46E5',
    },

    // ── Summary ──
    summaryCard: {
        backgroundColor: isDark ? '#1C1F2A' : '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
    },

    // ── Pay Button ──
    payBtn: {
        backgroundColor: '#059669',
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#059669',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.35,
                shadowRadius: 12,
            },
            android: { elevation: 6 },
        }),
    },
    stickyPayBtn: {
        paddingHorizontal: 22,
        minWidth: 220,
    },
    payBtnPartial: {
        backgroundColor: '#D97706',
    },
    payBtnDisabled: {
        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
        shadowOpacity: 0,
        elevation: 0,
    },
    payBtnTextDisabled: {
        color: isDark ? '#94A3B8' : '#64748B',
    },
    payBtnInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    payBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    payBtnArrow: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 18,
        fontWeight: '600',
    },
    stickyBar: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 16,
        maxWidth: 1088,
        width: '100%',
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        paddingVertical: 14,
        paddingHorizontal: 18,
        borderRadius: 20,
        backgroundColor: isDark ? '#0F172A' : '#111827',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.28,
                shadowRadius: 18,
            },
            android: { elevation: 10 },
        }),
    },
    stickyMode: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    stickyLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.55)',
        marginBottom: 2,
    },
    stickyAmount: {
        fontSize: 22,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: -0.4,
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginBottom: 12,
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
    },
    errorBannerText: {
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '600',
    },
    upiQrSection: {
        marginBottom: 12,
        padding: 18,
        borderRadius: 18,
        backgroundColor: isDark ? '#1C1F2A' : '#FFFFFF',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(79,70,229,0.35)' : '#C7D2FE',
    },
    upiQrHead: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 14,
    },
    upiQrIcon: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isDark ? 'rgba(79,70,229,0.2)' : '#EEF2FF',
    },
    upiQrTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: isDark ? '#C7D2FE' : '#3730A3',
    },
    upiQrSub: {
        fontSize: 12,
        lineHeight: 16,
        marginTop: 2,
        color: isDark ? 'rgba(255,255,255,0.55)' : '#64748B',
        fontWeight: '600',
    },
    upiQrCenter: { alignItems: 'center', paddingVertical: 24, gap: 10 },
    upiQrMuted: { fontSize: 13, color: isDark ? 'rgba(255,255,255,0.45)' : '#6B7280' },
    upiQrWarn: { paddingVertical: 8, gap: 6 },
    upiQrWarnText: { fontSize: 13, lineHeight: 20, color: '#F87171', fontWeight: '600' },
    upiQrLink: { marginTop: 10, fontSize: 13, fontWeight: '700', color: '#3B82F6' },
    upiQrFrame: {
        alignSelf: 'center',
        padding: 14,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        marginBottom: 14,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
            android: { elevation: 4 },
            default: {},
        }),
    },
    upiQrMeta: { marginBottom: 12, gap: 8 },
    upiMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    upiQrMetaLine: { flex: 1, fontSize: 13, color: isDark ? '#E5E7EB' : '#374151', fontWeight: '700' },
    upiQrMetaLab: { fontWeight: '700', color: isDark ? 'rgba(251,191,36,0.9)' : '#B45309' },
    upiShareBtn: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 10,
        backgroundColor: isDark ? 'rgba(79,70,229,0.2)' : '#EEF2FF',
        marginBottom: 12,
    },
    upiShareBtnText: { fontSize: 13, fontWeight: '800', color: '#4F46E5' },
    upiHintRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    upiLedgerHint: {
        flex: 1,
        fontSize: 12,
        lineHeight: 18,
        color: isDark ? '#6EE7B7' : '#047857',
        fontWeight: '700',
    },
});