"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { AppHeader } from "@/components/app-header";
import {
  getCase,
  getSession,
  imageUrl,
  savePrediction,
  startReview,
  submitReview,
  type AuthUser,
  type CaseRecord,
} from "@/lib/api";
import {
  predictImage,
  MODEL_VERSION,
  type PredictionResult,
} from "@/lib/onnxPipeline";

type Label = "BENIGN" | "MALIGNANT";

// Step machine for the mandatory blind-read-then-reveal flow: the AI
// prediction is not fetched, let alone rendered, until the pathologist's
// own blind read is locked in. "locking" happens before inference ever runs.
type Step = "loading" | "blind" | "predicting" | "revealed" | "done";

const LABELS: Label[] = ["BENIGN", "MALIGNANT"];

export default function PathologistCasePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [caseRecord, setCaseRecord] = useState<CaseRecord | null>(null);
  const [step, setStep] = useState<Step>("loading");
  const [error, setError] = useState<string | null>(null);

  const [blindLabel, setBlindLabel] = useState<Label>("BENIGN");
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [finalLabel, setFinalLabel] = useState<Label>("BENIGN");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Guards the case load (and the status transition it can trigger) against
  // running twice for the same case id. A second run on a fresh navigation,
  // or React re-invoking the effect, previously raced two transition
  // requests and could leave the page stuck without ever showing an error.
  const loadedCaseId = useRef<string | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session || session.user.role !== "PATHOLOGIST") {
      router.replace("/login");
      return;
    }
    setUser(session.user);
    setToken(session.token);

    if (loadedCaseId.current === params.id) return;
    loadedCaseId.current = params.id;
    setStep("loading");
    setError(null);

    (async () => {
      try {
        let c = await getCase(session.token, params.id);
        if (c.status === "AWAITING_REVIEW") {
          c = await startReview(session.token, params.id);
        }
        if (c.status !== "UNDER_REVIEW") {
          setError(
            `This case is ${c.status.replaceAll("_", " ").toLowerCase()}, not open for review.`,
          );
          setCaseRecord(c);
          return;
        }
        setCaseRecord(c);
        setStep("blind");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load case");
      }
    })();
  }, [params.id, router]);

  async function handleLockBlindRead() {
    if (!token || !caseRecord) return;
    setStep("predicting");
    setError(null);
    try {
      const image = caseRecord.images?.[0];
      if (!image) throw new Error("Case has no image");
      const result = await predictImage(
        imageUrl(image.storedName),
        caseRecord.organ as "breast" | "lung" | "colon",
      );
      await savePrediction(token, caseRecord.id, {
        modelVersion: MODEL_VERSION,
        label: result.label,
        probability: result.probability,
        logits: result.logits,
      });
      setPrediction(result);
      setFinalLabel(blindLabel);
      setStep("revealed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prediction failed");
      setStep("blind");
    }
  }

  async function handleSubmitReview() {
    if (!token || !caseRecord) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitReview(token, caseRecord.id, {
        blindLabel,
        finalLabel,
        notes: notes || undefined,
      });
      setStep("done");
      setTimeout(() => router.push("/pathologist"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) return null;

  const revealed = (step === "revealed" || step === "done") && prediction;
  const agrees = revealed && prediction.label === blindLabel;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-app text-navy">
      <AppHeader roleLabel="Pathologist" userName={user.name} />

      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <button
          onClick={() => router.push("/pathologist")}
          className="text-sm font-medium text-slate hover:text-navy"
        >
          ← Worklist
        </button>

        {step === "loading" && !error && (
          <p className="mt-6 text-sm text-slate">Loading case…</p>
        )}

        {error && (
          <p role="alert" className="mt-6 rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        {caseRecord && caseRecord.images?.[0] && step !== "loading" && (
          <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_400px]">
            {/* ── Specimen ───────────────────────────────────── */}
            <section>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">
                  <span className="font-mono tabular-nums">
                    {caseRecord.patient?.pseudonymRef}
                  </span>
                </h1>
                <span className="capitalize text-slate">
                  {caseRecord.organ} tissue patch
                </span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl(caseRecord.images[0].storedName)}
                alt={`${caseRecord.organ} tissue patch`}
                className="mt-4 aspect-square w-full max-w-160 rounded-md border border-line bg-card object-contain"
              />
            </section>

            {/* ── Decision panel ─────────────────────────────── */}
            <section className="lg:pt-12">
              {(step === "blind" || step === "predicting") && (
                <div className="animate-[fade-up_420ms_cubic-bezier(0.16,1,0.3,1)]">
                  <h2 className="text-base font-semibold">Your read</h2>
                  <p className="mt-1 text-sm text-slate">
                    Record your call before the AI prediction is generated.
                  </p>

                  <div role="radiogroup" aria-label="Your read" className="mt-5 grid grid-cols-2 gap-2">
                    {LABELS.map((l) => (
                      <button
                        key={l}
                        role="radio"
                        aria-checked={blindLabel === l}
                        disabled={step === "predicting"}
                        onClick={() => setBlindLabel(l)}
                        className={cn(
                          "h-11 rounded-md border text-sm font-medium transition-colors disabled:opacity-60",
                          blindLabel === l
                            ? "border-brand bg-brand text-white"
                            : "border-line bg-card text-navy hover:border-brand",
                        )}
                      >
                        {l === "BENIGN" ? "Benign" : "Malignant"}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleLockBlindRead}
                    disabled={step === "predicting"}
                    className="mt-6 h-11 w-full rounded-md bg-navy text-sm font-medium text-white transition-colors hover:bg-brand disabled:opacity-60"
                  >
                    {step === "predicting"
                      ? "Running AI prediction…"
                      : "Lock read and reveal AI"}
                  </button>
                  <p className="mt-3 text-xs text-slate">
                    Locking is permanent. The model runs only after this point.
                  </p>
                </div>
              )}

              {revealed && (
                <div className="animate-[fade-up_520ms_cubic-bezier(0.16,1,0.3,1)] space-y-8">
                  <div className="rounded-md border border-ai/25 bg-card p-5">
                    <div className="flex items-baseline justify-between gap-4">
                      <h2 className="text-sm font-medium text-slate">AI prediction</h2>
                      <span className="font-mono text-xs tabular-nums text-slate">
                        v{MODEL_VERSION} · {prediction.inferenceMs.toFixed(0)} ms
                      </span>
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-ai">
                      {prediction.label === "BENIGN" ? "Benign" : "Malignant"}
                    </p>
                    <div className="mt-4">
                      <div className="flex items-baseline justify-between font-mono text-sm tabular-nums">
                        <span className="text-slate">Confidence</span>
                        <span>{(prediction.probability * 100).toFixed(1)}%</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                        <div
                          className="h-full rounded-full bg-ai transition-[width] duration-700 ease-out"
                          style={{ width: `${prediction.probability * 100}%` }}
                        />
                      </div>
                    </div>
                    <p className="mt-4 text-sm text-slate">
                      {agrees
                        ? "Matches your blind read."
                        : "Differs from your blind read."}
                    </p>
                  </div>

                  <div>
                    <h2 className="text-sm font-medium text-slate">Your final verdict</h2>
                    <div role="radiogroup" aria-label="Final verdict" className="mt-3 grid grid-cols-2 gap-2">
                      {LABELS.map((l) => (
                        <button
                          key={l}
                          role="radio"
                          aria-checked={finalLabel === l}
                          disabled={step === "done"}
                          onClick={() => setFinalLabel(l)}
                          className={cn(
                            "h-11 rounded-md border text-sm font-medium transition-colors disabled:opacity-60",
                            finalLabel === l
                              ? "border-brand bg-brand text-white"
                              : "border-line bg-card text-navy hover:border-brand",
                          )}
                        >
                          {l === "BENIGN" ? "Benign" : "Malignant"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="notes" className="text-sm font-medium text-navy">
                      Notes <span className="font-normal text-slate">(optional)</span>
                    </label>
                    <textarea
                      id="notes"
                      value={notes}
                      disabled={step === "done"}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="mt-2 w-full rounded-md border border-line bg-card p-3 text-sm text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    />
                  </div>

                  {step === "revealed" && (
                    <button
                      onClick={handleSubmitReview}
                      disabled={submitting}
                      className="h-11 w-full rounded-md bg-navy text-sm font-medium text-white transition-colors hover:bg-brand disabled:opacity-60"
                    >
                      {submitting ? "Submitting…" : "Submit review"}
                    </button>
                  )}
                  {step === "done" && (
                    <p className="text-sm font-medium text-success">
                      Review submitted. Case verified.
                    </p>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
