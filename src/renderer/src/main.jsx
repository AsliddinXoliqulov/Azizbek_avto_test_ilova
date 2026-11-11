import './web/api'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { ConfirmProvider } from './components/ConfirmProvider'
import '@fontsource-variable/manrope'
import '@fontsource-variable/unbounded'
import './styles/index.css'
import './styles/mobile.css'
import './styles/app.css'

document.documentElement.classList.add('web-app')

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('[pwa] SW ro‘yxatdan o‘tmadi:', error))
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <ConfirmProvider>
        <App />
      </ConfirmProvider>
    </HashRouter>
  </React.StrictMode>
)
