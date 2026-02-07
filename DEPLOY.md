# Deployment Guide for Vercel

## ✅ Code is Ready!

All fixes have been applied and pushed to GitHub. The app is ready to deploy to **estimate-genie.vercel.app**.

## Deployment Steps

### 1. Connect GitHub to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New Project"**
3. Import your GitHub repository: `wearenextgen/Estimate-Genie`
4. Vercel will automatically detect the configuration

### 2. Configure Project Settings

- **Project Name:** `estimate-genie` (this will create `estimate-genie.vercel.app`)
- **Framework Preset:** Other (or leave auto-detected)
- **Root Directory:** `./` (default)
- **Build Command:** Leave empty (not needed for serverless)
- **Output Directory:** Leave empty
- **Install Command:** `npm install`

### 3. Environment Variables (Optional)

If you want to use an LLM for content generation, add these in Vercel dashboard:

- `LLM_BASE_URL` - Your LLM API endpoint
- `LLM_MODEL` - Model name
- `LLM_API_KEY` - API key (if required)

**Note:** The app works without these - it will use fallback templates.

### 4. Deploy

Click **"Deploy"** and wait for the build to complete.

### 5. Access Your App

Once deployed, your app will be available at:
- **Production:** `https://estimate-genie.vercel.app`
- **Preview URLs:** Each commit gets a preview URL

## What Was Fixed for Vercel

✅ **Top-level await removed** - Fixed blocking serverless startup
✅ **Serverless export** - App exports correctly for Vercel
✅ **Function timeout** - Set to 60 seconds for PDF processing
✅ **Error handling** - Won't exit process in serverless environment
✅ **Uploads directory** - Created asynchronously, won't block

## Testing After Deployment

1. **Health Check:**
   ```
   https://estimate-genie.vercel.app/health
   ```
   Should return: `{"ok":true}`

2. **Test PDF Upload:**
   - Go to `https://estimate-genie.vercel.app`
   - Upload a PDF
   - Enter a prompt
   - Generate estimate

## Troubleshooting

### Build Fails
- Check Vercel build logs
- Ensure all dependencies are in `package.json`
- Verify Node.js version (should be 20+)

### Function Timeout
- PDF processing might take time
- Current timeout is 60 seconds
- For larger PDFs, consider increasing timeout in `vercel.json`

### File Upload Issues
- Vercel has a 4.5MB limit for serverless functions
- Large PDFs might need to be processed differently
- Consider using Vercel Blob storage for larger files

## Current Status

✅ Code pushed to GitHub
✅ Vercel configuration ready
✅ Serverless compatibility fixes applied
⏳ **Ready for you to connect and deploy on Vercel**

## Next Steps

1. Go to [vercel.com](https://vercel.com)
2. Import `wearenextgen/Estimate-Genie`
3. Deploy!

The app will automatically deploy on every push to `main` branch.
