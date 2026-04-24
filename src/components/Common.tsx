import React, { useState } from 'react';
import { useStore, ParameterValue, ParameterReference, Pipeline, StackItem } from '../store';
import { 
  Link, Link2Off, CheckCircle2, XCircle, Trash2, ArrowUpRight,
  Settings2, Layers, AlertTriangle, ShieldCheck, Zap
} from 'lucide-react';

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Avoid logging the full errorInfo if it might contain circular structures
    console.error("ErrorBoundary caught an error:", error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '20px', 
          backgroundColor: '#2c0000', 
          color: '#ff9999', 
          borderRadius: '8px',
          border: '1px solid #ff0000',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          fontSize: '0.85rem',
          maxWidth: '400px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
            <AlertTriangle size={18} />
            Rendering Error
          </div>
          <div style={{ opacity: 0.8 }}>
            {this.state.error?.message || "An unexpected error occurred in the rendering pipeline."}
          </div>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              backgroundColor: '#ff0000',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              alignSelf: 'flex-start'
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const getRelevantParams = (node: any) => {
  if (!node) return [];
  const baseParams = ['x', 'y', 'width', 'height', 'rotation'];
  
  if (node.type === 'Generator') {
    const genType = node.params.genType?.value;
    const shapeType = node.params.shapeType?.value;
    
    let specificParams: string[] = ['genType'];
    if (genType === 'Solid') {
      specificParams.push('color');
    } else if (genType === 'Shape') {
      specificParams.push('color', 'shapeType', 'cornerRadius', 'roundness');
      if (shapeType === 'Star') {
        specificParams.push('points', 'innerRadius', 'outerRadius');
      } else if (shapeType === 'Polygon') {
        specificParams.push('sides');
      }
    } else if (genType === 'Gradient') {
      specificParams.push('color', 'color2', 'gradientType', 'angle', 'centerX', 'centerY', 'radius');
    } else if (genType === 'Noise') {
      specificParams.push('noiseScale', 'noiseOctaves', 'noisePersistence', 'noiseLacunarity', 'noiseSeed');
    } else if (genType === 'Image') {
      specificParams.push('imageUrl', 'fitMode');
    }
    return [...baseParams, ...specificParams];
  }
  
  if (node.type === 'CompOp') {
    return ['swapInputs', 'opacityA', 'opacityB', 'blendMode', 'amount'];
  }
  
  if (node.type === 'MathOp') {
    return ['operation', 'inputA', 'inputB', 'result'];
  }
  
  if (node.type === 'Constant') {
    return ['value', 'result'];
  }
  
  return Object.keys(node.params);
};

export const ParameterInput: React.FC<{
  label: string;
  nodeId: string;
  paramName: string;
  type?: 'number' | 'text' | 'color' | 'select';
  options?: { label: string, value: any }[];
  min?: number;
  max?: number;
  step?: number;
  isStack?: boolean;
  pipelineKey?: 'inputA_pipeline' | 'inputB_pipeline' | 'output_pipeline';
  itemPath?: string[];
}> = React.memo(({ label, nodeId, paramName, type = 'number', options, min, max, step = 1, isStack, pipelineKey, itemPath }) => {
  const node = useStore(state => state.nodes[nodeId]);
  const updateNodeParam = useStore(state => state.updateNodeParam);
  const updateStackParam = useStore(state => state.updateStackParam);
  const requestAutoAdjust = useStore(state => state.requestAutoAdjust);
  const resolveParam = useStore(state => state.resolveParam);
  const resolveStackParam = useStore(state => state.resolveStackParam);
  const getValidReferences = useStore(state => state.getValidReferences);
  const nodes = useStore(state => state.nodes);
  
  // Use a more specific selector for the parameter value to avoid unnecessary re-renders
  const paramValue = useStore(state => {
    const n = state.nodes[nodeId];
    if (!n) return null;
    if (isStack && pipelineKey && itemPath) {
      const findItem = (items: any[], path: string[]): any => {
        if (path.length === 0) return undefined;
        const id = path[0];
        const item = items.find(i => i.id === id);
        if (!item) return undefined;
        if (path.length === 1) return item;
        const nextStackKey = path[1] as 'effects' | 'masks';
        return findItem((item as any)[nextStackKey] || [], path.slice(2));
      };
      const topStackKey = itemPath[0] as 'effects' | 'masks';
      const pipeline = (n as any)[pipelineKey];
      const item = findItem(pipeline?.[topStackKey] || [], itemPath.slice(1));
      if (paramName === 'opacity') return item?.opacity?.value;
      if (paramName === 'blendMode') return item?.blendMode?.value;
      return item?.params[paramName]?.value;
    }
    return n.params[paramName]?.value;
  });

  if (!node) return null;
  let param: ParameterValue;
  
  if (isStack && pipelineKey && itemPath) {
    const pipeline = (node as any)[pipelineKey];
    
    const findItem = (items: StackItem[], path: string[]): StackItem | undefined => {
      if (path.length === 0) return undefined;
      const id = path[0];
      const item = items.find(i => i.id === id);
      if (!item) return undefined;
      if (path.length === 1) return item;
      const nextStackKey = path[1] as 'effects' | 'masks';
      return findItem((item as any)[nextStackKey] || [], path.slice(2));
    };

    const topStackKey = itemPath[0] as 'effects' | 'masks';
    const item = findItem(pipeline?.[topStackKey] || [], itemPath.slice(1));

    if (paramName === 'opacity') {
      param = item?.opacity || { value: 100, reference: null };
    } else if (paramName === 'blendMode') {
      param = item?.blendMode || { value: 'Normal', reference: null };
    } else {
      param = item?.params[paramName] || { value: type === 'color' ? '#ffffff' : 0, reference: null };
    }
  } else {
    param = node.params[paramName] || { value: (paramName === 'opacity' || paramName === 'opacityA' || paramName === 'opacityB' || paramName === 'amount') ? 100 : (type === 'color' ? '#ffffff' : 0), reference: null };
  }

  const resolvedValue = isStack && pipelineKey && itemPath 
    ? resolveStackParam(nodeId, pipelineKey, itemPath, paramName)
    : resolveParam(nodeId, paramName);

  const [isLinking, setIsLinking] = useState(false);

  const handleValueChange = (val: any) => {
    const finalVal = type === 'number' ? parseFloat(val) : val;
    if (isStack && pipelineKey && itemPath) {
      updateStackParam(nodeId, pipelineKey, itemPath, paramName, finalVal);
    } else {
      updateNodeParam(nodeId, paramName, finalVal);
    }
  };

  const handleLinkChange = (ref: Partial<ParameterReference>) => {
    const currentRef = param.reference || { nodeId: '', paramName: '', op: 'none', operand: 0 };
    const finalRef = { ...currentRef, ...ref };
    if (isStack && pipelineKey && itemPath) {
      updateStackParam(nodeId, pipelineKey, itemPath, paramName, finalRef, true);
    } else {
      updateNodeParam(nodeId, paramName, finalRef, true);
    }
  };

  const validRefs = getValidReferences(nodeId, true);

  return (
    <div className="param-container" style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <label className="param-label">{label}</label>
        <button 
          onClick={() => setIsLinking(!isLinking)}
          style={{ 
            background: 'transparent', 
            border: 'none', 
            color: param.reference ? '#007aff' : '#4e4e52', 
            cursor: 'pointer',
            padding: '2px'
          }}
          title={param.reference ? "Linked" : "Link to parameter"}
        >
          {param.reference ? <Link size={12} /> : <Link2Off size={12} />}
        </button>
      </div>

      {isLinking ? (
        <div style={{ backgroundColor: '#1c1c1e', padding: '8px', borderRadius: '6px', border: '1px solid #3a3a3c', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <select 
            className="param-input"
            value={param.reference?.nodeId || ''}
            onChange={(e) => handleLinkChange({ nodeId: e.target.value })}
          >
            <option value="">-- Select Item --</option>
            {validRefs.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          
          {param.reference?.nodeId && (
            <select 
              className="param-input"
              value={param.reference?.paramName || ''}
              onChange={(e) => handleLinkChange({ paramName: e.target.value })}
            >
              <option value="">-- Select Param --</option>
              {getRelevantParams(nodes[param.reference.nodeId])
                .filter(p => !(param.reference?.nodeId === nodeId && p === paramName))
                .map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
            </select>
          )}

          <div style={{ display: 'flex', gap: '4px' }}>
            <select 
              className="param-input"
              style={{ flex: 1 }}
              value={param.reference?.op || 'none'}
              onChange={(e) => handleLinkChange({ op: e.target.value as any })}
            >
              <option value="none">None</option>
              <option value="add">+</option>
              <option value="sub">-</option>
              <option value="mul">×</option>
              <option value="div">÷</option>
            </select>
            <input 
              type="number"
              className="param-input"
              style={{ flex: 1 }}
              value={param.reference?.operand || 0}
              onChange={(e) => handleLinkChange({ operand: parseFloat(e.target.value) })}
            />
          </div>
          <div style={{ fontSize: '0.65rem', color: '#8e8e93', textAlign: 'right' }}>
            Result: <span style={{ color: 'white', fontWeight: 'bold' }}>{resolvedValue}</span>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {type === 'select' ? (
            <select 
              className="param-input"
              value={paramValue ?? param.value}
              onChange={(e) => handleValueChange(e.target.value)}
            >
              {options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          ) : type === 'color' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
              <input 
                type="color" 
                value={paramValue ?? param.value} 
                onChange={(e) => handleValueChange(e.target.value)} 
                className="color-picker" 
              />
              <span style={{ fontSize: '0.75rem', color: '#8e8e93', fontFamily: 'monospace' }}>{paramValue ?? param.value}</span>
            </div>
          ) : type === 'number' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
              <input 
                type="range" 
                min={min} 
                max={max} 
                step={step}
                value={paramValue ?? param.value}
                onChange={(e) => handleValueChange(e.target.value)}
                style={{ flexGrow: 1 }}
              />
              <input 
                type="number"
                value={paramValue ?? param.value}
                onChange={(e) => handleValueChange(e.target.value)}
                className="param-input"
                style={{ width: '60px' }}
              />
            </div>
          ) : (
            <input 
              type="text"
              className="param-input"
              value={paramValue ?? param.value}
              onChange={(e) => handleValueChange(e.target.value)}
            />
          )}
        </div>
      )}
    </div>
  );
});

export const StackList: React.FC<{
  nodeId: string;
  pipelineKey: 'inputA_pipeline' | 'inputB_pipeline' | 'output_pipeline';
  parentPath: string[]; // e.g. ['effects'] or ['effects', 'e1', 'masks']
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}> = React.memo(({ nodeId, pipelineKey, parentPath, selectedId, onSelect }) => {
  const node = useStore(state => state.nodes[nodeId]);
  const addStackItem = useStore(state => state.addStackItem);
  const removeStackItem = useStore(state => state.removeStackItem);
  const updateStackItemMeta = useStore(state => state.updateStackItemMeta);
  
  if (!node) return null;
  const pipeline = (node as any)[pipelineKey];
  
  const getItems = (items: StackItem[], path: string[]): StackItem[] => {
    if (path.length === 0) return items;
    const id = path[0];
    const item = items.find(i => i.id === id);
    if (!item) return [];
    if (path.length === 1) {
       const nextStackKey = item.type === 'Effect' ? 'masks' : 'effects';
       return (item as any)[nextStackKey] || [];
    }
    const nextStackKey = path[1] as 'effects' | 'masks';
    return getItems((item as any)[nextStackKey] || [], path.slice(2));
  };

  const topStackKey = parentPath[0] as 'effects' | 'masks';
  const items = getItems(pipeline?.[topStackKey] || [], parentPath.slice(1));
  const currentStackType = parentPath[parentPath.length - 1] as 'effects' | 'masks';

  const handleAdd = (subtype: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newItem: any = {
      id,
      type: currentStackType === 'effects' ? 'Effect' : 'Mask',
      subtype,
      params: {},
      opacity: { value: 100, reference: null },
      blendMode: { value: 'Normal', reference: null },
      enabled: true
    };

    if (subtype === 'Blur') newItem.params.blur = { value: 4, reference: null };
    if (subtype === 'BrightnessContrast') {
      newItem.params.brightness = { value: 1, reference: null };
      newItem.params.contrast = { value: 1, reference: null };
    }
    if (subtype === 'HueSaturation') {
      newItem.params.hue = { value: 0, reference: null };
      newItem.params.saturation = { value: 0, reference: null };
    }
    if (subtype === 'ChannelExtract') newItem.params.channel = { value: 'RGBA', reference: null };
    if (subtype === 'Levels') {
      newItem.params.blackIn = { value: 0, reference: null };
      newItem.params.whiteIn = { value: 1, reference: null };
      newItem.params.gamma = { value: 1, reference: null };
      newItem.params.blackOut = { value: 0, reference: null };
      newItem.params.whiteOut = { value: 1, reference: null };
      newItem.params.autoActive = { value: false, reference: null };
    }
    if (subtype === 'Curves') {
      newItem.params.p0 = { value: 0, reference: null };
      newItem.params.p1 = { value: 0.25, reference: null };
      newItem.params.p2 = { value: 0.5, reference: null };
      newItem.params.p3 = { value: 0.75, reference: null };
      newItem.params.p4 = { value: 1, reference: null };
      newItem.params.autoActive = { value: false, reference: null };
    }
    if (subtype === 'Transform') {
      newItem.params.translateX = { value: 0, reference: null };
      newItem.params.translateY = { value: 0, reference: null };
      newItem.params.scaleX = { value: 1, reference: null };
      newItem.params.scaleY = { value: 1, reference: null };
      newItem.params.rotation = { value: 0, reference: null };
      newItem.params.skewX = { value: 0, reference: null };
      newItem.params.skewY = { value: 0, reference: null };
    }
    if (subtype === 'NodeRef') newItem.params.nodeId = { value: '', reference: null };
    if (subtype === 'Shape') {
      newItem.params.shapeType = { value: 'Rectangle', reference: null };
      newItem.params.width = { value: 400, reference: null };
      newItem.params.height = { value: 400, reference: null };
      newItem.params.points = { value: 5, reference: null };
      newItem.params.innerRadius = { value: 100, reference: null };
      newItem.params.outerRadius = { value: 200, reference: null };
      newItem.params.sides = { value: 6, reference: null };
      newItem.params.cornerRadius = { value: 0, reference: null };
      newItem.params.roundness = { value: 0, reference: null };
    }

    addStackItem(nodeId, pipelineKey, parentPath, newItem);
    onSelect(id);
  };

  return (
    <div className="stack-list" style={{ marginTop: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#8e8e93', textTransform: 'uppercase' }}>
          {currentStackType}
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          {currentStackType === 'effects' ? (
            <select 
              className="param-input" 
              style={{ fontSize: '0.65rem', padding: '2px 4px', height: '22px' }}
              onChange={(e) => { if (e.target.value) handleAdd(e.target.value); e.target.value = ''; }}
            >
              <option value="">+ Effect</option>
              <option value="Blur">Blur</option>
              <option value="BrightnessContrast">Brightness/Contrast</option>
              <option value="HueSaturation">Hue/Saturation</option>
              <option value="ChannelExtract">Channel Extract</option>
              <option value="Invert">Invert</option>
              <option value="Levels">Levels</option>
              <option value="Curves">Curves</option>
              <option value="Transform">Transform</option>
            </select>
          ) : (
            <select 
              className="param-input" 
              style={{ fontSize: '0.65rem', padding: '2px 4px', height: '22px' }}
              onChange={(e) => { if (e.target.value) handleAdd(e.target.value); e.target.value = ''; }}
            >
              <option value="">+ Mask</option>
              <option value="NodeRef">Node Reference</option>
              <option value="Shape">Shape Mask</option>
            </select>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {items.map((item: any) => (
          <div 
            key={item.id}
            onClick={() => onSelect(selectedId === item.id ? null : item.id)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '6px 10px', 
              backgroundColor: selectedId === item.id ? 'rgba(0, 122, 255, 0.2)' : '#2c2c2e',
              borderRadius: '6px',
              cursor: 'pointer',
              border: `1px solid ${selectedId === item.id ? '#007aff' : 'transparent'}`
            }}
          >
            <div style={{ color: item.enabled ? '#007aff' : '#4e4e52' }} onClick={(e) => {
              e.stopPropagation();
              updateStackItemMeta(nodeId, pipelineKey, [...parentPath, item.id], { enabled: !item.enabled });
            }}>
              {item.enabled ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            </div>
            <span style={{ flexGrow: 1, fontSize: '0.75rem', color: item.enabled ? 'white' : '#8e8e93' }}>
              {item.subtype}
            </span>
            <button 
              onClick={(e) => { e.stopPropagation(); removeStackItem(nodeId, pipelineKey, [...parentPath, item.id]); if (selectedId === item.id) onSelect(null); }}
              className="icon-btn danger"
              style={{ padding: '2px' }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <div style={{ fontSize: '0.7rem', color: '#4e4e52', textAlign: 'center', padding: '8px', border: '1px dashed #2c2c2e', borderRadius: '6px' }}>
            No {currentStackType}
          </div>
        )}
      </div>
    </div>
  );
});

export const StackInspector: React.FC<{
  nodeId: string;
  pipelineKey: 'inputA_pipeline' | 'inputB_pipeline' | 'output_pipeline';
  itemPath: string[];
}> = React.memo(({ nodeId, pipelineKey, itemPath }) => {
  const node = useStore(state => state.nodes[nodeId]);
  const requestAutoAdjust = useStore(state => state.requestAutoAdjust);
  
  if (!node) return null;
  
  const findItem = (items: StackItem[], path: string[]): StackItem | undefined => {
    if (path.length === 0) return undefined;
    const id = path[0];
    const item = items.find(i => i.id === id);
    if (!item) return undefined;
    if (path.length === 1) return item;
    const nextStackKey = path[1] as 'effects' | 'masks';
    return findItem((item as any)[nextStackKey] || [], path.slice(2));
  };

  const topStackKey = itemPath[0] as 'effects' | 'masks';
  const item = findItem((node as any)[pipelineKey]?.[topStackKey] || [], itemPath.slice(1));

  const [activeTab, setActiveTab] = useState<'settings' | 'layer' | 'sub'>('settings');
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);

  if (!item) return null;

  const subStackType = item.type === 'Effect' ? 'masks' : 'effects';

  return (
    <div style={{ 
      marginTop: '12px', 
      padding: '12px', 
      backgroundColor: '#0a0a0b', 
      borderRadius: '8px', 
      border: '1px solid #3a3a3c',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'white' }}>
          {item.subtype} {item.type}
        </div>
        <button 
          onClick={() => {
            useStore.getState().removeStackItem(nodeId, pipelineKey, itemPath);
          }}
          className="icon-btn danger"
          style={{ padding: '4px' }}
          title="Delete Item"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: '4px', backgroundColor: '#1c1c1e', padding: '2px', borderRadius: '6px' }}>
        <button 
          onClick={() => setActiveTab('settings')}
          style={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '6px',
            padding: '6px', 
            fontSize: '0.65rem', 
            fontWeight: '600',
            borderRadius: '4px',
            backgroundColor: activeTab === 'settings' ? '#2c2c2e' : 'transparent',
            color: activeTab === 'settings' ? 'white' : '#8e8e93',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <Settings2 size={12} /> Settings
        </button>
        <button 
          onClick={() => setActiveTab('layer')}
          style={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '6px',
            padding: '6px', 
            fontSize: '0.65rem', 
            fontWeight: '600',
            borderRadius: '4px',
            backgroundColor: activeTab === 'layer' ? '#2c2c2e' : 'transparent',
            color: activeTab === 'layer' ? 'white' : '#8e8e93',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <Layers size={12} /> Layer
        </button>
        <button 
          onClick={() => setActiveTab('sub')}
          style={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '6px',
            padding: '6px', 
            fontSize: '0.65rem', 
            fontWeight: '600',
            borderRadius: '4px',
            backgroundColor: activeTab === 'sub' ? '#2c2c2e' : 'transparent',
            color: activeTab === 'sub' ? 'white' : '#8e8e93',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          {subStackType === 'masks' ? <ShieldCheck size={12} /> : <Zap size={12} />} {subStackType === 'masks' ? 'Masks' : 'Effects'}
        </button>
      </div>

      {activeTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'white', marginBottom: '4px' }}>
            {item.subtype} Parameters
          </div>
          {item.subtype === 'Blur' && (
            <ParameterInput label="Blur Size" nodeId={nodeId} paramName="blur" min={0} max={64} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
          )}
          {item.subtype === 'BrightnessContrast' && (
            <>
              <ParameterInput label="Brightness" nodeId={nodeId} paramName="brightness" min={0} max={2} step={0.01} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
              <ParameterInput label="Contrast" nodeId={nodeId} paramName="contrast" min={0} max={2} step={0.01} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
            </>
          )}
          {item.subtype === 'HueSaturation' && (
            <>
              <ParameterInput label="Hue" nodeId={nodeId} paramName="hue" min={0} max={360} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
              <ParameterInput label="Saturation" nodeId={nodeId} paramName="saturation" min={-1} max={1} step={0.01} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
            </>
          )}
          {item.subtype === 'ChannelExtract' && (
            <ParameterInput label="Channel" nodeId={nodeId} paramName="channel" type="select" options={[
              { label: 'RGBA', value: 'RGBA' },
              { label: 'Red', value: 'R' },
              { label: 'Green', value: 'G' },
              { label: 'Blue', value: 'B' },
              { label: 'Alpha', value: 'A' }
            ]} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
          )}
          {item.subtype === 'Levels' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.7rem', color: '#8e8e93' }}>Adjust Levels</span>
                <button 
                  onClick={() => requestAutoAdjust(nodeId, pipelineKey, itemPath, item.subtype)}
                  style={{ fontSize: '0.6rem', padding: '2px 6px', height: '20px', backgroundColor: item.params.autoActive?.value ? '#007aff' : '#4e4e52', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Auto
                </button>
              </div>
              <ParameterInput label="Black In" nodeId={nodeId} paramName="blackIn" min={0} max={1} step={0.01} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
              <ParameterInput label="White In" nodeId={nodeId} paramName="whiteIn" min={0} max={1} step={0.01} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
              <ParameterInput label="Gamma" nodeId={nodeId} paramName="gamma" min={0.1} max={5} step={0.01} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
              <ParameterInput label="Black Out" nodeId={nodeId} paramName="blackOut" min={0} max={1} step={0.01} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
              <ParameterInput label="White Out" nodeId={nodeId} paramName="whiteOut" min={0} max={1} step={0.01} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
            </>
          )}
          {item.subtype === 'Curves' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.7rem', color: '#8e8e93' }}>Adjust Curves</span>
                <button 
                  onClick={() => requestAutoAdjust(nodeId, pipelineKey, itemPath, item.subtype)}
                  style={{ fontSize: '0.6rem', padding: '2px 6px', height: '20px', backgroundColor: item.params.autoActive?.value ? '#007aff' : '#4e4e52', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Auto
                </button>
              </div>
              <ParameterInput label="P0 (0%)" nodeId={nodeId} paramName="p0" min={0} max={1} step={0.01} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
              <ParameterInput label="P1 (25%)" nodeId={nodeId} paramName="p1" min={0} max={1} step={0.01} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
              <ParameterInput label="P2 (50%)" nodeId={nodeId} paramName="p2" min={0} max={1} step={0.01} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
              <ParameterInput label="P3 (75%)" nodeId={nodeId} paramName="p3" min={0} max={1} step={0.01} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
              <ParameterInput label="P4 (100%)" nodeId={nodeId} paramName="p4" min={0} max={1} step={0.01} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
            </>
          )}
          {item.subtype === 'Transform' && (
            <>
              <ParameterInput label="Translate X" nodeId={nodeId} paramName="translateX" min={-2000} max={2000} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
              <ParameterInput label="Translate Y" nodeId={nodeId} paramName="translateY" min={-2000} max={2000} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
              <ParameterInput label="Scale X" nodeId={nodeId} paramName="scaleX" min={-10} max={10} step={0.01} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
              <ParameterInput label="Scale Y" nodeId={nodeId} paramName="scaleY" min={-10} max={10} step={0.01} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
              <ParameterInput label="Rotation" nodeId={nodeId} paramName="rotation" min={-360} max={360} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
              <ParameterInput label="Skew X" nodeId={nodeId} paramName="skewX" min={-180} max={180} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
              <ParameterInput label="Skew Y" nodeId={nodeId} paramName="skewY" min={-180} max={180} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
            </>
          )}
          {item.subtype === 'NodeRef' && (
            <ParameterInput 
              label="Reference Item" 
              nodeId={nodeId} 
              paramName="nodeId" 
              type="select" 
              options={[
                { label: '-- Select Item --', value: '' },
                ...useStore.getState().getValidReferences(nodeId).map(ref => ({ label: ref.name, value: ref.id }))
              ]} 
              isStack 
              pipelineKey={pipelineKey} 
              itemPath={itemPath} 
            />
          )}
          {item.subtype === 'Shape' && (
            <>
              <ParameterInput 
                label="Shape" 
                nodeId={nodeId} 
                paramName="shapeType" 
                type="select" 
                options={[
                  { label: 'Rectangle', value: 'Rectangle' },
                  { label: 'Circle', value: 'Circle' },
                  { label: 'Star', value: 'Star' },
                  { label: 'Polygon', value: 'Polygon' }
                ]}
                isStack 
                pipelineKey={pipelineKey} 
                itemPath={itemPath} 
              />
              <ParameterInput label="Width" nodeId={nodeId} paramName="width" min={1} max={2000} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
              <ParameterInput label="Height" nodeId={nodeId} paramName="height" min={1} max={2000} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
              
              {item.params.shapeType?.value === 'Rectangle' && (
                <ParameterInput label="Corner Radius" nodeId={nodeId} paramName="cornerRadius" min={0} max={500} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
              )}

              {item.params.shapeType?.value === 'Star' && (
                <>
                  <ParameterInput label="Points" nodeId={nodeId} paramName="points" min={3} max={50} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
                  <ParameterInput label="Inner Radius" nodeId={nodeId} paramName="innerRadius" min={0} max={1000} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
                  <ParameterInput label="Outer Radius" nodeId={nodeId} paramName="outerRadius" min={0} max={1000} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
                  <ParameterInput label="Roundness" nodeId={nodeId} paramName="roundness" min={0} max={100} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
                </>
              )}

              {item.params.shapeType?.value === 'Polygon' && (
                <>
                  <ParameterInput label="Sides" nodeId={nodeId} paramName="sides" min={3} max={50} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
                  <ParameterInput label="Roundness" nodeId={nodeId} paramName="roundness" min={0} max={100} isStack pipelineKey={pipelineKey} itemPath={itemPath} />
                </>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'layer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <ParameterInput 
            label="Opacity" 
            nodeId={nodeId} 
            paramName="opacity" 
            isStack 
            pipelineKey={pipelineKey} 
            itemPath={itemPath} 
            min={0} max={100} 
          />
          <ParameterInput 
            label="Blend Mode" 
            nodeId={nodeId} 
            paramName="blendMode" 
            type="select" 
            options={[
              { label: 'Normal', value: 'Normal' },
              { label: 'Multiply', value: 'Multiply' },
              { label: 'Screen', value: 'Screen' },
              { label: 'Add', value: 'Add' },
              { label: 'Overlay', value: 'Overlay' },
              { label: 'Soft Light', value: 'SoftLight' },
              { label: 'Hard Light', value: 'HardLight' },
              { label: 'Color Dodge', value: 'ColorDodge' },
              { label: 'Color Burn', value: 'ColorBurn' },
              { label: 'Difference', value: 'Difference' },
              { label: 'Exclusion', value: 'Exclusion' },
              { label: 'Hue', value: 'Hue' },
              { label: 'Saturation', value: 'Saturation' },
              { label: 'Color', value: 'Color' },
              { label: 'Luminosity', value: 'Luminosity' }
            ]}
            isStack 
            pipelineKey={pipelineKey} 
            itemPath={itemPath} 
          />
        </div>
      )}

      {activeTab === 'sub' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <StackList 
            nodeId={nodeId} 
            pipelineKey={pipelineKey} 
            parentPath={[...itemPath, subStackType]} 
            selectedId={selectedSubId} 
            onSelect={setSelectedSubId} 
          />
          {selectedSubId && (
            <StackInspector 
              nodeId={nodeId} 
              pipelineKey={pipelineKey} 
              itemPath={[...itemPath, subStackType, selectedSubId]} 
            />
          )}
        </div>
      )}
    </div>
  );
});
