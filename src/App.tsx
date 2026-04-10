import React, { useState, useEffect, useMemo } from 'react';
import { HomeIcon, MapIcon, CompassIcon } from 'lucide-react';
import { FilterBar } from './components/Filters/FilterBar';
import type { FilterType } from './components/Filters/FilterBar';
import { FiltersModal } from './components/Filters/FiltersModal';
import { PropertyList } from './components/Sidebar/PropertyList';
import { InteractiveMap } from './components/Map/InteractiveMap';
import { supabase } from './supabaseClient';
import type { Property } from './types';
import './index.css';

function App() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [dbLoading, setDbLoading] = useState(true);

  const [activeFilters, setActiveFilters] = useState<FilterType[]>([]);
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  
  const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false);
  const [pricePerSqmRange, setPricePerSqmRange] = useState<[number, number]>([0, 300]);
  const [totalPriceRange, setTotalPriceRange] = useState<[number, number]>([0, 500000]);

  const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  const [isMobileListOpen, setIsMobileListOpen] = useState(false);

  // Fetch Live Property Data
  useEffect(() => {
    async function loadProperties() {
      const { data, error } = await supabase.from('properties').select('*');
      if (error) {
        console.error("Supabase Error:", error);
      } else if (data) {
        // Data aligns with Property type because of how we defined the DB
        setProperties(data as Property[]);
      }
      setDbLoading(false);
    }
    loadProperties();
  }, []);

  // Filter properties based on active filters
  const filteredProperties = useMemo(() => {
    return properties.filter(prop => {
      // Feature toggles
      for (const filter of activeFilters) {
        if (filter === 'plugAndPlay') {
          if (!prop.features.waterPermits || !prop.features.electricity) return false;
        } else {
          // General feature check
          if (!prop.features[filter as keyof typeof prop.features]) return false;
        }
      }

      // Size slider
      if (sizeFilter === 'small' && prop.area >= 1000) return false;
      if (sizeFilter === 'medium' && (prop.area < 1000 || prop.area > 5000)) return false;
      if (sizeFilter === 'large' && prop.area <= 5000) return false;

      // Ranges
      if (prop.pricePerSqm < pricePerSqmRange[0] || prop.pricePerSqm > (pricePerSqmRange[1] >= 300 ? Infinity : pricePerSqmRange[1])) return false;
      if (prop.price < totalPriceRange[0] || prop.price > (totalPriceRange[1] >= 500000 ? Infinity : totalPriceRange[1])) return false;

      return true;
    });
  }, [properties, activeFilters, sizeFilter, pricePerSqmRange, totalPriceRange]);

  const handleToggleFilter = (filter: FilterType) => {
    setActiveFilters(prev => 
      prev.includes(filter) 
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };

  const handleSelectProperty = (id: string) => {
    setSelectedPropertyId(id);
    
    // For mobile, open bottom sheet when marker clicked
    if (window.innerWidth <= 768) {
      setIsMobileListOpen(true);
    }

    // Scroll main list to property
    const cardEl = document.getElementById(`property-card-${id}`);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        {/* Top Header Layer: Brand */}
        <div className="header-top">
          <div className="brand">
            <span className="brand-text">Arenal <span className="brand-text-light">Index</span></span>
          </div>
          
          {/* Mobile toggle button */}
          {window.innerWidth <= 768 && (
             <button 
                className="mobile-view-toggle"
                onClick={() => setIsMobileListOpen(!isMobileListOpen)}
             >
               {isMobileListOpen ? <MapIcon size={16} /> : <HomeIcon size={16} />}
               {isMobileListOpen ? 'Map' : 'List'}
             </button>
          )}
        </div>
        
        {/* Bottom Header Layer: Categories & Filters Layout */}
        <div className="header-bottom">
          <FilterBar 
            activeFilters={activeFilters}
            toggleFilter={handleToggleFilter}
            onOpenFilters={() => setIsFiltersModalOpen(true)}
          />
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="main-content">
        {dbLoading && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.8)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-jungle-green)' }}>Syncing cloud data...</span>
          </div>
        )}
        <div className="map-container">
          <InteractiveMap 
            properties={filteredProperties}
            hoveredPropertyId={hoveredPropertyId}
            selectedPropertyId={selectedPropertyId}
            onHoverProperty={setHoveredPropertyId}
            onSelectProperty={handleSelectProperty}
          />
        </div>
        
        <div className={`sidebar ${isMobileListOpen ? '' : 'hidden'}`}>
          {/* A small drag handle hint for mobile */}
          <div 
             style={{ height: '24px', width: '100%', position: 'absolute', top: 0, left: 0 }}
             onClick={() => setIsMobileListOpen(!isMobileListOpen)}
          />
          <PropertyList 
            properties={filteredProperties}
            hoveredPropertyId={hoveredPropertyId}
            onHoverProperty={setHoveredPropertyId}
            onSelectProperty={handleSelectProperty}
          />
        </div>
      </main>

      {/* Popups and Modals */}
      <FiltersModal 
        isOpen={isFiltersModalOpen}
        onClose={() => setIsFiltersModalOpen(false)}
        activeFilters={activeFilters}
        toggleFilter={handleToggleFilter}
        sizeFilter={sizeFilter}
        setSizeFilter={setSizeFilter}
        pricePerSqmRange={pricePerSqmRange}
        setPricePerSqmRange={setPricePerSqmRange}
        totalPriceRange={totalPriceRange}
        setTotalPriceRange={setTotalPriceRange}
        properties={properties}
      />
    </div>
  );
}

export default App;
