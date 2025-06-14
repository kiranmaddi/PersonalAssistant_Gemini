// utilities.js

/**
 * Returns today's date in 'YYYY-MM-DD' format.
 * @returns {string} The current date as a string.
 */
export const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
