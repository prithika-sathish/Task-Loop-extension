// Replace previous Supabase import/duplicates with a lightweight REST helper
const SUPABASE_URL = 'https://vyicyfnntcseipjewxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5aWN5Zm5udGNzZWlwamV3eGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2ODg1MDcsImV4cCI6MjA3NjI2NDUwN30.MGjlyybbPX-lZvpWfRv7i7g-uURljNlltKUe5PFLHpM';
const SUPABASE_TABLE = 'Tasks';
const SUPABASE_REST = `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`;

// Simple fetch wrapper for Supabase REST
async function supabaseFetch(path = '', opts = {}) {
    const url = path.startsWith('http') ? path : `${SUPABASE_REST}${path}`;
    const headers = {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: opts.prefer || 'return=representation',
        ...opts.headers
    };

    const res = await fetch(url, { ...opts, headers });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Supabase error ${res.status}: ${text}`);
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    return null;
}

async function addTaskToSupabase(task) {
    try {
        // Map to actual Supabase table columns: id, date, duration, task_name
        const payload = {
            task_name: task.name,
            duration: task.duration,
            date: task.scheduledDate || (new Date()).toISOString().split('T')[0]
            // Note: Supabase table only has id, date, duration, task_name
            // start_time and status are stored locally only
        };
        const inserted = await supabaseFetch('', { method: 'POST', body: JSON.stringify(payload) });
        return Array.isArray(inserted) ? inserted[0] : inserted;
    } catch (err) {
        console.warn('Supabase insert failed', err);
        return null;
    }
}

async function updateTaskInSupabase(supabaseId, updates) {
    if (!supabaseId) return null;
    try {
        // Map to actual Supabase table columns: id, date, duration, task_name
        const payload = {};
        if (updates.name !== undefined) payload.task_name = updates.name;
        if (updates.duration !== undefined) payload.duration = updates.duration;
        if (updates.scheduledDate !== undefined) payload.date = updates.scheduledDate;
        
        // Only update if there are fields to update
        if (Object.keys(payload).length === 0) return null;
        
        const updated = await supabaseFetch(`?id=eq.${supabaseId}`, { method: 'PATCH', body: JSON.stringify(payload) });
        return Array.isArray(updated) ? updated[0] : updated;
    } catch (err) {
        console.warn('Supabase update failed', err);
        return null;
    }
}

async function deleteTaskFromSupabase(supabaseId) {
    if (!supabaseId) return false;
    try {
        await supabaseFetch(`?id=eq.${supabaseId}`, { method: 'DELETE' });
        return true;
    } catch (err) {
        console.warn('Supabase delete failed', err);
        return false;
    }
}

// TaskLoopDatabase — local storage with optional Supabase sync
class TaskLoopDatabase {
    constructor() {
        this.storageKeys = {
            TASKS: 'tasks',
            CURRENT_TASK: 'currentTask',
            TASK_HISTORY: 'taskHistory',
            SETTINGS: 'settings'
        };
        // Check if chrome.storage is available (extension context)
        this.isChromeExtension = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
    }

    // Storage wrapper - uses chrome.storage in extension, localStorage in browser
    async getFromStorage(key) {
        if (this.isChromeExtension) {
            const data = await chrome.storage.local.get([key]);
            return data[key];
        } else {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : undefined;
        }
    }

    async setToStorage(key, value) {
        if (this.isChromeExtension) {
            await chrome.storage.local.set({ [key]: value });
        } else {
            localStorage.setItem(key, JSON.stringify(value));
        }
    }

    async removeFromStorage(key) {
        if (this.isChromeExtension) {
            await chrome.storage.local.remove([key]);
        } else {
            localStorage.removeItem(key);
        }
    }

    // Task Management
    async getTasks() {
        try {
            const tasks = await this.getFromStorage(this.storageKeys.TASKS);
            return tasks || [];
        } catch (error) {
            console.error('Error getting tasks:', error);
            return [];
        }
    }

    async saveTasks(tasks) {
        try {
            await this.setToStorage(this.storageKeys.TASKS, tasks);
            return true;
        } catch (error) {
            console.error('Error saving tasks:', error);
            return false;
        }
    }

    async addTask(task) {
        try {
            const tasks = await this.getTasks();
            const newTask = {
                id: this.generateId(),
                name: task.name,
                duration: task.duration,
                startTime: task.startTime || null,
                status: task.status || 'pending',
                createdAt: Date.now(),
                scheduledDate: task.scheduledDate || this.getTodayDateString(),
                ...task
            };

            // Save locally first
            tasks.push(newTask);
            await this.saveTasks(tasks);

            // attempt supabase insert and store supabaseId
            const remote = await addTaskToSupabase(newTask).catch(() => null);
            if (remote && remote.id !== undefined) {
                newTask.supabaseId = remote.id;
                await this.saveTasks(tasks);
            }
            return newTask;
        } catch (error) {
            console.error('Error adding task:', error);
            return null;
        }
    }

    async updateTask(taskId, updates) {
        try {
            const tasks = await this.getTasks();
            const idx = tasks.findIndex(t => t.id === taskId);
            if (idx === -1) throw new Error('Task not found');

            tasks[idx] = { ...tasks[idx], ...updates };
            await this.saveTasks(tasks);

            const supabaseId = tasks[idx].supabaseId;
            if (supabaseId) {
                await updateTaskInSupabase(supabaseId, updates).catch(() => null);
            }

            return tasks[idx];
        } catch (error) {
            console.error('Error updating task:', error);
            return null;
        }
    }

    async deleteTask(taskId) {
        try {
            const tasks = await this.getTasks();
            const task = tasks.find(t => t.id === taskId);
            if (!task) return false;

            if (task.supabaseId) {
                await deleteTaskFromSupabase(task.supabaseId).catch(() => null);
            }

            const filtered = tasks.filter(t => t.id !== taskId);
            await this.saveTasks(filtered);
            return true;
        } catch (error) {
            console.error('Error deleting task:', error);
            return false;
        }
    }

    async getTasksByDate(date) {
        try {
            const tasks = await this.getTasks();
            const dateString = typeof date === 'string' ? date : this.formatDateString(date);
            return tasks.filter(task => task.scheduledDate === dateString);
        } catch (error) {
            console.error('Error getting tasks by date:', error);
            return [];
        }
    }

    async getTodaysTasks() {
        return this.getTasksByDate(this.getTodayDateString());
    }

    // Current Task Management
    async getCurrentTask() {
        try {
            const task = await this.getFromStorage(this.storageKeys.CURRENT_TASK);
            return task || null;
        } catch (error) {
            console.error('Error getting current task:', error);
            return null;
        }
    }

    async setCurrentTask(task) {
        try {
            await this.setToStorage(this.storageKeys.CURRENT_TASK, task);
            // Also update local task status if present
            if (task && task.id) {
                await this.updateTask(task.id, { status: task.status, startTime: task.startTime ? task.startTime : task.start_time });
            }
            return true;
        } catch (error) {
            console.error('Error setting current task:', error);
            return false;
        }
    }

    async clearCurrentTask() {
        try {
            await this.removeFromStorage(this.storageKeys.CURRENT_TASK);
            return true;
        } catch (error) {
            console.error('Error clearing current task:', error);
            return false;
        }
    }

    // Task History Management
    async getTaskHistory() {
        try {
            const history = await this.getFromStorage(this.storageKeys.TASK_HISTORY);
            return history || [];
        } catch (error) {
            console.error('Error getting task history:', error);
            return [];
        }
    }

    async addToHistory(completedTask) {
        try {
            const history = await this.getTaskHistory();
            const historyEntry = {
                ...completedTask,
                completedAt: Date.now(),
                actualDuration: completedTask.actualDuration || completedTask.duration
            };

            history.push(historyEntry);
            await this.setToStorage(this.storageKeys.TASK_HISTORY, history);

            // Note: Supabase table doesn't have status, end_time, or actual_duration columns
            // These are tracked locally only. We could update duration if needed:
            if (completedTask.supabaseId && historyEntry.actualDuration !== completedTask.duration) {
                await updateTaskInSupabase(completedTask.supabaseId, {
                    duration: historyEntry.actualDuration
                }).catch(err => {
                    console.warn('Supabase history update skipped:', err);
                });
            }

            return true;
        } catch (error) {
            console.error('Error adding to history:', error);
            return false;
        }
    }

    async getHistoryByDateRange(startDate, endDate) {
        try {
            const history = await this.getTaskHistory();
            const start = new Date(startDate).getTime();
            const end = new Date(endDate).getTime();

            return history.filter(task => {
                const taskDate = task.completedAt || task.endTime || task.createdAt;
                return taskDate >= start && taskDate <= end;
            });
        } catch (error) {
            console.error('Error getting history by date range:', error);
            return [];
        }
    }

    async getHistoryByDate(date) {
        try {
            const history = await this.getTaskHistory();
            const targetDate = new Date(date);

            return history.filter(task => {
                const taskDate = new Date(task.completedAt || task.endTime || task.createdAt);
                return this.isSameDay(taskDate, targetDate);
            });
        } catch (error) {
            console.error('Error getting history by date:', error);
            return [];
        }
    }

    // Settings Management
    async getSettings() {
        try {
            const settings = await this.getFromStorage(this.storageKeys.SETTINGS);
            return settings || {};
        } catch (error) {
            console.error('Error getting settings:', error);
            return {};
        }
    }

    async saveSettings(settings) {
        try {
            await this.setToStorage(this.storageKeys.SETTINGS, settings);
            return true;
        } catch (error) {
            console.error('Error saving settings:', error);
            return false;
        }
    }

    async updateSettings(updates) {
        try {
            const currentSettings = await this.getSettings();
            const newSettings = { ...currentSettings, ...updates };
            await this.saveSettings(newSettings);
            return newSettings;
        } catch (error) {
            console.error('Error updating settings:', error);
            return null;
        }
    }

    // Utility Methods
    generateId() {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
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

    formatTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;

        if (hours === 0) {
            return `${mins}m`;
        } else if (mins === 0) {
            return `${hours}h`;
        } else {
            return `${hours}h ${mins}m`;
        }
    }

    // Storage Event Listeners
    onStorageChange(callback) {
        if (this.isChromeExtension && chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener((changes, namespace) => {
                if (namespace === 'local') {
                    callback(changes);
                }
            });
        } else {
            // For localStorage, listen to storage events
            window.addEventListener('storage', (e) => {
                if (e.key && e.newValue) {
                    const changes = {
                        [e.key]: {
                            newValue: JSON.parse(e.newValue),
                            oldValue: e.oldValue ? JSON.parse(e.oldValue) : undefined
                        }
                    };
                    callback(changes);
                }
            });
        }
    }
}

// Export for runtime use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaskLoopDatabase;
} else {
    window.TaskLoopDatabase = TaskLoopDatabase;
}
