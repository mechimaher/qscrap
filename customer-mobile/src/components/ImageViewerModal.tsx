// Minimal ImageViewerModal - Replaced with React Native Modal + Image
import React from 'react';
import { Modal, View, Image, TouchableOpacity, Text, StyleSheet, Dimensions, FlatList } from 'react-native';

interface ImageViewerModalProps {
    visible: boolean;
    images: string[];
    imageIndex: number;
    onClose: () => void;
}

const { width, height } = Dimensions.get('window');

export default function ImageViewerModal({ visible, images, imageIndex, onClose }: ImageViewerModalProps) {
    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.container}>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                    <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
                <FlatList
                    data={images}
                    horizontal
                    pagingEnabled
                    initialScrollIndex={imageIndex}
                    getItemLayout={(_, index) => ({
                        length: width,
                        offset: width * index,
                        index,
                    })}
                    renderItem={({ item }) => (
                        <Image
                            source={{ uri: item }}
                            style={styles.image}
                            resizeMode="contain"
                        />
                    )}
                    keyExtractor={(_, i) => i.toString()}
                />
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
        justifyContent: 'center',
    },
    closeButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        zIndex: 10,
        padding: 12,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 20,
    },
    closeText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    image: {
        width,
        height: height * 0.7,
    },
});
