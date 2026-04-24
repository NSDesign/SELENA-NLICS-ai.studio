import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { createNoise2D } from 'simplex-noise';
import { Stage, Graphics, Sprite, Container } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { applyMixins, getBlendFilterArray } from '@pixi/picture';
import { useStore, NLICNode, Pipeline, StackItem } from './store';

applyMixins();
import { 
  Grid, Palette, Eye, EyeOff, Download
} from 'lucide-react';
import { ErrorBoundary } from './components/Common';

// Texture Cache to prevent memory leaks and flickering
const textureCache: Record<string, PIXI.Texture> = {};

const getCachedTexture = (key: string, creator: () => PIXI.Texture) => {
  if (textureCache[key]) return textureCache[key];
  const tex = creator();
  textureCache[key] = tex;
  return tex;
};

// Helper: Generates a WebGL Texture from a solid color using canvas pixels
const createSolidTexture = (color: string) => {
  const key = `solid_${color}`;
  return getCachedTexture(key, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
    }
    return PIXI.Texture.from(canvas);
  });
};

// Helper: Generates a WebGL Texture from a shape using canvas pixels (unused, kept but without JSON.stringify if it was used)
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
  const key = `grad_${color1}_${color2}_${type}_${angle}_${centerX}_${centerY}_${radius}`;
  return getCachedTexture(key, () => {
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
  });
};

// Helper: Generates a Turbulent Noise Texture
const createNoiseTexture = (
  scale: number = 0.1, 
  octaves: number = 4, 
  persistence: number = 0.5, 
  lacunarity: number = 2.0, 
  seed: number = 0.5
) => {
  const key = `noise_${scale}_${octaves}_${persistence}_${lacunarity}_${seed}`;
  return getCachedTexture(key, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    // Simple seedable random
    let s = seed;
    const seededRandom = () => {
      const x = Math.sin(s++) * 10000;
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
  });
};

// Helper mapping for our string modes to WebGL numeric Blend Modes
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
    case 'Xor': return PIXI.BLEND_MODES.XOR;
    case 'SourceIn': return PIXI.BLEND_MODES.SRC_IN;
    case 'SourceOut': return PIXI.BLEND_MODES.SRC_OUT;
    case 'SourceAtop': return PIXI.BLEND_MODES.SRC_ATOP;
    case 'DestinationOver': return PIXI.BLEND_MODES.DST_OVER;
    case 'DestinationIn': return PIXI.BLEND_MODES.DST_IN;
    case 'DestinationOut': return PIXI.BLEND_MODES.DST_OUT;
    case 'DestinationAtop': return PIXI.BLEND_MODES.DST_ATOP;
    case 'Normal':
    default: return PIXI.BLEND_MODES.NORMAL;
  }
};

const drawRoundedPolygon = (g: PIXI.Graphics, x: number, y: number, radius: number, sides: number, roundness: number) => {
  const step = (Math.PI * 2) / sides;
  const points = [];
  for (let i = 0; i < sides; i++) {
    const a = i * step - Math.PI / 2;
    points.push({ x: x + radius * Math.cos(a), y: y + radius * Math.sin(a) });
  }

  if (roundness <= 0) {
    g.drawPolygon(points.map(p => [p.x, p.y]).flat());
    return;
  }

  const mid = (p1: {x:number, y:number}, p2: {x:number, y:number}) => ({ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 });
  const start = mid(points[sides - 1], points[0]);
  g.moveTo(start.x, start.y);
  for (let i = 0; i < sides; i++) {
    const p = points[i];
    const next = mid(p, points[(i + 1) % sides]);
    g.arcTo(p.x, p.y, next.x, next.y, roundness);
  }
  g.closePath();
};

const drawStar = (g: PIXI.Graphics, x: number, y: number, points: number, radius: number, innerRadius: number, roundness: number = 0) => {
  const step = Math.PI / points;
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? radius : innerRadius;
    const a = i * step - Math.PI / 2;
    pts.push({ x: x + r * Math.cos(a), y: y + r * Math.sin(a) });
  }

  if (roundness <= 0) {
    g.drawPolygon(pts.map(p => [p.x, p.y]).flat());
    return;
  }

  const mid = (p1: {x:number, y:number}, p2: {x:number, y:number}) => ({ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 });
  const start = mid(pts[points * 2 - 1], pts[0]);
  g.moveTo(start.x, start.y);
  for (let i = 0; i < points * 2; i++) {
    const p = pts[i];
    const next = mid(p, pts[(i + 1) % (points * 2)]);
    g.arcTo(p.x, p.y, next.x, next.y, roundness);
  }
  g.closePath();
};

const LEVELS_FRAG = `
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uBlackIn;
uniform float uWhiteIn;
uniform float uGamma;
uniform float uBlackOut;
uniform float uWhiteOut;

void main(void) {
    vec4 color = texture2D(uSampler, vTextureCoord);
    if (color.a == 0.0) { gl_FragColor = vec4(0.0); return; }
    vec3 rgb = color.rgb / color.a;
    
    rgb = (rgb - uBlackIn) / (uWhiteIn - uBlackIn);
    rgb = clamp(rgb, 0.0, 1.0);
    rgb = pow(rgb, vec3(1.0 / uGamma));
    rgb = rgb * (uWhiteOut - uBlackOut) + uBlackOut;
    
    gl_FragColor = vec4(rgb * color.a, color.a);
}
`;

