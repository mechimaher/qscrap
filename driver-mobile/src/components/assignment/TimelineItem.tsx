// QScrap Driver App - TimelineItem Component
// Simple presentational component for assignment timeline
// Extracted from AssignmentDetailScreen

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface TimelineItemProps {
    dotColor: string;
    label: string;
    value: string;
    textColor: string;
    mutedColor: string;
}

export function TimelineItem({ dotColor, label, value, textColor, mutedColor }: TimelineItemProps) {
    return (
        <View style={styles.container}>
            <View style={[styles.dot, { backgroundColor: dotColor }]} />
            <View style={styles.content}>
                <Text style={[styles.label, { color: mutedColor }]}>{label}</Text>
                <Text style={[styles.value, { color: textColor }]}>{value}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    dot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 12,
    },
    content: {
        flex: 1,
    },
    label: {
        fontSize: 12,
        marginBottom: 2,
    },
    value: {
        fontSize: 14,
        fontWeight: '600',
    },
});

export default TimelineItem;
