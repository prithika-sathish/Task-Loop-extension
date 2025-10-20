// TaskLoop Popup Script
class TaskLoopPopup {
    constructor() {
        this.currentTask = null;
        this.tasks = [];
        this.taskHistory = [];
        this.currentView = 'today';
        this.currentDate = new Date();
        this.db = new TaskLoopDatabase(); // use DB layer that syncs to Supabase
        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.render();
        this.updateCurrentTask();
    }

    async loadData() {
        try {
            this.tasks = await this.db.getTasks();
            this.currentTask = await this.db.getCurrentTask();
            this.taskHistory = await this.db.getTaskHistory();
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    setupEventListeners() {
        const addTaskForm = document.getElementById('addTaskForm');
        if (addTaskForm) {
            addTaskForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addTask();
            });
        }

        document.getElementById('pauseBtn')?.addEventListener('click', () => this.pauseTask());
        document.getElementById('completeBtn')?.addEventListener('click', () => this.completeTask());
        document.getElementById('calendarBtn')?.addEventListener('click', () => this.toggleCalendarView());
        document.getElementById('settingsBtn')?.addEventListener('click', () => {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
                chrome.runtime.openOptionsPage();
            } else {
                // Fallback for non-extension context
                window.open('options.html', '_blank');
            }
        });
        document.getElementById('toggleView')?.addEventListener('click', () => this.toggleView());
        document.getElementById('prevMonth')?.addEventListener('click', () => this.navigateMonth(-1));
        document.getElementById('nextMonth')?.addEventListener('click', () => this.navigateMonth(1));

