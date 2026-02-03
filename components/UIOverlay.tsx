import React, { useMemo, useState } from 'react';
import { GameState, BuildingType, BuildingCategory, PlacedBuilding } from '../types';
import { BUILDINGS } from '../constants';

interface UIOverlayProps {
  gameState: GameState;
  selectedBuildingId: string | null;
  onSelectBuilding: (id: string | null) => void;
  onDemolishMode: (active: boolean) => void;
  isDemolishMode: boolean;
  currentVariant: number;
  inspectedBuildingId: string | null;
  buildings: PlacedBuilding[];
  onCloseInspector: () => void;
}

const UIOverlay: React.FC<UIOverlayProps> = ({
  gameState,
  selectedBuildingId,
  onSelectBuilding,
  onDemolishMode,
  isDemolishMode,
  currentVariant,
  inspectedBuildingId,
  buildings,
  onCloseInspector,
}) => {
  const [activeCategory, setActiveCategory] = useState<BuildingCategory>(BuildingCategory.RESIDENTIAL);

  const filteredBuildings = useMemo(() => {
    return BUILDINGS.filter(b => b.category === activeCategory);
  }, [activeCategory]);

  const categories = Object.values(BuildingCategory);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getVariantName = (v: number) => {
      switch(v) {
          case 0: return 'Modern';
          case 1: return 'Classic';
          case 2: return 'Eco';
          default: return 'Standard';
      }
  };

  const formatTime = (t: number) => {
      const h = Math.floor(t);
      const m = Math.floor((t % 1) * 60);
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const getActiveToolName = () => {
      if (isDemolishMode) return "Demolish";
      if (selectedBuildingId) {
          return BUILDINGS.find(b => b.id === selectedBuildingId)?.name || "Unknown";
      }
      return "Pointer";
  };

  // Logic to get Inspected Building Data
  const inspectedData = useMemo(() => {
    if (!inspectedBuildingId) return null;
    const building = buildings.find(b => b.id === inspectedBuildingId);
    if (!building) return null;
    const type = BUILDINGS.find(b => b.id === building.typeId);
    if (!type) return null;

    const area = type.width * type.depth;
    const factor = 10;
    let pop = 0;
    let jobs = 0;
    if (type.category === BuildingCategory.RESIDENTIAL) {
        pop = Math.floor(area * factor * (1 + type.width * 0.5));
    } else if (
        type.category === BuildingCategory.COMMERCIAL || 
        type.category === BuildingCategory.INDUSTRIAL || 
        type.category === BuildingCategory.OFFICE
    ) {
        jobs = Math.floor(area * factor * (1 + type.width * 0.2));
    }

    return { building, type, pop, jobs, variant: building.variant ?? 0 };
  }, [inspectedBuildingId, buildings]);


  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between">
      
      {/* --- NEW STATS PANEL (Top Left) --- */}
      <div className="pointer-events-auto absolute top-5 left-5 bg-[#0f0f19]/90 p-5 rounded-2xl border border-white/10 backdrop-blur-md shadow-2xl min-w-[280px] select-none z-10">
        <h2 className="m-0 text-lg font-bold text-white mb-2">Metropolis Prime</h2>
        
        {/* Tool Status */}
        <div className="bg-white/5 rounded-lg p-2 mb-3 text-xs text-gray-400">
          Tool: <b className="text-white">{getActiveToolName()}</b>
        </div>

        {/* RCI Bars */}
        <div className="flex gap-2 items-end h-[50px] mb-4">
           {/* Residential Demand (Green) */}
           <div className="flex-1 h-full bg-black/20 rounded-md flex items-end overflow-hidden relative group">
              <div 
                className="w-full bg-[#2ecc71] shadow-[0_0_15px_rgba(46,204,113,0.4)] transition-all duration-500 rounded-sm" 
                style={{ height: `${gameState.rci.res}%` }} 
              />
              <div className="absolute bottom-0 w-full text-center text-[8px] font-bold text-white/50 mb-1 opacity-0 group-hover:opacity-100">RES</div>
           </div>
           {/* Commercial Demand (Blue) */}
           <div className="flex-1 h-full bg-black/20 rounded-md flex items-end overflow-hidden relative group">
              <div 
                className="w-full bg-[#3498db] shadow-[0_0_15px_rgba(52,152,219,0.4)] transition-all duration-500 rounded-sm" 
                style={{ height: `${gameState.rci.com}%` }} 
              />
              <div className="absolute bottom-0 w-full text-center text-[8px] font-bold text-white/50 mb-1 opacity-0 group-hover:opacity-100">COM</div>
           </div>
           {/* Industrial Demand (Yellow) */}
           <div className="flex-1 h-full bg-black/20 rounded-md flex items-end overflow-hidden relative group">
              <div 
                className="w-full bg-[#f1c40f] shadow-[0_0_15px_rgba(241,196,15,0.4)] transition-all duration-500 rounded-sm" 
                style={{ height: `${gameState.rci.ind}%` }} 
              />
              <div className="absolute bottom-0 w-full text-center text-[8px] font-bold text-white/50 mb-1 opacity-0 group-hover:opacity-100">IND</div>
           </div>
        </div>

        {/* Stat Rows */}
        <div className="space-y-2 border-b border-white/5 pb-2 mb-2 font-mono text-xs">
           <div className="flex justify-between items-center text-gray-300">
              <span>Population</span>
              <span className="font-bold text-[#00d2ff]">{formatNumber(gameState.population)}</span>
           </div>
           <div className="flex justify-between items-center text-gray-300">
              <span>Jobs</span>
              <span className="font-bold text-[#00d2ff]">{formatNumber(gameState.jobs)}</span>
           </div>
           <div className="flex justify-between items-center text-gray-300">
              <span>Happiness</span>
              <span className={`font-bold ${gameState.happiness > 50 ? "text-[#00d2ff]" : "text-[#ff4444]"}`}>
                  {gameState.happiness}%
              </span>
           </div>
           <div className="flex justify-between items-center text-gray-300">
              <span>Funds</span>
              <span className="font-bold text-[#00d2ff]">${formatNumber(gameState.funds)}</span>
           </div>
           <div className="flex justify-between items-center text-gray-300">
              <span>Time</span>
              <span className="font-bold text-[#00d2ff]">{formatTime(gameState.time)}</span>
           </div>
        </div>
      </div>


      {/* Building Inspection Panel */}
      {inspectedData && (
        <div className="absolute top-5 right-5 w-64 pointer-events-auto bg-[#0f0f19]/95 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden border border-white/20 transform transition-all animate-in fade-in slide-in-from-right-10 z-20">
            <div className="bg-gradient-to-r from-gray-900 to-black p-3 flex justify-between items-center text-white border-b border-white/10">
                <span className="font-bold text-xs uppercase tracking-wider text-blue-400">{inspectedData.type.category}</span>
                <button onClick={onCloseInspector} className="text-gray-400 hover:text-white transition-colors">✕</button>
            </div>
            <div className="p-4 text-white">
                <div className="mb-3">
                    <h3 className="text-lg font-bold leading-none mb-1">{inspectedData.type.name}</h3>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wide">
                        Style: <span className="text-blue-300">{getVariantName(inspectedData.variant)}</span>
                    </div>
                </div>
                
                <div className="space-y-2 mb-4 text-xs">
                    <div className="flex justify-between items-center border-b border-white/5 pb-1">
                        <span className="text-gray-400">Asset Value</span>
                        <span className="font-bold text-yellow-400">§{formatNumber(inspectedData.type.cost)}</span>
                    </div>
                    {inspectedData.pop > 0 && (
                        <div className="flex justify-between items-center border-b border-white/5 pb-1">
                            <span className="text-gray-400">Residents</span>
                            <span className="font-bold text-green-400">+{inspectedData.pop}</span>
                        </div>
                    )}
                    {inspectedData.jobs > 0 && (
                        <div className="flex justify-between items-center border-b border-white/5 pb-1">
                            <span className="text-gray-400">Workforce</span>
                            <span className="font-bold text-orange-400">+{inspectedData.jobs}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-center">
                        <span className="text-gray-400">Footprint</span>
                        <span className="font-semibold text-gray-300">{inspectedData.type.width}x{inspectedData.type.depth}</span>
                    </div>
                </div>
                
                <p className="text-[10px] text-gray-500 italic leading-relaxed">
                   "{inspectedData.type.description}"
                </p>
            </div>
        </div>
      )}

      {/* Right Side Tools (Demolish) */}
      <div className="absolute right-5 top-40 flex flex-col gap-4 pointer-events-auto z-10">
        <button 
          onClick={() => {
            onDemolishMode(!isDemolishMode);
            onSelectBuilding(null);
          }}
          className={`w-12 h-12 rounded-xl shadow-lg flex items-center justify-center transition-all border border-white/10 ${isDemolishMode ? 'bg-red-600 text-white scale-110 ring-2 ring-red-400' : 'bg-[#0f0f19]/90 text-red-500 hover:bg-white/10'}`}
          title="Demolish Tool"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Bottom Construction Menu */}
      <div className="pointer-events-auto bg-[#0f0f19]/95 backdrop-blur-xl border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] pb-6 pt-2 transition-transform duration-300 ease-in-out z-10">
        
        {/* Style Selector Indicator */}
        <div className="px-4 mb-3 flex justify-between items-center">
            <div className="flex overflow-x-auto gap-2 no-scrollbar">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors border border-transparent ${activeCategory === cat ? 'bg-blue-600 text-white shadow-md border-blue-400' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}
                    >
                    {cat}
                    </button>
                ))}
            </div>
            
            {/* Visual Style Badge */}
            <div className="hidden md:flex bg-black/40 text-white px-3 py-1 rounded-full text-[10px] font-bold items-center gap-2 border border-white/10">
                <span className="text-gray-500 font-normal">Style</span>
                <span className="text-blue-300 uppercase">{getVariantName(currentVariant)}</span>
                <span className="bg-white/10 px-1.5 rounded text-[9px] text-gray-400 border border-white/5">KEY: C</span>
            </div>
        </div>

        {/* Buildings Scroller */}
        <div className="flex overflow-x-auto px-4 gap-3 pb-2 no-scrollbar">
          {filteredBuildings.map(building => (
            <button
              key={building.id}
              onClick={() => {
                onSelectBuilding(selectedBuildingId === building.id ? null : building.id);
                onDemolishMode(false);
              }}
              className={`relative flex-shrink-0 w-20 h-24 rounded-lg border transition-all duration-200 flex flex-col overflow-hidden bg-[#1a1a2e] group
                ${selectedBuildingId === building.id ? 'border-blue-500 ring-2 ring-blue-500/50 scale-105' : 'border-white/10 hover:border-white/30'}
              `}
            >
               {/* Building Preview */}
               <div className="flex-1 bg-gradient-to-br from-white/5 to-white/10 flex items-center justify-center relative overflow-hidden">
                  <div 
                    className="w-8 h-8 shadow-lg transform group-hover:-translate-y-1 transition-transform border border-black/20 rounded-sm"
                    style={{ backgroundColor: building.color }}
                  >
                    {/* Visual Hint for De-zone */}
                    {building.id === 'tool_dezone' && <div className="text-white text-xl font-bold flex justify-center items-center h-full">X</div>}
                  </div>
                  {/* Size Label */}
                  <div className="absolute bottom-1 right-1 text-[8px] font-bold text-gray-400 bg-black/50 px-1 rounded backdrop-blur-sm">
                    {building.width}x{building.depth}
                  </div>
               </div>
               
               {/* Info Footer */}
               <div className="bg-black/40 p-1.5 text-center border-t border-white/5">
                  <div className="text-[9px] font-bold text-gray-300 truncate">{building.name}</div>
                  <div className="text-[9px] font-semibold text-yellow-500">§{building.cost}</div>
               </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UIOverlay;