// QScrap Support Screen - Ticket Management System
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    TextInput,
    Modal,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Image,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';
import { useTranslation } from '../contexts/LanguageContext';
import { rtlFlexDirection, rtlTextAlign } from '../utils/rtl';

interface Ticket {
    ticket_id: string;
    subject: string;
    message: string;
    status: 'open' | 'in_progress' | 'closed';
    category: string;
    created_at: string;
    updated_at: string;
}

export default function SupportScreen() {
    const navigation = useNavigation();
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showNewTicket, setShowNewTicket] = useState(false);
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Enhanced new ticket fields
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [attachments, setAttachments] = useState<string[]>([]);
    const [orders, setOrders] = useState<any[]>([]);

    const loadTickets = async () => {
        try {
            const data = await api.getTickets();
            setTickets(data.tickets || []);
        } catch (error) {
            console.log('Failed to load tickets:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        loadTickets();
    }, []);

    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        loadTickets();
    }, []);

    const handleCreateTicket = async () => {
        if (!subject.trim() || !message.trim()) {
            Alert.alert(t('common.error'), t('common.fillAllFields'));
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsSubmitting(true);

        try {
            await api.request('/support/tickets', {
                method: 'POST',
                body: JSON.stringify({
                    subject: subject.trim(),
                    message: message.trim(),
                    order_id: selectedOrderId,
                    attachments: attachments
                })
            });
            // Reset form
            setSubject('');
            setMessage('');
            setSelectedOrderId(null);
            setAttachments([]);
            setShowNewTicket(false);
            Alert.alert(t('common.success'), t('support.ticketSubmitted'));
            loadTickets();
        } catch (error: any) {
            Alert.alert(t('common.error'), error.message || t('support.createFailed'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddPhoto = async () => {
        if (attachments.length >= 5) {
            Alert.alert(t('common.error'), t('support.maxPhotos'));
            return;
        }

        // Show action sheet for camera or gallery
        Alert.alert(
            t('support.addPhoto'),
            t('support.selectSource'),
            [
                { text: t('support.takePhoto'), onPress: () => pickImage('camera') },
                { text: t('support.chooseFromGallery'), onPress: () => pickImage('gallery') },
                { text: t('common.cancel'), style: 'cancel' }
            ]
        );
    };

    const pickImage = async (source: 'camera' | 'gallery') => {
        try {
            // Request appropriate permission
            const permission = source === 'camera'
                ? await ImagePicker.requestCameraPermissionsAsync()
                : await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (permission.status !== 'granted') {
                Alert.alert(
                    t('common.permissionRequired'),
                    source === 'camera'
                        ? t('support.cameraPermission')
                        : t('support.galleryPermission')
                );
                return;
            }

            // Launch camera or gallery
            const result = source === 'camera'
                ? await ImagePicker.launchCameraAsync({
                    mediaTypes: ['images'],
                    quality: 0.8,
                    allowsEditing: true,
                    aspect: [4, 3],
                })
                : await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ['images'],
                    quality: 0.8,
                    allowsMultipleSelection: false,
                });

            if (!result.canceled && result.assets[0]) {
                setAttachments([...attachments, result.assets[0].uri]);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        } catch (error) {
            console.error('Image picker error:', error);
            Alert.alert(t('common.error'), t('support.imagePickerFailed'));
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(attachments.filter((_, i) => i !== index));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const loadOrders = async () => {
        try {
            const data = await api.getMyOrders();
            setOrders((data.orders || []).slice(0, 10)); // Show last 10 orders
        } catch (error) {
            console.log('Failed to load orders:', error);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'open': return Colors.info;
            case 'in_progress': return Colors.warning;
            case 'closed': return Colors.success;
            default: return Colors.dark.textMuted;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'open': return t('status.open');
            case 'in_progress': return t('status.inProgress');
            case 'closed': return t('status.closed');
            default: return status;
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const renderTicket = ({ item }: { item: Ticket }) => (
        <TouchableOpacity
            style={[styles.ticketCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => (navigation as any).navigate('TicketChat', { ticketId: item.ticket_id })}
            activeOpacity={0.7}
        >
            <View style={[styles.ticketHeader, { flexDirection: rtlFlexDirection(isRTL) }]}>
                <Text style={[styles.ticketSubject, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]} numberOfLines={1}>{item.subject}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                        {getStatusLabel(item.status)}
                    </Text>
                </View>
            </View>
            <Text style={[styles.ticketMessage, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]} numberOfLines={2}>{item.message}</Text>
            <Text style={[styles.ticketDate, { color: colors.textMuted, textAlign: rtlTextAlign(isRTL) }]}>{formatDate(item.created_at)}</Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, flexDirection: rtlFlexDirection(isRTL) }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.background }]}>
                    <Text style={styles.backText}>{isRTL ? '→' : '←'} {t('common.back')}</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>{t('support.title')}</Text>
                <View style={{ width: 60 }} />
            </View>

            {/* New Ticket Button */}
            <TouchableOpacity
                style={styles.newTicketButton}
                onPress={() => setShowNewTicket(true)}
                activeOpacity={0.9}
            >
                <LinearGradient
                    colors={Colors.gradients.primary}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.newTicketGradient, { flexDirection: rtlFlexDirection(isRTL) }]}
                >
                    <Text style={[styles.newTicketIcon, isRTL ? { marginLeft: Spacing.sm, marginRight: 0 } : { marginRight: Spacing.sm, marginLeft: 0 }]}>+</Text>
                    <Text style={styles.newTicketText}>{t('support.createNew')}</Text>
                </LinearGradient>
            </TouchableOpacity>

            {isLoading ? (
                <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 50 }} />
            ) : tickets.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyIcon}>💬</Text>
                    <Text style={styles.emptyTitle}>{t('support.noTickets')}</Text>
                    <Text style={styles.emptySubtitle}>{t('support.createTicketHint')}</Text>
                </View>
            ) : (
                <FlatList
                    data={tickets}
                    keyExtractor={(item) => item.ticket_id}
                    renderItem={renderTicket}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={onRefresh}
                            tintColor={Colors.primary}
                        />
                    }
                />
            )}

            {/* New Ticket Modal */}
            <Modal visible={showNewTicket} animationType="slide" transparent>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.modalOverlay}
                >
                    <ScrollView style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                        <View style={[styles.modalHeader, { flexDirection: rtlFlexDirection(isRTL) }]}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('support.newTicketTitle')}</Text>
                            <TouchableOpacity onPress={() => { setShowNewTicket(false); loadOrders(); }}>
                                <Text style={[styles.closeButton, { color: colors.textMuted }]}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Order Picker */}
                        <Text style={[styles.label, { color: colors.text }]}>Link to Order (Optional)</Text>
                        <TouchableOpacity
                            style={[styles.orderPicker, { backgroundColor: colors.background, borderColor: colors.border }]}
                            onPress={() => {
                                if (orders.length === 0) loadOrders();
                            }}
                        >
                            <Text style={[styles.orderPickerText, { color: selectedOrderId ? colors.text : colors.textMuted }]}>
                                {selectedOrderId
                                    ? orders.find(o => o.order_id === selectedOrderId)?.order_number || 'Order Selected'
                                    : 'Select an order (optional)'}
                            </Text>
                        </TouchableOpacity>

                        {/* Order List */}
                        {orders.length > 0 && (
                            <View style={styles.ordersList}>
                                {orders.map((order) => (
                                    <TouchableOpacity
                                        key={order.order_id}
                                        style={[styles.orderItem, { backgroundColor: selectedOrderId === order.order_id ? Colors.primary + '10' : colors.background }]}
                                        onPress={() => {
                                            setSelectedOrderId(order.order_id);
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        }}
                                    >
                                        <Text style={[styles.orderNumber, { color: colors.text }]}>#{order.order_number}</Text>
                                        <Text style={[styles.orderDesc, { color: colors.textMuted }]} numberOfLines={1}>
                                            {order.part_description}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        <TextInput
                            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, textAlign: rtlTextAlign(isRTL) }]}
                            placeholder={t('support.subjectPlaceholder')}
                            placeholderTextColor={colors.textMuted}
                            value={subject}
                            onChangeText={setSubject}
                            maxLength={100}
                        />

                        <TextInput
                            style={[styles.input, styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, textAlign: rtlTextAlign(isRTL) }]}
                            placeholder={t('support.messagePlaceholder')}
                            placeholderTextColor={colors.textMuted}
                            value={message}
                            onChangeText={setMessage}
                            multiline
                            numberOfLines={5}
                            textAlignVertical="top"
                            maxLength={1000}
                        />

                        {/* Photo Attachments */}
                        <Text style={[styles.label, { color: colors.text }]}>Attach Photos (Max 5)</Text>
                        <View style={styles.attachmentsContainer}>
                            {/* Add Photo Button */}
                            {attachments.length < 5 && (
                                <TouchableOpacity
                                    style={[styles.addPhotoButton, { borderColor: colors.border }]}
                                    onPress={handleAddPhoto}
                                >
                                    <Text style={styles.addPhotoIcon}>📷</Text>
                                    <Text style={[styles.addPhotoText, { color: colors.textMuted }]}>Add Photo</Text>
                                </TouchableOpacity>
                            )}

                            {/* Attached Photos */}
                            {attachments.map((uri, index) => (
                                <View key={index} style={styles.attachmentPreview}>
                                    <Image source={{ uri }} style={styles.attachmentImage} />
                                    <TouchableOpacity
                                        style={styles.removeButton}
                                        onPress={() => removeAttachment(index)}
                                    >
                                        <Text style={styles.removeButtonText}>✕</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>

                        <TouchableOpacity
                            onPress={handleCreateTicket}
                            disabled={isSubmitting}
                            activeOpacity={0.9}
                        >
                            <LinearGradient
                                colors={Colors.gradients.primary}
                                style={styles.submitButton}
                            >
                                {isSubmitting ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.submitText}>{t('support.submitTicket')}</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </ScrollView>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAFAFA' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.lg,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    backButton: {
        padding: Spacing.sm,
        backgroundColor: '#F5F5F5',
        borderRadius: BorderRadius.md,
    },
    backText: { color: Colors.primary, fontSize: FontSizes.md, fontWeight: '600' },
    headerTitle: { fontSize: FontSizes.xl, fontWeight: '800', color: '#1a1a1a' },
    newTicketButton: {
        marginHorizontal: Spacing.lg,
        marginVertical: Spacing.md,
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        ...Shadows.md,
    },
    newTicketGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.md,
    },
    newTicketIcon: { fontSize: 24, color: '#fff', marginRight: Spacing.sm },
    newTicketText: { fontSize: FontSizes.md, fontWeight: '700', color: '#fff' },
    list: { padding: Spacing.lg, paddingTop: 0 },
    ticketCard: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        ...Shadows.sm,
    },
    ticketHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    ticketSubject: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        color: '#1a1a1a',
        flex: 1,
        marginRight: Spacing.md,
    },
    statusBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: BorderRadius.full,
    },
    statusText: { fontSize: FontSizes.xs, fontWeight: '600' },
    ticketMessage: {
        fontSize: FontSizes.sm,
        color: '#525252',
        marginBottom: Spacing.sm,
    },
    ticketDate: {
        fontSize: FontSizes.xs,
        color: '#737373',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.xl,
    },
    emptyIcon: { fontSize: 64, marginBottom: Spacing.lg, opacity: 0.5 },
    emptyTitle: {
        fontSize: FontSizes.xl,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: Spacing.sm,
    },
    emptySubtitle: {
        fontSize: FontSizes.md,
        color: '#525252',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        padding: Spacing.lg,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    modalTitle: { fontSize: FontSizes.xl, fontWeight: '800', color: '#1a1a1a' },
    closeButton: { fontSize: 24, color: '#737373' },
    input: {
        backgroundColor: '#F8F9FA',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        fontSize: FontSizes.md,
        color: '#1a1a1a',
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    textArea: {
        height: 120,
    },
    submitButton: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        alignItems: 'center',
        ...Shadows.sm,
    },
    submitText: { color: '#fff', fontSize: FontSizes.md, fontWeight: '700' },
    label: { fontSize: FontSizes.sm, fontWeight: '600', marginBottom: Spacing.xs, marginTop: Spacing.sm },
    orderPicker: { backgroundColor: '#F8F9FA', borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: '#E8E8E8' },
    orderPickerText: { fontSize: FontSizes.md },
    ordersList: { maxHeight: 150, marginBottom: Spacing.md },
    orderItem: { padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.xs },
    orderNumber: { fontSize: FontSizes.sm, fontWeight: '700' },
    orderDesc: { fontSize: FontSizes.xs, marginTop: 2 },
    attachmentsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: Spacing.md, gap: Spacing.sm },
    addPhotoButton: { width: 80, height: 80, borderRadius: BorderRadius.lg, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F9FA' },
    addPhotoIcon: { fontSize: 24, marginBottom: 4 },
    addPhotoText: { fontSize: FontSizes.xs, fontWeight: '600' },
    attachmentPreview: { width: 80, height: 80, borderRadius: BorderRadius.lg, overflow: 'hidden', position: 'relative' },
    attachmentImage: { width: '100%', height: '100%' },
    removeButton: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
    removeButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
