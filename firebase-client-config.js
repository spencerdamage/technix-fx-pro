window.technixFirebaseConfig = {
  apiKey: "REPLACE_WITH_FIREBASE_WEB_API_KEY",
  authDomain: "REPLACE_WITH_PROJECT_ID.firebaseapp.com",
  projectId: "REPLACE_WITH_PROJECT_ID",
  appId: "REPLACE_WITH_FIREBASE_WEB_APP_ID"
};

window.technixFirebaseConfigured = Object.values(window.technixFirebaseConfig)
  .every((value) => !value.startsWith("REPLACE_WITH_"));
