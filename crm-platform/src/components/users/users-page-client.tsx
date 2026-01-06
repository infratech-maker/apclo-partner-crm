"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { InviteUserDialog } from "./invite-user-dialog";
import { useRouter } from "next/navigation";

interface UserTableItem {
  id: string;
  name: string | null;
  email: string;
  organization: string;
  role: string;
  status: "Active" | "Invited";
  createdAt: Date;
}

interface UsersPageClientProps {
  initialUsers: UserTableItem[];
}

export function UsersPageClient({ initialUsers }: UsersPageClientProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const router = useRouter();

  const handleSuccess = () => {
    // 招待成功後、ページをリフレッシュ
    router.refresh();
  };

  return (
    <>
      <Button onClick={() => setIsDialogOpen(true)}>
        <UserPlus className="mr-2 h-4 w-4" />
        ユーザーを招待
      </Button>
      <InviteUserDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={handleSuccess}
      />
    </>
  );
}

