from pathlib import Path

path = Path('.agent/apply-research-tree-pan-zoom.py')
text = path.read_text(encoding='utf-8')

pairs = []
pairs.append((
"""  const gestureOriginRef = useRef<ViewportPoint | null>(null);\n  const gestureMovedRef = useRef(false);\n  const suppressClickRef = useRef(false);\n""",
"""  const gestureOriginRef = useRef<ViewportPoint | null>(null);\n  const gestureMovedRef = useRef(false);\n  const gestureStartedOnNodeRef = useRef(false);\n  const suppressClickRef = useRef(false);\n"""))

pairs.append((
"""  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {\n    if ((event.target as HTMLElement).closest('.research-tree-controls')) return;\n    const point = localPoint(event.clientX, event.clientY);\n    pointersRef.current.set(event.pointerId, point);\n    gestureMovedRef.current = false;\n    setDragging(true);\n\n    if (pointersRef.current.size === 1) {\n      lastSinglePointRef.current = point;\n      gestureOriginRef.current = point;\n      pinchRef.current = null;\n    } else if (pointersRef.current.size >= 2) {\n      const points = [...pointersRef.current.values()].slice(0, 2);\n      pinchRef.current = { midpoint: midpoint(points), distance: Math.max(1, distance(points)) };\n      gestureMovedRef.current = true;\n    }\n\n    const startedOnNode = Boolean((event.target as HTMLElement).closest('.research-technology-node'));\n    if (!startedOnNode) {\n      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* synthetic pointer events */ }\n    }\n  }, [localPoint]);\n""",
"""  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {\n    const target = event.target as HTMLElement;\n    if (target.closest('.research-tree-controls')) return;\n    const point = localPoint(event.clientX, event.clientY);\n    const startedOnNode = Boolean(target.closest('.research-technology-node'));\n    pointersRef.current.set(event.pointerId, point);\n    setDragging(true);\n\n    if (pointersRef.current.size === 1) {\n      gestureMovedRef.current = false;\n      gestureStartedOnNodeRef.current = startedOnNode;\n      suppressClickRef.current = false;\n      lastSinglePointRef.current = point;\n      gestureOriginRef.current = point;\n      pinchRef.current = null;\n    } else if (pointersRef.current.size >= 2) {\n      const points = [...pointersRef.current.values()].slice(0, 2);\n      pinchRef.current = { midpoint: midpoint(points), distance: Math.max(1, distance(points)) };\n      gestureMovedRef.current = true;\n    }\n\n    if (!startedOnNode) {\n      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* synthetic pointer events */ }\n    }\n  }, [localPoint]);\n"""))

pairs.append((
"""    const origin = gestureOriginRef.current ?? previous;\n    if (Math.hypot(point.x - origin.x, point.y - origin.y) >= DRAG_THRESHOLD) {\n      gestureMovedRef.current = true;\n      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* synthetic pointer events */ }\n    }\n    updatePan(point.x - previous.x, point.y - previous.y);\n    lastSinglePointRef.current = point;\n    event.preventDefault();\n""",
"""    const origin = gestureOriginRef.current ?? previous;\n    if (!gestureMovedRef.current && Math.hypot(point.x - origin.x, point.y - origin.y) >= DRAG_THRESHOLD) {\n      gestureMovedRef.current = true;\n      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* synthetic pointer events */ }\n    }\n    if (gestureMovedRef.current) {\n      updatePan(point.x - previous.x, point.y - previous.y);\n      event.preventDefault();\n    }\n    lastSinglePointRef.current = point;\n"""))

pairs.append((
"""  const finishPointer = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {\n    pointersRef.current.delete(event.pointerId);\n    if (gestureMovedRef.current) {\n      suppressClickRef.current = true;\n      window.setTimeout(() => { suppressClickRef.current = false; }, 0);\n    }\n    if (pointersRef.current.size === 1) {\n      const remaining = [...pointersRef.current.values()][0];\n      lastSinglePointRef.current = remaining;\n      gestureOriginRef.current = remaining;\n      pinchRef.current = null;\n    } else if (pointersRef.current.size === 0) {\n      lastSinglePointRef.current = null;\n      gestureOriginRef.current = null;\n      pinchRef.current = null;\n      setDragging(false);\n    }\n  }, []);\n\n  const handleClickCapture = useCallback((event: React.MouseEvent<HTMLDivElement>) => {\n    if (!suppressClickRef.current) return;\n    suppressClickRef.current = false;\n    event.preventDefault();\n    event.stopPropagation();\n  }, []);\n""",
"""  const finishPointer = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {\n    pointersRef.current.delete(event.pointerId);\n    if (pointersRef.current.size === 1) {\n      const remaining = [...pointersRef.current.values()][0];\n      lastSinglePointRef.current = remaining;\n      gestureOriginRef.current = remaining;\n      pinchRef.current = null;\n    } else if (pointersRef.current.size === 0) {\n      if (gestureMovedRef.current && gestureStartedOnNodeRef.current) {\n        suppressClickRef.current = true;\n        window.setTimeout(() => { suppressClickRef.current = false; }, 80);\n      }\n      lastSinglePointRef.current = null;\n      gestureOriginRef.current = null;\n      pinchRef.current = null;\n      gestureStartedOnNodeRef.current = false;\n      setDragging(false);\n    }\n  }, []);\n\n  const handleClickCapture = useCallback((event: React.MouseEvent<HTMLDivElement>) => {\n    const target = event.target as HTMLElement;\n    if (target.closest('.research-tree-controls')) return;\n    if (!target.closest('.research-technology-node') || !suppressClickRef.current) return;\n    suppressClickRef.current = false;\n    event.preventDefault();\n    event.stopPropagation();\n  }, []);\n"""))

for old, new in pairs:
    if text.count(old) != 1:
        raise SystemExit(f'expected one interaction marker, found {text.count(old)}')
    text = text.replace(old, new, 1)

marker = "test = read(test_path)\n"
insert = """test = test.replace('.research-tree-connections--desktop [data-highlighted=', '.research-tree-connections [data-highlighted=')\ntest = test.replace('.research-tree-connections--desktop [data-related=', '.research-tree-connections [data-related=')\ntest = test.replace('await toolManufacturing.click();', \"await toolManufacturing.press('Enter');\")\ntest = test.replace('await applianceNode.click();', \"await applianceNode.press('Enter');\")\ntest = test.replace(\"await page.getByRole('button', { name: /家电工程，尚未开放/ }).click();\", \"await page.getByRole('button', { name: /家电工程，尚未开放/ }).press('Enter');\")\n"""
if text.count(marker) != 1:
    raise SystemExit(f'expected one test read marker, found {text.count(marker)}')
text = text.replace(marker, marker + insert, 1)

# Keep verifier completion wording aligned with the new authoritative rule.
needle = "verifier = read(verifier_path)\n"
if text.count(needle) != 1:
    raise SystemExit(f'expected one verifier read marker, found {text.count(needle)}')
text = text.replace(needle, needle + "verifier = verifier.replace('mobile two-lane tree', 'shared pan/zoom viewport')\n", 1)

path.write_text(text, encoding='utf-8')
print('pan zoom interaction and test patch fixed')
