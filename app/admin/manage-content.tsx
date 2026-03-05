import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Alert } from 'react-native';
import AdminHeader from '../../src/components/AdminHeader';
import { useAuth } from '../../src/hooks/useAuth';
import { supabase } from '../../src/services/supabaseConfig';
import { ADMIN_THEME } from '../../src/constants/adminTheme';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
type ContentType = 'money_science' | 'life_values' | 'science_projects';
export default function ManageContent() {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const {
    user
  } = useAuth();
  const [activeTab, setActiveTab] = useState<ContentType>('money_science');

  // Form States (Simplified for basic CRUD)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contentBody, setContentBody] = useState('');
  const [loading, setLoading] = useState(false);

  // Dynamic Fields based on tab
  const [ageGroup, setAgeGroup] = useState('');
  const [duration, setDuration] = useState('');
  const [points, setPoints] = useState('');
  const [difficulty, setDifficulty] = useState('beginner');
  const resetForm = () => {
    setTitle('');
    setDescription('');
    setContentBody('');
    setAgeGroup('');
    setDuration('');
    setPoints('');
  };
  const handleSubmit = async () => {
    if (!title || !description) {
      Alert.alert('Error', 'Please fill required fields.');
      return;
    }
    setLoading(true);
    try {
      let table = '';
      let payload: any = {
        title,
        description,
        created_at: new Date().toISOString()
      };
      if (activeTab === 'money_science') {
        table = 'money_science_modules';
        payload = {
          ...payload,
          content_body: contentBody,
          age_group: ageGroup,
          estimated_duration: parseInt(duration) || 0,
          total_points: parseInt(points) || 10,
          difficulty_level: difficulty
        };
      } else if (activeTab === 'life_values') {
        table = 'life_values_modules';
        payload = {
          ...payload,
          content_body: contentBody
          // Optionally add quotes/banners here
        };
      } else if (activeTab === 'science_projects') {
        table = 'science_projects';
        payload = {
          ...payload,
          difficulty_level: difficulty,
          materials_required: contentBody.split('\n') // Hacky list input
        };
      }
      const {
        error
      } = await supabase.from(table).insert(payload);
      if (error) throw error;
      Alert.alert('Success', 'Content added successfully!');
      resetForm();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };
  return <View style={styles.container}>
            <AdminHeader title="Manage Content" showBackButton />

            {/* TABS */}
            <View style={styles.tabBar}>
                {(['money_science', 'life_values', 'science_projects'] as ContentType[]).map(tab => {
return <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.activeTab]} onPress={() => setActiveTab(tab)}>
                        <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                            {tab.replace('_', ' ').toUpperCase()}
                        </Text>
                    </TouchableOpacity>;
      })}
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.sectionTitle}>Add New Item</Text>

                <TextInput style={styles.input} placeholder="Title" value={title} onChangeText={setTitle} placeholderTextColor="#9ca3af" />

                <TextInput style={[styles.input, styles.textArea]} placeholder="Short Description" value={description} onChangeText={setDescription} multiline placeholderTextColor="#9ca3af" />

                {/* DYNAMIC FIELDS */}
                {activeTab === 'money_science' && <>
                        <TextInput style={styles.input} placeholder="Age Group (e.g. 6-8)" value={ageGroup} onChangeText={setAgeGroup} placeholderTextColor="#9ca3af" />
                        <TextInput style={styles.input} placeholder="Duration (mins)" value={duration} onChangeText={setDuration} keyboardType='numeric' placeholderTextColor="#9ca3af" />
                        <TextInput style={styles.input} placeholder="Total Points" value={points} onChangeText={setPoints} keyboardType='numeric' placeholderTextColor="#9ca3af" />
                    </>}

                <Text style={styles.label}>{activeTab === 'science_projects' ? 'Materials (Line separated)' : 'Content Body (Markdown)'}</Text>
                <TextInput style={[styles.input, styles.largeArea]} placeholder="Enter detailed content..." value={contentBody} onChangeText={setContentBody} multiline textAlignVertical="top" placeholderTextColor="#9ca3af" />

                <TouchableOpacity style={[styles.submitBtn, loading && styles.disabledBtn]} onPress={handleSubmit} disabled={loading}>
                    <Text style={styles.submitBtnText}>{loading ? 'Saving...' : 'Create Content'}</Text>
                </TouchableOpacity>

            </ScrollView>
        </View>;
}
const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6'
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    padding: 4
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent'
  },
  activeTab: {
    borderBottomColor: ADMIN_THEME.colors.primary
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280'
  },
  activeTabText: {
    color: ADMIN_THEME.colors.primary
  },
  content: {
    padding: 20
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    color: '#111827'
  },
  input: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16
  },
  textArea: {
    height: 80
  },
  largeArea: {
    height: 200
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#374151'
  },
  submitBtn: {
    backgroundColor: ADMIN_THEME.colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center'
  },
  disabledBtn: {
    opacity: 0.7
  },
  submitBtnText: {
    color: theme.colors.background,
    fontWeight: 'bold',
    fontSize: 16
  }
});