import React from 'react';
import type { Property } from '../../types';

interface PropertyCardProps {
  property: Property;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}

export const PropertyCard: React.FC<PropertyCardProps> = ({
  property,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  onClick
}) => {
  const isHighValue = property.pricePerSqm > 100;
  
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  });

  return (
    <div 
      className={`property-card ${isHovered ? 'highlighted' : ''}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      id={`property-card-${property.id}`}
    >
      <div className="property-card-image-wrap">
        <img 
          src={property.images[0]} 
          alt={property.title} 
          className="property-card-image"
          loading="lazy"
        />
      </div>
      
      <div className="property-card-content">
        <div className="property-title">{property.title}</div>
        
        <div className="property-price">{formatter.format(property.price)}</div>
        
        <div className="property-details">
          <div className="property-area">
            {property.area.toLocaleString()} m²
          </div>
          <div className={`property-value-tag ${isHighValue ? 'high-value' : ''}`}>
            {formatter.format(property.pricePerSqm)}/m²
          </div>
        </div>

        <div className="property-features">
           {property.features.mainRoadFront && <span className="feature-tag">Road Front</span>}
           {property.features.quietRetreat && <span className="feature-tag">Quiet</span>}
           {property.features.existingHouse && <span className="feature-tag">House</span>}
           {property.features.heavilyWooded && <span className="feature-tag">Wooded</span>}
           {property.features.riverAccess && <span className="feature-tag">River Front</span>}
           {property.features.waterPermits && property.features.electricity && (
             <span className="feature-tag" style={{ color: '#004D40', fontWeight: 'bold' }}>⚡ Plug & Play</span>
           )}
        </div>
      </div>
    </div>
  );
};
