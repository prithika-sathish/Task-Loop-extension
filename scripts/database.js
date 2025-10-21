// Replace previous Supabase import/duplicates with a lightweight REST helper
const SUPABASE_URL = 'https://vyicyfnntcseipjewxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5aWN5Zm5udGNzZWlwamV3eGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2ODg1MDcsImV4cCI6MjA3NjI2NDUwN30.MGjlyybbPX-lZvpWfRv7i7g-uURljNlltKUe5PFLHpM';
const SUPABASE_TABLE = 'Tasks';
const SUPABASE_STREAKS_TABLE = 'Streaks';
const SUPABASE_PENDING_TABLE = 'PendingTasks';
const SUPABASE_REST = `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`;
const SUPABASE_STREAKS_REST = `${SUPABASE_URL}/rest/v1/${SUPABASE_STREAKS_TABLE}`;
const SUPABASE_PENDING_REST = `${SUPABASE_URL}/rest/v1/${SUPABASE_PENDING_TABLE}`;

// Simple fetch wrapper for Supabase REST
async function supabaseFetch(path = '', opts = {}, baseUrl = SUPABASE_REST) {
    const url = path.startsWith('http') ? path : `${baseUrl}${path}`;
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

// Streaks Supabase functions
async function addStreakToSupabase(streak) {
    try {
        const payload = {
            task_name: streak.taskName,
            current_streak: streak.currentStreak || 0,
            last_completed_date: streak.lastCompletedDate || null
        };
        const inserted = await supabaseFetch('', { 
            method: 'POST', 
            body: JSON.stringify(payload),
            headers: { Prefer: 'return=representation' }
        }, SUPABASE_STREAKS_REST);
        return Array.isArray(inserted) ? inserted[0] : inserted;
    } catch (err) {
        console.warn('Supabase streak insert failed', err);
        return null;
    }
}

async function updateStreakInSupabase(supabaseId, updates) {
    if (!supabaseId) return null;
    try {
        const payload = {};
        if (updates.taskName !== undefined) payload.task_name = updates.taskName;
        if (updates.currentStreak !== undefined) payload.current_streak = updates.currentStreak;
        if (updates.lastCompletedDate !== undefined) payload.last_completed_date = updates.lastCompletedDate;
        
        if (Object.keys(payload).length === 0) return null;
        
        const updated = await supabaseFetch(`?id=eq.${supabaseId}`, { 
            method: 'PATCH', 
            body: JSON.stringify(payload) 
        }, SUPABASE_STREAKS_REST);
        return Array.isArray(updated) ? updated[0] : updated;
    } catch (err) {
        console.warn('Supabase streak update failed', err);
        return null;
    }
}

async function deleteStreakFromSupabase(supabaseId) {
    if (!supabaseId) return false;
    try {
        await supabaseFetch(`?id=eq.${supabaseId}`, { method: 'DELETE' }, SUPABASE_STREAKS_REST);
        return true;
    } catch (err) {
        console.warn('Supabase streak delete failed', err);
        return false;
    }
}

// Pending Tasks Supabase functions
async function addPendingTaskToSupabase(task) {
    try {
        const payload = {
            task_name: task.taskName,
            completed: task.completed || false
        };
        const inserted = await supabaseFetch('', { 
            method: 'POST', 
            body: JSON.stringify(payload),
            headers: { Prefer: 'return=representation' }
        }, SUPABASE_PENDING_REST);
        return Array.isArray(inserted) ? inserted[0] : inserted;
    } catch (err) {
        console.warn('Supabase pending task insert failed', err);
        return null;
    }
}

async function updatePendingTaskInSupabase(supabaseId, updates) {
    if (!supabaseId) return null;
    try {
        const payload = {};
        if (updates.taskName !== undefined) payload.task_name = updates.taskName;
        if (updates.completed !== undefined) payload.completed = updates.completed;
        
        if (Object.keys(payload).length === 0) return null;
        
        const updated = await supabaseFetch(`?id=eq.${supabaseId}`, { 
            method: 'PATCH', 
            body: JSON.stringify(payload) 
        }, SUPABASE_PENDING_REST);
        return Array.isArray(updated) ? updated[0] : updated;
    } catch (err) {
        console.warn('Supabase pending task update failed', err);
        return null;
    }
}

async function deletePendingTaskFromSupabase(supabaseId) {
    if (!supabaseId) return false;
    try {
        await supabaseFetch(`?id=eq.${supabaseId}`, { method: 'DELETE' }, SUPABASE_PENDING_REST);
        return true;
    } catch (err) {
        console.warn('Supabase pending task delete failed', err);
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
            SETTINGS: 'settings',
            STREAKS: 'streaks',
            PENDING_TASKS: 'pendingTasks'
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

    // Streaks Management
    async getStreaks() {
        try {
            const streaks = await this.getFromStorage(this.storageKeys.STREAKS);
            return streaks || [];
        } catch (error) {
            console.error('Error getting streaks:', error);
            return [];
        }
    }

    async saveStreaks(streaks) {
        try {
            await this.setToStorage(this.storageKeys.STREAKS, streaks);
            return true;
        } catch (error) {
            console.error('Error saving streaks:', error);
            return false;
        }
    }

    async addStreak(streak) {
        try {
            const streaks = await this.getStreaks();
            const newStreak = {
                id: this.generateId(),
                taskName: streak.taskName,
                currentStreak: 0,
                lastCompletedDate: null,
                createdAt: Date.now(),
                ...streak
            };

            streaks.push(newStreak);
            await this.saveStreaks(streaks);

            // Sync to Supabase
            const remote = await addStreakToSupabase(newStreak).catch(() => null);
            if (remote && remote.id !== undefined) {
                newStreak.supabaseId = remote.id;
                await this.saveStreaks(streaks);
            }

            return newStreak;
        } catch (error) {
            console.error('Error adding streak:', error);
            return null;
        }
    }

    async updateStreak(streakId, updates) {
        try {
            const streaks = await this.getStreaks();
            const idx = streaks.findIndex(s => s.id === streakId);
            if (idx === -1) throw new Error('Streak not found');

            streaks[idx] = { ...streaks[idx], ...updates };
            await this.saveStreaks(streaks);

            const supabaseId = streaks[idx].supabaseId;
            if (supabaseId) {
                await updateStreakInSupabase(supabaseId, updates).catch(() => null);
            }

            return streaks[idx];
        } catch (error) {
            console.error('Error updating streak:', error);
            return null;
        }
    }

    async deleteStreak(streakId) {
        try {
            const streaks = await this.getStreaks();
            const streak = streaks.find(s => s.id === streakId);
            if (!streak) return false;

            if (streak.supabaseId) {
                await deleteStreakFromSupabase(streak.supabaseId).catch(() => null);
            }

            const filtered = streaks.filter(s => s.id !== streakId);
            await this.saveStreaks(filtered);
            return true;
        } catch (error) {
            console.error('Error deleting streak:', error);
            return false;
        }
    }

    async completeStreakToday(streakId) {
        try {
            const streaks = await this.getStreaks();
            const streak = streaks.find(s => s.id === streakId);
            if (!streak) throw new Error('Streak not found');

            const today = this.getTodayDateString();
            
            // Check if already completed today
            if (streak.lastCompletedDate === today) {
                return { success: false, message: 'Already completed today' };
            }

            // Check if streak should continue or reset
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayString = this.formatDateString(yesterday);

            let newStreak = streak.currentStreak;
            if (streak.lastCompletedDate === yesterdayString) {
                // Continue streak
                newStreak = streak.currentStreak + 1;
            } else if (streak.lastCompletedDate === null || streak.lastCompletedDate < yesterdayString) {
                // Reset streak (missed a day)
                newStreak = 1;
            }

            await this.updateStreak(streakId, {
                currentStreak: newStreak,
                lastCompletedDate: today
            });

            return { success: true, streak: newStreak };
        } catch (error) {
            console.error('Error completing streak:', error);
            return { success: false, message: error.message };
        }
    }

    // Pending Tasks Management
    async getPendingTasks() {
        try {
            const tasks = await this.getFromStorage(this.storageKeys.PENDING_TASKS);
            return tasks || [];
        } catch (error) {
            console.error('Error getting pending tasks:', error);
            return [];
        }
    }

    async savePendingTasks(tasks) {
        try {
            await this.setToStorage(this.storageKeys.PENDING_TASKS, tasks);
            return true;
        } catch (error) {
            console.error('Error saving pending tasks:', error);
            return false;
        }
    }

    async addPendingTask(task) {
        try {
            const tasks = await this.getPendingTasks();
            const newTask = {
                id: this.generateId(),
                taskName: task.taskName,
                completed: false,
                createdAt: Date.now(),
                ...task
            };

            tasks.push(newTask);
            await this.savePendingTasks(tasks);

            // Sync to Supabase
            const remote = await addPendingTaskToSupabase(newTask).catch(() => null);
            if (remote && remote.id !== undefined) {
                newTask.supabaseId = remote.id;
                await this.savePendingTasks(tasks);
            }

            return newTask;
        } catch (error) {
            console.error('Error adding pending task:', error);
            return null;
        }
    }

    async updatePendingTask(taskId, updates) {
        try {
            const tasks = await this.getPendingTasks();
            const idx = tasks.findIndex(t => t.id === taskId);
            if (idx === -1) throw new Error('Pending task not found');

            tasks[idx] = { ...tasks[idx], ...updates };
            await this.savePendingTasks(tasks);

            const supabaseId = tasks[idx].supabaseId;
            if (supabaseId) {
                await updatePendingTaskInSupabase(supabaseId, updates).catch(() => null);
            }

            return tasks[idx];
        } catch (error) {
            console.error('Error updating pending task:', error);
            return null;
        }
    }

    async deletePendingTask(taskId) {
        try {
            const tasks = await this.getPendingTasks();
            const task = tasks.find(t => t.id === taskId);
            if (!task) return false;

            if (task.supabaseId) {
                await deletePendingTaskFromSupabase(task.supabaseId).catch(() => null);
            }

            const filtered = tasks.filter(t => t.id !== taskId);
            await this.savePendingTasks(filtered);
            return true;
        } catch (error) {
            console.error('Error deleting pending task:', error);
            return false;
        }
    }

    async completePendingTask(taskId) {
        try {
            await this.updatePendingTask(taskId, { completed: true });
            return true;
        } catch (error) {
            console.error('Error completing pending task:', error);
            return false;
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
