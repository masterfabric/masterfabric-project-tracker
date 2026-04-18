/**
 * After a successful login/register/OTP, `setMfGoAuth` runs before `router.replace('(tabs)')`.
 * Any awaited work in between lets React paint `MfGoAuthScreen`'s static "You're signed in" branch.
 * While this flag is true, that branch is skipped in favor of a short loading shell until unmount.
 */
let suppress = false;

export function suppressMfGoAuthSignedInPlaceholder(): void {
  suppress = true;
}

export function clearMfGoAuthSignedInPlaceholderSuppress(): void {
  suppress = false;
}

export function isMfGoAuthSignedInPlaceholderSuppressed(): boolean {
  return suppress;
}
