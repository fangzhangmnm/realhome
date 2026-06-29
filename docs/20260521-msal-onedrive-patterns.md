# MSAL + OneDrive Graph patterns

Reusable patterns for "PWA reads from a user's OneDrive AppFolder" — the
shape RealHome shares with its sibling project (JustReadPapers, the
same-user multi-app strategy). If you build a third app on this stack, these
are the non-obvious things that took iteration to get right.

## 1. AppFolder scope, not full Files access

```js
scopes: ["Files.ReadWrite.AppFolder", "offline_access"]
```

`Files.ReadWrite.AppFolder` grants access to **only** a per-app sandbox at
`/me/drive/special/approot` — auto-provisioned under `OneDrive/Apps/<App>/`
on first read. The app cannot see, list, or touch any other file in the
user's OneDrive. Lower friction during the consent dialog ("RealHome wants
to access *its own folder*") and minimizes blast radius if the access token
is ever leaked.

For an app that genuinely needs the user's full drive: use `Files.ReadWrite`
or `Files.ReadWrite.All`. But default to AppFolder until you actually need
more.

## 2. `offline_access` for persistent sign-in

Without `offline_access`, MSAL only gets an access token (1-hour lifetime).
After expiry, `acquireTokenSilent` fails and you have to interactively
re-auth. With it, MSAL gets a refresh token — silent re-acquisition works
indefinitely until the user revokes consent.

For PWAs on Quest / mobile where the user expects "sign in once, stay in"
behavior, this is mandatory.

## 3. Redirect-only auth on Quest

```js
await pca.loginRedirect({ scopes: ONEDRIVE_SCOPES });
```

Meta Quest's browser does not support `window.open` popups. `loginPopup`
silently fails. Use `loginRedirect` / `acquireTokenRedirect` everywhere — same
code path works on desktop too. The cost is a full page reload during
sign-in; the menu rebuilds from IDB on return so no user state is lost.

`navigateToLoginRequestUrl: true` in MSAL config = return to the same URL
that initiated the redirect, not to `redirectUri`. Better when the app has
a multi-page route structure (single SPA: doesn't matter).

## 4. `handleRedirectPromise()` MUST run on every page load

```js
const pca = new PublicClientApplication({ ... });
await pca.initialize();
await pca.handleRedirectPromise();   // even when NOT returning from a redirect
```

MSAL stashes interactive-flow state in sessionStorage. If a previous tab
crashed mid-redirect, the next page load needs to drain that state or
subsequent `acquireTokenSilent` calls will misbehave. Call it
unconditionally at boot.

## 5. Silent token probe — REQUIRED, but background-only

The sibling project does an `acquireTokenSilent` at boot, right after
`handleRedirectPromise`. RealHome initially tried to skip this for offline
resilience — that was wrong. Here's why the probe is non-negotiable, AND
how to keep it from blocking the offline path.

### The cross-app cache leak

`cacheLocation: "localStorage"` shares MSAL's account cache across every
app on the same origin (or any localhost dev origin you use for multiple
projects). So `pca.getAllAccounts()` can return an account the user has
consented to for some OTHER app's clientId (sibling project, last week's
test app) but NOT for the current app's clientId.

Concrete failure mode: user signs in to JustReadPapers (`8b5063a4-…`).
Loads RealHome (`c987add3-…`) on the same `localhost:5173`. RealHome calls
`getAllAccounts()` → returns `alice@outlook.com`. Optimistic-trust code
shows "Signed in: alice@outlook.com". User taps a OneDrive world.
`acquireTokenSilent` fires for RealHome's clientId — no refresh token
exists → falls back to hidden-iframe SSO renewal → iframe times out (6s,
modern Chrome blocks third-party cookies in iframes) → red error in the
UI. Worse: the UI was lying for the whole window before that.

The probe — `acquireTokenSilent` against the app's specific scopes,
right after init — is the only reliable signal that *this clientId* has
consent. If it throws, the cached account isn't ours; UI must not claim
"Signed in."

### Why it has to be background-only

The probe is expensive when it fails:

- **Iframe-based fallback**: when local cache doesn't satisfy, MSAL opens a
  hidden iframe to `login.microsoftonline.com?prompt=none`. Modern Chrome
  blocks third-party cookies in iframes by default → iframe lands on
  `chrome-error://chromewebdata/`. MSAL waits up to `windowHashTimeout`
  (6000ms default) before throwing `monitor_window_timeout`.
- **Network-dependent**: fails offline.
- **Visible console pollution**: `Unsafe attempt to load URL X from frame
  with URL chrome-error://chromewebdata/` and an iframe-sandbox warning,
  both browser-emitted, not suppressible from JS.

Block your boot path on this and the user stares at an empty menu for 6
seconds on every cross-app or offline load.

### RealHome's actual pattern

