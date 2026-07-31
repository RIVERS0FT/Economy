# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: game-shell-layout.spec.ts >> full-width signed-in game shell >> sidebar collapse keeps the inset status bar and page on the same workspace track
- Location: tests/browser/game-shell-layout.spec.ts:228:3

# Error details

```
Error: expect(received).toBeCloseTo(expected, precision)

Expected: 12
Received: 12.515625

Expected precision:    0
Expected difference: < 0.5
Received difference:   0.515625
```

# Page snapshot

```yaml
- main [ref=e3]:
  - complementary [ref=e4]:
    - button "展开侧栏" [active] [ref=e7] [cursor=pointer]:
      - img [ref=e8]
    - navigation "游戏主导航" [ref=e10]:
      - generic [ref=e12]:
        - button "概览" [ref=e13] [cursor=pointer]:
          - img [ref=e15]
        - button "市场" [ref=e18] [cursor=pointer]:
          - img [ref=e20]
        - button "生产" [ref=e22] [cursor=pointer]:
          - img [ref=e24]
        - button "拍卖" [ref=e26] [cursor=pointer]:
          - img [ref=e28]
        - button "合同" [ref=e31] [cursor=pointer]:
          - img [ref=e33]
        - button "银行" [ref=e36] [cursor=pointer]:
          - img [ref=e38]
        - button "排行" [ref=e41] [cursor=pointer]:
          - img [ref=e43]
        - button "商店" [ref=e45] [cursor=pointer]:
          - img [ref=e47]
        - button "设置" [ref=e49] [cursor=pointer]:
          - img [ref=e51]
    - generic [ref=e54]:
      - link "加入 QQ 群（在新窗口打开）" [ref=e55] [cursor=pointer]:
        - /url: https://qm.qq.com/q/eN8hya0Yn0
        - img [ref=e56]
      - button "退出登录" [ref=e60] [cursor=pointer]:
        - img [ref=e61]
  - generic [ref=e63]:
    - generic [ref=e67]:
      - generic [ref=e68]:
        - generic [ref=e69]:
          - heading "晚上好，MEVIUS" [level=1] [ref=e70]
          - paragraph [ref=e71]: 优先处理生产、仓库与订单提醒，并领取服务器每日签到奖励。
        - generic [ref=e72]:
          - generic [ref=e73]: 经营状态正常
          - button "进入市场" [ref=e74] [cursor=pointer]
      - generic [ref=e76]:
        - generic [ref=e77]:
          - article [ref=e78]:
            - generic [ref=e79]:
              - heading "今日经营" [level=2] [ref=e80]
              - generic [ref=e81]:
                - text: 工作收益
                - generic [ref=e82]:
                  - img [ref=e83]
                  - generic [ref=e86]: "1.00"
            - generic [ref=e87]:
              - generic [ref=e88]:
                - strong [ref=e89]: 基础工作
                - generic [ref=e90]: 固定 3s 冷却，为产业调整提供兜底资金。
              - button "开始工作" [ref=e91] [cursor=pointer]
            - generic [ref=e92]:
              - generic [ref=e93]:
                - strong [ref=e94]: 经营提醒
                - generic [ref=e95]: 按仓库、生产、订单和停工优先级排列
              - generic [ref=e96]: "0"
            - generic [ref=e98]: 当前没有需要立即处理的经营异常。
          - article [ref=e99]:
            - generic [ref=e100]:
              - heading "本周签到" [level=2] [ref=e101]
              - generic [ref=e102]: 3 / 7 天
            - generic [ref=e103]:
              - generic [ref=e104]:
                - generic [ref=e105]: 每日签到
                - strong [ref=e106]:
                  - img [ref=e107]
                  - text: +1 宝石
              - generic [ref=e109]:
                - generic [ref=e110]: 本周全勤
                - strong [ref=e111]:
                  - img [ref=e112]
                  - text: +5 宝石
            - list "本周签到日历" [ref=e114]:
              - listitem "周一 07-13 已签" [ref=e115]:
                - generic [ref=e116]: 周一
                - strong [ref=e117]: 07-13
                - generic [ref=e118]: 已签
              - listitem "周二 07-14 已签" [ref=e119]:
                - generic [ref=e120]: 周二
                - strong [ref=e121]: 07-14
                - generic [ref=e122]: 已签
              - listitem "周三 07-15 漏签" [ref=e123]:
                - generic [ref=e124]: 周三
                - strong [ref=e125]: 07-15
                - generic [ref=e126]: 漏签
              - listitem "周四 07-16 已签" [ref=e127]:
                - generic [ref=e128]: 周四
                - strong [ref=e129]: 07-16
                - generic [ref=e130]: 已签
              - listitem "周五 07-17 今日" [ref=e131]:
                - generic [ref=e132]: 周五
                - strong [ref=e133]: 07-17
                - generic [ref=e134]: 今日
              - listitem "周六 07-18 未到" [ref=e135]:
                - generic [ref=e136]: 周六
                - strong [ref=e137]: 07-18
                - generic [ref=e138]: 未到
              - listitem "周日 07-19 未到" [ref=e139]:
                - generic [ref=e140]: 周日
                - strong [ref=e141]: 07-19
                - generic [ref=e142]: 未到
            - generic [ref=e143]:
              - generic [ref=e144]:
                - strong [ref=e145]: 连续签到 7 天可额外获得 5 宝石
                - generic [ref=e146]: 签到日期由服务器按北京时间判定，不支持补签。
              - button "签到领取 1 宝石" [ref=e147] [cursor=pointer]
        - article [ref=e148]:
          - generic [ref=e149]:
            - heading "公开经济事件日历" [level=2] [ref=e150]
            - generic [ref=e151]: 未来 7 天
          - paragraph [ref=e152]: 事件只调整既有人口直接需求的类别与商品选择权重；人口总预算、直接／派生预算、市场储备和货币发行均保持不变。
          - list "未来七天公开经济事件" [ref=e153]:
            - generic [ref=e154]: 未来七天暂无已公布的经济事件。
        - generic [ref=e155]:
          - article [ref=e156]:
            - generic [ref=e157]:
              - heading "生产摘要" [level=2] [ref=e158]
              - button "管理工厂" [ref=e159] [cursor=pointer]
            - generic [ref=e160]:
              - generic [ref=e161]:
                - term [ref=e162]: 工厂总数
                - definition [ref=e163]: "18"
              - generic [ref=e164]:
                - term [ref=e165]: 正在运行
                - definition [ref=e166]: "12"
              - generic [ref=e167]:
                - term [ref=e168]: 生产受阻
                - definition [ref=e169]: "0"
              - generic [ref=e170]:
                - term [ref=e171]: 主动停工
                - definition [ref=e172]: "0"
              - generic [ref=e173]:
                - term [ref=e174]: 理论日产量
                - definition [ref=e175]: 8,640
            - generic [ref=e176]:
              - generic [ref=e177]: 施工 0
              - generic [ref=e178]: 下一周期加入 0
              - generic [ref=e179]: 待改种 0 组
          - article [ref=e180]:
            - generic [ref=e181]:
              - heading "资产与银行" [level=2] [ref=e182]
              - button "查看详情" [ref=e183] [cursor=pointer]
            - generic [ref=e184]:
              - generic [ref=e185]:
                - term [ref=e186]: 现金资产
                - definition [ref=e187]:
                  - generic [ref=e188]:
                    - img [ref=e189]
                    - generic [ref=e192]: "370.00"
              - generic [ref=e193]:
                - term [ref=e194]: 商品估值
                - definition [ref=e195]:
                  - generic [ref=e196]:
                    - img [ref=e197]
                    - generic [ref=e200]: 27,260.00
              - generic [ref=e201]:
                - term [ref=e202]: 工厂估值
                - definition [ref=e203]:
                  - generic [ref=e204]:
                    - img [ref=e205]
                    - generic [ref=e208]: 69,156.00
              - generic [ref=e209]:
                - term [ref=e210]: 冻结资金
                - definition [ref=e211]:
                  - generic [ref=e212]:
                    - img [ref=e213]
                    - generic [ref=e216]: "0.00"
            - generic [ref=e217]:
              - strong [ref=e218]: 资产状态
              - generic [ref=e219]: 服务器权威结果
            - generic [ref=e220]:
              - generic [ref=e221]:
                - term [ref=e222]: 可支配资产
                - definition [ref=e223]:
                  - generic [ref=e224]:
                    - img [ref=e225]
                    - generic [ref=e228]: 96,786.00
              - generic [ref=e229]:
                - term [ref=e230]: 冻结资产
                - definition [ref=e231]:
                  - generic [ref=e232]:
                    - img [ref=e233]
                    - generic [ref=e236]: "0.00"
              - generic [ref=e237]:
                - term [ref=e238]: 贷款负债
                - definition [ref=e239]:
                  - generic [ref=e240]:
                    - img [ref=e241]
                    - generic [ref=e244]: "0.00"
          - article [ref=e245]:
            - generic [ref=e246]:
              - heading "当前挂单" [level=2] [ref=e247]
              - button "管理订单" [ref=e248] [cursor=pointer]
            - generic [ref=e249]:
              - generic [ref=e250]:
                - term [ref=e251]: 买单
                - definition [ref=e252]: 0 笔
              - generic [ref=e253]:
                - term [ref=e254]: 卖单
                - definition [ref=e255]: 0 笔
              - generic [ref=e256]:
                - term [ref=e257]: 冻结资金
                - definition [ref=e258]:
                  - generic [ref=e259]:
                    - img [ref=e260]
                    - generic [ref=e263]: "0.00"
            - generic [ref=e265]: 当前没有未完成订单。
    - generic "玩家状态" [ref=e267]:
      - generic [ref=e269]:
        - img
        - generic [ref=e274]:
          - group "可用资金" [ref=e275]:
            - generic [ref=e276]: 可用资金
            - strong [ref=e277]:
              - generic [ref=e279]:
                - img [ref=e280]
                - generic [ref=e283]: "2.00"
              - generic [ref=e285]:
                - img [ref=e286]
                - generic [ref=e289]: "2.00"
            - generic [ref=e290]:
              - text: 冻结
              - generic [ref=e291]:
                - img [ref=e292]
                - generic [ref=e295]: "0.00"
          - button "净资产，打开详情" [ref=e296] [cursor=pointer]:
            - generic [ref=e297]: 净资产
            - strong [ref=e298]:
              - generic [ref=e300]:
                - img [ref=e301]
                - generic [ref=e304]: 96,786.00
              - generic [ref=e306]:
                - img [ref=e307]
                - generic [ref=e310]: 96,786.00
            - generic "本周净资产下降 116,543.00" [ref=e312]:
              - text: ↓ 本周
              - generic [ref=e313]:
                - img [ref=e314]
                - generic [ref=e317]: 116,543.00
          - group "宝石" [ref=e318]:
            - generic [ref=e319]: 宝石
            - strong [ref=e320]: "44"
            - generic [ref=e321]: 邀请好友可获得宝石
          - group "排行榜" [ref=e322]:
            - generic [ref=e323]: 排行榜
            - strong [ref=e324]: "#1#1"
            - generic [ref=e325]: 当前位于榜首
          - group "仓库剩余" [ref=e326]:
            - generic [ref=e327]: 仓库剩余
            - strong [ref=e328]: 1,3351,335
            - generic [ref=e329]: 已用 5,315/6,650
```

