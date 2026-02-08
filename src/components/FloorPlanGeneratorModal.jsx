// src/components/FloorPlanGeneratorModal.jsx

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { convertFloorPlanToWorld, calculateScaleFromReference } from '../utils/floorPlanConverter';
import FloorPlanPreview3D from './FloorPlanPreview3D';
import { supabase } from '../lib/supabaseClient';

// Interactive 2D overlay component with zoom, pan, and element editing
function DetectionOverlay({
  image,
  aiData,
  width = 400,
  calibrationMode = false,
  calibrationPoints = [],
  onCalibrationClick = null,
  editMode = false,
  selectedElement = null,
  onSelectElement = null,
  onUpdateElement = null,
  onDeleteElement = null,
  onDragEnd = null,
  drawMode = null, // 'wall' | 'door' | 'window' | null
  drawPoints = [],
  onDrawClick = null,
  elementFilter = null, // 'wall' | 'door' | 'window' | null (null = all)
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [baseScale, setBaseScale] = useState(1); // Scale to fit image in container

  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });

  // Dragging state for editing
  const [isDragging, setIsDragging] = useState(false);
  const [dragTarget, setDragTarget] = useState(null); // { type: 'wall-start' | 'wall-end' | 'door' | 'window', index }
  const [shiftHeld, setShiftHeld] = useState(false);

  // Find nearest wall to a point (for placing doors/windows)
  const findNearestWall = useCallback((x, y) => {
    if (!aiData?.walls) return null;
    let nearest = null;
    let nearestDist = Infinity;

    for (let i = 0; i < aiData.walls.length; i++) {
      const wall = aiData.walls[i];
      const dist = pointToLineDistance(x, y, wall.start.x, wall.start.y, wall.end.x, wall.end.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = { index: i, wall, distance: dist };
      }
    }

    // Only return if within reasonable distance
    const maxDist = 30 / (baseScale * zoom);
    return nearestDist < maxDist ? nearest : null;
  }, [aiData, baseScale, zoom]);

  // Track shift key
  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Shift') setShiftHeld(true); };
    const handleKeyUp = (e) => { if (e.key === 'Shift') setShiftHeld(false); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Calculate canvas dimensions
  const canvasWidth = width;
  const [canvasHeight, setCanvasHeight] = useState(300);

  // Convert screen coordinates to image pixels
  const screenToImage = useCallback((screenX, screenY) => {
    const imageX = (screenX - pan.x) / (baseScale * zoom);
    const imageY = (screenY - pan.y) / (baseScale * zoom);
    return { x: imageX, y: imageY };
  }, [baseScale, zoom, pan]);

  // Convert image pixels to screen coordinates
  const imageToScreen = useCallback((imageX, imageY) => {
    const screenX = imageX * baseScale * zoom + pan.x;
    const screenY = imageY * baseScale * zoom + pan.y;
    return { x: screenX, y: screenY };
  }, [baseScale, zoom, pan]);

  // Find element at position (respects elementFilter)
  const findElementAt = useCallback((imageX, imageY) => {
    if (!aiData) return null;
    const hitRadius = 10 / (baseScale * zoom); // 10px hit radius in screen space

    // Check walls (including endpoints) - only if filter is null or 'wall'
    if ((!elementFilter || elementFilter === 'wall') && aiData.walls) {
      for (let i = 0; i < aiData.walls.length; i++) {
        const wall = aiData.walls[i];
        // Check start endpoint
        const dStart = Math.hypot(wall.start.x - imageX, wall.start.y - imageY);
        if (dStart < hitRadius) {
          return { type: 'wall-start', index: i, wall };
        }
        // Check end endpoint
        const dEnd = Math.hypot(wall.end.x - imageX, wall.end.y - imageY);
        if (dEnd < hitRadius) {
          return { type: 'wall-end', index: i, wall };
        }
        // Check wall line
        const d = pointToLineDistance(imageX, imageY, wall.start.x, wall.start.y, wall.end.x, wall.end.y);
        if (d < hitRadius) {
          return { type: 'wall', index: i, wall };
        }
      }
    }

    // Check doors - only if filter is null or 'door'
    if ((!elementFilter || elementFilter === 'door') && aiData.doors) {
      for (let i = 0; i < aiData.doors.length; i++) {
        const door = aiData.doors[i];
        const d = Math.hypot(door.center.x - imageX, door.center.y - imageY);
        if (d < hitRadius * 1.5) {
          return { type: 'door', index: i, door };
        }
      }
    }

    // Check windows - only if filter is null or 'window'
    if ((!elementFilter || elementFilter === 'window') && aiData.windows) {
      for (let i = 0; i < aiData.windows.length; i++) {
        const win = aiData.windows[i];
        const d = Math.hypot(win.center.x - imageX, win.center.y - imageY);
        if (d < hitRadius * 1.5) {
          return { type: 'window', index: i, window: win };
        }
      }
    }

    return null;
  }, [aiData, baseScale, zoom, elementFilter]);

  // Point to line distance helper
  function pointToLineDistance(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;
    let xx, yy;
    if (param < 0) { xx = x1; yy = y1; }
    else if (param > 1) { xx = x2; yy = y2; }
    else { xx = x1 + param * C; yy = y1 + param * D; }
    return Math.hypot(px - xx, py - yy);
  }

  // Find nearest snap point from all wall endpoints
  const findSnapPoint = useCallback((x, y, excludeWallIndex, excludeEndpoint) => {
    if (!aiData?.walls) return null;
    const snapDistance = 15 / (baseScale * zoom); // 15px snap radius in screen space

    let nearest = null;
    let nearestDist = snapDistance;

    for (let i = 0; i < aiData.walls.length; i++) {
      const wall = aiData.walls[i];

      // Check start point (skip if it's the one being dragged)
      if (!(i === excludeWallIndex && excludeEndpoint === 'start')) {
        const d = Math.hypot(wall.start.x - x, wall.start.y - y);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = { x: wall.start.x, y: wall.start.y };
        }
      }

      // Check end point
      if (!(i === excludeWallIndex && excludeEndpoint === 'end')) {
        const d = Math.hypot(wall.end.x - x, wall.end.y - y);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = { x: wall.end.x, y: wall.end.y };
        }
      }
    }

    return nearest;
  }, [aiData, baseScale, zoom]);

  // Constrain angle to 45° increments when shift is held
  const constrainAngle = useCallback((fromX, fromY, toX, toY) => {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const length = Math.hypot(dx, dy);
    if (length === 0) return { x: toX, y: toY };

    // Get current angle and snap to nearest 45°
    let angle = Math.atan2(dy, dx);
    const snapAngle = Math.PI / 4; // 45 degrees
    angle = Math.round(angle / snapAngle) * snapAngle;

    return {
      x: fromX + Math.cos(angle) * length,
      y: fromY + Math.sin(angle) * length
    };
  }, []);

  // Draw everything
  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imageLoaded) return;

    const ctx = canvas.getContext('2d');

    // Calculate base scale to fit image
    const scale = width / img.naturalWidth;
    const height = img.naturalHeight * scale;
    setBaseScale(scale);
    setCanvasHeight(height);

    canvas.width = canvasWidth;
    canvas.height = height;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvasWidth, height);

    // Apply zoom and pan transform
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(baseScale * zoom, baseScale * zoom);

    // Draw original image
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);

    if (!aiData) {
      ctx.restore();
      return;
    }

    // Adjust line widths for zoom
    const lineWidth = 2 / (baseScale * zoom);
    const handleRadius = 6 / (baseScale * zoom);

    // Draw detected walls
    if (aiData.walls) {
      aiData.walls.forEach((wall, i) => {
        const isSelected = selectedElement?.type?.startsWith('wall') && selectedElement?.index === i;
        const isDimmed = elementFilter && elementFilter !== 'wall';

        ctx.strokeStyle = isSelected ? '#FBBF24' : isDimmed ? 'rgba(20, 184, 166, 0.3)' : '#14B8A6';
        ctx.lineWidth = isSelected ? lineWidth * 2 : lineWidth;
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.moveTo(wall.start.x, wall.start.y);
        ctx.lineTo(wall.end.x, wall.end.y);
        ctx.stroke();

        // Draw wall number at midpoint
        const midX = (wall.start.x + wall.end.x) / 2;
        const midY = (wall.start.y + wall.end.y) / 2;
        ctx.fillStyle = isSelected ? '#FBBF24' : '#14B8A6';
        ctx.font = `${12 / (baseScale * zoom)}px sans-serif`;
        ctx.fillText(`${i + 1}`, midX + 5 / (baseScale * zoom), midY);

        // Draw endpoint handles only for selected wall in edit mode
        if (editMode && isSelected) {
          // Start handle
          ctx.fillStyle = '#FBBF24';
          ctx.beginPath();
          ctx.arc(wall.start.x, wall.start.y, handleRadius * 1.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(wall.start.x, wall.start.y, handleRadius * 0.5, 0, Math.PI * 2);
          ctx.fill();

          // End handle
          ctx.fillStyle = '#FBBF24';
          ctx.beginPath();
          ctx.arc(wall.end.x, wall.end.y, handleRadius * 1.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(wall.end.x, wall.end.y, handleRadius * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    // Draw detected doors (arc showing swing direction)
    if (aiData.doors) {
      aiData.doors.forEach((door, i) => {
        const isSelected = selectedElement?.type === 'door' && selectedElement?.index === i;
        const isDimmed = elementFilter && elementFilter !== 'door';
        const doorRadius = (door.width || 30) / 2;
        const color = isSelected ? '#FBBF24' : isDimmed ? 'rgba(245, 158, 11, 0.3)' : '#F59E0B';
        const rotation = door.rotation || 0; // 0, 90, 180, 270 degrees
        const isDouble = door.doorType === 'double';

        ctx.save();
        ctx.translate(door.center.x, door.center.y);
        ctx.rotate((rotation * Math.PI) / 180);

        ctx.strokeStyle = color;
        ctx.lineWidth = isSelected ? lineWidth * 2 : lineWidth * 1.5;
        ctx.setLineDash([]);

        if (isDouble) {
          // Double door - "M" shape: two arcs meeting at center, vertical lines on edges
          // Reference: arcs curve from outer-top corners down to meet at center-bottom
          const leafWidth = doorRadius;
          const leftHingeX = -leafWidth;
          const rightHingeX = leafWidth;

          // ========== LEFT DOOR ==========
          // Arc: centered at left hinge, from center (0,0) at 0° to top-left at 270°
          // Use true (counter-clockwise/decreasing angles) for short 90° path
          ctx.beginPath();
          ctx.arc(leftHingeX, 0, leafWidth, 0, Math.PI * 1.5, true);
          ctx.stroke();

          // Door leaf: vertical line from hinge up (door in open position)
          ctx.beginPath();
          ctx.moveTo(leftHingeX, 0);
          ctx.lineTo(leftHingeX, -leafWidth);
          ctx.stroke();

          // ========== RIGHT DOOR ==========
          // Arc: centered at right hinge, from center (0,0) at 180° to top-right at 270°
          // Use false (clockwise/increasing angles) for short 90° path
          ctx.beginPath();
          ctx.arc(rightHingeX, 0, leafWidth, Math.PI, Math.PI * 1.5, false);
          ctx.stroke();

          // Door leaf: vertical line from hinge up (door in open position)
          ctx.beginPath();
          ctx.moveTo(rightHingeX, 0);
          ctx.lineTo(rightHingeX, -leafWidth);
          ctx.stroke();

          // Hinges at outer bottom edges
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(leftHingeX, 0, 3 / (baseScale * zoom), 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(rightHingeX, 0, 3 / (baseScale * zoom), 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Single door - original arc
          // Draw door swing arc (quarter circle)
          ctx.beginPath();
          ctx.arc(0, 0, doorRadius, 0, Math.PI / 2);
          ctx.stroke();

          // Draw door leaf line
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(doorRadius, 0);
          ctx.stroke();

          // Draw hinge point
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(0, 0, 3 / (baseScale * zoom), 0, Math.PI * 2);
          ctx.fill();
        }

        if (isSelected) {
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = lineWidth * 0.5;
          ctx.stroke();
        }

        ctx.restore();
      });
    }

    // Draw detected windows (parallel lines representing glass, aligned to wall)
    if (aiData.windows) {
      aiData.windows.forEach((win, i) => {
        const isSelected = selectedElement?.type === 'window' && selectedElement?.index === i;
        const isDimmed = elementFilter && elementFilter !== 'window';
        const color = isSelected ? '#FBBF24' : isDimmed ? 'rgba(6, 182, 212, 0.3)' : '#06B6D4';
        const winWidth = (win.width || 40) / 2;
        const gap = 3 / (baseScale * zoom);
        const capLength = 4 / (baseScale * zoom);

        // Calculate wall angle if wallIndex is available
        let angle = 0;
        if (win.wallIndex !== undefined && aiData.walls && aiData.walls[win.wallIndex]) {
          const wall = aiData.walls[win.wallIndex];
          angle = Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);
        }

        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        // Perpendicular direction for the gap between lines
        const perpCos = Math.cos(angle + Math.PI/2);
        const perpSin = Math.sin(angle + Math.PI/2);

        ctx.strokeStyle = color;
        ctx.lineWidth = isSelected ? lineWidth * 2 : lineWidth * 1.5;
        ctx.setLineDash([]);

        // Draw two parallel lines along wall direction
        // Line 1 (offset perpendicular)
        ctx.beginPath();
        ctx.moveTo(win.center.x - cos * winWidth + perpCos * gap, win.center.y - sin * winWidth + perpSin * gap);
        ctx.lineTo(win.center.x + cos * winWidth + perpCos * gap, win.center.y + sin * winWidth + perpSin * gap);
        ctx.stroke();

        // Line 2 (offset perpendicular other side)
        ctx.beginPath();
        ctx.moveTo(win.center.x - cos * winWidth - perpCos * gap, win.center.y - sin * winWidth - perpSin * gap);
        ctx.lineTo(win.center.x + cos * winWidth - perpCos * gap, win.center.y + sin * winWidth - perpSin * gap);
        ctx.stroke();

        // Draw end caps (perpendicular to wall)
        ctx.beginPath();
        ctx.moveTo(win.center.x - cos * winWidth + perpCos * (gap + capLength), win.center.y - sin * winWidth + perpSin * (gap + capLength));
        ctx.lineTo(win.center.x - cos * winWidth - perpCos * (gap + capLength), win.center.y - sin * winWidth - perpSin * (gap + capLength));
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(win.center.x + cos * winWidth + perpCos * (gap + capLength), win.center.y + sin * winWidth + perpSin * (gap + capLength));
        ctx.lineTo(win.center.x + cos * winWidth - perpCos * (gap + capLength), win.center.y + sin * winWidth - perpSin * (gap + capLength));
        ctx.stroke();

        if (isSelected) {
          // Selection highlight circle
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = lineWidth * 0.5;
          ctx.setLineDash([2/baseScale/zoom, 2/baseScale/zoom]);
          ctx.beginPath();
          ctx.arc(win.center.x, win.center.y, winWidth + capLength * 2, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });
    }

    // Draw detected room centers (only when not editing)
    if (aiData.rooms && !editMode) {
      ctx.fillStyle = 'rgba(20, 184, 166, 0.3)';
      ctx.strokeStyle = '#14B8A6';
      ctx.lineWidth = lineWidth * 0.5;
      aiData.rooms.forEach(room => {
        ctx.beginPath();
        ctx.arc(room.center.x, room.center.y, 15 / (baseScale * zoom), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }

    ctx.restore(); // Restore from zoom/pan transform

    // Draw calibration points (use imageToScreen for correct positioning with zoom/pan)
    if (calibrationPoints.length > 0) {
      if (calibrationPoints.length === 2) {
        const p1 = imageToScreen(calibrationPoints[0].imageX, calibrationPoints[0].imageY);
        const p2 = imageToScreen(calibrationPoints[1].imageX, calibrationPoints[1].imageY);
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      calibrationPoints.forEach((point, i) => {
        const screenPos = imageToScreen(point.imageX, point.imageY);
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(`${i + 1}`, screenPos.x + 12, screenPos.y + 4);
      });
    }

    // Draw mode indicators
    if (calibrationMode && calibrationPoints.length < 2) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
      ctx.fillRect(0, 0, canvasWidth, height);
      ctx.fillStyle = '#EF4444';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(calibrationPoints.length === 0 ? 'Click first point' : 'Click second point', canvasWidth / 2, 30);
      ctx.textAlign = 'left';
    }

    // Draw new wall being drawn
    if (drawMode === 'wall' && drawPoints.length === 1) {
      const startScreen = imageToScreen(drawPoints[0].x, drawPoints[0].y);
      ctx.strokeStyle = '#22C55E';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(startScreen.x, startScreen.y, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#22C55E';
      ctx.font = '12px sans-serif';
      ctx.fillText('Click to set end point (Shift: 45°)', startScreen.x + 15, startScreen.y + 5);
    }

    // Draw snap indicators on all wall endpoints in edit/draw mode
    if ((editMode || drawMode) && aiData?.walls) {
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(baseScale * zoom, baseScale * zoom);
      const snapRadius = 15 / (baseScale * zoom);

      aiData.walls.forEach(wall => {
        // Draw subtle snap targets
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.3)';
        ctx.lineWidth = 1 / (baseScale * zoom);
        ctx.setLineDash([2 / (baseScale * zoom), 2 / (baseScale * zoom)]);

        ctx.beginPath();
        ctx.arc(wall.start.x, wall.start.y, snapRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(wall.end.x, wall.end.y, snapRadius, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Draw zoom level indicator
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(canvasWidth - 60, 8, 52, 22);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(zoom * 100)}%`, canvasWidth - 12, 23);
    ctx.textAlign = 'left';

  }, [aiData, imageLoaded, width, canvasWidth, calibrationMode, calibrationPoints, editMode, selectedElement, zoom, pan, baseScale, drawMode, drawPoints, imageToScreen]);

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay]);

  // Handle mouse wheel for zoom
  const handleWheel = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // Calculate zoom change
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(4, Math.max(0.5, zoom * delta));

    // Zoom toward mouse position
    const zoomRatio = newZoom / zoom;
    const newPanX = mouseX - (mouseX - pan.x) * zoomRatio;
    const newPanY = mouseY - (mouseY - pan.y) * zoomRatio;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  // Handle mouse down
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    // Scale coordinates to account for CSS display size vs canvas internal resolution
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;
    const imagePos = screenToImage(canvasX, canvasY);

    // Middle mouse button for panning
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      return;
    }

    // Left click
    if (e.button === 0) {
      // Calibration mode
      if (calibrationMode && onCalibrationClick) {
        onCalibrationClick({ canvasX, canvasY, imageX: imagePos.x, imageY: imagePos.y });
        return;
      }

      // Draw mode
      if (drawMode && onDrawClick) {
        let finalPos = imagePos;

        // For door/window, snap to nearest wall
        if (drawMode === 'door' || drawMode === 'window') {
          const nearestWall = findNearestWall(imagePos.x, imagePos.y);
          if (nearestWall) {
            // Project point onto wall line
            const wall = nearestWall.wall;
            const wallDx = wall.end.x - wall.start.x;
            const wallDy = wall.end.y - wall.start.y;
            const wallLen = Math.hypot(wallDx, wallDy);
            const t = Math.max(0.1, Math.min(0.9, ((imagePos.x - wall.start.x) * wallDx + (imagePos.y - wall.start.y) * wallDy) / (wallLen * wallLen)));

            finalPos = {
              x: wall.start.x + t * wallDx,
              y: wall.start.y + t * wallDy
            };
            onDrawClick(finalPos, nearestWall);
          }
          return;
        }

        // For walls, use snap and angle constraints
        if (drawMode === 'wall') {
          // If we have a first point and shift is held, constrain angle
          if (drawPoints.length === 1 && shiftHeld) {
            finalPos = constrainAngle(drawPoints[0].x, drawPoints[0].y, imagePos.x, imagePos.y);
          }

          // Try to snap to existing wall endpoints
          const snapPoint = findSnapPoint(finalPos.x, finalPos.y, -1, null);
          if (snapPoint) {
            finalPos = snapPoint;
          }
        }

        onDrawClick(finalPos, null);
        return;
      }

      // Edit mode - check for element or handle
      if (editMode && onSelectElement) {
        // First, check if clicking on the selected wall's endpoints (for dragging)
        if (selectedElement?.type?.startsWith('wall') && selectedElement?.index !== undefined) {
          const wall = aiData?.walls?.[selectedElement.index];
          if (wall) {
            const hitRadius = 12 / (baseScale * zoom);
            const dStart = Math.hypot(wall.start.x - imagePos.x, wall.start.y - imagePos.y);
            const dEnd = Math.hypot(wall.end.x - imagePos.x, wall.end.y - imagePos.y);

            if (dStart < hitRadius) {
              setIsDragging(true);
              setDragTarget({ type: 'wall-start', index: selectedElement.index });
              return;
            }
            if (dEnd < hitRadius) {
              setIsDragging(true);
              setDragTarget({ type: 'wall-end', index: selectedElement.index });
              return;
            }
          }
        }

        // Check if clicking on selected door (for dragging)
        if (selectedElement?.type === 'door' && selectedElement?.index !== undefined) {
          const door = aiData?.doors?.[selectedElement.index];
          if (door) {
            const hitRadius = 20 / (baseScale * zoom);
            const d = Math.hypot(door.center.x - imagePos.x, door.center.y - imagePos.y);
            if (d < hitRadius) {
              setIsDragging(true);
              setDragTarget({ type: 'door', index: selectedElement.index });
              return;
            }
          }
        }

        // Check if clicking on selected window (for dragging)
        if (selectedElement?.type === 'window' && selectedElement?.index !== undefined) {
          const win = aiData?.windows?.[selectedElement.index];
          if (win) {
            const hitRadius = 20 / (baseScale * zoom);
            const d = Math.hypot(win.center.x - imagePos.x, win.center.y - imagePos.y);
            if (d < hitRadius) {
              setIsDragging(true);
              setDragTarget({ type: 'window', index: selectedElement.index });
              return;
            }
          }
        }

        // Otherwise, select a new element (but don't start dragging)
        const element = findElementAt(imagePos.x, imagePos.y);
        if (element) {
          // Convert endpoint clicks to wall selection (don't auto-drag on first click)
          if (element.type === 'wall-start' || element.type === 'wall-end') {
            onSelectElement({ type: 'wall', index: element.index, wall: element.wall });
          } else {
            onSelectElement(element);
          }
        } else {
          onSelectElement(null);
        }
      }
    }
  };

  // Handle mouse move
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;

    // Panning with middle mouse
    if (isPanning) {
      const dx = e.clientX - lastPanPoint.x;
      const dy = e.clientY - lastPanPoint.y;
      setPan(p => ({ x: p.x + dx, y: p.y + dy }));
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      return;
    }

    // Dragging wall endpoint
    if (isDragging && dragTarget && onUpdateElement) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const canvasX = (e.clientX - rect.left) * scaleX;
      const canvasY = (e.clientY - rect.top) * scaleY;
      let imagePos = screenToImage(canvasX, canvasY);

      if ((dragTarget.type === 'wall-start' || dragTarget.type === 'wall-end') && aiData?.walls) {
        // Get the wall being edited
        const wall = aiData.walls[dragTarget.index];
        const isStart = dragTarget.type === 'wall-start';
        const anchorPoint = isStart ? wall.end : wall.start;

        // If shift is held, constrain to 45° angles from the other endpoint
        if (shiftHeld) {
          imagePos = constrainAngle(anchorPoint.x, anchorPoint.y, imagePos.x, imagePos.y);
        }

        // Try to snap to nearby wall endpoints
        const excludeEndpoint = isStart ? 'start' : 'end';
        const snapPoint = findSnapPoint(imagePos.x, imagePos.y, dragTarget.index, excludeEndpoint);
        if (snapPoint) {
          imagePos = snapPoint;
        }

        onUpdateElement({
          type: dragTarget.type,
          index: dragTarget.index,
          newPosition: imagePos
        });
      }

      // Dragging door - snap to nearest wall
      if (dragTarget.type === 'door' && aiData?.doors) {
        const nearestWall = findNearestWall(imagePos.x, imagePos.y);
        if (nearestWall) {
          // Project point onto wall line
          const wall = nearestWall.wall;
          const wallDx = wall.end.x - wall.start.x;
          const wallDy = wall.end.y - wall.start.y;
          const wallLen = Math.hypot(wallDx, wallDy);
          const t = Math.max(0.1, Math.min(0.9, ((imagePos.x - wall.start.x) * wallDx + (imagePos.y - wall.start.y) * wallDy) / (wallLen * wallLen)));

          const snappedPos = {
            x: wall.start.x + t * wallDx,
            y: wall.start.y + t * wallDy
          };

          onUpdateElement({
            type: 'door',
            index: dragTarget.index,
            newPosition: snappedPos,
            wallIndex: nearestWall.index
          });
        }
      }

      // Dragging window - snap to nearest wall
      if (dragTarget.type === 'window' && aiData?.windows) {
        const nearestWall = findNearestWall(imagePos.x, imagePos.y);
        if (nearestWall) {
          // Project point onto wall line
          const wall = nearestWall.wall;
          const wallDx = wall.end.x - wall.start.x;
          const wallDy = wall.end.y - wall.start.y;
          const wallLen = Math.hypot(wallDx, wallDy);
          const t = Math.max(0.1, Math.min(0.9, ((imagePos.x - wall.start.x) * wallDx + (imagePos.y - wall.start.y) * wallDy) / (wallLen * wallLen)));

          const snappedPos = {
            x: wall.start.x + t * wallDx,
            y: wall.start.y + t * wallDy
          };

          onUpdateElement({
            type: 'window',
            index: dragTarget.index,
            newPosition: snappedPos,
            wallIndex: nearestWall.index
          });
        }
      }
    }

    // Update cursor based on what's under mouse
    if (editMode && !isDragging) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const canvasX = (e.clientX - rect.left) * scaleX;
      const canvasY = (e.clientY - rect.top) * scaleY;
      const imagePos = screenToImage(canvasX, canvasY);

      // Check if hovering over selected wall's endpoints
      if (selectedElement?.type?.startsWith('wall') && selectedElement?.index !== undefined && aiData?.walls) {
        const wall = aiData.walls[selectedElement.index];
        if (wall) {
          const hitRadius = 12 / (baseScale * zoom);
          const dStart = Math.hypot(wall.start.x - imagePos.x, wall.start.y - imagePos.y);
          const dEnd = Math.hypot(wall.end.x - imagePos.x, wall.end.y - imagePos.y);

          if (dStart < hitRadius || dEnd < hitRadius) {
            canvas.style.cursor = 'move';
            return;
          }
        }
      }

      // Check if hovering over selected door
      if (selectedElement?.type === 'door' && selectedElement?.index !== undefined && aiData?.doors) {
        const door = aiData.doors[selectedElement.index];
        if (door) {
          const hitRadius = 20 / (baseScale * zoom);
          const d = Math.hypot(door.center.x - imagePos.x, door.center.y - imagePos.y);
          if (d < hitRadius) {
            canvas.style.cursor = 'move';
            return;
          }
        }
      }

      // Check if hovering over selected window
      if (selectedElement?.type === 'window' && selectedElement?.index !== undefined && aiData?.windows) {
        const win = aiData.windows[selectedElement.index];
        if (win) {
          const hitRadius = 20 / (baseScale * zoom);
          const d = Math.hypot(win.center.x - imagePos.x, win.center.y - imagePos.y);
          if (d < hitRadius) {
            canvas.style.cursor = 'move';
            return;
          }
        }
      }

      // Check for other elements
      const element = findElementAt(imagePos.x, imagePos.y);
      if (element) {
        canvas.style.cursor = 'pointer';
      } else {
        canvas.style.cursor = 'default';
      }
    }
  };

  // Handle mouse up
  const handleMouseUp = (e) => {
    if (e.button === 1) {
      setIsPanning(false);
    }
    if (isDragging) {
      setIsDragging(false);
      setDragTarget(null);
      if (onDragEnd) onDragEnd(); // Notify parent that drag ended
    }
  };

  // Handle key press for delete
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElement && onDeleteElement) {
        e.preventDefault();
        onDeleteElement(selectedElement);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElement, onDeleteElement]);

  // Add wheel event listener with passive: false to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const wheelHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;

      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(prevZoom => {
        const newZoom = Math.min(4, Math.max(0.5, prevZoom * delta));
        const zoomRatio = newZoom / prevZoom;
        setPan(prevPan => ({
          x: mouseX - (mouseX - prevPan.x) * zoomRatio,
          y: mouseY - (mouseY - prevPan.y) * zoomRatio
        }));
        return newZoom;
      });
    };

    canvas.addEventListener('wheel', wheelHandler, { passive: false });
    return () => canvas.removeEventListener('wheel', wheelHandler);
  }, []);

  // Reset zoom/pan
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Determine cursor style
  const getCursor = () => {
    if (isPanning) return 'grabbing';
    if (calibrationMode || drawMode) return 'crosshair';
    if (editMode) return 'default';
    return 'default';
  };

  return (
    <div ref={containerRef} className="relative">
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
        style={{ cursor: getCursor() }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Zoom controls */}
      <div className="absolute top-2 left-2 flex gap-1">
        <button
          onClick={() => setZoom(z => Math.min(4, z * 1.2))}
          className="w-7 h-7 bg-black/60 hover:bg-black/80 rounded text-white text-sm flex items-center justify-center"
          title="Zoom in"
        >+</button>
        <button
          onClick={() => setZoom(z => Math.max(0.5, z / 1.2))}
          className="w-7 h-7 bg-black/60 hover:bg-black/80 rounded text-white text-sm flex items-center justify-center"
          title="Zoom out"
        >−</button>
        <button
          onClick={resetView}
          className="px-2 h-7 bg-black/60 hover:bg-black/80 rounded text-white text-xs flex items-center justify-center"
          title="Reset view"
        >Reset</button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 text-xs text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-teal-400"></span> Walls
        </span>
        <span className="flex items-center gap-1">
          <svg className="w-3 h-3 text-amber-400" viewBox="0 0 12 12">
            <path d="M2 10 A8 8 0 0 1 10 2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            <line x1="2" y1="10" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="2" cy="10" r="1.5" fill="currentColor"/>
          </svg> Doors
        </span>
        <span className="flex items-center gap-1">
          <svg className="w-4 h-3 text-cyan-400" viewBox="0 0 16 12">
            <line x1="1" y1="4" x2="15" y2="4" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="1" y1="2" x2="1" y2="10" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="15" y1="2" x2="15" y2="10" stroke="currentColor" strokeWidth="1.5"/>
          </svg> Windows
        </span>
        {selectedElement && (
          <span className="flex items-center gap-1 text-yellow-400">
            <span className="w-2 h-2 rounded-full bg-yellow-400"></span> Selected
          </span>
        )}
        <span className="ml-auto text-[var(--color-text-muted)]">
          Scroll: zoom • Middle-click: pan
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

  // Scale calibration state
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [calibrationPoints, setCalibrationPoints] = useState([]);
  const [calibrationDistance, setCalibrationDistance] = useState('');
  const [calibrationSuccess, setCalibrationSuccess] = useState(false);

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [selectedElement, setSelectedElement] = useState(null);
  const [drawMode, setDrawMode] = useState(null); // 'wall' | 'door' | 'window' | null
  const [drawPoints, setDrawPoints] = useState([]);
  const [elementFilter, setElementFilter] = useState(null); // 'wall' | 'door' | 'window' | null (null = all)

  // Undo/Redo state
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoingRef = useRef(false); // Prevent saving during undo/redo

  // Scale validation section state
  const [scaleValidationExpanded, setScaleValidationExpanded] = useState(false);
  const [aiDetailsExpanded, setAiDetailsExpanded] = useState(false);
  const [editingWallIndex, setEditingWallIndex] = useState(null);
  const [editingWallLength, setEditingWallLength] = useState('');

  // Display unit state (m, ft, mm)
  const [displayUnit, setDisplayUnit] = useState('m');

  // Unit label helper (must be after displayUnit)
  const unitLabel = displayUnit === 'ft' ? 'feet' : displayUnit === 'mm' ? 'mm' : 'meters';
  const unitShort = displayUnit === 'ft' ? 'ft' : displayUnit === 'mm' ? 'mm' : 'm';

  // Unit conversion helper
  const formatLength = useCallback((meters, decimals = 2) => {
    switch (displayUnit) {
      case 'ft':
        return `${(meters * 3.28084).toFixed(decimals)} ft`;
      case 'mm':
        return `${(meters * 1000).toFixed(0)} mm`;
      default:
        return `${meters.toFixed(decimals)} m`;
    }
  }, [displayUnit]);

  // Cycle through units
  const cycleUnit = () => {
    setDisplayUnit(prev => {
      if (prev === 'm') return 'ft';
      if (prev === 'ft') return 'mm';
      return 'm';
    });
  };

  // Area conversion helper (input is in m²)
  const formatArea = useCallback((sqMeters, decimals = 1) => {
    if (!sqMeters) return '';
    const num = parseFloat(sqMeters);
    switch (displayUnit) {
      case 'ft':
        return `${(num * 10.7639).toFixed(decimals)} ft²`;
      case 'mm':
        return `${(num * 1000000).toFixed(0)} mm²`;
      default:
        return `${num.toFixed(decimals)} m²`;
    }
  }, [displayUnit]);

  // Save current state to history (call this before making changes)
  const saveToHistory = useCallback(() => {
    if (!aiData || isUndoingRef.current) return;

    setHistory(prev => {
      // Remove any future states if we're not at the end
      const newHistory = prev.slice(0, historyIndex + 1);
      // Add current state (deep clone)
      newHistory.push(JSON.parse(JSON.stringify(aiData)));
      // Keep max 50 history entries
      if (newHistory.length > 50) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [aiData, historyIndex]);

  // Undo function
  const undo = useCallback(() => {
    if (historyIndex < 0 || !history[historyIndex]) return;

    isUndoingRef.current = true;

    // Save current state if this is the first undo
    if (historyIndex === history.length - 1 && aiData) {
      setHistory(prev => [...prev, JSON.parse(JSON.stringify(aiData))]);
    }

    setAiData(JSON.parse(JSON.stringify(history[historyIndex])));
    setHistoryIndex(prev => prev - 1);
    setSelectedElement(null);

    setTimeout(() => { isUndoingRef.current = false; }, 0);
  }, [history, historyIndex, aiData]);

  // Redo function
  const redo = useCallback(() => {
    if (historyIndex >= history.length - 2) return;

    isUndoingRef.current = true;

    const nextIndex = historyIndex + 2;
    if (history[nextIndex]) {
      setAiData(JSON.parse(JSON.stringify(history[nextIndex])));
      setHistoryIndex(nextIndex - 1);
      setSelectedElement(null);
    }

    setTimeout(() => { isUndoingRef.current = false; }, 0);
  }, [history, historyIndex]);

  // Rotate door (cycle through 0, 90, 180, 270)
  const handleRotateDoor = useCallback(() => {
    if (!aiData || selectedElement?.type !== 'door') return;
    const index = selectedElement.index;
    if (index === undefined || !aiData.doors?.[index]) return;

    saveToHistory();
    const newDoors = [...aiData.doors];
    const currentRotation = newDoors[index].rotation || 0;
    newDoors[index] = {
      ...newDoors[index],
      rotation: (currentRotation + 90) % 360
    };
    setAiData({ ...aiData, doors: newDoors });
  }, [aiData, selectedElement, saveToHistory]);

  // Toggle door type (single/double)
  const handleToggleDoorType = useCallback(() => {
    if (!aiData || selectedElement?.type !== 'door') return;
    const index = selectedElement.index;
    if (index === undefined || !aiData.doors?.[index]) return;

    saveToHistory();
    const newDoors = [...aiData.doors];
    const currentType = newDoors[index].doorType || 'single';
    newDoors[index] = {
      ...newDoors[index],
      doorType: currentType === 'single' ? 'double' : 'single'
    };
    setAiData({ ...aiData, doors: newDoors });
  }, [aiData, selectedElement, saveToHistory]);

  // Flip selected element (mirror - rotates 180°)
  const handleFlipElement = useCallback(() => {
    if (!aiData || !selectedElement) return;

    saveToHistory();

    if (selectedElement.type === 'door') {
      const index = selectedElement.index;
      if (index === undefined || !aiData.doors?.[index]) return;

      const newDoors = [...aiData.doors];
      const door = newDoors[index];
      const currentRotation = door.rotation || 0;
      const doorRadius = (door.width || 30) / 2;
      const isDouble = door.doorType === 'double';
      const radians = (currentRotation * Math.PI) / 180;

      let offsetX, offsetY;

      if (isDouble) {
        // Double door is horizontally symmetric, visual center at (0, -doorRadius/2)
        const localX = 0;
        const localY = -doorRadius / 2;
        const rotatedOffsetX = localX * Math.cos(radians) - localY * Math.sin(radians);
        const rotatedOffsetY = localX * Math.sin(radians) + localY * Math.cos(radians);
        offsetX = 2 * rotatedOffsetX;
        offsetY = 2 * rotatedOffsetY;
      } else {
        // Single door visual center at (doorRadius/2, doorRadius/2)
        const halfR = doorRadius / 2;
        const rotatedOffsetX = halfR * Math.cos(radians) - halfR * Math.sin(radians);
        const rotatedOffsetY = halfR * Math.sin(radians) + halfR * Math.cos(radians);
        offsetX = 2 * rotatedOffsetX;
        offsetY = 2 * rotatedOffsetY;
      }

      newDoors[index] = {
        ...door,
        rotation: (currentRotation + 180) % 360,
        center: {
          x: door.center.x + offsetX,
          y: door.center.y + offsetY
        }
      };
      setAiData({ ...aiData, doors: newDoors });
    }

    if (selectedElement.type === 'wall' || selectedElement.type === 'wall-start' || selectedElement.type === 'wall-end') {
      const index = selectedElement.index;
      if (index === undefined || !aiData.walls?.[index]) return;

      const newWalls = [...aiData.walls];
      const wall = newWalls[index];
      // Flip wall by swapping start and end points
      newWalls[index] = {
        ...wall,
        start: { ...wall.end },
        end: { ...wall.start }
      };
      setAiData({ ...aiData, walls: newWalls });
    }
  }, [aiData, selectedElement, saveToHistory]);

  // Keyboard shortcuts for undo/redo and rotate
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          // In calibration mode, undo calibration points instead
          if (calibrationMode && calibrationPoints.length > 0) {
            setCalibrationPoints(pts => pts.slice(0, -1));
          } else {
            undo();
          }
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
      // R key to rotate selected door
      if (e.key === 'r' || e.key === 'R') {
        if (selectedElement?.type === 'door') {
          e.preventDefault();
          handleRotateDoor();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, selectedElement, handleRotateDoor, calibrationMode, calibrationPoints]);

  // Check if undo/redo is available
  const canUndoHistory = historyIndex >= 0;
  const canRedo = historyIndex < history.length - 2;
  // In calibration mode, can undo calibration points; otherwise check history
  const canUndo = (calibrationMode && calibrationPoints.length > 0) || canUndoHistory;

  // Combined undo handler for button
  const handleUndo = () => {
    if (calibrationMode && calibrationPoints.length > 0) {
      setCalibrationPoints(pts => pts.slice(0, -1));
    } else {
      undo();
    }
  };

  // Handle element selection
  const handleSelectElement = (element) => {
    setSelectedElement(element);
  };

  // Track if we've saved before this drag operation
  const hasSavedForDrag = useRef(false);

  // Handle element update (drag wall endpoints, doors, windows)
  const handleUpdateElement = (update) => {
    if (!aiData) return;

    const { type, index, newPosition, wallIndex } = update;

    // Save to history only once at the start of dragging
    if (!hasSavedForDrag.current) {
      saveToHistory();
      hasSavedForDrag.current = true;
    }

    if (type === 'wall-start' || type === 'wall-end') {
      const newWalls = [...aiData.walls];
      const wall = { ...newWalls[index] };

      if (type === 'wall-start') {
        wall.start = { x: newPosition.x, y: newPosition.y };
      } else {
        wall.end = { x: newPosition.x, y: newPosition.y };
      }

      newWalls[index] = wall;
      setAiData({ ...aiData, walls: newWalls });
    }

    if (type === 'door') {
      const newDoors = [...aiData.doors];
      newDoors[index] = {
        ...newDoors[index],
        center: { x: newPosition.x, y: newPosition.y },
        wallIndex: wallIndex !== undefined ? wallIndex : newDoors[index].wallIndex
      };
      setAiData({ ...aiData, doors: newDoors });
    }

    if (type === 'window') {
      const newWindows = [...aiData.windows];
      newWindows[index] = {
        ...newWindows[index],
        center: { x: newPosition.x, y: newPosition.y },
        wallIndex: wallIndex !== undefined ? wallIndex : newWindows[index].wallIndex
      };
      setAiData({ ...aiData, windows: newWindows });
    }
  };

  // Reset drag save flag when mouse up
  const handleDragEnd = useCallback(() => {
    hasSavedForDrag.current = false;
  }, []);

  // Handle element deletion
  const handleDeleteElement = (element) => {
    if (!aiData || !element) return;

    saveToHistory(); // Save before deletion

    if (element.type === 'wall' || element.type === 'wall-start' || element.type === 'wall-end') {
      const newWalls = aiData.walls.filter((_, i) => i !== element.index);
      setAiData({ ...aiData, walls: newWalls });
    } else if (element.type === 'door') {
      const newDoors = aiData.doors.filter((_, i) => i !== element.index);
      setAiData({ ...aiData, doors: newDoors });
    } else if (element.type === 'window') {
      const newWindows = aiData.windows.filter((_, i) => i !== element.index);
      setAiData({ ...aiData, windows: newWindows });
    }

    setSelectedElement(null);
  };

  // Handle draw click (for adding new walls, doors, windows)
  const handleDrawClick = (imagePos, nearestWallInfo) => {
    if (drawMode === 'wall') {
      if (drawPoints.length === 0) {
        setDrawPoints([imagePos]);
      } else {
        saveToHistory(); // Save before adding new wall

        // Create new wall from two points
        const newWall = {
          start: { x: drawPoints[0].x, y: drawPoints[0].y },
          end: { x: imagePos.x, y: imagePos.y },
          thickness: 15,
          isExterior: false
        };
        setAiData(prev => ({
          ...prev,
          walls: [...(prev.walls || []), newWall]
        }));
        setDrawPoints([]);
        setDrawMode(null);
      }
    }

    if (drawMode === 'door' && nearestWallInfo) {
      saveToHistory(); // Save before adding new door

      // Calculate a reasonable door width based on wall length
      const wall = nearestWallInfo.wall;
      const wallLength = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
      const doorWidth = Math.min(wallLength * 0.3, Math.max(60, wallLength * 0.15)); // 15-30% of wall, min 60px

      const newDoor = {
        center: { x: imagePos.x, y: imagePos.y },
        width: doorWidth,
        wallIndex: nearestWallInfo.index,
        rotation: 0
      };
      setAiData(prev => ({
        ...prev,
        doors: [...(prev.doors || []), newDoor]
      }));
      setDrawMode(null);
    }

    if (drawMode === 'window' && nearestWallInfo) {
      saveToHistory(); // Save before adding new window

      // Calculate a reasonable window width based on wall length
      const wall = nearestWallInfo.wall;
      const wallLength = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
      const windowWidth = Math.min(wallLength * 0.4, Math.max(80, wallLength * 0.2)); // 20-40% of wall, min 80px

      const newWindow = {
        center: { x: imagePos.x, y: imagePos.y },
        width: windowWidth,
        wallIndex: nearestWallInfo.index
      };
      setAiData(prev => ({
        ...prev,
        windows: [...(prev.windows || []), newWindow]
      }));
      setDrawMode(null);
    }
  };

  // Toggle edit mode
  const toggleEditMode = () => {
    const newMode = !editMode;
    setEditMode(newMode);
    if (!newMode) {
      setSelectedElement(null);
      setDrawMode(null);
      setDrawPoints([]);
      setElementFilter(null); // Reset filter when exiting edit mode
    }
    // Exit calibration mode when entering edit mode
    if (newMode && calibrationMode) {
      setCalibrationMode(false);
      resetCalibration();
    }
  };

  // Handle element filter change
  const handleElementFilterChange = (filter) => {
    const newFilter = elementFilter === filter ? null : filter;
    setElementFilter(newFilter);
    // Clear selection if it doesn't match the new filter
    if (newFilter && selectedElement) {
      const elementType = selectedElement.type?.startsWith('wall') ? 'wall' : selectedElement.type;
      if (elementType !== newFilter) {
        setSelectedElement(null);
      }
    }
  };

  // Handle calibration point click
  const handleCalibrationClick = (point) => {
    if (calibrationPoints.length < 2) {
      setCalibrationPoints([...calibrationPoints, point]);
    }
  };

  // Calculate pixel distance between calibration points
  const calibrationPixelDistance = useMemo(() => {
    if (calibrationPoints.length !== 2) return 0;
    const dx = calibrationPoints[1].imageX - calibrationPoints[0].imageX;
    const dy = calibrationPoints[1].imageY - calibrationPoints[0].imageY;
    return Math.sqrt(dx * dx + dy * dy);
  }, [calibrationPoints]);

  // Apply calibration (converts to meters internally)
  const applyCalibration = () => {
    console.log('[Calibration] Applying...', { calibrationDistance, calibrationPixelDistance, displayUnit });
    let distance = parseFloat(calibrationDistance);
    if (distance > 0 && calibrationPixelDistance > 0) {
      // Convert to meters based on display unit
      if (displayUnit === 'ft') {
        distance = distance * 0.3048;
      } else if (displayUnit === 'mm') {
        distance = distance / 1000;
      }
      const newScale = distance / calibrationPixelDistance; // meters per pixel
      console.log('[Calibration] New scale:', newScale, 'meters/pixel');
      setSettings(s => ({ ...s, scale: newScale }));
      setCalibrationMode(false);
      setCalibrationPoints([]);
      setCalibrationDistance('');
      // Show success indicator
      setCalibrationSuccess(true);
      setTimeout(() => setCalibrationSuccess(false), 3000);
    } else {
      console.log('[Calibration] Invalid values - distance:', distance, 'pixelDist:', calibrationPixelDistance);
    }
  };

  // Reset calibration
  const resetCalibration = () => {
    setCalibrationPoints([]);
    setCalibrationDistance('');
  };

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

        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch('/api/analyze-floor-plan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` }),
          },
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
                <div className="bg-[var(--color-bg-primary)] rounded-xl overflow-hidden border border-[var(--color-border)] p-3 relative">
                  {/* Floating Undo/Redo Toolbar - Bottom of Image Preview */}
                  <div className="absolute bottom-5 left-5 z-10 flex items-center gap-1 pointer-events-auto">
                    <button
                      onClick={handleUndo}
                      disabled={!canUndo}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium backdrop-blur-md transition-all ${
                        canUndo
                          ? 'bg-black/60 text-white hover:bg-black/80 shadow-lg'
                          : 'bg-black/30 text-white/40 cursor-not-allowed'
                      }`}
                      title="Undo (Ctrl+Z)"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                      <span>Undo</span>
                    </button>
                    <button
                      onClick={redo}
                      disabled={!canRedo}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium backdrop-blur-md transition-all ${
                        canRedo
                          ? 'bg-black/60 text-white hover:bg-black/80 shadow-lg'
                          : 'bg-black/30 text-white/40 cursor-not-allowed'
                      }`}
                      title="Redo (Ctrl+Shift+Z)"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                      </svg>
                      <span>Redo</span>
                    </button>
                  </div>

                  <DetectionOverlay
                    image={image}
                    aiData={aiData}
                    width={450}
                    calibrationMode={calibrationMode}
                    calibrationPoints={calibrationPoints}
                    onCalibrationClick={handleCalibrationClick}
                    editMode={editMode}
                    selectedElement={selectedElement}
                    onSelectElement={handleSelectElement}
                    onUpdateElement={handleUpdateElement}
                    onDeleteElement={handleDeleteElement}
                    onDragEnd={handleDragEnd}
                    drawMode={drawMode}
                    drawPoints={drawPoints}
                    onDrawClick={handleDrawClick}
                    elementFilter={elementFilter}
                  />
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

                {/* AI Detection Details - Expandable */}
                {aiData && (
                  <div className="bg-[var(--color-bg-elevated)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                    <button
                      className={`w-full flex items-center justify-between px-4 py-3 transition-all hover:bg-[var(--color-bg-primary)] ${
                        aiDetailsExpanded ? 'border-b border-[var(--color-border)]' : ''
                      }`}
                      onClick={() => setAiDetailsExpanded(!aiDetailsExpanded)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[var(--color-bg-primary)]">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-white">AI Detection Details</p>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {aiDetailsExpanded ? 'Dimensions, rooms, and metadata' : `Shape: ${aiData.overallShape || 'Unknown'}`}
                          </p>
                        </div>
                      </div>
                      <div className={`p-1.5 rounded-full transition-all ${
                        aiDetailsExpanded ? 'bg-gray-500 text-white' : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)]'
                      }`}>
                        <svg className={`w-4 h-4 transition-transform duration-200 ${aiDetailsExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>

                    {aiDetailsExpanded && (
                      <div className="p-4 text-xs space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-gray-400">
                          <div>Shape: <span className="text-white">{aiData.overallShape || 'Unknown'}</span></div>
                          <div>Total Area: <span className="text-white">{aiData.totalArea?.value || '?'} {aiData.totalArea?.unit || 'm²'}</span></div>
                          <div>Scale Source: <span className="text-white">{aiData.scale?.source || 'estimated'}</span></div>
                          <div>Image Size: <span className="text-white">{aiData.imageSize?.width || '?'}×{aiData.imageSize?.height || '?'}px</span></div>
                        </div>

                        {/* Detected Dimensions */}
                        {aiData.dimensions?.length > 0 && (
                          <div>
                            <p className="text-gray-300 font-medium">Detected Dimensions:</p>
                            <ul className="mt-1">
                              {aiData.dimensions.map((dim, i) => (
                                <li key={i} className="text-gray-400">• {dim.value} {dim.unit} ({dim.pixelLength}px)</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Old schema fallback */}
                        {!aiData.dimensions?.length && aiData.dimensionsFromImage?.length > 0 && (
                          <div>
                            <p className="text-gray-300 font-medium">Dimensions from image:</p>
                            <ul className="mt-1">
                              {aiData.dimensionsFromImage.map((dim, i) => (
                                <li key={i} className="text-gray-400">• {dim.value} {dim.unit} ({dim.description})</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Detected Rooms */}
                        {aiData.rooms?.length > 0 && (
                          <div>
                            <p className="text-gray-300 font-medium">Detected Rooms:</p>
                            <ul className="mt-1 space-y-0.5">
                              {aiData.rooms.map((room, i) => (
                                <li key={i} className="text-gray-400">
                                  • {room.name} {(room.labeledArea || room.areaFromLabel) ? `(${formatArea(room.labeledArea || room.areaFromLabel)})` : ''}
                                </li>
                              ))}
                            </ul>
                            {aiData.totalArea?.value && (
                              <p className="text-gray-300 mt-1">Total: {formatArea(aiData.totalArea.value)}</p>
                            )}
                          </div>
                        )}
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
                  <h3 className="text-white font-medium mb-4 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                      Calibrate Scale
                    </span>
                    {/* Unit Switcher */}
                    <button
                      onClick={cycleUnit}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--color-accent)]/20 text-[var(--color-accent)] border border-[var(--color-accent)]/30 hover:bg-[var(--color-accent)]/30 transition-all"
                      title="Click to change display unit"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <span className="uppercase font-bold tracking-wide">
                        {displayUnit === 'm' ? 'Meters' : displayUnit === 'ft' ? 'Feet' : 'mm'}
                      </span>
                      <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                      </svg>
                    </button>
                  </h3>

                  {/* Current Scale Display */}
                  <div className={`mb-4 p-3 rounded-lg border transition-all duration-300 ${
                    calibrationSuccess
                      ? 'bg-green-500/20 border-green-500/50'
                      : 'bg-[var(--color-bg-primary)] border-[var(--color-border)]'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${calibrationSuccess ? 'text-green-400' : 'text-[var(--color-text-muted)]'}`}>
                        {calibrationSuccess ? '✓ Scale Updated!' : 'Current Scale'}
                      </span>
                      <span className={`text-sm font-mono ${calibrationSuccess ? 'text-green-400' : 'text-white'}`}>
                        {(settings.scale * 1000).toFixed(2)} mm/px
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      1 meter = {(1 / settings.scale).toFixed(0)} pixels
                    </p>
                  </div>

                  {/* Click-to-calibrate tool */}
                  <div className="mb-4 bg-[var(--color-bg-elevated)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                    <button
                      onClick={() => {
                        setCalibrationMode(!calibrationMode);
                        if (calibrationMode) resetCalibration();
                      }}
                      className={`w-full flex items-center justify-between px-4 py-3 transition-all ${
                        calibrationMode
                          ? 'bg-gradient-to-r from-red-500/20 to-orange-500/10 border-b border-red-500/30'
                          : 'hover:bg-[var(--color-bg-primary)]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${calibrationMode ? 'bg-red-500/20' : 'bg-[var(--color-bg-primary)]'}`}>
                          <svg className={`w-5 h-5 ${calibrationMode ? 'text-red-400' : 'text-[var(--color-text-muted)]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                          </svg>
                        </div>
                        <div className="text-left">
                          <p className={`font-semibold ${calibrationMode ? 'text-red-400' : 'text-white'}`}>
                            {calibrationMode ? 'Calibration Active' : 'Click-to-Calibrate'}
                          </p>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {calibrationMode ? 'Click to cancel' : 'Click two points on a known dimension'}
                          </p>
                        </div>
                      </div>
                      <div className={`p-1.5 rounded-full ${calibrationMode ? 'bg-red-500 text-white' : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)]'}`}>
                        {calibrationMode ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </div>
                    </button>

                    {calibrationMode && (
                      <div className="p-4 space-y-3">
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center ${
                            calibrationPoints.length >= 1 ? 'bg-red-500' : 'bg-gray-600'
                          } text-white font-bold`}>1</span>
                          <span className={calibrationPoints.length >= 1 ? 'text-white' : 'text-gray-500'}>
                            {calibrationPoints.length >= 1 ? 'First point set' : 'Click first point'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center ${
                            calibrationPoints.length >= 2 ? 'bg-red-500' : 'bg-gray-600'
                          } text-white font-bold`}>2</span>
                          <span className={calibrationPoints.length >= 2 ? 'text-white' : 'text-gray-500'}>
                            {calibrationPoints.length >= 2 ? 'Second point set' : 'Click second point'}
                          </span>
                        </div>

                        {calibrationPoints.length === 2 && (
                          <div className="pt-2 border-t border-[var(--color-border)]">
                            <p className="text-xs text-[var(--color-text-muted)] mb-2">
                              Distance: <span className="text-white">{calibrationPixelDistance.toFixed(0)} pixels</span>
                            </p>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={calibrationDistance}
                                onChange={(e) => setCalibrationDistance(e.target.value)}
                                placeholder={`Distance in ${unitLabel}`}
                                step={displayUnit === 'mm' ? '1' : '0.1'}
                                min="0.1"
                                className="flex-1 px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-white text-sm placeholder:text-[var(--color-text-muted)] focus:ring-2 focus:ring-red-500 focus:border-transparent focus:outline-none"
                              />
                              <span className="text-[var(--color-text-muted)] font-medium text-sm">{unitShort}</span>
                            </div>
                            {/* Preview calculated scale */}
                            {calibrationDistance && parseFloat(calibrationDistance) > 0 && (
                              <div className="mt-2 p-2 bg-[var(--color-bg-primary)] rounded-lg text-xs">
                                <p className="text-[var(--color-text-muted)]">
                                  Scale preview: <span className="text-white">
                                    {(() => {
                                      let dist = parseFloat(calibrationDistance);
                                      if (displayUnit === 'ft') dist *= 0.3048;
                                      else if (displayUnit === 'mm') dist /= 1000;
                                      const scale = dist / calibrationPixelDistance;
                                      return `${(scale * 1000).toFixed(2)} mm/px`;
                                    })()}
                                  </span>
                                </p>
                              </div>
                            )}
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={resetCalibration}
                                className="flex-1 px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-lg text-xs text-white transition-colors"
                              >
                                Reset
                              </button>
                              <button
                                onClick={applyCalibration}
                                disabled={!calibrationDistance || parseFloat(calibrationDistance) <= 0}
                                className="flex-1 px-3 py-1.5 bg-red-500 hover:bg-red-400 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-xs text-white transition-colors"
                              >
                                Apply Scale
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <div className="absolute inset-x-0 top-1/2 border-t border-[var(--color-border)]"></div>
                    <p className="relative bg-[var(--color-bg-secondary)] px-2 mx-auto w-fit text-xs text-[var(--color-text-muted)]">or</p>
                  </div>

                  <div className="space-y-4 mt-4">
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
                          step={displayUnit === 'mm' ? '1' : '0.1'}
                          min="1"
                          className="flex-1 px-4 py-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-white placeholder:text-[var(--color-text-muted)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent focus:outline-none"
                        />
                        <span className="text-[var(--color-text-muted)] font-medium">{unitLabel}</span>
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
                          step={displayUnit === 'mm' ? '100' : '0.1'}
                          min={displayUnit === 'mm' ? '2000' : displayUnit === 'ft' ? '6' : '2'}
                          max={displayUnit === 'mm' ? '5000' : displayUnit === 'ft' ? '16' : '5'}
                          className="flex-1 px-4 py-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-white focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent focus:outline-none"
                        />
                        <span className="text-[var(--color-text-muted)] font-medium">{unitLabel}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════════
                    EDIT TOOLBAR - Professional tool-based UI
                ═══════════════════════════════════════════════════════════════ */}
                <div className="bg-[var(--color-bg-elevated)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                  {/* Toolbar Header - Edit Mode Toggle */}
                  <button
                    onClick={toggleEditMode}
                    className={`w-full flex items-center justify-between px-4 py-3 transition-all ${
                      editMode
                        ? 'bg-gradient-to-r from-yellow-500/20 to-amber-500/10 border-b border-yellow-500/30'
                        : 'hover:bg-[var(--color-bg-primary)]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${editMode ? 'bg-yellow-500/20' : 'bg-[var(--color-bg-primary)]'}`}>
                        <svg className={`w-5 h-5 ${editMode ? 'text-yellow-400' : 'text-[var(--color-text-muted)]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <p className={`font-semibold ${editMode ? 'text-yellow-400' : 'text-white'}`}>
                          {editMode ? 'Edit Mode Active' : 'Edit Elements'}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {editMode ? 'Click to exit editing' : 'Modify walls, doors, and windows'}
                        </p>
                      </div>
                    </div>
                    <div className={`p-1.5 rounded-full ${editMode ? 'bg-yellow-500 text-black' : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)]'}`}>
                      {editMode ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </div>
                  </button>

                  {/* Expanded Edit Tools - Only when Edit Mode is active */}
                  {editMode && (
                    <div className="p-3 space-y-3">
                      {/* Element Type Filter - Large Segmented Control */}
                      <div>
                        <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2 px-1">Select Element Type</p>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => handleElementFilterChange('wall')}
                            className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${
                              elementFilter === 'wall'
                                ? 'bg-teal-500/20 border-teal-500 text-teal-400'
                                : 'bg-[var(--color-bg-primary)] border-transparent hover:border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-white'
                            }`}
                          >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5h16M4 19h16" />
                            </svg>
                            <span className="text-sm font-medium">Walls</span>
                            <span className="text-xs opacity-60">{aiData.walls?.length || 0}</span>
                          </button>
                          <button
                            onClick={() => handleElementFilterChange('door')}
                            className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${
                              elementFilter === 'door'
                                ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                                : 'bg-[var(--color-bg-primary)] border-transparent hover:border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-white'
                            }`}
                          >
                            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 20h4V4H4v16zm4-8h2" />
                              <path d="M8 20 Q16 20 16 12" strokeWidth={2} fill="none" />
                            </svg>
                            <span className="text-sm font-medium">Doors</span>
                            <span className="text-xs opacity-60">{aiData.doors?.length || 0}</span>
                          </button>
                          <button
                            onClick={() => handleElementFilterChange('window')}
                            className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${
                              elementFilter === 'window'
                                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                                : 'bg-[var(--color-bg-primary)] border-transparent hover:border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-white'
                            }`}
                          >
                            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <rect x="4" y="6" width="16" height="12" rx="1" strokeWidth={2} />
                              <line x1="12" y1="6" x2="12" y2="18" strokeWidth={2} />
                              <line x1="4" y1="12" x2="20" y2="12" strokeWidth={2} />
                            </svg>
                            <span className="text-sm font-medium">Windows</span>
                            <span className="text-xs opacity-60">{aiData.windows?.length || 0}</span>
                          </button>
                        </div>
                        {elementFilter && (
                          <button
                            onClick={() => setElementFilter(null)}
                            className="mt-2 w-full text-xs text-[var(--color-text-muted)] hover:text-white py-1 transition-colors"
                          >
                            Clear filter
                          </button>
                        )}
                      </div>

                      <div className="h-px bg-[var(--color-border)]"></div>

                      {/* Add New Elements */}
                      <div>
                        <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2 px-1">Add New</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setDrawMode(drawMode === 'wall' ? null : 'wall'); setDrawPoints([]); }}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium transition-all ${
                              drawMode === 'wall' ? 'bg-teal-500 text-white' : 'bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] hover:text-teal-400'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span className="text-sm">Wall</span>
                          </button>
                          <button
                            onClick={() => { setDrawMode(drawMode === 'door' ? null : 'door'); setDrawPoints([]); }}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium transition-all ${
                              drawMode === 'door' ? 'bg-amber-500 text-white' : 'bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] hover:text-amber-400'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span className="text-sm">Door</span>
                          </button>
                          <button
                            onClick={() => { setDrawMode(drawMode === 'window' ? null : 'window'); setDrawPoints([]); }}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium transition-all ${
                              drawMode === 'window' ? 'bg-cyan-500 text-white' : 'bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] hover:text-cyan-400'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span className="text-sm">Window</span>
                          </button>
                        </div>
                      </div>

                      {/* Selection Actions */}
                      {selectedElement && (
                        <>
                          <div className="h-px bg-[var(--color-border)]"></div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-[var(--color-text-muted)]">
                                Selected: {selectedElement.type === 'door' ? (aiData.doors?.[selectedElement.index]?.doorType === 'double' ? 'Double Door' : 'Single Door') : selectedElement.type === 'window' ? 'Window' : `Wall ${selectedElement.index + 1}`}
                              </p>
                              <button onClick={() => handleDeleteElement(selectedElement)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30" title="Delete (Del)">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                <span>Delete</span>
                              </button>
                            </div>
                            {/* Door actions: Rotate, Flip, and Single/Double toggle */}
                            {selectedElement?.type === 'door' && (
                              <div className="flex items-center gap-2">
                                <button onClick={handleRotateDoor} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" title="Rotate (R)">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                  <span>Rotate</span>
                                </button>
                                <button onClick={handleFlipElement} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-purple-500/20 text-purple-400 hover:bg-purple-500/30" title="Flip swing direction">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                  </svg>
                                  <span>Flip</span>
                                </button>
                                {/* Single/Double toggle - only when Door filter is active */}
                                {elementFilter === 'door' && (
                                  <button
                                    onClick={handleToggleDoorType}
                                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                      aiData.doors?.[selectedElement.index]?.doorType === 'double'
                                        ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'
                                        : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                                    }`}
                                    title="Toggle single/double door"
                                  >
                                    {aiData.doors?.[selectedElement.index]?.doorType === 'double' ? (
                                      <>
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                          <rect x="3" y="4" width="8" height="16" rx="1" strokeWidth={2} />
                                          <rect x="13" y="4" width="8" height="16" rx="1" strokeWidth={2} />
                                        </svg>
                                        <span>Double</span>
                                      </>
                                    ) : (
                                      <>
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                          <rect x="6" y="4" width="12" height="16" rx="1" strokeWidth={2} />
                                          <circle cx="15" cy="12" r="1" fill="currentColor" />
                                        </svg>
                                        <span>Single</span>
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            )}
                            {/* Wall actions: Flip */}
                            {(selectedElement?.type === 'wall' || selectedElement?.type === 'wall-start' || selectedElement?.type === 'wall-end') && (
                              <div className="flex items-center gap-2">
                                <button onClick={handleFlipElement} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-purple-500/20 text-purple-400 hover:bg-purple-500/30" title="Flip wall direction">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                  </svg>
                                  <span>Flip</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Edit Mode Instructions */}
                {editMode && !selectedElement && !drawMode && (
                  <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs text-yellow-200">
                    <p className="font-medium mb-1">Edit Mode Active</p>
                    <ul className="space-y-0.5 text-yellow-200/80">
                      <li>• Click to select wall/door/window</li>
                      <li>• Drag to reposition</li>
                      <li>• Hold Shift for 45°/90° angles</li>
                    </ul>
                  </div>
                )}

                {/* Draw mode instructions */}
                {editMode && drawMode && (
                  <div className={`p-2 border rounded-lg text-xs ${
                    drawMode === 'wall' ? 'bg-green-500/10 border-green-500/20 text-green-200' :
                    drawMode === 'door' ? 'bg-amber-500/10 border-amber-500/20 text-amber-200' :
                    'bg-cyan-500/10 border-cyan-500/20 text-cyan-200'
                  }`}>
                    <p className="font-medium mb-1">
                      {drawMode === 'wall' && 'Drawing Wall'}
                      {drawMode === 'door' && 'Placing Door'}
                      {drawMode === 'window' && 'Placing Window'}
                    </p>
                    <p className="opacity-80">
                      {drawMode === 'wall' && 'Click two points to create a wall.'}
                      {drawMode === 'door' && 'Click on a wall to place a door.'}
                      {drawMode === 'window' && 'Click on a wall to place a window.'}
                    </p>
                  </div>
                )}

                {/* ═══════════════════════════════════════════════════════════════
                    SCALE VALIDATION - Expandable wall lengths editor
                ═══════════════════════════════════════════════════════════════ */}
                {aiData.walls?.length > 0 && settings.scale > 0 && (
                  <div className="bg-[var(--color-bg-elevated)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                    <button
                      className={`w-full flex items-center justify-between px-4 py-3 transition-all hover:bg-[var(--color-bg-primary)] ${
                        scaleValidationExpanded ? 'border-b border-[var(--color-border)]' : ''
                      }`}
                      onClick={() => setScaleValidationExpanded(!scaleValidationExpanded)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[var(--color-bg-primary)]">
                          <svg className="w-5 h-5 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-white">Scale Validation</p>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {scaleValidationExpanded ? 'Click a wall to edit' : `${aiData.walls.length} walls detected`}
                          </p>
                        </div>
                      </div>
                      <div className={`p-1.5 rounded-full transition-all ${
                        scaleValidationExpanded ? 'bg-[var(--color-accent)] text-black' : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)]'
                      }`}>
                        <svg className={`w-4 h-4 transition-transform duration-200 ${scaleValidationExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>

                    {!scaleValidationExpanded && (
                      <div className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {aiData.walls.slice(0, 6).map((wall, i) => {
                            const dx = wall.end.x - wall.start.x;
                            const dy = wall.end.y - wall.start.y;
                            const meterLength = Math.sqrt(dx * dx + dy * dy) * settings.scale;
                            const isValid = meterLength >= 0.5 && meterLength <= 20;
                            return (
                              <span key={i} className={`px-2.5 py-1 rounded-md text-xs font-medium ${isValid ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                W{i + 1}: {formatLength(meterLength, 1)}
                              </span>
                            );
                          })}
                          {aiData.walls.length > 6 && (
                            <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--color-bg-primary)] text-[var(--color-text-muted)]">+{aiData.walls.length - 6} more</span>
                          )}
                        </div>
                      </div>
                    )}

                    {scaleValidationExpanded && (
                      <div className="p-3 space-y-1.5 max-h-48 overflow-y-auto">
                        {aiData.walls.map((wall, i) => {
                          const dx = wall.end.x - wall.start.x;
                          const dy = wall.end.y - wall.start.y;
                          const pixelLength = Math.sqrt(dx * dx + dy * dy);
                          const meterLength = pixelLength * settings.scale;
                          const isValid = meterLength >= 0.5 && meterLength <= 20;
                          const isEditing = editingWallIndex === i;
                          return (
                            <div key={i} className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors ${
                              isEditing ? 'bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/40' : isValid ? 'bg-green-500/10 hover:bg-green-500/20' : 'bg-red-500/10 hover:bg-red-500/20'
                            }`} onClick={() => { if (!isEditing) { setEditingWallIndex(i); setEditingWallLength(meterLength.toFixed(2)); setSelectedElement({ type: 'wall', index: i, wall }); } }}>
                              <span className={`text-xs font-medium ${isEditing ? 'text-[var(--color-accent)]' : isValid ? 'text-green-400' : 'text-red-400'}`}>W{i + 1}</span>
                              {isEditing ? (
                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  <input type="number" step="0.01" min="0.1" value={editingWallLength} onChange={(e) => setEditingWallLength(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { const n = parseFloat(editingWallLength); if (n > 0) setSettings(s => ({ ...s, scale: n / pixelLength })); setEditingWallIndex(null); setEditingWallLength(''); } else if (e.key === 'Escape') { setEditingWallIndex(null); setEditingWallLength(''); } }}
                                    autoFocus className="w-16 px-1.5 py-0.5 bg-[var(--color-bg-primary)] border border-[var(--color-accent)]/50 rounded text-white text-xs text-right focus:outline-none" />
                                  <span className="text-xs text-[var(--color-text-muted)]">m</span>
                                </div>
                              ) : (
                                <span className={`text-xs ${isValid ? 'text-green-400' : 'text-red-400'}`}>{formatLength(meterLength)}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
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
