import * as React from "react";
import { createPortal } from "react-dom";

export type ToastVariant = "default" | "destructive";

export type ToastOptions = {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
};

type ToastRecord = ToastOptions & { id: string };

type ToastContextValue = {
  toasts: ToastRecord[];
  toast: (options: ToastOptions) => void;
  dismiss: (id: string) => void;
};

const DEFAULT_DURATION = 5000;

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastRecord[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = React.useCallback(
    (options: ToastOptions) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const record: ToastRecord = { id, ...options };
      setToasts((current) => [...current, record]);

      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          dismiss(id);
        }, options.durationMs ?? DEFAULT_DURATION);
      }
    },
    [dismiss]
  );

  const value = React.useMemo<ToastContextValue>(
    () => ({ toasts, toast, dismiss }),
    [toasts, toast, dismiss]
  );

  const toastPortal =
    typeof document !== "undefined"
      ? createPortal(
          React.createElement(
            "div",
            {
              className:
                "fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2 text-sm"
            },
            toasts.map((toastRecord) => {
              const { id, title, description, variant } = toastRecord;
              const variantClasses =
                variant === "destructive"
                  ? "border-red-200 bg-red-50 text-red-900"
                  : "border-zinc-200 bg-white text-zinc-900";

              return React.createElement(
                "div",
                {
                  key: id,
                  className: `rounded-lg border bg-white p-4 shadow-md transition ${variantClasses}`
                },
                [
                  title
                    ? React.createElement(
                        "p",
                        { key: "title", className: "font-semibold" },
                        title
                      )
                    : null,
                  description
                    ? React.createElement(
                        "p",
                        {
                          key: "description",
                          className: "mt-1 text-xs text-zinc-600"
                        },
                        description
                      )
                    : null,
                  React.createElement(
                    "button",
                    {
                      key: "dismiss",
                      type: "button",
                      className:
                        "mt-3 text-xs font-medium text-zinc-500 hover:text-zinc-700",
                      onClick: () => dismiss(id)
                    },
                    "Dismiss"
                  )
                ].filter(Boolean)
              );
            })
          ),
          document.body
        )
      : null;

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(ToastContext.Provider, { value }, children),
    toastPortal
  );
}

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
