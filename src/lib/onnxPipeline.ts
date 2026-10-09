import * as ort from "onnxruntime-web";

ort.env.wasm.wasmPaths = "/ort/";

export interface PreprocessConfig {
  size_safety_cap: { max_longest_side_px: number };
  outputs: Record<string, { classes: string[] }>;
  [key: string]: unknown;
}

export interface GoldenVectorEntry {
  id: string;
  file: string;
  organ: "breast" | "lung" | "colon";
  expected_logits: Record<string, number[]>;
  expected_label: string;
  expected_probability: number;
}

export interface GoldenVectorsFile {
  tolerance_abs?: number;
  vectors: GoldenVectorEntry[];
}

// Pinned literal, never looked up dynamically. See README.txt.
export const MODEL_VERSION = "1.0.0";

const MODEL_URL = "/model/unicanpredict_v1.0.0.onnx";
const PREPROCESS_URL = "/model/preprocess.json";
const GOLDEN_VECTORS_URL = "/model/golden_vectors.json";
// entry.file already includes its own "images/" prefix (e.g. "images/gv_001.png").
const GOLDEN_VECTOR_IMAGE_DIR = "/model/golden_vectors";

let sessionPromise: Promise<ort.InferenceSession> | null = null;
let preprocessPromise: Promise<PreprocessConfig> | null = null;

export function loadPreprocessConfig(): Promise<PreprocessConfig> {
  if (!preprocessPromise) {
    preprocessPromise = fetch(PREPROCESS_URL).then((res) => {
      if (!res.ok) throw new Error("Could not load preprocess.json");
      return res.json();
    });
  }
  return preprocessPromise;
}

export function loadSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const session = await ort.InferenceSession.create(MODEL_URL, {
        executionProviders: ["wasm"],
      });
      // Warm-up runs. The first call is always slow; don't let it pollute later timing.
      const dummy = new ort.Tensor(
        "float32",
        new Float32Array(1 * 3 * 224 * 224),
        [1, 3, 224, 224]
      );
      for (let i = 0; i < 3; i++) await session.run({ image: dummy });
      return session;
    })();
  }
  return sessionPromise;
}

export function loadImageEl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// Mirrors preprocess.json's client_side_steps: RGB -> /255 -> NCHW.
// Resize + normalize run INSIDE the ONNX graph (see preprocess.json
// "why_resize_is_in_the_graph") -- a plain canvas resize can't reproduce the
// training pipeline's antialiased bilinear resize closely enough (measured up
// to 0.34 max abs logit diff on large source tiles). Only a safety-cap
// downscale happens here, for memory, well above the graph's own resize target.
export async function preprocessImage(
  imgEl: HTMLImageElement,
  cfg: PreprocessConfig
): Promise<ort.Tensor> {
  let width = imgEl.naturalWidth || imgEl.width;
  let height = imgEl.naturalHeight || imgEl.height;
  const cap = cfg.size_safety_cap.max_longest_side_px;
  if (Math.max(width, height) > cap) {
    const scale = cap / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D canvas context");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(imgEl, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height); // RGBA, 0-255

  const chw = new Float32Array(3 * width * height);
  const plane = width * height;
  for (let i = 0; i < plane; i++) {
    chw[i] = data[i * 4] / 255; // R, drop alpha
    chw[plane + i] = data[i * 4 + 1] / 255; // G
    chw[2 * plane + i] = data[i * 4 + 2] / 255; // B
  }
  return new ort.Tensor("float32", chw, [1, 3, height, width]);
}

export function softmax(arr: number[]): number[] {
  const m = Math.max(...arr);
  const exps = arr.map((v) => Math.exp(v - m));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}

export function maxAbsDiff(a: number[], b: number[]): number {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
}

export interface PredictionResult {
  organ: "breast" | "lung" | "colon";
  label: string;
  probability: number;
  logits: Record<string, number[]>;
  inferenceMs: number;
}

// Runs the full pipeline (preprocess -> ONNX -> softmax) for one image against
// one organ head. This is the only place a live (non-golden-vector) image
// gets predicted client-side; the browser is the only place inference runs.
export async function predictImage(
  imgUrl: string,
  organ: "breast" | "lung" | "colon"
): Promise<PredictionResult> {
  const [cfg, session] = await Promise.all([loadPreprocessConfig(), loadSession()]);
  const imgEl = await loadImageEl(imgUrl);
  const tensor = await preprocessImage(imgEl, cfg);

  const t0 = performance.now();
  const output = await session.run({ image: tensor });
  const inferenceMs = performance.now() - t0;

  const logits: Record<string, number[]> = {};
  for (const name of Object.keys(cfg.outputs)) {
    logits[name] = Array.from(output[name].data as Float32Array);
  }

  const organLogits = logits[`logits_${organ}`];
  const probs = softmax(organLogits);
  const predIdx = probs[1] > probs[0] ? 1 : 0;
  const label = cfg.outputs[`logits_${organ}`].classes[predIdx];

  return { organ, label, probability: probs[predIdx], logits, inferenceMs };
}

export interface GoldenVectorResult {
  id: string;
  organ: string;
  expectedLabel: string;
  predictedLabel: string;
  maxAbsDiff: number;
  pass: boolean;
}

export async function loadGoldenVectors(): Promise<GoldenVectorsFile> {
  const res = await fetch(GOLDEN_VECTORS_URL);
  if (!res.ok) throw new Error("Could not load golden_vectors.json");
  return res.json();
}

export async function runGoldenVectorCheck(
  entry: GoldenVectorEntry,
  session: ort.InferenceSession,
  cfg: PreprocessConfig,
  toleranceAbs: number
): Promise<GoldenVectorResult> {
  const imgEl = await loadImageEl(`${GOLDEN_VECTOR_IMAGE_DIR}/${entry.file}`);
  const tensor = await preprocessImage(imgEl, cfg);
  const output = await session.run({ image: tensor });

  let entryMaxDiff = 0;
  for (const name of Object.keys(entry.expected_logits)) {
    const got = Array.from(output[name].data as Float32Array);
    const expected = entry.expected_logits[name];
    entryMaxDiff = Math.max(entryMaxDiff, maxAbsDiff(got, expected));
  }

  const organLogits = Array.from(
    output[`logits_${entry.organ}`].data as Float32Array
  );
  const probs = softmax(organLogits);
  const predIdx = probs[1] > probs[0] ? 1 : 0;
  const predictedLabel = cfg.outputs[`logits_${entry.organ}`].classes[predIdx];

  return {
    id: entry.id,
    organ: entry.organ,
    expectedLabel: entry.expected_label,
    predictedLabel,
    maxAbsDiff: entryMaxDiff,
    pass: entryMaxDiff < toleranceAbs,
  };
}
