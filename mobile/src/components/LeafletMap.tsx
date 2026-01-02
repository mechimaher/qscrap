// QScrap Premium Leaflet Map Component
// WebView-based map using OpenStreetMap - 100% free, no API key needed
import React, { useRef, useEffect, useCallback } from 'react';
import { StyleSheet, View, ActivityIndicator, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { Colors } from '../constants/theme';

interface LeafletMapProps {
    driverLocation?: {
        latitude: number;
        longitude: number;
        heading?: number;
    } | null;
    customerLocation?: {
        latitude: number;
        longitude: number;
    } | null;
    onMapReady?: () => void;
    showRoute?: boolean;
    centerOnDriver?: boolean;
}

const LeafletMap: React.FC<LeafletMapProps> = ({
    driverLocation,
    customerLocation,
    onMapReady,
    showRoute = true,
    centerOnDriver = true,
}) => {
    const webViewRef = useRef<WebView>(null);
    const mapReadyRef = useRef(false);

    // Qatar default center
    const defaultCenter = { lat: 25.2854, lng: 51.5310 };

    // Update markers when locations change
    useEffect(() => {
        if (!mapReadyRef.current) return;

        if (driverLocation) {
            sendToMap('updateDriver', {
                lat: driverLocation.latitude,
                lng: driverLocation.longitude,
                heading: driverLocation.heading || 0,
            });
        }

        if (customerLocation) {
            sendToMap('updateCustomer', {
                lat: customerLocation.latitude,
                lng: customerLocation.longitude,
            });
        }

        if (showRoute && driverLocation && customerLocation) {
            sendToMap('updateRoute', {
                driver: { lat: driverLocation.latitude, lng: driverLocation.longitude },
                customer: { lat: customerLocation.latitude, lng: customerLocation.longitude },
            });
        }
    }, [driverLocation, customerLocation, showRoute]);

    const sendToMap = useCallback((action: string, data: any) => {
        const message = JSON.stringify({ action, data });
        webViewRef.current?.injectJavaScript(`
            window.handleMessage(${message});
            true;
        `);
    }, []);

    const handleMessage = useCallback((event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'mapReady') {
                mapReadyRef.current = true;
                onMapReady?.();

                // Send initial positions if available
                if (customerLocation) {
                    sendToMap('updateCustomer', {
                        lat: customerLocation.latitude,
                        lng: customerLocation.longitude,
                    });
                    sendToMap('centerOn', {
                        lat: customerLocation.latitude,
                        lng: customerLocation.longitude,
                    });
                }
                if (driverLocation) {
                    sendToMap('updateDriver', {
                        lat: driverLocation.latitude,
                        lng: driverLocation.longitude,
                        heading: driverLocation.heading || 0,
                    });
                }
            }
        } catch (e) {
            console.log('Map message error:', e);
        }
    }, [customerLocation, driverLocation, onMapReady, sendToMap]);

    // Expose methods for parent component
    const centerOn = useCallback((lat: number, lng: number) => {
        sendToMap('centerOn', { lat, lng });
    }, [sendToMap]);

    const fitBounds = useCallback(() => {
        if (driverLocation && customerLocation) {
            sendToMap('fitBounds', {
                driver: { lat: driverLocation.latitude, lng: driverLocation.longitude },
                customer: { lat: customerLocation.latitude, lng: customerLocation.longitude },
            });
        }
    }, [driverLocation, customerLocation, sendToMap]);

    const mapHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body, #map { width: 100%; height: 100%; background: #f8fafc; }
        
        /* Premium Driver Marker */
        .driver-marker {
            width: 50px;
            height: 50px;
            position: relative;
        }
        .driver-marker-inner {
            width: 44px;
            height: 44px;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid #fff;
            box-shadow: 0 4px 20px rgba(16, 185, 129, 0.5);
            animation: pulse 2s infinite;
        }
        .driver-marker-inner::after {
            content: '🚗';
            font-size: 22px;
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); box-shadow: 0 4px 20px rgba(16, 185, 129, 0.5); }
            50% { transform: scale(1.1); box-shadow: 0 4px 30px rgba(16, 185, 129, 0.8); }
        }
        
        /* Premium Customer Marker */
        .customer-marker {
            width: 60px;
            height: 60px;
            position: relative;
        }
        .customer-beacon {
            width: 50px;
            height: 50px;
            background: rgba(59, 130, 246, 0.2);
            border-radius: 50%;
            position: absolute;
            top: 5px;
            left: 5px;
            animation: beacon 2s infinite;
        }
        @keyframes beacon {
            0% { transform: scale(0.8); opacity: 0.8; }
            100% { transform: scale(2); opacity: 0; }
        }
        .customer-pin {
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            position: absolute;
            top: 10px;
            left: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid #fff;
            box-shadow: 0 4px 20px rgba(59, 130, 246, 0.5);
        }
        .customer-pin::after {
            content: '📍';
            transform: rotate(45deg);
            font-size: 16px;
        }
        
        /* Hide Leaflet attribution on small screens */
        .leaflet-control-attribution { font-size: 8px !important; opacity: 0.5; }
    </style>
