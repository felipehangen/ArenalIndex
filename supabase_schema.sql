-- 1. Create Properties Table
CREATE TABLE IF NOT EXISTS properties (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mock_id text UNIQUE NOT NULL, 
  title text NOT NULL,
  price numeric NOT NULL,
  area numeric NOT NULL,
  "pricePerSqm" numeric NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  images text[] NOT NULL DEFAULT '{}',
  features jsonb NOT NULL DEFAULT '{}',
  crtm05 jsonb
);

-- 2. Seed Initial Mock Data
INSERT INTO properties (mock_id, title, price, area, "pricePerSqm", lat, lng, images, features, crtm05) VALUES
('prop-a', 'Prime Roadfront Lot', 120000, 800, 150, 10.4578, -84.6622, ARRAY['/images/property_a.png'], '{"mainRoadFront": true, "quietRetreat": false, "existingHouse": false, "heavilyWooded": false, "riverAccess": false, "waterPermits": true, "electricity": true}', NULL),
('prop-b', 'Quiet Jungle Retreat House', 210000, 3000, 70, 10.4410, -84.6750, ARRAY['/images/property_b.png'], '{"mainRoadFront": false, "quietRetreat": true, "existingHouse": true, "heavilyWooded": true, "riverAccess": false, "waterPermits": true, "electricity": true}', NULL),
('prop-c', 'Deep Jungle Reserve', 150000, 15000, 10, 10.4800, -84.7000, ARRAY['/images/property_c.png'], '{"mainRoadFront": false, "quietRetreat": true, "existingHouse": false, "heavilyWooded": true, "riverAccess": true, "waterPermits": false, "electricity": false}', NULL),
('prop-d', 'Mountain View Parcel', 80000, 2500, 32, 10.4680, -84.6400, ARRAY['/images/property_d.png'], '{"mainRoadFront": false, "quietRetreat": false, "existingHouse": false, "heavilyWooded": false, "riverAccess": false, "waterPermits": true, "electricity": false}', NULL),
('prop-e', 'Riverfront Oasis', 350000, 10000, 35, 10.4500, -84.6300, ARRAY['/images/property_e.png'], '{"mainRoadFront": false, "quietRetreat": true, "existingHouse": true, "heavilyWooded": true, "riverAccess": true, "waterPermits": true, "electricity": true}', NULL),
('prop-f', 'Commercial Highway Corner', 400000, 2000, 200, 10.4590, -84.6600, ARRAY['/images/property_f.png'], '{"mainRoadFront": true, "quietRetreat": false, "existingHouse": false, "heavilyWooded": false, "riverAccess": false, "waterPermits": true, "electricity": true}', NULL),
('prop-g-plano-2015847', 'Lote Agrícola (Plano 2-2015847-2017)', 150000, 5000, 30, 10.454809900029222, -84.57324700256603, ARRAY['/images/property_g_palm.png'], '{"mainRoadFront": false, "quietRetreat": true, "existingHouse": false, "heavilyWooded": false, "riverAccess": false, "waterPermits": false, "electricity": false}', '{"x": 437244.22, "y": 1156102.39}');
