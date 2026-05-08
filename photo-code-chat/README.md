# PhotoCode Chat

A Firebase app with verified-email chat, an OpenAI-powered photo-to-code converter, and a Chrome extension that captures the current tab and opens it in the converter.

## Files

- `public/` - Firebase Hosting web app.
- `functions/` - Callable Cloud Function that converts images to code.
- `extension/` - Manifest V3 Chrome extension popup.
- `firestore.rules` - Firestore rules for verified-user chat messages.
- `storage.rules` - Storage rules for verified-user image uploads.

## Setup

1. Replace the placeholder Firebase config in `public/app.js` with your project config.
2. Install Firebase tools and log in:
   ```sh
   firebase login
   ```
3. Initialize Firebase from this directory if you have not already:
   ```sh
   firebase init hosting firestore functions storage
   ```
4. Set your OpenAI API key secret:
   ```sh
   firebase functions:secrets:set OPENAI_API_KEY
   ```
5. Deploy:
   ```sh
   firebase deploy
   ```

## Chrome extension

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Load `extension/` as an unpacked extension.
4. Set the domain to your deployed Firebase Hosting URL.
