"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
      const { case: updated } = await saveDiagnosis(
        token,
        caseRecord.id,
        summary,
      );
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
    <main className="flex flex-1 flex-col bg-app px-4 py-10 text-navy">
      <div className="mx-auto w-full max-w-3xl">
        <button
          onClick={() => router.push("/clinician")}
          className="text-sm text-slate hover:text-navy"
        >
          ← Back to case list
        </button>

        {error && <p className="mt-6 text-sm text-danger">{error}</p>}

        {caseRecord && (
          <div className="mt-6 grid gap-8 md:grid-cols-[320px_1fr]">
            {caseRecord.images?.[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl(caseRecord.images[0].storedName)}
                alt="Tissue patch"
                className="h-80 w-80 rounded-md border border-line object-cover shadow-sm"
              />
            )}

            <div>
              <h1 className="text-xl font-bold">
                {caseRecord.patient?.pseudonymRef} · {caseRecord.organ}
              </h1>

              <div className="mt-6 space-y-4">
                {caseRecord.prediction && (
                  <div className="rounded-md border border-ai/30 bg-ai/5 p-4">
                    <p className="text-xs uppercase tracking-wide text-ai">
                      AI prediction
                    </p>
                    <p className="text-lg font-semibold">
                      {caseRecord.prediction.label}{" "}
                      <span className="text-sm font-normal text-slate">
                        ({(caseRecord.prediction.probability * 100).toFixed(1)}
                        %)
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-slate">
                      model v{caseRecord.prediction.modelVersion}
                    </p>
                  </div>
                )}

                {caseRecord.review && (
                  <div className="rounded-md border border-brand/20 bg-accent-soft p-4">
                    <p className="text-xs uppercase tracking-wide text-brand">
                      Pathologist review
                    </p>
                    <p className="text-lg font-semibold">
                      {caseRecord.review.finalLabel}
                    </p>
                    <p className="mt-1 text-xs text-slate">
                      Blind read: {caseRecord.review.blindLabel}
                    </p>
                    {caseRecord.review.notes && (
                      <p className="mt-2 text-sm text-navy">
                        {caseRecord.review.notes}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-6">
                <label className="text-sm font-medium text-navy">
                  Diagnosis summary
                </label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  disabled={caseRecord.status === "RELEASED"}
                  rows={4}
                  placeholder="Clinical diagnosis summary for the patient record..."
                  className="mt-2 w-full rounded-md border border-line bg-white p-3 text-sm text-navy shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                />
              </div>

              <div className="mt-4 flex gap-3">
                {caseRecord.status === "VERIFIED" && (
                  <button
                    onClick={handleSaveDiagnosis}
                    disabled={busy || !summary.trim()}
                    className="h-10 rounded-md bg-brand px-6 text-sm font-medium text-white shadow-sm transition hover:bg-brand-hover disabled:opacity-60"
                  >
                    {busy ? "Saving..." : "Save diagnosis"}
                  </button>
                )}

                {caseRecord.status === "DIAGNOSED" && (
                  <button
                    onClick={handleRelease}
                    disabled={busy}
                    className="h-10 rounded-md bg-success px-6 text-sm font-medium text-white shadow-sm transition hover:brightness-90 disabled:opacity-60"
                  >
                    {busy ? "Releasing..." : "Release to patient"}
                  </button>
                )}

                {caseRecord.status === "RELEASED" && (
                  <p className="text-sm text-success">
                    Released to patient — this case is now immutable.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
