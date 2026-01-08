"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserCog,
  Building2,
  Settings,
  FileText,
  Database,
  Folder,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MenuItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[]; // 表示可能なロール（未指定の場合は全員表示）
}

interface SidebarProps {
  userRole: string;
}

const menuItems: MenuItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Master Leads (マスターリード)",
    href: "/dashboard/master-leads",
    icon: Database,
  },
  {
    name: "Leads (案件)",
    href: "/dashboard/leads",
    icon: FileText,
  },
  {
    name: "Projects (プロジェクト)",
    href: "/dashboard/projects",
    icon: Folder,
  },
  {
    name: "Customers",
    href: "/dashboard/customers",
    icon: Users,
  },
  {
    name: "Users (ユーザー管理)",
    href: "/dashboard/settings/users",
    icon: UserCog,
    roles: ["Super Admin", "Org Admin"], // MASTER と ORG_ADMIN に相当
  },
  {
    name: "Organization (組織管理)",
    href: "/dashboard/settings/organizations",
    icon: Building2,
    roles: ["Super Admin", "Org Admin"],
  },
  {
    name: "System Settings",
    href: "/dashboard/settings",
    icon: Settings,
    roles: ["Super Admin"], // MASTER のみ
  },
];

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname();

  // ロールに基づいてメニューをフィルタリング
  const filteredMenuItems = menuItems.filter((item) => {
    if (!item.roles) return true; // ロール制限がない場合は表示
    return item.roles.includes(userRole);
  });

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-gray-200 bg-white">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center border-b border-gray-200 px-6">
          <h1 className="text-xl font-bold text-gray-900">CRM Platform</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4">
          <p className="text-xs text-gray-500">v0.1.0</p>
        </div>
      </div>
    </aside>
  );
}

