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
} from './firebase.js'; 

// Firestore collection references
let reportsCollectionRef = null; 
let reportersCollectionRef = null;
let tasksCompletionCollectionRef = null; 

// Unsubscribe functions for real-time listeners
let unsubscribeFromReports = null; 
let unsubscribeFromReporters = null; 
let unsubscribeFromTasksCompletion = null; 

// Global state for tasks completion (client-side cache)
let completedTasks = {}; // Stores { logType: { taskId: true/false } }
let selectedLogTypeTasksCompleted = true; // Tracks if all tasks for the *currently selected log type* are completed


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
let menuToggleBtn; // New for hamburger menu
let headerMenu;     // New for dropdown menu
let searchLogBtn;   
let searchInput;    
let exportExcelBtn; 
let editReportersBtn; 
let tasksButton;    // New dedicated tasks button

// Clock DOM references
let currentTimeDisplay;
let assessmentTimeDisplay;
let assessmentTimePlusBtn;
let assessmentTimeMinusBtn;

// Clock state variables
let assessmentTime = new Date(); 
let assessmentTimeIsManual = false; // Flag to indicate if assessment time was manually set

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

// Custom Alert DOM references
let customAlert;
let customAlertMessage;
let customAlertCloseBtn;


// --- UI State Management ---
const showLoginPage = () => {
    if (loginPage) loginPage.classList.remove('hidden');
    if (appContent) appContent.classList.add('hidden');
    // Hide tasks panel and reporters modal on logout
    if (tasksPanel) tasksPanel.classList.remove('is-open');
    if (reportersModal) reportersModal.classList.add('hidden');
    // Close header menu on logout
    if (headerMenu) headerMenu.classList.remove('open');
};

const showAppContent = () => {
    if (loginPage) loginPage.classList.add('hidden');
    if (appContent) appContent.classList.remove('hidden');
};

