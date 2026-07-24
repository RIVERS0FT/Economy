import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../api/admin';
import { TextInput } from './ui/FormControls';
import { Button, Panel, WidgetHeading } from './ui/layout';

export function AdminCommunityLinkPanel({
  active,
  refreshToken,
  onNotice,
  onError,
}: {
  active: boolean;
  refreshToken: number;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [qqGroupUrl, setQqGroupUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadCommunityLink = useCallback(async () => {
    setLoading(true);
    try {
      const communityLink = await adminApi.communityLink();
      setQqGroupUrl(communityLink.qqGroupUrl);
      onError('');
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : '无法加载玩家社区入口');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    if (!active) return;
    void loadCommunityLink();
  }, [active, loadCommunityLink, refreshToken]);

  async function saveCommunityLink() {
    if (saving) return;
    setSaving(true);
    try {
      const saved = await adminApi.updateCommunityLink(qqGroupUrl.trim());
      setQqGroupUrl(saved.qqGroupUrl);
      onNotice('QQ群跳转链接已保存，玩家侧边栏将读取新地址。');
    } catch (reason) {
      onNotice(reason instanceof Error ? reason.message : '保存QQ群跳转链接失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel className="admin-panel admin-community-link-panel admin-overview-community">
      <WidgetHeading title="玩家社区入口" />
      <p>配置桌面侧边栏“加入 QQ 群”按钮的跳转地址，仅接受 HTTPS 链接。</p>
      <TextInput
        label="QQ群跳转链接"
        type="url"
        inputMode="url"
        maxLength={2048}
        value={qqGroupUrl}
        disabled={loading}
        onChange={(event) => setQqGroupUrl(event.target.value)}
        placeholder="https://qm.qq.com/q/..."
      />
      <Button disabled={saving || loading} onClick={() => void saveCommunityLink()}>
        {saving ? '正在保存…' : loading ? '正在读取…' : '保存链接'}
      </Button>
    </Panel>
  );
}