</head>
<body>
    <div id="map"></div>
    <script>
        // Initialize map with premium dark theme
        const map = L.map('map', {
            zoomControl: false,
            attributionControl: true,
        }).setView([${defaultCenter.lat}, ${defaultCenter.lng}], 14);
        
        // Premium light tile layer (Carto Positron - clean and readable)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);
        
        // Markers
        let driverMarker = null;
        let customerMarker = null;
        let routeLine = null;
        
        // Create custom icon HTML
        function createDriverIcon(heading) {
            return L.divIcon({
                html: '<div class="driver-marker"><div class="driver-marker-inner" style="transform: rotate(' + heading + 'deg)"></div></div>',
                className: '',
                iconSize: [50, 50],
                iconAnchor: [25, 25],
            });
        }
        
        function createCustomerIcon() {
            return L.divIcon({
                html: '<div class="customer-marker"><div class="customer-beacon"></div><div class="customer-pin"></div></div>',
                className: '',
                iconSize: [60, 60],
                iconAnchor: [30, 60],
            });
        }
        
        // Handle messages from React Native
        window.handleMessage = function(msg) {
            const { action, data } = msg;
            
            switch (action) {
                case 'updateDriver':
                    if (!driverMarker) {
                        driverMarker = L.marker([data.lat, data.lng], {
                            icon: createDriverIcon(data.heading || 0)
                        }).addTo(map);
                    } else {
                        driverMarker.setLatLng([data.lat, data.lng]);
                        driverMarker.setIcon(createDriverIcon(data.heading || 0));
                    }
                    break;
                    
                case 'updateCustomer':
                    if (!customerMarker) {
                        customerMarker = L.marker([data.lat, data.lng], {
                            icon: createCustomerIcon()
                        }).addTo(map);
                    } else {
                        customerMarker.setLatLng([data.lat, data.lng]);
                    }
                    break;
                    
                case 'updateRoute':
                    if (routeLine) {
                        map.removeLayer(routeLine);
                    }
                    routeLine = L.polyline([
                        [data.driver.lat, data.driver.lng],
                        [data.customer.lat, data.customer.lng]
                    ], {
                        color: '#10b981',
                        weight: 4,
                        dashArray: '10, 10',
                        opacity: 0.8,
                    }).addTo(map);
                    break;
                    
                case 'centerOn':
                    map.setView([data.lat, data.lng], 15, { animate: true });
                    break;
                    
                case 'fitBounds':
                    const bounds = L.latLngBounds([
                        [data.driver.lat, data.driver.lng],
                        [data.customer.lat, data.customer.lng]
                    ]);
                    map.fitBounds(bounds, { padding: [50, 50], animate: true });
                    break;
            }
        };
        
        // Notify React Native that map is ready
        setTimeout(() => {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
        }, 500);
    </script>
</body>
</html>
    `;

    return (
        <View style={styles.container}>
            <WebView
                ref={webViewRef}
                source={{ html: mapHtml }}
                style={styles.webview}
                onMessage={handleMessage}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                renderLoading={() => (
                    <View style={styles.loading}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                )}
                scrollEnabled={false}
                bounces={false}
                overScrollMode="never"
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                // Performance optimizations
                androidLayerType={Platform.OS === 'android' ? 'hardware' : undefined}
                cacheEnabled={true}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    webview: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    loading: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#f8fafc',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default LeafletMap;
