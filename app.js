const slider = document.getElementById("signalSlider");
const signalPercent = document.getElementById("signalPercent");
const heroMeterFill = document.getElementById("heroMeterFill");
const faucetState = document.getElementById("faucetState");
const transistorState = document.getElementById("transistorState");
const handleReadout = document.getElementById("handleReadout");
const waterReadout = document.getElementById("waterReadout");
const baseReadout = document.getElementById("baseReadout");
const collectorReadout = document.getElementById("collectorReadout");

const faucetCanvas = document.getElementById("faucetCanvas");
const transistorCanvas = document.getElementById("transistorCanvas");
const fctx = faucetCanvas.getContext("2d");
const tctx = transistorCanvas.getContext("2d");

const state = {
  signal: 0.34,
  target: 0.34,
  auto: false,
  autoTime: 0,
  pulseUntil: 0,
  lastTime: performance.now(),
  water: [],
  electrons: [],
  baseDots: [],
  sparks: []
};

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, x) {
  const n = clamp((x - edge0) / (edge1 - edge0));
  return n * n * (3 - 2 * n);
}

function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3);
}

function drawRoundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function resizeCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width: rect.width, height: rect.height };
}

function drawLabel(ctx, text, x, y, options = {}) {
  ctx.save();
  ctx.font = `${options.weight || 800} ${options.size || 13}px Inter, ui-sans-serif, system-ui`;
  ctx.fillStyle = options.color || "rgba(16,16,20,0.62)";
  ctx.textAlign = options.align || "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function line(ctx, x1, y1, x2, y2, options = {}) {
  ctx.save();
  ctx.lineCap = options.cap || "round";
  ctx.lineWidth = options.width || 4;
  ctx.strokeStyle = options.color || "rgba(16,16,20,0.72)";
  if (options.dash) ctx.setLineDash(options.dash);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function arrow(ctx, x1, y1, x2, y2, options = {}) {
  line(ctx, x1, y1, x2, y2, options);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const size = options.head || 10;
  ctx.save();
  ctx.fillStyle = options.color || "rgba(16,16,20,0.72)";
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - Math.cos(angle - Math.PI / 6) * size, y2 - Math.sin(angle - Math.PI / 6) * size);
  ctx.lineTo(x2 - Math.cos(angle + Math.PI / 6) * size, y2 - Math.sin(angle + Math.PI / 6) * size);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function clearSoft(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w * 0.48, h * 0.18, 20, w * 0.48, h * 0.18, w * 0.72);
  glow.addColorStop(0, "rgba(255,255,255,0.82)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
}

function drawFaucet(ctx, dims, dt, t) {
  const { width: w, height: h } = dims;
  const s = state.signal;
  const flow = Math.pow(smoothstep(0.05, 0.96, s), 1.22);

  clearSoft(ctx, w, h);

  const pipeX = w * 0.24;
  const pipeTop = h * 0.12;
  const pipeY = h * 0.34;
  const spoutEndX = w * 0.52;
  const spoutY = h * 0.36;
  const dropY = h * 0.76;

  ctx.save();
  ctx.shadowColor = "rgba(16,16,20,0.14)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 12;

  const pipeGradient = ctx.createLinearGradient(pipeX - 30, pipeY, spoutEndX, spoutY);
  pipeGradient.addColorStop(0, "#cfd4d9");
  pipeGradient.addColorStop(0.45, "#f8fbff");
  pipeGradient.addColorStop(1, "#9ba5ad");
  ctx.strokeStyle = pipeGradient;
  ctx.lineWidth = Math.max(24, w * 0.055);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pipeX, pipeTop);
  ctx.lineTo(pipeX, pipeY);
  ctx.quadraticCurveTo(pipeX, spoutY, pipeX + w * 0.11, spoutY);
  ctx.lineTo(spoutEndX, spoutY);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.76)";
  ctx.lineWidth = Math.max(5, w * 0.011);
  ctx.beginPath();
  ctx.moveTo(pipeX - 5, pipeTop + 18);
  ctx.lineTo(pipeX - 5, pipeY - 8);
  ctx.quadraticCurveTo(pipeX - 5, spoutY - 9, pipeX + w * 0.11, spoutY - 9);
  ctx.lineTo(spoutEndX - 18, spoutY - 9);
  ctx.stroke();
  ctx.restore();

  const nozzleW = Math.max(42, w * 0.09);
  const nozzleH = Math.max(42, h * 0.085);
  ctx.save();
  ctx.shadowColor = "rgba(16,16,20,0.16)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 10;
  drawRoundRect(ctx, spoutEndX - nozzleW * 0.5, spoutY - nozzleH * 0.18, nozzleW, nozzleH, 16);
  ctx.fillStyle = "#d9dee3";
  ctx.fill();
  ctx.strokeStyle = "rgba(16,16,20,0.12)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  const opening = lerp(5, nozzleW * 0.72, flow);
  drawRoundRect(ctx, spoutEndX - opening / 2, spoutY + nozzleH * 0.28, opening, 8, 5);
  ctx.fillStyle = `rgba(38,132,255,${0.18 + flow * 0.68})`;
  ctx.fill();

  drawHandle(ctx, w, h, s, pipeX, pipeTop);
  drawWater(ctx, w, h, dt, flow, spoutEndX, spoutY + nozzleH * 0.38, dropY, t);
  drawBasin(ctx, w, h, flow);

  drawLabel(ctx, "small handle motion", pipeX + w * 0.1, pipeTop - 20, { size: 13, color: "rgba(16,16,20,0.54)" });
  drawLabel(ctx, "larger water flow", spoutEndX + w * 0.08, dropY - h * 0.16, { size: 13, color: "rgba(16,16,20,0.54)" });

  if (flow > 0.03) {
    arrow(ctx, spoutEndX + 8, spoutY + h * 0.11, spoutEndX + 8, dropY - 18, {
      width: 2.5,
      color: `rgba(38,132,255,${0.28 + flow * 0.45})`,
      head: 10
    });
  }
}

