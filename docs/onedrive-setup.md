# OneDrive setup (Azure App Registration)

To enable OneDrive sync in RealHome, register a Microsoft Entra (Azure AD)
application. This is free, takes ~5 minutes, and uses a personal Microsoft
account.

The CLIENT_ID currently in [src/config.js](../src/config.js) is the one for
the official RealHome deployment at `fangzhangmnm.github.io/realhome/`. If
you're forking, register your own — Azure redirect URIs are strictly
matched, so you can't reuse mine.

## Steps

1. Go to <https://entra.microsoft.com> → **Applications → App registrations**
   → **New registration**.

2. **Name:** anything, e.g. `RealHome`.

3. **Supported account types:**
   `Personal Microsoft accounts only`
   *or*
   `Accounts in any organizational directory + personal Microsoft accounts`
   The latter is what RealHome uses ("All Microsoft account users").

4. **Redirect URI:** leave blank for now — we'll add SPA URIs in the next
   step. (The dropdown only offers Web here, which is the wrong platform.)

5. Click **Register**. Copy the **Application (client) ID** — this is what
   goes into `src/config.js` as `ONEDRIVE_CLIENT_ID`.

6. In the new app's left nav: **Manage → Authentication** → **Add a
   platform** → **Single-page application**.

   - Add redirect URI: `https://yourname.github.io/realhome/` (the exact
     URL you deploy to — trailing slash matters)
   - Add another: `http://localhost:8000/` (or whatever port you use for
     `python -m http.server` during dev)
   - **Implicit grant:** leave BOTH checkboxes UNCHECKED. MSAL.js v3 uses
     PKCE authorization code flow, not implicit. Enabling implicit grants
     weakens security and is unnecessary.

   Click **Configure** / **Save**.

7. **Manage → API permissions** → **Add a permission** → **Microsoft Graph
   → Delegated permissions** → check:
   - `Files.ReadWrite.AppFolder`
   - `offline_access`

   Click **Add permissions**. Admin consent is **not** required for these
   user-scoped delegated permissions.

8. **Manage → Manifest** (optional, for paranoia): verify
   ```json
   "allowPublicClient": false,
   "signInAudience": "AzureADandPersonalMicrosoftAccount"
   ```

That's it. Paste the client ID into `src/config.js`:

```js
export const ONEDRIVE_CLIENT_ID = "your-guid-here";
```

Commit, push, and the sign-in button appears in the menu on next load.

## Verifying the consent dialog

On first sign-in the user sees:

> RealHome wants to:
>   ✓ Have full access to its own folder
>   ✓ Maintain access to data you have given it access to
>   ✓ View your basic profile
>
> [Accept] [Cancel]

If you see a scarier dialog mentioning the user's **entire** OneDrive,
you accidentally added `Files.ReadWrite` (not `.AppFolder`). Go remove it
in API permissions.

## The AppFolder sandbox

After first authenticated read, OneDrive automatically creates:

```
OneDrive/
  Apps/
    RealHome/         ← only thing the app can see
      world1.glb
      world2.glb
```

The user drops `.glb` files into `Apps/RealHome/`. They appear in the
menu's worlds list on next refresh (↻ button) or next page load.

The app cannot list, read, or write **anything outside this folder**, even
if it tried — Microsoft Graph enforces the scope server-side. No way to
escape via path traversal.

## Common errors

| Error | Cause |
|---|---|
| `AADSTS9002326: Cross-origin token redemption is permitted only for the 'Single-Page Application' client type` | Registered as Web platform instead of SPA. Re-register the platform in step 6. |
| `AADSTS50011: The reply URL specified in the request does not match` | Redirect URI mismatch. The URL in your browser address bar must EXACTLY match one of the registered SPA redirect URIs, including the trailing slash. |
| Sign-in works but Graph calls return 401 | Permission scopes mismatch. Verify both `Files.ReadWrite.AppFolder` AND `offline_access` are added in API permissions, and re-consent (sign out + sign in again) so the new scopes apply. |
| `interaction-required: redirect initiated` (then page reloads) | Normal. The refresh token expired (rare — only happens after 90 days of inactivity, or if user revoked consent). |

## Revoking access (user-side)

The user can revoke our app's access at any time:
<https://account.live.com/consent/Manage>

On revoke, next `acquireTokenSilent` throws `InteractionRequiredAuthError`
and the app re-prompts for sign-in.

## See also

- [docs/msal-onedrive-patterns.md](msal-onedrive-patterns.md) — the
  patterns and gotchas that informed the auth/graph code design.
