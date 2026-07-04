// image-exporter.js
// viewer.js から画像出力関連だけを切り出したユーティリティ
(function (global) {
  "use strict";

  function getLabelPresetKey(labelsVisible, numbersVisible) {
    if (labelsVisible && numbersVisible) return "both";
    if (labelsVisible) return "labelsCountry";
    if (numbersVisible) return "labelsNumber";
    return "none";
  }

  function getMapSizeFromSvg(svg) {
    let width = 5000;
    let height = 2500;
    const vb = (svg.getAttribute("viewBox") || "").trim().split(/\s+/).map(Number);
    if (vb.length === 4 && Number.isFinite(vb[2]) && Number.isFinite(vb[3])) {
      width = Math.max(1, Math.round(vb[2]));
      height = Math.max(1, Math.round(vb[3]));
    }
    return { width, height };
  }

  function getCurrentViewBox(svg) {
    const vb = (svg.getAttribute("viewBox") || "").trim().split(/\s+/).map(Number);
    if (vb.length === 4 && vb.every(Number.isFinite)) {
      return { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
    }
    return { x: 0, y: 0, w: 5000, h: 2500 };
  }

  function closeCanvasSource(source) {
    if (source && typeof source.close === "function") {
      source.close();
    }
  }

  function getSourceWidth(source) {
    return Number(source && source.width) || Number(source && source.naturalWidth) || 0;
  }

  function getSourceHeight(source) {
    return Number(source && source.height) || Number(source && source.naturalHeight) || 0;
  }

  async function loadImageForCanvas(url) {
    const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`画像読み込み失敗: ${url} (${res.status})`);

    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (!bytes || bytes.length === 0) throw new Error(`画像が空です: ${url}`);

    const lowerUrl = String(url).toLowerCase();
    if (lowerUrl.endsWith(".png")) {
      const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
      const isPng = pngSignature.every((v, i) => bytes[i] === v);
      if (!isPng) throw new Error(`PNG形式ではありません: ${url}`);
    }

    const blob = new Blob([buffer], { type: "image/png" });

    if (typeof createImageBitmap === "function") {
      try {
        return await createImageBitmap(blob);
      } catch (e) {
        console.warn("createImageBitmapのデコードに失敗。Imageで再試行します:", e);
      }
    }

    const imgUrl = URL.createObjectURL(blob);
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("画像読み込みタイムアウト")), 30000);
        img.onload = () => {
          clearTimeout(timeout);
          resolve();
        };
        img.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("画像読み込みエラー"));
        };
        img.src = imgUrl;
      });
      return img;
    } finally {
      setTimeout(() => URL.revokeObjectURL(imgUrl), 2000);
    }
  }

  async function drawLayer(ctx, url, width, height, opacity, sourceViewBox) {
    const source = await loadImageForCanvas(url);
    try {
      ctx.save();
      ctx.globalAlpha = opacity;

      if (sourceViewBox) {
        const srcW = getSourceWidth(source);
        const srcH = getSourceHeight(source);
        const sx = Math.max(0, Math.min(sourceViewBox.x, srcW));
        const sy = Math.max(0, Math.min(sourceViewBox.y, srcH));
        const sw = Math.max(1, Math.min(sourceViewBox.w, srcW - sx));
        const sh = Math.max(1, Math.min(sourceViewBox.h, srcH - sy));
        ctx.drawImage(source, sx, sy, sw, sh, 0, 0, width, height);
      } else {
        ctx.drawImage(source, 0, 0, width, height);
      }

      ctx.restore();
    } finally {
      closeCanvasSource(source);
    }
  }

  function downloadBlob(blob, fileName) {
    const link = document.createElement("a");
    const blobUrl = URL.createObjectURL(blob);
    link.href = blobUrl;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
  }

  function createImageExporter(config) {
    const {
      assetUrl,
      BG_MAPS,
      PREGENERATED_MAP_ASSETS,
      getSvg,
      getStatusIndicator,
      getLabelsVisible,
      getNumbersVisible,
      getActiveBgMaps,
      getBgOpacity
    } = config;

    async function downloadGeneratedLatestImage() {
      const generatedUrl = `${assetUrl("generated/map-latest.png")}?t=${Date.now()}`;
      const res = await fetch(generatedUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`生成済み画像が未作成です (${res.status})`);

      const imageBuffer = await res.arrayBuffer();
      const signature = new Uint8Array(imageBuffer.slice(0, 8));
      const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
      const isPng = pngSignature.every((v, i) => signature[i] === v);
      if (!isPng) throw new Error("生成済み画像がPNG形式ではありません");

      const imageBlob = new Blob([imageBuffer], { type: "image/png" });
      if (!imageBlob || imageBlob.size === 0) throw new Error("生成済み画像が空です");

      downloadBlob(imageBlob, `map-latest-${new Date().toISOString().slice(0, 10)}.png`);
    }

    async function downloadMapImageFromPreRendered() {
      const svg = getSvg();
      if (!svg) throw new Error("地図が見つかりません");

      const { width, height } = getMapSizeFromSvg(svg);
      const sourceViewBox = getCurrentViewBox(svg);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) throw new Error("Canvasコンテキスト取得失敗");

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      // Base(色付き地図) -> 背景画像群 -> ラベル群
      await drawLayer(ctx, PREGENERATED_MAP_ASSETS.base, width, height, 1, sourceViewBox);

      const activeBgMaps = getActiveBgMaps();
      for (const type of ["topo", "climate", "region", "continent"]) {
        if (!activeBgMaps[type]) continue;
        await drawLayer(ctx, BG_MAPS[type].url, width, height, getBgOpacity(type), sourceViewBox);
      }

      const labelPreset = getLabelPresetKey(getLabelsVisible(), getNumbersVisible());
      if (labelPreset === "labelsCountry" || labelPreset === "both") {
        await drawLayer(ctx, PREGENERATED_MAP_ASSETS.labelsCountry, width, height, 1, sourceViewBox);
      }
      if (labelPreset === "labelsNumber" || labelPreset === "both") {
        await drawLayer(ctx, PREGENERATED_MAP_ASSETS.labelsNumber, width, height, 1, sourceViewBox);
      }

      const pngBlob = await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("PNG生成失敗"));
            return;
          }
          resolve(blob);
        }, "image/png");
      });

      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
      downloadBlob(pngBlob, `map-composited-${timestamp}.png`);
    }

    async function downloadMapImageLegacy() {
      const svg = getSvg();
      if (!svg) throw new Error("地図が見つかりません");

      let width = 5000;
      let height = 2500;
      const viewBox = svg.getAttribute("viewBox");
      if (viewBox) {
        const parts = viewBox.split(" ");
        width = parseFloat(parts[2]);
        height = parseFloat(parts[3]);
      }

      const svgString = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);

      try {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) throw new Error("Canvasコンテキスト取得失敗");

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);

        const img = new Image();
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("SVG読み込みタイムアウト")), 45000);
          img.onload = () => {
            clearTimeout(timeout);
            resolve();
          };
          img.onerror = () => {
            clearTimeout(timeout);
            reject(new Error("SVG読み込みエラー"));
          };
          img.src = svgUrl;
        });

        ctx.drawImage(img, 0, 0);
        const pngBlob = await new Promise((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error("PNG生成失敗"));
              return;
            }
            resolve(blob);
          }, "image/png");
        });

        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
        downloadBlob(pngBlob, `map-local-${timestamp}.png`);
      } finally {
        URL.revokeObjectURL(svgUrl);
      }
    }

    async function downloadMapImage() {
      const statusIndicator = getStatusIndicator();
      statusIndicator.textContent = "事前生成画像を合成中...";

      try {
        await downloadMapImageFromPreRendered();
        statusIndicator.textContent = "最終更新: " + new Date().toLocaleTimeString();
        console.log("事前生成PNGの合成画像を保存しました");
        return;
      } catch (e) {
        console.warn("事前生成PNG合成に失敗。次のフォールバックへ:", e);
      }

      statusIndicator.textContent = "生成済み画像を確認中...";
      try {
        await downloadGeneratedLatestImage();
        statusIndicator.textContent = "最終更新: " + new Date().toLocaleTimeString();
        alert("事前生成アセットが未配備のため、生成済み画像を保存しました。\n表示状態（背景/ラベル）とは一致しない場合があります。");
        return;
      } catch (e) {
        console.warn("生成済み画像の取得にも失敗。従来方式へ:", e);
      }

      statusIndicator.textContent = "従来方式で保存中...";
      try {
        await downloadMapImageLegacy();
        statusIndicator.textContent = "最終更新: " + new Date().toLocaleTimeString();
        alert("事前生成PNGでの合成保存に失敗したため、従来方式で保存しました。");
        return;
      } catch (e) {
        console.warn("従来方式の保存にも失敗:", e);
      }

      alert("画像保存に失敗しました。しばらく待って再試行してください。\n画像生成ワークフローが成功しているかも確認してください。");
      statusIndicator.textContent = "データ同期中...";
    }

    return {
      downloadMapImage,
      downloadMapImageFromPreRendered,
      downloadGeneratedLatestImage,
      downloadMapImageLegacy
    };
  }

  global.createImageExporter = createImageExporter;
})(window);
