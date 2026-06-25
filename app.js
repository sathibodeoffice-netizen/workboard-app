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
const taskDescription = document.getElementById('taskDescription');
const taskColor = document.getElementById('taskColor');
const taskDeadline = document.getElementById('taskDeadline');
const taskPriority = document.getElementById('taskPriority');
const taskPeriodType = document.getElementById('taskPeriodType');
const taskPeriod = document.getElementById('taskPeriod');

const listTodo = document.getElementById('list-todo');
const listInProgress = document.getElementById('list-inprogress');
const listDone = document.getElementById('list-done');
const countTodo = document.getElementById('count-todo');
const countInProgress = document.getElementById('count-inprogress');
const countDone = document.getElementById('count-done');
const filterAssignee = document.getElementById('filterAssignee');
const filterPeriod = document.getElementById('filterPeriod');
const filterDate = document.getElementById('filterDate');

const btnNewProject = document.getElementById('btnNewProject');
const btnShareLink = document.getElementById('btnShareLink');
const btnEditProject = document.getElementById('btnEditProject');
const btnDeleteProject = document.getElementById('btnDeleteProject');
const projectModal = document.getElementById('projectModal');
const deptNameInput = document.getElementById('deptNameInput');
const deptTemplateSelect = document.getElementById('deptTemplateSelect');
const btnCancelProject = document.getElementById('btnCancelProject');
const btnSaveProject = document.getElementById('btnSaveProject');
const btnLogout = document.getElementById('btnLogout');

// Attachment Elements
const attachmentModal = document.getElementById('attachmentModal');
const attachmentLink = document.getElementById('attachmentLink');
const attachmentFile = document.getElementById('attachmentFile');
const btnCancelAttachment = document.getElementById('btnCancelAttachment');
const btnSaveAttachment = document.getElementById('btnSaveAttachment');
let targetTaskIdForAttachment = null;

// Butler Elements
const butlerAutoDelete = document.getElementById('butlerAutoDelete');
const butlerAutoDate = document.getElementById('butlerAutoDate');

