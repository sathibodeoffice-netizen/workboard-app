// Authentication Check
const uid = sessionStorage.getItem('uid');
if (!sessionStorage.getItem('isAuthenticated') || !uid) {
    window.location.href = 'index.html';
}

// State Management
let currentMode = 'personal'; // 'personal' or 'team'

// Check URL for department param first
const urlParams = new URLSearchParams(window.location.search);
const deptFromUrl = urlParams.get('dept');

if (deptFromUrl) {
    localStorage.setItem('customDepartmentName', deptFromUrl);
    currentMode = 'team';
}

let customDepartmentName = localStorage.getItem('customDepartmentName') || 'Department';
let assignees = JSON.parse(localStorage.getItem('assignees')) || [];

if (!localStorage.getItem('defaultsCleared')) {
    assignees = assignees.filter(name => !['Alice', 'Bob', 'Charlie'].includes(name));
    localStorage.setItem('assignees', JSON.stringify(assignees));
    localStorage.setItem('defaultsCleared', 'true');
}

let tasks = {
    personal: [],
    team: []
};

// DOM Elements
const navPersonal = document.getElementById('navPersonal');
const navDepartment = document.getElementById('navDepartment');
const navSettings = document.getElementById('navSettings');
const dashboardView = document.getElementById('dashboardView');
const settingsView = document.getElementById('settingsView');
const boardTitle = document.getElementById('boardTitle');
const boardSubtitle = document.getElementById('boardSubtitle');
const taskAssigneeInput = document.getElementById('taskAssignee');
const filterAssigneeContainer = document.getElementById('filterAssignee').parentElement;

const taskForm = document.getElementById('taskForm');
const taskTitle = document.getElementById('taskTitle');
const taskPriority = document.getElementById('taskPriority');
const taskPeriodType = document.getElementById('taskPeriodType');
const taskPeriod = document.getElementById('taskPeriod');

const taskList = document.getElementById('taskList');
const filterAssignee = document.getElementById('filterAssignee');
const filterPeriod = document.getElementById('filterPeriod');
const filterDate = document.getElementById('filterDate');

const btnNewProject = document.getElementById('btnNewProject');
const btnShareLink = document.getElementById('btnShareLink');
const btnEditProject = document.getElementById('btnEditProject');
const btnDeleteProject = document.getElementById('btnDeleteProject');
const projectModal = document.getElementById('projectModal');
const deptNameInput = document.getElementById('deptNameInput');
const btnCancelProject = document.getElementById('btnCancelProject');
const btnSaveProject = document.getElementById('btnSaveProject');
const btnLogout = document.getElementById('btnLogout');

// Initialize App
function init() {
    renderAssigneeDropdowns();
    updateUIForMode();
    setupEventListeners();
    fetchTasks(); // Initial fetch
    
    // Set active nav if we started in team mode due to URL
    if (currentMode === 'team') {
        navDepartment.classList.add('active');
        navPersonal.classList.remove('active');
    }
}

// We use a simple polling mechanism for "real-time" feel since we aren't using websockets
let pollingInterval = null;

let previousTasksState = ''; // Store previous state to prevent jumpy UI

async function fetchTasks() {
    try {
        // Fetch Personal Tasks
        const resPersonal = await fetch(`/api/tasks?uid=${uid}&mode=personal`);
        tasks.personal = await resPersonal.json();

        // Fetch Team Tasks
        const resTeam = await fetch(`/api/tasks?department=${encodeURIComponent(customDepartmentName)}&mode=team`);
        tasks.team = await resTeam.json();

        // Extract dynamic assignees from team tasks
        const uniqueAssignees = new Set(assignees);
        tasks.team.forEach(task => {
            if (task.assignee) uniqueAssignees.add(task.assignee);
        });
        const updatedAssignees = Array.from(uniqueAssignees);
        if (updatedAssignees.length !== assignees.length) {
            assignees = updatedAssignees;
            localStorage.setItem('assignees', JSON.stringify(assignees));
            renderAssigneeDropdowns();
        }

        // Smart UI Re-rendering check
        const currentTasksState = JSON.stringify(tasks);
        if (currentTasksState !== previousTasksState) {
            previousTasksState = currentTasksState;
            renderTasks();
        }
    } catch (e) {
        console.error("Error fetching tasks:", e);
    }
}

