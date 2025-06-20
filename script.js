// Global variables for App State
let reports = []; 
let editingReportIndex = null; 
let lastAddedReportId = null; 
let collapsedGroups = new Set(); 
let currentUserId = null;

// --- Firebase Imports ---
import { 
    db, 
    auth, 
    appId, 
    onAuthStateChanged,
    addDoc, 
    setDoc, 
    onSnapshot, 
    collection, 
    doc, 
    signInAnonymously, 
    signInWithEmailAndPassword, 
    signOut,
    deleteDoc, 
    initialAuthToken, 
    getDocs, 
    query, 
    where,
    writeBatch,
    updateDoc // Added updateDoc for editing existing reporters
} from './firebase.js'; 

// Firestore collection references
let reportsCollectionRef = null; 
let reportersCollectionRef = null;
let tasksCompletionCollectionRef = null; 
let logTypesCollectionRef = null; // New: Reference for log types collection

// Unsubscribe functions for real-time listeners
let unsubscribeFromReports = null; 
let unsubscribeFromReporters = null; 
let unsubscribeFromTasksCompletion = null; 
let unsubscribeFromLogTypes = null; // New: Unsubscribe for log types

// Global state for tasks completion (client-side cache)
let completedTasks = {}; 

// Global state for defined task types (log types) and their tasks
let definedLogTypes = []; // Array of log type objects: { name: "שגרה", tasks: [] }

// New global promise to signal when Firebase auth state is initially determined
let firebaseAuthReadyResolve;
const firebaseAuthReady = new Promise(resolve => {
    firebaseAuthReadyResolve = resolve;
});


// --- Global DOM element references ---
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
let loadingStateRow; 
let expandAllBtn;
let collapseAllBtn;
let inputErrorMessage;

// Login Page DOM references
let loginPage;
let appContent;
let loginEmailInput;
let loginPasswordInput;
let loginBtn;
let loginErrorMessage;
let logoutBtn;

// Header Menu & Buttons
let menuToggleBtn; 
let headerMenu;     
let searchLogBtn;   
let searchInput;    
let exportExcelBtn; 
let importExcelBtn; 
let editReportersBtn; 
let taskButtonsContainer; 
let manageTaskSettingsBtn; 

// Clock DOM references
let currentTimeDisplay;
let assessmentTimeDisplay;
let assessmentTimePlusBtn;
let assessmentTimeMinusBtn;

// Clock state variables
let assessmentTime = new Date(); 
let assessmentTimeIsManual = false; 

// Tasks Panel DOM references
let tasksPanel;
let closeTasksPanelBtn;
let tasksLogTypeDisplay;
let tasksList;
let allTasksCompletedMessage;

// Reporters Modal DOM references
let reportersModal;
let closeReportersModalBtn; 
let newReporterNameInput;
let addReporterBtn;
let reportersListUl;
let reporterErrorMessage;

// Custom Task Settings Modal DOM references
let taskSettingsModal;
let closeTaskSettingsModalBtn;
let selectTaskTypeForSettings;
let newTaskTypeInput; // New: Input for new task type name
let addNewTaskTypeBtn; // New: Button for adding new task type
let currentTasksForSettings;
let newTaskItemInput;
let addTaskItemBtn;


// Custom Alert DOM references
let customAlert;
let customAlertMessage;
let customAlertCloseBtn;


// --- UI State Management ---
const showLoginPage = () => {
    if (loginPage) loginPage.classList.remove('hidden');
    if (appContent) {
        appContent.classList.add('hidden');
        appContent.classList.remove('app-content-shifted'); 
    }
    if (tasksPanel) tasksPanel.classList.remove('is-open'); // Ensure tasks panel is closed
    if (tasksPanel) tasksPanel.classList.add('hidden'); // Ensure tasks panel is hidden on login page
    if (headerMenu) headerMenu.classList.remove('open');
};

const showAppContent = () => {
    if (loginPage) loginPage.classList.add('hidden');
    if (appContent) appContent.classList.remove('hidden');
};

const showCustomAlert = (message) => {
    if (customAlert && customAlertMessage) {
        customAlertMessage.textContent = message;
        customAlert.classList.remove('hidden');
    }
};

const autoResizeTextarea = (textarea) => {
    textarea.style.height = 'auto'; 
    textarea.style.height = (textarea.scrollHeight) + 'px'; 
};

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

const isValidTimeFormat = (timeString) => {
    const pattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return pattern.test(timeString);
};

const formatAsDDMMYYYY = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

const sortChronologically = (arrToSort) => { 
    return [...arrToSort].sort((a, b) => { 
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);

        if (dateA > dateB) return -1; 
        if (dateA < dateB) return 1;  

        if (a.time > b.time) return -1; 
        if (a.time < b.time) return 1;  

        return 0; 
    });
};

