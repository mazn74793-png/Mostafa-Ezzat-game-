/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Crown, Settings, RotateCcw, Info, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Sound Synthesis Engine ---
const playSound = (type: 'drag' | 'place' | 'clear' | 'rotate' | 'levelup' | 'gameover') => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    if (type === 'drag') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'place') {
      const db = ctx.createOscillator();
      const gain = ctx.createGain();
      db.connect(gain);
      gain.connect(ctx.destination);
      db.type = 'sine';
      db.frequency.setValueAtTime(90, ctx.currentTime);
      db.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      db.start();
      db.stop(ctx.currentTime + 0.12);
    } else if (type === 'clear') {
      [440, 554, 659, 880].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.05);
        gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + idx * 0.05 + 0.15);
        osc.start(ctx.currentTime + idx * 0.05);
        osc.stop(ctx.currentTime + idx * 0.05 + 0.15);
      });
    } else if (type === 'rotate') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.setValueAtTime(360, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'levelup') {
      [261, 329, 392, 523, 659].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
        gain.gain.setValueAtTime(0.08, ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + idx * 0.08 + 0.3);
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.3);
      });
    } else if (type === 'gameover') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(40, ctx.currentTime + 0.6);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    }
  } catch (e) {
    console.warn("Audio Context Synthesis blocked or unsupported", e);
  }
};

// --- Shape Rotation Utilities ---
const rotateShape = (shape: Shape): Shape => {
  const rotated = shape.blocks.map(b => ({
    x: -b.y,
    y: b.x,
  }));
  const minX = Math.min(...rotated.map(b => b.x));
  const minY = Math.min(...rotated.map(b => b.y));
  return {
    ...shape,
    blocks: rotated.map(b => ({
      x: b.x - minX,
      y: b.y - minY,
    }))
  };
};

// --- Ambient Magic Forest Particle Engine ---
const AmbientParticles = () => {
  const [particles, setParticles] = useState<Array<{ id: number, x: number, y: number, size: number, duration: number }>>([]);
  
  useEffect(() => {
    const pArray = Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 2,
      duration: Math.random() * 8 + 8
    }));
    setParticles(pArray);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-amber-200/20 blur-[1px]"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
          }}
          animate={{
            y: ['0px', '-100px'],
            opacity: [0, 0.5, 0],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      ))}
    </div>
  );
};

// --- Constants & Types ---

const GRID_SIZE = 8;
const CELL_SIZE = 40; // Base size, will be responsive
const DRAG_Y_OFFSET = 125; // 125px offset so finger does not cover blocks on mobile screens

type Block = {
  x: number;
  y: number;
};

type Shape = {
  id: string;
  blocks: Block[];
  color: string;
};

const SHAPES: Omit<Shape, 'id'>[] = [
  // Oak Light Wood Style (Orange-Beige-Yellow tones)
  { color: '#E8C89C', blocks: [{ x: 0, y: 0 }] }, // 1x1
  { color: '#E8C89C', blocks: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }, // 1x2 Oak
  { color: '#E8C89C', blocks: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] }, // 1x3 Oak
  
  // Mahogany Red-wood Style
  { color: '#C05C3E', blocks: [{ x: 0, y: 0 }, { x: 0, y: 1 }] }, // 2x1 Mahogany
  { color: '#C05C3E', blocks: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] }, // 2x2 Mahogany
  { color: '#C05C3E', blocks: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }] }, // 3x3 Mahogany
  
  // Walnut Dark-Coffee Wood Style
  { color: '#82522C', blocks: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }] }, // 3x1 Walnut
  { color: '#82522C', blocks: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] }, // L small Walnut
  { color: '#82522C', blocks: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }] }, // T shape Walnut
  
  // Birch Cream Wood style
  { color: '#F3E1C3', blocks: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }] }, // 1x4 Birch
  { color: '#F3E1C3', blocks: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }] }, // 4x1 Birch
  { color: '#F3E1C3', blocks: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] }, // L small Birch
  
  // Cherry Amber Wood style
  { color: '#A64B2A', blocks: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] }, // L small Cherry
  { color: '#A64B2A', blocks: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }] }, // L large Cherry
  { color: '#A64B2A', blocks: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }] }, // Plus Cherry
  
  // SPECIAL EXTRA INTERACTIVE SHAPES
  { color: '#E3A857', blocks: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 2, y: 1 }] }, // Hollow Triangle Arch (Beech Wood)
  { color: '#82522C', blocks: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }] }, // Hollow U Base
  { color: '#D4AF37', blocks: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }] }, // Diagonal Magic Step (Golden Pine Wood)
  { color: '#C05C3E', blocks: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }] }, // Stair step
  { color: '#A64B2A', blocks: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }] }, // 1x5 Giant Cherry Slat
  { color: '#F3E1C3', blocks: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }, { x: 0, y: 4 }] }, // 5x1 Giant Slat

  // NEW EPIC SHAPES
  { color: '#D4AF37', blocks: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 2, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }] }, // Ring hollow square (O-Shape)
  { color: '#A64B2A', blocks: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 0 }] }, // U-Shape Arch (Cherry)
  { color: '#C05C3E', blocks: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }] }, // Lightning bolt / Big Z (Mahogany)
  { color: '#E8C89C', blocks: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }] }, // Small bracket / C-shape (Oak)
  { color: '#F3E1C3', blocks: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }, // Line 2x2 Diagonal Step (Birch)
  { color: '#82522C', blocks: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }] }, // Hollow Diamond (Walnut)
  { color: '#F3E1C3', blocks: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 2 }] }, // Bending Branch / F-shape (Birch)
  { color: '#E8C89C', blocks: [{ x: 1, y: 0 }, { x: 0, y: 1 }] }, // Small Dot Diagonal (Oak)
  { color: '#A64B2A', blocks: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }] }, // Pistol / Big Corner L (Cherry)
  { color: '#E3A857', blocks: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }] }, // ZigZag ladder (Beech)
];