const CURVES_FRAG = `
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uPoints[5];

float getCurve(float x) {
    if (x <= 0.0) return uPoints[0];
    if (x >= 1.0) return uPoints[4];
    
    float p = x * 4.0;
    int i = int(p);
    float f = fract(p);
    
    if (i == 0) return mix(uPoints[0], uPoints[1], f);
    if (i == 1) return mix(uPoints[1], uPoints[2], f);
    if (i == 2) return mix(uPoints[2], uPoints[3], f);
    return mix(uPoints[3], uPoints[4], f);
}

void main(void) {
    vec4 color = texture2D(uSampler, vTextureCoord);
    if (color.a == 0.0) { gl_FragColor = vec4(0.0); return; }
    vec3 rgb = color.rgb / color.a;
    
    rgb.r = getCurve(rgb.r);
    rgb.g = getCurve(rgb.g);
    rgb.b = getCurve(rgb.b);
    
    gl_FragColor = vec4(rgb * color.a, color.a);
}
`;

const MaskItemRenderer: React.FC<{ 
  mask: StackItem, 
  nodeId: string, 
  pipelineKey: string, 
  itemPath: string[],
  engineRef: React.MutableRefObject<any>, 
  visited: string[], 
  depth: number 
}> = ({ mask, nodeId, pipelineKey, itemPath, engineRef, visited, depth }) => {
  const resolveStackParam = useStore(state => state.resolveStackParam);
  const engineVersion = useStore(state => state.engineVersion);
  
  if (mask.subtype === 'NodeRef') {
    const targetNodeId = resolveStackParam(nodeId, pipelineKey, itemPath, 'nodeId');
    if (!targetNodeId) return null;
    // Flattening: remove extra Container wrapper
    return <NodeRenderer nodeId={targetNodeId as string} engineRef={engineRef} visited={visited} depth={depth + 1} isMask={true} />;
  }
  
  if (mask.subtype === 'Shape') {
    const shapeType = resolveStackParam(nodeId, pipelineKey, itemPath, 'shapeType') ?? 'Rectangle';
    const width = resolveStackParam(nodeId, pipelineKey, itemPath, 'width') ?? 400;
    const height = resolveStackParam(nodeId, pipelineKey, itemPath, 'height') ?? 400;
    const roundness = resolveStackParam(nodeId, pipelineKey, itemPath, 'roundness') ?? 0;
    
    return (
      <Graphics draw={(g) => {
        g.clear();
        g.beginFill(0xffffff);
        if (shapeType === 'Circle') {
          g.drawCircle(width / 2, height / 2, Math.min(width, height) / 2);
        } else if (shapeType === 'Star') {
          const points = resolveStackParam(nodeId, pipelineKey, itemPath, 'points') ?? 5;
          const radius = resolveStackParam(nodeId, pipelineKey, itemPath, 'outerRadius') ?? Math.min(width, height) / 2;
          const innerRadius = resolveStackParam(nodeId, pipelineKey, itemPath, 'innerRadius') ?? radius / 2;
          drawStar(g, width / 2, height / 2, points, radius, innerRadius, roundness);
        } else if (shapeType === 'Polygon') {
          const sides = resolveStackParam(nodeId, pipelineKey, itemPath, 'sides') ?? 6;
          const radius = Math.min(width, height) / 2;
          drawRoundedPolygon(g, width / 2, height / 2, radius, sides, roundness);
        } else {
          // Rectangle / Square
          const cr = resolveStackParam(nodeId, pipelineKey, itemPath, 'cornerRadius') ?? 0;
          if (cr > 0) {
            g.drawRoundedRect(0, 0, width, height, cr);
          } else {
            g.drawRect(0, 0, width, height);
          }
        }
        g.endFill();
      }} />
    );
  }
  
  return null;
};

