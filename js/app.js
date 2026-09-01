/**
 * Main Application Controller for Pi Art, Mona Lisa Theorem & Infinite Pi Book Reader
 * Includes SQLite Persistent Database Synchronization
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Core Components
  const canvas = document.getElementById('piCanvas');
  const engine = new PiEngine();
  engine.symbolMode = 'turkish-dual'; // default to Turkish Alphabet letters
  const visualizer = new VisualizerManager(canvas, engine);
  const synth = new PiSynthesizer();

  // Book Reader State
  let bookCurrentPage = 1;
  const charsPerPage = 750;
  let isBookLiveFollowing = true;

  // Plain Views State (Sade Sayı ve Sade Yazı)
  let isAutoScrollDigits = true;
  let isAutoScrollText = true;
  let digitsGrouping = 'blocks-10'; // 'blocks-10', 'lines-50', 'continuous'
  let textDecodeMode = 'turkish-dual'; // 'turkish-dual', 'turkish-freq', 'ascii'
  let fontSizeDigits = 15;
  let fontSizeText = 16;

  // Storage Persistence State
  const storage = new PiStorageManager();
  let latestStreamerState = null;

  // 2. Initialize Web Worker for Pi Calculation
  let worker = null;
  let isRunning = false;
  let targetSpeed = 500;
  let lastFpsCalcTime = performance.now();
  let digitsCalculatedInInterval = 0;

  function initWorker() {
    try {
      worker = new Worker('js/pi-worker.js');
    } catch (e) {
      console.warn("Direct worker fallback...", e);
      const workerScript = `
        class PiStreamer {
          constructor() { this.reset(); }
          reset() { this.count = 0; this.buffer = ""; this.chunkSize = 10000; }
          getState() { return { count: this.count }; }
          setState(state) { if (state) this.count = Number(state.count ?? 0); }
          computeChudnovsky(targetDigits) {
            if (this.buffer.length >= targetDigits) return;
            const digitsNeeded = Math.max(targetDigits, this.buffer.length + Math.max(this.chunkSize, Math.floor(targetDigits * 0.5)));
            const N = Math.ceil(digitsNeeded / 14.181647462725477) + 5;
            const PREC = BigInt(digitsNeeded + 30);
            function bs(a, b) {
              if (b - a === 1) {
                if (a === 0) return { P: 1n, Q: 1n, T: 13591409n };
                const k = BigInt(a);
                const P = -(6n * k - 5n) * (2n * k - 1n) * (6n * k - 1n);
                const Q = k * k * k * 10939058860032000n;
                const T = P * (13591409n + 545140134n * k);
                return { P, Q, T };
              }
              const m = (a + b) >> 1;
              const left = bs(a, m); const right = bs(m, b);
              return { P: left.P * right.P, Q: left.Q * right.Q, T: left.T * right.Q + left.P * right.T };
            }
            const { Q, T } = bs(0, N);
            function isqrt(n) {
              if (n <= 0n) return 0n;
              let x0 = 10n ** (BigInt(n.toString().length) / 2n + 1n);
              let x1 = (x0 + n / x0) >> 1n;
              while (x1 < x0) { x0 = x1; x1 = (x0 + n / x0) >> 1n; }
              return x0;
            }
            const sqrt10005 = isqrt(10005n * (10n ** (2n * PREC)));
            const pi = (426880n * sqrt10005 * Q) / T;
            this.buffer = pi.toString().slice(0, digitsNeeded);
          }
          nextDigit() {
            if (this.count >= this.buffer.length) this.computeChudnovsky(this.count + 1);
            return parseInt(this.buffer[this.count++], 10) || 0;
          }
          getBatch(batchSize = 100) {
            if (this.count + batchSize > this.buffer.length) this.computeChudnovsky(this.count + batchSize);
            const digits = new Uint8Array(batchSize);
            for (let i = 0; i < batchSize; i++) digits[i] = parseInt(this.buffer[this.count + i], 10) || 0;
            this.count += batchSize;
            return digits;
          }
        }
        const streamer = new PiStreamer();
        let isRunning = false;
        let speed = 50;
        let intervalMs = 20;
        let timerId = null;
        function tick() {
          if (!isRunning) return;
          const digits = streamer.getBatch(speed);
          self.postMessage({ type: 'digits', digits: digits, totalCount: streamer.count, state: streamer.getState() }, [digits.buffer]);
          timerId = setTimeout(tick, intervalMs);
        }
        self.onmessage = function(e) {
          const { command, value } = e.data;
          if (command === 'start') { if (!isRunning) { isRunning = true; tick(); } }
          else if (command === 'pause') {
            isRunning = false;
            if (timerId) clearTimeout(timerId);
            self.postMessage({ type: 'paused', totalCount: streamer.count, state: streamer.getState() });
          }
          else if (command === 'getState') {
            self.postMessage({ type: 'state', totalCount: streamer.count, state: streamer.getState() });
          }
          else if (command === 'setState') {
            streamer.setState(value);
            self.postMessage({ type: 'state_set', totalCount: streamer.count, state: streamer.getState() });
          }
          else if (command === 'reset') { isRunning = false; if (timerId) clearTimeout(timerId); streamer.reset(); self.postMessage({ type: 'reset_done' }); }
          else if (command === 'skipTo') {
            const targetCount = parseInt(value, 10) || 0;
            streamer.count = targetCount;
            if (streamer.count > streamer.buffer.length) streamer.computeChudnovsky(streamer.count);
            self.postMessage({ type: 'skipped', totalCount: streamer.count, state: streamer.getState() });
          }
          else if (command === 'burst') {
            const burstCount = Math.min(200000, value || 1000);
            const burstDigits = streamer.getBatch(burstCount);
            self.postMessage({ type: 'digits', digits: burstDigits, totalCount: streamer.count, state: streamer.getState() }, [burstDigits.buffer]);
          }
          else if (command === 'setSpeed') {
            const dps = Math.max(1, value);
            speed = Math.max(1, Math.round(dps / 50));
            intervalMs = 20;
          }
          else if (command === 'burst') {
            const burstDigits = streamer.getBatch(value || 10000);
            self.postMessage({ type: 'digits', digits: burstDigits, totalCount: streamer.count, state: streamer.getState() }, [burstDigits.buffer]);
          }
        };
      `;
      const blob = new Blob([workerScript], { type: 'application/javascript' });
      worker = new Worker(URL.createObjectURL(blob));
    }

    worker.onmessage = (e) => {
      const data = e.data;
      if (data.state) {
        latestStreamerState = data.state;
      }

      if (data.type === 'digits') {
        const newDigits = data.digits;
        engine.addDigits(newDigits);
        digitsCalculatedInInterval += newDigits.length;

        if (synth.isEnabled && newDigits.length > 0) {
          synth.playDigit(newDigits[newDigits.length - 1]);
        }

        requestCanvasRender();
        updateRibbon();
        if (visualizer.currentMode === 'book') {
          updateBookView();
        } else if (visualizer.currentMode === 'raw-digits') {
          updateRawDigitsView();
        } else if (visualizer.currentMode === 'plain-text') {
          updatePlainTextView();
        }
      } else if (data.type === 'paused') {
        // Immediate persistence on worker pause
        storage.save(engine, latestStreamerState);
      } else if (data.type === 'reset_done') {
        latestStreamerState = null;
        engine.reset();
        visualizer.resetMode();
        bookCurrentPage = 1;
        updateHUD();
        updateRibbon();
        updateBookView();
        updateRawDigitsView();
        updatePlainTextView();
      }
    };
  }

  initWorker();

  // 3. UI Element References
  const piBookContainer = document.getElementById('piBookContainer');
  const bookTextBody = document.getElementById('bookTextBody');
  const bookPageIndicator = document.getElementById('bookPageIndicator');
  const bookWordCount = document.getElementById('bookWordCount');
  const bookCharCount = document.getElementById('bookCharCount');
  const btnBookPrevPage = document.getElementById('btnBookPrevPage');
  const btnBookNextPage = document.getElementById('btnBookNextPage');
  const btnBookLivePage = document.getElementById('btnBookLivePage');

  // Plain Raw Digits View Elements
  const piRawDigitsContainer = document.getElementById('piRawDigitsContainer');
  const rawDigitsCounter = document.getElementById('rawDigitsCounter');
  const selectDigitsGrouping = document.getElementById('selectDigitsGrouping');
  const btnFontDecDigits = document.getElementById('btnFontDecDigits');
  const btnFontIncDigits = document.getElementById('btnFontIncDigits');
  const btnAutoScrollDigits = document.getElementById('btnAutoScrollDigits');
  const autoScrollDigitsIcon = document.getElementById('autoScrollDigitsIcon');
  const autoScrollDigitsText = document.getElementById('autoScrollDigitsText');
  const btnCopyDigits = document.getElementById('btnCopyDigits');
  const rawDigitsBody = document.getElementById('rawDigitsBody');
  const rawDigitsContent = document.getElementById('rawDigitsContent');
  const rawLastDigit = document.getElementById('rawLastDigit');

  // Plain Text View Elements
  const piPlainTextContainer = document.getElementById('piPlainTextContainer');
  const plainTextCounter = document.getElementById('plainTextCounter');
  const selectTextDecodeMode = document.getElementById('selectTextDecodeMode');
  const btnFontDecText = document.getElementById('btnFontDecText');
  const btnFontIncText = document.getElementById('btnFontIncText');
  const btnAutoScrollText = document.getElementById('btnAutoScrollText');
  const autoScrollTextIcon = document.getElementById('autoScrollTextIcon');
  const autoScrollTextText = document.getElementById('autoScrollTextText');
  const btnCopyPlainText = document.getElementById('btnCopyPlainText');
  const plainTextBody = document.getElementById('plainTextBody');
  const plainTextContent = document.getElementById('plainTextContent');
  const plainWordCountStat = document.getElementById('plainWordCountStat');

  // Toast Notification
  const toastNotification = document.getElementById('toastNotification');
  const toastIcon = document.getElementById('toastIcon');
  const toastMessage = document.getElementById('toastMessage');

  const sqliteStatusText = document.getElementById('sqliteStatusText');
  const btnPlayPause = document.getElementById('btnPlayPause');
  const playPauseIcon = document.getElementById('playPauseIcon');
  const playPauseText = document.getElementById('playPauseText');
  const btnReset = document.getElementById('btnReset');
  const btnBurst10k = document.getElementById('btnBurst10k');
  const btnResetView = document.getElementById('btnResetView');
  const sliderSpeed = document.getElementById('sliderSpeed');
  const valSpeed = document.getElementById('valSpeed');
  const selectPalette = document.getElementById('selectPalette');
  const palettePreview = document.getElementById('palettePreview');
  const selectMapping = document.getElementById('selectMapping');
  const selectSymbolMode = document.getElementById('selectSymbolMode');
  const valSymbolMode = document.getElementById('valSymbolMode');
  const selectGrowthMode = document.getElementById('selectGrowthMode');
  const gridColsContainer = document.getElementById('gridColsContainer');
  const sliderGridCols = document.getElementById('sliderGridCols');
  const valGridCols = document.getElementById('valGridCols');
  const sliderGridSize = document.getElementById('sliderGridSize');
  const valGridSize = document.getElementById('valGridSize');
  const btnToggleDiff = document.getElementById('btnToggleDiff');
  const targetImageInput = document.getElementById('targetImageInput');
  const btnAudioToggle = document.getElementById('btnAudioToggle');
  const audioIcon = document.getElementById('audioIcon');
  const btnExportImage = document.getElementById('btnExportImage');
  const btnToggleAutoFollow = document.getElementById('btnToggleAutoFollow');
  const autoFollowText = document.getElementById('autoFollowText');
  const modeNavButtons = document.querySelectorAll('.mode-btn');
  const hudTotalDigits = document.getElementById('hudTotalDigits');
  const hudSpeedRate = document.getElementById('hudSpeedRate');
  const hudCoordsCard = document.getElementById('hudCoordsCard');
  const hudCoords = document.getElementById('hudCoords');
  const hudGridArea = document.getElementById('hudGridArea');
  const hudMonaLisaCard = document.getElementById('hudMonaLisaCard');
  const hudSimilarity = document.getElementById('hudSimilarity');
  const hudFramesCount = document.getElementById('hudFramesCount');
  const hudZoom = document.getElementById('hudZoom');
  const streamDigits = document.getElementById('streamDigits');
  const streamTurkishText = document.getElementById('streamTurkishText');
  const pixelInspector = document.getElementById('pixelInspector');
  const inspectColorChip = document.getElementById('inspectColorChip');
  const inspectHex = document.getElementById('inspectHex');
  const inspectDigit = document.getElementById('inspectDigit');
  const inspectSymbol = document.getElementById('inspectSymbol');
  const inspectIndex = document.getElementById('inspectIndex');
  const inspectX = document.getElementById('inspectX');
  const inspectY = document.getElementById('inspectY');
  const inputSearch = document.getElementById('inputSearch');
  const btnSearch = document.getElementById('btnSearch');
  const searchResult = document.getElementById('searchResult');
  const inputWordSearch = document.getElementById('inputWordSearch');
  const btnWordSearch = document.getElementById('btnWordSearch');
  const wordSearchResult = document.getElementById('wordSearchResult');

  // 4. Permanent Storage Synchronization Setup
  storage.onStatusChange((status) => {
    if (sqliteStatusText) {
      if (status.state === 'saving') {
        sqliteStatusText.textContent = "Kaydediliyor...";
        sqliteStatusText.style.color = 'var(--accent-gold)';
      } else if (status.count > 0) {
        sqliteStatusText.textContent = `Kayıtlı: ${status.count.toLocaleString('tr-TR')} basamak`;
        sqliteStatusText.style.color = 'var(--accent-green)';
      } else {
        sqliteStatusText.textContent = status.message || `Senkronize (0 basamak)`;
        sqliteStatusText.style.color = 'var(--text-muted)';
      }
    }
  });

  async function triggerStorageSave() {
    await storage.save(engine, latestStreamerState);
  }

  // Periodic auto-sync every 2.0 seconds while running
  setInterval(() => {
    if (isRunning && engine.totalDigits > storage.lastSavedDigitCount) {
      triggerStorageSave();
    }
  }, 2000);

  // Auto-save on page close or tab switch
  window.addEventListener('beforeunload', () => {
    storage.save(engine, latestStreamerState);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      storage.save(engine, latestStreamerState);
    }
  });

  // 5. Render Loop with Dirty Flag
  let isRenderPending = false;
  function requestCanvasRender() {
    if (!isRenderPending) {
      isRenderPending = true;
      requestAnimationFrame(() => {
        if (visualizer.currentMode !== 'book') {
          visualizer.renderFull();
        }
        isRenderPending = false;
        updateHUD();
      });
    }
  }

  // 6. Update Palette Swatches Preview
  function updatePalettePreview() {
    const pal = COLOR_PALETTES[engine.currentPalette] || COLOR_PALETTES.cyberpunk;
    palettePreview.innerHTML = '';
    pal.colors.forEach(col => {
      const swatch = document.createElement('div');
      swatch.className = 'palette-swatch';
      swatch.style.backgroundColor = col;
      palettePreview.appendChild(swatch);
    });
  }

  // 7. Update HUD Stats & Coordinates
  function updateHUD() {
    const total = engine.totalDigits;
    hudTotalDigits.textContent = total.toLocaleString('tr-TR');
    hudZoom.textContent = visualizer.zoom.toFixed(1) + 'x';

    const frontier = visualizer.getCurrentFrontier();
    hudCoords.textContent = `X: ${frontier.x.toLocaleString('tr-TR')}, Y: ${frontier.y.toLocaleString('tr-TR')}`;
    hudGridArea.textContent = `${total.toLocaleString('tr-TR')} piksel²`;

    if (visualizer.currentMode === 'monalisa') {
      hudMonaLisaCard.style.display = 'block';
      hudCoordsCard.style.display = 'none';
      hudSimilarity.textContent = visualizer.monaLisaStats.similarityPercent + '%';
      hudFramesCount.textContent = visualizer.monaLisaStats.framesScanned;
    } else {
      hudMonaLisaCard.style.display = 'none';
      hudCoordsCard.style.display = 'block';
    }

    const now = performance.now();
    const elapsed = now - lastFpsCalcTime;
    if (elapsed >= 1000) {
      const currentDps = Math.round((digitsCalculatedInInterval / elapsed) * 1000);
      hudSpeedRate.textContent = `${currentDps.toLocaleString('tr-TR')} basamak/sn`;
      digitsCalculatedInInterval = 0;
      lastFpsCalcTime = now;
    }
  }

  // 8. Update Live Pi Stream Ribbon & Decoded Turkish Text
  function updateRibbon() {
    const total = engine.totalDigits;
    if (total === 0) {
      streamDigits.textContent = "3.1415926535...";
      if (streamTurkishText) streamTurkishText.textContent = "A B Ç D E...";
      return;
    }

    const previewLength = 60;
    const start = Math.max(1, total - previewLength);
    const recentDigits = engine.getSlice(start, total);
    
    let text = start <= 1 ? "3." : "...";
    for (let i = 0; i < recentDigits.length; i++) {
      text += recentDigits[i];
    }
    streamDigits.textContent = text;

    if (streamTurkishText) {
      const fullText = engine.decodedTurkishText;
      const textLen = fullText.length;
      if (textLen === 0) {
        streamTurkishText.textContent = "A B Ç D E...";
      } else {
        const textStart = Math.max(0, textLen - 45);
        let preview = textStart > 0 ? "..." : "";
        preview += fullText.slice(textStart, textLen);
        streamTurkishText.textContent = preview;
      }
    }
  }

  // 9. Pi Book Reader Engine
  function updateBookView() {
    const rawText = engine.decodedTurkishText;
    const totalChars = rawText.length;
    const totalPages = Math.max(1, Math.ceil(totalChars / charsPerPage));

    if (isBookLiveFollowing) {
      bookCurrentPage = totalPages;
    } else {
      bookCurrentPage = Math.min(bookCurrentPage, totalPages);
    }

    bookPageIndicator.textContent = `Sayfa ${bookCurrentPage} / ${totalPages}`;
    bookCharCount.textContent = `${totalChars.toLocaleString('tr-TR')} Harf`;
    
    const words = rawText.trim().split(/\s+/).filter(Boolean);
    bookWordCount.textContent = `${words.length.toLocaleString('tr-TR')} Kelime`;

    const pageStart = (bookCurrentPage - 1) * charsPerPage;
    const pageEnd = Math.min(totalChars, pageStart + charsPerPage);
    const pageString = rawText.substring(pageStart, pageEnd) || "Pi sayısının sonsuz basamakları çözümleniyor...";

    const paragraphs = [];
    const paragraphSize = 220;
    for (let i = 0; i < pageString.length; i += paragraphSize) {
      paragraphs.push(pageString.substring(i, i + paragraphSize));
    }

    let html = "";
    paragraphs.forEach((p, idx) => {
      let pText = p;
      const searchWord = inputWordSearch ? inputWordSearch.value.trim().toUpperCase() : "";
      if (searchWord && searchWord.length >= 2) {
        const regex = new RegExp(searchWord, "gi");
        pText = pText.replace(regex, match => `<span class="book-highlight-word">${match}</span>`);
      }

      if (idx === 0 && pText.length > 0) {
        const firstChar = pText.charAt(0);
        const rest = pText.slice(1);
        html += `<p class="book-paragraph"><span class="drop-cap">${firstChar}</span>${rest}</p>`;
      } else {
        html += `<p class="book-paragraph">${pText}</p>`;
      }
    });

    bookTextBody.innerHTML = html;
  }

  btnBookPrevPage.addEventListener('click', () => {
    if (bookCurrentPage > 1) {
      bookCurrentPage--;
      isBookLiveFollowing = false;
      btnBookLivePage.classList.remove('btn-primary');
      updateBookView();
    }
  });

  btnBookNextPage.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(engine.decodedTurkishText.length / charsPerPage));
    if (bookCurrentPage < totalPages) {
      bookCurrentPage++;
      if (bookCurrentPage === totalPages) {
        isBookLiveFollowing = true;
        btnBookLivePage.classList.add('btn-primary');
      } else {
        isBookLiveFollowing = false;
        btnBookLivePage.classList.remove('btn-primary');
      }
      updateBookView();
    }
  });

  btnBookLivePage.addEventListener('click', () => {
    isBookLiveFollowing = true;
    btnBookLivePage.classList.add('btn-primary');
    updateBookView();
  });

  // =========================================================
  // 10. Toast Notification & Plain Views (Sade Sayı / Sade Yazı)
  // =========================================================
  let toastTimer = null;
  function showToast(message, icon = "✨") {
    if (toastNotification && toastMessage) {
      toastMessage.textContent = message;
      if (toastIcon) toastIcon.textContent = icon;
      toastNotification.classList.add('show');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toastNotification.classList.remove('show');
      }, 2500);
    }
  }

  // Update Plain Raw Digits View
  function updateRawDigitsView() {
    const total = engine.totalDigits;
    if (rawDigitsCounter) {
      rawDigitsCounter.textContent = `${total.toLocaleString('tr-TR')} basamak`;
    }

    if (total <= 1) {
      if (rawDigitsContent) {
        if (total === 0) {
          rawDigitsContent.innerHTML = "Henüz basamak hesaplanmadı... <strong>Başlat</strong> butonuna basın.";
        } else {
          rawDigitsContent.innerHTML = "<span class='live-digit-pulse'>1</span>415926535...";
        }
      }
      if (rawLastDigit) rawLastDigit.textContent = total === 1 ? engine.getDigit(0) : "-";
      return;
    }

    const last = engine.getDigit(total - 1);
    if (rawLastDigit) rawLastDigit.textContent = last !== undefined ? last : "-";

    if (!rawDigitsContent) return;

    // Fractional digits start from index 1 (since index 0 is integer '3')
    const maxRender = 15000;
    let startIdx = 1;
    let isTruncated = false;
    if (total - 1 > maxRender) {
      startIdx = total - maxRender;
      isTruncated = true;
    }

    const digitsSlice = engine.getSlice(startIdx, total);
    let html = "";

    if (isTruncated) {
      html += `<div style="color: var(--text-muted); font-size: 11px; margin-bottom: 8px;">[... İlk ${(startIdx - 1).toLocaleString('tr-TR')} basamak performans için gizlendi. Tamamı 'Sayıyı Kopyala' butonuyla panoya kopyalanabilir.]</div>`;
    }

    if (digitsGrouping === 'blocks-10') {
      let block = "";
      for (let i = 0; i < digitsSlice.length; i++) {
        block += digitsSlice[i];
        if (block.length === 10 || i === digitsSlice.length - 1) {
          if (i === digitsSlice.length - 1) {
            const blockPrefix = block.slice(0, -1);
            const finalChar = block.slice(-1);
            html += `<span class="digit-block">${blockPrefix}<span class="live-digit-pulse">${finalChar}</span></span>`;
          } else {
            html += `<span class="digit-block">${block}</span>`;
          }
          block = "";
        }
      }
    } else if (digitsGrouping === 'lines-50') {
      const lineSize = 50;
      for (let i = 0; i < digitsSlice.length; i += lineSize) {
        const lineEnd = Math.min(digitsSlice.length, i + lineSize);
        const actualStart = startIdx + i;
        const actualEnd = startIdx + lineEnd - 1;
        const numLabel = `[${String(actualStart).padStart(6, '0')} - ${String(actualEnd).padStart(6, '0')}]`;
        
        let chunk = "";
        for (let j = i; j < lineEnd; j++) {
          chunk += digitsSlice[j];
          if ((j - i + 1) % 10 === 0 && j < lineEnd - 1) chunk += " ";
        }

        if (lineEnd === digitsSlice.length) {
          const chunkPrefix = chunk.slice(0, -1);
          const finalChar = chunk.slice(-1);
          html += `<div class="digit-line-row"><span class="digit-line-num">${numLabel}</span><span class="digit-line-val">${chunkPrefix}<span class="live-digit-pulse">${finalChar}</span></span></div>`;
        } else {
          html += `<div class="digit-line-row"><span class="digit-line-num">${numLabel}</span><span class="digit-line-val">${chunk}</span></div>`;
        }
      }
    } else {
      // Continuous
      let str = "";
      for (let i = 0; i < digitsSlice.length - 1; i++) {
        str += digitsSlice[i];
      }
      const lastChar = digitsSlice[digitsSlice.length - 1];
      html = str + `<span class="live-digit-pulse">${lastChar}</span>`;
    }

    rawDigitsContent.innerHTML = html;

    if (isAutoScrollDigits && rawDigitsBody) {
      rawDigitsBody.scrollTop = rawDigitsBody.scrollHeight;
    }
  }

  // Update Plain Text View
  function updatePlainTextView() {
    let fullText = "";

    if (textDecodeMode === 'turkish-dual') {
      fullText = engine.decodedTurkishText;
    } else if (textDecodeMode === 'turkish-freq') {
      const maxLen = Math.min(engine.digits.length, 50000);
      let s = "";
      for (let i = 0; i < maxLen; i++) {
        const d = engine.digits[i];
        s += TURKISH_FREQUENT_LETTERS[d] || "";
      }
      fullText = s;
    } else if (textDecodeMode === 'ascii') {
      const maxLen = Math.min(engine.digits.length - 1, 50000);
      let s = "";
      for (let i = 0; i < maxLen; i += 2) {
        const code = (engine.digits[i] * 10 + engine.digits[i + 1]);
        if (code >= 32 && code <= 126) {
          s += String.fromCharCode(code);
        } else {
          s += " ";
        }
      }
      fullText = s;
    }

    const totalChars = fullText.length;
    const words = fullText.trim().split(/\s+/).filter(Boolean);
    const totalWords = words.length;

    if (plainTextCounter) {
      plainTextCounter.textContent = `${totalChars.toLocaleString('tr-TR')} harf • ${totalWords.toLocaleString('tr-TR')} kelime`;
    }
    if (plainWordCountStat) {
      plainWordCountStat.textContent = totalWords.toLocaleString('tr-TR');
    }

    if (!plainTextContent) return;

    if (totalChars === 0) {
      plainTextContent.innerHTML = "Pi sayısının sonsuz basamakları harflere ve kelimelere dönüştürülüyor... <strong>Başlat</strong> butonuna basın.";
      return;
    }

    // Display limit for snappy performance
    const maxChars = 20000;
    let displayText = fullText;
    let isTruncated = false;
    if (totalChars > maxChars) {
      displayText = fullText.slice(totalChars - maxChars);
      isTruncated = true;
    }

    let formattedText = displayText;
    const searchWord = inputWordSearch ? inputWordSearch.value.trim().toUpperCase() : "";
    if (searchWord && searchWord.length >= 2) {
      const regex = new RegExp(searchWord, "gi");
      formattedText = formattedText.replace(regex, match => `<span class="plain-text-highlight">${match}</span>`);
    }

    let html = "";
    if (isTruncated) {
      html += `<div style="color: var(--text-muted); font-size: 11px; margin-bottom: 8px;">[... İlk ${(totalChars - maxChars).toLocaleString('tr-TR')} karakter gizlendi. Tamamı 'Metni Kopyala' butonuyla panoya kopyalanabilir.]</div>`;
    }
    html += formattedText;

    plainTextContent.innerHTML = html;

    if (isAutoScrollText && plainTextBody) {
      plainTextBody.scrollTop = plainTextBody.scrollHeight;
    }
  }

  // Plain Views Event Listeners
  if (selectDigitsGrouping) {
    selectDigitsGrouping.addEventListener('change', (e) => {
      digitsGrouping = e.target.value;
      updateRawDigitsView();
    });
  }

  if (btnAutoScrollDigits) {
    btnAutoScrollDigits.addEventListener('click', () => {
      isAutoScrollDigits = !isAutoScrollDigits;
      autoScrollDigitsIcon.textContent = isAutoScrollDigits ? '⚡' : '⏸';
      autoScrollDigitsText.textContent = isAutoScrollDigits ? 'Oto-Kaydır: Açık' : 'Oto-Kaydır: Kapalı';
      btnAutoScrollDigits.classList.toggle('btn-primary', isAutoScrollDigits);
      if (isAutoScrollDigits && rawDigitsBody) {
        rawDigitsBody.scrollTop = rawDigitsBody.scrollHeight;
      }
    });
  }

  if (btnFontDecDigits) {
    btnFontDecDigits.addEventListener('click', () => {
      fontSizeDigits = Math.max(11, fontSizeDigits - 1);
      if (rawDigitsBody) rawDigitsBody.style.fontSize = `${fontSizeDigits}px`;
    });
  }

  if (btnFontIncDigits) {
    btnFontIncDigits.addEventListener('click', () => {
      fontSizeDigits = Math.min(26, fontSizeDigits + 1);
      if (rawDigitsBody) rawDigitsBody.style.fontSize = `${fontSizeDigits}px`;
    });
  }

  if (btnCopyDigits) {
    btnCopyDigits.addEventListener('click', async () => {
      const total = engine.totalDigits;
      if (total === 0) {
        showToast("Kopyalanacak basamak yok!", "⚠️");
        return;
      }
      let fullPiStr = "3.";
      const fracDigitsSlice = engine.getSlice(1, total);
      for (let i = 0; i < fracDigitsSlice.length; i++) {
        fullPiStr += fracDigitsSlice[i];
      }
      try {
        await navigator.clipboard.writeText(fullPiStr);
        showToast(`${total.toLocaleString('tr-TR')} basamak panoya kopyalandı!`, "📋");
      } catch (err) {
        showToast("Panoya kopyalama başarısız oldu.", "❌");
      }
    });
  }

  if (selectTextDecodeMode) {
    selectTextDecodeMode.addEventListener('change', (e) => {
      textDecodeMode = e.target.value;
      updatePlainTextView();
    });
  }

  if (btnAutoScrollText) {
    btnAutoScrollText.addEventListener('click', () => {
      isAutoScrollText = !isAutoScrollText;
      autoScrollTextIcon.textContent = isAutoScrollText ? '⚡' : '⏸';
      autoScrollTextText.textContent = isAutoScrollText ? 'Oto-Kaydır: Açık' : 'Oto-Kaydır: Kapalı';
      btnAutoScrollText.classList.toggle('btn-primary', isAutoScrollText);
      if (isAutoScrollText && plainTextBody) {
        plainTextBody.scrollTop = plainTextBody.scrollHeight;
      }
    });
  }

  if (btnFontDecText) {
    btnFontDecText.addEventListener('click', () => {
      fontSizeText = Math.max(12, fontSizeText - 1);
      if (plainTextBody) plainTextBody.style.fontSize = `${fontSizeText}px`;
    });
  }

  if (btnFontIncText) {
    btnFontIncText.addEventListener('click', () => {
      fontSizeText = Math.min(28, fontSizeText + 1);
      if (plainTextBody) plainTextBody.style.fontSize = `${fontSizeText}px`;
    });
  }

  if (btnCopyPlainText) {
    btnCopyPlainText.addEventListener('click', async () => {
      let fullText = "";
      if (textDecodeMode === 'turkish-dual') {
        fullText = engine.decodedTurkishText;
      } else if (textDecodeMode === 'turkish-freq') {
        for (let i = 0; i < engine.digits.length; i++) {
          fullText += TURKISH_FREQUENT_LETTERS[engine.digits[i]] || "";
        }
      } else if (textDecodeMode === 'ascii') {
        for (let i = 0; i < engine.digits.length - 1; i += 2) {
          const code = (engine.digits[i] * 10 + engine.digits[i + 1]);
          fullText += (code >= 32 && code <= 126) ? String.fromCharCode(code) : " ";
        }
      }

      if (!fullText || fullText.length === 0) {
        showToast("Kopyalanacak metin yok!", "⚠️");
        return;
      }

      try {
        await navigator.clipboard.writeText(fullText);
        showToast(`${fullText.length.toLocaleString('tr-TR')} harflik metin kopyalandı!`, "📝");
      } catch (err) {
        showToast("Panoya kopyalama başarısız oldu.", "❌");
      }
    });
  }

  // 11. Event Handlers & Control Binding

  // Play / Pause Toggle
  function togglePlayPause() {
    isRunning = !isRunning;
    if (isRunning) {
      playPauseIcon.textContent = '⏸';
      playPauseText.textContent = 'Durdur';
      btnPlayPause.classList.add('btn-danger');
      btnPlayPause.classList.remove('btn-primary');
      worker.postMessage({ command: 'start' });
    } else {
      playPauseIcon.textContent = '▶';
      playPauseText.textContent = 'Başlat';
      btnPlayPause.classList.remove('btn-danger');
      btnPlayPause.classList.add('btn-primary');
      worker.postMessage({ command: 'pause' });
      // Immediately flush current state to permanent memory
      triggerStorageSave();
      showToast(`💾 Pi kalıcı hafızaya taşındı (${engine.totalDigits.toLocaleString('tr-TR')} basamak). Durduruldu ve kaldığı yer korundu!`, "💾");
    }
  }

  btnPlayPause.addEventListener('click', togglePlayPause);

  // Reset
  btnReset.addEventListener('click', async () => {
    if (isRunning) togglePlayPause();
    await storage.clear();
    worker.postMessage({ command: 'reset' });
    showToast("Kalıcı hafıza ve hesaplamalar sıfırlandı.", "↺");
  });

  // Burst 10k digits
  btnBurst10k.addEventListener('click', () => {
    worker.postMessage({ command: 'burst', value: 10000 });
  });

  // Reset Camera View
  btnResetView.addEventListener('click', () => {
    visualizer.resetCamera();
    requestCanvasRender();
  });

  // Toggle Auto-Follow Camera
  function updateAutoFollowBtnUI() {
    if (visualizer.autoFollow) {
      btnToggleAutoFollow.classList.add('btn-primary');
      autoFollowText.textContent = 'Kamera Takibi: Açık';
    } else {
      btnToggleAutoFollow.classList.remove('btn-primary');
      autoFollowText.textContent = 'Kamera Takibi: Kapalı';
    }
  }
  window.updateAutoFollowBtn = updateAutoFollowBtnUI;

  btnToggleAutoFollow.addEventListener('click', () => {
    visualizer.autoFollow = !visualizer.autoFollow;
    updateAutoFollowBtnUI();
    requestCanvasRender();
  });

  // Speed Slider
  sliderSpeed.addEventListener('input', (e) => {
    targetSpeed = parseInt(e.target.value, 10);
    valSpeed.textContent = `${targetSpeed} dps`;
    worker.postMessage({ command: 'setSpeed', value: targetSpeed });
  });

  // Mode Selection
  modeNavButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      modeNavButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.getAttribute('data-mode');
      visualizer.setMode(mode);

      // Hide all specific mode viewports first
      if (piBookContainer) piBookContainer.style.display = 'none';
      if (piRawDigitsContainer) piRawDigitsContainer.style.display = 'none';
      if (piPlainTextContainer) piPlainTextContainer.style.display = 'none';
      canvas.style.display = 'none';

      if (mode === 'book') {
        if (piBookContainer) piBookContainer.style.display = 'flex';
        updateBookView();
      } else if (mode === 'raw-digits') {
        if (piRawDigitsContainer) piRawDigitsContainer.style.display = 'flex';
        updateRawDigitsView();
      } else if (mode === 'plain-text') {
        if (piPlainTextContainer) piPlainTextContainer.style.display = 'flex';
        updatePlainTextView();
      } else {
        canvas.style.display = 'block';
        requestCanvasRender();
      }
    });
  });

  // Palette Selector
  selectPalette.addEventListener('change', (e) => {
    engine.currentPalette = e.target.value;
    updatePalettePreview();
    requestCanvasRender();
  });

  // Mapping Mode Selector
  selectMapping.addEventListener('change', (e) => {
    engine.mappingMode = e.target.value;
    requestCanvasRender();
  });

  // Symbol & Turkish Alphabet Mode Selector
  selectSymbolMode.addEventListener('change', (e) => {
    engine.symbolMode = e.target.value;
    const optText = selectSymbolMode.options[selectSymbolMode.selectedIndex].text;
    valSymbolMode.textContent = optText.split(' ')[1] || optText;
    requestCanvasRender();
  });

  // Growth Mode Selector
  selectGrowthMode.addEventListener('change', (e) => {
    visualizer.matrixLayoutMode = e.target.value;
    if (e.target.value === 'square') {
      gridColsContainer.style.display = 'none';
    } else {
      gridColsContainer.style.display = 'block';
    }
    requestCanvasRender();
  });

  // Grid Cols Slider
  sliderGridCols.addEventListener('input', (e) => {
    const cols = parseInt(e.target.value, 10);
    valGridCols.textContent = `${cols} sütun`;
    visualizer.matrixCols = cols;
    requestCanvasRender();
  });

  // Pixel Grid Block Size Slider
  sliderGridSize.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    valGridSize.textContent = `${val}px`;
    visualizer.gridBlockSize = val;
    requestCanvasRender();
  });

  // Diff Heatmap Toggle
  btnToggleDiff.addEventListener('click', () => {
    visualizer.showDiffOverlay = !visualizer.showDiffOverlay;
    btnToggleDiff.classList.toggle('btn-primary', visualizer.showDiffOverlay);
    requestCanvasRender();
  });

  // Custom Image Upload
  targetImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const img = new Image();
        img.onload = () => {
          visualizer.loadCustomTargetImage(img);
          requestCanvasRender();
        };
        img.src = evt.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  // Audio Toggle
  btnAudioToggle.addEventListener('click', () => {
    const isAudioOn = synth.toggle();
    audioIcon.textContent = isAudioOn ? '🔊' : '🔇';
    btnAudioToggle.classList.toggle('btn-primary', isAudioOn);
  });

  // Export Artwork PNG
  btnExportImage.addEventListener('click', () => {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const expCtx = exportCanvas.getContext('2d');
    
    expCtx.drawImage(canvas, 0, 0);

    expCtx.font = "bold 16px 'Outfit', sans-serif";
    expCtx.fillStyle = "rgba(255, 255, 255, 0.6)";
    expCtx.textAlign = "right";
    expCtx.fillText(`Pi Art Generator • ${engine.totalDigits.toLocaleString('tr-TR')} Basamak`, exportCanvas.width - 24, exportCanvas.height - 24);

    const link = document.createElement('a');
    link.download = `pi-art-${visualizer.currentMode}-${Date.now()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  });

  // Substring Digit Search
  btnSearch.addEventListener('click', () => {
    const query = inputSearch.value.trim();
    if (!query) return;
    const foundIndex = engine.searchSubstring(query);
    if (foundIndex !== -1) {
      searchResult.innerHTML = `<span style="color: var(--accent-green);">✓ Bulundu!</span> Pi'nin <strong>${(foundIndex + 1).toLocaleString('tr-TR')}.</strong> basamağında başlıyor.`;
    } else {
      searchResult.innerHTML = `<span style="color: var(--accent-pink);">✗ Bulunamadı.</span> Şu ana kadar hesaplanan ${engine.totalDigits.toLocaleString('tr-TR')} basamak içinde yer almıyor.`;
    }
  });

  inputSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnSearch.click();
  });

  // Turkish Word Search in Pi
  btnWordSearch.addEventListener('click', () => {
    const word = inputWordSearch.value.trim();
    if (!word) return;
    const foundCharIndex = engine.searchTurkishWord(word);
    if (foundCharIndex !== -1) {
      const piDigitPos = foundCharIndex * 2 + 1;
      const targetPage = Math.floor(foundCharIndex / charsPerPage) + 1;
      wordSearchResult.innerHTML = `<span style="color: var(--accent-green);">✓ "${word.toUpperCase()}" Bulundu!</span><br>Pi Kitabı <strong>Sayfa ${targetPage}</strong>'de (${(foundCharIndex + 1).toLocaleString('tr-TR')}. harf, Pi Basamağı: ~${piDigitPos.toLocaleString('tr-TR')}) yer alıyor!`;
      
      bookCurrentPage = targetPage;
      isBookLiveFollowing = false;
      btnBookLivePage.classList.remove('btn-primary');
      if (visualizer.currentMode === 'book') {
        updateBookView();
      }
    } else {
      wordSearchResult.innerHTML = `<span style="color: var(--accent-pink);">✗ Bulunamadı.</span> "${word.toUpperCase()}" henüz çözülen ${engine.decodedTurkishText.length.toLocaleString('tr-TR')} Türkçe harf içinde çıkmadı. Daha fazla basamak hesaplayın!`;
    }
  });

  inputWordSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnWordSearch.click();
  });

  // Pixel Inspector Hover
  canvas.addEventListener('mousemove', (e) => {
    if (visualizer.isDragging) {
      pixelInspector.style.display = 'none';
      return;
    }
    const info = visualizer.getPixelInfoAt(e.clientX, e.clientY);
    if (info) {
      pixelInspector.style.display = 'block';
      pixelInspector.style.left = `${e.clientX}px`;
      pixelInspector.style.top = `${e.clientY}px`;
      inspectColorChip.style.backgroundColor = info.hex;
      inspectHex.textContent = info.hex.toUpperCase();
      inspectDigit.textContent = info.digit;
      inspectSymbol.textContent = info.symbol ? `"${info.symbol}"` : '(Renk)';
      inspectIndex.textContent = (info.index + 1).toLocaleString('tr-TR');
      inspectX.textContent = info.col;
      inspectY.textContent = info.row;
    } else {
      pixelInspector.style.display = 'none';
    }
  });

  canvas.addEventListener('mouseleave', () => {
    pixelInspector.style.display = 'none';
  });

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlayPause();
    } else if (e.key === 'r' || e.key === 'R') {
      btnReset.click();
    }
  });

  // 11. Window Resize Handling
  function handleResize() {
    visualizer.resize();
  }
  window.addEventListener('resize', handleResize);

  // 12. Initial Boot: Load previous calculations from Permanent Storage (IndexedDB + SQLite)!
  updatePalettePreview();
  handleResize();
  updateAutoFollowBtnUI();
  worker.postMessage({ command: 'setSpeed', value: targetSpeed });

  (async () => {
    try {
      await storage.init();
      const savedData = await storage.load();

      if (savedData && savedData.digits && savedData.digits.length > 0) {
        const str = savedData.digits;
        const arr = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++) {
          arr[i] = parseInt(str[i], 10);
        }
        engine.addDigits(arr);

        // Restore worker calculation state so calculation resumes instantly from where it stopped
        if (savedData.streamerState) {
          latestStreamerState = savedData.streamerState;
          worker.postMessage({ command: 'setState', value: savedData.streamerState });
        } else {
          worker.postMessage({ command: 'skipTo', value: arr.length });
        }

        updateHUD();
        updateRibbon();
        updateBookView();
        updateRawDigitsView();
        updatePlainTextView();
        requestCanvasRender();

        showToast(`⚡ Kalıcı hafızadan ${arr.length.toLocaleString('tr-TR')} basamak yüklendi. Kaldığı yerden devam edebilirsiniz!`, '💾');
      } else {
        // First run: calculate initial seed batch
        worker.postMessage({ command: 'burst', value: 4096 });
      }
    } catch (err) {
      console.warn("Storage init error:", err);
      worker.postMessage({ command: 'burst', value: 4096 });
    }
  })();
});
