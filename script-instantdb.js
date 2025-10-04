// Override browser confirm to catch any remaining uses
window.originalConfirm = window.confirm;
window.confirm = function(message) {
    console.warn('Browser confirm called with message:', message);
    console.trace('Confirm called from:');
    return false; // Block all browser confirms
};

// InstantDB Configuration
// This is the PUBLIC app ID - it's safe to expose as authentication and permissions protect the data
// The SECRET admin token is never included in client code
const APP_ID = '79b71357-9dae-4fa3-8ee4-ab8a43ffefc0';

// Global database instance
let db = null;

// Initialize InstantDB when available
function initInstantDB() {
    if (window.instant) {
        db = window.instant.init({ 
            appId: APP_ID
        });
        console.log('InstantDB initialized successfully');
        return true;
    }
    return false;
}

// Helper function to get current user from InstantDB
function getCurrentUser() {
    if (db && db._reactor && db._reactor._currentUserCached) {
        const authState = db._reactor._currentUserCached;
        if (authState.user) {
            return authState.user;
        }
    }
    return null;
}

// Helper function to wait for user authentication
async function waitForAuth(maxWaitTime = 3000) {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitTime) {
        const user = getCurrentUser();
        if (user && user.id) {
            return user;
        }
        // Check every 100ms
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    return null;
}

class AuthManager {
    constructor() {
        this.user = null;
        this.isSignUp = false;
        this.initialized = false;
        this.initEventListeners();
    }

    initEventListeners() {
        // Auth form listeners
        this.addListener('auth-submit-btn', 'click', () => this.handleAuthSubmit());
        this.addListener('auth-toggle-btn', 'click', () => this.toggleAuthMode());

        // Enter key support
        this.addListener('auth-email', 'keypress', (e) => {
            if (e.key === 'Enter') this.handleAuthSubmit();
        });
        this.addListener('auth-password', 'keypress', (e) => {
            if (e.key === 'Enter') this.handleAuthSubmit();
        });
        this.addListener('auth-confirm-password', 'keypress', (e) => {
            if (e.key === 'Enter') this.handleAuthSubmit();
        });
    }

