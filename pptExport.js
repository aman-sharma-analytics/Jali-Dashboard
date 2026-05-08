import pptxgen from "pptxgenjs";
import { toPng } from "html-to-image";

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const EXPORT_WIDTH = 1400;
const SLICE_HEIGHT = Math.round((EXPORT_WIDTH * 9) / 16);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sanitizeFileName = (value) =>
  String(value || "webinar-insights")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();

const loadImage = (dataUrl) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });

const canvasToDataUrl = (source, y, height) => {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#08090C";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, y, source.width, height, 0, 0, source.width, height);
  return canvas.toDataURL("image/png");
};

export async function exportTabsToPpt({ targets, getNode, fileName }) {
  if (!targets?.length) return;

  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  await sleep(350);

  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Webinar Insights Local Analyzer";
  pptx.subject = "Webinar dashboard export";
  pptx.title = "Webinar Insights Export";
  pptx.company = "Local browser export";
  pptx.lang = "en-US";
  pptx.theme = {
    headFontFace: "Plus Jakarta Sans",
    bodyFontFace: "Plus Jakarta Sans",
    lang: "en-US",
  };
  pptx.defineLayout({ name: "CUSTOM_WIDE", width: SLIDE_W, height: SLIDE_H });
  pptx.layout = "CUSTOM_WIDE";

  for (const target of targets) {
    const node = getNode(target.key);
    if (!node) continue;

    const dataUrl = await toPng(node, {
      cacheBust: true,
      pixelRatio: 1,
      width: EXPORT_WIDTH,
      height: node.scrollHeight,
      canvasWidth: EXPORT_WIDTH,
      canvasHeight: node.scrollHeight,
      backgroundColor: "#08090C",
      filter: (el) => !el.classList?.contains("ppt-export-skip"),
      style: {
        transform: "none",
        width: `${EXPORT_WIDTH}px`,
      },
    });

    const image = await loadImage(dataUrl);
    const total = Math.max(1, Math.ceil(image.height / SLICE_HEIGHT));

    for (let index = 0; index < total; index += 1) {
      const y = index * SLICE_HEIGHT;
      const height = Math.min(SLICE_HEIGHT, image.height - y);
      const slide = pptx.addSlide();
      slide.background = { color: "08090C" };
      slide.addImage({
        data: canvasToDataUrl(image, y, height),
        x: 0,
        y: 0,
        w: SLIDE_W,
        h: (height / EXPORT_WIDTH) * SLIDE_W,
      });
      slide.addText(`${target.num} ${target.label}${total > 1 ? `  ${index + 1}/${total}` : ""}`, {
        x: 0.18,
        y: 7.18,
        w: 12.9,
        h: 0.18,
        fontFace: "JetBrains Mono",
        fontSize: 5.5,
        color: "5C6478",
        margin: 0,
      });
    }
  }

  await pptx.writeFile({ fileName: `${sanitizeFileName(fileName)}.pptx` });
}

export async function exportChartNodesToPpt({ charts, fileName }) {
  if (!charts?.length) return;

  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  await sleep(250);

  const pptx = new pptxgen();
  pptx.defineLayout({ name: "CUSTOM_WIDE", width: SLIDE_W, height: SLIDE_H });
  pptx.layout = "CUSTOM_WIDE";
  pptx.author = "Webinar Insights Local Analyzer";
  pptx.subject = "Selected webinar chart export";
  pptx.title = "Selected Webinar Charts";
  pptx.theme = {
    headFontFace: "Plus Jakarta Sans",
    bodyFontFace: "Plus Jakarta Sans",
    lang: "en-US",
  };

  for (const chart of charts) {
    if (!chart.node) continue;
    const rect = chart.node.getBoundingClientRect();
    const width = Math.max(1, Math.ceil(rect.width || chart.node.scrollWidth || EXPORT_WIDTH));
    const height = Math.max(1, Math.ceil(chart.node.scrollHeight || rect.height || 1));
    const dataUrl = await toPng(chart.node, {
      cacheBust: true,
      pixelRatio: 1.4,
      width,
      height,
      canvasWidth: width,
      canvasHeight: height,
      backgroundColor: "#08090C",
      filter: (el) => !el.classList?.contains("ppt-export-skip"),
    });

    const image = await loadImage(dataUrl);
    const safeHeight = Math.max(1, image.height);
    const chartSliceHeight = Math.round((image.width * 9) / 16);
    const total = Math.max(1, Math.ceil(safeHeight / chartSliceHeight));

    for (let index = 0; index < total; index += 1) {
      const y = index * chartSliceHeight;
      const sliceHeight = Math.min(chartSliceHeight, safeHeight - y);
      const slide = pptx.addSlide();
      slide.background = { color: "08090C" };
      const renderedHeight = Math.min(SLIDE_H - 0.42, (sliceHeight / image.width) * SLIDE_W);
      slide.addImage({
        data: canvasToDataUrl(image, y, sliceHeight),
        x: 0,
        y: 0,
        w: SLIDE_W,
        h: renderedHeight,
      });
      slide.addText(`${chart.group} / ${chart.title}${total > 1 ? `  ${index + 1}/${total}` : ""}`, {
        x: 0.18,
        y: 7.18,
        w: 12.9,
        h: 0.18,
        fontFace: "JetBrains Mono",
        fontSize: 5.5,
        color: "5C6478",
        margin: 0,
      });
    }
  }

  await pptx.writeFile({ fileName: `${sanitizeFileName(fileName)}.pptx` });
}