const getRandomShape = (): Shape => {
  const template = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  return {
    ...template,
    id: Math.random().toString(36).substr(2, 9),
  };
};

// --- Components ---

const WoodBlock = ({ size, color, isGhost = false, isClearing = false }: { size: number | string, color: string, isGhost?: boolean, isClearing?: boolean }) => (
  <motion.div
    animate={isClearing ? { 
      scale: [1, 1.2, 0], 
      rotate: [0, 15, -15],
      opacity: [1, 1, 0]
    } : { scale: 1, opacity: isGhost ? 0.4 : 1 }}
    transition={{ duration: 0.4, ease: "easeOut" }}
    style={{
      width: size,
      height: size,
      backgroundColor: color,
      boxShadow: isGhost ? 'none' : 'inset -4px -4px 8px rgba(0,0,0,0.5), inset 4px 4px 8px rgba(255,255,255,0.2), 0 4px 6px rgba(0,0,0,0.3)',
      border: isGhost ? '1px dashed rgba(255,255,255,0.3)' : '1px solid rgba(0,0,0,0.3)',
      backgroundImage: isGhost ? 'none' : `
        linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(0,0,0,0.1) 100%),
        repeating-linear-gradient(
          45deg,
          rgba(0,0,0,0.05) 0px,
          rgba(0,0,0,0.05) 2px,
          transparent 2px,
          transparent 4px
        )
      `
    }}
    className="rounded-lg relative overflow-hidden flex items-center justify-center"
  >
    {!isGhost && (
      <>
        {/* Wood Rings Effect */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
          background: 'radial-gradient(circle at 70% 30%, transparent 0%, rgba(0,0,0,0.4) 100%)'
        }} />
        {/* Subtle Highlight */}
        <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
      </>
    )}
  </motion.div>
);

