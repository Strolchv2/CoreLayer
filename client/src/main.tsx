import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { App } from './ui/App';
import { InfoPage, INFO_PAGES } from './ui/InfoPage';
import './ui/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {INFO_PAGES.map((p) => (
          <Route key={p.path} path={p.path} element={<InfoPage page={p} />} />
        ))}
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
