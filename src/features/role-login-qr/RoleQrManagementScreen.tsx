import { useStaffQrStyles } from '../library/useStaffQrStyles';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import AdminHeader from '../../components/AdminHeader';
import { SCHOOL_LOGO, SCHOOL_NAME } from '../../constants/school';
import { SCHOOL_CONFIG } from '../../constants/schoolConfig';
import { useTheme } from '../../hooks/useTheme';
import { useRequireRole } from '../../hooks/useRequireRole';
import { useAuth } from '../../hooks/useAuth';
import { alertCompat } from '../../utils/crossPlatformAlert';
import { resolveApiAssetUrl } from '../../utils/toBase64Uri';
import { useAccountsWebChrome } from '../../contexts/AccountsWebChromeContext';
import { LOGIN_QR_CARDS_PER_PAGE, printStudentQrPdf, saveStudentQrPdf, studentQrPngDataUrl } from '../student-login-qr/qrPdfGenerator';
import type { IssuedLoginQr, LoginQrSchool } from '../student-login-qr/types';
import { fetchAllRoleLoginQrAccounts, RoleLoginQrApi } from './roleQrApi';
import type { IssuedRoleLoginQr, RoleLoginQrAccount, RoleLoginQrMetadata } from './types';

type PickerOption = { value: string; label: string };

function isPlaceholderSchoolName(value?: string | null) {
  const name = value?.trim() || '';
  return !name || /^(default\s+school(\s+name)?|school|school\s+name|my\s+school|unnamed\s+school)$/i.test(name);
}

function brandedLoginQrSchool(school?: LoginQrSchool | null): LoginQrSchool {
  const name = school?.name?.trim() || '';
  const fallbackName = !isPlaceholderSchoolName(SCHOOL_NAME) ? SCHOOL_NAME : SCHOOL_CONFIG.name;
  return {
    id: school?.id ?? 0,
    name: isPlaceholderSchoolName(name) ? fallbackName : name,
    logo_url: school?.logo_url || SCHOOL_LOGO || null,
  };
}

function formatQrExpiry(iso?: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function loginQrStatus(account: RoleLoginQrAccount, issued: Map<string, IssuedRoleLoginQr>) {
  if (!account.login_configured) return { label: 'Needs login', tone: 'warn' as const };
  if (account.qr_ready || issued.has(account.id)) return { label: 'QR issued', tone: 'ready' as const };
  return { label: 'Login set up', tone: 'idle' as const };
}

function toPrintCredential(issued: IssuedRoleLoginQr): IssuedLoginQr {
  return {
    qrPayload: issued.qrPayload,
    credentialId: issued.credentialId,
    expiresAt: issued.expiresAt,
    created: issued.created,
    student: {
      id: issued.account.id,
      name: issued.account.name,
      admissionNo: issued.account.staffCode || '',
      className: issued.account.roleLabel,
      sectionName: issued.account.designation || '',
    },
  };
}

function printOptionsFor(credentials: IssuedRoleLoginQr[], school: LoginQrSchool, sheetMeta: string) {
  return {
    school,
    academicYear: '',
    className: sheetMeta,
    sectionName: '',
    credentials: credentials.map(toPrintCredential),
    cardKind: 'role' as const,
    sheetTitle: 'Login QR Codes',
    sheetMeta,
  };
}

function FilterPicker({ label, value, options, onChange, staffAppearance = false }: {
  label: string; value: string; options: PickerOption[]; onChange: (value: string) => void; staffAppearance?: boolean;
}) {
  const styles = useStaffQrStyles(baseStyles, staffAppearance);
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  return <>
    <Pressable style={styles.filterField} onPress={() => setOpen(true)}>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={styles.filterValueRow}><Text numberOfLines={1} style={styles.filterValue}>{selected?.label || 'All roles'}</Text><Ionicons name="chevron-down" size={15} color="#64748B" /></View>
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
        <Pressable style={styles.pickerCard} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.pickerTitle}>Select {label}</Text>
          <FlatList data={[{ value: '', label: 'All roles' }, ...options]} keyExtractor={(item) => item.value || 'all'} renderItem={({ item }) => (
            <Pressable style={[styles.pickerOption, item.value === value && styles.pickerOptionActive]} onPress={() => { onChange(item.value); setOpen(false); }}>
              <Text style={[styles.pickerOptionText, item.value === value && styles.pickerOptionTextActive]}>{item.label}</Text>
              {item.value === value ? <Ionicons name="checkmark-circle" size={20} color={styles.primaryAction.backgroundColor} /> : null}
            </Pressable>
          )} />
        </Pressable>
      </Pressable>
    </Modal>
  </>;
}

