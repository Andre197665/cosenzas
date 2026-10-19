# Firebase Auth migration (draft)

This repository is a static HTML site. Firebase Auth account creation requires a trusted Admin SDK credential, which must stay on the owner's computer and must never be uploaded to GitHub.

## Important: protect the old password file

The previous public `login_credentials.json` contains passwords. Treat those passwords as exposed because the repository is public and Git history can retain earlier copies. The branch replaces that public file with `login_users.json`, which contains usernames and settings only. Removing the file from the latest version does not erase copies from Git history; rotate account passwords after the new login is tested.

Before switching to this branch, keep your existing `login_credentials.json` backup somewhere private. For the one-time importer, place a private copy in the repository root named `login_credentials.local.json`. That filename is ignored by Git and must never be committed. Do not send it in chat.

## 1. Import existing accounts

1. Keep the local `login_credentials.local.json` copy private and confirm it contains the usernames/passwords you intend to import.
2. In Firebase Console, open project **cosenza-app** → Project settings → Service accounts → generate a private key.
3. Save the service-account JSON outside this repository. Do not send it in chat and do not commit it.
4. On a computer with Node.js installed, open a terminal in the repository folder and run:

   ```sh
   npm install firebase-admin
   ```

5. Set `GOOGLE_APPLICATION_CREDENTIALS` to the full local path of that service-account JSON, then run:

   ```sh
   node scripts/import-firebase-users.js
   ```

The script reads `login_credentials.local.json`, uses each username/password to create a Firebase Auth account, and never prints passwords. Usernames map to a technical email like `dido@cosenza-app.firebaseapp.com`; people still type only their username in the app. Existing Firebase users are skipped and their passwords are not overwritten.

**Important:** passwords changed through the old account settings were saved only in that specific device's localStorage. They are not in the original JSON and cannot be imported by this script. The importer uses the credentials in the private local file.

## 2. Realtime Database rules for authenticated chat/presence

Only after accounts are imported and login is tested, replace the current Realtime Database rules with:

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "presence": {
      ".read": "auth != null",
      "$uid": {
        ".write": "auth != null && auth.uid === $uid"
      }
    },
    "chat": {
      "messages": {
        ".read": "auth != null",
        "$messageId": {
          ".write": "auth != null && newData.hasChildren(['uid', 'name', 'text', 'ts']) && newData.child('uid').val() === auth.uid && newData.child('text').isString() && newData.child('text').val().length <= 500"
        }
      }
    }
  }
}
```

These rules are for the chat/presence paths used by the current page. Do not publish them until the new login works; the site's current rules deny all access, so chat will remain unavailable until this step.

## Current limitations

- The HTML changes on this branch are **draft and not deployed**.
- Firebase Auth accounts must be provisioned using the importer before the new login can work.
- Realtime Database rules still deny access and must be updated in Firebase Console only after login testing.
- Password overrides previously stored only in individual devices' localStorage are not included in the original JSON and are not migrated.
- League tables, scores, matches, and other league data are still embedded in `index.html`; **they are not yet synchronized through Firestore/Realtime Database**.
- Test on a separate branch and keep `main` unchanged until end-to-end testing succeeds.
