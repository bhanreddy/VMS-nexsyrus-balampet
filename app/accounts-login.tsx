import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, KeyboardAvoidingView, Platform, ScrollView, StatusBar, Modal, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/hooks/useAuth';
import AnimatedInput from '@/src/components/AnimatedInput';
import PremiumButton from '@/src/components/PremiumButton';
import AuthHeader from '@/src/components/AuthHeader';
import { Alert } from 'react-native';
import AuthService from '@/src/services/authService';
import LogoLoader from '../src/components/LogoLoader';
import { AccessControlService } from '@/src/services/accessControlService';

const { width } = Dimensions.get('window');

const AccountsLoginScreen: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const [loading, setLoading] = useState<boolean>(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const [showAccessModal, setShowAccessModal] = useState(false);
  const [accessReason, setAccessReason] = useState('');
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [restrictedUserId, setRestrictedUserId] = useState<string | null>(null);

  const { user, loading: authLoading } = useAuth();

  if (authLoading || user) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <LogoLoader size={60} color="#D97706" />
      </SafeAreaView>);

  }

  const handleLogin = async () => {
    if (!email || !password) {
      setError(true);
      Alert.alert('Required Fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const { user } = await AuthService.login(email, password);
      if (user.role === 'accountant') {
        if (__DEV__) { }
      } else {
        Alert.alert('Unauthorized Access', 'This portal is restricted to Accounts Department personnel only. Your attempt has been logged.', [
          { text: 'OK', onPress: () => AuthService.logout() }]
        );
      }
    } catch (error: any) {
      if (error.code === 'OUT_OF_HOURS_NO_ACCESS' && error.userId) {
        setRestrictedUserId(error.userId);
        setShowAccessModal(true);
      } else {
        if (__DEV__) { }
        Alert.alert('Login Failed', error.message || 'Invalid credentials');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAccess = async () => {
    if (!restrictedUserId) return;
    setRequestingAccess(true);
    try {
      await AccessControlService.requestOutOfHoursAccess(restrictedUserId, 'accounts', accessReason);
      Alert.alert('Request Sent', 'Your request has been sent to the Admin for approval.');
      setShowAccessModal(false);
      setAccessReason('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit request');
    } finally {
      setRequestingAccess(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false} bounces={false}>

          {/* Unified Premium Header */}
          <AuthHeader
            title={t('login.accounts') || "Accounts Portal"}
            subtitle="Manage finances, fees, and payroll."
            glowColor="rgba(217,119,6,0.15)" // #D97706 Orange/Amber
          />

          {/* Overlapping Form Body */}
          <View style={styles.bodyContainer}>
            <View style={styles.overlapSection}>

              <Animated.View entering={FadeInDown.delay(200).duration(600).springify()} style={styles.formCard}>
                <Text style={styles.welcomeBackText}>{t('login.welcome_back') || "Welcome Back"}</Text>
                <Text style={styles.subtitleText}>{t('login.signin_accounts') || "Sign in to accounts panel"}</Text>

                <View style={styles.inputWrapper}>
                  <AnimatedInput
                    icon={({ color }) => <FontAwesome5 name="user-alt" size={18} color={color} style={styles.inputIcon} />}
                    placeholder={t('emailAddress') || "Accountant Email"}
                    value={email}
                    onChangeText={(text) => { setEmail(text); setError(false); }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    error={error && !email}
                    accentColor="#D97706" />

                </View>

                <View style={styles.inputWrapper}>
                  <AnimatedInput
                    icon={({ color }) => <Ionicons name="lock-closed-outline" size={20} color={color} style={styles.inputIcon} />}
                    placeholder={t('login.enter_pass')}
                    value={password}
                    onChangeText={(text) => { setPassword(text); setError(false); }}
                    secureTextEntry={!showPassword}
                    error={error && !password}
                    accentColor="#D97706"
                    rightAccessory={
                      <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                        <Ionicons name={showPassword ? "eye-off" : "eye"} size={22} color="#94A3B8" />
                      </TouchableOpacity>
                    } />

                </View>

                <Animated.View entering={FadeInDown.delay(300).duration(600)}>
                  <TouchableOpacity style={styles.forgotPasswordContainer} onPress={() => router.push('/forgot-password')}>
                    <Text style={styles.forgotPasswordText}>{t('login.forgot_pass')}</Text>
                  </TouchableOpacity>
                </Animated.View>

                <Animated.View entering={FadeInUp.delay(400).springify()}>
                  <PremiumButton
                    title={t('login.login_btn')}
                    onPress={handleLogin}
                    loading={loading}
                    colors={['#F59E0B', '#D97706']} // Amber to Orange
                    icon={<Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />} />

                </Animated.View>
              </Animated.View>

            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Access Restricted Modal */}
      <Modal visible={showAccessModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowAccessModal(false)} activeOpacity={1} />
          <Animated.View
            entering={SlideInDown.springify().damping(15)}
            exiting={SlideOutDown}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="lock-closed" size={32} color="#D97706" />
              </View>
              <Text style={styles.modalTitle}>Access Restricted</Text>
              <Text style={styles.modalSubtitle}>
                The Accounts portal is restricted to school hours. You need administrator approval to log in.
              </Text>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Reason for access (optional)</Text>
              <TextInput
                style={styles.reasonInput}
                placeholder="Why do you need access outside hours?"
                placeholderTextColor="#94A3B8"
                value={accessReason}
                onChangeText={setAccessReason}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAccessModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <PremiumButton
                title="Request Access"
                onPress={handleRequestAccess}
                loading={requestingAccess}
                colors={['#F59E0B', '#D97706']}
                style={{ flex: 1, marginLeft: 12 }}
              />
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>);

};

export default AccountsLoginScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1, backgroundColor: '#F8FAFC' },

  bodyContainer: {
    flex: 1,
    paddingHorizontal: 24
  },
  overlapSection: {
    marginTop: -60, // 100x SaaS Layout Technique
    zIndex: 20,
    paddingBottom: 40
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 24 },
      android: { elevation: 4 }
    }),
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)'
  },

  welcomeBackText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    letterSpacing: -0.5
  },
  subtitleText: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 32,
    fontWeight: '500'
  },
  inputWrapper: {
    marginBottom: 16 // Strict 8pt spacing
  },
  inputIcon: {
    marginRight: 12
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: 32,
    marginTop: 4 // Fine-tuned vertical rhythm
  },
  forgotPasswordText: {
    color: '#D97706', // Orange 600
    fontWeight: '600',
    fontSize: 13
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 20,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(217, 119, 6, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  modalBody: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  reasonInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    color: '#0F172A',
    minHeight: 100,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '600',
  }
});