# Test source

```ts
  36  |     const pageScrollbarRail = pageScrollArea?.querySelector<HTMLElement>(':scope > .ui-scrollbar--vertical');
  37  |     const pageScrollbarThumb = pageScrollbarRail?.querySelector<HTMLElement>('.ui-scrollbar__thumb');
  38  |     const primaryCards = primaryGrid
  39  |       ? [...primaryGrid.children].filter((child): child is HTMLElement => child instanceof HTMLElement).slice(0, 2)
  40  |       : [];
  41  |     if (
  42  |       !shell
  43  |       || !sidebar
  44  |       || !workspace
  45  |       || !assetBar
  46  |       || !pageScrollArea
  47  |       || !pageScroll
  48  |       || !pageContent
  49  |       || !contentGrid
  50  |       || !primaryGrid
  51  |       || !pageScrollbarRail
  52  |       || !pageScrollbarThumb
  53  |       || primaryCards.length < 2
  54  |     ) {
  55  |       throw new Error('game shell geometry fixture is incomplete');
  56  |     }
  57  | 
  58  |     const rect = (element: HTMLElement) => {
  59  |       const box = element.getBoundingClientRect();
  60  |       return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
  61  |     };
  62  |     const shellStyle = getComputedStyle(shell);
  63  |     const workspaceStyle = getComputedStyle(workspace);
  64  |     const pageContentStyle = getComputedStyle(pageContent);
  65  |     const pageContentRect = pageContent.getBoundingClientRect();
  66  |     const contentGridRect = contentGrid.getBoundingClientRect();
  67  |     const firstCardRect = primaryCards[0].getBoundingClientRect();
  68  |     const secondCardRect = primaryCards[1].getBoundingClientRect();
  69  |     const pageScrollbarRailRect = pageScrollbarRail.getBoundingClientRect();
  70  |     const pageScrollbarThumbRect = pageScrollbarThumb.getBoundingClientRect();
  71  |     const paddingRight = Number.parseFloat(pageContentStyle.paddingRight) || 0;
  72  |     const primaryCardGap = secondCardRect.left >= firstCardRect.right - 1
  73  |       ? secondCardRect.left - firstCardRect.right
  74  |       : secondCardRect.top - firstCardRect.bottom;
  75  | 
  76  |     return {
  77  |       viewportWidth: document.documentElement.clientWidth,
  78  |       viewportHeight: document.documentElement.clientHeight,
  79  |       shell: rect(shell),
  80  |       sidebar: rect(sidebar),
  81  |       workspace: rect(workspace),
  82  |       assetBar: rect(assetBar),
  83  |       pageScroll: rect(pageScrollArea),
  84  |       pageContent: {
  85  |         left: pageContentRect.left,
  86  |         width: pageContentRect.width,
  87  |         right: pageContentRect.right,
  88  |         contentRight: pageContentRect.right - paddingRight,
  89  |       },
  90  |       contentGrid: {
  91  |         left: contentGridRect.left,
  92  |         right: contentGridRect.right,
  93  |       },
  94  |       primaryCardGap,
  95  |       pageScrollbar: {
  96  |         railRight: pageScrollbarRailRect.right,
  97  |         thumbRight: pageScrollbarThumbRect.right,
  98  |       },
  99  |       pageScrollClientWidth: pageScroll.clientWidth,
  100 |       pageScrollHasHorizontalOverflow: pageScroll.scrollWidth > pageScroll.clientWidth + 1,
  101 |       shellGap: shellStyle.gap,
  102 |       shellPadding: [
  103 |         shellStyle.paddingTop,
  104 |         shellStyle.paddingRight,
  105 |         shellStyle.paddingBottom,
  106 |         shellStyle.paddingLeft,
  107 |       ],
  108 |       workspaceMargin: [
  109 |         workspaceStyle.marginTop,
  110 |         workspaceStyle.marginRight,
  111 |         workspaceStyle.marginBottom,
  112 |         workspaceStyle.marginLeft,
  113 |       ],
  114 |       pageContentMaxWidth: pageContentStyle.maxWidth,
  115 |       pageContentMargin: [pageContentStyle.marginLeft, pageContentStyle.marginRight],
  116 |       pageContentPadding: [
  117 |         pageContentStyle.paddingLeft,
  118 |         pageContentStyle.paddingRight,
  119 |         pageContentStyle.paddingBottom,
  120 |       ],
  121 |     };
  122 |   });
  123 | }
  124 | 
  125 | function expectUnifiedDesktopGutter(layout: ShellGeometry, gutter: number) {
  126 |   expect(layout.shell.left).toBeCloseTo(0, 0);
  127 |   expect(layout.shell.top).toBeCloseTo(0, 0);
  128 |   expect(layout.shell.right).toBeCloseTo(layout.viewportWidth, 0);
  129 |   expect(layout.shell.bottom).toBeCloseTo(layout.viewportHeight, 0);
  130 |   expect(layout.shellGap).toBe('0px');
  131 |   expect(layout.shellPadding).toEqual(['0px', '0px', '0px', '0px']);
  132 | 
  133 |   expect(layout.sidebar.left).toBeCloseTo(gutter, 0);
  134 |   expect(layout.sidebar.top).toBeCloseTo(gutter, 0);
  135 |   expect(layout.viewportHeight - layout.sidebar.bottom).toBeCloseTo(gutter, 0);
> 136 |   expect(layout.workspace.left - layout.sidebar.right).toBeCloseTo(gutter, 0);
      |                                                        ^ Error: expect(received).toBeCloseTo(expected, precision)
  137 | 
  138 |   expect(layout.workspace.top).toBeCloseTo(0, 0);
  139 |   expect(layout.workspace.right).toBeCloseTo(layout.viewportWidth, 0);
  140 |   expect(layout.workspace.bottom).toBeCloseTo(layout.viewportHeight, 0);
  141 |   expect(layout.workspaceMargin).toEqual(['0px', '0px', '0px', '0px']);
  142 | 
  143 |   expect(layout.assetBar.left).toBeCloseTo(layout.workspace.left, 0);
  144 |   expect(layout.assetBar.left - layout.sidebar.right).toBeCloseTo(gutter, 0);
  145 |   expect(layout.assetBar.top - layout.workspace.top).toBeCloseTo(gutter, 0);
  146 |   expect(layout.workspace.right - layout.assetBar.right).toBeCloseTo(gutter, 0);
  147 | 
  148 |   expect(layout.pageScroll.left).toBeCloseTo(layout.workspace.left, 0);
  149 |   expect(layout.pageScroll.top).toBeCloseTo(layout.workspace.top, 0);
  150 |   expect(layout.pageScroll.right).toBeCloseTo(layout.workspace.right, 0);
  151 |   expect(layout.pageScroll.bottom).toBeCloseTo(layout.workspace.bottom, 0);
  152 | 
  153 |   expect(layout.pageContent.left).toBeCloseTo(layout.pageScroll.left, 0);
  154 |   expect(layout.pageContent.width).toBeCloseTo(layout.pageScrollClientWidth, 0);
  155 |   expect(layout.pageContent.right).toBeLessThanOrEqual(layout.pageScroll.right + 1);
  156 |   expect(layout.pageContent.contentRight).toBeCloseTo(layout.assetBar.right, 0);
  157 |   expect(layout.contentGrid.left).toBeCloseTo(layout.assetBar.left, 0);
  158 |   expect(layout.contentGrid.right).toBeCloseTo(layout.assetBar.right, 0);
  159 |   expect(layout.primaryCardGap).toBeCloseTo(gutter, 0);
  160 |   expect(layout.pageContentMaxWidth).toBe('none');
  161 |   expect(layout.pageContentMargin).toEqual(['0px', '0px']);
  162 |   expect(layout.pageContentPadding).toEqual(['0px', `${gutter}px`, `${gutter}px`]);
  163 |   expect(layout.pageScrollHasHorizontalOverflow).toBe(false);
  164 | 
  165 |   expect(layout.pageScrollbar.railRight).toBeCloseTo(layout.viewportWidth, 0);
  166 |   expect(layout.pageScrollbar.thumbRight).toBeCloseTo(layout.viewportWidth, 0);
  167 | }
  168 | 
  169 | test.describe('full-width signed-in game shell', () => {
  170 |   test('desktop shell uses one 12px gutter for sidebar, status bar, cards and page edges', async ({ page }) => {
  171 |     await page.setViewportSize({ width: 1684, height: 931 });
  172 |     await page.goto('runtime-test.html?view=overview&scenario=empty');
  173 |     await expect(page.locator('.game-shell')).toBeVisible();
  174 |     await expect(page.locator('.workspace')).toBeVisible();
  175 |     await expect(page.locator('.asset-bar')).toBeVisible();
  176 |     await expect(page.locator('.page-scroll-area')).toBeVisible();
  177 |     await expect(page.locator('.page-content')).toBeVisible();
  178 | 
  179 |     expectUnifiedDesktopGutter(await readShellGeometry(page), 12);
  180 |   });
  181 | 
  182 |   test('compact desktop width uses the same 8px gutter everywhere', async ({ page }) => {
  183 |     await page.setViewportSize({ width: 900, height: 900 });
  184 |     await page.goto('runtime-test.html?view=overview&scenario=empty');
  185 |     await expect(page.locator('.game-shell')).toBeVisible();
  186 | 
  187 |     expectUnifiedDesktopGutter(await readShellGeometry(page), 8);
  188 |   });
  189 | 
  190 |   test('short desktop height uses the same 8px gutter everywhere', async ({ page }) => {
  191 |     await page.setViewportSize({ width: 1440, height: 700 });
  192 |     await page.goto('runtime-test.html?view=overview&scenario=empty');
  193 |     await expect(page.locator('.game-shell')).toBeVisible();
  194 | 
  195 |     expectUnifiedDesktopGutter(await readShellGeometry(page), 8);
  196 |   });
  197 | 
  198 |   test('desktop navigation rows keep intrinsic height and stack from the top', async ({ page }) => {
  199 |     await page.setViewportSize({ width: 1684, height: 931 });
  200 |     await page.goto('runtime-test.html?view=overview&scenario=empty');
  201 | 
  202 |     const navigation = page.locator('.desktop-sidebar .sidebar-nav');
  203 |     const buttons = navigation.locator('.sidebar-nav-button');
  204 |     await expect(navigation).toBeVisible();
  205 |     await expect(buttons).toHaveCount(9);
  206 | 
  207 |     const geometry = await navigation.evaluate((element) => {
  208 |       const navRect = element.getBoundingClientRect();
  209 |       const rows = [...element.querySelectorAll<HTMLElement>('.sidebar-nav-button')]
  210 |         .map((button) => button.getBoundingClientRect());
  211 |       return {
  212 |         alignContent: getComputedStyle(element).alignContent,
  213 |         gridAutoRows: getComputedStyle(element).gridAutoRows,
  214 |         firstOffset: rows[0]?.top - navRect.top,
  215 |         heights: rows.map((row) => row.height),
  216 |         gaps: rows.slice(1).map((row, index) => row.top - rows[index].bottom),
  217 |       };
  218 |     });
  219 | 
  220 |     expect(geometry.alignContent).toBe('start');
  221 |     expect(geometry.gridAutoRows).toBe('max-content');
  222 |     expect(geometry.firstOffset).toBeCloseTo(0, 0);
  223 |     expect(Math.max(...geometry.heights)).toBeLessThanOrEqual(56);
  224 |     expect(Math.min(...geometry.heights)).toBeGreaterThanOrEqual(40);
  225 |     expect(Math.max(...geometry.gaps)).toBeLessThanOrEqual(12);
  226 |   });
  227 | 
  228 |   test('sidebar collapse keeps the inset status bar and page on the same workspace track', async ({ page }) => {
  229 |     await page.setViewportSize({ width: 1684, height: 931 });
  230 |     await page.goto('runtime-test.html?view=overview&scenario=empty');
  231 | 
  232 |     const expanded = await readShellGeometry(page);
  233 |     expectUnifiedDesktopGutter(expanded, 12);
  234 | 
  235 |     await page.getByRole('button', { name: '折叠侧栏' }).click();
  236 |     await expect(page.locator('.desktop-sidebar')).toHaveAttribute('data-collapsed', 'true');
```