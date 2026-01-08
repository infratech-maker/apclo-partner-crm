'use client'

import { useState, useTransition } from 'react'
import { MapPin, Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { startGoogleMapsScraping } from '@/lib/actions/apify'

export function GoogleMapsScraperDialog() {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  // フォームの状態
  const [keywords, setKeywords] = useState('')
  const [location, setLocation] = useState('')
  const [maxItems, setMaxItems] = useState('20')

  const handleStartScraping = () => {
    if (!keywords || !location) {
      toast({
        title: "入力エラー",
        description: "キーワードとエリアは必須です。",
        variant: "destructive"
      })
      return
    }

    // キーワードを配列に変換（カンマまたはスペース区切り）
    const keywordList = keywords.split(/[,、\s]+/).filter(k => k.trim() !== '')

    startTransition(async () => {
      try {
        const result = await startGoogleMapsScraping(
          keywordList,
          location,
          parseInt(maxItems)
        )

        if (result.success) {
          toast({
            title: "収集ジョブを開始しました",
            description: "バックグラウンドで収集中です。完了次第リストに追加されます。",
          })
          setOpen(false)
          // 入力リセット
          setKeywords('')
          setLocation('')
          setMaxItems('20')
        } else {
          toast({
            title: "エラーが発生しました",
            description: result.error || "ジョブの開始に失敗しました。",
            variant: "destructive"
          })
        }
      } catch (error) {
        toast({
          title: "予期せぬエラー",
          description: "通信エラーが発生しました。",
          variant: "destructive"
        })
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <MapPin className="h-4 w-4" />
          Google Map収集
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Google Maps収集</DialogTitle>
          <DialogDescription>
            指定したエリアとキーワードで店舗リストを収集し、自動的にリードとして追加します。
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="keywords">検索キーワード</Label>
            <Input
              id="keywords"
              placeholder="例: ラーメン, 居酒屋"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">複数ある場合はカンマまたはスペースで区切ってください</p>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="location">エリア・場所</Label>
            <Input
              id="location"
              placeholder="例: 東京都渋谷区, Shibuya Station"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="max-items">収集上限数 (概算)</Label>
            <Select 
              value={maxItems} 
              onValueChange={setMaxItems}
              disabled={isPending}
            >
              <SelectTrigger id="max-items">
                <SelectValue placeholder="件数を選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10件 (テスト用)</SelectItem>
                <SelectItem value="20">20件</SelectItem>
                <SelectItem value="50">50件</SelectItem>
                <SelectItem value="100">100件</SelectItem>
                <SelectItem value="200">200件</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">※ Apifyのコストに影響するためご注意ください</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            キャンセル
          </Button>
          <Button onClick={handleStartScraping} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                開始中...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                収集開始
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}



