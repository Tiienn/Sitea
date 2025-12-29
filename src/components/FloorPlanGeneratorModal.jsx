// src/components/FloorPlanGeneratorModal.jsx

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { convertFloorPlanToWorld, calculateScaleFromReference } from '../utils/floorPlanConverter';
import FloorPlanPreview3D from './FloorPlanPreview3D';

// 2D overlay component to visualize AI detection on the original image
function DetectionOverlay({ image, aiData, width = 400 }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imageLoaded || !aiData) return;

    const ctx = canvas.getContext('2d');

    // Calculate scale to fit image in canvas
    const scale = width / img.naturalWidth;
    const height = img.naturalHeight * scale;

    canvas.width = width;
    canvas.height = height;

    // Draw original image
    ctx.drawImage(img, 0, 0, width, height);

    // Draw detected walls
    if (aiData.walls) {
      ctx.strokeStyle = '#14B8A6';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);

      aiData.walls.forEach((wall, i) => {
        const startX = wall.start.x * scale;
        const startY = wall.start.y * scale;
        const endX = wall.end.x * scale;
        const endY = wall.end.y * scale;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Draw wall number at midpoint
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        ctx.fillStyle = '#14B8A6';
        ctx.font = '10px sans-serif';
        ctx.fillText(`${i + 1}`, midX - 4, midY + 4);
      });
    }

    // Draw detected doors (orange circles)
    if (aiData.doors) {
      ctx.fillStyle = '#F59E0B';
      aiData.doors.forEach(door => {
        const x = door.center.x * scale;
        const y = door.center.y * scale;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Draw detected windows (cyan rectangles)
    if (aiData.windows) {
      ctx.fillStyle = '#06B6D4';
      aiData.windows.forEach(window => {
        const x = window.center.x * scale;
        const y = window.center.y * scale;
        ctx.fillRect(x - 8, y - 3, 16, 6);
      });
    }

    // Draw detected room centers
    if (aiData.rooms) {
      ctx.fillStyle = 'rgba(20, 184, 166, 0.3)';
      ctx.strokeStyle = '#14B8A6';
      ctx.lineWidth = 1;
      aiData.rooms.forEach(room => {
        const x = room.center.x * scale;
        const y = room.center.y * scale;
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }
  }, [aiData, imageLoaded, width]);

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay]);

  return (
    <div className="relative">
      <img
        ref={imgRef}
        src={image}
        alt="Floor plan"
        className="hidden"
        onLoad={() => setImageLoaded(true)}
      />
      <canvas
        ref={canvasRef}
        className="w-full rounded-lg"
      />
      <div className="flex items-center gap-4 mt-2 text-xs text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-teal-400"></span> Walls
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span> Doors
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-1.5 bg-cyan-400"></span> Windows
        </span>
      </div>
    </div>
  );
}