function drawHandle(ctx, w, h, s, pipeX, pipeTop) {
  const cx = pipeX;
  const cy = pipeTop;
  const angle = lerp(-0.82, 0.88, easeOutCubic(s));
  const len = Math.max(78, w * 0.16);
  const knobR = Math.max(10, w * 0.022);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.shadowColor = "rgba(16,16,20,0.18)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 8;

  drawRoundRect(ctx, -len * 0.12, -9, len, 18, 9);
  ctx.fillStyle = "#14151a";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(len * 0.9, 0, knobR, 0, Math.PI * 2);
  ctx.fillStyle = "#fff7e8";
  ctx.fill();
  ctx.strokeStyle = "rgba(16,16,20,0.18)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(22, w * 0.045), 0, Math.PI * 2);
  ctx.fillStyle = "#d4d9dd";
  ctx.fill();
  ctx.strokeStyle = "rgba(16,16,20,0.14)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(10, w * 0.02), 0, Math.PI * 2);
  ctx.fillStyle = "#f7f9fb";
  ctx.fill();
  ctx.restore();
}

function drawWater(ctx, w, h, dt, flow, x, y, bottom, t) {
  const count = Math.floor(flow * 12);
  for (let i = 0; i < count; i += 1) {
    state.water.push({
      x: x + (Math.random() - 0.5) * (6 + 28 * flow),
      y: y + Math.random() * 8,
      vx: (Math.random() - 0.5) * (18 + 24 * flow),
      vy: 160 + Math.random() * 140 + flow * 220,
      r: 1.4 + Math.random() * 3.6 * flow,
      life: 1
    });
  }

  const streamW = 6 + flow * Math.max(36, w * 0.08);
  if (flow > 0.02) {
    const grad = ctx.createLinearGradient(x, y, x, bottom);
    grad.addColorStop(0, `rgba(70,174,255,${0.08 + flow * 0.32})`);
    grad.addColorStop(0.62, `rgba(38,132,255,${0.06 + flow * 0.18})`);
    grad.addColorStop(1, "rgba(38,132,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x - streamW * 0.36, y);
    ctx.bezierCurveTo(x - streamW * 0.62, y + h * 0.16, x - streamW * 0.22, bottom - h * 0.18, x - streamW * 0.76, bottom);
    ctx.lineTo(x + streamW * 0.76, bottom);
    ctx.bezierCurveTo(x + streamW * 0.2, bottom - h * 0.18, x + streamW * 0.64, y + h * 0.16, x + streamW * 0.36, y);
    ctx.closePath();
    ctx.fill();
  }

  for (const p of state.water) {
    p.life -= dt * 0.85;
    p.x += p.vx * dt + Math.sin(t * 0.004 + p.y * 0.02) * 10 * dt;
    p.y += p.vy * dt;
    if (p.y > bottom) {
      p.y = bottom + Math.random() * 6;
      p.vy *= -0.16;
      p.vx *= 1.8;
      p.life *= 0.72;
    }
  }

  state.water = state.water.filter(p => p.life > 0 && p.y < h + 30).slice(-520);

  for (const p of state.water) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(38,132,255,${clamp(p.life) * (0.18 + flow * 0.54)})`;
    ctx.fill();
  }
}

function drawBasin(ctx, w, h, flow) {
  const bx = w * 0.16;
  const by = h * 0.78;
  const bw = w * 0.68;
  const bh = h * 0.15;

  ctx.save();
  ctx.shadowColor = "rgba(16,16,20,0.12)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 14;
  ctx.beginPath();
  ctx.ellipse(bx + bw / 2, by + bh * 0.55, bw / 2, bh * 0.44, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.fill();
  ctx.strokeStyle = "rgba(16,16,20,0.12)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(bx + bw / 2, by + bh * 0.5, bw * 0.43, bh * 0.26, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(38,132,255,${0.07 + flow * 0.18})`;
  ctx.fill();
  ctx.restore();

  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.ellipse(
      bx + bw / 2,
      by + bh * 0.5,
      bw * (0.12 + i * 0.07 + flow * 0.02),
      bh * (0.05 + i * 0.018),
      0,
      0,
      Math.PI * 2
    );
    ctx.strokeStyle = `rgba(38,132,255,${flow * (0.18 - i * 0.03)})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawTransistor(ctx, dims, dt, t) {
  const { width: w, height: h } = dims;
  const s = state.signal;
  const gate = smoothstep(0.12, 0.72, s);
  const collector = Math.pow(gate, 1.16);

  clearSoft(ctx, w, h);

  const bulbX = w * 0.52;
  const bulbY = h * 0.18;
  const tx = w * 0.52;
  const ty = h * 0.55;
  const baseX = w * 0.18;
  const baseY = ty;
  const groundY = h * 0.85;
  const vTopY = h * 0.08;

  drawLampGlow(ctx, bulbX, bulbY, w, h, collector);
  drawCircuitWires(ctx, w, h, bulbX, bulbY, tx, ty, baseX, baseY, groundY, vTopY, collector, gate);
  drawBattery(ctx, w * 0.79, vTopY + h * 0.04, s);
  drawBulb(ctx, bulbX, bulbY, w, collector);
  drawTransistorSymbol(ctx, tx, ty, w, h, gate, collector);
  drawGround(ctx, tx, groundY, w);
  drawElectrons(ctx, dt, collector, bulbX, bulbY, tx, ty, groundY, t);
  drawBaseDots(ctx, dt, s, baseX, baseY, tx, ty, t);
  drawTransferCurve(ctx, w, h, s, collector);

  drawLabel(ctx, "+6 V", w * 0.79, vTopY - 12, { size: 13, color: "rgba(16,16,20,0.56)" });
  drawLabel(ctx, "lamp", bulbX, bulbY + h * 0.125, { size: 13, color: "rgba(16,16,20,0.56)" });
  drawLabel(ctx, "base", baseX - 18, baseY - 34, { size: 13, color: "rgba(16,16,20,0.56)", align: "right" });
  drawLabel(ctx, "collector", tx + w * 0.18, ty - h * 0.2, { size: 13, color: "rgba(16,16,20,0.56)" });
  drawLabel(ctx, "emitter", tx + w * 0.16, ty + h * 0.19, { size: 13, color: "rgba(16,16,20,0.56)" });
}

function drawLampGlow(ctx, x, y, w, h, collector) {
  if (collector < 0.01) return;

  const r = Math.max(w, h) * (0.12 + collector * 0.28);
  const glow = ctx.createRadialGradient(x, y, 4, x, y, r);
  glow.addColorStop(0, `rgba(255,184,76,${0.38 + collector * 0.42})`);
  glow.addColorStop(0.28, `rgba(255,184,76,${0.17 + collector * 0.22})`);
  glow.addColorStop(1, "rgba(255,184,76,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
}

function drawCircuitWires(ctx, w, h, bulbX, bulbY, tx, ty, baseX, baseY, groundY, vTopY, collector, gate) {
  const wire = "rgba(16,16,20,0.56)";
  const hot = `rgba(255,159,26,${0.22 + collector * 0.62})`;
  const baseHot = `rgba(0,184,217,${0.18 + gate * 0.58})`;

  line(ctx, w * 0.79, vTopY + h * 0.09, bulbX, vTopY + h * 0.09, { width: 5, color: collector > 0.02 ? hot : wire });
  line(ctx, bulbX, vTopY + h * 0.09, bulbX, bulbY - h * 0.065, { width: 5, color: collector > 0.02 ? hot : wire });
  line(ctx, bulbX, bulbY + h * 0.075, tx, ty - h * 0.15, { width: 5, color: collector > 0.02 ? hot : wire });
  line(ctx, tx, ty + h * 0.15, tx, groundY - 18, { width: 5, color: collector > 0.02 ? hot : wire });
  line(ctx, baseX, baseY, tx - w * 0.11, ty, { width: 5, color: gate > 0.02 ? baseHot : wire });

  ctx.save();
  ctx.beginPath();
  ctx.arc(baseX - 10, baseY, 9, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(0,184,217,${0.18 + gate * 0.5})`;
  ctx.fill();
  ctx.strokeStyle = "rgba(16,16,20,0.14)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawBattery(ctx, x, y, s) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(16,16,20,0.62)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - 30, y - 12);
  ctx.lineTo(x + 30, y - 12);
  ctx.moveTo(x - 18, y + 10);
  ctx.lineTo(x + 18, y + 10);
  ctx.stroke();
  drawLabel(ctx, "battery", x, y + 34, { size: 12, color: "rgba(16,16,20,0.48)" });

  ctx.beginPath();
  ctx.arc(x + 39, y - 12, 4 + s * 4, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,159,26,${0.24 + s * 0.44})`;
  ctx.fill();
  ctx.restore();
}

function drawBulb(ctx, x, y, w, collector) {
  const r = Math.max(35, w * 0.07);

  ctx.save();
  ctx.shadowColor = `rgba(255,159,26,${collector * 0.62})`;
  ctx.shadowBlur = 36 + collector * 24;

  const glass = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, 2, x, y, r * 1.1);
  glass.addColorStop(0, "rgba(255,255,255,0.95)");
  glass.addColorStop(0.5, `rgba(255,216,135,${0.18 + collector * 0.34})`);
  glass.addColorStop(1, "rgba(255,255,255,0.52)");

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = glass;
  ctx.fill();
  ctx.strokeStyle = "rgba(16,16,20,0.18)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = `rgba(16,16,20,${0.36 + collector * 0.18})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.44, y + 2);
  ctx.quadraticCurveTo(x - r * 0.2, y - r * 0.28, x, y + 2);
  ctx.quadraticCurveTo(x + r * 0.2, y + r * 0.3, x + r * 0.44, y + 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, r * 0.12 + collector * r * 0.13, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,159,26,${0.18 + collector * 0.72})`;
  ctx.fill();
  ctx.restore();
}

function drawTransistorSymbol(ctx, x, y, w, h, gate, collector) {
  const radius = Math.max(58, w * 0.115);

  ctx.save();
  ctx.shadowColor = `rgba(0,184,217,${gate * 0.22})`;
  ctx.shadowBlur = 24 + gate * 18;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.52)";
  ctx.fill();
  ctx.strokeStyle = `rgba(16,16,20,${0.16 + collector * 0.18})`;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  const barX = x - radius * 0.2;
  line(ctx, barX, y - radius * 0.48, barX, y + radius * 0.48, { width: 5, color: "rgba(16,16,20,0.78)" });
  line(ctx, barX, y, x - radius * 0.96, y, { width: 5, color: "rgba(16,16,20,0.78)" });
  line(ctx, barX, y - radius * 0.34, x + radius * 0.52, y - radius * 0.86, { width: 5, color: "rgba(16,16,20,0.78)" });
  line(ctx, barX, y + radius * 0.34, x + radius * 0.52, y + radius * 0.86, { width: 5, color: "rgba(16,16,20,0.78)" });

  arrow(ctx, barX + radius * 0.3, y + radius * 0.55, x + radius * 0.56, y + radius * 0.86, {
    width: 3.2,
    color: "rgba(16,16,20,0.78)",
    head: 11
  });

  const barrierAlpha = 0.55 - gate * 0.45;
  drawRoundRect(ctx, x - radius * 0.05, y - radius * 0.58, radius * 0.2, radius * 1.16, 10);
  ctx.fillStyle = `rgba(16,16,20,${barrierAlpha})`;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, radius * (0.25 + collector * 0.1), 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,159,26,${collector * 0.18})`;
  ctx.fill();

  drawLabel(ctx, "NPN", x, y + radius + 18, { size: 13, color: "rgba(16,16,20,0.54)" });
}

