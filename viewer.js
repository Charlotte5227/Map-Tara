// viewer.js

  // === 背景地図の設定 ===
  const BG_MAPS = {
    topo: { url: "topography.png", id: "bg-img-topo", layer: "bottom" }, 
    climate: { url: "climate.png", id: "bg-img-climate", layer: "bottom" },
    region: { url: "region.png", id: "bg-img-region", layer: "top" },
    continent: { url: "continent.png", id: "bg-img-continent", layer: "top" }
  };
  let activeBgMaps = { topo: false, climate: false, region: false, continent: false };

  function ensureBgLayer(svg, type) {
    const layerInfo = BG_MAPS[type];
    const layerId = layerInfo.layer === 'top' ? "bg-layer-top" : "bg-layer-bottom";
    let layer = svg.querySelector(`#${layerId}`);
    
    if (!layer) {
      layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
      layer.setAttribute("id", layerId);
      
      if (layerInfo.layer === 'bottom') {
        const provs = svg.querySelectorAll(".prov");
        if (provs.length > 0) {
          provs[0].parentNode.insertBefore(layer, provs[0]);
        } else {
          svg.appendChild(layer);
        }
      } else {
        const numLayer = svg.querySelector("#numbers-layer");
        const labelLayer = svg.querySelector("#labels-layer");
        
        if (numLayer) {
          numLayer.parentNode.insertBefore(layer, numLayer);
        } else if (labelLayer) {
          labelLayer.parentNode.insertBefore(layer, labelLayer);
        } else {
          svg.appendChild(layer); 
        }
      }
    }
    return layer;
  }

  function toggleBgMap(type) {
    console.log(`toggleBgMap呼び出し: ${type}`);
    activeBgMaps[type] = !activeBgMaps[type];
    const svg = document.getElementById("mapSvg");
    if (!svg) {
      console.error("mapSvgが見つかりません");
      return;
    }
    console.log(`SVG見つかりました。背景マップ状態: ${activeBgMaps[type]}`);
    
    const bgLayer = ensureBgLayer(svg, type); 
    const ctrlDiv = document.getElementById(`ctrl-${type}`);
    const btn = document.getElementById(`btn${type.charAt(0).toUpperCase() + type.slice(1)}`);

    if (activeBgMaps[type]) {
      let img = document.getElementById(BG_MAPS[type].id);
      if (!img) {
        img = document.createElementNS("http://www.w3.org/2000/svg", "image");
        img.setAttribute("id", BG_MAPS[type].id);
        
        // PNG保存時のセキュリティエラーを防ぐため、画像をBase64に変換して埋め込む
        fetch(BG_MAPS[type].url)
          .then(res => res.blob())
          .then(blob => {
            console.log(`📸 ${type} イメージ読み込み完了: ${blob.size} bytes`);
            const reader = new FileReader();
            reader.onload = () => { 
              img.setAttribute("href", reader.result);
              console.log(`📸 ${type} Base64変換完了`);
            };
            reader.readAsDataURL(blob);
          })
          .catch(err => {
            console.warn(`⚠️ ${type} Base64変換失敗。直接読み込みを試行:`, err);
            img.setAttribute("href", BG_MAPS[type].url);
          });
        
        img.setAttribute("width", "5000");
        img.setAttribute("height", "2500");
        img.setAttribute("x", "0");
        img.setAttribute("y", "0");
        img.setAttribute("preserveAspectRatio", "none");
        bgLayer.appendChild(img);
      }
      img.style.display = "block";
      
      const slider = document.getElementById(`op-${type}`);
      if (slider) {
        img.setAttribute("opacity", slider.value);
      }

      if (ctrlDiv) ctrlDiv.style.display = "flex";
      btn.classList.add("active-btn");
    } else {
      const img = document.getElementById(BG_MAPS[type].id);
      if (img) img.style.display = "none";

      if (ctrlDiv) ctrlDiv.style.display = "none";
      btn.classList.remove("active-btn");
    }

    const isAnyActive = Object.values(activeBgMaps).some(val => val);
    document.getElementById("bgMapControls").style.display = isAnyActive ? "flex" : "none";
    
    const isBottomActive = activeBgMaps.topo || activeBgMaps.climate;
    const isTopActive = activeBgMaps.region || activeBgMaps.continent;
    if (isBottomActive) {
      svg.classList.add("bg-bottom-active");
    } else {
      svg.classList.remove("bg-bottom-active");
    }
    if (isTopActive) {
      svg.classList.add("bg-top-active");
    } else {
      svg.classList.remove("bg-top-active");
    }
  }

  function updateBgOpacity(type, value) {
    const img = document.getElementById(BG_MAPS[type].id);
    if (img) {
      img.setAttribute("opacity", value);
    }
  }

  // === 時間管理 (Time System) ===
  let timeConfig = null;
  const TIME_CONFIG_URL = "time-config.json";

  async function loadTimeConfig() {
    try {
      const res = await fetch(`${TIME_CONFIG_URL}?t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        timeConfig = await res.json();
      }
    } catch (e) {
      console.warn("時間設定ファイルが見つかりません。デフォルトの動作を継続します。");
    }
  }

// 閲覧サイト用の日付計算ロジック（日・月・年対応版）
  function getCalculatedDate() {
    if (!timeConfig) return null;
    const now = Date.now();
    const elapsedMs = now - timeConfig.baseRealTime;
    
    // 管理サイトの設定を読み込む (古いデータの互換性対応も含む)
    const stepMs = timeConfig.stepLengthMs || timeConfig.dayLengthMs || 3600000;
    const unit = timeConfig.stepUnit || "day";
    
    const elapsedSteps = Math.floor(elapsedMs / stepMs);
    const d = new Date(timeConfig.baseGameDate);

    // 選択された単位(日/月/年)に応じて時間を進める
    if (unit === "year") {
      d.setFullYear(d.getFullYear() + Math.max(0, elapsedSteps));
    } else if (unit === "month") {
      d.setMonth(d.getMonth() + Math.max(0, elapsedSteps));
    } else {
      d.setDate(d.getDate() + Math.max(0, elapsedSteps));
    }

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${timeConfig.calendarName} ${y}年 ${m}月 ${day}日`;
  }
  // 自動的に日付表示を更新し続けるループ
  function startClock() {
    const svg = document.getElementById("mapSvg");
    if (!svg) return;
    
    const dateStr = getCalculatedDate();
    if (dateStr) {
      updateDateDisplay(svg, dateStr);
    }
    // 1日の長さに応じて適度な間隔で更新確認を行う
    const interval = timeConfig ? Math.max(timeConfig.dayLengthMs / 100, 1000) : 5000;
    setTimeout(startClock, interval);
  }

  // 年月日を右上に描画する関数
  function updateDateDisplay(svg, dateText) {
    let layer = svg.querySelector("#date-layer");
    if (!layer) {
      layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
      layer.setAttribute("id", "date-layer");
      svg.appendChild(layer); 
    }
    layer.innerHTML = ""; 

    if (!dateText) return; 

    const svgNS = "http://www.w3.org/2000/svg";
    
    const ellipse = document.createElementNS(svgNS, "ellipse");
    ellipse.setAttribute("cx", "4400");
    ellipse.setAttribute("cy", "250");
    ellipse.setAttribute("rx", "450");
    ellipse.setAttribute("ry", "120");
    ellipse.setAttribute("fill", "rgba(255, 255, 255, 0.85)");
    ellipse.setAttribute("stroke", "#333");
    ellipse.setAttribute("stroke-width", "8");

    const text = document.createElementNS(svgNS, "text");
    text.setAttribute("x", "4400");
    text.setAttribute("y", "250");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "middle");
    text.setAttribute("style", "font-size: 80px; font-weight: bold; fill: #111; user-select: none;");
    text.textContent = dateText;

    layer.appendChild(ellipse);
    layer.appendChild(text);
  }

  // === マップ描画・操作系の設定 ===
  const REFRESH_INTERVAL_MS = 30000; 
  let lastDataHash = "";
  let labelsVisible = true;
  let numbersVisible = false;
  let viewBox = { x: 0, y: 0, w: 5000, h: 2500 };

  function ensureLayer(svg, layerId) {
    let layer = svg.querySelector(`#${layerId}`);
    if (!layer) {
      layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
      layer.setAttribute("id", layerId);
      svg.appendChild(layer);
    }
    return layer;
  }

  function resetProvinces(svg) {
    svg.querySelectorAll(".prov").forEach(p => { p.style.fill = "#FEF9DB"; });
  }

  function updateViewBox(){
    const maxCx = 5000; const minCx = 0;
    const maxCy = 2500; const minCy = 0;
    
    let cx = viewBox.x + viewBox.w / 2;
    let cy = viewBox.y + viewBox.h / 2;
    
    if (cx < minCx) viewBox.x = minCx - viewBox.w / 2;
    if (cx > maxCx) viewBox.x = maxCx - viewBox.w / 2;
    if (cy < minCy) viewBox.y = minCy - viewBox.h / 2;
    if (cy > maxCy) viewBox.y = maxCy - viewBox.h / 2;

    const svg = document.getElementById("mapSvg");
    svg.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);

    const slider = document.getElementById("zoomSlider");
    if(slider) slider.value = 5000 / viewBox.w;
  }

  function zoom(factor){
    const cx = viewBox.x + viewBox.w/2;
    const cy = viewBox.y + viewBox.h/2;
    const newW = viewBox.w * factor;
    const newH = viewBox.h * factor;

    if(newW < 500 || newW > 8000) return;

    viewBox.w = newW;
    viewBox.h = newH;
    viewBox.x = cx - viewBox.w/2;
    viewBox.y = cy - viewBox.h/2;
    updateViewBox();
  }

  function zoomIn(){ zoom(0.8); }
  function zoomOut(){ zoom(1.25); }

  const zoomSlider = document.getElementById("zoomSlider");
  if (zoomSlider) zoomSlider.addEventListener("input", (e) => {
    const scale = parseFloat(e.target.value);
    const cx = viewBox.x + viewBox.w / 2;
    const cy = viewBox.y + viewBox.h / 2;
    
    viewBox.w = 5000 / scale;
    viewBox.h = 2500 / scale;
    viewBox.x = cx - viewBox.w / 2;
    viewBox.y = cy - viewBox.h / 2;
    updateViewBox();
  });

  function toggleLabels() {
    console.log("toggleLabels呼び出し");
    labelsVisible = !labelsVisible;
    console.log(`labelsVisible: ${labelsVisible}`);
    
    // body要素にクラスを付与して制御
    document.body.classList.toggle("labels-hidden", !labelsVisible);
    
    const button = document.getElementById("toggleBtn");
    if (button) {
      button.textContent = labelsVisible ? "国名を非表示" : "国名を表示";
      console.log(`ボタンテキスト更新: ${button.textContent}`);
    }
  }

  function toggleNumbers() {
    console.log("toggleNumbers呼び出し");
    numbersVisible = !numbersVisible;
    console.log(`numbersVisible: ${numbersVisible}`);
    
    // body要素にクラスを付与して制御
    document.body.classList.toggle("numbers-hidden", !numbersVisible);
    
    const button = document.getElementById("toggleNumBtn");
    if (button) {
      button.textContent = numbersVisible ? "番号を非表示" : "番号を表示";
      console.log(`ボタンテキスト更新: ${button.textContent}`);
    }
  }

  function computeBBoxCenter(svg, provinceIds) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let any = false;
    for (const id of provinceIds) {
      const p = svg.getElementById(id);
      if (!p) continue;
      const bb = p.getBBox();
      minX = Math.min(minX, bb.x); minY = Math.min(minY, bb.y);
      maxX = Math.max(maxX, bb.x + bb.width); maxY = Math.max(maxY, bb.y + bb.height);
      any = true;
    }
    return any ? { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 } : { cx: 0, cy: 0 };
  }

  function addLabel(layer, textValue, x, y, fontSize = 72){
    const svgNS = "http://www.w3.org/2000/svg";
    const text = document.createElementNS(svgNS,"text");
    text.classList.add("label");
    text.setAttribute("x",x);
    text.setAttribute("y",y);
    text.setAttribute("text-anchor","middle");
    text.setAttribute("dominant-baseline","middle");
    text.setAttribute("style", `font-size:${fontSize}px; font-weight:800; fill:#fff; stroke:#000; stroke-width:6px; paint-order:stroke fill; user-select:none;`);
    const lines = String(textValue).split("\n");
    lines.forEach((line,i)=>{
      const tspan = document.createElementNS(svgNS,"tspan");
      tspan.setAttribute("x",x);
      tspan.setAttribute("dy", i===0 ? "0" : "1.1em");
      tspan.textContent = line;
      text.appendChild(tspan);
    });
    layer.appendChild(text);
    if (layer.id === "labels-layer" && layer.children.length <= 3) {
      console.log(`📝 ラベル追加: "${textValue.substring(0,20)}" @ (${x}, ${y})`);
    }
  }

  function addProvNumber(layer, textValue, x, y, fontSize = 52) {
    const svgNS = "http://www.w3.org/2000/svg";
    const text = document.createElementNS(svgNS, "text");
    text.classList.add("prov-number");
    text.setAttribute("x", x);
    text.setAttribute("y", y);
    text.setAttribute("style", `font-size:${fontSize}px; font-weight:bold; fill:#333; text-anchor:middle; dominant-baseline:middle; user-select:none;`);
    text.textContent = textValue;
    layer.appendChild(text);
  }

  async function loadAndRender() {
    const svg = document.getElementById("mapSvg");
    if (!svg) {
      console.error("loadAndRender: mapSvgが見つかりません");
      return;
    }
    try {
      console.log("loadAndRender開始");
      // 1. まず時間設定を最新にする
      if (!timeConfig) await loadTimeConfig();

      const url = `map-data.json?t=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Fetch failed");

      const jsonText = await res.text();
      if (jsonText === lastDataHash) {
        console.log("データ更新なし（キャッシュ）");
        return;
      }
      lastDataHash = jsonText;
      console.log("map-data.json読み込み完了（新規）");
      
      const data = JSON.parse(jsonText);
      console.log(`データアイテム数: ${data.length}`);
      
      const numbersLayer = ensureLayer(svg, "numbers-layer");
      const labelsLayer = ensureLayer(svg, "labels-layer");
      console.log("レイヤー作成完了");
      
      svg.appendChild(numbersLayer);
      svg.appendChild(labelsLayer);
      console.log("レイヤーをSVGに追加");
      
      labelsLayer.innerHTML = "";
      numbersLayer.innerHTML = "";
      console.log("レイヤーをクリア");
      resetProvinces(svg);

      let currentDateText = ""; // jsonファイルに書かれた日付用

      let labelCount = 0, numberCount = 0;
      for (const item of data) {
        if (item.type === "metadata" && item.date) {
          currentDateText = item.date;
          continue;
        }

        if (item.type === "provNumber") {
          addProvNumber(numbersLayer, item.text, item.x, item.y, 52);
          numberCount++;
          continue;
        }
        if (item.type === "freeLabel") {
          addLabel(labelsLayer, item.text, item.x, item.y, 72);
          labelCount++;
          continue;
        }
        
        if (!item.provinces || item.provinces.length === 0) continue;

        for (const id of item.provinces) {
          const p = svg.getElementById(id);
          if (p) p.style.fill = item.color;
        }

        let lx, ly;
        if (item.labelX !== undefined && item.labelY !== undefined && item.labelX !== null) {
          lx = Number(item.labelX); ly = Number(item.labelY);
        } else {
          const center = computeBBoxCenter(svg, item.provinces);
          lx = center.cx; ly = center.cy;
        }
        addLabel(labelsLayer, item.labelText || item.name, lx, ly, 72);
        labelCount++;
      }
      console.log(`✅ テキスト要素生成完了: ラベル ${labelCount}個, 番号 ${numberCount}個`);
      console.log(`ラベルレイヤー: ${labelsLayer.children.length}個の子要素`);
      console.log(`番号レイヤー: ${numbersLayer.children.length}個の子要素`);
      
      // 計算で出した時間があればそちらを優先、無ければjsonファイル内の日付を使用
      const calculatedDate = getCalculatedDate();
      updateDateDisplay(svg, calculatedDate || currentDateText);

      document.getElementById("statusIndicator").textContent = "最終更新: " + new Date().toLocaleTimeString();
    } catch (e) {
      console.error("更新エラー:", e);
      document.getElementById("statusIndicator").textContent = "同期エラー発生中";
    }
  }

// 画像保存: SVGをCanvasに描画してPNGで出力（Canvas API方式）
async function downloadMapImage() {
    const svg = document.getElementById("mapSvg");
    const statusIndicator = document.getElementById("statusIndicator");
    
    if (!svg) {
        alert("地図が見つかりません");
        return;
    }

    statusIndicator.textContent = "画像を処理中... (SVGシリアライズ中)";
    
    try {
        // SVGの全体サイズを取得
        let width = 5000;
        let height = 2500;
        
        const viewBox = svg.getAttribute("viewBox");
        if (viewBox) {
            const parts = viewBox.split(" ");
            width = parseFloat(parts[2]);
            height = parseFloat(parts[3]);
        }
        
        console.log(`キャンバスサイズ: ${width}x${height}`);
        
        // SVGをシリアライズ
        const svgString = new XMLSerializer().serializeToString(svg);
        console.log(`SVGシリアライズ完了: ${svgString.length} bytes`);
        
        // Base64エンコード
        const base64String = btoa(unescape(encodeURIComponent(svgString)));
        const dataUrl = "data:image/svg+xml;base64," + base64String;
        
        statusIndicator.textContent = "画像を処理中... (レンダリング中)";
        
        // Canvasを作成
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { alpha: false });
        
        if (!ctx) {
            throw new Error("Canvasコンテキスト取得失敗");
        }
        
        // 背景を白で塗りつぶし
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        
        // SVGを画像として読み込んでCanvasに描画
        const img = new Image();
        let loadTimeout;
        
        img.onload = () => {
            clearTimeout(loadTimeout);
            try {
                console.log("SVGをCanvasに描画中...");
                ctx.drawImage(img, 0, 0);
                
                statusIndicator.textContent = "画像を処理中... (PNG生成中)";
                
                // PNGとしてダウンロード
                canvas.toBlob((pngBlob) => {
                    try {
                        if (!pngBlob) throw new Error("PNG生成失敗");
                        
                        const link = document.createElement("a");
                        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
                        link.download = `map-${timestamp}.png`;
                        link.href = URL.createObjectURL(pngBlob);
                        link.click();
                        URL.revokeObjectURL(link.href);
                        
                        statusIndicator.textContent = "データ同期中...";
                        console.log("画像を保存しました");
                    } catch (e) {
                        console.error("ダウンロードエラー:", e);
                        alert("ダウンロードに失敗しました");
                        statusIndicator.textContent = "データ同期中...";
                    }
                }, "image/png");
                
            } catch (e) {
                console.error("Canvas描画エラー:", e);
                alert("Canvas描画に失敗しました: " + e.message);
                statusIndicator.textContent = "データ同期中...";
            }
        };
        
        img.onerror = (error) => {
            clearTimeout(loadTimeout);
            console.error("SVG読み込みエラー:", error);
            alert("SVGのレンダリングに失敗しました。画面を再度読み込んで試してください。");
            statusIndicator.textContent = "データ同期中...";
        };
        
        // タイムアウト: 120秒（2分）に延長
        loadTimeout = setTimeout(() => {
            img.src = "";
            console.error("SVG読み込みタイムアウト");
            alert("SVGのレンダリングがタイムアウトしました。しばらく待ってからもう一度試してください。");
            statusIndicator.textContent = "データ同期中...";
        }, 120000);
        
        statusIndicator.textContent = "画像を処理中... (SVG読み込み中)";
        img.src = dataUrl;
        
    } catch (e) {
        console.error("画像保存エラー:", e);
        alert("画像保存に失敗しました: " + e.message);
        statusIndicator.textContent = "データ同期中...";
    }
}

  // === スマホ・PC共通のドラッグ ＆ ピンチズーム処理 ===
  function getSvg() { return document.getElementById("mapSvg"); }
  let isDragging = false;
  let startX = 0, startY = 0;
  let initialPinchDistance = null;
  let initialPinchViewBox = null;

  function getPointerPos(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function getPinchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function handleStart(e) {
    if (e.touches && e.touches.length === 2) {
      initialPinchDistance = getPinchDistance(e.touches);
      initialPinchViewBox = { ...viewBox };
      isDragging = false;
      return;
    }
    if (e.touches && e.touches.length > 2) return;
    
    isDragging = true;
    const pos = getPointerPos(e);
    startX = pos.x;
    startY = pos.y;
  }

  function handleMove(e) {
    if (!isDragging && !initialPinchDistance) {
      return;
    }

    e.preventDefault(); 
    
    if (e.touches && e.touches.length === 2 && initialPinchDistance) {
      const currentDistance = getPinchDistance(e.touches);
      const scale = initialPinchDistance / currentDistance;
      
      const newW = initialPinchViewBox.w * scale;
      const newH = initialPinchViewBox.h * scale;
      
      if (newW >= 500 && newW <= 8000) {
        const cx = initialPinchViewBox.x + initialPinchViewBox.w / 2;
        const cy = initialPinchViewBox.y + initialPinchViewBox.h / 2;
        viewBox.w = newW;
        viewBox.h = newH;
        viewBox.x = cx - newW / 2;
        viewBox.y = cy - newH / 2;
        updateViewBox();
      }
      return;
    }

    if (!isDragging) return;
    
    const pos = getPointerPos(e);
    const dx = pos.x - startX;
    const dy = pos.y - startY;
    
    startX = pos.x;
    startY = pos.y;

    const svg = getSvg();
    if (!svg) return;
    const scaleX = viewBox.w / svg.clientWidth;
    const scaleY = viewBox.h / svg.clientHeight;

    viewBox.x -= dx * scaleX;
    viewBox.y -= dy * scaleY;
    updateViewBox();
  }

  function handleEnd(e) {
    if (!e.touches || e.touches.length < 2) {
      initialPinchDistance = null;
    }
    if (!e.touches || e.touches.length === 0) {
      isDragging = false;
    }
  }

// ★重要：マウスやタッチのイベントを付与する処理を「関数」にまとめる
function attachSvgEvents() {
  const svg = document.getElementById("mapSvg");
  if (!svg) return;

  svg.addEventListener("mousedown", handleStart);
  window.addEventListener("mousemove", handleMove, { passive: false });
  window.addEventListener("mouseup", handleEnd);

  svg.addEventListener("touchstart", handleStart, { passive: false });
  window.addEventListener("touchmove", handleMove, { passive: false });
  window.addEventListener("touchend", handleEnd);
  window.addEventListener("touchcancel", handleEnd);

  svg.addEventListener("wheel", function(e){
    e.preventDefault();
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 0.9 : 1.1;

    if(viewBox.w * zoomFactor < 500 || viewBox.w * zoomFactor > 8000) return;

    // マウス位置を基準にズーム計算
    const dx = (mouseX / svg.clientWidth) * viewBox.w;
    const dy = (mouseY / svg.clientHeight) * viewBox.h;

    viewBox.x = (viewBox.x + dx) - (dx * zoomFactor);
    viewBox.y = (viewBox.y + dy) - (dy * zoomFactor);
    viewBox.w *= zoomFactor;
    viewBox.h *= zoomFactor;
    
    updateViewBox();
  }, { passive: false });
  
  updateViewBox(); // 初期ズームの適用
}

// 3. ★重要：一番最初に実行される起動処理（SVGの読み込み）
async function initViewer() {
  try {
    console.log("initViewer開始");
    
    // === 初期状態を設定 ===
    // 初期状態: 国名は見える、数字は見えない
    document.body.classList.add("numbers-hidden");
    document.body.classList.remove("labels-hidden");
    console.log("初期状態設定完了: labels visible, numbers hidden");
    
    // map.svgを読み込んでmapContainerに挿入する
    console.log("map.svg読み込み中...");
    const res = await fetch("map.svg");
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const svgText = await res.text();
    console.log(`SVGサイズ: ${svgText.length} bytes`);
    
    const mapContainer = document.getElementById("mapContainer");
    if (!mapContainer) {
      throw new Error("mapContainer要素が見つかりません");
    }
    
    mapContainer.innerHTML = svgText;
    console.log("SVGをmapContainerに挿入しました");

    // SVGが画面に出現したので、マウス操作などを紐付ける
    attachSvgEvents();
    console.log("SVGイベント付与完了");

    // 既存の自動更新や時間設定の開始
    await loadTimeConfig(); 
    startClock();           
    loadAndRender();        
    setInterval(loadAndRender, 30000); 
    
    console.log("initViewer完了");

  } catch (e) {
    console.error("SVGの読み込みに失敗しました:", e);
    document.getElementById("statusIndicator").textContent = "エラー: " + e.message;
  }
}

// 起動
console.log("ページロード完了。initViewer実行準備中...");
initViewer();