const $ = (selector) => document.querySelector(selector);
const dialog = $("#auth-dialog");
const authButton = $("#auth-button");
const signOutButton = $("#signout-button");
const authStatus = $("#auth-status");
const sendCodeButton = $("#send-code");
const verifyCodeButton = $("#verify-code");
const firebaseConfig = window.technixFirebaseConfig;
const firebaseConfigured = window.technixFirebaseConfigured;
let auth;
let functions;
let firestore;
let confirmation;
let verifier;
let currentUser;
let stopWatchingPayment;
let RecaptchaVerifier;
let signInWithPhoneNumber;
let signOut;
let onAuthStateChanged;
let doc;
let onSnapshot;
let httpsCallable;

function notify(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.classList.remove("show"), 4500);
}

function showAuthDialog() {
  if (!firebaseConfigured) {
    notify("Firebase is not configured. Follow FIREBASE_SETUP.md before enabling sign-in.");
    return;
  }
  $("#auth-phone").value = "";
  $("#auth-code").value = "";
  $("#auth-code-field").hidden = true;
  sendCodeButton.hidden = false;
  verifyCodeButton.hidden = true;
  authStatus.textContent = "";
  dialog.showModal();
}

async function sendVerificationCode() {
  const phone = $("#auth-phone").value.trim();
  if (!/^\+254[17]\d{8}$/.test(phone)) {
    authStatus.textContent = "Enter a Kenyan mobile number in +2547XXXXXXXX or +2541XXXXXXXX format.";
    return;
  }
  sendCodeButton.disabled = true;
  try {
    verifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
    confirmation = await signInWithPhoneNumber(auth, phone, verifier);
    $("#auth-code-field").hidden = false;
    $("#auth-code").focus();
    sendCodeButton.hidden = true;
    verifyCodeButton.hidden = false;
    authStatus.textContent = "Code sent. Enter the SMS verification code to continue.";
  } catch (error) {
    verifier?.clear();
    verifier = undefined;
    authStatus.textContent = error.message || "Could not send the verification code.";
  } finally {
    sendCodeButton.disabled = false;
  }
}

async function verifyCode() {
  const code = $("#auth-code").value.trim();
  if (!/^\d{6}$/.test(code) || !confirmation) {
    authStatus.textContent = "Enter the six-digit code sent to your phone.";
    return;
  }
  verifyCodeButton.disabled = true;
  try {
    await confirmation.confirm(code);
    confirmation = undefined;
    verifier?.clear();
    verifier = undefined;
    dialog.close();
    notify("Phone verified. You can request an M-Pesa prompt when payments are enabled.");
  } catch (error) {
    authStatus.textContent = error.message || "The verification code could not be confirmed.";
  } finally {
    verifyCodeButton.disabled = false;
  }
}

async function requestMpesaPrompt() {
  if (!firebaseConfigured) {
    notify("Firebase is not configured. No payment was initiated.");
    return;
  }
  if (!currentUser) {
    showAuthDialog();
    return;
  }
  const amount = Number($("#deposit-amount").value);
  if ($("#deposit-currency").value !== "KSH" || $("#deposit-method").value !== "M-Pesa · STK Push") {
    notify("Real prompts are only supported for KSH M-Pesa payments.");
    return;
  }
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 150000) {
    notify("Enter a whole KSH amount between 1 and 150,000.");
    return;
  }

  const button = $("#deposit-button");
  button.disabled = true;
  try {
    const requestId = crypto.randomUUID();
    const startPayment = httpsCallable(functions, "initiateMpesaStkPush");
    const result = await startPayment({ amount, requestId });
    const paymentRef = doc(firestore, "payments", requestId);
    stopWatchingPayment?.();
    stopWatchingPayment = onSnapshot(paymentRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const status = snapshot.data().status;
      if (status === "pending") {
        notify(result.data.customerMessage || "Check your phone to confirm the M-Pesa prompt.");
      } else if (status === "completed") {
        stopWatchingPayment?.();
        notify("M-Pesa confirmed payment. Deposit credit is not enabled in this scaffold.");
      } else if (status === "failed" || status === "review") {
        stopWatchingPayment?.();
        notify(status === "review"
          ? "Payment needs manual review. Do not retry until the payment is reconciled."
          : "M-Pesa did not confirm payment. Check your transaction history before retrying.");
      }
    }, (error) => {
      stopWatchingPayment?.();
      notify(error.message || "Could not read payment status.");
    });
  } catch (error) {
    notify(error.message || "The M-Pesa prompt could not be started.");
  } finally {
    button.disabled = false;
  }
}

authButton.addEventListener("click", showAuthDialog);
$("#auth-close").addEventListener("click", () => dialog.close());
sendCodeButton.addEventListener("click", sendVerificationCode);
verifyCodeButton.addEventListener("click", verifyCode);
$("#deposit-button").addEventListener("click", requestMpesaPrompt);
signOutButton.addEventListener("click", async () => {
  if (!auth) return;
  try {
    await signOut(auth);
  } catch (error) {
    notify(error.message || "Could not sign out.");
  }
});

async function initializeFirebase() {
  if (!firebaseConfigured) {
    authButton.hidden = false;
    authStatus.textContent = "Firebase setup required.";
    return;
  }

  const [
    { initializeApp },
    authSdk,
    firestoreSdk,
    functionsSdk
  ] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js"),
    import("https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js")
  ]);

  const app = initializeApp(firebaseConfig);
  ({ RecaptchaVerifier, signInWithPhoneNumber, signOut, onAuthStateChanged } = authSdk);
  ({ doc, onSnapshot } = firestoreSdk);
  ({ httpsCallable } = functionsSdk);
  auth = authSdk.getAuth(app);
  functions = functionsSdk.getFunctions(app);
  firestore = firestoreSdk.getFirestore(app);

  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    authSdk.connectAuthEmulator(auth, "http://127.0.0.1:9099");
    firestoreSdk.connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
    functionsSdk.connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  }

  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    authButton.hidden = Boolean(user);
    signOutButton.hidden = !user;
    authStatus.textContent = user ? `Signed in · ${user.phoneNumber}` : "Not signed in";
  });
}

initializeFirebase().catch((error) => {
  authButton.disabled = true;
  authStatus.textContent = "Firebase initialization failed. Check the configuration and browser console.";
  console.error("Firebase initialization failed", error);
});
