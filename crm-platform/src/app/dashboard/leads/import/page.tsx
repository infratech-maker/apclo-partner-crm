import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CsvUploadForm } from "@/components/leads/csv-upload-form";

export default async function ImportLeadsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">CSVインポート</h1>
        <p className="text-gray-600 mt-1">
          Pythonスクリプトで収集したCSVデータをアップロードしてください
        </p>
      </div>

      <div className="flex justify-center">
        <CsvUploadForm />
      </div>
    </div>
  );
}