const renderTable = (searchTerm = '') => {
    if (!tableBody) { 
        console.error('tableBody element not found. Cannot render table.');
        return;
    }
    tableBody.innerHTML = ''; 
    
    if (loadingStateRow) {
        loadingStateRow.classList.add('hidden');
    }

    let currentDisplayReports = [...reports]; 

    if (searchTerm) {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        currentDisplayReports = currentDisplayReports.filter(report => 
            report.description.toLowerCase().includes(lowerCaseSearchTerm) ||
            report.reporter.toLowerCase().includes(lowerCaseSearchTerm) ||
            report.logType.toLowerCase().includes(lowerCaseSearchTerm)
        );
    }

    if (lastAddedReportId && !searchTerm) { 
        const lastAddedIndex = currentDisplayReports.findIndex(report => report.id === lastAddedReportId);
        if (lastAddedIndex !== -1) {
            const [topReport] = currentDisplayReports.splice(lastAddedIndex, 1); 
            currentDisplayReports.unshift(topReport); 
        }
        lastAddedReportId = null; 
    }
    
    if (currentDisplayReports.length === 0) {
        if (emptyStateRow) { 
            // Updated colspan to reflect 5 columns (on desktop) or 3 (on mobile)
            const colspan = window.innerWidth <= 639 ? 3 : 5; 
            emptyStateRow.querySelector('td').setAttribute('colspan', colspan);

            emptyStateRow.classList.remove('hidden'); 
            tableBody.appendChild(emptyStateRow);
        }
        console.log('No reports to display.');
        return;
    } else {
        if (emptyStateRow) {
            emptyStateRow.classList.add('hidden'); 
        }
    }

    const groupedReports = new Map();
    currentDisplayReports.forEach(report => {
        const dateKey = report.date; 
        if (!groupedReports.has(dateKey)) {
            groupedReports.set(dateKey, { reports: [], logTypes: new Set() });
        }
        groupedReports.get(dateKey).reports.push(report);
        groupedReports.get(dateKey).logTypes.add(report.logType);
    });

    const sortedDateKeys = Array.from(groupedReports.keys()).sort((a, b) => {
        return new Date(b) - new Date(a);
    });

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;

    sortedDateKeys.forEach(dateKey => {
        const { reports: reportsForDate, logTypes } = groupedReports.get(dateKey);
        const isToday = dateKey === todayKey;
        const isCollapsed = searchTerm ? false : collapsedGroups.has(dateKey); 

        // Generate a one-line summary for the day
        let dailySummary = '';
        if (reportsForDate.length > 0) {
            const uniqueLogTypes = Array.from(new Set(reportsForDate.map(r => r.logType))).join(', ');
            dailySummary = ` (${reportsForDate.length} דיווחים, שיוכים: ${uniqueLogTypes})`;
            // Limit the length of the summary to prevent overflow
            if (dailySummary.length > 50) {
                dailySummary = dailySummary.substring(0, 47) + '...';
            }
        }

        const headerRow = document.createElement('tr');
        headerRow.className = 'date-group-header bg-[#F8F5F1] border-b-2 border-[#DCD5CC]';
        
        // Updated colspan to reflect 5 columns (on desktop) or 3 (on mobile)
        const headerColspan = window.innerWidth <= 639 ? 3 : 5; 

        headerRow.innerHTML = `
            <td colspan="${headerColspan}" class="p-3 font-bold text-[#6D5F53] text-right">
                <button class="toggle-day-btn text-blue-600 hover:text-blue-800 ml-2" data-toggle-date="${dateKey}">
                    ${isCollapsed ? '◀' : '▼'}
                </button>
                ${formatAsDDMMYYYY(dateKey)}
                <span class="daily-summary text-sm font-normal text-gray-500 ${isCollapsed ? '' : 'hidden'}">
                    ${dailySummary}
                </span>
            </td>
        `;

        // Add delete day button only for the allowed user
        const allowedEmailForDelete = 'gavishori@gmail.com';
        if (auth.currentUser && auth.currentUser.email === allowedEmailForDelete) {
            const deleteDayButton = document.createElement('button');
            deleteDayButton.className = 'text-red-500 hover:text-red-700 font-semibold ml-4';
            deleteDayButton.textContent = 'מחק יום';
            deleteDayButton.onclick = async () => {
                showCustomAlert(`האם אתה בטוח שברצונך למחוק את כל הדיווחים מתאריך ${formatAsDDMMYYYY(dateKey)}?`);
                customAlert.dataset.confirmAction = 'deleteDay';
                customAlert.dataset.dateToDelete = dateKey;
            };
            // Append delete button to the existing td (or create a new td for it if design requires)
            headerRow.querySelector('td').appendChild(deleteDayButton);
        }

        tableBody.appendChild(headerRow);

        const reportsContainerRow = document.createElement('tr');
        reportsContainerRow.className = `date-group-content ${isCollapsed ? 'hidden' : ''}`; 
        reportsContainerRow.dataset.contentDate = dateKey; 

        const reportsCell = document.createElement('td');
        // Updated colspan to reflect 5 columns (on desktop) or 3 (on mobile)
        const reportsCellColspan = window.innerWidth <= 639 ? 3 : 5; 
        reportsCell.colSpan = reportsCellColspan;
        reportsCell.className = 'p-0'; 

        const innerTable = document.createElement('table'); 
        innerTable.className = 'w-full text-sm';
        const innerTbody = document.createElement('tbody');

        const sortedReportsForDate = [...reportsForDate].sort((a, b) => {
            if (a.time > b.time) return -1;
            if (a.time < b.time) return 1;
            return 0;
        });

        sortedReportsForDate.forEach(report => {
            const reportRow = document.createElement('tr');
            reportRow.className = 'hover:bg-[#F8F5F1]';

            const reportDateTime = new Date(report.timestamp); 
            const now = new Date();
            const diffHours = (now.getTime() - reportDateTime.getTime()) / (1000 * 60 * 60);
            const canEdit = diffHours < 48;

            const highlightText = (text, term) => {
                if (!term) return text;
                const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                return text.replace(regex, '<span class="highlight">$&</span>');
            };

            reportRow.innerHTML = `
                <td class="table-cell">${highlightText(report.description, searchTerm)}</td>
                <td class="table-cell">${report.time}</td> <td class="table-cell table-cell-desktop-only">${highlightText(report.reporter, searchTerm)}</td>
                <td class="table-cell table-cell-desktop-only">${highlightText(report.logType, searchTerm)}</td> 
                <td class="table-cell text-center whitespace-nowrap">
                    ${canEdit ? `<button data-id="${report.id}" class="text-blue-600 hover:text-blue-800 font-semibold edit-btn">ערוך</button>` : `<span class="text-gray-400">לא ניתן לערוך</span>`}
                </td>
            `;
            innerTbody.appendChild(reportRow);
        });

        innerTable.appendChild(innerTbody);
        reportsCell.appendChild(innerTable);
        reportsContainerRow.appendChild(reportsCell);
        tableBody.appendChild(reportsContainerRow);
        
        // This part handles initial collapse and toggling, ensure summary visibility is controlled
        if (!isToday && !collapsedGroups.has(dateKey) && !searchTerm) { 
            collapsedGroups.add(dateKey); 
            reportsContainerRow.classList.add('hidden'); 
            const toggleButton = headerRow.querySelector('.toggle-day-btn');
            if (toggleButton) { 
                toggleButton.textContent = '◀'; 
            }
        }
        // Ensure summary is hidden when expanded and visible when collapsed
        const summarySpan = headerRow.querySelector('.daily-summary');
        if (summarySpan) {
            if (isCollapsed) {
                summarySpan.classList.remove('hidden');
            } else {
                summarySpan.classList.add('hidden');
            }
        }
    });
    
    tableBody.querySelectorAll('.toggle-day-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const dateToToggle = e.target.dataset.toggleDate;
            const contentRow = tableBody.querySelector(`tr[data-content-date="${dateToToggle}"]`);
            const summarySpan = e.target.parentNode.querySelector('.daily-summary'); // Get the summary span
            if (contentRow) {
                contentRow.classList.toggle('hidden');
                if (contentRow.classList.contains('hidden')) {
                    e.target.textContent = '◀';
                    collapsedGroups.add(dateToToggle);
                    if (summarySpan) summarySpan.classList.remove('hidden'); // Show summary when collapsed
                } else {
                    e.target.textContent = '▼';
                    collapsedGroups.delete(dateToToggle);
                    if (summarySpan) summarySpan.classList.add('hidden'); // Hide summary when expanded
                }
            }
        });
    });
    
    console.log('Current reports array (raw data from Firebase):', reports); 
    console.log('Collapsed Groups State:', collapsedGroups);
};

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
    
    // Hide delete button if it exists
    const deleteButton = document.getElementById('deleteReportBtn');
    if (deleteButton && deleteButton.parentNode) {
        deleteButton.parentNode.removeChild(deleteButton);
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

    if (filterLogType) {
        // filterLogType.value = ""; // Don't reset this, as it affects task buttons
    }
    toggleTasksPanel(false); 
};

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
        inputErrorMessage.textContent = 'יש למלוא את שדה תיאור הדיווח.';
        setTimeout(() => inputErrorMessage.textContent = '', 3000);
        return;
    }
    if (!reporter || reporter === '') {
        inputErrorMessage.textContent = 'יש לבחור מדווח.';
        setTimeout(() => inputErrorMessage.textContent = '', 3000);
        return;
    }
    if (!logType || logType === '') {
        inputErrorMessage.textContent = 'יש לבחור שיוך יומן.';
        setTimeout(() => inputErrorMessage.textContent = '', 3000);
        return;
    }

    const newReportData = { 
        description, 
        date, 
        time, 
        reporter, 
        logType,
        creatorId: currentUserId, 
        timestamp: new Date().toISOString(), 
    };

    try {
        const docRef = await addDoc(reportsCollectionRef, newReportData);
        console.log("Document written with ID: ", docRef.id);
        lastAddedReportId = docRef.id; 
        collapsedGroups.delete(newReportData.date); 
        resetForm(); 
    } catch (e) {
        console.error("Error adding document: ", e);
        inputErrorMessage.textContent = 'שגיאה בשמירת דיווח: ' + e.message;
        setTimeout(() => inputErrorMessage.textContent = '', 5000);
    }
};

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
        inputErrorMessage.textContent = 'יש למלוא את כל השדות: תיאור, תאריך ושעה.';
        setTimeout(() => inputErrorMessage.textContent = '', 3000);
        return;
    }
    if (!isValidTimeFormat(time)) { 
        inputErrorMessage.textContent = 'פורמט שעה שגוי. אנא הזן HH:MM (לדוגמה, 14:30).';
        setTimeout(() => inputErrorMessage.textContent = '', 3000);
        return;
    }
    if (!reporter || reporter === '') {
        inputErrorMessage.textContent = 'יש לבחור מדווח.';
        setTimeout(() => inputErrorMessage.textContent = '', 3000);
        return;
    }
    if (!logType || logType === '') {
        inputErrorMessage.textContent = 'יש לבחור שיוך יומן.';
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

    const reportDateTime = new Date(reportToUpdate.timestamp);
    const now = new Date();
    const diffHours = (now.getTime() - reportDateTime.getTime()) / (1000 * 60 * 60);
    if (diffHours >= 48) {
        showCustomAlert('לא ניתן לערוך דיווחים בני יותר מ-48 שעות.');
        resetForm();
        return;
    }

    const updatedReportData = {
        description,
        date,
        time,
        reporter,
        logType,
    };

    try {
        const docRef = doc(db, `artifacts/${appId}/public/data/reports`, reportToUpdate.id); 
        await setDoc(docRef, updatedReportData, { merge: true }); 
        console.log("Document updated with ID: ", docRef.id);
        lastAddedReportId = reportToUpdate.id; 
        collapsedGroups.delete(reportToUpdate.date); 
        resetForm(); 
    } catch (e) {
        console.error("Error updating document: ", e);
        inputErrorMessage.textContent = 'שגיאה בעדכון דיווח: ' + e.message;
        setTimeout(() => inputErrorMessage.textContent = '', 5000);
    }
};


// --- Auth State Handler ---
const handleAuthState = async (user) => {
    if (loadingStateRow) loadingStateRow.classList.add('hidden');

    if (user) {
        currentUserId = user.uid;
        console.log('User signed in. UID:', currentUserId);
        console.log('User email:', user.email);

        showAppContent(); 

        // Conditional visibility for export/import buttons
        const allowedEmailForExcel = 'gavishori@gmail.com';
        if (user.email === allowedEmailForExcel) {
            if (exportExcelBtn) exportExcelBtn.classList.remove('hidden');
            if (importExcelBtn) importExcelBtn.classList.remove('hidden');
        } else {
            if (exportExcelBtn) exportExcelBtn.classList.add('hidden');
            if (importExcelBtn) importExcelBtn.classList.add('hidden');
        }

        if (!reportsCollectionRef) {
             reportsCollectionRef = collection(db, `artifacts/${appId}/public/data/reports`);
             console.log('Reports collection path (PUBLIC):', `artifacts/${appId}/public/data/reports`);
        }
        if (!reportersCollectionRef) {
            reportersCollectionRef = collection(db, `artifacts/${appId}/public/data/reporters`);
            console.log('Reporters collection path (PUBLIC):', `artifacts/${appId}/public/data/reporters`);
        }
        if (!tasksCompletionCollectionRef) {
            tasksCompletionCollectionRef = doc(db, `artifacts/${appId}/users/${currentUserId}/tasks_completion`, 'status');
            console.log('Tasks completion document path (PRIVATE):', `artifacts/${appId}/users/${currentUserId}/tasks_completion/status`);
        }
        // New: Initialize log types collection reference
        if (!logTypesCollectionRef) {
            logTypesCollectionRef = collection(db, `artifacts/${appId}/public/data/log_types`);
            console.log('Log Types collection path (PUBLIC):', `artifacts/${appId}/public/data/log_types`);
        }
       
        if (!unsubscribeFromReports) {
            unsubscribeFromReports = onSnapshot(reportsCollectionRef, (snapshot) => {
                const fetchedReports = [];
                snapshot.forEach(doc => {
                    fetchedReports.push({ id: doc.id, ...doc.data() });
                });
                reports = sortChronologically(fetchedReports); 
                console.log('Reports fetched and sorted:', reports);
                renderTable(); 
                updateTasksButtonStates(); // Re-render/update all task buttons after reports load
            }, (error) => {
                console.error("Error getting reports in real-time: ", error);
                inputErrorMessage.textContent = 'שגיאה בטעינת דיווחים: ' + error.message;
            });
        }

        if (!unsubscribeFromReporters) {
            unsubscribeFromReporters = onSnapshot(reportersCollectionRef, async (snapshot) => {
                const fetchedReporters = [];
                snapshot.forEach(doc => {
                    fetchedReporters.push({ id: doc.id, name: doc.data().name }); // Fetch ID as well
                });
                populateReportersDropdown(fetchedReporters.map(r => r.name)); // Pass only names to dropdown
                renderReportersInModal(fetchedReporters); // Pass objects to modal for editing
                
                // Add default reporters only if the collection is empty AND the flag is not set
                // Use snapshot.size instead of .empty to be more robust
                if (snapshot.size === 0 && !localStorage.getItem('defaultReportersAddedOnce')) {
                    await addDefaultReportersIfEmpty();
                }
            }, (error) => {
                console.error("Error getting reporters in real-time: ", error);
            });
        }

        if (!unsubscribeFromTasksCompletion) {
            unsubscribeFromTasksCompletion = onSnapshot(tasksCompletionCollectionRef, (docSnap) => {
                if (docSnap.exists()) {
                    completedTasks = docSnap.data();
                    console.log("Completed tasks loaded:", completedTasks);
                } else {
                    console.log("No completed tasks data found for user.");
                    completedTasks = {}; 
                }
                if (tasksPanel && tasksPanel.classList.contains('is-open')) {
                    const currentLogType = tasksLogTypeDisplay.textContent; // Use content directly
                    renderTasksPanel(currentLogType);
                }
                updateTasksButtonStates(); 
            }, (error) => {
                console.error("Error getting tasks completion in real-time: ", error);
            });
        }

        // New: Listen for changes in log types and their tasks
        if (!unsubscribeFromLogTypes) {
            unsubscribeFromLogTypes = onSnapshot(logTypesCollectionRef, async (snapshot) => {
                const fetchedLogTypes = [];
                snapshot.forEach(doc => {
                    fetchedLogTypes.push({ id: doc.id, ...doc.data() });
                });
                definedLogTypes = fetchedLogTypes;
                console.log('Defined Log Types fetched:', definedLogTypes);
                
                // Populate log type dropdowns and update task buttons
                populateLogTypesDropdowns(definedLogTypes);
                updateTasksButtonStates();
                
                // Add default log types if the collection is empty
                if (snapshot.size === 0 && !localStorage.getItem('defaultLogTypesAddedOnce')) {
                    await addDefaultLogTypesIfEmpty();
                }

                // If task panel is open, re-render it with potentially new tasks
                if (tasksPanel && tasksPanel.classList.contains('is-open')) {
                    const currentLogType = tasksLogTypeDisplay.textContent;
                    renderTasksPanel(currentLogType);
                }

            }, (error) => {
                console.error("Error getting log types in real-time: ", error);
            });
        }

        // Enable reporters button if user is signed in
        if (editReportersBtn) {
            editReportersBtn.disabled = false;
        }

    } else {
        console.log('No user signed in. Showing login page.');
        showLoginPage(); 
        reports = []; 
        renderTable(); 
        resetForm(); 

        if (unsubscribeFromReports) unsubscribeFromReports();
        unsubscribeFromReports = null;
        if (unsubscribeFromReporters) unsubscribeFromReporters();
        unsubscribeFromReporters = null;
        if (unsubscribeFromTasksCompletion) unsubscribeFromTasksCompletion();
        unsubscribeFromTasksCompletion = null;
        if (unsubscribeFromLogTypes) unsubscribeFromLogTypes(); // New: Unsubscribe log types
        unsubscribeFromLogTypes = null;

        if (searchInput) searchInput.classList.add('hidden'); 
        if (searchInput) searchInput.value = ''; 
        isSearchInputVisible = false;

        // Disable reporters button if user is logged out
        if (editReportersBtn) {
            editReportersBtn.disabled = true;
        }
        // Hide export/import buttons if user is logged out
        if (exportExcelBtn) exportExcelBtn.classList.add('hidden');
        if (importExcelBtn) importExcelBtn.classList.add('hidden');
    }
    // Resolve the promise once the initial auth state has been handled
    firebaseAuthReadyResolve();
};

