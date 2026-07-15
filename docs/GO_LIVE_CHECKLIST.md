# 🚀 Antariya — Go-Live Production Checklist

## What Was Done (Code Changes)

| # | Fix | File(s) | Why |
|---|-----|---------|-----|
| 1 | Added `credentials: "include"` to ALL fetch calls | All 10 files in `frontend/src/lib/api/` | Without this, the browser won't send auth cookies cross-origin (Hostinger→Render) |
| 2 | Created centralized `apiFetch` helper | `frontend/src/lib/api/fetch-client.ts` | Use this for any new API calls — handles auth, timeout, errors |
| 3 | Updated `runtime-config.js` | Both `frontend/public/` and `public_html/` | Points frontend to Render backend URL |
| 4 | Added HTTPS + www→non-www redirect | `.htaccess` | SEO + security — Google penalizes duplicate content |
| 5 | Updated `render.yaml` | Root | Complete env var list + health check endpoint |
| 6 | Updated `sitemap.xml` | `public_html/` | Clean URLs, added product pages, fresh dates |
| 7 | Updated `deploy.sh` | Root | One-command build + deploy archive |

---

## ⚡ Steps YOU Need to Do (In Order)

### Step 1: Set Your Render Backend URL

Edit `frontend/public/runtime-config.js` and replace the placeholder:

```js
apiBaseUrl: "https://YOUR-ACTUAL-RENDER-URL.onrender.com"
```

To find your URL: Render Dashboard → Your service → the `.onrender.com` URL at the top.

---

### Step 2: Set Environment Variables on Render

Go to Render Dashboard → **antariya-backend** → Environment:

| Variable | Value | Required? |
|----------|-------|-----------|
| `MONGODB_URI` | Your MongoDB Atlas connection string | ✅ YES |
| `JWT_SECRET` | A random 64-char string (generate with `openssl rand -base64 48`) | ✅ YES |
| `FRONTEND_URL` | `https://antariyaofficial.com,https://www.antariyaofficial.com` | ✅ YES |
| `NODE_ENV` | `production` | ✅ YES |
| `RAZORPAY_KEY_ID` | Your Razorpay live key | For payments |
| `RAZORPAY_KEY_SECRET` | Your Razorpay live secret | For payments |
| `SUPERADMIN_ALLOWED_EMAILS` | Your admin email(s), comma-separated | For admin access |
| `SMTP_HOST` | e.g. `smtp.gmail.com` | For order emails |
| `SMTP_PORT` | e.g. `587` | For order emails |
| `SMTP_USER` | Your email | For order emails |
| `SMTP_PASS` | App password | For order emails |
| `CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud | For product images |
| `CLOUDINARY_API_KEY` | Cloudinary API key | For product images |
| `CLOUDINARY_API_SECRET` | Cloudinary secret | For product images |

---

### Step 3: Set Razorpay Key in Frontend

Edit `frontend/public/runtime-config.js`:

```js
razorpayKeyId: "rzp_live_xxxxxx"  // Your publishable key
```

---

### Step 4: Deploy Backend to Render

```bash
cd backend
git add -A && git commit -m "production: credentials + CORS ready"
git push origin main
```

Render will auto-deploy. Wait for "Deploy successful" in the Render dashboard.

Verify: Visit `https://YOUR-URL.onrender.com/api/health` — should return `{ success: true }`.

---

### Step 5: Build & Deploy Frontend to Hostinger

```bash
chmod +x deploy.sh
./deploy.sh
```

This creates `antariya-deploy.zip`. Upload it to Hostinger:
1. File Manager → `public_html/`
2. Delete all old files
3. Upload the zip
4. Extract in place
5. Delete the zip

---

### Step 6: Verify Everything Works

| Test | URL | Expected |
|------|-----|----------|
| Homepage loads | `https://antariyaofficial.com` | ✅ Loads with products |
| Product page | `https://antariyaofficial.com/product/any-id` | ✅ Loads (not 404) |
| API connection | Open DevTools → Network → check API calls return 200 | ✅ No CORS errors |
| Login works | Try logging in | ✅ Sets cookie, stays logged in |
| Payment test | Place a test order with Razorpay test key first | ✅ Payment completes |
| www redirect | Visit `www.antariyaofficial.com` | ✅ Redirects to non-www |
| HTTPS | Visit `http://antariyaofficial.com` | ✅ Redirects to https |

---

### Step 7: DNS Settings (Hostinger)

Make sure these DNS records exist:
- **A Record**: `@` → Hostinger's IP (check their panel)
- **CNAME**: `www` → `antariyaofficial.com`
- **SSL**: Enable "Force HTTPS" in Hostinger SSL settings

---

### Step 8: Google Search Console

1. Go to [Google Search Console](https://search.google.com/search-console/)
2. Add property: `https://antariyaofficial.com`
3. Submit sitemap: `https://antariyaofficial.com/sitemap.xml`
4. Request indexing for your homepage

---

## ⚠️ Common Issues

| Problem | Solution |
|---------|----------|
| API returns CORS error | Check `FRONTEND_URL` env var on Render includes your exact domain |
| Product pages show 404 | Make sure `.htaccess` is uploaded AND `product/placeholder/index.html` exists in the build output |
| Login doesn't persist | Ensure cookies have `SameSite=None; Secure` (already configured in your backend cookie-auth middleware) |
| Render cold start (slow first load) | Free tier sleeps after 15min. Upgrade to Starter ($7/mo) for always-on |
| Images not loading | Set up Cloudinary env vars on Render |

---

## 💡 Post-Launch Recommendations

1. **Upgrade Render to Starter tier** — free tier sleeps, causing 30-50s cold starts
2. **Enable Hostinger CDN** — speeds up static assets globally
3. **Add Google Analytics** — track visitors (add to `layout.tsx`)
4. **Set up order notification emails** — configure SMTP env vars
5. **Test mobile** — verify responsive design on real devices
