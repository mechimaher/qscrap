-- FIX-17: Performance Indexes for Production Readiness
-- Applied on: 2026-02-20

-- Orders table optimization
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_garage_id ON public.orders(garage_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- Part Requests optimization
CREATE INDEX IF NOT EXISTS idx_part_requests_customer_id ON public.part_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_part_requests_status ON public.part_requests(status);
CREATE INDEX IF NOT EXISTS idx_part_requests_created_at ON public.part_requests(created_at DESC);

-- Bids optimization
CREATE INDEX IF NOT EXISTS idx_bids_request_id ON public.bids(request_id);
CREATE INDEX IF NOT EXISTS idx_bids_garage_id ON public.bids(garage_id);
CREATE INDEX IF NOT EXISTS idx_bids_status ON public.bids(status);

-- Payments optimization
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON public.payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON public.payment_transactions(status);

-- Garage Search optimization
CREATE INDEX IF NOT EXISTS idx_garages_location ON public.garages(location_lat, location_lng);
CREATE INDEX IF NOT EXISTS idx_garages_rating ON public.garages(rating_average DESC);

-- Notifications optimization
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read) WHERE is_read = false;
