# TaskFlow — Worker Task Manager

A frontend-only task management website built with HTML, CSS and JavaScript.

## Features
- Login and account registration
- Manager and Worker roles
- Managers can create and assign tasks
- Workers can see assigned tasks
- Task status: Pending, In Progress, Completed
- Workers and managers can reply to tasks
- Team page
- Responsive layout
- Browser localStorage persistence

## Demo login
Manager:
manager@demo.com
123456

Worker:
worker@demo.com
123456

## Run
Open `index.html` in a browser.

## Important for production
This version is a frontend demo. Passwords and data are stored in browser localStorage, so it is NOT suitable for real company use or sensitive information.

For a real multi-user system where different workers can log in from different devices, add a backend such as Node.js/Express with PostgreSQL/MySQL, or Firebase/Supabase. Passwords should be securely hashed and authentication should be handled by the backend/auth provider.
