CREATE TABLE IF NOT EXISTS driver_locations (
    driver_id UUID PRIMARY KEY REFERENCES drivers(driver_id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    heading DECIMAL(5, 2), -- Direction in degrees
    speed DECIMAL(5, 2), -- Speed in m/s (or km/h depending on client, usually m/s from GPS)
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster queries later (though primary key is indexed by default)
-- If we do geo-queries, we might want composite index but for MVP lookup by ID is main
-- CREATE INDEX idx_driver_locations_lat_lon ON driver_locations(latitude, longitude);

-- Trigger to update updated_at automatically
CREATE OR REPLACE FUNCTION update_driver_locations_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_driver_locations_timestamp
BEFORE UPDATE ON driver_locations
FOR EACH ROW
EXECUTE PROCEDURE update_driver_locations_timestamp();
