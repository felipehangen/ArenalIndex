import React from 'react';
import type { Property } from '../../types';
import { PropertyCard } from './PropertyCard';

interface PropertyListProps {
  properties: Property[];
  hoveredPropertyId: string | null;
  onHoverProperty: (id: string | null) => void;
  onSelectProperty: (id: string) => void;
}

export const PropertyList: React.FC<PropertyListProps> = ({
  properties,
  hoveredPropertyId,
  onHoverProperty,
  onSelectProperty
}) => {
  if (properties.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-volcanic-ash-light)' }}>
        <h3>No properties found</h3>
        <p>Try adjusting your filters to see more results.</p>
      </div>
    );
  }

  return (
    <>
      <div style={{ paddingBottom: '12px', fontSize: '0.9rem', color: 'var(--color-volcanic-ash-light)', fontWeight: 600 }}>
        {properties.length} properties found
      </div>
      <div className="property-list-grid">
        {properties.map(property => (
          <PropertyCard
            key={property.id}
            property={property}
            isHovered={hoveredPropertyId === property.id}
            onMouseEnter={() => onHoverProperty(property.id)}
            onMouseLeave={() => onHoverProperty(null)}
            onClick={() => onSelectProperty(property.id)}
          />
        ))}
      </div>
    </>
  );
};
