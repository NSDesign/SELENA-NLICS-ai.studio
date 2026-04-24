import { create } from 'zustand';

export type NodeType = 'Generator' | 'CompOp' | 'MathOp' | 'LayerStack' | 'Constant';
export type GenType = 'Solid' | 'Shape' | 'Gradient' | 'Image' | 'Noise';
export type ShapeType = 'Rectangle' | 'Circle' | 'Star' | 'Polygon';
export type EffectType = 'Blur' | 'BrightnessContrast' | 'HueSaturation' | 'ChannelExtract';

export interface StackItem {
  id: string;
  type: 'Effect' | 'Mask';
  subtype: string; // e.g., 'Blur' or 'NodeRef'
  params: Record<string, ParameterValue>;
  opacity: ParameterValue;
  blendMode: ParameterValue;
  enabled: boolean;
  effects?: StackItem[]; // For Masks
  masks?: StackItem[];   // For Effects
}

export interface Pipeline {
  effects: StackItem[];
  masks: StackItem[];
}

export interface ParameterReference {
  nodeId: string;
  paramName: string;
  op: 'none' | 'add' | 'sub' | 'mul' | 'div';
  operand: number;
}

export interface ParameterValue {
  value: any;
  reference: ParameterReference | null;
}

export interface NLICNode {
  id: string;
  type: NodeType;
  name: string;
  inputs: Record<string, { nodeId: string | null, channel: 'RGBA' | 'R' | 'G' | 'B' | 'A' }>;
  params: Record<string, ParameterValue>;
  enabled: boolean;
  // Pipelines for CompOp and LayerStack
  inputA_pipeline?: Pipeline;
  inputB_pipeline?: Pipeline;
  output_pipeline?: Pipeline;
  lastUpdated: number;
}

export interface PreviewSettings {
  showCheckerboard: boolean;
  bgColor: string;
  useBgColor: boolean;
  previewScale: number;
  stickyPreview: boolean;
  channels: {
    r: boolean;
    g: boolean;
    b: boolean;
    a: boolean;
  };
}

export interface ExportSettings {
  width: number;
  height: number;
  dpi: number;
  bleed: number;
  showCropMarks: boolean;
}

interface NLICState {
  nodes: Record<string, NLICNode>;
  nodeOrder: string[];
  activePreviewId: string | null;
  previewSettings: PreviewSettings;
  exportSettings: ExportSettings;
  isExporting: boolean;
  engineVersion: number;
  autoAdjustRequest: { nodeId: string, pipelineKey: string, itemPath: string[], subtype: string } | null;
  
  // Actions
  addNode: (node: NLICNode) => void;
  updateNodeParam: (id: string, paramName: string, value: any, isReference?: boolean) => void;
  updateStackParam: (nodeId: string, pipelineKey: 'inputA_pipeline' | 'inputB_pipeline' | 'output_pipeline', itemPath: string[], paramName: string, value: any, isReference?: boolean) => void;
  updateStackItemMeta: (nodeId: string, pipelineKey: 'inputA_pipeline' | 'inputB_pipeline' | 'output_pipeline', itemPath: string[], meta: { opacity?: any, blendMode?: any, enabled?: boolean }) => void;
  addStackItem: (nodeId: string, pipelineKey: 'inputA_pipeline' | 'inputB_pipeline' | 'output_pipeline', parentPath: string[], item: StackItem) => void;
  removeStackItem: (nodeId: string, pipelineKey: 'inputA_pipeline' | 'inputB_pipeline' | 'output_pipeline', itemPath: string[]) => void;
  reorderStack: (nodeId: string, pipelineKey: 'inputA_pipeline' | 'inputB_pipeline' | 'output_pipeline', parentPath: string[], newOrder: string[]) => void;
  updateConnection: (nodeId: string, portName: string, targetId: string | null, channel?: 'RGBA' | 'R' | 'G' | 'B' | 'A') => void;
  setMask: (nodeId: string, maskId: string | null) => void; // Keeping for legacy or internal use if needed, but primarily using pipelines now
  setActivePreview: (id: string) => void;
  updatePreviewSettings: (settings: Partial<PreviewSettings>) => void;
  toggleChannel: (channel: keyof PreviewSettings['channels']) => void;
  toggleAllChannels: (on: boolean) => void;
  deleteNode: (id: string) => void;
  reorderNodes: (newOrder: string[]) => void;
  updateExportSettings: (settings: Partial<ExportSettings>) => void;
  setExporting: (exporting: boolean) => void;
  extractPipelineToLayerStack: (nodeId: string, pipelineKey: 'inputA_pipeline' | 'inputB_pipeline' | 'output_pipeline') => void;
  renameNode: (id: string, newName: string) => void;
  autoAdjustEffect: (nodeId: string, pipelineKey: string, itemPath: string[], params: Record<string, any>) => void;
  requestAutoAdjust: (nodeId: string, pipelineKey: string, itemPath: string[], subtype: string) => void;
  clearAutoAdjustRequest: () => void;
  loadDefaultScene: () => void;

