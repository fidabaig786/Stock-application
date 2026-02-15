import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Clear stale Supabase auth sessions from old project
const CURRENT_SUPABASE_REF = 'juqbmqdjourkqzugmmti';
for (let i = localStorage.length - 1; i >= 0; i--) {
  const key = localStorage.key(i);
  if (key && key.startsWith('sb-') && !key.startsWith(`sb-${CURRENT_SUPABASE_REF}`)) {
    localStorage.removeItem(key);
  }
}

createRoot(document.getElementById("root")!).render(<App />);
