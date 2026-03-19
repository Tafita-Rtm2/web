"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { BellRing } from "lucide-react";
import React from "react";

export function AlarmProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Request Notification Permission on mount
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }

    const checkAlarms = () => {
      const saved = localStorage.getItem('gsi_study_program');
      if (saved) {
        const items = JSON.parse(saved);
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        items.forEach((item: any) => {
          if (item.time === currentTime) {
            const alarmKey = `alarm_${item.id}_${now.toDateString()}_${currentTime}`;
            if (!window.sessionStorage.getItem(alarmKey)) {
              // 1. Toast (In-app)
              toast.info(`C'est l'heure de votre session : ${item.title}`, {
                icon: <BellRing className="text-primary animate-bounce" size={20} />,
                duration: 20000,
                description: "GSI Insight — Assistant Académique",
              });

              // 2. Native/Browser Notification (Background)
              if ("Notification" in window && Notification.permission === "granted") {
                new Notification("GSI Insight - Rappel d'étude", {
                  body: `C'est l'heure de votre session : ${item.title}`,
                  icon: "/favicon.ico"
                });
              }

              // 3. Audio feedback
              try {
                const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
                audio.play().catch(() => {});
              } catch (e) {}

              window.sessionStorage.setItem(alarmKey, 'true');
            }
          }
        });
      }
    };

    checkAlarms();
    const interval = setInterval(checkAlarms, 10000); // Check every 10 seconds for more precision

    return () => clearInterval(interval);
  }, []);

  return <>{children}</>;
}