// Fetch every 5 seconds to simulate real-time updates for the team
if (!pollingInterval) {
    pollingInterval = setInterval(fetchTasks, 5000);
}

// Event Listeners
function setupEventListeners() {
    navPersonal.addEventListener('click', () => {
        currentMode = 'personal';
        navPersonal.classList.add('active');
        navDepartment.classList.remove('active');
        navSettings.classList.remove('active');
        dashboardView.classList.remove('hidden');
        settingsView.classList.add('hidden');
        
        // Remove dept from URL
        const url = new URL(window.location);
        url.searchParams.delete('dept');
        window.history.pushState({}, '', url);

        updateUIForMode();
        renderTasks();
    });

    navDepartment.addEventListener('click', () => {
        currentMode = 'team';
        navDepartment.classList.add('active');
        navPersonal.classList.remove('active');
        navSettings.classList.remove('active');
        dashboardView.classList.remove('hidden');
        settingsView.classList.add('hidden');
        
        // Add dept to URL
        const url = new URL(window.location);
        url.searchParams.set('dept', customDepartmentName);
        window.history.pushState({}, '', url);

        updateUIForMode();
        renderTasks();
    });

    navSettings.addEventListener('click', () => {
        navSettings.classList.add('active');
        navPersonal.classList.remove('active');
        navDepartment.classList.remove('active');
        dashboardView.classList.add('hidden');
        settingsView.classList.remove('hidden');
    });

    taskForm.addEventListener('submit', handleTaskSubmit);
    filterAssignee.addEventListener('change', renderTasks);
    filterPeriod.addEventListener('change', (e) => {
        if (e.target.value === 'Custom') {
            filterDate.classList.remove('hidden');
        } else {
            filterDate.classList.add('hidden');
            filterDate.value = '';
        }
        renderTasks();
    });
    filterDate.addEventListener('change', renderTasks);

    taskPeriodType.addEventListener('change', (e) => {
        if (e.target.value === 'Custom') {
            taskPeriod.classList.remove('hidden');
            taskPeriod.required = true;
        } else {
            taskPeriod.classList.add('hidden');
            taskPeriod.required = false;
            taskPeriod.value = '';
        }
    });

    taskAssigneeInput.addEventListener('change', (e) => {
        if (e.target.value === 'ADD_NEW') {
            const newAssignee = prompt("Enter new Assignee name:");
            if (newAssignee && newAssignee.trim() !== '') {
                const trimmedName = newAssignee.trim();
                if (!assignees.includes(trimmedName)) {
                    assignees.push(trimmedName);
                    localStorage.setItem('assignees', JSON.stringify(assignees));
                }
                renderAssigneeDropdowns();
                taskAssigneeInput.value = trimmedName;
            } else {
                taskAssigneeInput.value = "";
            }
        }
    });

    btnNewProject.addEventListener('click', () => {
        deptNameInput.value = '';
        projectModal.classList.remove('hidden');
    });

    btnCancelProject.addEventListener('click', () => {
        projectModal.classList.add('hidden');
    });

    btnSaveProject.addEventListener('click', () => {
        const newName = deptNameInput.value.trim();
        if (newName) {
            customDepartmentName = newName;
            localStorage.setItem('customDepartmentName', customDepartmentName);
            boardTitle.textContent = `${customDepartmentName} To Do Board`;
            
            // Update URL with new dept
            const url = new URL(window.location);
            url.searchParams.set('dept', customDepartmentName);
            window.history.pushState({}, '', url);

            fetchTasks();
        }
        projectModal.classList.add('hidden');
    });

    btnShareLink.addEventListener('click', () => {
        navigator.clipboard.writeText(window.location.href).then(() => {
            const originalText = btnShareLink.textContent;
            btnShareLink.textContent = "✅ Copied!";
            setTimeout(() => {
                btnShareLink.textContent = originalText;
            }, 2000);
        });
    });

    btnEditProject.addEventListener('click', async () => {
        const newName = prompt("Enter new name for this department:", customDepartmentName);
        if (newName && newName.trim() !== '' && newName.trim() !== customDepartmentName) {
            const oldName = customDepartmentName;
            const updatedName = newName.trim();
            try {
                await fetch(`/api/tasks?department=${encodeURIComponent(oldName)}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newDepartment: updatedName })
                });
                customDepartmentName = updatedName;
                localStorage.setItem('customDepartmentName', customDepartmentName);
                boardTitle.textContent = `${customDepartmentName} To Do Board`;
                
                const url = new URL(window.location);
                url.searchParams.set('dept', customDepartmentName);
                window.history.pushState({}, '', url);

                fetchTasks();
            } catch (e) {
                console.error("Error editing department: ", e);
            }
        }
    });

    btnDeleteProject.addEventListener('click', async () => {
        if (confirm(`Are you sure you want to delete the department "${customDepartmentName}" and ALL its tasks?`)) {
            try {
                await fetch(`/api/tasks?department=${encodeURIComponent(customDepartmentName)}`, {
                    method: 'DELETE'
                });
                
                currentMode = 'personal';
                navPersonal.classList.add('active');
                navDepartment.classList.remove('active');
                
                const url = new URL(window.location);
                url.searchParams.delete('dept');
                window.history.pushState({}, '', url);
                
                localStorage.removeItem('customDepartmentName');
                customDepartmentName = 'Department';

                updateUIForMode();
                fetchTasks();
            } catch (e) {
                console.error("Error deleting department: ", e);
            }
        }
    });

    btnLogout.addEventListener('click', () => {
        sessionStorage.clear();
        window.location.href = 'index.html';
    });
}

// Update UI elements based on current mode
function updateUIForMode() {
    if (currentMode === 'team') {
        boardTitle.textContent = `${customDepartmentName} To Do Board`;
        boardSubtitle.textContent = 'Shared tasks for the department.';
        taskAssigneeInput.classList.remove('hidden');
        taskAssigneeInput.required = true;
        filterAssigneeContainer.classList.remove('hidden');
        btnNewProject.classList.remove('hidden');
        btnShareLink.classList.remove('hidden');
        btnEditProject.classList.remove('hidden');
        btnDeleteProject.classList.remove('hidden');
    } else {
        boardTitle.textContent = 'Personal Board';
        boardSubtitle.textContent = 'Manage your private tasks efficiently.';
        taskAssigneeInput.classList.add('hidden');
        taskAssigneeInput.required = false;
        filterAssigneeContainer.classList.add('hidden');
        filterAssignee.value = 'all'; // Reset assignee filter
        btnNewProject.classList.add('hidden');
        btnShareLink.classList.add('hidden');
        btnEditProject.classList.add('hidden');
        btnDeleteProject.classList.add('hidden');
    }
}

// Handle Form Submission
async function handleTaskSubmit(e) {
    e.preventDefault();

    const title = taskTitle.value.trim();
    const priority = taskPriority.value;
    const periodType = taskPeriodType.value;
    const period = periodType === 'Custom' ? taskPeriod.value : periodType;
    const assignee = currentMode === 'team' ? taskAssigneeInput.value : 'Me';

    if (!title || !priority || !periodType || (periodType === 'Custom' && !period) || (currentMode === 'team' && !assignee)) {
        alert('Please fill in all fields.');
        return;
    }

    const newTask = {
        title,
        priority,
        period,
        assignee,
        mode: currentMode,
        uid: uid,
        department: currentMode === 'team' ? customDepartmentName : '',
        createdAt: new Date().toISOString()
    };

    try {
        await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTask)
        });
        taskForm.reset();
        fetchTasks(); // Refresh immediately
    } catch (e) {
        console.error("Error adding document: ", e);
    }
}

// Delete Task
window.deleteTask = async function(taskId) {
    try {
        await fetch(`/api/tasks?id=${taskId}`, {
            method: 'DELETE'
        });
        fetchTasks(); // Refresh immediately
    } catch (e) {
        console.error("Error deleting document: ", e);
    }
}

// Toggle Task Completion
window.toggleTaskCompletion = async function(taskId, isCompleted) {
    try {
        await fetch(`/api/tasks?id=${taskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: isCompleted })
        });
        fetchTasks(); // Refresh immediately
    } catch (e) {
        console.error("Error updating document: ", e);
    }
}

// Render Tasks to DOM
function renderTasks() {
    taskList.innerHTML = '';
    
    const currentTasks = tasks[currentMode];
    const selectedAssignee = filterAssignee.value;
    const selectedPeriodType = filterPeriod.value;
    const selectedDate = filterDate.value;

    const filteredTasks = currentTasks.filter(task => {
        const matchAssignee = selectedAssignee === 'all' || task.assignee === selectedAssignee;
        const matchPeriod = selectedPeriodType === 'all' 
            || (selectedPeriodType === 'Custom' && (!selectedDate || task.period === selectedDate))
            || task.period === selectedPeriodType;
        return matchAssignee && matchPeriod;
    });

    if (filteredTasks.length === 0) {
        taskList.innerHTML = `<p style="color: var(--text-secondary); grid-column: 1 / -1; text-align: center; padding: 2rem;">No tasks found.</p>`;
        return;
    }

    filteredTasks.forEach(task => {
        const card = document.createElement('div');
        card.className = 'task-card';
        
        const isCompleted = task.completed ? 'checked' : '';
        const titleStyle = task.completed ? 'text-decoration: line-through; color: var(--text-secondary);' : '';
        
        card.innerHTML = `
            <div class="task-header" style="display: flex; align-items: center; gap: 10px;">
                <input type="checkbox" ${isCompleted} onchange="toggleTaskCompletion('${task._id}', this.checked)" style="transform: scale(1.5); cursor: pointer; accent-color: var(--accent);">
                <h3 class="task-title" style="${titleStyle} flex: 1; margin: 0;">${task.title}</h3>
                <span class="badge ${task.priority.toLowerCase()}">${task.priority}</span>
            </div>
            <div class="task-meta">
                <span>🗓️ ${task.period}</span>
                ${currentMode === 'team' ? `<span>👤 ${task.assignee}</span>` : ''}
            </div>
            <div class="task-actions">
                <button class="btn-delete" onclick="deleteTask('${task._id}')">Delete</button>
            </div>
        `;
        
        taskList.appendChild(card);
    });
}

// Render Assignees Dropdowns
function renderAssigneeDropdowns() {
    // Task Form Select
    taskAssigneeInput.innerHTML = '<option value="" disabled selected>Assignee</option>';
    assignees.forEach(name => {
        taskAssigneeInput.innerHTML += `<option value="${name}">${name}</option>`;
    });
    taskAssigneeInput.innerHTML += `<option value="ADD_NEW" style="font-weight: bold; color: var(--accent);">+ Add New Assignee...</option>`;

    // Filter Select
    const currentFilter = filterAssignee.value;
    filterAssignee.innerHTML = '<option value="all">All Assignees</option>';
    assignees.forEach(name => {
        filterAssignee.innerHTML += `<option value="${name}">${name}</option>`;
    });
    
    if (assignees.includes(currentFilter) || currentFilter === 'all') {
        filterAssignee.value = currentFilter;
    } else {
        filterAssignee.value = 'all';
    }
}

// Run App
init();
