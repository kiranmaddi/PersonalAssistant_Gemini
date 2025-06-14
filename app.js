// app.js

// Core Imports from other modules
import { initializeFirebase, userId, setRenderCallbacks as setFirebaseRenderCallbacks, auth } from './firebase-setup.js';
import { fetchEvents, fetchTasks, getEvents, getTasks, saveEvent, deleteEvent, markEventOccurrenceDone, saveTask, deleteTask, markTaskOccurrenceDone, setDataCallbacks } from './data-service.js';
import { showToast, showConfirmModal, openEventFormModal, closeEventFormModal, openTaskFormModal, closeTaskFormModal, openImportExportModal, closeImportExportModal, renderEventFormModal, renderTaskFormModal, renderImportExportModal, renderEventItem, renderTaskItem, getEventFormModalState, getEditingEventState, getTaskFormModalState, getEditingTaskState, getImportExportModalState, setUICallbacks } from './ui-components.js';
import { getTodayDateString } from './utilities.js';
import { exportAllData, importAllData, exportEventsToCsv, exportTasksToCsv } from './import-export.js';
import { renderCalendarView, changeCalendarMonth, changeCalendarYear, handleDayClick, daysInMonth, firstDayOfMonth, generateOccurrencesForMonth } from './calendar-logic.js';
import { signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, setDoc, getDoc, collection, addDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// --- Application State ---
// These are the central state variables managed by app.js
let currentView = 'loading'; // 'loading', 'auth', 'landing', 'eventDetail', 'taskDetail'
let authScreen = 'login'; // 'login', 'register', 'forgotPassword'
let authInputEmail = '';
let authInputPassword = '';
let authInputConfirmPassword = '';
let authInputName = '';
let authInputPhone = '';
let authScreenError = '';
let authScreenMessage = '';
let showPasswordState = false;
let showConfirmPasswordState = false;

let events = []; // This will be updated by data-service callbacks
let tasks = [];  // This will be updated by data-service callbacks
let userProfile = { name: '', email: '', phone: '', photoURL: '' };
let currentUser = null; // Firebase User object from onAuthStateChanged

let currentCalendarDate = new Date(); // State for the calendar view
let currentTab = 'calendar'; // 'calendar' or 'list' within the landing page

let selectedEvent = null; // For event detail/edit forms
let selectedTask = null; // For task detail/edit forms

let showProfileModal = false; // Controls visibility of profile edit modal

// Modal states which are now controlled via getters from ui-components.js
// let showEventFormModal = false; // Directly managed by ui-components now
// let isEditingEvent = false;     // Directly managed by ui-components now
// let showTaskFormModal = false;  // Directly managed by ui-components now
// let isEditingTask = false;      // Directly managed by ui-components now
// let showImportExportModal = false; // Directly managed by ui-components now

// Internal flags for loading/error states in forms/details
let eventFormIsLoading = false;
let eventFormError = '';
let taskFormIsLoading = false;
let taskFormError = '';
let importExportLoading = false;
let importExportError = '';
let selectedFile = null; // For CSV import file
let eventDetailIsDeleting = false;
let taskDetailIsDeleting = false;
let dateForNewEntry = null; // Used when adding new event/task from calendar day click

// --- DOM Elements (References from index.html) ---
const appRoot = document.getElementById('app-root');
const eventFormModalContainer = document.getElementById('event-form-modal-container');
const taskFormModalContainer = document.getElementById('task-form-modal-container');
const importExportModalContainer = document.getElementById('import-export-modal-container');
const confirmModalContainer = document.getElementById('confirm-modal-container'); // Ensure this is present
const toastContainer = document.getElementById('toast-container'); // Ensure this is present


// --- Helper Functions ---
const getUserId = () => auth.currentUser?.uid || 'no_user_logged_in'; // Use auth.currentUser

// --- Callbacks for Modules to Update App State ---

// Callback for data-service to update events in main app state
const handleUpdateEvents = (newEvents) => {
    events = newEvents;
    renderApp(); // Re-render when events state changes
};

// Callback for data-service to update tasks in main app state
const handleUpdateTasks = (newTasks) => {
    tasks = newTasks;
    renderApp(); // Re-render when tasks state changes
};

// Callback for UI components to trigger main app re-render
const triggerAppRender = () => {
    renderApp();
};

// Callback for UI components to handle navigation (e.g., day click in calendar)
const navigateTo = (view, data = {}) => {
    currentView = view;
    selectedEvent = null; // Clear previous selections
    selectedTask = null; // Clear previous selections

    // Reset deleting states when navigating away from detail views
    eventDetailIsDeleting = false;
    taskDetailIsDeleting = false;

    if (view === 'eventDetail') selectedEvent = data;
    if (view === 'taskDetail') selectedTask = data;
    if (view === 'newEvent') {
        dateForNewEntry = data.startDate || null; // Capture date if from calendar
        // ui-components handles its own state for showEventFormModal
        openEventFormModal(null); // Explicitly open new event form
    } else if (view === 'editEvent') {
        openEventFormModal(data); // Explicitly open edit event form
    } else if (view === 'newTask') {
        dateForNewEntry = data.startDate || null; // Capture date if from calendar
        // ui-components handles its own state for showTaskFormModal
        openTaskFormModal(null); // Explicitly open new task form
    } else if (view === 'editTask') {
        openTaskFormModal(data); // Explicitly open edit task form
    } else if (view === 'importExport') {
        openImportExportModal();
    }
    renderApp(); // Re-render the main app based on new view
};

// --- Firebase Authentication Handlers (moved from index.html) ---

async function fetchUserProfile(uid) {
    if (!uid) {
        userProfile = { name: 'Guest User', email: 'guest@example.com', phone: 'N/A', photoURL: '' };
        return;
    }
    try {
        const userDocRef = doc(db, `artifacts/${__app_id}/users/${uid}/profile`, 'userData');
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            userProfile = {
                name: data.name || auth.currentUser?.displayName || '',
                email: data.email || auth.currentUser?.email || '',
                phone: data.phone || '',
                photoURL: data.photoURL || auth.currentUser?.photoURL || '',
            };
        } else {
            // Create a new profile if it doesn't exist (e.g., first login with Google)
            userProfile = {
                name: auth.currentUser?.displayName || '',
                email: auth.currentUser?.email || '',
                phone: '',
                photoURL: auth.currentUser?.photoURL || '',
            };
            await setDoc(userDocRef, userProfile);
        }
    } catch (error) {
        console.error("Error fetching user profile:", error);
        userProfile = {
            name: auth.currentUser?.displayName || '',
            email: auth.currentUser?.email || '',
            phone: '',
            photoURL: '',
        };
        showToast(`Error fetching profile: ${error.message}`, 'error');
    }
}

async function handleUpdateProfile(updatedProfileData) {
    if (!auth.currentUser) {
        showToast('Profile cannot be updated without a signed-in user!', 'error');
        return;
    }

    try {
        // Update Firebase Auth profile
        await updateProfile(auth.currentUser, {
            displayName: updatedProfileData.name,
            photoURL: updatedProfileData.photoURL,
        });

        const userDocRef = doc(db, `artifacts/${__app_id}/users/${auth.currentUser.uid}/profile`, 'userData');
        await setDoc(userDocRef, {
            name: updatedProfileData.name,
            email: updatedProfileData.email,
            phone: updatedProfileData.phone,
            photoURL: updatedProfileData.photoURL,
        }, { merge: true });

        userProfile = updatedProfileData; // Update global state
        showProfileModal = false;
        showToast('Profile updated successfully!', 'success');
        renderApp(); // Re-render to reflect changes
    } catch (error) {
        console.error("Error updating profile:", error);
        showToast(`Error updating profile: ${error.message}`, 'error');
    }
}

function setAuthScreen(screen) {
    authScreen = screen;
    authScreenError = ''; // Clear errors on screen change
    authScreenMessage = ''; // Clear messages on screen change
    authInputEmail = ''; // Clear inputs
    authInputPassword = '';
    authInputConfirmPassword = '';
    authInputName = '';
    authInputPhone = '';
    showPasswordState = false;
    showConfirmPasswordState = false;
    renderApp();
}

async function handleRegister(e) {
    e.preventDefault();
    authScreenError = '';
    authScreenMessage = '';
    if (authInputPassword !== authInputConfirmPassword) {
        authScreenError = "Passwords do not match.";
        renderApp();
        return;
    }
    if (authInputPassword.length < 6) {
        authScreenError = "Password should be at least 6 characters long.";
        renderApp();
        return;
    }
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, authInputEmail, authInputPassword);
        const user = userCredential.user;

        await updateProfile(user, { displayName: authInputName });

        const userDocRef = doc(db, `artifacts/${__app_id}/users/${user.uid}/profile`, 'userData');
        await setDoc(userDocRef, {
            name: authInputName,
            email: user.email,
            phone: authInputPhone,
            photoURL: '',
            createdAt: new Date().toISOString(),
        });

        authScreenMessage = "Registration successful! Please log in.";
        showToast("Registration successful! Please log in.", "success");
        setAuthScreen('login');
    }
    catch (err) {
        if (err.code === 'auth/operation-not-allowed') {
            authScreenError = "Registration failed: Email/Password sign-in is not enabled for this project. Please contact the administrator or check your Firebase console settings.";
        } else {
            authScreenError = err.message;
        }
        console.error("Registration error:", err, err.code);
        showToast(`Registration failed: ${err.message}`, 'error');
        renderApp();
    }
}

