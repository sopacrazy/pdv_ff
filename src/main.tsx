import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { instalarInterceptorApiNativo } from './services/apiBase';
import { confirmarAppPronto } from './services/atualizacaoApp';

instalarInterceptorApiNativo();
void confirmarAppPronto();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
