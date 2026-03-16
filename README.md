# StitchMart

The ultimate premium marketplace for embroidery designs, industrial threads, fabrics, and machine accessories in India.

## Core Features

- **AI Customization Studio**: An interactive interface where users can select base garments (like hoodies or blouse pieces) and preview embroidery designs on them using Genkit-powered AI visualization.
- **Product Marketplace**: A comprehensive catalog for browsing and searching digital embroidery assets and physical supplies.
- **Personalized Recommendations**: AI-driven suggestions based on user browsing history and past purchases.
- **Secure Authentication**: Role-based access for customers and dealers integrated with Firebase Auth.
- **Dynamic Portals**: Real-time dashboards for managing orders and digital downloads.

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with [Shadcn UI](https://ui.shadcn.com/)
- **Backend & Auth**: [Firebase](https://firebase.google.com/) (Firestore, Authentication)
- **AI**: [Genkit](https://firebase.google.com/docs/genkit) with Google Gemini
- **Language**: TypeScript

## Git Troubleshooting

If you see `error: remote origin already exists` or `Permission denied (publickey)`, follow these steps to switch to HTTPS:

### 1. Update the remote URL to HTTPS
Run this command in your terminal:
```bash
git remote set-url origin https://github.com/sushanth-kesava/StitchMart.git
```

### 2. Push your code
Then, push your changes to GitHub:
```bash
git push -u origin main
```
*Note: You may be asked for your GitHub username and a Personal Access Token (PAT). You can generate a PAT in your GitHub settings.*

## Getting Started

1. **Configure Environment**: Add your Firebase configuration keys to a `.env` file.
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Run Development Server**:
   ```bash
   npm run dev
   ```
