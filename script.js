// Global variables for App State
let reports = []; 
let editingReportIndex = null; 
let lastAddedReportId = null; 
let collapsedGroups = new Set(); 

// Import Firebase variables and functions from firebase.js
import { 
    db, 
    auth, 
    appId, // Use the exported appId
    initialAuthToken, // Use the exported initialAuthToken
    onAuthStateChanged,
    addDoc, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    onSnapshot, 
    collection, 
    doc, // Import doc specifically for doc references
    signInAnonymously, // Ensure this is explicitly imported
    signInWithCustomToken // Ensure this is explicitly imported
} from './firebase.js'; // Adjust path if firebase.js is in a different folder

// Import FieldValue DIRECTLY from the Firestore SDK to ensure correct serverTimestamp() access
import { FieldValue } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


let currentUserId = null;
// reportsCollectionRef will now point to the PUBLIC collection
let reportsCollectionRef = null; 
let unsubscribeFromReports = null; // To store the unsubscribe function for real-time listener

// Global DOM element references (initialized in DOMContentLoaded)
let filterReporter;
let filterLogType;
let generalTextInput;
let newDateInput; 
let newTimeInput; 
let dateTimeInputsWrapper; 
let mainActionBtn; 
let cancelEditBtn;
let tableBody;
let emptyStateRow;
let loadingStateRow; // New loading state row
let expandAllBtn;
let collapseAllBtn;
let inputErrorMessage;
let userIdDisplay; // New element to display user ID


// --- Auto-resize Textarea Logic ---
const autoResizeTextarea = (textarea) => {
    textarea.style.height = 'auto'; 
    textarea.style.height = (textarea.scrollHeight) + 'px'; 
};

// Sets default date and time in the input fields (used for initial load and after reset)
const setDefaultDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    if (newDateInput) { 
        newDateInput.value = `${year}-${month}-${day}`;
    }
    
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    if (newTimeInput) { 
        newTimeInput.value = `${hours}:${minutes}`; 
    }
};

// Function to validate time format (HH:MM)
const isValidTimeFormat = (timeString) => {
    const pattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return pattern.test(timeString);
};

// Function to format date as DD/MM/YYYY
const formatAsDDMMYYYY = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

// Function to sort reports by date (descending) then time (descending) - operates on an array COPY
const sortChronologically = (arrToSort) => { 
    return [...arrToSort].sort((a, b) => { 
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);

        if (dateA > dateB) return -1; 
        if (dateA < dateB) return 1;  

        // If dates are the same, sort by time (descending)
        if (a.time > b.time) return -1; 
        if (a.time < b.time) return 1;  

        return 0; 
    });
};

