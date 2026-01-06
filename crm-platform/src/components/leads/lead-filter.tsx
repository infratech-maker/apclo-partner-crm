"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { LeadStatusBadge } from "./lead-status-badge";

const STATUS_OPTIONS = [
  { value: "NEW", label: "新規" },
  { value: "CALLING", label: "架電中" },
  { value: "CONNECTED", label: "接続済み" },
  { value: "APPOINTMENT", label: "アポイント獲得" },
  { value: "NG", label: "お断り" },
  { value: "CALLBACK", label: "掛け直し" },
];

interface LeadFilterProps {
  selectedStatuses: string[];
  onChange: (statuses: string[]) => void;
  onClear: () => void;
}

export function LeadFilter({
  selectedStatuses,
  onChange,
  onClear,
}: LeadFilterProps) {
  const [open, setOpen] = useState(false);

  const handleToggleStatus = (status: string) => {
    if (selectedStatuses.includes(status)) {
      onChange(selectedStatuses.filter((s) => s !== status));
    } else {
      onChange([...selectedStatuses, status]);
    }
  };

  const handleClear = () => {
    onChange([]);
    onClear();
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-10">
            <Filter className="h-4 w-4 mr-2" />
            ステータス
            {selectedStatuses.length > 0 && (
              <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                {selectedStatuses.length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="ステータスを検索..." />
            <CommandList>
              <CommandEmpty>ステータスが見つかりません</CommandEmpty>
              <CommandGroup>
                {STATUS_OPTIONS.map((option) => {
                  const isSelected = selectedStatuses.includes(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      onSelect={() => handleToggleStatus(option.value)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "flex h-4 w-4 items-center justify-center rounded-sm border",
                              isSelected
                                ? "bg-blue-600 border-blue-600"
                                : "border-gray-300"
                            )}
                          >
                            {isSelected && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </div>
                          <LeadStatusBadge status={option.value} />
                        </div>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedStatuses.length > 0 && (
        <Button variant="ghost" size="sm" onClick={handleClear}>
          <X className="h-4 w-4 mr-1" />
          クリア
        </Button>
      )}
    </div>
  );
}

