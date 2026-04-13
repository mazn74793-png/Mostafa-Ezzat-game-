/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Crown, Settings, RotateCcw, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Constants & Types ---

const GRID_SIZE = 8;
const CELL_SIZE = 40; // Base size, will be responsive

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
  { color: '#D2B48C', blocks: [{ x: 0, y: 0 }] }, // 1x1
  { color: '#D2B48C', blocks: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }, // 1x2
  { color: '#D2B48C', blocks: [{ x: 0, y: 0 }, { x: 0, y: 1 }] }, // 2x1
  { color: '#D2B48C', blocks: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] }, // 1x3
  { color: '#D2B48C', blocks: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }] }, // 3x1
  { color: '#D2B48C', blocks: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }] }, // 1x4
  { color: '#D2B48C', blocks: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }] }, // 4x1
  { color: '#D2B48C', blocks: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] }, // 2x2
  { color: '#D2B48C', blocks: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }] }, // 3x3
  { color: '#D2B48C', blocks: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] }, // L small
  { color: '#D2B48C', blocks: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] }, // L small rot
  { color: '#D2B48C', blocks: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] }, // L small rot
  { color: '#D2B48C', blocks: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] }, // L small rot
  { color: '#D2B48C', blocks: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }] }, // L large
  { color: '#D2B48C', blocks: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }] }, // L large rot
];

const getRandomShape = (): Shape => {
  const template = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  return {
    ...template,
    id: Math.random().toString(36).substr(2, 9),
  };
};

// --- Components ---

const WoodBlock = ({ size, color, isGhost = false }: { size: number | string, color: string, isGhost?: boolean }) => (
  <div
    style={{
      width: size,
      height: size,
      backgroundColor: color,
      opacity: isGhost ? 0.4 : 1,
      boxShadow: isGhost ? 'none' : 'inset -3px -3px 6px rgba(0,0,0,0.4), inset 3px 3px 6px rgba(255,255,255,0.3), 2px 2px 5px rgba(0,0,0,0.2)',
      border: isGhost ? '1px dashed rgba(255,255,255,0.3)' : '1px solid rgba(0,0,0,0.2)',
    }}
    className="rounded-md relative overflow-hidden"
  >
    {!isGhost && (
      <>
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.2) 4px, rgba(0,0,0,0.2) 5px)'
        }} />
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(to bottom right, rgba(255,255,255,0.4), transparent)'
        }} />
      </>
    )}
  </div>
);

