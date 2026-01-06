"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LeadSearchProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}

export function LeadSearch({ value, onChange, onClear }: LeadSearchProps) {
  const [inputValue, setInputValue] = useState(value);

  // Debounce処理（300ms）
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue !== value) {
        onChange(inputValue);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue, value, onChange]);

  // 外部からのvalue変更を反映
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleClear = () => {
    setInputValue("");
    onClear();
  };

  return (
    <div className="relative flex-1 max-w-md">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
      <Input
        type="text"
        placeholder="店舗名、電話番号、住所で検索..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        className="pl-10 pr-10"
      />
      {inputValue && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
          onClick={handleClear}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

