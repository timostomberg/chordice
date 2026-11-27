# Chordice
A chord progression generator for practice.

https://timostomberg.github.io/chordice

## Account (optional)

Saved songs are kept in the browser. To let people sign in with Google and keep their songs in their account, connect a
Firebase project:

1. Create a project in the [Firebase console](https://console.firebase.google.com/) (the free Spark plan is enough).
2. **Authentication** > Sign-in method: enable **Google** (and no other provider). Under Settings > Authorized domains, add the domain the page is
   served from (e.g. `timostomberg.github.io`).
3. **Firestore Database**: create a database in an EU location (`europe-west3`, Frankfurt; it cannot be changed later),
   then publish the rules from [firestore.rules](firestore.rules) under Rules.
4. Project settings > Your apps: add a web app and copy its config object into `FIREBASE_CONFIG` in
   [chordice/app/account.js](chordice/app/account.js). These values are not secret; the rules guard the data.

The [imprint](chordice/app/help/imprint.html) names the operator, their city and their email address. The [privacy policy](chordice/app/help/privacy.html) names the controller with a name
and an email address.
The privacy policy assumes the Firestore location `europe-west3`.

## Tests

`npm test` runs every test. The part of [tests/firestore.rules.test.js](tests/firestore.rules.test.js) that runs the rules
in the Firestore emulator is skipped there; `npm run test:rules` starts the emulator and runs it. It needs Java (JDK 21 or
newer, e.g. [Temurin](https://adoptium.net/)) and these dev dependencies:

```sh
npm install --save-dev firebase-tools @firebase/rules-unit-testing firebase
```

The emulator runs the demo project `demo-chordice` (see [firebase.json](firebase.json)), so it never touches the real
Firebase project.
