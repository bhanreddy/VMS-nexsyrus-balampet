import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNetBalance } from '../hooks/useNetBalance';
import Animated, { FadeInDown } from 'react-native-reanimated';
import LogoLoader from './LogoLoader';

// Helper to format currency
const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
};

type FilterType = 'all' | 'this_month' | 'last_month' | 'academic_year' | 'custom';

export default function NetBalanceTab() {
    const { data, loading, error, fetchNetBalance } = useNetBalance();
    const [activeFilter, setActiveFilter] = useState<FilterType>('this_month');

    // Date ranges
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        calculateDateRange(activeFilter);
    }, [activeFilter]);

    useEffect(() => {
        if (startDate && endDate) {
            fetchNetBalance(startDate, endDate);
        }
    }, [startDate, endDate]);

    const calculateDateRange = (filter: FilterType) => {
        const now = new Date();
        let start = new Date();
        let end = new Date();

        switch (filter) {
            case 'this_month':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                break;
            case 'last_month':
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                end = new Date(now.getFullYear(), now.getMonth(), 0);
                break;
            case 'academic_year':
                // Assuming Academic Year starts roughly around June. 
                // Logic: If current month < June (5), then start is June prev year. Else June curr year.
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();
                if (currentMonth < 5) { // Jan - May
                    start = new Date(currentYear - 1, 5, 1); // June 1st prev year
                } else {
                    start = new Date(currentYear, 5, 1); // June 1st curr year
                }
                // End is always today for "Year to Date" logic usually, or end of academic year logic.
                // Let's us today as end date for range.
                end = now;
                break;
            case 'all':
                start = new Date(2020, 0, 1); // Specific epoch
                end = now;
                break;
            case 'custom':
                // TODO: Implement custom date picker
                // For now distinct from 'this_month' logic to avoid immediate fetch if we had a picker
                return;
        }

        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(end.toISOString().split('T')[0]);
    };

    const SummaryCard = ({ title, amount, icon, color, index }: any) => (
        <Animated.View
            entering={FadeInDown.delay(index * 100).duration(500)}
            style={[styles.card, { borderLeftColor: color, borderLeftWidth: 4 }]}
        >
            <View style={[styles.iconBox, { backgroundColor: color + '20' }]}>
                <MaterialCommunityIcons name={icon} size={24} color={color} />
            </View>
            <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{title}</Text>
                <Text style={[styles.cardAmount, { color }]}>
                    {formatCurrency(amount || 0)}
                </Text>
            </View>
        </Animated.View>
    );

    return (
        <View style={styles.container}>
            {/* Filters */}
            <View style={styles.filterContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {[
                        { id: 'this_month', label: 'This Month' },
                        { id: 'last_month', label: 'Last Month' },
                        { id: 'academic_year', label: 'Academic Year' },
                        { id: 'all', label: 'All Time' },
                    ].map((f) => (
                        <TouchableOpacity
                            key={f.id}
                            style={[
                                styles.filterChip,
                                activeFilter === f.id && styles.activeFilterChip
                            ]}
                            onPress={() => setActiveFilter(f.id as FilterType)}
                        >
                            <Text style={[
                                styles.filterText,
                                activeFilter === f.id && styles.activeFilterText
                            ]}>
                                {f.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <LogoLoader size={60} color="#6366F1" />
                </View>
            ) : error ? (
                <View style={styles.centered}>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity
                        style={styles.retryBtn}
                        onPress={() => fetchNetBalance(startDate, endDate)}
                    >
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : data ? (
                <ScrollView contentContainerStyle={styles.content}>
                    <SummaryCard
                        index={0}
                        title="Total Fee Collected"
                        amount={data.totalFee}
                        icon="cash-plus"
                        color="#3B82F6" // Blue
                    />

                    <SummaryCard
                        index={1}
                        title="Total Salary Paid"
                        amount={data.totalSalary}
                        icon="account-cash"
                        color="#F59E0B" // Orange
                    />

                    <SummaryCard
                        index={2}
                        title="Other Expenses"
                        amount={data.totalExpenses}
                        icon="cash-minus"
                        color="#8B5CF6" // Purple
                    />

                    {/* Net Balance (Large) */}
                    <Animated.View
                        entering={FadeInDown.delay(300).duration(500)}
                        style={[
                            styles.balanceCard,
                            { backgroundColor: data.netBalance >= 0 ? '#DCFCE7' : '#FEE2E2' }
                        ]}
                    >
                        <Text style={styles.balanceLabel}>Net Balance</Text>
                        <Text style={[
                            styles.balanceAmount,
                            { color: data.netBalance >= 0 ? '#166534' : '#991B1B' }
                        ]}>
                            {data.netBalance >= 0 ? '+' : ''}{formatCurrency(data.netBalance)}
                        </Text>
                        <Text style={styles.balanceSub}>
                            {data.netBalance >= 0 ? 'Surplus' : 'Deficit'}
                        </Text>
                    </Animated.View>
                </ScrollView>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    filterContainer: {
        paddingVertical: 15,
        paddingHorizontal: 15,
        backgroundColor: '#fff',
        marginBottom: 10,
        elevation: 1,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        marginRight: 10,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    activeFilterChip: {
        backgroundColor: '#EEF2FF',
        borderColor: '#6366F1',
    },
    filterText: {
        color: '#4B5563',
        fontSize: 13,
        fontWeight: '500',
    },
    activeFilterText: {
        color: '#6366F1',
        fontWeight: 'bold',
    },
    content: {
        padding: 15,
        paddingBottom: 100,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 300,
    },
    card: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 15,
        marginBottom: 15,
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    cardContent: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
    },
    cardAmount: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    balanceCard: {
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        marginTop: 10,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    balanceLabel: {
        fontSize: 16,
        color: '#4B5563',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    balanceAmount: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    balanceSub: {
        fontSize: 14,
        fontWeight: '600',
        opacity: 0.7,
        color: '#374151',
    },
    errorText: {
        color: '#EF4444',
        marginBottom: 10,
    },
    retryBtn: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#E5E7EB',
        borderRadius: 8,
    },
    retryText: {
        color: '#374151',
        fontWeight: '600',
    },
});
