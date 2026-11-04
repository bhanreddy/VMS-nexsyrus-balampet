import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import AppTextInput from '../../components/AppTextInput';
import KeyboardAwareScreen from '../../../components/keyboard/KeyboardAwareScreen';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { alertCompat } from '../../utils/crossPlatformAlert';
import { LinearGradient } from 'expo-linear-gradient';
import { flatCard, flatInset } from '../../theme/surfaceStyles';
import type { SchoolTheme } from '../../theme/types';
import { schoolColorWithAlpha } from '../../constants/schoolConfig';
import { staffTabBarReserve } from '../../components/StaffFooter';
import LibraryActionCard from './LibraryActionCard';
import StaffToolsDrawer from '../../components/StaffToolsDrawer';
import { LIBRARY_DESTINATIONS } from '../../config/libraryNavigation';
import LibraryHomeHero from './LibraryHomeHero';
import LibrarySummaryCards from './LibrarySummaryCards';
import {
  LibraryService as service, LibraryBook, LibraryBookInput, LibraryCopy, LibraryBorrower,
  LibraryLoan, LibraryReservation, LibraryReports, LibrarySettings,
} from '../../services/libraryService';

type Page = 'dashboard' | 'catalog' | 'loans' | 'reservations' | 'reports' | 'settings';
const TITLES: Record<Page, [string, string]> = {
  dashboard: ['A home for every reader', 'Manage your school collection and keep books moving.'],
  catalog: ['Books & copies', 'Search by title, author, ISBN, category, or accession number.'],
  loans: ['Issue & return', 'Lend to students and staff, renew loans, and follow up on overdue books.'],
  reservations: ['Reservations', 'Titles are issued in reservation order. Close holds that are no longer needed.'],
  reports: ['Library reports', 'Inventory, circulation, fines, and the latest activity across your school.'],
  settings: ['Lending policy', 'Set borrowing limits, renewal rules, and daily overdue fines.'],
};
const EMPTY_BOOK: LibraryBookInput = { title: '', author: '', isbn: '', category: '', publisher: '' };
const money = (value: unknown) => `₹${Number(value || 0).toFixed(2)}`;
const date = (value: string) => value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString('en-IN') : '—';

function Button({ label, onPress, disabled, secondary = false, danger = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean; danger?: boolean }) {
  const { theme } = useTheme();
  const styles = useLibraryStyles();
  const color = danger ? theme.colors.danger : theme.colors.primary;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }, disabled && { opacity: 0.45 }]}>
    <View style={[styles.buttonInner, { backgroundColor: secondary ? theme.colors.card : color, borderColor: secondary ? theme.colors.border : color }]}>
      <Text style={{ color: secondary ? theme.colors.primary : '#fff', fontSize: 14, fontWeight: '700' }}>{label}</Text>
    </View>
  </Pressable>;
}
function Field({ label, value, onChange, numeric = false }: { label: string; value: string; onChange: (value: string) => void; numeric?: boolean }) {
  const { theme } = useTheme();
  const styles = useLibraryStyles();
  return <View style={{ gap: 7, marginBottom: 14 }}><Text style={{ color: theme.colors.text, fontWeight: '600' }}>{label}</Text><AppTextInput accessibilityLabel={label} value={value} onChangeText={onChange} keyboardType={numeric ? 'decimal-pad' : 'default'} style={styles.input} /></View>;
}
function Empty({ text }: { text: string }) { const styles = useLibraryStyles(); return <View style={styles.empty}><Ionicons name="book-outline" size={32} color="#94A3B8" /><Text style={styles.muted}>{text}</Text></View>; }
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const { theme } = useTheme();
  const styles = useLibraryStyles();
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={styles.backdrop}><View style={styles.sheet}>
    <View style={styles.sheetHeader}><Text style={[styles.sectionTitle, { color: theme.colors.text, flex: 1 }]}>{title}</Text><Pressable accessibilityLabel="Close dialog" style={{ padding: 10 }} onPress={onClose}><Ionicons name="close" size={24} color={theme.colors.text} /></Pressable></View>
    <KeyboardAwareScreen variant="scroll" contentContainerStyle={{ padding: 20 }}>{children}</KeyboardAwareScreen>
  </View></View></Modal>;
}
function BorrowerPicker({ onSelect, selected }: { onSelect: (value: LibraryBorrower | null) => void; selected: LibraryBorrower | null }) {
  const styles = useLibraryStyles();
  const { theme } = useTheme();
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<LibraryBorrower[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let alive = true;
    if (selected || search.trim().length < 2) { setRows([]); return; }
    const timer = setTimeout(() => {
      setLoading(true);
      service.borrowers(search).then((data) => { if (alive) setRows(data); })
        .catch(() => { if (alive) setRows([]); }).finally(() => { if (alive) setLoading(false); });
    }, 300);
    return () => { alive = false; clearTimeout(timer); };
  }, [search, selected]);
  if (selected) return <View style={styles.selected}><Text style={styles.selectedText}>{selected.display_name} · {selected.kind} {selected.code}</Text><Button secondary label="Change" onPress={() => onSelect(null)} /></View>;
  return <View><Field label="Find borrower by name, admission number, or staff code" value={search} onChange={setSearch} />
    {loading && <ActivityIndicator color={theme.colors.primary} />}
    {rows.map((r) => <Pressable key={r.id} onPress={() => onSelect(r)} style={styles.option}><Text style={styles.selectedText}>{r.display_name}</Text><Text style={styles.muted}>{r.kind} · {r.code}</Text></Pressable>)}
    {!loading && search.length >= 2 && rows.length === 0 && <Text style={styles.muted}>No matching active borrowers.</Text>}
  </View>;
}

