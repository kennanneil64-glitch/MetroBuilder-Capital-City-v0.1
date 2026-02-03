import { BuildingCategory, BuildingType } from './types';

// Grid Settings
export const GRID_SIZE = 128; // Total grid size (128x128 tiles) - Expanded x2
export const TILE_SIZE = 10; // Size of one tile in World Units
export const MAP_SIZE = GRID_SIZE * TILE_SIZE;

// Colors
export const COLORS = {
  GRASS: '#4ade80', // Tailwind green-400
  WATER: '#38bdf8', // Tailwind sky-400
  GRID_LINE: '#ffffff',
  SELECTION_VALID: '#22c55e',
  SELECTION_INVALID: '#ef4444',
  BACKGROUND: '#bae6fd', // Sky blue
};

// Initial State
export const INITIAL_FUNDS = 50000;
export const INITIAL_POPULATION = 0;

// Helper to create zones
const createZone = (
  prefix: string, 
  name: string, 
  category: BuildingCategory, 
  color: string, 
  baseCost: number, 
  baseHeight: number
): BuildingType[] => {
  const sizes = [1, 2, 3, 4];
  return sizes.map(size => ({
    id: `${prefix}_${size}x${size}`,
    name: `${name} ${size}x${size}`,
    category,
    width: size,
    depth: size,
    height: baseHeight * (1 + (size * 0.5)), // Taller for bigger zones
    color,
    cost: baseCost * size * size,
    description: `${size}x${size} ${name} zone.`
  }));
};

// Building Catalog
export const BUILDINGS: BuildingType[] = [
  // Tools
  {
    id: 'tool_dezone',
    name: 'De-Zone Tool',
    category: BuildingCategory.TOOLS,
    width: 1,
    depth: 1,
    height: 0.1,
    color: '#ff0000',
    cost: 0,
    description: 'Removes zoning and buildings.',
  },
  {
    id: 'road_local',
    name: 'Road',
    category: BuildingCategory.ROAD,
    width: 1,
    depth: 1,
    height: 0.1,
    color: '#374151',
    cost: 10,
    description: 'Basic infrastructure.',
  },

  // Residential (Green)
  ...createZone('res', 'Residential', BuildingCategory.RESIDENTIAL, '#4ade80', 50, 2),

  // Commercial (Blue)
  ...createZone('com', 'Commercial', BuildingCategory.COMMERCIAL, '#60a5fa', 100, 3),

  // Industrial (Yellow)
  ...createZone('ind', 'Industrial', BuildingCategory.INDUSTRIAL, '#facc15', 150, 3),

  // Office (Purple)
  ...createZone('off', 'Office', BuildingCategory.OFFICE, '#c084fc', 200, 5),

  // Landfill (Brown)
  ...createZone('util_landfill', 'Landfill', BuildingCategory.UTILITY, '#854d0e', 500, 1.5),

  // Parks (Trees)
  ...createZone('dec_park', 'Park', BuildingCategory.DECORATION, '#166534', 100, 0.5),
];