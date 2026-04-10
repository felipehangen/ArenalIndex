import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Property } from '../../types';

interface InteractiveMapProps {
  properties: Property[];
  hoveredPropertyId: string | null;
  selectedPropertyId: string | null;
  onHoverProperty: (id: string | null) => void;
  onSelectProperty: (id: string) => void;
}

// Map Updater Component to handle zooming automatically on selection
const MapUpdater = ({ 
  selectedId, 
  properties 
}: { 
  selectedId: string | null; 
  properties: Property[] 
}) => {
  const map = useMap();
  
  useEffect(() => {
    if (selectedId) {
      const prop = properties.find(p => p.id === selectedId);
      if (prop) {
        map.flyTo([prop.lat, prop.lng], 16, {
          duration: 1.5,
        });
      }
    } else if (properties.length > 0) {
       // Fit bounds to show all available properties if none selected
       const group = L.featureGroup(
         properties.map(p => L.marker([p.lat, p.lng]))
       );
       if (group.getBounds().isValid()) {
         map.fitBounds(group.getBounds(), { padding: [50, 50] });
       }
    }
  }, [selectedId, properties, map]);

  return null;
};

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  properties,
  hoveredPropertyId,
  selectedPropertyId,
  onHoverProperty,
  onSelectProperty
}) => {

  const createPillIcon = (property: Property, isHovered: boolean, isSelected: boolean) => {
    const isHighValue = property.pricePerSqm > 100;
    
    let containerClass = 'map-pill';
    if (isHighValue) containerClass += ' high-value';
    if (isHovered) containerClass += ' hovered';
    if (isSelected) containerClass += ' selected';
    
    const abbreviatedPrice = property.price >= 1000 
      ? `$${Math.round(property.price / 1000)}k` 
      : `$${property.price}`;

    const htmlString = `
      <div class="${containerClass}">
        <span class="pill-primary">$${property.pricePerSqm}/m²</span>
        <span class="pill-secondary">${abbreviatedPrice}</span>
      </div>
    `;

    return L.divIcon({
      html: htmlString,
      className: 'custom-leaflet-icon', // Wrapper
      iconSize: [null as any, null as any], // Use CSS sizes
      iconAnchor: [30, 15], 
      popupAnchor: [0, -20]
    });
  };

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  });

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }}>
      <MapContainer 
        center={[10.4678, -84.6622]} // Default center near Arenal
        zoom={13} 
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          // Esri World Imagery (Satellite)
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri"
          maxZoom={18}
        />
        {/* Adds Topo/Labels overlay */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri"
          maxZoom={18}
        />
        
        {properties.map(prop => (
          <Marker 
            key={prop.id}
            position={[prop.lat, prop.lng]}
            icon={createPillIcon(prop, hoveredPropertyId === prop.id, selectedPropertyId === prop.id)}
            eventHandlers={{
              mouseover: () => onHoverProperty(prop.id),
              mouseout: () => onHoverProperty(null),
              click: () => onSelectProperty(prop.id)
            }}
          >
            {/* We show a simple summary card in the popup */}
            <Popup closeButton={false}>
              <div className="popup-card">
                <img src={prop.images[0]} alt={prop.title} className="popup-image" />
                <div className="popup-details">
                   <div style={{ fontSize: '0.8rem', color: '#757575', marginBottom: '2px' }}>{prop.title}</div>
                   <div className="popup-price">{formatter.format(prop.price)}</div>
                   <div className="popup-value">{formatter.format(prop.pricePerSqm)}/m²</div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        <MapUpdater selectedId={selectedPropertyId} properties={properties} />
      </MapContainer>
    </div>
  );
};
