import React from 'react';
import ImageView from 'react-native-image-viewing';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontSizes, Spacing } from '../constants/theme';

interface ImageViewerModalProps {
    visible: boolean;
    images: string[];
    imageIndex: number;
    onClose: () => void;
    footerComponent?: (imageIndex: number) => React.ReactElement;
}

export default function ImageViewerModal({
    visible,
    images,
    imageIndex,
    onClose,
    footerComponent
}: ImageViewerModalProps) {
    // Format images for the library
    const formattedImages = images.map(uri => ({ uri }));

    return (
        <ImageView
            images={formattedImages}
            imageIndex={imageIndex}
            visible={visible}
            onRequestClose={onClose}
            swipeToCloseEnabled={true}
            doubleTapToZoomEnabled={true}
            FooterComponent={({ imageIndex }) => (
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        {imageIndex + 1} / {images.length}
                    </Text>
                    {footerComponent && footerComponent(imageIndex)}
                </View>
            )}
        />
    );
}

const styles = StyleSheet.create({
    footer: {
        height: 60,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.md,
    },
    footerText: {
        color: '#fff',
        fontSize: FontSizes.md,
        fontWeight: '600',
    },
});
