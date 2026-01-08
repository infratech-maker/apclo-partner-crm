import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Phone } from "lucide-react"
import Link from "next/link"

export default async function ProjectDetailPage({ 
  params 
}: { 
  params: Promise<{ projectId: string }>
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { projectId } = await params;
  const tenantId = session.user.tenantId;

  const project = await prisma.project.findFirst({
    where: { 
      id: projectId,
      tenantId: tenantId,
    },
    include: {
      leads: {
        orderBy: { createdAt: 'desc' },
        include: {
          masterLead: {
            select: {
              companyName: true,
              phone: true,
              address: true,
            }
          }
        }
      }
    }
  })

  if (!project) {
    notFound()
  }

  // Leadのdataフィールドから情報を取得するヘルパー関数
  const getLeadInfo = (lead: any) => {
    const data = lead.data as Record<string, any> || {};
    const masterLead = lead.masterLead;
    
    return {
      name: data.name || data.店舗名 || masterLead?.companyName || '-',
      phone: data.phone || data.電話番号 || masterLead?.phone || '-',
      address: data.address || data.住所 || masterLead?.address || '-',
    };
  };

  return (
    <div className="space-y-6">
      {/* ヘッダーエリア */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/projects">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {project.name}
            <Badge variant="secondary" className="text-base font-normal">
              {project.leads.length}件
            </Badge>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {project.description || "説明なし"}
          </p>
        </div>
      </div>

      {/* リード一覧テーブル（簡易版） */}
      <div className="border rounded-lg shadow-sm bg-white overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-6 py-3 font-medium">会社名 / 店舗名</th>
              <th className="px-6 py-3 font-medium">電話番号</th>
              <th className="px-6 py-3 font-medium">住所</th>
              <th className="px-6 py-3 font-medium">ステータス</th>
              <th className="px-6 py-3 font-medium text-right">アクション</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {project.leads.map((lead) => {
              const info = getLeadInfo(lead);
              return (
                <tr key={lead.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium">{info.name}</td>
                  <td className="px-6 py-4">{info.phone}</td>
                  <td className="px-6 py-4 text-muted-foreground">{info.address}</td>
                  <td className="px-6 py-4">
                    <Badge variant="outline">{lead.status}</Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button size="sm" variant="default" className="gap-2">
                      <Phone className="h-3 w-3" />
                      架電
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {project.leads.length === 0 && (
          <div className="p-10 text-center text-muted-foreground">
            まだリードがありません。
          </div>
        )}
      </div>
    </div>
  )
}