export default function App() {
  const [grid, setGrid] = useState<(string | null)[][]>(
    Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null))
  );
  const [availableShapes, setAvailableShapes] = useState<(Shape | null)[]>([]);
  const [score, setScore] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [draggingShape, setDraggingShape] = useState<{ shape: Shape, index: number, x: number, y: number, startX: number, startY: number, cellSize: number } | null>(null);
  const [clearingLines, setClearingLines] = useState<{ rows: number[], cols: number[] }>({ rows: [], cols: [] });
  const [maxCombo, setMaxCombo] = useState(0);
  const [level, setLevel] = useState(1);
  const [showLevelUp, setShowLevelUp] = useState<number | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showInfoMessage, setShowInfoMessage] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string, id: number } | null>(null);
  
  const gridRef = useRef<HTMLDivElement>(null);

  // Animated Score logic
  useEffect(() => {
    if (displayScore < score) {
      const timer = setTimeout(() => setDisplayScore(prev => Math.min(prev + 5, score)), 20);
      return () => clearTimeout(timer);
    }
  }, [displayScore, score]);

  const handleRotate = useCallback((index: number) => {
    setAvailableShapes(prev => {
      const shapeToRotate = prev[index];
      if (!shapeToRotate) return prev;
      playSound('rotate');
      const rotated = rotateShape(shapeToRotate);
      const updated = [...prev];
      updated[index] = rotated;
      return updated;
    });
  }, []);

  const generateFairShapeSet = useCallback((currentGrid: (string | null)[][]) => {
    let newShapes: Shape[] = [];
    let attempts = 0;
    const maxAttempts = 50;

    while (attempts < maxAttempts) {
      newShapes = [getRandomShape(), getRandomShape(), getRandomShape()];
      const canPlaceAny = newShapes.some(shape => {
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            if (canPlaceShape(currentGrid, shape, r, c)) return true;
          }
        }
        return false;
      });

      if (canPlaceAny) break;
      attempts++;
    }
    
    // If we couldn't find a fair set after many attempts, just return random ones
    // (This usually means the board is extremely full)
    if (attempts === maxAttempts) {
      newShapes = [getRandomShape(), getRandomShape(), getRandomShape()];
    }
    
    return newShapes;
  }, []);

  // Initialize game
  useEffect(() => {
    const savedHighScore = localStorage.getItem('wood-puzzle-highscore');
    if (savedHighScore) setHighScore(parseInt(savedHighScore));
    
    setAvailableShapes(generateFairShapeSet(grid));
  }, [generateFairShapeSet]);

  // Check for game over whenever grid or available shapes change
  useEffect(() => {
    const activeShapes = availableShapes.filter((s): s is Shape => s !== null);
    if (activeShapes.length === 0) return;
    
    const canPlaceAny = activeShapes.some(shape => {
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (canPlaceShape(grid, shape, r, c)) return true;
        }
      }
      return false;
    });

    if (!canPlaceAny && !draggingShape) {
      setGameOver(true);
    }
  }, [grid, availableShapes, draggingShape]);

  const canPlaceShape = (currentGrid: (string | null)[][], shape: Shape, row: number, col: number) => {
    return shape.blocks.every(block => {
      const r = row + block.y;
      const c = col + block.x;
      return (
        r >= 0 && r < GRID_SIZE &&
        c >= 0 && c < GRID_SIZE &&
        currentGrid[r][c] === null
      );
    });
  };

  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>, shape: Shape, index: number) => {
    if (gameOver) return;
    
    // Only accept left mouse click or touch
    if (e.button !== 0) return;
    
    // Capture pointer to continue receiving events even if the pointer leaves target
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {
      console.warn("Could not capture pointer:", err);
    }
    
    playSound('drag');
    
    let currentCellSize = 32;
    if (gridRef.current) {
      const rect = gridRef.current.getBoundingClientRect();
      currentCellSize = rect.width / GRID_SIZE;
    }

    setDraggingShape({
      shape,
      index,
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      cellSize: currentCellSize
    });
  };

  const handleDragMove = useCallback((e: PointerEvent) => {
    if (!draggingShape) return;
    
    // Silky smooth mobile sliding requires preventing browser document bounce/scroll
    if (e.cancelable) {
      e.preventDefault();
    }
    
    setDraggingShape(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
  }, [draggingShape]);

  const handleDragEnd = useCallback(() => {
    if (!draggingShape || !gridRef.current) return;

    // Check if the gesture was a brief tap/click rather than a drag
    const dragDistance = Math.hypot(draggingShape.x - draggingShape.startX, draggingShape.y - draggingShape.startY);
    if (dragDistance < 12) {
      handleRotate(draggingShape.index);
      setDraggingShape(null);
      return;
    }

    const rect = gridRef.current.getBoundingClientRect();
    const cellSize = rect.width / GRID_SIZE;
    
    // Calculate shape dimensions based on the modern, scaled cell size
    const maxX = Math.max(...draggingShape.shape.blocks.map(b => b.x));
    const maxY = Math.max(...draggingShape.shape.blocks.map(b => b.y));
    const shapeWidth = (maxX + 1) * cellSize;
    const shapeHeight = (maxY + 1) * cellSize;

    // Perfect offset centering above finger
    const dropX = draggingShape.x - rect.left - (shapeWidth / 2);
    const dropY = (draggingShape.y - DRAG_Y_OFFSET) - rect.top - (shapeHeight / 2);

    const col = Math.round(dropX / cellSize);
    const row = Math.round(dropY / cellSize);

    if (canPlaceShape(grid, draggingShape.shape, row, col)) {
      const newGrid = grid.map(r => [...r]);
      draggingShape.shape.blocks.forEach(block => {
        newGrid[row + block.y][col + block.x] = draggingShape.shape.color;
      });

      // Check for lines
      const rowsToClear: number[] = [];
      const colsToClear: number[] = [];

      for (let r = 0; r < GRID_SIZE; r++) {
        if (newGrid[r].every(cell => cell !== null)) rowsToClear.push(r);
      }
      for (let c = 0; c < GRID_SIZE; c++) {
        if (newGrid.every(row => row[c] !== null)) colsToClear.push(c);
      }

      const totalLines = rowsToClear.length + colsToClear.length;
      
      if (totalLines > 0) {
        const newCombo = combo + 1;
        setCombo(newCombo);
        
        let feedbackText = "Good!";
        if (totalLines === 1) feedbackText = newCombo > 1 ? `COMBO x${newCombo}!` : "Nice!";
        else if (totalLines === 2) feedbackText = "GREAT!";
        else if (totalLines === 3) feedbackText = "PERFECT!";
        else if (totalLines >= 4) feedbackText = "MASTERPIECE!";
        
        setFeedback({ text: feedbackText, id: Date.now() });
        setIsShaking(true);
        playSound('clear');
        setTimeout(() => setIsShaking(false), 400);
      } else {
        setCombo(0);
        playSound('place');
      }

      const points = draggingShape.shape.blocks.length + (totalLines * 20);
      const comboBonus = combo > 0 ? combo * 25 : 0;
      const newScore = score + points + comboBonus;
      
      setScore(newScore);

      // Level check
      const nextLevel = newScore < 500 ? 1 : newScore < 1500 ? 2 : newScore < 3000 ? 3 : newScore < 5000 ? 4 : 5 + Math.floor((newScore - 5000) / 3000);
      if (nextLevel > level) {
        setLevel(nextLevel);
        setShowLevelUp(nextLevel);
        playSound('levelup');
        setTimeout(() => setShowLevelUp(null), 2500);
      }

      if (newScore > highScore) {
        setHighScore(newScore);
        localStorage.setItem('wood-puzzle-highscore', newScore.toString());
      }
      if (combo > maxCombo) {
        setMaxCombo(combo);
      }

      if (totalLines > 0) {
        setClearingLines({ rows: rowsToClear, cols: colsToClear });
        
        // Delay actual clearing for animation
        setTimeout(() => {
          const clearedGrid = newGrid.map((r, rIdx) => 
            r.map((cell, cIdx) => {
              if (rowsToClear.includes(rIdx) || colsToClear.includes(cIdx)) return null;
              return cell;
            })
          );
          setGrid(clearedGrid);
          setClearingLines({ rows: [], cols: [] });
        }, 300);
      } else {
        setGrid(newGrid);
      }

      // Mark the used shape as null
      const nextShapes = [...availableShapes];
      nextShapes[draggingShape.index] = null;
      
      // If all shapes are used, generate 3 new ones
      if (nextShapes.every(s => s === null)) {
        setAvailableShapes(generateFairShapeSet(newGrid));
      } else {
        setAvailableShapes(nextShapes);
      }
    }

    setDraggingShape(null);
  }, [draggingShape, grid, score, highScore, availableShapes, handleRotate, combo, maxCombo, level, generateFairShapeSet]);

  useEffect(() => {
    if (draggingShape) {
      window.addEventListener('pointermove', handleDragMove, { passive: false });
      window.addEventListener('pointerup', handleDragEnd);
      window.addEventListener('pointercancel', handleDragEnd);
    }
    return () => {
      window.removeEventListener('pointermove', handleDragMove);
      window.removeEventListener('pointerup', handleDragEnd);
      window.removeEventListener('pointercancel', handleDragEnd);
    };
  }, [draggingShape, handleDragMove, handleDragEnd]);

  useEffect(() => {
    if (showInfoMessage) {
      const timer = setTimeout(() => setShowInfoMessage(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showInfoMessage]);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 1000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const resetGame = () => {
    const emptyGrid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
    setGrid(emptyGrid);
    setScore(0);
    setCombo(0);
    setLevel(1);
    setGameOver(false);
    setAvailableShapes(generateFairShapeSet(emptyGrid));
  };

  // Calculate ghost position
  let ghostPos: { row: number, col: number } | null = null;
  if (draggingShape && gridRef.current) {
    const rect = gridRef.current.getBoundingClientRect();
    const cellSize = rect.width / GRID_SIZE;
    
    const maxX = Math.max(...draggingShape.shape.blocks.map(b => b.x));
    const maxY = Math.max(...draggingShape.shape.blocks.map(b => b.y));
    const shapeWidth = (maxX + 1) * cellSize;
    const shapeHeight = (maxY + 1) * cellSize;

    const dropX = draggingShape.x - rect.left - (shapeWidth / 2);
    const dropY = (draggingShape.y - DRAG_Y_OFFSET) - rect.top - (shapeHeight / 2);
    
    const col = Math.round(dropX / cellSize);
    const row = Math.round(dropY / cellSize);
    
    if (canPlaceShape(grid, draggingShape.shape, row, col)) {
      ghostPos = { row, col };
    }
  }

  return (
    <div className="min-h-screen bg-[#A07855] flex flex-col items-center p-4 font-sans text-white select-none overflow-hidden touch-none relative">
      {/* Background Ambient particles */}
      <AmbientParticles />

      {/* Wood Grain Texture Overlay */}
      <div className="absolute inset-0 opacity-20 pointer-events-none z-0" style={{
        backgroundImage: 'url("https://www.transparenttextures.com/patterns/wood-pattern.png")',
        backgroundSize: '400px'
      }} />

      {/* Header */}
      <header className="w-full max-w-md flex flex-col items-center gap-1 mb-4 z-10">
        <div className="w-full flex justify-between items-center px-2">
          <div className="flex flex-col gap-1 items-start">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-black/30 px-4 py-1.5 rounded-full border border-white/10 shadow-inner">
                <Crown size={18} className="text-yellow-400 fill-yellow-400" />
                <span className="text-base font-bold">{highScore}</span>
              </div>
              <div className="bg-yellow-800/50 text-yellow-200 border border-yellow-400/20 text-xs font-black uppercase px-3 py-1.5 rounded-full shadow-md">
                Lv. {level}
              </div>
            </div>
            {combo > 0 && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-xs font-bold text-yellow-300 bg-yellow-900/40 px-2 py-0.5 rounded-md border border-yellow-400/20"
              >
                Combo x{combo}
              </motion.div>
            )}
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowInfoMessage(true)}
              className="p-2.5 bg-black/30 rounded-full border border-white/10 hover:bg-black/40 transition-colors shadow-inner"
            >
              <Info size={22} />
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 bg-black/30 rounded-full border border-white/10 hover:bg-black/40 transition-colors shadow-inner"
            >
              <Settings size={22} />
            </button>
          </div>
        </div>
        
        <div className="text-7xl font-black tracking-tighter drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] text-white flex items-baseline">
          <motion.span
            key={displayScore}
            initial={{ scale: 1.1, y: -5 }}
            animate={{ scale: 1, y: 0 }}
            className="inline-block"
          >
            {displayScore}
          </motion.span>
        </div>
      </header>

      {/* Grid Container */}
      <motion.div 
        animate={isShaking ? {
          x: [-2, 2, -2, 2, 0],
          y: [-1, 1, -1, 1, 0],
        } : {}}
        className="relative p-3 bg-[#5D4037] rounded-3xl shadow-[0_30px_70px_rgba(0,0,0,0.6)] border-[6px] border-[#3E2723] z-10"
      >
        <div 
          ref={gridRef}
          className="grid grid-cols-8 gap-1.5 bg-[#3E2723] p-2 rounded-2xl"
          style={{ width: 'min(94vw, 440px)', height: 'min(94vw, 440px)' }}
        >
          {grid.map((row, rIdx) => 
            row.map((cell, cIdx) => {
              const isClearing = clearingLines.rows.includes(rIdx) || clearingLines.cols.includes(cIdx);
              const isGhost = ghostPos && draggingShape?.shape.blocks.some(b => b.x + ghostPos!.col === cIdx && b.y + ghostPos!.row === rIdx);
              
              return (
                <div 
                  key={`${rIdx}-${cIdx}`}
                  className="relative rounded-lg bg-[#2D1B18] shadow-inner overflow-hidden"
                >
                  {cell && (
                    <div className="absolute inset-0">
                      <WoodBlock size="100%" color={cell} isClearing={isClearing} />
                    </div>
                  )}
                  {isGhost && !cell && (
                    <div className="absolute inset-0">
                      <WoodBlock size="100%" color={draggingShape.shape.color} isGhost />
                    </div>
                  )}
                  {/* Grid highlight for valid drop */}
                  {isGhost && !cell && (
                    <motion.div 
                      animate={{ opacity: [0.1, 0.4, 0.1] }}
                      transition={{ repeat: Infinity, duration: 1 }}
                      className="absolute inset-0 bg-yellow-400/20"
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Game Over Overlay */}
        <AnimatePresence>
          {gameOver && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm rounded-lg"
            >
              <h2 className="text-4xl font-black mb-4 text-white drop-shadow-lg">GAME OVER</h2>
              <button 
                onClick={resetGame}
                className="flex items-center gap-2 bg-[#8D6E63] hover:bg-[#795548] px-6 py-3 rounded-full font-bold text-xl shadow-lg transition-all active:scale-95"
              >
                <RotateCcw size={24} />
                PLAY AGAIN
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Instructions for Tap-to-Rotate */}
      <div className="mt-6 flex flex-col items-center gap-1 text-center bg-black/25 px-4 py-2 rounded-xl border border-white/5 shadow-inner z-10 max-w-xs transition-all hover:bg-black/35">
        <span className="text-[11px] font-black tracking-wider text-yellow-300 uppercase flex items-center gap-1">
          <RefreshCw size={10} className="animate-spin" style={{ animationDuration: '3s' }} />
          طريقة تدوير الأشكال الجديدة
        </span>
        <span className="text-[12px] font-semibold text-amber-100/90 leading-tight">
          اضغط ضغطة سريعة على أي شكل لتدويره • اسحب لوضعه!
        </span>
        <span className="text-[9px] text-white/50 font-mono tracking-widest uppercase">
          Tap shapes to rotate • Drag & drop to place
        </span>
      </div>

      <div className="mt-4 w-full max-w-md flex justify-around items-center h-44 touch-none z-10">
        {availableShapes.map((shape, idx) => (
          <motion.div 
            key={shape ? shape.id : `empty-${idx}`}
            whileHover={shape ? { scale: 1.05 } : {}}
            whileTap={shape ? { scale: 0.95 } : {}}
            className={`relative ${shape ? 'cursor-pointer hover:bg-white/10 active:scale-95 bg-white/5 border border-white/5 shadow-inner touch-none' : ''} rounded-2xl h-32 sm:h-36 flex flex-col items-center justify-center p-2 transition-colors duration-200`}
            onPointerDown={(e) => shape && handleDragStart(e, shape, idx)}
            style={{ width: '32%' }}
          >
            {shape ? (
              <>
                {/* Decorative Tiny Rotation Hint Icon */}
                <div 
                  className="absolute top-2 right-2 p-1 bg-black/30 border border-white/10 rounded-full z-10 shadow-sm pointer-events-none"
                  title="Tap container to rotate"
                >
                  <RefreshCw size={10} className="text-yellow-400 opacity-80" />
                </div>
                <div 
                  className="grid gap-1"
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(...shape.blocks.map(b => b.x)) + 1}, 28px)`,
                    gridTemplateRows: `repeat(${Math.max(...shape.blocks.map(b => b.y)) + 1}, 28px)`,
                    opacity: draggingShape?.index === idx ? 0 : 1
                  }}
                >
                  {shape.blocks.map((block, bIdx) => (
                    <div 
                      key={bIdx}
                      style={{
                        gridColumnStart: block.x + 1,
                        gridRowStart: block.y + 1,
                      }}
                    >
                      <WoodBlock size={28} color={shape.color} />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="w-24 h-24 bg-black/20 rounded-2xl border-2 border-white/5 flex items-center justify-center">
                 <div className="w-8 h-8 rounded-full border-4 border-white/5 animate-pulse" />
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Dragging Preview */}
      {draggingShape && (
        <div 
          className="fixed pointer-events-none z-[100]"
          style={{
            left: draggingShape.x,
            top: draggingShape.y - DRAG_Y_OFFSET, // Offset of 125px to clear fingers on small touch screens
            transform: 'translate(-50%, -50%) scale(1.02)',
          }}
        >
          <div 
            className="grid gap-0.5"
            style={{
              gridTemplateColumns: `repeat(${Math.max(...draggingShape.shape.blocks.map(b => b.x)) + 1}, ${draggingShape.cellSize}px)`,
              gridTemplateRows: `repeat(${Math.max(...draggingShape.shape.blocks.map(b => b.y)) + 1}, ${draggingShape.cellSize}px)`,
            }}
          >
            {draggingShape.shape.blocks.map((block, bIdx) => (
              <div 
                key={bIdx}
                style={{
                  gridColumnStart: block.x + 1,
                  gridRowStart: block.y + 1,
                }}
              >
                <WoodBlock size={draggingShape.cellSize} color={draggingShape.shape.color} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-md p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#5D4037] p-8 rounded-3xl border-4 border-[#3E2723] shadow-2xl w-full max-w-xs flex flex-col items-center gap-6"
            >
              <h3 className="text-3xl font-black">SETTINGS</h3>
              <button 
                onClick={() => {
                  resetGame();
                  setIsSettingsOpen(false);
                }}
                className="w-full flex items-center justify-center gap-3 bg-[#8D6E63] hover:bg-[#795548] py-4 rounded-2xl font-bold text-lg shadow-[0_4px_0_#5D4037] active:shadow-none active:translate-y-1 transition-all border border-white/10"
              >
                <RotateCcw size={20} />
                RESTART GAME
              </button>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="w-full bg-white/10 hover:bg-white/20 py-4 rounded-2xl font-bold text-lg border border-white/10"
              >
                CLOSE
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info Message Toast */}
      <AnimatePresence>
        {showInfoMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[300] bg-white/90 text-[#3E2723] px-6 py-3 rounded-2xl shadow-2xl border border-white font-bold text-center whitespace-nowrap"
          >
            Mazen Mohamed & Mostafa Ezzat 🚀
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feedback Message */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            key={feedback.id}
            initial={{ opacity: 0, scale: 0.2, y: 100 }}
            animate={{ 
              opacity: 1, 
              scale: [1, 1.4, 1.2], 
              y: -50,
              rotate: [0, 5, -5, 0]
            }}
            exit={{ opacity: 0, scale: 2, filter: 'blur(20px)' }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[400] pointer-events-none"
          >
            <span className="text-6xl font-black text-white drop-shadow-[0_8px_20px_rgba(0,0,0,1)] italic tracking-tighter uppercase whitespace-nowrap bg-gradient-to-b from-white to-yellow-200 bg-clip-text text-transparent">
              {feedback.text}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Level Up Notification Modal */}
      <AnimatePresence>
        {showLevelUp !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="fixed inset-0 z-[500] flex flex-col items-center justify-center bg-black/60 backdrop-blur-md pointer-events-none"
          >
            <motion.div
              initial={{ rotate: -10, y: 50 }}
              animate={{ rotate: 0, y: 0 }}
              transition={{ type: "spring", stiffness: 100 }}
              className="bg-gradient-to-br from-[#8D6E63] to-[#5D4037] p-8 rounded-2xl border-4 border-yellow-400/60 shadow-2xl text-center flex flex-col items-center gap-2"
            >
              <div className="text-yellow-400 font-extrabold tracking-widest text-sm uppercase animate-bounce">
                🎉 CONGRATULATIONS 🎉
              </div>
              <h2 className="text-5xl font-black tracking-tight text-white drop-shadow-[0_4px_6px_rgba(0,0,0,0.6)]">
                LEVEL UP!
              </h2>
              <div className="bg-yellow-400 text-[#3E2723] font-black rounded-full px-6 py-2 text-2xl mt-4 shadow-lg animate-pulse">
                LEVEL {showLevelUp}
              </div>
              <p className="text-yellow-100/80 text-xs font-semibold mt-2">
                New multi-wood designs activated!
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="mt-auto pt-4 pb-4 text-center text-[10px] text-white/30 max-w-xs leading-relaxed z-10">
        Project by Mazen Mohamed & Mostafa Ezzat - First year of secondary school - Mohamed Anwar El Sadat School
      </footer>
    </div>
  );
}
