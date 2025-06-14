// import-export.js
import { getEvents, getTasks, saveEvent, saveTask } from './data-service.js';
import { showToast } from './ui-components.js'; // Assuming ui-components exports showToast
import { closeImportExportModal } from './ui-components.js'; // Assuming ui-components exports closeImportExportModal
import { db, appId, userId, collection, query, getDocs, deleteDoc, addDoc } from './firebase-setup.js';


/**
 * Exports all events and tasks data to a JSON string.
 * @returns {string} JSON string of all events and tasks.
 */
export const exportAllData = () => {
    const data = {
        events: getEvents().map(({ id, ...rest }) => rest), // Remove Firestore ID for export
        tasks: getTasks().map(({ id, ...rest }) => rest)
    };
    return JSON.stringify(data, null, 2);
};

/**
 * Imports events and tasks data from a JSON string into Firestore.
 * This function will clear existing data before importing.
 * @param {string} jsonData - The JSON string containing events and tasks.
 */
export const importAllData = async (jsonData) => {
    if (!userId) {
        showToast('Authentication error: No user ID. Cannot import data.', 'error');
        return;
    }
    try {
        const data = JSON.parse(jsonData);

        // Import Events
        if (data.events && Array.isArray(data.events)) {
            const eventCollectionRef = collection(db, 'artifacts', appId, 'users', userId, 'events');
            const existingEvents = await getDocs(query(eventCollectionRef));
            for (const doc of existingEvents.docs) {
                await deleteDoc(doc.ref); // Delete existing events
            }
            for (const event of data.events) {
                await addDoc(eventCollectionRef, { ...event, createdAt: new Date() }); // Add new events
            }
            showToast(`Imported ${data.events.length} events.`, 'success');
        }

        // Import Tasks
        if (data.tasks && Array.isArray(data.tasks)) {
            const taskCollectionRef = collection(db, 'artifacts', appId, 'users', userId, 'tasks');
            const existingTasks = await getDocs(query(taskCollectionRef));
            for (const doc of existingTasks.docs) {
                await deleteDoc(doc.ref); // Delete existing tasks
            }
            for (const task of data.tasks) {
                await addDoc(taskCollectionRef, { ...task, createdAt: new Date() }); // Add new tasks
            }
            showToast(`Imported ${data.tasks.length} tasks.`, 'success');
        }
        closeImportExportModal(); // Close modal after successful import
    } catch (error) {
        console.error("Error importing data:", error);
        showToast('Error importing data. Make sure it is valid JSON.', 'error');
    }
};
