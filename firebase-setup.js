// firebase-setup.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global variables for Firebase (MUST BE USED)
export const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
export const firebaseConfig = {

          apiKey: "AIzaSyDnN-0llXDCh1ihfZMK7VKGwnOHydIxfGY",

          authDomain: "personal-assistant-831e4.firebaseapp.com",

          projectId: "personal-assistant-831e4",

          storageBucket: "personal-assistant-831e4.firebasestorage.app",

          messagingSenderId: "843295495665",

          appId: "1:843295495665:web:adbecd2864441b196de050",

          measurementId: "G-Q9H76MR2Y9"

        };
        
export const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

export let app;
export let db;
export let auth;
export let userId;
export let currentUser; // Store current user object

// Callback to be set by app.js for re-rendering
let renderAppCallback = () => console.warn("renderAppCallback not set in firebase-setup.js");
let fetchEventsCallback = () => console.warn("fetchEventsCallback not set in firebase-setup.js");
let fetchTasksCallback = () => console.warn("fetchTasksCallback not set in firebase-setup.js");

export const setRenderCallbacks = (renderAppFn, fetchEventsFn, fetchTasksFn) => {
    renderAppCallback = renderAppFn;
    fetchEventsCallback = fetchEventsFn;
    fetchTasksCallback = fetchTasksFn;
};

export const initializeFirebase = async () => {
    if (!app) {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUser = user;
                userId = user.uid;
                console.log("User signed in:", userId);
                // Fetch data after successful sign-in
                await fetchEventsCallback();
                await fetchTasksCallback();
                renderAppCallback(); // Re-render once data is fetched
            } else {
                console.log("No user signed in, attempting anonymous sign-in or custom token.");
                try {
                    if (initialAuthToken) {
                        await signInWithCustomToken(auth, initialAuthToken);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (error) {
                    console.error("Firebase Auth Error:", error);
                    // Fallback to a random userId if authentication fails
                    userId = crypto.randomUUID();
                    console.log("Using anonymous userId:", userId);
                    renderAppCallback(); // Render with anonymous user if auth fails
                }
            }
        });

        // Initial sign-in attempt
        if (initialAuthToken) {
            try {
                await signInWithCustomToken(auth, initialAuthToken);
            } catch (error) {
                console.error("Error signing in with custom token:", error);
                await signInAnonymously(auth); // Fallback to anonymous
            }
        } else {
            await signInAnonymously(auth);
        }
    }
};

// Exporting necessary Firebase functions directly
export { doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, addDoc, getDocs };