```js
// Boot path (src/app.js)
async function bootstrap() {
  // 1. Synchronously show OneDrive bar in "Not signed in" default state.
  if (isOneDriveConfigured()) showSignInDefault();
  // 2. Render cached worlds from IDB. No MSAL involvement.
  await renderWorldsList();
  // 3. Kick off MSAL init in the BACKGROUND. Never awaited from boot.
  if (isOneDriveConfigured()) {
    (async () => {
      try {
        const { getPCA } = await import("./onedriveAuth.js");
        await getPCA();                  // includes the silent probe
        await refreshOneDriveStatus();   // swap to "Signed in: …" iff probe succeeded
        await renderWorldsList();        // OneDrive entries appear iff signed in
      } catch (err) {
        console.warn("OneDrive boot failed:", err);
      }
    })();
  }
}
```

```js
// src/onedriveAuth.js — probe inside getPCA, after handleRedirectPromise
const cached = pca.getAllAccounts();
if (cached.length > 0) {
  try {
    await pca.acquireTokenSilent({ scopes: ONEDRIVE_SCOPES, account: cached[0] });
    pca.setActiveAccount(cached[0]);
    activeAccount = cached[0];
  } catch (err) {
    // InteractionRequiredAuthError / monitor_window_timeout / network errors
    // all mean "we can't silently confirm sign-in for THIS clientId."
    // activeAccount stays null. UI stays "Not signed in". No errorLog noise.
    console.warn("MSAL silent probe failed:", err.errorCode || err.message);
  }
}
```

The user-visible UX:
- Cold boot, signed in to RealHome: bar shows "Not signed in" for
  ~200ms, then swaps to "Signed in: alice@…" once probe completes (fast
  via cached refresh token).
- Cold boot, only signed in to a sibling: bar stays "Not signed in" for
  ~6s while iframe times out, then no change. Console has scary iframe
  messages; user-visible UI never lies.
- Cold boot, offline: bar stays "Not signed in" forever (until network).
  Bundled + cached worlds load from IDB unaffected.

Trade-off accepted: console noise during the probe's iframe attempt is
unavoidable. That's a browser-emitted message about the iframe's
cross-origin nav attempt — JS can't suppress it. The errorLog (user-facing)
stays clean.

### One thing to watch

