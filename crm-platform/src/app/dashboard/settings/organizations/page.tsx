import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OrganizationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Organization (組織管理)</h1>
        <p className="mt-2 text-sm text-gray-600">
          組織の管理を行います
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organizations List</CardTitle>
          <CardDescription>
            組織一覧を表示します
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
}

