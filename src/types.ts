export interface PropertyFeatures {
  mainRoadFront: boolean;
  quietRetreat: boolean;
  existingHouse: boolean;
  heavilyWooded: boolean;
  riverAccess: boolean;
  waterPermits: boolean;
  electricity: boolean;
}

export interface Property {
  id: string;
  title: string;
  price: number;
  area: number;
  pricePerSqm: number;
  lat: number;
  lng: number;
  crtm05?: { x: number; y: number };
  images: string[];
  features: PropertyFeatures;
}
