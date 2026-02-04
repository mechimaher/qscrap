/**
 * ScreenErrorBoundary — E2 Enterprise Resilience
 * Catches errors at screen level for graceful degradation.
 * Prevents entire app crash when a single screen fails.
 */

import React, { Component, ReactNode } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants';
import { captureException, addBreadcrumb } from '../services/sentry';

interface Props {
    children: ReactNode;
    screenName?: string;
    onRetry?: () => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}

export class ScreenErrorBoundary extends Component<Props, State> {
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

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        // Log to console in development
        console.error('[ScreenErrorBoundary] Caught error:', error);
        console.error('[ScreenErrorBoundary] Component stack:', errorInfo.componentStack);

        this.setState({ errorInfo });

        // Report to Sentry
        addBreadcrumb('error-boundary', 'Screen error caught', {
            screenName: this.props.screenName,
            componentStack: errorInfo.componentStack,
        }, 'error');

        captureException(error, {
            screenName: this.props.screenName,
            componentStack: errorInfo.componentStack,
        });
    }

    handleRetry = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
        this.props.onRetry?.();
    };

    render(): ReactNode {
        if (this.state.hasError) {
            const { screenName } = this.props;
            const { error } = this.state;

            return (
                <View
                    style={styles.container}
                    accessible={true}
                    accessibilityRole="alert"
                    accessibilityLabel={`Error: ${screenName ? `${screenName} could not be loaded` : 'Screen error occurred'}`}
                >
                    <View style={styles.content}>
                        {/* Error Icon */}
                        <View
                            style={styles.iconContainer}
                            accessibilityElementsHidden={true}
                        >
                            <MaterialCommunityIcons
                                name="alert-circle-outline"
                                size={64}
                                color={Colors.primary}
                            />
                        </View>

                        {/* Error Message */}
                        <Text
                            style={styles.title}
                            accessibilityRole="header"
                        >
                            Something went wrong
                        </Text>
                        <Text style={styles.subtitle}>
                            {screenName
                                ? `We couldn't load ${screenName}`
                                : "This screen couldn't be displayed"}
                        </Text>

                        {/* Error Details (Development Only) */}
                        {__DEV__ && error && (
                            <ScrollView style={styles.errorDetails} horizontal>
                                <Text style={styles.errorText}>
                                    {error.toString()}
                                </Text>
                            </ScrollView>
                        )}

                        {/* Retry Button */}
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={this.handleRetry}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityLabel="Try again"
                            accessibilityHint="Attempts to reload the screen"
                        >
                            <MaterialCommunityIcons
                                name="refresh"
                                size={20}
                                color="#FFF"
                                style={styles.retryIcon}
                            />
                            <Text style={styles.retryText}>Try Again</Text>
                        </TouchableOpacity>

                        {/* Help Text */}
                        <Text style={styles.helpText}>
                            If this problem persists, please restart the app
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
        backgroundColor: '#F9FAFB',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.xl,
    },
    content: {
        alignItems: 'center',
        maxWidth: 320,
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: Colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    title: {
        fontSize: FontSize.xl,
        fontWeight: '700',
        color: '#1F2937',
        textAlign: 'center',
        marginBottom: Spacing.sm,
    },
    subtitle: {
        fontSize: FontSize.md,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: Spacing.lg,
        lineHeight: 22,
    },
    errorDetails: {
        backgroundColor: '#FEE2E2',
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        marginBottom: Spacing.lg,
        maxHeight: 80,
        width: '100%',
    },
    errorText: {
        fontSize: 11,
        fontFamily: 'monospace',
        color: '#991B1B',
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.full,
        marginBottom: Spacing.lg,
    },
    retryIcon: {
        marginRight: Spacing.sm,
    },
    retryText: {
        color: '#FFF',
        fontSize: FontSize.md,
        fontWeight: '600',
    },
    helpText: {
        fontSize: FontSize.sm,
        color: '#9CA3AF',
        textAlign: 'center',
    },
});

export default ScreenErrorBoundary;