    addListener(id, event, handler) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(event, handler);
        } else {
            console.warn(`Element with id '${id}' not found`);
        }
    }

    toggleAuthMode() {
        this.isSignUp = !this.isSignUp;
        const title = document.getElementById('auth-modal-title');
        const submitBtn = document.getElementById('auth-submit-btn');
        const toggleBtn = document.getElementById('auth-toggle-btn');
        const confirmPasswordContainer = document.getElementById('auth-confirm-password-container');

        if (this.isSignUp) {
            title.textContent = 'Sign Up for Clarity Todo';
            submitBtn.textContent = 'Send Magic Code';
            toggleBtn.textContent = 'Already have an account? Sign In';
            confirmPasswordContainer.style.display = 'none'; // InstantDB uses magic codes, no password confirmation needed
        } else {
            title.textContent = 'Sign In to Clarity Todo';
            submitBtn.textContent = 'Send Magic Code';
            toggleBtn.textContent = "Don't have an account? Sign Up";
            confirmPasswordContainer.style.display = 'none';
        }

        // Hide password fields for magic code auth
        const passwordField = document.getElementById('auth-password');
        const confirmPasswordField = document.getElementById('auth-confirm-password');
        passwordField.style.display = 'none';
        confirmPasswordField.style.display = 'none';

        this.clearError();
    }

    async handleAuthSubmit() {
        const email = document.getElementById('auth-email').value.trim();

        // Check if InstantDB is available
        if (!db) {
            this.showError('Database not initialized. Please refresh the page.');
            return;
        }

        // Validation
        if (!email) {
            this.showError('Please enter your email address');
            return;
        }

        if (!this.isValidEmail(email)) {
            this.showError('Please enter a valid email address');
            return;
        }

        this.setLoading(true);
        this.clearError();

        try {
            // Send magic code
            await db.auth.sendMagicCode({ email: email });
            
            this.showSuccess('Magic code sent! Check your email and enter the code below.');
            this.showMagicCodeInput();

        } catch (error) {
            console.error('Auth error:', error);
            
            let errorMessage = 'Failed to send magic code';
            if (error.message) {
                if (error.message.includes('Invalid email')) {
                    errorMessage = 'Please enter a valid email address';
                } else if (error.message.includes('network')) {
                    errorMessage = 'Network error. Please check your internet connection';
                } else {
                    errorMessage = error.message;
                }
            }
            
            this.showError(errorMessage);
        } finally {
            this.setLoading(false);
        }
    }

    showMagicCodeInput() {
        const authForm = document.getElementById('auth-form');
        const submitBtn = document.getElementById('auth-submit-btn');
        
        // Hide email field and show code input
        const emailField = document.getElementById('auth-email');
        emailField.style.display = 'none';
        
        // Create magic code input if it doesn't exist
        let codeInput = document.getElementById('magic-code-input');
        if (!codeInput) {
            codeInput = document.createElement('input');
            codeInput.type = 'text';
            codeInput.id = 'magic-code-input';
            codeInput.placeholder = 'Enter the 6-digit code from your email';
            codeInput.maxLength = 6;
            codeInput.style.marginTop = '1rem';
            codeInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleMagicCodeSubmit();
            });
            
            authForm.insertBefore(codeInput, authForm.querySelector('#auth-error'));
        }
        
        codeInput.style.display = 'block';
        codeInput.focus();
        
        submitBtn.textContent = 'Verify Code';
        submitBtn.onclick = () => this.handleMagicCodeSubmit();
    }

    async handleMagicCodeSubmit() {
        const email = document.getElementById('auth-email').value.trim();
        const code = document.getElementById('magic-code-input').value.trim();

        if (!db) {
            this.showError('Database not initialized. Please refresh the page.');
            return;
        }

        if (!code) {
            this.showError('Please enter the magic code');
            return;
        }

        this.setLoading(true);
        this.clearError();

        try {
            // Sign in with magic code
            const authResult = await db.auth.signInWithMagicCode({ email: email, code: code });
            console.log('Auth result received:', authResult);
            
            // Store the refresh token if available for session persistence
            if (authResult && authResult.refreshToken) {
                localStorage.setItem('instantdb-refresh-token', authResult.refreshToken);
                console.log('Refresh token stored for session persistence');
            }
            
            // After sign in, wait a moment for the user to be set in the reactor
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Get the current user from InstantDB's internal state
            const currentUser = getCurrentUser();
            console.log('Current user from reactor:', currentUser);
            
            let userId = null;
            let userEmail = email;
            
            // Try multiple sources for the user ID
            if (currentUser && currentUser.id) {
                // Best case: user from reactor
                userId = currentUser.id;
                userEmail = currentUser.email || email;
            } else if (authResult) {
                // Fallback: check auth result
                if (authResult.user && authResult.user.id) {
                    userId = authResult.user.id;
                    userEmail = authResult.user.email || email;
                } else if (authResult.id) {
                    userId = authResult.id;
                } else if (authResult.userId) {
                    userId = authResult.userId;
                }
            }
            
            // If still no user ID, generate a deterministic one from email
            if (!userId) {
                console.warn('Could not find user ID, generating from email');
                // Create a simple hash from email for consistency
                userId = 'user_' + email.replace(/[^a-zA-Z0-9]/g, '_');
            }
            
            // Store user info
            this.user = { id: userId, email: userEmail };
            console.log('User authenticated with ID:', userId);
            
            // Success - user is now authenticated
            this.hideAuthModal();
            
            // Initialize the todo app with user info
            window.todoApp = new TodoApp(this.user);
            
        } catch (error) {
            console.error('Magic code verification error:', error);
            
            let errorMessage = 'Invalid or expired code';
            if (error.message) {
                if (error.message.includes('Invalid code')) {
                    errorMessage = 'Invalid code. Please check and try again.';
                } else if (error.message.includes('expired')) {
                    errorMessage = 'Code expired. Please request a new one.';
                } else {
                    errorMessage = error.message;
                }
            }
            
            this.showError(errorMessage);
        } finally {
            this.setLoading(false);
        }
    }

    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    showError(message) {
        const errorEl = document.getElementById('auth-error');
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        errorEl.style.color = '#ef4444';
    }

    showSuccess(message) {
        const errorEl = document.getElementById('auth-error');
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        errorEl.style.color = '#10b981';
    }

    clearError() {
        const errorEl = document.getElementById('auth-error');
        errorEl.style.display = 'none';
    }

    setLoading(loading) {
        const form = document.getElementById('auth-form');
        const submitBtn = document.getElementById('auth-submit-btn');

        if (loading) {
            form.classList.add('auth-loading');
            submitBtn.textContent = 'Loading...';
        } else {
            form.classList.remove('auth-loading');
            submitBtn.textContent = this.isSignUp ? 'Send Magic Code' : 'Send Magic Code';
        }
    }

    hideAuthModal() {
        document.getElementById('auth-modal').classList.remove('active');
    }

    async checkSession() {
        if (!db) {
            console.log('Database not available for session check');
            return false;
        }
        
        try {
            console.log('Checking for existing session...');
            
            // InstantDB automatically persists sessions
            // We just need to wait for it to restore from localStorage/cookies
            const user = await waitForAuth(2000); // Wait up to 2 seconds
            
            if (user && user.id) {
                console.log('Session restored! User:', user);
                this.user = user;
                this.hideAuthModal();
                
                // Initialize the todo app with restored user
                window.todoApp = new TodoApp(this.user);
                return true;
            }
            
            // Try alternative approach: check for refresh token
            const refreshToken = localStorage.getItem('instantdb-refresh-token');
            if (refreshToken) {
                console.log('Found refresh token, attempting manual restore...');
                try {
                    const authResult = await db.auth.signInWithToken({ refreshToken: refreshToken });
                    if (authResult) {
                        // Wait for auth to complete
                        const restoredUser = await waitForAuth(1000);
                        if (restoredUser && restoredUser.id) {
                            console.log('Session restored via token! User:', restoredUser);
                            this.user = restoredUser;
                            this.hideAuthModal();
                            window.todoApp = new TodoApp(this.user);
                            return true;
                        }
                    }
                } catch (tokenError) {
                    console.log('Token expired or invalid, removing...');
                    localStorage.removeItem('instantdb-refresh-token');
                }
            }
            
            console.log('No existing session found');
            return false;
        } catch (error) {
            console.error('Error checking session:', error);
            return false;
        }
    }

    async signOut() {
        await db.auth.signOut();
        this.user = null;
        
        // Clear stored tokens
        localStorage.removeItem('instantdb-refresh-token');
        localStorage.removeItem('instantdb-auth');
        
        // Reload page to reset everything
        window.location.reload();
    }
}

class TodoApp {
    constructor(user) {
        console.log('TodoApp constructor called with user:', user);

        this.currentFolderId = null;
        this.editingTaskId = null;
        this.editingFolderId = null;
        this.draggedTaskId = null;
        this.searchQuery = '';
        this.confirmationCallback = null;
        
        // Store user info
        this.user = user;
        this.userId = user?.id || user?.userId;
        this.userEmail = user?.email || 'user@example.com';
        console.log('Current user ID:', this.userId);
        
        // Initialize reminder checking
        this.reminderInterval = null;
        this.notificationPermissionGranted = false;

        this.initEventListeners();
        this.setupReactiveQueries();
        this.initializeReminders();
    }

