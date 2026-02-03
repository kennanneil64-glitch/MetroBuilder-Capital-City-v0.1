import React, { useState, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';
import UIOverlay from './components/UIOverlay';
import { GameState, PlacedBuilding, BuildingCategory } from './types';
import { INITIAL_FUNDS, INITIAL_POPULATION, BUILDINGS } from './constants';

const App: React.FC = () => {
  // Game State
  const [gameState, setGameState] = useState<GameState>({
    funds: INITIAL_FUNDS,
    population: INITIAL_POPULATION,
    jobs: 0,
    happiness: 100,
    level: 1,
    rci: { res: 100, com: 50, ind: 50 },
    time: 8.0, // Start at 8 AM
    weather: 'clear'
  });

  const [buildings, setBuildings] = useState<PlacedBuilding[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [inspectedBuildingId, setInspectedBuildingId] = useState<string | null>(null);
  const [isDemolishMode, setIsDemolishMode] = useState(false);
  const [currentVariant, setCurrentVariant] = useState(0); // 0: Modern, 1: Classic, 2: Eco

  // Time Cycle & RCI Simulation
  useEffect(() => {
      const timer = setInterval(() => {
          setGameState(prev => {
              // Time Progression: 5 minutes real time for 24h game cycle
              // Interval is 100ms (10 ticks/sec). 
              // 5 mins = 300 sec = 3000 ticks.
              // 24h / 3000 ticks = 0.008h per tick.
              const newTime = (prev.time + 0.008) % 24;

              // Weather Simulation: Cycle approx every 5 mins
              // Prob = 1 / 3000 ticks ≈ 0.00033
              let newWeather = prev.weather;
              if (Math.random() < 0.00033) { 
                  const roll = Math.random();
                  if (roll < 0.5) newWeather = 'clear';
                  else if (roll < 0.8) newWeather = 'rain';
                  else newWeather = 'fog';
              }

              // Simple RCI Logic
              // Res demand drops as population grows relative to jobs
              // Com/Ind demand grows as population grows
              const jobPopRatio = prev.jobs === 0 ? 0 : prev.jobs / (prev.population || 1);
              
              let targetRes = 100;
              if (prev.population > 0) {
                  // If lots of jobs available (ratio > 1), high res demand. If no jobs, low demand.
                  targetRes = Math.min(100, Math.max(0, 50 + (prev.jobs - prev.population) * 0.1));
              }

              const targetCom = Math.min(100, Math.max(0, (prev.population * 0.5 - prev.jobs * 0.2) / 2));
              const targetInd = Math.min(100, Math.max(0, (prev.population * 0.4 - prev.jobs * 0.3) / 2));

              // Smooth lerp
              const lerp = (a: number, b: number) => a + (b - a) * 0.05;

              return {
                  ...prev,
                  time: newTime,
                  weather: newWeather,
                  rci: {
                      res: lerp(prev.rci.res, targetRes),
                      com: lerp(prev.rci.com, targetCom),
                      ind: lerp(prev.rci.ind, targetInd)
                  }
              };
          });
      }, 100);

      return () => clearInterval(timer);
  }, []);

  // Logic to update stats based on buildings
  useEffect(() => {
    let newPop = 0;
    let newJobs = 0;

    buildings.forEach(b => {
      const bType = BUILDINGS.find(t => t.id === b.typeId);
      if (!bType) return;

      const area = bType.width * bType.depth;
      const factor = 10; // Base multiplier

      if (bType.category === BuildingCategory.RESIDENTIAL) {
        // Density scales with size
        newPop += area * factor * (1 + bType.width * 0.5); 
      } else if (
        bType.category === BuildingCategory.COMMERCIAL || 
        bType.category === BuildingCategory.INDUSTRIAL || 
        bType.category === BuildingCategory.OFFICE
      ) {
        newJobs += area * factor * (1 + bType.width * 0.2);
      }
    });

    setGameState(prev => ({
      ...prev,
      population: Math.floor(newPop),
      jobs: Math.floor(newJobs)
    }));
  }, [buildings]);

  const handlePlaceBuilding = (building: PlacedBuilding) => {
    if (building.typeId === 'tool_dezone') {
       return; 
    }
    // Ensure the placed building keeps the current variant
    setBuildings([...buildings, { ...building, variant: currentVariant }]);
  };

  const handleRemoveBuilding = (id: string) => {
     setBuildings(buildings.filter(b => b.id !== id));
     if (inspectedBuildingId === id) setInspectedBuildingId(null);
  };

  const handleDeselect = () => {
    setSelectedBuildingId(null);
    setIsDemolishMode(false);
    setInspectedBuildingId(null);
  };

  const handleSelectBuildingTool = (id: string | null) => {
    setSelectedBuildingId(id);
    if (id) {
        setInspectedBuildingId(null); // Clear inspection when picking a tool
        setIsDemolishMode(false);
    }
  };

  const handleDemolishToggle = (active: boolean) => {
      setIsDemolishMode(active);
      if (active) {
          setSelectedBuildingId(null);
          setInspectedBuildingId(null);
      }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-900">
      <GameCanvas
        selectedBuildingId={selectedBuildingId}
        isDemolishMode={isDemolishMode}
        gameState={gameState}
        onUpdateGameState={(updates) => setGameState(prev => ({ ...prev, ...updates }))}
        buildings={buildings}
        onPlaceBuilding={handlePlaceBuilding}
        onRemoveBuilding={handleRemoveBuilding}
        onDeselect={handleDeselect}
        currentVariant={currentVariant}
        onVariantChange={setCurrentVariant}
        onInspectBuilding={setInspectedBuildingId}
      />
      
      <UIOverlay 
        gameState={gameState}
        selectedBuildingId={selectedBuildingId}
        onSelectBuilding={handleSelectBuildingTool}
        isDemolishMode={isDemolishMode}
        onDemolishMode={handleDemolishToggle}
        currentVariant={currentVariant}
        inspectedBuildingId={inspectedBuildingId}
        buildings={buildings}
        onCloseInspector={() => setInspectedBuildingId(null)}
      />
    </div>
  );
};

export default App;