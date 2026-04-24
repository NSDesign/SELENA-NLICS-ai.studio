import * as PIXI from 'pixi.js';
import { createNoise2D } from 'simplex-noise';
import { NLICNode, ExportSettings, useStore } from './store';

// Helper: Generates a WebGL Texture from a gradient
const createGradientTexture = (
  color1: string, 
  color2: string, 
  type: 'Linear' | 'Radial' = 'Linear', 
  angle: number = 0,
  centerX: number = 0.5,
  centerY: number = 0.5,
  radius: number = 0.5
) => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    let grd;
    if (type === 'Linear') {
      const rad = (angle * Math.PI) / 180;
      const x1 = 128 - Math.cos(rad) * 128;
      const y1 = 128 - Math.sin(rad) * 128;
      const x2 = 128 + Math.cos(rad) * 128;
      const y2 = 128 + Math.sin(rad) * 128;
      grd = ctx.createLinearGradient(x1, y1, x2, y2);
    } else {
      grd = ctx.createRadialGradient(
        centerX * 256, centerY * 256, 0,
        centerX * 256, centerY * 256, radius * 256
      );
    }
    grd.addColorStop(0, color1);
    grd.addColorStop(1, color2);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 256, 256);
  }
  return PIXI.Texture.from(canvas);
};

// Helper: Generates a Turbulent Noise Texture
const createNoiseTexture = (
  scale: number = 0.1, 
  octaves: number = 4, 
  persistence: number = 0.5, 
  lacunarity: number = 2.0, 
  seed: number = 0.5
) => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  
  // Simple seedable random
  const seededRandom = () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };
  
  const noise2D = createNoise2D(seededRandom);

  if (ctx) {
    const imageData = ctx.createImageData(256, 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        let amplitude = 1;
        let frequency = scale;
        let noiseValue = 0;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
          noiseValue += amplitude * noise2D(x * frequency, y * frequency);
          maxValue += amplitude;
          amplitude *= persistence;
          frequency *= lacunarity;
        }

        const val = ((noiseValue / maxValue) + 1) * 0.5 * 255;
        const idx = (y * 256 + x) * 4;
        imageData.data[idx] = val;
        imageData.data[idx + 1] = val;
        imageData.data[idx + 2] = val;
        imageData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }
  return PIXI.Texture.from(canvas);
};

const getPixiBlendMode = (mode: string) => {
  switch (mode) {
    case 'Multiply': return PIXI.BLEND_MODES.MULTIPLY;
    case 'Screen': return PIXI.BLEND_MODES.SCREEN;
    case 'Add': return PIXI.BLEND_MODES.ADD;
    case 'Overlay': return PIXI.BLEND_MODES.OVERLAY;
    case 'Darken': return PIXI.BLEND_MODES.DARKEN;
    case 'Lighten': return PIXI.BLEND_MODES.LIGHTEN;
    case 'ColorDodge': return PIXI.BLEND_MODES.COLOR_DODGE;
    case 'ColorBurn': return PIXI.BLEND_MODES.COLOR_BURN;
    case 'HardLight': return PIXI.BLEND_MODES.HARD_LIGHT;
    case 'SoftLight': return PIXI.BLEND_MODES.SOFT_LIGHT;
    case 'Difference': return PIXI.BLEND_MODES.DIFFERENCE;
    case 'Exclusion': return PIXI.BLEND_MODES.EXCLUSION;
    case 'Hue': return PIXI.BLEND_MODES.HUE;
    case 'Saturation': return PIXI.BLEND_MODES.SATURATION;
    case 'Color': return PIXI.BLEND_MODES.COLOR;
    case 'Luminosity': return PIXI.BLEND_MODES.LUMINOSITY;
    case 'Normal':
    default: return PIXI.BLEND_MODES.NORMAL;
  }
};

const drawStar = (g: PIXI.Graphics, x: number, y: number, points: number, radius: number, innerRadius: number) => {
  const step = Math.PI / points;
  const path = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? radius : innerRadius;
    path.push(
      x + r * Math.cos(i * step - Math.PI / 2),
      y + r * Math.sin(i * step - Math.PI / 2)
    );
  }
  g.drawPolygon(path);
};

