"use client";

import { useEffect, useRef, useState } from "react";

const CALENDLY_SCRIPT_SRC = "https://assets.calendly.com/assets/external/widget.js";
const CALENDLY_STYLE_HREF = "https://assets.calendly.com/assets/external/widget.css";
const CALENDLY_URL = "https://calendly.com/neerajbajpayee/30min?primary_color=0ea5e9";

export default function CalendlyEmbed() {
  const widgetRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let retryInterval: ReturnType<typeof setInterval> | null = null;

    const ensureStylesheet = () => {
      if (!document.querySelector(`link[href='${CALENDLY_STYLE_HREF}']`)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = CALENDLY_STYLE_HREF;
        document.head.appendChild(link);
      }
    };

    const tryInitialize = () => {
      const calendly = (window as typeof window & { Calendly?: any }).Calendly;
      if (calendly && widgetRef.current) {
        calendly.initInlineWidget({
          url: CALENDLY_URL,
          parentElement: widgetRef.current,
        });
        if (isMounted) {
          setIsLoading(false);
        }
        return true;
      }
      return false;
    };

    const startRetryLoop = () => {
      if (retryInterval) return;
      let attempts = 0;
      retryInterval = setInterval(() => {
        attempts += 1;
        if (tryInitialize()) {
          if (retryInterval) {
            clearInterval(retryInterval);
            retryInterval = null;
          }
        } else if (attempts >= 40) {
          if (retryInterval) {
            clearInterval(retryInterval);
            retryInterval = null;
          }
          if (isMounted) {
            setIsLoading(false);
            setLoadError(true);
          }
        }
      }, 150);
    };

    ensureStylesheet();

    if (tryInitialize()) {
      return () => {
        isMounted = false;
        if (retryInterval) clearInterval(retryInterval);
      };
    }

    startRetryLoop();

    let scriptElement = document.querySelector<HTMLScriptElement>(`script[src='${CALENDLY_SCRIPT_SRC}']`);
    if (!scriptElement) {
      scriptElement = document.createElement("script");
      scriptElement.src = CALENDLY_SCRIPT_SRC;
      scriptElement.async = true;
      document.body.appendChild(scriptElement);
    }

    const handleLoad = () => {
      scriptElement?.setAttribute("data-loaded", "true");
      tryInitialize();
    };

    const handleError = () => {
      if (isMounted) {
        setIsLoading(false);
        setLoadError(true);
      }
    };

    scriptElement.addEventListener("load", handleLoad);
    scriptElement.addEventListener("error", handleError);

    return () => {
      isMounted = false;
      if (retryInterval) clearInterval(retryInterval);
      scriptElement?.removeEventListener("load", handleLoad);
      scriptElement?.removeEventListener("error", handleError);
    };
  }, []);

  return (
    <div
      className="bg-white rounded-2xl border border-gray-200 shadow-lg p-4"
      id="calendly-demo"
    >
      {isLoading && (
        <div className="flex items-center justify-center h-[100px] text-sm text-gray-500 animate-pulse">
          Loading available times…
        </div>
      )}
      {loadError && (
        <div className="flex flex-col items-center justify-center gap-3 text-center py-10">
          <p className="text-sm text-gray-500">
            We couldn&apos;t load the scheduler right now. Please try again in a few seconds or open Calendly in a new tab.
          </p>
          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="btn-primary"
          >
            Open Calendly
          </a>
        </div>
      )}
      <div
        ref={widgetRef}
        className="calendly-inline-widget"
        data-url={CALENDLY_URL}
        style={{ minWidth: "320px", height: "700px" }}
      />
    </div>
  );
}
