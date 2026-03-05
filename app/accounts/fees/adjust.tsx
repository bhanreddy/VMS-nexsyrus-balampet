import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AdminHeader from '../../../src/components/AdminHeader';
import { FeeService } from '../../../src/services/feeService';
import { useTheme } from '../../../src/hooks/useTheme';
import { Theme } from '../../../src/theme/themes';
import LogoLoader from '../../../src/components/LogoLoader';
export default function AdjustFeeScreen() {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const router = useRouter();
  const params = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const feeId = params.feeId as string;
  const studentName = params.name as string;
  const feeType = params.feeType as string;
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const handleAdjust = async () => {
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid waiver amount.");
      return;
    }
    if (!reason || reason.length < 5) {
      Alert.alert("Reason Required", "Please provide a detailed justification for this waiver (min 5 characters).");
      return;
    }

    // RISK WARNING
    Alert.alert("POTENTIAL REVENUE IMPACT", `You are about to waive ₹${amountNum} for ${studentName}'s ${feeType}. This cannot be reversed easily. Proceed?`, [{
      text: "Cancel",
      style: "cancel"
    }, {
      text: "Authorize Waiver",
      style: "destructive",
      onPress: async () => {
        setLoading(true);
        try {
          await FeeService.adjustFee({
            student_fee_id: feeId,
            amount: amountNum,
            reason: reason
          });
          Alert.alert("Success", "Waiver applied and logged.", [{
            text: "OK",
            onPress: () => router.back()
          }]);
        } catch (error: any) {
          Alert.alert("Waiver Failed", error.message || "Failed to record adjustment.");
        } finally {
          setLoading(false);
        }
      }
    }]);
  };
  return <View style={styles.container}>
            <AdminHeader title="Issue Waiver/Adjustment" showBackButton={true} />
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.warningBox}>
                    <Text style={styles.warningText}>
                        AUDIT NOTICE: Every adjustment is logged with your User ID. Unauthorized waivers are subject to financial audit.
                    </Text>
                </View>

                <View style={styles.infoCard}>
                    <Text style={styles.label}>Student</Text>
                    <Text style={styles.value}>{studentName}</Text>
                    <View style={styles.divider} />
                    <Text style={styles.label}>Fee Component</Text>
                    <Text style={styles.value}>{feeType}</Text>
                </View>

                <View style={styles.form}>
                    <Text style={styles.inputLabel}>Waiver Amount (₹)</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={amount} onChangeText={setAmount} placeholder="0.00" />

                    <Text style={styles.inputLabel}>Justification / Reason (Mandatory)</Text>
                    <TextInput style={[styles.input, styles.textArea]} multiline numberOfLines={4} value={reason} onChangeText={setReason} placeholder="Enter official reason for adjustment..." />

                    <TouchableOpacity style={[styles.btn, loading && styles.disabledBtn]} onPress={handleAdjust} disabled={loading}>
                        {loading ? <LogoLoader color="#fff" /> : <Text style={styles.btnText}>Apply Adjustment</Text>}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>;
}
const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.card
  },
  content: {
    padding: 20
  },
  warningBox: {
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    marginBottom: 20
  },
  warningText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '600'
  },
  infoCard: {
    backgroundColor: theme.colors.background,
    padding: 20,
    borderRadius: 16,
    marginBottom: 20
  },
  label: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4
  },
  value: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937'
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.card,
    marginVertical: 12
  },
  form: {
    backgroundColor: theme.colors.background,
    padding: 20,
    borderRadius: 16
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8
  },
  input: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 20
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top'
  },
  btn: {
    backgroundColor: '#6366F1',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center'
  },
  btnText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: 'bold'
  },
  disabledBtn: {
    opacity: 0.7
  }
});