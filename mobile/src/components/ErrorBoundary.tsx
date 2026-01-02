import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing the app.
 * 
 * Required for app store certification - prevents white screen crashes.
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log error to console (in production, send to error reporting service)
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({ errorInfo });

        // TODO: Send to crash reporting service (Sentry, Crashlytics, etc.)
        // crashReportingService.logError(error, errorInfo);
    }

    handleRestart = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <View style={styles.container}>
                    <View style={styles.content}>
                        {/* Error Icon */}
                        <View style={styles.iconContainer}>
                            <Ionicons name="warning-outline" size={64} color={Colors.dark.warning} />
                        </View>

                        {/* Error Message */}
                        <Text style={styles.title}>Oops! Something went wrong</Text>
                        <Text style={styles.message}>
                            We apologize for the inconvenience. The app encountered an unexpected error.
                        </Text>

                        {/* Error Details (Dev Mode) */}
                        {__DEV__ && this.state.error && (
                            <ScrollView style={styles.errorDetails} nestedScrollEnabled>
                                <Text style={styles.errorText}>
                                    {this.state.error.toString()}
                                </Text>
                                {this.state.errorInfo && (
                                    <Text style={styles.stackTrace}>
                                        {this.state.errorInfo.componentStack}
                                    </Text>
                                )}
                            </ScrollView>
                        )}

                        {/* Retry Button */}
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={this.handleRestart}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="refresh" size={20} color="#fff" />
                            <Text style={styles.retryText}>Try Again</Text>
                        </TouchableOpacity>

                        {/* Help Text */}
                        <Text style={styles.helpText}>
                            If the problem persists, please contact support.
                        </Text>
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
        backgroundColor: Colors.dark.background,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.xl,
    },
    content: {
        alignItems: 'center',
        maxWidth: 320,
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: Colors.dark.warning + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    title: {
        fontSize: FontSize.xxl,
        fontWeight: '700',
        color: '#1a1a1a', // Previously Colors.dark.text
        textAlign: 'center',
        marginBottom: Spacing.md,
    },
    message: {
        fontSize: FontSize.md,
        color: '#525252', // Previously Colors.dark.textSecondary
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: Spacing.xl,
    },
    errorDetails: {
        maxHeight: 150,
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        marginBottom: Spacing.xl,
        width: '100%',
    },
    errorText: {
        fontSize: FontSize.sm,
        color: Colors.dark.danger,
        fontFamily: 'monospace',
    },
    stackTrace: {
        fontSize: FontSize.xs,
        color: '#737373', // Previously Colors.dark.textMuted
        fontFamily: 'monospace',
        marginTop: Spacing.sm,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.dark.primary,
        paddingHorizontal: Spacing.xxl,
        paddingVertical: Spacing.lg,
        borderRadius: BorderRadius.lg,
        gap: Spacing.sm,
        marginBottom: Spacing.lg,
    },
    retryText: {
        fontSize: FontSize.lg,
        fontWeight: '600',
        color: '#fff',
    },
    helpText: {
        fontSize: FontSize.sm,
        color: '#737373', // Previously Colors.dark.textMuted
        textAlign: 'center',
    },
});

export default ErrorBoundary;