function PreviewModal({ credential, school, onClose, onRegenerated, staffAppearance = false }: {
  staffAppearance?: boolean;
  credential: IssuedRoleLoginQr | null;
  school: LoginQrSchool | null;
  onClose: () => void;
  onRegenerated: (credential: IssuedRoleLoginQr) => void;
}) {
  const styles = useStaffQrStyles(baseStyles, staffAppearance);
  const qrRef = useRef<{ toDataURL: (callback: (data: string) => void) => void } | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('Working…');
  const [logoFailed, setLogoFailed] = useState(false);
  const brand = brandedLoginQrSchool(school);
  const remoteLogo = resolveApiAssetUrl(brand.logo_url);

  useEffect(() => { setLogoFailed(false); }, [remoteLogo, credential?.credentialId]);
  if (!credential) return null;

  const printOptions = printOptionsFor([credential], brand, credential.account.roleLabel);
  const audit = (exportType: 'png' | 'single_card_pdf' | 'print') =>
    RoleLoginQrApi.auditExport({ exportType, userIds: [credential.account.id], role: credential.account.roleCode }).catch(() => undefined);
  const expiry = formatQrExpiry(credential.expiresAt);
  const showRemoteLogo = Boolean(remoteLogo) && !logoFailed;
  const meta = [credential.account.roleLabel, credential.account.designation, credential.account.staffCode].filter(Boolean).join(' · ');

  const run = async (label: string, task: () => Promise<void>) => {
    setBusyLabel(label);
    setBusy(true);
    try { await task(); }
    catch (error) { alertCompat('Could not finish', error instanceof Error ? error.message : 'Try again.'); }
    finally { setBusy(false); }
  };

  const downloadPng = () => run('Saving QR image…', async () => {
    const filename = `${credential.account.name.replace(/[^a-z0-9]+/gi, '-')}_Login-QR.png`;
    if (Platform.OS === 'web') {
      const anchor = document.createElement('a');
      anchor.href = await studentQrPngDataUrl(credential.qrPayload);
      anchor.download = filename;
      document.body.appendChild(anchor);
      try { anchor.click(); } finally { anchor.remove(); }
    } else {
      const base64 = await new Promise<string>((resolve, reject) => {
        if (!qrRef.current) return reject(new Error('QR preview is not ready.'));
        const timeout = setTimeout(() => reject(new Error('QR image export timed out. Please try again.')), 10000);
        try { qrRef.current.toDataURL((data) => { clearTimeout(timeout); resolve(data); }); }
        catch (error) { clearTimeout(timeout); reject(error); }
      });
      const uri = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Save Login QR' });
    }
    await audit('png');
  });

  const regenerate = () => alertCompat(
    'Replace this login QR?',
    'Any printed or saved copy of the current QR will stop working immediately. The account password does not change.',
    [{ text: 'Keep current QR', style: 'cancel' }, { text: 'Replace QR', style: 'destructive', onPress: async () => {
      setBusyLabel('Replacing QR…');
      setBusy(true);
      try { onRegenerated(await RoleLoginQrApi.regenerate(credential.account.id)); }
      catch (error) { alertCompat('Could not replace QR', error instanceof Error ? error.message : 'Try again.'); }
      finally { setBusy(false); }
    } }],
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.previewCard} onPress={(event) => event.stopPropagation()}>
          <View style={styles.previewHeader}>
            <View style={styles.previewHeaderCopy}>
              <Text style={styles.previewEyebrow}>LOGIN QR CARD</Text>
              <Text style={styles.previewTitle}>{credential.account.name}</Text>
              <Text style={styles.previewMeta}>{meta}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.iconButton} accessibilityLabel="Close QR preview">
              <Ionicons name="close" size={22} color="#334155" />
            </Pressable>
          </View>
          <ScrollView style={styles.previewScroll} contentContainerStyle={styles.previewScrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.qrCardPreview}>
              {showRemoteLogo ? (
                <Image source={{ uri: remoteLogo as string }} style={styles.previewLogo} resizeMode="contain" onError={() => setLogoFailed(true)} />
              ) : (
                <Image source={SCHOOL_CONFIG.logo} style={styles.previewLogo} resizeMode="contain" />
              )}
              <Text style={styles.previewSchool}>{brand.name}</Text>
              <Text style={styles.previewScanHint}>Open SchoolIMS, then scan to sign in</Text>
              <View style={styles.qrPreviewWrap}>
                <QRCode value={credential.qrPayload} size={216} ecl="M" quietZone={24} />
              </View>
              <View style={styles.previewValidity}>
                <View style={[styles.createdChip, credential.created ? styles.createdChipNew : styles.createdChipExisting]}>
                  <Text style={[styles.createdChipText, credential.created ? styles.createdChipTextNew : styles.createdChipTextExisting]}>
                    {credential.created ? 'New QR issued' : 'Current QR'}
                  </Text>
                </View>
                {expiry ? <Text style={styles.previewExpiry}>Works until {expiry}</Text> : null}
              </View>
            </View>
            <View style={styles.privacyBox}>
              <Ionicons name="warning" size={18} color="#B45309" />
              <Text style={styles.privacyText}>Treat this like a password. Anyone who has this QR can sign in as {credential.account.name}.</Text>
            </View>
            <Text style={styles.actionGroupLabel}>Give this to {credential.account.roleLabel.toLowerCase()}</Text>
            <Pressable disabled={busy} style={styles.primaryPreviewButton} onPress={() => { void run('Preparing printable card…', async () => { await saveStudentQrPdf(printOptions, true); await audit('single_card_pdf'); }); }}>
              <Ionicons name="id-card-outline" size={20} color="#FFFFFF" />
              <View style={styles.actionCopy}>
                <Text style={styles.primaryPreviewButtonText}>Download printable card</Text>
                <Text style={styles.primaryPreviewButtonSub}>PDF with name, role, and QR</Text>
              </View>
            </Pressable>
            <View style={styles.actionGrid}>
              <Pressable disabled={busy} style={styles.secondaryButton} onPress={() => { void downloadPng(); }}>
                <Ionicons name="image-outline" size={18} color={styles.primaryAction.backgroundColor} />
                <View style={styles.actionCopy}><Text style={styles.secondaryButtonText}>Save QR image</Text><Text style={styles.secondaryButtonHint}>PNG for WhatsApp or files</Text></View>
              </Pressable>
              <Pressable disabled={busy} style={styles.secondaryButton} onPress={() => { void run('Opening print dialog…', async () => { await printStudentQrPdf(printOptions, true); await audit('print'); }); }}>
                <Ionicons name="print-outline" size={18} color={styles.primaryAction.backgroundColor} />
                <View style={styles.actionCopy}><Text style={styles.secondaryButtonText}>Print now</Text><Text style={styles.secondaryButtonHint}>Opens the printer dialog</Text></View>
              </Pressable>
            </View>
            <View style={styles.replaceBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.replaceTitle}>Lost, shared, or printed by mistake?</Text>
                <Text style={styles.replaceCopy}>Replace the QR. The old card stops working immediately. The password does not change.</Text>
              </View>
              <Pressable disabled={busy} style={styles.replaceButton} onPress={regenerate}>
                <Ionicons name="refresh" size={16} color="#B91C1C" />
                <Text style={styles.replaceButtonText}>Replace QR</Text>
              </Pressable>
            </View>
          </ScrollView>
          {Platform.OS !== 'web' ? <View pointerEvents="none" style={styles.hiResQr}>
            <QRCode getRef={(ref) => { qrRef.current = ref; }} value={credential.qrPayload} size={1024} ecl="M" quietZone={128} />
          </View> : null}
          {busy ? <View style={styles.busyOverlay}><ActivityIndicator size="large" color={styles.primaryAction.backgroundColor} /><Text style={styles.busyLabel}>{busyLabel}</Text></View> : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function RoleQrManagementScreen({ embedded = false }: { embedded?: boolean }) {
  const styles = useStaffQrStyles(baseStyles, embedded);
  useRequireRole('admin', 'principal', 'management', 'accountant', 'accounts', 'librarian');
  const { width } = useWindowDimensions();
  const { theme, isDark } = useTheme();
  const { role } = useAuth();
  const { shellActive: accountsShell, openMobileNav } = useAccountsWebChrome();
  const [metadata, setMetadata] = useState<RoleLoginQrMetadata | null>(null);
  const [accounts, setAccounts] = useState<RoleLoginQrAccount[]>([]);
  const [roleCode, setRoleCode] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [issued, setIssued] = useState<Map<string, IssuedRoleLoginQr>>(new Map());
  const [preview, setPreview] = useState<IssuedRoleLoginQr | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const isWide = width >= 820;
  const PAGE_SIZE = 50;

  useEffect(() => {
    let live = true;
    RoleLoginQrApi.metadata().then((data) => { if (live) setMetadata(data); })
      .catch((caught) => { if (live) setError(caught instanceof Error ? caught.message : 'Could not load QR management.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  const currentFilters = useMemo(() => ({
    role: roleCode || undefined,
    search: search.trim() || undefined,
  }), [roleCode, search]);

  const loadAccounts = useCallback(async (nextPage = 1) => {
    if (!metadata) return;
    setLoading(true); setError('');
    try {
      const result = await RoleLoginQrApi.accounts({ ...currentFilters, page: nextPage, limit: PAGE_SIZE });
      setAccounts(result.rows);
      setPage(result.page);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setSelected((current) => {
        const visible = new Set(result.rows.map((account) => account.id));
        return new Set([...current].filter((id) => {
          if (!visible.has(id)) return true;
          return result.rows.some((account) => account.id === id && account.login_configured);
        }));
      });
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not load accounts.'); }
    finally { setLoading(false); }
  }, [metadata, currentFilters]);

  useEffect(() => {
    const timer = setTimeout(() => { void loadAccounts(1); }, search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [loadAccounts, search]);

  const roleOptions = useMemo(() => (metadata?.roles || []).map((item) => ({ value: item.code, label: item.label })), [metadata]);
  const selectable = accounts.filter((account) => account.login_configured);
  const allSelected = selectable.length > 0 && selectable.every((account) => selected.has(account.id));
  const canPrintSheet = selected.size > 0 || Boolean(roleCode);
  const brandedSchool = useMemo(() => brandedLoginQrSchool(metadata?.school || null), [metadata]);
  const roleLabel = roleOptions.find((option) => option.value === roleCode)?.label || 'Selected accounts';

  const toggle = (id: string) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const selectAll = () => setSelected(allSelected ? new Set() : new Set(selectable.map((account) => account.id)));
  const storeIssued = (credentials: IssuedRoleLoginQr[]) => setIssued((current) => {
    const next = new Map(current); credentials.forEach((credential) => next.set(credential.account.id, credential)); return next;
  });

  const issueForAccounts = async (targets: RoleLoginQrAccount[]): Promise<IssuedRoleLoginQr[]> => {
    const ready = targets.filter((account) => account.login_configured);
    if (!ready.length) throw new Error('Select at least one account with a configured login.');
    const collected: IssuedRoleLoginQr[] = [];
    let failed = 0;
    for (let index = 0; index < ready.length; index += 200) {
      const result = await RoleLoginQrApi.bulk(ready.slice(index, index + 200).map((account) => account.id));
      const serviceFailure = result.failures.find((failure) => !['LOGIN_NOT_CONFIGURED', 'USER_NOT_FOUND'].includes(failure.code));
      if (serviceFailure) {
        throw new Error(serviceFailure.code === 'LOGIN_QR_NOT_CONFIGURED'
          ? 'Login QR generation is not configured on the server. Contact your system administrator.'
          : serviceFailure.code === 'LOGIN_QR_KEY_ROTATED'
            ? 'The school QR key changed. Open View QR for the affected account to replace their QR.'
            : serviceFailure.code === 'QR_ROLE_OUT_OF_SCOPE'
              ? 'You cannot issue a login QR for an account with a higher role.'
              : 'The server could not generate the QR cards. Please try again.');
      }
      storeIssued(result.credentials);
      collected.push(...result.credentials);
      failed += result.failures.length;
    }
    if (failed) alertCompat('Some QR codes were skipped', `${failed} login${failed === 1 ? ' is' : 's are'} not configured or no longer active.`);
    if (!collected.length) throw new Error('No QR codes were generated. Check that the selected accounts have active logins.');
    return collected;
  };

  const resolvePrintableAccounts = async (): Promise<RoleLoginQrAccount[]> => {
    if (selected.size) {
      const pool = [...selected].some((id) => !accounts.some((account) => account.id === id))
        ? await fetchAllRoleLoginQrAccounts(currentFilters) : accounts;
      return pool.filter((account) => selected.has(account.id) && account.login_configured);
    }
    if (roleCode) return (await fetchAllRoleLoginQrAccounts(currentFilters)).filter((account) => account.login_configured);
    throw new Error('Select accounts, or choose a role, to print QR cards.');
  };

  const generateOne = async (account: RoleLoginQrAccount) => {
    setOpeningId(account.id);
    try {
      const credential = await RoleLoginQrApi.generate(account.id);
      storeIssued([credential]);
      setPreview(credential);
    } catch (caught) {
      if ((caught as { code?: string })?.code === 'LOGIN_QR_KEY_ROTATED') {
        alertCompat('Replace this login QR?', 'The school QR key changed. Replace this QR so it works with the current server. Previously printed copies will stop working.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace QR', style: 'destructive', onPress: async () => {
            setOpeningId(account.id);
            try {
              const credential = await RoleLoginQrApi.regenerate(account.id);
              storeIssued([credential]);
              setPreview(credential);
            } catch (error) { alertCompat('QR unavailable', error instanceof Error ? error.message : 'Could not replace this QR.'); }
            finally { setOpeningId(null); }
          } },
        ]);
      } else {
        alertCompat('QR unavailable', caught instanceof Error ? caught.message : 'Could not generate this QR.');
      }
    } finally { setOpeningId(null); }
  };

  const bulkGenerate = async () => {
    setWorking(true);
    try {
      const targets = await resolvePrintableAccounts();
      const credentials = await issueForAccounts(targets);
      alertCompat('QR codes are ready', `${credentials.length} login QR ${credentials.length === 1 ? 'card is' : 'cards are'} ready. Download a printable sheet, or open View QR for one person.`);
    } catch (caught) { alertCompat('Could not issue QR codes', caught instanceof Error ? caught.message : 'Try again.'); }
    finally { setWorking(false); }
  };

  const downloadA4 = () => {
    const run = async () => {
      setWorking(true);
      try {
        const targets = await resolvePrintableAccounts();
        const pages = Math.ceil(targets.length / LOGIN_QR_CARDS_PER_PAGE);
        const credentials = await issueForAccounts(targets);
        if (!credentials.length) throw new Error('No printable QR codes were generated.');
        await saveStudentQrPdf(printOptionsFor(credentials, brandedSchool, roleLabel));
        await RoleLoginQrApi.auditExport({ exportType: 'a4_pdf', userIds: credentials.map((item) => item.account.id), role: roleCode || undefined });
        alertCompat('Printable sheet ready', `${credentials.length} cards · ${pages} page${pages === 1 ? '' : 's'} · ${LOGIN_QR_CARDS_PER_PAGE} cards per page.`);
      } catch (caught) { alertCompat('Could not create the sheet', caught instanceof Error ? caught.message : 'Could not generate the PDF.'); }
      finally { setWorking(false); }
    };
    const estimated = selected.size || total;
    const pages = Math.max(1, Math.ceil(estimated / LOGIN_QR_CARDS_PER_PAGE));
    const who = selected.size
      ? `${selected.size} selected account${selected.size === 1 ? '' : 's'}`
      : `every ready ${roleLabel} account`;
    alertCompat(
      'Download printable sheet?',
      `${who}\n${LOGIN_QR_CARDS_PER_PAGE} cards per A4 page · about ${pages} page${pages === 1 ? '' : 's'}\n\nEach card includes the name, role, and a private login QR.`,
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Download sheet', onPress: () => { void run(); } }],
    );
  };

  const selectAllMatching = async () => {
    setWorking(true);
    try {
      const all = await fetchAllRoleLoginQrAccounts(currentFilters);
      setSelected(new Set(all.filter((account) => account.login_configured).map((account) => account.id)));
    } catch (caught) { alertCompat('Could not select accounts', caught instanceof Error ? caught.message : 'Try again.'); }
    finally { setWorking(false); }
  };

  const isAccountsPortal = role === 'accountant' || role === 'accounts';
  const pageHeader = (
    <AdminHeader
      title="Role Login QR Codes"
      showBackButton
      hideAppSearch
      showMenuButton={isAccountsPortal && !accountsShell}
      onMenuPress={isAccountsPortal ? openMobileNav : undefined}
    />
  );

  if (!metadata && loading) {
    return <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>{!accountsShell && !embedded ? pageHeader : null}<View style={styles.center}><ActivityIndicator size="large" color={styles.primaryAction.backgroundColor} /><Text style={styles.muted}>Loading secure QR workspace…</Text></View></View>;
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      {!accountsShell && !embedded ? pageHeader : null}
      <FlatList
        data={accounts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<>
          <View style={[styles.hero, isDark && styles.darkCard]}>
            <View style={styles.heroIcon}><Ionicons name="qr-code" size={28} color="#FFFFFF" /></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroTitle, isDark && styles.darkText]}>Print private login cards for every role</Text>
              <Text style={styles.heroCopy}>Staff, librarians, teachers, principals, accounts, drivers, gate keepers, and parents each scan their own card. Passwords are never shown.</Text>
            </View>
            <View style={styles.securityBadge}><Ionicons name="eye-off" size={14} color="#166534" /><Text style={styles.securityBadgeText}>PASSWORDS HIDDEN</Text></View>
          </View>
          <View style={[styles.filters, isWide && styles.filtersWide, isDark && styles.darkCard]}>
            <View style={styles.searchBox}><Ionicons name="search" size={18} color="#64748B" /><TextInput value={search} onChangeText={setSearch} placeholder="Search name, staff code, or login" placeholderTextColor="#94A3B8" style={styles.searchInput} autoCapitalize="none" /></View>
            <View style={styles.filterRow}>
              <FilterPicker staffAppearance={embedded} label="Role" value={roleCode} options={roleOptions} onChange={setRoleCode} />
              <View style={styles.statusFilterChip}><View style={styles.activeDot} /><Text style={styles.statusFilterText}>Active accounts only</Text></View>
            </View>
          </View>
          <View style={styles.toolbar}>
            <Pressable style={styles.selectAllButton} onPress={selectAll}><Ionicons name={allSelected ? 'checkbox' : 'square-outline'} size={21} color={styles.primaryAction.backgroundColor} /><Text style={styles.selectAllText}>Select this page ({selectable.length})</Text></Pressable>
            {total > accounts.length ? <Pressable style={styles.selectAllButton} onPress={() => { void selectAllMatching(); }}><Ionicons name="checkmark-done-outline" size={21} color={styles.primaryAction.backgroundColor} /><Text style={styles.selectAllText}>Select every match ({total})</Text></Pressable> : null}
            <Text style={styles.selectedCount}>{selected.size ? `${selected.size} selected` : `${total} accounts`}</Text>
            <View style={styles.toolbarActions}>
              <Pressable disabled={working} onPress={() => { void loadAccounts(page); }} style={styles.iconToolbarButton} accessibilityLabel="Refresh account list">
                <Ionicons name="refresh-outline" size={18} color={styles.primaryAction.backgroundColor} />
              </Pressable>
              <Pressable disabled={working || !canPrintSheet} onPress={() => { void bulkGenerate(); }} style={[styles.outlineButton, !canPrintSheet && styles.disabledAction]}>
                <Ionicons name="qr-code-outline" size={17} color={styles.primaryAction.backgroundColor} />
                <Text style={styles.outlineButtonText}>{selected.size ? `Issue selected (${selected.size})` : roleCode ? 'Issue this role' : 'Issue QR codes'}</Text>
              </Pressable>
              <Pressable disabled={working || !canPrintSheet} onPress={downloadA4} style={[styles.primaryAction, !canPrintSheet && styles.disabledAction]}>
                <Ionicons name="download-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryActionText}>Download printable sheet</Text>
              </Pressable>
            </View>
          </View>
          <Text style={styles.toolbarHint}>
            {selected.size
              ? `Print ${selected.size} selected card${selected.size === 1 ? '' : 's'} as an A4 sheet (${LOGIN_QR_CARDS_PER_PAGE} per page).`
              : roleCode
                ? `Print every ready ${roleLabel} account.`
                : 'Select accounts, or choose a role, to print an A4 sheet of QR cards.'}
          </Text>
          {error ? <View style={styles.errorBanner}><Ionicons name="alert-circle" size={18} color="#B91C1C" /><Text style={styles.errorBannerText}>{error}</Text><Pressable onPress={() => { void loadAccounts(page); }}><Text style={styles.retryText}>Retry</Text></Pressable></View> : null}
          {working ? <View style={styles.workingBanner}><ActivityIndicator size="small" color={styles.primaryAction.backgroundColor} /><Text style={styles.workingText}>Preparing login QR cards…</Text></View> : null}
          {isWide ? <View style={styles.tableHeader}><Text style={[styles.headerCell, { width: 54 }]}>SELECT</Text><Text style={[styles.headerCell, { flex: 2 }]}>PERSON</Text><Text style={[styles.headerCell, { flex: 1.2 }]}>ROLE</Text><Text style={[styles.headerCell, { flex: 1.3 }]}>STATUS</Text><Text style={[styles.headerCell, { width: 116 }]}>ACTION</Text></View> : null}
        </>}
        renderItem={({ item }) => {
          const checked = selected.has(item.id);
          const status = loginQrStatus(item, issued);
          const opening = openingId === item.id;
          const subtitle = [item.staff_code, item.designation, item.login_email].filter(Boolean).join(' · ');
          return <View style={[styles.studentRow, !isWide && styles.studentCard, isDark && styles.darkCard]}>
            <Pressable disabled={!item.login_configured} onPress={() => toggle(item.id)} style={styles.checkboxCell}><Ionicons name={checked ? 'checkbox' : 'square-outline'} size={23} color={item.login_configured ? styles.primaryAction.backgroundColor : '#CBD5E1'} /></Pressable>
            <View style={styles.studentMain}><View style={styles.avatar}><Text style={styles.avatarText}>{(item.name || '?').slice(0, 1).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text numberOfLines={2} style={[styles.studentName, isDark && styles.darkText]}>{item.name || 'Unnamed account'}</Text><Text style={styles.studentSub}>{subtitle || 'No staff code yet'}</Text></View></View>
            <Text style={[styles.classCell, !isWide && styles.mobileMeta]}>{item.role_label}</Text>
            <View style={[styles.statusCell, status.tone === 'ready' ? styles.readyStatus : status.tone === 'idle' ? styles.idleStatus : styles.missingStatus]}>
              <View style={[styles.statusDot, { backgroundColor: status.tone === 'ready' ? '#16A34A' : status.tone === 'idle' ? styles.primaryAction.backgroundColor : '#D97706' }]} />
              <Text style={[styles.statusText, { color: status.tone === 'ready' ? '#166534' : status.tone === 'idle' ? '#115E59' : '#92400E' }]}>{status.label}</Text>
            </View>
            <Pressable
              disabled={opening || !item.login_configured}
              style={[styles.rowAction, !item.login_configured && styles.configureAction]}
              onPress={() => { if (item.login_configured) void generateOne(item); }}
            >
              {opening ? <ActivityIndicator size="small" color={styles.primaryAction.backgroundColor} /> : <Ionicons name={item.login_configured ? (status.tone === 'ready' ? 'eye-outline' : 'qr-code-outline') : 'key-outline'} size={16} color={item.login_configured ? styles.primaryAction.backgroundColor : '#92400E'} />}
              <Text style={[styles.rowActionText, !item.login_configured && { color: '#92400E' }]}>
                {item.login_configured ? (opening ? 'Opening' : status.tone === 'ready' ? 'View QR' : 'Create QR') : 'Needs login'}
              </Text>
            </Pressable>
          </View>;
        }}
        ListEmptyComponent={!loading ? <View style={styles.empty}><Ionicons name="people-outline" size={42} color="#94A3B8" /><Text style={[styles.emptyTitle, isDark && styles.darkText]}>No accounts found</Text><Text style={styles.muted}>Try another role or search.</Text></View> : null}
        ListFooterComponent={loading ? <View style={styles.center}><ActivityIndicator color={styles.primaryAction.backgroundColor} /><Text style={styles.muted}>Loading accounts…</Text></View> : <View style={styles.pagination}>
          <Text style={styles.footerNote}>{total} active accounts · page {page} of {totalPages}</Text>
          {totalPages > 1 ? <View style={styles.pagerRow}>
            <Pressable disabled={page <= 1 || working} onPress={() => { void loadAccounts(page - 1); }} style={[styles.pagerButton, page <= 1 && styles.pagerDisabled]}><Text style={styles.pagerText}>Previous</Text></Pressable>
            <Pressable disabled={page >= totalPages || working} onPress={() => { void loadAccounts(page + 1); }} style={[styles.pagerButton, page >= totalPages && styles.pagerDisabled]}><Text style={styles.pagerText}>Next</Text></Pressable>
          </View> : null}
        </View>}
      />
      <PreviewModal staffAppearance={embedded} credential={preview} school={brandedSchool} onClose={() => setPreview(null)} onRegenerated={(next) => { storeIssued([next]); setPreview(next); void loadAccounts(page); }} />
    </View>
  );
}

const baseStyles = StyleSheet.create({
  screen: { flex: 1 }, content: { padding: 18, paddingBottom: 44, maxWidth: 1180, width: '100%', alignSelf: 'center' }, center: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 12 }, muted: { color: '#64748B', fontSize: 13, textAlign: 'center' }, darkText: { color: '#F8FAFC' }, darkCard: { backgroundColor: '#121827', borderColor: '#263044' },
  hero: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 }, heroIcon: { width: 54, height: 54, borderRadius: 17, backgroundColor: '#0F766E', alignItems: 'center', justifyContent: 'center' }, heroTitle: { color: '#0F172A', fontSize: 19, fontWeight: '800' }, heroCopy: { color: '#64748B', fontSize: 13, lineHeight: 19, marginTop: 3 }, securityBadge: { flexDirection: 'row', gap: 5, alignItems: 'center', backgroundColor: '#DCFCE7', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 7 }, securityBadgeText: { color: '#166534', fontSize: 9, fontWeight: '900', letterSpacing: .7 },
  filters: { borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, marginBottom: 14 }, filtersWide: { flexDirection: 'row', alignItems: 'center', gap: 12 }, searchBox: { flex: 1.3, minWidth: 220, height: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 13 }, searchInput: { flex: 1, color: '#0F172A', fontSize: 14, outlineStyle: 'none' } as never, filterRow: { flex: 2, flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 10 }, filterField: { minWidth: 160, flex: 1, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', borderRadius: 11, paddingHorizontal: 11, paddingVertical: 7 }, filterLabel: { color: '#64748B', fontSize: 9, fontWeight: '800', letterSpacing: .5, textTransform: 'uppercase' }, filterValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }, filterValue: { flex: 1, color: '#1E293B', fontWeight: '700', fontSize: 12 }, activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E' },
  statusFilterChip: { minWidth: 148, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch', borderWidth: 1, borderColor: '#DCFCE7', backgroundColor: '#F0FDF4', borderRadius: 11, paddingHorizontal: 11, paddingVertical: 10 }, statusFilterText: { color: '#166534', fontSize: 12, fontWeight: '800' },
  toolbar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 6 }, selectAllButton: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 8 }, selectAllText: { color: '#0F766E', fontWeight: '800', fontSize: 12 }, selectedCount: { color: '#64748B', fontSize: 12 }, toolbarActions: { marginLeft: 'auto', flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, toolbarHint: { color: '#64748B', fontSize: 12, lineHeight: 17, marginBottom: 12 }, iconToolbarButton: { width: 40, height: 40, borderRadius: 11, borderWidth: 1, borderColor: '#99F6E4', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }, outlineButton: { minHeight: 40, paddingHorizontal: 12, borderRadius: 11, borderWidth: 1, borderColor: '#99F6E4', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF' }, outlineButtonText: { color: '#0F766E', fontSize: 12, fontWeight: '800' }, primaryAction: { minHeight: 40, paddingHorizontal: 13, borderRadius: 11, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0F766E' }, primaryActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' }, disabledAction: { opacity: 0.45 },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#F1F5F9', borderTopLeftRadius: 12, borderTopRightRadius: 12 }, headerCell: { color: '#64748B', fontSize: 9, fontWeight: '900', letterSpacing: .7 }, studentRow: { minHeight: 72, backgroundColor: '#FFFFFF', borderWidth: 1, borderTopWidth: 0, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 10 }, studentCard: { borderTopWidth: 1, borderRadius: 15, marginBottom: 10, flexWrap: 'wrap' }, checkboxCell: { width: 44 }, studentMain: { flex: 2, minWidth: 180, flexDirection: 'row', alignItems: 'center', gap: 10 }, avatar: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#CCFBF1', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#0F766E', fontWeight: '900' }, studentName: { color: '#172033', fontSize: 13, fontWeight: '800' }, studentSub: { color: '#64748B', fontSize: 10, marginTop: 3 }, classCell: { flex: 1.2, color: '#475569', fontSize: 12, fontWeight: '700' }, mobileMeta: { flexBasis: '45%', marginLeft: 54 }, statusCell: { flex: 1.3, minWidth: 120, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingHorizontal: 9, paddingVertical: 7, borderRadius: 9 }, readyStatus: { backgroundColor: '#F0FDF4' }, idleStatus: { backgroundColor: '#F0FDFA' }, missingStatus: { backgroundColor: '#FFFBEB' }, statusDot: { width: 7, height: 7, borderRadius: 4 }, statusText: { fontSize: 10, fontWeight: '800' }, rowAction: { width: 116, height: 36, borderRadius: 10, backgroundColor: '#F0FDFA', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, configureAction: { backgroundColor: '#FFF7ED' }, rowActionText: { color: '#0F766E', fontSize: 11, fontWeight: '800' },
  errorBanner: { borderRadius: 12, padding: 12, backgroundColor: '#FEF2F2', flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }, errorBannerText: { color: '#991B1B', flex: 1, fontSize: 12 }, retryText: { color: '#B91C1C', fontWeight: '900' }, workingBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, marginBottom: 8, borderRadius: 10, backgroundColor: '#F0FDFA' }, workingText: { color: '#0F766E', fontWeight: '700', fontSize: 12 }, empty: { minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 8 }, emptyTitle: { color: '#1E293B', fontSize: 17, fontWeight: '800' }, footerNote: { textAlign: 'center', color: '#94A3B8', fontSize: 11, marginTop: 18 }, pagination: { alignItems: 'center', gap: 10, marginTop: 8 }, pagerRow: { flexDirection: 'row', gap: 8 }, pagerButton: { minHeight: 36, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#F0FDFA', justifyContent: 'center' }, pagerDisabled: { opacity: 0.45 }, pagerText: { color: '#0F766E', fontWeight: '800', fontSize: 12 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,.64)', padding: 18, alignItems: 'center', justifyContent: 'center' }, pickerCard: { width: '100%', maxWidth: 440, maxHeight: '70%', borderRadius: 20, padding: 16, backgroundColor: '#FFFFFF' }, pickerTitle: { color: '#0F172A', fontSize: 18, fontWeight: '800', marginBottom: 10 }, pickerOption: { minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10 }, pickerOptionActive: { backgroundColor: '#F0FDFA' }, pickerOptionText: { color: '#475569', fontWeight: '600' }, pickerOptionTextActive: { color: '#0F766E', fontWeight: '800' },
  previewCard: { width: '100%', maxWidth: 520, maxHeight: '92%', borderRadius: 24, backgroundColor: '#FFFFFF', overflow: 'hidden' }, previewHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 }, previewHeaderCopy: { flex: 1, paddingRight: 12 }, previewEyebrow: { color: '#0F766E', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, previewTitle: { color: '#0F172A', fontSize: 22, fontWeight: '800', marginTop: 3 }, iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }, previewMeta: { color: '#64748B', fontSize: 12, marginTop: 6 }, previewScroll: { flexGrow: 0, flexShrink: 1 }, previewScrollContent: { paddingHorizontal: 20, paddingBottom: 20 }, qrCardPreview: { alignItems: 'center', borderWidth: 1, borderColor: '#CCFBF1', backgroundColor: '#F0FDFA', borderRadius: 18, paddingVertical: 16, paddingHorizontal: 16 }, previewLogo: { width: 52, height: 52 }, previewSchool: { textAlign: 'center', color: '#0F172A', fontWeight: '800', marginTop: 8, fontSize: 15 }, previewScanHint: { textAlign: 'center', color: '#0F766E', fontWeight: '700', fontSize: 12, marginTop: 4 }, qrPreviewWrap: { alignSelf: 'center', marginTop: 14, marginBottom: 12, padding: 8, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' }, previewValidity: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }, createdChip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }, createdChipNew: { backgroundColor: '#DCFCE7' }, createdChipExisting: { backgroundColor: '#CCFBF1' }, createdChipText: { fontSize: 10, fontWeight: '800' }, createdChipTextNew: { color: '#166534' }, createdChipTextExisting: { color: '#0F766E' }, previewExpiry: { color: '#64748B', fontSize: 11, fontWeight: '700' },
  privacyBox: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 12, padding: 11, flexDirection: 'row', gap: 8, marginTop: 14 }, privacyText: { flex: 1, color: '#78350F', fontSize: 12, lineHeight: 17, fontWeight: '600' }, actionGroupLabel: { marginTop: 16, marginBottom: 8, color: '#64748B', fontSize: 10, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' }, primaryPreviewButton: { minHeight: 56, borderRadius: 14, paddingHorizontal: 14, backgroundColor: '#0F766E', flexDirection: 'row', alignItems: 'center', gap: 10 }, primaryPreviewButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' }, primaryPreviewButtonSub: { color: 'rgba(255,255,255,.82)', fontSize: 11, marginTop: 1 }, actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }, secondaryButton: { flexGrow: 1, minWidth: '46%', minHeight: 58, borderWidth: 1, borderColor: '#99F6E4', borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8, backgroundColor: '#F0FDFA' }, secondaryButtonText: { color: '#0F766E', fontSize: 12, fontWeight: '800' }, secondaryButtonHint: { color: '#0F766E', fontSize: 10, marginTop: 1 }, actionCopy: { flex: 1 }, replaceBox: { marginTop: 14, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FFF7F7', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 }, replaceTitle: { color: '#7F1D1D', fontSize: 12, fontWeight: '800' }, replaceCopy: { color: '#9F1239', fontSize: 11, lineHeight: 16, marginTop: 3 }, replaceButton: { minHeight: 40, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 5 }, replaceButtonText: { color: '#B91C1C', fontSize: 11, fontWeight: '800' }, busyOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: 24, backgroundColor: 'rgba(255,255,255,.82)', alignItems: 'center', justifyContent: 'center', gap: 10 }, busyLabel: { color: '#0F766E', fontWeight: '700', fontSize: 13 },
  hiResQr: { position: 'absolute', left: -2000, top: 0, width: 1024, height: 1024 },
});
