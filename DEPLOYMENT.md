# Deployment recommendations

AutoVault is a React/Vite application using Firebase authentication and Cloud Storage, with AI capabilities.

## Recommended architecture

- Host the static frontend on **Firebase Hosting** or **Cloudflare Pages**.
- Keep Firebase configuration in the appropriate deployment environment.
- Put any Gemini or privileged Express API on **Google Cloud Run** (recommended), **Render**, **Railway**, or **Fly.io**.

Do not expose a privileged Gemini key in `VITE_*` client variables. Use Firebase Security Rules, authenticated access, upload limits and a documented retention policy for files.
