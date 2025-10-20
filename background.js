// Background service worker for TaskLoop extension
class TaskLoopBackground {
    constructor() {
        this.currentTask = null;
        this.taskTimer = null;
        this.badgeUpdateInterval = null;
        this.init();
    }
}