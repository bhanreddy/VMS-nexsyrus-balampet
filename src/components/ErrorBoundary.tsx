import React, { Component, ErrorInfo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to service (e.g. Sentry) here
    // For now, safe console logging
    if (__DEV__) {

    } else {

    }

    this.setState({
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
    // Navigate to root to reset state
    router.replace('/welcome');
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
                    <View style={styles.content}>
                        <Text style={styles.title}>Oops!</Text>
                        <Text style={styles.subtitle}>Something went wrong.</Text>
                        {__DEV__ &&
            <ScrollView style={styles.debugBox}>
                                <Text style={styles.errorText}>{this.state.error?.toString()}</Text>
                                <Text style={styles.stackText}>{this.state.errorInfo?.componentStack}</Text>
                            </ScrollView>
            }
                        <TouchableOpacity style={styles.button} onPress={this.handleReset}>
                            <Text style={styles.buttonText}>Go Home</Text>
                        </TouchableOpacity>
                    </View>
                </View>);

    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20
  },
  content: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 400
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center'
  },
  debugBox: {
    maxHeight: 200,
    width: '100%',
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20
  },
  errorText: {
    color: '#d32f2f',
    fontWeight: 'bold',
    marginBottom: 5
  },
  stackText: {
    color: '#555',
    fontSize: 12
  },
  button: {
    backgroundColor: '#007AFF', // Standard Blue
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    elevation: 2
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  }
});