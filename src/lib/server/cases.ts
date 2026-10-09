export const ORGANS = ["breast", "lung", "colon"] as const;
export type Organ = (typeof ORGANS)[number];

export const CASE_STATUSES = [
  "DRAFT",
  "AWAITING_REVIEW",
  "UNDER_REVIEW",
  "VERIFIED",
  "DIAGNOSED",
  "RELEASED",
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

// Allowed status -> status transitions. Anything not listed here is rejected
// by the API. RELEASED has no outgoing edges; it's immutable.
export const ALLOWED_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  DRAFT: ["AWAITING_REVIEW"],
  AWAITING_REVIEW: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["VERIFIED"],
  VERIFIED: ["DIAGNOSED"],
  DIAGNOSED: ["RELEASED"],
  RELEASED: [],
};

export function canTransition(from: CaseStatus, to: CaseStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