  // Utilities
  getValidReferences: (sourceNodeId: string, allowSelf?: boolean, typeFilter?: NodeType[]) => NLICNode[];
  resolveParam: (nodeId: string, paramName: string, visited?: Set<string>) => any;
  resolveParamValue: (param: ParameterValue, visited?: Set<string>) => any;
  resolveStackParam: (nodeId: string, pipelineKey: string, itemPath: string[], paramName: string) => any;
}

export const useStore = create<NLICState>((set, get) => ({
  nodes: {},
  nodeOrder: [],
  activePreviewId: null,
  previewSettings: {
    showCheckerboard: true,
    bgColor: '#000000',
    useBgColor: false,
    previewScale: 0.5,
    stickyPreview: false,
    channels: { r: true, g: true, b: true, a: true }
  },
  exportSettings: {
    width: 10,
    height: 10,
    dpi: 300,
    bleed: 0.125,
    showCropMarks: true
  },
  isExporting: false,
  engineVersion: 0,
  autoAdjustRequest: null,

  addNode: (node) => set((state) => ({ 
    nodes: { ...state.nodes, [node.id]: node },
    nodeOrder: [...state.nodeOrder, node.id],
    engineVersion: state.engineVersion + 1
  })),

  updateNodeParam: (id, paramName, value, isReference = false) => set((state) => {
    const node = state.nodes[id];
    if (!node) return state;
    
    const currentParam = node.params[paramName] || { value: null, reference: null };
    const newParam = isReference 
      ? { ...currentParam, reference: value }
      : { ...currentParam, value: value, reference: null };

    return {
      nodes: {
        ...state.nodes,
        [id]: { ...node, params: { ...node.params, [paramName]: newParam }, lastUpdated: Date.now() }
      },
      engineVersion: state.engineVersion + 1
    };
  }),

  resolveParam: (nodeId, paramName, visited = new Set<string>()) => {
    const { nodes } = get();
    const node = nodes[nodeId];
    if (!node) return undefined;

    const paramKey = `${nodeId}:${paramName}`;
    if (visited.has(paramKey)) {
      console.warn(`Cycle detected in parameter resolution: ${paramKey}`);
      return undefined;
    }
    
    const nextVisited = new Set(visited);
    nextVisited.add(paramKey);

    // Special case for Constant result
    if (node.type === 'Constant' && paramName === 'result') {
      return get().resolveParamValue(node.params.value || { value: 0, reference: null }, nextVisited);
    }

    // Special case for MathOp result
    if (node.type === 'MathOp' && paramName === 'result') {
      const op = get().resolveParam(nodeId, 'operation', nextVisited);
      
      const resolveInput = (port: string) => {
        const input = node.inputs[port];
        if (input && input.nodeId) {
          return get().resolveParam(input.nodeId, 'result', nextVisited);
        }
        // Fallback to param if no input connection (for backward compatibility or hybrid)
        return get().resolveParamValue(node.params[port] || { value: 0, reference: null }, nextVisited);
      };

      const a = resolveInput('inputA');
      const b = resolveInput('inputB');

      switch (op) {
        case 'Add': return a + b;
        case 'Subtract': return a - b;
        case 'Multiply': return a * b;
        case 'Divide': return b !== 0 ? a / b : a;
        case 'Sin': return Math.sin(a);
        case 'Cos': return Math.cos(a);
        default: return 0;
      }
    }

    const param = node.params[paramName];
    if (!param) return undefined;

    return get().resolveParamValue(param, nextVisited);
  },

  resolveParamValue: (param: ParameterValue, visited = new Set<string>()) => {
    if (param.reference) {
      const refValue = get().resolveParam(param.reference.nodeId, param.reference.paramName, visited);
      const operand = param.reference.operand || 0;
      switch (param.reference.op) {
        case 'add': return refValue + operand;
        case 'sub': return refValue - operand;
        case 'mul': return refValue * operand;
        case 'div': return operand !== 0 ? refValue / operand : refValue;
        case 'none':
        default: return refValue;
      }
    }
    return param.value;
  },

  resolveStackParam: (nodeId, pipelineKey, itemPath, paramName) => {
    const { nodes } = get();
    const node = nodes[nodeId];
    if (!node) return undefined;

    const pipeline = (node as any)[pipelineKey] as Pipeline;
    if (!pipeline) return undefined;

    const findItem = (items: StackItem[], path: string[]): StackItem | undefined => {
      if (path.length === 0) return undefined;
      const id = path[0];
      const item = items.find(i => i.id === id);
      if (!item) return undefined;
      if (path.length === 1) return item;
      
      const nextStackKey = path[1] as 'effects' | 'masks';
      const nextStack = (item as any)[nextStackKey] || [];
      return findItem(nextStack, path.slice(2));
    };

    const topStackKey = itemPath[0] as 'effects' | 'masks';
    const item = findItem(pipeline[topStackKey], itemPath.slice(1));
    if (!item) return undefined;

    if (paramName === 'opacity') return get().resolveParamValue(item.opacity);
    if (paramName === 'blendMode') return get().resolveParamValue(item.blendMode);

    const param = item.params[paramName];
    if (!param) return undefined;

    return get().resolveParamValue(param);
  },

  updateStackParam: (nodeId, pipelineKey, itemPath, paramName, value, isReference = false) => set((state) => {
    const node = state.nodes[nodeId];
    if (!node) return state;
    const pipeline = (node as any)[pipelineKey] as Pipeline;
    if (!pipeline) return state;

    const updateItem = (items: StackItem[], path: string[]): StackItem[] => {
      if (path.length === 0) return items;
      const id = path[0];
      return items.map(item => {
        if (item.id !== id) return item;
        if (path.length === 1) {
          const currentParam = (paramName === 'opacity' ? item.opacity : (paramName === 'blendMode' ? item.blendMode : item.params[paramName])) || { value: null, reference: null };
          const newParam = isReference 
            ? { ...currentParam, reference: value }
            : { ...currentParam, value: value, reference: null };

          const newItem = { ...item };
          if (paramName === 'opacity') newItem.opacity = newParam;
          else if (paramName === 'blendMode') newItem.blendMode = newParam;
          else {
            newItem.params = { ...item.params, [paramName]: newParam };
            if (paramName !== 'autoActive' && newItem.params.autoActive?.value === true) {
              newItem.params.autoActive = { value: false, reference: null };
            }
          }
          return newItem;
        }
        const nextStackKey = path[1] as 'effects' | 'masks';
        const nextStack = (item as any)[nextStackKey] || [];
        return {
          ...item,
          [nextStackKey]: updateItem(nextStack, path.slice(2))
        };
      });
    };

    const topStackKey = itemPath[0] as 'effects' | 'masks';
    const newPipeline = {
      ...pipeline,
      [topStackKey]: updateItem(pipeline[topStackKey], itemPath.slice(1))
    };

    return {
      nodes: {
        ...state.nodes,
        [nodeId]: { 
          ...node, 
          [pipelineKey]: newPipeline,
          lastUpdated: Date.now() 
        }
      },
      engineVersion: state.engineVersion + 1
    };
  }),

  updateStackItemMeta: (nodeId, pipelineKey, itemPath, meta) => set((state) => {
    const node = state.nodes[nodeId];
    if (!node) return state;
    const pipeline = (node as any)[pipelineKey] as Pipeline;
    if (!pipeline) return state;

    const updateItem = (items: StackItem[], path: string[]): StackItem[] => {
      if (path.length === 0) return items;
      const id = path[0];
      return items.map(item => {
        if (item.id !== id) return item;
        if (path.length === 1) {
          const newItem = { ...item };
          if (meta.opacity !== undefined) newItem.opacity = meta.opacity;
          if (meta.blendMode !== undefined) newItem.blendMode = meta.blendMode;
          if (meta.enabled !== undefined) newItem.enabled = meta.enabled;
          return newItem;
        }
        const nextStackKey = path[1] as 'effects' | 'masks';
        const nextStack = (item as any)[nextStackKey] || [];
        return {
          ...item,
          [nextStackKey]: updateItem(nextStack, path.slice(2))
        };
      });
    };

    const topStackKey = itemPath[0] as 'effects' | 'masks';
    const newPipeline = {
      ...pipeline,
      [topStackKey]: updateItem(pipeline[topStackKey], itemPath.slice(1))
    };

    return {
      nodes: {
        ...state.nodes,
        [nodeId]: { 
          ...node, 
          [pipelineKey]: newPipeline,
          lastUpdated: Date.now() 
        }
      },
      engineVersion: state.engineVersion + 1
    };
  }),

  addStackItem: (nodeId, pipelineKey, parentPath, item) => set((state) => {
    const node = state.nodes[nodeId];
    if (!node) return state;
    const pipeline = (node as any)[pipelineKey] || { effects: [], masks: [] };

    const addItem = (items: StackItem[], path: string[]): StackItem[] => {
      if (path.length === 0) return [...items, item];
      const id = path[0];
      return items.map(it => {
        if (it.id !== id) return it;
        if (path.length === 1) {
          const nextStackKey = it.type === 'Effect' ? 'masks' : 'effects';
          return {
            ...it,
            [nextStackKey]: [...((it as any)[nextStackKey] || []), item]
          };
        }
        const nextStackKey = path[1] as 'effects' | 'masks';
        const nextStack = (it as any)[nextStackKey] || [];
        return {
          ...it,
          [nextStackKey]: addItem(nextStack, path.slice(2))
        };
      });
    };

    const topStackKey = parentPath.length === 0 ? (item.type === 'Effect' ? 'effects' : 'masks') : parentPath[0] as 'effects' | 'masks';
    const newPipeline = {
      ...pipeline,
      [topStackKey]: addItem(pipeline[topStackKey], parentPath.length === 0 ? [] : parentPath.slice(1))
    };

    return {
      nodes: {
        ...state.nodes,
        [nodeId]: { 
          ...node, 
          [pipelineKey]: newPipeline,
          lastUpdated: Date.now() 
        }
      },
      engineVersion: state.engineVersion + 1
    };
  }),

  removeStackItem: (nodeId, pipelineKey, itemPath) => set((state) => {
    const node = state.nodes[nodeId];
    if (!node) return state;
    const pipeline = (node as any)[pipelineKey] as Pipeline;
    if (!pipeline) return state;

    const removeItem = (items: StackItem[], path: string[]): StackItem[] => {
      if (path.length === 0) return items;
      const id = path[0];
      if (path.length === 1) {
        return items.filter(it => it.id !== id);
      }
      return items.map(it => {
        if (it.id !== id) return it;
        const nextStackKey = path[1] as 'effects' | 'masks';
        const nextStack = (it as any)[nextStackKey] || [];
        return {
          ...it,
          [nextStackKey]: removeItem(nextStack, path.slice(2))
        };
      });
    };

    const topStackKey = itemPath[0] as 'effects' | 'masks';
    const newPipeline = {
      ...pipeline,
      [topStackKey]: removeItem(pipeline[topStackKey], itemPath.slice(1))
    };

    return {
      nodes: {
        ...state.nodes,
        [nodeId]: { 
          ...node, 
          [pipelineKey]: newPipeline,
          lastUpdated: Date.now() 
        }
      },
      engineVersion: state.engineVersion + 1
    };
  }),

  reorderStack: (nodeId, pipelineKey, parentPath, newOrder) => set((state) => {
    const node = state.nodes[nodeId];
    if (!node) return state;
    const pipeline = (node as any)[pipelineKey] as Pipeline;
    if (!pipeline) return state;

    const reorder = (items: StackItem[], path: string[]): StackItem[] => {
      if (path.length === 0) {
        return newOrder.map(id => items.find(it => it.id === id)!).filter(Boolean);
      }
      const id = path[0];
      return items.map(it => {
        if (it.id !== id) return it;
        if (path.length === 1) {
          const nextStackKey = it.type === 'Effect' ? 'masks' : 'effects';
          const nextStack = (it as any)[nextStackKey] || [];
          const newNextStack = newOrder.map(nid => nextStack.find(sit => sit.id === nid)!).filter(Boolean);
          return { ...it, [nextStackKey]: newNextStack };
        }
        const nextStackKey = path[1] as 'effects' | 'masks';
        const nextStack = (it as any)[nextStackKey] || [];
        return {
          ...it,
          [nextStackKey]: reorder(nextStack, path.slice(2))
        };
      });
    };

    const topStackKey = parentPath[0] as 'effects' | 'masks';
    const newPipeline = {
      ...pipeline,
      [topStackKey]: reorder(pipeline[topStackKey], parentPath.slice(1))
    };

    return {
      nodes: {
        ...state.nodes,
        [nodeId]: { 
          ...node, 
          [pipelineKey]: newPipeline,
          lastUpdated: Date.now() 
        }
      },
      engineVersion: state.engineVersion + 1
    };
  }),

  updateConnection: (nodeId, portName, targetId, channel = 'RGBA') => set((state) => {
    const node = state.nodes[nodeId];
    if (!node) return state;
    return {
      nodes: {
        ...state.nodes,
        [nodeId]: { 
          ...node, 
          inputs: { 
            ...node.inputs, 
            [portName]: { nodeId: targetId, channel } 
          },
          lastUpdated: Date.now()
        }
      },
      engineVersion: state.engineVersion + 1
    };
  }),

  setMask: (nodeId, maskId) => set((state) => {
    const node = state.nodes[nodeId];
    if (!node) return state;
    return {
      nodes: {
        ...state.nodes,
        [nodeId]: { ...node, maskId, lastUpdated: Date.now() }
      },
      engineVersion: state.engineVersion + 1
    };
  }),

  setActivePreview: (id) => set({ activePreviewId: id }),

  updatePreviewSettings: (settings) => set((state) => ({
    previewSettings: { ...state.previewSettings, ...settings }
  })),

  toggleChannel: (channel) => set((state) => ({
    previewSettings: {
      ...state.previewSettings,
      channels: {
        ...state.previewSettings.channels,
        [channel]: !state.previewSettings.channels[channel]
      }
    }
  })),

  toggleAllChannels: (on) => set((state) => ({
    previewSettings: {
      ...state.previewSettings,
      channels: { r: on, g: on, b: on, a: on }
    }
  })),

  updateExportSettings: (settings) => set((state) => ({
    exportSettings: { ...state.exportSettings, ...settings }
  })),

  setExporting: (exporting) => set({ isExporting: exporting }),

  reorderNodes: (newOrder) => set({ nodeOrder: newOrder }),

  deleteNode: (id) => set((state) => {
    const newNodes = { ...state.nodes };
    delete newNodes[id];
    
    const newNodeOrder = state.nodeOrder.filter(nodeId => nodeId !== id);
    
    // Clean up references
    Object.keys(newNodes).forEach(nodeId => {
      const node = newNodes[nodeId];
      const newInputs = { ...node.inputs };
      let changed = false;
      Object.keys(newInputs).forEach(port => {
        if (newInputs[port].nodeId === id) {
          newInputs[port] = { nodeId: null, channel: 'RGBA' };
          changed = true;
        }
      });

      // Cleanup pipelines
      const cleanupPipeline = (p?: Pipeline) => {
        if (!p) return;
        p.effects.forEach(item => {
          if (item.subtype === 'NodeRef' && item.params.nodeId?.value === id) {
            item.params.nodeId.value = '';
            changed = true;
          }
        });
        p.masks.forEach(item => {
          if (item.subtype === 'NodeRef' && item.params.nodeId?.value === id) {
            item.params.nodeId.value = '';
            changed = true;
          }
        });
      };

      cleanupPipeline(node.inputA_pipeline);
      cleanupPipeline(node.inputB_pipeline);
      cleanupPipeline(node.output_pipeline);

      if (changed) {
        newNodes[nodeId] = { ...node, inputs: newInputs, lastUpdated: Date.now() };
      }
    });

    return { 
      nodes: newNodes,
      nodeOrder: newNodeOrder,
      activePreviewId: state.activePreviewId === id ? null : state.activePreviewId,
      engineVersion: state.engineVersion + 1
    };
  }),

  extractPipelineToLayerStack: (nodeId, pipelineKey) => set((state) => {
    const node = state.nodes[nodeId];
    if (!node) return state;
    const pipeline = (node as any)[pipelineKey] as Pipeline;
    if (!pipeline || (pipeline.effects.length === 0 && pipeline.masks.length === 0)) return state;

    const newId = `layerstack-${Math.random().toString(36).substring(2, 9)}`;
    const newLayerStack: NLICNode = {
      id: newId,
      type: 'LayerStack',
      name: `Extracted Stack ${state.nodeOrder.length + 1}`,
      inputs: { input: { nodeId: null, channel: 'RGBA' } },
      params: {},
      enabled: true,
      output_pipeline: { 
        effects: [...pipeline.effects],
        masks: [...pipeline.masks]
      },
      lastUpdated: Date.now()
    };

    // If it's an input pipeline, we might want to keep the input connection but move it to the LayerStack
    if (pipelineKey === 'inputA_pipeline' || pipelineKey === 'inputB_pipeline') {
      const port = pipelineKey === 'inputA_pipeline' ? 'inputA' : 'inputB';
      const originalInput = node.inputs[port];
      newLayerStack.inputs.input = { nodeId: originalInput.nodeId, channel: originalInput.channel as any };
      // The original node now takes the LayerStack as input for that port
      const newInputs = { ...node.inputs, [port]: { nodeId: newId, channel: 'RGBA' as const } };
      
      return {
        nodes: {
          ...state.nodes,
          [nodeId]: { 
            ...node, 
            inputs: newInputs,
            [pipelineKey]: { effects: [], masks: [] }, 
            lastUpdated: Date.now() 
          },
          [newId]: newLayerStack
        },
        nodeOrder: [...state.nodeOrder, newId],
        engineVersion: state.engineVersion + 1
      };
    } else {
      // Output pipeline extraction
      // We create a LayerStack that takes the CompOp/LayerStack output as input
      // But wait, the user said "referencing that node in the stack of another node".
      // If we extract the output pipeline, the node's output pipeline becomes empty, 
      // and we probably want to add a new node that uses this node as input and has the extracted pipeline.
      // Actually, a better way is to make the LayerStack take the current node as input.
      
      newLayerStack.inputs.input = { nodeId, channel: 'RGBA' };
      
      return {
        nodes: {
          ...state.nodes,
          [nodeId]: { 
            ...node, 
            output_pipeline: { effects: [], masks: [] }, 
            lastUpdated: Date.now() 
          },
          [newId]: newLayerStack
        },
        nodeOrder: [...state.nodeOrder, newId],
        engineVersion: state.engineVersion + 1
      };
    }
  }),

  renameNode: (id, newName) => set((state) => ({
    nodes: {
      ...state.nodes,
      [id]: { ...state.nodes[id], name: newName, lastUpdated: Date.now() }
    },
    engineVersion: state.engineVersion + 1
  })),

  autoAdjustEffect: (nodeId, pipelineKey, itemPath, params) => set((state) => {
    const node = state.nodes[nodeId];
    if (!node) return state;
    const pipeline = (node as any)[pipelineKey] as Pipeline;
    if (!pipeline) return state;

    const updateItem = (items: StackItem[], path: string[]): StackItem[] => {
      if (path.length === 0) return items;
      const id = path[0];
      return items.map(item => {
        if (item.id !== id) return item;
        if (path.length === 1) {
          const newParams = { ...item.params };
          for (const [key, val] of Object.entries(params)) {
            newParams[key] = { value: val, reference: null };
          }
          return { ...item, params: newParams };
        }
        const nextStackKey = path[1] as 'effects' | 'masks';
        const nextStack = (item as any)[nextStackKey] || [];
        return {
          ...item,
          [nextStackKey]: updateItem(nextStack, path.slice(2))
        };
      });
    };

    const topStackKey = itemPath[0] as 'effects' | 'masks';
    const newPipeline = {
      ...pipeline,
      [topStackKey]: updateItem(pipeline[topStackKey], itemPath.slice(1))
    };

    return {
      nodes: {
        ...state.nodes,
        [nodeId]: { 
          ...node, 
          [pipelineKey]: newPipeline,
          lastUpdated: Date.now() 
        }
      },
      engineVersion: state.engineVersion + 1
    };
  }),

  requestAutoAdjust: (nodeId, pipelineKey, itemPath, subtype) => set({
    autoAdjustRequest: { nodeId, pipelineKey, itemPath, subtype }
  }),

  clearAutoAdjustRequest: () => set({ autoAdjustRequest: null }),


  loadDefaultScene: () => {
    const generateId = () => Math.random().toString(36).substring(2, 9);
    
    const createGenerator = (subtype: GenType, name: string, params: any = {}): NLICNode => ({
      id: `gen-${subtype.toLowerCase()}-${generateId()}`,
      type: 'Generator',
      name,
      enabled: true,
      lastUpdated: Date.now(),
      inputs: {},
      params: {
        genType: { value: subtype, reference: null },
        color: { value: '#007acc', reference: null },
        color2: { value: '#ff0055', reference: null },
        shapeType: { value: 'Rectangle', reference: null },
        imageUrl: { value: null, reference: null },
        x: { value: 0, reference: null },
        y: { value: 0, reference: null },
        width: { value: 1920, reference: null },
        height: { value: 1080, reference: null },
        rotation: { value: 0, reference: null },
        points: { value: 5, reference: null },
        innerRadius: { value: 200, reference: null },
        outerRadius: { value: 400, reference: null },
        sides: { value: 6, reference: null },
        cornerRadius: { value: 0, reference: null },
        roundness: { value: 0, reference: null },
        gradientType: { value: 'Linear', reference: null },
        angle: { value: 0, reference: null },
        centerX: { value: 0.5, reference: null },
        centerY: { value: 0.5, reference: null },
        radius: { value: 0.5, reference: null },
        noiseScale: { value: 0.1, reference: null },
        noiseOctaves: { value: 4, reference: null },
        noisePersistence: { value: 0.5, reference: null },
        noiseLacunarity: { value: 2.0, reference: null },
        noiseSeed: { value: Math.random(), reference: null },
        fitMode: { value: 'Cover', reference: null },
        ...params
      }
    });

    const createBlender = (name: string, inputA: string | null, inputB: string | null): NLICNode => ({
      id: `blender-${generateId()}`,
      type: 'CompOp',
      name,
      enabled: true,
      lastUpdated: Date.now(),
      inputs: {
        inputA: { nodeId: inputA, channel: 'RGBA' },
        inputB: { nodeId: inputB, channel: 'RGBA' }
      },
      params: {
        blendMode: { value: 'Normal', reference: null },
        amount: { value: 100, reference: null },
        opacityA: { value: 100, reference: null },
        opacityB: { value: 100, reference: null }
      },
      inputA_pipeline: { effects: [], masks: [] },
      inputB_pipeline: { effects: [], masks: [] },
      output_pipeline: { effects: [], masks: [] }
    });

    const createEffect = (subtype: string, params: any = {}): StackItem => ({
      id: `effect-${generateId()}`,
      type: 'Effect',
      subtype,
      params: Object.entries(params).reduce((acc, [k, v]) => ({ ...acc, [k]: { value: v, reference: null } }), {}),
      opacity: { value: 100, reference: null },
      blendMode: { value: 'Normal', reference: null },
      enabled: true
    });

    const createMask = (nodeId: string): StackItem => ({
      id: `mask-${generateId()}`,
      type: 'Mask',
      subtype: 'NodeRef',
      params: {
        nodeId: { value: nodeId, reference: null }
      },
      opacity: { value: 100, reference: null },
      blendMode: { value: 'Normal', reference: null },
      enabled: true
    });

    const solid = createGenerator('Solid', 'Background', { color: { value: '#1a1a1c', reference: null } });
    const gradient = createGenerator('Gradient', 'Sky Gradient', { 
      color: { value: '#001f3f', reference: null }, 
      color2: { value: '#0074d9', reference: null },
      gradientType: { value: 'Linear', reference: null },
      angle: { value: 90, reference: null }
    });
    const noise = createGenerator('Noise', 'Texture Noise', { 
      noiseScale: { value: 0.05, reference: null },
      noisePersistence: { value: 0.6, reference: null }
    });
    const shape = createGenerator('Shape', 'Center Star', { 
      shapeType: { value: 'Star', reference: null },
      color: { value: '#ffdc00', reference: null },
      x: { value: 960, reference: null },
      y: { value: 540, reference: null },
      width: { value: 400, reference: null },
      height: { value: 400, reference: null },
      points: { value: 5, reference: null },
      innerRadius: { value: 150, reference: null },
      outerRadius: { value: 400, reference: null }
    });
    const image = createGenerator('Image', 'Sample Image', { 
      imageUrl: { value: 'https://picsum.photos/seed/nlic/1920/1080', reference: null },
      fitMode: { value: 'Cover', reference: null }
    });
    const maskShape = createGenerator('Shape', 'Image Mask', {
      shapeType: { value: 'Circle', reference: null },
      color: { value: '#ffffff', reference: null },
      x: { value: 960, reference: null },
      y: { value: 540, reference: null },
      width: { value: 800, reference: null },
      height: { value: 800, reference: null }
    });

    // Chain blenders to combine all
    const b1 = createBlender('Base Mix', solid.id, gradient.id);
    b1.params.blendMode.value = 'Multiply';
    b1.inputB_pipeline!.effects.push(createEffect('Blur', { blur: 20 }));
    
    const b2 = createBlender('Texture Overlay', b1.id, noise.id);
    b2.params.blendMode.value = 'Overlay';
    b2.params.amount.value = 30;
    b2.inputB_pipeline!.effects.push(createEffect('BrightnessContrast', { brightness: 1.2, contrast: 1.5 }));

    const b3 = createBlender('Image Blend', b2.id, image.id);
    b3.params.blendMode.value = 'Screen';
    b3.params.amount.value = 50;
    b3.inputB_pipeline!.masks.push(createMask(maskShape.id));

    const finalBlender = createBlender('Final Composition', b3.id, shape.id);
    finalBlender.params.blendMode.value = 'Add';
    finalBlender.inputB_pipeline!.effects.push(createEffect('HueSaturation', { hue: 45, saturation: 0.5 }));

    const newNodes = {
      [solid.id]: solid,
      [gradient.id]: gradient,
      [noise.id]: noise,
      [shape.id]: shape,
      [image.id]: image,
      [maskShape.id]: maskShape,
      [b1.id]: b1,
      [b2.id]: b2,
      [b3.id]: b3,
      [finalBlender.id]: finalBlender
    };

    const newNodeOrder = [
      solid.id, gradient.id, noise.id, shape.id, image.id, maskShape.id,
      b1.id, b2.id, b3.id, finalBlender.id
    ];

    set({
      nodes: newNodes,
      nodeOrder: newNodeOrder,
      activePreviewId: finalBlender.id,
      engineVersion: get().engineVersion + 1
    });
  },

  getValidReferences: (sourceNodeId: string, allowSelf = false, typeFilter?: NodeType[]) => {
    const { nodes, resolveParam } = get();
    
    const wouldCreateCycle = (targetId: string, sourceId: string, visited = new Set<string>()): boolean => {
      if (targetId === sourceId) return true;
      if (visited.has(targetId)) return false;
      visited.add(targetId);

      const targetNode = nodes[targetId];
      if (!targetNode || !targetNode.inputs) return false;

      for (const input of Object.values(targetNode.inputs)) {
        if (input.nodeId && wouldCreateCycle(input.nodeId, sourceId, visited)) {
          return true;
        }
      }

      // Check pipelines for NodeRefs
      const checkPipeline = (p?: Pipeline) => {
        if (!p) return false;
        for (const item of [...p.effects, ...p.masks]) {
          if (item.subtype === 'NodeRef' && item.params.nodeId?.value) {
            if (wouldCreateCycle(item.params.nodeId.value as string, sourceId, visited)) return true;
          }
        }
        return false;
      };

      if (checkPipeline(targetNode.inputA_pipeline)) return true;
      if (checkPipeline(targetNode.inputB_pipeline)) return true;
      if (checkPipeline(targetNode.output_pipeline)) return true;

      return false;
    };

    return Object.values(nodes)
      .filter(node => {
        // Type filter
        if (typeFilter && !typeFilter.includes(node.type)) return false;
        // Allow self-reference for parameters if explicitly requested
        if (node.id === sourceNodeId) return allowSelf;
        // Otherwise check for node-level cycles (inputs/pipelines)
        return !wouldCreateCycle(node.id, sourceNodeId);
      })
      .map(node => {
        let subtype = '';
        if (node.type === 'Generator') {
          subtype = resolveParam(node.id, 'genType') || '';
        } else if (node.type === 'MathOp') {
          subtype = resolveParam(node.id, 'operation') || '';
        } else {
          subtype = node.type;
        }
        
        return {
          ...node,
          name: `${node.name} (${subtype})`
        };
      });
  }
}));