function drawGround(ctx, x, y, w) {
  line(ctx, x - w * 0.07, y, x + w * 0.07, y, { width: 4, color: "rgba(16,16,20,0.56)" });
  line(ctx, x - w * 0.045, y + 12, x + w * 0.045, y + 12, { width: 4, color: "rgba(16,16,20,0.42)" });
  line(ctx, x - w * 0.022, y + 24, x + w * 0.022, y + 24, { width: 4, color: "rgba(16,16,20,0.28)" });
}

function pointOnPath(points, u) {
  const clamped = clamp(u);
  const total = points.length - 1;
  const raw = clamped * total;
  const idx = Math.min(points.length - 2, Math.floor(raw));
  const local = raw - idx;
  return {
    x: lerp(points[idx].x, points[idx + 1].x, local),
    y: lerp(points[idx].y, points[idx + 1].y, local)
  };
}

function drawElectrons(ctx, dt, collector, bulbX, bulbY, tx, ty, groundY, t) {
  if (collector > 0.015) {
    const spawn = 1 + Math.floor(collector * 8);
    for (let i = 0; i < spawn; i += 1) {
      if (Math.random() < 0.55) {
        state.electrons.push({
          u: Math.random() * 0.03,
          speed: 0.22 + Math.random() * 0.28 + collector * 0.42,
          r: 2 + Math.random() * 2.4,
          phase: Math.random() * Math.PI * 2
        });
      }
    }
  }

  const path = [
    { x: bulbX, y: bulbY - 46 },
    { x: bulbX, y: bulbY + 46 },
    { x: tx, y: ty - 72 },
    { x: tx, y: ty + 72 },
    { x: tx, y: groundY }
  ];

  for (const e of state.electrons) {
    e.u += e.speed * dt * (0.35 + collector * 1.2);
  }
  state.electrons = state.electrons.filter(e => e.u <= 1).slice(-420);

  for (const e of state.electrons) {
    const p = pointOnPath(path, e.u);
    const wobble = Math.sin(t * 0.006 + e.phase) * 2.5;
    ctx.beginPath();
    ctx.arc(p.x + wobble, p.y, e.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,159,26,${0.22 + collector * 0.62})`;
    ctx.fill();
  }
}

function drawBaseDots(ctx, dt, s, baseX, baseY, tx, ty, t) {
  const gate = smoothstep(0.08, 0.75, s);
  if (gate > 0.01 && Math.random() < gate * 0.7) {
    state.baseDots.push({
      u: 0,
      speed: 0.42 + Math.random() * 0.42,
      r: 2 + Math.random() * 2,
      phase: Math.random() * Math.PI * 2
    });
  }

  for (const d of state.baseDots) {
    d.u += d.speed * dt;
  }
  state.baseDots = state.baseDots.filter(d => d.u <= 1).slice(-130);

  const path = [
    { x: baseX - 10, y: baseY },
    { x: tx - 70, y: ty }
  ];

  for (const d of state.baseDots) {
    const p = pointOnPath(path, d.u);
    ctx.beginPath();
    ctx.arc(p.x, p.y + Math.sin(t * 0.006 + d.phase) * 1.6, d.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,184,217,${0.22 + gate * 0.62})`;
    ctx.fill();
  }
}

