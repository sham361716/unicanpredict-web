"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import {
  getCase,
  getSession,
  imageUrl,
  releaseCase,
  saveDiagnosis,
  type AuthUser,
  type CaseRecord,
} from "@/lib/api";

export default function ClinicianCasePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [caseRecord, setCaseRecord] = useState<CaseRecord | null>(null);
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session || session.user.role !== "CLINICIAN") {
      router.replace("/login");
      return;
    }
    setUser(session.user);
    setToken(session.token);
    getCase(session.token, params.id)
      .then((c) => {
        setCaseRecord(c);
        if (c.diagnosis?.summary) setSummary(c.diagnosis.summary);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load case"),
      );
  }, [params.id, router]);

  async function handleSaveDiagnosis() {
    if (!token || !caseRecord) return;
    setBusy(true);
    setError(null);
    try {
      const { case: updated } = await saveDiagnosis(token, caseRecord.id, summary);
      const refreshed = await getCase(token, caseRecord.id);
      setCaseRecord({ ...updated, ...refreshed });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save diagnosis");
    } finally {
      setBusy(false);
    }
  }

  async function handleRelease() {
    if (!token || !caseRecord) return;
    setBusy(true);
    setError(null);
    try {
      await releaseCase(token, caseRecord.id);
      router.push("/clinician");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to release case");
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-app text-navy">
      <AppHeader roleLabel="Clinician" userName={user.name} />

      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <button
          onClick={() => router.push("/clinician")}
          className="text-sm font-medium text-slate hover:text-navy"
        >
          ← Worklist
        </button>

        {error && (
          <p role="alert" className="mt-6 rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        {caseRecord && (
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
              {caseRecord.images?.[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl(caseRecord.images[0].storedName)}
                  alt={`${caseRecord.organ} tissue patch`}
                  className="mt-4 aspect-square w-full max-w-160 rounded-md border border-line bg-card object-contain"
                />
              )}
            </section>

            {/* ── Record ──────────────────────────────────────── */}
            <section className="lg:pt-12">
              <div className="space-y-6">
                {caseRecord.prediction && (
                  <div className="rounded-md border border-ai/25 bg-card p-5">
                    <div className="flex items-baseline justify-between gap-4">
                      <h2 className="text-sm font-medium text-slate">AI prediction</h2>
                      <span className="font-mono text-xs tabular-nums text-slate">
                        v{caseRecord.prediction.modelVersion}
                      </span>
                    </div>
                    <p className="mt-2 text-lg font-semibold text-ai">
                      {caseRecord.prediction.label}{" "}
                      <span className="font-mono text-sm font-normal tabular-nums text-slate">
                        {(caseRecord.prediction.probability * 100).toFixed(1)}%
                      </span>
                    </p>
                  </div>
                )}

                {caseRecord.review && (
                  <div className="rounded-md border border-line bg-card p-5">
                    <h2 className="text-sm font-medium text-slate">Pathologist review</h2>
                    <p className="mt-2 text-lg font-semibold">{caseRecord.review.finalLabel}</p>
                    <p className="mt-1 text-sm text-slate">
                      Blind read: {caseRecord.review.blindLabel}
                    </p>
                    {caseRecord.review.notes && (
                      <p className="mt-3 text-sm text-navy">{caseRecord.review.notes}</p>
                    )}
                  </div>
                )}

                <div>
                  <label htmlFor="summary" className="text-sm font-medium text-navy">
                    Diagnosis summary
                  </label>
                  <textarea
                    id="summary"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    disabled={caseRecord.status === "RELEASED"}
                    rows={4}
                    placeholder="Clinical diagnosis summary for the patient record."
                    className="mt-2 w-full rounded-md border border-line bg-card p-3 text-sm text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  />
                </div>

                {caseRecord.status === "VERIFIED" && (
                  <button
                    onClick={handleSaveDiagnosis}
                    disabled={busy || !summary.trim()}
                    className="h-11 w-full rounded-md bg-navy text-sm font-medium text-white transition-colors hover:bg-brand disabled:opacity-60"
                  >
                    {busy ? "Saving…" : "Save diagnosis"}
                  </button>
                )}

                {caseRecord.status === "DIAGNOSED" && (
                  <button
                    onClick={handleRelease}
                    disabled={busy}
                    className="h-11 w-full rounded-md bg-success text-sm font-medium text-white transition-colors hover:brightness-90 disabled:opacity-60"
                  >
                    {busy ? "Releasing…" : "Release to patient"}
                  </button>
                )}

                {caseRecord.status === "RELEASED" && (
                  <p className="text-sm font-medium text-success">
                    Released to patient. This case is now immutable.
                  </p>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
