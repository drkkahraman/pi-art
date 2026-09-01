# 🎨 π-Art & The Mona Lisa Theorem
### *An Interactive Infinity Visualizer, Audio Synthesizer & Mathematical Explorer*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Vanilla JS](https://img.shields.io/badge/Vanilla-JavaScript-F7DF1E?logo=javascript&logoColor=black)](#)
[![HTML5 Canvas](https://img.shields.io/badge/HTML5-Canvas%202D-E34F26?logo=html5&logoColor=white)](#)
[![Web Workers](https://img.shields.io/badge/Web%20Workers-Multi--threaded-purple)](#)
[![Web Audio API](https://img.shields.io/badge/Web%20Audio%20API-Synthesizer-orange)](#)
[![Python SQLite](https://img.shields.io/badge/Backend-Python%20SQLite-3776AB?logo=python&logoColor=white)](#)

---

## 🌟 Overview

**π-Art** is an interactive, high-performance web experience that computes the decimal digits of $\pi$ in real time and transforms them into dynamic digital art, generative music, geometric visualizations, and probability experiments.

At its core lies the **Mona Lisa Theorem** (an artistic adaptation of the *Infinite Monkey Theorem* and *Borel's Normal Number Theorem*): 
> *If $\pi$ is a normal number, every image ever painted, every song ever recorded, and every sentence ever written is encoded somewhere within its infinite decimal expansion.*

---

## ✨ Features & Visualization Modes

### 🎨 Visualizer Engines
| Mode | Description |
| :--- | :--- |
| **🌀 Pixel Matrix** | Maps sequential digits to dynamic color palettes in a responsive 2D pixel grid. |
| **🔢 Raw Digits** | High-speed terminal-style telemetry displaying raw calculated digits. |
| **📝 Plain Text** | Translates base-10 digit sequences into readable text via character encoding. |
| **📖 Pi Book (Babel)** | Generates infinite virtual book pages and chapters straight out of $\pi$. |
| **🖼️ Mona Lisa Theorem** | Tests probability by reconstructing target images from chunks of $\pi$ digits. |
| **🌌 Pi Spiral** | Polar and Archimedean spirals mapping digits to radius and angle offsets. |
| **⚡ Neon Random Walk** | 2D vector path tracking where digit values determine movement angles. |
| **🕸️ String Art (Chord)** | Circle transition chords connecting successive digit occurrences (0–9). |

### 🎵 Web Audio Synthesizer
- Converts digit streams (0–9) into melodic frequencies in real-time.
- Supports pentatonic, minor, major, and celestial scales with custom ADSR envelopes and reverb effects.

### ⚡ Architecture & Performance
- **Non-blocking Web Worker:** Digits are computed in background threads using an streaming Spigot algorithm—keeping the UI at a butter-smooth 60+ FPS.
- **Dual-Tier Persistence:**
  - **IndexedDB:** Browser-side offline caching.
  - **Python SQLite Server:** Optional local backend persistence (`pi_storage.db`) to preserve computed digits across sessions.
- **Zero External Dependencies:** Built with pure Vanilla JS, CSS3, HTML5 Canvas, Web Audio API, and Python 3 standard library.

---

## 🚀 Quick Start

### Option 1: Full Experience with SQLite Backend (Recommended)
Clone the repository and run the Python backend:

```bash
git clone https://github.com/<your-username>/pi-art.git
cd pi-art
python3 server.py
```
Open **`http://localhost:8080`** in your browser.

### Option 2: Standalone Frontend
You can also open `index.html` directly in any modern browser (uses browser IndexedDB storage).

---

## 📂 Project Structure

```text
pi-art/
├── index.html          # Main application interface & HUD controls
├── server.py           # Lightweight Python HTTP + SQLite API backend
├── css/
│   └── style.css       # Modern dark-mode glassmorphic styling
├── js/
│   ├── app.js          # UI controller, event bindings, and lifecycle manager
│   ├── pi-engine.js    # Streaming Spigot algorithm & digit pipeline
│   ├── pi-worker.js    # Multi-threaded Web Worker for calculations
│   ├── visualizers.js  # Canvas 2D render engines (Matrix, Spiral, Walk, Chords)
│   ├── audio-synth.js  # Web Audio API harmonic sound synthesizer
│   └── pi-storage.js   # Hybrid IndexedDB & SQLite persistence layer
├── assets/             # Visual assets & presets
├── .gitignore          # Git exclusion rules
├── LICENSE             # MIT License
└── README.md           # Documentation
```

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).
Feel free to use, modify, and build upon it!
