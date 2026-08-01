'use strict';

/**
 * TrimToken — Theme-Aware Particle Engine
 * Renders animated background particles that adapt to the active theme.
 * Self-contained: just include this script and it will find #fireCanvas.
 */

(function () {
  const canvas = document.getElementById('fireCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width, height;
  let particles = [];
  let animationId = null;

  // ── Theme-aware color palettes ─────────────────────────────
  const THEME_PALETTES = {
    'command-center': [
      { r: 50,  g: 120, b: 255 },   // electric blue
      { r: 80,  g: 150, b: 255 },   // bright blue
      { r: 30,  g:  90, b: 220 },   // deep blue
      { r: 100, g: 180, b: 255 },   // sky blue
      { r: 40,  g: 100, b: 200 },   // steel blue
      { r: 70,  g: 140, b: 240 },   // medium blue
    ],
    'arctic': [
      { r: 136, g: 192, b: 208 },   // frost blue
      { r: 160, g: 210, b: 225 },   // light frost
      { r: 200, g: 220, b: 240 },   // ice white-blue
      { r: 100, g: 160, b: 190 },   // deep frost
      { r: 180, g: 200, b: 220 },   // pale blue
      { r: 120, g: 180, b: 200 },   // muted frost
    ],
    'sunset': [
      { r: 255, g: 100, b: 20 },    // bright orange
      { r: 255, g: 140, b: 40 },    // amber
      { r: 255, g: 70,  b: 30 },    // red-orange
      { r: 255, g: 180, b: 60 },    // warm yellow
      { r: 200, g: 50,  b: 20 },    // deep ember
      { r: 255, g: 120, b: 50 },    // flame
    ],
  };

  let currentPalette = THEME_PALETTES['command-center'];

  // ── Configuration ──────────────────────────────────────────
  const CONFIG = {
    particleCount: 90,
    minSize: 1.5,
    maxSize: 4.5,
    minSpeed: 0.3,
    maxSpeed: 1.2,
    drift: 0.4,       // horizontal drift range
    fadeRate: 0.003,   // alpha decay per frame
    glowMultiplier: 3, // glow radius = size * this
    spawnMargin: 40,   // spawn below the bottom edge
  };

  // ── Detect and react to theme changes ──────────────────────
  function detectTheme() {
    const theme = document.documentElement.getAttribute('data-theme') || 'command-center';
    currentPalette = THEME_PALETTES[theme] || THEME_PALETTES['command-center'];
  }

  // Watch for data-theme attribute changes
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
        detectTheme();
        // Gradually recolor existing particles on next reset
        break;
      }
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  // ── Particle class ─────────────────────────────────────────
  class Particle {
    constructor() {
      this.reset();
    }

    reset() {
      const color = currentPalette[Math.floor(Math.random() * currentPalette.length)];
      this.r = color.r;
      this.g = color.g;
      this.b = color.b;

      this.x = Math.random() * width;
      this.y = height + Math.random() * CONFIG.spawnMargin;
      this.size = CONFIG.minSize + Math.random() * (CONFIG.maxSize - CONFIG.minSize);
      this.speedY = CONFIG.minSpeed + Math.random() * (CONFIG.maxSpeed - CONFIG.minSpeed);
      this.speedX = (Math.random() - 0.5) * CONFIG.drift;
      this.alpha = 0.6 + Math.random() * 0.4;
      this.decay = CONFIG.fadeRate + Math.random() * 0.004;

      // Slight flicker
      this.flickerSpeed = 0.02 + Math.random() * 0.03;
      this.flickerPhase = Math.random() * Math.PI * 2;
    }

    update() {
      this.y -= this.speedY;
      this.x += this.speedX + Math.sin(this.flickerPhase) * 0.15;
      this.alpha -= this.decay;
      this.flickerPhase += this.flickerSpeed;

      // Shrink as it fades
      this.size *= 0.999;

      if (this.alpha <= 0 || this.y < -20) {
        this.reset();
      }
    }

    draw() {
      const flicker = 0.7 + Math.sin(this.flickerPhase) * 0.3;
      const alpha = this.alpha * flicker;

      // Outer glow
      const glowRadius = this.size * CONFIG.glowMultiplier;
      const gradient = ctx.createRadialGradient(
        this.x, this.y, 0,
        this.x, this.y, glowRadius
      );
      gradient.addColorStop(0, `rgba(${this.r}, ${this.g}, ${this.b}, ${alpha * 0.6})`);
      gradient.addColorStop(0.4, `rgba(${this.r}, ${this.g}, ${this.b}, ${alpha * 0.2})`);
      gradient.addColorStop(1, `rgba(${this.r}, ${this.g}, ${this.b}, 0)`);

      ctx.beginPath();
      ctx.arc(this.x, this.y, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Core bright center
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${Math.min(255, this.r + 50)}, ${Math.min(255, this.g + 40)}, ${Math.min(255, this.b + 20)}, ${alpha})`;
      ctx.fill();
    }
  }

  // ── Resize handler ─────────────────────────────────────────
  function resize() {
    width = canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
    height = canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    // Use CSS dimensions for particle coords
    width = canvas.offsetWidth;
    height = canvas.offsetHeight;
  }

  // ── Animation loop ─────────────────────────────────────────
  function animate() {
    // Semi-transparent clear for motion trails
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of particles) {
      p.update();
      p.draw();
    }

    animationId = requestAnimationFrame(animate);
  }

  // ── Init ───────────────────────────────────────────────────
  function init() {
    detectTheme();
    resize();
    particles = [];
    for (let i = 0; i < CONFIG.particleCount; i++) {
      const p = new Particle();
      // Stagger initial positions so they don't all start at the bottom
      p.y = Math.random() * (height + CONFIG.spawnMargin);
      p.alpha = Math.random() * 0.8;
      particles.push(p);
    }
    animate();
  }

  window.addEventListener('resize', () => {
    resize();
  });

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