// Initialize App
function init() {
    try {
        if ("Notification" in window) {
            // Some browsers throw errors if not triggered by user gesture or in insecure contexts
            const promise = Notification.requestPermission();
            if (promise) {
                promise.catch(e => console.log("Notification permission dismissed:", e));
            }
        }
    } catch (e) {
        console.warn("Notification API not fully supported or blocked:", e);
    }
    
    renderAssigneeDropdowns();
    updateUIForMode();
    setupEventListeners();
    fetchTasks(); // Initial fetch
    
    // Load Butler States
    butlerAutoDelete.checked = localStorage.getItem('butlerAutoDelete') === 'true';
    butlerAutoDate.checked = localStorage.getItem('butlerAutoDate') === 'true';
    
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

// Check Deadlines for Notifications
setInterval(checkDeadlines, 60000); // Check every minute

function checkDeadlines() {
    try {
        if (!("Notification" in window) || Notification.permission !== "granted") return;
    } catch (e) {
        return; // Fail silently if Notification throws
    }
    
    let notifiedTasks = JSON.parse(localStorage.getItem('notifiedTasks')) || {};
    const now = new Date().getTime();
    let uiNeedsUpdate = false;
    
    ['personal', 'team'].forEach(mode => {
        tasks[mode].forEach(task => {
            if (task.status === 'done' || !task.deadline) return;
            
            const deadlineTime = new Date(task.deadline).getTime();
            const timeDiff = deadlineTime - now;
            
            if (timeDiff <= 0) {
                if (notifiedTasks[task._id] !== 'overdue') {
                    new Notification("Task Overdue!", { body: `The task "${task.title}" is overdue!` });
                    notifiedTasks[task._id] = 'overdue';
                    uiNeedsUpdate = true;
                }
            } else if (timeDiff > 0 && timeDiff <= 3600000) {
                if (!notifiedTasks[task._id]) {
                    new Notification("Deadline Approaching!", { body: `The task "${task.title}" is due in less than an hour!` });
                    notifiedTasks[task._id] = 'approaching';
                    uiNeedsUpdate = true;
                }
            }
        });
    });
    
    localStorage.setItem('notifiedTasks', JSON.stringify(notifiedTasks));
    if (uiNeedsUpdate) {
        renderTasks();
    }
}

// Event Listeners
function setupEventListeners() {
    const cols = [
        { el: document.getElementById('col-todo'), status: 'todo' },
        { el: document.getElementById('col-inprogress'), status: 'in_progress' },
        { el: document.getElementById('col-done'), status: 'done' }
    ];
    
    cols.forEach(col => {
        if (!col.el) return;
        col.el.ondragover = allowDrop;
        col.el.ondragleave = dragLeave;
        col.el.ondrop = (e) => drop(e, col.status);
    });
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
        if(deptTemplateSelect) deptTemplateSelect.value = 'blank';
        projectModal.classList.remove('hidden');
    });

    btnCancelProject.addEventListener('click', () => {
        projectModal.classList.add('hidden');
    });

    btnSaveProject.addEventListener('click', async () => {
        const newName = deptNameInput.value.trim();
        const template = deptTemplateSelect ? deptTemplateSelect.value : 'blank';
        
        if (newName) {
            customDepartmentName = newName;
            localStorage.setItem('customDepartmentName', customDepartmentName);
            boardTitle.textContent = `${customDepartmentName} Board`;
            
            // Update URL with new dept
            const url = new URL(window.location);
            url.searchParams.set('dept', customDepartmentName);
            window.history.pushState({}, '', url);

            projectModal.classList.add('hidden');
            
            if (template !== 'blank') {
                await createTemplateTasks(newName, template);
            }
            
            fetchTasks();
        } else {
            alert("Please enter a department name.");
        }
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
                boardTitle.textContent = `${customDepartmentName} Board`;
                
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

    // Butler Event Listeners
    butlerAutoDelete.addEventListener('change', (e) => {
        localStorage.setItem('butlerAutoDelete', e.target.checked);
    });
    butlerAutoDate.addEventListener('change', (e) => {
        localStorage.setItem('butlerAutoDate', e.target.checked);
    });

    // Attachment Event Listeners
    btnCancelAttachment.addEventListener('click', () => {
        attachmentModal.classList.add('hidden');
    });

    btnSaveAttachment.addEventListener('click', async () => {
        if (!targetTaskIdForAttachment) return;
        
        const task = tasks[currentMode].find(t => t._id === targetTaskIdForAttachment);
        if (!task) return;
        if (!task.attachments) task.attachments = [];

        const linkVal = attachmentLink.value.trim();
        const file = attachmentFile.files[0];

        btnSaveAttachment.textContent = 'Uploading...';
        btnSaveAttachment.disabled = true;

        try {
            if (file) {
                if (file.size > 1024 * 1024) { // 1MB limit
                    alert("Image must be smaller than 1MB.");
                    resetAttachmentModal();
                    return;
                }
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const base64Data = e.target.result;
                    task.attachments.push({ type: 'image', name: file.name, data: base64Data });
                    await updateTaskAttachments(task);
                };
                reader.readAsDataURL(file);
            } else if (linkVal) {
                task.attachments.push({ type: 'link', url: linkVal });
                await updateTaskAttachments(task);
            } else {
                alert("Please provide a link or an image.");
                resetAttachmentModal();
            }
        } catch (e) {
            console.error(e);
            resetAttachmentModal();
        }
    });
}

// Attachment Helpers
window.openAttachmentModal = function(taskId) {
    targetTaskIdForAttachment = taskId;
    attachmentLink.value = '';
    attachmentFile.value = '';
    btnSaveAttachment.textContent = 'Add Attachment';
    btnSaveAttachment.disabled = false;
    attachmentModal.classList.remove('hidden');
}

