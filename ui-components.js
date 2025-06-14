// ui-components.js
import { saveEvent, deleteEvent, markEventOccurrenceDone, saveTask, deleteTask, markTaskOccurrenceDone } from './data-service.js';
import { getEvents, getTasks } from './data-service.js'; // To access data for export function placeholder
import { getTodayDateString } from './utilities.js'; // Import utility function

// Internal state for modals
let showEventFormModalState = false;
let editingEventState = null;
let showTaskFormModalState = false;
let editingTaskState = null;
let showImportExportModalState = false;

// Callbacks from app.js to trigger re-rendering or other app-wide state changes
let renderAppCallback = () => console.warn("renderAppCallback not set in ui-components.js");
let navigateToCallback = (view, data) => console.warn("navigateToCallback not set in ui-components.js"); // To handle navigation like opening detail views
let showToastCallback = (message, type) => console.warn("showToastCallback not set in ui-components.js"); // Callback for toasts

/**
 * Sets the callback functions for UI interactions.
 * These callbacks allow UI components to trigger actions in the main application logic.
 * @param {Function} renderAppFn - Function to trigger a re-render of the main app.
 * @param {Function} navigateToFn - Function to handle navigation within the app.
 * @param {Function} showToastFn - Function to display a toast notification.
 */
export const setUICallbacks = (renderAppFn, navigateToFn, showToastFn) => {
    renderAppCallback = renderAppFn;
    navigateToCallback = navigateToFn;
    showToastCallback = showToastFn;
};

// --- Common UI Classes ---
// Reusable Tailwind CSS classes for consistent styling
const commonInputClass = "w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow";
const commonButtonClass = "w-full py-3 px-4 rounded-lg text-white font-semibold transition-all duration-300 ease-in-out";
const commonLabelClass = "block text-sm font-medium text-slate-600 mb-1";

// --- Notification Message Function ---
// Tracks timeout ID to clear previous notifications if a new one appears quickly
let notificationTimeoutId = null;
/**
 * Displays a toast notification on the screen.
 * @param {string} message - The message to display.
 * @param {'success'|'error'|'info'} type - The type of notification (determines color).
 */
export function showToast(message, type = 'success') {
    if (notificationTimeoutId) {
        clearTimeout(notificationTimeoutId);
    }

    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        console.error('Toast container not found!');
        return;
    }

    const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-gray-700';
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 p-3 rounded-md shadow-lg text-white ${bgColor} animate-modalEnter`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    notificationTimeoutId = setTimeout(() => {
        toast.remove();
    }, 3000);
}

// --- Confirm Modal Function ---
/**
 * Displays a confirmation modal to the user.
 * @param {string} title - The title of the modal.
 * @param {string} message - The message to display in the modal body.
 * @param {Function} onConfirmCallback - Callback function to execute when the 'Confirm' button is clicked.
 * @param {Function} onCancelCallback - Callback function to execute when the 'Cancel' button is clicked or modal is closed.
 * @param {string} [confirmText='Confirm'] - Text for the confirm button.
 * @param {string} [cancelText='Cancel'] - Text for the cancel button.
 * @param {string} [confirmButtonClass='bg-blue-600 hover:bg-blue-700'] - Tailwind CSS classes for the confirm button.
 */
export function showConfirmModal(title, message, onConfirmCallback, onCancelCallback, confirmText = "Confirm", cancelText = "Cancel", confirmButtonClass = "bg-blue-600 hover:bg-blue-700") {
    const confirmModalContainer = document.getElementById('confirm-modal-container');
    if (!confirmModalContainer) {
        console.error('Confirm modal container not found!');
        return;
    }

    confirmModalContainer.innerHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
            <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md animate-modalEnter">
                <h3 class="text-xl font-semibold text-slate-800 mb-4">${title}</h3>
                <p class="text-slate-600 mb-6">${message}</p>
                <div class="flex justify-end space-x-3">
                    <button id="confirm-modal-cancel"
                        class="px-4 py-2 rounded-md text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                        ${cancelText}
                    </button>
                    <button id="confirm-modal-confirm"
                        class="px-4 py-2 rounded-md text-sm font-medium text-white transition-colors ${confirmButtonClass}"
                    >
                        ${confirmText}
                    </button>
                </div>
            </div>
        </div>
    `;

    // Function to close the modal by clearing its HTML
    const closeModal = () => {
        confirmModalContainer.innerHTML = '';
    };

    // Event listeners for confirm and cancel buttons
    document.getElementById('confirm-modal-cancel').onclick = () => {
        onCancelCallback();
        closeModal();
    };
    document.getElementById('confirm-modal-confirm').onclick = () => {
        onConfirmCallback();
        closeModal();
    };
    // Re-create Lucide icons if any are present in the modal's HTML
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}


