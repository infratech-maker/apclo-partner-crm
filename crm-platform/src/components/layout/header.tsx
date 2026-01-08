"use client";

import { usePathname } from "next/navigation";
import { UserNav } from "./user-nav";
import { ReleaseNotesDialog } from "./release-notes-dialog";

interface HeaderProps {
  userName: string;
  userEmail: string;
  userRole: string;
}

// ページタイトルマッピング
const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/leads": "Leads (案件)",
  "/dashboard/customers": "Customers",
  "/dashboard/master-leads": "Master Leads (マスターリード)",
  "/dashboard/settings/users": "Users (ユーザー管理)",
  "/dashboard/settings/organizations": "Organization (組織管理)",
  "/dashboard/settings": "System Settings",
  "/dashboard/scraper": "Scraper",
};

export function Header({ userName, userEmail, userRole }: HeaderProps) {
  const pathname = usePathname();
  const title = pageTitles[pathname] || "Dashboard";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center border-b border-gray-200 bg-white px-6">
      <div className="flex flex-1 items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <div className="flex items-center gap-4">
          <ReleaseNotesDialog />
          <UserNav
            userName={userName}
            userEmail={userEmail}
            userRole={userRole}
          />
        </div>
      </div>
    </header>
  );
}

