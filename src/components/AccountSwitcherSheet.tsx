import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Image,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import {
  KeyboardAvoidingView,
  KeyboardAwareScrollView,
} from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { alertCompat } from '../utils/crossPlatformAlert';
import * as accountVault from '../services/accountVault';
import type { VaultAccount } from '../services/accountVault';
import {
  getHomeRouteForRole,
} from '../utils/portalRoutes';
import {
  ensureFreshAccessTokens,
  getUnreadCountsForAllVaultedAccounts,
  removeVaultedAccount,
} from '../services/pushFanout';
import ClayPasswordToggle from './ClayPasswordToggle';
import { useSurfaceMaterials, useSurfaceStyleMap } from '../theme/surfaceStyles';
import { schoolColorWithAlpha } from '../constants/schoolConfig';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

const FALLBACK_AVATAR = 'https://cdn-icons-png.flaticon.com/512/2922/2922506.png';

/** Small raised clay puck (avatar rings, icon buttons, chips). */
function raisedPuck(isDark: boolean, tint?: string): object {
  if (Platform.OS === 'web') {
    const drop = tint
      ? schoolColorWithAlpha(tint, isDark ? 0.42 : 0.28)
      : isDark
        ? 'rgba(0,0,0,0.55)'
        : 'rgba(148,163,184,0.42)';
    const light = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.95)';
    const innerHi = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.95)';
    const innerLo = tint
      ? schoolColorWithAlpha(tint, isDark ? 0.35 : 0.18)
      : isDark
        ? 'rgba(0,0,0,0.45)'
        : 'rgba(148,163,184,0.22)';
    return {
      boxShadow: `4px 5px 12px ${drop}, -3px -3px 10px ${light}, inset 1.5px 1.5px 3px ${innerHi}, inset -2px -2px 4px ${innerLo}`,
    };
  }
  return {
    shadowColor: tint || (isDark ? '#000' : '#94A3B8'),
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: isDark ? 0.4 : 0.22,
    shadowRadius: 6,
    elevation: 3,
  };
}

/** Soft embossed clay for list rows — lighter than clay('sm') so stacks don't mud. */
function raisedRow(isDark: boolean, accent?: string): object {
  if (Platform.OS === 'web') {
    const drop = accent
      ? schoolColorWithAlpha(accent, isDark ? 0.38 : 0.26)
      : isDark
        ? 'rgba(0,0,0,0.5)'
        : 'rgba(148,163,184,0.38)';
    const light = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.92)';
    const innerHi = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)';
    const innerLo = accent
      ? schoolColorWithAlpha(accent, isDark ? 0.28 : 0.14)
      : isDark
        ? 'rgba(0,0,0,0.35)'
        : 'rgba(148,163,184,0.18)';
    return {
      boxShadow: `6px 7px 16px ${drop}, -5px -5px 14px ${light}, inset 2px 2px 4px ${innerHi}, inset -2px -3px 5px ${innerLo}`,
    };
  }
  return {
    shadowColor: accent || (isDark ? '#000' : '#64748B'),
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.35 : 0.14,
    shadowRadius: 8,
    elevation: 3,
    borderBottomWidth: 1.5,
    borderBottomColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(148,163,184,0.22)',
  };
}

/** Pressed-in clay chip / grabber. */
function raisedInsetSoft(isDark: boolean): object {
  if (Platform.OS === 'web') {
    const lo = isDark ? 'rgba(0,0,0,0.55)' : 'rgba(148,163,184,0.4)';
    const hi = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.9)';
    return {
      boxShadow: `inset 3px 3px 6px ${lo}, inset -2px -2px 5px ${hi}`,
    };
  }
  return {
    borderWidth: 1,
    borderColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(148,163,184,0.28)',
  };
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

function localizedAccountSubtitle(acct: VaultAccount, t: TFunction): string {
  const roleCode = acct.validatedUser?.role?.code;
  const role = roleCode === 'librarian' ? 'Librarian' : roleCode === 'student' || roleCode === 'parent'
    ? t('driver_ui.parent')
    : roleCode === 'staff' || roleCode === 'teacher'
      ? t('driver_ui.staff')
      : roleCode === 'admin' || roleCode === 'principal'
        ? t('driver_ui.admin')
        : roleCode === 'accountant' || roleCode === 'accounts'
          ? t('driver_ui.accounts')
          : roleCode === 'driver'
            ? t('driver_ui.driver')
            : t('driver_ui.account');
  const detail = roleCode === 'student' || roleCode === 'parent'
    ? acct.classLabel || acct.admissionNo
    : roleCode === 'staff' || roleCode === 'teacher'
      ? acct.validatedUser?.staff_code
      : null;
  return detail ? `${role} · ${detail}` : role;
}