function drawTransferCurve(ctx, w, h, s, collector) {
  const gx = w * 0.08;
  const gy = h * 0.72;
  const gw = w * 0.22;
  const gh = h * 0.17;

  ctx.save();
  drawRoundRect(ctx, gx, gy, gw, gh, 18);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fill();
  ctx.strokeStyle = "rgba(16,16,20,0.1)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  line(ctx, gx + 18, gy + gh - 22, gx + gw - 18, gy + gh - 22, { width: 1.5, color: "rgba(16,16,20,0.25)" });
  line(ctx, gx + 18, gy + gh - 22, gx + 18, gy + 18, { width: 1.5, color: "rgba(16,16,20,0.25)" });

  ctx.beginPath();
  for (let i = 0; i <= 70; i += 1) {
    const x = i / 70;
    const y = Math.pow(smoothstep(0.12, 0.72, x), 1.16);
    const px = gx + 18 + x * (gw - 38);
    const py = gy + gh - 22 - y * (gh - 44);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = "rgba(38,132,255,0.72)";
  ctx.lineWidth = 3;
  ctx.stroke();

  const dotX = gx + 18 + s * (gw - 38);
  const dotY = gy + gh - 22 - collector * (gh - 44);
  ctx.beginPath();
  ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
  ctx.fillStyle = "#101014";
  ctx.fill();

  drawLabel(ctx, "input", gx + gw * 0.5, gy + gh - 8, { size: 10, color: "rgba(16,16,20,0.42)" });
  drawLabel(ctx, "output", gx + 14, gy + 10, { size: 10, color: "rgba(16,16,20,0.42)", align: "left" });
  ctx.restore();
}

function setTarget(value) {
  const n = clamp(value);
  state.target = n;
  slider.value = Math.round(n * 100);
  updateStaticUi(n);
}

function updateStaticUi(value = state.target) {
  const pct = Math.round(value * 100);
  signalPercent.textContent = `${pct}%`;
  slider.style.background = `linear-gradient(90deg, var(--cyan) 0%, var(--blue) ${pct}%, rgba(16,16,20,0.08) ${pct}%)`;
}

function updateLiveUi() {
  const s = state.signal;
  const flow = Math.pow(smoothstep(0.05, 0.96, s), 1.22);
  const gate = smoothstep(0.12, 0.72, s);
  const collector = Math.pow(gate, 1.16);

  const pct = Math.round(s * 100);
  const waterPct = Math.round(flow * 100);
  const baseMa = (s * 10).toFixed(1);
  const collectorMa = Math.round(collector * 140);

  heroMeterFill.style.width = `${pct}%`;
  handleReadout.textContent = `${pct}%`;
  waterReadout.textContent = `${waterPct}%`;
  baseReadout.textContent = `${baseMa} mA`;
  collectorReadout.textContent = `${collectorMa} mA`;

  let faucetText = "closed";
  if (flow > 0.72) faucetText = "pouring";
  else if (flow > 0.2) faucetText = "flowing";
  else if (flow > 0.03) faucetText = "dripping";
  faucetState.textContent = faucetText;
  faucetState.classList.toggle("on", flow > 0.2);

  let transistorText = "cutoff";
  if (collector > 0.82) transistorText = "saturated";
  else if (collector > 0.12) transistorText = "active";
  else if (collector > 0.02) transistorText = "waking";
  transistorState.textContent = transistorText;
  transistorState.classList.toggle("on", collector > 0.12);
}

function animate(now) {
  const rawDt = Math.min(0.033, (now - state.lastTime) / 1000 || 0.016);
  const dt = prefersReducedMotion ? 0 : rawDt;
  state.lastTime = now;

  if (state.auto) {
    state.autoTime += rawDt;
    const wave = (Math.sin(state.autoTime * 1.35) + 1) / 2;
    const slowWave = (Math.sin(state.autoTime * 0.42 - 0.8) + 1) / 2;
    state.target = clamp(0.08 + wave * 0.74 + slowWave * 0.12);
    slider.value = Math.round(state.target * 100);
    updateStaticUi(state.target);
  }

  if (now < state.pulseUntil) {
    const remaining = (state.pulseUntil - now) / 900;
    state.target = clamp(Math.sin(remaining * Math.PI) * 0.98);
    slider.value = Math.round(state.target * 100);
    updateStaticUi(state.target);
  }

  state.signal = lerp(state.signal, state.target, prefersReducedMotion ? 1 : 0.08);
  updateLiveUi();

  const fdims = resizeCanvas(faucetCanvas);
  const tdims = resizeCanvas(transistorCanvas);
  drawFaucet(fctx, fdims, dt, now);
  drawTransistor(tctx, tdims, dt, now);

  requestAnimationFrame(animate);
}

slider.addEventListener("input", event => {
  state.auto = false;
  document.getElementById("autoBtn").setAttribute("aria-pressed", "false");
  setTarget(Number(event.target.value) / 100);
});

const buttonTargets = [
  ["offBtn", 0],
  ["halfBtn", 0.5],
  ["fullBtn", 1]
];

for (const [id, value] of buttonTargets) {
  document.getElementById(id).addEventListener("click", () => {
    state.auto = false;
    document.getElementById("autoBtn").setAttribute("aria-pressed", "false");
    setTarget(value);
  });
}

document.getElementById("pulseBtn").addEventListener("click", () => {
  state.auto = false;
  document.getElementById("autoBtn").setAttribute("aria-pressed", "false");
  state.pulseUntil = performance.now() + 900;
});

document.getElementById("autoBtn").addEventListener("click", event => {
  state.auto = !state.auto;
  event.currentTarget.setAttribute("aria-pressed", String(state.auto));
});

window.addEventListener("resize", () => {
  resizeCanvas(faucetCanvas);
  resizeCanvas(transistorCanvas);
});

updateStaticUi(state.target);
requestAnimationFrame(animate);
