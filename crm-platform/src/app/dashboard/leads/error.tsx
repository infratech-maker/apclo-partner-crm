'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Page Error:", error)
  }, [error])

  return (
    <div className="flex h-[400px] flex-col items-center justify-center gap-4">
      <h2 className="text-xl font-bold text-destructive">読み込み中にエラーが発生しました</h2>
      <p className="text-muted-foreground text-sm">{error.message}</p>
      {error.digest && (
        <p className="text-muted-foreground text-xs">Error ID: {error.digest}</p>
      )}
      <Button variant="outline" onClick={() => reset()}>再試行</Button>
    </div>
  )
}