// Renders the table content based on the reports array and current sorting rules
const renderTable = () => {
    if (!tableBody) { 
        console.error('tableBody element not found. Cannot render table.');
        return;
    }
    tableBody.innerHTML = ''; // Clear existing table body
    
    // Hide loading state
    if (loadingStateRow) {
        loadingStateRow.classList.add('hidden');
    }

    if (reports.length === 0) {
        if (emptyStateRow) { 
            emptyStateRow.classList.remove('hidden'); // Show empty state
            tableBody.appendChild(emptyStateRow);
        }
        console.log('No reports to display.');
        return;
    } else {
        if (emptyStateRow) {
            emptyStateRow.classList.add('hidden'); // Hide empty state if there are reports
        }
    }

    let finalDisplayList = [...reports]; 

    // Apply hybrid sorting logic:
    // Rule 1: The last NEWLY ADDED report always at the top.
    if (lastAddedReportId) {
        const lastAddedIndex = finalDisplayList.findIndex(report => report.id === lastAddedReportId);
        if (lastAddedIndex !== -1) {
            const [topReport] = finalDisplayList.splice(lastAddedIndex, 1); 
            finalDisplayList.unshift(topReport); 
        } else {
            lastAddedReportId = null; 
        }
    }
    
    // Group reports by date for rendering
    const groupedReports = new Map();
    finalDisplayList.forEach(report => {
        const dateKey = report.date; 
        if (!groupedReports.has(dateKey)) {
            groupedReports.set(dateKey, []);
        }
        groupedReports.get(dateKey).push(report);
    });

    // Sort the date keys for displaying date groups chronologically (descending)
    const sortedDateKeys = Array.from(groupedReports.keys()).sort((a, b) => {
        return new Date(b) - new Date(a);
    });

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;

    sortedDateKeys.forEach(dateKey => {
        const reportsForDate = groupedReports.get(dateKey);
        const isToday = dateKey === todayKey;
        const isCollapsed = collapsedGroups.has(dateKey); 

        // Date Header Row
        const headerRow = document.createElement('tr');
        headerRow.className = 'date-group-header bg-[#F8F5F1] border-b-2 border-[#DCD5CC]';
        headerRow.innerHTML = `
            <td colspan="6" class="p-3 font-bold text-[#6D5F53] text-right">
                <button class="toggle-day-btn text-blue-600 hover:text-blue-800 ml-2" data-toggle-date="${dateKey}">
                    ${isCollapsed ? '◀' : '▼'}
                </button>
                ${formatAsDDMMYYYY(dateKey)}
            </td>
        `;
        tableBody.appendChild(headerRow);

        // Content Rows Wrapper (collapsible)
        const reportsContainerRow = document.createElement('tr');
        reportsContainerRow.className = `date-group-content ${isCollapsed ? 'hidden' : ''}`; 
        reportsContainerRow.dataset.contentDate = dateKey; 

        const reportsCell = document.createElement('td');
        reportsCell.colSpan = 6;
        reportsCell.className = 'p-0'; 

        const innerTable = document.createElement('table'); 
        innerTable.className = 'w-full text-sm';
        const innerTbody = document.createElement('tbody');

        // Render individual report rows inside the inner table
        // Sort reports within the same date group by time (descending)
        const sortedReportsForDate = [...reportsForDate].sort((a, b) => {
            if (a.time > b.time) return -1;
            if (a.time < b.time) return 1;
            return 0;
        });

        sortedReportsForDate.forEach(report => {
            const reportRow = document.createElement('tr');
            reportRow.className = 'hover:bg-[#F8F5F1]';
            reportRow.innerHTML = `
                <td class="table-cell">${report.description.replace(/\n/g, '<br>')}</td>
                <td class="table-cell">${formatAsDDMMYYYY(report.date)}</td>
                <td class="table-cell">${report.time}</td>
                <td class="table-cell">${report.reporter}</td>
                <td class="table-cell">${report.logType}</td>
                <td class="table-cell text-center whitespace-nowrap">
                    <button data-id="${report.id}" class="text-blue-600 hover:text-blue-800 font-semibold edit-btn">ערוך</button>
                    <button data-id="${report.id}" class="text-red-600 hover:text-red-800 font-semibold delete-btn ml-2">מחק</button>
                </td>
            `;
            innerTbody.appendChild(reportRow);
        });

        innerTable.appendChild(innerTbody);
        reportsCell.appendChild(innerTable);
        reportsContainerRow.appendChild(reportsCell);
        tableBody.appendChild(reportsContainerRow);
        
        // Default collapse/expand logic for initial rendering
        // Only collapse if not today AND it's not already in the collapsedGroups set
        if (!isToday && !collapsedGroups.has(dateKey)) {
            collapsedGroups.add(dateKey); // Add to set to mark as collapsed
            reportsContainerRow.classList.add('hidden'); // Hide the content
            const toggleButton = headerRow.querySelector('.toggle-day-btn');
            if (toggleButton) { 
                toggleButton.textContent = '◀'; // Change arrow to indicate collapsed
            }
        }
    });
    
    // Re-attach event listeners for individual toggle buttons after re-rendering the table
    tableBody.querySelectorAll('.toggle-day-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const dateToToggle = e.target.dataset.toggleDate;
            const contentRow = tableBody.querySelector(`tr[data-content-date="${dateToToggle}"]`);
            if (contentRow) {
                contentRow.classList.toggle('hidden');
                if (contentRow.classList.contains('hidden')) {
                    e.target.textContent = '◀';
                    collapsedGroups.add(dateToToggle);
                } else {
                    e.target.textContent = '▼';
                    collapsedGroups.delete(dateToToggle);
                }
            }
        });
    });
    
    console.log('Current reports array (raw data from Firebase):', reports); 
    console.log('Reports displayed in table (after hybrid sorting and grouping):', finalDisplayList);
    console.log('Collapsed Groups State:', collapsedGroups);
};

