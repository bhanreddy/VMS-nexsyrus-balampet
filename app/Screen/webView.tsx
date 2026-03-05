import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router'; // expo-router handles navigation
import StudentHeader from '../../src/components/StudentHeader';
import ScreenLayout from '../../src/components/ScreenLayout';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';
export default function WebViewScreen() {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const {
    url,
    title
  } = useLocalSearchParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Ensure params are strings (hooks can return arrays)
  const uri = typeof url === 'string' ? url : Array.isArray(url) ? url[0] : '';
  const pageTitle = typeof title === 'string' ? title : Array.isArray(title) ? title[0] : 'Content';
  const handleLoadStart = () => {
    setIsLoading(true);
    setHasError(false);
  };
  const handleLoadEnd = () => {
    setIsLoading(false);
  };
  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };
  if (!uri) {
    return <ScreenLayout>
                <StudentHeader showBackButton={true} title="Error" />
                <View style={styles.centerContainer}>
                    <Text style={styles.errorText}>Invalid URL provided.</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
                        <Text style={styles.retryText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </ScreenLayout>;
  }
  return <ScreenLayout>
            <StudentHeader showBackButton={true} title={pageTitle} />
            <View style={styles.container}>
                {hasError ? <View style={styles.centerContainer}>
                        <Text style={styles.errorText}>Failed to load content.</Text>
                        <Text style={styles.subErrorText}>Please check your internet connection.</Text>
                        {/* WebView might not support reload nicely without ref, so simple back for now or retry logic could be added */}
                    </View> : <WebView source={{
        uri: uri
      }} style={styles.webview} startInLoadingState={true} renderLoading={() => {
return <View style={styles.loadingOverlay}>
                                <LogoLoader size={60} color="#4F46E5" />
                            </View>;
      }} onLoadStart={handleLoadStart} onLoadEnd={handleLoadEnd} onError={handleError} javaScriptEnabled={true} domStorageEnabled={true} scalesPageToFit={true} // For Android text sizing
      />}
            </View>
        </ScreenLayout>;
}
const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb'
  },
  webview: {
    flex: 1
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    zIndex: 10
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#dc2626',
    marginBottom: 8
  },
  subErrorText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center'
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: theme.colors.primary,
    borderRadius: 8
  },
  retryText: {
    color: theme.colors.background,
    fontWeight: 'bold'
  }
});