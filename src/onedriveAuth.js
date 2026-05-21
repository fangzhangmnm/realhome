// Microsoft Graph auth via MSAL.js — redirect flow only.
//
// Why redirect-only:
//   - Meta Quest's browser doesn't support popups (no window.open new tab).
//   - Same code path works on desktop. Trade-off: a full page reload during
//     sign-in. We don't lose meaningful state — the menu rebuilds from IDB
//     and the only thing in-flight at sign-in time is the menu itself.
//
// Sign-out: clearCache({ account }) NOT logoutRedirect. The full logout
// signs the user out of ALL Microsoft properties in their browser (Outlook,
// Teams, etc.) — hostile UX. clearCache only drops this app's tokens.
//
// Silent token probe — REQUIRED, but background-only:
//
// MSAL with cacheLocation:"localStorage" shares its account cache across
// every app on the same origin. So getAllAccounts() can return an account
// the user has consented for some OTHER clientId (e.g. JustReadPapers's
// `8b5063a4-…`) but NOT for RealHome's `c987add3-…`. Trusting that result
// blindly => UI says "Signed in as alice@…" but every Graph call fails
// because we don't have a token for our clientId.
//
// The probe — `acquireTokenSilent` against our specific scopes — is the
// only reliable way to detect per-clientId consent. Pattern from
// ../20260518 JustReadPapers/src/auth.js.
//
// Two probe outcomes:
//   - succeeds (have valid refresh token for OUR clientId): activeAccount
//     set, UI swaps to "Signed in: …"
//   - fails (no consent, refresh expired, OR iframe timeout when MSAL
//     falls back to hidden-iframe silent renewal and third-party cookies
//     are blocked): activeAccount stays null, UI stays "Not signed in"
//
// The iframe failure path is the loud one (6s timeout, scary console
// messages). That's why this MUST run in the background after the first
// menu paint — never block boot.
//
// Cache: cacheLocation = "localStorage" so accounts survive tab close.
// sessionStorage would force a fresh interactive sign-in on every Quest
// reboot.

import {
  PublicClientApplication,
  InteractionRequiredAuthError,
} from "@azure/msal-browser";
import {
  ONEDRIVE_CLIENT_ID,
  ONEDRIVE_SCOPES,
  onedriveRedirectUri,
  isOneDriveConfigured,
} from "./config.js";

let pcaPromise = null;
let activeAccount = null;

export function isConfigured() {
  return isOneDriveConfigured();
}

// Singleton init. handleRedirectPromise drains MSAL's pending interactive
// state. After that, if there's a cached account, we run a silent token
// probe scoped to OUR clientId — that's the only reliable signal that
// THIS specific app has consent (see header comment for why).
//
// Probe failure (including iframe timeout from cross-app cache leak) is
// silent: activeAccount stays null, UI stays "Not signed in", no error
// surfaces. Caller bootstrap MUST run this in the background — not on the
// boot critical path — because the probe can take up to 6s to fail.
export function getPCA() {
  if (!isOneDriveConfigured()) {
    return Promise.reject(new Error("OneDrive not configured (set ONEDRIVE_CLIENT_ID in src/config.js)"));
  }
  if (pcaPromise) return pcaPromise;
  pcaPromise = (async () => {
    const pca = new PublicClientApplication({
      auth: {
        clientId: ONEDRIVE_CLIENT_ID,
        // /common = personal + work/school accounts. Matches the "All Microsoft
        // account users" supportedAccountTypes in Azure.
        authority: "https://login.microsoftonline.com/common",
        redirectUri: onedriveRedirectUri(),
        postLogoutRedirectUri: onedriveRedirectUri(),
        navigateToLoginRequestUrl: true,
      },
      cache: {
        // localStorage survives tab close; sessionStorage doesn't.
        cacheLocation: "localStorage",
        storeAuthStateInCookie: false,
      },
      system: {
        loggerOptions: { loggerCallback: () => {}, piiLoggingEnabled: false },
      },
    });
    await pca.initialize();

    // Drain any in-flight redirect. May throw when offline — fall through
    // with activeAccount unset.
    let redirectResponse = null;
    try {
      redirectResponse = await pca.handleRedirectPromise();
    } catch (err) {
      console.warn("MSAL handleRedirectPromise failed:", err);
    }

    if (redirectResponse?.account) {
      pca.setActiveAccount(redirectResponse.account);
      activeAccount = redirectResponse.account;
      return pca;
    }

    // Per-clientId consent probe. acquireTokenSilent succeeds quickly when
    // the user signed in to THIS app (cached refresh token works). For
    // accounts from a sibling app sharing localStorage, MSAL falls back to
    // hidden-iframe silent renewal which times out (~6s) → throws. Either
    // failure path leaves activeAccount=null, so the UI shows sign-in
    // instead of lying about being authorized.
    const cached = pca.getAllAccounts();
    if (cached.length > 0) {
      try {
        await pca.acquireTokenSilent({
          scopes: ONEDRIVE_SCOPES,
          account: cached[0],
        });
        pca.setActiveAccount(cached[0]);
        activeAccount = cached[0];
      } catch (err) {
        // Includes: InteractionRequiredAuthError, monitor_window_timeout
        // (cross-app cache leak), network errors offline. All correctly
        // map to "not signed in for this app" — UI default state is right.
        console.warn(
          "MSAL silent probe failed (cached account not authorized for this app?):",
          err.errorCode || err.message,
        );
      }
    }
    return pca;
  })().catch((err) => {
    pcaPromise = null;
    throw err;
  });
  return pcaPromise;
}

export async function getAccount() {
  await getPCA();
  return activeAccount;
}

export async function signIn() {
  const pca = await getPCA();
  // Redirect: the entire page navigates to login.microsoftonline.com, then
  // returns to redirectUri with a code. MSAL's handleRedirectPromise() picks
  // it up on the next page load.
  await pca.loginRedirect({
    scopes: ONEDRIVE_SCOPES,
    prompt: "select_account",
  });
}

// Local sign-out only. We clear THIS app's MSAL cache + drop active account.
// We do NOT call logoutRedirect — that would sign the user out of every
// Microsoft property in their browser (Outlook, Teams, OneDrive web). Bad UX.
//
// The user can still revoke our app's consent globally at
// https://account.live.com/consent/Manage if they want a true logout.
export async function signOut() {
  const pca = await getPCA();
  const account = activeAccount;
  activeAccount = null;
  try { pca.setActiveAccount(null); } catch (_) {}
  if (account) {
    try {
      await pca.clearCache({ account });
    } catch (err) {
      console.warn("MSAL clearCache failed:", err);
    }
  }
}

// Acquire an access token for Graph calls. Tries silent (cached refresh
// token) first; on InteractionRequiredAuthError, kicks off
// acquireTokenRedirect — which navigates away. Caller should treat that
// case as "session ended, page is reloading."
export async function getToken() {
  const pca = await getPCA();
  if (!activeAccount) throw new Error("not signed in");
  try {
    const result = await pca.acquireTokenSilent({
      account: activeAccount,
      scopes: ONEDRIVE_SCOPES,
    });
    return result.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      await pca.acquireTokenRedirect({
        account: activeAccount,
        scopes: ONEDRIVE_SCOPES,
      });
      throw new Error("interaction-required: redirect initiated");
    }
    throw err;
  }
}
