import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, Plus, Trash2, Upload, Move, X, MousePointerClick } from 'lucide-react';
import { optImg, processImageFile, uploadImageToCloudinary } from '../utils';
import { PRESET_COLORS, ACCEPTED_IMAGE_FORMATS } from '../types';

interface ImageAreaEditorProps {
  item: any;
  appDB: any;
  handleItemChange: (id: string, field: string, value: any) => void;
  setDialog: (dialog: any) => void;
  idPrefix?: string;
}

export const ImageAreaEditor: React.FC<ImageAreaEditorProps> = React.memo(({ 
  item, 
  appDB, 
  handleItemChange, 
  setDialog, 
  idPrefix = 'editor' 
}) => {
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Default to hidden (false) on entry, as per user request
  const [showControls, setShowControls] = useState(false);
  
  const [mode, setMode] = useState<'draw' | 'pan'>('draw'); 
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<any>(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null); 
  const [pointDrag, setPointDrag] = useState<{ areaId: string; pIdx: number } | null>(null); 
  const [panelPos, setPanelPos] = useState(() => {
    if (typeof window !== 'undefined') {
      return {
        x: window.innerWidth > 1024 ? window.innerWidth - 360 : 20,
        y: 120
      };
    }
    return { x: 20, y: 80 };
  });
  const [draggingPanel, setDraggingPanel] = useState(false);
  const [panelDragStart, setPanelDragStart] = useState({ x: 0, y: 0 });
  const [isUploadingObj, setIsUploadingObj] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgNativeSize, setImgNativeSize] = useState<{ w: number; h: number } | null>(null);
  const [containerStyle, setContainerStyle] = useState({ width: '100%', height: '100%' });

  useEffect(() => {
    const updateSize = () => {
      if (!viewportRef.current || !imgNativeSize) return;
      const vw = viewportRef.current.clientWidth;
      const vh = viewportRef.current.clientHeight;
      const { w: natW, h: natH } = imgNativeSize;
      if (natW === 0 || natH === 0 || vw === 0 || vh === 0) return;

      const ri = natW / natH;
      const rc = vw / vh;
      let finalW, finalH;

      if (item.imageFit === 'fill') {
          if (ri > rc) { finalH = vh; finalW = vh * ri; } 
          else { finalW = vw; finalH = vw / ri; }
      } else { 
          if (ri > rc) { finalW = vw; finalH = vw / ri; } 
          else { finalH = vh; finalW = vh * ri; }
      }

      setContainerStyle({ width: `${finalW}px`, height: `${finalH}px` });
      
      if (containerRef.current) {
          containerRef.current.style.width = `${finalW}px`;
          containerRef.current.style.height = `${finalH}px`;
      }
    };

    updateSize();
    let ro: ResizeObserver | undefined;
    if (viewportRef.current && window.ResizeObserver) {
        ro = new ResizeObserver(updateSize);
        ro.observe(viewportRef.current);
    }

    window.addEventListener('beforeprint', updateSize);

    return () => {
        if (ro) ro.disconnect();
        window.removeEventListener('beforeprint', updateSize);
    };
  }, [imgNativeSize, item.imageFit]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!item.image) return;
      if (mode === 'pan') {
          e.preventDefault(); 
          const zoomFactor = -e.deltaY * 0.005;
          setZoom(z => Math.max(0.2, Math.min(10, z + zoomFactor)));
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [item.image, mode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawing && activeAreaId) {
        handleItemChange(item.id, 'areas', item.areas.map((a: any) => a.id === activeAreaId ? { ...a, points: [] } : a));
        setIsDrawing(false);
        setCursorPos(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawing, activeAreaId, item.areas, item.id, handleItemChange]);

  const getPctFromEvent = useCallback((e: any) => {
      if (!containerRef.current || !imgNativeSize) return null;
      let clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
      let clientY = e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;
      
      const rect = containerRef.current.getBoundingClientRect();
      return { 
          xPct: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
          yPct: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))
      };
  }, [imgNativeSize]);

  useEffect(() => {
    const handleGlobalPointMove = (e: MouseEvent | TouchEvent) => {
      if (!pointDrag) return;
      const pos = getPctFromEvent(e);
      if (!pos) return;

      handleItemChange(item.id, 'areas', item.areas.map((a: any) => {
        if (a.id === pointDrag.areaId) {
          const newPts = [...a.points];
          newPts[pointDrag.pIdx] = { x: pos.xPct, y: pos.yPct };
          return { ...a, points: newPts };
        }
        return a;
      }));
    };
    const handleGlobalPointUp = () => setPointDrag(null);

    if (pointDrag) {
      window.addEventListener('mousemove', handleGlobalPointMove);
      window.addEventListener('touchmove', handleGlobalPointMove, { passive: false });
      window.addEventListener('mouseup', handleGlobalPointUp);
      window.addEventListener('touchend', handleGlobalPointUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalPointMove);
      window.removeEventListener('touchmove', handleGlobalPointMove);
      window.removeEventListener('mouseup', handleGlobalPointUp);
      window.removeEventListener('touchmove', handleGlobalPointUp);
    }
  }, [pointDrag, zoom, pan, item.imageFit, imgNativeSize, item.areas, item.id, handleItemChange, getPctFromEvent]);

  useEffect(() => {
    const handleGlobalPanelMove = (e: MouseEvent | TouchEvent) => {
      if (draggingPanel) {
        let clientX = e instanceof MouseEvent ? e.clientX : (e.touches?.[0]?.clientX ?? 0);
        let clientY = e instanceof MouseEvent ? e.clientY : (e.touches?.[0]?.clientY ?? 0);

        let newX = clientX - panelDragStart.x;
        let newY = clientY - panelDragStart.y;
        
        // Ensure the panel doesn't go off-screen easily
        newX = Math.max(10, Math.min(newX, window.innerWidth - 350));
        newY = Math.max(10, Math.min(newY, window.innerHeight - 450));
        setPanelPos({ x: newX, y: newY });
      }
    };
    const handleGlobalPanelUp = () => setDraggingPanel(false);

    if (draggingPanel) {
      window.addEventListener('mousemove', handleGlobalPanelMove);
      window.addEventListener('touchmove', handleGlobalPanelMove, { passive: false });
      window.addEventListener('mouseup', handleGlobalPanelUp);
      window.addEventListener('touchend', handleGlobalPanelUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalPanelMove);
      window.removeEventListener('touchmove', handleGlobalPanelMove);
      window.removeEventListener('mouseup', handleGlobalPanelUp);
      window.removeEventListener('touchend', handleGlobalPanelUp);
    }
  }, [draggingPanel, panelDragStart]);

  const onPanelMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    let clientX = e.nativeEvent instanceof MouseEvent ? e.nativeEvent.clientX : (e.nativeEvent as TouchEvent).touches?.[0]?.clientX ?? 0;
    let clientY = e.nativeEvent instanceof MouseEvent ? e.nativeEvent.clientY : (e.nativeEvent as TouchEvent).touches?.[0]?.clientY ?? 0;
    setDraggingPanel(true);
    setPanelDragStart({ x: clientX - panelPos.x, y: clientY - panelPos.y });
  };

  const handleAddArea = () => {
    const newAreaId = Date.now().toString() + '_a' + (item.areas.length + 1);
    const newArea = { 
      id: newAreaId, points: [], width: '', height: '', 
      lineColor: '#EF4444', lineWidth: 2, fabrics: [], layers: 2,
      labelColor: '#EF4444', labelSize: 14, wPos: 'top', hPos: 'right',
      maskType: '', maskPct: 20, maskOpacity: 87, styleMain1: '', styleAction1: '', styleMain2: '', styleAction2: ''
    };
    handleItemChange(item.id, 'areas', [...item.areas, newArea]);
    setActiveAreaId(newAreaId);
    setIsDrawing(true);
    setMode('draw');
  };

  const handleRemoveArea = (areaId: string) => {
    handleItemChange(item.id, 'areas', item.areas.filter((a: any) => a.id !== areaId));
    if (activeAreaId === areaId) { setActiveAreaId(null); setIsDrawing(false); }
  };

  const handleUpdateArea = (areaId: string, field: string, value: any) => handleItemChange(item.id, 'areas', item.areas.map((a: any) => a.id === areaId ? { ...a, [field]: value } : a));

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => { 
    let clientX = e.nativeEvent instanceof MouseEvent ? e.nativeEvent.clientX : (e.nativeEvent as TouchEvent).touches?.[0]?.clientX ?? 0;
    let clientY = e.nativeEvent instanceof MouseEvent ? e.nativeEvent.clientY : (e.nativeEvent as TouchEvent).touches?.[0]?.clientY ?? 0;
    if (mode === 'pan') {
       setIsPanning({ startX: clientX, startY: clientY, startPanX: pan.x, startPanY: pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    let clientX = e.nativeEvent instanceof MouseEvent ? e.nativeEvent.clientX : (e.nativeEvent as TouchEvent).touches?.[0]?.clientX ?? 0;
    let clientY = e.nativeEvent instanceof MouseEvent ? e.nativeEvent.clientY : (e.nativeEvent as TouchEvent).touches?.[0]?.clientY ?? 0;
    
    if (mode === 'pan' && isPanning) { 
        if (e.cancelable) e.preventDefault();
        
        const dx = clientX - isPanning.startX;
        const dy = clientY - isPanning.startY;
        
        if (containerRef.current) {
            const baseW = containerRef.current.offsetWidth;
            const baseH = containerRef.current.offsetHeight;
            const panX = isPanning.startPanX + ((dx / zoom) / baseW) * 100;
            const panY = isPanning.startPanY + ((dy / zoom) / baseH) * 100;
            setPan({ x: panX, y: panY }); 
        }
        return; 
    }
    
    if (mode === 'draw' && activeAreaId && isDrawing) {
        if (e.cancelable) e.preventDefault();
        const pos = getPctFromEvent(e);
        if (pos && !pointDrag && !isPanning) setCursorPos({ x: pos.xPct, y: pos.yPct });
        else setCursorPos(null);
    }
  };

  const handleMouseUp = () => setIsPanning(false);
  const handleMouseLeave = () => { setIsPanning(false); setCursorPos(null); };

  const handleContentClick = (e: React.MouseEvent) => {
    if (mode !== 'draw' || !activeAreaId || !isDrawing || pointDrag || isPanning || draggingPanel) return;
    const pos = getPctFromEvent(e);
    if (!pos) return;
    const area = item.areas.find((a: any) => a.id === activeAreaId);
    if (area && area.points.length > 0) {
      const lastPt = area.points[area.points.length - 1];
      if (Math.hypot(lastPt.x - pos.xPct, lastPt.y - pos.yPct) < 1) return; 
    }
    handleItemChange(item.id, 'areas', item.areas.map((a: any) => a.id === activeAreaId ? { ...a, points: [...a.points, { x: pos.xPct, y: pos.yPct }] } : a));
  };

  const handlePointMouseDown = (e: React.MouseEvent | React.TouchEvent, areaId: string, pIdx: number) => { 
    e.stopPropagation(); 
    setActiveAreaId(areaId); 
    const matchingArea = item.areas.find((a: any) => a.id === areaId);
    if (isDrawing && pIdx === 0 && matchingArea && matchingArea.points.length > 2) {
      setIsDrawing(false); setCursorPos(null); return;
    }
    setPointDrag({ areaId, pIdx }); 
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadingObj(true);
      const compressedDataUrl = await processImageFile(file, 1024, 0.7, setDialog);
      if (compressedDataUrl) {
         try {
             const url = await uploadImageToCloudinary(compressedDataUrl);
             if (url) {
               handleItemChange(item.id, 'image', url);
               setShowControls(true);
             } else setDialog({ type: 'alert', message: 'อัปโหลดรูปล้มเหลว' });
         } catch (err) { setDialog({ type: 'alert', message: 'ระบบขัดข้อง กรุณาลองใหม่' }); }
      }
      setIsUploadingObj(false);
    }
  };

  const activeArea = item.areas.find((a: any) => a.id === activeAreaId);

  return (
    <div ref={wrapperRef} className="flex flex-col w-full h-full relative border-b md:border-b-0 print:border-b-0 border-gray-300 bg-white">
      <div 
        ref={viewportRef}
        className={`relative w-full flex-grow overflow-hidden flex items-center justify-center ${item.imageFit === 'fit' ? 'bg-white' : 'bg-gray-100'} ${mode === 'pan' ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : (activeAreaId && isDrawing ? 'cursor-crosshair' : 'cursor-default')}`}
        style={{ touchAction: 'none', clipPath: 'inset(0)', contain: 'paint' }}
        onMouseDown={handleMouseDown} onTouchStart={handleMouseDown}
        onMouseMove={handleMouseMove} onTouchMove={handleMouseMove}
        onMouseUp={handleMouseUp} onTouchEnd={handleMouseUp}
        onMouseLeave={handleMouseLeave} onClick={handleContentClick}
      >
        {item.image ? (
          <>
            <div
              style={{
                 position: 'absolute',
                 inset: 0,
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 transform: `translate(${pan.x}%, ${pan.y}%) scale(${zoom})`,
                 transformOrigin: 'center',
                 transition: isPanning ? 'none' : 'transform 0.05s ease-out'
              }}
            >
              <div 
                  ref={containerRef}
                  style={{
                      position: 'relative',
                      flexShrink: 0,
                      width: containerStyle.width,
                      height: containerStyle.height
                  }}
                  className="shadow-sm"
              >
                <img 
                    ref={imgRef}
                    src={optImg(item.image, 1600)} 
                    alt="Window view" 
                    style={{ width: '100%', height: '100%', display: 'block', objectFit: 'fill' }}
                    className="absolute inset-0 pointer-events-none" 
                    onLoad={e => {
                      const img = e.target as HTMLImageElement;
                      setImgNativeSize({ w: img.naturalWidth, h: img.naturalHeight });
                    }}
                    referrerPolicy="no-referrer"
                />
                
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ top: 0, left: 0 }}>
                  <defs>
                    {item.areas.map((area: any) => {
                        const clipId = `clip-${idPrefix}-${item.id}-${area.id}`;
                        return (
                          <clipPath key={clipId} id={clipId}>
                            <polygon points={area.points.map((p: any) => `${p.x},${p.y}`).join(' ')} />
                          </clipPath>
                        )
                      })}
                    </defs>

                    {item.areas.map((area: any, idx: number) => {
                      if (area.points.length < 3) return null;
                      const minX = Math.min(...area.points.map((p: any)=>p.x));
                      const maxX = Math.max(...area.points.map((p: any)=>p.x));
                      const minY = Math.min(...area.points.map((p: any)=>p.y));
                      const maxY = Math.max(...area.points.map((p: any)=>p.y));
                      const w = maxX - minX;
                      const h = maxY - minY;
                      const clipId = `clip-${idPrefix}-${item.id}-${area.id}`;
                      
                      const styleMain1 = area.styleMain1 || item.styleMain1 || item.styleMain || '';
                      const autoMaskType = styleMain1.match(/ม่านม้วน|ม่านพับ|มู่ลี่|ม่านปรับแสง/) ? 'height' : 'width';
                      const maskType = area.maskType || autoMaskType;
                      const mPct = (area.maskPct || 20) / 100;
                      const maskOpacity = (area.maskOpacity ?? 87) / 100;
                      
                      const action = area.styleAction1 || item.styleAction1 || item.styleAction || '';
                      const masks = appDB.masks?.[styleMain1] || {};
                      const maskImgFallback = masks[action] || masks['ALL'] || Object.values(masks)[0];
                      let maskElements: any[] = [];
                      
                      const dist = (p1: any, p2: any) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
                      
                      if (maskImgFallback) {
                        if (maskType === 'height') {
                          let isQuad = area.points.length === 4;
                          let TL: any, TR: any, BL: any, BR: any;
                          if (isQuad) {
                            let sortedY = [...area.points].sort((a, b) => a.y - b.y);
                            let top2 = sortedY.slice(0, 2).sort((a, b) => a.x - b.x);
                            let bot2 = sortedY.slice(2, 4).sort((a, b) => a.x - b.x);
                            TL = top2[0]; TR = top2[1]; BL = bot2[0]; BR = bot2[1];
                          } else {
                            TL = {x: minX, y: minY}; TR = {x: maxX, y: minY};
                            BL = {x: minX, y: maxY}; BR = {x: maxX, y: maxY};
                          }

                          let dropL = { x: TL.x + (BL.x - TL.x) * mPct, y: TL.y + (BL.y - TL.y) * mPct };
                          let dropR = { x: TR.x + (BR.x - TR.x) * mPct, y: TR.y + (BR.y - TR.y) * mPct };

                          let clipPoly = `${TL.x},${TL.y} ${TR.x},${TR.y} ${dropR.x},${dropR.y} ${dropL.x},${dropL.y}`;
                          let clipIdAct = `${clipId}-height-act`;

                          let W = Math.max(0.1, dist(TL, TR));
                          let H = Math.max(0.1, dist(TL, dropL));

                          let u_x = (TR.x - TL.x) / W;
                          let u_y = (TR.y - TL.y) / W;
                          let v_x = (dropL.x - TL.x) / H;
                          let v_y = (dropL.y - TL.y) / H;

                          let D = u_x * v_y - u_y * v_x;
                          let imgW = W;
                          let imgH = H;

                          if (Math.abs(D) > 1e-6) {
                            let dx = dropR.x - TL.x;
                            let dy = dropR.y - TL.y;
                            let x_R = (dx * v_y - dy * v_x) / D;
                            let y_R = (u_x * dy - u_y * dx) / D;
                            imgW = Math.max(W, x_R);
                            imgH = Math.max(H, y_R);
                          }

                          maskElements.push(
                            <React.Fragment key="T">
                              <clipPath id={clipIdAct}><polygon points={clipPoly} /></clipPath>
                              <g clipPath={`url(#${clipIdAct})`}>
                                <image 
                                  href={optImg(maskImgFallback, 800)} 
                                  x="0" y="0" 
                                  width={imgW} height={imgH} 
                                  preserveAspectRatio="none" 
                                  opacity={maskOpacity}
                                  transform={area.points.length === 4 ? `matrix(${u_x} ${u_y} ${v_x} ${v_y} ${TL.x} ${TL.y})` : `translate(${TL.x}, ${TL.y})`}
                                />
                              </g>
                            </React.Fragment>
                          );
                        } else {
                          if (action.includes('แยกกลาง')) {
                            const leftImg = masks['รวบซ้าย'] || maskImgFallback;
                            const rightImg = masks['รวบขวา'] || maskImgFallback;
                            maskElements.push(
                              <g key="W" clipPath={`url(#${clipId})`}>
                                <image href={optImg(leftImg, 800)} x={minX} y={minY} width={w * mPct} height={h} preserveAspectRatio="none" opacity={maskOpacity} />
                                <image href={optImg(rightImg, 800)} x={maxX - (w * mPct)} y={minY} width={w * mPct} height={h} preserveAspectRatio="none" opacity={maskOpacity} />
                              </g>
                            );
                          } else if (action.includes('ขวา')) {
                            const rightImg = masks['รวบขวา'] || masks[action] || maskImgFallback;
                            maskElements.push(
                              <g key="R" clipPath={`url(#${clipId})`}>
                                <image href={optImg(rightImg, 800)} x={maxX - (w * mPct)} y={minY} width={w * mPct} height={h} preserveAspectRatio="none" opacity={maskOpacity} />
                              </g>
                            );
                          } else {
                            const leftImg = masks['รวบซ้าย'] || masks[action] || maskImgFallback;
                            maskElements.push(
                              <g key="L" clipPath={`url(#${clipId})`}>
                                <image href={optImg(leftImg, 800)} x={minX} y={minY} width={w * mPct} height={h} preserveAspectRatio="none" opacity={maskOpacity} />
                              </g>
                            );
                          }
                        }
                      }

                      return (
                        <g key={`fill-group-${area.id}`}>
                          <polygon points={area.points.map((p: any) => `${p.x},${p.y}`).join(' ')} fill={area.lineColor} fillOpacity={0.15} stroke="none" />
                          {maskElements}
                        </g>
                      );
                    })}
                    {mode === 'draw' && activeAreaId && isDrawing && !pointDrag && cursorPos && activeArea && activeArea.points.length > 0 && (
                      <polygon points={[...activeArea.points, cursorPos].map(p => `${p.x},${p.y}`).join(' ')} fill={activeArea.lineColor} fillOpacity={0.1} stroke="none" />
                    )}
                </svg>

                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ top: 0, left: 0 }}>
                  {item.areas.map((area: any) => {
                    const isActive = activeAreaId === area.id;
                    return (
                      <g key={area.id}>
                        {area.points.map((p: any, idx: number) => {
                          const isLast = idx === area.points.length - 1;
                          const nextP = isLast ? area.points[0] : area.points[idx + 1];
                          if (mode === 'draw' && isActive && isDrawing && isLast && !pointDrag) return null;
                          if (area.points.length < 2) return null;
                          return (
                            <line key={`line-${idx}`} x1={`${p.x}%`} y1={`${p.y}%`} x2={`${nextP.x}%`} y2={`${nextP.y}%`} stroke={area.lineColor} strokeWidth={area.lineWidth / zoom} strokeDasharray={isActive && !pointDrag && isDrawing ? "4 4" : "0"} className={isActive && !pointDrag && isDrawing ? "animate-pulse" : ""} style={{ pointerEvents: 'none' }} />
                          );
                        })}
                        {area.points.map((p: any, idx: number) => {
                          const isFirstPoint = idx === 0;
                          const isCurrentlyDrawing = mode === 'draw' && isActive && isDrawing;
                          const isHighlight = isCurrentlyDrawing && isFirstPoint && area.points.length >= 2;
                          const circleRadius = isHighlight ? 8/zoom : 4/zoom;
                          
                          return (
                            <g key={idx} className="cursor-move" style={{ pointerEvents: 'auto' }}>
                              <circle cx={`${p.x}%`} cy={`${p.y}%`} r={circleRadius} fill={isHighlight ? "#FFD700" : "white"} stroke={area.lineColor} strokeWidth={isHighlight ? 3/zoom : 2/zoom} onMouseDown={(e) => handlePointMouseDown(e, area.id, idx)} onTouchStart={(e) => handlePointMouseDown(e, area.id, idx)} className={isHighlight ? "animate-pulse" : ""} />
                            </g>
                          );
                        })}
                      </g>
                    );
                  })}
                  {mode === 'draw' && activeAreaId && isDrawing && !pointDrag && cursorPos && activeArea && activeArea.points.length > 0 && (
                    <g style={{ pointerEvents: 'none' }}>
                      <line x1={`${activeArea.points[activeArea.points.length - 1].x}%`} y1={`${activeArea.points[activeArea.points.length - 1].y}%`} x2={`${cursorPos.x}%`} y2={`${cursorPos.y}%`} stroke={activeArea.lineColor} strokeWidth={2/zoom} strokeDasharray="4 4" />
                      <line x1={`${cursorPos.x}%`} y1={`${cursorPos.y}%`} x2={`${activeArea.points[0].x}%`} y2={`${activeArea.points[0].y}%`} stroke={activeArea.lineColor} strokeWidth={2/zoom} strokeDasharray="4 4" opacity="0.5" />
                    </g>
                  )}
                </svg>

                {item.areas.map((area: any, idx: number) => {
                  if (area.points.length === 0) return null;
                  
                  let wMidX = 50, wMidY = 0, wAng = 0;
                  let hMidX = 0, hMidY = 50, hAng = -90;

                  if (area.points.length >= 2) {
                    let edges: any[] = [];
                    for(let i=0; i<area.points.length; i++) {
                      let p1 = area.points[i];
                      let p2 = area.points[(i+1)%area.points.length];
                      edges.push({ p1, p2, midX: (p1.x+p2.x)/2, midY: (p1.y+p2.y)/2, dx: p2.x - p1.x, dy: p2.y - p1.y });
                    }
                    
                    let tEdge = edges.reduce((prev, curr) => prev.midY < curr.midY ? prev : curr);
                    let bEdge = edges.reduce((prev, curr) => prev.midY > curr.midY ? prev : curr);
                    let lEdge = edges.reduce((prev, curr) => prev.midX < curr.midX ? prev : curr);
                    let rEdge = edges.reduce((prev, curr) => prev.midX > curr.midX ? prev : curr);

                    const getVisualAngle = (edge: any, defaultAng: number) => {
                      if (!containerRef.current) return defaultAng;
                      const rect = containerRef.current.getBoundingClientRect();
                      const pxDx = edge.dx * (rect.width / 100);
                      const pxDy = edge.dy * (rect.height / 100);
                      if (pxDx === 0 && pxDy === 0) return defaultAng;
                      let ang = Math.atan2(pxDy, pxDx) * (180 / Math.PI);
                      if (ang > 90 || ang < -90) ang += 180;
                      return ang;
                    };

                    const wPos = area.wPos || 'top';
                    const hPos = area.hPos || 'right';

                    if (wPos === 'top') { wMidX = tEdge.midX; wMidY = tEdge.midY; wAng = getVisualAngle(tEdge, 0); }
                    else { wMidX = bEdge.midX; wMidY = bEdge.midY; wAng = getVisualAngle(bEdge, 0); }

                    if (hPos === 'left') { hMidX = lEdge.midX; hMidY = lEdge.midY; hAng = getVisualAngle(lEdge, -90); }
                    else { hMidX = rEdge.midX; hMidY = rEdge.midY; hAng = getVisualAngle(rEdge, 90); }
                  }

                  const lblSize = (area.labelSize || 14) / zoom;
                  
                  return (
                    <div key={`labels-${area.id}`} className="absolute inset-0 pointer-events-none">
                      {item.areas.length >= 2 && area.points[0] && (
                        <div style={{ position: 'absolute', left: `${area.points[0].x}%`, top: `${area.points[0].y}%`, transform: `translate(-50%, -100%) translateY(-10px)`, color: area.lineColor, fontSize: `${12/zoom}px`, whiteSpace: 'nowrap' }} className="bg-white/90 px-1.5 py-0.5 rounded shadow-sm border border-gray-300 font-bold z-10 text-center">
                          บานที่ {idx + 1}
                        </div>
                      )}
                      {area.width && (
                        <div style={{ position: 'absolute', left: `${wMidX}%`, top: `${wMidY}%`, transform: `translate(-50%, -50%) rotate(${wAng}deg)`, color: area.labelColor || area.lineColor, fontSize: `${lblSize}px`, whiteSpace: 'nowrap' }} className="bg-white/95 px-2 py-0.5 rounded shadow-md border border-gray-300 font-bold z-10 text-center">
                          {area.width} ซม.
                        </div>
                      )}
                      {area.height && (
                        <div style={{ position: 'absolute', left: `${hMidX}%`, top: `${hMidY}%`, transform: `translate(-50%, -50%) rotate(${hAng}deg)`, color: area.labelColor || area.lineColor, fontSize: `${lblSize}px`, whiteSpace: 'nowrap' }} className="bg-white/95 px-2 py-0.5 rounded shadow-md border border-gray-300 font-bold z-10 text-center">
                          {area.height} ซม.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="absolute top-2 left-2 flex flex-wrap gap-2 z-40 no-print" onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} onWheel={e=>e.stopPropagation()}>
              <label className={`cursor-pointer bg-white/90 border border-gray-300 text-gray-700 px-3 py-1.5 rounded shadow-sm hover:bg-white flex items-center text-xs font-bold transition-colors ${isUploadingObj ? 'opacity-50 cursor-wait' : ''}`} title="เปลี่ยนเฉพาะรูปพื้นหลัง">
                <Upload size={14} className="mr-1.5"/> {isUploadingObj ? 'กำลังอัปโหลด...' : 'เปลี่ยนรูปหน้างาน'}
                <input type="file" accept={ACCEPTED_IMAGE_FORMATS} className="hidden" disabled={isUploadingObj} onChange={handleImageUpload} />
              </label>
              <button onClick={() => {
                handleItemChange(item.id, 'imageFit', (item.imageFit || 'fill') === 'fill' ? 'fit' : 'fill');
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }} className="cursor-pointer bg-white/90 border border-gray-300 text-gray-700 px-3 py-1.5 rounded shadow-sm hover:bg-white flex items-center text-xs font-bold transition-colors" title="รีเซ็ตและเปลี่ยนรูปแบบการจัดวางรูปภาพ">
                {(item.imageFit || 'fill') === 'fill' ? 'โหมด: เต็มกรอบ (Fill)' : 'โหมด: พอดีภาพ (Fit)'}
              </button>
              
              {/* FIX: Dynamic toggle button to let users reopen the floating panel if closed */}
              <button 
                onClick={() => setShowControls(prev => !prev)} 
                className={`cursor-pointer px-3 py-1.5 rounded shadow-sm flex items-center text-xs font-bold transition-colors ${showControls ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white animate-pulse'}`} 
                title="เปิด/ปิด แผงเครื่องมือควบคุมหน้างาน"
              >
                <Settings size={14} className={`mr-1.5 ${showControls ? '' : 'animate-spin'}`}/> 
                {showControls ? 'ซ่อนชุดเครื่องมือ' : 'เปิดชุดเครื่องมือ'}
              </button>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center opacity-100 bg-gray-50 no-print">
            <label className={`cursor-pointer bg-white text-blue-600 border border-blue-600 px-6 py-3 rounded-lg shadow-sm flex items-center transition-colors font-bold ${isUploadingObj ? 'opacity-50 cursor-wait' : 'hover:bg-blue-50'}`}>
              <Upload size={20} className="mr-2" /> {isUploadingObj ? 'กำลังอัปโหลด...' : 'อัปโหลดรูปหน้างาน'}
              <input type="file" accept={ACCEPTED_IMAGE_FORMATS} className="hidden" disabled={isUploadingObj} onChange={handleImageUpload} />
            </label>
          </div>
        )}
      </div>

      {item.image && showControls && (
        <div 
          style={{ position: 'fixed', left: panelPos.x, top: panelPos.y }}
          className="w-[90vw] sm:w-[340px] max-w-[340px] z-[999999] bg-white/95 backdrop-blur-sm border border-gray-300 rounded shadow-2xl flex flex-col no-print cursor-default transition-shadow"
          onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}
        >
          <div onMouseDown={onPanelMouseDown} onTouchStart={onPanelMouseDown} className="bg-gray-800 text-white px-3 py-2 flex justify-between items-center cursor-move rounded-t selection:bg-transparent">
            <span className="font-bold text-xs flex items-center"><Move size={14} className="mr-1"/> เครื่องมือพื้นที่ (ลากจัดวางได้)</span>
            <button onClick={() => setShowControls(false)} className="hover:text-red-400 text-gray-300 transition-colors"><X size={16}/></button>
          </div>
          
          <div className="flex gap-1 p-2 bg-gray-100 border-b">
            <button onClick={() => setMode('pan')} className={`flex-1 flex justify-center items-center px-2 py-1.5 rounded text-xs font-bold transition-colors ${mode === 'pan' ? 'bg-indigo-600 text-white shadow' : 'bg-white border text-gray-700 hover:bg-gray-50'}`}><Move size={14} className="mr-1"/> เลื่อน/ซูม</button>
            <button onClick={() => setMode('draw')} className={`flex-1 flex justify-center items-center px-2 py-1.5 rounded text-xs font-bold transition-colors ${mode === 'draw' ? 'bg-red-500 text-white shadow' : 'bg-white border text-gray-700 hover:bg-gray-50'}`}><MousePointerClick size={14} className="mr-1"/> จัดการพื้นที่</button>
          </div>

          <div className="p-2 text-sm flex flex-col gap-2 max-h-[350px] overflow-y-auto">
            <div className="flex justify-between items-center">
               <button onClick={handleAddArea} className="bg-green-600 text-white px-3 py-1.5 rounded shadow-sm font-bold flex items-center text-xs hover:bg-green-700"><Plus size={14} className="mr-1"/> เพิ่มบานย่อย</button>
               {mode === 'draw' && activeAreaId && isDrawing && <span className="text-red-500 font-bold bg-red-50 px-2 py-1 rounded border border-red-200 text-[10px] animate-pulse">คลิกจุดเริ่มต้น เพื่อจบเส้น (ESC)</span>}
            </div>

            {item.areas.map((area: any, idx: number) => {
              const isActive = activeAreaId === area.id;
              const autoMaskType = (area.styleMain1 || item.styleMain1 || item.styleMain || '').match(/ม่านม้วน|ม่านพับ|มู่ลี่|ม่านปรับแสง/) ? 'height' : 'width';
              return (
                <div key={area.id} className={`flex flex-col gap-2 border p-2 rounded bg-white transition-all ${isActive ? 'border-blue-400 ring-2 ring-blue-100 shadow-md' : 'border-gray-200'}`}>
                  <div className="flex flex-wrap gap-1 items-center justify-between">
                    <div className="flex gap-1 items-center">
                      <button onClick={() => { setActiveAreaId(isActive ? null : area.id); if(!isActive) setIsDrawing(false); setMode('draw'); }} className={`px-2 py-1 rounded border font-bold flex items-center text-[10px] ${isActive ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'}`}>บานที่ {idx + 1}</button>
                      {isActive && <button onClick={() => setIsDrawing(!isDrawing)} className={`px-2 py-1 text-[10px] rounded font-bold shadow-sm transition-colors ${isDrawing ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>{isDrawing ? 'หยุดวาดจุด' : '+ วาดจุดเพิ่ม'}</button>}
                    </div>
                    <div className="flex items-center gap-1 ml-auto">
                       <button onClick={() => handleUpdateArea(area.id, 'points', [])} className="text-[10px] text-orange-600 hover:bg-orange-50 px-2 py-1 rounded border border-orange-200 font-bold">ล้างเส้น</button>
                       <button onClick={() => handleRemoveArea(area.id)} className="bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 px-2 py-1 rounded border border-red-200" title="ลบพื้นที่"><Trash2 size={12}/></button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 justify-between w-full mt-1">
                    <div className="flex items-center border px-2 py-1 rounded bg-gray-50 flex-1">
                      <span className="text-gray-500 text-xs font-bold whitespace-nowrap mr-1">กว้าง:</span>
                      <input type="text" placeholder="ซม." value={area.width} onChange={(e)=>handleUpdateArea(area.id, 'width', e.target.value)} className="w-10 bg-transparent outline-none border-b border-gray-300 focus:border-blue-500 text-center text-blue-700 font-bold text-xs h-5"/>
                      <select value={area.wPos || 'top'} onChange={(e)=>handleUpdateArea(area.id, 'wPos', e.target.value)} className="text-[10px] bg-transparent outline-none cursor-pointer ml-auto"><option value="top">บน</option><option value="bottom">ล่าง</option></select>
                    </div>
                    <div className="flex items-center border px-2 py-1 rounded bg-gray-50 flex-1">
                      <span className="text-gray-500 text-xs font-bold whitespace-nowrap mr-1">สูง:</span>
                      <input type="text" placeholder="ซม." value={area.height} onChange={(e)=>handleUpdateArea(area.id, 'height', e.target.value)} className="w-10 bg-transparent outline-none border-b border-gray-300 focus:border-blue-500 text-center text-blue-700 font-bold text-xs h-5"/>
                      <select value={area.hPos || 'right'} onChange={(e)=>handleUpdateArea(area.id, 'hPos', e.target.value)} className="text-[10px] bg-transparent outline-none cursor-pointer ml-auto"><option value="left">ซ้าย</option><option value="right">ขวา</option></select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 border-t pt-2 mt-1 bg-blue-50/30 p-2 rounded">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-indigo-800">รูปแบบ Mask:</span>
                      <select value={area.maskType || autoMaskType} onChange={(e)=>handleUpdateArea(area.id, 'maskType', e.target.value)} className="border border-indigo-200 rounded bg-white px-2 py-1 outline-none text-indigo-700 font-bold text-[11px] h-7"><option value="width">เปิดข้าง (จีบ/ลอน)</option><option value="height">ดึงลง (ม้วน/พับ/มู่ลี่)</option></select>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1">
                      <label className="flex items-center gap-1"><span className="font-bold text-gray-600">สัดส่วนผ้า:</span>
                        <select value={area.maskPct || 20} onChange={(e)=>handleUpdateArea(area.id, 'maskPct', parseInt(e.target.value))} className="border rounded bg-white px-1 py-0.5 outline-none text-blue-700 font-bold h-7">{[10, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100].map(sz => <option key={sz} value={sz}>{sz}%</option>)}</select>
                      </label>
                      <label className="flex items-center gap-1"><span className="font-bold text-gray-600">ความทึบ:</span>
                        <select value={area.maskOpacity ?? 87} onChange={(e)=>handleUpdateArea(area.id, 'maskOpacity', parseInt(e.target.value))} className="border rounded bg-white px-1 py-0.5 outline-none text-blue-700 font-bold h-7">{[10, 20, 30, 40, 50, 60, 70, 80, 87, 90, 100].map(sz => <option key={sz} value={sz}>{sz}%</option>)}</select>
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 items-center text-xs border-t pt-2 mt-1 justify-between">
                    <div className="flex items-center gap-1.5"><span className="font-bold text-gray-700">สี:</span>
                      {PRESET_COLORS.map(c => <button key={c} onClick={(e) => { e.stopPropagation(); handleUpdateArea(area.id, 'lineColor', c); handleUpdateArea(area.id, 'labelColor', c); }} className={`w-4 h-4 rounded-full border ${area.lineColor === c ? 'ring-2 ring-offset-1 ring-blue-500 border-transparent' : 'border-gray-300'}`} style={{ backgroundColor: c }} />)}
                    </div>
                    <label className="flex items-center"><span className="font-bold mr-1 text-gray-700">อักษร:</span>
                      <select value={area.labelSize || 14} onChange={(e)=>handleUpdateArea(area.id, 'labelSize', parseInt(e.target.value))} className="border rounded bg-white px-1 py-0.5 outline-none font-bold text-blue-700 h-7">{[10, 12, 14, 16, 18, 20, 24, 28, 32].map(sz => <option key={sz} value={sz}>{sz}px</option>)}</select>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

ImageAreaEditor.displayName = 'ImageAreaEditor';