async function handleLogin(e) {
    e.preventDefault();
    authScreenError = '';
    authScreenMessage = '';
    try {
        const userCredential = await signInWithEmailAndPassword(auth, authInputEmail, authInputPassword);
        showToast("Logged in successfully!", "success");
    }
    catch (err) {
         if (err.code === 'auth/operation-not-allowed') {
            authScreenError = "Login failed: Email/Password sign-in is not enabled for this project. Please contact the administrator or check your Firebase console settings.";
        } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
            authScreenError = "Invalid email or password. Please try again.";
        }
        else {
            authScreenError = err.message;
        }
        console.error("Login error:", err);
        showToast(`Login failed: ${err.message}`, 'error');
        renderApp();
    }
}

async function handleGoogleSignIn() {
    authScreenError = '';
    authScreenMessage = '';
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        showToast("Signed in with Google successfully!", "success");

        // Check if user profile already exists, if not, create a basic one
        const userDocRef = doc(db, `artifacts/${__app_id}/users/${user.uid}/profile`, 'userData');
        const docSnap = await getDoc(userDocRef);
        if (!docSnap.exists()) {
            await setDoc(userDocRef, {
                name: user.displayName || '',
                email: user.email || '',
                phone: '',
                photoURL: user.photoURL || '',
                createdAt: new Date().toISOString(),
            });
        }
    } catch (error) {
        console.error("Google Sign-In Error:", error);
        if (error.code === 'auth/popup-closed-by-user') {
            authScreenError = "Sign-in cancelled.";
        } else if (error.code === 'auth/cancelled-popup-request') {
            authScreenError = "Already attempting to sign in. Please wait.";
        } else if (error.code === 'auth/operation-not-allowed') {
            authScreenError = "Google Sign-in is not enabled for this project. Please enable it in Firebase Console > Authentication > Sign-in method.";
        } else {
            authScreenError = `Google Sign-In Failed: ${error.message}`;
        }
        showToast(`Google Sign-In Failed: ${error.message}`, 'error');
        renderApp();
    }
}

async function handlePasswordReset(e) {
    e.preventDefault();
    authScreenError = '';
    authScreenMessage = '';
    if (!authInputEmail) {
        authScreenError = "Please enter your email address to reset password.";
        renderApp();
        return;
    }
    try {
        await sendPasswordResetEmail(auth, authInputEmail);
        authScreenMessage = "Password reset email sent! Check your inbox.";
        showToast("Password reset email sent! Check your inbox.", "success");
        renderApp();
    } catch (err) {
        authScreenError = err.message;
        console.error("Password reset error:", err);
        showToast(`Password reset failed: ${err.message}`, 'error');
        renderApp();
    }
}

async function handleSignOut() {
    try {
        await signOut(auth);
        showToast('Signed out successfully!', 'success');
    } catch (error) {
        console.error("Sign out error:", error);
        showToast(`Error signing out: ${error.message}`, 'error');
    }
}

// --- Render Functions for different views ---

function renderLoadingSpinner() {
    appRoot.innerHTML = `
        <div class="flex items-center justify-center min-h-screen">
            <div class="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
            <p class="ml-4 text-lg text-gray-700">Loading Personal Assistant...</p>
        </div>
    `;
}