If you ever change provider list() to call `getToken()` even when
`activeAccount` is null (e.g., "try to silent-acquire from scratch on every
list()"), you'll re-introduce the iframe failure during `renderWorldsList`,
which DOES surface via the per-provider errorLog. The contract is:
`provider.list()` MUST short-circuit to `[]` when `getAccount()` returns
null — never attempt Graph calls without a confirmed account.

## 6. Sign-out: `clearCache`, NOT `logoutRedirect`

```js
await pca.clearCache({ account });
pca.setActiveAccount(null);
```

`logoutRedirect` calls Microsoft's `/logout` endpoint — which signs the user
out of *every* Microsoft property in their browser (Outlook, Teams, OneDrive
Web, anywhere else they're authenticated). Hostile UX: "I clicked sign out
in this little app, why am I now logged out of my email?"

`clearCache` only drops this app's tokens from MSAL's local storage. The
user can still revoke consent globally at
`https://account.live.com/consent/Manage` if they truly want a hard reset.

## 7. `@microsoft.graph.downloadUrl` for binary fetches

```js
const meta = await graphFetch(
  `/me/drive/items/${itemId}?$select=id,size,eTag,@microsoft.graph.downloadUrl`
);
const r = await fetch(meta.downloadUrl);   // plain unauthenticated fetch
const blob = await r.blob();
```

`/me/drive/items/{id}/content` works but auto-302s to a CDN URL. The browser
strips `Authorization` across cross-origin redirects, so the CDN serves
unauthenticated anyway — same outcome. The difference: `downloadUrl` is a
pre-signed short-lived URL we can use directly, skipping the round-trip
through Graph.

`@microsoft.graph.downloadUrl` is a **computed property** — must be opted
into via `$select` (it's not in the default response). Easy gotcha.

Fallback to `/content` for the rare case where org policy strips
`downloadUrl` from responses.

## 8. `$select` everything, `$top` for pagination

```js
?$select=id,name,size,eTag,file&$top=200
```

Default Graph responses are huge. Always `$select` to the fields you need —
~10× smaller payloads, faster on cold network. Then loop on `@odata.nextLink`
for pagination:

```js
let url = `${APP_ROOT}/children?$select=...&$top=200`;
while (url) {
  const r = await graphFetch(url);
  const body = await r.json();
  items.push(...body.value);
  url = body["@odata.nextLink"] || null;
}
```

`$top=200` is the AppFolder max. For a "max 5 worlds" use case, pagination
is paranoia — but it's two extra lines.

## 9. `cacheLocation: "localStorage"` for survive-tab-close

```js
cache: { cacheLocation: "localStorage", storeAuthStateInCookie: false }
```

Default is `sessionStorage` which clears on tab close — forces fresh sign-in
on every PWA cold-boot. `localStorage` persists. Cookie storage is a
fallback for IE11; modern apps can ignore it.

For multi-tab safety, MSAL serializes writes through a mutex so two tabs
won't corrupt the cache. We don't need to do anything special.

## 10. Lazy-import the MSAL bundle

```js
let modPromise = null;
function getMod() {
  if (!modPromise) modPromise = (async () => ({
    auth: await import("./onedriveAuth.js"),
    graph: await import("./onedriveGraph.js"),
  }))();
  return modPromise;
}
```

The MSAL bundle is ~660KB (gzipped ~150KB but still notable). Cold-boot a
PWA without it; only pull when the user actually clicks sign-in. Provider
abstraction makes this easy: the OneDrive provider's `list()` early-returns
`[]` when not signed in, so no MSAL load happens until the user takes
action.

## 11. SPA platform type in Azure portal

In the Azure App Registration → Authentication → Platform configurations:
**must be "Single-page application"**, not "Web". SPA uses PKCE flow
(public client, no client secret), which is what MSAL.js implements. "Web"
expects a confidential client with secrets — wrong for a static PWA.

Common failure: register as Web, get cryptic "AADSTS9002326: Cross-origin
token redemption is permitted only for the 'Single-Page Application' client
type" errors that don't obviously point to the platform type.

## 12. MSAL must never gate the offline-first path

Core invariant for any PWA that uses OneDrive as a sync layer (not a primary
store): **the app stays useful when Microsoft is down, when the user is
offline, when third-party cookies are blocked, when the access token
expired.**

Concretely in RealHome:

| Action | Network? | MSAL? | Works? |
|---|---|---|---|
| Open menu | offline | unavailable | ✓ (cached worlds appear from IDB) |
| Open bundled "default" world | offline | unavailable | ✓ (same-origin asset) |
| Open cached OneDrive world | offline | unavailable | ✓ (blob in IDB, no Graph call) |
| Open uncached OneDrive world | offline | unavailable | ✗ (need bytes; error visible) |
| Sign in | online | needed | ✓ |
| Refresh OneDrive list | online | needed | ✓ |

Achieved by three design rules:

1. **Lazy import the MSAL bundle.** First time someone clicks sign-in (or
   the OneDrive provider's `list()` runs). Cold-boot offline = no MSAL load
   = no failure surface.

2. **Boot path never awaits MSAL.** The bootstrap sequence:
   ```
   show cached worlds from IDB
     → show OneDrive bar (default "Not signed in", button visible)
       → in background, init MSAL + refresh status + re-render worlds
   ```
   MSAL init failure leaves the bar in its default state, no error banner.

3. **Graph failure ⇒ fall back to IDB-only listing.** Lifted from the
   sibling's `loadFolderItems()` at
   `../20260518 JustReadPapers/src/app.js:259-273`: if `listChildren()`
   throws, the sibling maps from `cache.listMeta()` to synthesize a list of
   "what we have locally", tagged `_offlineStub: true`.

   RealHome gets this for free from the worlds-list sequencer: cached
   worlds (including `source: "onedrive"`) are painted from IDB FIRST,
   independent of any provider. The provider layer only ADDS uncached
   entries; its failure is invisible to the user beyond the absence of
   not-yet-downloaded options.

The mistake to avoid: blocking a worlds-list render on Graph. If the menu
ever waits for `listChildren()` to resolve, the user sees a stalled UI on
flaky networks. Instead, paint local-first, append remote.

## 13. Redirect URI must EXACTLY match (no trailing-slash games)

Register both `https://yourdomain.example/app/` and
`http://localhost:8000/` (or whatever dev port). Mismatch → MSAL throws
`AADSTS50011` before even hitting the consent screen.

When building `redirectUri` in code: `location.origin + location.pathname`
— don't add or strip a trailing slash. Just use exactly what the user's
browser shows in the URL bar.

## Files in RealHome

- [src/onedriveAuth.js](../src/onedriveAuth.js) — PCA singleton + sign in/out + token
- [src/onedriveGraph.js](../src/onedriveGraph.js) — listChildren + fetchItem
- [src/providers.js](../src/providers.js) — `createOneDriveProvider()` wrapping the above
- [src/config.js](../src/config.js) — `ONEDRIVE_CLIENT_ID`, scopes, redirect builder
- [docs/20260521-onedrive-setup.md](20260521-onedrive-setup.md) — Azure App Registration step-by-step

## Sibling reference

- `../20260518 JustReadPapers/src/auth.js` — same MSAL setup, PDF reader use case
- `../20260518 JustReadPapers/src/graph.js` — broader Graph surface (uploads,
  rename, ensure-subfolder); read this when you need to add write-back to
  OneDrive from RealHome.
