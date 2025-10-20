# TaskLoop - Chrome Extension

A lightweight task scheduling and tracking Chrome extension with countdown timers and productivity insights.

## Features

### ✅ Task Scheduling
- Add tasks with name, duration (15min - 2hr), and optional start time
- Schedule multiple tasks for any day
- Stack tasks sequentially or set specific start times

### ⏱️ Task Tracking & Timers
- Real-time countdown timers for active tasks
- Pause/resume functionality
- Track actual vs expected duration
- Automatic completion detection

### 🗄️ Local Database Storage
- All data stored locally using Chrome storage API
- Task history organized by date
- Lightweight and fast data access
- Export/import functionality for backup

### 🏷️ Badge Display
- Shows remaining time in MM format (e.g., "25")
- Displays first 3 letters of current task (e.g., "DSA")
- Auto-updates every minute
- Hover tooltip shows full task name + time left
- Color-coded status (Green: running, Yellow: upcoming, Red: overdue)

### 📊 Calendar & History
- Calendar view of completed tasks
- Daily/weekly/monthly summaries
- Task completion statistics
- Time accuracy tracking
- Productivity streaks

### ⚙️ Settings & Customization
- Badge format options
- Notification preferences
- Auto-start next task
- Data retention settings
- Export/import data

## Installation

1. Clone or download this repository
2. Add icon files to the `icons/` directory:
   - `icon16.png` (16x16 pixels)
   - `icon32.png` (32x32 pixels) 
   - `icon48.png` (48x48 pixels)
   - `icon128.png` (128x128 pixels)
3. Open Chrome and go to `chrome://extensions/`
4. Enable "Developer mode" in the top right
5. Click "Load unpacked" and select the extension directory

## Icon Requirements

The extension needs the following icon files in the `icons/` directory:

- **icon16.png**: 16x16 pixels - Used in extension management page
- **icon32.png**: 32x32 pixels - Used in extension management page  
- **icon48.png**: 48x48 pixels - Used in extension management page and notifications
- **icon128.png**: 128x128 pixels - Used in Chrome Web Store and extension management

### Icon Design Guidelines
- Use a clock or timer theme to represent task tracking
- Primary color: #2563eb (blue)
- Secondary color: #10b981 (green) for active states
- Simple, recognizable design that works at small sizes
- Consider using a circular background with clock hands or timer elements

## File Structure

```
TaskLoop-extension/
├── manifest.json              # Extension manifest
├── popup.html                 # Main popup interface
├── options.html               # Settings page
├── background.js              # Service worker for timers and badge
├── scripts/
│   ├── popup.js              # Popup functionality
│   ├── options.js            # Settings page functionality
│   └── database.js           # Data management utilities
├── styles/
│   ├── popup.css             # Popup styles
│   └── options.css           # Settings page styles
├── icons/
│   ├── icon16.png            # 16x16 icon
│   ├── icon32.png            # 32x32 icon
│   ├── icon48.png            # 48x48 icon
│   └── icon128.png           # 128x128 icon
└── README.md                 # This file
```

## Usage

### Adding Tasks
1. Click the extension icon in the toolbar
2. Enter task name (e.g., "DSA Practice")
3. Select duration (15min to 2hr)
4. Optionally set a start time
5. Click "Add Task"

### Starting Tasks
1. Click "Start" button next to any pending task
2. Timer begins countdown immediately
3. Badge shows remaining time and task abbreviation
4. Use pause/complete buttons as needed

### Viewing History
1. Click "History" toggle in the popup
2. Or click the calendar icon for calendar view
3. Navigate between months to see past tasks
4. View completion statistics and time accuracy

### Settings
1. Click the settings icon (⚙️) in the popup header
2. Or right-click extension icon → "Options"
3. Customize badge display, notifications, and data settings
4. Export/import data for backup

## Technical Details

### Storage
- Uses Chrome Storage API for local data persistence
- No external servers or cloud storage required
- Data includes tasks, history, settings, and current state

### Background Processing
- Service worker handles timer updates and badge display
- Efficient battery usage with smart update intervals
- Automatic cleanup of old data based on retention settings

### Permissions
- `storage`: For local data persistence
- `activeTab`: For basic extension functionality
- `alarms`: For timer notifications (future enhancement)

## Development

### Prerequisites
- Chrome browser with Developer mode enabled
- Basic knowledge of HTML, CSS, and JavaScript
- Understanding of Chrome Extension APIs

### Testing
1. Load the extension in developer mode
2. Test all features: adding tasks, starting timers, settings
3. Verify badge updates and notifications work correctly
4. Test data persistence across browser restarts

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use and modify as needed.

## Support

For issues or feature requests, please create an issue in the repository.
