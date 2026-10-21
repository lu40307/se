/**
 * Seismic Refraction Interactive Web Application
 * Line: 202610_UTELS (Taipei City University Campus Seismic Survey)
 */

document.addEventListener('DOMContentLoaded', () => {
  initSideWaveRails();
  initHeroWave();
  initWaveSimulator();
  initTxExplorer();
  initSurveyLine();
});

/* ==========================================================================
   1. Decorative Side Wave Rails (側邊波形動態裝飾 - 地震記錄波形)
   ========================================================================== */
function initSideWaveRails() {
  const leftCanvas = document.getElementById('railLeftCanvas');
  const rightCanvas = document.getElementById('railRightCanvas');
  if (!leftCanvas || !rightCanvas) return;

  const leftCtx = leftCanvas.getContext('2d');
  const rightCtx = rightCanvas.getContext('2d');

  let time = 0;

  function drawRailTrace(ctx, width, height, isRight = false) {
    ctx.clearRect(0, 0, width, height);

    const numTraces = 3; // 繪製 3 條平行的地震紀錄道
    const traceSpacing = width / (numTraces + 1);

    for (let t = 1; t <= numTraces; t++) {
      const baseX = t * traceSpacing;
      ctx.beginPath();
      ctx.strokeStyle = isRight ? '#0284c7' : '#0ea5e9';
      ctx.lineWidth = 1.2;

      const points = [];
      const step = 4;

      // 垂直由上至下模擬地震波形 Wiggle Trace
      for (let y = 0; y <= height; y += step) {
        // 疊加多組正弦波與小波 (Ricker Wavelet 複合擾動)
        const freq1 = 0.035;
        const freq2 = 0.012;
        const phase = time * 0.04 + t * 1.5;
        
        let amp = Math.sin(y * freq1 + phase) * 8 + Math.cos(y * freq2 - phase * 0.5) * 4;
        
        // 局部加入脈衝震波
        const pulse = Math.sin((y + time * 20) * 0.02);
        if (Math.abs(pulse) > 0.85) {
          amp *= 1.8;
        }

        const x = baseX + amp;
        points.push({ x, y, baseX });

        if (y === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // 傳統地震波形變密度填色 (Variable Area Fill - 正振幅填色)
      ctx.fillStyle = isRight ? 'rgba(2, 132, 199, 0.15)' : 'rgba(14, 165, 233, 0.15)';
      ctx.beginPath();
      ctx.moveTo(baseX, 0);
      for (const p of points) {
        if (p.x >= p.baseX) {
          ctx.lineTo(p.x, p.y);
        } else {
          ctx.lineTo(p.baseX, p.y);
        }
      }
      ctx.lineTo(baseX, height);
      ctx.closePath();
      ctx.fill();

      // 基底零線
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = 0.8;
      ctx.moveTo(baseX, 0);
      ctx.lineTo(baseX, height);
      ctx.stroke();
    }
  }

  function animateRails() {
    time += 0.8;
    drawRailTrace(leftCtx, leftCanvas.width, leftCanvas.height, false);
    drawRailTrace(rightCtx, rightCanvas.width, rightCanvas.height, true);
    requestAnimationFrame(animateRails);
  }

  animateRails();
}

/* ==========================================================================
   2. Hero Background Ambient Waves
   ========================================================================== */
function initHeroWave() {
  const canvas = document.getElementById('heroWaveCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  let phase = 0;

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = canvas.width;
    const h = canvas.height;
    
    // Wave 1
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.lineWidth = 1.5;
    for (let x = 0; x <= w; x += 8) {
      const y = h * 0.45 + Math.sin(x * 0.005 + phase) * 35 + Math.cos(x * 0.002 - phase * 0.5) * 20;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Wave 2
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(2, 132, 199, 0.12)';
    ctx.lineWidth = 2;
    for (let x = 0; x <= w; x += 8) {
      const y = h * 0.65 + Math.sin(x * 0.004 - phase * 0.8) * 45;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    phase += 0.015;
    requestAnimationFrame(render);
  }

  render();
}

/* ==========================================================================
   3. Interactive Wave Physics Simulator (臨界折射波傳即時模擬器)
   ========================================================================== */
let simState = {
  v1: 350,       // m/s
  v2: 650,       // m/s
  h: 3.0,        // m
  running: false,
  elapsedMs: 0,
  speedMultiplier: 1.0,
  animId: null,
  strikeAnim: 0
};

function initWaveSimulator() {
  const canvas = document.getElementById('simCanvas');
  const btnStrike = document.getElementById('btnStrike');
  const btnReset = document.getElementById('btnResetSim');
  const btnSlow = document.getElementById('btnSlowSim');
  const slowText = document.getElementById('slowText');
  
  const sliderV1 = document.getElementById('sliderV1');
  const sliderV2 = document.getElementById('sliderV2');
  const sliderDepth = document.getElementById('sliderDepth');
  
  const valV1 = document.getElementById('valV1');
  const valV2 = document.getElementById('valV2');
  const valDepth = document.getElementById('valDepth');
  const simTimeDisplay = document.getElementById('simTime');
  
  const calcCritAngle = document.getElementById('calcCritAngle');
  const calcTi = document.getElementById('calcTi');
  const calcXcross = document.getElementById('calcXcross');

  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function updateCalculations() {
    valV1.textContent = `${simState.v1} m/s`;
    valV2.textContent = `${simState.v2} m/s`;
    valDepth.textContent = `${simState.h.toFixed(1)} m`;

    // 確保 V2 > V1
    if (simState.v2 <= simState.v1) {
      simState.v2 = simState.v1 + 50;
      sliderV2.value = simState.v2;
      valV2.textContent = `${simState.v2} m/s`;
    }

    const sinCrit = simState.v1 / simState.v2;
    const critRad = Math.asin(sinCrit);
    const critDeg = (critRad * 180 / Math.PI).toFixed(1);
    
    // Intercept time ti = 2h * sqrt(v2^2 - v1^2) / (v1 * v2) * 1000 ms
    const ti = (2 * simState.h * Math.sqrt(simState.v2**2 - simState.v1**2)) / (simState.v1 * simState.v2) * 1000;
    
    // Crossover distance x_cross = 2h * sqrt((v2 + v1)/(v2 - v1))
    const xcross = 2 * simState.h * Math.sqrt((simState.v2 + simState.v1) / (simState.v2 - simState.v1));

    calcCritAngle.textContent = `${critDeg}°`;
    calcTi.textContent = `${ti.toFixed(1)} ms`;
    calcXcross.textContent = `${xcross.toFixed(1)} m`;

    // 同步更新 T-X Explorer
    if (window.updateTxChart) {
      window.updateTxChart(simState.v1, simState.v2, simState.h, ti, xcross);
    }
  }

  // Sliders input
  sliderV1.addEventListener('input', (e) => {
    simState.v1 = parseFloat(e.target.value);
    updateCalculations();
    drawSimulator();
  });
  sliderV2.addEventListener('input', (e) => {
    simState.v2 = parseFloat(e.target.value);
    updateCalculations();
    drawSimulator();
  });
  sliderDepth.addEventListener('input', (e) => {
    simState.h = parseFloat(e.target.value);
    updateCalculations();
    drawSimulator();
  });

  // Buttons
  btnStrike.addEventListener('click', () => {
    simState.elapsedMs = 0;
    simState.running = true;
    simState.strikeAnim = 1.0;
    animate();
  });

  btnReset.addEventListener('click', () => {
    simState.running = false;
    simState.elapsedMs = 0;
    simState.strikeAnim = 0;
    simTimeDisplay.textContent = '0.0 ms';
    drawSimulator();
  });

  btnSlow.addEventListener('click', () => {
    if (simState.speedMultiplier === 1.0) {
      simState.speedMultiplier = 0.35;
      slowText.textContent = '慢速播放: 0.35x';
    } else {
      simState.speedMultiplier = 1.0;
      slowText.textContent = '慢速播放: 正常';
    }
  });

  function drawSimulator() {
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // 空間座標尺度轉換：測線長度 46m 映射到畫布寬度 (左邊界 70px, 右邊界 W - 40px)
    const marginL = 70;
    const marginR = 40;
    const surveyW = W - marginL - marginR;
    const groundY = 80;
    const maxDepth = 8.0; // 畫布垂直深度尺度 8m
    const depthScale = (H - groundY - 30) / maxDepth;
    const interfaceY = groundY + simState.h * depthScale;

    // 1. 地層背景 (Layer 1 & Layer 2)
    // 第 1 層 (表層覆土)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(marginL, groundY, surveyW, interfaceY - groundY);
    
    // 第 2 層 (下伏較高速岩層)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(marginL, interfaceY, surveyW, H - interfaceY);

    // 分界面標示線 (Interface Line)
    ctx.beginPath();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.moveTo(marginL, interfaceY);
    ctx.lineTo(marginL + surveyW, interfaceY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 地表基準線 (Ground Line)
    ctx.beginPath();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.moveTo(marginL, groundY);
    ctx.lineTo(marginL + surveyW, groundY);
    ctx.stroke();

    // 標籤說明文字
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`介質分界面 (深度 h = ${simState.h.toFixed(1)} m)`, marginL + 12, interfaceY - 10);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`第 1 層覆土: V1 = ${simState.v1} m/s`, marginL + 12, groundY + 30);
    ctx.fillText(`第 2 層下伏層: V2 = ${simState.v2} m/s`, marginL + 12, interfaceY + 35);

    // 2. 繪製 24 個受波器 (Geophones, 0 ~ 46m, 每 2m 一站)
    const mToPx = surveyW / 46.0;
    for (let ch = 1; ch <= 24; ch++) {
      const stationX = (ch - 1) * 2.0;
      const gx = marginL + stationX * mToPx;
      const gy = groundY;

      // 判斷震波是否已到達此受波器
      const tSec = simState.elapsedMs / 1000.0;
      const tDirect = stationX / simState.v1;
      
      const sinCrit = simState.v1 / simState.v2;
      const xCrit = 2 * simState.h * Math.tan(Math.asin(sinCrit));
      const tiSec = (2 * simState.h * Math.sqrt(simState.v2**2 - simState.v1**2)) / (simState.v1 * simState.v2);
      const tRefract = (stationX / simState.v2) + tiSec;

      let arrived = false;
      if (simState.elapsedMs > 0) {
        if (tSec >= tDirect) arrived = true;
        if (stationX >= xCrit && tSec >= tRefract) arrived = true;
      }

      // 受波器倒三角
      ctx.beginPath();
      ctx.moveTo(gx - 6, gy - 12);
      ctx.lineTo(gx + 6, gy - 12);
      ctx.lineTo(gx, gy);
      ctx.closePath();
      ctx.fillStyle = arrived ? '#10b981' : '#cbd5e1';
      ctx.fill();
      ctx.strokeStyle = arrived ? '#059669' : '#475569';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // 受波器編號與測站距離
      if (ch === 1 || ch === 12 || ch === 24) {
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#64748b';
        ctx.fillText(`${stationX}m`, gx - 8, gy - 16);
      }
    }

    // 3. 繪製震源鐵鎚與鐵板 (Shot Point at x = 0m)
    const shotX = marginL;
    const shotY = groundY;

    // 鋼板
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(shotX - 8, shotY - 3, 16, 6);

    // 鐵鎚敲擊火花效果
    if (simState.strikeAnim > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(shotX, shotY, 14 * simState.strikeAnim, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(244, 63, 94, ${simState.strikeAnim * 0.8})`;
      ctx.fill();
      ctx.restore();
      simState.strikeAnim -= 0.05;
      if (simState.strikeAnim < 0) simState.strikeAnim = 0;
    }

    // 鐵鎚本體
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(shotX, shotY - 6, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 11px "Outfit", sans-serif';
    ctx.fillText('⚡ 震源 Shot 1 (0m)', shotX + 10, shotY - 8);

    // 4. 動態波前物理計算與繪製 (Wavefronts)
    if (simState.elapsedMs > 0) {
      const tSec = simState.elapsedMs / 1000.0;
      const sinCrit = simState.v1 / simState.v2;
      const critRad = Math.asin(sinCrit);
      const cosCrit = Math.cos(critRad);
      const rDirect = simState.v1 * tSec; // 直達波半徑 (m)

      // (A) 直達縱波 (Direct Wave) - 球面圓形波前
      const rPx = rDirect * mToPx;
      ctx.save();
      // 裁切僅繪製在第 1 層覆土內
      ctx.beginPath();
      ctx.rect(marginL, groundY, surveyW, interfaceY - groundY);
      ctx.clip();

      ctx.beginPath();
      ctx.arc(shotX, groundY, rPx, 0, Math.PI);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // 微弱漸層波場
      ctx.beginPath();
      ctx.arc(shotX, groundY, rPx, 0, Math.PI);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 14;
      ctx.stroke();
      ctx.restore();

      // (B) 臨界折射波與滑行波 (Critical Refraction & Sliding Wave)
      const tCritSec = (simState.h / cosCrit) / simState.v1; // 到達界面臨界點時間
      const xCritM = simState.h * Math.tan(critRad); // 臨界入射點水平位置 (m)

      if (tSec >= tCritSec) {
        // 沿界面高速滑行之滑行波 (Sliding Wave)
        const slidingDistM = xCritM + simState.v2 * (tSec - tCritSec);
        const slidingPx = marginL + slidingDistM * mToPx;

        // 繪製滑行波脈衝 (綠色)
        if (slidingPx <= marginL + surveyW) {
          ctx.beginPath();
          ctx.arc(slidingPx, interfaceY, 7, 0, Math.PI * 2);
          ctx.fillStyle = '#10b981';
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(marginL + xCritM * mToPx, interfaceY);
          ctx.lineTo(slidingPx, interfaceY);
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 4;
          ctx.stroke();
        }

        // (C) 向上層輻射之折射首波 (Planar Head Wavefront)
        // 首波波前面與界面夾角為 (90° - θc)
        ctx.save();
        ctx.beginPath();
        ctx.rect(marginL, groundY, surveyW, interfaceY - groundY);
        ctx.clip();

        ctx.beginPath();
        // 繪製回傳地表的折射平面波前
        const angle = critRad; // 與垂直線夾角
        const headSlope = Math.tan(angle);
        
        // 滑行波前點 (slidingDistM, h)
        // 地表到達點 x_surf = slidingDistM - h * tan(θc)
        const xSurfM = slidingDistM - simState.h * headSlope;
        const xSurfPx = marginL + xSurfM * mToPx;

        ctx.moveTo(slidingPx, interfaceY);
        ctx.lineTo(xSurfPx, groundY);
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 3.5;
        ctx.stroke();

        ctx.strokeStyle = 'rgba(244, 63, 94, 0.2)';
        ctx.lineWidth = 12;
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function animate() {
    if (!simState.running) return;

    // 時間推進 (每禎前進約 0.6 ms * 倍速)
    simState.elapsedMs += 0.55 * simState.speedMultiplier;
    simTimeDisplay.textContent = `${simState.elapsedMs.toFixed(1)} ms`;

    drawSimulator();

    // 46m 測線傳播完畢 (約 120 ms)
    if (simState.elapsedMs > 130) {
      simState.running = false;
    } else {
      simState.animId = requestAnimationFrame(animate);
    }
  }

  updateCalculations();
  drawSimulator();
}

/* ==========================================================================
   4. Interactive T-X Travel Time Curve Explorer (走時曲線探索器)
   ========================================================================== */
function initTxExplorer() {
  const canvas = document.getElementById('txCanvas');
  const tooltip = document.getElementById('txTooltip');
  const statXcross = document.getElementById('statXcross');
  const statTi = document.getElementById('statTi');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  let currentParams = {
    v1: 350,
    v2: 650,
    h: 3.0,
    ti: 14.4,
    xcross: 11.0
  };

  // 實測 8~14m 穩定視速度數據點 (支距, 到時 ms)
  const fieldData = [
    { x: 8, t: 14.6, v: 547 },
    { x: 10, t: 18.8, v: 533 },
    { x: 12, t: 20.8, v: 578 },
    { x: 14, t: 24.5, v: 571 }
  ];

  window.updateTxChart = function(v1, v2, h, ti, xcross) {
    currentParams = { v1, v2, h, ti, xcross };
    statXcross.textContent = `${xcross.toFixed(1)} m`;
    statTi.textContent = `${ti.toFixed(1)} ms`;
    renderTxChart();
  };

  function renderTxChart() {
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const padL = 60;
    const padR = 30;
    const padT = 30;
    const padB = 50;

    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const maxX = 46.0; // 支距 0~46 m
    const maxT = 110.0; // 走時 0~110 ms

    function toPx(x, t) {
      return {
        px: padL + (x / maxX) * chartW,
        py: padT + chartH - (t / maxT) * chartH
      };
    }

    // 繪製背景網格與座標軸
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= maxX; x += 10) {
      const { px } = toPx(x, 0);
      ctx.moveTo(px, padT);
      ctx.lineTo(px, padT + chartH);
    }
    for (let t = 0; t <= maxT; t += 20) {
      const { py } = toPx(0, t);
      ctx.moveTo(padL, py);
      ctx.lineTo(padL + chartW, py);
    }
    ctx.stroke();

    // 座標軸線
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + chartH);
    ctx.lineTo(padL + chartW, padT + chartH);
    ctx.stroke();

    // 刻度文字
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    for (let x = 0; x <= maxX; x += 10) {
      const { px, py } = toPx(x, 0);
      ctx.fillText(`${x}m`, px, py + 18);
    }
    ctx.textAlign = 'right';
    for (let t = 0; t <= maxT; t += 20) {
      const { px, py } = toPx(0, t);
      ctx.fillText(`${t}ms`, px - 8, py + 4);
    }

    // 軸標題
    ctx.font = '12px "Outfit", sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.fillText('支距 Offset (m)', padL + chartW / 2, H - 12);
    ctx.save();
    ctx.translate(16, padT + chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('初達走時 Travel Time (ms)', 0, 0);
    ctx.restore();

    // 1. 直達波理論線 (Direct Wave: t = x / V1)
    ctx.beginPath();
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2.5;
    for (let x = 0; x <= maxX; x += 1) {
      const t = (x / currentParams.v1) * 1000;
      const { px, py } = toPx(x, t);
      if (x === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // 2. 折射波理論線 (Head Wave: t = x / V2 + ti)
    const sinCrit = currentParams.v1 / currentParams.v2;
    const xCrit = 2 * currentParams.h * Math.tan(Math.asin(sinCrit));

    ctx.beginPath();
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2.5;
    let started = false;
    for (let x = xCrit; x <= maxX; x += 1) {
      const t = ((x / currentParams.v2) * 1000) + currentParams.ti;
      const { px, py } = toPx(x, t);
      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();

    // 截距時間虛線 (向左外插)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
    ctx.setLineDash([4, 4]);
    const pCrit = toPx(xCrit, ((xCrit / currentParams.v2) * 1000) + currentParams.ti);
    const pZero = toPx(0, currentParams.ti);
    ctx.moveTo(pCrit.px, pCrit.py);
    ctx.lineTo(pZero.px, pZero.py);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. 標記交叉距離 (Crossover point)
    const pCross = toPx(currentParams.xcross, (currentParams.xcross / currentParams.v1) * 1000);
    if (currentParams.xcross <= maxX) {
      ctx.beginPath();
      ctx.arc(pCross.px, pCross.py, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'left';
      ctx.fillText(`x_cross = ${currentParams.xcross.toFixed(1)}m`, pCross.px + 8, pCross.py - 6);
    }

    // 4. 繪製實測數據點 (Field Picks)
    for (const d of fieldData) {
      const p = toPx(d.x, d.t);
      ctx.beginPath();
      ctx.arc(p.px, p.py, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#10b981';
      ctx.fill();
      ctx.strokeStyle = '#064e3b';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 圖例 (Legend)
    ctx.font = '11px "Outfit", sans-serif';
    ctx.textAlign = 'left';
    
    // 直達波
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(padL + 16, padT + 12, 16, 3);
    ctx.fillText(`直達波 (V1 ~ ${currentParams.v1} m/s)`, padL + 38, padT + 16);

    // 折射波
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(padL + 16, padT + 28, 16, 3);
    ctx.fillText(`折射波 (V2 ~ ${currentParams.v2} m/s)`, padL + 38, padT + 32);

    // 實測點
    ctx.beginPath();
    ctx.arc(padL + 24, padT + 46, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.fill();
    ctx.fillText('實測 8~14m 穩定群 (202610_UTELS)', padL + 38, padT + 49);
  }

  // Mouse hover interaction for data tooltip
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const padL = 60;
    const padR = 30;
    const padT = 30;
    const padB = 50;
    const chartW = canvas.width - padL - padR;
    const chartH = canvas.height - padT - padB;

    let hovered = null;
    for (const d of fieldData) {
      const px = padL + (d.x / 46.0) * chartW;
      const py = padT + chartH - (d.t / 110.0) * chartH;
      const dist = Math.hypot(mx - px, my - py);
      if (dist < 12) {
        hovered = { ...d, px, py };
        break;
      }
    }

    if (hovered) {
      tooltip.style.display = 'block';
      tooltip.style.left = `${hovered.px + 12}px`;
      tooltip.style.top = `${hovered.py - 10}px`;
      tooltip.innerHTML = `實測站位: <strong>${hovered.x} m</strong><br>初動到時: <strong>${hovered.t} ms</strong><br>視速度: <strong>${hovered.v} m/s</strong>`;
    } else {
      tooltip.style.display = 'none';
    }
  });

  canvas.addEventListener('mouseleave', () => {
    tooltip.style.display = 'none';
  });

  renderTxChart();
}

/* ==========================================================================
   5. Interactive 12-Shot Survey Line Explorer
   ========================================================================== */
const SHOTS_DATA = [
  { id: 1, ffid: '101.dat', loc: 0.0, stack: 15, time: '11:13:29', offsets: '0 ~ +46 m (正向全展距)' },
  { id: 2, ffid: '102.dat', loc: 4.0, stack: 14, time: '11:17:28', offsets: '-4 ~ +42 m' },
  { id: 3, ffid: '103.dat', loc: 8.0, stack: 14, time: '11:19:54', offsets: '-8 ~ +38 m' },
  { id: 4, ffid: '104.dat', loc: 12.0, stack: 15, time: '11:21:48', offsets: '-12 ~ +34 m' },
  { id: 5, ffid: '105.dat', loc: 16.0, stack: 13, time: '11:23:54', offsets: '-16 ~ +30 m' },
  { id: 6, ffid: '106.dat', loc: 20.0, stack: 9, time: '11:25:33', offsets: '-20 ~ +26 m' },
  { id: 7, ffid: '107.dat', loc: 24.0, stack: 11, time: '11:29:12', offsets: '-24 ~ +22 m (中段雙向)' },
  { id: 8, ffid: '108.dat', loc: 28.0, stack: 3, time: '11:30:15', offsets: '-28 ~ +18 m' },
  { id: 9, ffid: '109.dat', loc: 32.0, stack: 11, time: '11:32:53', offsets: '-32 ~ +14 m' },
  { id: 10, ffid: '110.dat', loc: 36.0, stack: 13, time: '11:34:39', offsets: '-36 ~ +10 m' },
  { id: 11, ffid: '111.dat', loc: 40.0, stack: 9, time: '11:36:16', offsets: '-40 ~ +6 m' },
  { id: 12, ffid: '112.dat', loc: 44.0, stack: 14, time: '11:38:01', offsets: '-44 ~ +2 m (反向對稱)' }
];

let activeShotIndex = 0;

function initSurveyLine() {
  const lineCanvas = document.getElementById('lineCanvas');
  const gatherCanvas = document.getElementById('gatherCanvas');
  const buttonsContainer = document.getElementById('shotButtons');
  if (!lineCanvas || !buttonsContainer) return;

  const lineCtx = lineCanvas.getContext('2d');
  const gatherCtx = gatherCanvas.getContext('2d');

  // 建立 12 個炮點切換按鈕
  SHOTS_DATA.forEach((shot, idx) => {
    const btn = document.createElement('button');
    btn.className = `shot-pill ${idx === 0 ? 'active' : ''}`;
    btn.textContent = `Shot ${shot.id} (${shot.loc}m)`;
    btn.onclick = () => {
      document.querySelectorAll('.shot-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeShotIndex = idx;
      updateShotDisplay();
    };
    buttonsContainer.appendChild(btn);
  });

  function updateShotDisplay() {
    const shot = SHOTS_DATA[activeShotIndex];
    document.getElementById('shotId').textContent = `Shot ${shot.id} (FFID: ${shot.ffid})`;
    document.getElementById('shotLoc').textContent = `${shot.loc.toFixed(1)} m`;
    document.getElementById('shotStack').textContent = `${shot.stack} 次疊加 (${shot.time})`;
    document.getElementById('shotOffsets').textContent = shot.offsets;

    drawLineGeometry();
    drawGatherWaveforms();
  }

  function drawLineGeometry() {
    const W = lineCanvas.width;
    const H = lineCanvas.height;
    lineCtx.clearRect(0, 0, W, H);

    const padL = 40;
    const padR = 40;
    const lineW = W - padL - padR;
    const groundY = 80;

    // 測線基準線
    lineCtx.beginPath();
    lineCtx.strokeStyle = '#94a3b8';
    lineCtx.lineWidth = 3;
    lineCtx.moveTo(padL, groundY);
    lineCtx.lineTo(padL + lineW, groundY);
    lineCtx.stroke();

    const mToPx = lineW / 46.0;
    const activeShot = SHOTS_DATA[activeShotIndex];
    const shotPx = padL + activeShot.loc * mToPx;

    // 1. 繪製射線連接線 (Raypaths from active shot to all 24 geophones)
    for (let i = 0; i < 24; i++) {
      const gX = padL + (i * 2.0) * mToPx;
      const offset = Math.abs((i * 2.0) - activeShot.loc);
      
      lineCtx.beginPath();
      lineCtx.moveTo(shotPx, groundY);
      // 曲線下沉弧度代表地下波傳
      const depthCurve = groundY + Math.min(offset * 1.5, 45);
      lineCtx.quadraticCurveTo((shotPx + gX) / 2, depthCurve, gX, groundY);
      
      lineCtx.strokeStyle = offset <= 30 ? 'rgba(56, 189, 248, 0.35)' : 'rgba(244, 63, 94, 0.2)';
      lineCtx.lineWidth = 1;
      lineCtx.stroke();
    }

    // 2. 繪製 24 個受波器
    for (let i = 0; i < 24; i++) {
      const gx = padL + (i * 2.0) * mToPx;
      lineCtx.beginPath();
      lineCtx.moveTo(gx - 5, groundY - 10);
      lineCtx.lineTo(gx + 5, groundY - 10);
      lineCtx.lineTo(gx, groundY);
      lineCtx.closePath();
      lineCtx.fillStyle = '#0284c7';
      lineCtx.fill();
    }

    // 3. 繪製 12 個炮點標記 (圓形)
    SHOTS_DATA.forEach((s, idx) => {
      const sx = padL + s.loc * mToPx;
      const isActive = idx === activeShotIndex;

      lineCtx.beginPath();
      lineCtx.arc(sx, groundY + (isActive ? 16 : 14), isActive ? 8 : 4.5, 0, Math.PI * 2);
      lineCtx.fillStyle = isActive ? '#f43f5e' : '#cbd5e1';
      lineCtx.fill();
      if (isActive) {
        lineCtx.strokeStyle = '#fff';
        lineCtx.lineWidth = 2;
        lineCtx.stroke();
      }
    });

    // 活躍震源發光標記
    lineCtx.beginPath();
    lineCtx.arc(shotPx, groundY, 14, 0, Math.PI * 2);
    lineCtx.fillStyle = 'rgba(244, 63, 94, 0.3)';
    lineCtx.fill();

    lineCtx.font = 'bold 12px "Outfit", sans-serif';
    lineCtx.fillStyle = '#f43f5e';
    lineCtx.textAlign = 'center';
    lineCtx.fillText(`★ Shot ${activeShot.id} (${activeShot.loc}m)`, shotPx, groundY - 22);

    // 兩端標記
    lineCtx.font = '10px "JetBrains Mono", monospace';
    lineCtx.fillStyle = '#64748b';
    lineCtx.textAlign = 'left';
    lineCtx.fillText('0.0m (北端)', padL, groundY + 36);
    lineCtx.textAlign = 'right';
    lineCtx.fillText('46.0m (南端)', padL + lineW, groundY + 36);
  }

  function drawGatherWaveforms() {
    const W = gatherCanvas.width;
    const H = gatherCanvas.height;
    gatherCtx.clearRect(0, 0, W, H);

    const padL = 30;
    const padR = 30;
    const padT = 20;
    const padB = 25;
    const traceW = (W - padL - padR) / 24;

    const activeShot = SHOTS_DATA[activeShotIndex];

    for (let ch = 1; ch <= 24; ch++) {
      const stationM = (ch - 1) * 2.0;
      const offset = Math.abs(stationM - activeShot.loc);
      const baseX = padL + (ch - 0.5) * traceW;

      // 模擬初達走時 (約 350~550 m/s)
      const arrivalNorm = Math.min((offset / 30.0) * 0.7 + 0.1, 0.85);
      const arrivalY = padT + arrivalNorm * (H - padT - padB);

      // 雜訊振幅比 (大於 30m SNR 降低)
      const snrFactor = offset > 30 ? 0.35 : 1.0;

      gatherCtx.beginPath();
      gatherCtx.strokeStyle = '#38bdf8';
      gatherCtx.lineWidth = 1;

      for (let y = padT; y <= H - padB; y += 2) {
        let amp = 0;
        if (y < arrivalY) {
          // 初達前微弱背景噪訊
          amp = (Math.random() - 0.5) * 1.5;
        } else {
          // 初達波脈衝與衰減尾波
          const dy = y - arrivalY;
          amp = Math.sin(dy * 0.3) * Math.exp(-dy * 0.05) * 7 * snrFactor;
          amp += (Math.random() - 0.5) * 2.0; // 疊加環境雜訊
        }
        
        const x = baseX + amp;
        if (y === padT) gatherCtx.moveTo(x, y);
        else gatherCtx.lineTo(x, y);
      }
      gatherCtx.stroke();

      // 標註通道號
      if (ch % 2 === 1) {
        gatherCtx.font = '9px "JetBrains Mono", monospace';
        gatherCtx.fillStyle = '#64748b';
        gatherCtx.textAlign = 'center';
        gatherCtx.fillText(`CH${ch}`, baseX, H - 8);
      }
    }
  }

  updateShotDisplay();
}

/* ==========================================================================
   6. Data Analysis Tabs Switcher
   ========================================================================== */
window.switchAnalysisTab = function(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  event.currentTarget.classList.add('active');
  const target = document.getElementById(`tab-${tabId}`);
  if (target) target.classList.add('active');
};

/* ==========================================================================
   7. Equipment Showcase Modal
   ========================================================================== */
const EQUIP_SPECS = {
  das1: {
    title: 'Geometrics DAS-1 NZ 震測記錄主機',
    sub: '24-Channel Engineering Seismograph',
    img: 'assets/das1.jpg',
    specs: '• 通道數：24 Channels\n• 取樣率：0.25 ms (4000 Hz)\n• 紀錄長度：0.5 s (2000 點/道)\n• 前級放大增益：固定 36 dB (Fixed Gain)\n• 別名濾波器：1666.66 Hz\n• 濾波設定：Low/High Cut/Notch 全關閉',
    role: '負責 24 通道微弱電壓訊號的 24 位元 A/D 高速類比數位轉換。在手動敲擊鐵鎚時，依據 trigger 瞬時脈衝同步啟動取樣，並對同點敲擊波形進行即時垂直疊加（Vertical Stacking 3~15 次）以壓制隨機環境雜訊。'
  },
  geophone: {
    title: '垂直動圈式速度檢波器 (Geophones)',
    sub: 'Vertical Component Velocity Sensor',
    img: 'assets/geophone.jpg',
    specs: '• 感應分量：垂直分量 (Vertical Z)\n• 固有頻率：4.5 Hz ~ 14 Hz\n• 數量：24 支 (布設間距 2.0 m)\n• 接地配件：高強度不銹鋼耦合探針',
    role: '將沿地表傳播或自地下折射回傳的微弱地面質點垂直振動速度，透過線圈切割磁力線轉換為毫伏級電壓訊號。施測時探針必須垂直牢固釘入土中，確保高頻能量不被鬆土吸收。'
  },
  hammer: {
    title: '手動重型鐵鎚 + 衝擊鐵板 + Trigger 開關',
    sub: 'Impulsive Seismic Source System',
    img: 'assets/hammer.jpg',
    specs: '• 鐵鎚規格：12~16 磅手動重鎚\n• 衝擊鋼板：厚度 2.5 cm 厚鋼板\n• 觸發開關：壓電式瞬時閉合觸發器 (裝於鎚柄)\n• 敲擊方式：垂直向下全力敲擊',
    role: '安全環保之非爆破人工震源。墊厚鐵板能防止土壤塑性變形並確保震波頻譜集中於高頻；鎚柄之 Trigger 在擊中瞬間導通，向主機傳遞精確次毫秒級的 t = 0 起跳訊號。'
  },
  system: {
    title: '全系統野外整合配置 (電源、線纜與筆電)',
    sub: 'Integrated Field Survey System',
    img: 'assets/system.jpg',
    specs: '• 供電系統：12V 車用深循環蓄電池 (純淨直流電)\n• 訊號線纜：24 通道多芯屏蔽主電纜 (2.0 m 分支)\n• 終端電腦：連線控制筆電 (即時顯示與存檔)',
    role: '提供野外自給自足的低雜訊量測環境。12V 電瓶徹底杜絕市電 60 Hz 交流干擾；專用電纜傳輸多道訊號；筆電端則負責監控每一炮各道波形與即時品質評估。'
  }
};

window.openEquipModal = function(key) {
  const data = EQUIP_SPECS[key];
  if (!data) return;

  document.getElementById('modalTitle').textContent = data.title;
  document.getElementById('modalSub').textContent = data.sub;
  document.getElementById('modalImg').src = data.img;
  document.getElementById('modalSpecs').textContent = data.specs;
  document.getElementById('modalRole').textContent = data.role;

  document.getElementById('equipModal').classList.add('open');
};

window.closeEquipModal = function() {
  document.getElementById('equipModal').classList.remove('open');
};
