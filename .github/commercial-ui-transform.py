from pathlib import Path
import re


def update(path, before, after):
    p = Path(path)
    text = p.read_text()
    assert text.count(before) == 1, (path, before[:100], text.count(before))
    p.write_text(text.replace(before, after, 1))

p = Path('src/pages/CommercePage.tsx')
s = p.read_text().replace("import { useEffect, useMemo, useState } from 'react';", "import { useEffect, useMemo, useRef, useState } from 'react';")
s = s.replace('  StatusTag,\n', '')
a = s.index('interface CommercialInputDefinition')
b = s.index('export function CommercePage')
s = s[:a] + '''import { BuildingClusterCard } from '../components/buildings/BuildingClusterCard';
import { CommercialBuildingArtwork } from '../components/commercial/CommercialBuildingArtwork';
import { CommercialBuildingDetail } from '../components/commercial/CommercialBuildingDetail';
import { CompactCurrency } from '../components/ui/CompactNumber';
import type { CommercialStateFields } from '../types/commercial';
import { commercialProfitPerMinute as profitPerMinute, commercialStatusLabel } from '../utils/commercialPresentation';
import '../styles/commercial-buildings.css';

''' + s[b:]
s = s.replace("  const [pendingAction, setPendingAction] = useState('');", "  const [pendingAction, setPendingAction] = useState('');\n  const pendingActionRef = useRef(false);\n  const [actionError, setActionError] = useState('');")
a = s.index('  const productNameById = useMemo(')
b = s.index('  const selectedBuildType =', a)
s = s[:a] + s[b:]
a = s.index('  const execute = async (')
b = s.index('  if (types.length === 0)', a)
s = s[:a] + '''  useEffect(() => { setActionError(''); }, [activeDetailTypeId, model.selectedProvinceId]);

  const execute = async (
    key: string,
    operation: 'build' | 'start' | 'stop',
    commercialTypeId: string,
    quantity?: number,
  ) => {
    if (pendingActionRef.current) return;
    pendingActionRef.current = true;
    setPendingAction(key);
    setActionError('');
    try {
      const result = await runCommercialBuildingAction(Number(game.saveEpoch || 0), {
        operation,
        provinceId: model.selectedProvinceId,
        commercialTypeId,
        quantity,
      });
      if (!result.ok) setActionError(result.message);
      await model.showResult(result);
    } catch {
      setActionError('商业建筑操作未能完成确认，请刷新状态后重试。');
    } finally {
      pendingActionRef.current = false;
      setPendingAction('');
    }
  };

''' + s[b:]
a = s.index('  const buildingList = (')
b = s.index('  const detail =', a)
s = s[:a] + '''  const buildingList = (
    <section className="facility-cluster-selector-region commercial-cluster-selector-region" aria-label="商业建筑列表">
      <div className="facility-cluster-selector-list commercial-cluster-selector-list">
        {provinceGroups.map((group) => {
          const type = typeById.get(group.commercialTypeId);
          if (!type) return null;
          const profit = profitPerMinute(type);
          return (
            <BuildingClusterCard key={group.commercialTypeId} className="commercial-building-card"
              name={type.name} status={group.status} count={group.count}
              artwork={<CommercialBuildingArtwork commercialTypeId={type.id} className="facility-cluster-icon" />}
              profitValue={<CompactCurrency value={profit} />}
              profitTone={profit > 0 ? 'positive' : 'neutral'}
              profitTitle={`${type.name}单座稳定利润／分钟；不含集群数量倍数`}
              ariaLabel={`${type.name}，数量 ${formatNumber(group.count)}，${commercialStatusLabel(group)}，单座稳定利润每分钟：${formatCurrency(profit)}`}
              onSelect={() => selectDetail(type.id)}
            />
          );
        })}
      </div>
      {provinceGroups.length === 0 ? (
        <div className="empty-state tall">尚未拥有商业建筑。先建设第一座商业建筑。</div>
      ) : null}
    </section>
  );

''' + s[b:]
a = s.index('  const detail =')
b = s.index('  if (embedded) return content;', a)
s = s[:a] + '''  const detail = selectedGroup && selectedDetailType ? (
    <div className="facility-cluster-detail-shell facility-cluster-detail-page commercial-cluster-detail-page">
      <PagePanel className="production-surface facility-card facility-group-card facility-cluster-detail-card commercial-building-detail-card">
        <CommercialBuildingDetail group={selectedGroup} type={selectedDetailType}
          products={game.products} inventories={game.inventories} now={game.lastProcessedAt}
          pending={Boolean(pendingAction)}
          onToggle={(enabled) => void execute(
            `${enabled ? 'start' : 'stop'}:${selectedGroup.commercialTypeId}`,
            enabled ? 'start' : 'stop', selectedGroup.commercialTypeId,
          )}
        />
      </PagePanel>
    </div>
  ) : null;

  const content = <>
    {actionError ? <p className="commercial-action-error" role="alert">{actionError}</p> : null}
    {selectedGroup && selectedDetailType ? detail : (
      <div className="regional-buildings-management commercial-buildings-management">
        {buildCard}
        {buildingList}
      </div>
    )}
  </>;

''' + s[b:]
p.write_text(s)

