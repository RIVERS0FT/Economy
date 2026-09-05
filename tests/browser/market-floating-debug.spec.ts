import { test, expect } from '@playwright/test';
test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 1000 } });
test('inspect first touch tooltip coordinate conversion', async ({ page }) => {
  await page.goto('market-runtime-test.html?scenario=freeze-details');
  const chart = page.locator('.market-history-chart.full');
  await expect(chart.locator('.economy-chart')).toHaveAttribute('data-echarts-ready', 'true');
  await chart.scrollIntoViewIfNeeded();
  const selected = await chart.evaluate(el => {
    const r=el.getBoundingClientRect(); const e=el as HTMLElement;
    return {x:r.x+Number(e.dataset.axisLeft)+(r.width-Number(e.dataset.axisLeft)-Number(e.dataset.axisRight))*.502,y:r.y+(Number(e.dataset.priceTop)+Number(e.dataset.priceBottom))/2};
  });
  await page.touchscreen.tap(selected.x, selected.y);
  for (const delay of [0, 300, 1000]) {
    if (delay) await page.waitForTimeout(delay);
    const result=await page.evaluate(() => {
      const info=(el:Element|null):unknown=>{
        if (!el) return null;
        const e=el as HTMLElement; const r=el.getBoundingClientRect();const cs=getComputedStyle(el);
        const saved=(el as any).___zrEVENTSAVED;
        return {tag:el.tagName,cl:el.className,rect:{x:r.x,y:r.y,width:r.width,height:r.height},offset:[e.offsetLeft,e.offsetTop],offsetParent:e.offsetParent?.className,position:cs.position,transform:cs.transform,scroll:[e.scrollLeft,e.scrollTop],saved:saved?{srcCoords:saved.srcCoords,markers:saved.markers?.map((m:Element)=>info(m))}:undefined};
      };
      const canvas=document.querySelector('.market-history-chart .economy-chart__canvas');
      return {window:[innerWidth,innerHeight,scrollX,scrollY],selectedCanvas:info(canvas),root:info(canvas?.firstElementChild??null),host:info(document.querySelector('.workspace-tooltip-layer')),tooltip:info(document.querySelector('.economy-chart-tooltip')),scrolls:[...document.querySelectorAll('.page-card-scroll,.mobile-detail-sheet-scroll')].map(info)};
    });
    console.log('MARKET_COORD',delay,JSON.stringify(result));
  }
});