const EffectRenderer: React.FC<{
  effect: StackItem;
  nodeId: string;
  pipelineKey: string;
  itemPath: string[];
  engineRef: React.MutableRefObject<any>;
  children: React.ReactNode;
  visited: string[];
  depth: number;
}> = ({ effect, nodeId, pipelineKey, itemPath, engineRef, children, visited, depth }) => {
  const resolveStackParam = useStore(state => state.resolveStackParam);
  const engineVersion = useStore(state => state.engineVersion);
  
  const opacity = (resolveStackParam(nodeId, pipelineKey, itemPath, 'opacity') ?? 100) / 100;
  const blendMode = getPixiBlendMode(resolveStackParam(nodeId, pipelineKey, itemPath, 'blendMode') || 'Normal');

  const filter = useMemo(() => {
    if (effect.subtype === 'Transform') return null; // Handled via Container props
    const effectType = effect.subtype;
    try {
      if (effectType === 'Blur') {
        const BlurFilter = (PIXI as any).BlurFilter || (PIXI.filters as any).BlurFilter;
        if (!BlurFilter) return null;
        return new BlurFilter(resolveStackParam(nodeId, pipelineKey, itemPath, 'blur') ?? 4);
      }
      if (effectType === 'BrightnessContrast') {
        const ColorMatrixFilter = (PIXI as any).ColorMatrixFilter || (PIXI.filters as any).ColorMatrixFilter;
        if (!ColorMatrixFilter) return null;
        const f = new ColorMatrixFilter();
        f.brightness(resolveStackParam(nodeId, pipelineKey, itemPath, 'brightness') ?? 1, false);
        f.contrast(resolveStackParam(nodeId, pipelineKey, itemPath, 'contrast') ?? 1, true);
        return f;
      }
      if (effectType === 'HueSaturation') {
        const ColorMatrixFilter = (PIXI as any).ColorMatrixFilter || (PIXI.filters as any).ColorMatrixFilter;
        if (!ColorMatrixFilter) return null;
        const f = new ColorMatrixFilter();
        const hueVal = resolveStackParam(nodeId, pipelineKey, itemPath, 'hue') ?? 0;
        const satVal = resolveStackParam(nodeId, pipelineKey, itemPath, 'saturation') ?? 0;
        f.hue(hueVal, false);
        // PixiJS saturate: 1 is no change, 0 is grayscale. Our saturation is -1 to 1 (0 is no change).
        f.saturate(satVal + 1, true);
        return f;
      }
      if (effectType === 'ChannelExtract') {
        const channel = resolveStackParam(nodeId, pipelineKey, itemPath, 'channel') || 'RGBA';
        const ColorMatrixFilter = (PIXI as any).ColorMatrixFilter || (PIXI.filters as any).ColorMatrixFilter;
        if (!ColorMatrixFilter) return null;
        const f = new ColorMatrixFilter();
        let matrix: any;
        if (channel === 'RGBA') {
          matrix = [
            1, 0, 0, 0, 0,
            0, 1, 0, 0, 0,
            0, 0, 1, 0, 0,
            0, 0, 0, 1, 0
          ];
        } else if (channel === 'R') {
          matrix = [
            1, 0, 0, 0, 0,
            0, 0, 0, 0, 0,
            0, 0, 0, 0, 0,
            0, 0, 0, 1, 0
          ];
        } else if (channel === 'G') {
          matrix = [
            0, 0, 0, 0, 0,
            0, 1, 0, 0, 0,
            0, 0, 0, 0, 0,
            0, 0, 0, 1, 0
          ];
        } else if (channel === 'B') {
          matrix = [
            0, 0, 0, 0, 0,
            0, 0, 0, 0, 0,
            0, 0, 1, 0, 0,
            0, 0, 0, 1, 0
          ];
        } else if (channel === 'A') {
          matrix = [
            0, 0, 0, 1, 0,
            0, 0, 0, 1, 0,
            0, 0, 0, 1, 0,
            0, 0, 0, 1, 0
          ];
        }
        f.matrix = matrix;
        return f;
      }
      if (effectType === 'Invert') {
        const ColorMatrixFilter = (PIXI as any).ColorMatrixFilter || (PIXI.filters as any).ColorMatrixFilter;
        if (!ColorMatrixFilter) return null;
        const f = new ColorMatrixFilter();
        f.negative();
        return f;
      }
      if (effectType === 'Levels') {
        const f = new PIXI.Filter(undefined, LEVELS_FRAG, {
          uBlackIn: resolveStackParam(nodeId, pipelineKey, itemPath, 'blackIn') ?? 0,
          uWhiteIn: resolveStackParam(nodeId, pipelineKey, itemPath, 'whiteIn') ?? 1,
          uGamma: resolveStackParam(nodeId, pipelineKey, itemPath, 'gamma') ?? 1,
          uBlackOut: resolveStackParam(nodeId, pipelineKey, itemPath, 'blackOut') ?? 0,
          uWhiteOut: resolveStackParam(nodeId, pipelineKey, itemPath, 'whiteOut') ?? 1,
        });
        return f;
      }
      if (effectType === 'Curves') {
        const f = new PIXI.Filter(undefined, CURVES_FRAG, {
          uPoints: [
            resolveStackParam(nodeId, pipelineKey, itemPath, 'p0') ?? 0,
            resolveStackParam(nodeId, pipelineKey, itemPath, 'p1') ?? 0.25,
            resolveStackParam(nodeId, pipelineKey, itemPath, 'p2') ?? 0.5,
            resolveStackParam(nodeId, pipelineKey, itemPath, 'p3') ?? 0.75,
            resolveStackParam(nodeId, pipelineKey, itemPath, 'p4') ?? 1.0,
          ]
        });
        return f;
      }
    } catch (e) {
      console.error(`Error creating filter ${effectType}:`, e instanceof Error ? e.message : String(e));
    }
    return null;
  }, [effect.subtype, nodeId, pipelineKey, itemPath, engineVersion]);

  const transformProps = useMemo(() => {
    if (effect.subtype !== 'Transform') return {};
    return {
      x: resolveStackParam(nodeId, pipelineKey, itemPath, 'translateX') ?? 0,
      y: resolveStackParam(nodeId, pipelineKey, itemPath, 'translateY') ?? 0,
      scale: {
        x: resolveStackParam(nodeId, pipelineKey, itemPath, 'scaleX') ?? 1,
        y: resolveStackParam(nodeId, pipelineKey, itemPath, 'scaleY') ?? 1
      },
      rotation: (resolveStackParam(nodeId, pipelineKey, itemPath, 'rotation') ?? 0) * (Math.PI / 180),
      skew: {
        x: (resolveStackParam(nodeId, pipelineKey, itemPath, 'skewX') ?? 0) * (Math.PI / 180),
        y: (resolveStackParam(nodeId, pipelineKey, itemPath, 'skewY') ?? 0) * (Math.PI / 180)
      }
    };
  }, [effect.subtype, nodeId, pipelineKey, itemPath, engineVersion]);

  const hasEnabledMasks = effect.masks && effect.masks.some(m => m.enabled);

  const blendFilterArray = useMemo(() => getBlendFilterArray(blendMode), [blendMode]);
  const containerBlendMode = blendFilterArray ? PIXI.BLEND_MODES.NORMAL : blendMode;

  return (
    <Container
      alpha={opacity}
      x={transformProps.x}
      y={transformProps.y}
      scale={transformProps.scale}
      rotation={transformProps.rotation}
      skew={transformProps.skew}
    >
      {/* Base layer - only rendered if we are masking the effect over it */}
      {hasEnabledMasks && children}
      
      <Container blendMode={containerBlendMode} filters={blendFilterArray || undefined}>
        <MaskStackRenderer 
          masks={effect.masks || []} 
          nodeId={nodeId} 
          pipelineKey={pipelineKey} 
          parentPath={itemPath}
          engineRef={engineRef}
          visited={visited}
          depth={depth + 1}
        >
          <Container filters={filter ? [filter] : undefined}>
            {children}
          </Container>
        </MaskStackRenderer>
      </Container>
    </Container>
  );
};