/**
 * AccountSwitcherSheet — direct multi-login switcher (no admin setup).
 *
 * Each saved account uses its own email & password (parent login, staff login, etc.).
 * Tap to switch instantly, or add another login you already have.
 */
export default function AccountSwitcherSheet({ visible, onClose }: Props) {
  const { raised: clay, card: clayCard, inset: clayInset, puck: clayPuck, row: clayRow, softInset: clayInsetSoft } = useSurfaceMaterials({ puck: raisedPuck, row: raisedRow, softInset: raisedInsetSoft });

  const { switchAccount, addAccount, signOut } = useAuth();
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { t } = useTranslation();

  const [accounts, setAccounts] = useState<VaultAccount[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [addMode, setAddMode] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const primary = theme.colors.primary as string;

  const load = useCallback(async (refreshTokens = true) => {
    setLoading(true);
    try {
      if (refreshTokens) {
        await ensureFreshAccessTokens().catch(() => {});
      }
      const [accs, active] = await Promise.all([
        accountVault.listAccounts(),
        accountVault.getActiveAccountId(),
      ]);
      setAccounts(accs);
      setActiveId(active);
    } catch {
      /* vault read failures shouldn't crash the sheet */
    } finally {
      setLoading(false);
    }
    getUnreadCountsForAllVaultedAccounts()
      .then(setCounts)
      .catch(() => { /* badges simply don't show */ });
  }, []);

  useEffect(() => {
    if (visible) {
      setAddMode(false);
      setAddEmail('');
      setAddPassword('');
      setShowAddPassword(false);
      setAddError(null);
      setFocusedField(null);
      load();
    }
  }, [visible, load]);

  useEffect(() => {
    if (!addMode) return;
    const id = requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => cancelAnimationFrame(id);
  }, [addMode]);

  const onSwitch = async (userId: string) => {
    if (busyId) return;
    if (userId === activeId) {
      onClose();
      return;
    }
    setBusyId(userId);
    try {
      const res = await switchAccount(userId);
      if (res?.error) {
        alertCompat(t('driver_ui.could_not_switch'), t('driver_ui.please_try_again'));
        return;
      }
      if (res?.session?.validatedUser?.role?.code) {
        router.replace(getHomeRouteForRole(res.session.validatedUser.role.code) as any);
      }
      onClose();
    } finally {
      setBusyId(null);
    }
  };

  const openQrAdd = () => {
    onClose();
    router.push('/qr-login?mode=add' as never);
  };

  const onAdd = async () => {
    if (addBusy) return;
    if (!addEmail.trim() || !addPassword) {
      setAddError(t('driver_ui.enter_email_password'));
      return;
    }
    setAddBusy(true);
    setAddError(null);
    try {
      const res = await addAccount(addEmail.trim(), addPassword);
      if (res?.error) {
        setAddError(t('driver_ui.could_not_add_account'));
        return;
      }
      if (res?.session) {
        await switchAccount(res.session.validatedUser.userId);
        router.replace(getHomeRouteForRole(res.session.validatedUser.role?.code) as any);
        onClose();
      }
    } catch {
      setAddError(t('driver_ui.could_not_add_account'));
    } finally {
      setAddBusy(false);
    }
  };

  const onRemove = (acct: VaultAccount) => {
    if (busyId) return;
    const isActive = acct.userId === activeId;
    const name = acct.displayName || t('driver_ui.this_account');
    alertCompat(
      isActive ? t('driver_ui.log_out') : t('driver_ui.remove_account'),
      isActive
        ? t('driver_ui.log_out_account_question', { name })
        : t('driver_ui.remove_account_question', { name }),
      [
        { text: t('driver_ui.cancel'), style: 'cancel' },
        {
          text: isActive ? t('driver_ui.log_out') : t('driver_ui.remove'),
          style: 'destructive',
          onPress: async () => {
            setBusyId(acct.userId);
            try {
              if (isActive) {
                onClose();
                await signOut();
                router.replace('/welcome');
              } else {
                await removeVaultedAccount(acct.userId);
                await load();
              }
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  const s = useSurfaceStyleMap(getStyles(theme.colors, isDark, primary));
  const sheetMinHeight = Math.min(Math.round(height * 0.52), 540);
  const sheetMaxHeight = Math.round(height * 0.88);
  const iconMuted = isDark ? '#64748B' : '#94A3B8';
  const isWeb = Platform.OS === 'web';

  const scrollFocusedFieldIntoView = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(180)} style={s.backdrop}>
        <Pressable style={s.backdropPress} onPress={onClose} />
        <KeyboardAvoidingView
          behavior="padding"
          style={s.kav}
          pointerEvents="box-none"
        >
          <View
            style={[
              s.sheet,
              clay(isDark, 'lg'),
              {
                paddingBottom: 20 + insets.bottom,
                // Drop rigid min-height while adding a login so the sheet can
                // shrink above the keyboard instead of trapping inputs under it.
                minHeight: addMode ? undefined : sheetMinHeight,
                maxHeight: sheetMaxHeight,
              },
            ]}
          >
            {/* Outer clay sheet — sheen only (no overflow clip so shadows survive) */}
            <LinearGradient
              colors={
                isDark
                  ? [schoolColorWithAlpha(primary, 0.18), 'transparent']
                  : [schoolColorWithAlpha(primary, 0.1), 'rgba(255,255,255,0.35)', 'transparent']
              }
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.85, y: 0.5 }}
              style={s.sheetSheen}
              pointerEvents="none"
            />

            <View style={[s.grabber, clayInsetSoft(isDark)]} />

            <View style={s.header}>
              <View style={[s.headerIconOuter, clayPuck(isDark, primary)]}>
                <LinearGradient
                  colors={
                    isDark
                      ? [schoolColorWithAlpha(primary, 0.55), schoolColorWithAlpha(primary, 0.25)]
                      : ['#FFFFFF', schoolColorWithAlpha(primary, 0.16)]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.headerIconFill}
                >
                  <Ionicons name="people" size={18} color={primary} />
                </LinearGradient>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{t('driver_ui.switch_account')}</Text>
                <Text style={s.subtitle}>
                  {accounts.length > 0
                    ? t('driver_ui.switch_account_description')
                    : t('driver_ui.add_existing_login')}
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  s.closeBtn,
                  clayPuck(isDark),
                  pressed && { opacity: 0.85, transform: [{ scale: 0.94 }] },
                ]}
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={t('driver_ui.close')}
              >
                <Ionicons name="close" size={17} color={isDark ? '#9CA3AF' : '#64748B'} />
              </Pressable>
            </View>

            {loading ? (
              <View style={s.loadingBox}>
                <ActivityIndicator color={primary} />
              </View>
            ) : (
              <AccountListScroll
                isWeb={isWeb}
                scrollRef={scrollRef}
                style={s.list}
                contentContainerStyle={s.listContent}
              >
                {accounts.map((acct, idx) => {
                  const isActive = acct.userId === activeId;
                  const unread = counts[acct.userId] ?? 0;
                  const rowBusy = busyId === acct.userId;
                  return (
                    <Animated.View
                      key={acct.userId}
                      entering={FadeInDown.delay(36 * idx).duration(300)}
                      style={s.rowOuter}
                    >
                      <Pressable
                        style={({ pressed }) => [
                          s.row,
                          isActive ? s.rowActive : s.rowIdle,
                          clayRow(isDark, isActive ? primary : undefined),
                          pressed && s.rowPressed,
                        ]}
                        disabled={!!busyId}
                        onPress={() => onSwitch(acct.userId)}
                      >
                        <View style={[s.avatarRing, clayPuck(isDark, isActive ? primary : undefined), isActive && s.avatarRingActive]}>
                          <Image source={{ uri: acct.photoUrl || FALLBACK_AVATAR }} style={s.avatar} />
                          {unread > 0 && (
                            <View style={[s.avatarBadge, clayPuck(isDark, '#EF4444')]}>
                              <Text style={s.avatarBadgeText}>{unread > 99 ? '99+' : unread}</Text>
                            </View>
                          )}
                        </View>

                        <View style={s.rowMeta}>
                          <Text style={s.rowName} numberOfLines={1}>
                            {acct.displayName || t('driver_ui.account')}
                          </Text>
                          <View style={s.rowSubLine}>
                            {isActive && (
                              <View style={[s.activeTag, clayPuck(isDark, primary)]}>
                                <Text style={s.activeTagText}>{t('driver_ui.active')}</Text>
                              </View>
                            )}
                            <Text style={s.rowSubMuted} numberOfLines={1}>
                              {localizedAccountSubtitle(acct, t)}
                            </Text>
                            {unread > 0 && (
                              <Text style={s.rowSubMuted} numberOfLines={1}>
                                {' · '}{unread > 99
                                  ? t('driver_ui.unread_99_plus')
                                  : t('driver_ui.unread_count', { count: unread })}
                              </Text>
                            )}
                          </View>
                        </View>

                        {rowBusy ? (
                          <ActivityIndicator size="small" color={primary} />
                        ) : (
                          <View style={s.rowRight}>
                            {isActive ? (
                              <View style={[s.checkWrap, clayPuck(isDark, primary)]}>
                                <Ionicons name="checkmark" size={14} color="#fff" />
                              </View>
                            ) : (
                              <View style={[s.chevronPuck, clayPuck(isDark)]}>
                                <Ionicons name="chevron-forward" size={14} color={isDark ? '#94A3B8' : '#94A3B8'} />
                              </View>
                            )}
                            <Pressable
                              style={({ pressed }) => [
                                s.actionBtn,
                                isActive ? s.actionBtnDanger : s.actionBtnNeutral,
                                clayPuck(isDark, isActive ? '#EF4444' : undefined),
                                pressed && { opacity: 0.85, transform: [{ scale: 0.94 }] },
                              ]}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              onPress={() => onRemove(acct)}
                              disabled={!!busyId}
                              accessibilityRole="button"
                              accessibilityLabel={isActive ? t('driver_ui.log_out') : t('driver_ui.remove_account')}
                            >
                              <Ionicons
                                name={isActive ? 'log-out-outline' : 'close'}
                                size={15}
                                color={isActive ? '#EF4444' : (isDark ? '#94A3B8' : '#64748B')}
                              />
                            </Pressable>
                          </View>
                        )}
                      </Pressable>
                    </Animated.View>
                  );
                })}

                {!addMode ? (
                  <>
                  <Pressable
                    style={({ pressed }) => [
                      s.addRow,
                      clayRow(isDark, primary),
                      pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] },
                    ]}
                    disabled={!!busyId}
                    onPress={() => setAddMode(true)}
                  >
                    <View style={[s.addIcon, clayPuck(isDark, primary)]}>
                      <Ionicons name="add" size={22} color={primary} />
                    </View>
                    <View style={s.rowMeta}>
                      <Text style={[s.rowName, { color: primary }]}>{t('driver_ui.add_account')}</Text>
                      <Text style={s.rowSubMuted}>{t('driver_ui.use_login_email_password')}</Text>
                    </View>
                    <View style={[s.chevronPuck, clayPuck(isDark, primary)]}>
                      <Ionicons name="chevron-forward" size={14} color={primary} />
                    </View>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      s.addRow,
                      clayRow(isDark, primary),
                      pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] },
                    ]}
                    disabled={!!busyId}
                    onPress={openQrAdd}
                    accessibilityRole="button"
                    accessibilityLabel={t('qrLogin.scanCtaAdd', 'Scan QR to add account')}
                  >
                    <View style={[s.addIcon, clayPuck(isDark, primary)]}>
                      <Ionicons name="scan-outline" size={22} color={primary} />
                    </View>
                    <View style={s.rowMeta}>
                      <Text style={[s.rowName, { color: primary }]}>{t('qrLogin.scanCtaAdd', 'Scan QR to add account')}</Text>
                      <Text style={s.rowSubMuted}>{t('qrLogin.scanHint', 'Quick and secure access with your private school card')}</Text>
                    </View>
                    <View style={[s.chevronPuck, clayPuck(isDark, primary)]}>
                      <Ionicons name="chevron-forward" size={14} color={primary} />
                    </View>
                  </Pressable>
                  </>
                ) : (
                  <Animated.View entering={FadeInDown.duration(260)} style={[s.addForm, clayCard(isDark, 'md')]}>
                    <View style={s.addFormHeader}>
                      <View style={[s.addFormBadge, clayPuck(isDark, primary)]}>
                        <Ionicons name="person-add-outline" size={14} color={primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.addFormTitle}>{t('driver_ui.add_another_login')}</Text>
                        <Text style={s.addFormHint}>
                          {t('driver_ui.add_login_instructions')}
                        </Text>
                      </View>
                    </View>

                    <View style={[s.inputOuter, clay(isDark, 'sm')]}>
                      <View style={[s.inputInner, clayInset(isDark, focusedField === 'email')]}>
                        <Ionicons
                          name="mail-outline"
                          size={16}
                          color={focusedField === 'email' ? primary : iconMuted}
                        />
                        <TextInput
                          style={s.input}
                          placeholder={t('driver_ui.email')}
                          placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                          autoCapitalize="none"
                          keyboardType="email-address"
                          autoCorrect={false}
                          value={addEmail}
                          onChangeText={setAddEmail}
                          editable={!addBusy}
                          onFocus={() => {
                            setFocusedField('email');
                            scrollFocusedFieldIntoView();
                          }}
                          onBlur={() => setFocusedField((f) => (f === 'email' ? null : f))}
                        />
                      </View>
                    </View>

                    <View style={[s.inputOuter, clay(isDark, 'sm'), { marginBottom: 0 }]}>
                      <View style={[s.inputInner, clayInset(isDark, focusedField === 'password')]}>
                        <Ionicons
                          name="lock-closed-outline"
                          size={16}
                          color={focusedField === 'password' ? primary : iconMuted}
                        />
                        <TextInput
                          style={s.input}
                          placeholder={t('driver_ui.password')}
                          placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                          secureTextEntry={!showAddPassword}
                          value={addPassword}
                          onChangeText={setAddPassword}
                          editable={!addBusy}
                          onSubmitEditing={onAdd}
                          onFocus={() => {
                            setFocusedField('password');
                            scrollFocusedFieldIntoView();
                          }}
                          onBlur={() => setFocusedField((f) => (f === 'password' ? null : f))}
                        />
                        <ClayPasswordToggle
                          visible={showAddPassword}
                          onToggle={() => setShowAddPassword((v) => !v)}
                          isDark={isDark}
                        />
                      </View>
                    </View>

                    {addError ? <Text style={s.errorText}>{addError}</Text> : null}

                    <View style={s.qrDividerRow}>
                      <View style={s.qrDivider} />
                      <Text style={s.qrDividerText}>{t('qrLogin.or', 'OR')}</Text>
                      <View style={s.qrDivider} />
                    </View>
                    <Pressable
                      style={({ pressed }) => [
                        s.qrAddButton,
                        clayRow(isDark, primary),
                        pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] },
                      ]}
                      disabled={addBusy}
                      onPress={openQrAdd}
                      accessibilityRole="button"
                      accessibilityLabel={t('qrLogin.scanCtaAdd', 'Scan QR to add account')}
                    >
                      <View style={[s.qrAddIcon, clayPuck(isDark, primary)]}>
                        <Ionicons name="scan-outline" size={18} color={primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.rowName, { color: primary }]}>{t('qrLogin.scanCtaAdd', 'Scan QR to add account')}</Text>
                        <Text style={s.rowSubMuted}>{t('qrLogin.scanHint', 'Quick and secure access with your private school card')}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={primary} />
                    </Pressable>

                    <View style={s.addActions}>
                      <Pressable
                        style={({ pressed }) => [
                          s.btn,
                          s.btnGhost,
                          clay(isDark, 'sm'),
                          pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                        ]}
                        onPress={() => {
                          setAddMode(false);
                          setShowAddPassword(false);
                          setFocusedField(null);
                        }}
                        disabled={addBusy}
                      >
                        <Text style={s.btnGhostText}>{t('driver_ui.cancel')}</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [
                          s.btnPrimaryOuter,
                          clayPuck(isDark, primary),
                          pressed && !addBusy && { opacity: 0.92, transform: [{ scale: 0.97 }] },
                          addBusy && { opacity: 0.7 },
                        ]}
                        onPress={onAdd}
                        disabled={addBusy}
                      >
                        <View style={[s.btn, s.btnPrimary]}>
                          <LinearGradient
                            colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                            style={s.btnPrimarySheen}
                            pointerEvents="none"
                          />
                          {addBusy ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={s.btnPrimaryText}>{t('driver_ui.login_and_add')}</Text>
                          )}
                        </View>
                      </Pressable>
                    </View>
                  </Animated.View>
                )}
              </AccountListScroll>
            )}
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