p = Path('src/pages/production/ProductionFacilityDetail.tsx')
s = p.read_text()
s = "import { BuildingClusterCard } from '../../components/buildings/BuildingClusterCard';\n" + s
a = s.index('  return (', s.index('export function FacilityClusterSelectorCard'))
b = s.index('export function FacilityClusterInformation', a)
s = s[:a] + '''  return (
    <BuildingClusterCard
      name={type.name} status={group.status} count={group.count}
      artwork={<FacilityIcon facilityTypeId={type.id} className="facility-cluster-icon" />}
      profitValue={profit.visibleValue} profitTone={profit.tone}
      profitTitle={`${type.name}单厂平均利润／分钟；${profit.detail}`}
      ariaLabel={`${type.name}，数量 ${formatNumber(group.count)}，${facilityStatusLabel(group)}，每分钟平均利润：${profit.accessibleValue}`}
      onSelect={onSelect}
    />
  );
}

''' + s[b:]
p.write_text(s)

p = Path('scripts/verify-unified-factory-recipes-grid.mjs')
s = p.read_text()
a = s.index('for (const text of [', s.index('const selectorCardSource ='))
b = s.index("assert.equal(selectorCardSource.includes('×')", a)
s = s[:a] + '''for (const text of [
  '<BuildingClusterCard',
  'status={group.status}',
  'count={group.count}',
  '<FacilityIcon facilityTypeId={type.id} className="facility-cluster-icon" />',
  'profitValue={profit.visibleValue}',
  'profitTone={profit.tone}',
  'resolveFacilityProfitPresentation({',
]) assert.equal(selectorCardSource.includes(text), true, `工厂卡数据接入缺少: ${text}`);
const sharedBuildingCard = read('src/components/buildings/BuildingClusterCard.tsx');
for (const text of [
  '<button', 'type="button"', 'facility-cluster-selector-card',
  'data-ui-interactive="surface"', 'data-status={status}',
  'aria-label={ariaLabel}', 'onSelect(event.currentTarget)',
  'className="facility-cluster-name"',
  'className={`facility-cluster-profit is-${profitTone}`}',
  'className="facility-cluster-count"', '<CompactNumber value={count}',
]) assert.equal(sharedBuildingCard.includes(text), true, `共享建筑卡结构缺少: ${text}`);
assert.ok(read('src/pages/CommercePage.tsx').includes('<BuildingClusterCard'), '商业与工业必须共用同一展示组件');
''' + s[b:]
p.write_text(s)

# Keep rules at their existing owners; resolve obsolete geometry without changing economics.
p = Path('docs/PRODUCTION_PILL_ALIGNMENT_DESIGN.md')
s = p.read_text().replace('本文只负责地区建筑页工厂卡片、二级详情、共享标题轨道以及生产状态胶囊／开关的场景几何。',
  '本文只负责地区建筑页工业／商业卡片、二级详情、共享标题轨道以及运行状态胶囊／开关的场景几何。')
s += '''
## 6. 商业建筑同构展示

地区已拥有商业建筑与工业建筑共用 `BuildingClusterCard` 纯展示组件和本文的选择卡几何、状态颜色、整卡按钮、键盘焦点与二级详情规则；商业不得复制第二套网格、卡片、遮罩或响应式断点。商业详情共用 `MobileDetailSummary`、状态胶囊、紧凑开关、利润展示区和线性周期轨道，不创建独立滚动根或专用 Sheet。开关和状态区沿用工业摘要同一行的几何。

商业卡片与详情字段归 `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md`，插画与共享组件边界归 `UI_DESIGN_SYSTEM.md`，营业意图、周期锁定与消费规则归 `COMMERCIAL_BUILDINGS_DESIGN.md`；视觉共用不得带入工业满员率、配方或资产资格。

`tests/browser/commercial-buildings-layout.spec.ts` 对照工业基线验证 320px 起的三列比例、整卡和键盘导航、摘要与开关高度、长名称与大数量、异常与停止状态、权威周期和请求失败行为。
'''
p.write_text(s)

p = Path('docs/UI_DESIGN_SYSTEM.md')
s = p.read_text()
s = s.replace('工厂集群选择卡统一为最大宽度 `160px`、`4:5` 竖卡；',
  '地区工业／商业集群选择卡共用 `BuildingClusterCard`，列数和尺寸唯一遵守 `PRODUCTION_PILL_ALIGNMENT_DESIGN.md`；')
