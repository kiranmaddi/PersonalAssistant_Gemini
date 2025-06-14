// data-service.js
import { db, appId, userId, onSnapshot, collection, query, doc, getDoc, updateDoc, addDoc, deleteDoc } from './firebase-setup.js';

// Internal state for events and tasks
let events = [];
let tasks = [];

// Callbacks to update the main app's state (will be set by app.js)
let updateEventsCallback = (newEvents) => console.warn("updateEventsCallback not set in data-service.js");
let updateTasksCallback = (newTasks) => console.warn("updateTasksCallback not set in data-service.js");
let showToastCallback = (message, type) => console.warn("showToastCallback not set in data-service.js");

export const setDataCallbacks = (updateEventsFn, updateTasksFn, showToastFn) => {
    updateEventsCallback = updateEventsFn;
    updateTasksCallback = updateTasksFn;
    showToastCallback = showToastFn;
};

// Helper to get today's date in YYYY-MM-DD format
const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Firestore data fetching with real-time listeners
export const fetchEvents = () => {
    if (!userId) {
        console.warn("userId not available for fetching events.");
        events = [];
        updateEventsCallback([]);
        return;
    }
    try {
        const q = query(collection(db, 'artifacts', appId, 'users', userId, 'events'));
        onSnapshot(q, (snapshot) => {
            const fetchedEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            events = fetchedEvents;
            updateEventsCallback(fetchedEvents); // Update state in main app
            console.log("Events fetched:", events);
        }, (error) => {
            console.error("Error fetching events:", error);
            showToastCallback('Error fetching events!', 'error');
        });
    } catch (error) {
        console.error("Error setting up event listener:", error);
        showToastCallback('Error setting up event listener!', 'error');
    }
};

export const fetchTasks = () => {
    if (!userId) {
        console.warn("userId not available for fetching tasks.");
        tasks = [];
        updateTasksCallback([]);
        return;
    }
    try {
        const q = query(collection(db, 'artifacts', appId, 'users', userId, 'tasks'));
        onSnapshot(q, (snapshot) => {
            const fetchedTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            tasks = fetchedTasks;
            updateTasksCallback(fetchedTasks); // Update state in main app
            console.log("Tasks fetched:", tasks);
        }, (error) => {
            console.error("Error fetching tasks:", error);
            showToastCallback('Error fetching tasks!', 'error');
        });
    } catch (error) {
        console.error("Error setting up task listener:", error);
        showToastCallback('Error setting up task listener!', 'error');
    }
};

// CRUD Operations for Events
export const saveEvent = async (eventData) => {
    if (!userId) { showToastCallback("Authentication error: No user ID.", "error"); return; }
    try {
        if (eventData.id) {
            // Update existing event
            const { id, ...dataToUpdate } = eventData;
            await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'events', id), dataToUpdate);
            showToastCallback('Event updated successfully!', 'success');
        } else {
            // Add new event
            await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'events'), { ...eventData, createdAt: new Date() });
            showToastCallback('Event added successfully!', 'success');
        }
        // No need to call renderApp() directly here, onSnapshot will handle it.
    } catch (e) {
        console.error("Error saving event: ", e);
        showToastCallback('Error saving event!', 'error');
    }
};

export const deleteEvent = async (id) => {
    if (!userId) { showToastCallback("Authentication error: No user ID.", "error"); return; }
    try {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'events', id));
        showToastCallback('Event deleted successfully!', 'success');
    } catch (e) {
        console.error("Error deleting event: ", e);
        showToastCallback('Error deleting event!', 'error');
    }
};

export const markEventOccurrenceDone = async (id) => {
    if (!userId) { showToastCallback("Authentication error: No user ID.", "error"); return; }
    try {
        const eventRef = doc(db, 'artifacts', appId, 'users', userId, 'events', id);
        const eventDoc = await getDoc(eventRef);
        if (eventDoc.exists()) {
            const eventData = eventDoc.data();
            const completedOccurrences = eventData.completedOccurrences || [];
            const todayDate = getTodayDateString();

            if (!completedOccurrences.includes(todayDate)) {
                completedOccurrences.push(todayDate);
                await updateDoc(eventRef, {
                    completedOccurrences: completedOccurrences,
                });
                showToastCallback('Event occurrence marked as done!', 'success');
            } else {
                showToastCallback('Event occurrence already marked as done for today.', 'info');
            }
        }
    } catch (e) {
        console.error("Error marking event occurrence done: ", e);
        showToastCallback('Error marking event occurrence done!', 'error');
    }
};

// CRUD Operations for Tasks
export const saveTask = async (taskData) => {
    if (!userId) { showToastCallback("Authentication error: No user ID.", "error"); return; }
    try {
        if (taskData.id) {
            // Update existing task
            const { id, ...dataToUpdate } = taskData;
            await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'tasks', id), dataToUpdate);
            showToastCallback('Task updated successfully!', 'success');
        } else {
            // Add new task
            await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'tasks'), { ...taskData, createdAt: new Date() });
            showToastCallback('Task added successfully!', 'success');
        }
        // No need to call renderApp() directly here, onSnapshot will handle it.
    } catch (e) {
        console.error("Error saving task: ", e);
        showToastCallback('Error saving task!', 'error');
    }
};

export const deleteTask = async (id) => {
    if (!userId) { showToastCallback("Authentication error: No user ID.", "error"); return; }
    try {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'tasks', id));
        showToastCallback('Task deleted successfully!', 'success');
    } catch (e) {
        console.error("Error deleting task: ", e);
        showToastCallback('Error deleting task!', 'error');
    }
};

export const markTaskOccurrenceDone = async (id) => {
    if (!userId) { showToastCallback("Authentication error: No user ID.", "error"); return; }
    try {
        const taskRef = doc(db, 'artifacts', appId, 'users', userId, 'tasks', id);
        const taskDoc = await getDoc(taskRef);
        if (taskDoc.exists()) {
            const taskData = taskDoc.data();
            const completedOccurrences = taskData.completedOccurrences || [];
            const todayDate = getTodayDateString();

            if (!completedOccurrences.includes(todayDate)) {
                completedOccurrences.push(todayDate);
                await updateDoc(taskRef, {
                    completedOccurrences: completedOccurrences,
                });
                showToastCallback('Task occurrence marked as done!', 'success');
            } else {
                showToastCallback('Task occurrence already marked as done for today.', 'info');
            }
        }
    } catch (e) {
        console.error("Error marking task occurrence done: ", e);
        showToastCallback('Error marking task occurrence done!', 'error');
    }
};

// Export internal state for reading (will be used by ui-components for rendering)
export const getEvents = () => events;
export const getTasks = () => tasks;
