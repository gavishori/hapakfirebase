// Global variables for App State
let reports = []; 
let editingReportIndex = null; 
let lastAddedReportId = null; 
let collapsedGroups = new Set(); 

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
    signInWithEmailAndPassword, 
    signOut 
} from './firebase.js'; 

// Import FieldValue DIRECTLY from the Firestore SDK
// import { FieldValue } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


let currentUserId = null;
let reportsCollectionRef = null; 
let unsubscribeFromReports = null; 


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
let exportExcelBtn; // New DOM reference
let searchLogBtn;   // New DOM reference
let searchInput;    // New DOM reference


// Clock DOM references
let currentTimeDisplay;
let assessmentTimeDisplay;
let assessmentTimePlusBtn;
let assessmentTimeMinusBtn;

// Clock state variables
let assessmentTime = new Date(); // Initialize with current time
let assessmentTimeIsManual = false; // Flag to indicate if assessment time was manually set


// --- UI State Management ---
const showLoginPage = () => {
    if (loginPage) loginPage.classList.remove('hidden');
    if (appContent) appContent.classList.add('hidden');
};

const showAppContent = () => {
    if (loginPage) loginPage.classList.add('hidden');
    if (appContent) appContent.classList.remove('hidden');
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
            groupedReports.set(dateKey, []);
        }
        groupedReports.get(dateKey).push(report);
    });

    const sortedDateKeys = Array.from(groupedReports.keys()).sort((a, b) => {
        return new Date(b) - new Date(a);
    });

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;

    sortedDateKeys.forEach(dateKey => {
        const reportsForDate = groupedReports.get(dateKey);
        const isToday = dateKey === todayKey;
        // Only collapse if not searching
        const isCollapsed = searchTerm ? false : collapsedGroups.has(dateKey); 

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

        const reportsContainerRow = document.createElement('tr');
        reportsContainerRow.className = `date-group-content ${isCollapsed ? 'hidden' : ''}`; 
        reportsContainerRow.dataset.contentDate = dateKey; 

        const reportsCell = document.createElement('td');
        reportsCell.colSpan = 6;
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

            // Function to highlight text
            const highlightText = (text, term) => {
                if (!term) return text;
                const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                return text.replace(regex, '<span class="highlight">$&</span>');
            };

            reportRow.innerHTML = `
                <td class="table-cell">${highlightText(report.description, searchTerm)}</td>
                <td class="table-cell">${formatAsDDMMYYYY(report.date)}</td>
                <td class="table-cell">${report.time}</td>
                <td class="table-cell">${highlightText(report.reporter, searchTerm)}</td>
                <td class="table-cell">${highlightText(report.logType, searchTerm)}</td>
                <td class="table-cell text-center whitespace-nowrap">
                    <button data-id="${report.id}" class="text-blue-600 hover:text-blue-800 font-semibold edit-btn">ערוך</button>
                </td>
            `;
            innerTbody.appendChild(reportRow);
        });

        innerTable.appendChild(innerTbody);
        reportsCell.appendChild(innerTable);
        reportsContainerRow.appendChild(reportsCell);
        tableBody.appendChild(reportsContainerRow);
        
        if (!isToday && !collapsedGroups.has(dateKey) && !searchTerm) { // Only collapse if not searching
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
    console.log('Reports displayed in table (after hybrid sorting and grouping):', currentDisplayReports);
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

    const newReportData = { 
        description, 
        date, 
        time, 
        reporter, 
        logType,
        creatorId: currentUserId, 
        //createdAt: FieldValue.serverTimestamp() 
    };

    try {
        const docRef = await addDoc(reportsCollectionRef, newReportData);
        console.log("Document written with ID: ", docRef.id);
        lastAddedReportId = docRef.id; 
        collapsedGroups.delete(newReportData.date); 
        // renderTable is triggered by onSnapshot. lastAddedReportId will be cleared there.
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
    };

    try {
        const docRef = doc(db, `artifacts/${appId}/public/data/reports`, reportToUpdate.id); 
        await setDoc(docRef, updatedReportData, { merge: true }); 
        console.log("Document updated with ID: ", reportToUpdate.id);
        lastAddedReportId = reportToUpdate.id; // Set lastAddedReportId for update too
        collapsedGroups.delete(reportToUpdate.date); 
        // renderTable is triggered by onSnapshot. lastAddedReportId will be cleared there.
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

    } else {
        console.log('No user signed in. Showing login page.');
        showLoginPage(); 
        reports = []; 
        renderTable(); // Clear table on logout
        resetForm(); 
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
    return now; // Return current time for comparison
};

// Update assessment time display
const updateAssessmentTimeDisplay = () => {
    const now = new Date();
    // Check if assessmentTime is essentially the same as current time (within a few seconds)
    // Or if it was manually set and is now in the past
    const isSameAsCurrent = Math.abs(assessmentTime.getTime() - now.getTime()) < 5000; // 5 seconds threshold

    if (assessmentTimeDisplay) {
        if (isSameAsCurrent && !assessmentTimeIsManual) {
            assessmentTimeDisplay.textContent = 'טרם נקבע';
            assessmentTimeDisplay.classList.remove('blinking-red'); // Ensure no blinking if "טרם נקבע"
        } else {
            const hours = assessmentTime.getHours().toString().padStart(2, '0');
            const minutes = assessmentTime.getMinutes().toString().padStart(2, '0');
            assessmentTimeDisplay.textContent = `${hours}:${minutes}`;
            checkBlinkingStatus();
        }
    }
};

// Check and apply blinking status for assessment time
const checkBlinkingStatus = () => {
    const now = updateCurrentTime(); // Get latest current time
    const diffMs = assessmentTime.getTime() - now.getTime();
    const diffMinutes = diffMs / (1000 * 60);

    if (assessmentTimeDisplay) {
        // If assessment time is in the past, or exactly current time, or very close (within 100ms)
        // it should not blink, unless it was just adjusted to be past current time
        if (diffMinutes <= 0 && !assessmentTimeIsManual) { // If time has passed or arrived, stop blinking and revert color
            assessmentTimeDisplay.classList.remove('blinking-red');
        } else if (diffMinutes > 0 && diffMinutes <= 5) { // Within 5 minutes and in the future
            assessmentTimeDisplay.classList.add('blinking-red');
        } else { // More than 5 minutes away
            assessmentTimeDisplay.classList.remove('blinking-red');
        }
    }
};

// --- Export to Excel Functionality ---
const exportReportsToExcel = () => {
    if (reports.length === 0) {
        // Using alert for simplicity, could be custom modal
        const customAlert = document.createElement('div');
        customAlert.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50';
        customAlert.innerHTML = `
            <div class="bg-white p-6 rounded-lg shadow-lg text-center">
                <p class="text-lg font-semibold text-[#6D5F53] mb-4">אין דיווחים לייצוא.</p>
                <button id="alertCloseBtn" class="btn-primary py-2 px-4 rounded-lg">אישור</button>
            </div>
        `;
        document.body.appendChild(customAlert);
        document.getElementById('alertCloseBtn').addEventListener('click', () => {
            document.body.removeChild(customAlert);
        });
        return;
    }

    const header = ["דיווח", "תאריך", "שעה", "שם המדווח", "שיוך יומן"].join(',');
    const csvRows = reports.map(report => {
        const description = `"${report.description.replace(/"/g, '""')}"`; // Handle commas and quotes
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
    document.body.appendChild(link); // Required for Firefox
    link.click();
    document.body.removeChild(link); // Clean up
};

// --- Search Functionality ---
let isSearchInputVisible = false; // To manage search input visibility

const toggleSearchInput = () => {
    if (searchInput) {
        isSearchInputVisible = !isSearchInputVisible;
        if (isSearchInputVisible) {
            searchInput.classList.remove('hidden');
            searchInput.focus();
        } else {
            searchInput.value = ''; // Clear search when hidden
            searchInput.classList.add('hidden'); // Hide search input
            performSearch(); // Re-render table without search filter
        }
    }
};

const performSearch = () => {
    const searchTerm = searchInput ? searchInput.value.trim() : '';
    renderTable(searchTerm); // Render table with search term
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
    exportExcelBtn = document.getElementById('exportExcelBtn'); 
    searchLogBtn = document.getElementById('searchLogBtn');     
    searchInput = document.getElementById('searchInput');       


    // Clock DOM references
    currentTimeDisplay = document.getElementById('currentTimeDisplay');
    assessmentTimeDisplay = document.getElementById('assessmentTimeDisplay');
    assessmentTimePlusBtn = document.getElementById('assessmentTimePlusBtn');
    assessmentTimeMinusBtn = document.getElementById('assessmentTimeMinusBtn');

    // --- Firebase Initialization ---
    if (!auth || !db) {
        console.error('Firebase Auth or Firestore not initialized. Check firebase.js for errors.');
        loginErrorMessage.textContent = 'שגיאה: Firebase לא אותחל באופן מלא.';
        showLoginPage(); 
        return;
    }

    // Initial state: show loading then login page
    if (loadingStateRow) loadingStateRow.classList.remove('hidden'); 


    // --- Set up initial data/listeners ---
    setDefaultDateTime();
    resetForm(); 

    // Initialize clocks
    assessmentTime = updateCurrentTime(); // Set initial assessment time to current time
    assessmentTime.setMinutes(assessmentTime.getMinutes() + 30); // Add 30 minutes to start
    assessmentTime.setSeconds(0); // Clear seconds for cleaner display
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
            
            const now = updateCurrentTime(); // Get the very latest current time for comparison
            if (prospectiveTime.getTime() < now.getTime()) {
                // If prospective time is earlier than current time, set it to current time
                assessmentTime = now;
                assessmentTime.setSeconds(0); // Ensure no seconds when snapping to current
                assessmentTime.setMilliseconds(0);
            } else {
                assessmentTime = prospectiveTime;
            }
            updateAssessmentTimeDisplay();
        });
    }

    // --- New Buttons Event Listeners ---
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', exportReportsToExcel);
    }
    if (searchLogBtn) {
        searchLogBtn.addEventListener('click', toggleSearchInput);
    }
    if (searchInput) {
        searchInput.addEventListener('input', performSearch); // Live search as user types
    }


    // Initialize default date and time, and reset form
    setDefaultDateTime();
    resetForm(); 
});