export default function FloorPlanGeneratorModal({
  image,
  onGenerate,
  onCancel,
  isPaidUser = true,
}) {
  const [status, setStatus] = useState('analyzing'); // 'analyzing' | 'calibrating' | 'preview' | 'error' | 'upgrade'
  const [aiData, setAiData] = useState(null);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [settings, setSettings] = useState({
    scale: 0.05,
    originX: 0,
    originZ: 0,
    rotation: 0,
    wallHeight: 2.7,
    referenceLength: '',
  });

  // Analyze on mount
  useEffect(() => {
    if (!isPaidUser) {
      setStatus('upgrade');
      return;
    }
    analyzeFloorPlan();
  }, [isPaidUser]);

  const analyzeFloorPlan = async () => {
    setStatus('analyzing');
    setError(null);
    setWarning(null);

    // Set to false for production (real API), true for local testing with mock data
    const USE_MOCK = false;

    try {
      let data;

      if (USE_MOCK) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Mock floor plan data for testing
        data = {
          success: true,
          overallShape: 'L-shaped',
          totalArea: { value: 71, unit: 'm²', source: 'label in image' },
          dimensionsFromImage: [
            { value: 5.37, unit: 'm', description: 'bottom left width' },
            { value: 3.68, unit: 'm', description: 'bottom right width' },
          ],
          walls: [
            { start: { x: 100, y: 100 }, end: { x: 500, y: 100 }, thickness: 20, isExterior: true },
            { start: { x: 500, y: 100 }, end: { x: 500, y: 400 }, thickness: 20, isExterior: true },
            { start: { x: 500, y: 400 }, end: { x: 100, y: 400 }, thickness: 20, isExterior: true },
            { start: { x: 100, y: 400 }, end: { x: 100, y: 100 }, thickness: 20, isExterior: true },
            { start: { x: 300, y: 100 }, end: { x: 300, y: 250 }, thickness: 15, isExterior: false },
            { start: { x: 100, y: 250 }, end: { x: 300, y: 250 }, thickness: 15, isExterior: false },
          ],
          doors: [
            { center: { x: 200, y: 100 }, width: 80, wallIndex: 0 },
            { center: { x: 300, y: 175 }, width: 80, wallIndex: 4 },
          ],
          windows: [
            { center: { x: 400, y: 100 }, width: 100, wallIndex: 0 },
            { center: { x: 500, y: 250 }, width: 100, wallIndex: 1 },
          ],
          rooms: [
            { name: 'Living Room', center: { x: 200, y: 325 }, areaFromLabel: 24 },
            { name: 'Bedroom', center: { x: 400, y: 175 }, areaFromLabel: 16 },
            { name: 'Kitchen', center: { x: 200, y: 175 }, areaFromLabel: 12 },
          ],
          scale: {
            estimatedMetersPerPixel: 0.025,
            confidence: 0.85,
            reasoning: 'Based on standard door width of 0.9m'
          }
        };
      } else {
        // Real API call
        const base64 = image.replace(/^data:image\/\w+;base64,/, '');

        const response = await fetch('/api/analyze-floor-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 }),
        });

        data = await response.json();

        // If API returned an error, show details
        if (!response.ok || (!data.success && data.error)) {
          const errorMsg = data.details
            ? `${data.error}: ${data.details}`
            : (data.error || `Analysis failed: ${response.status}`);
          throw new Error(errorMsg);
        }
      }

      if (!data.success && data.error) {
        throw new Error(data.error);
      }

      // Validate we got useful data
      if (!data.walls || data.walls.length === 0) {
        throw new Error('No walls detected in the floor plan. Please try a clearer image.');
      }

      // Validate quality - check if AI result seems oversimplified
      if (data.walls.length < 4) {
        console.warn('AI detected very few walls, results may be incomplete');
        setWarning('The AI detected only a few walls. Results might not match exactly.');
      }

      if (data.rooms && data.rooms.length === 0) {
        console.warn('AI detected no rooms');
      }

      // Check if this looks like a simplified result (many rooms but few walls)
      const isOversimplified = data.walls.length < 6 && (data.rooms?.length || 0) > 3;
      if (isOversimplified) {
        setWarning('The AI may have simplified the floor plan. Results might not match exactly.');
      }

      setAiData(data);

      // Use AI's scale if available (handle both new and old schema)
      if (data.scale?.pixelsPerMeter && data.scale.pixelsPerMeter > 0) {
        // New schema: pixelsPerMeter
        setSettings(s => ({
          ...s,
          scale: 1 / data.scale.pixelsPerMeter
        }));
      } else if (data.scale?.estimatedMetersPerPixel) {
        // Old schema: estimatedMetersPerPixel
        setSettings(s => ({
          ...s,
          scale: data.scale.estimatedMetersPerPixel
        }));
      }

      setStatus('calibrating');
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.message || 'Failed to analyze floor plan');
      setStatus('error');
    }
  };

  // Generate preview data
  const previewData = useMemo(() => {
    if (!aiData || status !== 'preview') return null;
    return convertFloorPlanToWorld(aiData, settings);
  }, [aiData, settings, status]);

  // Handle calibration
  const handleCalibrate = () => {
    if (settings.referenceLength && aiData?.walls?.length > 0) {
      const lengthMeters = parseFloat(settings.referenceLength);
      if (lengthMeters > 0) {
        const newScale = calculateScaleFromReference(aiData, lengthMeters);
        setSettings(s => ({ ...s, scale: newScale }));
      }
    }
    setStatus('preview');
  };

  // Handle generation
  const handleGenerate = () => {
    const data = convertFloorPlanToWorld(aiData, settings);
    onGenerate(data);
  };

  // Update setting helper
  const updateSetting = (key, value) => {
    setSettings(s => ({ ...s, [key]: value }));
  };

  return (
    <div className="fixed inset-0 bg-[var(--color-bg-primary)]/95 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-4xl bg-[var(--color-bg-secondary)] rounded-2xl shadow-2xl border border-[var(--color-border)] overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--color-accent)]/20 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Generate 3D Floor Plan</h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                {status === 'analyzing' && 'Analyzing your floor plan...'}
                {status === 'calibrating' && 'Set the scale for accurate dimensions'}
                {status === 'preview' && 'Preview and adjust your 3D model'}
                {status === 'error' && 'Something went wrong'}
                {status === 'upgrade' && 'Premium feature'}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-[var(--color-text-muted)] hover:text-white p-2 hover:bg-[var(--color-bg-elevated)] rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* Analyzing State */}
          {status === 'analyzing' && (
            <div className="text-center py-16">
              <div className="w-32 h-32 mx-auto mb-6 rounded-xl overflow-hidden bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
                <img src={image} alt="Floor plan" className="w-full h-full object-contain" />
              </div>
              <div className="w-12 h-12 mx-auto mb-4 border-3 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-white font-medium text-lg mb-2">Analyzing floor plan...</p>
              <p className="text-[var(--color-text-muted)]">Detecting walls, doors, windows, and rooms</p>
              <p className="text-[var(--color-text-muted)] text-sm mt-4">This may take 10-30 seconds</p>
            </div>
          )}

          {/* Calibration State */}
          {status === 'calibrating' && aiData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Image with Detection Overlay */}
              <div className="space-y-4">
                <div className="bg-[var(--color-bg-primary)] rounded-xl overflow-hidden border border-[var(--color-border)] p-3">
                  <DetectionOverlay image={image} aiData={aiData} width={450} />
                </div>

                {/* Detection Summary */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Walls', value: aiData.walls?.length || 0, color: 'text-blue-400' },
                    { label: 'Doors', value: aiData.doors?.length || 0, color: 'text-amber-400' },
                    { label: 'Windows', value: aiData.windows?.length || 0, color: 'text-cyan-400' },
                    { label: 'Rooms', value: aiData.rooms?.length || 0, color: 'text-[var(--color-accent)]' },
                  ].map(stat => (
                    <div key={stat.label} className="bg-[var(--color-bg-elevated)] rounded-lg p-3 text-center">
                      <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {/* AI Confidence */}
                {aiData.scale?.confidence && (
                  <div className="bg-[var(--color-bg-elevated)] rounded-lg p-3">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-[var(--color-text-muted)]">AI Confidence</span>
                      <span className="text-white">{Math.round(aiData.scale.confidence * 100)}%</span>
                    </div>
                    <div className="w-full bg-[var(--color-bg-primary)] rounded-full h-1.5">
                      <div
                        className="bg-[var(--color-accent)] h-1.5 rounded-full transition-all"
                        style={{ width: `${aiData.scale.confidence * 100}%` }}
                      />
                    </div>
                    {aiData.scale.reasoning && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-2">{aiData.scale.reasoning}</p>
                    )}
                  </div>
                )}

                {/* Debug: AI Detection Details */}
                {aiData && (
                  <div className="p-3 bg-gray-700/50 rounded-lg text-xs">
                    <p className="text-gray-300 font-medium mb-2">AI Detection Details:</p>
                    <div className="grid grid-cols-2 gap-2 text-gray-400">
                      <div>Shape: <span className="text-white">{aiData.overallShape || 'Unknown'}</span></div>
                      <div>Total Area: <span className="text-white">{aiData.totalArea?.value || '?'} {aiData.totalArea?.unit || 'm²'}</span></div>
                      <div>Scale Source: <span className="text-white">{aiData.scale?.source || 'estimated'}</span></div>
                      <div>Image Size: <span className="text-white">{aiData.imageSize?.width || '?'}×{aiData.imageSize?.height || '?'}px</span></div>
                    </div>

                    {aiData.rooms?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-gray-300">Detected Rooms:</p>
                        <ul className="mt-1 space-y-1">
                          {aiData.rooms.map((room, i) => (
                            <li key={i} className="text-gray-400">
                              • {room.name} {(room.labeledArea || room.areaFromLabel) ? `(${room.labeledArea || room.areaFromLabel} m²)` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* New schema: dimensions array */}
                    {aiData.dimensions?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-gray-300">Detected Dimensions:</p>
                        <ul className="mt-1">
                          {aiData.dimensions.map((dim, i) => (
                            <li key={i} className="text-gray-400">
                              • {dim.value} {dim.unit} ({dim.pixelLength}px)
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Old schema fallback: dimensionsFromImage */}
                    {!aiData.dimensions?.length && aiData.dimensionsFromImage?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-gray-300">Dimensions from image:</p>
                        <ul className="mt-1">
                          {aiData.dimensionsFromImage.map((dim, i) => (
                            <li key={i} className="text-gray-400">
                              • {dim.value} {dim.unit} ({dim.description})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Warning if quality is low */}
                {warning && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <div className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <p className="text-amber-200 text-sm">{warning}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Settings */}
              <div className="space-y-5">
                <div>
                  <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                    Calibrate Scale
                  </h3>
                  <p className="text-[var(--color-text-muted)] text-sm mb-4">
                    For accurate dimensions, enter the length of the longest wall in your plan.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-[var(--color-text-secondary)] mb-2">
                        Longest wall length
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={settings.referenceLength}
                          onChange={(e) => updateSetting('referenceLength', e.target.value)}
                          placeholder="e.g., 12"
                          step="0.1"
                          min="1"
                          className="flex-1 px-4 py-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-white placeholder:text-[var(--color-text-muted)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent focus:outline-none"
                        />
                        <span className="text-[var(--color-text-muted)] font-medium">meters</span>
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] mt-2">
                        Leave empty to use AI-estimated scale
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm text-[var(--color-text-secondary)] mb-2">
                        Wall height
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={settings.wallHeight}
                          onChange={(e) => updateSetting('wallHeight', parseFloat(e.target.value) || 2.7)}
                          step="0.1"
                          min="2"
                          max="5"
                          className="flex-1 px-4 py-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-white focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent focus:outline-none"
                        />
                        <span className="text-[var(--color-text-muted)] font-medium">meters</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detected Rooms */}
                {aiData.rooms?.length > 0 && (
                  <div>
                    <h3 className="text-white font-medium mb-3">Detected Rooms</h3>
                    <div className="flex flex-wrap gap-2">
                      {aiData.rooms.map((room, i) => (
                        <span
                          key={i}
                          className="px-3 py-1.5 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 rounded-full text-sm text-[var(--color-accent)]"
                        >
                          {room.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Generate Button */}
                <button
                  onClick={handleCalibrate}
                  className="w-full py-3 bg-[var(--color-accent)] hover:opacity-90 rounded-xl text-[var(--color-bg-primary)] font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                  Generate 3D Preview
                </button>
              </div>
            </div>
          )}

          {/* Preview State */}
          {status === 'preview' && previewData && (
            <div className="space-y-4">
              {/* 3D Preview */}
              <div className="bg-[var(--color-bg-primary)] rounded-xl overflow-hidden border border-[var(--color-border)]" style={{ height: '350px' }}>
                <FloorPlanPreview3D
                  walls={previewData.walls}
                  rooms={previewData.rooms}
                />
              </div>

              {/* Adjustment Controls */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs text-[var(--color-text-muted)] mb-1">Scale (mm/px)</label>
                  <input
                    type="range"
                    min="10"
                    max="200"
                    value={settings.scale * 1000}
                    onChange={(e) => updateSetting('scale', parseInt(e.target.value) / 1000)}
                    className="w-full accent-[var(--color-accent)]"
                  />
                  <p className="text-xs text-[var(--color-text-muted)] text-center mt-1">{(settings.scale * 1000).toFixed(0)} mm/px</p>
                </div>
                <div>
                  <label className="block text-xs text-[var(--color-text-muted)] mb-1">Position X</label>
                  <input
                    type="number"
                    value={settings.originX}
                    onChange={(e) => updateSetting('originX', parseFloat(e.target.value) || 0)}
                    step="1"
                    className="w-full px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--color-text-muted)] mb-1">Position Z</label>
                  <input
                    type="number"
                    value={settings.originZ}
                    onChange={(e) => updateSetting('originZ', parseFloat(e.target.value) || 0)}
                    step="1"
                    className="w-full px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--color-text-muted)] mb-1">Rotation</label>
                  <input
                    type="range"
                    min="0"
                    max={360}
                    value={(settings.rotation * 180 / Math.PI)}
                    onChange={(e) => updateSetting('rotation', parseInt(e.target.value) * Math.PI / 180)}
                    className="w-full accent-[var(--color-accent)]"
                  />
                  <p className="text-xs text-[var(--color-text-muted)] text-center mt-1">{Math.round(settings.rotation * 180 / Math.PI)}°</p>
                </div>
              </div>

              {/* Stats Bar */}
              <div className="flex items-center justify-center gap-6 text-sm text-[var(--color-text-muted)] py-2 bg-[var(--color-bg-elevated)] rounded-lg">
                <span><strong className="text-white">{previewData.stats.wallCount}</strong> walls</span>
                <span><strong className="text-white">{previewData.stats.doorCount}</strong> doors</span>
                <span><strong className="text-white">{previewData.stats.windowCount}</strong> windows</span>
                <span><strong className="text-white">{previewData.stats.roomCount}</strong> rooms</span>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setStatus('calibrating')}
                  className="flex-1 py-3 bg-[var(--color-bg-elevated)] hover:bg-[var(--color-border)] rounded-xl text-[var(--color-text-secondary)] font-medium transition-colors"
                >
                  ← Back to Calibration
                </button>
                <button
                  onClick={handleGenerate}
                  className="flex-1 py-3 bg-gradient-to-r from-[var(--color-accent)] to-cyan-500 hover:opacity-90 rounded-xl text-[var(--color-bg-primary)] font-medium transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Build 3D Floor Plan
                </button>
              </div>
            </div>
          )}

          {/* Error State */}
          {status === 'error' && (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-white font-medium text-lg mb-2">Analysis Failed</p>
              <p className="text-[var(--color-text-muted)] mb-6 max-w-md mx-auto">{error}</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={onCancel}
                  className="px-6 py-2 bg-[var(--color-bg-elevated)] hover:bg-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)]"
                >
                  Cancel
                </button>
                <button
                  onClick={analyzeFloorPlan}
                  className="px-6 py-2 bg-[var(--color-accent)] hover:opacity-90 rounded-lg text-[var(--color-bg-primary)]"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Upgrade State (Free Users) */}
          {status === 'upgrade' && (
            <div className="flex flex-col items-center justify-center py-20 min-h-[400px]">
              {/* Centered Icon */}
              <div className="w-20 h-20 mb-6 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-2xl flex items-center justify-center border border-amber-500/30">
                <svg className="w-10 h-10 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>

              {/* Title */}
              <h3 className="text-white font-semibold text-xl mb-3">Premium Feature</h3>

              {/* Description */}
              <p className="text-[var(--color-text-muted)] text-center max-w-sm mb-2">
                AI-powered floor plan generation is available for Pro users.
              </p>
              <p className="text-[var(--color-text-muted)] text-center text-sm max-w-sm mb-8">
                Upgrade to automatically create 3D buildings from your floor plans with walls, doors, windows, and rooms detected instantly.
              </p>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={onCancel}
                  className="px-8 py-3 bg-[var(--color-bg-elevated)] hover:bg-[var(--color-border)] rounded-xl text-[var(--color-text-secondary)] font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => window.location.href = '/pricing'}
                  className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 rounded-xl text-white font-medium transition-all shadow-lg shadow-amber-500/20"
                >
                  Upgrade to Pro
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
