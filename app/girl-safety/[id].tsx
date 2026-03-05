import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { GirlSafetyService, ComplaintDetails } from '../../src/services/girlSafetyService';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/hooks/useAuth';

export default function ComplaintDetailScreen() {
  const { id } = useLocalSearchParams<{id: string;}>();
  const { user } = useAuth();
  const [complaint, setComplaint] = useState<ComplaintDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (id) fetchDetails();
  }, [id]);

  const fetchDetails = async () => {
    try {
      const data = await GirlSafetyService.getComplaintDetails(id!);
      setComplaint(data);
    } catch (error) {

    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || sending) return;
    try {
      setSending(true);
      const newReply = await GirlSafetyService.addReply(id!, replyText.trim());
      setComplaint((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          threads: [...prev.threads, newReply]
        };
      });
      setReplyText('');
      // Scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {

    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerLoading}>
                <ActivityIndicator size="large" color="#6D28D9" />
            </View>);

  }

  if (!complaint) {
    return (
      <View style={styles.centerLoading}>
                <Text>Complaint not found.</Text>
            </View>);

  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':return '#F59E0B';
      case 'in_review':return '#3B82F6';
      case 'resolved':return '#10B981';
      default:return '#6B7280';
    }
  };

  const isResolved = complaint.status === 'resolved';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>

            <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}>

                {/* Header Card */}
                <View style={styles.headerCard}>
                    <View style={styles.rowBetween}>
                        <Text style={styles.ticketNo}>Ticket: {complaint.ticket_no}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(complaint.status) + '1A' }]}>
                            <Text style={[styles.statusText, { color: getStatusColor(complaint.status) }]}>
                                {complaint.status.replace('_', ' ').toUpperCase()}
                            </Text>
                        </View>
                    </View>
                    <Text style={styles.category}>{complaint.category}</Text>
                    <Text style={styles.label}>Description</Text>
                    <Text style={styles.description}>{complaint.description}</Text>
                    <View style={styles.metaRow}>
                        <Ionicons name="calendar-outline" size={14} color="#64748B" />
                        <Text style={styles.metaText}>{new Date(complaint.created_at).toLocaleString()}</Text>
                    </View>
                    {complaint.assigned_authority &&
          <View style={[styles.metaRow, { marginTop: 4 }]}>
                            <Ionicons name="person-circle-outline" size={14} color="#64748B" />
                            <Text style={styles.metaText}>Assigned to: {complaint.assigned_authority}</Text>
                        </View>
          }
                </View>
                {/* Thread */}
                <Text style={styles.threadTitle}>Conversation</Text>
                {complaint.threads.length === 0 ?
        <Text style={styles.emptyThread}>No updates yet. An authority will respond here.</Text> :

        complaint.threads.map((msg, index) => {
          const isStudent = msg.sender_role === 'student';
          // if current user is student, their messages are right, admin is left
          // if current user is admin, their messages are right, student is left
          const isMe = user?.role === 'student' ? isStudent : !isStudent;

          return (
            <View key={msg.id || index} style={[styles.bubbleWrapper, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
                                {!isMe && <View style={styles.avatarLeft}><Ionicons name={isStudent ? "person" : "shield-checkmark"} size={14} color="#FFF" /></View>}
                                <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                                    <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>
                                        {msg.message}
                                    </Text>
                                    <Text style={[styles.bubbleTime, isMe ? styles.bubbleTimeMe : styles.bubbleTimeThem]}>
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </View>
                            </View>);

        })
        }
            </ScrollView>
            {/* Reply Input Box */}
            {!isResolved ?
      <View style={styles.replyBox}>
                    <TextInput
          style={styles.replyInput}
          placeholder="Type a message..."
          placeholderTextColor="#94A3B8"
          multiline
          maxLength={500}
          value={replyText}
          onChangeText={setReplyText} />

                    <TouchableOpacity
          style={[styles.sendButton, !replyText.trim() && styles.sendButtonDisabled]}
          disabled={!replyText.trim() || sending}
          onPress={handleSendReply}>

                        {sending ?
          <ActivityIndicator size="small" color="#FFF" /> :

          <Ionicons name="send" size={16} color="#FFF" />
          }
                    </TouchableOpacity>
                </View> :

      <View style={styles.resolvedBox}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    <Text style={styles.resolvedText}>This complaint has been marked as resolved.</Text>
                </View>
      }
        </KeyboardAvoidingView>);

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC'
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  ticketNo: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B'
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700'
  },
  category: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginBottom: 6
  },
  description: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 24,
    marginBottom: 16
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  metaText: {
    fontSize: 13,
    color: '#64748B'
  },
  threadTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
    marginLeft: 4
  },
  emptyThread: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic'
  },
  bubbleWrapper: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end'
  },
  bubbleRight: {
    justifyContent: 'flex-end'
  },
  bubbleLeft: {
    justifyContent: 'flex-start'
  },
  avatarLeft: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#C4B5FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8
  },
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16
  },
  bubbleMe: {
    backgroundColor: '#7C3AED',
    borderBottomRightRadius: 4
  },
  bubbleThem: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22
  },
  bubbleTextMe: {
    color: '#FFFFFF'
  },
  bubbleTextThem: {
    color: '#334155'
  },
  bubbleTime: {
    fontSize: 11,
    marginTop: 6,
    alignSelf: 'flex-end'
  },
  bubbleTimeMe: {
    color: 'rgba(255,255,255,0.7)'
  },
  bubbleTimeThem: {
    color: '#94A3B8'
  },
  replyBox: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'flex-end',
    gap: 12
  },
  replyInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    color: '#0F172A',
    minHeight: 46,
    maxHeight: 120
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center'
  },
  sendButtonDisabled: {
    backgroundColor: '#C4B5FD'
  },
  resolvedBox: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#ECFDF5',
    borderTopWidth: 1,
    borderColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  resolvedText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '600'
  }
});