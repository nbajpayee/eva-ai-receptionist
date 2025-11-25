"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DateTimePickerProps {
  date?: Date;
  setDate: (date: Date | undefined) => void;
}

export function DateTimePicker({ date, setDate }: DateTimePickerProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(date);
  const [time, setTime] = React.useState<string>("10:00");

  // Update local state when prop changes
  React.useEffect(() => {
    if (date) {
      setSelectedDate(date);
      setTime(format(date, "HH:mm"));
    }
  }, [date]);

  // Combine date and time whenever either changes
  const handleDateSelect = (newDate: Date | undefined) => {
    setSelectedDate(newDate);
    if (newDate) {
      const [hours, minutes] = time.split(":").map(Number);
      const combinedDate = new Date(newDate);
      combinedDate.setHours(hours, minutes);
      setDate(combinedDate);
    } else {
      setDate(undefined);
    }
  };

  const handleTimeSelect = (newTime: string) => {
    setTime(newTime);
    if (selectedDate) {
      const [hours, minutes] = newTime.split(":").map(Number);
      const combinedDate = new Date(selectedDate);
      combinedDate.setHours(hours, minutes);
      setDate(combinedDate);
    }
  };

  // Generate time options (every 15 mins)
  const timeOptions = React.useMemo(() => {
    return Array.from({ length: 96 }).map((_, i) => {
      const hour = Math.floor(i / 4);
      const minute = (i % 4) * 15;
      return `${hour.toString().padStart(2, "0")}:${minute
        .toString()
        .padStart(2, "0")}`;
    });
  }, []);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal h-10 bg-white border-zinc-200 hover:bg-white focus:ring-2 focus:ring-[#4BA3E3] focus:border-[#4BA3E3]",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-zinc-400" />
          {date ? (
            <span className="text-sm font-medium text-zinc-900">
              {format(date, "PPP")} <span className="text-zinc-400 mx-1">•</span> {format(date, "p")}
            </span>
          ) : (
            <span>Pick a date & time</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col sm:flex-row h-[300px] divide-y sm:divide-y-0 sm:divide-x divide-zinc-100">
          <div className="p-3">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              initialFocus
              className="p-0 pointer-events-auto"
            />
          </div>
          <div className="flex flex-col w-full sm:w-[160px]">
             <div className="flex items-center px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
                <Clock className="mr-2 h-4 w-4 text-[#4BA3E3]" />
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Time</span>
             </div>
             <ScrollArea className="flex-1">
                <div className="p-2 grid gap-1">
                    {timeOptions.map((t) => (
                    <Button
                        key={t}
                        variant={time === t ? "default" : "ghost"}
                        size="sm"
                        className={cn(
                        "w-full justify-start text-xs font-normal h-8",
                        time === t
                            ? "bg-[#4BA3E3] hover:bg-[#4BA3E3]/90 text-white"
                            : "hover:bg-zinc-100 text-zinc-700"
                        )}
                        onClick={() => handleTimeSelect(t)}
                    >
                        {t}
                    </Button>
                    ))}
                </div>
             </ScrollArea>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}