// --- Clock Functions ---

const updateCurrentTime = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    if (currentTimeDisplay) {
        currentTimeDisplay.textContent = `${hours}:${minutes}:${seconds}`;
    }
    return now; 
};

const updateAssessmentTimeDisplay = () => {
    const now = new Date();
    
    if (assessmentTimeDisplay) {
        if (!assessmentTimeIsManual) { 
            assessmentTimeDisplay.textContent = 'טרם נקבע';
            assessmentTimeDisplay.classList.remove('blinking-red'); 
        } else {
            const hours = assessmentTime.getHours().toString().padStart(2, '0');
            const minutes = assessmentTime.getMinutes().toString().padStart(2, '0');
            assessmentTimeDisplay.textContent = `${hours}:${minutes}`;
            checkBlinkingStatus(); 
        }
    }
};

const checkBlinkingStatus = () => {
    const now = updateCurrentTime(); 
    const diffMs = assessmentTime.getTime() - now.getTime();
    const diffMinutes = diffMs / (1000 * 60);

    if (assessmentTimeDisplay) {
        if (diffMinutes > 0 && diffMinutes <= 5) { 
            assessmentTimeDisplay.classList.add('blinking-red');
        } else { 
            assessmentTimeDisplay.classList.remove('blinking-red');
        }
    }
};

// --- Export to Excel Functionality ---
const exportReportsToExcel = () => {
    if (reports.length === 0) {
        showCustomAlert('אין דיווחים לייצוא.');
        return;
    }

    const header = ["דיווח", "תאריך", "שעה", "שם המדווח", "שיוך יומן"].join(',');
    const csvRows = reports.map(report => {
        const description = `"${report.description.replace(/"/g, '""')}"`; 
        const formattedDate = formatAsDDMMYYYY(report.date);
        return [description, formattedDate, report.time, report.reporter, report.logType].join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [header, ...csvRows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);

    const today = new Date();
    const dateString = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
    link.setAttribute("download", `גיבוי יומן חפק לתאריך ${dateString}.csv`);
    document.body.appendChild(link); 
    link.click();
    document.body.removeChild(link); 
};

// --- Search Functionality ---
let isSearchInputVisible = false; 

const toggleSearchInput = () => {
    if (searchInput) {
        isSearchInputVisible = !isSearchInputVisible;
        if (isSearchInputVisible) {
            searchInput.classList.remove('hidden');
            searchInput.focus();
        } else {
            searchInput.value = ''; 
            searchInput.classList.add('hidden'); 
            performSearch(); 
        }
    }
};

const performSearch = () => {
    const searchTerm = searchInput ? searchInput.value.trim() : '';
    renderTable(searchTerm); 
};


// --- Reporters Management ---
let currentReporters = []; // Stores objects {id: ..., name: ...}

const populateReportersDropdown = (reportersNamesArray) => {
    if (filterReporter) {
        filterReporter.innerHTML = ''; 
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'בחר מדווח';
        filterReporter.appendChild(defaultOption);

        if (reportersNamesArray.length === 0) {
            filterReporter.disabled = true;
        } else {
            reportersNamesArray.sort((a,b) => a.localeCompare(b, 'he')); 
            reportersNamesArray.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                filterReporter.appendChild(option);
            });
            filterReporter.disabled = false;
        }
        // currentReporters is now populated by onSnapshot directly with objects
    }
};

const renderReportersInModal = (reportersArray) => {
    if (reportersListUl) {
        reportersListUl.innerHTML = '';
        if (reportersArray.length === 0) {
            reportersListUl.innerHTML = '<li class="p-4 text-center text-gray-500">אין מדווחים מוגדרים.</li>';
            return;
        }
        reportersArray.sort((a,b) => a.name.localeCompare(b.name, 'he')); 
        reportersArray.forEach(reporter => {
            const li = document.createElement('li');
            li.className = 'reporters-list-item';
            // Display reporter name
            li.innerHTML = `
                <span data-id="${reporter.id}" class="reporter-name-display">${reporter.name}</span>
                <input type="text" class="reporter-name-edit hidden" value="${reporter.name}" data-id="${reporter.id}">
                <div class="reporter-actions">
                    <button class="edit-reporter-btn text-blue-600 hover:text-blue-800 font-semibold py-1 px-2 rounded-md text-sm">ערוך</button>
                    <button class="save-reporter-btn text-green-600 hover:text-green-800 font-semibold py-1 px-2 rounded-md text-sm hidden">שמור</button>
                    <button class="delete-reporter-btn text-red-500 hover:text-red-700 font-semibold py-1 px-2 rounded-md text-sm">מחק</button>
                    <button class="cancel-reporter-btn text-gray-500 hover:text-gray-700 font-semibold py-1 px-2 rounded-md text-sm hidden">ביטול</button>
                </div>
            `;
            reportersListUl.appendChild(li);
        });

        // Add event listeners for new buttons
        reportersListUl.querySelectorAll('.delete-reporter-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const idToDelete = e.target.closest('.reporters-list-item').querySelector('.reporter-name-display').dataset.id;
                const nameToDelete = e.target.closest('.reporters-list-item').querySelector('.reporter-name-display').textContent;
                showCustomAlert(`האם אתה בטוח שברצונך למחוק את המדווח "${nameToDelete}"?`);
                customAlert.dataset.confirmAction = 'deleteReporter';
                customAlert.dataset.reporterIdToDelete = idToDelete;
            });
        });

        reportersListUl.querySelectorAll('.edit-reporter-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const listItem = e.target.closest('.reporters-list-item');
                const nameDisplay = listItem.querySelector('.reporter-name-display');
                const nameInput = listItem.querySelector('.reporter-name-edit');
                const editBtn = listItem.querySelector('.edit-reporter-btn');
                const saveBtn = listItem.querySelector('.save-reporter-btn');
                const deleteBtn = listItem.querySelector('.delete-reporter-btn');
                const cancelBtn = listItem.querySelector('.cancel-reporter-btn');

                nameDisplay.classList.add('hidden');
                nameInput.classList.remove('hidden');
                editBtn.classList.add('hidden');
                saveBtn.classList.remove('hidden');
                deleteBtn.classList.add('hidden');
                cancelBtn.classList.remove('hidden');
                nameInput.focus();
            });
        });

        reportersListUl.querySelectorAll('.save-reporter-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const listItem = e.target.closest('.reporters-list-item');
                const nameInput = listItem.querySelector('.reporter-name-edit');
                const idToUpdate = nameInput.dataset.id;
                const newName = nameInput.value.trim();
                await updateReporterInFirestore(idToUpdate, newName);
                // UI will re-render via onSnapshot listener
            });
        });

        reportersListUl.querySelectorAll('.cancel-reporter-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const listItem = e.target.closest('.reporters-list-item');
                const nameDisplay = listItem.querySelector('.reporter-name-display');
                const nameInput = listItem.querySelector('.reporter-name-edit');
                const editBtn = listItem.querySelector('.edit-reporter-btn');
                const saveBtn = listItem.querySelector('.save-reporter-btn');
                const deleteBtn = listItem.querySelector('.delete-reporter-btn');
                const cancelBtn = listItem.querySelector('.cancel-reporter-btn');

                nameDisplay.classList.remove('hidden');
                nameInput.classList.add('hidden');
                editBtn.classList.remove('hidden');
                saveBtn.classList.add('hidden');
                deleteBtn.classList.remove('hidden');
                cancelBtn.classList.add('hidden');
                nameInput.value = nameDisplay.textContent; // Revert input value
            });
        });
    }
};

const openReportersModal = () => {
    if (reportersModal) {
        reportersModal.classList.remove('hidden');
        if (newReporterNameInput) newReporterNameInput.value = ''; 
        if (reporterErrorMessage) reporterErrorMessage.textContent = ''; 
        // renderReportersInModal is called by onSnapshot listener automatically
    }
};

const closeReportersModal = () => {
    if (reportersModal) {
        reportersModal.classList.add('hidden');
    }
};

