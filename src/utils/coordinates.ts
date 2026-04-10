import proj4 from 'proj4';

// Define Costa Rican CRTM05 Coordinate System (EPSG:5367)
const CRTM05_DEF = '+proj=tmerc +lat_0=0 +lon_0=-84 +k=0.9999 +x_0=500000 +y_0=0 +ellps=WGS84 +units=m +no_defs';
const WGS84_DEF = 'WGS84';

export const convertCrtm05ToWgs84 = (x: number, y: number): { lat: number; lng: number } => {
  const [lng, lat] = proj4(CRTM05_DEF, WGS84_DEF, [x, y]);
  return { lat, lng };
};