const EffectStackRenderer: React.FC<{
  effects: StackItem[];
  nodeId: string;
  pipelineKey: string;
  parentPath: string[];
  engineRef: React.MutableRefObject<any>;
  children: React.ReactNode;
  visited: string[];
  depth: number;
}> = ({ effects, nodeId, pipelineKey, parentPath, engineRef, children, visited, depth }) => {
  return effects.reduceRight((acc, effect) => {
    if (!effect.enabled) return acc;
    return (
      <EffectRenderer 
        key={effect.id}
        effect={effect} 
        nodeId={nodeId} 
        pipelineKey={pipelineKey} 
        itemPath={[...parentPath, 'effects', effect.id]}
        engineRef={engineRef}
        visited={visited}
        depth={depth}
      >
        {acc}
      </EffectRenderer>
    );
  }, children);
};

const MaskRenderer: React.FC<{
  mask: StackItem;
  nodeId: string;
  pipelineKey: string;
  itemPath: string[];
  engineRef: React.MutableRefObject<any>;
  visited: string[];
  depth: number;
}> = ({ mask, nodeId, pipelineKey, itemPath, engineRef, visited, depth }) => {
  const resolveStackParam = useStore(state => state.resolveStackParam);
  const opacity = (resolveStackParam(nodeId, pipelineKey, itemPath, 'opacity') ?? 100) / 100;
  const blendMode = getPixiBlendMode(resolveStackParam(nodeId, pipelineKey, itemPath, 'blendMode') || 'Normal');

  const blendFilterArray = useMemo(() => getBlendFilterArray(blendMode), [blendMode]);
  const containerBlendMode = blendFilterArray ? PIXI.BLEND_MODES.NORMAL : blendMode;

  return (
    <Container alpha={opacity} blendMode={containerBlendMode} filters={blendFilterArray || undefined}>
      <EffectStackRenderer 
        effects={mask.effects || []}
        nodeId={nodeId}
        pipelineKey={pipelineKey}
        parentPath={itemPath}
        engineRef={engineRef}
        visited={visited}
        depth={depth + 1}
      >
        <MaskItemRenderer 
          mask={mask} 
          nodeId={nodeId} 
          pipelineKey={pipelineKey} 
          itemPath={itemPath}
          engineRef={engineRef} 
          visited={visited} 
          depth={depth} 
        />
      </EffectStackRenderer>
    </Container>
  );
};

const MaskStackRenderer: React.FC<{
  masks: StackItem[];
  nodeId: string;
  pipelineKey: string;
  parentPath: string[];
  engineRef: React.MutableRefObject<any>;
  children: React.ReactNode;
  visited: string[];
  depth: number;
}> = ({ masks, nodeId, pipelineKey, parentPath, engineRef, children, visited, depth }) => {
  const hasEnabledMasks = masks && masks.some(m => m.enabled);

  const isolationFilter = useMemo(() => {
    const FilterClass = (PIXI as any).AlphaFilter || (PIXI.filters as any).AlphaFilter;
    return FilterClass ? [new FilterClass()] : [];
  }, []);

  const maskIsolationFilter = useMemo(() => {
    const FilterClass = (PIXI as any).AlphaFilter || (PIXI.filters as any).AlphaFilter;
    return FilterClass ? [new FilterClass()] : [];
  }, []);

  if (!hasEnabledMasks) {
    return <>{children}</>;
  }

  return (
    <Container filters={isolationFilter}>
      {children}
      <Container blendMode={PIXI.BLEND_MODES.DST_IN} filters={maskIsolationFilter}>
        {masks.filter(m => m.enabled).map(mask => (
          <MaskRenderer 
             key={mask.id}
             mask={mask}
             nodeId={nodeId}
             pipelineKey={pipelineKey}
             itemPath={[...parentPath, 'masks', mask.id]}
             engineRef={engineRef}
             visited={visited}
             depth={depth + 1}
          />
        ))}
      </Container>
    </Container>
  );
};

