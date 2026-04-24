import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStore, NLICNode, NodeType, Pipeline } from '../store';
import { 
  Eye, Trash2, ChevronDown, ChevronRight, ArrowUpRight, 
  Move, Settings2, Image as ImageIcon, Layers, Calculator,
  Edit2
} from 'lucide-react';
import { ParameterInput, StackList, StackInspector } from './Common';
import { Stage, Container, Graphics } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { NodeRenderer, PipelineRenderer } from '../CanvasEngine';

const MiniPreview: React.FC<{ 
  nodeId: string, 
  pipeline?: Pipeline, 
  pipelineKey?: string,
  split?: boolean, 
  opacity?: number,
  isOutput?: boolean
}> = ({ nodeId, pipeline, pipelineKey, split, opacity = 1, isOutput = false }) => {
  const nodes = useStore(state => state.nodes);
  const engineVersion = useStore(state => state.engineVersion);
  const engineRef = useRef({ nodes, engineVersion });
  
  useEffect(() => {
    engineRef.current = { nodes, engineVersion };
  }, [nodes, engineVersion]);

  const [leftMask, setLeftMask] = useState<PIXI.Graphics | null>(null);
  const [rightMask, setRightMask] = useState<PIXI.Graphics | null>(null);

  const drawLeftMask = useCallback((g: PIXI.Graphics) => {
    g.clear();
    g.beginFill(0xffffff);
    g.drawRect(0, 0, 1920 / 2, 1080);
    g.endFill();
  }, []);

  const drawRightMask = useCallback((g: PIXI.Graphics) => {
    g.clear();
    g.beginFill(0xffffff);
    g.drawRect(1920 / 2, 0, 1920 / 2, 1080);
    g.endFill();
  }, []);

  const scale = Math.min(150 / 1920, 150 / 1080);
  const scaledWidth = 1920 * scale;
  const scaledHeight = 1080 * scale;
  const offsetX = (150 - scaledWidth) / 2;
  const offsetY = (150 - scaledHeight) / 2;

  return (
    <div style={{ width: '150px', height: '150px', backgroundColor: '#000', borderRadius: '6px', overflow: 'hidden', border: '1px solid #2c2c2e', flexShrink: 0, position: 'relative' }}>
      <Stage width={150} height={150} options={{ backgroundAlpha: 0, resolution: 1 }}>
        <Container position={[offsetX, offsetY]} scale={{ x: scale, y: scale }}>
          {isOutput ? (
            <NodeRenderer nodeId={nodeId} engineRef={engineRef} />
          ) : split ? (
            <>
              <Graphics draw={drawLeftMask} ref={setLeftMask} />
              <Graphics draw={drawRightMask} ref={setRightMask} />
              {/* Left half: Original */}
              <Container mask={leftMask}>
                <NodeRenderer nodeId={nodeId} engineRef={engineRef} />
              </Container>
              {/* Right half: Modified */}
              <Container mask={rightMask} alpha={opacity}>
                {pipeline && pipelineKey ? (
                  <PipelineRenderer pipeline={pipeline} nodeId={nodeId} pipelineKey={pipelineKey} engineRef={engineRef} visited={[]} depth={0}>
                    <NodeRenderer nodeId={nodeId} engineRef={engineRef} />
                  </PipelineRenderer>
                ) : (
                  <NodeRenderer nodeId={nodeId} engineRef={engineRef} />
                )}
              </Container>
            </>
          ) : (
            <Container alpha={opacity}>
              {pipeline && pipelineKey ? (
                <PipelineRenderer pipeline={pipeline} nodeId={nodeId} pipelineKey={pipelineKey} engineRef={engineRef} visited={[]} depth={0}>
                  <NodeRenderer nodeId={nodeId} engineRef={engineRef} />
                </PipelineRenderer>
              ) : (
                <NodeRenderer nodeId={nodeId} engineRef={engineRef} />
              )}
            </Container>
          )}
        </Container>
      </Stage>
      {split && (
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '75px', width: '1px', backgroundColor: 'rgba(255,255,255,0.3)', zIndex: 10 }} />
      )}
    </div>
  );
};

