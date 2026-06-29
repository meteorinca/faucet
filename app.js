(() => {
  const faucetCanvas = document.getElementById("faucetCanvas");
  const transistorCanvas = document.getElementById("transistorCanvas");
  const faucetCtx = faucetCanvas.getContext("2d");
  const transistorCtx = transistorCanvas.getContext("2d");

  const slider = document.getElementById("baseSlider");
  const baseReadout = document.getElementById("baseReadout");
  const waterReadout = document.getElementById("waterReadout");
  const currentReadout = document.getElementById("currentReadout");
  const regionBadge = document.getElementById("regionBadge");
  const stage = document.querySelector(".stage");
  const presets = [...document.querySelectorAll(".preset")];

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dprLimit = prefersReducedMotion ? 1.25 : 2;

  const state = {
    raw: 0,
    target: 0,
    flow: 0,
    time: 0,
    faucetHandle: null,
    dragHandle: false,
    last: performance.now(),
    faucetSize: { w: 0, h: 0, dpr: 1 },
    transistorSize: { w: 0, h: 0, dpr: 1 }
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
  const ease = (t) => t * t * (3 - 2 * t);
  const cssPercent = (v) => `${Math.round(v * 1000) / 10}%`;

  function roundedRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  function drawLabel(ctx, text, x, y, color = "rgba(237,241,251,0.74)", align = "center") {
    ctx.save();
    ctx.font = "700 12px Inter, system-ui, sans-serif";
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function drawSmallCapsule(ctx, text, x, y, color, align = "center") {
    ctx.save();
    ctx.font = "800 11px Inter, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = align;
    const metrics = ctx.measureText(text);
    const padX = 9;
    const w = metrics.width + padX * 2;
    const h = 23;
    const bx = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    roundedRect(ctx, bx, y - h / 2, w, h, h / 2);
    ctx.fillStyle = color.bg;
    ctx.fill();
    ctx.strokeStyle = color.stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = color.text;
    ctx.fillText(text, x, y + 0.5);
    ctx.restore();
  }

  function sizeCanvas(canvas, ctx, sizeStore) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, dprLimit);
    const pixelW = Math.max(1, Math.round(rect.width * dpr));
    const pixelH = Math.max(1, Math.round(rect.height * dpr));

    if (canvas.width !== pixelW || canvas.height !== pixelH) {
      canvas.width = pixelW;
      canvas.height = pixelH;
      sizeStore.w = rect.width;
      sizeStore.h = rect.height;
      sizeStore.dpr = dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function transferCurve(raw) {
    if (raw < 0.025) return 0;
    if (raw < 0.78) return ease(invLerp(0.025, 0.78, raw)) * 0.88;
    return 0.88 + ease(invLerp(0.78, 1, raw)) * 0.12;
  }

  function regionFor(raw) {
    if (raw < 0.025) return { key: "cutoff", label: "Cutoff" };
    if (raw < 0.78) return { key: "active", label: "Active" };
    return { key: "saturation", label: "Saturated" };
  }

  class WaterDrop {
    constructor() {
      this.alive = false;
      this.phase = Math.random() * Math.PI * 2;
      this.hue = 194 + Math.random() * 8;
      this.highlight = 0.38 + Math.random() * 0.28;
      this.reset();
    }

    reset() {
      this.x = 0;
      this.y = 0;
      this.vx = 0;
      this.vy = 0;
      this.radius = 2;
      this.life = 0;
      this.maxLife = 1;
      this.alive = false;
    }

    spawn(x, y, flow, scale) {
      const spread = lerp(2, 14, flow);
      this.x = x + (Math.random() - 0.5) * spread;
      this.y = y + Math.random() * 2;
      this.vx = (Math.random() - 0.5) * lerp(10, 72, flow);
      this.vy = lerp(120, 450, flow) + Math.random() * lerp(20, 180, flow);
      this.radius = scale * lerp(0.006, 0.011, Math.random()) * lerp(0.7, 1.25, flow);
      this.maxLife = lerp(0.75, 1.25, Math.random());
      this.life = this.maxLife;
      this.alive = true;
    }

    update(dt, sinkY) {
      if (!this.alive) return;
      this.life -= dt;
      if (this.life <= 0) {
        this.alive = false;
        return;
      }
      this.vy += 420 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vx *= 0.99;
      if (this.y > sinkY) {
        this.vy *= -0.08;
        this.vx *= 0.52;
        this.life -= dt * 2.2;
      }
    }

    draw(ctx) {
      if (!this.alive) return;
      const a = clamp(this.life / this.maxLife, 0, 1);
      const r = Math.max(1.1, this.radius * (0.72 + a * 0.35));
      const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r * 2.2);
      grad.addColorStop(0, `hsla(${this.hue}, 96%, 94%, ${0.9 * a})`);
      grad.addColorStop(0.38, `hsla(${this.hue}, 88%, 58%, ${0.76 * a})`);
      grad.addColorStop(1, `hsla(${this.hue}, 86%, 36%, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${this.highlight * a})`;
      ctx.beginPath();
      ctx.arc(this.x - r * 0.28, this.y - r * 0.32, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  class ChargeDot {
    constructor(kind = "collector") {
      this.kind = kind;
      this.alive = false;
      this.progress = 0;
      this.speed = 0;
      this.radius = 2;
      this.alpha = 1;
      this.offset = (Math.random() - 0.5) * 6;
      this.trail = [];
    }

    spawn(flow, progress = 0) {
      this.progress = progress;
      this.speed = this.kind === "base" ? lerp(0.42, 1.1, flow) : lerp(0.28, 1.42, flow);
      this.radius = this.kind === "base" ? lerp(2.0, 3.6, flow) : lerp(2.1, 4.9, flow);
      this.alpha = lerp(0.56, 0.96, flow);
      this.offset = (Math.random() - 0.5) * lerp(2, 7, flow);
      this.trail.length = 0;
      this.alive = true;
    }

    update(dt, pointAt) {
      if (!this.alive) return;
      this.progress += this.speed * dt;
      if (this.progress > 1.04) {
        this.alive = false;
        return;
      }

      const point = pointAt(clamp(this.progress, 0, 1), this.offset);
      this.trail.push({ x: point.x, y: point.y, life: 0.22 });
      for (let i = this.trail.length - 1; i >= 0; i -= 1) {
        this.trail[i].life -= dt;
        if (this.trail[i].life <= 0) this.trail.splice(i, 1);
      }
      if (this.trail.length > 18) this.trail.shift();
      this.x = point.x;
      this.y = point.y;
    }

    draw(ctx) {
      if (!this.alive) return;
      const isBase = this.kind === "base";
      const main = isBase ? "167,139,250" : "251,191,36";
      const hot = isBase ? "237,233,254" : "255,247,212";

      for (const t of this.trail) {
        const a = clamp(t.life / 0.22, 0, 1) * this.alpha;
        ctx.fillStyle = `rgba(${main},${0.22 * a})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, this.radius * 1.5 * a, 0, Math.PI * 2);
        ctx.fill();
      }

      const glow = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius * 4.0);
      glow.addColorStop(0, `rgba(${hot},${this.alpha})`);
      glow.addColorStop(0.3, `rgba(${main},${0.86 * this.alpha})`);
      glow.addColorStop(1, `rgba(${main},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 4.0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const waterDrops = Array.from({ length: prefersReducedMotion ? 90 : 260 }, () => new WaterDrop());
  const collectorDots = Array.from({ length: prefersReducedMotion ? 45 : 140 }, () => new ChargeDot("collector"));
  const baseDots = Array.from({ length: prefersReducedMotion ? 20 : 64 }, () => new ChargeDot("base"));
  const timers = { water: 0, collector: 0, base: 0 };

  function spawnFromPool(pool, cb) {
    const item = pool.find((p) => !p.alive);
    if (item) cb(item);
  }

  function drawSink(ctx, x, y, w, h, flow, time) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 15;

    const bodyGrad = ctx.createLinearGradient(0, y - h * 0.42, 0, y + h * 0.68);
    bodyGrad.addColorStop(0, "rgba(86, 99, 122, 0.54)");
    bodyGrad.addColorStop(0.45, "rgba(39, 48, 64, 0.78)");
    bodyGrad.addColorStop(1, "rgba(18, 24, 34, 0.92)");

    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.5, h * 0.22, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(174, 188, 210, 0.16)";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x - w * 0.5, y);
    ctx.bezierCurveTo(x - w * 0.46, y + h * 0.56, x - w * 0.30, y + h * 0.72, x, y + h * 0.72);
    ctx.bezierCurveTo(x + w * 0.30, y + h * 0.72, x + w * 0.46, y + h * 0.56, x + w * 0.5, y);
    ctx.bezierCurveTo(x + w * 0.34, y + h * 0.22, x - w * 0.34, y + h * 0.22, x - w * 0.5, y);
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.shadowColor = "transparent";
    const waterAlpha = 0.12 + flow * 0.48;
    const wave = Math.sin(time * 2.2) * h * 0.018 * flow;
    ctx.beginPath();
    ctx.ellipse(x, y + h * 0.02 + wave, w * 0.43, h * 0.14, 0, 0, Math.PI * 2);
    const waterGrad = ctx.createLinearGradient(0, y - h * 0.15, 0, y + h * 0.2);
    waterGrad.addColorStop(0, `rgba(125,211,252,${waterAlpha})`);
    waterGrad.addColorStop(1, `rgba(14,116,144,${waterAlpha * 0.62})`);
    ctx.fillStyle = waterGrad;
    ctx.fill();
    ctx.strokeStyle = `rgba(125,211,252,${0.2 + flow * 0.35})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawWaterStream(ctx, fromX, fromY, sinkY, flow, time, scale) {
    if (flow <= 0.002) return;
    const length = sinkY - fromY;
    const widthTop = lerp(2.2, scale * 0.022, flow);
    const widthBottom = lerp(3.2, scale * 0.038, flow);
    const sway = Math.sin(time * 4.2) * lerp(0.2, 2.2, flow);
    const midX = fromX + sway;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.beginPath();
    ctx.moveTo(fromX - widthTop, fromY);
    ctx.bezierCurveTo(midX - widthBottom * 0.6, fromY + length * 0.34, midX - widthBottom, fromY + length * 0.70, fromX - widthBottom, sinkY);
    ctx.lineTo(fromX + widthBottom, sinkY);
    ctx.bezierCurveTo(midX + widthBottom, fromY + length * 0.70, midX + widthBottom * 0.6, fromY + length * 0.34, fromX + widthTop, fromY);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, fromY, 0, sinkY);
    grad.addColorStop(0, `rgba(191,235,255,${0.32 + flow * 0.40})`);
    grad.addColorStop(0.42, `rgba(56,189,248,${0.23 + flow * 0.36})`);
    grad.addColorStop(1, `rgba(56,189,248,${0.08 + flow * 0.20})`);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.bezierCurveTo(midX + widthTop * 0.4, fromY + length * 0.3, midX - widthTop * 0.5, fromY + length * 0.68, fromX, sinkY);
    ctx.strokeStyle = `rgba(226,247,255,${0.25 + flow * 0.42})`;
    ctx.lineWidth = Math.max(1, widthTop * 0.62);
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.restore();
  }

  function drawFaucet(ctx, w, h, raw, flow, time) {
    const scale = Math.min(w, h);
    const cx = w * 0.50;
    const sinkY = h * 0.77;
    const sinkW = clamp(w * 0.62, scale * 0.72, scale * 1.05);
    const sinkH = scale * 0.22;
    const baseX = cx - scale * 0.13;
    const baseY = h * 0.61;
    const topY = h * 0.26;
    const spoutX = cx + scale * 0.18;
    const spoutY = h * 0.43;
    const pipeWidth = clamp(scale * 0.058, 18, 32);
    const openingX = spoutX + pipeWidth * 0.62;
    const openingY = spoutY + pipeWidth * 0.58;

    drawSink(ctx, cx, sinkY, sinkW, sinkH, flow, time);

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.shadowColor = "rgba(0,0,0,0.48)";
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 14;

    const chrome = ctx.createLinearGradient(baseX - pipeWidth, topY, spoutX + pipeWidth * 2, baseY);
    chrome.addColorStop(0, "#202838");
    chrome.addColorStop(0.16, "#718199");
    chrome.addColorStop(0.34, "#d7dde8");
    chrome.addColorStop(0.52, "#7a879b");
    chrome.addColorStop(0.75, "#3b4659");
    chrome.addColorStop(1, "#161d2b");

    ctx.strokeStyle = chrome;
    ctx.lineWidth = pipeWidth;
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(baseX, topY + pipeWidth * 1.05);
    ctx.bezierCurveTo(baseX, topY, baseX + scale * 0.10, topY - scale * 0.045, baseX + scale * 0.22, topY + scale * 0.018);
    ctx.bezierCurveTo(spoutX + scale * 0.08, topY + scale * 0.075, spoutX + scale * 0.075, spoutY - scale * 0.035, spoutX, spoutY);
    ctx.bezierCurveTo(spoutX + scale * 0.015, spoutY + scale * 0.03, spoutX + scale * 0.06, spoutY + scale * 0.04, openingX, openingY);
    ctx.stroke();

    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = Math.max(1, pipeWidth * 0.12);
    ctx.beginPath();
    ctx.moveTo(baseX - pipeWidth * 0.20, baseY - pipeWidth * 0.25);
    ctx.lineTo(baseX - pipeWidth * 0.20, topY + pipeWidth * 1.2);
    ctx.bezierCurveTo(baseX - pipeWidth * 0.2, topY + pipeWidth * 0.4, baseX + scale * 0.10, topY + scale * 0.02, baseX + scale * 0.20, topY + scale * 0.045);
    ctx.stroke();

    const baseGrad = ctx.createLinearGradient(baseX - pipeWidth * 1.1, baseY - pipeWidth, baseX + pipeWidth * 1.3, baseY + pipeWidth * 1.5);
    baseGrad.addColorStop(0, "#e6ebf4");
    baseGrad.addColorStop(0.32, "#7f8ba1");
    baseGrad.addColorStop(1, "#202838");
    roundedRect(ctx, baseX - pipeWidth * 0.9, baseY - pipeWidth * 0.28, pipeWidth * 1.8, pipeWidth * 1.35, pipeWidth * 0.34);
    ctx.fillStyle = baseGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const mouthGrad = ctx.createRadialGradient(openingX, openingY, 0, openingX, openingY, pipeWidth * 0.58);
    mouthGrad.addColorStop(0, "rgba(0,0,0,0.80)");
    mouthGrad.addColorStop(0.58, "rgba(12,16,24,0.78)");
    mouthGrad.addColorStop(1, "rgba(210,220,235,0.45)");
    ctx.beginPath();
    ctx.ellipse(openingX, openingY, pipeWidth * 0.52, pipeWidth * 0.28, 0.18, 0, Math.PI * 2);
    ctx.fillStyle = mouthGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.stroke();

    const pivotX = baseX + pipeWidth * 1.05;
    const pivotY = baseY - pipeWidth * 1.35;
    const leverLength = clamp(scale * 0.18, 52, 104);
    const minAngle = -Math.PI * 0.48;
    const maxAngle = -Math.PI * 0.08;
    const angle = lerp(minAngle, maxAngle, raw);

    ctx.save();
    ctx.translate(pivotX, pivotY);
    ctx.rotate(angle);

    const handleGrad = ctx.createLinearGradient(0, -pipeWidth * 0.24, leverLength, pipeWidth * 0.24);
    handleGrad.addColorStop(0, "#edf2fb");
    handleGrad.addColorStop(0.44, "#aeb8ca");
    handleGrad.addColorStop(1, "#5f6b7e");
    roundedRect(ctx, -pipeWidth * 0.18, -pipeWidth * 0.19, leverLength, pipeWidth * 0.38, pipeWidth * 0.19);
    ctx.fillStyle = handleGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const knobX = leverLength;
    const knobGrad = ctx.createRadialGradient(knobX - pipeWidth * 0.15, -pipeWidth * 0.12, 2, knobX, 0, pipeWidth * 0.55);
    knobGrad.addColorStop(0, "#fff");
    knobGrad.addColorStop(0.45, "#d7deea");
    knobGrad.addColorStop(1, "#596476");
    ctx.beginPath();
    ctx.ellipse(knobX, 0, pipeWidth * 0.55, pipeWidth * 0.42, 0, 0, Math.PI * 2);
    ctx.fillStyle = knobGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.24)";
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(pivotX, pivotY, pipeWidth * 0.48, 0, Math.PI * 2);
    const pivotGrad = ctx.createRadialGradient(pivotX - 4, pivotY - 5, 1, pivotX, pivotY, pipeWidth * 0.56);
    pivotGrad.addColorStop(0, "#fff");
    pivotGrad.addColorStop(0.45, "#aeb8ca");
    pivotGrad.addColorStop(1, "#2a3343");
    ctx.fillStyle = pivotGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.20)";
    ctx.stroke();

    if (flow > 0.02) {
      ctx.globalCompositeOperation = "lighter";
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, pipeWidth * (0.65 + flow * 0.68), 0, Math.PI * 2);
      const valveGlow = ctx.createRadialGradient(pivotX, pivotY, 0, pivotX, pivotY, pipeWidth * (1.35 + flow));
      valveGlow.addColorStop(0, `rgba(167,139,250,${0.24 + flow * 0.25})`);
      valveGlow.addColorStop(1, "rgba(167,139,250,0)");
      ctx.fillStyle = valveGlow;
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }

    ctx.restore();

    drawWaterStream(ctx, openingX, openingY + pipeWidth * 0.18, sinkY - sinkH * 0.05, flow, time, scale);

    drawSmallCapsule(ctx, "handle = base current", pivotX + pipeWidth * 0.7, pivotY - pipeWidth * 1.35, {
      bg: "rgba(167,139,250,0.12)",
      stroke: "rgba(167,139,250,0.30)",
      text: "rgba(221,214,254,0.92)"
    }, "center");

    const aperture = raw <= 0.025 ? "closed" : `${Math.round(flow * 100)}% open`;
    drawSmallCapsule(ctx, aperture, openingX, openingY + pipeWidth * 1.55, {
      bg: "rgba(56,189,248,0.11)",
      stroke: "rgba(56,189,248,0.28)",
      text: "rgba(186,230,253,0.94)"
    }, "center");

    return {
      openingX,
      openingY: openingY + pipeWidth * 0.18,
      sinkY: sinkY - sinkH * 0.05,
      sinkBottom: sinkY + sinkH,
      scale,
      handle: {
        pivotX,
        pivotY,
        length: leverLength,
        angle,
        minAngle,
        maxAngle,
        knobX: pivotX + Math.cos(angle) * leverLength,
        knobY: pivotY + Math.sin(angle) * leverLength,
        hitRadius: Math.max(44, leverLength * 0.54)
      }
    };
  }

  function drawResistor(ctx, x, y0, y1, width) {
    const steps = 7;
    const h = (y1 - y0) / steps;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    for (let i = 1; i < steps; i += 1) {
      const dx = i % 2 === 0 ? -width : width;
      ctx.lineTo(x + dx, y0 + h * i);
    }
    ctx.lineTo(x, y1);
    ctx.stroke();
  }

  function arrowHead(ctx, x, y, angle, size, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.8, -size * 0.58);
    ctx.lineTo(-size * 0.45, 0);
    ctx.lineTo(-size * 0.8, size * 0.58);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  function drawTransistor(ctx, w, h, raw, flow, time) {
    const scale = Math.min(w, h);
    const cx = w * 0.52;
    const cy = h * 0.49;
    const r = clamp(scale * 0.19, 72, 120);
    const wire = "rgba(174,188,210,0.72)";
    const wireDim = "rgba(118,132,155,0.56)";
    const collectorTop = { x: cx + r * 0.58, y: cy - r * 1.45 };
    const collectorPin = { x: cx + r * 0.58, y: cy - r * 0.68 };
    const emitterPin = { x: cx + r * 0.58, y: cy + r * 0.72 };
    const emitterBottom = { x: cx + r * 0.58, y: cy + r * 1.55 };
    const baseInput = { x: cx - r * 1.72, y: cy };
    const basePin = { x: cx - r * 0.34, y: cy };
    const loadTop = Math.max(76, h * 0.14);
    const groundY = Math.min(h - 76, h * 0.84);

    ctx.save();

    if (flow > 0.01) {
      ctx.globalCompositeOperation = "lighter";
      const halo = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.65);
      halo.addColorStop(0, `rgba(251,191,36,${0.12 + flow * 0.20})`);
      halo.addColorStop(0.45, `rgba(167,139,250,${flow * 0.08})`);
      halo.addColorStop(1, "rgba(251,191,36,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4);
      ctx.globalCompositeOperation = "source-over";
    }

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = wireDim;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(collectorTop.x, loadTop);
    ctx.lineTo(collectorTop.x, collectorTop.y - r * 0.22);
    ctx.stroke();

    ctx.strokeStyle = wire;
    ctx.lineWidth = 2.7;
    drawResistor(ctx, collectorTop.x, loadTop + r * 0.15, collectorTop.y - r * 0.26, r * 0.13);
    drawLabel(ctx, "load", collectorTop.x + r * 0.33, (loadTop + collectorTop.y) * 0.5, "rgba(150,160,184,0.92)", "left");

    ctx.beginPath();
    ctx.moveTo(collectorTop.x, collectorTop.y - r * 0.18);
    ctx.lineTo(collectorPin.x, collectorPin.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(emitterPin.x, emitterPin.y);
    ctx.lineTo(emitterBottom.x, groundY);
    ctx.stroke();

    ctx.strokeStyle = wireDim;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(emitterBottom.x - r * 0.22, groundY);
    ctx.lineTo(emitterBottom.x + r * 0.22, groundY);
    ctx.moveTo(emitterBottom.x - r * 0.15, groundY + 8);
    ctx.lineTo(emitterBottom.x + r * 0.15, groundY + 8);
    ctx.moveTo(emitterBottom.x - r * 0.08, groundY + 16);
    ctx.lineTo(emitterBottom.x + r * 0.08, groundY + 16);
    ctx.stroke();

    ctx.fillStyle = "rgba(237,241,251,0.92)";
    ctx.font = "850 13px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("+V", collectorTop.x, loadTop - 18);

    ctx.strokeStyle = `rgba(167,139,250,${0.34 + flow * 0.42})`;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(baseInput.x, baseInput.y);
    ctx.lineTo(basePin.x, basePin.y);
    ctx.stroke();

    const circleGrad = ctx.createRadialGradient(cx - r * 0.30, cy - r * 0.38, r * 0.08, cx, cy, r);
    circleGrad.addColorStop(0, "rgba(255,255,255,0.12)");
    circleGrad.addColorStop(0.55, "rgba(24,31,48,0.86)");
    circleGrad.addColorStop(1, "rgba(11,14,24,0.92)");
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = circleGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const channelGlow = ctx.createLinearGradient(cx - r * 0.15, cy - r * 0.7, cx + r * 0.65, cy + r * 0.72);
    channelGlow.addColorStop(0, `rgba(251,191,36,${0.02 + flow * 0.34})`);
    channelGlow.addColorStop(0.5, `rgba(251,191,36,${0.05 + flow * 0.22})`);
    channelGlow.addColorStop(1, `rgba(251,191,36,${0.01 + flow * 0.24})`);
    ctx.strokeStyle = channelGlow;
    ctx.lineWidth = 16 + flow * 12;
    ctx.beginPath();
    ctx.moveTo(collectorPin.x, collectorPin.y);
    ctx.lineTo(cx - r * 0.12, cy - r * 0.22);
    ctx.lineTo(cx - r * 0.12, cy + r * 0.23);
    ctx.lineTo(emitterPin.x, emitterPin.y);
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = "rgba(226,232,240,0.86)";
    ctx.lineWidth = 5.4;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.28, cy - r * 0.42);
    ctx.lineTo(cx - r * 0.28, cy + r * 0.42);
    ctx.stroke();

    ctx.strokeStyle = "rgba(226,232,240,0.82)";
    ctx.lineWidth = 5.2;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.28, cy - r * 0.26);
    ctx.lineTo(collectorPin.x, collectorPin.y);
    ctx.moveTo(cx - r * 0.28, cy + r * 0.26);
    ctx.lineTo(emitterPin.x, emitterPin.y);
    ctx.stroke();

    const arrowAngle = Math.atan2(emitterPin.y - (cy + r * 0.22), emitterPin.x - (cx - r * 0.18));
    arrowHead(ctx, cx + r * 0.33, cy + r * 0.49, arrowAngle, 11, "rgba(226,232,240,0.86)");

    ctx.strokeStyle = `rgba(167,139,250,${0.48 + flow * 0.40})`;
    ctx.lineWidth = 5.0;
    ctx.beginPath();
    ctx.moveTo(basePin.x, basePin.y);
    ctx.lineTo(cx - r * 0.28, cy);
    ctx.stroke();

    if (raw > 0.025) {
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(cx - r * 0.28, cy, 0, cx - r * 0.28, cy, r * (0.28 + flow * 0.34));
      g.addColorStop(0, `rgba(167,139,250,${0.22 + flow * 0.44})`);
      g.addColorStop(1, "rgba(167,139,250,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx - r * 0.28, cy, r * (0.28 + flow * 0.34), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }

    drawSmallCapsule(ctx, "small input", baseInput.x + r * 0.03, baseInput.y - r * 0.36, {
      bg: "rgba(167,139,250,0.12)",
      stroke: "rgba(167,139,250,0.30)",
      text: "rgba(221,214,254,0.94)"
    }, "left");

    drawSmallCapsule(ctx, "larger controlled current", collectorTop.x + r * 0.10, cy + r * 1.12, {
      bg: "rgba(245,158,11,0.12)",
      stroke: "rgba(245,158,11,0.30)",
      text: "rgba(253,230,138,0.94)"
    }, "center");

    ctx.font = "850 13px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(237,241,251,0.88)";
    ctx.fillText("C", collectorPin.x + r * 0.22, collectorPin.y - r * 0.02);
    ctx.fillText("E", emitterPin.x + r * 0.23, emitterPin.y + r * 0.02);
    ctx.fillText("B", baseInput.x - r * 0.08, baseInput.y);

    ctx.restore();

    function collectorPath(p, offset = 0) {
      const a = collectorTop;
      const b = collectorPin;
      const c = { x: cx - r * 0.09, y: cy - r * 0.22 };
      const d = { x: cx - r * 0.09, y: cy + r * 0.23 };
      const e = emitterPin;
      const f = emitterBottom;
      if (p < 0.20) {
        const t = p / 0.20;
        return { x: lerp(a.x, b.x, t) + offset * 0.15, y: lerp(a.y, b.y, t) };
      }
      if (p < 0.44) {
        const t = (p - 0.20) / 0.24;
        return { x: lerp(b.x, c.x, ease(t)) + offset, y: lerp(b.y, c.y, ease(t)) };
      }
      if (p < 0.62) {
        const t = (p - 0.44) / 0.18;
        return { x: lerp(c.x, d.x, t) + offset, y: lerp(c.y, d.y, t) };
      }
      if (p < 0.82) {
        const t = (p - 0.62) / 0.20;
        return { x: lerp(d.x, e.x, ease(t)) + offset, y: lerp(d.y, e.y, ease(t)) };
      }
      const t = (p - 0.82) / 0.18;
      return { x: lerp(e.x, f.x, t) + offset * 0.18, y: lerp(e.y, f.y, t) };
    }

    function basePath(p, offset = 0) {
      const y = baseInput.y + Math.sin(p * Math.PI * 2 + time * 2) * 1.1 + offset * 0.12;
      return { x: lerp(baseInput.x, cx - r * 0.32, ease(p)), y };
    }

    return { collectorPath, basePath };
  }

  function updateUi(raw, flow) {
    const baseCurrent = raw * 0.12;
    const water = flow * 4.8;
    const collector = flow * 12.5;
    baseReadout.textContent = `${baseCurrent.toFixed(2)} mA`;
    waterReadout.textContent = `Water flow: ${water.toFixed(2)} L/s`;
    currentReadout.textContent = `Collector current: ${collector.toFixed(2)} mA`;

    const region = regionFor(raw);
    regionBadge.textContent = region.label;
    regionBadge.className = `region-badge is-${region.key}`;
    document.documentElement.style.setProperty("--slider-percent", cssPercent(raw));
    stage.style.setProperty("--flow", flow.toFixed(3));
    stage.style.setProperty("--bridge-alpha", (0.18 + flow * 0.82).toFixed(3));
    stage.style.setProperty("--bridge-blur", `${20 + flow * 40}px`);
    stage.style.setProperty("--bridge-shadow-alpha", (0.1 + flow * 0.35).toFixed(3));
    stage.style.setProperty("--bridge-dot-opacity", (0.24 + flow * 0.76).toFixed(3));
    stage.style.setProperty("--bridge-dot-blur", `${22 + flow * 42}px`);
    stage.style.setProperty("--bridge-dot-shadow-alpha", (0.26 + flow * 0.42).toFixed(3));
  }

  function render(timestamp) {
    const dtRaw = (timestamp - state.last) / 1000;
    const dt = prefersReducedMotion ? 1 / 30 : clamp(dtRaw || 1 / 60, 1 / 120, 1 / 20);
    state.last = timestamp;
    state.time += dt;

    state.raw += (state.target - state.raw) * clamp(dt * 12, 0, 1);
    if (Math.abs(state.target - state.raw) < 0.0004) state.raw = state.target;
    state.flow = transferCurve(state.raw);

    sizeCanvas(faucetCanvas, faucetCtx, state.faucetSize);
    sizeCanvas(transistorCanvas, transistorCtx, state.transistorSize);

    const fw = state.faucetSize.w;
    const fh = state.faucetSize.h;
    const tw = state.transistorSize.w;
    const th = state.transistorSize.h;

    faucetCtx.clearRect(0, 0, fw, fh);
    transistorCtx.clearRect(0, 0, tw, th);

    const faucetGeo = drawFaucet(faucetCtx, fw, fh, state.raw, state.flow, state.time);
    state.faucetHandle = faucetGeo.handle;

    if (state.flow > 0 && !prefersReducedMotion) {
      timers.water += dt;
      const interval = lerp(0.052, 0.006, state.flow);
      let guard = 0;
      while (timers.water > interval && guard < 12) {
        timers.water -= interval;
        const count = 1 + Math.floor(state.flow * 5);
        for (let i = 0; i < count; i += 1) {
          spawnFromPool(waterDrops, (drop) => drop.spawn(faucetGeo.openingX, faucetGeo.openingY, state.flow, faucetGeo.scale));
        }
        guard += 1;
      }
    }

    for (const drop of waterDrops) {
      if (!drop.alive) continue;
      drop.update(dt, faucetGeo.sinkY);
      if (drop.y > faucetGeo.sinkBottom || drop.x < -60 || drop.x > fw + 60) drop.alive = false;
      drop.draw(faucetCtx);
    }

    const transistorGeo = drawTransistor(transistorCtx, tw, th, state.raw, state.flow, state.time);

    if (state.flow > 0 && !prefersReducedMotion) {
      timers.collector += dt;
      const interval = lerp(0.070, 0.010, state.flow);
      let guard = 0;
      while (timers.collector > interval && guard < 10) {
        timers.collector -= interval;
        const count = 1 + Math.floor(state.flow * 4);
        for (let i = 0; i < count; i += 1) {
          spawnFromPool(collectorDots, (dot) => dot.spawn(state.flow, Math.random() * 0.035));
        }
        guard += 1;
      }

      timers.base += dt;
      const baseInterval = lerp(0.13, 0.035, state.raw);
      if (timers.base > baseInterval) {
        timers.base = 0;
        spawnFromPool(baseDots, (dot) => dot.spawn(Math.max(0.08, state.raw), Math.random() * 0.04));
      }
    }

    for (const dot of collectorDots) {
      if (!dot.alive) continue;
      dot.update(dt, transistorGeo.collectorPath);
      dot.draw(transistorCtx);
    }
    for (const dot of baseDots) {
      if (!dot.alive) continue;
      dot.update(dt, transistorGeo.basePath);
      dot.draw(transistorCtx);
    }

    updateUi(state.raw, state.flow);
    requestAnimationFrame(render);
  }

  function setTarget(v) {
    state.target = clamp(Number(v) || 0, 0, 1);
    slider.value = String(Math.round(state.target * 1000));
    updateUi(state.target, transferCurve(state.target));
  }

  slider.addEventListener("input", () => setTarget(Number(slider.value) / 1000));

  presets.forEach((button) => {
    button.addEventListener("click", () => setTarget(button.dataset.preset));
  });

  function angleToValue(angle, minAngle, maxAngle) {
    return clamp((angle - minAngle) / (maxAngle - minAngle), 0, 1);
  }

  function hitHandle(clientX, clientY) {
    const h = state.faucetHandle;
    if (!h) return false;
    const rect = faucetCanvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const distToKnob = Math.hypot(x - h.knobX, y - h.knobY);
    const distToPivot = Math.hypot(x - h.pivotX, y - h.pivotY);
    return distToKnob < h.hitRadius || distToPivot < h.hitRadius * 0.88;
  }

  function dragHandle(clientX, clientY) {
    const h = state.faucetHandle;
    if (!h) return;
    const rect = faucetCanvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const angle = clamp(Math.atan2(y - h.pivotY, x - h.pivotX), h.minAngle, h.maxAngle);
    setTarget(angleToValue(angle, h.minAngle, h.maxAngle));
  }

  faucetCanvas.addEventListener("pointerdown", (event) => {
    if (!hitHandle(event.clientX, event.clientY)) return;
    state.dragHandle = true;
    faucetCanvas.setPointerCapture(event.pointerId);
    dragHandle(event.clientX, event.clientY);
    event.preventDefault();
  });

  faucetCanvas.addEventListener("pointermove", (event) => {
    if (state.dragHandle) {
      dragHandle(event.clientX, event.clientY);
      event.preventDefault();
      return;
    }
    faucetCanvas.style.cursor = hitHandle(event.clientX, event.clientY) ? "grab" : "default";
  });

  faucetCanvas.addEventListener("pointerup", () => {
    state.dragHandle = false;
    faucetCanvas.style.cursor = "default";
  });

  faucetCanvas.addEventListener("pointercancel", () => {
    state.dragHandle = false;
    faucetCanvas.style.cursor = "default";
  });

  window.addEventListener("keydown", (event) => {
    const keyActions = {
      ArrowRight: () => setTarget(state.target + 0.04),
      ArrowUp: () => setTarget(state.target + 0.04),
      ArrowLeft: () => setTarget(state.target - 0.04),
      ArrowDown: () => setTarget(state.target - 0.04),
      Home: () => setTarget(0),
      End: () => setTarget(1),
      "0": () => setTarget(0),
      "5": () => setTarget(0.5),
      "1": () => setTarget(1)
    };
    const action = keyActions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  });

  const observer = new ResizeObserver(() => {
    sizeCanvas(faucetCanvas, faucetCtx, state.faucetSize);
    sizeCanvas(transistorCanvas, transistorCtx, state.transistorSize);
  });
  observer.observe(faucetCanvas);
  observer.observe(transistorCanvas);

  updateUi(0, 0);
  requestAnimationFrame(render);
})();