// Function to show custom alert
const showCustomAlert = (message) => {
    if (customAlert && customAlertMessage) {
        customAlertMessage.textContent = message;
        customAlert.classList.remove('hidden');
    }
};

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
const renderTable = (searchTerm = '') => {
    if (!tableBody) { 
        console.error('tableBody element not found. Cannot render table.');
        return;
    }
    tableBody.innerHTML = ''; 
    
    if (loadingStateRow) {
        loadingStateRow.classList.add('hidden');
    }

    let currentDisplayReports = [...reports]; // Start with a copy of the global reports array

    // Apply search filter if a search term exists
    if (searchTerm) {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        currentDisplayReports = currentDisplayReports.filter(report => 
            report.description.toLowerCase().includes(lowerCaseSearchTerm) ||
            report.reporter.toLowerCase().includes(lowerCaseSearchTerm) ||
            report.logType.toLowerCase().includes(lowerCaseSearchTerm)
        );
    }

    // After filtering, if we are NOT searching, potentially promote the last added report
    if (lastAddedReportId && !searchTerm) { 
        const lastAddedIndex = currentDisplayReports.findIndex(report => report.id === lastAddedReportId);
        if (lastAddedIndex !== -1) {
            const [topReport] = currentDisplayReports.splice(lastAddedIndex, 1); 
            currentDisplayReports.unshift(topReport); 
        }
        // Clear lastAddedReportId AFTER it's been used for rendering this cycle
        lastAddedReportId = null; 
    }
    
    if (currentDisplayReports.length === 0) {
        if (emptyStateRow) { 
            // Update colspan for mobile and desktop views
            // On desktop: 6 columns (דיווח, תאריך, שעה, מדווח, שיוך, פעולות)
            // On mobile: 3 columns (דיווח, שעה, פעולות)
            const colspan = window.innerWidth <= 639 ? 3 : 6; 
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
        // Only collapse if not searching
        const isCollapsed = searchTerm ? false : collapsedGroups.has(dateKey); 

        const headerRow = document.createElement('tr');
        headerRow.className = 'date-group-header bg-[#F8F5F1] border-b-2 border-[#DCD5CC]';
        
        // Colspan for group header: 6 columns on desktop, 3 on mobile
        const headerColspan = window.innerWidth <= 639 ? 3 : 6;

        // Date group header should only display date (Point 1)
        headerRow.innerHTML = `
            <td colspan="${headerColspan}" class="p-3 font-bold text-[#6D5F53] text-right">
                <button class="toggle-day-btn text-blue-600 hover:text-blue-800 ml-2" data-toggle-date="${dateKey}">
                    ${isCollapsed ? '◀' : '▼'}
                </button>
                ${formatAsDDMMYYYY(dateKey)}
            </td>
        `;
        tableBody.appendChild(headerRow);

        const reportsContainerRow = document.createElement('tr');
        reportsContainerRow.className = `date-group-content ${isCollapsed ? 'hidden' : ''}`; 
        reportsContainerRow.dataset.contentDate = dateKey; 

        const reportsCell = document.createElement('td');
        // Colspan for reports cell within group: 6 columns on desktop, 3 on mobile
        const reportsCellColspan = window.innerWidth <= 639 ? 3 : 6;
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

            // Check if report is older than 48 hours for edit lock 
            const reportDateTime = new Date(report.timestamp); // Use the timestamp from Firebase
            const now = new Date();
            const diffHours = (now.getTime() - reportDateTime.getTime()) / (1000 * 60 * 60);
            const canEdit = diffHours < 48;

            // Function to highlight text
            const highlightText = (text, term) => {
                if (!term) return text;
                const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                return text.replace(regex, '<span class="highlight">$&</span>');
            };

            reportRow.innerHTML = `
                <td class="table-cell">${highlightText(report.description, searchTerm)}</td>
                <td class="table-cell table-cell-desktop-only">${formatAsDDMMYYYY(report.date)}</td> <!-- Restored for desktop -->
                <td class="table-cell">${report.time}</td>
                <td class="table-cell table-cell-desktop-only">${highlightText(report.reporter, searchTerm)}</td>
                <td class="table-cell table-cell-desktop-only">${highlightText(report.logType, searchTerm)}</td> <!-- Restored for desktop -->
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
        
        if (!isToday && !collapsedGroups.has(dateKey) && !searchTerm) { 
            collapsedGroups.add(dateKey); 
            reportsContainerRow.classList.add('hidden'); 
            const toggleButton = headerRow.querySelector('.toggle-day-btn');
            if (toggleButton) { 
                toggleButton.textContent = '◀'; 
            }
        }
    });
    
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

    if (filterLogType) {
        filterLogType.value = ""; // Reset log type selection
        updateTasksButtonState(""); // Update tasks button for empty selection
    }
    toggleTasksPanel(false); // Hide tasks panel on form reset
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
        inputErrorMessage.textContent = 'יש למלא את כל השדות: תיאור, תאריך ושעה.';
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

    // Check 48-hour edit lock 
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
        // timestamp is NOT updated on edit to preserve original creation time for the 48-hour rule
    };

    try {
        const docRef = doc(db, `artifacts/${appId}/public/data/reports`, reportToUpdate.id); 
        await setDoc(docRef, updatedReportData, { merge: true }); 
        console.log("Document updated with ID: ", reportToUpdate.id);
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
    // Hide loading state
    if (loadingStateRow) loadingStateRow.classList.add('hidden');

    if (user) {
        currentUserId = user.uid;
        console.log('User signed in. UID:', currentUserId);
        console.log('User email:', user.email);

        console.log('User is authenticated. Showing app content.');
        showAppContent(); 

        // Initialize reports collection reference if not already done
        if (!reportsCollectionRef) {
             reportsCollectionRef = collection(db, `artifacts/${appId}/public/data/reports`);
             console.log('Reports collection path (PUBLIC):', `artifacts/${appId}/public/data/reports`);
        }
        // Initialize reporters collection reference
        if (!reportersCollectionRef) {
            reportersCollectionRef = collection(db, `artifacts/${appId}/public/data/reporters`);
            console.log('Reporters collection path (PUBLIC):', `artifacts/${appId}/public/data/reporters`);
        }
        // Initialize tasks completion collection reference
        if (!tasksCompletionCollectionRef) {
            tasksCompletionCollectionRef = doc(db, `artifacts/${appId}/users/${currentUserId}/tasks_completion`, 'status');
            console.log('Tasks completion document path (PRIVATE):', `artifacts/${appId}/users/${currentUserId}/tasks_completion/status`);
        }
       
        // Set up real-time listener for reports if not active
        if (!unsubscribeFromReports) {
            unsubscribeFromReports = onSnapshot(reportsCollectionRef, (snapshot) => {
                const fetchedReports = [];
                snapshot.forEach(doc => {
                    fetchedReports.push({ id: doc.id, ...doc.data() });
                });
                reports = sortChronologically(fetchedReports); 
                console.log('Reports fetched and sorted:', reports);
                renderTable(); // Initial render after data fetch
            }, (error) => {
                console.error("Error getting reports in real-time: ", error);
                inputErrorMessage.textContent = 'שגיאה בטעינת דיווחים: ' + error.message;
            });
        }

        // Set up real-time listener for reporters 
        if (!unsubscribeFromReporters) {
            unsubscribeFromReporters = onSnapshot(reportersCollectionRef, (snapshot) => {
                const fetchedReporters = [];
                snapshot.forEach(doc => {
                    fetchedReporters.push(doc.data().name); 
                });
                populateReportersDropdown(fetchedReporters);
                renderReportersInModal(fetchedReporters);
            }, (error) => {
                console.error("Error getting reporters in real-time: ", error);
            });
        }

        // Set up real-time listener for tasks completion 
        if (!unsubscribeFromTasksCompletion) {
            unsubscribeFromTasksCompletion = onSnapshot(tasksCompletionCollectionRef, (docSnap) => {
                if (docSnap.exists()) {
                    completedTasks = docSnap.data();
                    console.log("Completed tasks loaded:", completedTasks);
                } else {
                    console.log("No completed tasks data found for user.");
                    completedTasks = {}; 
                }
                // Re-render tasks panel if it's open, to reflect updated completion status
                if (tasksPanel && tasksPanel.classList.contains('is-open')) {
                    const currentLogType = tasksLogTypeDisplay.textContent.replace('משימות עבור ', '');
                    renderTasksPanel(currentLogType);
                }
                updateTasksButtonState(filterLogType.value); // Update button state after tasks load
            }, (error) => {
                console.error("Error getting tasks completion in real-time: ", error);
            });
        }

    } else {
        console.log('No user signed in. Showing login page.');
        showLoginPage(); 
        reports = []; 
        renderTable(); 
        resetForm(); 

        // Unsubscribe from all listeners on logout
        if (unsubscribeFromReports) unsubscribeFromReports();
        unsubscribeFromReports = null;
        if (unsubscribeFromReporters) unsubscribeFromReporters();
        unsubscribeFromReporters = null;
        if (unsubscribeFromTasksCompletion) unsubscribeFromTasksCompletion();
        unsubscribeFromTasksCompletion = null;

        // Hide and clear search input on logout
        if (searchInput) searchInput.classList.add('hidden'); 
        if (searchInput) searchInput.value = ''; 
        isSearchInputVisible = false;
    }
};

// --- Clock Functions ---

// Update current time display
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

// Update assessment time display
const updateAssessmentTimeDisplay = () => {
    const now = new Date();
    
    if (assessmentTimeDisplay) {
        if (!assessmentTimeIsManual) { // Only display "טרם נקבע" if not manually set
            assessmentTimeDisplay.textContent = 'טרם נקבע';
            assessmentTimeDisplay.classList.remove('blinking-red'); 
        } else {
            const hours = assessmentTime.getHours().toString().padStart(2, '0');
            const minutes = assessmentTime.getMinutes().toString().padStart(2, '0');
            assessmentTimeDisplay.textContent = `${hours}:${minutes}`;
            checkBlinkingStatus(); // Continue blinking check if manually set
        }
    }
};

// Check and apply blinking status for assessment time
const checkBlinkingStatus = () => {
    const now = updateCurrentTime(); 
    const diffMs = assessmentTime.getTime() - now.getTime();
    const diffMinutes = diffMs / (1000 * 60);

    if (assessmentTimeDisplay) {
        // Blinking only if time is in the future and within 5 minutes
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
let currentReporters = []; 

const populateReportersDropdown = (reportersArray) => {
    if (filterReporter) {
        filterReporter.innerHTML = ''; 
        // Add a default empty option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'בחר מדווח';
        filterReporter.appendChild(defaultOption);

        if (reportersArray.length === 0) {
            filterReporter.disabled = true;
        } else {
            reportersArray.sort((a,b) => a.localeCompare(b, 'he')); 
            reportersArray.forEach(reporter => {
                const option = document.createElement('option');
                option.value = reporter;
                option.textContent = reporter;
                filterReporter.appendChild(option);
            });
            filterReporter.disabled = false;
        }
        currentReporters = reportersArray; 
    }
};

const renderReportersInModal = (reportersArray) => {
    if (reportersListUl) {
        reportersListUl.innerHTML = '';
        if (reportersArray.length === 0) {
            reportersListUl.innerHTML = '<li class="p-4 text-center text-gray-500">אין מדווחים מוגדרים.</li>';
            return;
        }
        reportersArray.sort((a,b) => a.localeCompare(b, 'he')); 
        reportersArray.forEach(reporter => {
            const li = document.createElement('li');
            li.className = 'reporters-list-item';
            li.innerHTML = `
                <span>${reporter}</span>
                <button data-name="${reporter}">מחק</button>
            `;
            reportersListUl.appendChild(li);
        });

        // Add event listener for delete buttons
        reportersListUl.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', async (e) => {
                const nameToDelete = e.target.dataset.name;
                await deleteReporterFromFirestore(nameToDelete);
            });
        });
    }
};

const openReportersModal = () => {
    if (reportersModal) {
        reportersModal.classList.remove('hidden');
        if (newReporterNameInput) newReporterNameInput.value = ''; 
        if (reporterErrorMessage) reporterErrorMessage.textContent = ''; 
        renderReportersInModal(currentReporters); 
    }
};

const closeReportersModal = () => {
    if (reportersModal) {
        reportersModal.classList.add('hidden');
    }
};

const addReporterToFirestore = async (name) => {
    if (!name || name.trim() === '') {
        if (reporterErrorMessage) reporterErrorMessage.textContent = 'שם המדווח אינו יכול להיות ריק.';
        return;
    }
    if (currentReporters.includes(name.trim())) {
        if (reporterErrorMessage) reporterErrorMessage.textContent = 'מדווח בשם זה כבר קיים.';
        return;
    }

    try {
        await addDoc(reportersCollectionRef, { name: name.trim() });
        console.log(`Reporter "${name}" added.`);
        if (newReporterNameInput) newReporterNameInput.value = '';
        if (reporterErrorMessage) reporterErrorMessage.textContent = '';
    } catch (e) {
        console.error("Error adding reporter: ", e);
        if (reporterErrorMessage) reporterErrorMessage.textContent = 'שגיאה בהוספת מדווח: ' + e.message;
    }
};

const deleteReporterFromFirestore = async (name) => {
    try {
        // Find the document ID for the reporter by name
        const q = query(reportersCollectionRef, where("name", "==", name));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const docToDelete = querySnapshot.docs[0];
            await deleteDoc(doc(db, `artifacts/${appId}/public/data/reporters`, docToDelete.id));
            console.log(`Reporter "${name}" deleted.`);
            if (reporterErrorMessage) reporterErrorMessage.textContent = '';
        } else {
            console.warn(`Reporter "${name}" not found for deletion.`);
            if (reporterErrorMessage) reporterErrorMessage.textContent = 'מדווח לא נמצא.';
        }
    } catch (e) {
        console.error("Error deleting reporter: ", e);
        if (reporterErrorMessage) reporterErrorMessage.textContent = 'שגיאה במחיקת מדווח: ' + e.message;
    }
};


// --- Order of Operations / Tasks Panel ---
// Dummy data for order of operations. THIS SHOULD BE LOADED FROM A DATABASE/CONFIG.
const orderOfOperations = {
    "בטחוני": [
        { id: 'sec_task_1', text: 'בדיקת קשר ותקשורת עם מפקדה' },
        { id: 'sec_task_2', text: 'אבטחת שטח/ציר פיזי' },
        { id: 'sec_task_3', text: 'פריסת כוחות/עמדות' },
        { id: 'sec_task_4', text: 'תיאום עם גורמי ביטחון נוספים' },
        { id: 'sec_task_5', text: 'הערכת מצב ראשונית' },
    ],
    "שריפה": [
        { id: 'fire_task_1', text: 'הודעה מיידית לכבאות והצלה' },
        { id: 'fire_task_2', text: 'פינוי מיידי של נפגעים/לכודים' },
        { id: 'fire_task_3', text: 'הגדרת קווי אש/מגבלות התפשטות' },
        { id: 'fire_task_4', text: 'אבטחת גישה לצוותי חירום' },
        { id: 'fire_task_5', text: 'כיבוי ראשוני (אם בטוח)' },
    ],
    "נעדר": [
        { id: 'missing_task_1', text: 'קבלת פרטים מזהים ופרטי לבוש' },
        { id: 'missing_task_2', text: 'איסוף מידע על נסיבות ההיעלמות' },
        { id: 'missing_task_3', text: 'פתיחת סריקה ראשונית באזור' },
        { id: 'missing_task_4', text: 'הודעה למשטרה ולגורמי חיפוש' },
        { id: 'missing_task_5', text: 'גיוס כוחות סיוע (מתנדבים/כלבנים)' },
    ],
    "שגרה": [
        { id: 'routine_task_1', text: 'בדיקת תקינות מערכות' },
        { id: 'routine_task_2', text: 'עדכון סטטוס משימות פתוחות' },
        { id: 'routine_task_3', text: 'ביצוע סיור/בדיקה תקופתית' },
        { id: 'routine_task_4', text: 'הכנת ציוד ומשאבים' },
    ],
};

const toggleTasksPanel = (open) => { // Removed logType from here, handled in renderTasksPanel
    if (tasksPanel) {
        if (open) {
            tasksPanel.classList.add('is-open');
        } else {
            tasksPanel.classList.remove('is-open');
        }
    }
};

// Function to update the "משימות" button's color based on completion status of the selected log type
const updateTasksButtonState = (logType) => {
    if (!tasksButton) return;

    if (!logType || logType === '') {
        tasksButton.classList.remove('btn-tasks-completed');
        tasksButton.classList.remove('btn-tasks'); // Remove red/green classes
        tasksButton.classList.add('btn-secondary'); // Make it grey/default
        tasksButton.disabled = true;
        return;
    } else {
        tasksButton.classList.remove('btn-secondary'); // Remove grey/default
        tasksButton.disabled = false;
    }

    const tasksForType = orderOfOperations[logType] || [];
    if (tasksForType.length === 0) {
        tasksButton.classList.add('btn-tasks-completed'); // Green if no tasks defined
        tasksButton.classList.remove('btn-tasks'); // Ensure no red class
        return;
    }

    selectedLogTypeTasksCompleted = true; // Assume true, then check
    for (const task of tasksForType) {
        const isCompleted = completedTasks[logType] && completedTasks[logType][task.id];
        if (!isCompleted) {
            selectedLogTypeTasksCompleted = false;
            break;
        }
    }

    if (selectedLogTypeTasksCompleted) {
        tasksButton.classList.add('btn-tasks-completed'); // Green
        tasksButton.classList.remove('btn-tasks'); // Ensure no red class
    } else {
        tasksButton.classList.remove('btn-tasks-completed'); // Red
        tasksButton.classList.add('btn-tasks'); // Ensure red class
    }
};


const renderTasksPanel = (logType) => {
    if (!tasksList || !tasksLogTypeDisplay || !allTasksCompletedMessage) {
        console.error('Task panel elements not found.');
        return;
    }

    tasksLogTypeDisplay.textContent = logType;
    tasksList.innerHTML = '';
    const tasksForType = orderOfOperations[logType] || [];
    
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

            // Add event listener to checkbox
            taskItemDiv.querySelector(`input[type="checkbox"]`).addEventListener('change', (e) => {
                handleTaskCheckboxChange(e.target.dataset.taskId, e.target.dataset.logType, task.text, e.target.checked);
            });
        });
    }

    // Show/hide "All tasks completed" message
    if (allTasksCompletedForTypeCurrentlyDisplayed && tasksForType.length > 0) {
        allTasksCompletedMessage.classList.remove('hidden');
        // Do NOT hide the panel here, user might want to see the completed list
    } else {
        allTasksCompletedMessage.classList.add('hidden');
    }
    updateTasksButtonState(logType); // Update button state after rendering tasks
};

const handleTaskCheckboxChange = async (taskId, logType, taskText, isChecked) => {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0].substring(0, 5); 

    const taskReportDescription = `משימת "${taskText}" עבור שיוך "${logType}" ${isChecked ? 'הושלמה' : 'בוטלה'}.`;
    const reportIdPrefix = `task-${logType}-${taskId}`; 

    // Update client-side state
    if (!completedTasks[logType]) {
        completedTasks[logType] = {};
    }
    completedTasks[logType][taskId] = isChecked;

    // Update Firestore for task completion status (private to user)
    try {
        await setDoc(tasksCompletionCollectionRef, completedTasks, { merge: true });
        console.log(`Task completion status updated for ${logType}/${taskId}.`);
    } catch (error) {
        console.error("Error updating task completion status:", error);
    }

    // Find if a corresponding report already exists
    const existingTaskReport = reports.find(r => r.description === taskReportDescription && r.isTaskReport && r.taskReportId === reportIdPrefix);

    if (isChecked) {
        if (!existingTaskReport) {
            // Add a new report to the main reports collection
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
            console.log("Task report already exists, no new report added.");
        }
    } else { 
        if (existingTaskReport) {
            // Delete the corresponding report from the main reports collection
            try {
                await deleteDoc(doc(db, `artifacts/${appId}/public/data/reports`, existingTaskReport.id));
                console.log("Auto-generated task report deleted.");
            } catch (e) {
                console.error("Error deleting auto-generated task report: ", e);
            }
        }
    }
    
    // Re-render the tasks panel to reflect visual changes and update button state
    renderTasksPanel(logType);
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
    editReportersBtn = document.getElementById('editReportersBtn'); 
    tasksButton = document.getElementById('tasksButton');

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

    // Custom Alert DOM references
    customAlert = document.getElementById('customAlert');
    customAlertMessage = document.getElementById('customAlertMessage');
    customAlertCloseBtn = document.getElementById('customAlertCloseBtn');


    // --- Firebase Initialization ---
    if (!auth || !db) {
        console.error('Firebase Auth or Firestore not initialized. Check firebase.js for errors.');
        loginErrorMessage.textContent = 'שגיאה: Firebase לא אותחל באופן מלא.';
        showLoginPage(); 
        return;
    }

    // Initial state: show loading then login page
    if (loadingStateRow) loadingStateRow.classList.remove('hidden'); 

    // Attempt anonymous sign-in or custom token sign-in on load to bypass login
    try {
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
            console.log("Signed in with custom token.");
        } else {
            await signInAnonymously(auth);
            console.log("Signed in anonymously.");
        }
    } catch (error) {
        console.error("Error during automatic sign-in:", error);
        loginErrorMessage.textContent = "שגיאת התחברות אוטומטית: " + error.message;
        showLoginPage(); 
    }


    // --- Set up initial data/listeners ---
    setDefaultDateTime();
    resetForm(); 

    // Initialize clocks
    // assessmentTime is already initialized with current time. Keep assessmentTimeIsManual as false initially.
    assessmentTime.setMinutes(assessmentTime.getMinutes() + 30); // Add 30 minutes for a meaningful initial future time
    assessmentTime.setSeconds(0); 
    assessmentTime.setMilliseconds(0);
    updateAssessmentTimeDisplay(); // Update display with initial state
    setInterval(updateCurrentTime, 1000); // Update current time every second
    setInterval(updateAssessmentTimeDisplay, 1000); // Check assessment time status every second


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
                // Hide and clear search input on logout
                if (searchInput) searchInput.classList.add('hidden'); 
                if (searchInput) searchInput.value = ''; 
                isSearchInputVisible = false;
            } catch (error) {
                console.error("Error signing out:", error);
                loginErrorMessage.textContent = "שגיאה בהתנתקות: " + error.message; 
            }
        });
    }

    // --- Firebase Auth State Changed Listener ---
    onAuthStateChanged(auth, handleAuthState);


    // --- Attach Main App Event Listeners ---
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
                
                // Check 48-hour edit lock 
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
                
                if (dateTimeInputsWrapper) dateTimeInputsWrapper.classList.remove('hidden'); 

                if (generalTextInput) {
                    generalTextInput.rows = 5; 
                    generalTextInput.style.height = 'auto'; 
                    generalTextInput.classList.add('edit-mode-fixed-height'); 
                }

                if (newDateInput) newDateInput.readOnly = false; 
                if (newTimeInput) newTimeInput.readOnly = false; 

                if (generalTextInput) generalTextInput.focus(); 
            }
        });
    } else {
        console.error('tableBody element not found! Cannot attach event delegation for edit.');
    }

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
        menuToggleBtn.addEventListener('click', () => {
            headerMenu.classList.toggle('hidden');
            headerMenu.classList.toggle('open'); // For transition animation
        });
        // Close menu if clicked outside
        document.addEventListener('click', (event) => {
            if (headerMenu && !headerMenu.contains(event.target) && !menuToggleBtn.contains(event.target)) {
                headerMenu.classList.add('hidden');
                headerMenu.classList.remove('open');
            }
        });
    }

    if (searchLogBtn) {
        searchLogBtn.addEventListener('click', () => {
            toggleSearchInput();
            headerMenu.classList.add('hidden'); // Close menu after selection
            headerMenu.classList.remove('open');
        });
    }
    if (searchInput) {
        searchInput.addEventListener('input', performSearch); 
    }

    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', () => {
            exportReportsToExcel();
            headerMenu.classList.add('hidden'); // Close menu after selection
            headerMenu.classList.remove('open');
        });
    }

    // --- Reporters Management Event Listeners ---
    if (editReportersBtn) {
        editReportersBtn.addEventListener('click', () => {
            openReportersModal();
            headerMenu.classList.add('hidden'); // Close menu after selection
            headerMenu.classList.remove('open');
        });
    }
    if (closeReportersModalBtn) {
        closeReportersModalBtn.addEventListener('click', closeReportersModal);
    }
    if (addReporterBtn) {
        addReporterBtn.addEventListener('click', () => {
            if (newReporterNameInput) {
                addReporterToFirestore(newReporterNameInput.value);
            }
        });
    }
    // Listen for Enter key in newReporterNameInput
    if (newReporterNameInput) {
        newReporterNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addReporterBtn.click();
            }
        });
    }

    // --- Tasks Panel Event Listeners ---
    if (filterLogType) {
        filterLogType.addEventListener('change', (e) => {
            const selectedLogType = e.target.value;
            // Only open panel if a log type is selected and it has tasks
            if (selectedLogType && orderOfOperations[selectedLogType] && orderOfOperations[selectedLogType].length > 0) {
                renderTasksPanel(selectedLogType);
                toggleTasksPanel(true);
            } else {
                toggleTasksPanel(false); // Hide if no log type selected or no tasks for selected type
            }
            updateTasksButtonState(selectedLogType); // Always update button state
        });
    }
    if (closeTasksPanelBtn) {
        closeTasksPanelBtn.addEventListener('click', () => toggleTasksPanel(false));
    }
    // New tasks button listener
    if (tasksButton) {
        tasksButton.addEventListener('click', () => {
            // Only allow opening if a log type is selected
            const selectedLogType = filterLogType.value;
            if (selectedLogType && orderOfOperations[selectedLogType] && orderOfOperations[selectedLogType].length > 0) {
                renderTasksPanel(selectedLogType);
                toggleTasksPanel(true);
            } else if (selectedLogType) {
                showCustomAlert(`אין משימות מוגדרות עבור "${selectedLogType}".`);
            } else {
                showCustomAlert("יש לבחור שיוך יומן כדי לראות משימות.");
            }
        });
    }

    // --- Custom Alert Event Listener ---
    if (customAlertCloseBtn) {
        customAlertCloseBtn.addEventListener('click', () => {
            if (customAlert) customAlert.classList.add('hidden');
        });
    }

    // Initialize default date and time, and reset form
    setDefaultDateTime();
    resetForm(); 
    // Initial update of tasks button state based on default/initial filterLogType value
    updateTasksButtonState(filterLogType.value); 
});

// Update render table on window resize to adjust colspan for empty/loading states
window.addEventListener('resize', () => {
    renderTable(searchInput ? searchInput.value.trim() : '');
});