// Clears the input fields and resets the form to "add new report" mode
const resetForm = () => {
    if (generalTextInput) { 
        generalTextInput.value = '';
        generalTextInput.rows = 3; 
        generalTextInput.style.height = 'auto'; 
        generalTextInput.classList.remove('edit-mode-fixed-height'); 
        autoResizeTextarea(generalTextInput); 
    }

    setDefaultDateTime(); 
    if (generalTextInput) { 
        generalTextInput.focus();
    }
    editingReportIndex = null; 
    if (mainActionBtn) { 
        mainActionBtn.textContent = 'הזן';
    }
    if (cancelEditBtn) { 
        cancelEditBtn.classList.add('hidden');
    }
    if (inputErrorMessage) { 
        inputErrorMessage.textContent = '';
    }
    
    if (dateTimeInputsWrapper) { 
        dateTimeInputsWrapper.classList.add('hidden'); 
    }

    if (newDateInput) { 
        newDateInput.readOnly = false; 
    }
    if (newTimeInput) { 
        newTimeInput.readOnly = false; 
    }
    // No renderTable() here, as onSnapshot will trigger it
};

// Adds a new report to Firestore
const addReport = async () => { 
    if (!generalTextInput || !newDateInput || !newTimeInput || !filterReporter || !filterLogType || !inputErrorMessage || !reportsCollectionRef) {
        console.error('One or more required input elements or Firebase collection reference are not initialized.');
        inputErrorMessage.textContent = 'שגיאה: רכיבי קלט או בסיס נתונים אינם זמינים.';
        setTimeout(() => inputErrorMessage.textContent = '', 5000);
        return;
    }

    const description = generalTextInput.value.trim();
    const date = newDateInput.value; 
    const time = newTimeInput.value; 
    
    const reporter = filterReporter.value; 
    const logType = filterLogType.value;   

    if (!description) { 
        inputErrorMessage.textContent = 'יש למלא את שדה תיאור הדיווח.';
        setTimeout(() => inputErrorMessage.textContent = '', 3000);
        return;
    }

    const newReportData = { 
        description, 
        date, 
        time, 
        reporter, 
        logType,
        creatorId: currentUserId, // Add the ID of the user who created the report
        //createdAt: FieldValue.serverTimestamp() 
    };

    try {
        const docRef = await addDoc(reportsCollectionRef, newReportData);
        console.log("Document written with ID: ", docRef.id);
        lastAddedReportId = docRef.id; // Mark this as the last added report by its Firestore ID
        collapsedGroups.delete(newReportData.date); // Open the group for the newly added report
        resetForm(); 
    } catch (e) {
        console.error("Error adding document: ", e);
        inputErrorMessage.textContent = 'שגיאה בשמירת דיווח: ' + e.message;
        setTimeout(() => inputErrorMessage.textContent = '', 5000);
    }
};

