import { useCallback, useEffect, useState } from 'react';
import { adminApi, type ExtendedAdminSummary } from '../api/admin';
import { AdminBanPanel } from '../components/AdminBanPanel';
import { AdminGiftCodesSection } from '../components/AdminGiftCodesSection';
import { AdminOverview } from '../components/AdminOverview';
import { AdminPlayerSection } from '../components/AdminPlayerSection';
import { AdminPopulationSection } from '../components/AdminPopulationSection';
import {
  AdminMobileNavigation,
  AdminSidebar,
  type AdminSectionId,
} from '../components/shell/AdminSidebar';
import { AdminDesktopBar } from '../components/shell/AdminDesktopBar';
import { SignedInShell } from '../components/shell/SignedInShell';
import { CurrencyText } from '../components/ui/CurrencyAmount';
import { Button, PageLayout } from '../components/ui/layout';
import type { AuthUser } from '../types';

const ADMIN_SECTION_COPY: Record<AdminSectionId, { title: string; description: string }> = {
  overview: { title: '世界概览', description: '查看 Economy 世界状态、核心运营指标与玩家社区入口。' },
  players: { title: '玩家运营', description: '分析玩家活跃、留存、经营成长、参与结构与财富分布。' },
  population: { title: '人口经济', description: '查看人口健康、就业资金流并执行受控人口政策调控。' },
  'gift-codes': { title: '礼品码', description: '创建、停用礼品码并审阅玩家兑换记录。' },
  bans: { title: '账号封禁', description: '复核同 IP 多账号事件并调整账号封禁状态。' },
};

const INITIAL_REFRESH_TOKENS: Record<AdminSectionId, number> = {
  overview: 0,
  players: 0,
  population: 0,
  'gift-codes': 0,
  bans: 0,
};

export function AdminApp({ user }: { user: AuthUser }) {
  const [activeSection, setActiveSection] = useState<AdminSectionId>('overview');
  const [visitedSections, setVisitedSections] = useState<Set<AdminSectionId>>(() => new Set(['overview']));
  const [refreshTokens, setRefreshTokens] = useState(INITIAL_REFRESH_TOKENS);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [summary, setSummary] = useState<ExtendedAdminSummary | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadOverview = useCallback(async () => {
    try {
      setSummary(await adminApi.summary());
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法加载世界概览');
    }
  }, []);

  useEffect(() => {
    setVisitedSections((current) => {
      if (current.has(activeSection)) return current;
      const next = new Set(current);
      next.add(activeSection);
      return next;
    });
    if (activeSection === 'overview') void loadOverview();
    if (activeSection === 'bans') {
      setRefreshTokens((current) => ({ ...current, bans: current.bans + 1 }));
    }
  }, [activeSection, loadOverview]);

  if (user.role !== 'admin') {
    return <main className="admin-shell admin-denied"><section><h1>无权访问</h1><p>当前账号不是 Economy 管理员。</p><a href="/economy/">返回游戏</a></section></main>;
  }

  function refreshActiveSection() {
    setNotice('');
    setError('');
    if (activeSection === 'overview') void loadOverview();
    setRefreshTokens((current) => ({
      ...current,
      [activeSection]: current[activeSection] + 1,
    }));
  }

  return (
    <SignedInShell
      rootClassName="admin-shell"
      workspaceClassName="admin-workspace"
      pageViewportClassName="admin-page-scroll"
      pageFrameClassName="admin-page-frame"
      chromeOverlayClassName="admin-mobile-chrome-layer"
      adminChromeLayer
      sidebarCollapsed={sidebarCollapsed}
      sidebar={(
        <AdminSidebar
email={user.email}
activeSection={activeSection}
collapsed={sidebarCollapsed}
onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
onSelect={setActiveSection}
        />
      )}
      chrome={(
        <>
<AdminDesktopBar
  title={ADMIN_SECTION_COPY[activeSection].title}
  description={ADMIN_SECTION_COPY[activeSection].description}
  email={user.email}
  worldVersion={summary?.worldVersion}
  apiStatus={summary?.apiStatus}
  onRefresh={refreshActiveSection}
/>
<AdminMobileNavigation activeSection={activeSection} onSelect={setActiveSection} />
        </>
      )}
    >
      <PageLayout
        title={ADMIN_SECTION_COPY[activeSection].title}
        description={ADMIN_SECTION_COPY[activeSection].description}
        actions={<Button variant="secondary" onClick={refreshActiveSection}>刷新当前分区</Button>}
      >
        {error ? <div className="admin-alert danger" role="alert"><CurrencyText>{error}</CurrencyText></div> : null}
        {notice ? <div className="admin-alert" role="status"><CurrencyText>{notice}</CurrencyText></div> : null}

        {visitedSections.has('overview') ? (
<div className="admin-section-view" hidden={activeSection !== 'overview'}>
  <AdminOverview
    active={activeSection === 'overview'}
    summary={summary}
    refreshToken={refreshTokens.overview}
    onNotice={setNotice}
    onError={setError}
  />
</div>
        ) : null}

        {visitedSections.has('players') ? (
<div className="admin-section-view" hidden={activeSection !== 'players'}>
  <AdminPlayerSection
    active={activeSection === 'players'}
    refreshToken={refreshTokens.players}
    onError={setError}
  />
</div>
        ) : null}

        {visitedSections.has('population') ? (
<div className="admin-section-view" hidden={activeSection !== 'population'}>
  <AdminPopulationSection
    active={activeSection === 'population'}
    refreshToken={refreshTokens.population}
    onNotice={setNotice}
    onError={setError}
  />
</div>
        ) : null}

        {visitedSections.has('gift-codes') ? (
<div className="admin-section-view" hidden={activeSection !== 'gift-codes'}>
  <AdminGiftCodesSection
    active={activeSection === 'gift-codes'}
    refreshToken={refreshTokens['gift-codes']}
    onNotice={setNotice}
    onError={setError}
  />
</div>
        ) : null}

        {visitedSections.has('bans') ? (
<div className="admin-section-view" hidden={activeSection !== 'bans'}>
  <AdminBanPanel onNotice={setNotice} refreshToken={refreshTokens.bans} />
</div>
        ) : null}
      </PageLayout>
    </SignedInShell>
  );
}
