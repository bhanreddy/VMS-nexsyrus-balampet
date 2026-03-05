import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenLayout from '../../src/components/ScreenLayout';
import StudentHeader from '../../src/components/StudentHeader';
import { useTheme } from '../../src/hooks/useTheme';
const projects = [{
  title: 'Magnetic Levitation',
  query: 'Magnetic Levitation science project DIY'
}, {
  title: 'Simple Electric Circuit',
  query: 'Simple Electric Circuit project for students'
}, {
  title: 'Volcano Eruption',
  query: 'Volcano Eruption science experiment'
}, {
  title: 'Invisible Ink',
  query: 'Invisible Ink lemon juice experiment'
}, {
  title: 'Mini Water Purifier',
  query: 'Homemade Water Purifier science project'
}, {
  title: 'Solar Oven',
  query: 'DIY Solar Oven box project'
}, {
  title: 'Homemade Slime',
  query: 'Science behind slime experiment'
}];
const ScienceProjectsScreen = () => {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(), []);
  const router = useRouter();
  const handlePress = (item: {
    title: string;
    query: string;
  }) => {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(item.query)}`;
    router.push({
      pathname: '/Screen/webView',
      params: {
        url: searchUrl,
        title: item.title
      }
    });
  };
  return <ScreenLayout>
            {/* ===== HEADER ===== */}
            <StudentHeader showBackButton={true} title="Science Projects" />

            {/* ===== CONTENT ===== */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
                {/* ===== TITLE ===== */}
                <View style={styles.titleContainer}>
                    <Text style={styles.pageTitle}>Science Projects</Text>
                    <Text style={styles.subtitle}>
                        Learn by doing • Build • Experiment
                    </Text>
                </View>

                {/* ===== PROJECT LIST ===== */}
                <Text style={styles.sectionTitle}>
                    Project List & Certification
                </Text>

                {projects.map((project, index) => {
return <TouchableOpacity key={index} activeOpacity={0.9} onPress={() => handlePress(project)}>
                        <LinearGradient colors={['#e8f5e9', '#c8e6c9']} // Green-ish for science
          start={{
            x: 0,
            y: 0
          }} end={{
            x: 1,
            y: 1
          }} style={styles.projectCard}>
                            <View style={styles.left}>
                                <View style={styles.iconCircle}>
                                    <Text style={styles.icon}>🧪</Text>
                                </View>
                                <Text style={styles.projectText}>{project.title}</Text>
                            </View>

                            <View style={styles.arrowContainer}>
                                <Text style={styles.arrow}>›</Text>
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>;
      })}

                {/* ===== CERTIFICATE INFO ===== */}
                <LinearGradient colors={['#fff8e1', '#ffecb3']} style={styles.certificateCard}>
                    <Text style={styles.certificateIcon}>🏆</Text>
                    <Text style={styles.certificateText}>
                        <Text style={{
            fontWeight: 'bold'
          }}>Get Certified!</Text>{'\n'}
                        Complete a project and submit your report to receive a certificate.
                    </Text>
                </LinearGradient>

            </ScrollView>
        </ScreenLayout>;
};
export default ScienceProjectsScreen;

/* ============================ STYLES ============================ */

const getStyles = () => StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 30
  },
  titleContainer: {
    marginBottom: 20
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1b5e20',
    marginBottom: 4
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#558b2f'
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#33691e',
    marginBottom: 16,
    marginLeft: 4
  },
  projectCard: {
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    shadowColor: '#1b5e20',
    shadowOffset: {
      width: 0,
      height: 4
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)'
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14
  },
  icon: {
    fontSize: 22
  },
  projectText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1b5e20'
  },
  arrowContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  arrow: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1b5e20',
    marginTop: -2
  },
  /* Certificate */
  certificateCard: {
    marginTop: 20,
    borderRadius: 18,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#ff6f00',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#ffe082'
  },
  certificateIcon: {
    fontSize: 32,
    marginRight: 16
  },
  certificateText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6d4c41',
    flex: 1,
    lineHeight: 20
  }
});