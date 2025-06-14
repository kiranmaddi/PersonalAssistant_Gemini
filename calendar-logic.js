// calendar-logic.js

import { getTodayDateString } from './utilities.js'; // Assuming utilities.js contains date helpers
import { getEvents, getTasks } from './data-service.js'; // To get events and tasks for calendar display

/**
 * Calculates the number of days in a given month and year.
 * @param {number} year - The year.
 * @param {number} month - The month (0-indexed, e.g., 0 for January).
 * @returns {number} The number of days in the month.
 */
export const daysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
};

/**
 * Calculates the day of the week for the first day of a given month and year.
 * @param {number} year - The year.
 * @param {number} month - The month (0-indexed, e.g., 0 for January).
 * @returns {number} The day of the week (0 for Sunday, 6 for Saturday).
 */
export const firstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
};

/**
 * Changes the current calendar month by a given offset.
 * This function would typically update a state variable in app.js and trigger a re-render.
 * @param {number} offset - The number of months to change by (e.g., 1 for next month, -1 for previous).
 * @param {Object} currentDate - The current date object being displayed by the calendar.
 * @returns {Date} The new date representing the changed month.
 */
export const changeCalendarMonth = (offset, currentDate) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + offset);
    return newDate; // This new date would typically be used to update the app's state
};

/**
 * Changes the current calendar year by a given offset.
 * This function would typically update a state variable in app.js and trigger a re-render.
 * @param {number} offset - The number of years to change by (e.g., 1 for next year, -1 for previous).
 * @param {Object} currentDate - The current date object being displayed by the calendar.
 * @returns {Date} The new date representing the changed year.
 */
export const changeCalendarYear = (offset, currentDate) => {
    const newDate = new Date(currentDate);
    newDate.setFullYear(newDate.getFullYear() + offset);
    return newDate; // This new date would typically be used to update the app's state
};

/**
 * Handles a click on a specific day in the calendar.
 * This could trigger opening a modal to view/add events for that day.
 * @param {string} dateString - The date string of the clicked day (e.g., 'YYYY-MM-DD').
 * @param {Function} navigateToCallback - Callback from app.js to navigate or open a modal.
 */
export const handleDayClick = (dateString, navigateToCallback) => {
    console.log(`Day clicked: ${dateString}`);
    // Example: navigateToCallback('dayDetail', { date: dateString });
    // This function would typically call a callback passed from app.js to update the main app's state
    // For now, it just logs.
};

/**
 * Generates occurrences for events and tasks within a given month.
 * This is a placeholder for logic that would process recurring events/tasks.
 * @param {number} year - The year.
 * @param {number} month - The month (0-indexed).
 * @param {Array<Object>} allEvents - All events from data service.
 * @param {Array<Object>} allTasks - All tasks from data service.
 * @returns {Object} An object where keys are date strings ('YYYY-MM-DD') and values are arrays of occurrences.
 */
export const generateOccurrencesForMonth = (year, month, allEvents, allTasks) => {
    const occurrences = {};
    const days = daysInMonth(year, month);

    // Placeholder logic for generating occurrences (can be expanded based on recurrence rules)
    for (let day = 1; day <= days; day++) {
        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        occurrences[dateString] = [];

        // Add events occurring on this specific date
        allEvents.forEach(event => {
            if (event.date === dateString) {
                occurrences[dateString].push({ type: 'event', ...event });
            }
        });

        // Add tasks due on this specific date
        allTasks.forEach(task => {
            if (task.dueDate === dateString) {
                occurrences[dateString].push({ type: 'task', ...task });
            }
        });
    }
    return occurrences;
};

/**
 * Renders the calendar view HTML.
 * This function is a placeholder for the full calendar UI generation.
 * It will receive the current date, events, and tasks to populate the calendar.
 * @param {Date} currentDate - The current date object for the calendar month being displayed.
 * @param {Array<Object>} events - Current events data from data-service.
 * @param {Array<Object>} tasks - Current tasks data from data-service.
 * @param {Function} navigateToCallback - Callback from app.js to handle navigation (e.g., day clicks).
 * @returns {string} HTML string for the calendar view.
 */
export const renderCalendarView = (currentDate, events, tasks, navigateToCallback) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth(); // 0-indexed
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    let calendarHtml = `
        <div class="calendar-container bg-white p-6 rounded-lg shadow-md mt-6">
            <div class="calendar-header flex justify-between items-center mb-4">
                <button onclick="window.changeCalendarMonth(-1, ${currentDate.getTime()})" class="px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300">Prev</button>
                <h3 class="text-xl font-semibold">${monthNames[month]} ${year}</h3>
                <button onclick="window.changeCalendarMonth(1, ${currentDate.getTime()})" class="px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300">Next</button>
            </div>
            <div class="grid grid-cols-7 gap-2 text-center font-medium text-gray-700 mb-2">
                ${dayNames.map(day => `<div>${day}</div>`).join('')}
            </div>
            <div class="grid grid-cols-7 gap-2 calendar-grid">
    `;

    const firstDay = firstDayOfMonth(year, month);
    const daysInCurrentMonth = daysInMonth(year, month);

    // Fill leading empty days
    for (let i = 0; i < firstDay; i++) {
        calendarHtml += `<div class="p-2 border rounded-md bg-gray-50 text-gray-400"></div>`;
    }

    // Fill days of the month
    const todayDateString = getTodayDateString();
    const occurrences = generateOccurrencesForMonth(year, month, events, tasks);

    for (let day = 1; day <= daysInCurrentMonth; day++) {
        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateString === todayDateString;
        const dayOccurrences = occurrences[dateString] || [];
        const hasEvents = dayOccurrences.some(o => o.type === 'event');
        const hasTasks = dayOccurrences.some(o => o.type === 'task');

        let dayClasses = "p-2 border rounded-md flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 transition-colors";
        if (isToday) {
            dayClasses += " bg-indigo-100 border-indigo-500 font-bold";
        } else {
            dayClasses += " bg-white border-gray-200";
        }

        let occurrenceIndicators = '';
        if (hasEvents) {
            occurrenceIndicators += `<span class="w-2 h-2 bg-blue-500 rounded-full mt-1" title="Event(s)"></span>`;
        }
        if (hasTasks) {
            occurrenceIndicators += `<span class="w-2 h-2 bg-purple-500 rounded-full mt-1" title="Task(s)"></span>`;
        }


        calendarHtml += `
            <div class="${dayClasses}" onclick="window.handleCalendarDayClick('${dateString}')">
                <span>${day}</span>
                <div class="flex space-x-1">
                    ${occurrenceIndicators}
                </div>
            </div>
        `;
    }

    calendarHtml += `
            </div>
        </div>
    `;
    return calendarHtml;
};