function renderAuthScreenContent() {
    let errorHtml = '';
    let messageHtml = '';

    if (authScreenError) {
        errorHtml = `<div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md text-sm flex items-center"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-alert-triangle mr-2"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>${authScreenError}</div>`;
    }
    if (authScreenMessage) {
        messageHtml = `<div class="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md text-sm">${authScreenMessage}</div>`;
    }

    let formHtml = '';
    let titleText = '';

    const commonLabelClass = "block text-sm font-medium text-slate-600 mb-1";
    const commonInputClass = "w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow";
    const commonButtonClass = "w-full py-3 px-4 rounded-lg text-white font-semibold transition-all duration-300 ease-in-out";

    if (authScreen === 'login') {
        titleText = "Welcome back! Please sign in.";
        formHtml = `
            <form id="login-form" class="space-y-6">
                <div>
                    <label class="${commonLabelClass}">Email</label>
                    <input type="email" id="login-email" placeholder="you@example.com" class="${commonInputClass}" required value="${authInputEmail}">
                </div>
                <div>
                    <label class="${commonLabelClass}">Password</label>
                    <div class="relative">
                        <input type="${showPasswordState ? 'text' : 'password'}" id="login-password" placeholder="••••••••" class="${commonInputClass}" required value="${authInputPassword}">
                        <button type="button" id="toggle-login-password" class="absolute inset-y-0 right-0 px-3 flex items-center text-slate-500 hover:text-blue-600">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-${showPasswordState ? 'eye-off' : 'eye'}"></svg>
                        </button>
                    </div>
                </div>
                <button type="submit" class="${commonButtonClass} bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-300">Sign In</button>
                <div class="text-sm text-center">
                    <button type="button" id="forgot-password-btn" class="font-medium text-blue-600 hover:text-blue-500">Forgot password?</button>
                </div>
            </form>
            <div class="relative flex py-5 items-center">
                <div class="flex-grow border-t border-gray-300"></div>
                <span class="flex-shrink mx-4 text-gray-500">Or</span>
                <div class="flex-grow border-t border-gray-300"></div>
            </div>
            <button id="google-sign-in-btn" class="${commonButtonClass} bg-red-600 hover:bg-red-700 focus:ring-4 focus:ring-red-300 flex items-center justify-center">
                <svg class="w-5 h-5 mr-2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                    <path d="M12.24 10.27v3.08h6.24c-.26 1.63-1.54 2.76-3.8 3.52 1.48 1.15 3.3 1.95 5.24 1.95 2.1 0 4.07-.68 5.73-2.02l4.13 3.2c-2.45 2.06-5.69 3.32-9.43 3.32-7.55 0-13.68-6.13-13.68-13.68s6.13-13.68 13.68-13.68c3.96 0 7.37 1.57 9.87 4.14L22.61 9.4c-1.3-1.22-3.1-2.1-5.18-2.1-2.92 0-5.4 1.25-7.18 3.07z"/>
                </svg>
                Sign in with Google
            </button>
        `;
    } else if (authScreen === 'register') {
        titleText = "Create your account to get started.";
        formHtml = `
            <form id="register-form" class="space-y-4">
                 <div>
                    <label class="${commonLabelClass}">Full Name</label>
                    <input type="text" id="register-name" placeholder="John Doe" class="${commonInputClass}" required value="${authInputName}">
                </div>
                <div>
                    <label class="${commonLabelClass}">Email</label>
                    <input type="email" id="register-email" placeholder="you@example.com" class="${commonInputClass}" required value="${authInputEmail}">
                </div>
                 <div>
                    <label class="${commonLabelClass}">Phone (Optional)</label>
                    <input type="tel" id="register-phone" placeholder="123-456-7890" class="${commonInputClass}" value="${authInputPhone}">
                </div>
                <div>
                    <label class="${commonLabelClass}">Password</label>
                     <div class="relative">
                        <input type="${showPasswordState ? 'text' : 'password'}" id="register-password" placeholder="Minimum 6 characters" class="${commonInputClass}" required value="${authInputPassword}">
                        <button type="button" id="toggle-register-password" class="absolute inset-y-0 right-0 px-3 flex items-center text-slate-500 hover:text-blue-600">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-${showPasswordState ? 'eye-off' : 'eye'}"></svg>
                        </button>
                    </div>
                </div>
                <div>
                    <label class="${commonLabelClass}">Confirm Password</label>
                     <div class="relative">
                        <input type="${showConfirmPasswordState ? 'text' : 'password'}" id="register-confirm-password" placeholder="Re-enter password" class="${commonInputClass}" required value="${authInputConfirmPassword}">
                        <button type="button" id="toggle-register-confirm-password" class="absolute inset-y-0 right-0 px-3 flex items-center text-slate-500 hover:text-blue-600">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-${showConfirmPasswordState ? 'eye-off' : 'eye'}"></svg>
                        </button>
                    </div>
                </div>
                <button type="submit" class="${commonButtonClass} bg-green-600 hover:bg-green-700 focus:ring-4 focus:ring-green-300">Create Account</button>
            </form>
        `;
    } else if (authScreen === 'forgotPassword') {
        titleText = "Reset your password.";
        formHtml = `
            <form id="forgot-password-form" class="space-y-6">
                <div>
                    <label class="${commonLabelClass}">Email</label>
                    <input type="email" id="forgot-email" placeholder="Enter your registered email" class="${commonInputClass}" required value="${authInputEmail}">
                </div>
                <button type="submit" class="${commonButtonClass} bg-orange-500 hover:bg-orange-600 focus:ring-4 focus:ring-orange-300">Send Reset Link</button>
            </form>
        `;
    }

    appRoot.innerHTML = `
        <div class="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 to-indigo-600 p-4">
            <div class="w-full max-w-md bg-white rounded-xl shadow-2xl p-8 space-y-6">
                <div class="text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar mx-auto h-16 w-16 text-blue-600 mb-4"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>
                    <h1 class="text-4xl font-bold text-slate-800">Personal Assistant</h1>
                    <p class="text-slate-500 mt-2">${titleText}</p>
                </div>
                ${errorHtml}
                ${messageHtml}
                ${formHtml}
                <div class="text-sm text-center">
                    ${authScreen === 'login' ?
                        `<p>Don't have an account? <button id="signup-link" class="font-medium text-blue-600 hover:text-blue-500">Sign up</button></p>` : ''}
                    ${authScreen === 'register' ?
                        `<p>Already have an account? <button id="signin-link" class="font-medium text-blue-600 hover:text-blue-500">Sign in</button></p>` : ''}
                    ${authScreen === 'forgotPassword' ?
                        `<p>Remembered your password? <button id="signin-link-from-forgot" class="font-medium text-blue-600 hover:text-blue-500">Sign in</button></p>` : ''}
                </div>
                <p class="text-xs text-center text-slate-400 mt-8">
                    User ID: ${getUserId()}
                </p>
            </div>
        </div>
    `;

    // Event Listeners for Auth Screen (only attach if elements exist)
    if (document.getElementById('login-form')) {
        document.getElementById('login-form').onsubmit = handleLogin;
        document.getElementById('forgot-password-btn').onclick = () => setAuthScreen('forgotPassword');
        document.getElementById('toggle-login-password').onclick = () => {
            showPasswordState = !showPasswordState;
            renderApp();
        };
        document.getElementById('login-email').oninput = (e) => authInputEmail = e.target.value;
        document.getElementById('login-password').oninput = (e) => authInputPassword = e.target.value;
        document.getElementById('google-sign-in-btn').onclick = handleGoogleSignIn; // Attach Google sign-in
    }
    if (document.getElementById('register-form')) {
        document.getElementById('register-form').onsubmit = handleRegister;
        document.getElementById('toggle-register-password').onclick = () => {
            showPasswordState = !showPasswordState;
            renderApp();
        };
        document.getElementById('toggle-register-confirm-password').onclick = () => {
            showConfirmPasswordState = !showConfirmPasswordState;
            renderApp();
        };
        document.getElementById('register-name').oninput = (e) => authInputName = e.target.value;
        document.getElementById('register-email').oninput = (e) => authInputEmail = e.target.value;
        document.getElementById('register-phone').oninput = (e) => authInputPhone = e.target.value;
        document.getElementById('register-password').oninput = (e) => authInputPassword = e.target.value;
        document.getElementById('register-confirm-password').oninput = (e) => authInputConfirmPassword = e.target.value;
    }
    if (document.getElementById('forgot-password-form')) {
        document.getElementById('forgot-password-form').onsubmit = handlePasswordReset;
        document.getElementById('forgot-email').oninput = (e) => authInputEmail = e.target.value;
    }

    if (document.getElementById('signup-link')) {
        document.getElementById('signup-link').onclick = () => setAuthScreen('register');
    }
    if (document.getElementById('signin-link')) {
        document.getElementById('signin-link').onclick = () => setAuthScreen('login');
    }
    if (document.getElementById('signin-link-from-forgot')) {
        document.getElementById('signin-link-from-forgot').onclick = () => setAuthScreen('login');
    }
    lucide.createIcons(); // Re-create icons for the new content
}


function renderLandingPage() {
    const placeholderImage = `https://placehold.co/100x100/E0E7FF/4F46E5?text=${userProfile.name ? userProfile.name.charAt(0).toUpperCase() : 'U'}`;
    const profilePhoto = userProfile.photoURL || placeholderImage;

    appRoot.innerHTML = `
        <div class="flex flex-col h-screen">
            <header class="h-1/4 bg-white shadow-md p-4 md:p-6 flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
                <div class="flex items-center space-x-4">
                    <img src="${profilePhoto}" alt="${userProfile.name || "User"}"
                        class="w-16 h-16 md:w-24 md:h-24 rounded-full border-4 border-blue-200 object-cover shadow-lg"
                        onerror="this.onerror=null;this.src='${placeholderImage}';"
                    />
                    <div>
                        <h2 class="text-xl md:text-3xl font-bold text-slate-800">${userProfile.name || "User Name"}</h2>
                        <p class="text-sm md:text-base text-slate-600 flex items-center"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-mail mr-2 text-blue-500"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>${userProfile.email || "user@example.com"}</p>
                        <p class="text-sm md:text-base text-slate-600 flex items-center"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-phone mr-2 text-green-500"><path d="M22 16.92v3a2 2 0 0 1-2.18 2.02 15.15 15.15 0 0 1-12.62-6.32A15.15 15.15 0 0 1 2.02 4.18 2 2 0 0 1 4.02 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>${userProfile.phone || "No phone number"}</p>
                        <button id="edit-profile-btn"
                            class="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-edit-3 mr-1"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg> Edit Profile
                        </button>
                    </div>
                </div>
                <div class="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                    <button id="new-event-btn"
                        class="flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus-circle mr-2"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg> New Event
                    </button>
                    <button id="new-task-btn"
                        class="flex items-center justify-center bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus-circle mr-2"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg> New Task
                    </button>
                    <button id="import-export-btn"
                        class="flex items-center justify-center bg-purple-500 hover:bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-text mr-2"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg> Import/Export
                    </button>
                    <button id="sign-out-btn"
                        class="flex items-center justify-center bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-log-out mr-2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="17 16 22 12 17 8"/><line x1="22" x2="10" y1="12" y2="12"/></svg> Sign Out
                    </button>
                </div>
            </header>
            <main class="h-3/4 bg-slate-50 p-4 md:p-6 overflow-y-auto flex flex-col">
                <!-- Common Calendar Navigation -->
                <div class="flex items-center justify-between mb-4 md:mb-6 bg-white p-4 rounded-lg shadow-sm">
                    <div class="flex items-center space-x-1 md:space-x-2">
                        <button id="prev-year-btn" class="p-2 rounded-md hover:bg-slate-200 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-left"><path d="m15 18-6-6 6-6"/></svg></button>
                        <h3 class="text-lg md:text-xl font-semibold text-slate-700 w-20 md:w-24 text-center">${currentCalendarDate.getFullYear()}</h3>
                        <button id="next-year-btn" class="p-2 rounded-md hover:bg-slate-200 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right"><path d="m9 18 6-6-6-6"/></svg></button>
                    </div>
                    <h3 class="text-lg md:text-xl font-semibold text-slate-700 text-center flex-grow">
                        ${currentCalendarDate.toLocaleString('default', { month: 'long' })}
                    </h3>
                    <div class="flex items-center space-x-1 md:space-x-2">
                        <button id="prev-month-btn" class="p-2 rounded-md hover:bg-slate-200 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-left"><path d="m15 18-6-6 6-6"/></svg></button>
                        <button id="today-btn" class="p-2 rounded-md text-sm font-medium text-blue-600 hover:bg-blue-100 transition-colors">Today</button>
                        <button id="next-month-btn" class="p-2 rounded-md hover:bg-slate-200 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right"><path d="m9 18 6-6-6-6"/></svg></button>
                    </div>
                </div>

                <div class="flex border-b border-slate-300 mb-4">
                    <button id="calendar-tab-btn" class="py-2 px-4 text-sm font-medium ${currentTab === 'calendar' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600 hover:text-blue-600'} transition-colors">Calendar View</button>
                    <button id="list-tab-btn" class="py-2 px-4 text-sm font-medium ${currentTab === 'list' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600 hover:text-blue-600'} transition-colors">List View</button>
                </div>
                <div id="tab-content" class="flex-grow"></div>
            </main>
        </div>
    `;
    document.getElementById('edit-profile-btn').onclick = () => {
        showProfileModal = true;
        renderApp();
    };
    document.getElementById('new-event-btn').onclick = () => navigateTo('newEvent');
    document.getElementById('new-task-btn').onclick = () => navigateTo('newTask');
    document.getElementById('import-export-btn').onclick = () => navigateTo('importExport');
    document.getElementById('sign-out-btn').onclick = handleSignOut;

    // Attach event listeners to COMMON calendar controls
    document.getElementById('prev-year-btn').onclick = () => {
        currentCalendarDate = changeCalendarYear(-1, currentCalendarDate);
        renderApp();
    };
    document.getElementById('next-year-btn').onclick = () => {
        currentCalendarDate = changeCalendarYear(1, currentCalendarDate);
        renderApp();
    };
    document.getElementById('prev-month-btn').onclick = () => {
        currentCalendarDate = changeCalendarMonth(-1, currentCalendarDate);
        renderApp();
    };
    document.getElementById('next-month-btn').onclick = () => {
        currentCalendarDate = changeCalendarMonth(1, currentCalendarDate);
        renderApp();
    };
    document.getElementById('today-btn').onclick = () => {
        currentCalendarDate = new Date();
        renderApp();
    };


    document.getElementById('calendar-tab-btn').onclick = () => {
        currentTab = 'calendar';
        renderApp();
    };
    document.getElementById('list-tab-btn').onclick = () => {
        currentTab = 'list';
        renderApp();
    };

    const tabContentContainer = document.getElementById('tab-content');
    if (currentTab === 'calendar') {
        tabContentContainer.innerHTML = `<div id="calendar-view-container" class="h-full"></div>`;
        renderCalendarViewContent();
    } else {
        tabContentContainer.innerHTML = `<div id="list-view-container" class="h-full"></div>`;
        renderListViewContent();
    }

    if (showProfileModal) {
        renderProfileModal();
    }
    // Re-create icons for the new content
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}