    initEventListeners() {
        console.log('Initializing event listeners...');

        // Add sign out button to header
        this.addSignOutButton();

        // Folder management
        this.addListener('add-folder-btn', 'click', () => this.showFolderModal());
        this.addListener('save-folder-btn', 'click', () => this.saveFolder());
        this.addListener('cancel-folder-btn', 'click', () => this.hideFolderModal());
        this.addListener('folder-modal-close', 'click', () => this.hideFolderModal());

        // Task management
        this.addListener('add-task-btn', 'click', () => this.showTaskInput());
        this.addListener('save-task-btn', 'click', () => this.saveTask());
        this.addListener('cancel-task-btn', 'click', () => this.hideTaskInput());
        this.addListener('task-input', 'keypress', (e) => {
            if (e.key === 'Enter') this.saveTask();
            if (e.key === 'Escape') this.hideTaskInput();
        });

        // Task editing modal
        this.addListener('save-edit-task-btn', 'click', () => this.saveEditTask());
        this.addListener('cancel-edit-task-btn', 'click', () => this.hideTaskModal());
        this.addListener('task-modal-close', 'click', () => this.hideTaskModal());
        this.addListener('edit-task-input', 'keypress', (e) => {
            if (e.key === 'Enter') this.saveEditTask();
            if (e.key === 'Escape') this.hideTaskModal();
        });

        // Global search functionality
        this.addListener('global-search-input', 'input', (e) => this.handleGlobalSearch(e.target.value));
        this.addListener('global-clear-search-btn', 'click', () => this.clearGlobalSearch());

        // Confirmation modal
        this.addListener('confirm-yes-btn', 'click', () => this.handleConfirmationResponse(true));
        this.addListener('confirm-no-btn', 'click', () => this.handleConfirmationResponse(false));

        // Color picker
        document.querySelectorAll('.color-option').forEach(option => {
            option.addEventListener('click', () => this.selectColor(option));
        });

        // Modal backdrop clicks
        this.addListener('folder-modal', 'click', (e) => {
            if (e.target === e.currentTarget) this.hideFolderModal();
        });
        this.addListener('task-modal', 'click', (e) => {
            if (e.target === e.currentTarget) this.hideTaskModal();
        });
        this.addListener('confirmation-modal', 'click', (e) => {
            if (e.target === e.currentTarget) this.handleConfirmationResponse(false);
        });

        // Date/time and reminder event listeners
        this.addListener('task-due-date', 'change', (e) => this.handleDateChange(e, 'task'));
        this.addListener('edit-task-due-date', 'change', (e) => this.handleDateChange(e, 'edit'));
        this.addListener('task-reminder-type', 'change', (e) => this.handleReminderTypeChange(e, 'task'));
        this.addListener('edit-task-reminder-type', 'change', (e) => this.handleReminderTypeChange(e, 'edit'));
        
        console.log('Event listeners initialized');
    }
    
    // Notification and Reminder System
    async initializeReminders() {
        // Check notification permission status
        if ('Notification' in window) {
            this.notificationPermissionGranted = Notification.permission === 'granted';
        }
        
        // Start checking for reminders every minute
        this.startReminderCheck();
    }
    
    startReminderCheck() {
        // Clear any existing interval
        if (this.reminderInterval) {
            clearInterval(this.reminderInterval);
        }
        
        // Check for reminders every 30 seconds
        this.reminderInterval = setInterval(() => {
            this.checkAndSendReminders();
        }, 30000); // 30 seconds
        
        // Also check immediately
        this.checkAndSendReminders();
    }
    
    async checkAndSendReminders() {
        if (!this.tasks) return;
        
        const now = Date.now();
        const tasksToUpdate = [];
        
        for (const task of this.tasks) {
            // Skip if no reminder is set or already sent or task is done
            if (!task.reminderTimestamp || task.reminderSent || task.done) continue;
            
            // Check if it's time to send the reminder
            if (task.reminderTimestamp <= now) {
                console.log('Sending reminder for task:', task.text);
                
                // Send the appropriate reminder
                if (task.reminderType === 'notification') {
                    await this.sendNotificationReminder(task);
                } else if (task.reminderType === 'email') {
                    await this.sendEmailReminder(task);
                }
                
                // Mark reminder as sent
                tasksToUpdate.push(task.id);
            }
        }
        
        // Update tasks to mark reminders as sent
        if (tasksToUpdate.length > 0) {
            const operations = tasksToUpdate.map(taskId => 
                db.tx.todos[taskId].update({ reminderSent: true })
            );
            
            try {
                await db.transact(operations);
            } catch (error) {
                console.error('Error updating reminder status:', error);
            }
        }
    }
    
    async sendNotificationReminder(task) {
        // First check if we have permission
        if (!('Notification' in window)) {
            console.log('Browser does not support notifications');
            return;
        }
        
        if (Notification.permission === 'default') {
            // Request permission
            const permission = await Notification.requestPermission();
            this.notificationPermissionGranted = permission === 'granted';
        }
        
        if (Notification.permission === 'granted') {
            const dueDate = new Date(task.dueDate);
            const timeStr = task.dueTime || '';
            const dueDateStr = dueDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: dueDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
            });
            
            const notification = new Notification('Task Reminder: Clarity Todo', {
                body: `"${task.text}" is due on ${dueDateStr}${timeStr ? ' at ' + timeStr : ''}`,
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                tag: `task-${task.id}`,
                requireInteraction: true
            });
            
