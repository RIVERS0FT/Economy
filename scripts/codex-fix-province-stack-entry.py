from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    source = target.read_text(encoding='utf-8')
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one match, found {count}')
    target.write_text(source.replace(old, new, 1), encoding='utf-8')


replace_once(
    'src/pages/ProvincePage.tsx',
    """  useEffect(() => {\n    if (!pageNavigation || model.tab !== 'province' || !isUnlocked) return;\n    const current = pageNavigation.currentLocation;\n    const validCurrentLocation = 'provinceId' in current\n      && current.provinceId === model.selectedProvinceId\n      && (\n        current.type === 'province'\n        || (current.type === 'regional-product' && current.host === 'province')\n        || (current.type === 'regional-facility' && current.host === 'province')\n      );\n    if (!validCurrentLocation) {\n      pageNavigation.replacePage({\n        type: 'province',\n        provinceId: model.selectedProvinceId,\n        section: 'overview',\n      });\n    }\n  }, [isUnlocked, model.selectedProvinceId, model.tab, pageNavigation]);\n""",
    """  useEffect(() => {\n    if (!pageNavigation || model.tab !== 'province') return;\n    const current = pageNavigation.currentLocation;\n    const validCurrentLocation = 'provinceId' in current\n      && current.provinceId === model.selectedProvinceId\n      && (\n        current.type === 'province'\n        || (current.type === 'regional-product' && current.host === 'province')\n        || (current.type === 'regional-facility' && current.host === 'province')\n      );\n    if (!validCurrentLocation) {\n      const provinceLocation = {\n        type: 'province' as const,\n        provinceId: model.selectedProvinceId,\n        section: 'overview' as const,\n      };\n      if (current.type === 'map') {\n        pageNavigation.pushPage(provinceLocation);\n      } else {\n        pageNavigation.replacePage(provinceLocation);\n      }\n    }\n  }, [model.selectedProvinceId, model.tab, pageNavigation]);\n""",
)

replace_once(
    'scripts/verify-provincial-economy.mjs',
    """  '<WarehouseInventoryPanel', 'className=\"province-warehouse-section\"', 'onOpenProduct={openWarehouseProduct}',\n]) assert.ok(provincePage.includes(text), `州级上下文页缺少: ${text}`);\n""",
    """  '<WarehouseInventoryPanel', 'className=\"province-warehouse-section\"', 'onOpenProduct={openWarehouseProduct}',\n  \"if (current.type === 'map') {\", 'pageNavigation.pushPage(provinceLocation);',\n  'pageNavigation.replacePage(provinceLocation);',\n]) assert.ok(provincePage.includes(text), `州级上下文页缺少: ${text}`);\nassert.equal(\n  provincePage.includes(\"model.tab !== 'province' || !isUnlocked\"),\n  false,\n  '锁定州也必须先建立 map → province 返回层，不能因未解锁跳过位置规范化',\n);\n""",
)

replace_once(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    """`GameShell` 提供桌面侧栏、移动底部导航、全局状态栏、统一通知入口与面板、战略追踪器、受限玩家页面栈，以及所有玩家页面共享的常驻战略地图。页面栈只保存 `tab`、`provinceId`、分区、`productId`、`facilityTypeId` 和渲染宿主等轻量位置描述，不得保存 `EconomyState`、订单／商品数组、React 节点、DOM、Ref 或函数；当前页面加历史总深度固定最多 20 层，超过上限时保留根 `map` 并淘汰最旧的非根历史。地区“概览／市场／建筑／仓库”同级切换使用 replace，不增加栈深度；商品、工厂和全局实体钻取使用 push；连续相同位置不得重复 push；返回只 pop 并恢复上一位置；关闭清空页面栈并回到透明 `map`。不得通过 `origin` 标志、页面来源枚举或多套局部历史模拟返回路径。""",
    """`GameShell` 提供桌面侧栏、移动底部导航、全局状态栏、统一通知入口与面板、战略追踪器、受限玩家页面栈，以及所有玩家页面共享的常驻战略地图。页面栈只保存 `tab`、`provinceId`、分区、`productId`、`facilityTypeId` 和渲染宿主等轻量位置描述，不得保存 `EconomyState`、订单／商品数组、React 节点、DOM、Ref 或函数；当前页面加历史总深度固定最多 20 层，超过上限时保留根 `map` 并淘汰最旧的非根历史。地区“概览／市场／建筑／仓库”同级切换使用 replace，不增加栈深度；商品、工厂和全局实体钻取使用 push；连续相同位置不得重复 push；返回只 pop 并恢复上一位置；关闭清空页面栈并回到透明 `map`。州面点击把业务 Tab 切到 `province` 时，如果共享位置仍是根 `map`，州级位置规范化必须用 push 保留该 `map` 作为上一层；不得用 replace 吞掉根地图历史，否则从商品／工厂详情返回地区后会提前失去“返回地图”能力。锁定州也遵守同一规则，只是不显示四分区正文。不得通过 `origin` 标志、页面来源枚举或多套局部历史模拟返回路径。""",
)