        // Only listen to storage changes if chrome.storage is available
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener((changes) => this.handleStorageChange(changes));
        }
    }

    async addTask() {
        const name = document.getElementById('taskName').value.trim();
        const duration = parseInt(document.getElementById('taskDuration').value);
        const startTime = document.getElementById('startTime').value;

        if (!name) return;

        const task = {
            name,
            duration,
            startTime: startTime || null,
            status: 'pending',
            scheduledDate: this.getTodayDateString()
        };

        // add via DB (local save + supabase attempt)
        const newTask = await this.db.addTask(task);
        this.tasks = await this.db.getTasks();

        // notify background for badge update (only if chrome.runtime is available)
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            try {
                chrome.runtime.sendMessage({ taskName: newTask.name });
            } catch (error) {
                console.log('Badge update skipped (not in extension context)');
            }
        }

        document.getElementById('addTaskForm').reset();
        this.render();
    }

    async startTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        try {
            // Send message to background if available
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                try {
                    await chrome.runtime.sendMessage({ action: 'startTask', task });
                } catch (error) {
                    console.log('Background message skipped (not in extension context)');
                }
            }
            
            task.status = 'running';
            task.startTime = Date.now();
            if (!task.remainingTime) task.remainingTime = task.duration * 60 * 1000;
            await this.db.updateTask(task.id, { status: 'running', startTime: task.startTime, remainingTime: task.remainingTime });
            this.tasks = await this.db.getTasks();
            this.render();
        } catch (error) {
            console.error('Error starting task:', error);
        }
    }

    async pauseTask() {
        try {
            // Send message to background if available
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                try {
                    await chrome.runtime.sendMessage({ action: 'pauseTask' });
                } catch (error) {
                    console.log('Background message skipped (not in extension context)');
                }
            }
            
            if (this.currentTask && this.currentTask.id) {
                await this.db.updateTask(this.currentTask.id, { status: 'paused' });
                this.tasks = await this.db.getTasks();
            }
            this.updateCurrentTask();
        } catch (error) {
            console.error('Error pausing task:', error);
        }
    }

    async completeTask() {
        try {
            // Send message to background if available
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                try {
                    await chrome.runtime.sendMessage({ action: 'completeTask' });
                } catch (error) {
                    console.log('Background message skipped (not in extension context)');
                }
            }

            if (this.currentTask && this.currentTask.id) {
                await this.db.updateTask(this.currentTask.id, { status: 'completed' });
                await this.db.addToHistory(this.currentTask);
                await this.db.clearCurrentTask();
            }

            this.currentTask = null;
            this.tasks = await this.db.getTasks();
            this.taskHistory = await this.db.getTaskHistory();
            this.render();
        } catch (error) {
            console.error('Error completing task:', error);
        }
    }

    async deleteTask(taskId) {
        await this.db.deleteTask(taskId);
        this.tasks = await this.db.getTasks();
        this.render();
    }

    async editTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        const newName = prompt('Edit task name:', task.name);
        if (newName && newName.trim()) {
            await this.db.updateTask(taskId, { name: newName.trim() });
            this.tasks = await this.db.getTasks();
            this.render();
        }
    }

    async updateCurrentTask() {
        try {
            this.currentTask = await this.db.getCurrentTask();
            this.renderCurrentTask();
        } catch (error) {
            console.error('Error getting current task:', error);
        }
    }

    toggleView() {
        this.currentView = this.currentView === 'today' ? 'history' : 'today';
        const toggleBtn = document.getElementById('toggleView');
        toggleBtn.textContent = this.currentView === 'today' ? 'History' : 'Today';
        this.render();
    }

    toggleCalendarView() {
        const calendarSection = document.getElementById('calendarSection');
        const tasksSection = document.getElementById('tasksSection');
        
        if (calendarSection.classList.contains('hidden')) {
            calendarSection.classList.remove('hidden');
            tasksSection.classList.add('hidden');
            this.renderCalendar();
        } else {
            calendarSection.classList.add('hidden');
            tasksSection.classList.remove('hidden');
        }
    }

    navigateMonth(direction) {
        this.currentDate.setMonth(this.currentDate.getMonth() + direction);
        this.renderCalendar();
    }

    render() {
        this.renderCurrentTask();
        this.renderTasks();
    }

    renderCurrentTask() {
        const currentTaskSection = document.getElementById('currentTaskSection');
        
        if (!this.currentTask || this.currentTask.status !== 'running') {
            currentTaskSection.classList.add('hidden');
            return;
        }

        currentTaskSection.classList.remove('hidden');
        
        const nameEl = document.getElementById('currentTaskName');
        const timeEl = document.getElementById('currentTaskTime');
        const durationEl = document.getElementById('currentTaskDuration');

        nameEl.textContent = this.currentTask.name;
        durationEl.textContent = `${this.currentTask.duration} min`;

        // Calculate remaining time
        const elapsed = Date.now() - this.currentTask.startTime;
        const remaining = Math.max(0, this.currentTask.remainingTime - elapsed);
        const remainingMinutes = Math.floor(remaining / (60 * 1000));
        const remainingSeconds = Math.floor((remaining % (60 * 1000)) / 1000);

        timeEl.textContent = `${remainingMinutes}:${remainingSeconds.toString().padStart(2, '0')}`;

        // Update every second
        setTimeout(() => {
            if (this.currentTask && this.currentTask.status === 'running') {
                this.renderCurrentTask();
            }
        }, 1000);
    }

    renderTasks() {
        const tasksList = document.getElementById('tasksList');
        const emptyState = document.getElementById('emptyState');

        let tasksToShow = [];
        
        if (this.currentView === 'today') {
            const today = this.getTodayDateString();
            tasksToShow = this.tasks.filter(task => 
                task.scheduledDate === today || !task.scheduledDate
            );
        } else {
            // Show completed tasks from history
            tasksToShow = this.taskHistory.slice(-10).reverse(); // Last 10 completed tasks
        }

        if (tasksToShow.length === 0) {
            tasksList.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        
        tasksList.innerHTML = tasksToShow.map(task => this.createTaskHTML(task)).join('');

        // Add event listeners to task buttons
        tasksToShow.forEach(task => {
            const taskEl = document.querySelector(`[data-task-id="${task.id}"]`);
            if (!taskEl) return;

            const startBtn = taskEl.querySelector('.start-btn');
            const editBtn = taskEl.querySelector('.edit-btn');
            const deleteBtn = taskEl.querySelector('.delete-btn');

            if (startBtn) {
                startBtn.addEventListener('click', () => this.startTask(task.id));
            }
            if (editBtn) {
                editBtn.addEventListener('click', () => this.editTask(task.id));
            }
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => this.deleteTask(task.id));
            }
        });
    }

    createTaskHTML(task) {
        const isHistory = this.currentView === 'history';
        const statusClass = this.getTaskStatusClass(task);
        
        return `
            <div class="task-item ${statusClass}" data-task-id="${task.id}">
                <div class="task-item-info">
                    <h4>${task.name}</h4>
                    <div class="task-item-meta">
                        ${task.duration} min
                        ${task.startTime ? ` • ${task.startTime}` : ''}
                        ${isHistory && task.actualDuration ? ` • Actual: ${task.actualDuration} min` : ''}
                    </div>
                </div>
                <div class="task-item-actions">
                    ${!isHistory && task.status === 'pending' ? 
                        `<button class="btn btn-success start-btn">Start</button>` : ''
                    }
                    ${!isHistory && task.status !== 'running' ? 
                        `<button class="btn btn-outline edit-btn">Edit</button>
                         <button class="btn btn-secondary delete-btn">Delete</button>` : ''
                    }
                </div>
            </div>
        `;
    }

    getTaskStatusClass(task) {
        if (task.status === 'completed') return 'completed';
        if (task.status === 'running') return 'running';
        
        // Check if task is overdue
        if (task.startTime) {
            const now = new Date();
            const taskTime = new Date();
            const [hours, minutes] = task.startTime.split(':');
            taskTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            
            if (now > taskTime && task.status === 'pending') {
                return 'overdue';
            }
        }
        
        return 'upcoming';
    }

    renderCalendar() {
        const calendarGrid = document.getElementById('calendarGrid');
        const currentMonthEl = document.getElementById('currentMonth');
        
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        currentMonthEl.textContent = new Intl.DateTimeFormat('en-US', { 
            month: 'long', 
            year: 'numeric' 
        }).format(this.currentDate);

        // Get first day of month and number of days
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        let calendarHTML = '';
        
        // Day headers
        const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayHeaders.forEach(day => {
            calendarHTML += `<div class="calendar-day-header">${day}</div>`;
        });

        // Empty cells for days before month starts
        for (let i = 0; i < startingDayOfWeek; i++) {
            calendarHTML += '<div class="calendar-day other-month"></div>';
        }

        // Days of the month
        const today = new Date();
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateString = this.formatDateString(date);
            const isToday = this.isSameDay(date, today);
            const hasTasks = this.taskHistory.some(task => 
                task.scheduledDate === dateString || 
                (task.endTime && this.formatDateString(new Date(task.endTime)) === dateString)
            );

            let classes = 'calendar-day';
            if (isToday) classes += ' today';
            if (hasTasks) classes += ' has-tasks';

            calendarHTML += `<div class="${classes}">${day}</div>`;
        }

        calendarGrid.innerHTML = calendarHTML;
    }

    handleStorageChange(changes) {
        if (changes.currentTask) {
            this.currentTask = changes.currentTask.newValue;
            this.renderCurrentTask();
        }
        if (changes.tasks) {
            this.tasks = changes.tasks.newValue || [];
            this.renderTasks();
        }
        if (changes.taskHistory) {
            this.taskHistory = changes.taskHistory.newValue || [];
        }
    }

    getTodayDateString() {
        return this.formatDateString(new Date());
    }

    formatDateString(date) {
        return date.toISOString().split('T')[0];
    }

    isSameDay(date1, date2) {
        return date1.toDateString() === date2.toDateString();
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TaskLoopPopup();
});

