import React, { useState, useMemo } from 'react';
import { useStore, NLICNode, NodeType, GenType, ShapeType, EffectType, ParameterValue, ParameterReference } from './store';
import CanvasEngine from './CanvasEngine';
import { 
  Eye, Plus, Image as ImageIcon, Layers, Settings, Grid, Palette, 
  Square, Circle, Star, Hexagon, Wand2, Trash2, CheckCircle2, XCircle,
  Download, Printer, Loader2, ChevronDown, ChevronRight, Activity,
  Sliders, Box, Zap, Scissors, Calculator, Link, Link2Off, PlusCircle, MinusCircle, X, Divide,
  MoreVertical, GripVertical, Copy, ArrowUpRight, Move, Settings2, Pin
} from 'lucide-react';
import { exportProject } from './exportUtils';
import { ItemControls } from './components/ItemControls';

const App: React.FC = () => {
  const { 
    nodes, 
    nodeOrder,
    addNode, 
    updateNodeParam, 
    updateConnection, 
    activePreviewId,
    setActivePreview, 
    getValidReferences,
    previewSettings,
    updatePreviewSettings,
    toggleChannel,
    toggleAllChannels,
    deleteNode,
    exportSettings,
    updateExportSettings,
    isExporting,
    setExporting,
    reorderNodes,
    resolveParam,
    extractPipelineToLayerStack,
    loadDefaultScene
  } = useStore();

  React.useEffect(() => {
    if (nodeOrder.length === 0) {
      loadDefaultScene();
    }
  }, []);

  const [exportProgress, setExportProgress] = useState(0);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'preview': true,
    'generators': true,
    'compops': true,
    'mathops': false,
    'export': false
  });
  const [previewHeight, setPreviewHeight] = useState(400);
  const [showPreviewSettings, setShowPreviewSettings] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [selectedStackItem, setSelectedStackItem] = useState<{ nodeId: string, pipelineKey: string, stackType: string, itemId: string } | null>(null);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleItem = (id: string) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExport = async () => {
    if (!activePreviewId) return;
    setExporting(true);
    setExportProgress(0);
    try {
      await exportProject(activePreviewId, nodes, exportSettings, (p) => setExportProgress(p));
    } catch (error) {
      console.error('Export failed:', error instanceof Error ? error.message : String(error));
    } finally {
      setExporting(false);
    }
  };

  const handleAddItem = (type: NodeType, subtype?: string) => {
    const id = `${type.toLowerCase()}-${generateId()}`;
    const defaultSubtype = type === 'Generator' ? 'Solid' : subtype;
    const newNode: NLICNode = {
      id,
      type,
      name: `${defaultSubtype || type} ${Object.keys(nodes).length + 1}`,
      inputs: type === 'CompOp' ? { inputA: { nodeId: null, channel: 'RGBA' }, inputB: { nodeId: null, channel: 'RGBA' } } :
              type === 'LayerStack' ? { input: { nodeId: null, channel: 'RGBA' } } :
              type === 'MathOp' ? { inputA: { nodeId: null, channel: 'RGBA' }, inputB: { nodeId: null, channel: 'RGBA' } } : {},
      params: {},
      enabled: true,
      lastUpdated: Date.now()
    };

    if (type === 'CompOp' || type === 'LayerStack' || type === 'Generator') {
      newNode.output_pipeline = { effects: [], masks: [] };
      if (type === 'CompOp') {
        newNode.inputA_pipeline = { effects: [], masks: [] };
        newNode.inputB_pipeline = { effects: [], masks: [] };
      }
    }

    // Initialize default params
    if (type === 'Generator') {
      newNode.params = {
        genType: { value: subtype || 'Solid', reference: null },
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
        // New Shape params
        cornerRadius: { value: 0, reference: null },
        roundness: { value: 0, reference: null },
        // New Gradient params
        gradientType: { value: 'Linear', reference: null },
        angle: { value: 0, reference: null },
        centerX: { value: 0.5, reference: null },
        centerY: { value: 0.5, reference: null },
        radius: { value: 0.5, reference: null },
        // New Noise params
        noiseScale: { value: 0.1, reference: null },
        noiseOctaves: { value: 4, reference: null },
        noisePersistence: { value: 0.5, reference: null },
        noiseLacunarity: { value: 2.0, reference: null },
        noiseSeed: { value: Math.random(), reference: null },
        // New Image params
        fitMode: { value: 'Cover', reference: null }
      };
    } else if (type === 'CompOp') {
      newNode.params = {
        blendMode: { value: 'Normal', reference: null },
        amount: { value: 100, reference: null },
        opacityA: { value: 100, reference: null },
        opacityB: { value: 100, reference: null }
      };
    } else if (type === 'MathOp') {
      newNode.params = {
        operation: { value: 'Add', reference: null },
        inputA: { value: 0, reference: null },
        inputB: { value: 0, reference: null }
      };
    } else if (type === 'Constant') {
      newNode.params = {
        value: { value: 0, reference: null }
      };
    }

    addNode(newNode);
    setExpandedNodes(prev => ({ ...prev, [id]: true }));
  };

  const handleImageUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      updateNodeParam(id, 'imageUrl', imageUrl);
    }
  };

  return (
    <div className="app-container" style={{ 
      display: 'flex', 
      flexDirection: 'column',
      height: '100vh', 
      backgroundColor: '#0a0a0b', 
      color: '#d1d1d6', 
      fontFamily: 'Inter, system-ui, sans-serif',
      overflow: 'hidden'
    }}>
      
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #1c1c1e', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1000 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Activity size={20} color="#007aff" />
          <h1 style={{ fontSize: '1rem', fontWeight: '700', margin: 0, color: 'white' }}>NLICS STUDIO</h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Preview Settings Toggle */}
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowPreviewSettings(!showPreviewSettings)}
              className={`tool-btn ${showPreviewSettings ? 'active' : ''}`}
              title="Preview Settings"
            >
              <Sliders size={16} />
            </button>

            {showPreviewSettings && (
              <div style={{ 
                position: 'absolute', 
                top: '48px', 
                right: '0', 
                backgroundColor: '#1c1c1e', 
                border: '1px solid #3a3a3c', 
                borderRadius: '12px', 
                padding: '16px', 
                width: '240px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                zIndex: 1001
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span className="param-label">Background</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button 
                      onClick={() => updatePreviewSettings({ useBgColor: !previewSettings.useBgColor })}
                      className={`icon-btn ${previewSettings.useBgColor ? 'active' : ''}`}
                      style={{ backgroundColor: previewSettings.useBgColor ? 'rgba(0,122,255,0.2)' : '#2c2c2e', padding: '8px' }}
                    >
                      <Palette size={16} />
                    </button>
                    {previewSettings.useBgColor ? (
                      <input 
                        type="color" 
                        value={previewSettings.bgColor} 
                        onChange={(e) => updatePreviewSettings({ bgColor: e.target.value })} 
                        className="color-picker"
                      />
                    ) : (
                      <button 
                        onClick={() => updatePreviewSettings({ showCheckerboard: !previewSettings.showCheckerboard })}
                        className={`icon-btn ${previewSettings.showCheckerboard ? 'active' : ''}`}
                        style={{ backgroundColor: previewSettings.showCheckerboard ? 'rgba(0,122,255,0.2)' : '#2c2c2e', padding: '8px' }}
                      >
                        <Grid size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span className="param-label">Channels</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {(['r', 'g', 'b', 'a'] as const).map(ch => (
                      <button 
                        key={ch}
                        onClick={() => toggleChannel(ch)}
                        style={{ 
                          flex: 1,
                          height: '28px', 
                          backgroundColor: previewSettings.channels[ch] ? '#007aff' : '#2c2c2e', 
                          border: 'none', 
                          borderRadius: '4px', 
                          color: 'white', 
                          cursor: 'pointer',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          textTransform: 'uppercase'
                        }}
                      >
                        {ch}
                      </button>
                    ))}
                    <button 
                      onClick={() => toggleAllChannels(!Object.values(previewSettings.channels).every(v => v))}
                      style={{ 
                        padding: '0 8px', 
                        height: '28px',
                        backgroundColor: Object.values(previewSettings.channels).every(v => v) ? '#007aff' : '#2c2c2e', 
                        border: 'none', 
                        borderRadius: '4px', 
                        color: 'white', 
                        cursor: 'pointer',
                        fontSize: '9px',
                        fontWeight: 'bold'
                      }}
                    >
                      ALL
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="param-label">Preview Scale</span>
                    <span style={{ fontSize: '10px', color: '#007aff', fontWeight: 'bold' }}>{Math.round(previewSettings.previewScale * 100)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="1.0" 
                    step="0.05" 
                    value={previewSettings.previewScale} 
                    onChange={(e) => updatePreviewSettings({ previewScale: parseFloat(e.target.value) })}
                    style={{ width: '100%', accentColor: '#007aff' }}
                  />
                </div>
              </div>
            )}
          </div>

          <button onClick={() => handleExport()} disabled={isExporting} className="tool-btn primary">
            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          </button>
        </div>
      </div>

      {/* Main Content - Vertical Layout */}
      <div style={{ flexGrow: 1, overflowY: 'auto' }} className="custom-scrollbar">
        
        {/* Section 1: Live Preview */}
        <div style={{ 
          borderBottom: '1px solid #1c1c1e',
          position: previewSettings.stickyPreview ? 'sticky' : 'relative',
          top: previewSettings.stickyPreview ? 0 : 'auto',
          zIndex: previewSettings.stickyPreview ? 100 : 1,
          backgroundColor: '#0a0a0b',
          boxShadow: previewSettings.stickyPreview ? '0 4px 12px rgba(0,0,0,0.5)' : 'none'
        }}>
          <div onClick={() => toggleSection('preview')} className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {expandedSections['preview'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <Eye size={16} color="#007aff" />
              <span>Live Preview</span>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                updatePreviewSettings({ stickyPreview: !previewSettings.stickyPreview });
              }}
              className={`tool-btn ${previewSettings.stickyPreview ? 'active' : ''}`}
              title={previewSettings.stickyPreview ? "Unlock Preview" : "Lock Preview"}
              style={{ padding: '4px', height: 'auto', width: 'auto' }}
            >
              <Pin size={14} style={{ transform: previewSettings.stickyPreview ? 'rotate(0deg)' : 'rotate(45deg)', transition: 'transform 0.2s' }} />
            </button>
          </div>
          {expandedSections['preview'] && (
            <div style={{ height: previewSettings.stickyPreview ? `${previewHeight}px` : '400px', backgroundColor: '#000', position: 'relative' }}>
              <CanvasEngine />
            </div>
          )}
          {previewSettings.stickyPreview && expandedSections['preview'] && (
            <div 
              style={{ height: '24px', cursor: 'ns-resize', backgroundColor: '#1c1c1e', display: 'flex', justifyContent: 'center', alignItems: 'center', borderTop: '1px solid #2c2c2e', touchAction: 'none' }}
              onPointerDown={(e) => {
                e.preventDefault();
                const startY = e.clientY;
                const startHeight = previewHeight;
                const onPointerMove = (moveEvent: PointerEvent) => {
                  setPreviewHeight(Math.max(100, startHeight + moveEvent.clientY - startY));
                };
                const onPointerUp = () => {
                  document.removeEventListener('pointermove', onPointerMove);
                  document.removeEventListener('pointerup', onPointerUp);
                };
                document.addEventListener('pointermove', onPointerMove);
                document.addEventListener('pointerup', onPointerUp);
              }}
            >
              <div style={{ width: '40px', height: '4px', backgroundColor: '#4e4e52', borderRadius: '2px' }} />
            </div>
          )}
        </div>

        {/* Section 2: Generators */}
        <div style={{ borderBottom: '1px solid #1c1c1e' }}>
          <div onClick={() => toggleSection('generators')} className="section-header">
            {expandedSections['generators'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <Box size={16} color="#34c759" />
            <span>Generators</span>
            <button onClick={(e) => { e.stopPropagation(); handleAddItem('Generator'); }} className="add-btn"><Plus size={14} /></button>
          </div>
          {expandedSections['generators'] && (
            <div style={{ padding: '12px' }}>
              {nodeOrder.filter(id => nodes[id]?.type === 'Generator').map(id => (
                <ItemControls 
                  key={id}
                  nodeId={id}
                  isActive={activePreviewId === id}
                  isExpanded={expandedNodes[id]}
                  onToggle={() => toggleItem(id)}
                  onSetActive={() => setActivePreview(id)}
                  onDelete={() => deleteNode(id)}
                  selectedStackItem={selectedStackItem}
                  onSelectStackItem={setSelectedStackItem}
                />
              ))}
            </div>
          )}
        </div>

        {/* Section 3: Composite Operations */}
        <div style={{ borderBottom: '1px solid #1c1c1e' }}>
          <div onClick={() => toggleSection('compops')} className="section-header">
            {expandedSections['compops'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <Layers size={16} color="#5856d6" />
            <span>Composite Operations</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={(e) => { e.stopPropagation(); handleAddItem('CompOp'); }} className="add-btn" title="Add Blender"><Layers size={14} /></button>
              <button onClick={(e) => { e.stopPropagation(); handleAddItem('LayerStack'); }} className="add-btn" title="Add Layer Stack"><Zap size={14} /></button>
            </div>
          </div>
          {expandedSections['compops'] && (
            <div style={{ padding: '12px' }}>
              {nodeOrder.filter(id => nodes[id]?.type === 'CompOp' || nodes[id]?.type === 'LayerStack').map(id => (
                <ItemControls 
                  key={id}
                  nodeId={id}
                  isActive={activePreviewId === id}
                  isExpanded={expandedNodes[id]}
                  onToggle={() => toggleItem(id)}
                  onSetActive={() => setActivePreview(id)}
                  onDelete={() => deleteNode(id)}
                  selectedStackItem={selectedStackItem}
                  onSelectStackItem={setSelectedStackItem}
                />
              ))}
            </div>
          )}
        </div>

        {/* Section 4: Math Operations */}
        <div style={{ borderBottom: '1px solid #1c1c1e' }}>
          <div onClick={() => toggleSection('mathops')} className="section-header">
            {expandedSections['mathops'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <Calculator size={16} color="#ff9500" />
            <span>Math Operations</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={(e) => { e.stopPropagation(); handleAddItem('Constant'); }} className="add-btn" title="Add Constant"><PlusCircle size={14} /></button>
              <button onClick={(e) => { e.stopPropagation(); handleAddItem('MathOp'); }} className="add-btn" title="Add Math Op"><Calculator size={14} /></button>
            </div>
          </div>
          {expandedSections['mathops'] && (
            <div style={{ padding: '12px' }}>
              {nodeOrder.filter(id => nodes[id]?.type === 'MathOp' || nodes[id]?.type === 'Constant').map(id => (
                <ItemControls 
                  key={id}
                  nodeId={id}
                  isActive={activePreviewId === id}
                  isExpanded={expandedNodes[id]}
                  onToggle={() => toggleItem(id)}
                  onSetActive={() => setActivePreview(id)}
                  onDelete={() => deleteNode(id)}
                  selectedStackItem={selectedStackItem}
                  onSelectStackItem={setSelectedStackItem}
                />
              ))}
            </div>
          )}
        </div>

        {/* Section 5: Export Settings */}
        <div style={{ borderBottom: '1px solid #1c1c1e' }}>
          <div onClick={() => toggleSection('export')} className="section-header">
            {expandedSections['export'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <Settings size={16} color="#8e8e93" />
            <span>Export & Print Settings</span>
          </div>
          {expandedSections['export'] && (
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="param-group">
                  <label className="param-label">Width (in)</label>
                  <input type="number" step="0.1" value={exportSettings.width} onChange={(e) => updateExportSettings({ width: parseFloat(e.target.value) })} className="param-input" />
                </div>
                <div className="param-group">
                  <label className="param-label">Height (in)</label>
                  <input type="number" step="0.1" value={exportSettings.height} onChange={(e) => updateExportSettings({ height: parseFloat(e.target.value) })} className="param-input" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="param-group">
                  <label className="param-label">DPI</label>
                  <select value={exportSettings.dpi} onChange={(e) => updateExportSettings({ dpi: parseInt(e.target.value) })} className="param-input">
                    <option value="72">72</option>
                    <option value="150">150</option>
                    <option value="300">300</option>
                  </select>
                </div>
                <div className="param-group">
                  <label className="param-label">Bleed (in)</label>
                  <input type="number" step="0.0625" value={exportSettings.bleed} onChange={(e) => updateExportSettings({ bleed: parseFloat(e.target.value) })} className="param-input" />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                <input type="checkbox" checked={exportSettings.showCropMarks} onChange={(e) => updateExportSettings({ showCropMarks: e.target.checked })} />
                Include Crop Marks
              </label>
            </div>
          )}
        </div>

      </div>

      <style>{`
        .section-header {
          padding: 14px 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          background-color: #151517;
          font-weight: 600;
          font-size: 0.9rem;
          user-select: none;
        }
        .section-header:hover {
          background-color: #1c1c1e;
        }
        .section-header span {
          flex-grow: 1;
        }
        .add-btn {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          background-color: #2c2c2e;
          border: none;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .add-btn:hover {
          background-color: #007aff;
        }
        .tool-btn {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background-color: #2c2c2e;
          border: 1px solid #3a3a3c;
          color: #d1d1d6;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .tool-btn.primary {
          background-color: #007aff;
          color: white;
          border: none;
        }
        .icon-btn {
          padding: 6px;
          background: transparent;
          border: none;
          color: #8e8e93;
          cursor: pointer;
          border-radius: 4px;
        }
        .icon-btn:hover {
          color: white;
          background-color: rgba(255,255,255,0.05);
        }
        .icon-btn.active {
          color: #007aff;
        }
        .icon-btn.danger:hover {
          color: #ff453a;
        }
        .param-label {
          display: block;
          font-size: 0.65rem;
          font-weight: 700;
          color: #8e8e93;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .param-input {
          width: 100%;
          padding: 6px 8px;
          background-color: #2c2c2e;
          border: 1px solid #3a3a3c;
          border-radius: 4px;
          color: white;
          font-size: 0.75rem;
          outline: none;
        }
        .param-input:focus {
          border-color: #007aff;
        }
        .color-picker {
          border: none;
          background: transparent;
          width: 30px;
          height: 20px;
          cursor: pointer;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2c2c2e;
          border-radius: 3px;
        }
        .file-input {
          font-size: 0.7rem;
          color: #8e8e93;
        }
      `}</style>
    </div>
  );
};

export default App;