export const buildPixiTree = (nodeId: string, nodes: Record<string, NLICNode>): PIXI.Container | null => {
  const node = nodes[nodeId];
  if (!node || !node.enabled || node.type === 'MathOp') return null;

  const resolveParam = (id: string, name: string) => useStore.getState().resolveParam(id, name);

  const container = new PIXI.Container();
  const content = new PIXI.Container();
  container.addChild(content);

  const getChannelFilter = (channel: string) => {
    const f = new PIXI.filters.ColorMatrixFilter();
    const matrix: any = [
      channel === 'R' ? 1 : 0, 0, 0, 0, 0,
      channel === 'G' ? 1 : 0, 0, 0, 0, 0,
      channel === 'B' ? 1 : 0, 0, 0, 0, 0,
      channel === 'A' ? 1 : 0, 0, 0, 0, 0
    ];
    f.matrix = matrix;
    return f;
  };

  const processInput = (input: { nodeId: string | null, channel: string }) => {
    if (!input.nodeId) return null;
    const child = buildPixiTree(input.nodeId, nodes);
    if (child && input.channel !== 'RGBA') {
      child.filters = [...(child.filters || []), getChannelFilter(input.channel)];
    }
    return child;
  };

  const processPipeline = (target: PIXI.Container, pipeline?: any) => {
    if (!pipeline) return;

    // Apply Effects
    pipeline.effects.forEach((item: any) => {
      if (!item.enabled) return;
      let filter: PIXI.Filter | null = null;
      const opacity = resolveParamValue(item.opacity) / 100;

      if (item.subtype === 'Blur') {
        filter = new PIXI.filters.BlurFilter(resolveParamValue(item.params.blur) || 4);
      } else if (item.subtype === 'BrightnessContrast') {
        const f = new PIXI.filters.ColorMatrixFilter();
        f.brightness(resolveParamValue(item.params.brightness) !== undefined ? resolveParamValue(item.params.brightness) : 1, false);
        f.contrast(resolveParamValue(item.params.contrast) !== undefined ? resolveParamValue(item.params.contrast) : 1, false);
        filter = f;
      } else if (item.subtype === 'HueSaturation') {
        const f = new PIXI.filters.ColorMatrixFilter();
        f.hue(resolveParamValue(item.params.hue) || 0, false);
        f.saturate(resolveParamValue(item.params.saturation) || 0, false);
        filter = f;
      } else if (item.subtype === 'ChannelExtract') {
        filter = getChannelFilter(resolveParamValue(item.params.channel) || 'RGBA');
      } else if (item.subtype === 'NodeRef') {
        const refId = resolveParamValue(item.params.nodeId);
        if (refId) {
          const refTree = buildPixiTree(refId, nodes);
          if (refTree) {
            // How to apply a node as an effect? 
            // Pixi doesn't have a direct "node as filter" easily without custom shaders.
            // For now, we'll just skip it or maybe implement it as a mask if it's in the mask stack.
          }
        }
      }

      if (filter) {
        (filter as any).alpha = opacity;
        target.filters = [...(target.filters || []), filter];
      }
    });

    // Apply Masks
    pipeline.masks.forEach((item: any) => {
      if (!item.enabled) return;
      const opacity = resolveParamValue(item.opacity) / 100;
      const blendMode = resolveParamValue(item.blendMode);

      if (item.subtype === 'NodeRef') {
        const refId = resolveParamValue(item.params.nodeId);
        if (refId) {
          const maskTree = buildPixiTree(refId, nodes);
          if (maskTree) {
            maskTree.alpha = opacity;
            (maskTree as any).blendMode = getPixiBlendMode(blendMode);
            target.addChild(maskTree);
            target.mask = maskTree;
          }
        }
      }
    });
  };

  const resolveParamValue = (param: any) => useStore.getState().resolveParamValue(param);

  if (node.type === 'Generator') {
    const genType = resolveParam(nodeId, 'genType');
    const color = resolveParam(nodeId, 'color');
    const color2 = resolveParam(nodeId, 'color2');
    const shapeType = resolveParam(nodeId, 'shapeType');
    const imageUrl = resolveParam(nodeId, 'imageUrl');
    
    const x = resolveParam(nodeId, 'x') || 0;
    const y = resolveParam(nodeId, 'y') || 0;
    const width = resolveParam(nodeId, 'width') || 1920;
    const height = resolveParam(nodeId, 'height') || 1080;
    const rotation = (resolveParam(nodeId, 'rotation') || 0) * (Math.PI / 180);

    const hexColor = new PIXI.Color(color || '#ffffff').toNumber();

    if (genType === 'Solid') {
      const g = new PIXI.Graphics();
      g.beginFill(hexColor);
      g.drawRect(0, 0, width, height);
      g.endFill();
      g.position.set(x, y);
      g.rotation = rotation;
      content.addChild(g);
    } else if (genType === 'Shape') {
      const g = new PIXI.Graphics();
      const cornerRadius = resolveParam(nodeId, 'cornerRadius') || 0;
      g.beginFill(hexColor);
      if (shapeType === 'Circle') {
        g.drawCircle(width / 2, height / 2, Math.min(width, height) / 2);
      } else if (shapeType === 'Star') {
        const points = resolveParam(nodeId, 'points') || 5;
        const radius = resolveParam(nodeId, 'outerRadius') || Math.min(width, height) / 2;
        const innerRadius = resolveParam(nodeId, 'innerRadius') || radius / 2;
        drawStar(g, width / 2, height / 2, points, radius, innerRadius);
      } else if (shapeType === 'Polygon') {
        const sides = resolveParam(nodeId, 'sides') || 6;
        const size = Math.min(width, height) / 2;
        const points = [];
        for (let i = 0; i < sides; i++) {
          points.push(
            width / 2 + size * Math.cos(i * 2 * Math.PI / sides),
            height / 2 + size * Math.sin(i * 2 * Math.PI / sides)
          );
        }
        g.drawPolygon(points);
      } else {
        if (cornerRadius > 0) {
          g.drawRoundedRect(0, 0, width, height, cornerRadius);
        } else {
          g.drawRect(0, 0, width, height);
        }
      }
      g.endFill();
      g.position.set(x, y);
      g.rotation = rotation;
      content.addChild(g);
    } else if (genType === 'Gradient') {
      const gType = resolveParam(nodeId, 'gradientType') || 'Linear';
      const angle = resolveParam(nodeId, 'angle') || 0;
      const centerX = resolveParam(nodeId, 'centerX') ?? 0.5;
      const centerY = resolveParam(nodeId, 'centerY') ?? 0.5;
      const radius = resolveParam(nodeId, 'radius') ?? 0.5;

      const tex = createGradientTexture(color, color2 || '#000000', gType, angle, centerX, centerY, radius);
      const s = new PIXI.Sprite(tex);
      s.width = width;
      s.height = height;
      s.position.set(x, y);
      s.rotation = rotation;
      content.addChild(s);
    } else if (genType === 'Image' && imageUrl) {
      const s = PIXI.Sprite.from(imageUrl);
      s.width = width;
      s.height = height;
      s.position.set(x, y);
      s.rotation = rotation;
      content.addChild(s);
    } else if (genType === 'Noise') {
      const nScale = resolveParam(nodeId, 'noiseScale') ?? 0.1;
      const nOctaves = resolveParam(nodeId, 'noiseOctaves') ?? 4;
      const nPersistence = resolveParam(nodeId, 'noisePersistence') ?? 0.5;
      const nLacunarity = resolveParam(nodeId, 'noiseLacunarity') ?? 2.0;
      const nSeed = resolveParam(nodeId, 'noiseSeed') ?? 0.5;

      const tex = createNoiseTexture(nScale, nOctaves, nPersistence, nLacunarity, nSeed);
      const s = new PIXI.Sprite(tex);
      s.width = width;
      s.height = height;
      s.position.set(x, y);
      s.rotation = rotation;
      content.addChild(s);
    }
  } else if (node.type === 'CompOp') {
    const inputA = node.inputs['inputA'];
    const inputB = node.inputs['inputB'];
    const blendMode = resolveParam(nodeId, 'blendMode');
    const amount = resolveParam(nodeId, 'amount');
    
    const containerA = new PIXI.Container();
    const childA = processInput(inputA);
    if (childA) {
      containerA.addChild(childA);
      processPipeline(containerA, node.inputA_pipeline);
    }
    content.addChild(containerA);
    
    const containerB = new PIXI.Container();
    const childB = processInput(inputB);
    if (childB) {
      containerB.addChild(childB);
      processPipeline(containerB, node.inputB_pipeline);
      containerB.alpha = (amount !== undefined ? amount : 100) / 100;
      (containerB as any).blendMode = getPixiBlendMode(blendMode);
    }
    content.addChild(containerB);

    processPipeline(content, node.output_pipeline);
  } else if (node.type === 'LayerStack') {
    const input = node.inputs['input'];
    const child = processInput(input);
    if (child) {
      content.addChild(child);
      processPipeline(content, node.output_pipeline);
    }
  }

  return container;
};

