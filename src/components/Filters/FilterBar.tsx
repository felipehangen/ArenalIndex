import React from 'react';
import { BuildingIcon, CarIcon, DropletsIcon, LeafIcon, TreePineIcon, ZapIcon, SlidersHorizontalIcon } from 'lucide-react';

export type FilterType = 'mainRoadFront' | 'quietRetreat' | 'existingHouse' | 'heavilyWooded' | 'riverAccess' | 'plugAndPlay';

interface FilterBarProps {
  activeFilters: FilterType[];
  toggleFilter: (filter: FilterType) => void;
  onOpenFilters: () => void;
}

const CATEGORIES = [
  { id: 'mainRoadFront', label: 'Main Road Front', icon: CarIcon },
  { id: 'quietRetreat', label: 'Quiet Retreat', icon: LeafIcon },
  { id: 'existingHouse', label: 'Move-In Ready', icon: BuildingIcon },
  { id: 'heavilyWooded', label: 'Jungle Vibe', icon: TreePineIcon },
  { id: 'riverAccess', label: 'River Access', icon: DropletsIcon },
  { id: 'plugAndPlay', label: 'Plug & Play', icon: ZapIcon },
];

export const FilterBar: React.FC<FilterBarProps> = ({ 
  activeFilters, 
  toggleFilter,
  onOpenFilters
}) => {
  return (
    <div className="airbnb-categories-wrapper">
      <div className="airbnb-categories-scroll">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeFilters.includes(cat.id as FilterType);
          return (
            <div 
              key={cat.id} 
              className={`airbnb-category-item ${isActive ? 'active' : ''}`}
              onClick={() => toggleFilter(cat.id as FilterType)}
            >
              <Icon size={24} strokeWidth={isActive ? 2 : 1.5} className="category-icon" />
              <span className="category-label">{cat.label}</span>
            </div>
          );
        })}
      </div>
      
      <div className="airbnb-filters-container">
        <button className="airbnb-filters-btn" onClick={onOpenFilters}>
          <SlidersHorizontalIcon size={16} />
          <span className="hide-on-mobile">Filters</span>
        </button>
      </div>
    </div>
  );
};