function renderProfileModal() {
    const modalHtml = `
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 transition-opacity duration-300 ease-in-out">
            <div class="bg-white rounded-xl shadow-2xl p-6 md:p-8 w-full max-w-lg transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-modalEnter modal-content-area">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-2xl font-semibold text-slate-800">Edit Profile</h3>
                    <button id="close-profile-modal" class="text-slate-400 hover:text-slate-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus-circle transform rotate-45"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>
                    </button>
                </div>
                <div id="profile-modal-error" class="hidden bg-red-100 border-l-4 border-red-500 text-red-700 p-3 rounded-md text-sm mb-4 flex items-center"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-alert-triangle mr-2"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg></div>
                <form id="profile-form" class="space-y-5">
                    <div>
                        <label for="profile-name" class="block text-sm font-medium text-slate-600 mb-1">Full Name</label>
                        <input type="text" id="profile-name" placeholder="Your full name" class="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow" required value="${userProfile.name || ''}">
                    </div>
                    <div>
                        <label for="profile-email" class="block text-sm font-medium text-slate-600 mb-1">Email</label>
                        <input type="email" id="profile-email" class="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow bg-slate-200 cursor-not-allowed" readonly title="Email cannot be changed here" value="${userProfile.email || ''}">
                    </div>
                    <div>
                        <label for="profile-phone" class="block text-sm font-medium text-slate-600 mb-1">Phone Number</label>
                        <input type="tel" id="profile-phone" placeholder="e.g., 123-456-7890" class="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow" value="${userProfile.phone || ''}">
                    </div>
                    <div>
                        <label for="profile-photoURL" class="block text-sm font-medium text-slate-600 mb-1">Photo URL</label>
                        <input type="text" id="profile-photoURL" placeholder="https://example.com/image.png" class="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow" value="${userProfile.photoURL || ''}">
                        <p class="text-xs text-slate-500 mt-1">Enter a URL for your profile picture.</p>
                    </div>
                    <div class="flex justify-end space-x-3 pt-2">
                        <button type="button" id="profile-cancel-btn" class="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">
                            Cancel
                        </button>
                        <button type="submit" id="profile-save-btn" class="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors focus:ring-4 focus:ring-blue-300">
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    appRoot.insertAdjacentHTML('beforeend', modalHtml); // Append modal to app root

    const modalElement = appRoot.lastElementChild; // Get the newly added modal
    const profileNameInput = modalElement.querySelector('#profile-name');
    const profilePhoneInput = modalElement.querySelector('#profile-phone');
    const profilePhotoURLInput = modalElement.querySelector('#profile-photoURL');
    const profileModalErrorDiv = modalElement.querySelector('#profile-modal-error');

    modalElement.querySelector('#close-profile-modal').onclick = () => {
        showProfileModal = false;
        modalElement.remove(); // Remove modal from DOM
    };
    modalElement.querySelector('#profile-cancel-btn').onclick = () => {
        showProfileModal = false;
        modalElement.remove();
    };
    modalElement.querySelector('#profile-form').onsubmit = async (e) => {
        e.preventDefault();
        profileModalErrorDiv.classList.add('hidden'); // Hide previous error

        const name = profileNameInput.value.trim();
        const phone = profilePhoneInput.value;
        const photoURL = profilePhotoURLInput.value;

        if (!name) {
            profileModalErrorDiv.classList.remove('hidden');
            profileModalErrorDiv.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-alert-triangle mr-2"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>Name cannot be empty.`;
            return;
        }

        await handleUpdateProfile({ ...userProfile, name, phone, photoURL });
        modalElement.remove(); // Remove modal after update
    };
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

