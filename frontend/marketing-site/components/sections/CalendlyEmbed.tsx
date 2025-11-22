"use client";

import { useEffect, useState } from "react";
import { InlineWidget } from "react-calendly";

// Clean URL without query parameters
const CALENDLY_URL = "https://calendly.com/neerajbajpayee/30min";

export default function CalendlyEmbed() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="relative bg-white/10 backdrop-blur-sm p-3 rounded-[2.5rem] border border-white/20 shadow-2xl">
        <div className="bg-white rounded-[2rem] h-[920px] flex items-center justify-center">
           <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative group">
        {/* Glass Frame Effect */}
        <div className="absolute inset-0 bg-white/10 backdrop-blur-sm rounded-[2.5rem] transform translate-y-2 translate-x-2" />
        
        <div
        className="relative bg-white/10 backdrop-blur-md p-3 rounded-[2.5rem] border border-white/20 shadow-2xl shadow-primary-900/20 transition-transform duration-500 hover:scale-[1.01]"
        id="calendly-demo"
        >
            <div className="bg-white rounded-[2rem] overflow-hidden">
                <InlineWidget
                    url={CALENDLY_URL}
                    styles={{
                    minWidth: "320px",
                    height: "920px", 
                    }}
                    pageSettings={{
                        hideGdprBanner: true,
                        hideLandingPageDetails: false,
                        hideEventTypeDetails: false,
                        primaryColor: "0ea5e9",
                        backgroundColor: "ffffff",
                        textColor: "4b5563" 
                    }}
                />
            </div>
        </div>
    </div>
  );
}