// --- Modal Control Functions (called by app.js to show/hide modals) ---
/**
 * Opens the event form modal, optionally pre-filling it for editing an existing event.
 * Triggers a re-render of the main app to display the modal.
 * @param {Object|null} event - The event object to edit, or null for a new event.
 */
export const openEventFormModal = (event = null) => {
    editingEventState = event;
    showEventFormModalState = true;
    renderAppCallback(); // Request re-render from main app
};

/**
 * Closes the event form modal.
 * Triggers a re-render of the main app to hide the modal.
 */
export const closeEventFormModal = () => {
    showEventFormModalState = false;
    editingEventState = null;
    renderAppCallback(); // Request re-render from main app
};

/**
 * Opens the task form modal, optionally pre-filling it for editing an existing task.
 * Triggers a re-render of the main app to display the modal.
 * @param {Object|null} task - The task object to edit, or null for a new task.
 */
export const openTaskFormModal = (task = null) => {
    editingTaskState = task;
    showTaskFormModalState = true;
    renderAppCallback(); // Request re-render from main app
};

/**
 * Closes the task form modal.
 * Triggers a re-render of the main app to hide the modal.
 */
export const closeTaskFormModal = () => {
    showTaskFormModalState = false;
    editingTaskState = null;
    renderAppCallback(); // Request re-render from main app
};

/**
 * Opens the import/export modal.
 * Triggers a re-render of the main app to display the modal.
 */
export const openImportExportModal = () => {
    showImportExportModalState = true;
    renderAppCallback(); // Request re-render from main app
};

/**
 * Closes the import/export modal.
 * Triggers a re-render of the main app to hide the modal.
 */
export const closeImportExportModal = () => {
    showImportExportModalState = false;
    renderAppCallback(); // Request re-render from main app
};

// --- Render Modals ---

/**
 * Renders the event form modal into its designated container.
 * This function should be called by the main app's render cycle when showEventFormModalState is true.
 */
export const renderEventFormModal = () => {
    const container = document.getElementById('event-form-modal-container');
    if (!showEventFormModalState) {
        container.innerHTML = ''; // Clear container if modal is not active
        return;
    }

    const title = editingEventState ? 'Edit Event' : 'Add New Event';
    const event = editingEventState || { title: '', description: '', date: '', time: '' };
    container.innerHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-modalEnter">
            <div class="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg relative">
                <h2 class="text-2xl font-bold mb-6 text-gray-800">${title}</h2>
                <button id="close-event-form-modal-btn" class="absolute top-4 right-4 text-gray-500 hover:text-gray-700">
                    <i data-lucide="x" class="w-6 h-6"></i>
                </button>
                <form id="eventForm" class="space-y-4">
                    <div>
                        <label for="eventTitle" class="block text-sm font-medium text-gray-700">Title</label>
                        <input type="text" id="eventTitle" value="${event.title}" required
                            class="${commonInputClass}">
                    </div>
                    <div>
                        <label for="eventDescription" class="block text-sm font-medium text-gray-700">Description</label>
                        <textarea id="eventDescription"
                            class="${commonInputClass}">${event.description}</textarea>
                    </div>
                    <div>
                        <label for="eventDate" class="block text-sm font-medium text-gray-700">Date</label>
                        <input type="date" id="eventDate" value="${event.date}" required
                            class="${commonInputClass}">
                    </div>
                    <div>
                        <label for="eventTime" class="block text-sm font-medium text-gray-700">Time (Optional)</label>
                        <input type="time" id="eventTime" value="${event.time}"
                            class="${commonInputClass}">
                    </div>
                    <div class="flex justify-end space-x-3">
                        <button type="button" id="cancel-event-form-btn"
                            class="px-5 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition duration-300">
                            Cancel
                        </button>
                        <button type="submit"
                            class="px-5 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition duration-300">
                            Save Event
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    // Attach event listeners directly
    document.getElementById('close-event-form-modal-btn').onclick = closeEventFormModal;
    document.getElementById('cancel-event-form-btn').onclick = closeEventFormModal;

    document.getElementById('eventForm').onsubmit = (e) => {
        e.preventDefault();
        const id = editingEventState ? editingEventState.id : null;
        const eventData = {
            id: id,
            title: document.getElementById('eventTitle').value,
            description: document.getElementById('eventDescription').value,
            date: document.getElementById('eventDate').value,
            time: document.getElementById('eventTime').value,
            completedOccurrences: editingEventState ? editingEventState.completedOccurrences || [] : []
        };
        // Call the saveEvent function from data-service.js
        saveEvent(eventData);
        // The modal will be closed by the success callback in saveEvent (which triggers renderAppCallback)
    };
    // Ensure Lucide icons are created within the newly rendered modal content
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
};