function renderCalendarViewContent() {
    const calendarContainer = document.getElementById('calendar-view-container');
    if (!calendarContainer) return; // Exit if container not found

    // The renderCalendarView function from calendar-logic.js expects raw events/tasks
    calendarContainer.innerHTML = renderCalendarView(currentCalendarDate, events, tasks, navigateTo);

    // Attach event listeners to individual day cells (delegated from calendar-logic)
    calendarContainer.querySelectorAll('[data-day]').forEach(dayCell => {
        dayCell.onclick = (e) => {
            // Re-fetch events/tasks from data-service for the latest state before showing details
            const allEvents = getEvents();
            const allTasks = getTasks();

            const year = currentCalendarDate.getFullYear();
            const month = currentCalendarDate.getMonth();
            const day = parseInt(dayCell.dataset.day);
            const dayDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            // Generate occurrences for the specific day
            const selectedDayEvents = generateOccurrencesForMonth(allEvents, 'event', year, month)
                .filter(event => event.startDate === dayDateStr)
                .sort((a,b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'));

            const selectedDayTasks = generateOccurrencesForMonth(allTasks, 'task', year, month)
                .filter(task => task.startDate === dayDateStr)
                .sort((a,b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'));

            renderDayDetailsModal(dayDateStr, selectedDayEvents, selectedDayTasks);
        };
        dayCell.ondblclick = (e) => {
            const year = currentCalendarDate.getFullYear();
            const month = currentCalendarDate.getMonth();
            const day = parseInt(dayCell.dataset.day);
            const dayDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            showConfirmModal(
                "Create New Entry",
                `Would you like to create a new Event or a new Task for ${dayDateStr}?`
                ,
                () => navigateTo('newEvent', { startDate: dayDateStr }), // On Confirm: New Event
                () => navigateTo('newTask', { startDate: dayDateStr }), // On Cancel: New Task (using cancel callback for other option)
                "New Event",
                "New Task",
                "bg-blue-600 hover:bg-blue-700" // Custom class for confirm button
            );
        };
    });
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

function renderDayDetailsModal(dateForNewEntry, eventsForDay, tasksForDay) {
    const formattedDate = dateForNewEntry ? new Date(dateForNewEntry + "T00:00:00Z").toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : "Details";

    let detailsListHtml = '';
    if (eventsForDay.length > 0 || tasksForDay.length > 0) {
        detailsListHtml = `<ul class="space-y-3 max-h-80 overflow-y-auto">`;
        
        // Display Events
        if (eventsForDay.length > 0) {
            detailsListHtml += `<li class="font-bold text-slate-700 pt-2 pb-1">Events:</li>`;
            eventsForDay.forEach(event => {
                const statusClass = event.isCompleted ? 'bg-green-50 border-green-200 text-green-700' : 'bg-blue-50 border-blue-200 text-blue-700';
                detailsListHtml += `
                    <li class="p-3 ${statusClass} rounded-lg hover:bg-blue-100 cursor-pointer transition-colors" data-type="event" data-id="${event.id}" data-original-id="${event.originalId || event.id}" data-start-date="${event.startDate}">
                        <div class="flex justify-between items-center">
                            <p class="font-semibold">${event.name}</p>
                            ${!event.isCompleted ? `
                                <button class="mark-done-btn px-2 py-0.5 bg-green-500 text-white rounded-md text-xs font-semibold hover:bg-green-600 transition-colors"
                                    data-id="${event.id}" data-type="event" data-original-id="${event.originalId || event.id}" data-start-date="${event.startDate}">
                                    Done
                                </button>
                            ` : `<span class="text-xs font-medium text-green-700">Completed</span>`}
                        </div>
                        <p class="text-sm text-slate-600 truncate">${event.description || "No description"}</p>
                        <p class="text-xs text-slate-500">
                            ${event.startTime} ${event.endTime ? ` - ${event.endTime}` : ''}
                        </p>
                        ${event.isOccurrence ? `<span class="text-xs text-slate-500 italic"> (Recurring)</span>` : ''}
                    </li>
                `;
            });
        }

        // Display Tasks
        if (tasksForDay.length > 0) {
            detailsListHtml += `<li class="font-bold text-slate-700 pt-4 pb-1">Tasks:</li>`;
            tasksForDay.forEach(task => {
                const statusClass = task.isCompleted ? 'bg-green-50 border-green-200 text-green-700' : 'bg-purple-50 border-purple-200 text-purple-700';
                detailsListHtml += `
                    <li class="p-3 ${statusClass} rounded-lg hover:bg-purple-100 cursor-pointer transition-colors" data-type="task" data-id="${task.id}" data-original-id="${task.originalId || task.id}" data-start-date="${task.startDate}">
                        <div class="flex justify-between items-center">
                            <p class="font-semibold">${task.name}</p>
                            ${!task.isCompleted ? `
                                <button class="mark-done-btn px-2 py-0.5 bg-green-500 text-white rounded-md text-xs font-semibold hover:bg-green-600 transition-colors"
                                    data-id="${task.id}" data-type="task" data-original-id="${task.originalId || task.id}" data-start-date="${task.startDate}">
                                    Done
                                </button>
                            ` : `<span class="text-xs font-medium text-green-700">Completed</span>`}
                        </div>
                        <p class="text-sm text-slate-600">Type: ${task.type || 'General'}</p>
                        <p class="text-sm text-slate-600 truncate">${task.description || "No description"}</p>
                        <p class="text-xs text-slate-500">
                            ${task.startTime} ${task.endTime ? ` - ${task.endTime}` : ''}
                        </p>
                        ${task.isOccurrence ? `<span class="text-xs text-slate-500 italic"> (Recurring)</span>` : ''}
                    </li>
                `;
            });
        }

        detailsListHtml += `</ul>`;
    } else {
        detailsListHtml = `<p class="text-slate-500 py-4 text-center">No events or tasks scheduled for this day.</p>`;
    }

    const modalHtml = `
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div class="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md md:max-w-lg animate-modalEnter modal-content-area">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-semibold text-slate-800">Details for ${formattedDate}</h3>
                    <button id="close-day-details-modal" class="text-slate-400 hover:text-slate-600">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus-circle transform rotate-45"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>
                    </button>
                </div>
                ${detailsListHtml}
                <div class="mt-6 flex justify-end space-x-3">
                    <button id="add-new-event-from-modal"
                        class="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center"
                    >
                       <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus-circle mr-2"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg> Add Event
                    </button>
                    <button id="add-new-task-from-modal"
                        class="bg-purple-500 hover:bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center"
                    >
                       <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus-circle mr-2"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg> Add Task
                    </button>
                </div>
            </div>
        </div>
    `;
    confirmModalContainer.insertAdjacentHTML('beforeend', modalHtml); // Using confirmModalContainer as it's typically empty

    const modalElement = confirmModalContainer.lastElementChild;

    modalElement.querySelector('#close-day-details-modal').onclick = () => {
        modalElement.remove();
    };
    modalElement.querySelector('#add-new-event-from-modal').onclick = () => {
        navigateTo('newEvent', { startDate: dateForNewEntry });
        modalElement.remove();
    };
    modalElement.querySelector('#add-new-task-from-modal').onclick = () => {
        navigateTo('newTask', { startDate: dateForNewEntry });
        modalElement.remove();
    };

    // Event listener for clicking on a detail item (event or task)
    modalElement.querySelectorAll('li[data-original-id]').forEach(itemLi => {
        itemLi.onclick = (e) => {
            // Prevent navigation if the "Mark Done" button was clicked
            if (e.target.classList.contains('mark-done-btn')) {
                return;
            }
            const originalId = itemLi.dataset.originalId;
            const type = itemLi.dataset.type;
            if (type === 'event') {
                const entry = events.find(e => e.id === originalId); // Use local 'events' state
                navigateTo('eventDetail', entry);
            } else if (type === 'task') {
                const entry = tasks.find(t => t.id === originalId); // Use local 'tasks' state
                navigateTo('taskDetail', entry);
            }
            modalElement.remove();
        };
    });

    // Event listener for "Mark Done" buttons within the modal
    modalElement.querySelectorAll('.mark-done-btn').forEach(button => {
        button.onclick = (e) => {
            e.stopPropagation(); // Prevent the parent <li> click from firing
            handleMarkDoneClick(e.target);
        };
    });

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}


function renderListViewContent() {
    const listContainer = document.getElementById('list-view-container');
    if (!listContainer) return;

    const now = new Date();
    const nowUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    const allEventsForMonth = generateOccurrencesForMonth(events, 'event', currentCalendarDate.getFullYear(), currentCalendarDate.getMonth());
    const allTasksForMonth = generateOccurrencesForMonth(tasks, 'task', currentCalendarDate.getFullYear(), currentCalendarDate.getMonth());

    let eventsHtml = '';
    let tasksHtml = '';

    if (allEventsForMonth.length === 0 && allTasksForMonth.length === 0) {
        listContainer.innerHTML = `
            <div class="bg-white p-6 rounded-xl shadow-lg text-center text-slate-600">
                No events or tasks scheduled for ${currentCalendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}.
                Add some using the "New Event" or "New Task" buttons, or by double-clicking a day on the Calendar.
            </div>
        `;
        return;
    }

    const generateEntryHtml = (entry, type) => {
        const entryDateUTC = new Date(entry.startDate + "T00:00:00Z");
        const formattedTime = entry.startTime ? ` at ${entry.startTime}` : '';
        const formattedDate = entryDateUTC.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

        let statusClass = 'text-blue-700 bg-blue-50 border-blue-200';
        let statusText = 'Upcoming';
        let isBold = false;
        let showMarkDone = false;

        if (entry.isCompleted) {
            statusClass = 'text-green-700 bg-green-50 border-green-200';
            statusText = 'Completed';
            showMarkDone = false;
        } else if (entryDateUTC < nowUTC) {
            statusClass = 'text-red-700 bg-red-50 border-red-200';
            statusText = 'Overdue';
            showMarkDone = true;
        } else if (entryDateUTC.getTime() === nowUTC.getTime()) {
            isBold = true;
            statusText = 'Today';
            showMarkDone = true;
        } else {
            showMarkDone = true;
        }

        const markDoneButton = showMarkDone && !entry.isCompleted ? `
            <button class="mark-done-btn px-3 py-1 bg-green-500 text-white rounded-md text-xs font-semibold hover:bg-green-600 transition-colors"
                data-id="${entry.id}" data-type="${type}" data-original-id="${entry.originalId || entry.id}" data-start-date="${entry.startDate}">
                Mark Done
            </button>
        ` : '';

        return `
            <li class="p-4 rounded-lg shadow-sm cursor-pointer ${statusClass}" data-id="${entry.id}" data-type="${type}" data-original-id="${entry.originalId || entry.id}" data-start-date="${entry.startDate}">
                <div class="flex justify-between items-center mb-2">
                    <h4 class="font-semibold ${isBold ? 'text-lg md:text-xl font-bold' : 'text-base md:text-lg'}">${entry.name}</h4>
                    <span class="text-xs font-medium px-2 py-0.5 rounded-full ${entry.isCompleted ? 'bg-green-200 text-green-800' : (entryDateUTC < nowUTC && !entry.isCompleted ? 'bg-red-200 text-red-800' : 'bg-blue-200 text-blue-800')}">
                        ${statusText}
                    </span>
                </div>
                <p class="text-sm text-slate-700 mb-2 truncate">${entry.description || 'No description.'}</p>
                <p class="text-xs text-slate-600">
                    ${type === 'task' ? `Type: ${entry.type || 'General'} | ` : ''}
                    ${formattedDate}${formattedTime}
                    ${entry.isOccurrence ? `<span class="italic ml-2">(Recurring)</span>` : ''}
                </p>
                ${markDoneButton}
            </li>
        `;
    };

    allEventsForMonth.sort((a, b) => new Date(a.startDate + (a.startTime || '')) - new Date(b.startDate + (b.startTime || ''))).forEach(event => {
        eventsHtml += generateEntryHtml(event, 'event');
    });
    allTasksForMonth.sort((a, b) => new Date(a.startDate + (a.startTime || '')) - new Date(b.startDate + (b.startTime || ''))).forEach(task => {
        tasksHtml += generateEntryHtml(task, 'task');
    });

    listContainer.innerHTML = `
        <div class="bg-white p-4 md:p-6 rounded-xl shadow-lg h-full flex flex-col">
            <h3 class="text-xl md:text-2xl font-bold text-slate-800 mb-6 text-center">
                Events & Tasks for ${currentCalendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto">
                <div>
                    <h4 class="text-lg font-bold text-blue-700 mb-3">Events</h4>
                    <ul class="space-y-4">
                        ${eventsHtml || '<li class="text-slate-500">No events this month.</li>'}
                    </ul>
                </div>
                <div>
                    <h4 class="text-lg font-bold text-purple-700 mb-3">Tasks</h4>
                    <ul class="space-y-4">
                        ${tasksHtml || '<li class="text-slate-500">No tasks this month.</li>'}
                    </ul>
                </div>
            </div>
        </div>
    `;

    listContainer.querySelectorAll('li[data-original-id]').forEach(itemElement => {
        itemElement.onclick = (e) => {
            if (e.target.classList.contains('mark-done-btn')) return;

            const originalId = itemElement.dataset.originalId;
            const type = itemElement.dataset.type;
            if (type === 'event') {
                const entry = events.find(e => e.id === originalId);
                navigateTo('eventDetail', entry);
            } else if (type === 'task') {
                const entry = tasks.find(t => t.id === originalId);
                navigateTo('taskDetail', entry);
            }
        };
    });

    listContainer.querySelectorAll('.mark-done-btn').forEach(button => {
        button.onclick = async (e) => {
            e.stopPropagation();
            handleMarkDoneClick(e.target);
        };
    });
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}


async function handleMarkDoneClick(targetButton) {
    const id = targetButton.dataset.originalId;
    const type = targetButton.dataset.type;
    const occurrenceDate = targetButton.dataset.startDate;

    showConfirmModal(
        "Mark as Done",
        `Are you sure you want to mark this ${type} occurrence on ${occurrenceDate} as done?`,
        async () => {
            try {
                const userIdToUse = auth.currentUser?.uid;
                const collectionPath = `artifacts/${__app_id}/users/${userIdToUse}/${type === 'event' ? 'events' : 'tasks'}`;
                const docRef = doc(db, collectionPath, id);

                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.recurrence && data.recurrence !== 'none') {
                        const currentCompletedDates = Array.isArray(data.completedOccurrencesDates) ? data.completedOccurrencesDates : [];
                        if (!currentCompletedDates.includes(occurrenceDate)) {
                            await updateDoc(docRef, {
                                completedOccurrencesDates: [...currentCompletedDates, occurrenceDate],
                                updatedAt: new Date().toISOString()
                            });
                        }
                    } else {
                        await updateDoc(docRef, {
                            isCompleted: true,
                            updatedAt: new Date().toISOString()
                        });
                    }
                    showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} occurrence marked as done!`, 'success');
                } else {
                    showToast(`Error: Original ${type} not found.`, 'error');
                }
            } catch (error) {
                console.error(`Error marking ${type} as done:`, error);
                showToast(`Failed to mark ${type} as done: ${error.message}. Ensure Firebase is configured and security rules allow writes.`, 'error');
            }
        },
        () => { /* Cancelled */ },
        "Yes, Mark Done",
        "Cancel",
        "bg-green-600 hover:bg-green-700"
    );
}


function renderEventDetailContent() {
    if (!selectedEvent) {
        appRoot.innerHTML = `<div class="p-6 text-center text-slate-600">Event not found. Please go back to the calendar.</div>`;
        return;
    }

    const formattedStartDate = selectedEvent.startDate ? new Date(selectedEvent.startDate + "T00:00:00Z").toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', timeZone: 'UTC' }) : 'N/A';
    const formattedEndDate = selectedEvent.endDate && selectedEvent.endDate !== selectedEvent.startDate ? new Date(selectedEvent.endDate + "T00:00:00Z").toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', timeZone: 'UTC' }) : null;

    let endTimeDisplay = '';
    if (!formattedEndDate && selectedEvent.endTime && selectedEvent.startDate) {
        endTimeDisplay = `<p class="text-slate-600">Ends: ${new Date(selectedEvent.startDate + "T00:00:00Z").toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', timeZone: 'UTC' })} at ${selectedEvent.endTime}</p>`;
    } else if (formattedEndDate) {
        endTimeDisplay = `<p class="text-slate-600">Ends: ${formattedEndDate} ${selectedEvent.endTime ? `at ${selectedEvent.endTime}` : ''}</p>`;
    }

    const todayUTC = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
    const eventStartUTC = new Date(selectedEvent.startDate + "T00:00:00Z");

    let statusText = 'Upcoming';
    let statusColor = 'bg-blue-200 text-blue-800';
    let showMarkDone = true;

    if (selectedEvent.recurrence === 'none') {
        if (selectedEvent.isCompleted) {
            statusText = 'Completed';
            statusColor = 'bg-green-200 text-green-800';
            showMarkDone = false;
        } else if (eventStartUTC < todayUTC) {
            statusText = 'Overdue';
            statusColor = 'bg-red-200 text-red-800';
        }
    } else {
        const hasCompletedOccurrences = Array.isArray(selectedEvent.completedOccurrencesDates) && selectedEvent.completedOccurrencesDates.length > 0;
        if (hasCompletedOccurrences) {
            statusText = 'Has Completed Occurrences';
            statusColor = 'bg-yellow-200 text-yellow-800';
            showMarkDone = true;
        } else if (eventStartUTC < todayUTC) {
            statusText = 'Upcoming (Some may be overdue)';
            statusColor = 'bg-blue-200 text-blue-800';
        }
    }

    appRoot.innerHTML = `
        <div class="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
            <div class="w-full max-w-2xl bg-white rounded-xl shadow-2xl p-6 md:p-8">
                <div class="flex justify-between items-center mb-2">
                     <h2 class="text-3xl font-bold text-slate-800">${selectedEvent.name}</h2>
                    <span class="text-sm font-medium px-3 py-1 rounded-full ${statusColor}">
                        ${statusText}
                    </span>
                </div>
                <p class="text-slate-500 mb-6 text-sm">Last updated: ${new Date(selectedEvent.updatedAt).toLocaleString()}</p>

                <div class="space-y-4 mb-8">
                    <div>
                        <h4 class="font-semibold text-slate-700">Description:</h4>
                        <p class="text-slate-600 whitespace-pre-wrap">${selectedEvent.description || "No description provided."}</p>
                    </div>
                    ${selectedEvent.additionalInfo ? `
                    <div>
                        <h4 class="font-semibold text-slate-700">Additional Info:</h4>
                        <p class="text-slate-600 whitespace-pre-wrap">${selectedEvent.additionalInfo}</p>
                    </div>
                    ` : ''}
                    <div>
                        <h4 class="font-semibold text-slate-700">Date & Time:</h4>
                        <p class="text-slate-600">
                            Starts: ${formattedStartDate} ${selectedEvent.startTime ? `at ${selectedEvent.startTime}` : ''}
                        </p>
                        ${endTimeDisplay}
                    </div>
                    <div>
                        <h4 class="font-semibold text-slate-700">Recurrence:</h4>
                        <p class="text-slate-600 capitalize">${selectedEvent.recurrence || "None"}</p>
                    </div>
                    ${selectedEvent.recurrence !== 'none' && Array.isArray(selectedEvent.completedOccurrencesDates) && selectedEvent.completedOccurrencesDates.length > 0 ? `
                        <div>
                            <h4 class="font-semibold text-slate-700">Completed Occurrences:</h4>
                            <p class="text-slate-600 text-sm">${selectedEvent.completedOccurrencesDates.join(', ')}</p>
                        </div>
                    ` : ''}
                </div>

                <div class="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3">
                    <button id="detail-back-btn"
                        class="w-full sm:w-auto px-6 py-3 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                        Back to Calendar
                    </button>
                    <button id="detail-edit-btn"
                        class="w-full sm:w-auto px-6 py-3 rounded-lg text-sm font-medium text-white bg-yellow-500 hover:bg-yellow-600 transition-colors flex items-center justify-center"
                    >
                       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-edit-3 mr-2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg> Edit Event
                    </button>
                    ${showMarkDone ? `
                    <button id="detail-mark-done-btn"
                        class="w-full sm:w-auto px-6 py-3 rounded-lg text-sm font-medium text-white bg-green-500 hover:bg-green-600 transition-colors flex items-center justify-center"
                        data-original-id="${selectedEvent.id}"
                        data-type="event"
                        data-start-date="${new Date().toISOString().split('T')[0]}"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check-circle mr-2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg> Mark Today's Occurrence Done
                    </button>
                    ` : ''}
                    <button id="detail-delete-btn"
                        class="w-full sm:w-auto px-6 py-3 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center"
                        ${eventDetailIsDeleting ? 'disabled' : ''}
                    >
                       ${eventDetailIsDeleting ?
                           `<div class="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>Deleting...` :
                           `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2 mr-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg> Delete Event`}
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('detail-back-btn').onclick = () => navigateTo('landing');
    document.getElementById('detail-edit-btn').onclick = () => navigateTo('editEvent', selectedEvent);
    if (document.getElementById('detail-mark-done-btn')) {
        document.getElementById('detail-mark-done-btn').onclick = (e) => handleMarkDoneClick(e.target);
    }
    document.getElementById('detail-delete-btn').onclick = () => {
        showConfirmModal(
            "Confirm Deletion",
            `Are you sure you want to delete the event "${selectedEvent.name}"? This action cannot be undone.`,
            async () => {
                eventDetailIsDeleting = true;
                renderApp();
                try {
                    const userIdToUse = auth.currentUser?.uid;
                    const eventDocRef = doc(db, `artifacts/${__app_id}/users/${userIdToUse}/events`, selectedEvent.id);
                    await deleteDoc(eventDocRef);
                    showToast("Event deleted successfully!", "success");
                    navigateTo('landing');
                } catch (error) {
                    console.error("Error deleting event:", error);
                    showToast(`Failed to delete event: ${error.message}. Ensure Firebase is configured and security rules allow writes.`, 'error');
                } finally {
                    eventDetailIsDeleting = false;
                    renderApp();
                }
            },
            () => { /* Cancelled */ },
            "Delete",
            "Cancel",
            "bg-red-600 hover:bg-red-700"
        );
    };
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}


function renderTaskDetailContent() {
    if (!selectedTask) {
        appRoot.innerHTML = `<div class="p-6 text-center text-slate-600">Task not found. Please go back to the calendar.</div>`;
        return;
    }

    const formattedStartDate = selectedTask.startDate ? new Date(selectedTask.startDate + "T00:00:00Z").toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', timeZone: 'UTC' }) : 'N/A';
    const formattedEndDate = selectedTask.endDate && selectedTask.endDate !== selectedTask.startDate ? new Date(selectedTask.endDate + "T00:00:00Z").toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', timeZone: 'UTC' }) : null;

    let endTimeDisplay = '';
    if (!formattedEndDate && selectedTask.endTime && selectedTask.startDate) {
        endTimeDisplay = `<p class="text-slate-600">Ends: ${new Date(selectedTask.startDate + "T00:00:00Z").toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', timeZone: 'UTC' })} at ${selectedTask.endTime}</p>`;
    } else if (formattedEndDate) {
        endTimeDisplay = `<p class="text-slate-600">Ends: ${formattedEndDate} ${selectedTask.endTime ? `at ${selectedTask.endTime}` : ''}</p>`;
    }

    const todayUTC = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
    const taskStartUTC = new Date(selectedTask.startDate + "T00:00:00Z");

    let statusText = 'Upcoming';
    let statusColor = 'bg-purple-200 text-purple-800';
    let showMarkDone = true;

    if (selectedTask.recurrence === 'none') {
        if (selectedTask.isCompleted) {
            statusText = 'Completed';
            statusColor = 'bg-green-200 text-green-800';
            showMarkDone = false;
        } else if (taskStartUTC < todayUTC) {
            statusText = 'Overdue';
            statusColor = 'bg-red-220 text-red-800';
        }
    } else {
        const hasCompletedOccurrences = Array.isArray(selectedTask.completedOccurrencesDates) && selectedTask.completedOccurrencesDates.length > 0;
        if (hasCompletedOccurrences) {
            statusText = 'Has Completed Occurrences';
            statusColor = 'bg-yellow-200 text-yellow-800';
            showMarkDone = true;
        } else if (taskStartUTC < todayUTC) {
            statusText = 'Upcoming (Some may be overdue)';
            statusColor = 'bg-purple-200 text-purple-800';
        }
    }

    appRoot.innerHTML = `
        <div class="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
            <div class="w-full max-w-2xl bg-white rounded-xl shadow-2xl p-6 md:p-8">
                <div class="flex justify-between items-center mb-2">
                     <h2 class="text-3xl font-bold text-slate-800">${selectedTask.name}</h2>
                    <span class="text-sm font-medium px-3 py-1 rounded-full ${statusColor}">
                        ${statusText}
                    </span>
                </div>
                <p class="text-slate-500 mb-6 text-sm">Last updated: ${new Date(selectedTask.updatedAt).toLocaleString()}</p>

                <div class="space-y-4 mb-8">
                    <div>
                        <h4 class="font-semibold text-slate-700">Type:</h4>
                        <p class="text-slate-600 capitalize">${selectedTask.type || "General"}</p>
                    </div>
                    <div>
                        <h4 class="font-semibold text-slate-700">Description:</h4>
                        <p class="text-slate-600 whitespace-pre-wrap">${selectedTask.description || "No description provided."}</p>
                    </div>
                    ${selectedTask.additionalInfo ? `
                    <div>
                        <h4 class="font-semibold text-slate-700">Additional Info:</h4>
                        <p class="text-slate-600 whitespace-pre-wrap">${selectedTask.additionalInfo}</p>
                    </div>
                    ` : ''}
                    <div>
                        <h4 class="font-semibold text-slate-700">Date & Time:</h4>
                        <p class="text-slate-600">
                            Starts: ${formattedStartDate} ${selectedTask.startTime ? `at ${selectedTask.startTime}` : ''}
                        </p>
                        ${endTimeDisplay}
                    </div>
                    <div>
                        <h4 class="font-semibold text-slate-700">Recurrence:</h4>
                        <p class="text-slate-600 capitalize">${selectedTask.recurrence || "None"}</p>
                    </div>
                    ${selectedTask.recurrence !== 'none' && Array.isArray(selectedTask.completedOccurrencesDates) && selectedTask.completedOccurrencesDates.length > 0 ? `
                        <div>
                            <h4 class="font-semibold text-slate-700">Completed Occurrences:</h4>
                            <p class="text-slate-600 text-sm">${selectedTask.completedOccurrencesDates.join(', ')}</p>
                        </div>
                    ` : ''}
                </div>

                <div class="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3">
                    <button id="detail-back-btn"
                        class="w-full sm:w-auto px-6 py-3 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                        Back to Calendar
                    </button>
                    <button id="detail-edit-btn"
                        class="w-full sm:w-auto px-6 py-3 rounded-lg text-sm font-medium text-white bg-yellow-500 hover:bg-yellow-600 transition-colors flex items-center justify-center"
                    >
                       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-edit-3 mr-2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg> Edit Task
                    </button>
                    ${showMarkDone ? `
                    <button id="detail-mark-done-btn"
                        class="w-full sm:w-auto px-6 py-3 rounded-lg text-sm font-medium text-white bg-green-500 hover:bg-green-600 transition-colors flex items-center justify-center"
                        data-original-id="${selectedTask.id}"
                        data-type="task"
                        data-start-date="${new Date().toISOString().split('T')[0]}"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check-circle mr-2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg> Mark Today's Occurrence Done
                    </button>
                    ` : ''}
                    <button id="detail-delete-btn"
                        class="w-full sm:w-auto px-6 py-3 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center"
                        ${taskDetailIsDeleting ? 'disabled' : ''}
                    >
                       ${taskDetailIsDeleting ?
                           `<div class="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>Deleting...` :
                           `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2 mr-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg> Delete Task`}
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('detail-back-btn').onclick = () => navigateTo('landing');
    document.getElementById('detail-edit-btn').onclick = () => navigateTo('editTask', selectedTask);
    if (document.getElementById('detail-mark-done-btn')) {
        document.getElementById('detail-mark-done-btn').onclick = (e) => handleMarkDoneClick(e.target);
    }
    document.getElementById('detail-delete-btn').onclick = () => {
        showConfirmModal(
            "Confirm Deletion",
            `Are you sure you want to delete the task "${selectedTask.name}"? This action cannot be undone.`,
            async () => {
                taskDetailIsDeleting = true;
                renderApp();
                try {
                    const userIdToUse = auth.currentUser?.uid;
                    const taskDocRef = doc(db, `artifacts/${__app_id}/users/${userIdToUse}/tasks`, selectedTask.id);
                    await deleteDoc(taskDocRef);
                    showToast("Task deleted successfully!", "success");
                    navigateTo('landing');
                } catch (error) {
                    console.error("Error deleting task:", error);
                    showToast(`Failed to delete task: ${error.message}. Ensure Firebase is configured and security rules allow writes.`, 'error');
                } finally {
                    taskDetailIsDeleting = false;
                    renderApp();
                }
            },
            () => { /* Cancelled */ },
            "Delete",
            "Cancel",
            "bg-red-600 hover:bg-red-700"
        );
    };
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}


const predefinedTaskTypes = [
    'Payment',
    'Medication',
    'Groceries',
    'Workout',
    'Meeting',
    'Other' // Always last
];

// Re-defining for local use as it was in the original monolithic code.
// The actual importExportModal rendering is in ui-components.js, this is just for wiring up handlers
function renderImportExportModalContent() {
    // This function will be called by renderApp, which means the HTML structure for the modal
    // (from ui-components.js) will already be present in importExportModalContainer.
    // We just need to attach the specific event listeners.

    const importFileInput = importExportModalContainer.querySelector('#import-file-input');
    const importSelectedBtn = importExportModalContainer.querySelector('#import-selected-btn');
    const selectedFileNameSpan = importExportModalContainer.querySelector('#selected-file-name');
    const exportDataBtn = importExportModalContainer.querySelector('#export-data-btn');

    // Ensure state reflects previous selection
    if (selectedFile) {
        selectedFileNameSpan.textContent = selectedFile.name;
        importSelectedBtn.disabled = false;
    } else {
        selectedFileNameSpan.textContent = 'No file chosen';
        importSelectedBtn.disabled = true;
    }

    exportDataBtn.onclick = handleExportData;

    importFileInput.onchange = (e) => {
        selectedFile = e.target.files[0];
        if (selectedFile) {
            selectedFileNameSpan.textContent = selectedFile.name;
            importSelectedBtn.disabled = false;
            importExportError = '';
        } else {
            selectedFileNameSpan.textContent = 'No file chosen';
            importSelectedBtn.disabled = true;
        }
        renderApp(); // Re-render to update button state
    };

    importSelectedBtn.onclick = handleImportData;

    // CSV export/import buttons
    const downloadEventsCsvBtn = importExportModalContainer.querySelector('#download-events-csv-btn');
    const downloadTasksCsvBtn = importExportModalContainer.querySelector('#download-tasks-csv-btn');
    const importJsonBtn = importExportModalContainer.querySelector('#import-json-btn');
    const exportJsonBtn = importExportModalContainer.querySelector('#export-json-btn');

    if (downloadEventsCsvBtn) {
        downloadEventsCsvBtn.onclick = () => {
            const csv = exportEventsToCsv(); // From import-export.js
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', 'events.csv');
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                showToast('Events data downloaded as CSV!', 'success');
            }
        };
    }
    if (downloadTasksCsvBtn) {
        downloadTasksCsvBtn.onclick = () => {
            const csv = exportTasksToCsv(); // From import-export.js
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', 'tasks.csv');
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                showToast('Tasks data downloaded as CSV!', 'success');
            }
        };
    }

    if (exportJsonBtn) {
        exportJsonBtn.onclick = () => {
            document.getElementById('importExportData').value = exportAllData(); // From import-export.js
            showToast('Data exported as JSON! Copy from the text area.', 'success');
        };
    }
    if (importJsonBtn) {
        importJsonBtn.onclick = async () => {
            const jsonData = document.getElementById('importExportData').value;
            await importAllData(jsonData); // From import-export.js
            // importAllData already calls closeImportExportModal and showToast
        };
    }

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}


// --- CSV Utility Functions (should be in import-export.js, duplicated for context) ---
// Note: These functions are now correctly placed in import-export.js,
// but were originally in the monolithic index.html, so I'm leaving them here
// for illustrative purposes if the user needs to refer to the original logic
// within the context of 'app.js' logic. In a real modular app, they wouldn't be here.

/*
function escapeCSV(value) {
    if (value === null || value === undefined) return '';
    let stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return '"' + stringValue.replace(/"/g, '""') + '"';
    }
    return stringValue;
}

function parseCSV(csvString) {
    const rows = csvString.split(/\r?\n/).filter(line => line.trim() !== '');
    if (rows.length === 0) return [];

    const headers = rows[0].split(',').map(h => h.trim());

    const data = [];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const values = [];
        let inQuote = false;
        let currentField = '';

        for (let j = 0; j < row.length; j++) {
            const char = row[j];
            if (char === '"') {
                if (inQuote && j + 1 < row.length && row[j+1] === '"') {
                    currentField += '"';
                    j++;
                } else {
                    inQuote = !inQuote;
                }
            } else if (char === ',' && !inQuote) {
                values.push(currentField);
                currentField = '';
            } else {
                currentField += char;
            }
        }
        values.push(currentField);

        const entry = {};
        headers.forEach((header, index) => {
            entry[header] = values[index] !== undefined ? values[index] : '';
        });
        data.push(entry);
    }
    return data;
}
*/
// The actual handleExportData and handleImportData now call functions from import-export.js
async function handleExportData() {
    importExportLoading = true;
    importExportError = '';
    renderApp();
    try {
        // We will call exportAllData from import-export.js, but it returns JSON.
        // If the user expects a single CSV export, we need to convert all data here.
        // For now, I'll provide a combined CSV export.

        const headers = ['Type', 'Name', 'Description', 'AdditionalInfo', 'StartDate', 'StartTime', 'EndDate', 'EndTime', 'Recurrence', 'TaskType', 'IsCompleted'];
        let allData = [];

        getEvents().forEach(event => { // Use getEvents() from data-service
            allData.push({
                Type: 'Event',
                Name: event.name,
                Description: event.description || '',
                AdditionalInfo: event.additionalInfo || '',
                StartDate: event.startDate,
                StartTime: event.startTime || '',
                EndDate: event.endDate || '',
                EndTime: event.endTime || '',
                Recurrence: event.recurrence,
                TaskType: '',
                IsCompleted: event.isCompleted ? 'TRUE' : 'FALSE'
            });
        });

        getTasks().forEach(task => { // Use getTasks() from data-service
            allData.push({
                Type: 'Task',
                Name: task.name,
                Description: task.description || '',
                AdditionalInfo: task.additionalInfo || '',
                StartDate: task.startDate,
                StartTime: task.startTime || '',
                EndDate: task.endDate || '',
                EndTime: task.endTime || '',
                Recurrence: task.recurrence,
                TaskType: task.type || '',
                IsCompleted: task.isCompleted ? 'TRUE' : 'FALSE'
            });
        });

        if (allData.length === 0) {
            allData.push({
                Type: 'Event', Name: 'Sample Event', Description: 'This is a sample event description.', AdditionalInfo: 'Example: Meeting agenda, location details.', StartDate: '2025-07-01', StartTime: '09:00', EndDate: '2025-07-01', EndTime: '10:00', Recurrence: 'none', TaskType: '', IsCompleted: 'FALSE'
            });
            allData.push({
                Type: 'Task', Name: 'Sample Task', Description: 'This is a sample task description.', AdditionalInfo: 'Example: Groceries list, project steps.', StartDate: '2025-07-05', StartTime: '14:00', EndDate: '', EndTime: '', Recurrence: 'weekly', TaskType: 'Groceries', IsCompleted: 'FALSE'
            });
        }

        let csvContent = headers.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',') + '\n';
        allData.forEach(row => {
            const values = headers.map(header => {
                let value = row[header];
                if (value === null || value === undefined) value = '';
                let stringValue = String(value);
                if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                    return `"${stringValue.replace(/"/g, '""')}"`;
                }
                return stringValue;
            });
            csvContent += values.join(',') + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'personal_assistant_data.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast('Data exported successfully to CSV!', 'success');

    } catch (error) {
        console.error('Export failed:', error);
        importExportError = `Export failed: ${error.message}`;
        showToast(`Export failed: ${error.message}`, 'error');
    } finally {
        importExportLoading = false;
        renderApp();
    }
}

async function handleImportData() {
    if (!selectedFile) {
        importExportError = "Please select a CSV file to import.";
        renderApp();
        return;
    }

    importExportLoading = true;
    importExportError = '';
    renderApp();

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const csvString = e.target.result;
            // Use the parseCSV function (which I'll define inside import-export.js)
            const importedData = parseCSV(csvString); // Assuming parseCSV is available or imported

            if (importedData.length === 0) {
                importExportError = "No data found in the CSV file or invalid format.";
                showToast("Import failed: No data found in the CSV file or invalid format.", 'error');
                return;
            }

            const userIdToUse = auth.currentUser?.uid;
            if (!userIdToUse) {
                importExportError = "User not authenticated. Cannot import data.";
                showToast("Import failed: User not authenticated.", 'error');
                return;
            }

            let successfulImports = 0;
            let failedImports = 0;

            // Optional: Show a confirmation before clearing existing data
            showConfirmModal(
                "Confirm Import",
                "Importing new data will REPLACE all your existing events and tasks. Are you sure you want to proceed?",
                async () => {
                    // Clear existing data before importing new data
                    const eventCollectionRef = collection(db, `artifacts/${__app_id}/users/${userIdToUse}/events`);
                    const existingEvents = await getDocs(eventCollectionRef);
                    for (const docSnapshot of existingEvents.docs) {
                        await deleteDoc(docSnapshot.ref);
                    }

                    const taskCollectionRef = collection(db, `artifacts/${__app_id}/users/${userIdToUse}/tasks`);
                    const existingTasks = await getDocs(taskCollectionRef);
                    for (const docSnapshot of existingTasks.docs) {
                        await deleteDoc(docSnapshot.ref);
                    }

                    for (const row of importedData) {
                        const type = row.Type;
                        const name = row.Name;
                        const startDate = row.StartDate;

                        if (!type || !name || !startDate) {
                            console.warn("Skipping row due to missing required fields:", row);
                            failedImports++;
                            continue;
                        }

                        const commonFields = {
                            name: name,
                            description: row.Description || '',
                            additionalInfo: row.AdditionalInfo || '',
                            startDate: startDate,
                            startTime: row.StartTime || '',
                            endDate: row.EndDate || '',
                            endTime: row.EndTime || '',
                            recurrence: row.Recurrence || 'none',
                            // Ensure completedOccurrencesDates is handled correctly for import
                            completedOccurrencesDates: (row.CompletedOccurrencesDates && JSON.parse(row.CompletedOccurrencesDates)) || [],
                            isCompleted: (row.IsCompleted || 'FALSE').toUpperCase() === 'TRUE',
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                        };

                        try {
                            if (type.toLowerCase() === 'event') {
                                const eventData = { ...commonFields };
                                await addDoc(collection(db, `artifacts/${__app_id}/users/${userIdToUse}/events`), eventData);
                                successfulImports++;
                            } else if (type.toLowerCase() === 'task') {
                                const taskData = { ...commonFields, type: row.TaskType || 'Other' };
                                await addDoc(collection(db, `artifacts/${__app_id}/users/${userIdToUse}/tasks`), taskData);
                                successfulImports++;
                            } else {
                                console.warn("Unknown entry type, skipping:", row);
                                failedImports++;
                            }
                        } catch (firestoreError) {
                            console.error("Failed to add document to Firestore:", row, firestoreError);
                            failedImports++;
                        }
                    }

                    showToast(`Import complete: ${successfulImports} items imported, ${failedImports} failed.`, successfulImports > 0 ? 'success' : 'error');
                    if (failedImports > 0) {
                        importExportError = `${failedImports} rows could not be imported. Check console for details.`;
                    }
                    selectedFile = null;
                    closeImportExportModal(); // Close the modal
                    navigateTo('landing'); // Re-render main view to show updated data

                },
                () => { // On Cancel
                    importExportLoading = false;
                    renderApp(); // Just re-render to dismiss loading if any
                    showToast('Import cancelled.', 'info');
                },
                "Yes, Import and Replace",
                "Cancel",
                "bg-red-600 hover:bg-red-700"
            );


        } catch (error) {
            console.error('Error reading or parsing CSV:', error);
            importExportError = `Error processing file: ${error.message}`;
            showToast(`Error processing file: ${error.message}`, 'error');
        } finally {
            importExportLoading = false;
            renderApp();
        }
    };
    reader.onerror = (error) => {
        console.error('File reading error:', error);
        importExportLoading = false;
        importExportError = `Failed to read file: ${error.message}`;
        showToast(`Failed to read file: ${error.message}`, 'error');
        renderApp();
    };
    reader.readAsText(selectedFile);
}


