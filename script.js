// Global variables for App State
let reports = []; 
let editingReportIndex = null; 
let lastAddedReportId = null; 
let collapsedGroups = new Set(); 

// Global DOM element references (initialized in DOMContentLoaded)
let filterReporter;
let filterLogType;
let generalTextInput;
let newDateInput; 
let newTimeInput; 
let dateTimeInputsWrapper; 
let mainActionBtn; // Declared globally
let cancelEditBtn;
let tableBody;
let emptyStateRow;
let expandAllBtn;
let collapseAllBtn;
let inputErrorMessage;


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
    if (newDateInput) { // Add a check for newDateInput to prevent errors if it's undefined
        newDateInput.value = `${year}-${month}-${day}`;
    }
    
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    if (newTimeInput) { // Add a check for newTimeInput
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

        if (a.time > b.time) return -1; 
        if (a.time < b.time) return 1;  

        return 0; 
    });
};

// Renders the table content based on the reports array and current sorting rules
const renderTable = () => {
    if (!tableBody) { // Add a check here for tableBody
        console.error('tableBody element not found. Cannot render table.');
        return;
    }
    tableBody.innerHTML = ''; // Clear existing table body
    
    if (reports.length === 0) {
        if (emptyStateRow) { // Add a check for emptyStateRow
            tableBody.appendChild(emptyStateRow);
        }
        console.log('No reports to display.');
        return;
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
        reportsForDate.forEach(report => {
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
                </td>
            `;
            innerTbody.appendChild(reportRow);
        });

        innerTable.appendChild(innerTbody);
        reportsCell.appendChild(innerTable);
        reportsContainerRow.appendChild(reportsCell);
        tableBody.appendChild(reportsContainerRow);
        
        // Default collapse/expand logic for initial rendering
        if (!isToday && !collapsedGroups.has(dateKey)) {
            collapsedGroups.add(dateKey);
            reportsContainerRow.classList.add('hidden');
            const toggleButton = headerRow.querySelector('.toggle-day-btn');
            if (toggleButton) { // Add a check here
                toggleButton.textContent = '◀';
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
    
    console.log('Current reports array (raw data from Firestore):', reports); 
    console.log('Reports displayed in table (after hybrid sorting and grouping):', finalDisplayList);
    console.log('Collapsed Groups State:', collapsedGroups);
};

// Clears the input fields and resets the form to "add new report" mode
const resetForm = () => {
    if (generalTextInput) { // Add check here
        generalTextInput.value = '';
        generalTextInput.rows = 3; 
        generalTextInput.style.height = 'auto'; 
        generalTextInput.classList.remove('edit-mode-fixed-height'); 
        autoResizeTextarea(generalTextInput); 
    }

    setDefaultDateTime(); 
    if (generalTextInput) { // Add check here
        generalTextInput.focus();
    }
    editingReportIndex = null; 
    if (mainActionBtn) { // Add check here
        mainActionBtn.textContent = 'הזן';
    }
    if (cancelEditBtn) { // Add check here
        cancelEditBtn.classList.add('hidden');
    }
    if (inputErrorMessage) { // Add check here
        inputErrorMessage.textContent = '';
    }
    
    if (dateTimeInputsWrapper) { // Add check here
        dateTimeInputsWrapper.classList.add('hidden'); 
    }

    if (newDateInput) { // Add check here
        newDateInput.readOnly = false; 
    }
    if (newTimeInput) { // Add check here
        newTimeInput.readOnly = false; 
    }

    renderTable(); 
};

// Adds a new report
const addReport = () => { 
    if (!generalTextInput || !newDateInput || !newTimeInput || !filterReporter || !filterLogType || !inputErrorMessage) {
        console.error('One or more required input elements are not initialized.');
        return;
    }

    const description = generalTextInput.value.trim();
    const date = newDateInput.value; 
    const time = newTimeInput.value; 
    
    const reporter = filterReporter.value; 
    const logType = filterLogType.value;   

    if (!description) { 
        inputErrorMessage.textContent = 'יש למ מלא את שדה תיאור הדיווח.';
        setTimeout(() => inputErrorMessage.textContent = '', 3000);
        return;
    }

    const newReport = { 
        id: crypto.randomUUID(), 
        description, 
        date, 
        time, 
        reporter, 
        logType,
    };

    reports.unshift(newReport); // Add to the BEGINNING of the internal array
    lastAddedReportId = newReport.id; // Mark this as the last added report
    
    collapsedGroups.delete(newReport.date); // Open the group for the newly added report

    renderTable(); 
    resetForm(); 
};

// Updates an existing report
const updateReport = () => { 
    if (!generalTextInput || !newDateInput || !newTimeInput || !filterReporter || !filterLogType || !inputErrorMessage) {
        console.error('One or more required input elements are not initialized for update.');
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

    if (editingReportIndex !== null) {
        const reportToUpdate = reports[editingReportIndex];
        reportToUpdate.description = description;
        reportToUpdate.date = date;
        reportToUpdate.time = time;
        reportToUpdate.reporter = reporter;
        reportToUpdate.logType = logType;

        
        reports = sortChronologically(reports); // Sorts the global 'reports' array directly
        lastAddedReportId = null; // Clear last added to ensure full chronological sort is dominant now
        
        collapsedGroups.delete(reportToUpdate.date); // Open the group for the updated report

        renderTable(); 
        resetForm(); 
    }
};


// DOMContentLoaded listener - All DOM element references and initial event listeners are set here
document.addEventListener('DOMContentLoaded', () => {
    // Initialize global DOM element references
    filterReporter = document.getElementById('filterReporter');
    filterLogType = document.getElementById('filterLogType');
    generalTextInput = document.getElementById('generalTextInput');
    newDateInput = document.getElementById('newDate'); 
    newTimeInput = document.getElementById('newTime'); 
    dateTimeInputsWrapper = document.getElementById('dateTimeInputsWrapper'); 
    mainActionBtn = document.getElementById('mainActionBtn'); // Initialization happens here
    cancelEditBtn = document.getElementById('cancelEditBtn');
    tableBody = document.getElementById('reportTableBody');
    emptyStateRow = document.getElementById('empty-state');
    inputErrorMessage = document.getElementById('inputErrorMessage');
    expandAllBtn = document.getElementById('expandAllBtn'); 
    collapseAllBtn = document.getElementById('collapseAllBtn'); 

    // --- IMPORTANT: Confirm initialization status ---
    console.log('mainActionBtn after getElementById:', mainActionBtn); 
    console.log('cancelEditBtn after getElementById:', cancelEditBtn); 

    // Attach global expand/collapse buttons listeners here, after elements are guaranteed to exist
    if (expandAllBtn) {
        expandAllBtn.addEventListener('click', () => {
            collapsedGroups.clear(); 
            // Query for all date group content rows
            document.querySelectorAll('.date-group-content').forEach(div => {
                div.classList.remove('hidden'); 
            });
            // Query for all toggle buttons
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

            // Query for all date group content rows
            document.querySelectorAll('.date-group-content').forEach(div => {
                div.classList.add('hidden'); 
            });
            // Query for all toggle buttons
            document.querySelectorAll('.toggle-day-btn').forEach(button => {
                button.textContent = '◀'; 
            });
        });
    } else {
        console.error('collapseAllBtn element not found!');
    }

    // Handle the click on the main action button (Add/Update)
    // This event listener is placed AFTER mainActionBtn is initialized above
    if (mainActionBtn) { // Add a check to ensure mainActionBtn is not null/undefined
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
    if (cancelEditBtn) { // Add a check here
        cancelEditBtn.addEventListener('click', resetForm);
    } else {
        console.error('cancelEditBtn element not found! Cannot attach event listener.');
    }


    // Event delegation for table actions (edit)
    // This listener is also placed within DOMContentLoaded
    if (tableBody) { // Add a check here
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

                // Date input should allow picker, not manual typing (type="date")
                if (newDateInput) newDateInput.readOnly = false; 

                // Time input should allow direct manual input (type="text")
                if (newTimeInput) newTimeInput.readOnly = false; 

                if (generalTextInput) generalTextInput.focus(); 
            }
        });
    } else {
        console.error('tableBody element not found! Cannot attach event delegation.');
    }

    // Initialize default date and time, and render table on load
    setDefaultDateTime();
    resetForm(); 
});

