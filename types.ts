export enum BuildingCategory {
  RESIDENTIAL = 'Residential',
  COMMERCIAL = 'Commercial',
  INDUSTRIAL = 'Industrial',
  OFFICE = 'Office',
  UTILITY = 'Utility',
  DECORATION = 'Parks',
  ROAD = 'Road',
  TOOLS = 'Tools'
}

export interface BuildingType {
  id: string;
  name: string;
  category: BuildingCategory;
  width: number; // in grid cells
  depth: number; // in grid cells
  height: number;
  color: string;
  cost: number;
  description: string;
}

export interface PlacedBuilding {
  id: string;
  typeId: string;
  x: number;
  z: number;
  rotation: number; // 0, 90, 180, 270
  variant?: number; // Visual variant index (0, 1, 2...)
}

export interface GameState {
  funds: number;
  population: number;
  jobs: number;
  happiness: number;
  level: number;
  rci: { res: number; com: number; ind: number };
  time: number; // 0.0 to 24.0
  weather: 'clear' | 'rain' | 'fog';
}

export interface Vector2 {
  x: number;
  y: number;
}