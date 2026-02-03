import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GameState, PlacedBuilding, BuildingType, BuildingCategory } from '../types';
import { GRID_SIZE, TILE_SIZE, MAP_SIZE, BUILDINGS, COLORS } from '../constants';

interface GameCanvasProps {
  selectedBuildingId: string | null;
  isDemolishMode: boolean;
  gameState: GameState;
  onUpdateGameState: (newState: Partial<GameState>) => void;
  buildings: PlacedBuilding[];
  onPlaceBuilding: (building: PlacedBuilding) => void;
  onRemoveBuilding: (id: string) => void;
  onDeselect: () => void;
  currentVariant: number;
  onVariantChange: (v: number) => void;
  onInspectBuilding: (id: string | null) => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({
  selectedBuildingId,
  isDemolishMode,
  gameState,
  onUpdateGameState,
  buildings,
  onPlaceBuilding,
  onRemoveBuilding,
  onDeselect,
  currentVariant,
  onVariantChange,
  onInspectBuilding
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const ghostRef = useRef<THREE.Group | null>(null);
  const buildingsGroupRef = useRef<THREE.Group>(new THREE.Group());
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);

  // Weather & Lighting Refs
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientLightRef = useRef<THREE.HemisphereLight | null>(null);
  const rainSystemRef = useRef<THREE.Points | null>(null);
  const starSystemRef = useRef<THREE.Points | null>(null);
  
  // To access fresh state inside animate loop without re-binding loop
  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // --- Helpers defined outside to avoid recreation ---
  const getSelectedBuildingType = useCallback((): BuildingType | undefined => {
    return BUILDINGS.find(b => b.id === selectedBuildingId);
  }, [selectedBuildingId]);

  // Procedural Building Generator
  const createProceduralBuilding = useCallback((type: BuildingType, variant: number = 0, isGhost: boolean = false): THREE.Object3D => {
      const group = new THREE.Group();
      const w = type.width * TILE_SIZE;
      const d = type.depth * TILE_SIZE;
      const h = type.height * TILE_SIZE;
      
      const style = variant % 3;

      const isZone = [
          BuildingCategory.RESIDENTIAL, 
          BuildingCategory.COMMERCIAL, 
          BuildingCategory.OFFICE,
          BuildingCategory.INDUSTRIAL
      ].includes(type.category);

      // --- Helper Materials ---
      // We add emissive properties to allow windows to light up at night
      const createMat = (color: string | number, rough: number, metal: number, emissive: boolean = false) => new THREE.MeshStandardMaterial({
          color: color,
          roughness: rough,
          metalness: metal,
          transparent: isGhost,
          opacity: isGhost ? 0.6 : 1.0,
          flatShading: true,
          emissive: emissive ? color : 0x000000,
          emissiveIntensity: 0
      });

      // --- UTILITY (Landfill) & DECORATION (Parks) & ROAD ---
      if (type.category === BuildingCategory.UTILITY && type.id.includes('landfill')) {
          const piles = Math.max(3, w * 0.5);
          const pileMat = createMat('#713f12', 0.9, 0.0);
          for(let i=0; i<piles; i++) {
              const r = 2 + Math.random() * 3;
              const pile = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), pileMat);
              pile.position.set((Math.random()-0.5)*(w-4), r*0.5, (Math.random()-0.5)*(d-4));
              if (!isGhost) pile.castShadow = true;
              group.add(pile);
          }
          if (!isGhost) {
              const fence = new THREE.Mesh(new THREE.BoxGeometry(w, 2, d), new THREE.MeshStandardMaterial({ color: '#444', wireframe: true }));
              fence.position.y = 1;
              group.add(fence);
          }
          return group;
      }
      
      if (type.category === BuildingCategory.DECORATION) {
          const ground = new THREE.Mesh(new THREE.BoxGeometry(w, 1, d), createMat('#166534', 0.9, 0));
          ground.position.y = 0.5;
          group.add(ground);
          if (!isGhost) {
              const treeCount = Math.max(1, (w * d) / 50);
              for(let i=0; i<treeCount; i++) {
                  const tGroup = new THREE.Group();
                  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 2), createMat('#3f2c20', 1, 0));
                  trunk.position.y = 1;
                  const leavesCol = style === 2 ? '#4ade80' : '#15803d'; // Lighter green for eco
                  const leaves = new THREE.Mesh(new THREE.ConeGeometry(2, 4), createMat(leavesCol, 0.8, 0));
                  leaves.position.y = 3.5;
                  tGroup.add(trunk); tGroup.add(leaves);
                  tGroup.position.set((Math.random()-0.5)*(w-4), 0.5, (Math.random()-0.5)*(d-4));
                  group.add(tGroup);
              }
          }
          return group;
      }

      if (!isZone) {
           const mesh = new THREE.Mesh(new THREE.BoxGeometry(w-0.2, h, d-0.2), createMat(type.color, 0.5, 0));
           mesh.position.y = h/2;
           group.add(mesh);
           return group;
      }

      // --- ZONED BUILDINGS ---

      // STYLE 0: MODERN
      if (style === 0) {
          const glassColor = type.category === BuildingCategory.OFFICE ? '#a78bfa' : 
                             type.category === BuildingCategory.COMMERCIAL ? '#60a5fa' :
                             type.category === BuildingCategory.RESIDENTIAL ? '#86efac' : '#fde047';
          
          // Modern buildings have high emissive potential (glass towers)
          const mat = createMat(glassColor, 0.1, 0.8, true);
          
          if (h > 15) { 
             const towerW = w - 4;
             const towerD = d - 4;
             const tower = new THREE.Mesh(new THREE.BoxGeometry(towerW, h, towerD), mat);
             tower.position.y = h/2;
             tower.name = "window_mesh"; // Tag for night cycle
             if (!isGhost) { tower.castShadow = true; tower.receiveShadow = true; }
             group.add(tower);
             
             const frame = new THREE.Mesh(new THREE.BoxGeometry(towerW - 0.5, h+0.2, towerD - 0.5), new THREE.MeshBasicMaterial({color: 0xffffff, wireframe: true, transparent: true, opacity: 0.2}));
             frame.position.y = h/2;
             group.add(frame);
          } else {
             const box = new THREE.Mesh(new THREE.BoxGeometry(w-2, h, d-2), mat);
             box.position.y = h/2;
             box.name = "window_mesh";
             if (!isGhost) { box.castShadow = true; box.receiveShadow = true; }
             group.add(box);
          }
      }

      // STYLE 1: CLASSIC
      else if (style === 1) {
          const brickColor = type.category === BuildingCategory.RESIDENTIAL ? '#b45309' : 
                             type.category === BuildingCategory.COMMERCIAL ? '#78350f' : 
                             '#57534e'; 
          
          const mat = createMat(brickColor, 0.9, 0.1);
          const roofMat = createMat('#374151', 0.6, 0.3);
          const trimMat = createMat('#e5e5e5', 0.5, 0);

          const box = new THREE.Mesh(new THREE.BoxGeometry(w-2, h, d-2), mat);
          box.position.y = h/2;
          if (!isGhost) { box.castShadow = true; box.receiveShadow = true; }
          group.add(box);

          // Add windows as separate small meshes for classic style
          if (!isGhost) {
              const winMat = createMat('#ffffaa', 0.2, 0.8, true);
              const floors = Math.floor(h / 3);
              for(let f=1; f<floors; f++) {
                  const win = new THREE.Mesh(new THREE.BoxGeometry(w-1.8, 1.5, d-1.8), winMat);
                  win.position.y = f * 3;
                  win.name = "window_mesh";
                  group.add(win);
              }
          }

          if (!isGhost) {
              const cornice = new THREE.Mesh(new THREE.BoxGeometry(w-1.5, 1, d-1.5), trimMat);
              cornice.position.y = h - 0.5;
              group.add(cornice);

              const plinth = new THREE.Mesh(new THREE.BoxGeometry(w-1.8, 1, d-1.8), trimMat);
              plinth.position.y = 0.5;
              group.add(plinth);

              if (type.category === BuildingCategory.RESIDENTIAL) {
                  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.min(w,d)/2, 4, 4), roofMat);
                  roof.position.y = h + 2;
                  roof.rotation.y = Math.PI/4;
                  group.add(roof);
              }
          }
      }

      // STYLE 2: ECO
      else if (style === 2) {
          const wallMat = createMat('#f9fafb', 0.3, 0.1);
          const woodMat = createMat('#d97706', 0.8, 0);
          const grassMat = createMat('#22c55e', 1.0, 0);
          const glassMat = createMat('#a7f3d0', 0.1, 0.8, true);

          const steps = Math.max(1, Math.floor(h / 6));
          const stepH = h / steps;

          for(let i=0; i<steps; i++) {
              const inset = i * 1.5;
              const stepW = Math.max(2, w - 2 - inset);
              const stepD = Math.max(2, d - 2 - inset);
              
              const mesh = new THREE.Mesh(new THREE.BoxGeometry(stepW, stepH, stepD), i % 2 === 0 ? wallMat : woodMat);
              mesh.position.y = (i * stepH) + stepH/2;
              if (!isGhost) { mesh.castShadow = true; mesh.receiveShadow = true; }
              group.add(mesh);
              
              // Eco windows
              if (i % 2 === 0 && !isGhost) {
                 const win = new THREE.Mesh(new THREE.BoxGeometry(stepW+0.1, stepH*0.6, stepD+0.1), glassMat);
                 win.position.y = (i * stepH) + stepH/2;
                 win.name = "window_mesh";
                 group.add(win);
              }

              if (i > 0 && !isGhost) {
                 const prevInset = (i-1) * 1.5;
                 const prevW = Math.max(2, w - 2 - prevInset);
                 const prevD = Math.max(2, d - 2 - prevInset);
                 const grass = new THREE.Mesh(new THREE.BoxGeometry(prevW - 0.2, 0.2, prevD - 0.2), grassMat);
                 grass.position.y = (i * stepH);
                 group.add(grass);
              }
          }
          if (!isGhost) {
             const finalInset = (steps-1) * 1.5;
             const finalW = Math.max(2, w - 2 - finalInset);
             const finalD = Math.max(2, d - 2 - finalInset);
             const grass = new THREE.Mesh(new THREE.BoxGeometry(finalW-0.2, 0.2, finalD-0.2), grassMat);
             grass.position.y = h;
             group.add(grass);
          }
      }
      
      return group;
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.WATER); 
    scene.fog = new THREE.Fog(COLORS.WATER, 600, 2500);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 8000);
    camera.position.set(0, 600, 800);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    while (mountRef.current.firstChild) {
      mountRef.current.removeChild(mountRef.current.firstChild);
    }
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 50;
    controls.maxDistance = 2000; 
    controls.maxPolarAngle = Math.PI / 2 - 0.05;

    // Lights
    const ambientLight = new THREE.HemisphereLight(0xffffff, 0xebf4ff, 0.5);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(-500, 1000, 500);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    const shadowD = 1500;
    dirLight.shadow.camera.left = -shadowD;
    dirLight.shadow.camera.right = shadowD;
    dirLight.shadow.camera.top = shadowD;
    dirLight.shadow.camera.bottom = -shadowD;
    scene.add(dirLight);
    sunLightRef.current = dirLight;

    // Particle Systems
    // Stars
    const starGeo = new THREE.BufferGeometry();
    const starCount = 2000;
    const starPos = new Float32Array(starCount * 3);
    for(let i=0; i<starCount; i++) {
        const r = 2000;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        starPos[i*3] = r * Math.sin(phi) * Math.cos(theta);
        starPos[i*3+1] = Math.abs(r * Math.sin(phi) * Math.sin(theta)) + 100; // Keep above horizon roughly
        starPos[i*3+2] = r * Math.cos(phi);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({color: 0xffffff, size: 4, transparent: true, opacity: 0});
    const starSystem = new THREE.Points(starGeo, starMat);
    scene.add(starSystem);
    starSystemRef.current = starSystem;

    // Rain
    const rainGeo = new THREE.BufferGeometry();
    const rainCount = 10000;
    const rainPos = new Float32Array(rainCount * 3);
    for(let i=0; i<rainCount; i++) {
        rainPos[i*3] = (Math.random() - 0.5) * MAP_SIZE * 1.5;
        rainPos[i*3+1] = Math.random() * 800;
        rainPos[i*3+2] = (Math.random() - 0.5) * MAP_SIZE * 1.5;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.PointsMaterial({color: 0xaaaaaa, size: 1.5, transparent: true, opacity: 0});
    const rainSystem = new THREE.Points(rainGeo, rainMat);
    scene.add(rainSystem);
    rainSystemRef.current = rainSystem;


    // Terrain Generation
    const terrainConfig = {
      mountainStart: -MAP_SIZE / 2, 
      beachStart: MAP_SIZE / 2,     
      riverPath: (x: number) => Math.sin(x * 0.005) * 80 + Math.sin(x * 0.015) * 30
    };

    generateTerrain(scene, terrainConfig);
    addRocksInstanced(scene, terrainConfig);
    addTreesInstanced(scene, terrainConfig);

    const gridHelper = new THREE.GridHelper(MAP_SIZE, GRID_SIZE, 0xffffff, 0xffffff);
    (gridHelper.material as THREE.Material).transparent = true;
    (gridHelper.material as THREE.Material).opacity = 0;
    gridHelper.position.y = 2.5;
    gridHelperRef.current = gridHelper;
    scene.add(gridHelper);

    scene.add(buildingsGroupRef.current);

    const ghostGroup = new THREE.Group();
    ghostRef.current = ghostGroup;
    scene.add(ghostGroup);

    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      controls.update();

      // --- Day/Night Cycle Logic ---
      const curState = gameStateRef.current;
      const time = curState.time;
      const weather = curState.weather;

      // Calculate Day Fraction (0 at 6am, 0.5 at 18pm, 1 at 6am next day)
      // Game Time: 0-24. 
      // Sun should be up from ~6 to ~18.
      // Cosine cycle: peak at 12.
      const sunAngle = ((time - 6) / 24) * Math.PI * 2; 
      
      // Update Sun Position
      if (sunLightRef.current) {
         const dist = 1000;
         sunLightRef.current.position.x = Math.cos(sunAngle) * dist;
         sunLightRef.current.position.y = Math.sin(sunAngle) * dist;
         sunLightRef.current.position.z = 500; // Slight tilt
         sunLightRef.current.lookAt(0,0,0);
         
         // Intensity fades at night
         const intensity = Math.max(0, Math.sin(sunAngle));
         // Reduce intensity during rain/fog
         const weatherDim = weather !== 'clear' ? 0.4 : 1.0;
         sunLightRef.current.intensity = intensity * 1.5 * weatherDim;
      }

      // Sky Color & Fog
      const isNight = time < 5 || time > 19;
      const isDawnDusk = (time >= 5 && time < 7) || (time > 17 && time <= 19);
      
      let targetSky = new THREE.Color(COLORS.WATER); // Day blue
      if (isNight) targetSky.setHex(0x0a0a15); // Night dark blue
      else if (isDawnDusk) targetSky.setHex(0xffaa77); // Orange tint
      
      // Weather overrides
      if (weather === 'rain') {
          targetSky.lerp(new THREE.Color(0x333344), 0.8); // Stormy grey
      } else if (weather === 'fog') {
          targetSky.lerp(new THREE.Color(0xcccccc), 0.9); // Foggy white
      }

      scene.background = targetSky;
      
      // Fog Logic
      if (scene.fog) {
          scene.fog.color.copy(targetSky);
          let targetDensity = 0.0004; // Clear day
          if (weather === 'fog') targetDensity = 0.0025;
          else if (weather === 'rain') targetDensity = 0.0015;
          
          if (scene.fog instanceof THREE.Fog) {
             // We used Fog in initialization, converting to FogExp2 might be better for thick fog, but let's stick to linear or simple density simulation manually if using Fog
             // Actually init used linear Fog(color, 600, 2500)
             // Let's modify near/far for linear fog to simulate density
             const baseNear = 600;
             const baseFar = 2500;
             let wNear = baseNear, wFar = baseFar;
             
             if (weather === 'fog') { wNear = 50; wFar = 900; }
             else if (weather === 'rain') { wNear = 300; wFar = 1500; }

             scene.fog.near += (wNear - scene.fog.near) * 0.05;
             scene.fog.far += (wFar - scene.fog.far) * 0.05;
          }
      }

      // Stars
      if (starSystemRef.current) {
          const starOpacity = isNight && weather === 'clear' ? Math.max(0, Math.sin(((time + 12)%24 / 24) * Math.PI) ) : 0;
          (starSystemRef.current.material as THREE.PointsMaterial).opacity = starOpacity;
      }

      // Rain Particles
      if (rainSystemRef.current) {
          const positions = rainSystemRef.current.geometry.attributes.position.array as Float32Array;
          const isRaining = weather === 'rain';
          (rainSystemRef.current.material as THREE.PointsMaterial).opacity = isRaining ? 0.6 : 0;
          
          if (isRaining) {
              for(let i=0; i<positions.length/3; i++) {
                  positions[i*3+1] -= 8; // Fall speed
                  if (positions[i*3+1] < 0) {
                      positions[i*3+1] = 800;
                  }
              }
              rainSystemRef.current.geometry.attributes.position.needsUpdate = true;
          }
      }

      // Building Windows (Emissive at night)
      const nightIntensity = Math.max(0, Math.cos(sunAngle) * -1); // 1 at midnight
      buildingsGroupRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh && child.name === "window_mesh") {
             const mat = child.material as THREE.MeshStandardMaterial;
             if (mat.emissive) {
                 mat.emissiveIntensity = nightIntensity * (weather === 'clear' ? 1.5 : 2.0); // Brighter contrast in rain
             }
          }
      });

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId);
      renderer.dispose();
      controls.dispose();
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  // --- Terrain Logic ---
  const generateTerrain = (scene: THREE.Scene, config: any) => {
    const terrainSize = MAP_SIZE * 2.8;
    const geometry = new THREE.PlaneGeometry(terrainSize, terrainSize, 256, 256);
    geometry.rotateX(-Math.PI / 2);

    const posAttr = geometry.attributes.position;
    const colors: number[] = [];
    const vertex = new THREE.Vector3();

    const cGrass = new THREE.Color('#4ade80');
    const cGrassDark = new THREE.Color('#15803d');
    const cSand = new THREE.Color('#fcd34d');
    const cRiverBed = new THREE.Color('#78350f');
    const cRock = new THREE.Color('#57534e');
    const cSnow = new THREE.Color('#ffffff');
    const cOceanBed = new THREE.Color('#0369a1');

    const noise = (x: number, z: number) => {
        return Math.sin(x * 0.01) * Math.cos(z * 0.01) + 
               Math.sin(x * 0.03) * Math.cos(z * 0.03) * 0.5;
    };

    for (let i = 0; i < posAttr.count; i++) {
      vertex.fromBufferAttribute(posAttr, i);
      let color = cGrass.clone();
      let height = 2;

      const riverZ = config.riverPath(vertex.x);
      const distToRiver = Math.abs(vertex.z - riverZ);
      const isRiver = distToRiver < 40;
      const isRiverBank = distToRiver < 55;

      if (vertex.x < config.mountainStart) {
         const t = (config.mountainStart - vertex.x) / 600;
         let mHeight = 2 + (t * t * 600);
         mHeight += noise(vertex.x, vertex.z) * 20;
         mHeight += Math.abs(Math.sin(vertex.x * 0.05) * Math.cos(vertex.z * 0.05)) * 40 * t;
         height = mHeight;
         if (isRiver) {
             const riverFade = Math.max(0, 1 - t * 4);
             if (riverFade > 0) {
                 const riverBedHeight = -2 + (1 - riverFade) * 10;
                 height = THREE.MathUtils.lerp(height, riverBedHeight, riverFade);
                 if (riverFade > 0.5) {
                    color.lerp(cRiverBed, 0.6);
                 } else {
                    color.lerp(cRock, 1.0);
                 }
             } else {
                color.lerp(cRock, 0.9);
             }
         } else {
             if (height > 180) {
                 color.lerp(cSnow, Math.min(1, (height - 180) / 100));
             } else {
                 color.lerp(cRock, 0.8 + Math.random() * 0.2);
             }
         }
      }
      else if (vertex.x > config.beachStart) {
         const dist = vertex.x - config.beachStart;
         if (dist < 80) {
             height = 2 - (dist / 80) * 16;
             color = cSand;
         } else {
             height = -14 - Math.random() * 3;
             color = cOceanBed;
         }
      }
      else {
          height = 2 + noise(vertex.x, vertex.z) * 3;
          if (Math.random() > 0.6) color.lerp(cGrassDark, 0.1);
          if (isRiver) {
             const depth = (1 - distToRiver / 40);
             height = 2 - depth * 14; 
             color.lerp(cRiverBed, depth * 0.8);
          } else if (isRiverBank) {
             color.lerp(cSand, 0.4);
          }
      }

      posAttr.setXYZ(i, vertex.x, height, vertex.z);
      colors.push(color.r, color.g, color.b);
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true
    });

    const terrain = new THREE.Mesh(geometry, mat);
    terrain.receiveShadow = true;
    terrain.name = 'terrain';
    scene.add(terrain);

    const waterGeo = new THREE.PlaneGeometry(terrainSize, terrainSize);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: COLORS.WATER,
      transparent: true,
      opacity: 0.75,
      roughness: 0.05,
      metalness: 0.4
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.y = -3;
    scene.add(water);
  };

  const addRocksInstanced = (scene: THREE.Scene, config: any) => {
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: '#78716c', flatShading: true, roughness: 0.8 });
    const count = 500;
    const mesh = new THREE.InstancedMesh(rockGeo, rockMat, count);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    const dummy = new THREE.Object3D();
    const terrainSize = MAP_SIZE * 2.5; 
    const limit = terrainSize / 2;

    for (let i = 0; i < count; i++) {
        let x = (Math.random() - 0.5) * limit * 2;
        let z = (Math.random() - 0.5) * limit * 2;
        const riverZ = config.riverPath(x);
        if (Math.abs(z - riverZ) < 30) continue; 
        let y = 2;
        if (x < config.mountainStart) {
             const t = (config.mountainStart - x) / 600;
             y = 2 + (t * t * 600);
        }
        if (x > config.beachStart + 80) continue;
        dummy.position.set(x, y + Math.random(), z);
        const s = 3 + Math.random() * 7;
        dummy.scale.set(s, s * 0.7, s);
        dummy.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
    }
    scene.add(mesh);
  };

  const addTreesInstanced = (scene: THREE.Scene, config: any) => {
    const count = 3000; 
    const trunkGeo = new THREE.CylinderGeometry(1.2, 1.8, 3, 5);
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#451a03' });
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    const leavesGeo = new THREE.ConeGeometry(5, 11, 7);
    const leavesMat = new THREE.MeshStandardMaterial({ color: '#15803d' });
    const leavesMesh = new THREE.InstancedMesh(leavesGeo, leavesMat, count);
    leavesMesh.castShadow = true;
    leavesMesh.receiveShadow = true;
    const dummy = new THREE.Object3D();
    const terrainSize = MAP_SIZE * 2.5;
    const limit = terrainSize / 2;
    
    let index = 0;
    for (let i = 0; i < count * 2; i++) { 
        if (index >= count) break;
        const x = (Math.random() - 0.5) * limit * 2;
        const z = (Math.random() - 0.5) * limit * 2;
        const riverZ = config.riverPath(x);
        if (Math.abs(z - riverZ) < 55) continue;
        if (x > config.beachStart - 20) continue;
        let y = 2;
        if (x < config.mountainStart) {
             const t = (config.mountainStart - x) / 600;
             y = 2 + (t * t * 600);
             if (y > 150) continue; 
        }
        dummy.position.set(x, y + 1.5, z);
        const s = 0.7 + Math.random() * 0.8;
        dummy.scale.set(s, s, s);
        dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(index, dummy.matrix);
        dummy.position.set(x, y + 6.5, z);
        dummy.updateMatrix();
        leavesMesh.setMatrixAt(index, dummy.matrix);
        index++;
    }
    trunkMesh.count = index;
    leavesMesh.count = index;
    scene.add(trunkMesh);
    scene.add(leavesMesh);
  };

  // --- Rendering Buildings ---
  useEffect(() => {
    const group = buildingsGroupRef.current;
    group.clear(); 

    buildings.forEach(b => {
      const bType = BUILDINGS.find(t => t.id === b.typeId);
      if (!bType) return;
      
      const buildingMesh = createProceduralBuilding(bType, b.variant || 0, false);
      buildingMesh.position.set(b.x, 2, b.z);
      buildingMesh.userData = { id: b.id, isBuilding: true };
      
      group.add(buildingMesh);
    });
  }, [buildings, createProceduralBuilding]);

  // --- Ghost & Input ---
  const checkCollision = useCallback((x: number, z: number, w: number, d: number): boolean => {
      const halfMap = MAP_SIZE / 2;
      const hw = (w * TILE_SIZE) / 2;
      const hd = (d * TILE_SIZE) / 2;
      
      if (x - hw < -halfMap || x + hw > halfMap || z - hd < -halfMap || z + hd > halfMap) return true;

      return buildings.some(b => {
          const bType = BUILDINGS.find(t => t.id === b.typeId);
          if (!bType) return false;
          
          const rect1 = { x1: b.x - (bType.width*TILE_SIZE)/2, x2: b.x + (bType.width*TILE_SIZE)/2, z1: b.z - (bType.depth*TILE_SIZE)/2, z2: b.z + (bType.depth*TILE_SIZE)/2 };
          const rect2 = { x1: x - hw, x2: x + hw, z1: z - hd, z2: z + hd };

          return (rect1.x1 < rect2.x2 && rect1.x2 > rect2.x1 && rect1.z1 < rect2.z2 && rect1.z2 > rect2.z1);
      });
  }, [buildings]);

  const updateGhost = useCallback((x: number, z: number) => {
     if (!ghostRef.current) return;
     const buildingType = getSelectedBuildingType();

     if (selectedBuildingId && buildingType) {
        ghostRef.current.clear();

        if (selectedBuildingId === 'tool_dezone') {
             const cursor = new THREE.Mesh(
                 new THREE.BoxGeometry(TILE_SIZE, 5, TILE_SIZE),
                 new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5, wireframe: true })
             );
             cursor.position.y = 2.5;
             ghostRef.current.add(cursor);
        } else {
             // Pass currentVariant prop here
             const mesh = createProceduralBuilding(buildingType, currentVariant, true);
             ghostRef.current.add(mesh);
        }
        
        ghostRef.current.userData.typeId = selectedBuildingId;
        ghostRef.current.position.set(x, 2, z);
        ghostRef.current.visible = true;

        if (selectedBuildingId !== 'tool_dezone') {
            const isValid = !checkCollision(x, z, buildingType.width, buildingType.depth);
            ghostRef.current.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    (child.material as THREE.MeshStandardMaterial).color.set(isValid ? COLORS.SELECTION_VALID : COLORS.SELECTION_INVALID);
                }
            });
        }

     } else {
        ghostRef.current.visible = false;
     }
  }, [selectedBuildingId, getSelectedBuildingType, checkCollision, createProceduralBuilding, currentVariant]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!cameraRef.current || !sceneRef.current) return;
    mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);

    const terrain = sceneRef.current.getObjectByName('terrain');
    if (terrain) {
        const intersects = raycasterRef.current.intersectObject(terrain);
        if (intersects.length > 0) {
            const point = intersects[0].point;
            const riverZ = Math.sin(point.x * 0.005) * 80 + Math.sin(point.x * 0.015) * 30;
            const limit = MAP_SIZE / 2;
            
            if (point.x < -limit + 10 || point.x > limit - 10 || Math.abs(point.z - riverZ) < 35) {
                if (ghostRef.current) ghostRef.current.visible = false;
                return;
            }
            
            const snappedX = Math.round(point.x / TILE_SIZE) * TILE_SIZE;
            const snappedZ = Math.round(point.z / TILE_SIZE) * TILE_SIZE;
            updateGhost(snappedX, snappedZ);
            return;
        }
    }
    if (ghostRef.current) ghostRef.current.visible = false;
  }, [updateGhost]);

  const handleClick = useCallback(() => {
    if (!cameraRef.current || !sceneRef.current) return;

    const handleBuildingClick = () => {
         raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
         const intersects = raycasterRef.current.intersectObjects(buildingsGroupRef.current.children, true);
         let target = null;
         for(let hit of intersects) {
            let obj = hit.object;
            while(obj.parent && obj.parent !== buildingsGroupRef.current) {
                if(obj.userData.id) { target = obj; break; }
                obj = obj.parent;
            }
            if (obj.userData.id) target = obj;
            if (target) break;
         }
         return target;
    };

    if (isDemolishMode || selectedBuildingId === 'tool_dezone') {
        const target = handleBuildingClick();
        if (target && target.userData.id) {
            onRemoveBuilding(target.userData.id);
        }
        return;
    }

    if (ghostRef.current?.visible && selectedBuildingId) {
        // Placement Logic
        const bType = getSelectedBuildingType();
        if (!bType) return;
        const { x, z } = ghostRef.current.position;
        if (!checkCollision(x, z, bType.width, bType.depth)) {
            if (gameState.funds >= bType.cost) {
                onPlaceBuilding({
                    id: Math.random().toString(36).substr(2, 9),
                    typeId: selectedBuildingId,
                    x,
                    z,
                    rotation: 0,
                });
                onUpdateGameState({ funds: gameState.funds - bType.cost });
            } else {
                alert("Not enough Simoleons!");
            }
        }
    } else {
        // Inspection Mode (No tool selected)
        const target = handleBuildingClick();
        if (target && target.userData.id) {
            onInspectBuilding(target.userData.id);
        } else {
            // Clicked empty space
            onInspectBuilding(null);
        }
    }
  }, [isDemolishMode, selectedBuildingId, getSelectedBuildingType, checkCollision, gameState, onPlaceBuilding, onUpdateGameState, onRemoveBuilding, onInspectBuilding]);

  // Key Listeners
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.code === 'KeyC') {
              onVariantChange((currentVariant + 1) % 3);
          }
          if (e.code === 'Escape') {
              onDeselect();
              if (ghostRef.current) ghostRef.current.visible = false;
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onVariantChange, currentVariant, onDeselect]);

  // Ensure ghost updates when variant changes
  useEffect(() => {
      if (ghostRef.current && ghostRef.current.visible) {
          const { x, z } = ghostRef.current.position;
          updateGhost(x, z);
      }
  }, [currentVariant, updateGhost]);

  useEffect(() => {
    const canvas = rendererRef.current?.domElement;
    if (!canvas) return;
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);
    return () => {
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('click', handleClick);
    };
  }, [handleMouseMove, handleClick]);

  useEffect(() => {
    if (gridHelperRef.current) {
        (gridHelperRef.current.material as THREE.Material).opacity = selectedBuildingId ? 0.3 : 0;
    }
  }, [selectedBuildingId]);

  return <div ref={mountRef} className="absolute inset-0 z-0 bg-sky-300" />;
};

export default GameCanvas;