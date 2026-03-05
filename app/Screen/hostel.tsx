import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import ScreenLayout from '../../src/components/ScreenLayout';
import StudentHeader from '../../src/components/StudentHeader';
import { useAuth } from '../../src/hooks/useAuth';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
const HostelProfileScreen = () => {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const {
    user
  } = useAuth();
  return <ScreenLayout>

            {/* ===== HEADER ===== */}
            <StudentHeader showBackButton={true} title="Hostel" />

            {/* ===== CONTENT ===== */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>

                {/* ===== TITLE ===== */}
                <Text style={styles.pageTitle}>Hostel Profile</Text>

                {/* ===== STUDENT HOSTEL INFO ===== */}
                <Text style={styles.sectionTitle}>Student Hostel Information</Text>

                <View style={styles.infoCard}>
                    <InfoRow label="Name" value={user?.name || 'Student'} />
                    <InfoRow label="Hostel No" value={(user as any)?.hostelBlock || 'N/A'} />
                    <InfoRow label="Warden No" value="**********" />
                    <InfoRow label="Hostel Name" value={(user as any)?.hostelName || 'Not Assigned'} />
                </View>

                {/* ===== HOSTEL DETAILS ===== */}
                <Text style={styles.sectionTitle}>Hostel Details</Text>

                <View style={styles.detailsCard}>
                    <InfoRow label="Room Type" value="2 Sharing" />
                    <InfoRow label="Facilities" value="AC / Non-AC" />

                    <View style={styles.locationRow}>
                        <Text style={styles.label}>Location</Text>
                        <TouchableOpacity>
                            <Text style={styles.mapLink}>View on Maps</Text>
                        </TouchableOpacity>
                    </View>

                    <InfoRow label="Hostel Fee" value="₹ ——— / Year" />
                </View>

                {/* ===== HOSTEL IMAGE ===== */}
                <View style={styles.imageCard}>
                    <View style={styles.imagePlaceholder}>
                        <Text style={styles.imageText}>Hostel Image</Text>
                    </View>
                </View>

                {/* ===== APPLY CTA ===== */}
                <TouchableOpacity style={styles.applyButton} activeOpacity={0.85} onPress={() => {
        // TODO: initiate call / application
      }}>
                    <Text style={styles.applyText}>📞 Call to Apply</Text>
                </TouchableOpacity>

            </ScrollView>

        </ScreenLayout>;
};
export default HostelProfileScreen;

/* ====================== SMALL COMPONENT ====================== */

const InfoRow = ({
  label,
  value
}: {
  label: string;
  value: string;
}) => {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  return <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
    </View>;
};

/* ============================ STYLES ============================ */

const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 30
  },
  /* Titles */
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
    marginTop: 14
  },
  /* Cards */
  infoCard: {
    backgroundColor: '#d8ecef',
    borderRadius: 18,
    padding: 16,
    elevation: 3
  },
  detailsCard: {
    backgroundColor: '#f7f7f7',
    borderRadius: 18,
    padding: 16,
    elevation: 2
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderColor: '#ddd'
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text
  },
  value: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    maxWidth: '60%',
    textAlign: 'right'
  },
  /* Location */
  locationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6
  },
  mapLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563eb'
  },
  /* Image */
  imageCard: {
    marginTop: 16,
    borderRadius: 18,
    overflow: 'hidden',
    elevation: 4
  },
  imagePlaceholder: {
    height: 200,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center'
  },
  imageText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#555'
  },
  /* CTA */
  applyButton: {
    marginTop: 20,
    backgroundColor: '#22c55e',
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    elevation: 4
  },
  applyText: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.background
  }
});