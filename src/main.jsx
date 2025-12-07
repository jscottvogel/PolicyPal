import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Amplify } from 'aws-amplify';
import '@aws-amplify/ui-react/styles.css';
import outputs from '../amplify_outputs.json';
import './index.css'
import App from './App.jsx'

try {
  Amplify.configure(outputs);
} catch (e) {
  console.info("Amplify not configured yet. Run 'npx ampx sandbox' to generate outputs.");
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
