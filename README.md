# Clarity Todo App

A modern, elegant todo list application with folder organization, task management, and real-time sync powered by InstantDB.

## Features

- ✅ **Folder Organization** - Create custom folders to organize your tasks
- 📝 **Task Management** - Add, edit, delete, and mark tasks as complete
- 🎨 **Color-Coded Folders** - Assign colors to folders for visual organization  
- 🔍 **Global Search** - Find tasks across all folders instantly
- 🎯 **Drag & Drop** - Move tasks between folders with drag and drop
- 🔐 **Magic Link Authentication** - Secure, passwordless login via email
- 💾 **Real-Time Sync** - All data synced instantly with InstantDB
- 👤 **User Isolation** - Each user has their own private workspace

## Quick Start

1. **Install dependencies:**
```bash
npm install
```

2. **Start the development server:**
```bash
npm start
```

3. **Open in browser:**
```
http://localhost:3000
```
Or you can open this link (website is hosted on there) https://clarity-todo.com/

## Technology Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Icons**: Font Awesome
- **Backend**: InstantDB (Real-time database + Auth)
- **Authentication**: Magic link (passwordless) via email
- **Hosting**: Can be deployed to any static hosting service

## Project Structure

```
clarity-todo-app/
├── index.html           # Main HTML structure
├── styles.css           # All styling
├── script-instantdb.js  # Application logic
├── instant.schema.ts    # Database schema
├── instant.perms.ts     # Security permissions
├── build.js            # Build script
├── package.json        # Dependencies
├── lib/                # Generated library folder
└── README.md           # This file
```

## Usage

1. **Sign Up/Sign In**: Enter your email to receive a magic code
2. **Verify**: Enter the 6-digit code sent to your email
3. **Create Folders**: Click "New Folder" to organize tasks
4. **Add Tasks**: Click "Add Task" within any folder
5. **Manage Tasks**: Click to edit, check to complete, drag to move
6. **Search**: Use the search bar to find tasks
7. **Sign Out**: Click sign out button when done

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

MIT
