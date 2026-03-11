
import * as React from "react";
import {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast";

export type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

// Create a custom hook that syncs with global toast state
export const useToast = () => {
  const [toasts, setToasts] = React.useState<ToasterToast[]>(toastState.toasts);

  React.useEffect(() => {
    const listener = (newToasts: ToasterToast[]) => {
      setToasts(newToasts);
    };
    
    toastState.listeners.add(listener);
    
    return () => {
      toastState.listeners.delete(listener);
    };
  }, []);

  const localToast = (props: Omit<ToasterToast, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToasterToast = { id, ...props };
    
    toastState.addToast(newToast);
    
    return {
      id,
      dismiss: () => toastState.removeToast(id),
      update: (updatedProps: Partial<ToasterToast>) => {
        toastState.toasts = toastState.toasts.map(t =>
          t.id === id ? { ...t, ...updatedProps } : t
        );
        toastState.notify();
      },
    };
  };

  const dismiss = (toastId?: string) => {
    if (toastId) {
      toastState.removeToast(toastId);
    } else {
      toastState.toasts = [];
      toastState.notify();
    }
  };

  return {
    toast: localToast,
    dismiss,
    toasts,
  };
};

export { type ToastProps };

// Create a global toast state outside of React
const toastState = {
  listeners: new Set<(toasts: ToasterToast[]) => void>(),
  toasts: [] as ToasterToast[],
  
  addToast(toast: ToasterToast) {
    this.toasts = [...this.toasts, toast];
    this.notify();
  },
  
  removeToast(id: string) {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.notify();
  },
  
  notify() {
    this.listeners.forEach(listener => listener(this.toasts));
  }
};

// Export the toast function directly for convenience
export const toast = (props: Omit<ToasterToast, "id">) => {
  const id = Math.random().toString(36).substring(2, 9);
  const newToast: ToasterToast = { id, ...props };
  
  toastState.addToast(newToast);
  
  return {
    id,
    dismiss: () => toastState.removeToast(id),
    update: (updatedProps: Partial<ToasterToast>) => {
      toastState.toasts = toastState.toasts.map(t =>
        t.id === id ? { ...t, ...updatedProps } : t
      );
      toastState.notify();
    },
  };
};
