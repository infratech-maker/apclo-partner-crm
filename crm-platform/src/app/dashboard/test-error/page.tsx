import { getDashboardMetrics } from "@/lib/actions/analytics";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function TestErrorPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  try {
    console.log("TestErrorPage: Starting getDashboardMetrics");
    const metrics = await getDashboardMetrics();
    console.log("TestErrorPage: Successfully got metrics");

    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4 text-green-600">Success!</h1>
        <p className="mb-4">Metrics retrieved successfully.</p>
        <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-[500px]">
          {JSON.stringify(metrics, null, 2)}
        </pre>
      </div>
    );
  } catch (error) {
    console.error("TestErrorPage: Error caught:", error);
    
    const errorDetails = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    };

    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4 text-red-600">Error Details</h1>
        <div className="bg-red-50 p-4 rounded border border-red-200">
          <p className="font-semibold text-red-800 mb-2">Error Message:</p>
          <p className="text-red-700 mb-4">{errorDetails.message}</p>
          
          {errorDetails.name && (
            <>
              <p className="font-semibold text-red-800 mb-2">Error Name:</p>
              <p className="text-red-700 mb-4">{errorDetails.name}</p>
            </>
          )}
          
          {errorDetails.stack && (
            <>
              <p className="font-semibold text-red-800 mb-2">Stack Trace:</p>
              <pre className="text-xs text-red-600 p-2 bg-red-100 rounded overflow-auto max-h-96">
                {errorDetails.stack}
              </pre>
            </>
          )}
        </div>
        
        <div className="mt-4 bg-blue-50 p-4 rounded border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Next Steps:</strong>
          </p>
          <ul className="list-disc list-inside text-sm text-blue-700 mt-2 space-y-1">
            <li>開発サーバーのターミナルログを確認してください</li>
            <li>コンソールに「getDashboardMetrics error:」で始まるログがあるか確認してください</li>
            <li>データベース接続が正常か確認してください</li>
          </ul>
        </div>
      </div>
    );
  }
}

