"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import {
  disagreementsExportUrl,
  getSession,
  imageUrl,
  listDisagreements,
  type AuthUser,
  type CaseRecord,
} from "@/lib/api";

export default function DisagreementsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session || session.user.role !== "ADMIN") {
      router.replace("/login");
      return;
    }
    setUser(session.user);
    setToken(session.token);
    listDisagreements(session.token)
      .then(setCases)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleExport() {
    if (!token) return;
    setExporting(true);
    setError(null);
    try {
      const res = await fetch(disagreementsExportUrl(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `disagreement-cases-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  if (!user) return null;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-app text-navy">
      <AppHeader roleLabel="Admin" userName={user.name} />

      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <Link href="/admin" className="text-sm font-medium text-slate hover:text-navy">
          ← Dashboard
        </Link>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Disagreement cases</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate">
              Cases where a pathologist&apos;s final verdict, given after seeing the AI
              prediction, still differed from it. Candidates for future retraining
              review. A disagreement means a case is worth a second look, not that the
              model was wrong.
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting || cases.length === 0}
            className="h-10 shrink-0 rounded-md bg-navy px-4 text-sm font-medium text-white transition-colors hover:bg-brand disabled:opacity-50"
          >
            {exporting ? "Preparing export…" : "Export as ZIP"}
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="mt-8 overflow-x-auto rounded-md border border-line bg-card">
          <table className="w-full min-w-180 border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-slate">
                <th className="px-4 py-3 font-medium">Patch</th>
                <th className="px-4 py-3 font-medium">Patient ref</th>
                <th className="px-4 py-3 font-medium">Organ</th>
                <th className="px-4 py-3 font-medium">AI call</th>
                <th className="px-4 py-3 font-medium">Pathologist's final call</th>
                <th className="px-4 py-3 font-medium">Reviewed</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && cases.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <p className="font-medium">No disagreements yet</p>
                    <p className="mt-1 text-slate">
                      Cases appear here when a pathologist's final verdict differs from
                      the AI's prediction.
                    </p>
                  </td>
                </tr>
              )}
              {cases.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    {c.images?.[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl(c.images[0].storedName)}
                        alt=""
                        className="h-10 w-10 rounded object-cover ring-1 ring-line"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums">{c.patient?.pseudonymRef}</td>
                  <td className="px-4 py-3 capitalize">{c.organ}</td>
                  <td className="px-4 py-3">
                    <span className="text-ai">{c.prediction?.label}</span>{" "}
                    <span className="font-mono text-xs tabular-nums text-slate">
                      {c.prediction ? `${(c.prediction.probability * 100).toFixed(1)}%` : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">{c.review?.finalLabel}</td>
                  <td className="px-4 py-3 tabular-nums text-slate">
                    {c.review?.createdAt ? new Date(c.review.createdAt).toLocaleString() : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