const addReporterToFirestore = async (name) => {
    // Ensure Firebase references are available and user is authenticated
    if (!reportersCollectionRef || !auth.currentUser) {
        const msg = 'שגיאה: אימות נדרש או מערכת הנתונים אינה זמינה. אנא התחבר ונסה שוב.';
        console.error(msg);
        showCustomAlert(msg);
        if (reporterErrorMessage) reporterErrorMessage.textContent = msg;
        return;
    }

    if (!name || name.trim() === '') {
        if (reporterErrorMessage) reporterErrorMessage.textContent = 'שם המדווח אינו יכול להיות ריק.';
        showCustomAlert('שם המדווח אינו יכול להיות רישום ריק.'); // Add custom alert
        return;
    }
    if (currentReporters.some(r => r.name === name.trim())) { // Check names from objects
        if (reporterErrorMessage) reporterErrorMessage.textContent = 'מדווח בשם זה כבר קיים.';
        showCustomAlert('מדווח בשם זה כבר קיים.'); // Add custom alert
        return;
    }

    try {
        await addDoc(reportersCollectionRef, { name: name.trim() });
        console.log(`Reporter "${name}" added.`);
        if (newReporterNameInput) newReporterNameInput.value = '';
        if (reporterErrorMessage) reporterErrorMessage.textContent = ''; // Clear error on success
        showCustomAlert(`המדווח "${name}" נוסף בהצלחה!`); // Success alert
    } catch (e) {
        console.error("Error adding reporter: ", e);
        const errorMessage = `שגיאה בהוספת מדווח ל-Firestore: ${e.message} (קוד: ${e.code || 'לא ידוע'})`;
        if (reporterErrorMessage) reporterErrorMessage.textContent = errorMessage;
        showCustomAlert(errorMessage); // Alert on error
    }
};

const updateReporterInFirestore = async (id, newName) => {
    if (!reportersCollectionRef || !auth.currentUser) {
        const msg = 'שגיאה: אימות נדרש או מערכת הנתונים אינה זמינה לעדכון. אנא התחבר ונסה שוב.';
        console.error(msg);
        showCustomAlert(msg);
        return;
    }
    if (!newName || newName.trim() === '') {
        showCustomAlert('שם המדווח אינו יכול להיות ריק.');
        return;
    }
    if (currentReporters.some(r => r.id !== id && r.name === newName.trim())) {
        showCustomAlert('מדווח בשם זה כבר קיים.');
        return;
    }

    try {
        const docRef = doc(db, `artifacts/${appId}/public/data/reporters`, id);
        await updateDoc(docRef, { name: newName.trim() });
        console.log(`Reporter ID ${id} updated to "${newName}".`);
        showCustomAlert(`שם המדווח עודכן בהצלחה ל: "${newName}"`);
    } catch (e) {
        console.error("Error updating reporter: ", e);
        showCustomAlert(`שגיאה בעדכון מדווח: ${e.message}`);
    }
};


