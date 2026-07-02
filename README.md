# AutoVault - Smart File System

AutoVault is an intelligent file management system powered by AI and modern web technologies. It provides secure, scalable file storage with AI-powered organization and management capabilities.

## 🚀 Features

- **Secure Storage**: Enterprise-grade encryption for all uploaded files
- **AI-Powered Organization**: Intelligent file categorization and management
- **Drag & Drop Interface**: Easy file uploads with intuitive UI
- **Real-time Processing**: Instant file analysis and organization
- **Firebase Integration**: Cloud-based storage and authentication
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **PWA Support**: Progressive Web App capabilities for offline access

## 📋 Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Git**: For version control
- **Gemini API Key**: For AI capabilities (https://ai.google.dev)
- **Firebase Project**: For authentication and storage

## 🔧 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/mobconnect/AutoVault.git
cd AutoVault
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

Update `.env.local` with your credentials:

```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_FIREBASE_API_KEY=your_firebase_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_firebase_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## 🏃 Running the Application

### Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## 📁 Project Structure

```
AutoVault/
├── src/
│   ├── components/       # Reusable React components
│   ├── pages/           # Page components
│   ├── services/        # API and Firebase services
│   ├── utils/           # Utility functions
│   ├── App.tsx          # Main App component
���   ├── main.tsx         # Entry point
│   └── index.css        # Global styles
├── public/              # Static assets
├── index.html           # HTML template
├── vite.config.ts       # Vite configuration
├── tsconfig.json        # TypeScript configuration
├── tailwind.config.js   # Tailwind CSS configuration
├── postcss.config.js    # PostCSS configuration
├── package.json         # Project dependencies
└── README.md            # This file
```

## 🎨 Technology Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS
- **State Management**: React Hooks
- **Backend**: Express.js (Node.js)
- **Database**: Firebase Firestore
- **Storage**: Firebase Cloud Storage
- **Authentication**: Firebase Auth
- **AI**: Google Gemini API
- **Icons**: Lucide React
- **Build Tool**: Vite
- **Package Manager**: npm

## 🔐 Security

- All files are encrypted before storage
- Firebase Security Rules protect user data
- Environment variables are never committed to version control
- CORS properly configured for API endpoints
- Input validation on all user uploads

## 📝 Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run clean        # Clean build artifacts
npm run lint         # Run TypeScript linter
```

## 🐛 Troubleshooting

### Port Already in Use
If port 3000 is already in use:
```bash
npm run dev -- --port 3001
```

### Module Not Found
Clear node_modules and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Firebase Connection Error
- Verify `VITE_FIREBASE_PROJECT_ID` is correct
- Check Firebase project is active in Google Cloud Console
- Ensure Firestore database is initialized

### Gemini API Error
- Verify `VITE_GEMINI_API_KEY` is valid and active
- Check API quotas in Google Cloud Console
- Ensure API is enabled for your project

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 💬 Support

For support, email support@autovault.io or open an issue on GitHub.

## 🙏 Acknowledgments

- Google Gemini API for AI capabilities
- Firebase for backend services
- React and Vite communities
- Tailwind CSS team
