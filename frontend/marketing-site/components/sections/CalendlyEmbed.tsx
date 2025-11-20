"use client";

import Script from "next/script";

const CALENDLY_SCRIPT_SRC = "https://assets.calendly.com/assets/external/widget.js";
const CALENDLY_STYLE_HREF = "https://assets.calendly.com/assets/external/widget.css";
const CALENDLY_URL = "https://calendly.com/neerajbajpayee/30min?primary_color=0ea5e9";

export default function CalendlyEmbed() {
  return (
    <div
      className="bg-white rounded-2xl border border-gray-200 shadow-lg p-4"
      id="calendly-demo"
    >
      <Script src={CALENDLY_SCRIPT_SRC} strategy="lazyOnload" />
      <Script
        id="calendly-inline-styles"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              if (!document.querySelector("link[href='${CALENDLY_STYLE_HREF}']")) {
                var link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = '${CALENDLY_STYLE_HREF}';
                document.head.appendChild(link);
              }
            })();
          `,
        }}
      />
      <div
        className="calendly-inline-widget"
        data-url={CALENDLY_URL}
        style={{ minWidth: "320px", height: "700px" }}
      />
      <noscript>
        <p className="mt-4 text-sm text-gray-500">
          JavaScript is required to load the scheduler. You can also open Calendly in a new tab:
          {" "}
          <a href={CALENDLY_URL} className="underline text-primary-600">
            Open Calendly
          </a>
        </p>
      </noscript>
    </div>
  );
}
