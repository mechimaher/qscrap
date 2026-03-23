import { apiClient } from './apiClient';
import { authService } from './auth.service';
import { dashboardService } from './dashboard.service';
import { requestService } from './request.service';
import { orderService } from './order.service';
import { deliveryService } from './delivery.service';
import { chatService } from './chat.service';
import { addressService } from './address.service';
import { notificationService } from './notification.service';
import { supportService } from './support.service';
import { escrowService } from './escrow.service';
import { loyaltyService } from './loyalty.service';
import { paymentService } from './payment.service';
import { vehicleService } from './vehicle.service';

export * from './types';
export * from './apiClient';

// Backward compatible API facade
export const api = new Proxy(
    {},
    {
        get(target, prop) {
            const services = [
                apiClient,
                authService,
                dashboardService,
                requestService,
                orderService,
                deliveryService,
                chatService,
                addressService,
                notificationService,
                supportService,
                escrowService,
                loyaltyService,
                paymentService,
                vehicleService
            ];
            for (const service of services) {
                if (prop in service && typeof (service as any)[prop] === 'function') {
                    return (service as any)[prop].bind(service);
                }
            }
            return undefined;
        }
    }
) as any;