async function updateTaskAttachments(task) {
    renderTasks(); // Optimistic update
    try {
        await fetch(`/api/tasks?id=${task._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ attachments: task.attachments })
        });
        fetchTasks();
    } catch (e) {
        console.error("Error saving attachment: ", e);
    }
    resetAttachmentModal();
}

function resetAttachmentModal() {
    btnSaveAttachment.textContent = 'Add Attachment';
    btnSaveAttachment.disabled = false;
    attachmentModal.classList.add('hidden');
}

// Template Helpers
async function createTemplateTasks(deptName, templateId) {
    let templateTasks = [];
    
    if (templateId === 'software') {
        templateTasks = [
            { title: "Set up Code Repository", description: "Initialize Git and create branch structure.", status: "done", priority: "High", color: "#3b82f6" },
            { title: "Design Database Schema", description: "Plan tables for users and tasks.", status: "in_progress", priority: "High", color: "#8b5cf6", subtasks: [{text: "ER Diagram", completed: true}, {text: "SQL Scripts", completed: false}] },
            { title: "Build Authentication API", description: "Login, Signup and JWT generation.", status: "todo", priority: "Medium", color: "#10b981" },
            { title: "Frontend Dashboard Integration", description: "Connect React/UI to API.", status: "todo", priority: "Low", color: "#f59e0b" }
        ];
    } else if (templateId === 'marketing') {
        templateTasks = [
            { title: "Market Research", description: "Analyze competitor ad strategies.", status: "done", priority: "High", color: "#ec4899" },
            { title: "Create Ad Copy", description: "Write 3 variations for Facebook Ads.", status: "in_progress", priority: "Medium", color: "#f43f5e" },
            { title: "Design Social Graphics", description: "Banner and square formats.", status: "todo", priority: "High", color: "#8b5cf6" },
            { title: "Launch Campaign", description: "Set budget and publish.", status: "todo", priority: "High", color: "#3b82f6" }
        ];
    } else if (templateId === 'hr') {
        templateTasks = [
            { title: "Send Welcome Email", description: "Include instructions for Day 1.", status: "done", priority: "High", color: "#10b981" },
            { title: "Setup IT Accounts", description: "Email, Slack, and Jira access.", status: "in_progress", priority: "High", color: "#3b82f6" },
            { title: "First Day Office Tour", description: "Show desks, kitchen, and meeting rooms.", status: "todo", priority: "Medium", color: "#f59e0b" },
            { title: "Manager 1-on-1 Meeting", description: "Set expectations.", status: "todo", priority: "Low", color: "#8b5cf6" }
        ];
    }
    
    for (let t of templateTasks) {
        const newTask = {
            title: t.title,
            description: t.description,
            color: t.color,
            deadline: "",
            priority: t.priority,
            period: "Weekly",
            assignee: "Me",
            mode: "team",
            uid: uid,
            department: deptName,
            status: t.status,
            subtasks: t.subtasks || [],
            createdAt: new Date().toISOString()
        };
        try {
            await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTask)
            });
        } catch(e) {
            console.error("Error creating template task", e);
        }
    }
}

// Update UI elements based on current mode
function updateUIForMode() {
    if (currentMode === 'team') {
        boardTitle.textContent = `${customDepartmentName} Board`;
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
    const description = taskDescription.value.trim();
    const color = taskColor.value;
    const deadline = taskDeadline.value;
    const priority = taskPriority.value;
    const periodType = taskPeriodType.value;
    const period = periodType === 'Custom' ? taskPeriod.value : periodType;
    const assignee = currentMode === 'team' ? taskAssigneeInput.value : 'Me';

    if (!title || !priority || !periodType || (periodType === 'Custom' && !period) || (currentMode === 'team' && !assignee)) {
        alert('Please fill in all required fields.');
        return;
    }

    const newTask = {
        title,
        description,
        color,
        deadline,
        priority,
        period,
        assignee,
        mode: currentMode,
        uid: uid,
        department: currentMode === 'team' ? customDepartmentName : '',
        status: 'todo',
        subtasks: [],
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

// Drag & Drop Logic
let draggedTaskId = null;

function drag(event) {
    draggedTaskId = event.currentTarget.id.replace('task-', '');
    event.dataTransfer.setData("text", draggedTaskId);
}

function allowDrop(event) {
    event.preventDefault();
    const column = event.currentTarget.querySelector('.kanban-task-list');
    if (column) column.classList.add('drag-over');
}

function drop(event, newStatus) {
    event.preventDefault();
    const column = event.currentTarget.querySelector('.kanban-task-list');
    if (column) column.classList.remove('drag-over');
    
    const taskId = event.dataTransfer.getData("text") || draggedTaskId;
    if (!taskId) return;
    
    // Optimistic UI update
    const taskIndex = tasks[currentMode].findIndex(t => t._id === taskId);
    if (taskIndex !== -1) {
        tasks[currentMode][taskIndex].status = newStatus;
        
        // 🤖 Butler Automations
        if (newStatus === 'done') {
            if (butlerAutoDelete.checked) {
                deleteTask(taskId);
                return; // Let deleteTask handle the refresh
            } else if (butlerAutoDate.checked) {
                const nowTime = new Date();
                nowTime.setMinutes(nowTime.getMinutes() - nowTime.getTimezoneOffset());
                const nowStr = nowTime.toISOString().slice(0, 16);
                
                tasks[currentMode][taskIndex].deadline = nowStr;
                
                fetch(`/api/tasks?id=${taskId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus, deadline: nowStr })
                }).then(() => fetchTasks()).catch(e => console.error(e));
                
                renderTasks();
                return;
            }
        }
        
        renderTasks();
    }

    fetch(`/api/tasks?id=${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
    }).then(() => fetchTasks()).catch(e => console.error(e));
    
    draggedTaskId = null;
}

function dragLeave(event) {
    const column = event.currentTarget.querySelector('.kanban-task-list');
    if (column) column.classList.remove('drag-over');
}

// Toggle Subtask Completion
window.toggleSubtask = async function(taskId, subtaskIndex, isCompleted) {
    const task = tasks[currentMode].find(t => t._id === taskId);
    if (!task) return;
    
    task.subtasks[subtaskIndex].completed = isCompleted;
    renderTasks(); // Optimistic update
    
    try {
        await fetch(`/api/tasks?id=${taskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subtasks: task.subtasks })
        });
        fetchTasks();
    } catch (e) {
        console.error("Error toggling subtask: ", e);
    }
}

