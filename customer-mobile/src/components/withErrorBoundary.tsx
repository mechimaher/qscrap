/**
 * withErrorBoundary — E2 Enterprise Pattern
 * Higher-order component that wraps screens with ScreenErrorBoundary.
 * Allows declarative error boundary usage without modifying screen internals.
 */

import React, { ComponentType } from 'react';
import { ScreenErrorBoundary } from './ScreenErrorBoundary';

interface WithErrorBoundaryOptions {
    screenName?: string;
    onRetry?: () => void;
}

export function withErrorBoundary<P extends object>(
    WrappedComponent: ComponentType<P>,
    options: WithErrorBoundaryOptions = {}
) {
    const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

    const ComponentWithErrorBoundary: React.FC<P> = (props) => {
        return (
            <ScreenErrorBoundary
                screenName={options.screenName || displayName}
                onRetry={options.onRetry}
            >
                <WrappedComponent {...props} />
            </ScreenErrorBoundary>
        );
    };

    ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

    return ComponentWithErrorBoundary;
}

export default withErrorBoundary;
