import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import ScreenLayout from '../../src/components/ScreenLayout';
import StudentHeader from '../../src/components/StudentHeader';
import { useAuth } from '../../src/hooks/useAuth';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
export default function InsuranceScreen() {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const {
    user
  } = useAuth();
  return <ScreenLayout>
            <StudentHeader showBackButton={true} title="Insurance" />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
                {/* INSURANCE CARD */}
                <View style={styles.insuranceCard}>
                    <Text style={styles.planTitle}>Active Insurance Plan</Text>

                    <View style={styles.planRow}>
                        <Text style={styles.label}>Student Name</Text>
                        <Text style={styles.value}>{user?.name || 'Student'}</Text>
                    </View>

                    <View style={styles.planRow}>
                        <Text style={styles.label}>Policy Number</Text>
                        <Text style={styles.value}>NX-INS-2025-001</Text>
                    </View>

                    <View style={styles.planRow}>
                        <Text style={styles.label}>Coverage Amount</Text>
                        <Text style={styles.coverage}>₹5,00,000</Text>
                    </View>

                    <View style={styles.statusBadge}>
                        <Text style={styles.statusText}>ACTIVE</Text>
                    </View>
                </View>

                {/* COVERAGE DETAILS */}
                <Text style={styles.sectionTitle}>Coverage Includes</Text>

                <View style={styles.coverageCard}>
                    <CoverageItem icon="medical" text="Accidental Injuries" />
                    <CoverageItem icon="local-hospital" text="Hospitalization" />
                    <CoverageItem icon="healing" text="Emergency Treatment" />
                    <CoverageItem icon="directions-bus" text="School Travel Safety" />
                </View>

                {/* CLAIM PROCESS */}
                <Text style={styles.sectionTitle}>How to Claim</Text>

                <View style={styles.stepCard}>
                    <Text style={styles.step}>1. Inform School Admin</Text>
                    <Text style={styles.step}>2. Visit Nearest Hospital</Text>
                    <Text style={styles.step}>3. Submit Medical Reports</Text>
                    <Text style={styles.step}>4. Claim Processed by Insurance Team</Text>
                </View>

                {/* EMERGENCY */}
                <View style={styles.emergencyCard}>
                    <Ionicons name="call" size={24} color="#fff" />
                    <View style={{
          marginLeft: 12
        }}>
                        <Text style={styles.emergencyTitle}>Emergency Helpline</Text>
                        <Text style={styles.emergencyNumber}>1800 123 456</Text>
                    </View>
                </View>

                {/* ACTION BUTTONS */}
                <TouchableOpacity style={styles.primaryBtn}>
                    <Text style={styles.primaryBtnText}>Download Insurance Card</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryBtn}>
                    <Text style={styles.secondaryBtnText}>Contact Support</Text>
                </TouchableOpacity>
            </ScrollView>
        </ScreenLayout>;
}

/* 🔹 Coverage Item Component */
const CoverageItem = ({
  icon,
  text
}: any) => {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  return <View style={styles.coverageItem}>
        <MaterialIcons name={icon} size={22} color="#4F46E5" />
        <Text style={styles.coverageText}>{text}</Text>
    </View>;
};
const getStyles = (theme: Theme) => StyleSheet.create({
  scrollContainer: {
    paddingBottom: 20
  },
  insuranceCard: {
    backgroundColor: theme.colors.primary,
    margin: 16,
    borderRadius: 20,
    padding: 18,
    elevation: 6
  },
  planTitle: {
    fontSize: 16,
    color: "#E0E7FF",
    marginBottom: 10
  },
  planRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 6
  },
  label: {
    color: "#C7D2FE",
    fontSize: 13
  },
  value: {
    color: theme.colors.background,
    fontSize: 14,
    fontWeight: "600"
  },
  coverage: {
    color: "#22C55E",
    fontSize: 16,
    fontWeight: "700"
  },
  statusBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#22C55E",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 10
  },
  statusText: {
    color: theme.colors.background,
    fontWeight: "700",
    fontSize: 12
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginHorizontal: 16,
    marginTop: 10
  },
  coverageCard: {
    backgroundColor: theme.colors.background,
    margin: 16,
    borderRadius: 18,
    padding: 14
  },
  coverageItem: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8
  },
  coverageText: {
    marginLeft: 10,
    fontSize: 15,
    fontWeight: "500"
  },
  stepCard: {
    backgroundColor: theme.colors.background,
    margin: 16,
    borderRadius: 18,
    padding: 16
  },
  step: {
    fontSize: 14,
    marginVertical: 6
  },
  emergencyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EF4444",
    margin: 16,
    borderRadius: 18,
    padding: 16
  },
  emergencyTitle: {
    color: theme.colors.background,
    fontSize: 14
  },
  emergencyNumber: {
    color: theme.colors.background,
    fontSize: 18,
    fontWeight: "700"
  },
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 14,
    alignItems: "center"
  },
  primaryBtnText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: "700"
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    margin: 16,
    borderRadius: 16,
    padding: 14,
    alignItems: "center"
  },
  secondaryBtnText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: "700"
  }
});