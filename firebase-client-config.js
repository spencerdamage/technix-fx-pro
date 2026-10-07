window.technixFirebaseConfig = {
  apiKey: "AIzaSyBE9wns9ix9QRvRoM5fdFkK72yPlu7Wa0g",
  authDomain: "technix-pro-fx.firebaseapp.com",
  projectId: "technix-pro-fx",
  appId: "1:996611133323:web:058da9b376eaf40ed9a98e",
  messagingSenderId: "996611133323"
};

window.technixFirebaseConfigured = Object.values(window.technixFirebaseConfig)
  .every((value) => !value.startsWith("REPLACE_WITH_"));