export const PipelineRenderer: React.FC<{ 
  pipeline?: Pipeline; 
  nodeId: string; 
  pipelineKey: string; 
  engineRef: React.MutableRefObject<any>;
  children: React.ReactNode;
  visited: string[];
  depth: number;
}> = ({ pipeline, nodeId, pipelineKey, engineRef, children, visited, depth }) => {
  if (!pipeline) return <>{children}</>;

  return (
    <MaskStackRenderer 
      masks={pipeline.masks} 
      nodeId={nodeId} 
      pipelineKey={pipelineKey} 
      parentPath={[]}
      engineRef={engineRef}
      visited={visited}
      depth={depth + 1}
    >
      <EffectStackRenderer 
        effects={pipeline.effects}
        nodeId={nodeId}
        pipelineKey={pipelineKey}
        parentPath={[]}
        engineRef={engineRef}
        visited={visited}
        depth={depth + 1}
      >
        {children}
      </EffectStackRenderer>
    </MaskStackRenderer>
  );
};

const ChannelFilter: React.FC<{ channel: string, children: React.ReactNode }> = ({ channel, children }) => {
  const filter = useMemo(() => {
    const ColorMatrixFilter = (PIXI as any).ColorMatrixFilter || (PIXI.filters as any).ColorMatrixFilter;
    if (!ColorMatrixFilter) return null;
    const f = new ColorMatrixFilter();
    const c = channel;
    // Matrix to extract channel and put it into R, G, B with A=1 or keep A
    const matrix: any = [
      c === 'R' ? 1 : 0, c === 'G' ? 1 : 0, c === 'B' ? 1 : 0, c === 'A' ? 1 : 0, 0,
      c === 'R' ? 1 : 0, c === 'G' ? 1 : 0, c === 'B' ? 1 : 0, c === 'A' ? 1 : 0, 0,
      c === 'R' ? 1 : 0, c === 'G' ? 1 : 0, c === 'B' ? 1 : 0, c === 'A' ? 1 : 0, 0,
      0, 0, 0, 1, 0
    ];
    f.matrix = matrix;
    return f;
  }, [channel]);

  if (!filter) return <>{children}</>;

  return <Container filters={[filter]}>{children}</Container>;
};

const GeneratorRenderer: React.FC<{ 
  nodeId: string, 
  engineRef: React.MutableRefObject<any>, 
  newVisited: string[], 
  depth: number 
}> = ({ nodeId, engineRef, newVisited, depth }) => {
  const resolveParam = useStore(state => state.resolveParam);
  const [textureLoaded, setTextureLoaded] = useState(0);

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

  const hexColor = useMemo(() => {
    try {
      if ((PIXI as any).Color) {
        return new (PIXI as any).Color(color || '#ffffff').toNumber();
      }
      // Fallback for older Pixi or if Color is missing
      return parseInt((color || '#ffffff').replace('#', ''), 16);
    } catch (e) {
      return 0xffffff;
    }
  }, [color]);

  const tex = useMemo(() => {
    if (genType !== 'Image' || !imageUrl) return null;
    try {
      return PIXI.Texture.from(imageUrl);
    } catch (e) {
      console.error('Error loading texture:', e instanceof Error ? e.message : String(e));
      return PIXI.Texture.EMPTY;
    }
  }, [genType, imageUrl]);

  useEffect(() => {
    if (tex && !tex.baseTexture.valid) {
      const onLoaded = () => setTextureLoaded(v => v + 1);
      tex.baseTexture.once('loaded', onLoaded);
      return () => {
        tex.baseTexture.off('loaded', onLoaded);
      };
    }
  }, [tex]);

  if (genType === 'Solid') {
    return <Sprite texture={PIXI.Texture.WHITE} tint={hexColor} x={x} y={y} width={width} height={height} rotation={rotation} />;
  }

  if (genType === 'Shape') {
    return (
      <Graphics 
        x={x} y={y} rotation={rotation}
        draw={(g) => {
          g.clear();
          g.beginFill(hexColor);
          if (shapeType === 'Circle') {
            g.drawCircle(width / 2, height / 2, Math.min(width, height) / 2);
          } else if (shapeType === 'Star') {
            const points = resolveParam(nodeId, 'points') || 5;
            const radius = resolveParam(nodeId, 'outerRadius') || Math.min(width, height) / 2;
            const innerRadius = resolveParam(nodeId, 'innerRadius') || radius / 2;
            const roundness = resolveParam(nodeId, 'roundness') || 0;
            drawStar(g, width / 2, height / 2, points, radius, innerRadius, roundness);
          } else if (shapeType === 'Polygon') {
            const sides = resolveParam(nodeId, 'sides') || 6;
            const radius = Math.min(width, height) / 2;
            const roundness = resolveParam(nodeId, 'roundness') || 0;
            drawRoundedPolygon(g, width / 2, height / 2, radius, sides, roundness);
          } else {
            // Rectangle
            const cr = resolveParam(nodeId, 'cornerRadius') || 0;
            if (cr > 0) {
              g.drawRoundedRect(0, 0, width, height, cr);
            } else {
              g.drawRect(0, 0, width, height);
            }
          }
          g.endFill();
        }} 
      />
    );
  }

  if (genType === 'Gradient') {
    const gType = resolveParam(nodeId, 'gradientType') || 'Linear';
    const angle = resolveParam(nodeId, 'angle') || 0;
    const centerX = resolveParam(nodeId, 'centerX') ?? 0.5;
    const centerY = resolveParam(nodeId, 'centerY') ?? 0.5;
    const radius = resolveParam(nodeId, 'radius') ?? 0.5;
    const texGrad = createGradientTexture(color, color2 || '#000000', gType, angle, centerX, centerY, radius);
    return <Sprite texture={texGrad} x={x} y={y} width={width} height={height} rotation={rotation} />;
  }

  if (genType === 'Image' && tex) {
    const fitMode = resolveParam(nodeId, 'fitMode') || 'Cover';
    let spriteWidth = width;
    let spriteHeight = height;
    let anchorX = 0;
    let anchorY = 0;

    if (tex.baseTexture.valid) {
      const imgW = tex.width;
      const imgH = tex.height;
      const targetRatio = width / height;
      const imgRatio = imgW / imgH;

      if (fitMode === 'Cover') {
        if (imgRatio > targetRatio) {
          spriteHeight = height;
          spriteWidth = height * imgRatio;
          anchorX = (spriteWidth - width) / 2 / spriteWidth;
        } else {
          spriteWidth = width;
          spriteHeight = width / imgRatio;
          anchorY = (spriteHeight - height) / 2 / spriteHeight;
        }
      } else if (fitMode === 'Contain') {
        if (imgRatio > targetRatio) {
          spriteWidth = width;
          spriteHeight = width / imgRatio;
          anchorY = -(height - spriteHeight) / 2 / spriteHeight;
        } else {
          spriteHeight = height;
          spriteWidth = height * imgRatio;
          anchorX = -(width - spriteWidth) / 2 / spriteWidth;
        }
      }
    }

    return (
      <Container x={x} y={y} rotation={rotation}>
        <Sprite 
          texture={tex} 
          width={spriteWidth} 
          height={spriteHeight} 
          anchor={new PIXI.Point(anchorX, anchorY)}
        />
      </Container>
    );
  }

  if (genType === 'Noise') {
    const nScale = resolveParam(nodeId, 'noiseScale') ?? 0.1;
    const nOctaves = resolveParam(nodeId, 'noiseOctaves') ?? 4;
    const nPersistence = resolveParam(nodeId, 'noisePersistence') ?? 0.5;
    const nLacunarity = resolveParam(nodeId, 'noiseLacunarity') ?? 2.0;
    const nSeed = resolveParam(nodeId, 'noiseSeed') ?? 0.5;
    const texNoise = createNoiseTexture(nScale, nOctaves, nPersistence, nLacunarity, nSeed);
    return <Sprite texture={texNoise} x={x} y={y} width={width} height={height} rotation={rotation} />;
  }

  return null;
};