            notification.onclick = () => {
                window.focus();
                notification.close();
                // Switch to the task's folder
                if (task.folder_id) {
                    this.switchFolder(task.folder_id);
                }
            };
        }
    }
    
    async sendEmailReminder(task) {
        // For email reminders, we'll use EmailJS (free service)
        // First, the user needs to sign up at https://www.emailjs.com/
        // For now, we'll just log it
        console.log('Email reminder would be sent for task:', task.text);
        console.log('To enable email reminders, integrate with EmailJS or another email service');
        
        // If you want to implement EmailJS:
        // 1. Sign up at https://www.emailjs.com/
        // 2. Create an email service and template
        // 3. Include EmailJS SDK: <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>
        // 4. Use the following code:
        /*
        try {
            await emailjs.send('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', {
                to_email: this.userEmail,
                task_name: task.text,
                due_date: new Date(task.dueDate).toLocaleString(),
                message: `Your task "${task.text}" is coming up soon!`
            });
            console.log('Email sent successfully');
        } catch (error) {
            console.error('Failed to send email:', error);
        }
        */
    }
    
    handleDateChange(e, context) {
        const dateValue = e.target.value;
        const reminderSettings = context === 'task' ? 
            document.getElementById('reminder-settings') : 
            document.getElementById('edit-reminder-settings');
        
        if (dateValue) {
            // Show reminder settings when a date is selected
            reminderSettings.style.display = 'block';
        } else {
            // Hide reminder settings when date is cleared
            reminderSettings.style.display = 'none';
        }
    }
    
    handleReminderTypeChange(e, context) {
        const reminderType = e.target.value;
        const timingField = context === 'task' ? 
            document.getElementById('reminder-timing-field') : 
            document.getElementById('edit-reminder-timing-field');
        
        if (reminderType !== 'none') {
            timingField.style.display = 'block';
            
            // Request notification permission if needed
            if (reminderType === 'notification' && 'Notification' in window) {
                if (Notification.permission === 'default') {
                    Notification.requestPermission().then(permission => {
                        this.notificationPermissionGranted = permission === 'granted';
                        if (permission === 'denied') {
                            alert('Browser notifications are blocked. Please enable them in your browser settings to receive reminders.');
                            // Reset to none
                            e.target.value = 'none';
                            timingField.style.display = 'none';
                        }
                    });
                } else if (Notification.permission === 'denied') {
                    alert('Browser notifications are blocked. Please enable them in your browser settings to receive reminders.');
                    e.target.value = 'none';
                    timingField.style.display = 'none';
                }
            }
        } else {
            timingField.style.display = 'none';
        }
    }
    
    calculateReminderTimestamp(dueDate, dueTime, reminderTiming) {
        if (!dueDate || !reminderTiming || reminderTiming === 'none') {
            return null;
        }
        
        // Start with the due date/time
        let reminderTime = dueDate;
        
        // If there's a specific time, use it
        if (dueTime) {
            const [hours, minutes] = dueTime.split(':').map(Number);
            const tempDate = new Date(dueDate);
            tempDate.setHours(hours, minutes, 0, 0);
            reminderTime = tempDate.getTime();
        }
        
        // Calculate the reminder time based on the timing setting
        const timingMap = {
            '10min': 10 * 60 * 1000,
            '30min': 30 * 60 * 1000,
            '1hour': 60 * 60 * 1000,
            '2hours': 2 * 60 * 60 * 1000,
            '1day': 24 * 60 * 60 * 1000
        };
        
        const offset = timingMap[reminderTiming] || 0;
        return reminderTime - offset;
    }

    setupReactiveQueries() {
        // Set up reactive queries for real-time updates
        console.log('Setting up reactive queries...');
        console.log('Querying folders for user:', this.userId);
        
        // Query only folders and todos belonging to the current user
        db.subscribeQuery({ 
            folders: {
                $: {
                    where: {
                        userId: this.userId
                    }
                },
                todos: {
                    $: {
                        where: {
                            userId: this.userId
                        }
                    }
                } 
            } 
        }, (resp) => {
            if (resp.error) {
                console.error('Error querying folders:', resp.error);
                return;
            }
            
            this.handleFoldersUpdate(resp.data.folders || []);
        });
        
        console.log('Reactive queries set up');
    }

    handleFoldersUpdate(folders) {
        console.log('Folders updated:', folders);
        
        this.folders = folders;
        
        // Extract all todos from all folders
        this.tasks = [];
        folders.forEach(folder => {
            if (folder.todos) {
                folder.todos.forEach(todo => {
                    this.tasks.push({
                        ...todo,
                        folder_id: folder.id
                    });
                });
            }
        });
        
        // If no folders exist, create default Inbox folder
        if (this.folders.length === 0) {
            console.log('No folders found, creating default Inbox folder...');
            this.createDefaultFolder();
            return;
        }
        
        // Set current folder to default Inbox or first folder
        if (!this.currentFolderId) {
            const defaultFolder = this.folders.find(f => f.isDefault);
            this.currentFolderId = defaultFolder ? defaultFolder.id : this.folders[0]?.id;
        }
        
        this.render();
    }

    async createDefaultFolder() {
        try {
            const folderId = window.crypto.randomUUID();
            await db.transact([
                db.tx.folders[folderId].update({
                    text: 'Inbox',
                    color: '#3b82f6',
                    isDefault: true,
                    userId: this.userId
                })
            ]);
            console.log('Default folder created for user:', this.userId);
        } catch (error) {
            console.error('Error creating default folder:', error);
        }
    }

    addSignOutButton() {
        const headerActions = document.querySelector('.header-actions');
        const signOutBtn = document.createElement('button');
        signOutBtn.className = 'btn btn-secondary';
        signOutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Sign Out';
        signOutBtn.addEventListener('click', () => {
            if (window.authManager) {
                window.authManager.signOut();
            }
        });
        headerActions.appendChild(signOutBtn);
    }

    addListener(id, event, handler) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(event, handler);
        } else {
            console.warn(`Element with id '${id}' not found`);
        }
    }

    // Confirmation modal system
    showConfirmation(title, message) {
        console.log('showConfirmation called with:', title, message);
        return new Promise((resolve) => {
            this.confirmationCallback = resolve;
            const titleEl = document.getElementById('confirmation-title');
            const messageEl = document.getElementById('confirmation-message');
            const modalEl = document.getElementById('confirmation-modal');

            if (!titleEl || !messageEl || !modalEl) {
                console.error('Confirmation modal elements not found');
                resolve(false);
                return;
            }

            titleEl.textContent = title;
            messageEl.textContent = message;
            modalEl.classList.add('active');
            console.log('Confirmation modal should now be visible');
        });
    }

    handleConfirmationResponse(confirmed) {
        console.log('Confirmation response:', confirmed);
        const modalEl = document.getElementById('confirmation-modal');
        if (modalEl) {
            modalEl.classList.remove('active');
        }
        if (this.confirmationCallback) {
            this.confirmationCallback(confirmed);
            this.confirmationCallback = null;
        }
    }

    // Global search functionality
    handleGlobalSearch(query) {
        this.searchQuery = query.toLowerCase().trim();
        const clearBtn = document.getElementById('global-clear-search-btn');

        if (this.searchQuery) {
            clearBtn.style.display = 'block';
        } else {
            clearBtn.style.display = 'none';
        }

        this.renderTasks();
    }

    clearGlobalSearch() {
        document.getElementById('global-search-input').value = '';
        this.searchQuery = '';
        document.getElementById('global-clear-search-btn').style.display = 'none';
        this.renderTasks();
    }

    // Folder Management
    showFolderModal(folderId = null) {
        this.editingFolderId = folderId;
        const modal = document.getElementById('folder-modal');
        const title = document.getElementById('folder-modal-title');
        const input = document.getElementById('folder-name-input');

        if (folderId) {
            const folder = this.folders.find(f => f.id === folderId);
            title.textContent = 'Edit Folder';
            input.value = folder.text;
            this.selectColorByValue(folder.color);
        } else {
            title.textContent = 'New Folder';
            input.value = '';
            this.selectColorByValue('#3b82f6');
        }

        modal.classList.add('active');
        input.focus();
    }

    hideFolderModal() {
        document.getElementById('folder-modal').classList.remove('active');
        this.editingFolderId = null;
    }

    selectColor(colorElement) {
        document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
        colorElement.classList.add('selected');
    }

    selectColorByValue(color) {
        document.querySelectorAll('.color-option').forEach(el => {
            el.classList.remove('selected');
            if (el.dataset.color === color) {
                el.classList.add('selected');
            }
        });
    }

    async saveFolder() {
        const nameInput = document.getElementById('folder-name-input');
        const name = nameInput.value.trim();
        const selectedColor = document.querySelector('.color-option.selected');

        if (!name) {
            nameInput.focus();
            return;
        }

        const color = selectedColor ? selectedColor.dataset.color : '#3b82f6';

        try {
            if (this.editingFolderId) {
                // Update existing folder
                await db.transact([
                    db.tx.folders[this.editingFolderId].update({
                        text: name,
                        color: color
                    })
                ]);
            } else {
                // Create new folder
                const folderId = window.crypto.randomUUID();
                await db.transact([
                    db.tx.folders[folderId].update({
                        text: name,
                        color: color,
                        isDefault: false,
                        userId: this.userId
                    })
                ]);
            }

            this.hideFolderModal();

        } catch (error) {
            console.error('Error saving folder:', error);
        }
    }

    async deleteFolder(folderId) {
        const folder = this.folders.find(f => f.id === folderId);

        if (folder.isDefault) {
            console.log('Cannot delete default folder');
            return;
        }

        const confirmed = await this.showConfirmation(
            'Delete Folder',
            `Are you sure you want to delete "${folder.text}"? All tasks in this folder will be moved to Inbox.`
        );

        if (!confirmed) return;

        try {
            // Find default folder
            const defaultFolder = this.folders.find(f => f.isDefault);
            
            // Move all tasks to default folder by recreating them
            const folderTasks = this.tasks.filter(t => t.folder_id === folderId);
            
            // Create operations to delete old tasks and recreate in default folder
            const operations = [];
            
            // Reference the default folder entity first
            if (defaultFolder && folderTasks.length > 0) {
                operations.push(db.tx.folders[defaultFolder.id].update({}));
            }
            
            folderTasks.forEach(task => {
                const newTaskId = window.crypto.randomUUID();
                // Delete old task
                operations.push(db.tx.todos[task.id].delete());
                // Create new task in default folder with all fields including dueDate
                const taskData = {
                    text: task.text,
                    done: task.done,
                    createdAt: task.createdAt,
                    userId: this.userId
                };
                if (task.dueDate) {
                    taskData.dueDate = task.dueDate;
                }
                operations.push(
                    db.tx.todos[newTaskId].update(taskData).link({ folder: defaultFolder.id })
                );
            });
            
            // Delete the folder and move tasks in one transaction
            await db.transact([
                ...operations,
                db.tx.folders[folderId].delete()
            ]);

            // Switch to default folder if we were viewing the deleted folder
            if (this.currentFolderId === folderId) {
                this.currentFolderId = defaultFolder?.id || this.folders[0]?.id;
            }

        } catch (error) {
            console.error('Error deleting folder:', error);
        }
    }

    switchFolder(folderId) {
        this.currentFolderId = folderId;
        this.renderFolders();
        this.renderTasks();

        const folder = this.folders.find(f => f.id === folderId);
        const titleEl = document.getElementById('current-folder-title');
        if (titleEl && folder) {
            titleEl.textContent = folder.text;
        }
    }

    // Task Management
    showTaskInput() {
        const container = document.getElementById('task-input-container');
        const input = document.getElementById('task-input');

        container.style.display = 'block';
        input.focus();
    }

    hideTaskInput() {
        const container = document.getElementById('task-input-container');
        const input = document.getElementById('task-input');
        const dueDateInput = document.getElementById('task-due-date');
        const dueTimeInput = document.getElementById('task-due-time');
        const reminderTypeInput = document.getElementById('task-reminder-type');
        const reminderTimingInput = document.getElementById('task-reminder-timing');
        const reminderSettings = document.getElementById('reminder-settings');
        const reminderTimingField = document.getElementById('reminder-timing-field');

        container.style.display = 'none';
        input.value = '';
        if (dueDateInput) dueDateInput.value = '';
        if (dueTimeInput) dueTimeInput.value = '';
        if (reminderTypeInput) reminderTypeInput.value = 'none';
        if (reminderTimingInput) reminderTimingInput.value = '1hour';
        if (reminderSettings) reminderSettings.style.display = 'none';
        if (reminderTimingField) reminderTimingField.style.display = 'none';
    }

    async saveTask() {
        const input = document.getElementById('task-input');
        const dueDateInput = document.getElementById('task-due-date');
        const dueTimeInput = document.getElementById('task-due-time');
        const reminderTypeInput = document.getElementById('task-reminder-type');
        const reminderTimingInput = document.getElementById('task-reminder-timing');
        const text = input.value.trim();

        if (!text || !this.currentFolderId) {
            input.focus();
            return;
        }

        try {
            const todoId = window.crypto.randomUUID();
            const taskData = {
                text: text,
                done: false,
                createdAt: Date.now(),
                userId: this.userId,
                reminderSent: false
            };

            // Add due date if provided
            if (dueDateInput && dueDateInput.value) {
                // Parse the date string as local time (not UTC)
                const [year, month, day] = dueDateInput.value.split('-').map(Number);
                const dueDate = new Date(year, month - 1, day); // month is 0-indexed
                
                // Add time if provided
                if (dueTimeInput && dueTimeInput.value) {
                    const [hours, minutes] = dueTimeInput.value.split(':').map(Number);
                    dueDate.setHours(hours, minutes, 0, 0);
                    taskData.dueTime = dueTimeInput.value;
                } else {
                    dueDate.setHours(23, 59, 59, 999); // Set to end of day if no time specified
                }
                
                taskData.dueDate = dueDate.getTime();
                
                // Add reminder settings if provided
                if (reminderTypeInput && reminderTypeInput.value !== 'none') {
                    taskData.reminderType = reminderTypeInput.value;
                    taskData.reminderTiming = reminderTimingInput.value || '1hour';
                    
                    // Calculate when to send the reminder
                    taskData.reminderTimestamp = this.calculateReminderTimestamp(
                        taskData.dueDate,
                        taskData.dueTime,
                        taskData.reminderTiming
                    );
                }
            }

            await db.transact([
                db.tx.folders[this.currentFolderId].update({}),  // Reference the folder entity
                db.tx.todos[todoId].update(taskData).link({ folder: this.currentFolderId })
            ]);

            this.hideTaskInput();

        } catch (error) {
            console.error('Error saving task:', error);
        }
    }

    showTaskModal(taskId) {
        this.editingTaskId = taskId;
        const task = this.tasks.find(t => t.id === taskId);

        if (!task) return;

        const modal = document.getElementById('task-modal');
        const input = document.getElementById('edit-task-input');
        const dueDateInput = document.getElementById('edit-task-due-date');
        const dueTimeInput = document.getElementById('edit-task-due-time');
        const reminderTypeInput = document.getElementById('edit-task-reminder-type');
        const reminderTimingInput = document.getElementById('edit-task-reminder-timing');
        const reminderSettings = document.getElementById('edit-reminder-settings');
        const reminderTimingField = document.getElementById('edit-reminder-timing-field');

        input.value = task.text;
        
        // Set due date if it exists
        if (dueDateInput && task.dueDate) {
            const date = new Date(task.dueDate);
            // Format as YYYY-MM-DD for date input using local date
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            dueDateInput.value = dateStr;
            
            // Show reminder settings since date is set
            if (reminderSettings) reminderSettings.style.display = 'block';
        } else if (dueDateInput) {
            dueDateInput.value = '';
            if (reminderSettings) reminderSettings.style.display = 'none';
        }
        
        // Set time if it exists
        if (dueTimeInput) {
            dueTimeInput.value = task.dueTime || '';
        }
        
        // Set reminder settings
        if (reminderTypeInput) {
            reminderTypeInput.value = task.reminderType || 'none';
            if (task.reminderType && task.reminderType !== 'none') {
                if (reminderTimingField) reminderTimingField.style.display = 'block';
            } else {
                if (reminderTimingField) reminderTimingField.style.display = 'none';
            }
        }
        
        if (reminderTimingInput) {
            reminderTimingInput.value = task.reminderTiming || '1hour';
        }
        
        modal.classList.add('active');
        input.focus();
        input.select();
    }

    hideTaskModal() {
        document.getElementById('task-modal').classList.remove('active');
        this.editingTaskId = null;
    }

    async saveEditTask() {
        const input = document.getElementById('edit-task-input');
        const dueDateInput = document.getElementById('edit-task-due-date');
        const dueTimeInput = document.getElementById('edit-task-due-time');
        const reminderTypeInput = document.getElementById('edit-task-reminder-type');
        const reminderTimingInput = document.getElementById('edit-task-reminder-timing');
        const text = input.value.trim();

        if (!text || !this.editingTaskId) {
            input.focus();
            return;
        }

        try {
            const updateData = { text: text };
            
            // Handle due date and time
            if (dueDateInput) {
                if (dueDateInput.value) {
                    // Parse the date string as local time
                    const [year, month, day] = dueDateInput.value.split('-').map(Number);
                    const dueDate = new Date(year, month - 1, day);
                    
                    // Add time if provided
                    if (dueTimeInput && dueTimeInput.value) {
                        const [hours, minutes] = dueTimeInput.value.split(':').map(Number);
                        dueDate.setHours(hours, minutes, 0, 0);
                        updateData.dueTime = dueTimeInput.value;
                    } else {
                        dueDate.setHours(23, 59, 59, 999);
                        updateData.dueTime = null;
                    }
                    
                    updateData.dueDate = dueDate.getTime();
                    
                    // Handle reminder settings
                    if (reminderTypeInput && reminderTypeInput.value !== 'none') {
                        updateData.reminderType = reminderTypeInput.value;
                        updateData.reminderTiming = reminderTimingInput.value || '1hour';
                        updateData.reminderSent = false; // Reset reminder sent status
                        
                        // Calculate when to send the reminder
                        updateData.reminderTimestamp = this.calculateReminderTimestamp(
                            updateData.dueDate,
                            updateData.dueTime,
                            updateData.reminderTiming
                        );
                    } else {
                        // Clear reminder settings
                        updateData.reminderType = null;
                        updateData.reminderTiming = null;
                        updateData.reminderTimestamp = null;
                        updateData.reminderSent = null;
                    }
                } else {
                    // Clear all date/time/reminder fields
                    updateData.dueDate = null;
                    updateData.dueTime = null;
                    updateData.reminderType = null;
                    updateData.reminderTiming = null;
                    updateData.reminderTimestamp = null;
                    updateData.reminderSent = null;
                }
            }
            
            await db.transact([
                db.tx.todos[this.editingTaskId].update(updateData)
            ]);

            this.hideTaskModal();

        } catch (error) {
            console.error('Error saving task edit:', error);
        }
    }

    async toggleTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        try {
            await db.transact([
                db.tx.todos[taskId].update({
                    done: !task.done
                })
            ]);
        } catch (error) {
            console.error('Error toggling task:', error);
        }
    }

    async deleteTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        const confirmed = await this.showConfirmation(
            'Delete Task',
            'Are you sure you want to delete this task?'
        );

        if (!confirmed) return;

        try {
            await db.transact([
                db.tx.todos[taskId].delete()
            ]);
        } catch (error) {
            console.error('Error deleting task:', error);
        }
    }

    // Drag and Drop
    handleDragStart(e, taskId) {
        this.draggedTaskId = taskId;
        e.dataTransfer.effectAllowed = 'move';
        e.target.classList.add('dragging');
    }

    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        this.draggedTaskId = null;

        // Remove drag-over class from all folders
        document.querySelectorAll('.folder-item').forEach(folder => {
            folder.classList.remove('drag-over');
        });
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    handleDragEnter(e, folderId) {
        e.preventDefault();
        if (this.draggedTaskId && folderId !== this.currentFolderId) {
            e.currentTarget.classList.add('drag-over');
        }
    }

    handleDragLeave(e) {
        e.currentTarget.classList.remove('drag-over');
    }

    async handleDrop(e, folderId) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');

        console.log('handleDrop called with folderId:', folderId, 'type:', typeof folderId);
        console.log('Current draggedTaskId:', this.draggedTaskId);
        console.log('Current folderId:', this.currentFolderId);

        // Capture the dragged task ID immediately before it gets cleared
        const draggedTaskId = this.draggedTaskId;
        
        if (!draggedTaskId || !folderId || folderId === this.currentFolderId) {
            console.log('Early return - missing draggedTaskId or folderId, or same folder');
            return;
        }

        const task = this.tasks.find(t => t.id === draggedTaskId);
        const targetFolder = this.folders.find(f => f.id === folderId);

        console.log('Found task:', task);
        console.log('Found target folder:', targetFolder);

        if (!task || !targetFolder || !targetFolder.id) {
            console.error('Missing task or target folder', { task, targetFolder });
            return;
        }

        const confirmed = await this.showConfirmation(
            'Move Task',
            `Move "${task.text}" to "${targetFolder.text}"?`
        );

        if (!confirmed) return;

        try {
            console.log('Attempting to move task');
            console.log('Task ID:', draggedTaskId);  // Use captured value
            console.log('Target Folder ID:', targetFolder.id);
            console.log('Folder ID type:', typeof targetFolder.id);
            
            // Ensure we have valid UUIDs
            if (!targetFolder.id || typeof targetFolder.id !== 'string') {
                throw new Error(`Invalid folder ID: ${targetFolder.id}`);
            }
            
            if (!draggedTaskId || typeof draggedTaskId !== 'string') {
                throw new Error(`Invalid task ID: ${draggedTaskId}`);
            }
            
            // In InstantDB, we need to delete the task and recreate it with the new folder link
            const taskData = {
                text: task.text || '',
                done: task.done === true,
                createdAt: task.createdAt || Date.now(),
                userId: this.userId
            };
            
            // Preserve due date if it exists
            if (task.dueDate) {
                taskData.dueDate = task.dueDate;
            }
            
            // Create new task ID
            const newTaskId = window.crypto.randomUUID();
            
            console.log('New task ID:', newTaskId);
            console.log('Task data:', taskData);
            
            // First attempt: Just like saveTask which works
            const operations = [
                db.tx.todos[draggedTaskId].delete(),  // Use captured value
                db.tx.folders[targetFolder.id].update({}),  // Reference the folder
                db.tx.todos[newTaskId]
                    .update(taskData)
                    .link({ folder: targetFolder.id })
            ];
            
            console.log('Executing transaction...');
            await db.transact(operations);
            
            console.log(`Task successfully moved from folder ${task.folder_id} to ${targetFolder.id}`);
            
        } catch (error) {
            console.error('Error moving task:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                folderId: folderId,
                targetFolderId: targetFolder?.id,
                draggedTaskId: draggedTaskId  // Log the captured value
            });
        }
    }

    // Rendering Methods
    render() {
        this.renderFolders();
        this.renderTasks();
    }

    renderFolders() {
        if (!this.folders) return;
        
        const folderList = document.getElementById('folder-list');
        if (!folderList) return;

        folderList.innerHTML = '';

        this.folders.forEach(folder => {
            const taskCount = this.tasks.filter(t => t.folder_id === folder.id).length;

            const folderEl = document.createElement('div');
            folderEl.className = `folder-item ${folder.id === this.currentFolderId ? 'active' : ''}`;
            folderEl.dataset.folderId = folder.id;

            // Apply color styling
            if (!folder.isDefault && folder.id !== this.currentFolderId) {
                folderEl.style.borderLeft = `4px solid ${folder.color}`;
                folderEl.style.paddingLeft = 'calc(1rem - 4px)';
            }

            if (folder.id === this.currentFolderId) {
                folderEl.style.background = folder.color;
                folderEl.style.color = 'white';
            }

            const icon = folder.isDefault ? 'fas fa-inbox' : 'fas fa-folder';

            folderEl.innerHTML = `
                <i class="${icon}"></i>
                <span>${folder.text}</span>
                <span class="task-count">${taskCount}</span>
                ${!folder.isDefault ? `
                    <div class="folder-actions">
                        <button class="folder-action-btn" onclick="todoApp.showFolderModal('${folder.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="folder-action-btn" onclick="todoApp.deleteFolder('${folder.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                ` : ''}
            `;

            // Click to switch folders
            folderEl.addEventListener('click', (e) => {
                if (!e.target.closest('.folder-actions')) {
                    this.switchFolder(folder.id);
                }
            });

            // Drag and drop handlers
            folderEl.addEventListener('dragover', (e) => this.handleDragOver(e));
            folderEl.addEventListener('dragenter', (e) => this.handleDragEnter(e, folder.id));
            folderEl.addEventListener('dragleave', (e) => this.handleDragLeave(e));
            folderEl.addEventListener('drop', (e) => this.handleDrop(e, folder.id));

            folderList.appendChild(folderEl);
        });
    }

    renderTasks() {
        if (!this.tasks) return;
        
        const taskList = document.getElementById('task-list');
        if (!taskList) return;

        // Filter tasks by current folder and search query
        let filteredTasks = this.tasks.filter(task => task.folder_id === this.currentFolderId);

        if (this.searchQuery) {
            filteredTasks = filteredTasks.filter(task =>
                task.text.toLowerCase().includes(this.searchQuery)
            );
        }
        
        // Sort tasks: overdue first, then by due date, then by creation date
        filteredTasks.sort((a, b) => {
            const now = Date.now();
            const aOverdue = a.dueDate && !a.done && a.dueDate < now;
            const bOverdue = b.dueDate && !b.done && b.dueDate < now;
            
            // Overdue tasks come first
            if (aOverdue && !bOverdue) return -1;
            if (!aOverdue && bOverdue) return 1;
            
            // Then sort by due date (earliest first)
            if (a.dueDate && b.dueDate) {
                return a.dueDate - b.dueDate;
            }
            if (a.dueDate && !b.dueDate) return -1;
            if (!a.dueDate && b.dueDate) return 1;
            
            // Finally sort by creation date
            return b.createdAt - a.createdAt;
        });

        if (filteredTasks.length === 0) {
            const emptyMessage = this.searchQuery
                ? `No tasks found matching "${this.searchQuery}"`
                : 'No tasks yet';

            taskList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clipboard-list"></i>
                    <h3>${emptyMessage}</h3>
                    <p>${this.searchQuery ? 'Try a different search term' : 'Click "Add Task" to create your first task'}</p>
                </div>
            `;
            return;
        }

        taskList.innerHTML = '';

        filteredTasks.forEach(task => {
            const taskEl = document.createElement('div');
            taskEl.className = `task-item ${task.done ? 'completed' : ''}`;
            taskEl.draggable = true;

            // Check if task is overdue or due soon
            let dueDateHTML = '';
            if (task.dueDate) {
                const now = Date.now();
                const dueDate = new Date(task.dueDate);
                const isOverdue = !task.done && task.dueDate < now;
                const isDueSoon = !task.done && !isOverdue && (task.dueDate - now) < 86400000; // Less than 24 hours
                
                const dateStr = dueDate.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    year: dueDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                });
                
                let className = 'task-due-date';
                let statusText = '';
                
                if (isOverdue) {
                    className += ' overdue';
                    statusText = ' (Overdue)';
                } else if (isDueSoon) {
                    className += ' due-soon';
                    statusText = ' (Due Soon)';
                }
                
                // Add time if specified
                let timeHTML = '';
                if (task.dueTime) {
                    timeHTML = `<span class="time-badge">${task.dueTime}</span>`;
                }
                
                // Add reminder indicator
                let reminderHTML = '';
                if (task.reminderType && task.reminderType !== 'none') {
                    const reminderIcon = task.reminderType === 'notification' ? 'fa-bell' : 'fa-envelope';
                    const reminderStatus = task.reminderSent ? ' (Sent)' : '';
                    reminderHTML = `
                        <span class="task-reminder-indicator">
                            <i class="fas ${reminderIcon}"></i>
                            ${task.reminderTiming}${reminderStatus}
                        </span>
                    `;
                }
                
                dueDateHTML = `
                    <div class="${className}">
                        <i class="far fa-calendar"></i>
                        <span>Due ${dateStr}${statusText}</span>
                        ${timeHTML}
                        ${reminderHTML}
                    </div>
                `;
            }

            taskEl.innerHTML = `
                <div class="drag-handle">
                    <i class="fas fa-grip-vertical"></i>
                </div>
                <div class="task-checkbox ${task.done ? 'checked' : ''}" onclick="todoApp.toggleTask('${task.id}')">
                    ${task.done ? '<i class="fas fa-check"></i>' : ''}
                </div>
                <div class="task-info">
                    <div class="task-text">${task.text}</div>
                    ${dueDateHTML}
                </div>
                <div class="task-actions">
                    <button class="task-action-btn edit" onclick="todoApp.showTaskModal('${task.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="task-action-btn delete" onclick="todoApp.deleteTask('${task.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;

            // Drag handlers
            taskEl.addEventListener('dragstart', (e) => this.handleDragStart(e, task.id));
            taskEl.addEventListener('dragend', (e) => this.handleDragEnd(e));

            taskList.appendChild(taskEl);
        });
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing auth manager...');

    // Wait for InstantDB to be available
    let attempts = 0;
    const maxAttempts = 50; // Wait up to 5 seconds
    
    const waitForInstantDB = () => {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                attempts++;
                if (initInstantDB()) {
                    clearInterval(checkInterval);
                    resolve(true);
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    console.error('InstantDB failed to load after 5 seconds');
                    resolve(false);
                }
            }, 100);
        });
    };

    const dbInitialized = await waitForInstantDB();
    if (!dbInitialized) {
        console.error('Failed to initialize InstantDB');
        return;
    }

    window.authManager = new AuthManager();

    // Check for existing session
    const hasSession = await window.authManager.checkSession();
    if (!hasSession) {
        console.log('No active session found, showing auth modal');
        // Auth modal is already visible by default
    }
});
