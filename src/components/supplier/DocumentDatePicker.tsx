import { useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

interface DocumentDatePickerProps {
  label: string;
  required?: boolean;
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  minDate?: Date;
}

export function DocumentDatePicker({ label, required, value, onChange, minDate }: DocumentDatePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-1">
      <Label className="text-xs">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "w-full h-8 justify-start text-left text-xs font-normal",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-1.5 h-3 w-3 shrink-0" />
            {value ? format(value, "dd/MM/yyyy", { locale: it }) : "Seleziona"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(d) => {
              onChange(d);
              setOpen(false);
            }}
            disabled={minDate ? (date) => date < minDate : undefined}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
