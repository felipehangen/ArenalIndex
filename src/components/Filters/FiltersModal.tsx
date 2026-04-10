import React, { useMemo } from 'react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { XIcon, BuildingIcon, CarIcon, DropletsIcon, LeafIcon, TreePineIcon, ZapIcon } from 'lucide-react';
import type { FilterType } from './FilterBar';
import type { Property } from '../../types';

interface FiltersModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeFilters: FilterType[];
  toggleFilter: (filter: FilterType) => void;
  sizeFilter: string;
  setSizeFilter: (size: string) => void;
  pricePerSqmRange: [number, number];
  setPricePerSqmRange: (val: [number, number]) => void;
  totalPriceRange: [number, number];
  setTotalPriceRange: (val: [number, number]) => void;
  properties: Property[];
}

const CATEGORIES = [
  { id: 'mainRoadFront', label: 'Main Road Front', icon: CarIcon },
  { id: 'quietRetreat', label: 'Quiet Retreat', icon: LeafIcon },
  { id: 'existingHouse', label: 'Move-In Ready', icon: BuildingIcon },
  { id: 'heavilyWooded', label: 'Jungle Vibe', icon: TreePineIcon },
  { id: 'riverAccess', label: 'River Access', icon: DropletsIcon },
  { id: 'plugAndPlay', label: 'Plug & Play', icon: ZapIcon },
];

export const FiltersModal: React.FC<FiltersModalProps> = ({
  isOpen,
  onClose,
  activeFilters,
  toggleFilter,
  sizeFilter,
  setSizeFilter,
  pricePerSqmRange,
  setPricePerSqmRange,
  totalPriceRange,
  setTotalPriceRange,
  properties
}) => {
  // Static Min/Max constants
  const MAX_PRICE_SQM = 300; // Hard cap for slider UI
  const MAX_TOTAL_PRICE = 500000; // Hard cap for slider UI

  // Compute histograms
  const { sqmFrequencies, totalFrequencies } = useMemo(() => {
    const bins = 40;
    const sqmStep = MAX_PRICE_SQM / bins;
    const totalStep = MAX_TOTAL_PRICE / bins;
    
    const sqmFrequencies = new Array(bins).fill(0);
    const totalFrequencies = new Array(bins).fill(0);

    properties.forEach(p => {
      let sqIdx = Math.floor(p.pricePerSqm / sqmStep);
      if (sqIdx >= bins) sqIdx = bins - 1;
      sqmFrequencies[sqIdx]++;

      let tIdx = Math.floor(p.price / totalStep);
      if (tIdx >= bins) tIdx = bins - 1;
      totalFrequencies[tIdx]++;
    });

    return { sqmFrequencies, totalFrequencies };
  }, [properties]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <button className="close-btn" onClick={onClose}>
            <XIcon size={24} />
          </button>
          <h2>Filters</h2>
          <div style={{ width: 24 }} /> {/* balance center */}
        </div>

        <div className="modal-body">
          {/* Property Types */}
          <section className="filter-section">
            <h3>Type of property</h3>
            <div className="modal-categories">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isActive = activeFilters.includes(cat.id as FilterType);
                return (
                  <div 
                    key={cat.id} 
                    className={`modal-category-item ${isActive ? 'active' : ''}`}
                    onClick={() => toggleFilter(cat.id as FilterType)}
                  >
                    <Icon size={32} strokeWidth={isActive ? 2 : 1.5} />
                    <span>{cat.label}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Price per sqm */}
          <section className="filter-section">
            <h3>Price distribution ($/m²)</h3>
            <p className="subtitle">Cost efficiency based on land value</p>
            <div className="histogram-container">
              <div className="histogram-bars">
                {sqmFrequencies.map((freq, i) => {
                  const isActive = (i / 40) * MAX_PRICE_SQM >= pricePerSqmRange[0] && 
                                   (i / 40) * MAX_PRICE_SQM <= pricePerSqmRange[1];
                  return (
                    <div 
                      key={i} 
                      className={`histogram-bar ${isActive ? 'active' : ''} ${freq > 0 ? 'has-data' : ''}`}
                      style={{ height: `${freq > 0 ? Math.max(freq * 15, 10) : 5}px` }} 
                    />
                  );
                })}
              </div>
              <Slider 
                range 
                min={0} 
                max={MAX_PRICE_SQM} 
                value={pricePerSqmRange}
                onChange={(val) => setPricePerSqmRange(val as [number, number])}
              />
              <div className="range-inputs">
                <div className="range-input-box">
                  <label>Minimum</label>
                  <span>${pricePerSqmRange[0]}/m²</span>
                </div>
                <span>-</span>
                <div className="range-input-box">
                  <label>Maximum</label>
                  <span>${pricePerSqmRange[1]}{pricePerSqmRange[1] === MAX_PRICE_SQM ? '+' : ''}/m²</span>
                </div>
              </div>
            </div>
          </section>

          {/* Total Price */}
          <section className="filter-section">
            <h3>Total Price ($)</h3>
            <div className="histogram-container">
              <div className="histogram-bars">
                {totalFrequencies.map((freq, i) => {
                  const isActive = (i / 40) * MAX_TOTAL_PRICE >= totalPriceRange[0] && 
                                   (i / 40) * MAX_TOTAL_PRICE <= totalPriceRange[1];
                  return (
                    <div 
                      key={i} 
                      className={`histogram-bar ${isActive ? 'active' : ''} ${freq > 0 ? 'has-data' : ''}`}
                      style={{ height: `${freq > 0 ? Math.max(freq * 15, 10) : 5}px` }} 
                    />
                  );
                })}
              </div>
              <Slider 
                range 
                min={0} 
                max={MAX_TOTAL_PRICE} 
                step={10000}
                value={totalPriceRange}
                onChange={(val) => setTotalPriceRange(val as [number, number])}
              />
              <div className="range-inputs">
                <div className="range-input-box">
                  <label>Minimum</label>
                  <span>${pricePerSqmRange[0] >= 1000 ? Math.round(totalPriceRange[0]/1000)+'k' : totalPriceRange[0]}</span>
                </div>
                <span>-</span>
                <div className="range-input-box">
                  <label>Maximum</label>
                  <span>${totalPriceRange[1] >= 1000 ? Math.round(totalPriceRange[1]/1000)+'k' : totalPriceRange[1]}{totalPriceRange[1] === MAX_TOTAL_PRICE ? '+' : ''}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Property Size */}
          <section className="filter-section">
            <h3>Property Size</h3>
            <div className="modal-size-filters">
              <button 
                className={`modal-size-btn ${sizeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setSizeFilter('all')}
              >Any Size</button>
              <button 
                className={`modal-size-btn ${sizeFilter === 'small' ? 'active' : ''}`}
                onClick={() => setSizeFilter('small')}
              >&lt; 1,000 m²</button>
              <button 
                className={`modal-size-btn ${sizeFilter === 'medium' ? 'active' : ''}`}
                onClick={() => setSizeFilter('medium')}
              >1k - 5k m²</button>
              <button 
                className={`modal-size-btn ${sizeFilter === 'large' ? 'active' : ''}`}
                onClick={() => setSizeFilter('large')}
              >&gt; 5k m²</button>
            </div>
          </section>
        </div>
        
        <div className="modal-footer">
          <button className="clear-btn" onClick={() => {
            setPricePerSqmRange([0, MAX_PRICE_SQM]);
            setTotalPriceRange([0, MAX_TOTAL_PRICE]);
            setSizeFilter('all');
          }}>Clear all</button>
          <button className="apply-btn" onClick={onClose}>Show homes</button>
        </div>
      </div>
    </div>
  );
};
