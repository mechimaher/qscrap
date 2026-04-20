-- QScrap Phase 03: Intelligent Search Migration
-- Implements PostgreSQL Full-Text Search (FTS) with Weighted GIN Indexes

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- For fuzzy matching support later

-- 2. ORDERS TABLE ENHANCEMENT
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION orders_search_vector_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.order_number, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.delivery_address, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.delivery_notes, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_search_update ON public.orders;
CREATE TRIGGER trg_orders_search_update
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION orders_search_vector_trigger();

-- Backfill existing orders
UPDATE public.orders SET search_vector = (
    setweight(to_tsvector('english', COALESCE(order_number, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(delivery_address, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(delivery_notes, '')), 'C')
);

CREATE INDEX idx_orders_fts ON public.orders USING GIN(search_vector);

-- 3. PART REQUESTS TABLE ENHANCEMENT
ALTER TABLE public.part_requests ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION part_requests_search_vector_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.car_make, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.car_model, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.part_number, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.part_description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.vin_number, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_part_requests_search_update ON public.part_requests;
CREATE TRIGGER trg_part_requests_search_update
BEFORE INSERT OR UPDATE ON public.part_requests
FOR EACH ROW EXECUTE FUNCTION part_requests_search_vector_trigger();

-- Backfill existing requests
UPDATE public.part_requests SET search_vector = (
    setweight(to_tsvector('english', COALESCE(car_make, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(car_model, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(part_number, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(part_description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(vin_number, '')), 'C')
);

CREATE INDEX idx_part_requests_fts ON public.part_requests USING GIN(search_vector);