const deleteReporterFromFirestore = async (id) => { // Now accepts ID
    // Ensure Firebase references are available and user is authenticated
    if (!reportersCollectionRef || !auth.currentUser) {
        const msg = 'שגיאה: אימות נדרש או מערכת הנתונים אינה זמינה למחיקה. אנא התחבר ונסה שוב.';
        console.error(msg);
        showCustomAlert(msg);
        return;
    }
    try {
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/reporters`, id)); // Use ID directly
        console.log(`Reporter ID ${id} deleted.`);
        if (reporterErrorMessage) reporterErrorMessage.textContent = '';
        showCustomAlert(`המדווח נמחק בהצלחה.`);
    } catch (e) {
        console.error("Error deleting reporter: ", e);
        const errorMessage = `שגיאה במחיקת מדווח מ-Firestore: ${e.message} (קוד: ${e.code || 'לא ידוע'})`;
        if (reporterErrorMessage) reporterErrorMessage.textContent = errorMessage;
        showCustomAlert(errorMessage);
    }
};

const addDefaultReportersIfEmpty = async () => {
    try {
        const snapshot = await getDocs(reportersCollectionRef);
        if (snapshot.empty) {
            console.log("Reporters collection is empty. Adding default reporters.");
            const defaultReporters = ["אורי", "שונית", "חיליק"];
            const batch = writeBatch(db); 
            for (const reporterName of defaultReporters) {
                const newDocRef = doc(reportersCollectionRef); 
                batch.set(newDocRef, { name: reporterName });
            }
            await batch.commit();
            console.log("Default reporters added successfully.");
            localStorage.setItem('defaultReportersAddedOnce', 'true'); 
        } else {
            console.log("Reporters collection is not empty, skipping default reporter addition.");
        }
    }
    // Added catch block for addDefaultReportersIfEmpty for robustness
    catch (e) {
        console.error("Error checking or adding default reporters:", e);
    }
};


// --- Order of Operations / Tasks Panel ---
// This will now be populated dynamically from Firestore via `definedLogTypes`
// const orderOfOperations = { ... }; 

const toggleTasksPanel = (open) => { 
    if (tasksPanel && appContent) {
        if (open) {
            tasksPanel.classList.remove('hidden'); // Ensure it's visible before transform
            setTimeout(() => { // Small delay to allow 'hidden' class to be removed before transform
                tasksPanel.classList.add('is-open');
                appContent.classList.add('app-content-shifted');
            }, 10); // Adjust delay as needed
        } else {
            tasksPanel.classList.remove('is-open');
            appContent.classList.remove('app-content-shifted');
            setTimeout(() => { // Add 'hidden' class after animation completes
                tasksPanel.classList.add('hidden');
            }, 300); // Should match CSS transition duration
        }
    }
};

// Renders and updates the state of all individual task type buttons
const updateTasksButtonStates = () => {
    if (!taskButtonsContainer) return; 

    // Clear existing buttons to prevent duplicates on re-render
    taskButtonsContainer.innerHTML = ''; 

    // Get today's date in IHDA-MM-DD format
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
    
    // Filter reports relevant to today
    const relevantReportsToday = reports.filter(report => report.date === todayKey);
    const logTypesWithReportsToday = new Set(relevantReportsToday.map(r => r.logType));

    // Sort definedLogTypes based on a custom order for display
    const customOrder = ["בטחוני", "שריפה", "נעדר", "שגרה"]; 
    const sortedDefinedLogTypes = [...definedLogTypes].sort((a, b) => {
        const nameA = a.name;
        const nameB = b.name;
        const indexA = customOrder.indexOf(nameA);
        const indexB = customOrder.indexOf(nameB);

        // Handle cases where log types are not in customOrder (place them at the end, alphabetically)
        if (indexA === -1 && indexB === -1) {
            return nameA.localeCompare(nameB, 'he');
        }
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    sortedDefinedLogTypes.forEach(logTypeObj => {
        const logType = logTypeObj.name;
        const tasksForType = logTypeObj.tasks || []; // Get tasks from the fetched log type object

        const button = document.createElement('button');
        button.classList.add('task-type-button'); 
        button.dataset.logType = logType;
        button.textContent = logType;

        let allTasksCompleted = true;     // True if all tasks are checked
        let hasSomeCompletedTasks = false; // True if at least one task is checked
        let hasIncompleteTasks = false;    // True if at least one task is unchecked

        if (tasksForType.length > 0) {
            for (const task of tasksForType) {
                const isCompleted = completedTasks[logType] && completedTasks[logType][task.id];
                if (isCompleted) {
                    hasSomeCompletedTasks = true;
                } else {
                    allTasksCompleted = false; // If even one is not completed, then not all are completed
                    hasIncompleteTasks = true;
                }
            }
        } else {
            // If no tasks are defined, they are "all completed" in a sense (nothing to do)
            allTasksCompleted = true; 
            hasSomeCompletedTasks = false; // No tasks means no *some* completed tasks
            hasIncompleteTasks = false; // No tasks means no incomplete tasks
        }

        // Determine button color based on the new logic
        if (tasksForType.length > 0 && allTasksCompleted) {
            // Green: All tasks are completed (and there are existing tasks)
            button.classList.add('all-tasks-completed');
            button.classList.remove('tasks-incomplete-with-reports');
        } else if (tasksForType.length > 0 && hasSomeCompletedTasks && hasIncompleteTasks && logTypesWithReportsToday.has(logType)) {
            // Red: Tasks exist, some are completed and some are not, AND there are general reports for this log type from today
            button.classList.add('tasks-incomplete-with-reports');
            button.classList.remove('all-tasks-completed');
        } else {
            // Gray (default): All other cases
            // - No tasks defined at all (tasksForType.length === 0)
            // - Tasks exist, but none of them are completed (allTasksCompleted === false, hasSomeCompletedTasks === false)
            // - Tasks are partially completed, but there are no general reports for this log type from today
            button.classList.remove('tasks-incomplete-with-reports');
            button.classList.remove('all-tasks-completed');
        }

        button.addEventListener('click', () => {
            const isPanelOpenForThisType = tasksPanel.classList.contains('is-open') && 
                                           tasksLogTypeDisplay.textContent === logType;
            
            if (isPanelOpenForThisType) {
                toggleTasksPanel(false); 
            } else {
                renderTasksPanel(logType); 
                toggleTasksPanel(true);    
            }
        });

        taskButtonsContainer.appendChild(button);
    });
};


const renderTasksPanel = (logType) => {
    if (!tasksList || !tasksLogTypeDisplay || !allTasksCompletedMessage) {
        console.error('Task panel elements not found.');
        return;
    }

    tasksLogTypeDisplay.textContent = logType;
    tasksList.innerHTML = '';
    
    // Find the tasks for the selected log type from definedLogTypes
    const logTypeObj = definedLogTypes.find(lt => lt.name === logType);
    const tasksForType = logTypeObj ? logTypeObj.tasks : [];
    
    let allTasksCompletedForTypeCurrentlyDisplayed = true;

    if (tasksForType.length === 0) {
        tasksList.innerHTML = `<p class="text-gray-500 text-center">אין משימות מוגדרות עבור ${logType}.</p>`;
        allTasksCompletedForTypeCurrentlyDisplayed = false; 
    } else {
        tasksForType.forEach(task => {
            const isCompleted = completedTasks[logType] && completedTasks[logType][task.id];
            if (!isCompleted) {
                allTasksCompletedForTypeCurrentlyDisplayed = false;
            }

            const taskItemDiv = document.createElement('div');
            taskItemDiv.className = `task-item ${isCompleted ? 'highlight-completed' : ''}`;
            taskItemDiv.innerHTML = `
                <input type="checkbox" id="task-${task.id}" data-task-id="${task.id}" data-log-type="${logType}" ${isCompleted ? 'checked' : ''}>
                <label for="task-${task.id}" class="cursor-pointer flex-grow">${task.text}</label>
            `;
            tasksList.appendChild(taskItemDiv);

            taskItemDiv.querySelector(`input[type="checkbox"]`).addEventListener('change', (e) => {
                handleTaskCheckboxChange(e.target.dataset.taskId, e.target.dataset.logType, task.text, e.target.checked);
            });
        });
    }

    if (allTasksCompletedForTypeCurrentlyDisplayed && tasksForType.length > 0) {
        allTasksCompletedMessage.classList.remove('hidden');
    } else {
        allTasksCompletedMessage.classList.add('hidden');
    }
    updateTasksButtonStates(); 
};

const handleTaskCheckboxChange = async (taskId, logType, taskText, isChecked) => {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0].substring(0, 5); 

    const taskReportDescription = `משימת "${taskText}" עבור שיוך "${logType}" ${isChecked ? 'הושלמה' : 'בוטלה'}.`;
    const reportIdPrefix = `task-${logType}-${taskId}`; 

    if (!completedTasks[logType]) {
        completedTasks[logType] = {};
    }
    completedTasks[logType][taskId] = isChecked;

    try {
        await setDoc(tasksCompletionCollectionRef, completedTasks, { merge: true });
        console.log(`Task completion status updated for ${logType}/${taskId}.`);
    } catch (error) {
        console.error("Error updating task completion status:", error);
    }

    // Find if a report for this specific task and status change already exists
    // We need to check only for today's reports for this specific task to avoid conflicts
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;

    const existingTaskReport = reports.find(r => 
        r.isTaskReport && 
        r.taskReportId === reportIdPrefix &&
        r.date === todayKey // Only consider reports from today
    );

    if (isChecked) {
        if (!existingTaskReport) {
            const newReportData = {
                description: taskReportDescription,
                date: date,
                time: time,
                reporter: filterReporter.value, 
                logType: logType,
                creatorId: currentUserId,
                timestamp: new Date().toISOString(),
                isTaskReport: true, 
                taskReportId: reportIdPrefix, 
            };
            try {
                await addDoc(reportsCollectionRef, newReportData);
                console.log("Auto-generated task report added.");
            } catch (e) {
                console.error("Error adding auto-generated task report: ", e);
            }
        } else {
            console.log("Task report already exists for completion for today, no new report added.");
            // Optionally update timestamp if you want "last completion time"
            try {
                await setDoc(doc(db, `artifacts/${appId}/public/data/reports`, existingTaskReport.id), 
                             { timestamp: new Date().toISOString() }, { merge: true });
                console.log("Existing task report timestamp updated.");
            } catch (e) {
                console.error("Error updating existing task report timestamp: ", e);
            }
        }
    } else { // Task was unchecked
        // Find any existing report for this task from today
        const existingTaskReportForDeletion = reports.find(r => 
            r.isTaskReport && 
            r.taskReportId === reportIdPrefix &&
            r.date === todayKey // Only consider reports from today
        );
        if (existingTaskReportForDeletion) {
            try {
                await deleteDoc(doc(db, `artifacts/${appId}/public/data/reports`, existingTaskReportForDeletion.id));
                console.log("Auto-generated task report deleted (task unchecked).");
            } catch (e) {
                console.error("Error deleting auto-generated task report: ", e);
            }
        }
    }
    
    renderTasksPanel(logType);
};


// --- Log Type Management Functions (New) ---
const populateLogTypesDropdowns = (logTypesArray) => {
    // Populate main filterLogType dropdown
    if (filterLogType) {
        // Store current value to re-select after repopulating
        const currentSelectedValue = filterLogType.value; 
        filterLogType.innerHTML = '<option value="">בחר שיוך</option>'; // Clear existing options
        logTypesArray.sort((a, b) => a.name.localeCompare(b.name, 'he')).forEach(logType => {
            const option = document.createElement('option');
            option.value = logType.name;
            option.textContent = logType.name;
            filterLogType.appendChild(option);
        });
        filterLogType.value = currentSelectedValue; // Restore selection
    }

    // Populate taskSettingsModal's selectTaskTypeForSettings dropdown
    if (selectTaskTypeForSettings) {
        const currentSelectedValue = selectTaskTypeForSettings.value;
        selectTaskTypeForSettings.innerHTML = `
            <option value="">בחר שיוך</option>
            <option value="הוסף שיוך">הוסף שיוך</option>
        `; // Keep "Add Association" option
        logTypesArray.sort((a, b) => a.name.localeCompare(b.name, 'he')).forEach(logType => {
            const option = document.createElement('option');
            option.value = logType.name;
            option.textContent = logType.name;
            selectTaskTypeForSettings.appendChild(option);
        });
        selectTaskTypeForSettings.value = currentSelectedValue;
    }
};

const addDefaultLogTypesIfEmpty = async () => {
    try {
        const snapshot = await getDocs(logTypesCollectionRef);
        if (snapshot.empty) {
            console.log("Log Types collection is empty. Adding default log types.");
            const defaultLogTypesData = [
                { name: "שגרה", tasks: [
                    { id: 'routine_task_1', text: 'בדיקת תקינות מערכות' },
                    { id: 'routine_task_2', text: 'עדכון סטטוס משימות פתוחות' },
                    { id: 'routine_task_3', text: 'ביצוע סיור/בדיקה תקופתית' },
                    { id: 'routine_task_4', text: 'הכנת ציוד ומשאבים' },
                ]},
                { name: "בטחוני", tasks: [
                    { id: 'sec_task_1', text: 'בדיקת קשר ותקשורת עם מפקדה' },
                    { id: 'sec_task_2', text: 'אבטחת שטח/ציר פיזי' },
                    { id: 'sec_task_3', text: 'פריסת כוחות/עמדות' },
                    { id: 'sec_task_4', text: 'תיאום עם גורמי ביטחון נוספים' },
                    { id: 'sec_task_5', text: 'הערכת מצב ראשונית' },
                ]},
                { name: "שריפה", tasks: [
                    { id: 'fire_task_1', text: 'הודעה מיידית לכבאות והצלה' },
                    { id: 'fire_task_2', text: 'פינוי מיידי של נפגעים/לכודים' },
                    { id: 'fire_task_3', text: 'הגדרת קווי אש/מגבלות התפשטות' },
                    { id: 'fire_task_4', text: 'אבטחת גישה לצוותי חירום' },
                    { id: 'fire_task_5', text: 'כיבוי ראשוני (אם בטוח)' },
                ]},
                { name: "נעדר", tasks: [
                    { id: 'missing_task_1', text: 'קבלת פרטים מזהים ופרטי לבוש' },
                    { id: 'missing_task_2', text: 'איסוף מידע על נסיבות ההיעלמות' },
                    { id: 'missing_3', text: 'פתיחת סריקה ראשונית באזור' },
                    { id: 'missing_task_4', text: 'הודעה למשטרה ולגורמי חיפוש' },
                    { id: 'missing_task_5', text: 'גיוס כוחות סיוע (מתנדבים/כלבנים)' },
                ]},
            ];
            const batch = writeBatch(db); 
            for (const logTypeData of defaultLogTypesData) {
                const newDocRef = doc(logTypesCollectionRef); 
                batch.set(newDocRef, logTypeData);
            }
            await batch.commit();
            console.log("Default log types added successfully.");
            localStorage.setItem('defaultLogTypesAddedOnce', 'true'); 
        } else {
            console.log("Log Types collection is not empty, skipping default log type addition.");
        }
    } catch (e) {
        console.error("Error checking or adding default log types:", e);
    }
};

const addLogType = async (logTypeName) => {
    if (!logTypesCollectionRef || !auth.currentUser) {
        showCustomAlert('שגיאה: אימות נדרש או מערכת הנתונים אינה זמינה. אנא התחבר ונסה שוב.');
        return;
    }
    if (!logTypeName || logTypeName.trim() === '') {
        showCustomAlert('שם השיוך אינו יכול להיות ריק.');
        return;
    }
    if (definedLogTypes.some(lt => lt.name === logTypeName.trim())) {
        showCustomAlert('שיוך בשם זה כבר קיים.');
        return;
    }

    try {
        await addDoc(logTypesCollectionRef, { name: logTypeName.trim(), tasks: [] });
        showCustomAlert(`שיוך "${logTypeName}" נוסף בהצלחה!`);
        if (newTaskTypeInput) newTaskTypeInput.value = '';
    } catch (e) {
        console.error("Error adding log type: ", e);
        showCustomAlert(`שגיאה בהוספת שיוך: ${e.message}`);
    }
};

const addTaskToLogType = async (logTypeName, taskText) => {
    if (!logTypesCollectionRef || !auth.currentUser) {
        showCustomAlert('שגיאה: אימות נדרש או מערכת הנתונים אינה זמינה. אנא התחבר ונסה שוב.');
        return;
    }
    if (!taskText || taskText.trim() === '') {
        showCustomAlert('תיאור המשימה אינו יכול להיות ריק.');
        return;
    }

    const logTypeObj = definedLogTypes.find(lt => lt.name === logTypeName);
    if (!logTypeObj) {
        showCustomAlert('שיוך לא נמצא. אנא בחר שיוך קיים.');
        return;
    }

    const newTaskId = `task_${Date.now()}`; // Simple unique ID
    const updatedTasks = [...logTypeObj.tasks, { id: newTaskId, text: taskText.trim() }];

    try {
        const docRef = doc(db, `artifacts/${appId}/public/data/log_types`, logTypeObj.id);
        await updateDoc(docRef, { tasks: updatedTasks });
        showCustomAlert(`משימה נוספה לשיוך "${logTypeName}" בהצלחה!`);
        if (newTaskItemInput) newTaskItemInput.value = '';
    } catch (e) {
        console.error("Error adding task to log type: ", e);
        showCustomAlert(`שגיאה בהוספת משימה: ${e.message}`);
    }
};

const removeTaskFromLogType = async (logTypeName, taskId) => {
    if (!logTypesCollectionRef || !auth.currentUser) {
        showCustomAlert('שגיאה: אימות נדרש או מערכת הנתונים אינה זמינה. אנא התחבר ונסה שוב.');
        return;
    }

    const logTypeObj = definedLogTypes.find(lt => lt.name === logTypeName);
    if (!logTypeObj) {
        showCustomAlert('שיוך לא נמצא.');
        return;
    }

    const updatedTasks = logTypeObj.tasks.filter(task => task.id !== taskId);

    try {
        const docRef = doc(db, `artifacts/${appId}/public/data/log_types`, logTypeObj.id);
        await updateDoc(docRef, { tasks: updatedTasks });
        showCustomAlert(`משימה הוסרה משיוך "${logTypeName}" בהצלחה.`);

        // --- NEW: Delete corresponding auto-generated reports from the main reports collection ---
        const taskReportIdPrefix = `task-${logTypeName}-${taskId}`;
        const q = query(reportsCollectionRef, where("isTaskReport", "==", true), where("taskReportId", "==", taskReportIdPrefix));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const batch = writeBatch(db);
            querySnapshot.docs.forEach(docToDelete => {
                batch.delete(doc(db, `artifacts/${appId}/public/data/reports`, docToDelete.id));
            });
            await batch.commit();
            console.log(`Deleted all auto-generated reports for task "${taskId}" under log type "${logTypeName}".`);
        }
        // --- END NEW ---

    } catch (e) {
        console.error("Error removing task from log type: ", e);
        showCustomAlert(`שגיאה בהסרת משימה: ${e.message}`);
    }
};


// --- DOMContentLoaded listener ---
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
    loadingStateRow = document.getElementById('loading-state'); 
    inputErrorMessage = document.getElementById('inputErrorMessage');
    expandAllBtn = document.getElementById('expandAllBtn'); 
    collapseAllBtn = document.getElementById('collapseAllBtn'); 

    // Login Page DOM references
    loginPage = document.getElementById('login-page');
    appContent = document.getElementById('app-content');
    loginEmailInput = document.getElementById('loginEmail');
    loginPasswordInput = document.getElementById('loginPassword');
    loginBtn = document.getElementById('loginBtn');
    loginErrorMessage = document.getElementById('loginErrorMessage');
    logoutBtn = document.getElementById('logoutBtn');

    // Header Menu & Buttons
    menuToggleBtn = document.getElementById('menuToggleBtn');
    headerMenu = document.getElementById('headerMenu');
    searchLogBtn = document.getElementById('searchLogBtn');     
    searchInput = document.getElementById('searchInput');       
    exportExcelBtn = document.getElementById('exportExcelBtn'); 
    importExcelBtn = document.getElementById('importExcelBtn'); 
    editReportersBtn = document.getElementById('editReportersBtn'); 
    taskButtonsContainer = document.getElementById('taskButtonsContainer'); 
    manageTaskSettingsBtn = document.getElementById('manageTaskSettingsBtn'); 

    // Clock DOM references
    currentTimeDisplay = document.getElementById('currentTimeDisplay');
    assessmentTimeDisplay = document.getElementById('assessmentTimeDisplay');
    assessmentTimePlusBtn = document.getElementById('assessmentTimePlusBtn');
    assessmentTimeMinusBtn = document.getElementById('assessmentTimeMinusBtn');

    // Tasks Panel DOM references
    tasksPanel = document.getElementById('tasksPanel');
    closeTasksPanelBtn = document.getElementById('closeTasksPanelBtn');
    tasksLogTypeDisplay = document.getElementById('tasksLogTypeDisplay');
    tasksList = document.getElementById('tasksList');
    allTasksCompletedMessage = document.getElementById('allTasksCompletedMessage');

    // Reporters Modal DOM references
    reportersModal = document.getElementById('reportersModal');
    closeReportersModalBtn = document.getElementById('closeReportersModalBtn'); 
    newReporterNameInput = document.getElementById('newReporterName');
    addReporterBtn = document.getElementById('addReporterBtn'); 
    reportersListUl = document.getElementById('reportersList');
    reporterErrorMessage = document.getElementById('reporterErrorMessage');

    // Custom Task Settings Modal DOM references
    taskSettingsModal = document.getElementById('taskSettingsModal');
    closeTaskSettingsModalBtn = document.getElementById('closeTaskSettingsModalBtn');
    selectTaskTypeForSettings = document.getElementById('selectTaskTypeForSettings');
    newTaskTypeInput = document.getElementById('newTaskTypeInput'); // New
    addNewTaskTypeBtn = document.getElementById('addNewTaskTypeBtn'); // New
    currentTasksForSettings = document.getElementById('currentTasksForSettings');
    newTaskItemInput = document.getElementById('newTaskItemInput');
    addTaskItemBtn = document.getElementById('addTaskItemBtn');


    // Custom Alert DOM references
    customAlert = document.getElementById('customAlert');
    customAlertMessage = document.getElementById('customAlertMessage');
    customAlertCloseBtn = document.getElementById('customAlertCloseBtn'); 


    // Attach event listener for addReporterBtn
    if (addReporterBtn) { 
        addReporterBtn.addEventListener('click', () => {
            addReporterToFirestore(newReporterNameInput.value);
        });
    } else {
        console.error('addReporterBtn element not found! Cannot attach event listener.');
    }
    
    // Attach event listener for closeTasksPanelBtn (original tasks panel close)
    if (closeTasksPanelBtn) {
        closeTasksPanelBtn.addEventListener('click', () => toggleTasksPanel(false)); 
    } else {
        console.error('closeTasksPanelBtn element not found! Cannot attach event listener.');
    }

    // Attach event listener for closeReportersModalBtn (specific to reporters modal)
    if (closeReportersModalBtn) {
        closeReportersModalBtn.addEventListener('click', closeReportersModal);
    } else {
        console.error('closeReportersModalBtn element not found! Cannot attach event listener.');
    }


    // --- Firebase Initialization ---
    if (!auth || !db) {
        console.error('Firebase Auth or Firestore not initialized. Check firebase.js for errors.');
        loginErrorMessage.textContent = 'שגיאה: Firebase לא אותחל באופן מלא.';
        showLoginPage(); 
        return;
    }

    if (loadingStateRow) loadingStateRow.classList.remove('hidden'); 

    // Attach the auth state listener *before* attempting any sign-in
    onAuthStateChanged(auth, handleAuthState);

    // Wait for the initial auth state to be determined
    await firebaseAuthReady;

    // Only attempt automatic sign-in if no user is currently signed in
    if (!auth.currentUser) {
        try {
            if (initialAuthToken) {
                await signInWithCustomToken(auth, initialAuthToken);
                console.log("Signed in with custom token.");
            } else {
                console.log("No custom token. Anonymous sign-in skipped as it might be disabled. Directing to login.");
                showLoginPage(); 
            }
        } catch (error) {
            console.error("Error during automatic sign-in:", error);
            if (!error.code || !error.code.includes('auth/admin-restricted-operation')) {
                loginErrorMessage.textContent = "שגיאת התחברות אוטומטית: " + error.message;
            }
            showLoginPage(); 
        }
    } else {
        console.log("User already signed in from previous session. Skipping automatic sign-in.");
    }


    // --- Set up initial data/listeners ---
    setDefaultDateTime();
    resetForm(); 

    assessmentTime.setMinutes(assessmentTime.getMinutes() + 30); 
    assessmentTime.setSeconds(0); 
    assessmentTime.setMilliseconds(0);
    updateAssessmentTimeDisplay(); 
    setInterval(updateCurrentTime, 1000); 
    setInterval(updateAssessmentTimeDisplay, 1000); 


    // --- Login/Logout Event Listeners ---
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const email = loginEmailInput.value;
            const password = loginPasswordInput.value;
            loginErrorMessage.textContent = ''; 

            if (!email || !password) {
                loginErrorMessage.textContent = 'נא להזין אימייל וסיסמה.';
                return;
            }

            try {
                await signInWithEmailAndPassword(auth, email, password);
            } catch (error) {
                console.error("Error signing in with email/password:", error);
                let errorMessage = 'שגיאת התחברות: ';
                switch (error.code) {
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                        errorMessage += 'אימייל או סיסמה שגויים.';
                        break;
                    case 'auth/invalid-email':
                        errorMessage += 'פורמט אימייל שגוי.';
                        break;
                    case 'auth/too-many-requests':
                        errorMessage += 'נסיונות רבים מדי, נסה שוב מאוחר יותר.';
                        break;
                    default:
                        errorMessage += error.message;
                }
                loginErrorMessage.textContent = errorMessage;
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                console.log("User signed out.");
                showLoginPage(); 
                reports = []; 
                renderTable(); 
                resetForm(); 
                if (searchInput) searchInput.classList.add('hidden'); 
                if (searchInput) searchInput.value = ''; 
                isSearchInputVisible = false;
            } catch (error) {
                console.error("Error signing out:", error);
                loginErrorMessage.textContent = "שגיאה בהתנתקות: " + error.message; 
            }
            headerMenu.classList.add('hidden'); 
            headerMenu.classList.remove('open');
        });
    }


    // --- Attach Main App Event Listeners ---
    // --- Attach Main App Event Listeners ---
if (mainActionBtn) {
    mainActionBtn.addEventListener('click', async () => { // Made async to await
        try {
            if (editingReportIndex === null) {
                // NEW: Update the time input to the current time right before adding a new report
                const now = new Date();
                const hours = now.getHours().toString().padStart(2, '0');
                const minutes = now.getMinutes().toString().padStart(2, '0');
                if (newTimeInput) {
                    newTimeInput.value = `${hours}:${minutes}`;
                }
                await addReport(); // Await the async function
            } else {
                await updateReport(); // Await the async function
            }
        } catch (error) {
            console.error("Main action failed:", error);
            // Error message already shown by addReport/updateReport functions
        }
        // resetIdleTimer() is now handled within addReport/updateReport finally blocks
    });
} else {
    console.error('mainActionBtn element not found! Cannot attach event listener.');
}

    if (cancelEditBtn) { 
        cancelEditBtn.addEventListener('click', resetForm);
    } else {
        console.error('cancelEditBtn element not found! Cannot attach event listener.');
    }

    if (expandAllBtn) {
        expandAllBtn.addEventListener('click', () => {
            collapsedGroups.clear(); 
            document.querySelectorAll('.date-group-content').forEach(div => {
                div.classList.remove('hidden'); 
            });
            document.querySelectorAll('.toggle-day-btn').forEach(button => {
                button.textContent = '▼'; 
            });
            document.querySelectorAll('.daily-summary').forEach(span => { // Hide summary when expanded
                span.classList.add('hidden');
            });
        });
    } else {
        console.error('expandAllBtn element not found!');
    }

    if (collapseAllBtn) {
        collapseAllBtn.addEventListener('click', () => {
            collapsedGroups.clear(); 
            const allDateKeysInTable = Array.from(new Set(reports.map(r => r.date)));
            allDateKeysInTable.forEach(key => collapsedGroups.add(key));

            document.querySelectorAll('.date-group-content').forEach(div => {
                div.classList.add('hidden'); 
            });
            document.querySelectorAll('.toggle-day-btn').forEach(button => {
                button.textContent = '◀'; 
            });
            document.querySelectorAll('.daily-summary').forEach(span => { // Show summary when collapsed
                span.classList.remove('hidden');
            });
        });
    } else {
        console.error('collapseAllBtn element not found!');
    }

    if (tableBody) { 
        tableBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('edit-btn')) {
                const reportIdToEdit = e.target.getAttribute('data-id');
                const index = reports.findIndex(report => report.id === reportIdToEdit);
                
                if (index === -1) {
                    console.error('Report not found for editing:', reportIdToEdit);
                    return;
                }

                const reportToEdit = reports[index];
                
                const reportDateTime = new Date(reportToEdit.timestamp);
                const now = new Date();
                const diffHours = (now.getTime() - reportDateTime.getTime()) / (1000 * 60 * 60);
                if (diffHours >= 48) {
                    showCustomAlert('לא ניתן לערוך דיווחים בני יותר מ-48 שעות.');
                    return;
                }

                if (generalTextInput) generalTextInput.value = reportToEdit.description;
                if (newDateInput) newDateInput.value = reportToEdit.date;
                if (newTimeInput) newTimeInput.value = reportToEdit.time; 
                if (filterReporter) filterReporter.value = reportToEdit.reporter; 
                if (filterLogType) filterLogType.value = reportToEdit.logType;   
                
                editingReportIndex = index; 
                if (mainActionBtn) mainActionBtn.textContent = 'עדכן דיווח'; 
                if (cancelEditBtn) cancelEditBtn.classList.remove('hidden'); 
                
                // Show delete button
                const deleteButton = document.createElement('button');
                deleteButton.id = 'deleteReportBtn';
                deleteButton.className = 'btn-primary bg-red-500 hover:bg-red-700 font-bold py-2 px-6 rounded-lg shadow w-full sm:w-auto mt-2'; // Red styling
                deleteButton.textContent = 'מחק דיווח';
                deleteButton.setAttribute('data-id', reportToEdit.id);
                // Insert after mainActionBtn, or before cancelEditBtn if cancel is always visible
                if (mainActionBtn.parentNode) { // Check if parent exists
                    mainActionBtn.parentNode.insertBefore(deleteButton, cancelEditBtn); 
                }


                deleteButton.addEventListener('click', async () => {
                    showCustomAlert('האם אתה בטוח שברצונך למחוק דיווח זה?'); // Using custom alert
                    // Temporarily store action and ID for confirmation
                    customAlert.dataset.confirmAction = 'deleteReport';
                    customAlert.dataset.reportIdToDelete = reportToEdit.id;
                });


                if (dateTimeInputsWrapper) dateTimeInputsWrapper.classList.remove('hidden'); 

                if (generalTextInput) {
                    generalTextInput.rows = 5; 
                    generalTextInput.style.height = 'auto'; 
                    generalTextInput.classList.add('edit-mode-fixed-height'); 
                }

                if (newDateInput) newDateInput.readOnly = false; 
                if (newTimeInput) newTimeInput.readOnly = false; 
                filterReporter.focus(); 
            }
        });
    } else {
        console.error('tableBody element not found! Cannot attach event delegation for edit.');
    }

    // --- Delete Report Functionality ---
    const deleteReport = async (reportId) => {
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/public/data/reports`, reportId));
            console.log("Document successfully deleted!");
            showCustomAlert('הדיווח נמחק בהצלחה!');
            resetForm(); // Call resetForm after successful deletion
            // onSnapshot will re-render table automatically
        } catch (error) {
            console.error("Error removing document: ", error);
            showCustomAlert(`שגיאה במחיקת הדיווח: ${error.message}`);
        }
    };

    // --- Delete Day Functionality (new) ---
    const deleteDayReports = async (dateToDelete) => {
        try {
            const q = query(reportsCollectionRef, where("date", "==", dateToDelete));
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                showCustomAlert(`אין דיווחים למחיקה בתאריך ${formatAsDDMMYYYY(dateToDelete)}.`);
                return;
            }

            const batch = writeBatch(db);
            querySnapshot.docs.forEach(docToDelete => {
                batch.delete(doc(db, `artifacts/${appId}/public/data/reports`, docToDelete.id));
            });
            await batch.commit();
            showCustomAlert(`כל הדיווחים מתאריך ${formatAsDDMMYYYY(dateToDelete)} נמחקו בהצלחה!`);
            resetForm(); // Call resetForm after successful deletion
            // onSnapshot will re-render table automatically
        } catch (error) {
            console.error("Error deleting day's reports: ", error);
            showCustomAlert(`שגיאה במחיקת דיווחי היום: ${error.message}`);
        }
    };


    // --- Clock Event Listeners ---
    if (assessmentTimePlusBtn) {
        assessmentTimePlusBtn.addEventListener('click', () => {
            assessmentTimeIsManual = true;
            assessmentTime.setMinutes(assessmentTime.getMinutes() + 10);
            updateAssessmentTimeDisplay();
        });
    }
    if (assessmentTimeMinusBtn) {
        assessmentTimeMinusBtn.addEventListener('click', () => {
            assessmentTimeIsManual = true;
            const prospectiveTime = new Date(assessmentTime.getTime());
            prospectiveTime.setMinutes(prospectiveTime.getMinutes() - 10);
            
            const now = updateCurrentTime(); 
            if (prospectiveTime.getTime() < now.getTime()) {
                assessmentTime = now;
                assessmentTime.setSeconds(0); 
                assessmentTime.setMilliseconds(0);
            } else {
                assessmentTime = prospectiveTime;
            }
            updateAssessmentTimeDisplay();
        });
    }

    // --- Header Menu Event Listeners ---
    if (menuToggleBtn) {
        menuToggleBtn.addEventListener('click', (event) => {
            event.stopPropagation(); 
            headerMenu.classList.toggle('hidden');
            headerMenu.classList.toggle('open'); 
            if (!headerMenu.classList.contains('hidden') && searchInput) {
                searchInput.classList.add('hidden'); 
                isSearchInputVisible = false;
            }
        });
        document.addEventListener('click', (event) => {
            if (headerMenu && !headerMenu.contains(event.target) && !menuToggleBtn.contains(event.target)) {
                headerMenu.classList.add('hidden');
                headerMenu.classList.remove('open');
            }
        });
    }

    if (searchLogBtn) {
        searchLogBtn.addEventListener('click', (event) => {
            event.stopPropagation(); 
            if (searchInput) {
                searchInput.classList.toggle('hidden');
                isSearchInputVisible = !searchInput.classList.contains('hidden');
                if (isSearchInputVisible) {
                    searchInput.focus();
                } else {
                    searchInput.value = '';
                    performSearch(); 
                }
            }
        });
    }

    // Add event listener for search input to perform live search
    if (searchInput) {
        searchInput.addEventListener('input', performSearch);
    }

    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', () => {
            exportReportsToExcel();
            headerMenu.classList.add('hidden'); 
            headerMenu.classList.remove('open');
        });
    }

    if (importExcelBtn) { 
        importExcelBtn.addEventListener('click', () => {
            headerMenu.classList.add('hidden'); 
            headerMenu.classList.remove('open');
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.xlsx, .xls';
            fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    importReportsFromExcel(file);
                }
            };
            fileInput.click();
        });
    }

    if (editReportersBtn) {
        editReportersBtn.addEventListener('click', () => {
            openReportersModal();
            headerMenu.classList.add('hidden'); 
            headerMenu.classList.remove('open');
        });
    }

    // New: Manage Task Settings button listener
    if (manageTaskSettingsBtn) {
        manageTaskSettingsBtn.addEventListener('click', () => {
            openTaskSettingsModal();
            headerMenu.classList.add('hidden'); 
            headerMenu.classList.remove('open');
        });
    }


    // --- Tasks Panel Event Listeners (controlled by dynamic buttons) ---
    // Initialize task type buttons initially
    updateTasksButtonStates(); // Call this once to render all buttons

    // Close button inside panel
    if (closeTasksPanelBtn) {
        closeTasksPanelBtn.addEventListener('click', () => toggleTasksPanel(false));
    }
    
    // Add mouseleave listener to tasksPanel
    if (tasksPanel) {
        tasksPanel.addEventListener('mouseleave', () => toggleTasksPanel(false));
    }


    // When logType changes, update the button states
    if (filterLogType) {
        filterLogType.addEventListener('change', (e) => {
            const selectedLogType = e.target.value;
            updateTasksButtonStates(); 
            if (tasksPanel.classList.contains('is-open')) {
                if (tasksLogTypeDisplay.textContent !== selectedLogType) { 
                    toggleTasksPanel(false); 
                }
            }
            // Logic to keep task panel closed if there are no tasks for the selected type
            const selectedLogTypeObj = definedLogTypes.find(lt => lt.name === selectedLogType);
            if (!selectedLogTypeObj || selectedLogTypeObj.tasks.length === 0) {
                if (tasksPanel.classList.contains('is-open') && tasksLogTypeDisplay.textContent === selectedLogType) {
                    toggleTasksPanel(false);
                }
            }
        });
    }

    // --- Task Settings Modal Functions (New) ---
    const openTaskSettingsModal = () => {
        if (taskSettingsModal) {
            taskSettingsModal.classList.remove('hidden');
            // Reset modal content
            if (selectTaskTypeForSettings) selectTaskTypeForSettings.value = "";
            if (currentTasksForSettings) currentTasksForSettings.innerHTML = '<p class="text-gray-500 text-center">בחר שיוך כדי לראות משימות.</p>';
            if (newTaskItemInput) newTaskItemInput.value = '';
            if (newTaskItemInput) newTaskItemInput.classList.add('hidden');
            if (addTaskItemBtn) addTaskItemBtn.classList.add('hidden');
            // New fields for adding log type
            if (newTaskTypeInput) newTaskTypeInput.classList.add('hidden');
            if (addNewTaskTypeBtn) addNewTaskTypeBtn.classList.add('hidden');
        }
    };

    const closeTaskSettingsModal = () => {
        if (taskSettingsModal) {
            taskSettingsModal.classList.add('hidden');
        }
    };

    if (closeTaskSettingsModalBtn) {
        closeTaskSettingsModalBtn.addEventListener('click', closeTaskSettingsModal);
    }

    if (selectTaskTypeForSettings) {
        selectTaskTypeForSettings.addEventListener('change', (e) => {
            const selectedType = e.target.value;
            if (selectedType === "הוסף שיוך") {
                if (newTaskTypeInput) newTaskTypeInput.classList.remove('hidden');
                if (addNewTaskTypeBtn) addNewTaskTypeBtn.classList.remove('hidden');
                if (currentTasksForSettings) currentTasksForSettings.innerHTML = '';
                if (newTaskItemInput) newTaskItemInput.classList.add('hidden');
                if (addTaskItemBtn) addTaskItemBtn.classList.add('hidden');
            } else if (selectedType) {
                renderCurrentTasksForSettings(selectedType);
                if (newTaskTypeInput) newTaskTypeInput.classList.add('hidden');
                if (addNewTaskTypeBtn) addNewTaskTypeBtn.classList.add('hidden');
                if (newTaskItemInput) newTaskItemInput.classList.remove('hidden');
                if (addTaskItemBtn) addTaskItemBtn.classList.remove('hidden');
            } else { // "בחר שיוך" selected
                if (currentTasksForSettings) currentTasksForSettings.innerHTML = '<p class="text-gray-500 text-center">בחר שיוך כדי לראות משימות.</p>';
                if (newTaskTypeInput) newTaskTypeInput.classList.add('hidden');
                if (addNewTaskTypeBtn) addNewTaskTypeBtn.classList.add('hidden');
                if (newTaskItemInput) newTaskItemInput.classList.add('hidden');
                if (addTaskItemBtn) addTaskItemBtn.classList.add('hidden');
            }
        });
    }

    if (addNewTaskTypeBtn) {
        addNewTaskTypeBtn.addEventListener('click', () => {
            const newLogTypeName = newTaskTypeInput.value.trim();
            addLogType(newLogTypeName);
        });
    }


    const renderCurrentTasksForSettings = (logType) => {
        if (!currentTasksForSettings) return;
        currentTasksForSettings.innerHTML = '';
        const logTypeObj = definedLogTypes.find(lt => lt.name === logType);
        const tasks = logTypeObj ? logTypeObj.tasks : [];

        if (tasks.length === 0) {
            currentTasksForSettings.innerHTML = `<p class="text-gray-500 text-center">אין משימות מוגדרות עבור ${logType}.</p>`;
        } else {
            const ul = document.createElement('ul');
            ul.className = 'space-y-2';
            tasks.forEach(task => {
                const li = document.createElement('li');
                li.className = 'flex justify-between items-center bg-white p-2 rounded-md shadow-sm';
                li.innerHTML = `
                    <span>${task.text}</span>
                    <button data-task-id="${task.id}" data-log-type="${logType}" class="remove-task-item text-red-500 hover:text-red-700 text-sm">הסר</button>
                `;
                ul.appendChild(li);
            });
            currentTasksForSettings.appendChild(ul);

            currentTasksForSettings.querySelectorAll('.remove-task-item').forEach(button => {
                button.addEventListener('click', (e) => {
                    const taskIdToRemove = e.target.dataset.taskId;
                    const logTypeToRemove = e.target.dataset.logType;
                    // Confirm before removing the task and its reports
                    showCustomAlert(`האם אתה בטוח שברצונך להסיר משימה זו (${e.target.previousElementSibling.textContent}) וכל הדיווחים שנוצרו עבורה?`);
                    customAlert.dataset.confirmAction = 'removeTask';
                    customAlert.dataset.taskIdToRemove = taskIdToRemove;
                    customAlert.dataset.logTypeToRemove = logTypeToRemove;
                });
            });
        }
    };

    if (addTaskItemBtn) {
        addTaskItemBtn.addEventListener('click', () => {
            const selectedType = selectTaskTypeForSettings.value;
            const newItemText = newTaskItemInput.value.trim();
            if (selectedType && newItemText) {
                addTaskToLogType(selectedType, newItemText);
            } else {
                showCustomAlert("יש לבחור שיוך ולהזין טקסט למשימה.");
            }
        });
    }

    // --- Custom Alert Event Listener ---
    if (customAlertCloseBtn) {
        customAlertCloseBtn.addEventListener('click', () => {
            if (customAlert) {
                customAlert.classList.add('hidden');
                // Handle confirmation actions here
                if (customAlert.dataset.confirmAction === 'deleteReport') {
                    const reportIdToDelete = customAlert.dataset.reportIdToDelete;
                    if (reportIdToDelete) {
                        deleteReport(reportIdToDelete);
                    }
                    delete customAlert.dataset.confirmAction;
                    delete customAlert.dataset.reportIdToDelete;
                } else if (customAlert.dataset.confirmAction === 'deleteDay') {
                    const dateToDelete = customAlert.dataset.dateToDelete;
                    if (dateToDelete) {
                        deleteDayReports(dateToDelete);
                    }
                    delete customAlert.dataset.confirmAction;
                    delete customAlert.dataset.dateToDelete;
                } else if (customAlert.dataset.confirmAction === 'deleteReporter') { // New: Handle delete reporter confirmation
                    const reporterIdToDelete = customAlert.dataset.reporterIdToDelete;
                    if (reporterIdToDelete) {
                        deleteReporterFromFirestore(reporterIdToDelete);
                    }
                    delete customAlert.dataset.confirmAction;
                    delete customAlert.dataset.reporterIdToDelete;
                } else if (customAlert.dataset.confirmAction === 'removeTask') { // NEW: Handle remove task confirmation
                    const taskIdToRemove = customAlert.dataset.taskIdToRemove;
                    const logTypeToRemove = customAlert.dataset.logTypeToRemove;
                    if (taskIdToRemove && logTypeToRemove) {
                        removeTaskFromLogType(logTypeToRemove, taskIdToRemove);
                    }
                    delete customAlert.dataset.confirmAction;
                    delete customAlert.dataset.taskIdToRemove;
                    delete customAlert.dataset.logTypeToRemove;
                }
            }
        });
    }

    // --- Import Excel Functionality ---
    const importReportsFromExcel = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (json.length === 0) {
                showCustomAlert('קובץ האקסל ריק או לא מכיל נתונים.');
                return;
            }

            const headerRow = json[0];
            const dataRows = json.slice(1);

            const fieldMap = {
                "דיווח": "description",
                "תאריך": "date",
                "שעה": "time",
                "שם המדווח": "reporter",
                "שיוך יומן": "logType"
            };

            const newReports = [];
            let isValid = true;

            for (const row of dataRows) {
                if (row.length === 0 || row.every(cell => cell === undefined || cell === '')) {
                    continue; // Skip empty rows
                }

                const reportData = {};
                for (let i = 0; i < headerRow.length; i++) {
                    const header = headerRow[i];
                    const field = fieldMap[header];
                    if (field) {
                        reportData[field] = row[i];
                    }
                }

                // Validate required fields and format
                if (!reportData.description || !reportData.date || !reportData.time || !reportData.reporter || !reportData.logType) {
                    showCustomAlert('שגיאת ייבוא: וודא שכל העמודות הנדרשות (דיווח, תאריך, שעה, שם המדווח, שיוך יומן) קיימות ומלאות בכל שורה.');
                    isValid = false;
                    break;
                }
                if (!isValidTimeFormat(reportData.time)) {
                    showCustomAlert(`שגיאת ייבוא: פורמט שעה שגוי בשורה עבור דיווח "${reportData.description}". פורמט נדרש: HH:MM.`);
                    isValid = false;
                    break;
                }
                
                // Convert Excel date (number) to IHDA-MM-DD string
                // Excel dates are days since 1900-01-01 (or 1904-01-01 for Mac, usually 1900)
                if (typeof reportData.date === 'number') {
                    const excelEpoch = new Date('1899-12-30T00:00:00Z'); // Excel's day 1 is 1900-01-01
                    const msPerDay = 24 * 60 * 60 * 1000;
                    const dateObj = new Date(excelEpoch.getTime() + reportData.date * msPerDay);
                    reportData.date = dateObj.toISOString().split('T')[0];
                } else if (typeof reportData.date === 'string') {
                    // Try to parse string dates into IHDA-MM-DD
                    const parsedDate = new Date(reportData.date);
                    if (isNaN(parsedDate.getTime())) {
                         showCustomAlert(`שגיאת ייבוא: פורמט תאריך שגוי בשורה עבור דיווח "${reportData.description}". פורמט נדרש: IHDA-MM-DD או תאריך אקסל נומרי.`);
                         isValid = false;
                         break;
                    }
                    reportData.date = parsedDate.toISOString().split('T')[0];
                } else {
                    showCustomAlert(`שגיאת ייבוא: פורמט תאריך לא נתמך בשורה עבור דיווח "${reportData.description}".`);
                    isValid = false;
                    break;
                }

                newReports.push({
                    description: String(reportData.description), // Ensure string
                    date: reportData.date,
                    time: String(reportData.time),
                    reporter: String(reportData.reporter),
                    logType: String(reportData.logType),
                    creatorId: currentUserId,
                    timestamp: new Date().toISOString() // Current time for timestamp
                });
            }

            if (!isValid) return; // Stop if validation failed

            if (newReports.length > 0) {
                const batch = writeBatch(db);
                newReports.forEach(report => {
                    const newDocRef = doc(reportsCollectionRef); // Auto-generate ID
                    batch.set(newDocRef, report);
                });

                try {
                    batch.commit();
                    showCustomAlert(`ייבוא הושלם! נוספו ${newReports.length} דיווחים.`);
                } catch (e) {
                    console.error("Error writing batch to Firestore:", e);
                    showCustomAlert(`שגיאה בשמירת דיווחים ל-Firebase: ${e.message}. וודא הרשאות כתיבה.`);
                }
            } else {
                showCustomAlert('לא נמצאו דיווחים חוקיים לייבוא בקובץ.');
            }
        };
        reader.readAsArrayBuffer(file);
    };


    // Initialize default date and time, and reset form
    setDefaultDateTime();
    resetForm(); 
    updateTasksButtonStates(); 
});

// Update render table on window resize to adjust colspan for empty/loading states
window.addEventListener('resize', () => {
    renderTable(searchInput ? searchInput.value.trim() : '');
});