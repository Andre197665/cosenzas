# Firebase Auth migration (draft)

This repository is a static HTML site. Firebase Auth user creation requires a trusted Admin SDK credential, which must stay on the owner's computer and must never be uploaded to GitHub.

## 1. Import the existing accounts

1. In Firebase Console, open project **cosenza-app** → Project settings → Service accounts → generate a private key.
2. Save the JSON file **outside this repository**. Do not send it in chat and do not commit it.
3. On a computer with Node.js installed, open a terminal in the repository folder and run:

   ```sh
   npm install firebase-admin
   ```

4. Set `GOOGLE_APPLICATION_CREDENTIALS` to the full local path of that JSON file, then run:

   ```sh
   node scripts/import-firebase-users.js
   ```

The script reads the existing `login_credentials.json`, uses each existing username and password to create a Firebase Auth account, and never prints passwords. Usernames map to a technical email like `dido@cosenza-app.firebaseapp.com`; people still type only their username in the app. Existing Firebase users are skipped and their passwords are not overwritten.

**Important:** passwords changed through the old account settings were saved only in that specific device's localStorage. They are not in `login_credentials.json` and cannot be imported by this script. The importer also uses the usernames and passwords currently in that JSON file.

## 2. Realtime Database rules for authenticated chat/presence

Only after the accounts are imported and login is tested, replace the current Realtime Database rules with:

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
- The login code expects the Firebase Auth accounts to exist first.
- The chat/presence code is being tied to authenticated Firebase UIDs.
- League data and other localStorage settings are **not yet migrated to Firestore**.
- Test on a separate branch and keep the current main branch as the working version until all tests pass.
