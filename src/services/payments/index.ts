// QScrap Payment System - Barrel Export
// Clean import paths for payment services

export * from './payment.interface';
export * from './mock-payment.provider';
export * from './payment.service';

// Stripe and new payment providers
export { StripePaymentProvider } from '../payment/stripe.provider';
export { PaymentService as DepositPaymentService, getPaymentService } from '../payment/payment.service';

// Re-export singleton for convenience
export { paymentService } from './payment.service';
export { TEST_CARDS } from './mock-payment.provider';
