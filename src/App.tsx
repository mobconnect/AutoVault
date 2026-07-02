import React from 'react';
import { FileUp, Shield, Zap } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-slate-900/80 backdrop-blur-md border-b border-slate-700 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Shield className="w-8 h-8 text-blue-500" />
            <h1 className="text-2xl font-bold text-white">AutoVault</h1>
          </div>
          <div className="hidden md:flex gap-8">
            <a href="#features" className="text-slate-300 hover:text-white transition">Features</a>
            <a href="#upload" className="text-slate-300 hover:text-white transition">Upload</a>
            <a href="#docs" className="text-slate-300 hover:text-white transition">Docs</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Smart File System
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            Secure, intelligent file management powered by AI. Upload, organize, and manage your files with ease.
          </p>
          <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg flex items-center gap-2 mx-auto transition transform hover:scale-105">
            <FileUp className="w-5 h-5" />
            Get Started
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-800/50">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-4xl font-bold text-white text-center mb-12">Features</h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 rounded-lg bg-slate-700/50 border border-slate-600 hover:border-blue-500 transition">
              <Shield className="w-12 h-12 text-blue-500 mb-4" />
              <h4 className="text-xl font-bold text-white mb-2">Secure Storage</h4>
              <p className="text-slate-300">Enterprise-grade encryption for all your files</p>
            </div>
            <div className="p-8 rounded-lg bg-slate-700/50 border border-slate-600 hover:border-blue-500 transition">
              <Zap className="w-12 h-12 text-blue-500 mb-4" />
              <h4 className="text-xl font-bold text-white mb-2">AI Powered</h4>
              <p className="text-slate-300">Intelligent file organization and management</p>
            </div>
            <div className="p-8 rounded-lg bg-slate-700/50 border border-slate-600 hover:border-blue-500 transition">
              <FileUp className="w-12 h-12 text-blue-500 mb-4" />
              <h4 className="text-xl font-bold text-white mb-2">Easy Upload</h4>
              <p className="text-slate-300">Drag and drop interface for seamless uploads</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-700 py-8 px-4">
        <div className="max-w-6xl mx-auto text-center text-slate-400">
          <p>&copy; 2024 AutoVault. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}