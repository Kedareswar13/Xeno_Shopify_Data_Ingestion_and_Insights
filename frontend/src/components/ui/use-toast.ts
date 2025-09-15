import React from 'react';
import { toast as sonnerToast } from 'sonner';
import { SuccessIcon, ErrorIcon, WarningIcon, InfoIcon } from './toast-icons';
import { ToastContent } from './ToastContent';

type ToastType = 'success' | 'error' | 'info' | 'warning' | 'default' | 'destructive';

interface ToastOptions {
  type?: ToastType;
  duration?: number;
  description?: string | React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const getIcon = (variant: string): React.ReactNode => {
  switch (variant) {
    case 'success':
      return React.createElement(SuccessIcon);
    case 'warning':
      return React.createElement(WarningIcon);
    case 'info':
      return React.createElement(InfoIcon);
    case 'error':
    case 'destructive':
      return React.createElement(ErrorIcon);
    default:
      return null;
  }
};

interface ToastFunction {
  (title: string | React.ReactNode, options?: Omit<ToastOptions, 'type'>): void | string | number;
  success: (title: string, options?: Omit<ToastOptions, 'type'>) => void | string | number;
  error: (title: string, options?: Omit<ToastOptions, 'type'>) => void | string | number;
  warning: (title: string, options?: Omit<ToastOptions, 'type'>) => void | string | number;
  info: (title: string, options?: Omit<ToastOptions, 'type'>) => void | string | number;
}

export function useToast() {
  const toast = ((title: string | React.ReactNode, options: Omit<ToastOptions, 'type'> = {}) => {
    const { duration = 5000, description, action, className, ...rest } = options;
    
    const toastOptions = {
      duration,
      className,
      ...(action && {
        action: {
          label: action.label,
          onClick: action.onClick,
        },
      }),
      ...rest,
    };

    const content = React.createElement(
      'div',
      { className: 'flex items-center' },
      typeof title === 'string' ? title : title
    );

    return sonnerToast(content, {
      description,
      ...toastOptions,
    });
  }) as ToastFunction;

  toast.success = (title: string, options: Omit<ToastOptions, 'type'> = {}) => {
    const icon = getIcon('success');
    return toast(React.createElement(ToastContent, { icon, title }), {
      ...options,
      className: `toast-success ${options.className || ''}`,
    });
  };

  toast.error = (title: string, options: Omit<ToastOptions, 'type'> = {}) => {
    const icon = getIcon('error');
    return toast(React.createElement(ToastContent, { icon, title }), {
      ...options,
      className: `toast-error ${options.className || ''}`,
    });
  };

  toast.warning = (title: string, options: Omit<ToastOptions, 'type'> = {}) => {
    const icon = getIcon('warning');
    return toast(React.createElement(ToastContent, { icon, title }), {
      ...options,
      className: `toast-warning ${options.className || ''}`,
    });
  };

  toast.info = (title: string, options: Omit<ToastOptions, 'type'> = {}) => {
    const icon = getIcon('info');
    return toast(React.createElement(ToastContent, { icon, title }), {
      ...options,
      className: `toast-info ${options.className || ''}`,
    });
  };

  return { toast };
}
