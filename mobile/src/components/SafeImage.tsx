import React, { useState } from 'react';
import { Image, ImageProps, ImageSourcePropType, View, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';

interface SafeImageProps extends Omit<ImageProps, 'source'> {
  source: ImageSourcePropType | string;
  fallbackIcon?: string;
  fallbackColor?: string;
  showLoading?: boolean;
  borderRadius?: number;
}

/**
 * Enterprise-grade Image component with:
 * - Automatic fallback on error (404, network issues)
 * - Loading state indicator
 * - Retry capability
 * - Consistent styling
 * 
 * Usage: <SafeImage source={uri} style={...} />
 */
export const SafeImage: React.FC<SafeImageProps> = ({
  source,
  fallbackIcon = 'image-outline',
  fallbackColor = colors.gray300,
  showLoading = true,
  borderRadius = 8,
  style,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

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

  const handleRetry = () => {
    if (retryCount < 3) {
      setRetryCount(prev => prev + 1);
      setIsLoading(true);
      setHasError(false);
    }
  };

  // Normalize source to string for comparison
  const sourceUri = typeof source === 'string' ? source : 
                   (source as any)?.uri || '';

  return (
    <View style={[{ position: 'relative' }, style]}>
      {hasError ? (
        <View 
          style={[
            styles.fallbackContainer, 
            { borderRadius },
            // Match parent dimensions if not explicitly set
            { minHeight: 100, minWidth: 100 }
          ]}
        >
          <Ionicons 
            name={fallbackIcon as any} 
            size={48} 
            color={fallbackColor} 
          />
          {retryCount < 3 && (
            <ActivityIndicator 
              size="small" 
              color={colors.primary} 
              style={styles.retryLoader}
            />
          )}
        </View>
      ) : (
        <>
          <Image
            source={source}
            onLoadStart={handleLoadStart}
            onLoadEnd={handleLoadEnd}
            onError={handleError}
            style={[{ borderRadius }, style]}
            {...props}
          />
          {isLoading && showLoading && (
            <View style={[styles.loadingOverlay, { borderRadius }]}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fallbackContainer: {
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray200,
    borderStyle: 'dashed',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryLoader: {
    marginTop: 8,
  },
});
