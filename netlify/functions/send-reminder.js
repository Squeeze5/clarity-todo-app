// Netlify Function to send reminder emails
// This function will be available at /.netlify/functions/send-reminder

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const { to_email, task_name, due_date, due_time, reminder_timing } = JSON.parse(event.body);

    // Validate required fields
    if (!to_email || !task_name || !due_date) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Get API key from environment variable
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Email service not configured' })
      };
    }

    // Format the due date/time for the email
    const dueDateStr = new Date(due_date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const timeStr = due_time ? ` at ${due_time}` : '';
    const reminderStr = reminder_timing ? reminder_timing.replace(/(\d+)/, '$1 ') : '';

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
            "${task_name}"
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
        from: 'Clarity Todo <onboarding@resend.dev>', // Use this for testing, you'll need your own domain later
        to: [to_email],
        subject: `Reminder: ${task_name} is due ${reminderStr? 'in ' + reminderStr : 'soon'}!`,
        html: emailHtml,
        text: `Reminder: Your task "${task_name}" is due on ${dueDateStr}${timeStr}. You asked to be reminded ${reminderStr}before the due time.`
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend API error:', data);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: data.message || 'Failed to send email' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Reminder email sent successfully',
        id: data.id 
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to send reminder email',
        details: error.message 
      })
    };
  }
};