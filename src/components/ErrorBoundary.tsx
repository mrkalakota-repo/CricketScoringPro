import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message ?? 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <MaterialCommunityIcons name="alert-circle-outline" size={64} color="#E65100" />
          <Text variant="titleLarge" style={styles.title}>Something went wrong</Text>
          <Text variant="bodyMedium" style={styles.message}>
            {this.state.message}
          </Text>
          <Button
            mode="contained"
            onPress={this.handleRetry}
            style={styles.button}
            icon="refresh"
          >
            Try Again
          </Button>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
    backgroundColor: '#F0F9F1',
  },
  title: { fontWeight: '800', textAlign: 'center', color: '#1A2B1B' },
  message: { color: '#4A6B4C', textAlign: 'center', maxWidth: 300, lineHeight: 22 },
  button: { marginTop: 8, borderRadius: 12 },
});
