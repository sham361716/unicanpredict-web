"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AppHeader } from "@/components/app-header";
import {
  createCase,
  getSession,
  imageUrl,
  listCases,
  submitCase,
  uploadCaseImage,
  type AuthUser,
  type CaseRecord,
} from "@/lib/api";

const ORGANS = ["breast", "lung", "colon"] as const;

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "text-slate",
  AWAITING_REVIEW: "text-warning",
  REJECTED_QC: "text-danger",
  UNDER_REVIEW: "text-ai",
  VERIFIED: "text-brand",
  DIAGNOSED: "text-brand",
  RELEASED: "text-success",
};

export default function TechnicianPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);

  const [pseudonym, setPseudonym] = useState("");
  const [organ, setOrgan] = useState<(typeof ORGANS)[number]>("breast");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session || session.user.role !== "TECHNICIAN") {
      router.replace("/login");
      return;
    }
    setUser(session.user);
    setToken(session.token);
  }, [router]);

  async function refreshCases(currentToken: string) {
    setLoadingCases(true);
    try {
      const data = await listCases(currentToken);
      setCases(data);
    } catch {
      // non-fatal — the list just stays stale
    } finally {
      setLoadingCases(false);
    }
  }

  useEffect(() => {
    if (token) refreshCases(token);
  }, [token]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function handleCreateCase(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setSuccess(null);
    if (!file) {
      setError("Attach an image before submitting.");
      return;
    }
    setBusy(true);
    try {
      const created = await createCase(token, pseudonym, organ);
      await uploadCaseImage(token, created.id, file);
      await submitCase(token, created.id);
      setSuccess(`Case ${pseudonym} submitted for pathologist review.`);
      setPseudonym("");
      setFile(null);
      (e.target as HTMLFormElement).reset();
      await refreshCases(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-app text-navy">
      <AppHeader roleLabel="Technician" userName={user.name} />

      <main className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* ── Intake ─────────────────────────────────────── */}
        <form onSubmit={handleCreateCase} className="h-fit space-y-6 lg:sticky lg:top-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">New case</h1>
            <p className="mt-1 text-sm text-slate">
              Submit a tissue patch for pathologist review.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pseudonym">Patient reference</Label>
            <Input
              id="pseudonym"
              placeholder="PT-0001"
              className="font-mono"
              value={pseudonym}
              onChange={(e) => setPseudonym(e.target.value)}
              required
            />
            <p className="text-xs text-slate">Pseudonymous reference only. No real names.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="organ">Organ</Label>
            <select
              id="organ"
              value={organ}
              onChange={(e) => setOrgan(e.target.value as (typeof ORGANS)[number])}
              className="h-10 w-full rounded-md border border-line bg-card px-3 text-sm text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {ORGANS.map((o) => (
                <option key={o} value={o}>
                  {o[0].toUpperCase() + o.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="image">Tissue patch</Label>
            <Input
              id="image"
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
            {previewUrl && (
              <div className="flex items-center gap-3 rounded-md border border-line bg-card p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Selected patch preview"
                  className="h-14 w-14 rounded object-cover ring-1 ring-line"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{file?.name}</p>
                  <p className="font-mono text-xs tabular-nums text-slate">
                    {file ? `${(file.size / 1024).toFixed(0)} KB` : ""}
                  </p>
                </div>
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          {success && <p className="text-sm font-medium text-success">{success}</p>}

          <button
            type="submit"
            disabled={busy}
            className={cn(
              "h-11 w-full rounded-md bg-navy text-sm font-medium text-white transition-colors hover:bg-brand disabled:opacity-60",
            )}
          >
            {busy ? "Submitting…" : "Create and submit for review"}
          </button>
        </form>

        {/* ── Submitted cases ────────────────────────────── */}
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold">Submitted cases</h2>
            <span className="text-sm tabular-nums text-slate">{cases.length}</span>
          </div>

          <div className="mt-4 overflow-x-auto rounded-md border border-line bg-card">
            <table className="w-full min-w-140 border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-slate">
                  <th className="px-4 py-3 font-medium">Patch</th>
                  <th className="px-4 py-3 font-medium">Patient ref</th>
                  <th className="px-4 py-3 font-medium">Organ</th>
                  <th className="px-4 py-3 font-medium">Submitted</th>
                  <th className="px-4 py-3 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {loadingCases && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate">
                      Loading cases…
                    </td>
                  </tr>
                )}
                {!loadingCases && cases.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center">
                      <p className="font-medium">No cases yet</p>
                      <p className="mt-1 text-slate">
                        Submitted patches will appear here with their review status.
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
                    <td className="px-4 py-3 tabular-nums text-slate">
                      {new Date(c.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn("font-medium", STATUS_STYLES[c.status] ?? "text-slate")}>
                        {c.status.replaceAll("_", " ").toLowerCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
