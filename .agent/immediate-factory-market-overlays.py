from __future__ import annotations

import sys
from pathlib import Path


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: immediate-factory-market-overlays.py <patch-script>")
    path = Path(sys.argv[1])
    source = path.read_text()
    marker = "const remainingVisible = [\n"
    if source.count(marker) != 1:
        raise SystemExit(f"final verification marker: expected one occurrence, found {source.count(marker)}")
    overlay = r'''
const marketAssetsVerifier = 'scripts/verify-market-assets.mjs';
replaceExact(
  marketAssetsVerifier,
  "  '下一周期加入 <strong>{formatNumber(group.pendingJoinCount)}</strong>',\n",
  "  '新增生产可用工厂立即参与运行并同步稀释满员率',\n",
);
replaceExact(
  marketAssetsVerifier,
  "  '下一周期切换为：',\n",
  "  '生产进度已清零',\n",
);
replaceExact(
  marketAssetsVerifier,
  "  '>保存计划</Button>','下一周期按 ','<span>冻结 <strong>{group.listedCount}</strong></span>'\n]) forbidText('src/pages/ProductionPage.tsx', text);\n",
  "  '>保存计划</Button>','下一周期按 ','<span>冻结 <strong>{group.listedCount}</strong></span>',\n  '下一周期加入','下一周期切换为：'\n]) forbidText('src/pages/ProductionPage.tsx', text);\n",
);

const overviewPage = 'src/pages/OverviewPage.tsx';
replaceExact(
  overviewPage,
  "  const pendingRecipeChanges = game.facilityGroups.filter((group) => Boolean(group.pendingRecipeId)).length;\n",
  '',
);
replaceExact(
  overviewPage,
  "  const pendingJoin = game.facilityGroups.reduce((sum, group) => sum + group.pendingJoinCount, 0);\n",
  '',
);
replaceExact(
  overviewPage,
  `              <span>施工 {formatNumber(derived.constructingFacilities)}</span>
              <span>下一周期加入 {formatNumber(pendingJoin)}</span>
              <span>待改种 {formatNumber(pendingRecipeChanges)} 组</span>
`,
  `              <span>施工 {formatNumber(derived.constructingFacilities)}</span>
              <span>新增工厂直接加入运行</span>
              <span>生产配置立即生效</span>
`,
);

'''
    path.write_text(source.replace(marker, overlay + marker))


if __name__ == '__main__':
    main()
