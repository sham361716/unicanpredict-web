"use client";

import { useState } from "react";
import {
  GoldenVectorResult,
  loadGoldenVectors,
  loadPreprocessConfig,
  loadSession,
  runGoldenVectorCheck,
} from "@/lib/onnxPipeline";

type Status = "idle" | "loading" | "done" | "error";

export default function VerifyPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<GoldenVectorResult[]>([]);
  const [tolerance, setTolerance] = useState<number>(1e-4);

  async function runVerification() {
    setStatus("loading");
    setResults([]);
    try {
      setMessage("Loading preprocess.json + model...");
      const [cfg, session] = await Promise.all([
        loadPreprocessConfig(),
        loadSession(),
      ]);

      setMessage("Loading golden_vectors.json...");
      const gv = await loadGoldenVectors();
      const tol = gv.tolerance_abs ?? 1e-4;
      setTolerance(tol);

      const collected: GoldenVectorResult[] = [];
      for (const entry of gv.vectors) {
        setMessage(`Checking ${entry.id} (${entry.organ})...`);
        const result = await runGoldenVectorCheck(entry, session, cfg, tol);
        collected.push(result);
        setResults([...collected]);
      }

      setMessage("");
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  const passed = results.filter((r) => r.pass).length;
  const allDone = status === "done" && results.length > 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold">UniCanPredict pipeline verification</h1>
      <p className="mt-4 text-sm text-neutral-600">
        Runs all 50 golden vectors through the real ONNX model in-browser
        (onnxruntime-web) and compares against logits computed on the
        training machine. All 50 must show max abs diff below tolerance
        (1e-4 by default) before any UI is built on top of this pipeline.
      </p>

      <button
        onClick={runVerification}
        disabled={status === "loading"}
        className="mt-6 rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {status === "loading" ? "Running..." : "Run verification"}
      </button>

      {message && <p className="mt-3 text-sm text-neutral-500">{message}</p>}

      {status === "error" && (
        <p className="mt-3 text-sm text-red-600">Error: {message}</p>
      )}

      {allDone && (
        <p className="mt-4 font-semibold">
          {passed} / {results.length} passed (tolerance {tolerance}).{" "}
          {passed === results.length
            ? "Pipeline verified. Safe to build the UI on top of this."
            : "Not all passing. Do not proceed to UI work."}
        </p>
      )}

      {results.length > 0 && (
        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2 text-left">id</th>
              <th className="p-2 text-left">organ</th>
              <th className="p-2 text-left">expected</th>
              <th className="p-2 text-left">predicted</th>
              <th className="p-2 text-left">max abs diff</th>
              <th className="p-2 text-left">result</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr
                key={r.id}
                className={`border-b ${r.pass ? "bg-green-50" : "bg-red-50"}`}
              >
                <td className="p-2">{r.id}</td>
                <td className="p-2">{r.organ}</td>
                <td className="p-2">{r.expectedLabel}</td>
                <td className="p-2">{r.predictedLabel}</td>
                <td className="p-2">{r.maxAbsDiff.toExponential(3)}</td>
                <td className="p-2">{r.pass ? "PASS" : "FAIL"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