/**
 * Renders the task form modal into its designated container.
 * This function should be called by the main app's render cycle when showTaskFormModalState is true.
 */
export const renderTaskFormModal = () => {
    const container = document.getElementById('task-form-modal-container');
    if (!showTaskFormModalState) {
        container.innerHTML = ''; // Clear container if modal is not active
        return;
    }

    const title = editingTaskState ? 'Edit Task' : 'Add New Task';
    const task = editingTaskState || { title: '', description: '', dueDate: '', dueTime: '', priority: 'medium' };
    container.innerHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-modalEnter">
            <div class="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg relative">
                <h2 class="text-2xl font-bold mb-6 text-gray-800">${title}</h2>
                <button id="close-task-form-modal-btn" class="absolute top-4 right-4 text-gray-500 hover:text-gray-700">
                    <i data-lucide="x" class="w-6 h-6"></i>
                </button>
                <form id="taskForm" class="space-y-4">
                    <div>
                        <label for="taskTitle" class="block text-sm font-medium text-gray-700">Title</label>
                        <input type="text" id="taskTitle" value="${task.title}" required
                            class="${commonInputClass}">
                    </div>
                    <div>
                        <label for="taskDescription" class="block text-sm font-medium text-gray-700">Description</label>
                        <textarea id="taskDescription"
                            class="${commonInputClass}">${task.description}</textarea>
                    </div>
                    <div>
                        <label for="taskDueDate" class="block text-sm font-medium text-gray-700">Due Date</label>
                        <input type="date" id="taskDueDate" value="${task.dueDate}"
                            class="${commonInputClass}">
                    </div>
                    <div>
                        <label for="taskDueTime" class="block text-sm font-medium text-gray-700">Due Time (Optional)</label>
                        <input type="time" id="taskDueTime" value="${task.dueTime}"
                            class="${commonInputClass}">
                    </div>
                    <div>
                        <label for="taskPriority" class="block text-sm font-medium text-gray-700">Priority</label>
                        <select id="taskPriority"
                            class="${commonInputClass}">
                            <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
                            <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Medium</option>
                            <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
                        </select>
                    </div>
                    <div class="flex justify-end space-x-3">
                        <button type="button" id="cancel-task-form-btn"
                            class="px-5 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition duration-300">
                            Cancel
                        </button>
                        <button type="submit"
                            class="px-5 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition duration-300">
                            Save Task
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    // Attach event listeners directly
    document.getElementById('close-task-form-modal-btn').onclick = closeTaskFormModal;
    document.getElementById('cancel-task-form-btn').onclick = closeTaskFormModal;

    document.getElementById('taskForm').onsubmit = (e) => {
        e.preventDefault();
        const id = editingTaskState ? editingTaskState.id : null;
        const taskData = {
            id: id,
            title: document.getElementById('taskTitle').value,
            description: document.getElementById('taskDescription').value,
            dueDate: document.getElementById('taskDueDate').value,
            dueTime: document.getElementById('taskDueTime').value,
            priority: document.getElementById('taskPriority').value,
            completedOccurrences: editingTaskState ? editingTaskState.completedOccurrences || [] : []
        };
        // Call the saveTask function from data-service.js
        saveTask(taskData);
        // The modal will be closed by the success callback in saveTask (which triggers renderAppCallback)
    };
    // Ensure Lucide icons are created within the newly rendered modal content
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
};

/**
 * Renders the import/export modal into its designated container.
 * This function should be called by the main app's render cycle when showImportExportModalState is true.
 * Note: The actual import/export logic is delegated to `import-export.js`.
 */
export const renderImportExportModal = () => {
    const container = document.getElementById('import-export-modal-container');
    if (!showImportExportModalState) {
        container.innerHTML = ''; // Clear container if modal is not active
        return;
    }
    
    // These functions will be linked to import-export.js later by app.js or directly by event listeners here
    // For now, they are placeholders or call directly if logic is simple and can be fully contained here.

    container.innerHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-modalEnter">
            <div class="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg relative">
                <h2 class="text-2xl font-bold mb-6 text-gray-800">Import/Export Data</h2>
                <button id="close-import-export-modal-btn" class="absolute top-4 right-4 text-gray-500 hover:text-gray-700">
                    <i data-lucide="x" class="w-6 h-6"></i>
                </button>
                <div class="space-y-4">
                    <div>
                        <label for="importExportData" class="block text-sm font-medium text-gray-700">JSON Data</label>
                        <textarea id="importExportData" rows="10"
                            class="${commonInputClass}"></textarea>
                    </div>
                    <div class="flex justify-end space-x-3">
                        <button type="button" id="export-data-btn"
                            class="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-300">
                            Export Data
                        </button>
                        <button type="button" id="import-data-btn"
                            class="px-5 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition duration-300">
                            Import Data
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    // Attach event listeners directly
    document.getElementById('close-import-export-modal-btn').onclick = closeImportExportModal;
    // The actual export/import logic will be attached by `index.html` (or `app.js`) from `import-export.js`
    // This allows `ui-components.js` to remain focused purely on rendering the UI.
    // The `index.html` will grab the buttons and assign the functions from `import-export.js`.
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
};

