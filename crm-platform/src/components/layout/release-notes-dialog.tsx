'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileText, Sparkles, Folder, MapPin, Database, Bell } from 'lucide-react'

const releaseNotes = {
  version: '0.2.0',
  date: '2025年1月8日',
  features: [
    {
      title: 'AI検索機能',
      icon: Sparkles,
      description: '自然言語でリードを検索できるAI検索機能を追加しました。',
      details: [
        'ベクトル検索による意味的な類似度検索',
        'OpenAI Embedding APIを使用した高精度な検索',
        '検索結果をプロジェクトとして保存可能',
      ],
    },
    {
      title: 'プロジェクト（営業リスト）管理',
      icon: Folder,
      description: 'AI検索結果を営業リストとして保存・管理できる機能を追加しました。',
      details: [
        'プロジェクト一覧ページでリストを管理',
        'プロジェクト詳細ページでリードを確認',
        'サイドバーから簡単にアクセス',
      ],
    },
    {
      title: 'Google Maps収集機能',
      icon: MapPin,
      description: 'Apifyを使用してGoogle Mapsから店舗情報を自動収集する機能を追加しました。',
      details: [
        'キーワードとエリアを指定して収集',
        'レビュー数・評価の自動取得',
        'MasterLeadへの自動登録と重複チェック',
      ],
    },
    {
      title: 'RAG実装 Phase 2',
      icon: Database,
      description: '既存のMasterLeadデータをベクトル化して検索可能にしました。',
      details: [
        'バッチ処理による効率的なベクトル生成',
        'pgvectorを使用した高速検索',
        'レート制限対策を実装',
      ],
    },
    {
      title: 'バックアップ機能の強化',
      icon: Bell,
      description: 'バックアップ成功/失敗時にSlack通知を送信する機能を追加しました。',
      details: [
        'バックアップ完了時に自動通知',
        'エラー発生時にも通知',
        'バックアップファイルの世代管理',
      ],
    },
  ],
}

export function ReleaseNotesDialog() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileText className="h-4 w-4" />
          リリースノート
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            リリースノート
          </DialogTitle>
          <DialogDescription>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary">v{releaseNotes.version}</Badge>
              <span className="text-sm text-muted-foreground">
                {releaseNotes.date} リリース
              </span>
            </div>
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {releaseNotes.features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <div
                  key={index}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        {feature.description}
                      </p>
                      <ul className="space-y-1">
                        {feature.details.map((detail, detailIndex) => (
                          <li
                            key={detailIndex}
                            className="text-sm text-gray-600 flex items-start gap-2"
                          >
                            <span className="text-purple-600 mt-1">•</span>
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={() => setOpen(false)}>閉じる</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
