// Same-origin by default: the API lives in this Next.js app under /api.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "TECHNICIAN" | "PATHOLOGIST" | "CLINICIAN" | "ADMIN";
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Login failed");
  }
  return res.json();
}

const TOKEN_KEY = "unicanpredict_token";
const USER_KEY = "unicanpredict_user";

export function saveSession(session: LoginResponse) {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function getSession(): { token: string; user: AuthUser } | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const userRaw = localStorage.getItem(USER_KEY);
  if (!token || !userRaw) return null;
  return { token, user: JSON.parse(userRaw) as AuthUser };
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export interface CaseImage {
  id: string;
  storedName: string;
  originalMime: string;
  createdAt: string;
}

export interface AiPredictionRecord {
  label: string;
  probability: number;
  modelVersion: string;
}

export interface ReviewRecord {
  blindLabel: string;
  finalLabel: string;
  notes?: string | null;
  disagreesWithAi?: boolean;
  createdAt?: string;
}

export interface DiagnosisRecord {
  summary: string;
  releasedAt?: string | null;
}

export interface CaseRecord {
  id: string;
  status: string;
  organ: string;
  patientId: string;
  uploadedById: string;
  createdAt: string;
  updatedAt: string;
  patient?: { pseudonymRef: string };
  images?: CaseImage[];
  prediction?: AiPredictionRecord | null;
  review?: ReviewRecord | null;
  diagnosis?: DiagnosisRecord | null;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function createCase(
  token: string,
  patientPseudonym: string,
  organ: string
): Promise<CaseRecord> {
  const res = await fetch(`${API_URL}/cases`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ patientPseudonym, organ }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to create case");
  return res.json();
}

export async function uploadCaseImage(token: string, caseId: string, file: File): Promise<CaseImage> {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch(`${API_URL}/cases/${caseId}/images`, {
    method: "POST",
    headers: authHeaders(token),
    body: formData,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to upload image");
  return res.json();
}

export async function submitCase(token: string, caseId: string): Promise<CaseRecord> {
  const res = await fetch(`${API_URL}/cases/${caseId}/transition`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ to: "AWAITING_REVIEW" }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to submit case");
  return res.json();
}

export async function listCases(token: string): Promise<CaseRecord[]> {
  const res = await fetch(`${API_URL}/cases`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error("Failed to load cases");
  return res.json();
}

export function imageUrl(storedName: string): string {
  return `${API_URL}/uploads/${storedName}`;
}

export interface AuditEntry {
  id: string;
  caseId: string | null;
  userId: string | null;
  action: string;
  detail: string | null;
  createdAt: string;
  user: { name: string; email: string; role: string } | null;
}

export async function listAudit(token: string): Promise<AuditEntry[]> {
  const res = await fetch(`${API_URL}/audit`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error("Failed to load audit log");
  return res.json();
}

export async function getCase(token: string, caseId: string): Promise<CaseRecord> {
  const res = await fetch(`${API_URL}/cases/${caseId}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error("Failed to load case");
  return res.json();
}

export async function startReview(token: string, caseId: string): Promise<CaseRecord> {
  const res = await fetch(`${API_URL}/cases/${caseId}/transition`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ to: "UNDER_REVIEW" }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to start review");
  return res.json();
}

export async function savePrediction(
  token: string,
  caseId: string,
  payload: { modelVersion: string; label: string; probability: number; logits: Record<string, number[]> }
) {
  const res = await fetch(`${API_URL}/cases/${caseId}/prediction`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to save prediction");
  return res.json();
}

export async function saveDiagnosis(token: string, caseId: string, summary: string) {
  const res = await fetch(`${API_URL}/cases/${caseId}/diagnosis`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ summary }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to save diagnosis");
  return res.json();
}

export async function releaseCase(token: string, caseId: string): Promise<CaseRecord> {
  const res = await fetch(`${API_URL}/cases/${caseId}/release`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to release case");
  return res.json();
}

// Cases where the pathologist's final verdict disagreed with the AI
// prediction — candidates for future retraining review.
export async function listDisagreements(token: string): Promise<CaseRecord[]> {
  const res = await fetch(`${API_URL}/cases/disagreements`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error("Failed to load disagreement cases");
  return res.json();
}

export function disagreementsExportUrl(): string {
  return `${API_URL}/cases/disagreements/export`;
}

export async function submitReview(
  token: string,
  caseId: string,
  payload: { blindLabel: string; finalLabel: string; notes?: string }
) {
  const res = await fetch(`${API_URL}/cases/${caseId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to submit review");
  return res.json();
}
