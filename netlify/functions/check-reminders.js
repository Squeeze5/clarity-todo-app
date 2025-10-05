// Scheduled Netlify Function to check and send reminders
// This function runs every 5 minutes via Netlify's scheduled functions
// It checks all users' tasks for pending reminders and sends them automatically

const { init } = require('@instantdb/admin');

exports.handler = async (event, context) => {
  console.log('Running scheduled reminder check at:', new Date().toISOString());

  try {
    // Initialize InstantDB Admin API
    // The admin token is kept secret on the server
    const APP_ID = '79b71357-9dae-4fa3-8ee4-ab8a43ffefc0';
    const ADMIN_TOKEN = process.env.INSTANTDB_ADMIN_TOKEN;

    if (!ADMIN_TOKEN) {
      console.error('INSTANTDB_ADMIN_TOKEN not configured');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Admin token not configured' })
      };
    }

    const db = init({
      appId: APP_ID,
      adminToken: ADMIN_TOKEN
    });

    // Query all todos with pending reminders
    const now = Date.now();

    // Get all todos that have:
    // 1. A reminder timestamp set
    // 2. Reminder not sent yet
    // 3. Not completed
    // 4. Reminder time has passed
    const { data } = await db.query({
      todos: {
        $: {
          where: {
            reminderSent: false,
            done: false
          }
        }
      }
    });

    if (!data || !data.todos) {
      console.log('No todos found or query failed');
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'No reminders to process',
          checked: 0
        })
      };
    }

    const todos = data.todos;
    console.log(`Found ${todos.length} todos with reminders not sent`);

    // Filter for tasks where reminder time has passed
    const tasksToRemind = todos.filter(task => {
      return task.reminderTimestamp && task.reminderTimestamp <= now;
    });

    console.log(`${tasksToRemind.length} reminders are due to be sent`);

    let emailsSent = 0;
    let errors = 0;

    // Process each task
    for (const task of tasksToRemind) {
      try {
        // Only send email reminders (browser notifications can't work from server)
        if (task.reminderType === 'email') {
          const success = await sendEmailReminder(task);

          if (success) {
            // Mark reminder as sent
            await db.transact([
              db.tx.todos[task.id].update({ reminderSent: true })
            ]);
            emailsSent++;
            console.log(`Email sent for task: ${task.text}`);
          } else {
            errors++;
            console.error(`Failed to send email for task: ${task.text}`);
          }
        } else if (task.reminderType === 'notification') {
          // Browser notifications can't be sent from server
          // We'll mark it as sent so the user gets it when they next open the app
          // Actually, let's leave it for the client to handle when they open the app
          console.log(`Skipping browser notification for task: ${task.text} (client-side only)`);
        }
      } catch (error) {
        console.error(`Error processing task ${task.id}:`, error);
        errors++;
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Reminder check completed',
        checked: todos.length,
        due: tasksToRemind.length,
        emailsSent,
        errors
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to check reminders',
        details: error.message
      })
    };
  }
};

// Helper function to send email reminder
async function sendEmailReminder(task) {
  try {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      return false;
    }

    // Get user email from the task
    const userEmail = task.userEmail;

    // Validate email exists
    if (!userEmail || userEmail === 'user@example.com') {
      console.error('No valid email address for task:', task.text);
      console.error('Task data:', JSON.stringify(task, null, 2));
      return false;
    }

    // Format the due date/time for the email
    const dueDateStr = new Date(task.dueDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const timeStr = task.dueTime ? ` at ${task.dueTime}` : '';
    const reminderStr = task.reminderTiming ? task.reminderTiming.replace(/(\d+)/, '$1 ') : '';

    // Create the email HTML content
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px 10px 0 0;
            text-align: center;
          }
          .content {
            background: white;
            padding: 30px;
            border: 1px solid #e5e7eb;
            border-radius: 0 0 10px 10px;
          }
          .task-name {
            font-size: 24px;
            font-weight: bold;
            color: #1f2937;
            margin: 20px 0;
          }
          .due-date {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .reminder-info {
            background: #dbeafe;
            padding: 10px 15px;
            border-radius: 5px;
            margin: 15px 0;
            color: #1e40af;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #6b7280;
            font-size: 14px;
          }
          .button {
            display: inline-block;
            background: #3b82f6;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 8px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📋 Clarity Todo Reminder</h1>
        </div>
        <div class="content">
          <p>Hello!</p>
          <p>This is a reminder about your upcoming task:</p>

          <div class="task-name">
            "${task.text}"
          </div>

          <div class="due-date">
            <strong>📅 Due:</strong> ${dueDateStr}${timeStr}
          </div>

          <div class="reminder-info">
            ⏰ You asked to be reminded ${reminderStr}before the due time
          </div>

          <p>Don't forget to complete this task on time!</p>

          <div style="text-align: center;">
            <a href="${process.env.URL || 'https://your-app.netlify.app'}" class="button">
              Open Clarity Todo
            </a>
          </div>
        </div>
        <div class="footer">
          <p>You're receiving this email because you set a reminder in Clarity Todo.</p>
          <p>© 2024 Clarity Todo App</p>
        </div>
      </body>
      </html>
    `;

    // Send email using Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Clarity Todo <onboarding@resend.dev>',
        to: [userEmail],
        subject: `Reminder: ${task.text} is due ${reminderStr ? 'in ' + reminderStr : 'soon'}!`,
        html: emailHtml,
        text: `Reminder: Your task "${task.text}" is due on ${dueDateStr}${timeStr}. You asked to be reminded ${reminderStr}before the due time.`
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend API error:', data);
      return false;
    }

    return true;

  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}
