import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, KeyboardAvoidingView, Platform, ScrollView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/hooks/useAuth';
import AnimatedInput from '@/src/components/AnimatedInput';
import PremiumButton from '@/src/components/PremiumButton';
import AuthHeader from '@/src/components/AuthHeader';
import { Alert } from 'react-native';
import AuthService from '@/src/services/authService';
import LogoLoader from '../src/components/LogoLoader';

const { width } = Dimensions.get('window');

const AdminLoginScreen: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const [loading, setLoading] = useState<boolean>(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const { user, loading: authLoading } = useAuth();

  if (authLoading || user) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <LogoLoader size={60} color="#7C3AED" />
      </SafeAreaView>);

  }

  const handleLogin = async () => {
    if (!email || !password) {
      setError(true);
      Alert.alert('Error', t('login.enter_id') + ' & ' + t('login.enter_pass'));
      return;
    }
    setLoading(true);
    try {
      const response = await AuthService.login(email, password);
      const role = response.user.role;
      if (role === 'admin') {
        if (__DEV__) {}
      } else {
        Alert.alert('Access Denied', 'You do not have administrative privileges.');
        await AuthService.logout();
      }
    } catch (error: any) {
      if (__DEV__) {}
      Alert.alert('Login Failed', error.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false} bounces={false}>

          {/* Unified Premium Header */}
          <AuthHeader
            title={t('login.admin') || "Admin Portal"}
            subtitle="Full system control and reporting."
            glowColor="rgba(124,58,237,0.15)" // #7C3AED Purple
            showLangToggle={false} />

          {/* Overlapping Form Body */}
          <View style={styles.bodyContainer}>
            <View style={styles.overlapSection}>

              <Animated.View entering={FadeInDown.delay(200).duration(600).springify()} style={styles.formCard}>
                <Text style={styles.welcomeBackText}>{t('login.welcome_admin') || "Welcome, Admin"}</Text>
                <Text style={styles.subtitleText}>{t('login.signin_admin') || "Sign in to the control panel"}</Text>

                <View style={styles.inputWrapper}>
                  <AnimatedInput
                    icon={({ color }) => <FontAwesome5 name="user-tie" size={18} color={color} style={styles.inputIcon} />}
                    placeholder="Admin Email"
                    value={email}
                    onChangeText={(text) => {setEmail(text);setError(false);}}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    error={error && !email}
                    accentColor="#7C3AED" />

                </View>

                <View style={styles.inputWrapper}>
                  <AnimatedInput
                    icon={({ color }) => <Ionicons name="lock-closed-outline" size={20} color={color} style={styles.inputIcon} />}
                    placeholder={t('login.enter_pass')}
                    value={password}
                    onChangeText={(text) => {setPassword(text);setError(false);}}
                    secureTextEntry={!showPassword}
                    error={error && !password}
                    accentColor="#7C3AED"
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
                    colors={['#8B5CF6', '#7C3AED']} // Violet to Purple
                    icon={<Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />} />

                </Animated.View>
              </Animated.View>

            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>);

};

export default AdminLoginScreen;

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
    color: '#7C3AED', // Purple 600
    fontWeight: '600',
    fontSize: 13
  }
});