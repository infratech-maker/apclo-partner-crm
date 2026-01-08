import Link from "next/link"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
import { Folder, ArrowRight, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function ProjectsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const tenantId = session.user.tenantId;

  // プロジェクトと、それに紐づくリード数を取得
  const projects = await prisma.project.findMany({
    where: {
      tenantId: tenantId,
    },
    include: {
      _count: {
        select: { leads: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">プロジェクト（営業リスト）</h1>
          <p className="text-gray-600 mt-1">
            保存された営業リストを管理します
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.length === 0 ? (
          <div className="col-span-full text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
            プロジェクトはまだありません。<br />
            リード管理画面の「AI検索」からリストを作成してください。
          </div>
        ) : (
          projects.map((project) => (
            <Card key={project.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                    <Folder className="h-5 w-5" />
                  </div>
                  <CardTitle className="line-clamp-1">{project.name}</CardTitle>
                </div>
                <CardDescription>
                  作成日: {format(project.createdAt, 'yyyy年MM月dd日', { locale: ja })}
                </CardDescription>
                {project.description && (
                  <CardDescription className="mt-1">
                    {project.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardFooter className="flex justify-between items-center border-t pt-4 bg-slate-50/50 rounded-b-lg">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Users className="mr-2 h-4 w-4" />
                  {project._count.leads}件のリード
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/dashboard/projects/${project.id}`}>
                    開く <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
