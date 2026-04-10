import type { Property } from '../types';
import { convertCrtm05ToWgs84 } from '../utils/coordinates';

export const mockProperties: Property[] = [
  {
    id: 'prop-a',
    title: 'Prime Roadfront Lot',
    price: 120000,
    area: 800,
    pricePerSqm: 150,
    lat: 10.4578,
    lng: -84.6622,
    images: ['/images/property_a.png'],
    features: {
      mainRoadFront: true,
      quietRetreat: false,
      existingHouse: false,
      heavilyWooded: false,
      riverAccess: false,
      waterPermits: true,
      electricity: true,
    }
  },
  {
    id: 'prop-b',
    title: 'Quiet Jungle Retreat House',
    price: 210000,
    area: 3000,
    pricePerSqm: 70,
    lat: 10.4410,
    lng: -84.6750,
    images: ['/images/property_b.png'],
    features: {
      mainRoadFront: false,
      quietRetreat: true,
      existingHouse: true,
      heavilyWooded: true,
      riverAccess: false,
      waterPermits: true,
      electricity: true,
    }
  },
  {
    id: 'prop-c',
    title: 'Deep Jungle Reserve',
    price: 150000,
    area: 15000,
    pricePerSqm: 10,
    lat: 10.4800,
    lng: -84.7000,
    images: ['/images/property_c.png'],
    features: {
      mainRoadFront: false,
      quietRetreat: true,
      existingHouse: false,
      heavilyWooded: true,
      riverAccess: true,
      waterPermits: false,
      electricity: false,
    }
  },
  {
    id: 'prop-d',
    title: 'Mountain View Parcel',
    price: 80000,
    area: 2500,
    pricePerSqm: 32,
    lat: 10.4680,
    lng: -84.6400,
    images: ['/images/property_d.png'],
    features: {
      mainRoadFront: false,
      quietRetreat: false,
      existingHouse: false,
      heavilyWooded: false,
      riverAccess: false,
      waterPermits: true,
      electricity: false,
    }
  },
  {
    id: 'prop-e',
    title: 'Riverfront Oasis',
    price: 350000,
    area: 10000,
    pricePerSqm: 35,
    lat: 10.4500,
    lng: -84.6300,
    images: ['/images/property_e.png'],
    features: {
      mainRoadFront: false,
      quietRetreat: true,
      existingHouse: true,
      heavilyWooded: true,
      riverAccess: true,
      waterPermits: true,
      electricity: true,
    }
  },
  {
    id: 'prop-f',
    title: 'Commercial Highway Corner',
    price: 400000,
    area: 2000,
    pricePerSqm: 200,
    lat: 10.4590,
    lng: -84.6600,
    images: ['/images/property_f.png'],
    features: {
      mainRoadFront: true,
      quietRetreat: false,
      existingHouse: false,
      heavilyWooded: false,
      riverAccess: false,
      waterPermits: true,
      electricity: true,
    }
  },
  {
    id: 'prop-g-plano-2015847',
    title: 'Lote Agrícola (Plano 2-2015847-2017)',
    price: 150000,
    area: 5000,
    pricePerSqm: 30,
    lat: convertCrtm05ToWgs84(437244.22, 1156102.39).lat,
    lng: convertCrtm05ToWgs84(437244.22, 1156102.39).lng,
    crtm05: { x: 437244.22, y: 1156102.39 },
    images: ['/images/property_g_palm.png'],
    features: {
      mainRoadFront: false,
      quietRetreat: true,
      existingHouse: false,
      heavilyWooded: false,
      riverAccess: false,
      waterPermits: false,
      electricity: false,
    }
  }
];
