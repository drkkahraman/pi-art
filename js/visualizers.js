/**
 * Canvas Visualizers for Pi Art & The Mona Lisa Theorem
 * Includes Infinite Coordinate Grid, Turkish Alphabet Typography & Symbol Renderers
 */

class VisualizerManager {
  constructor(canvas, engine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    this.engine = engine;
    this.currentMode = 'matrix';
    
    // Zoom & Pan state
    this.zoom = 1;
    this.panX = 60;
    this.panY = 60;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.autoFollow = true;

    // Infinite Matrix Layout Settings
    this.gridBlockSize = 14;
    this.matrixLayoutMode = 'fixed-width';
    this.matrixCols = 80;

    // Mona Lisa Theorem State
    this.targetImageCanvas = document.createElement('canvas');
    this.targetImageCtx = this.targetImageCanvas.getContext('2d', { willReadFrequently: true });
    this.targetGridSize = 64;
    this.targetImageData = null;
    this.monaLisaStats = {
      matchedPixels: 0,
      totalCompared: 0,
      similarityPercent: 0,
      longestExactStreak: 0,
      currentStreak: 0,
      bestPatchMatch: 0,
      bestPatchLocation: { x: 0, y: 0 },
      framesScanned: 1
    };

    // Walker state
    this.walkState = {
      stepLength: 12
    };

    this.showDiffOverlay = false;

    this.initDefaultMonaLisa();
    this.setupInteractions();
  }

  initDefaultMonaLisa() {
    this.targetImageCanvas.width = this.targetGridSize;
    this.targetImageCanvas.height = this.targetGridSize;
    
    const tctx = this.targetImageCtx;
    const w = this.targetGridSize;
    const h = this.targetGridSize;

    // Background sky & tuscan hills
    const bgGrad = tctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, "#4b5d67");
    bgGrad.addColorStop(0.35, "#5b6e58");
    bgGrad.addColorStop(0.55, "#3a4f41");
    bgGrad.addColorStop(1, "#241d15");
    tctx.fillStyle = bgGrad;
    tctx.fillRect(0, 0, w, h);

    // Veil and Hair
    tctx.fillStyle = "#1e1812";
    tctx.beginPath();
    tctx.ellipse(w * 0.5, h * 0.42, w * 0.28, h * 0.35, 0, 0, Math.PI * 2);
    tctx.fill();

    // Body / Dress
    const dressGrad = tctx.createRadialGradient(w * 0.5, h * 0.8, 5, w * 0.5, h * 0.8, w * 0.4);
    dressGrad.addColorStop(0, "#7d5a3c");
    dressGrad.addColorStop(0.7, "#3a2d21");
    dressGrad.addColorStop(1, "#181410");
    tctx.fillStyle = dressGrad;
    tctx.beginPath();
    tctx.ellipse(w * 0.5, h * 0.85, w * 0.42, h * 0.32, 0, 0, Math.PI * 2);
    tctx.fill();

    // Face Oval
    const faceGrad = tctx.createRadialGradient(w * 0.5, h * 0.38, 2, w * 0.5, h * 0.38, w * 0.16);
    faceGrad.addColorStop(0, "#f2d4ae");
    faceGrad.addColorStop(0.6, "#c49a6c");
    faceGrad.addColorStop(1, "#704f33");
    tctx.fillStyle = faceGrad;
    tctx.beginPath();
    tctx.ellipse(w * 0.5, h * 0.38, w * 0.14, h * 0.19, 0, 0, Math.PI * 2);
    tctx.fill();

    // Eyes and smile
    tctx.fillStyle = "#3d2b1d";
    tctx.beginPath();
    tctx.ellipse(w * 0.44, h * 0.35, w * 0.035, h * 0.018, -0.1, 0, Math.PI * 2);
    tctx.fill();
    tctx.beginPath();
    tctx.ellipse(w * 0.56, h * 0.35, w * 0.035, h * 0.018, 0.1, 0, Math.PI * 2);
    tctx.fill();
    tctx.beginPath();
    tctx.ellipse(w * 0.50, h * 0.41, w * 0.015, h * 0.04, 0, 0, Math.PI * 2);
    tctx.fill();
    tctx.strokeStyle = "#4a2d1f";
    tctx.lineWidth = Math.max(1, w * 0.02);
    tctx.beginPath();
    tctx.arc(w * 0.5, h * 0.44, w * 0.055, 0.15 * Math.PI, 0.85 * Math.PI, false);
    tctx.stroke();

