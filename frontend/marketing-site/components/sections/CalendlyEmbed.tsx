"use client";

import { InlineWidget } from "react-calendly";

const CALENDLY_URL = "https://calendly.com/neerajbajpayee/30min?primary_color=0ea5e9";

export default function CalendlyEmbed() {
  return (
    <div
      className="bg-white rounded-2xl border border-gray-200 shadow-lg p-4"
      id="calendly-demo"
    >
      <InlineWidget
        url={CALENDLY_URL}
        styles={{
          minWidth: "320px",
          height: "700px",
        }}
      />
    </div>
  );
}
