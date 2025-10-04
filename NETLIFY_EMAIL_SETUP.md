# Setting Up Email Reminders on Netlify

Your app is deployed to https://clarity-todo.netlify.app/ and now we need to set up the email service.

## Step 1: Sign Up for Resend

1. Go to [https://resend.com/](https://resend.com/)
2. Click "Start for free" 
3. Create an account (100 emails/day free)
4. Verify your email address

## Step 2: Get Your API Key

1. After signing in to Resend, go to the dashboard
2. Click on "API Keys" in the left sidebar
3. Click "Create API Key"
4. Give it a name like "Clarity Todo Reminders"
5. Copy the API key (starts with `re_`)
6. **Save this key securely - you won't be able to see it again!**

## Step 3: Add API Key to Netlify

1. Go to your Netlify dashboard: https://app.netlify.com/
2. Select your "clarity-todo" site
3. Go to **Site configuration** → **Environment variables**
4. Click "Add a variable"
5. Add the following:
   - **Key:** `RESEND_API_KEY`
   - **Value:** Your Resend API key (the one that starts with `re_`)
6. Click "Save"

## Step 4: Update Site URL (Optional)

In the same environment variables section, add:
- **Key:** `URL`
- **Value:** `https://clarity-todo.netlify.app`

This will make the "Open Clarity Todo" button in emails link to your site.

## Step 5: Redeploy Your Site

After adding environment variables, you need to redeploy:

1. Go to the **Deploys** tab in Netlify
2. Click "Trigger deploy" → "Deploy site"
3. Wait for the deploy to complete (usually 1-2 minutes)

## Step 6: Test Email Reminders

1. Visit https://clarity-todo.netlify.app/
2. Create a new task:
   - Enter a task name
   - Set a due date and time
   - Choose "Email" as reminder type
   - Select when to be reminded
   - Save the task

3. The email will be sent at the specified time before the due date

## How It Works

When you select "Email" for a reminder:
1. Your browser calculates when to send the reminder
2. At the right time, it calls your Netlify Function
3. The function uses Resend to send a beautiful HTML email
4. The email is sent from "onboarding@resend.dev" (for free tier)

## Customizing the "From" Email (Optional)

To send emails from your own domain:

1. You need to own a domain (e.g., yourdomain.com)
2. In Resend dashboard, go to "Domains"
3. Click "Add domain"
4. Follow the instructions to verify your domain
5. Update the function to use: `from: 'Clarity Todo <noreply@yourdomain.com>'`

## Troubleshooting

### Emails not sending?
- Check Netlify function logs: **Functions** tab → **send-reminder** → View logs
- Verify the API key is set correctly in environment variables
- Check Resend dashboard for API usage and errors

### Testing locally?
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Run locally with functions
netlify dev

# Your app will be available at http://localhost:8888
# Functions will work at http://localhost:8888/.netlify/functions/send-reminder
```

### Email going to spam?
- This is common with the free tier using resend.dev domain
- Upgrade to use your own domain for better deliverability
- Ask recipients to mark as "not spam"

## Current Limitations

- **Free tier:** 100 emails per day
- **From address:** Uses resend.dev domain on free tier
- **Browser must be open:** Reminders only work while the app is open
- **No server-side scheduling:** Consider a cron job service for true background reminders

## Next Steps

For production use, consider:
1. Upgrading Resend for more emails and custom domain
2. Using a background job service (like Quirrel or Inngest) for server-side reminder scheduling
3. Implementing a database to store reminder preferences

## Support

- Resend documentation: https://resend.com/docs
- Netlify Functions docs: https://docs.netlify.com/functions/overview/
- Your function logs: https://app.netlify.com/sites/clarity-todo/functions