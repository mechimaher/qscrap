// QScrap Services
// API, Socket, and other service exports

// API Service (single instance)
export { api } from './api';

// Type exports
export type {
    User,
    AuthResponse,
    Request,
    Bid,
    Order,
    Stats,
    Address,
    Product
} from './api';

// Socket and Notifications
export * from './socket';
export * from './notifications';
