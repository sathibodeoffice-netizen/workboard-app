"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Task {
  _id: string;
  title: string;
  description: string;
  color: string;
  deadline: string;
  priority: string;
  period: string;
  assignee: string;
  mode: string;
  uid: string;
  department: string;
  status: string;
  subtasks: { text: string; completed: boolean }[];
  attachments: { type: string; name?: string; url?: string; data?: string }[];
  createdAt: string;
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Auth state
  const [uid, setUid] = useState<string | null>(null);

  // App state
  const [currentMode, setCurrentMode] = useState<"personal" | "team">("personal");
  const [customDepartmentName, setCustomDepartmentName] = useState("Department");
  const [assignees, setAssignees] = useState<string[]>([]);
  
  const [tasks, setTasks] = useState<{ personal: Task[]; team: Task[] }>({
    personal: [],
    team: [],
  });

  const [activeView, setActiveView] = useState<"dashboard" | "settings">("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Filters
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [filterDate, setFilterDate] = useState("");

  // Modals
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [deptNameInput, setDeptNameInput] = useState("");
  const [deptTemplateSelect, setDeptTemplateSelect] = useState("blank");

  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState(false);
  const [attachmentLink, setAttachmentLink] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [targetTaskIdForAttachment, setTargetTaskIdForAttachment] = useState<string | null>(null);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Butler settings
  const [butlerAutoDelete, setButlerAutoDelete] = useState(false);
  const [butlerAutoDate, setButlerAutoDate] = useState(false);

  // Form state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskColor, setTaskColor] = useState("#3b82f6");
  const [taskDeadline, setTaskDeadline] = useState("");
  const [taskPriority, setTaskPriority] = useState("");
  const [taskPeriodType, setTaskPeriodType] = useState("");
  const [taskPeriod, setTaskPeriod] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [deadlineInputType, setDeadlineInputType] = useState("text");

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [notifiedTasks, setNotifiedTasks] = useState<Record<string, string>>({});

  useEffect(() => {
    // Authentication Check
    const storedUid = sessionStorage.getItem("uid");
    const isAuthenticated = sessionStorage.getItem("isAuthenticated");

    if (!isAuthenticated || !storedUid) {
      router.push("/");
      return;
    }
    setUid(storedUid);

    // Initial setups
    const deptFromUrl = searchParams.get("dept");
    if (deptFromUrl) {
      localStorage.setItem("customDepartmentName", deptFromUrl);
      setCurrentMode("team");
      setCustomDepartmentName(deptFromUrl);
    } else {
      const localDept = localStorage.getItem("customDepartmentName");
      if (localDept) setCustomDepartmentName(localDept);
    }

    let localAssignees = JSON.parse(localStorage.getItem("assignees") || "[]");
    if (!localStorage.getItem("defaultsCleared")) {
      localAssignees = localAssignees.filter((name: string) => !["Alice", "Bob", "Charlie"].includes(name));
      localStorage.setItem("assignees", JSON.stringify(localAssignees));
      localStorage.setItem("defaultsCleared", "true");
    }
    setAssignees(localAssignees);

    setButlerAutoDelete(localStorage.getItem("butlerAutoDelete") === "true");
    setButlerAutoDate(localStorage.getItem("butlerAutoDate") === "true");
    setNotifiedTasks(JSON.parse(localStorage.getItem("notifiedTasks") || "{}"));

    if (typeof window !== "undefined" && "Notification" in window) {
      Notification.requestPermission().catch((e) => console.log("Notification permission dismissed:", e));
    }
  }, [router, searchParams]);

  const fetchTasks = useCallback(async () => {
    if (!uid) return;

    try {
      const resPersonal = await fetch(`/api/tasks?uid=${uid}&mode=personal`);
      const personal = await resPersonal.json();

      const resTeam = await fetch(`/api/tasks?department=${encodeURIComponent(customDepartmentName)}&mode=team`);
      const team = await resTeam.json();

      const uniqueAssignees = new Set(assignees);
      team.forEach((task: Task) => {
        if (task.assignee) uniqueAssignees.add(task.assignee);
      });
      const updatedAssignees = Array.from(uniqueAssignees);
      if (updatedAssignees.length !== assignees.length) {
        setAssignees(updatedAssignees as string[]);
        localStorage.setItem("assignees", JSON.stringify(updatedAssignees));
      }

      setTasks({ personal: personal || [], team: team || [] });
    } catch (e) {
      console.error("Error fetching tasks:", e);
    }
  }, [uid, customDepartmentName, assignees]);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  useEffect(() => {
    const checkDeadlines = () => {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      
      const now = new Date().getTime();
      let uiNeedsUpdate = false;
      const newNotifiedTasks = { ...notifiedTasks };
      
      ["personal", "team"].forEach((mode) => {
        tasks[mode as "personal" | "team"].forEach((task) => {
          if (task.status === "done" || !task.deadline) return;
          
          const deadlineTime = new Date(task.deadline).getTime();
          const timeDiff = deadlineTime - now;
          
          if (timeDiff <= 0) {
            if (newNotifiedTasks[task._id] !== "overdue") {
              new Notification("Task Overdue!", { body: `The task "${task.title}" is overdue!` });
              newNotifiedTasks[task._id] = "overdue";
              uiNeedsUpdate = true;
            }
          } else if (timeDiff > 0 && timeDiff <= 3600000) {
            if (!newNotifiedTasks[task._id]) {
              new Notification("Deadline Approaching!", { body: `The task "${task.title}" is due in less than an hour!` });
              newNotifiedTasks[task._id] = "approaching";
              uiNeedsUpdate = true;
            }
          }
        });
      });
      
      if (uiNeedsUpdate) {
        setNotifiedTasks(newNotifiedTasks);
        localStorage.setItem("notifiedTasks", JSON.stringify(newNotifiedTasks));
      }
    };

    const deadlineInterval = setInterval(checkDeadlines, 60000);
    return () => clearInterval(deadlineInterval);
  }, [tasks, notifiedTasks]);

  // Handlers
  const handleNavClick = (mode: "personal" | "team" | "settings") => {
    if (mode === "settings") {
      setActiveView("settings");
    } else {
      setActiveView("dashboard");
      setCurrentMode(mode);
      const url = new URL(window.location.href);
      if (mode === "team") {
        url.searchParams.set("dept", customDepartmentName);
      } else {
        url.searchParams.delete("dept");
      }
      window.history.pushState({}, "", url.toString());
    }
    if (window.innerWidth <= 768) setIsSidebarOpen(false);
  };

  const handleLogout = () => {
    sessionStorage.clear();
    router.push("/");
  };

  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const periodValue = taskPeriodType === "Custom" ? taskPeriod : taskPeriodType;
    const assigneeValue = currentMode === "team" ? taskAssignee : "Me";

    if (!taskTitle || !taskPriority || !taskPeriodType || (taskPeriodType === "Custom" && !taskPeriod) || (currentMode === "team" && !assigneeValue)) {
      alert("Please fill in all required fields.");
      return;
    }

    const newTask = {
      title: taskTitle.trim(),
      description: taskDescription.trim(),
      color: taskColor,
      deadline: taskDeadline,
      priority: taskPriority,
      period: periodValue,
      assignee: assigneeValue,
      mode: currentMode,
      uid: uid,
      department: currentMode === "team" ? customDepartmentName : "",
      status: "todo",
      subtasks: [],
      attachments: [],
    };

    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTask),
      });
      
      setTaskTitle("");
      setTaskDescription("");
      setTaskDeadline("");
      setTaskPriority("");
      setTaskPeriodType("");
      setTaskPeriod("");
      setTaskAssignee("");
      setIsTaskModalOpen(false);
      
      fetchTasks();
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await fetch(`/api/tasks?id=${taskId}`, { method: "DELETE" });
      fetchTasks();
    } catch (e) {
      console.error("Error deleting document: ", e);
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData("text", taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add("drag-over");
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("drag-over");
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    e.currentTarget.classList.remove("drag-over");
    const taskId = e.dataTransfer.getData("text") || draggedTaskId;
    if (!taskId) return;

    // Optimistic UI update
    setTasks(prev => {
      const newTasks = { ...prev };
      const taskIndex = newTasks[currentMode].findIndex(t => t._id === taskId);
      if (taskIndex !== -1) {
        newTasks[currentMode][taskIndex].status = newStatus;
      }
      return newTasks;
    });

    if (newStatus === "done") {
      if (butlerAutoDelete) {
        deleteTask(taskId);
        return;
      } else if (butlerAutoDate) {
        const nowTime = new Date();
        nowTime.setMinutes(nowTime.getMinutes() - nowTime.getTimezoneOffset());
        const nowStr = nowTime.toISOString().slice(0, 16);
        
        await fetch(`/api/tasks?id=${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus, deadline: nowStr }),
        });
        fetchTasks();
        return;
      }
    }

    try {
      await fetch(`/api/tasks?id=${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchTasks();
    } catch (e) {
      console.error(e);
    }
    setDraggedTaskId(null);
  };

  const toggleSubtask = async (taskId: string, subtaskIndex: number, isCompleted: boolean) => {
    const task = tasks[currentMode].find((t) => t._id === taskId);
    if (!task) return;

    const newSubtasks = [...task.subtasks];
    newSubtasks[subtaskIndex].completed = isCompleted;

    try {
      await fetch(`/api/tasks?id=${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtasks: newSubtasks }),
      });
      fetchTasks();
    } catch (e) {
      console.error("Error toggling subtask: ", e);
    }
  };

  const addSubtask = async (e: React.KeyboardEvent<HTMLInputElement>, taskId: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const text = e.currentTarget.value.trim();
      if (!text) return;

      const task = tasks[currentMode].find((t) => t._id === taskId);
      if (!task) return;

      const newSubtasks = [...(task.subtasks || []), { text, completed: false }];

      try {
        await fetch(`/api/tasks?id=${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subtasks: newSubtasks }),
        });
        fetchTasks();
      } catch (e) {
        console.error("Error adding subtask: ", e);
      }
      e.currentTarget.value = "";
    }
  };

  const handleAttachmentSubmit = async () => {
    if (!targetTaskIdForAttachment) return;

    const task = tasks[currentMode].find((t) => t._id === targetTaskIdForAttachment);
    if (!task) return;

    const linkVal = attachmentLink.trim();
    const file = attachmentFile;

    try {
      const newAttachments = [...(task.attachments || [])];
      
      if (file) {
        if (file.size > 1024 * 1024) {
          alert("Image must be smaller than 1MB.");
          return;
        }
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64Data = e.target?.result as string;
          newAttachments.push({ type: "image", name: file.name, data: base64Data });
          
          await fetch(`/api/tasks?id=${task._id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ attachments: newAttachments }),
          });
          fetchTasks();
          setIsAttachmentModalOpen(false);
        };
        reader.readAsDataURL(file);
      } else if (linkVal) {
        newAttachments.push({ type: "link", url: linkVal });
        await fetch(`/api/tasks?id=${task._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attachments: newAttachments }),
        });
        fetchTasks();
        setIsAttachmentModalOpen(false);
      } else {
        alert("Please provide a link or an image.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const createProject = async () => {
    const newName = deptNameInput.trim();
    const template = deptTemplateSelect;

    if (newName) {
      setCustomDepartmentName(newName);
      localStorage.setItem("customDepartmentName", newName);
      
      const url = new URL(window.location.href);
      url.searchParams.set("dept", newName);
      window.history.pushState({}, "", url.toString());

      setIsProjectModalOpen(false);

      if (template !== "blank") {
        let templateTasks: any[] = [];
        if (template === "software") {
          templateTasks = [
            { title: "Set up Code Repository", description: "Initialize Git and create branch.", status: "done", priority: "High", color: "#3b82f6" },
            { title: "Design Database Schema", description: "Plan tables.", status: "in_progress", priority: "High", color: "#8b5cf6", subtasks: [{text: "ER Diagram", completed: true}, {text: "SQL Scripts", completed: false}] },
            { title: "Build Authentication API", description: "Login, Signup.", status: "todo", priority: "Medium", color: "#10b981" },
          ];
        } else if (template === "marketing") {
          templateTasks = [
            { title: "Market Research", description: "Analyze competitor ad strategies.", status: "done", priority: "High", color: "#ec4899" },
            { title: "Create Ad Copy", description: "Write 3 variations.", status: "in_progress", priority: "Medium", color: "#f43f5e" },
          ];
        } else if (template === "hr") {
          templateTasks = [
            { title: "Send Welcome Email", description: "Include instructions for Day 1.", status: "done", priority: "High", color: "#10b981" },
            { title: "Setup IT Accounts", description: "Email, Slack.", status: "in_progress", priority: "High", color: "#3b82f6" },
          ];
        }

        for (const t of templateTasks) {
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
            department: newName,
            status: t.status,
            subtasks: t.subtasks || [],
          };
          await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newTask),
          });
        }
      }
      fetchTasks();
    } else {
      alert("Please enter a department name.");
    }
  };

  const deleteProject = async () => {
    if (confirm(`Are you sure you want to delete the department "${customDepartmentName}" and ALL its tasks?`)) {
      try {
        await fetch(`/api/tasks?department=${encodeURIComponent(customDepartmentName)}`, { method: "DELETE" });
        setCurrentMode("personal");
        const url = new URL(window.location.href);
        url.searchParams.delete("dept");
        window.history.pushState({}, "", url.toString());
        localStorage.removeItem("customDepartmentName");
        setCustomDepartmentName("Department");
        fetchTasks();
      } catch (e) {
        console.error("Error deleting department: ", e);
      }
    }
  };

  const currentTasks = tasks[currentMode].filter(task => {
    const matchAssignee = filterAssignee === "all" || task.assignee === filterAssignee;
    const matchPeriod = filterPeriod === "all" 
      || (filterPeriod === "Custom" && (!filterDate || task.period === filterDate))
      || task.period === filterPeriod;
    return matchAssignee && matchPeriod;
  });

  const renderTaskList = (status: string) => {
    const statusTasks = currentTasks.filter(t => t.status === status);
    
    if (statusTasks.length === 0) {
      return (
        <div style={{ textAlign: "center", padding: "2rem 0", color: "var(--text-secondary)", fontSize: "0.95rem", fontStyle: "italic", opacity: 0.7 }}>
          No tasks yet
        </div>
      );
    }

    return statusTasks.map(task => {
      let deadlineClass = "";
      if (task.deadline && status !== "done") {
        const timeDiff = new Date(task.deadline).getTime() - new Date().getTime();
        if (timeDiff <= 0) deadlineClass = "overdue";
        else if (timeDiff <= 3600000) deadlineClass = "approaching";
      }

      return (
        <div
          key={task._id}
          className={`task-card ${deadlineClass}`}
          draggable
          onDragStart={(e) => handleDragStart(e, task._id)}
          style={{ borderTop: task.color ? `4px solid ${task.color}` : "" }}
        >
          <div className="task-header">
            <h3 className="task-title">{task.title}</h3>
            {task.priority && (
              <span className={`badge ${task.priority.toLowerCase()}`}>{task.priority}</span>
            )}
          </div>
          {task.description && <p className="task-description">{task.description}</p>}
          
          <div className="subtasks-container">
            {task.subtasks?.map((st, i) => (
              <div key={i} className={`subtask-item ${st.completed ? "completed" : ""}`}>
                <input
                  type="checkbox"
                  checked={st.completed}
                  onChange={(e) => toggleSubtask(task._id, i, e.target.checked)}
                />
                <span>{st.text}</span>
              </div>
            ))}
            <input
              type="text"
              className="subtask-input"
              placeholder="+ Add subtask (press Enter)"
              onKeyDown={(e) => addSubtask(e, task._id)}
            />
          </div>

          {task.deadline && status !== "done" && (
            <div className={`task-deadline ${deadlineClass}`}>
              ⏳ Due: {new Date(task.deadline).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
            </div>
          )}

          <div className="attachments-container">
            {task.attachments?.map((att, i) => (
              att.type === "image" ? (
                <div key={i} className="attachment-item">
                  <img src={att.data} alt="attachment" />
                </div>
              ) : (
                <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="attachment-link">
                  🔗 Link
                </a>
              )
            ))}
            <button
              className="btn-attachment"
              onClick={() => {
                setTargetTaskIdForAttachment(task._id);
                setIsAttachmentModalOpen(true);
              }}
            >
              📎 Add Attachment
            </button>
          </div>

          <div className="task-meta">
            <span>📅 {task.period}</span>
            {task.mode === "team" && <span>👤 {task.assignee}</span>}
          </div>

          <div className="task-actions">
            <button className="btn-delete" onClick={() => deleteTask(task._id)}>🗑️</button>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? "open" : ""}`}>
        <div className="logo">
          <img src="/logo.png" alt="Work Board Logo" className="logo-img" />
          <h2>Work Board</h2>
        </div>
        
        <nav className="nav-menu">
          <div className={`nav-item ${currentMode === "personal" && activeView !== "settings" ? "active" : ""}`} onClick={() => handleNavClick("personal")}>
            <span style={{ fontSize: "1.2rem" }}>👤</span> Personal Board
          </div>
          <div className={`nav-item ${currentMode === "team" && activeView !== "settings" ? "active" : ""}`} onClick={() => handleNavClick("team")}>
            <span style={{ fontSize: "1.2rem" }}>👥</span> Department Board
          </div>
          <div className={`nav-item ${activeView === "settings" ? "active" : ""}`} onClick={() => handleNavClick("settings")}>
            <span style={{ fontSize: "1.2rem" }}>⚙️</span> Settings
          </div>
        </nav>

        <div className="filters">
          <h3>Filters</h3>
          <div className="filter-group">
            <label htmlFor="filterAssignee">Assignee</label>
            <select id="filterAssignee" value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}>
              <option value="all">All Assignees</option>
              {assignees.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="filterPeriod">Time Period</label>
            <select id="filterPeriod" value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)}>
              <option value="all">All Periods</option>
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
              <option value="Custom">Custom Date...</option>
            </select>
            {filterPeriod === "Custom" && (
              <input type="date" className="date-filter" style={{ marginTop: "0.5rem" }} value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content" onClick={(e) => {
        // Close sidebar if clicking outside
        if (window.innerWidth <= 768 && isSidebarOpen) setIsSidebarOpen(false);
      }}>
        {activeView === "dashboard" ? (
          <div id="dashboardView">
            <header className="main-header">
              <div className="header-title-row">
                <button className="mobile-menu-btn" onClick={(e) => { e.stopPropagation(); setIsSidebarOpen(true); }}>☰</button>
                <h1>{currentMode === "personal" ? "Personal Board" : `${customDepartmentName} Board`}</h1>
                <div className="header-actions" style={{ display: "flex", gap: "10px" }}>
                  {currentMode === "team" && (
                    <>
                      <button className="btn-secondary" onClick={() => navigator.clipboard.writeText(window.location.href)}>🔗 Share</button>
                      <button className="btn-secondary" onClick={() => {
                        const newName = prompt("Enter new name for this department:", customDepartmentName);
                        if (newName && newName.trim() !== "" && newName.trim() !== customDepartmentName) {
                          fetch(`/api/tasks?department=${encodeURIComponent(customDepartmentName)}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ newDepartment: newName.trim() }),
                          }).then(() => {
                            setCustomDepartmentName(newName.trim());
                            localStorage.setItem("customDepartmentName", newName.trim());
                            const url = new URL(window.location.href);
                            url.searchParams.set("dept", newName.trim());
                            window.history.pushState({}, "", url.toString());
                            fetchTasks();
                          });
                        }
                      }}>✏️ Edit</button>
                      <button className="btn-secondary" style={{ color: "var(--priority-high)", borderColor: "var(--priority-high)" }} onClick={deleteProject}>🗑️ Delete</button>
                      <button className="btn-secondary" onClick={() => setIsProjectModalOpen(true)}>New Project</button>
                    </>
                  )}
                  <button className="btn-primary" style={{ padding: "0.6rem 1.2rem", fontSize: "0.95rem" }} onClick={() => setIsTaskModalOpen(true)}>+ New Task</button>
                </div>
              </div>
              <p>{currentMode === "personal" ? "Manage your private tasks efficiently." : "Shared tasks for the department."}</p>
            </header>

            <section className="kanban-board">
              <div className="kanban-column" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={(e) => handleDrop(e, "todo")}>
                <h2 className="column-title">To-Do <span className="task-count">{currentTasks.filter(t => t.status === "todo").length}</span></h2>
                <div className="kanban-task-list">{renderTaskList("todo")}</div>
              </div>
              <div className="kanban-column" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={(e) => handleDrop(e, "in_progress")}>
                <h2 className="column-title">In Progress <span className="task-count">{currentTasks.filter(t => t.status === "in_progress").length}</span></h2>
                <div className="kanban-task-list">{renderTaskList("in_progress")}</div>
              </div>
              <div className="kanban-column" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={(e) => handleDrop(e, "done")}>
                <h2 className="column-title">Done <span className="task-count">{currentTasks.filter(t => t.status === "done").length}</span></h2>
                <div className="kanban-task-list">{renderTaskList("done")}</div>
              </div>
            </section>
          </div>
        ) : (
          <div id="settingsView">
            <header className="main-header">
              <div className="header-title-row">
                <button className="mobile-menu-btn" onClick={(e) => { e.stopPropagation(); setIsSidebarOpen(true); }}>☰</button>
                <h1>Settings</h1>
              </div>
              <p style={{ color: "var(--text-secondary)" }}>Manage your account and preferences.</p>
            </header>
            
            <section className="task-form-section" style={{ maxWidth: "500px", marginBottom: "2rem" }}>
              <h3 style={{ marginBottom: "1rem" }}>🤖 Butler Automations</h3>
              <p style={{ color: "var(--text-secondary)", marginBottom: "1rem" }}>Automate repetitive actions when you move tasks to the Done column.</p>
              
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", padding: "10px", background: "var(--bg-input)", border: "1px solid var(--border-glass)", borderRadius: "8px" }}>
                <div>
                  <strong>Auto-Delete on Done</strong>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "4px" }}>Automatically delete tasks dropped in Done.</p>
                </div>
                <input type="checkbox" checked={butlerAutoDelete} onChange={(e) => {
                  setButlerAutoDelete(e.target.checked);
                  localStorage.setItem("butlerAutoDelete", String(e.target.checked));
                }} style={{ width: "20px", height: "20px", cursor: "pointer" }} />
              </div>
              
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px", background: "var(--bg-input)", border: "1px solid var(--border-glass)", borderRadius: "8px" }}>
                <div>
                  <strong>Auto-Update Date on Done</strong>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "4px" }}>Change the deadline to current time.</p>
                </div>
                <input type="checkbox" checked={butlerAutoDate} onChange={(e) => {
                  setButlerAutoDate(e.target.checked);
                  localStorage.setItem("butlerAutoDate", String(e.target.checked));
                }} style={{ width: "20px", height: "20px", cursor: "pointer" }} />
              </div>
            </section>

            <section className="task-form-section" style={{ maxWidth: "500px" }}>
              <h3 style={{ marginBottom: "1rem" }}>Account Actions</h3>
              <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>Sign out of your Work Board account.</p>
              <button className="btn-secondary" style={{ color: "var(--priority-high)", borderColor: "var(--priority-high)", width: "100%" }} onClick={handleLogout}>Logout</button>
            </section>
          </div>
        )}
      </main>

      {/* New Project Modal */}
      <div className={`modal ${isProjectModalOpen ? "" : "hidden"}`}>
        <div className="modal-content">
          <h2>New Project</h2>
          <p>Enter the Department Name for this board:</p>
          <input type="text" placeholder="e.g., Calling" value={deptNameInput} onChange={(e) => setDeptNameInput(e.target.value)} />
          
          <p style={{ marginTop: "1rem" }}>Choose a Template:</p>
          <select value={deptTemplateSelect} onChange={(e) => setDeptTemplateSelect(e.target.value)} style={{ width: "100%", padding: "0.8rem", borderRadius: "8px", border: "1px solid var(--border-glass)", background: "var(--bg-input)", color: "var(--text-primary)", marginTop: "0.5rem", fontFamily: "inherit" }}>
            <option value="blank">📝 Blank Board</option>
            <option value="software">🚀 Software Development</option>
            <option value="marketing">📢 Marketing Campaign</option>
            <option value="hr">👋 HR Onboarding</option>
          </select>

          <div className="modal-actions" style={{ marginTop: "1.5rem" }}>
            <button className="btn-secondary" onClick={() => setIsProjectModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={createProject}>Create Project</button>
          </div>
        </div>
      </div>

      {/* Attachment Modal */}
      <div className={`modal ${isAttachmentModalOpen ? "" : "hidden"}`}>
        <div className="modal-content">
          <h2>Add Attachment</h2>
          <p>Upload a small image or paste an external link (Google Drive, GitHub, Slack, etc.).</p>
          
          <div style={{ marginBottom: "1rem", marginTop: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", color: "var(--text-secondary)" }}>External Link URL</label>
            <input type="url" placeholder="https://drive.google.com/..." style={{ width: "100%", boxSizing: "border-box" }} value={attachmentLink} onChange={(e) => setAttachmentLink(e.target.value)} />
          <div className="input-group">
            <label>Image File (Max 1MB)</label>
            <input type="file" accept="image/*" onChange={(e) => setAttachmentFile(e.target.files ? e.target.files[0] : null)} />
          </div>
          <div style={{ textAlign: "center", marginBottom: "1rem" }}>OR</div>
          <div className="input-group">
            <label>External Link</label>
            <input type="url" placeholder="https://..." value={attachmentLink} onChange={(e) => setAttachmentLink(e.target.value)} />
          </div>
          <button className="btn-primary btn-full" onClick={handleAttachmentSubmit}>Attach</button>
        </div>
      </div>

      {/* Task Modal */}
      <div className={`modal ${isTaskModalOpen ? "" : "hidden"}`}>
        <div className="modal-content" style={{ maxWidth: "600px" }}>
          <button className="btn-close" onClick={() => setIsTaskModalOpen(false)}>&times;</button>
          <h2>Create New Task</h2>
          <form onSubmit={handleTaskSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <input type="text" placeholder="Task Title" required value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} style={{ width: "100%", padding: "1rem", borderRadius: "10px", border: "1px solid var(--border-glass)", background: "var(--bg-input)", color: "var(--text-primary)" }} />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <textarea placeholder="Detailed description..." rows={3} value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} style={{ width: "100%", padding: "1rem", borderRadius: "10px", border: "1px solid var(--border-glass)", background: "var(--bg-input)", color: "var(--text-primary)", resize: "vertical" }} />
            </div>
            
            <div className="form-row" style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <input type="color" className="color-picker" value={taskColor} onChange={(e) => setTaskColor(e.target.value)} title="Choose Task Color" style={{ height: "45px", width: "45px", padding: "0", border: "none", borderRadius: "8px", background: "transparent", cursor: "pointer" }} />
              <input
                type={deadlineInputType}
                placeholder="Deadline (optional)"
                onFocus={() => setDeadlineInputType("datetime-local")}
                onBlur={() => setDeadlineInputType(taskDeadline ? "datetime-local" : "text")}
                value={taskDeadline}
                onChange={(e) => setTaskDeadline(e.target.value)}
                style={{ flex: "1 1 140px", minWidth: "140px", padding: "0.8rem", borderRadius: "8px", border: "1px solid var(--border-glass)", background: "var(--bg-input)", color: "var(--text-primary)" }}
              />
              <select required value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)} style={{ flex: "1 1 140px", minWidth: "140px", padding: "0.8rem", borderRadius: "8px", border: "1px solid var(--border-glass)", background: "var(--bg-input)", color: "var(--text-primary)" }}>
                <option value="" disabled>Priority</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
              
              <select required value={taskPeriodType} onChange={(e) => setTaskPeriodType(e.target.value)} style={{ flex: "1 1 140px", minWidth: "140px", padding: "0.8rem", borderRadius: "8px", border: "1px solid var(--border-glass)", background: "var(--bg-input)", color: "var(--text-primary)" }}>
                <option value="" disabled>Period</option>
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
                <option value="Custom">Custom Date...</option>
              </select>

              {taskPeriodType === "Custom" && (
                <input type="date" required value={taskPeriod} onChange={(e) => setTaskPeriod(e.target.value)} style={{ flex: "1 1 140px", minWidth: "140px", padding: "0.8rem", borderRadius: "8px", border: "1px solid var(--border-glass)", background: "var(--bg-input)", color: "var(--text-primary)" }} />
              )}

              {currentMode === "team" && (
                <select required value={taskAssignee} onChange={(e) => {
                  if (e.target.value === "ADD_NEW") {
                    const newAssignee = prompt("Enter new Assignee name:");
                    if (newAssignee && newAssignee.trim() !== "") {
                      const trimmed = newAssignee.trim();
                      if (!assignees.includes(trimmed)) {
                        const newArr = [...assignees, trimmed];
                        setAssignees(newArr);
                        localStorage.setItem("assignees", JSON.stringify(newArr));
                      }
                      setTaskAssignee(trimmed);
                    } else {
                      setTaskAssignee("");
                    }
                  } else {
                    setTaskAssignee(e.target.value);
                  }
                }} style={{ flex: "1 1 140px", minWidth: "140px", padding: "0.8rem", borderRadius: "8px", border: "1px solid var(--border-glass)", background: "var(--bg-input)", color: "var(--text-primary)" }}>
                  <option value="" disabled>Assignee</option>
                  {assignees.map(a => <option key={a} value={a}>{a}</option>)}
                  <option value="ADD_NEW">+ Add New</option>
                </select>
              )}
            </div>
            <button type="submit" className="btn-primary btn-full">Create Task</button>
          </form>
        </div>
      </div>
    </div>
  );
}