interface ItemControlsProps {
  nodeId: string;
  isActive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onSetActive: () => void;
  onDelete: () => void;
  selectedStackItem: { nodeId: string, pipelineKey: string, stackType: string, itemId: string } | null;
  onSelectStackItem: (item: { nodeId: string, pipelineKey: string, stackType: string, itemId: string } | null) => void;
}

export const ItemControls: React.FC<ItemControlsProps> = React.memo(({ 
  nodeId, isActive, isExpanded, onToggle, onSetActive, onDelete, 
  selectedStackItem, onSelectStackItem 
}) => {
  const node = useStore(state => state.nodes[nodeId]);
  const updateNodeParam = useStore(state => state.updateNodeParam);
  const updateConnection = useStore(state => state.updateConnection);
  const getValidReferences = useStore(state => state.getValidReferences);
  const resolveParam = useStore(state => state.resolveParam);
  const extractPipelineToLayerStack = useStore(state => state.extractPipelineToLayerStack);
  const renameNode = useStore(state => state.renameNode);

  const [activeTab, setActiveTab] = useState<'settings' | 'transform'>('settings');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(node?.name || '');

  if (!node) return null;

  const handleImageUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      updateNodeParam(id, 'imageUrl', imageUrl);
    }
  };

  const renderPipeline = (pipelineKey: 'inputA_pipeline' | 'inputB_pipeline' | 'output_pipeline', label: string) => {
    return (
      <div style={{ borderTop: '1px solid #2c2c2e', paddingTop: '12px', marginTop: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'white' }}>{label} Pipeline</span>
          <button 
            className="icon-btn" 
            title="Extract to LayerStack"
            onClick={() => {
              extractPipelineToLayerStack(node.id, pipelineKey);
              onSelectStackItem(null);
            }}
          >
            <ArrowUpRight size={14} />
          </button>
        </div>
        <StackList 
          nodeId={node.id} 
          pipelineKey={pipelineKey} 
          parentPath={['effects']} 
          selectedId={selectedStackItem?.nodeId === node.id && selectedStackItem?.pipelineKey === pipelineKey && selectedStackItem?.stackType === 'effects' ? selectedStackItem.itemId : null}
          onSelect={(itemId) => onSelectStackItem(itemId ? { nodeId: node.id, pipelineKey, stackType: 'effects', itemId } : null)}
        />
        <StackList 
          nodeId={node.id} 
          pipelineKey={pipelineKey} 
          parentPath={['masks']} 
          selectedId={selectedStackItem?.nodeId === node.id && selectedStackItem?.pipelineKey === pipelineKey && selectedStackItem?.stackType === 'masks' ? selectedStackItem.itemId : null}
          onSelect={(itemId) => onSelectStackItem(itemId ? { nodeId: node.id, pipelineKey, stackType: 'masks', itemId } : null)}
        />
        
        {selectedStackItem?.nodeId === node.id && selectedStackItem?.pipelineKey === pipelineKey && (
          <StackInspector 
            nodeId={node.id} 
            pipelineKey={pipelineKey} 
            itemPath={[selectedStackItem.stackType, selectedStackItem.itemId]} 
          />
        )}
      </div>
    );
  };

  return (
    <div style={{ 
      backgroundColor: '#1c1c1e', 
      borderRadius: '10px', 
      border: `1px solid ${isActive ? '#007aff' : '#2c2c2e'}`,
      overflow: 'hidden',
      marginBottom: '8px'
    }}>
      <div 
        onClick={onToggle}
        style={{ 
          padding: '12px 16px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          cursor: 'pointer',
          backgroundColor: isActive ? 'rgba(0, 122, 255, 0.1)' : 'transparent'
        }}
      >
        <div style={{ color: '#8e8e93' }}>
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
        <div style={{ flexGrow: 1 }} onClick={(e) => e.stopPropagation()}>
          {isEditingName ? (
            <input 
              autoFocus
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={() => {
                setIsEditingName(false);
                if (tempName.trim()) renameNode(node.id, tempName.trim());
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setIsEditingName(false);
                  if (tempName.trim()) renameNode(node.id, tempName.trim());
                }
                if (e.key === 'Escape') {
                  setIsEditingName(false);
                  setTempName(node.name);
                }
              }}
              style={{ 
                backgroundColor: '#2c2c2e', 
                border: '1px solid #007aff', 
                color: 'white', 
                fontSize: '0.85rem', 
                padding: '2px 4px', 
                borderRadius: '4px',
                width: '100%'
              }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span 
                onDoubleClick={() => setIsEditingName(true)}
                style={{ fontWeight: '600', fontSize: '0.85rem', color: 'white', cursor: 'text' }}
                title="Double click to rename"
              >
                {node.name}
              </span>
              <button 
                onClick={() => setIsEditingName(true)}
                style={{ background: 'transparent', border: 'none', color: '#4e4e52', cursor: 'pointer', padding: '2px' }}
              >
                <Edit2 size={10} />
              </button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
          <button onClick={onSetActive} className={`icon-btn ${isActive ? 'active' : ''}`}><Eye size={14} /></button>
          <button onClick={onDelete} className="icon-btn danger"><Trash2 size={14} /></button>
        </div>
      </div>

      {isExpanded && (
        <div style={{ padding: '16px', borderTop: '1px solid #2c2c2e', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          
          {node.type === 'Generator' && (
            <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', backgroundColor: '#0a0a0b', padding: '2px', borderRadius: '6px' }}>
              <button 
                onClick={() => setActiveTab('settings')}
                style={{ 
                  flex: 1, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '6px',
                  padding: '6px', 
                  fontSize: '0.7rem', 
                  fontWeight: '600',
                  borderRadius: '4px',
                  backgroundColor: activeTab === 'settings' ? '#2c2c2e' : 'transparent',
                  color: activeTab === 'settings' ? 'white' : '#8e8e93',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <Settings2 size={14} /> Settings
              </button>
              <button 
                onClick={() => setActiveTab('transform')}
                style={{ 
                  flex: 1, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '6px',
                  padding: '6px', 
                  fontSize: '0.7rem', 
                  fontWeight: '600',
                  borderRadius: '4px',
                  backgroundColor: activeTab === 'transform' ? '#2c2c2e' : 'transparent',
                  color: activeTab === 'transform' ? 'white' : '#8e8e93',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <Move size={14} /> Transform
              </button>
            </div>
          )}

          {node.type === 'Generator' && activeTab === 'transform' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <ParameterInput label="X Position" nodeId={node.id} paramName="x" min={-2000} max={4000} />
                <ParameterInput label="Y Position" nodeId={node.id} paramName="y" min={-2000} max={4000} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <ParameterInput label="Width" nodeId={node.id} paramName="width" min={0} max={4000} />
                <ParameterInput label="Height" nodeId={node.id} paramName="height" min={0} max={4000} />
              </div>
              <ParameterInput label="Rotation" nodeId={node.id} paramName="rotation" min={0} max={360} />
            </div>
          )}

          {node.type === 'Generator' && activeTab === 'settings' && (
            <>
              <ParameterInput label="Generator Type" nodeId={node.id} paramName="genType" type="select" options={[
                { label: 'Solid Color', value: 'Solid' },
                { label: 'Gradient', value: 'Gradient' },
                { label: 'Shape', value: 'Shape' },
                { label: 'Image', value: 'Image' },
                { label: 'Noise (Turbulent)', value: 'Noise' }
              ]} />
              
              {resolveParam(node.id, 'genType') === 'Solid' && (
                <ParameterInput label="Color" nodeId={node.id} paramName="color" type="color" />
              )}

              {resolveParam(node.id, 'genType') === 'Gradient' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <ParameterInput label="Gradient Type" nodeId={node.id} paramName="gradientType" type="select" options={[
                    { label: 'Linear', value: 'Linear' },
                    { label: 'Radial', value: 'Radial' }
                  ]} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <ParameterInput label="Color 1" nodeId={node.id} paramName="color" type="color" />
                    <ParameterInput label="Color 2" nodeId={node.id} paramName="color2" type="color" />
                  </div>
                  {resolveParam(node.id, 'gradientType') === 'Linear' ? (
                    <ParameterInput label="Angle" nodeId={node.id} paramName="angle" min={0} max={360} />
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <ParameterInput label="Center X" nodeId={node.id} paramName="centerX" min={0} max={1} step={0.01} />
                        <ParameterInput label="Center Y" nodeId={node.id} paramName="centerY" min={0} max={1} step={0.01} />
                      </div>
                      <ParameterInput label="Radius" nodeId={node.id} paramName="radius" min={0} max={2} step={0.01} />
                    </>
                  )}
                </div>
              )}

              {resolveParam(node.id, 'genType') === 'Shape' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <ParameterInput label="Shape Type" nodeId={node.id} paramName="shapeType" type="select" options={[
                    { label: 'Rectangle', value: 'Rectangle' },
                    { label: 'Circle', value: 'Circle' },
                    { label: 'Star', value: 'Star' },
                    { label: 'Polygon', value: 'Polygon' }
                  ]} />
                  <ParameterInput label="Fill Color" nodeId={node.id} paramName="color" type="color" />
                  
                  {resolveParam(node.id, 'shapeType') === 'Rectangle' && (
                    <ParameterInput label="Corner Radius" nodeId={node.id} paramName="cornerRadius" min={0} max={500} />
                  )}

                  {resolveParam(node.id, 'shapeType') === 'Star' && (
                    <>
                      <ParameterInput label="Points" nodeId={node.id} paramName="points" min={3} max={50} />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <ParameterInput label="Inner Radius" nodeId={node.id} paramName="innerRadius" min={0} max={1000} />
                        <ParameterInput label="Outer Radius" nodeId={node.id} paramName="outerRadius" min={0} max={1000} />
                      </div>
                      <ParameterInput label="Roundness" nodeId={node.id} paramName="roundness" min={0} max={100} />
                    </>
                  )}

                  {resolveParam(node.id, 'shapeType') === 'Polygon' && (
                    <>
                      <ParameterInput label="Sides" nodeId={node.id} paramName="sides" min={3} max={50} />
                      <ParameterInput label="Roundness" nodeId={node.id} paramName="roundness" min={0} max={100} />
                    </>
                  )}
                </div>
              )}

              {resolveParam(node.id, 'genType') === 'Image' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="file-upload-container" style={{ 
                    border: '2px dashed #3a3a3c', 
                    borderRadius: '8px', 
                    padding: '20px', 
                    textAlign: 'center',
                    backgroundColor: '#0a0a0b'
                  }}>
                    <ImageIcon size={24} color="#8e8e93" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '0.75rem', color: '#8e8e93', marginBottom: '12px' }}>
                      {resolveParam(node.id, 'imageUrl') ? 'Image Selected' : 'Drop image or click to upload'}
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => handleImageUpload(node.id, e)} 
                      style={{ display: 'none' }} 
                      id={`file-upload-${node.id}`}
                    />
                    <label 
                      htmlFor={`file-upload-${node.id}`}
                      style={{ 
                        backgroundColor: '#007aff', 
                        color: 'white', 
                        padding: '6px 12px', 
                        borderRadius: '4px', 
                        fontSize: '0.75rem', 
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      Choose File
                    </label>
                  </div>
                  <ParameterInput label="Fit Mode" nodeId={node.id} paramName="fitMode" type="select" options={[
                    { label: 'Cover', value: 'Cover' },
                    { label: 'Contain', value: 'Contain' },
                    { label: 'Stretch', value: 'Stretch' }
                  ]} />
                </div>
              )}

              {resolveParam(node.id, 'genType') === 'Noise' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <ParameterInput label="Scale" nodeId={node.id} paramName="noiseScale" min={0.001} max={1} step={0.001} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <ParameterInput label="Octaves" nodeId={node.id} paramName="noiseOctaves" min={1} max={8} step={1} />
                    <ParameterInput label="Persistence" nodeId={node.id} paramName="noisePersistence" min={0} max={1} step={0.01} />
                  </div>
                  <ParameterInput label="Lacunarity" nodeId={node.id} paramName="noiseLacunarity" min={1} max={4} step={0.01} />
                  <ParameterInput label="Seed" nodeId={node.id} paramName="noiseSeed" min={0} max={1} step={0.0001} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <ParameterInput label="Color 1" nodeId={node.id} paramName="color" type="color" />
                    <ParameterInput label="Color 2" nodeId={node.id} paramName="color2" type="color" />
                  </div>
                </div>
              )}
            </>
          )}

              {node.type === 'CompOp' && (
                <>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <ParameterInput label="Blend Mode" nodeId={node.id} paramName="blendMode" type="select" options={[
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
                        { label: 'Luminosity', value: 'Luminosity' },
                        { label: 'Xor', value: 'Xor' },
                        { label: 'Source In', value: 'SourceIn' },
                        { label: 'Source Out', value: 'SourceOut' },
                        { label: 'Source Atop', value: 'SourceAtop' },
                        { label: 'Destination Over', value: 'DestinationOver' },
                        { label: 'Destination In', value: 'DestinationIn' },
                        { label: 'Destination Out', value: 'DestinationOut' },
                        { label: 'Destination Atop', value: 'DestinationAtop' }
                      ]} />
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', padding: '8px', backgroundColor: '#2c2c2e', borderRadius: '6px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'white' }}>Swap Inputs (B over A)</span>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={resolveParam(node.id, 'swapInputs') || false}
                        onChange={(e) => updateNodeParam(node.id, 'swapInputs', e.target.checked)}
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>

                  {['inputA', 'inputB'].map(port => (
                    <div key={port} style={{ marginBottom: '8px', padding: '8px', backgroundColor: '#0a0a0b', borderRadius: '6px', border: '1px solid #2c2c2e' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label className="param-label" style={{ margin: 0, fontWeight: 'bold' }}>{port === 'inputA' ? 'Input A (Base)' : 'Input B (Top)'}</label>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                        <select 
                          value={node.inputs?.[port]?.nodeId || ''}
                          onChange={(e) => updateConnection(node.id, port, e.target.value || null, node.inputs?.[port]?.channel || 'RGBA')}
                          className="param-input"
                          style={{ flexGrow: 1 }}
                        >
                          <option value="">-- None --</option>
                          {getValidReferences(node.id).map(ref => <option key={ref.id} value={ref.id}>{ref.name}</option>)}
                        </select>
                        <select 
                          value={node.inputs?.[port]?.channel || 'RGBA'}
                          onChange={(e) => updateConnection(node.id, port, node.inputs?.[port]?.nodeId || null, e.target.value as any)}
                          className="param-input"
                          style={{ width: '65px', fontSize: '0.7rem' }}
                        >
                          <option value="RGBA">RGBA</option>
                          <option value="R">R</option>
                          <option value="G">G</option>
                          <option value="B">B</option>
                          <option value="A">A</option>
                        </select>
                      </div>
                      {node.inputs?.[port]?.nodeId && (
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                          <MiniPreview 
                            nodeId={node.inputs[port].nodeId!} 
                            pipeline={port === 'inputA' ? node.inputA_pipeline : node.inputB_pipeline}
                            pipelineKey={port === 'inputA' ? 'inputA_pipeline' : 'inputB_pipeline'}
                            split={true}
                            opacity={(resolveParam(node.id, port === 'inputA' ? 'opacityA' : 'opacityB') ?? 100) / 100}
                          />
                        </div>
                      )}
                      <ParameterInput label="Opacity" nodeId={node.id} paramName={port === 'inputA' ? 'opacityA' : 'opacityB'} min={0} max={100} />
                      {renderPipeline(port === 'inputA' ? 'inputA_pipeline' : 'inputB_pipeline', port === 'inputA' ? 'Input A' : 'Input B')}
                    </div>
                  ))}
                  <div style={{ padding: '8px', backgroundColor: '#0a0a0b', borderRadius: '6px', border: '1px solid #2c2c2e' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                      <MiniPreview 
                        nodeId={node.id} 
                        isOutput={true}
                      />
                    </div>
                    <ParameterInput label="Blend Amount (Final Opacity)" nodeId={node.id} paramName="amount" min={0} max={100} />
                    {renderPipeline('output_pipeline', 'Output')}
                  </div>
                </>
              )}

          {node.type === 'LayerStack' && (
            <>
              <div style={{ marginBottom: '8px' }}>
                <label className="param-label">Input</label>
                <select 
                  value={node.inputs['input'].nodeId || ''}
                  onChange={(e) => updateConnection(node.id, 'input', e.target.value || null, node.inputs['input'].channel)}
                  className="param-input"
                >
                  <option value="">-- None --</option>
                  {getValidReferences(node.id, false, ['CompOp', 'LayerStack']).map(ref => <option key={ref.id} value={ref.id}>{ref.name}</option>)}
                </select>
              </div>
              
              {node.inputs['input'].nodeId && useStore.getState().nodes[node.inputs['input'].nodeId]?.type === 'CompOp' && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <ParameterInput label="Target Port" nodeId={node.id} paramName="targetPort" type="select" options={[
                      { label: 'Output', value: 'output' },
                      { label: 'Input A', value: 'inputA' },
                      { label: 'Input B', value: 'inputB' }
                    ]} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <ParameterInput label="Target Stack" nodeId={node.id} paramName="targetStack" type="select" options={[
                      { label: 'Effects', value: 'effects' },
                      { label: 'Masks', value: 'masks' }
                    ]} />
                  </div>
                </div>
              )}
              
              {renderPipeline('output_pipeline', 'Stack')}
            </>
          )}

          {node.type === 'MathOp' && (
            <>
              <ParameterInput label="Operation" nodeId={node.id} paramName="operation" type="select" options={[
                { label: 'Add', value: 'Add' },
                { label: 'Subtract', value: 'Subtract' },
                { label: 'Multiply', value: 'Multiply' },
                { label: 'Divide', value: 'Divide' },
                { label: 'Sin', value: 'Sin' },
                { label: 'Cos', value: 'Cos' }
              ]} />
              
              {['inputA', 'inputB'].map(port => (
                <div key={port} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label className="param-label">{port === 'inputA' ? 'Input A' : 'Input B'}</label>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <select 
                      value={node.inputs[port].nodeId || ''}
                      onChange={(e) => updateConnection(node.id, port, e.target.value || null, 'RGBA')}
                      className="param-input"
                      style={{ flexGrow: 1 }}
                    >
                      <option value="">-- Manual Value --</option>
                      {getValidReferences(node.id).map(ref => <option key={ref.id} value={ref.id}>{ref.name}</option>)}
                    </select>
                  </div>
                  {!node.inputs[port].nodeId && (
                    <div style={{ marginTop: '4px' }}>
                      <ParameterInput label="" nodeId={node.id} paramName={port} min={-1000} max={1000} />
                    </div>
                  )}
                </div>
              ))}

              <div style={{ padding: '8px', backgroundColor: '#0a0a0b', borderRadius: '4px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: '#8e8e93' }}>Result: </span>
                <span style={{ fontWeight: 'bold', color: '#007aff' }}>{resolveParam(node.id, 'result')}</span>
              </div>
            </>
          )}

          {node.type === 'Constant' && (
            <ParameterInput label="Value" nodeId={node.id} paramName="value" min={-1000} max={1000} />
          )}
        </div>
      )}
    </div>
  );
});
