"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"

export function TruckKeyGate({ busy, error, onSubmit }) {
  const [key, setKey] = useState("")
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus?.()
  }, [])

  useEffect(() => {
    if (error) {
      setKey("")
      inputRef.current?.focus?.()
    }
  }, [error])

  function submit() {
    const trimmed = key.trim()
    if (!trimmed || busy) return
    onSubmit(trimmed)
  }

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-white p-4 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="w-full max-w-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-lg font-semibold">Enter truck key</div>

        <div className="mt-1 text-sm text-zinc-500">
          This device will bind to a single truck and load its route.
        </div>

        <div className="mt-4">
          <div className="text-xs text-zinc-500">Truck key</div>
          <input
            ref={inputRef}
            value={key}
            onChange={e => setKey(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") submit()
            }}
            className="mt-1 w-full border border-zinc-200 bg-white px-2 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            placeholder="Paste key"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={busy}
          />
        </div>

        {error ? (
          <div className="mt-3 border border-red-300 bg-red-50 p-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-4">
          <Button
            onClick={submit}
            disabled={!key.trim() || busy}
            className="w-full"
          >
            {busy ? "Validating" : "Bind truck"}
          </Button>
        </div>

        <div className="mt-3 text-xs text-zinc-500">
          This is required once per device.
        </div>
      </div>
    </div>
  )
}