// --- Render Individual Items ---
/**
 * Renders a single event item as an HTML string.
 * Includes buttons for marking as done, editing, and deleting, which call data-service functions.
 * @param {Object} event - The event object containing details like title, description, date, etc.
 * @returns {string} HTML string representing the event item.
 */
export const renderEventItem = (event) => {
    const todayDate = getTodayDateString(); // Using the utility function
    const isEventOccurrenceCompletedToday = (event.completedOccurrences || []).includes(todayDate);

    return `
        <div class="bg-white p-6 rounded-lg shadow-md flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 md:space-x-4">
            <div class="flex-grow">
                <h3 class="text-xl font-semibold text-gray-800">${event.title}</h3>
                <p class="text-gray-600 mt-1">${event.description}</p>
                <p class="text-sm text-gray-500 mt-2">Date: ${event.date} ${event.time ? `at ${event.time}` : ''}</p>
            </div>
            <div class="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full md:w-auto">
                <button onclick="window.markEventOccurrenceDone('${event.id}')"
                    class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md transition duration-300
                    ${isEventOccurrenceCompletedToday ? 'opacity-50 cursor-not-allowed' : ''}"
                    ${isEventOccurrenceCompletedToday ? 'disabled' : ''}>
                    Mark Today's Occurrence Done
                </button>
                <button onclick="window.openEventFormModal(${JSON.stringify(event).replace(/'/g, "&apos;")})"
                    class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition duration-300">
                    Edit
                </button>
                <button onclick="window.deleteEvent('${event.id}')"
                    class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md transition duration-300">
                    Delete
                </button>
            </div>
        </div>
    `;
};

/**
 * Renders a single task item as an HTML string.
 * Includes buttons for marking as done, editing, and deleting, which call data-service functions.
 * @param {Object} task - The task object containing details like title, description, due date, priority, etc.
 * @returns {string} HTML string representing the task item.
 */
export const renderTaskItem = (task) => {
    const todayDate = getTodayDateString(); // Using the utility function
    const isTaskOccurrenceCompletedToday = (task.completedOccurrences || []).includes(todayDate);

    let priorityColor = '';
    if (task.priority === 'high') priorityColor = 'text-red-600';
    else if (task.priority === 'medium') priorityColor = 'text-yellow-600';
    else priorityColor = 'text-green-600';

    return `
        <div class="bg-white p-6 rounded-lg shadow-md flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 md:space-x-4">
            <div class="flex-grow">
                <h3 class="text-xl font-semibold text-gray-800">${task.title}</h3>
                <p class="text-gray-600 mt-1">${task.description}</p>
                <p class="text-sm text-gray-500 mt-2">Due: ${task.dueDate} ${task.dueTime ? `at ${task.dueTime}` : ''} | Priority: <span class="${priorityColor} font-medium">${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}</span></p>
            </div>
            <div class="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full md:w-auto">
                <button onclick="window.markTaskOccurrenceDone('${task.id}')"
                    class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md transition duration-300
                    ${isTaskOccurrenceCompletedToday ? 'opacity-50 cursor-not-allowed' : ''}"
                    ${isTaskOccurrenceCompletedToday ? 'disabled' : ''}>
                    Mark Today's Occurrence Done
                </button>
                <button onclick="window.openTaskFormModal(${JSON.stringify(task).replace(/'/g, "&apos;")})"
                    class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition duration-300">
                    Edit
                </button>
                <button onclick="window.deleteTask('${task.id}')"
                    class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md transition duration-300">
                    Delete
                </button>
            </div>
        </div>
    `;
};

// --- Getters for Modal State (used by app.js to determine what to render) ---
export const getEventFormModalState = () => showEventFormModalState;
export const getEditingEventState = () => editingEventState;
export const getTaskFormModalState = () => showTaskFormModalState;
export const getEditingTaskState = () => editingTaskState;
export const getImportExportModalState = () => showImportExportModalState;
