"use client";

import { signOut } from "next-auth/react";
import { User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

interface UserNavProps {
  userName: string;
  userEmail: string;
  userRole: string;
}

export function UserNav({ userName, userEmail, userRole }: UserNavProps) {
  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-10 w-10 rounded-full"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-gray-700">
            {userName.charAt(0).toUpperCase()}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-gray-700">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col">
                <p className="text-sm font-medium text-gray-900">{userName}</p>
                <p className="text-xs text-gray-500">{userEmail}</p>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              Role: <span className="font-medium">{userRole}</span>
            </div>
          </div>
          <Separator />
          <div className="space-y-1">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => {
                // TODO: プロフィールページへの遷移
                console.log("Profile clicked");
              }}
            >
              <User className="mr-2 h-4 w-4" />
              Profile
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