// Add Subtask
window.addSubtask = async function(event, taskId) {
    if (event.key === 'Enter') {
        event.preventDefault();
        const text = event.target.value.trim();
        if (!text) return;
        
        const task = tasks[currentMode].find(t => t._id === taskId);
        if (!task) return;
        
        if (!task.subtasks) task.subtasks = [];
        task.subtasks.push({ text: text, completed: false });
        renderTasks(); // Optimistic update
        
        try {
            await fetch(`/api/tasks?id=${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subtasks: task.subtasks })
            });
            fetchTasks();
        } catch (e) {
            console.error("Error adding subtask: ", e);
        }
    }
}

// Render Tasks to DOM
function renderTasks() {
    listTodo.innerHTML = '';
    listInProgress.innerHTML = '';
    listDone.innerHTML = '';
    
    let cTodo = 0, cInProg = 0, cDone = 0;
    
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

    filteredTasks.forEach(task => {
        const status = task.status || 'todo';
        
        let deadlineHtml = '';
        let deadlineClass = '';
        if (task.deadline && status !== 'done') {
            const timeDiff = new Date(task.deadline).getTime() - new Date().getTime();
            if (timeDiff <= 0) deadlineClass = 'overdue';
            else if (timeDiff <= 3600000) deadlineClass = 'approaching';
            
            const formattedDate = new Date(task.deadline).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
            deadlineHtml = `<div class="task-deadline ${deadlineClass}">⏳ Due: ${formattedDate}</div>`;
        }

        const card = document.createElement('div');
        card.className = `task-card ${deadlineClass}`;
        card.id = `task-${task._id}`;
        card.draggable = true;
        card.ondragstart = drag;
        
        // Apply task color
        if (task.color) {
            card.style.borderTop = `4px solid ${task.color}`;
        }
        
        const descriptionHtml = task.description ? `<p class="task-description">${task.description.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>` : '';
        
        const subtasks = task.subtasks || [];
        let subtasksHtml = `<div class="subtasks-container">`;
        subtasks.forEach((st, index) => {
            const isChecked = st.completed ? 'checked' : '';
            const completedClass = st.completed ? 'completed' : '';
            subtasksHtml += `
                <div class="subtask-item ${completedClass}">
                    <input type="checkbox" ${isChecked} onchange="toggleSubtask('${task._id}', ${index}, this.checked)">
                    <span>${st.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
                </div>
            `;
        });
        subtasksHtml += `
            <input type="text" class="subtask-input" placeholder="+ Add subtask..." onkeypress="addSubtask(event, '${task._id}')">
        </div>`;

        const attachments = task.attachments || [];
        let attachmentsHtml = '';
        if (attachments.length > 0) {
            attachmentsHtml += '<div class="attachments-container">';
            attachments.forEach(att => {
                if (att.type === 'image') {
                    attachmentsHtml += `
                        <div class="attachment-item">
                            <a href="${att.data}" target="_blank" title="${att.name}">
                                <img src="${att.data}" alt="${att.name}">
                            </a>
                        </div>
                    `;
                } else if (att.type === 'link') {
                    let icon = '🔗';
                    let bgColor = 'var(--bg-primary)';
                    if (att.url.includes('drive.google.com')) { icon = '📁'; bgColor = '#4285F415'; }
                    else if (att.url.includes('github.com')) { icon = '🐙'; bgColor = '#24292e15'; }
                    else if (att.url.includes('slack.com')) { icon = '💬'; bgColor = '#4A154B15'; }
                    
                    let shortUrl = att.url;
                    try { shortUrl = new URL(att.url).hostname.replace('www.', ''); } catch(e){}
                    
                    attachmentsHtml += `
                        <a href="${att.url}" target="_blank" class="attachment-link" style="background: ${bgColor}" title="${att.url}">
                            <span class="attachment-icon">${icon}</span> ${shortUrl}
                        </a>
                    `;
                }
            });
            attachmentsHtml += '</div>';
        }
        
        card.innerHTML = `
            <div class="task-header" style="display: flex; align-items: center; gap: 10px;">
                ${task.color ? `<span style="width:12px;height:12px;border-radius:50%;background-color:${task.color};flex-shrink:0;"></span>` : ''}
                <h3 class="task-title" style="margin: 0; flex: 1;">${task.title}</h3>
                <span class="badge ${task.priority.toLowerCase()}">${task.priority}</span>
            </div>
            ${deadlineHtml}
            ${descriptionHtml}
            ${subtasksHtml}
            ${attachmentsHtml}
            <button class="btn-attachment" onclick="openAttachmentModal('${task._id}')">📎 Add Attachment</button>
            <div class="task-meta">
                <span>🗓️ ${task.period}</span>
                ${currentMode === 'team' ? `<span>👤 ${task.assignee}</span>` : ''}
            </div>
            <div class="task-actions">
                <button class="btn-delete" onclick="deleteTask('${task._id}')">Delete</button>
            </div>
        `;
        
        if (status === 'todo') {
            listTodo.appendChild(card);
            cTodo++;
        } else if (status === 'in_progress') {
            listInProgress.appendChild(card);
            cInProg++;
        } else if (status === 'done') {
            listDone.appendChild(card);
            cDone++;
        }
    });
    
    countTodo.textContent = cTodo;
    countInProgress.textContent = cInProg;
    countDone.textContent = cDone;
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
