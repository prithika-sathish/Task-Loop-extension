// TaskLoop Options Script
class TaskLoopOptions {
    constructor() {
        this.settings = {};
        this.defaultSettings = {
            badgeFormat: 'time',
            showBadgeWhenIdle: false,
            enableNotifications: true,
            notifyBeforeEnd: true,
            notificationSound: 'default',
            autoStartNext: false,
            allowOvertime: true,
            defaultDuration: 30,
            historyRetention: 30
        };
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.setupEventListeners();
        this.populateForm();
        this.loadStatistics();
    }

    async loadSettings() {
        try {
            const data = await chrome.storage.local.get(['settings']);
            this.settings = { ...this.defaultSettings, ...(data.settings || {}) };
        } catch (error) {
            console.error('Error loading settings:', error);
            this.settings = { ...this.defaultSettings };
        }
    }

    async saveSettings() {
        try {
            await chrome.storage.local.set({ settings: this.settings });
            this.showSaveStatus('Settings saved successfully', 'success');
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showSaveStatus('Error saving settings', 'error');
        }
    }

    setupEventListeners() {
        // Badge settings
        document.getElementById('badgeFormat').addEventListener('change', (e) => {
            this.settings.badgeFormat = e.target.value;
            this.saveSettings();
        });

        document.getElementById('showBadgeWhenIdle').addEventListener('change', (e) => {
            this.settings.showBadgeWhenIdle = e.target.checked;
            this.saveSettings();
        });

        // Notification settings
        document.getElementById('enableNotifications').addEventListener('change', (e) => {
            this.settings.enableNotifications = e.target.checked;
            this.toggleNotificationSettings(e.target.checked);
            this.saveSettings();
        });

        document.getElementById('notifyBeforeEnd').addEventListener('change', (e) => {
            this.settings.notifyBeforeEnd = e.target.checked;
            this.saveSettings();
        });

        document.getElementById('notificationSound').addEventListener('change', (e) => {
            this.settings.notificationSound = e.target.value;
            this.saveSettings();
        });

        // Task management settings
        document.getElementById('autoStartNext').addEventListener('change', (e) => {
            this.settings.autoStartNext = e.target.checked;
            this.saveSettings();
        });

        document.getElementById('allowOvertime').addEventListener('change', (e) => {
            this.settings.allowOvertime = e.target.checked;
            this.saveSettings();
        });

        document.getElementById('defaultDuration').addEventListener('change', (e) => {
            this.settings.defaultDuration = parseInt(e.target.value);
            this.saveSettings();
        });

        // Data management settings
        document.getElementById('historyRetention').addEventListener('change', (e) => {
            this.settings.historyRetention = parseInt(e.target.value);
            this.saveSettings();
            this.cleanupOldHistory();
        });

        // Data management buttons
        document.getElementById('exportData').addEventListener('click', () => {
            this.exportData();
        });

        document.getElementById('importData').addEventListener('click', () => {
            this.importData();
        });

        document.getElementById('clearData').addEventListener('click', () => {
            this.clearAllData();
        });

        document.getElementById('resetSettings').addEventListener('click', () => {
            this.resetToDefaults();
        });

        // File input for import
        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileImport(e);
        });
    }

    populateForm() {
        // Badge settings
        document.getElementById('badgeFormat').value = this.settings.badgeFormat;
        document.getElementById('showBadgeWhenIdle').checked = this.settings.showBadgeWhenIdle;

        // Notification settings
        document.getElementById('enableNotifications').checked = this.settings.enableNotifications;
        document.getElementById('notifyBeforeEnd').checked = this.settings.notifyBeforeEnd;
        document.getElementById('notificationSound').value = this.settings.notificationSound;

        // Task management settings
        document.getElementById('autoStartNext').checked = this.settings.autoStartNext;
        document.getElementById('allowOvertime').checked = this.settings.allowOvertime;
        document.getElementById('defaultDuration').value = this.settings.defaultDuration;

        // Data management settings
        document.getElementById('historyRetention').value = this.settings.historyRetention;

        // Toggle notification settings based on main toggle
        this.toggleNotificationSettings(this.settings.enableNotifications);
    }

    toggleNotificationSettings(enabled) {
        const notificationInputs = [
            'notifyBeforeEnd',
            'notificationSound'
        ];

        notificationInputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.disabled = !enabled;
                element.parentElement.style.opacity = enabled ? '1' : '0.5';
            }
        });
    }

    async loadStatistics() {
        try {
            const data = await chrome.storage.local.get(['taskHistory', 'tasks']);
            const history = data.taskHistory || [];
            const tasks = data.tasks || [];

            // Calculate statistics
            const totalTasks = history.length;
            const totalTime = this.calculateTotalTime(history);
            const avgAccuracy = this.calculateAverageAccuracy(history);
            const streakDays = this.calculateStreak(history);

            // Update UI
            document.getElementById('totalTasks').textContent = totalTasks;
            document.getElementById('totalTime').textContent = this.formatTime(totalTime);
            document.getElementById('avgAccuracy').textContent = `${avgAccuracy}%`;
            document.getElementById('streakDays').textContent = streakDays;

        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    }

    calculateTotalTime(history) {
        return history.reduce((total, task) => {
            return total + (task.actualDuration || task.duration || 0);
        }, 0);
    }

    calculateAverageAccuracy(history) {
        if (history.length === 0) return 0;

        const accuracies = history
            .filter(task => task.actualDuration && task.duration)
            .map(task => {
                const accuracy = Math.min(task.duration / task.actualDuration, task.actualDuration / task.duration);
                return accuracy * 100;
            });

        if (accuracies.length === 0) return 0;

        const average = accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
        return Math.round(average);
    }

    calculateStreak(history) {
        if (history.length === 0) return 0;

        const today = new Date();
        let streak = 0;
        let currentDate = new Date(today);

        // Check each day backwards from today
        while (true) {
            const dateString = this.formatDateString(currentDate);
            const hasTasksOnDate = history.some(task => {
                if (task.endTime) {
                    const taskDate = this.formatDateString(new Date(task.endTime));
                    return taskDate === dateString;
                }
                return false;
            });

            if (hasTasksOnDate) {
                streak++;
                currentDate.setDate(currentDate.getDate() - 1);
            } else {
                // If today has no tasks, don't break the streak yet
                if (streak === 0 && this.isSameDay(currentDate, today)) {
                    currentDate.setDate(currentDate.getDate() - 1);
                    continue;
                }
                break;
            }
        }

        return streak;
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

    formatDateString(date) {
        return date.toISOString().split('T')[0];
    }

    isSameDay(date1, date2) {
        return date1.toDateString() === date2.toDateString();
    }

    async exportData() {
        try {
            const data = await chrome.storage.local.get(['tasks', 'taskHistory', 'settings']);
            const exportData = {
                tasks: data.tasks || [],
                taskHistory: data.taskHistory || [],
                settings: data.settings || {},
                exportDate: new Date().toISOString(),
                version: '1.0.0'
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
                type: 'application/json' 
            });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `taskloop-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showSaveStatus('Data exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting data:', error);
            this.showSaveStatus('Error exporting data', 'error');
        }
    }

    importData() {
        document.getElementById('fileInput').click();
    }

    async handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const importData = JSON.parse(text);

            // Validate import data
            if (!this.validateImportData(importData)) {
                throw new Error('Invalid backup file format');
            }

            // Confirm with user
            const confirmed = confirm(
                'This will replace all your current data. Are you sure you want to continue?'
            );
            
            if (!confirmed) return;

            // Import data
            await chrome.storage.local.set({
                tasks: importData.tasks || [],
                taskHistory: importData.taskHistory || [],
                settings: { ...this.defaultSettings, ...(importData.settings || {}) }
            });

            // Reload settings and statistics
            await this.loadSettings();
            this.populateForm();
            this.loadStatistics();

            this.showSaveStatus('Data imported successfully', 'success');
        } catch (error) {
            console.error('Error importing data:', error);
            this.showSaveStatus('Error importing data: ' + error.message, 'error');
        }

        // Clear file input
        event.target.value = '';
    }

    validateImportData(data) {
        return (
            typeof data === 'object' &&
            Array.isArray(data.tasks) &&
            Array.isArray(data.taskHistory) &&
            typeof data.settings === 'object'
        );
    }

    async clearAllData() {
        const confirmed = confirm(
            'This will permanently delete all your tasks, history, and settings. This action cannot be undone. Are you sure?'
        );

        if (!confirmed) return;

        const doubleConfirmed = confirm(
            'Are you absolutely sure? This will delete everything!'
        );

        if (!doubleConfirmed) return;

        try {
            await chrome.storage.local.clear();
            
            // Reinitialize with defaults
            this.settings = { ...this.defaultSettings };
            await this.saveSettings();
            
            this.populateForm();
            this.loadStatistics();

            this.showSaveStatus('All data cleared successfully', 'success');
        } catch (error) {
            console.error('Error clearing data:', error);
            this.showSaveStatus('Error clearing data', 'error');
        }
    }

    async resetToDefaults() {
        const confirmed = confirm(
            'This will reset all settings to their default values. Continue?'
        );

        if (!confirmed) return;

        try {
            this.settings = { ...this.defaultSettings };
            await this.saveSettings();
            this.populateForm();

            this.showSaveStatus('Settings reset to defaults', 'success');
        } catch (error) {
            console.error('Error resetting settings:', error);
            this.showSaveStatus('Error resetting settings', 'error');
        }
    }

    async cleanupOldHistory() {
        if (this.settings.historyRetention === 0) return; // Keep forever

        try {
            const data = await chrome.storage.local.get(['taskHistory']);
            const history = data.taskHistory || [];
            
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.settings.historyRetention);
            
            const filteredHistory = history.filter(task => {
                if (!task.endTime) return true;
                return new Date(task.endTime) > cutoffDate;
            });

            if (filteredHistory.length !== history.length) {
                await chrome.storage.local.set({ taskHistory: filteredHistory });
                this.loadStatistics(); // Refresh stats
            }
        } catch (error) {
            console.error('Error cleaning up history:', error);
        }
    }

    showSaveStatus(message, type = 'success') {
        const statusEl = document.getElementById('saveStatus');
        statusEl.textContent = message;
        statusEl.className = `save-status ${type}`;

        // Clear status after 3 seconds
        setTimeout(() => {
            statusEl.textContent = 'Settings saved automatically';
            statusEl.className = 'save-status';
        }, 3000);
    }
}

// Initialize options page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TaskLoopOptions();
});
