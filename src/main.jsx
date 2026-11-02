import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './styles/sections.css'
import './styles/blog.css'
import './styles/contact.css'
import './styles/footer.css'
import './styles/lead.css'
import './styles/auth.css'
import './styles/platform.css'
import './styles/meet.css'
import { AuthProvider } from './platform/store/auth.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