export const exportProject = async (
  activeNodeId: string, 
  nodes: Record<string, NLICNode>, 
  settings: ExportSettings,
  onProgress: (p: number) => void
) => {
  const { width, height, dpi, bleed, showCropMarks } = settings;
  
  // Design resolution is 1920x1080
  // We scale this to fit the physical dimensions
  const designWidth = 1920;
  const designHeight = 1080;
  
  const physicalWidthPx = (width + bleed * 2) * dpi;
  const physicalHeightPx = (height + bleed * 2) * dpi;
  
  const scale = Math.max(physicalWidthPx / designWidth, physicalHeightPx / designHeight);
  
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = physicalWidthPx;
  finalCanvas.height = physicalHeightPx;
  const finalCtx = finalCanvas.getContext('2d')!;
  
  // Tiling settings
  const MAX_TILE_SIZE = 2048;
  const cols = Math.ceil(physicalWidthPx / MAX_TILE_SIZE);
  const rows = Math.ceil(physicalHeightPx / MAX_TILE_SIZE);
  const totalTiles = cols * rows;
  
  const renderer = new PIXI.Renderer({
    width: MAX_TILE_SIZE,
    height: MAX_TILE_SIZE,
    backgroundAlpha: 0,
    antialias: true,
    resolution: 1,
  });

  const root = buildPixiTree(activeNodeId, nodes);
  if (!root) return;

  // Center the design in the physical space
  const offsetX = (physicalWidthPx - designWidth * scale) / 2;
  const offsetY = (physicalHeightPx - designHeight * scale) / 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tileX = c * MAX_TILE_SIZE;
      const tileY = r * MAX_TILE_SIZE;
      const tileW = Math.min(MAX_TILE_SIZE, physicalWidthPx - tileX);
      const tileH = Math.min(MAX_TILE_SIZE, physicalHeightPx - tileY);
      
      renderer.resize(tileW, tileH);
      
      // Position the root container to render the correct tile
      root.scale.set(scale);
      root.position.set(offsetX - tileX, offsetY - tileY);
      
      renderer.render(root);
      
      finalCtx.drawImage(renderer.view as HTMLCanvasElement, tileX, tileY);
      
      onProgress(((r * cols + c + 1) / totalTiles) * 100);
      // Small delay to allow UI updates
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  // Draw Crop Marks
  if (showCropMarks) {
    const bleedPx = bleed * dpi;
    finalCtx.strokeStyle = '#000000';
    finalCtx.lineWidth = 2;
    const markSize = 20;

    // Top Left
    finalCtx.beginPath();
    finalCtx.moveTo(bleedPx, 0); finalCtx.lineTo(bleedPx, markSize);
    finalCtx.moveTo(0, bleedPx); finalCtx.lineTo(markSize, bleedPx);
    finalCtx.stroke();

    // Top Right
    finalCtx.beginPath();
    finalCtx.moveTo(physicalWidthPx - bleedPx, 0); finalCtx.lineTo(physicalWidthPx - bleedPx, markSize);
    finalCtx.moveTo(physicalWidthPx, bleedPx); finalCtx.lineTo(physicalWidthPx - markSize, bleedPx);
    finalCtx.stroke();

    // Bottom Left
    finalCtx.beginPath();
    finalCtx.moveTo(bleedPx, physicalHeightPx); finalCtx.lineTo(bleedPx, physicalHeightPx - markSize);
    finalCtx.moveTo(0, physicalHeightPx - bleedPx); finalCtx.lineTo(markSize, physicalHeightPx - bleedPx);
    finalCtx.stroke();

    // Bottom Right
    finalCtx.beginPath();
    finalCtx.moveTo(physicalWidthPx - bleedPx, physicalHeightPx); finalCtx.lineTo(physicalWidthPx - bleedPx, physicalHeightPx - markSize);
    finalCtx.moveTo(physicalWidthPx, physicalHeightPx - bleedPx); finalCtx.lineTo(physicalWidthPx - markSize, physicalHeightPx - bleedPx);
    finalCtx.stroke();
  }

  // Download
  const link = document.createElement('a');
  link.download = `selena-export-${Date.now()}.png`;
  link.href = finalCanvas.toDataURL('image/png');
  link.click();
  
  renderer.destroy(true);
};
