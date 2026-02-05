<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# LabelCheck AI - Deployment Guide

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js (>= 18.0.0)

### Setup Instructions

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure API Token:**
   - Get your Replicate API token from [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens)
   - Open `.env.local` file in the project root
   - Replace `your_replicate_token_here` with your actual token:
     ```
     REPLICATE_API_KEY=r8_your_actual_token_here
     ```

3. **Run the app:**
   - Development mode: `npm run dev`
   - Production mode: `npm start`

4. **Open in browser:**
   - Navigate to `http://localhost:3000`

### Troubleshooting

If you get a **401 Unauthenticated error**:
- Make sure you've created the `.env.local` file
- Verify your `REPLICATE_API_KEY` is correct
- Restart the server after changing environment variables

---

## Deploy to Railway

This app is configured for Railway deployment. Follow these steps:

### 1. Deploy to Railway

If not already deployed:
```bash
# Install Railway CLI (optional)
npm i -g @railway/cli

# Deploy (or use Railway dashboard)
railway up
```

Or deploy via Railway Dashboard:
1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select this repository

### 2. Configure Environment Variables

**This is the critical step to fix the 401 error on Railway:**

1. **Get Replicate API Token:**
   - Visit [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens)
   - Copy your existing token or create a new one

2. **Add to Railway:**
   - Go to your Railway project dashboard
   - Click on your service
   - Navigate to **"Variables"** tab
   - Click **"New Variable"**
   - Add:
     ```
     Variable: REPLICATE_API_KEY
     Value: r8_your_actual_token_here
     ```
   - Click **"Add"**

3. **Redeploy:**
   - Railway will automatically redeploy with the new environment variable
   - Or manually trigger: Click "Deploy" → "Redeploy"

### 3. Verify Deployment

- Open your Railway app URL (found in project settings)
- Test any feature (Brief processing, Label comparison, or Final check)
- The 401 error should be gone

### Railway Configuration Files

- `railway.toml` - Build and deployment configuration
- `package.json` - Contains build and start scripts

**Important:** Never commit your actual `REPLICATE_API_KEY` to Git. Railway injects environment variables at runtime.
