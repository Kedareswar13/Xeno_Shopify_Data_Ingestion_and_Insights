import { useState, useCallback, useRef, useEffect } from 'react';

type ModalOptions = {
  onClose?: () => void;
  onConfirm?: () => void | Promise<void>;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
};

export function useModal(initialState = false, options: ModalOptions = {}) {
  const [isOpen, setIsOpen] = useState(initialState);
  const [isLoading, setIsLoading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  
  const {
    onClose,
    onConfirm,
    closeOnOverlayClick = true,
    closeOnEscape = true,
  } = options;

  // Handle escape key press
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;
    const handleEscape = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape]);

  // Handle outside click
  useEffect(() => {
    if (!isOpen || !closeOnOverlayClick) return;
    const handleClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, closeOnOverlayClick]);

  const open = useCallback(() => {
    setIsOpen(true);
    document.body.style.overflow = 'hidden';
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    onClose?.();
    document.body.style.overflow = '';
  }, [onClose]);

  const confirm = useCallback(async () => {
    if (!onConfirm) return close();
    try {
      setIsLoading(true);
      await onConfirm();
      close();
    } finally {
      setIsLoading(false);
    }
  }, [onConfirm, close]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return { isOpen, open, close, confirm, isLoading, modalRef };
}
