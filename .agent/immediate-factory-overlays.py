from __future__ import annotations

import sys
import textwrap
from pathlib import Path


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f"{label}: expected one occurrence, found {count}")
    return source.replace(before, after)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: immediate-factory-overlays.py <patch-script>")
    path = Path(sys.argv[1])
    source = path.read_text()

    pending_old = "replaceExact(runtime, '  group.pendingJoinCount = 0;\\n', '', 2);"
    pending_new = textwrap.dedent(
        """\
        replaceExact(runtime, '  group.participatingCount = 0;\\n  group.pendingJoinCount = 0;\\n', '  group.participatingCount = 0;\\n');
        replaceExact(runtime, '  group.participatingCount = count;\\n  group.pendingJoinCount = 0;\\n', '  group.participatingCount = count;\\n');"""
    )
    source = replace_once(source, pending_old, pending_new, "pendingJoinCount cleanup")

    formula_old = """replaceExact(
  formula,
  `      group.nextCycleCount,
      group.nextCycleEffectiveCount ?? group.nextCycleCount,
      group.nextCycleStaffingRateBps ?? group.staffingRateBps ?? 10_000,
`,
  `      group.productionAvailableCount ?? group.nextCycleCount ?? group.participatingCount,
      group.projectedEffectiveCount ?? group.nextCycleEffectiveCount ?? group.productionAvailableCount ?? group.nextCycleCount ?? group.participatingCount,
      group.staffingRateBps ?? 10_000,
`,
  2,
);"""
    formula_new = """replaceExact(
  formula,
  `      group.nextCycleCount,
      group.nextCycleEffectiveCount ?? group.nextCycleCount,
      group.nextCycleStaffingRateBps ?? group.staffingRateBps ?? 10_000,
`,
  `      group.productionAvailableCount ?? group.nextCycleCount ?? group.participatingCount,
      group.projectedEffectiveCount ?? group.nextCycleEffectiveCount ?? group.productionAvailableCount ?? group.nextCycleCount ?? group.participatingCount,
      group.staffingRateBps ?? 10_000,
`,
);
replaceExact(
  formula,
  `    group.nextCycleCount,
    group.nextCycleEffectiveCount ?? group.nextCycleCount,
    group.nextCycleStaffingRateBps ?? group.staffingRateBps ?? 10_000,
`,
  `    group.productionAvailableCount ?? group.nextCycleCount ?? group.participatingCount,
    group.projectedEffectiveCount ?? group.nextCycleEffectiveCount ?? group.productionAvailableCount ?? group.nextCycleCount ?? group.participatingCount,
    group.staffingRateBps ?? 10_000,
`,
  2,
);"""
    source = replace_once(source, formula_old, formula_new, "formula scope indentation")

    harness_old = "replaceExact(harness, '      pendingJoinCount: 0,\\n', '');"
    harness_new = "replaceRegex(harness, /^      pendingJoinCount: 0,\\n/m, '');"
    source = replace_once(source, harness_old, harness_new, "runtime harness queue cleanup")

    marker = "const remainingVisible = [\n"
    if source.count(marker) != 1:
        raise SystemExit(f"final verification marker: expected one occurrence, found {source.count(marker)}")

    extra = textwrap.dedent(
        r'''\
        replaceExact(
          runtime,
          `export function releaseFacilityAuctionQuantity(world, userId, typeId, quantity, now = Date.now()) {
          const account = world.players?.[String(userId)];
          const group = account ? groupFor(account, typeId) : null;
          const normalizedQuantity = normalizePositiveInteger(quantity, MAX_FACILITY_AUCTION_QUANTITY);
          if (!group || !normalizedQuantity) return result(false, '拍卖工厂不存在');
          const previousAvailable = availableGroupCount(world, account, group);
          const nextAvailable = Math.min(group.count, previousAvailable + normalizedQuantity);
          expandAvailableFacilities(group, previousAvailable, nextAvailable, now);
          return result(true, '工厂拍卖已解冻并直接恢复运行资格');
        }
        `,
          `export function releaseFacilityAuctionQuantity(
          world,
          userId,
          typeId,
          quantity,
          now = Date.now(),
          assumeReserved = false,
        ) {
          const account = world.players?.[String(userId)];
          const group = account ? groupFor(account, typeId) : null;
          const normalizedQuantity = normalizePositiveInteger(quantity, MAX_FACILITY_AUCTION_QUANTITY);
          if (!group || !normalizedQuantity) return result(false, '拍卖工厂不存在');
          delete group.pendingJoinCount;
          const currentAvailable = availableGroupCount(world, account, group);
          const previousAvailable = assumeReserved
            ? Math.max(0, currentAvailable - normalizedQuantity)
            : currentAvailable;
          const nextAvailable = Math.min(group.count, previousAvailable + normalizedQuantity);
          expandAvailableFacilities(group, previousAvailable, nextAvailable, now);
          return result(true, '工厂拍卖已解冻并直接恢复运行资格');
        }
        `,
        );
        replaceExact(
          auctionRuntime,
          'function releaseItems(world, sellerId, items, now) {\n',
          'function releaseItems(world, sellerId, items, now, assumeReserved = false) {\n',
        );
        replaceExact(
          auctionRuntime,
          '      releaseFacilityAuctionQuantity(world, sellerId, item.assetId, item.quantity, now);\n',
          '      releaseFacilityAuctionQuantity(world, sellerId, item.assetId, item.quantity, now, assumeReserved);\n',
        );
        replaceExact(
          auctionRuntime,
          "    releaseItems(world, auction.sellerId, items.filter((item) => item.assetKind !== 'collectible'), now);\n",
          "    releaseItems(world, auction.sellerId, items.filter((item) => item.assetKind !== 'collectible'), now, true);\n",
        );

        const auctionTest = 'server/test/asset-auctions.test.js';
        replaceExact(
          auctionTest,
          "  assert.equal(sellerAccount.facilityGroups[0].pendingJoinCount, 1);\n",
          `  assert.equal(sellerAccount.facilityGroups[0].participatingCount, 2);
          assert.equal(sellerAccount.facilityGroups[0].staffingRateBps, 5_000);
          assert.equal(sellerAccount.facilityGroups[0].cycleStaffingRateBps, 5_000);
          assert.equal(Object.hasOwn(sellerAccount.facilityGroups[0], 'pendingJoinCount'), false);
        `,
        );
        replaceExact(
          methodTest,
          '  assert.equal(farm.lifetimeOutput, 4);\n',
          '  assert.equal(player.facilityGroups[0].lifetimeOutput, 4);\n',
        );
        replaceRegex(
          detail,
          /        <div className="facility-production-settings-heading">\n          <strong>生产设置<\/strong>\n        <\/div>/,
          `        <div className="facility-production-settings-heading">
          <strong>生产设置</strong>
          <small className="facility-recipe-status">
            配置切换结果会提示“生产进度已清零”，并同步降低满员率。
          </small>
        </div>`,
        );
        replaceExact(
          industryDoc,
          '- 运行中切换生产产物或作业制度立即写入新的 `activeRecipeId`；动作时间点之前已经完成的完整周期先正常结算，未完成周期不扣费、不耗料、不产出。\n',
          '- 生产配置切换立即写入 `activeRecipeId`，生产进度立即清零，并在同一次原子动作中降低满员率。\n- 运行中切换生产产物或作业制度立即写入新的 `activeRecipeId`；动作时间点之前已经完成的完整周期先正常结算，未完成周期不扣费、不耗料、不产出。\n',
        );

        '''
    )
    source = source.replace(marker, extra + marker)
    path.write_text(source)


if __name__ == "__main__":
    main()
