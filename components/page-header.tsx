"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, onBack, rightElement, className }: PageHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  return (
    <div className={cn("flex items-center justify-between mb-6 gap-4", className)}>
      <div className="flex items-center gap-3">
        <button
          onClick={handleBack}
          className="p-2 bg-gray-100 rounded-xl text-gray-500 hover:bg-gray-200 active:scale-90 transition-all"
        >
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-800 leading-tight">{title}</h1>
          {subtitle && <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{subtitle}</p>}
        </div>
      </div>
      {rightElement && <div>{rightElement}</div>}
    </div>
  );
}
