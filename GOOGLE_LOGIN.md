# Google login on web

## Fix HTTP 403: origin is not allowed

Open Google Cloud Console → Google Auth Platform → Clients, and select the
**Web application** client matching `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
Under **Authorized JavaScript origins**, add the exact frontend origin from
the browser address bar (scheme + hostname + port, without a page path).
For the current local start commands, register:

```text
http://localhost
http://localhost:8081
http://localhost:8083
```

Open the web app using localhost. `localhost` and `127.0.0.1` are different
origins; if using 127.0.0.1, register that exact origin and port too.
Save the client configuration and reload the page after it propagates.
The app cannot bypass Google's origin allowlist. Changing backend CORS does
not fix this Google-hosted 403.

To see the exact current origin, run `window.location.origin` in DevTools.
Keep using `npx expo start --clear` from `mobile` and press W for web.

Paste the **same Web application OAuth Client ID** into both files:

```env
# mobile/.env.local
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-client-id.apps.googleusercontent.com

# backend/.env
GOOGLE_WEB_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

No Client Secret is required. Restart the backend (`node server.js` from backend)
and the frontend (`npm run web -- --clear` from mobile) after changing these values.

Open the frontend using localhost. In Google Cloud, add its exact origin
(for example `http://localhost:8081`) to Authorized JavaScript origins.
The popup callback flow does not require Authorized redirect URIs.
For deployment, use HTTPS and register the deployed frontend origin.

The web button loads Google Identity Services and posts the ID token to
`POST /api/auth/google`. The backend verifies signature, audience and expiry using
google-auth-library, requires a verified email, and identifies accounts by `google_id`.
New accounts are created with a null phone/password. Existing emails are never
automatically linked. Web and native iOS Google login are supported; Android is not included.

Database requirements: users must have nullable email, phone, password_hash and
avatar_url columns, and a nullable google_id column with a UNIQUE index.
The connected development database already has these columns and indexes.

This integration uses the application's existing saveAuthUser login flow.
The existing APIs still need server-side session/token authorization before
production use; a locally stored user_id is not proof of authentication.

Verify with a configured Client ID: choose a Google account, confirm a user is
created once, log out and sign in again, and check that the user_id is unchanged.
Canceling the popup should leave the password login usable. A conflicting email
should show an error instead of linking accounts.

## iPhone app

In mobile/.env.local, keep EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and add:

```env
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com
IOS_BUNDLE_IDENTIFIER=com.yourcompany.smartkitchenai
```

Use the exact Bundle ID from your Google Cloud **iOS** OAuth client. Both OAuth
clients should belong to the same Google Cloud project. Do not replace the Web
Client ID in backend/.env with the iOS Client ID: the native SDK is configured
with webClientId to obtain an ID token for the existing backend audience.

app.config.js automatically derives the reversed iOS URL scheme and registers
the Google Sign-In config plugin. Changing the iOS Client ID or Bundle ID requires
a new native build. No Google Client Secret or Firebase project is needed.

The native Google SDK runs in a development build:

```powershell
cd C:\DACN2-main\smart-kitchen-ai\mobile
npx eas-cli@latest build --platform ios --profile development
npx expo start --dev-client --lan
```

Configure these variables in the EAS development build environment too:
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
IOS_BUNDLE_IDENTIFIER and EXPO_PUBLIC_API_URL. Local .env.local may be ignored
when uploading the project to EAS. Physical iPhone internal distribution requires
Apple signing/provisioning and device registration. Install the resulting build
on the registered iPhone and connect it to Metro. On Windows, build iOS using
EAS cloud builds rather than local Xcode.

Use a backend URL reachable from the iPhone (LAN IP on the same Wi-Fi for local
development, HTTPS URL for deployment). localhost on the phone means the phone.
Safari on iPhone uses the existing **web** Google login, not the native iOS SDK.

Manual verification: cancel Google sign-in and retry, log in with the same
Google account used on web, verify that the user_id is unchanged, restart the
app and verify remember-me behavior. Actual iOS sign-in must be tested on a build
with real OAuth IDs and a registered Bundle ID.

## Expo Go on iPhone

Expo Go opens a backend-hosted Google Identity Services page in the system
browser. After Google confirms the account, tap **Done / Xong** to return to the
app. The app exchanges a private session secret for the verified ID token and
passes it through the existing Google login endpoint and remember-me flow.

Expose the same backend process through an HTTPS domain or HTTPS tunnel. Set
its origin in `backend/.env` using the following variable.

```env
GOOGLE_EXPO_WEB_ORIGIN=https://your-backend.example.com
```

In Google Cloud, open the Web application OAuth client matching
`GOOGLE_WEB_CLIENT_ID` and add `https://your-backend.example.com` to
**Authorized JavaScript origins**. Keep the existing localhost origin for web
development. The browser page uses the popup callback flow. Its full URL is
generated by the backend when the app starts a Google login session.

Restart the backend after setting the origin. `EXPO_PUBLIC_API_URL` must reach
that same backend process from the iPhone. A Metro tunnel serves the mobile
bundle separately from the backend HTTPS origin.

Login sessions expire after five minutes and can be consumed once. They are
kept in memory for this single-process development backend. Restarting the
backend invalidates pending logins. Multiple backend workers require a shared
session store before this flow can be deployed across them.

Verify on iPhone by choosing a Google account, waiting for the confirmation
message, tapping Done, and checking that the app opens Home. Also close the
browser before choosing an account, then retry. A Google account already used
on web should retain the same user ID.
