import React, { useEffect, useState } from 'react';

export interface ToastState {
  message: string;
  type: 'success' | 'error';
  visible: boolean;
}

interface ToastProps {
  toast: ToastState;
}

export const Toast: React.FC<ToastProps> = ({ toast }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (toast.visible) {
      setShow(true);
      const timer = setTimeout(() => setShow(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (!show && !toast.visible) return null;

  const isError = toast.type === 'error';
  
  return (
    <div 
      className={`fixed top-20 right-6 bg-white border border-green-100 shadow-xl rounded-lg p-4 flex items-start gap-3 transition-transform duration-300 z-50 max-w-sm ${show ? 'translate-x-0' : 'translate-x-64'}`}
    >
      <div className={`rounded-full p-1 shrink-0 ${isError ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
        <i className={`fa-solid ${isError ? 'fa-circle-exclamation' : 'fa-check-circle'} text-xl`}></i>
      </div>
      <div>
        <h4 className="font-bold text-gray-800 text-sm">{isError ? '提示' : '成功'}</h4>
        <p className="text-xs text-gray-500 mt-1">{toast.message}</p>
      </div>
    </div>
  );
};