export function isInternalRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "staff" || role === "reviewer" || role === "approver";
}

export function isApproverRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "approver";
}

export function canApprove(role: string | null | undefined): boolean {
  return isApproverRole(role);
}
export function canClose(role: string | null | undefined): boolean {
  return isApproverRole(role);
}
export function canReopen(role: string | null | undefined): boolean {
  return isApproverRole(role);
}
export function canSetSold(role: string | null | undefined): boolean {
  return isApproverRole(role);
}
