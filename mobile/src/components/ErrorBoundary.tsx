// ErrorBoundary - Catches React component errors and shows recovery UI
import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius, FontSizes } from '../constants/theme';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);
        this.props.onError?.(error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <View style={styles.container}>
                    <View style={styles.content}>
                        <Text style={styles.icon}>⚠️</Text>
                        <Text style={styles.title}>Something went wrong</Text>
                        <Text style={styles.message}>
                            We're sorry, but something unexpected happened. Please try again.
                        </Text>
                        {__DEV__ && this.state.error && (
                            <Text style={styles.errorDetail}>
                                {this.state.error.message}
                            </Text>
                        )}
                        <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
                            <LinearGradient
                                colors={[Colors.primary, '#B31D4A']}
                                style={styles.buttonGradient}
                            >
                                <Text style={styles.buttonText}>Try Again</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
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
        backgroundColor: '#FAFAFA',
        padding: Spacing.xl,
    },
    content: {
        alignItems: 'center',
        maxWidth: 300,
    },
    icon: {
        fontSize: 64,
        marginBottom: Spacing.lg,
    },
    title: {
        fontSize: FontSizes.xxl,
        fontWeight: '800',
        color: '#1A1A1A',
        marginBottom: Spacing.sm,
        textAlign: 'center',
    },
    message: {
        fontSize: FontSizes.md,
        color: '#6A6A6A',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: Spacing.lg,
    },
    errorDetail: {
        fontSize: FontSizes.sm,
        color: Colors.error,
        textAlign: 'center',
        marginBottom: Spacing.lg,
        padding: Spacing.md,
        backgroundColor: '#FEE2E2',
        borderRadius: BorderRadius.md,
        width: '100%',
    },
    button: {
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        marginTop: Spacing.md,
    },
    buttonGradient: {
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xl,
    },
    buttonText: {
        color: '#fff',
        fontSize: FontSizes.md,
        fontWeight: '700',
    },
});

export default ErrorBoundary;
