// QScrap My Repairs Screen - View repair requests and bookings
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { Colors, VVIP_COLORS } from '../theme';

interface RepairRequest {
    request_id: string;
    car_make: string;
    car_model: string;
    car_year?: number;
    problem_type: string;
    problem_description: string;
    status: string;
    bid_count: number;
    created_at: string;
}

interface RepairBooking {
    booking_id: string;
    scheduled_date: string;
    scheduled_time?: string;
    status: string;
    garage_name?: string;
    garage_address?: string;
    car_make: string;
    car_model: string;
    problem_type: string;
}

export default function MyRepairsScreen() {
    const navigation = useNavigation<any>();
    const [tab, setTab] = useState<'requests' | 'bookings'>('requests');
    const [requests, setRequests] = useState<RepairRequest[]>([]);
    const [bookings, setBookings] = useState<RepairBooking[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = async () => {
        try {
            const [reqRes, bookRes] = await Promise.all([
                api.get('/repair/requests/my'),
                api.get('/repair/bookings/my'),
            ]);
            setRequests(reqRes.data.requests || []);
            setBookings(bookRes.data.bookings || []);
        } catch (err) {
            console.error('Error loading repairs:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
            case 'bidding':
                return '#3b82f6';
            case 'booked':
            case 'confirmed':
                return '#f59e0b';
            case 'in_progress':
                return '#8b5cf6';
            case 'completed':
                return '#10b981';
            case 'cancelled':
                return '#ef4444';
            default:
                return '#888';
        }
    };

    const getProblemIcon = (type: string) => {
        switch (type) {
            case 'engine': return 'car-sport-outline';
            case 'brakes': return 'stop-circle-outline';
            case 'electrical': return 'flash-outline';
            case 'ac': return 'snow-outline';
            case 'transmission': return 'cog-outline';
            case 'body': return 'construct-outline';
            default: return 'medical-outline';
        }
    };

    const renderRequest = (request: RepairRequest) => (
        <TouchableOpacity
            key={request.request_id}
            style={styles.card}
            onPress={() => navigation.navigate('RepairDetail', { request_id: request.request_id })}
        >
            <View style={styles.cardHeader}>
                <View style={styles.vehicleInfo}>
                    <Ionicons name={getProblemIcon(request.problem_type) as any} size={24} color={VVIP_COLORS.gold} />
                    <View style={{ marginLeft: 12 }}>
                        <Text style={styles.vehicleText}>
                            {request.car_make} {request.car_model} {request.car_year || ''}
                        </Text>
                        <Text style={styles.problemText}>{request.problem_type.replace('_', ' ')}</Text>
                    </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(request.status) }]}>
                        {request.status.replace('_', ' ')}
                    </Text>
                </View>
            </View>

            <Text style={styles.description} numberOfLines={2}>
                {request.problem_description}
            </Text>

            <View style={styles.cardFooter}>
                <View style={styles.footerItem}>
                    <Ionicons name="pricetag-outline" size={16} color="#888" />
                    <Text style={styles.footerText}>{request.bid_count} bids</Text>
                </View>
                <View style={styles.footerItem}>
                    <Ionicons name="time-outline" size={16} color="#888" />
                    <Text style={styles.footerText}>
                        {new Date(request.created_at).toLocaleDateString()}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    const renderBooking = (booking: RepairBooking) => (
        <TouchableOpacity
            key={booking.booking_id}
            style={[styles.card, styles.bookingCard]}
        >
            <View style={styles.cardHeader}>
                <View style={styles.vehicleInfo}>
                    <View style={styles.dateBox}>
                        <Text style={styles.dateDay}>
                            {new Date(booking.scheduled_date).getDate()}
                        </Text>
                        <Text style={styles.dateMonth}>
                            {new Date(booking.scheduled_date).toLocaleString('default', { month: 'short' })}
                        </Text>
                    </View>
                    <View style={{ marginLeft: 12 }}>
                        <Text style={styles.vehicleText}>
                            {booking.car_make} {booking.car_model}
                        </Text>
                        <Text style={styles.problemText}>{booking.garage_name || 'Workshop'}</Text>
                    </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(booking.status) }]}>
                        {booking.status.replace('_', ' ')}
                    </Text>
                </View>
            </View>

            {booking.scheduled_time && (
                <View style={styles.timeRow}>
                    <Ionicons name="time-outline" size={18} color={VVIP_COLORS.gold} />
                    <Text style={styles.timeText}>{booking.scheduled_time}</Text>
                </View>
            )}

            {booking.garage_address && (
                <View style={styles.addressRow}>
                    <Ionicons name="location-outline" size={18} color="#888" />
                    <Text style={styles.addressText}>{booking.garage_address}</Text>
                </View>
            )}
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <LinearGradient colors={[VVIP_COLORS.maroon, '#0f0f0f']} style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backIcon}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Repairs</Text>
                <TouchableOpacity
                    onPress={() => navigation.navigate('RepairRequest')}
                    style={styles.addButton}
                >
                    <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
            </LinearGradient>

            {/* Tab Bar */}
            <View style={styles.tabBar}>
                <TouchableOpacity
                    style={[styles.tab, tab === 'requests' && styles.tabActive]}
                    onPress={() => setTab('requests')}
                >
                    <Text style={[styles.tabText, tab === 'requests' && styles.tabTextActive]}>
                        Requests ({requests.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, tab === 'bookings' && styles.tabActive]}
                    onPress={() => setTab('bookings')}
                >
                    <Text style={[styles.tabText, tab === 'bookings' && styles.tabTextActive]}>
                        Bookings ({bookings.length})
                    </Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={VVIP_COLORS.maroon} />
                </View>
            ) : (
                <ScrollView
                    style={styles.content}
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={VVIP_COLORS.gold} />
                    }
                >
                    {tab === 'requests' ? (
                        requests.length > 0 ? (
                            requests.map(renderRequest)
                        ) : (
                            <View style={styles.emptyState}>
                                <Ionicons name="car-outline" size={64} color="#333" />
                                <Text style={styles.emptyTitle}>No Repair Requests</Text>
                                <Text style={styles.emptyText}>Request a repair or checkup for your vehicle</Text>
                                <TouchableOpacity
                                    style={styles.emptyButton}
                                    onPress={() => navigation.navigate('RepairRequest')}
                                >
                                    <Text style={styles.emptyButtonText}>Request Repair</Text>
                                </TouchableOpacity>
                            </View>
                        )
                    ) : (
                        bookings.length > 0 ? (
                            bookings.map(renderBooking)
                        ) : (
                            <View style={styles.emptyState}>
                                <Ionicons name="calendar-outline" size={64} color="#333" />
                                <Text style={styles.emptyTitle}>No Bookings</Text>
                                <Text style={styles.emptyText}>Accept a bid to book an appointment</Text>
                            </View>
                        )
                    )}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f0f0f',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    backIcon: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    addButton: {
        padding: 8,
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: '#1a1a1a',
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    tab: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
    },
    tabActive: {
        borderBottomWidth: 2,
        borderBottomColor: VVIP_COLORS.maroon,
    },
    tabText: {
        color: '#888',
        fontSize: 15,
    },
    tabTextActive: {
        color: '#fff',
        fontWeight: '600',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    card: {
        backgroundColor: '#1a1a1a',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#333',
    },
    bookingCard: {
        borderLeftWidth: 4,
        borderLeftColor: VVIP_COLORS.gold,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    vehicleInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    vehicleText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    problemText: {
        fontSize: 13,
        color: '#888',
        textTransform: 'capitalize',
        marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    description: {
        fontSize: 14,
        color: '#aaa',
        marginBottom: 12,
    },
    cardFooter: {
        flexDirection: 'row',
        gap: 16,
    },
    footerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    footerText: {
        color: '#888',
        fontSize: 13,
    },
    dateBox: {
        width: 50,
        height: 50,
        backgroundColor: VVIP_COLORS.maroon,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dateDay: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
    },
    dateMonth: {
        color: '#fff',
        fontSize: 11,
        textTransform: 'uppercase',
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    timeText: {
        color: VVIP_COLORS.gold,
        fontSize: 15,
        fontWeight: '600',
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    addressText: {
        color: '#888',
        fontSize: 13,
        flex: 1,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#fff',
        marginTop: 16,
    },
    emptyText: {
        fontSize: 14,
        color: '#888',
        marginTop: 8,
        textAlign: 'center',
    },
    emptyButton: {
        marginTop: 20,
        backgroundColor: VVIP_COLORS.maroon,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 10,
    },
    emptyButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
});
