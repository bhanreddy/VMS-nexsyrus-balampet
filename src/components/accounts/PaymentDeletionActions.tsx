import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppTextInput from '../AppTextInput';
import { FeeService } from '../../services/feeService';
import { FeeTransaction } from '../../types/models';
import { alertCompat } from '../../utils/crossPlatformAlert';

interface Props {
  transaction: FeeTransaction;
  isDark: boolean;
  onChanged: () => void | Promise<void>;
}

export default function PaymentDeletionActions({ transaction, isDark, onChanged }: Props) {
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const status = transaction.deletion_status;

  if (status === 'DELETED' || transaction.can_delete === false) {
    return null;
  }

  const submitRequest = async () => {
    const normalized = reason.trim();
    if (!normalized) {
      alertCompat('Reason required', 'Explain why this payment must be deleted.');
      return;
    }
    setBusy(true);
    try {
      await FeeService.requestPaymentDeletion(transaction.id, normalized);
      setReasonOpen(false);
      setReason('');
      alertCompat('Request sent', 'The payment will remain in the ledger until an admin approves it.');
      await onChanged();
    } catch (error: any) {
      alertCompat('Request failed', error?.message || 'Could not send the deletion request.');
    } finally {
      setBusy(false);
    }
  };

  const deletePayment = () => {
    if (!transaction.deletion_approval_id) {
      alertCompat('Approval missing', 'Refresh the page and try again.');
      return;
    }
    alertCompat(
      'Delete payment?',
      'This restores the student balance. The original payment remains in the audit history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete payment',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await FeeService.deleteApprovedPayment(
                transaction.id,
                transaction.deletion_approval_id!,
              );
              alertCompat('Payment deleted', 'The fee ledger and collection totals have been restored.');
              await onChanged();
            } catch (error: any) {
              alertCompat('Deletion failed', error?.message || 'Could not delete the payment.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const textColor = isDark ? '#F9FAFB' : '#111827';
  const muted = isDark ? 'rgba(255,255,255,0.55)' : '#64748B';

  return (
    <>
      {status === 'PENDING' ? (
        <View style={[styles.statusPill, { backgroundColor: isDark ? 'rgba(245,158,11,0.16)' : '#FFFBEB' }]}>
          <Ionicons name="time-outline" size={13} color="#D97706" />
          <Text style={[styles.statusText, { color: '#D97706' }]}>Waiting for admin</Text>
        </View>
      ) : status === 'APPROVED' ? (
        <Pressable disabled={busy} onPress={deletePayment} style={[styles.action, styles.deleteAction]}>
          {busy ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="trash-outline" size={14} color="#fff" />}
          <Text style={styles.actionText}>Delete payment</Text>
        </Pressable>
      ) : (
        <Pressable disabled={busy} onPress={() => setReasonOpen(true)} style={[styles.action, styles.requestAction]}>
          <Ionicons name={status === 'REJECTED' ? 'refresh-outline' : 'trash-outline'} size={14} color="#DC2626" />
          <Text style={[styles.actionText, { color: '#DC2626' }]}>
            {status === 'REJECTED' ? 'Request again' : 'Request deletion'}
          </Text>
        </Pressable>
      )}

      <Modal visible={reasonOpen} transparent animationType="fade" onRequestClose={() => !busy && setReasonOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.modalCard, { backgroundColor: isDark ? '#1C1F2A' : '#FFFFFF' }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Request payment deletion</Text>
            <Text style={[styles.modalDescription, { color: muted }]}>
              Admin will review this exact payment. If it is a combined receipt, every line in that receipt will be reversed together.
            </Text>
            <AppTextInput
              value={reason}
              onChangeText={setReason}
              editable={!busy}
              multiline
              numberOfLines={4}
              placeholder="Reason, for example: Collected for the wrong student"
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#94A3B8'}
              style={[
                styles.reasonInput,
                {
                  color: textColor,
                  backgroundColor: isDark ? '#0F1117' : '#F8FAFC',
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#CBD5E1',
                },
              ]}
            />
            <View style={styles.modalActions}>
              <Pressable disabled={busy} onPress={() => setReasonOpen(false)} style={styles.cancelButton}>
                <Text style={[styles.cancelText, { color: muted }]}>Cancel</Text>
              </Pressable>
              <Pressable disabled={busy} onPress={submitRequest} style={styles.submitButton}>
                {busy ? <ActivityIndicator size="small" color="#fff" /> : null}
                <Text style={styles.submitText}>Send to admin</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  action: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 10,
  },
  requestAction: { backgroundColor: 'rgba(220,38,38,0.09)' },
  deleteAction: { backgroundColor: '#DC2626' },
  actionText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
    marginTop: 10,
  },
  statusText: { fontSize: 11, fontWeight: '800' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: { width: '100%', maxWidth: 480, borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 19, fontWeight: '800' },
  modalDescription: { fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 14 },
  reasonInput: {
    minHeight: 104,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  cancelButton: { paddingHorizontal: 14, paddingVertical: 11 },
  cancelText: { fontSize: 13, fontWeight: '700' },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  submitText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