export default function LibraryWorkspace({ page }: { page: Page }) {
  const { theme } = useTheme();
  const styles = useLibraryStyles();
  const { user } = useAuth();
  const navigation = useNavigation();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [pageNo, setPageNo] = useState(1);
  const [total, setTotal] = useState(0);
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [loans, setLoans] = useState<LibraryLoan[]>([]);
  const [reservations, setReservations] = useState<LibraryReservation[]>([]);
  const [reports, setReports] = useState<LibraryReports | null>(null);
  const [loanStatus, setLoanStatus] = useState('active');
  const [today, setToday] = useState('');
  const [policy, setPolicy] = useState<Record<keyof LibrarySettings, string>>({ loan_days: '14', max_loans: '3', max_renewals: '2', fine_per_day: '0' });
  const [editBook, setEditBook] = useState<LibraryBook | 'new' | null>(null);
  const [bookForm, setBookForm] = useState<LibraryBookInput>(EMPTY_BOOK);
  const [detail, setDetail] = useState<LibraryBook | null>(null);
  const [copies, setCopies] = useState<LibraryCopy[]>([]);
  const [accession, setAccession] = useState('');
  const [shelf, setShelf] = useState('');
  const [copyEdit, setCopyEdit] = useState<LibraryCopy | null>(null);
  const [copyStatus, setCopyStatus] = useState('available');
  const [copyShelf, setCopyShelf] = useState('');
  const [lend, setLend] = useState<{ book: LibraryBook; copy?: LibraryCopy } | null>(null);
  const [borrower, setBorrower] = useState<LibraryBorrower | null>(null);
  const [returnLoan, setReturnLoan] = useState<LibraryLoan | null>(null);
  const [condition, setCondition] = useState('available');
  const [payment, setPayment] = useState<LibraryLoan | null>(null);
  const [amount, setAmount] = useState('');
  const generation = useRef(0);

  const load = useCallback(async () => {
    const request = ++generation.current;
    if (!user?.userId) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      if (page === 'catalog') {
        const data = await service.books(search, pageNo);
        if (request === generation.current) { setBooks(data.rows); setTotal(data.total); }
      } else if (page === 'loans') {
        const data = await service.loans(loanStatus, search, pageNo);
        if (request === generation.current) { setLoans(data.rows); setTotal(data.total); setToday(data.today); }
      } else if (page === 'reservations') {
        const data = await service.reservations();
        if (request === generation.current) setReservations(data);
      } else if (page === 'settings') {
        const data = await service.settings();
        if (request === generation.current) setPolicy({ loan_days: String(data.loan_days), max_loans: String(data.max_loans), max_renewals: String(data.max_renewals), fine_per_day: String(data.fine_per_day) });
      } else {
        const data = await service.reports();
        if (request === generation.current) setReports(data);
      }
    } catch (e) { if (request === generation.current) setError(e instanceof Error ? e.message : 'Could not load the library.'); }
    finally { if (request === generation.current) setLoading(false); }
  }, [page, search, pageNo, loanStatus, user?.userId]);
  useFocusEffect(useCallback(() => {
    const timer = setTimeout(() => { void load(); }, 200);
    return () => { clearTimeout(timer); generation.current++; };
  }, [load]));

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await action(); await load(); }
    catch (e) { alertCompat('Could not complete action', e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); }
  };
  const card = [styles.card];
  const textStyle = { color: theme.colors.text };
  const openBook = async (book: LibraryBook) => {
    await run(async () => { const data = await service.copies(book.id); setCopies(data); setDetail(book); setAccession(''); setShelf(''); });
  };
  const newLending = (book: LibraryBook, copy?: LibraryCopy) => { setDetail(null); setBorrower(null); setLend({ book, copy }); };
  const edit = (book?: LibraryBook) => { setDetail(null); setEditBook(book || 'new'); setBookForm(book ? { title: book.title, author: book.author, isbn: book.isbn || '', category: book.category || '', publisher: book.publisher || '' } : EMPTY_BOOK); };
  const updateSearch = (value: string) => { setSearch(value); setPageNo(1); };
  const navigate = (route: string) => (navigation as any).navigate(route);
  const exportReport = async () => {
    if (!reports) return;
    const cells: unknown[][] = [['School library report', reports.today], ['Metric', 'Value'],
      ...reports.inventory.map((v) => [`Copies: ${v.status}`, v.count]),
      ['Active loans', reports.active_loans], ['Overdue loans', reports.overdue], ['Returned loans', reports.returned],
      ['Borrowers', reports.borrowers], ['Outstanding fines (INR)', reports.outstanding_fines], ['Collected fines (INR)', reports.collected_fines],
      [], ['Date', 'Action', 'Operator', 'Details'], ...reports.activity.map((v) => [v.created_at, v.action, v.actor_name || '', JSON.stringify(v.details)])];
    const csv = cells.map((row) => row.map((v) => `"${String(v ?? '').replace(/^[=+@\-]/, "'$&").replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const filename = `library-report-${reports.today}.csv`;
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else {
      if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this device.');
      const path = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(path, '\uFEFF' + csv);
      await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Library report' });
    }
  };

  return <View style={{ flex: 1, backgroundColor: theme.colors.background }}><ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, ['dashboard', 'catalog', 'loans', 'reports'].includes(page) && { paddingBottom: staffTabBarReserve(theme.spacing) }]} refreshControl={<RefreshControl refreshing={loading && !!(reports || books.length || loans.length)} onRefresh={() => { void load(); }} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />}>
    {page === 'dashboard' ? <View style={styles.heroBand}><LibraryHomeHero /></View> : <View style={styles.hero}><View style={styles.headingIcon}><Ionicons name={page === 'catalog' ? 'library-outline' : page === 'loans' ? 'swap-horizontal-outline' : page === 'settings' ? 'options-outline' : page === 'reservations' ? 'bookmark-outline' : 'bar-chart-outline'} size={26} color={theme.colors.primary} /></View><View style={{ flex: 1 }}><Text style={styles.eyebrow}>LIBRARY MANAGEMENT</Text><Text style={styles.heroTitle}>{TITLES[page][0]}</Text><Text style={styles.heroSubtitle}>{TITLES[page][1]}</Text></View></View>}
    {page === 'dashboard' && <LibrarySectionLabel label="TODAY’S WORK" />}
    <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 20 }]}><Text style={styles.muted}>{page === 'catalog' || page === 'loans' ? `${total} records` : 'Your school · All classes'}</Text><View style={styles.actions}>
      <Button label="Refresh" secondary disabled={busy || loading} onPress={() => { void load(); }} />
      {page === 'catalog' && <Button label="Add title" disabled={busy} onPress={() => edit()} />}
      {page === 'loans' && <Button label="Issue a book" onPress={() => navigate('catalog')} />}
      {page === 'reservations' && <Button label="Reserve a title" onPress={() => navigate('catalog')} />}
      {page === 'reports' && <Button label="Export CSV" disabled={busy || !reports} onPress={() => { void run(exportReport); }} />}
    </View></View>
    {(page === 'catalog' || page === 'loans') && <Field label={page === 'catalog' ? 'Search collection' : 'Search title, borrower, or accession number'} value={search} onChange={updateSearch} />}
    {page === 'loans' && <View style={[styles.actions, { marginBottom: 20 }]}>{[['active', 'On loan'], ['overdue', 'Overdue'], ['history', 'Returned'], ['fines', 'Unpaid fines']].map(([key, label]) => <Button key={key} secondary={key !== loanStatus} label={label} onPress={() => { setLoanStatus(key); setPageNo(1); }} />)}</View>}
    {error ? <View style={card}><Text style={{ color: '#DC2626' }}>{error}</Text><Button label="Retry" onPress={() => { void load(); }} /></View> : loading ? <View style={styles.empty}><ActivityIndicator color={theme.colors.primary} /><Text style={styles.muted}>Loading library…</Text></View> : <>
      {(page === 'dashboard' || page === 'reports') && reports && <>
        <LibrarySummaryCards reports={reports} />
        {page === 'dashboard' && <>
          <View style={styles.between}><LibrarySectionLabel label="EVERYDAY TOOLS" /><Pressable accessibilityRole="button" accessibilityLabel="Open all librarian tools" onPress={() => setToolsOpen(true)} style={styles.allTools}><Ionicons name="menu-outline" size={20} color={theme.colors.textStrong} /><Text style={{ color: theme.colors.textStrong, fontSize: 14, fontWeight: '600' }}>All tools</Text></Pressable></View>
          {(['Library management', 'School operations', 'Account & access'] as const).map((group) => <View key={group} style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.lg }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.fontSizeMD, fontWeight: '600' }}>{group}</Text>
            <View style={styles.menuGrid}>{LIBRARY_DESTINATIONS.filter((item) => item.group === group).map((item) => <LibraryActionCard key={item.key} item={item} onPress={() => navigate(item.key)} />)}</View>
          </View>)}
        </>}
        {page === 'reports' && <View style={card}><Text style={[styles.sectionTitle, textStyle]}>Inventory condition</Text>{reports.inventory.map((v) => <View key={v.status} style={styles.between}><Text style={textStyle}>{v.status}</Text><Text style={[textStyle, { fontWeight: '700' }]}>{v.count}</Text></View>)}</View>}
        <View style={card}><Text style={[styles.sectionTitle, textStyle]}>Recent activity</Text>{reports.activity.length === 0 ? <Empty text="Activity appears when you start managing your library." /> : reports.activity.map((a) => <View key={a.id} style={styles.activity}><Text style={[textStyle, { fontWeight: '600' }]}>{a.action.replace(/[._]/g, ' ')}</Text><Text style={styles.muted}>{a.actor_name || 'School user'} · {date(a.created_at)}</Text></View>)}</View>
      </>}
      {page === 'catalog' && (books.length ? books.map((book) => <View key={book.id} style={card}>
        <View style={styles.between}><View style={{ flex: 1 }}><Text style={[styles.sectionTitle, textStyle]}>{book.title}</Text><Text style={styles.muted}>{book.author}{book.category ? ` · ${book.category}` : ''}</Text><Text style={styles.muted}>{book.isbn ? `ISBN ${book.isbn} · ` : ''}{book.available} available / {book.copies} copies</Text></View><Ionicons name="book-outline" size={32} color={theme.colors.primary} /></View>
        <View style={styles.actions}><Button label="Copies & lending" disabled={busy} onPress={() => { void openBook(book); }} /><Button label="Edit title" secondary onPress={() => edit(book)} /><Button label="Reserve" secondary onPress={() => newLending(book)} /></View>
      </View>) : <Empty text="No titles found. Add your first book to start the collection." />)}
      {page === 'loans' && (loans.length ? loans.map((loan) => <View key={loan.id} style={card}>
        <Text style={[styles.sectionTitle, textStyle]}>{loan.title}</Text><Text style={styles.muted}>{loan.borrower_name} · Accession {loan.accession_no}</Text>
        <Text style={{ color: !loan.returned_at && loan.due_date < today ? theme.colors.danger : theme.colors.primary, fontWeight: '700' }}>Due {date(loan.due_date)}{!loan.returned_at && loan.due_date < today ? ' · OVERDUE' : ''}</Text>
        <Text style={styles.muted}>{loan.returned_at ? `Returned ${date(loan.returned_at)}` : `Issued ${date(loan.issued_at)} · ${loan.renewal_count} renewals`} · {loan.returned_at ? 'Fine' : 'Estimated fine'} {money(loan.current_fine)}{Number(loan.fine_paid) ? ` · Paid ${money(loan.fine_paid)}` : ''}</Text>
        <View style={styles.actions}>{!loan.returned_at ? <><Button label="Return" disabled={busy} onPress={() => { setReturnLoan(loan); setCondition('available'); }} /><Button label="Renew" secondary disabled={busy || loan.due_date < today} onPress={() => { void run(async () => { await service.renew(loan.id); }); }} /></> : Number(loan.fine_amount) > Number(loan.fine_paid) ? <Button label="Record fine payment" disabled={busy} onPress={() => { setPayment(loan); setAmount((Number(loan.fine_amount) - Number(loan.fine_paid)).toFixed(2)); }} /> : null}</View>
      </View>) : <Empty text="No loans match this view." />)}
      {page === 'reservations' && (reservations.length ? reservations.map((r) => <View key={r.id} style={card}><Text style={[styles.sectionTitle, textStyle]}>{r.title}</Text><Text style={styles.muted}>{r.borrower_name} · Reserved {date(r.created_at)}</Text><Button label="Close reservation" secondary disabled={busy} onPress={() => alertCompat('Close reservation?', `${r.borrower_name} will leave the queue for ${r.title}.`, [{ text: 'Cancel' }, { text: 'Close reservation', onPress: () => { void run(async () => { await service.closeReservation(r.id); }); } }])} /></View>) : <Empty text="No active reservations. Reserve a title from the collection." />)}
      {page === 'settings' && <View style={card}>
        {([['loan_days', 'Loan period (days)'], ['max_loans', 'Maximum books per borrower'], ['max_renewals', 'Maximum renewals per loan'], ['fine_per_day', 'Overdue fine per day (₹)']] as const).map(([key, label]) => <Field key={key} label={label} numeric value={policy[key]} onChange={(value) => setPolicy((p) => ({ ...p, [key]: value }))} />)}
        <Text style={styles.muted}>Daily fines are fixed when a book is issued. Policy changes apply to new loans. Overdue borrowers must return their books before borrowing again.</Text>
        <Button label="Save policy" disabled={busy} onPress={() => { void run(async () => {
          if (Object.values(policy).some((v) => !v.trim() || !Number.isFinite(Number(v)))) throw new Error('Enter a valid number in each policy field.');
          await service.saveSettings({ loan_days: Number(policy.loan_days), max_loans: Number(policy.max_loans), max_renewals: Number(policy.max_renewals), fine_per_day: Number(policy.fine_per_day) });
          alertCompat('Policy saved', 'Library lending rules have been updated.');
        }); }} />
      </View>}
      {(page === 'catalog' || page === 'loans') && total > 50 && <View style={styles.between}><Button secondary label="Previous" disabled={pageNo === 1} onPress={() => setPageNo((v) => v - 1)} /><Text style={styles.muted}>Page {pageNo} of {Math.ceil(total / 50)}</Text><Button secondary label="Next" disabled={pageNo * 50 >= total} onPress={() => setPageNo((v) => v + 1)} /></View>}
    </>}
  </ScrollView>
  {toolsOpen && <StaffToolsDrawer portal="library" photoUrl={user?.photoUrl} onClose={() => setToolsOpen(false)} />}
  {busy && <View style={styles.busy}><ActivityIndicator color="#fff" /><Text style={{ color: '#fff' }}>Saving changes…</Text></View>}
  {editBook && <Sheet title={editBook === 'new' ? 'Add a title' : 'Edit title'} onClose={() => { if (!busy) setEditBook(null); }}>
    {(['title', 'author', 'isbn', 'category', 'publisher'] as const).map((key) => <Field key={key} label={`${key === 'isbn' ? 'ISBN' : key[0].toUpperCase() + key.slice(1)}${key === 'title' || key === 'author' ? ' *' : ''}`} value={bookForm[key]} onChange={(value) => setBookForm((v) => ({ ...v, [key]: value }))} />)}
    <Button label="Save title" disabled={busy || !bookForm.title.trim() || !bookForm.author.trim()} onPress={() => { void run(async () => { await service.saveBook(bookForm, editBook === 'new' ? undefined : editBook.id); setEditBook(null); }); }} />
    {editBook !== 'new' && <Button danger label="Archive title" disabled={busy} onPress={() => alertCompat('Archive title?', 'Copies will be withdrawn from circulation. Loan history is kept.', [{ text: 'Cancel' }, { text: 'Archive', onPress: () => { void run(async () => { await service.archiveBook(editBook.id); setEditBook(null); }); } }])} />}
  </Sheet>}
  {detail && <Sheet title={detail.title} onClose={() => { if (!busy) setDetail(null); }}>
    <Text style={styles.muted}>{detail.author} · Select an available copy to issue a book.</Text>
    {copies.length === 0 && <Empty text="Add an accessioned copy before lending this title." />}
    {copies.map((copy) => <View key={copy.id} style={card}><Text style={[styles.sectionTitle, textStyle]}>{copy.accession_no}</Text><Text style={styles.muted}>{copy.status} · Shelf {copy.shelf || 'unassigned'}</Text><View style={styles.actions}>
      {copy.status === 'available' && <Button label="Issue copy" disabled={busy} onPress={() => newLending(detail, copy)} />}
      {copy.status !== 'loaned' && <Button secondary label="Update copy" disabled={busy} onPress={() => { setCopyEdit(copy); setCopyStatus(copy.status); setCopyShelf(copy.shelf || ''); setDetail(null); }} />}
    </View></View>)}
    <Text style={[styles.sectionTitle, textStyle]}>Add physical copy</Text><Field label="Accession number *" value={accession} onChange={setAccession} /><Field label="Shelf location" value={shelf} onChange={setShelf} />
    <Button label="Add copy" disabled={busy || !accession.trim()} onPress={() => { void run(async () => { await service.addCopy(detail.id, { accession_no: accession.trim(), shelf }); setCopies(await service.copies(detail.id)); setAccession(''); }); }} />
  </Sheet>}
  {copyEdit && <Sheet title={`Update ${copyEdit.accession_no}`} onClose={() => { if (!busy) setCopyEdit(null); }}><Field label="Shelf location" value={copyShelf} onChange={setCopyShelf} />
    <Text style={styles.muted}>Condition / stock status</Text><View style={styles.actions}>{['available', 'lost', 'damaged', 'withdrawn'].map((v) => <Button key={v} label={v} secondary={v !== copyStatus} onPress={() => setCopyStatus(v)} />)}</View>
    <Button label="Save copy" disabled={busy} onPress={() => { void run(async () => { await service.updateCopy(copyEdit.id, { status: copyStatus, shelf: copyShelf }); setCopyEdit(null); }); }} />
  </Sheet>}
  {lend && <Sheet title={lend.copy ? `Issue ${lend.copy.accession_no}` : 'Reserve title'} onClose={() => { if (!busy) setLend(null); }}><Text style={[styles.sectionTitle, textStyle]}>{lend.book.title}</Text><BorrowerPicker selected={borrower} onSelect={setBorrower} />
    <Text style={styles.muted}>{lend.copy ? 'The due date and daily fine follow your school lending policy.' : 'This borrower joins the reservation queue for this title.'}</Text>
    <Button label={lend.copy ? 'Confirm issue' : 'Confirm reservation'} disabled={busy || !borrower} onPress={() => { void run(async () => { if (!borrower) return; if (lend.copy) await service.issue(lend.copy.id, borrower.id); else await service.reserve(lend.book.id, borrower.id); setLend(null); }); }} />
  </Sheet>}
  {returnLoan && <Sheet title="Return book" onClose={() => { if (!busy) setReturnLoan(null); }}><Text style={[styles.sectionTitle, textStyle]}>{returnLoan.title}</Text><Text style={styles.muted}>{returnLoan.borrower_name} · {returnLoan.accession_no}</Text>
    <Text style={styles.muted}>Return condition</Text><View style={styles.actions}>{[['available', 'Good condition'], ['damaged', 'Damaged'], ['lost', 'Lost']].map(([v, label]) => <Button key={v} label={label} secondary={v !== condition} onPress={() => setCondition(v)} />)}</View>
    <Text style={styles.muted}>Estimated overdue fine: {money(returnLoan.current_fine)}. The final amount uses the school date when the return is saved.</Text>
    <Button label="Confirm return" disabled={busy} onPress={() => { void run(async () => { await service.returnBook(returnLoan.id, condition); setReturnLoan(null); }); }} />
  </Sheet>}
  {payment && <Sheet title="Record fine payment" onClose={() => { if (!busy) setPayment(null); }}><Text style={[styles.sectionTitle, textStyle]}>{payment.borrower_name}</Text><Text style={styles.muted}>{payment.title} · Outstanding {money(Number(payment.fine_amount) - Number(payment.fine_paid))}</Text>
    <Field label="Amount received (₹)" numeric value={amount} onChange={setAmount} /><Text style={styles.muted}>Record money already received. This entry is kept in the library fine ledger.</Text>
    <Button label="Record payment" disabled={busy || !amount.trim() || !(Number(amount) > 0)} onPress={() => { void run(async () => { await service.payFine(payment.id, Number(amount)); setPayment(null); }); }} />
  </Sheet>}
  </View>;
}

function LibrarySectionLabel({ label }: { label: string }) {
  const { theme } = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginTop: 8 }}><LinearGradient colors={['#6C63FF', '#10B981']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ width: 3, height: 16, borderRadius: 2, marginRight: 9 }} /><Text style={{ color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600', letterSpacing: 0.5 }}>{label}</Text></View>;
}

function useLibraryStyles() {
  const { theme, isDark } = useTheme();
  return useMemo(() => createStyles(theme, isDark), [theme, isDark]);
}
const createStyles = (theme: SchoolTheme, isDark: boolean) => StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, maxWidth: 1120, width: '100%', alignSelf: 'center' },
  heroBand: { backgroundColor: '#15245C', borderRadius: 16, overflow: 'hidden', marginBottom: 24 },
  hero: { ...flatCard(isDark, 'md'), padding: 24, marginBottom: 24, flexDirection: 'row', alignItems: 'center', gap: 16 },
  headingIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: schoolColorWithAlpha(theme.colors.primary, 0.12) },
  eyebrow: { color: theme.colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 5 },
  heroTitle: { color: theme.colors.textStrong, fontSize: 24, fontWeight: '800', letterSpacing: -0.6, marginBottom: 6 },
  heroSubtitle: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingVertical: 8, flexWrap: 'wrap' },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  button: { borderRadius: 10, overflow: 'hidden', marginVertical: 4 },
  buttonInner: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  card: { ...flatCard(isDark, 'sm'), padding: 20, gap: 10, marginBottom: 16 },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 4 },
  allTools: { minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  muted: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 21 },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  input: { ...flatInset(isDark), color: theme.colors.text, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  sheet: { ...flatCard(isDark, 'lg'), backgroundColor: theme.colors.card, width: '100%', maxWidth: 620, maxHeight: '90%', overflow: 'hidden' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, borderBottomWidth: 1, borderColor: theme.colors.border },
  selected: { ...flatCard(isDark, 'sm'), padding: 12, marginVertical: 12, gap: 8 },
  selectedText: { color: theme.colors.textStrong, fontSize: 15, fontWeight: '700' },
  option: { ...flatCard(isDark, 'sm'), padding: 14, marginBottom: 8 },
  activity: { paddingVertical: 12, borderBottomWidth: 1, borderColor: theme.colors.border, gap: 4 },
  busy: { position: 'absolute', bottom: 20, alignSelf: 'center', backgroundColor: theme.colors.primaryDark, borderRadius: 16, padding: 16, flexDirection: 'row', gap: 12 },
});
