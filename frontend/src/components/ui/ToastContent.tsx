import React from 'react';

interface ToastContentProps {
  icon: React.ReactNode;
  title: string;
}

export const ToastContent: React.FC<ToastContentProps> = ({ icon, title }) => (
  <div className="flex items-center">
    {icon}
    <span className="ml-2">{title}</span>
  </div>
);