/** Scroll host that lifts focused inputs above the keyboard on native. */
function AccountListScroll({
  isWeb,
  scrollRef,
  style,
  contentContainerStyle,
  children,
}: {
  isWeb: boolean;
  scrollRef: React.RefObject<ScrollView | null>;
  style: object;
  contentContainerStyle: object;
  children: React.ReactNode;
}) {
  if (isWeb) {
    return (
      <ScrollView
        ref={scrollRef}
        style={style}
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <KeyboardAwareScrollView
      ref={scrollRef}
      style={style}
      contentContainerStyle={contentContainerStyle}
      bottomOffset={28}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      extraKeyboardSpace={12}
    >
      {children}
    </KeyboardAwareScrollView>
  );
}

const getStyles = (colors: any, isDark: boolean, primary: string) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: isDark ? 'rgba(2,6,23,0.72)' : 'rgba(15,23,42,0.52)',
      justifyContent: 'flex-end',
    },
    backdropPress: { ...StyleSheet.absoluteFillObject },
    kav: {
      width: '100%',
      flex: 1,
      justifyContent: 'flex-end',
    },
    sheet: {
      width: '100%',
      maxWidth: 540,
      alignSelf: 'center',
      flexShrink: 1,
      // Soft clay base — slightly darker than row fills so raised cards pop
      backgroundColor: isDark ? '#121826' : '#E7EBF4',
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      borderBottomLeftRadius: Platform.OS === 'web' ? 28 : 0,
      borderBottomRightRadius: Platform.OS === 'web' ? 28 : 0,
      paddingHorizontal: 18,
      paddingTop: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.75)',
      marginBottom: Platform.OS === 'web' ? 18 : 0,
    },
    sheetSheen: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 140,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
    },
    grabber: {
      alignSelf: 'center',
      width: 44,
      height: 6,
      borderRadius: 4,
      backgroundColor: isDark ? '#1E293B' : '#D5DCE8',
      marginBottom: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 14,
      paddingHorizontal: 2,
      gap: 12,
    },
    headerIconOuter: {
      width: 44,
      height: 44,
      borderRadius: 16,
      marginTop: 1,
      backgroundColor: isDark ? '#1E293B' : '#F4F7FD',
    },
    headerIconFill: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 16,
      overflow: 'hidden',
    },
    title: {
      fontSize: 21,
      fontWeight: '800',
      color: isDark ? '#F1F5F9' : '#2A3142',
      letterSpacing: -0.4,
    },
    subtitle: {
      fontSize: 12.5,
      color: isDark ? '#94A3B8' : '#6B7590',
      marginTop: 3,
      fontWeight: '500',
      lineHeight: 17,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 14,
      backgroundColor: isDark ? '#1E293B' : '#F4F7FD',
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 2,
    },
    loadingBox: { flex: 1, paddingVertical: 60, alignItems: 'center', justifyContent: 'center' },
    list: { flexGrow: 0, flexShrink: 1 },
    listContent: { paddingTop: 2, paddingBottom: 20, paddingHorizontal: 2 },

    rowOuter: {
      marginBottom: 12,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 13,
      paddingHorizontal: 13,
      borderRadius: 22,
      // No overflow:hidden — clay dual shadows must paint outside
    },
    rowIdle: {
      backgroundColor: isDark ? '#1A2332' : '#F4F7FD',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.85)',
    },
    rowActive: {
      backgroundColor: isDark ? schoolColorWithAlpha(primary, 0.22) : schoolColorWithAlpha(primary, 0.12),
      borderWidth: 1,
      borderColor: isDark ? schoolColorWithAlpha(primary, 0.4) : schoolColorWithAlpha(primary, 0.28),
    },
    rowPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.98 }],
    },
    avatarRing: {
      width: 54,
      height: 54,
      borderRadius: 27,
      padding: 3,
      marginRight: 13,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? '#243044' : '#EEF2F7',
    },
    avatarRingActive: {
      backgroundColor: primary,
      padding: 3,
    },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E5E7EB' },
    avatarBadge: {
      position: 'absolute',
      top: -3,
      right: -3,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 5,
      backgroundColor: '#EF4444',
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    rowMeta: { flex: 1, minWidth: 0 },
    rowName: {
      fontSize: 15.5,
      fontWeight: '700',
      color: isDark ? '#F1F5F9' : '#2A3142',
      letterSpacing: -0.2,
    },
    rowSubLine: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4, flexWrap: 'wrap' },
    activeTag: {
      backgroundColor: primary,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    activeTagText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: 0.45,
      textTransform: 'uppercase',
    },
    rowSubMuted: { fontSize: 12.5, color: isDark ? '#94A3B8' : '#6B7590', fontWeight: '500' },
    rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    checkWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    chevronPuck: {
      width: 28,
      height: 28,
      borderRadius: 12,
      backgroundColor: isDark ? '#1E293B' : '#EEF2F7',
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionBtn: {
      width: 32,
      height: 32,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionBtnNeutral: {
      backgroundColor: isDark ? '#1E293B' : '#EEF2F7',
    },
    actionBtnDanger: {
      backgroundColor: isDark ? 'rgba(239,68,68,0.18)' : '#FEE2E2',
    },

    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 13,
      marginTop: 2,
      marginBottom: 4,
      borderRadius: 22,
      backgroundColor: isDark ? schoolColorWithAlpha(primary, 0.14) : schoolColorWithAlpha(primary, 0.08),
      borderWidth: 1,
      borderColor: isDark ? schoolColorWithAlpha(primary, 0.35) : schoolColorWithAlpha(primary, 0.22),
    },
    addIcon: {
      width: 54,
      height: 54,
      borderRadius: 27,
      marginRight: 13,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? schoolColorWithAlpha(primary, 0.2) : '#F4F7FD',
    },

    addForm: {
      paddingVertical: 18,
      paddingHorizontal: 16,
      marginTop: 8,
    },
    addFormHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 11,
      marginBottom: 16,
    },
    addFormBadge: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? schoolColorWithAlpha(primary, 0.25) : schoolColorWithAlpha(primary, 0.12),
    },
    addFormTitle: {
      fontSize: 14.5,
      fontWeight: '800',
      color: isDark ? '#F1F5F9' : '#2A3142',
      letterSpacing: -0.2,
      marginBottom: 3,
    },
    addFormHint: {
      fontSize: 12,
      color: isDark ? '#94A3B8' : '#6B7590',
      fontWeight: '500',
      lineHeight: 16,
    },
    inputOuter: {
      borderRadius: 18,
      padding: 6,
      marginBottom: 12,
      backgroundColor: isDark ? '#1A2332' : '#EFF2F9',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.8)',
    },
    inputInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'web' ? 12 : 11,
      borderRadius: 13,
    },
    input: {
      flex: 1,
      fontSize: 14.5,
      fontWeight: '600',
      color: isDark ? '#F1F5F9' : '#2A3142',
      letterSpacing: -0.15,
      paddingVertical: 2,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
    },
    errorText: {
      color: '#DC2626',
      fontSize: 12.5,
      marginTop: 10,
      marginLeft: 2,
      fontWeight: '600',
    },
    addActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
    qrDividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 16,
    },
    qrDivider: {
      flex: 1,
      height: 1,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(148,163,184,0.35)',
    },
    qrDividerText: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: isDark ? '#64748B' : '#94A3B8',
    },
    qrAddButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 18,
      backgroundColor: isDark ? schoolColorWithAlpha(primary, 0.14) : schoolColorWithAlpha(primary, 0.08),
      borderWidth: 1,
      borderColor: isDark ? schoolColorWithAlpha(primary, 0.35) : schoolColorWithAlpha(primary, 0.22),
    },
    qrAddIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? schoolColorWithAlpha(primary, 0.2) : '#F4F7FD',
    },
    btn: {
      flex: 1,
      paddingVertical: 15,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnGhost: {
      backgroundColor: isDark ? '#1A2332' : '#F4F7FD',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.85)',
    },
    btnGhostText: { fontSize: 14.5, fontWeight: '700', color: isDark ? '#F1F5F9' : '#2A3142' },
    btnPrimaryOuter: {
      flex: 1,
      borderRadius: 16,
      backgroundColor: primary,
    },
    btnPrimary: {
      backgroundColor: primary,
      borderBottomWidth: 1.5,
      borderBottomColor: 'rgba(0,0,0,0.18)',
      overflow: 'hidden',
    },
    btnPrimarySheen: {
      ...StyleSheet.absoluteFillObject,
    },
    btnPrimaryText: { fontSize: 14.5, fontWeight: '800', color: '#fff', letterSpacing: 0.15 },
  });