// --- Main Render Orchestrator ---
function renderApp() {
    // Determine which screen to render based on currentView and authentication status
    if (!auth || !auth.currentUser) { // Check Firebase auth state explicitly
        currentView = 'loading'; // Show loading while auth state is being determined
    }
    // Note: The onAuthStateChanged listener in firebase-setup.js will eventually
    // update `currentUser` and switch `currentView` to 'auth' or 'landing'.

    switch (currentView) {
        case 'loading':
            renderLoadingSpinner();
            break;
        case 'auth':
            renderAuthScreenContent();
            break;
        case 'landing':
            renderLandingPage();
            break;
        case 'eventDetail':
            renderEventDetailContent();
            break;
        case 'taskDetail':
            renderTaskDetailContent();
            break;
        default:
            renderLoadingSpinner(); // Fallback
    }

    // Always render modals if their internal state indicates they should be shown
    if (getEventFormModalState()) { // From ui-components.js
        renderEventFormModal(); // From ui-components.js
    } else {
        eventFormModalContainer.innerHTML = '';
    }
    if (getTaskFormModalState()) { // From ui-components.js
        renderTaskFormModal(); // From ui-components.js
    } else {
        taskFormModalContainer.innerHTML = '';
    }
    if (getImportExportModalState()) { // From ui-components.js
        renderImportExportModal(); // From ui-components.js
        renderImportExportModalContent(); // Wire up specific event handlers
    } else {
        importExportModalContainer.innerHTML = '';
    }
    if (showProfileModal) {
        renderProfileModal();
    }
}