export default function App() {
  const [grid, setGrid] = useState<(string | null)[][]>(
    Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null))
  );
  const [availableShapes, setAvailableShapes] = useState<(Shape | null)[]>([]);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [draggingShape, setDraggingShape] = useState<{ shape: Shape, index: number, x: number, y: number, startX: number, startY: number } | null>(null);
  const [clearingLines, setClearingLines] = useState<{ rows: number[], cols: number[] }>({ rows: [], cols: [] });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showInfoMessage, setShowInfoMessage] = useState(false);
  
  const gridRef = useRef<HTMLDivElement>(null);

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

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent, shape: Shape, index: number) => {
    if (gameOver) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    setDraggingShape({
      shape,
      index,
      x: clientX,
      y: clientY,
      startX: clientX,
      startY: clientY
    });
  };

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!draggingShape) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    setDraggingShape(prev => prev ? { ...prev, x: clientX, y: clientY } : null);
  }, [draggingShape]);

  const handleDragEnd = useCallback(() => {
    if (!draggingShape || !gridRef.current) return;

    const rect = gridRef.current.getBoundingClientRect();
    const cellSize = rect.width / GRID_SIZE;
    
    // Calculate shape dimensions
    const maxX = Math.max(...draggingShape.shape.blocks.map(b => b.x));
    const maxY = Math.max(...draggingShape.shape.blocks.map(b => b.y));
    const shapeWidth = (maxX + 1) * cellSize;
    const shapeHeight = (maxY + 1) * cellSize;

    // The drag point (x, y) is the center of the preview
    // We need the top-left of the shape to calculate the grid position
    const dropX = draggingShape.x - rect.left - (shapeWidth / 2);
    const dropY = (draggingShape.y - 100) - rect.top - (shapeHeight / 2);

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

      const points = draggingShape.shape.blocks.length + (rowsToClear.length + colsToClear.length) * 10;
      const newScore = score + points;
      setScore(newScore);
      if (newScore > highScore) {
        setHighScore(newScore);
        localStorage.setItem('wood-puzzle-highscore', newScore.toString());
      }

      if (rowsToClear.length > 0 || colsToClear.length > 0) {
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
  }, [draggingShape, grid, score, highScore, availableShapes]);

  useEffect(() => {
    if (draggingShape) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove, { passive: false });
      window.addEventListener('touchend', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [draggingShape, handleDragMove, handleDragEnd]);

  useEffect(() => {
    if (showInfoMessage) {
      const timer = setTimeout(() => setShowInfoMessage(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showInfoMessage]);

  const resetGame = () => {
    const emptyGrid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
    setGrid(emptyGrid);
    setScore(0);
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
    const dropY = (draggingShape.y - 100) - rect.top - (shapeHeight / 2);
    
    const col = Math.round(dropX / cellSize);
    const row = Math.round(dropY / cellSize);
    
    if (canPlaceShape(grid, draggingShape.shape, row, col)) {
      ghostPos = { row, col };
    }
  }

  return (
    <div className="min-h-screen bg-[#A07855] flex flex-col items-center p-4 font-sans text-white select-none overflow-hidden touch-none relative">
      {/* Wood Grain Texture Overlay */}
      <div className="absolute inset-0 opacity-20 pointer-events-none z-0" style={{
        backgroundImage: 'url("https://www.transparenttextures.com/patterns/wood-pattern.png")',
        backgroundSize: '400px'
      }} />

      {/* Header */}
      <header className="w-full max-w-md flex flex-col items-center gap-1 mb-4 z-10">
        <div className="w-full flex justify-between items-center px-2">
          <div className="flex items-center gap-1 bg-black/30 px-4 py-1.5 rounded-full border border-white/10 shadow-inner">
            <Crown size={18} className="text-yellow-400 fill-yellow-400" />
            <span className="text-base font-bold">{highScore}</span>
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
        
        <div className="text-7xl font-black tracking-tighter drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] text-white">
          {score}
        </div>
      </header>

      {/* Grid Container */}
      <div className="relative p-2.5 bg-[#5D4037] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-4 border-[#3E2723] z-10">
        <div 
          ref={gridRef}
          className="grid grid-cols-8 gap-1 bg-[#3E2723] p-1.5 rounded-xl"
          style={{ width: 'min(92vw, 420px)', height: 'min(92vw, 420px)' }}
        >
          {grid.map((row, rIdx) => 
            row.map((cell, cIdx) => {
              const isClearing = clearingLines.rows.includes(rIdx) || clearingLines.cols.includes(cIdx);
              const isGhost = ghostPos && draggingShape?.shape.blocks.some(b => b.x + ghostPos!.col === cIdx && b.y + ghostPos!.row === rIdx);
              
              return (
                <div 
                  key={`${rIdx}-${cIdx}`}
                  className="relative rounded-sm bg-[#2D1B18] transition-colors duration-200"
                >
                  {cell && (
                    <motion.div
                      initial={false}
                      animate={isClearing ? { opacity: 0, scale: 0.8 } : { opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-0"
                    >
                      <WoodBlock size="100%" color={cell} />
                    </motion.div>
                  )}
                  {isGhost && !cell && (
                    <div className="absolute inset-0">
                      <WoodBlock size="100%" color={draggingShape.shape.color} isGhost />
                    </div>
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
      </div>

      <div className="mt-8 w-full max-w-md flex justify-around items-center h-40 touch-none z-10">
        {availableShapes.map((shape, idx) => (
          <div 
            key={shape ? shape.id : `empty-${idx}`}
            className={`relative ${shape ? 'cursor-grab active:cursor-grabbing' : ''} touch-none flex items-center justify-center`}
            onMouseDown={(e) => shape && handleDragStart(e, shape, idx)}
            onTouchStart={(e) => shape && handleDragStart(e, shape, idx)}
            style={{ width: '30%' }}
          >
            {shape ? (
              <div 
                className="grid gap-0.5"
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
            ) : (
              <div className="w-20 h-20 bg-black/10 rounded-lg border border-white/5" /> // Placeholder for used shape
            )}
          </div>
        ))}
      </div>

      {/* Dragging Preview */}
      {draggingShape && (
        <div 
          className="fixed pointer-events-none z-[100]"
          style={{
            left: draggingShape.x,
            top: draggingShape.y - 100, // Consistent offset (2.5 * cellSize approx)
            transform: 'translate(-50%, -50%) scale(1.1)',
          }}
        >
          <div 
            className="grid gap-0.5"
            style={{
              gridTemplateColumns: `repeat(${Math.max(...draggingShape.shape.blocks.map(b => b.x)) + 1}, 32px)`,
              gridTemplateRows: `repeat(${Math.max(...draggingShape.shape.blocks.map(b => b.y)) + 1}, 32px)`,
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
                <WoodBlock size={32} color={draggingShape.shape.color} />
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
                className="w-full flex items-center justify-center gap-3 bg-[#8D6E63] hover:bg-[#795548] py-4 rounded-2xl font-bold text-lg shadow-lg"
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

      {/* Footer */}
      <footer className="mt-auto pt-4 pb-4 text-center text-[10px] text-white/30 max-w-xs leading-relaxed z-10">
        Project by Mazen Mohamed & Mostafa Ezzat - First year of secondary school - Mohamed Anwar El Sadat School
      </footer>
    </div>
  );
}