// Updates an existing report in Firestore
const updateReport = async () => { 
    if (!generalTextInput || !newDateInput || !newTimeInput || !filterReporter || !filterLogType || !inputErrorMessage || !reportsCollectionRef || editingReportIndex === null) {
        console.error('One or more required input elements or Firebase collection reference are not initialized for update, or no report is being edited.');
        inputErrorMessage.textContent = 'שגיאה: רכיבי קלט או בסיס נתונים אינם זמינים לעדכון.';
        setTimeout(() => inputErrorMessage.textContent = '', 5000);
        return;
    }

    const description = generalTextInput.value.trim();
    const date = newDateInput.value; 
    const time = newTimeInput.value; 

    const reporter = filterReporter.value; 
    const logType = filterLogType.value;   

    if (!description || !date || !time) { 
        inputErrorMessage.textContent = 'יש למ מלא את כל השדות: תיאור, תאריך ושעה.';
        setTimeout(() => inputErrorMessage.textContent = '', 3000);
        return;
    }
    if (!isValidTimeFormat(time)) { 
        inputErrorMessage.textContent = 'פורמט שעה שגוי. אנא הזן HH:MM (לדוגמה, 14:30).';
        setTimeout(() => inputErrorMessage.textContent = '', 3000);
        return;
    }

    const reportToUpdate = reports[editingReportIndex];
    if (!reportToUpdate || !reportToUpdate.id) {
        console.error('No valid report selected for update or missing ID.');
        inputErrorMessage.textContent = 'שגיאה: לא נבחר דיווח חוקי לעדכון.';
        setTimeout(() => inputErrorMessage.textContent = '', 5000);
        return;
    }

    const updatedReportData = {
        description,
        date,
        time,
        reporter,
        logType,
        // creatorId should remain the same
        // createdAt should not be updated
    };

    try {
        // Use `doc` with `db` and the full path
        const docRef = doc(db, `artifacts/${appId}/public/data/reports`, reportToUpdate.id); // Updated path for public collection
        await setDoc(docRef, updatedReportData, { merge: true }); // Use merge to only update specified fields
        console.log("Document updated with ID: ", reportToUpdate.id);
        lastAddedReportId = null; // Clear last added to ensure full chronological sort is dominant now
        collapsedGroups.delete(reportToUpdate.date); // Open the group for the updated report
        resetForm(); 
    } catch (e) {
        console.error("Error updating document: ", e);
        inputErrorMessage.textContent = 'שגיאה בעדכון דיווח: ' + e.message;
        setTimeout(() => inputErrorMessage.textContent = '', 5000);
    }
};

// Deletes a report from Firestore
const deleteReport = async (reportId) => {
    if (!reportId || !reportsCollectionRef) {
        console.error('Report ID or Firebase collection reference is missing for deletion.');
        return;
    }

    // IMPORTANT: Custom modal UI instead of confirm()
    const confirmDelete = window.confirm('האם אתה בטוח שברצונך למחוק דיווח זה?'); // For quick demo, keeping confirm, replace with custom modal
    if (!confirmDelete) {
        return;
    }

    try {
        const docRef = doc(db, `artifacts/${appId}/public/data/reports`, reportId); // Updated path for public collection
        await deleteDoc(docRef);
        console.log("Document successfully deleted!");
        // No need to manually update `reports` array, onSnapshot will handle it
        resetForm(); // Reset form after deletion
    } catch (e) {
        console.error("Error removing document: ", e);
        inputErrorMessage.textContent = 'שגיאה במחיקת דיווח: ' + e.message;
        setTimeout(() => inputErrorMessage.textContent = '', 5000);
    }
};