type InjectedStack = {
  port: 'inputA' | 'inputB' | 'output';
  stackType: 'effects' | 'masks';
  pipeline: Pipeline;
};

const CompOpRenderer: React.FC<{ 
  nodeId: string, 
  engineRef: React.MutableRefObject<any>, 
  newVisited: string[], 
  depth: number,
  injectedStack?: InjectedStack
}> = ({ nodeId, engineRef, newVisited, depth, injectedStack }) => {
  const node = useStore(state => state.nodes[nodeId]);
  const resolveParam = useStore(state => state.resolveParam);
  
  if (!node) return null;

  const inputA = node.inputs?.['inputA'];
  const inputB = node.inputs?.['inputB'];
  const blendMode = resolveParam(nodeId, 'blendMode');
  const amount = resolveParam(nodeId, 'amount');
  const opacityA = resolveParam(nodeId, 'opacityA') ?? 100;
  const opacityB = resolveParam(nodeId, 'opacityB') ?? 100;
  const swapInputs = resolveParam(nodeId, 'swapInputs') ?? false;
  
  const alphaA = opacityA / 100;
  const alphaB = opacityB / 100;
  const blendAlpha = (amount !== undefined ? amount : 100) / 100;
  const pixiBlendMode = getPixiBlendMode(blendMode);

  const isolationFilterA = useMemo(() => {
    const FilterClass = (PIXI as any).ColorMatrixFilter || (PIXI.filters as any).ColorMatrixFilter || (PIXI as any).AlphaFilter || (PIXI.filters as any).AlphaFilter;
    return FilterClass ? [new FilterClass()] : [];
  }, []);

  const blendFilterArray = useMemo(() => getBlendFilterArray(pixiBlendMode), [pixiBlendMode]);
  const containerBlendMode = blendFilterArray ? PIXI.BLEND_MODES.NORMAL : pixiBlendMode;

  const processInput = (input: { nodeId: string | null, channel: string }) => {
    if (!input.nodeId) return null;
    
    const rendered = <NodeRenderer nodeId={input.nodeId} engineRef={engineRef} visited={newVisited} depth={depth + 1} />;
    
    if (input.channel !== 'RGBA') {
      return <ChannelFilter channel={input.channel}>{rendered}</ChannelFilter>;
    }
    return rendered;
  };

  const baseInput = swapInputs ? inputB : inputA;
  const topInput = swapInputs ? inputA : inputB;
  let basePipeline = swapInputs ? node.inputB_pipeline : node.inputA_pipeline;
  let topPipeline = swapInputs ? node.inputA_pipeline : node.inputB_pipeline;
  let outputPipeline = node.output_pipeline;

  if (injectedStack) {
    const applyInjection = (pipeline: Pipeline, port: string) => {
      if (injectedStack.port === port) {
        return {
          ...pipeline,
          [injectedStack.stackType]: [
            ...pipeline[injectedStack.stackType],
            ...injectedStack.pipeline[injectedStack.stackType]
          ]
        };
      }
      return pipeline;
    };

    basePipeline = applyInjection(basePipeline, swapInputs ? 'inputB' : 'inputA');
    topPipeline = applyInjection(topPipeline, swapInputs ? 'inputA' : 'inputB');
    outputPipeline = applyInjection(outputPipeline, 'output');
  }

  const baseAlpha = swapInputs ? alphaB : alphaA;
  const topAlpha = swapInputs ? alphaA : alphaB;

  return (
    <PipelineRenderer pipeline={outputPipeline} nodeId={nodeId} pipelineKey="output_pipeline" engineRef={engineRef} visited={newVisited} depth={depth + 1}>
      <Container filters={isolationFilterA}>
        <Container alpha={baseAlpha}>
          <PipelineRenderer pipeline={basePipeline} nodeId={nodeId} pipelineKey={swapInputs ? "inputB_pipeline" : "inputA_pipeline"} engineRef={engineRef} visited={newVisited} depth={depth + 1}>
            {baseInput?.nodeId && processInput(baseInput)}
          </PipelineRenderer>
        </Container>
        <Container 
          alpha={topAlpha * blendAlpha}
          blendMode={containerBlendMode}
          filters={blendFilterArray || undefined}
        >
          <PipelineRenderer pipeline={topPipeline} nodeId={nodeId} pipelineKey={swapInputs ? "inputA_pipeline" : "inputB_pipeline"} engineRef={engineRef} visited={newVisited} depth={depth + 1}>
            {topInput?.nodeId && processInput(topInput)}
          </PipelineRenderer>
        </Container>
      </Container>
    </PipelineRenderer>
  );
};