s = s.replace('除建筑页工厂紧凑开关', '除建筑页工业／商业紧凑开关')
s = s.replace('## 6. 设计令牌、按钮与表单', '''### 5.5 商业建筑场景插画与共享卡片

商业建筑按 `commercialTypeId` 映射本地内联 SVG 店面场景，正式商业类型具有对应零售商品／服务的可辨识窗陈；未知类型使用通用商业店面，不得借用工业 ID 或工厂图片。场景无文字、人物、品牌或水印，按与工业相同的卡片和详情插画槽居中铺满；图像本身不包含状态、数量或利润。场景是装饰，建筑名称和业务状态由真实文字及可访问名称提供。

`BuildingClusterCard` 只接收名称、状态、数量、利润呈现、插画与点击回调，不接收商业或工业业务模型，不计算经济收益。两领域必须共用真实按钮与三处文字槽，不复制第二套卡片 DOM；局部几何归 `PRODUCTION_PILL_ALIGNMENT_DESIGN.md`。

## 6. 设计令牌、按钮与表单''')
p.write_text(s)

p = Path('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md')
s = p.read_text()
s = s.replace('### 1.1 跨页面表单状态隔离', '''### 商业建筑卡片与详情

商业列表的已拥有建筑整卡进入当前州二级详情，列表和详情不同时展示；返回恢复列表，地区标题导航继续使用本文的共享页面栈规则。卡片展示名称、单座稳定利润／分钟和总数量，状态及异常原因进入可访问名称，不保留额外“查看经营详情”按钮或重复数据列表。卡片与详情的几何唯一引用 `PRODUCTION_PILL_ALIGNMENT_DESIGN.md`。

商业详情按建筑摘要、经营收益、商品消耗、累计经营排列。摘要展示总数量、本周期参与数量、营业状态、单座稳定利润与营业意图开关；开关不代替周期状态，请求期间禁用重复操作，失败给出可见错误且不改写服务器状态。经营收益明确区分按全部建筑计算的额定利润／运营成本和服务器本周期锁定收入、锁定利润、已消费商品量；缺失锁定数据不得推导成额定值。商品消耗带正式商品插画与名称，需求明确为按全部建筑准备下一周期，库存只读当前州，不提供隐式采购按钮。累计保留营业收入、稳定利润及消费数量。不得为样式一致新增工业满员率、生产配置或无业务意义的零值资产字段。

### 1.1 跨页面表单状态隔离''')
paragraphs = s.split('\n\n')
for i, paragraph in enumerate(paragraphs):
    if paragraph.startswith('每种工厂类型最多一个集群。建筑页只显示'):
        paragraphs[i] = '每种工厂类型最多一个集群。地区建筑列表先展示建设区，再按正式目录排列已拥有工厂选择卡；点击进入同一地区内的二级详情，列表与详情不同时展示。桌面和移动复用同一详情内容，不打开专用工厂 Sheet。名称、单厂有效平均利润和总数量仍由选择卡展示，状态与异常原因保留可访问描述；列数、尺寸与场景几何唯一归 `PRODUCTION_PILL_ALIGNMENT_DESIGN.md`。'
p.write_text('\n\n'.join(paragraphs))

p = Path('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md')
s = p.read_text()
s = re.sub(r'^- 选择卡统一为 `4:5` 竖卡，宽度不得超过 `160px`。.*$',
  '- 工厂选择卡的字段和导航归 `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md`，尺寸、布局与详情承载归 `PRODUCTION_PILL_ALIGNMENT_DESIGN.md`；本业务文档不另设卡片限宽或移动弹层规则。', s, flags=re.M)
p.write_text(s)

p = Path('docs/COMMERCIAL_BUILDINGS_DESIGN.md')
s = p.read_text().replace('## 7. 防回退边界', '''商业营业意图开关与当前周期状态相互独立：关闭后续营业时，当前已投入周期仍保持服务器返回的营业中状态与参与数量。客户端只投影权威起止时间，进度到期保持完成并等待服务器结算，不使用取模生成新周期，不据此修改资金、累计统计或商品库存。单座、集群额定与本周期锁定值的页面归属由 `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md` 定义。

## 7. 防回退边界''')
p.write_text(s)

p = Path('tests/browser/runtime-harness.tsx')
s = p.read_text()
s = "import { CommercePage } from '../../src/pages/CommercePage';\nimport type { CommercialBuildingGroup } from '../../src/types/commercial';\n" + s
s = s.replace("'overview', 'map', 'production',", "'overview', 'map', 'commerce', 'production',")
fragment = Path('.github/commercial-harness-fragment.tsx').read_text()
fragment = fragment.replace('food: { available: 1, reserved: 0 }, beverage: { available: 0, reserved: 0 }', 'food: { ...base.game.inventories.food, available: 1 }, beverage: { ...base.game.inventories.beverage, available: 0 }')
s = s.replace("const runtimeView = view === 'overview'", fragment + "const runtimeView = view === 'commerce' ? <CommerceHarness /> : view === 'overview'")
p.write_text(s)
update('runtime-test.html', "'overview', 'map', 'production',", "'overview', 'map', 'commerce', 'production',")