// DOMContentLoaded listener - All DOM element references and initial event listeners are set here
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize global DOM element references
    filterReporter = document.getElementById('filterReporter');
    filterLogType = document.getElementById('filterLogType');
    generalTextInput = document.getElementById('generalTextInput');
    newDateInput = document.getElementById('newDate'); 
    newTimeInput = document.getElementById('newTime'); 
    dateTimeInputsWrapper = document.getElementById('dateTimeInputsWrapper'); 
    mainActionBtn = document.getElementById('mainActionBtn'); 
    cancelEditBtn = document.getElementById('cancelEditBtn');
    tableBody = document.getElementById('reportTableBody');
    emptyStateRow = document.getElementById('empty-state');
    loadingStateRow = document.getElementById('loading-state'); // Get loading state row
    inputErrorMessage = document.getElementById('inputErrorMessage');
    expandAllBtn = document.getElementById('expandAllBtn'); 
    collapseAllBtn = document.getElementById('collapseAllBtn'); 
    userIdDisplay = document.getElementById('userIdDisplay'); // Get user ID display element

    // --- Firebase Initialization (auth state listener) ---
    // The Firebase app itself is initialized in firebase.js.
    // Here we set up the auth state listener using the 'auth' object imported from firebase.js.
    if (!auth || !db) {
        console.error('Firebase Auth or Firestore not initialized. Check firebase.js for errors.');
        inputErrorMessage.textContent = 'שגיאה: Firebase לא אותחל באופן מלא.';
        return;
    }

    // Display loading state initially
    if (loadingStateRow) {
        loadingStateRow.classList.remove('hidden');
    }
    if (emptyStateRow) {
        emptyStateRow.classList.add('hidden');
    }

    // --- Add console logs for immediate debugging of imports ---
    console.log('script.js: db imported?', !!db);
    console.log('script.js: auth imported?', !!auth);
    console.log('script.js: signInAnonymously imported?', !!signInAnonymously);
    console.log('script.js: signInWithCustomToken imported?', !!signInWithCustomToken);
    console.log('script.js: FieldValue imported?', !!FieldValue);


    // Listen for auth state changes using the imported onAuthStateChanged
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserId = user.uid;
            console.log('User signed in. UID:', currentUserId);
            if (userIdDisplay) {
                userIdDisplay.textContent = `מחובר כ: ${currentUserId}`;
            }

            // Set up Firestore collection reference for the PUBLIC collection
            reportsCollectionRef = collection(db, `artifacts/${appId}/public/data/reports`);
            console.log('Reports collection path (PUBLIC):', `artifacts/${appId}/public/data/reports`);

            // Unsubscribe from previous listener if exists
            if (unsubscribeFromReports) {
                unsubscribeFromReports();
            }

            // Set up real-time listener for reports
            unsubscribeFromReports = onSnapshot(reportsCollectionRef, (snapshot) => {
                const fetchedReports = [];
                snapshot.forEach(doc => {
                    fetchedReports.push({ id: doc.id, ...doc.data() });
                });
                reports = sortChronologically(fetchedReports); // Sort data after fetching
                console.log('Reports fetched and sorted:', reports);
                renderTable(); // Re-render table with fetched data
            }, (error) => {
                console.error("Error getting reports in real-time: ", error);
                inputErrorMessage.textContent = 'שגיאה בטעינת דיווחים: ' + error.message;
            });

        } else {
            console.log('No user signed in. Attempting anonymous sign-in...');
            if (userIdDisplay) {
                userIdDisplay.textContent = 'מצב אורח (טוען...)';
            }
            try {
                if (initialAuthToken) {
                    await signInWithCustomToken(auth, initialAuthToken);
                } else {
                    await signInAnonymously(auth); 
                }
            } catch (error) {
                console.error('Error signing in:', error);
                inputErrorMessage.textContent = 'שגיאה בהתחברות: ' + error.message;
                if (userIdDisplay) {
                    userIdDisplay.textContent = 'מצב אורח (שגיאת התחברות)';
                }
                // If sign-in fails, hide loading and show empty state
                if (loadingStateRow) loadingStateRow.classList.add('hidden');
                if (emptyStateRow) emptyStateRow.classList.remove('hidden');
            }
        }
    });

    // --- Attach Event Listeners (after DOM elements are initialized) ---

    // Handle the click on the main action button (Add/Update)
    if (mainActionBtn) { 
        mainActionBtn.addEventListener('click', () => {
            if (editingReportIndex === null) {
                addReport();
            } else {
                updateReport();
            }
        });
    } else {
        console.error('mainActionBtn element not found! Cannot attach event listener.');
    }

    // Handle the click on the cancel edit button
    if (cancelEditBtn) { 
        cancelEditBtn.addEventListener('click', resetForm);
    } else {
        console.error('cancelEditBtn element not found! Cannot attach event listener.');
    }

    // Attach global expand/collapse buttons listeners
    if (expandAllBtn) {
        expandAllBtn.addEventListener('click', () => {
            collapsedGroups.clear(); 
            document.querySelectorAll('.date-group-content').forEach(div => {
                div.classList.remove('hidden'); 
            });
            document.querySelectorAll('.toggle-day-btn').forEach(button => {
                button.textContent = '▼'; 
            });
        });
    } else {
        console.error('expandAllBtn element not found!');
    }

    if (collapseAllBtn) {
        collapseAllBtn.addEventListener('click', () => {
            collapsedGroups.clear(); 
            // Get all unique dates currently in the reports array
            const allDateKeysInTable = Array.from(new Set(reports.map(r => r.date)));
            allDateKeysInTable.forEach(key => collapsedGroups.add(key));

            document.querySelectorAll('.date-group-content').forEach(div => {
                div.classList.add('hidden'); 
            });
            document.querySelectorAll('.toggle-day-btn').forEach(button => {
                button.textContent = '◀'; 
            });
        });
    } else {
        console.error('collapseAllBtn element not found!');
    }

    // Event delegation for table actions (edit and delete)
    if (tableBody) { 
        tableBody.addEventListener('click', (e) => {
            // Edit button
            if (e.target.classList.contains('edit-btn')) {
                const reportIdToEdit = e.target.getAttribute('data-id');
                const index = reports.findIndex(report => report.id === reportIdToEdit);
                
                if (index === -1) {
                    console.error('Report not found for editing:', reportIdToEdit);
                    return;
                }

                const reportToEdit = reports[index];
                
                // Populate inputs with report data
                if (generalTextInput) generalTextInput.value = reportToEdit.description;
                if (newDateInput) newDateInput.value = reportToEdit.date;
                if (newTimeInput) newTimeInput.value = reportToEdit.time; 
                if (filterReporter) filterReporter.value = reportToEdit.reporter; 
                if (filterLogType) filterLogType.value = reportToEdit.logType;   
                
                editingReportIndex = index; 
                if (mainActionBtn) mainActionBtn.textContent = 'עדכן דיווח'; 
                if (cancelEditBtn) cancelEditBtn.classList.remove('hidden'); 
                
                // SHOW date and time inputs when editing
                if (dateTimeInputsWrapper) dateTimeInputsWrapper.classList.remove('hidden'); 

                // Set textarea to fixed height for edit mode
                if (generalTextInput) {
                    generalTextInput.rows = 5; 
                    generalTextInput.style.height = 'auto'; 
                    generalTextInput.classList.add('edit-mode-fixed-height'); 
                }

                if (newDateInput) newDateInput.readOnly = false; 
                if (newTimeInput) newTimeInput.readOnly = false; 

                if (generalTextInput) generalTextInput.focus(); 
            }
            // Delete button
            else if (e.target.classList.contains('delete-btn')) {
                const reportIdToDelete = e.target.getAttribute('data-id');
                deleteReport(reportIdToDelete);
            }
        });
    } else {
        console.error('tableBody element not found! Cannot attach event delegation for edit/delete.');
    }

    // Initialize default date and time
    setDefaultDateTime();
    // resetForm() is called initially, but renderTable is now driven by onSnapshot
    // resetForm() will ensure inputs are clear after initialization
    resetForm(); 
});