// Improve rendering quality
PIXI.settings.ROUND_PIXELS = false;
PIXI.settings.PRECISION_FRAGMENT = PIXI.PRECISION.HIGH;

export const NodeRenderer: React.FC<{ 
  nodeId: string, 
  engineRef: React.MutableRefObject<any>,
  visited?: string[],
  depth?: number,
  isMask?: boolean,
  injectedStack?: InjectedStack
}> = React.memo(({ nodeId, engineRef, visited = [], depth = 0, isMask = false, injectedStack }) => {
  const node = useStore(state => state.nodes[nodeId]);
  const resolveParam = useStore(state => state.resolveParam);
  
  // Cycle detection and depth limit
  if (!node || visited.includes(nodeId) || depth > 32) {
    return null;
  }
  const newVisited = [...visited, nodeId];

  if (!node.enabled || node.type === 'MathOp') return null;

  const processInput = (input: { nodeId: string | null, channel: string }) => {
    if (!input.nodeId) return null;
    
    const rendered = <NodeRenderer nodeId={input.nodeId} engineRef={engineRef} visited={newVisited} depth={depth + 1} />;
    
    if (input.channel !== 'RGBA') {
      return <ChannelFilter channel={input.channel}>{rendered}</ChannelFilter>;
    }
    return rendered;
  };

  const renderContent = () => {
    if (node.type === 'Generator') {
      const content = <GeneratorRenderer nodeId={nodeId} engineRef={engineRef} newVisited={newVisited} depth={depth} />;
      // If it's a mask, we skip the generator's own pipeline to avoid recursion issues
      // and because masks are usually simple shapes.
      if (isMask) return content;
      
      return (
        <PipelineRenderer pipeline={node.output_pipeline} nodeId={nodeId} pipelineKey="output_pipeline" engineRef={engineRef} visited={newVisited} depth={depth + 1}>
          {content}
        </PipelineRenderer>
      );
    }

    if (node.type === 'CompOp') {
      return <CompOpRenderer nodeId={nodeId} engineRef={engineRef} newVisited={newVisited} depth={depth} injectedStack={injectedStack} />;
    }

    if (node.type === 'LayerStack') {
      const input = node.inputs?.['input'];
      const targetPort = resolveParam(nodeId, 'targetPort');
      const targetStack = resolveParam(nodeId, 'targetStack');
      
      if (input?.nodeId) {
        const inputNode = useStore.getState().nodes[input.nodeId];
        if (inputNode?.type === 'CompOp' && targetPort && targetStack) {
           return <NodeRenderer nodeId={input.nodeId} engineRef={engineRef} visited={newVisited} depth={depth + 1} injectedStack={{
             port: targetPort,
             stackType: targetStack,
             pipeline: node.output_pipeline
           }} />;
        } else {
           return (
             <PipelineRenderer pipeline={node.output_pipeline} nodeId={nodeId} pipelineKey="output_pipeline" engineRef={engineRef} visited={newVisited} depth={depth + 1}>
               {processInput(input)}
             </PipelineRenderer>
           );
        }
      }
      return null;
    }
    return null;
  };

  return isMask ? renderContent() : (
    <Container>
      {renderContent()}
    </Container>
  );
});

