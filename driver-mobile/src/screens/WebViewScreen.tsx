import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/theme';

export default function WebViewScreen() {
    const { colors } = useTheme();
    const navigation = useNavigation();
    const route = useRoute<any>();
    const { url, html, title } = route.params;
    const [isLoading, setIsLoading] = useState(true);

    const source = html ? { html } : { uri: url };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={[styles.backText, { color: colors.text }]}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                <WebView
                    source={source}
                    originWhitelist={['*']}
                    onLoadStart={() => setIsLoading(true)}
                    onLoadEnd={() => setIsLoading(false)}
                    style={{ flex: 1, backgroundColor: colors.background }}
                />
                {isLoading && (
                    <View style={styles.loader}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    backButton: { padding: 8 },
    backText: { fontSize: 24, fontWeight: 'bold' },
    title: { fontSize: 18, fontWeight: '700' },
    content: { flex: 1, position: 'relative' },
    loader: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.8)',
    },
});
