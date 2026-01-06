"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, X, CheckCircle2, AlertCircle } from "lucide-react";
import { importLeads } from "@/lib/actions/leads";

export function CsvUploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    message: string;
  } | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === "text/csv") {
      setFile(droppedFile);
      setError("");
      setResult(null);
    } else {
      setError("CSVファイルのみアップロードできます。");
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === "text/csv" || selectedFile.name.endsWith(".csv")) {
        setFile(selectedFile);
        setError("");
        setResult(null);
      } else {
        setError("CSVファイルのみアップロードできます。");
      }
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setError("");
    setResult(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      setError("ファイルを選択してください。");
      return;
    }

    setIsLoading(true);
    setError("");
    setResult(null);

    try {
      // ファイルを読み込む
      const text = await file.text();

      // サーバーアクションを呼び出す
      const result = await importLeads(text);

      if (result.success) {
        setResult({
          imported: result.imported,
          skipped: result.skipped,
          message: result.message,
        });
        // 3秒後にリード一覧ページへリダイレクト
        setTimeout(() => {
          router.push("/dashboard/leads");
        }, 3000);
      } else {
        setError("インポートに失敗しました。");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "インポートに失敗しました。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>CSVインポート</CardTitle>
        <CardDescription>
          Pythonスクリプトで収集したCSVデータをアップロードしてください。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ドラッグ＆ドロップエリア */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 bg-gray-50"
            }`}
          >
            <input
              type="file"
              id="file-upload"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center gap-4"
            >
              <Upload className="h-12 w-12 text-gray-400" />
              <div>
                <span className="text-blue-600 hover:text-blue-700 font-medium">
                  クリックしてファイルを選択
                </span>
                <span className="text-gray-500"> または ドラッグ＆ドロップ</span>
              </div>
              <p className="text-sm text-gray-500">
                CSVファイルのみ（最大10MB）
              </p>
            </label>
          </div>

          {/* 選択されたファイルの表示 */}
          {file && (
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <FileText className="h-5 w-5 text-gray-600" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleRemoveFile}
                disabled={isLoading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* エラーメッセージ */}
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 p-4">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* 成功メッセージ */}
          {result && (
            <div className="flex items-center gap-2 rounded-md bg-green-50 p-4">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800">
                  {result.message}
                </p>
                <p className="text-xs text-green-700 mt-1">
                  インポート: {result.imported}件 / スキップ: {result.skipped}件
                </p>
                <p className="text-xs text-green-700 mt-2">
                  3秒後にリード一覧ページへリダイレクトします...
                </p>
              </div>
            </div>
          )}

          {/* 送信ボタン */}
          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={!file || isLoading}
              className="flex-1"
            >
              {isLoading ? "インポート中..." : "インポート実行"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isLoading}
            >
              キャンセル
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