const CanvasEngine: React.FC = () => {
  const { nodes, activePreviewId, previewSettings, engineVersion, autoAdjustRequest, updatePreviewSettings, toggleChannel, toggleAllChannels, autoAdjustEffect, clearAutoAdjustRequest } = useStore();

  const engineRef = useRef({ nodes, engineVersion });
  const appRef = useRef<PIXI.Application | null>(null);
  const [renderVersion, setRenderVersion] = useState(0);

  useEffect(() => {
    if (autoAdjustRequest && appRef.current) {
      const { nodeId, pipelineKey, itemPath, subtype } = autoAdjustRequest;
      
      const runAuto = async () => {
        try {
          // Extract pixels from the current renderer
          // Note: This extracts from the whole canvas.
          const pixels = appRef.current!.renderer.extract.pixels() as Uint8Array;
          
          let min = 255;
          let max = 0;
          let total = 0;
          let count = 0;

          // Sample pixels (every 10th to save time)
          for (let i = 0; i < pixels.length; i += 40) {
            const r = pixels[i];
            const g = pixels[i+1];
            const b = pixels[i+2];
            const a = pixels[i+3];
            if (a > 10) { // Only count non-transparent pixels
              const lum = (r * 0.299 + g * 0.587 + b * 0.114);
              if (lum < min) min = lum;
              if (lum > max) max = lum;
              total += lum;
              count++;
            }
          }

          if (count > 0) {
            const avg = total / count;
            // Simple auto-levels: stretch min-max to 0-1
            // And adjust gamma based on average
            const blackIn = Math.max(0, (min - 5) / 255);
            const whiteIn = Math.min(1, (max + 5) / 255);
            const gamma = Math.log(0.5) / Math.log((avg / 255 - blackIn) / (whiteIn - blackIn));
            const safeGamma = isFinite(gamma) ? Math.max(0.1, Math.min(5, gamma)) : 1.0;
            
            if (subtype === 'Levels') {
              autoAdjustEffect(nodeId, pipelineKey, itemPath, {
                blackIn,
                whiteIn,
                gamma: safeGamma,
                autoActive: true // Flag to indicate auto was applied
              });
            } else if (subtype === 'Curves') {
              // Map min/max/gamma to curve points
              // p0 is black point, p4 is white point
              // p2 is midtone (gamma)
              autoAdjustEffect(nodeId, pipelineKey, itemPath, {
                p0: blackIn,
                p1: blackIn + (whiteIn - blackIn) * 0.25 * (1/safeGamma),
                p2: blackIn + (whiteIn - blackIn) * 0.5 * (1/safeGamma),
                p3: blackIn + (whiteIn - blackIn) * 0.75 * (1/safeGamma),
                p4: whiteIn,
                autoActive: true
              });
            }
          }
        } catch (e) {
          console.error("Auto adjust failed:", e instanceof Error ? e.message : String(e));
        } finally {
          clearAutoAdjustRequest();
        }
      };
      
      runAuto();
    }
  }, [autoAdjustRequest, autoAdjustEffect, clearAutoAdjustRequest]);

  useEffect(() => {
    engineRef.current = { nodes, engineVersion };
    // Throttled update to the render pipeline
    requestAnimationFrame(() => {
      setRenderVersion(v => v + 1);
    });
  }, [nodes, engineVersion]);

  const channelFilter = useMemo(() => {
    const ColorMatrixFilter = (PIXI as any).ColorMatrixFilter || (PIXI.filters as any).ColorMatrixFilter;
    const filter = new ColorMatrixFilter();
    const { r, g, b, a } = previewSettings.channels;
    
    const matrix: any = [
      r ? 1 : 0, 0, 0, 0, 0,
      0, g ? 1 : 0, 0, 0, 0,
      0, 0, b ? 1 : 0, 0, 0,
      0, 0, 0, a ? 1 : 0, 0
    ];
    filter.matrix = matrix;
    return filter;
  }, [previewSettings.channels]);

  const allChannelsOn = Object.values(previewSettings.channels).every(v => v);

  const stageOptions = useMemo(() => ({
    antialias: true, 
    resolution: window.devicePixelRatio || 1, 
    backgroundAlpha: 0,
    autoDensity: true,
    powerPreference: 'high-performance' as any
  }), []);

  const bgColorHex = useMemo(() => new PIXI.Color(previewSettings.bgColor).toNumber(), [previewSettings.bgColor]);

  return (
    <div className={`canvas-wrapper ${previewSettings.showCheckerboard && !previewSettings.useBgColor ? 'checkerboard' : ''}`} 
         style={{ 
           width: '100%', 
           height: '100%', 
           display: 'flex', 
           justifyContent: 'center', 
           alignItems: 'center',
           backgroundColor: previewSettings.useBgColor ? previewSettings.bgColor : 'transparent',
           position: 'relative'
         }}>
      
      <ErrorBoundary>
        <Stage 
          width={1920 * previewSettings.previewScale} 
          height={1080 * previewSettings.previewScale} 
          options={stageOptions}
          onMount={(app) => {
            appRef.current = app;
          }}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
        >
          {previewSettings.useBgColor && (
            <Graphics draw={(g) => {
              g.clear(); g.beginFill(bgColorHex); g.drawRect(0, 0, 1920 * previewSettings.previewScale, 1080 * previewSettings.previewScale); g.endFill();
            }} />
          )}
          <Container filters={[channelFilter]} scale={previewSettings.previewScale}>
            {activePreviewId && (
              <NodeRenderer nodeId={activePreviewId} engineRef={engineRef} />
            )}
          </Container>
        </Stage>
      </ErrorBoundary>
    </div>
  );
};

export default CanvasEngine;