// --- Initialization ---
window.onload = () => {
    console.log("Window loaded. Starting app initialization.");

    // 1. Set up callbacks for firebase-setup.js
    setFirebaseRenderCallbacks(renderApp, () => fetchEvents(), () => fetchTasks(), (user) => {
        currentUser = user; // Update app.js's currentUser state
        if (user) {
            currentView = 'landing'; // Switch to landing once authenticated
            fetchUserProfile(user.uid);
        } else {
            currentView = 'auth'; // Switch to auth if not authenticated
        }
        renderApp(); // Trigger re-render after auth state changes
    });

    // 2. Set up callbacks for data-service.js
    setDataCallbacks(handleUpdateEvents, handleUpdateTasks, showToast);

    // 3. Set up callbacks for ui-components.js
    setUICallbacks(triggerAppRender, navigateTo, showToast);

    // 4. Initialize Firebase (this will trigger the onAuthStateChanged listener)
    initializeFirebase();

    // 5. Initial render of the app (will show loading spinner first)
    renderApp();

    // Ensure Lucide icons are created for initial static HTML
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }

    // Mutation Observer to re-create Lucide icons whenever the DOM is updated dynamically
    const observer = new MutationObserver(() => {
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
    });
    observer.observe(appRoot, { childList: true, subtree: true });
    observer.observe(eventFormModalContainer, { childList: true, subtree: true });
    observer.observe(taskFormModalContainer, { childList: true, subtree: true });
    observer.observe(importExportModalContainer, { childList: true, subtree: true });
    observer.observe(confirmModalContainer, { childList: true, subtree: true });
    observer.observe(toastContainer, { childList: true, subtree: true });
};