    // Hands
    tctx.fillStyle = "#d4ab7c";
    tctx.beginPath();
    tctx.ellipse(w * 0.5, h * 0.72, w * 0.18, h * 0.08, 0, 0, Math.PI * 2);
    tctx.fill();

    this.targetImageData = tctx.getImageData(0, 0, w, h);
  }

  loadCustomTargetImage(imgElement) {
    this.targetImageCanvas.width = this.targetGridSize;
    this.targetImageCanvas.height = this.targetGridSize;
    this.targetImageCtx.drawImage(imgElement, 0, 0, this.targetGridSize, this.targetGridSize);
    this.targetImageData = this.targetImageCtx.getImageData(0, 0, this.targetGridSize, this.targetGridSize);
    this.resetMode();
  }

  setMode(mode) {
    this.currentMode = mode;
    this.resetCamera();
    this.resetMode();
  }

  resetCamera() {
    this.zoom = 1;
    if (this.currentMode === 'matrix') {
      this.panX = 60;
      this.panY = 60;
    } else {
      this.panX = 0;
      this.panY = 0;
    }
  }

  resetMode() {
    this.monaLisaStats = {
      matchedPixels: 0,
      totalCompared: 0,
      similarityPercent: 0,
      longestExactStreak: 0,
      currentStreak: 0,
      bestPatchMatch: 0,
      bestPatchLocation: { x: 0, y: 0 },
      framesScanned: 1
    };
    this.renderFull();
  }

  setupInteractions() {
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      this.panX = mouseX - (mouseX - this.panX) * zoomFactor;
      this.panY = mouseY - (mouseY - this.panY) * zoomFactor;
      this.zoom *= zoomFactor;
      this.zoom = Math.max(0.005, Math.min(this.zoom, 80));
      this.renderFull();
    }, { passive: false });

    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.dragStartX = e.clientX - this.panX;
      this.dragStartY = e.clientY - this.panY;
      this.autoFollow = false;
      if (window.updateAutoFollowBtn) window.updateAutoFollowBtn();
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        this.panX = e.clientX - this.dragStartX;
        this.panY = e.clientY - this.dragStartY;
        this.renderFull();
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Touch support for mobile/tablets
    let lastTouchX = 0;
    let lastTouchY = 0;
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
        this.autoFollow = false;
        if (window.updateAutoFollowBtn) window.updateAutoFollowBtn();
      }
    });

    this.canvas.addEventListener('touchmove', (e) => {
      if (this.isDragging && e.touches.length === 1) {
        const dx = e.touches[0].clientX - lastTouchX;
        const dy = e.touches[0].clientY - lastTouchY;
        this.panX += dx;
        this.panY += dy;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
        this.renderFull();
      }
    });

    this.canvas.addEventListener('touchend', () => {
      this.isDragging = false;
    });
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    this.ctx.scale(dpr, dpr);
    this.renderFull();
  }

  getCurrentFrontier() {
    const total = this.engine.totalDigits;
    if (total === 0) return { x: 0, y: 0 };
    const lastIdx = total - 1;

    if (this.matrixLayoutMode === 'square') {
      const side = Math.max(1, Math.ceil(Math.sqrt(total)));
      return { x: lastIdx % side, y: Math.floor(lastIdx / side) };
    } else {
      const cols = this.matrixCols;
      return { x: lastIdx % cols, y: Math.floor(lastIdx / cols) };
    }
  }

  renderFull() {
    if (this.currentMode === 'book' || this.currentMode === 'raw-digits' || this.currentMode === 'plain-text') {
      return;
    }
    const w = this.canvas.parentElement.clientWidth;
    const h = this.canvas.parentElement.clientHeight;

    if (this.autoFollow && (this.currentMode === 'matrix' || this.currentMode === 'monalisa')) {
      const frontier = this.getCurrentFrontier();
      const bSize = this.gridBlockSize;
      const targetScreenX = frontier.x * bSize * this.zoom;
      const targetScreenY = frontier.y * bSize * this.zoom;

      if (targetScreenY + this.panY > h * 0.75) {
        this.panY += (h * 0.5 - (targetScreenY + this.panY)) * 0.1;
      }
    }

    this.ctx.save();
    this.ctx.clearRect(0, 0, w, h);

    // Deep cosmic background
    this.ctx.fillStyle = "#080a11";
    this.ctx.fillRect(0, 0, w, h);

    // Apply Pan & Zoom
    this.ctx.translate(this.panX, this.panY);
    this.ctx.scale(this.zoom, this.zoom);

    switch (this.currentMode) {
      case 'matrix':
        this.renderInfiniteMatrix(w, h);
        break;
      case 'monalisa':
        this.renderInfiniteMonaLisa(w, h);
        break;
      case 'spiral':
        this.renderSpiral(w, h);
        break;
      case 'walk':
        this.renderWalk(w, h);
        break;
      case 'chord':
        this.renderChord(w, h);
        break;
    }

    this.ctx.restore();
  }

  /* -------------------------------------------------------------
     MODE 1 (INFINITE CANVAS): Piksel Matrisi & Türkçe Harf Tipografisi
  -------------------------------------------------------------- */
  renderInfiniteMatrix(viewW, viewH) {
    const bSize = this.gridBlockSize;
    const total = this.engine.totalDigits;
    let cols = this.matrixCols;

    if (this.matrixLayoutMode === 'square') {
      cols = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, total))));
    }

    const totalRows = Math.ceil(total / cols);

    // Viewport Culling Bounds
    const startWorldX = Math.floor(-this.panX / this.zoom);
    const startWorldY = Math.floor(-this.panY / this.zoom);
    const endWorldX = Math.ceil((viewW - this.panX) / this.zoom);
    const endWorldY = Math.ceil((viewH - this.panY) / this.zoom);

    const minCol = Math.max(0, Math.floor(startWorldX / bSize));
    const maxCol = Math.min(cols - 1, Math.ceil(endWorldX / bSize));
    const minRow = Math.max(0, Math.floor(startWorldY / bSize));
    const maxRow = Math.min(totalRows - 1, Math.ceil(endWorldY / bSize));

    // 1. Draw Coordinate System Axes & Grid Numbers
    this.drawCoordinateRulers(cols, totalRows, bSize, minCol, maxCol, minRow, maxRow);

    const isSymbolEnabled = this.engine.symbolMode !== 'none';
    const canRenderText = (bSize * this.zoom >= 9);

    if (isSymbolEnabled && canRenderText) {
      const fontSize = Math.max(8, Math.min(bSize * 0.72, 28));
      this.ctx.font = `800 ${fontSize}px 'JetBrains Mono', 'Outfit', sans-serif`;
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
    }

    // 2. Render visible Pi Pixels & Letters/Symbols
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const index = row * cols + col;
        if (index >= total) break;

        const color = this.engine.getPixelColor(index);
        const px = col * bSize;
        const py = row * bSize;

        this.ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        this.ctx.fillRect(px, py, bSize - (bSize > 4 ? 0.8 : 0), bSize - (bSize > 4 ? 0.8 : 0));

        // Render Turkish Letter / Symbol on top of pixel
        if (isSymbolEnabled && canRenderText) {
          const sym = this.engine.getPixelSymbol(index);
          if (sym) {
            // High contrast text shadow and color
            this.ctx.fillStyle = "#ffffff";
            this.ctx.fillText(sym, px + bSize / 2, py + bSize / 2);
          }
        }
      }
    }

    // 3. Draw Active Expanding Frontier Highlighter
    if (total > 0) {
      const lastIdx = total - 1;
      const lastCol = lastIdx % cols;
      const lastRow = Math.floor(lastIdx / cols);
      const fx = lastCol * bSize;
      const fy = lastRow * bSize;

      this.ctx.strokeStyle = "#00f0ff";
      this.ctx.lineWidth = Math.max(1.5, 3 / this.zoom);
      this.ctx.shadowColor = "#00f0ff";
      this.ctx.shadowBlur = 10;
      this.ctx.strokeRect(fx, fy, bSize, bSize);
      this.ctx.shadowBlur = 0;
    }
  }

  drawCoordinateRulers(cols, totalRows, bSize, minCol, maxCol, minRow, maxRow) {
    this.ctx.strokeStyle = "rgba(0, 240, 255, 0.4)";
    this.ctx.lineWidth = Math.max(1, 2 / this.zoom);

    // X Axis line
    this.ctx.beginPath();
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(cols * bSize + 40, 0);
    this.ctx.stroke();

    // Y Axis line
    this.ctx.beginPath();
    this.ctx.moveTo(0, 0);
    const maxYLine = Math.max(100, (totalRows + 2) * bSize);
    this.ctx.lineTo(0, maxYLine);
    this.ctx.stroke();

    // Origin (0,0) Marker
    this.ctx.fillStyle = "#ff007f";
    this.ctx.beginPath();
    this.ctx.arc(0, 0, Math.max(3, 5 / this.zoom), 0, Math.PI * 2);
    this.ctx.fill();

    // Coordinate Numbers
    this.ctx.font = `600 ${Math.max(9, Math.min(14, 12 / this.zoom))}px 'JetBrains Mono', monospace`;
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.6)";

    this.ctx.textAlign = "right";
    this.ctx.textBaseline = "bottom";
    this.ctx.fillText("(0,0)", -6, -6);

    const step = (this.zoom * bSize < 20) ? 50 : ((this.zoom * bSize < 50) ? 10 : 5);

    // X Ticks
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "bottom";
    for (let c = 0; c <= cols; c += step) {
      if (c >= minCol - 10 && c <= maxCol + 10) {
        const x = c * bSize;
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        this.ctx.beginPath();
        this.ctx.moveTo(x, -6);
        this.ctx.lineTo(x, 0);
        this.ctx.stroke();
        this.ctx.fillText(`X:${c}`, x + (bSize/2), -8);
      }
    }

    // Y Ticks
    this.ctx.textAlign = "right";
    this.ctx.textBaseline = "middle";
    for (let r = 0; r <= totalRows + 10; r += step) {
      if (r >= minRow - 10 && r <= maxRow + 10) {
        const y = r * bSize;
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        this.ctx.beginPath();
        this.ctx.moveTo(-6, y);
        this.ctx.lineTo(0, y);
        this.ctx.stroke();
        this.ctx.fillText(`Y:${r}`, -10, y + (bSize/2));
      }
    }
  }

  /* -------------------------------------------------------------
     MODE 2: Mona Lisa Infinite Theorem Explorer
  -------------------------------------------------------------- */
  renderInfiniteMonaLisa(viewW, viewH) {
    const gridN = this.targetGridSize;
    const framePixels = gridN * gridN;
    const total = this.engine.totalDigits;
    const totalFrames = Math.max(1, Math.ceil(total / framePixels));
    this.monaLisaStats.framesScanned = totalFrames;

    const tileSize = this.gridBlockSize;
    const frameW = gridN * tileSize;
    const frameGap = 30;
    const framesPerRow = Math.max(1, Math.floor((viewW / this.zoom) / (frameW + frameGap))) || 3;

    let matchedCount = 0;
    let totalCompared = 0;
    let currentStreak = 0;
    let maxStreak = 0;
    const targetData = this.targetImageData ? this.targetImageData.data : null;

    for (let f = 0; f < totalFrames; f++) {
      const fCol = f % framesPerRow;
      const fRow = Math.floor(f / framesPerRow);
      const frameStartX = fCol * (frameW + frameGap);
      const frameStartY = fRow * (frameW + frameGap + 25);

      this.ctx.font = "bold 12px 'Outfit', sans-serif";
      this.ctx.fillStyle = "rgba(0, 240, 255, 0.8)";
      this.ctx.textAlign = "left";
      this.ctx.fillText(`Mona Lisa Aday Kare #${f + 1} (Basamak ${f * framePixels + 1} - ${(f + 1) * framePixels})`, frameStartX, frameStartY - 8);

      this.ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      this.ctx.lineWidth = 1.5;
      this.ctx.strokeRect(frameStartX - 1, frameStartY - 1, frameW + 2, frameW + 2);

      for (let py = 0; py < gridN; py++) {
        for (let px = 0; px < gridN; px++) {
          const pixelInFrame = py * gridN + px;
          const globalIndex = f * framePixels + pixelInFrame;
          const x = frameStartX + px * tileSize;
          const y = frameStartY + py * tileSize;

          if (globalIndex < total) {
            const color = this.engine.getPixelColor(globalIndex);
            
            if (this.showDiffOverlay && targetData) {
              const tidx = pixelInFrame * 4;
              const tr = targetData[tidx];
              const tg = targetData[tidx + 1];
              const tb = targetData[tidx + 2];
              
              const diff = Math.sqrt(
                Math.pow(color[0] - tr, 2) +
                Math.pow(color[1] - tg, 2) +
                Math.pow(color[2] - tb, 2)
              );
              
              const matchRatio = Math.max(0, 1 - diff / 255);
              if (matchRatio > 0.82) {
                matchedCount++;
                currentStreak++;
                if (currentStreak > maxStreak) maxStreak = currentStreak;
                this.ctx.fillStyle = `rgba(0, 255, 128, 0.9)`;
              } else {
                currentStreak = 0;
                this.ctx.fillStyle = `rgba(${Math.round(diff/2)}, 20, 40, 0.85)`;
              }
            } else {
              this.ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 1)`;
              if (targetData) {
                const tidx = pixelInFrame * 4;
                const tr = targetData[tidx];
                const tg = targetData[tidx + 1];
                const tb = targetData[tidx + 2];
                const diff = Math.abs(color[0] - tr) + Math.abs(color[1] - tg) + Math.abs(color[2] - tb);
                if (diff < 90) {
                  matchedCount++;
                  currentStreak++;
                  if (currentStreak > maxStreak) maxStreak = currentStreak;
                } else {
                  currentStreak = 0;
                }
              }
            }
            totalCompared++;
            this.ctx.fillRect(x, y, Math.ceil(tileSize), Math.ceil(tileSize));
          } else {
            this.ctx.fillStyle = (px + py) % 2 === 0 ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.2)";
            this.ctx.fillRect(x, y, Math.ceil(tileSize), Math.ceil(tileSize));
          }
        }
      }
    }

    if (totalCompared > 0) {
      this.monaLisaStats.matchedPixels = matchedCount;
      this.monaLisaStats.totalCompared = totalCompared;
      this.monaLisaStats.similarityPercent = ((matchedCount / totalCompared) * 100).toFixed(2);
      this.monaLisaStats.longestExactStreak = maxStreak;
    }
  }

  /* -------------------------------------------------------------
     MODE 3: Archimedean & Ulam Spiral
  -------------------------------------------------------------- */
  renderSpiral(viewW, viewH) {
    const cx = viewW / 2;
    const cy = viewH / 2;
    const totalPiDigits = this.engine.totalDigits;
    const count = Math.min(totalPiDigits, 60000);
    const spacing = 1.6;
    const angleStep = 0.25;

    for (let i = 0; i < count; i++) {
      const angle = i * angleStep;
      const r = spacing * Math.sqrt(i) * 5;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      
      const color = this.engine.getPixelColor(i);
      const dotSize = Math.max(2, 6 - (r / 300));

      this.ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.85)`;
      this.ctx.beginPath();
      this.ctx.arc(x, y, dotSize / 2, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  /* -------------------------------------------------------------
     MODE 4: Pi Random Walk (Neon Trails)
  -------------------------------------------------------------- */
  renderWalk(viewW, viewH) {
    const totalDigits = this.engine.totalDigits;
    if (totalDigits === 0) return;

    const cx = viewW / 2;
    const cy = viewH / 2;
    let curX = cx;
    let curY = cy;
    const step = this.walkState.stepLength;
    const pal = COLOR_PALETTES[this.engine.currentPalette] || COLOR_PALETTES.cyberpunk;

    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.lineWidth = 2.5;

    const maxWalkSteps = Math.min(totalDigits, 20000);

    for (let i = 0; i < maxWalkSteps; i++) {
      const d = this.engine.getDigit(i);
      const angle = (d * 36) * (Math.PI / 180);
      const nextX = curX + Math.cos(angle) * step;
      const nextY = curY + Math.sin(angle) * step;

      const rgb = pal.rgb[d];
      this.ctx.strokeStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.7)`;
      this.ctx.shadowColor = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
      this.ctx.shadowBlur = 4;

      this.ctx.beginPath();
      this.ctx.moveTo(curX, curY);
      this.ctx.lineTo(nextX, nextY);
      this.ctx.stroke();

      curX = nextX;
      curY = nextY;
    }

    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = "#ffffff";
    this.ctx.beginPath();
    this.ctx.arc(curX, curY, 5, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /* -------------------------------------------------------------
     MODE 5: Pi Chord / Constellation (String Art)
  -------------------------------------------------------------- */
  renderChord(viewW, viewH) {
    const cx = viewW / 2;
    const cy = viewH / 2;
    const radius = Math.min(viewW, viewH) * 0.38;
    const totalDigits = this.engine.totalDigits;
    const pal = COLOR_PALETTES[this.engine.currentPalette] || COLOR_PALETTES.cyberpunk;

    const nodes = [];
    for (let d = 0; d < 10; d++) {
      const angle = ((d / 10) * Math.PI * 2) - Math.PI / 2;
      nodes.push({
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
        angle: angle,
        digit: d
      });
    }

    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    this.ctx.stroke();

    const maxChords = Math.min(totalDigits - 1, 15000);
    this.ctx.lineWidth = 1;

    for (let i = 0; i < maxChords; i++) {
      const d1 = this.engine.getDigit(i);
      const d2 = this.engine.getDigit(i + 1);
      const n1 = nodes[d1];
      const n2 = nodes[d2];

      const rgb = pal.rgb[d1];
      this.ctx.strokeStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.08)`;

      this.ctx.beginPath();
      this.ctx.moveTo(n1.x, n1.y);
      const midX = (n1.x + n2.x) / 2;
      const midY = (n1.y + n2.y) / 2;
      const ctrlX = midX * 0.7 + cx * 0.3;
      const ctrlY = midY * 0.7 + cy * 0.3;
      this.ctx.quadraticCurveTo(ctrlX, ctrlY, n2.x, n2.y);
      this.ctx.stroke();
    }

    this.ctx.font = "bold 16px 'Outfit', sans-serif";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";

    for (let d = 0; d < 10; d++) {
      const n = nodes[d];
      const rgb = pal.rgb[d];

      this.ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
      this.ctx.shadowColor = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
      this.ctx.shadowBlur = 10;
      this.ctx.beginPath();
      this.ctx.arc(n.x, n.y, 9, 0, Math.PI * 2);
      this.ctx.fill();

      const labelDist = radius + 28;
      const lx = cx + labelDist * Math.cos(n.angle);
      const ly = cy + labelDist * Math.sin(n.angle);
      this.ctx.shadowBlur = 0;
      this.ctx.fillStyle = "#ffffff";
      this.ctx.fillText(d.toString(), lx, ly);
    }
  }

  getPixelInfoAt(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (clientX - rect.left - this.panX) / this.zoom;
    const y = (clientY - rect.top - this.panY) / this.zoom;

    if (this.currentMode === 'matrix') {
      const bSize = this.gridBlockSize;
      let cols = this.matrixCols;
      if (this.matrixLayoutMode === 'square') {
        cols = Math.max(1, Math.ceil(Math.sqrt(this.engine.totalDigits)));
      }
      const col = Math.floor(x / bSize);
      const row = Math.floor(y / bSize);

      if (col >= 0 && col < cols && row >= 0) {
        const index = row * cols + col;
        if (index < this.engine.totalDigits) {
          const digit = this.engine.getDigit(index);
          const color = this.engine.getPixelColor(index);
          const sym = this.engine.getPixelSymbol(index);
          return {
            index: index,
            digit: digit,
            row: row,
            col: col,
            symbol: sym,
            rgb: color,
            hex: `#${((1 << 24) + (color[0] << 16) + (color[1] << 8) + color[2]).toString(16).slice(1)}`
          };
        }
      }
    } else if (this.currentMode === 'monalisa') {
      const gridN = this.targetGridSize;
      const tileSize = this.gridBlockSize;
      const frameW = gridN * tileSize;
      const frameGap = 30;
      const framesPerRow = Math.max(1, Math.floor((this.canvas.parentElement.clientWidth / this.zoom) / (frameW + frameGap))) || 3;

      const fCol = Math.floor(x / (frameW + frameGap));
      const fRow = Math.floor(y / (frameW + frameGap + 25));
      const f = fRow * framesPerRow + fCol;

      const localX = x - fCol * (frameW + frameGap);
      const localY = y - fRow * (frameW + frameGap + 25);
      const px = Math.floor(localX / tileSize);
      const py = Math.floor(localY / tileSize);

      if (px >= 0 && px < gridN && py >= 0 && py < gridN) {
        const index = f * (gridN * gridN) + (py * gridN + px);
        if (index < this.engine.totalDigits) {
          const digit = this.engine.getDigit(index);
          const color = this.engine.getPixelColor(index);
          const sym = this.engine.getPixelSymbol(index);
          return {
            index: index,
            digit: digit,
            row: py,
            col: px,
            symbol: sym,
            rgb: color,
            hex: `#${((1 << 24) + (color[0] << 16) + (color[1] << 8) + color[2]).toString(16).slice(1)}`
          };
        }
      }
    }
    return null;
  }
}

window.VisualizerManager = VisualizerManager;
