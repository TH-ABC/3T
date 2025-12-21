
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import App from './App';
import { Loader2 } from 'lucide-react';

// --- POLYFILL FOR REACT 19 COMPATIBILITY ---
// Libraries like react-quill still rely on findDOMNode which was removed in React 19.
if (!(ReactDOM as any).findDOMNode) {
  (ReactDOM as any).findDOMNode = (instance: any) => {
    if (instance == null) return null;
    if (instance instanceof HTMLElement) return instance;
    // For legacy components, we return the DOM node if accessible
    return instance.status === 'mounted' ? instance.getDOMNode() : null;
  };
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOMClient.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Suspense fallback={
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 gap-4">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Đang khởi tạo hệ thống...</p>
      </div>
    }>
      <App />
    </Suspense>
  </React.StrictMode>
);
