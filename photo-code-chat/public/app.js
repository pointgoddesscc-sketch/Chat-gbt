import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-functions.js";

const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

const $ = (id) => document.getElementById(id);
const status = $("status");
let capturedImage = parseCapturedImageFromUrl();

if (capturedImage) {
  $("capturedNotice").hidden = false;
}

function requireVerifiedUser() {
  const user = auth.currentUser;
  if (!user) throw new Error("Login first.");
  if (!user.emailVerified) throw new Error("Verify your email first.");
  return user;
}

$("signup").onclick = async () => {
  try {
    const cred = await createUserWithEmailAndPassword(auth, $("email").value, $("password").value);
    await sendEmailVerification(cred.user);
    status.textContent = "Account created. Verification email sent.";
  } catch (err) {
    status.textContent = err.message;
  }
};

$("login").onclick = async () => {
  try {
    await signInWithEmailAndPassword(auth, $("email").value, $("password").value);
  } catch (err) {
    status.textContent = err.message;
  }
};

$("verify").onclick = async () => {
  try {
    if (!auth.currentUser) throw new Error("Login first.");
    await sendEmailVerification(auth.currentUser);
    status.textContent = "Verification email sent.";
  } catch (err) {
    status.textContent = err.message;
  }
};

$("logout").onclick = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
  status.textContent = user
    ? `Logged in as ${user.email}. Verified: ${user.emailVerified}`
    : "Logged out.";
});

$("chatForm").onsubmit = async (event) => {
  event.preventDefault();

  try {
    const user = requireVerifiedUser();
    const text = $("messageInput").value.trim();
    if (!text) return;

    await addDoc(collection(db, "messages"), {
      text,
      uid: user.uid,
      email: user.email,
      createdAt: serverTimestamp()
    });

    $("messageInput").value = "";
  } catch (err) {
    status.textContent = err.message;
  }
};

const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));

onSnapshot(q, (snapshot) => {
  $("messages").innerHTML = "";
  snapshot.forEach((doc) => {
    const data = doc.data();
    const item = document.createElement("div");
    const email = document.createElement("strong");
    const lineBreak = document.createElement("br");
    const text = document.createTextNode(data.text || "");

    item.className = "msg";
    email.textContent = data.email || "Unknown user";
    item.append(email, lineBreak, text);
    $("messages").appendChild(item);
  });
});

$("photo").onchange = () => {
  capturedImage = null;
  $("capturedNotice").hidden = true;
};

$("convert").onclick = async () => {
  try {
    requireVerifiedUser();

    const file = $("photo").files[0];
    const image = file ? await fileToImagePayload(file) : capturedImage;
    if (!image) throw new Error("Choose a photo first.");

    const convertPhotoToCode = httpsCallable(functions, "convertPhotoToCode");
    const result = await convertPhotoToCode(image);

    $("codeOutput").textContent = result.data.code;
  } catch (err) {
    $("codeOutput").textContent = err.message;
  }
};

async function fileToImagePayload(file) {
  return {
    imageBase64: await fileToBase64(file),
    mimeType: file.type
  };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.readAsDataURL(file);
  });
}

function parseCapturedImageFromUrl() {
  const captured = new URLSearchParams(window.location.search).get("captured");
  if (!captured) return null;

  const match = captured.match(/^data:(image\/[-+.\w]+);base64,(.+)$/);
  if (!match) return null;

  return {
    mimeType: match[1],
    imageBase64: match[2]
  };
}
