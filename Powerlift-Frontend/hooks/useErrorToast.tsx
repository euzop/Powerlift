import React, { createContext, useContext, useState, ReactNode } from 'react';
import ErrorToast from '../components/ErrorToast';

interface ErrorToastContextType {
  showError: (message: string) => void;
  showWarning: (message: string) => void;
  showSuccess: (message: string) => void;
  hideToast: () => void;
}

const ErrorToastContext = createContext<ErrorToastContextType | undefined>(undefined);

interface ErrorToastProviderProps {
  children: ReactNode;
}

export function ErrorToastProvider({ children }: ErrorToastProviderProps) {
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);
  const [toastType, setToastType] = useState<'error' | 'warning' | 'success'>('error');

  const showError = (errorMessage: string) => {
    setMessage(errorMessage);
    setToastType('error');
    setVisible(true);
  };

  const showWarning = (warningMessage: string) => {
    setMessage(warningMessage);
    setToastType('warning');
    setVisible(true);
  };

  const showSuccess = (successMessage: string) => {
    setMessage(successMessage);
    setToastType('success');
    setVisible(true);
  };

  const hideToast = () => {
    setVisible(false);
  };

  return (
    <ErrorToastContext.Provider
      value={{
        showError,
        showWarning,
        showSuccess,
        hideToast,
      }}
    >
      {children}
      <ErrorToast
        message={message}
        visible={visible}
        onDismiss={hideToast}
        type={toastType}
      />
    </ErrorToastContext.Provider>
  );
}

export default function useErrorToast() {
  const context = useContext(ErrorToastContext);
  
  if (context === undefined) {
    throw new Error('useErrorToast must be used within an ErrorToastProvider');
  }
  
  return context;
} 