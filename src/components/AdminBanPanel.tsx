import { useEffect, useState } from 'react';
import { adminApi, type BanIncidentDetails, type BanIncidentSummary } from '../api/admin';
import { formatDate, formatTime } from '../utils/formatters';
import { TextArea } from './ui/FormControls';
import { Button, EmptyState, Panel, StatusTag, WidgetHeading } from './ui/layout';
import { VirtualList } from './ui/VirtualList';

function incidentKey(incident: BanIncidentSummary) {
  return incident.id;
}

function incidentLabel(status: BanIncidentSummary['status']) {
  if (status === 'reviewed') return '已复核';
  if (status === 'closed') return '已关闭';
  return '待复核';
}

export function AdminBanPanel({
  onNotice,
  refreshToken = 0,
}: {
  onNotice: (message: string) => void;
  refreshToken?: number;
}) {
  const [incidents, setIncidents] = useState<BanIncidentSummary[]>([]);
  const [details, setDetails] = useState<BanIncidentDetails | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const noteReady = note.trim().length > 0;

  async function load() {
    setLoading(true);
    try {
      const next = await adminApi.banIncidents();
      setIncidents(next);
      if (details) {
        const refreshed = next.some((incident) => incident.id === details.incident.id)
          ? await adminApi.banIncident(details.incident.id)
          : null;
        setDetails(refreshed);
      }
    } catch (reason) {
      onNotice(reason instanceof Error ? reason.message : '无法读取异常上报记录');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [refreshToken]);

  async function selectIncident(id: number) {
    try {
      setDetails(await adminApi.banIncident(id));
      setNote('');
    } catch (reason) {
      onNotice(reason instanceof Error ? reason.message : '无法读取异常事件');
    }
  }

  async function mutate(task: () => Promise<{ message: string }>) {
    if (working) return;
    if (!noteReady) {
      onNotice('请先填写管理员备注');
      return;
    }
    setWorking(true);
    try {
      const result = await task();
      onNotice(result.message);
      await load();
    } catch (reason) {
      onNotice(reason instanceof Error ? reason.message : '封禁状态修改失败');
    } finally {
      setWorking(false);
    }
  }

  function banAll() {
    if (!details) return;
    const count = details.members.filter((member) => member.ban_status !== 'active').length;
    if (!window.confirm(`确认由管理员封禁本事件中的 ${count} 个当前可用账号？`)) return;
    void mutate(() => adminApi.banIncidentMembers(details.incident.id, note));
  }

  return (
    <Panel className="admin-panel admin-ban-panel">
      <div className="admin-panel-heading">
        <WidgetHeading title="异常上报与封禁" />
        <Button variant="secondary" onClick={() => void load()}>刷新异常记录</Button>
      </div>
      <p className="ui-helper-text">系统只上报同一注册网络的异常，不会自动封禁账号；只有管理员操作会暂停普通游戏访问。</p>
      {loading ? <p>正在读取异常事件…</p> : incidents.length === 0 ? <EmptyState>暂无同 IP 异常事件。</EmptyState> : (
        <div className="admin-ban-layout">
          <div className="admin-ban-incidents-column">
            <VirtualList
              items={incidents}
              getKey={incidentKey}
              estimateSize={78}
              viewportHeight={560}
              minViewportHeight={96}
              overscan={5}
              gap={10}
              className="admin-ban-incidents admin-ban-incidents-virtual-list"
              ariaLabel="异常事件"
              renderItem={(incident) => (
                <button
                  type="button"
                  className={details?.incident.id === incident.id ? 'active' : ''}
                  onClick={() => void selectIncident(incident.id)}
                >
                  <strong>事件 #{incident.id} · {incidentLabel(incident.status)}</strong>
                  <span>{incident.detected_user_count} 个账号 · {incident.active_ban_count} 个手动封禁中</span>
                  <small>{incident.fingerprint_preview}… · {formatDate(incident.updated_at)}</small>
                </button>
              )}
            />
          </div>
          <div className="admin-ban-details">
            {details ? (
              <>
                <div className="admin-ban-summary">
                  <strong>事件 #{details.incident.id}</strong>
                  <StatusTag tone={details.incident.status === 'active' ? 'danger' : 'success'}>
                    {incidentLabel(details.incident.status)}
                  </StatusTag>
                  <span>检测时间：{formatTime(details.incident.detected_at)}</span>
                </div>
                <TextArea
                  label="管理员备注"
                  value={note}
                  maxLength={240}
                  placeholder="必填，例如：家庭共享网络，核验后不封禁"
                  onChange={(event) => setNote(event.target.value)}
                />
                <p className="ui-helper-text">复核、关闭、封禁和解禁操作均要求填写备注并写入审计。</p>
                <div className="admin-ban-actions">
                  <Button
                    variant="secondary"
                    disabled={working}
                    onClick={() => void mutate(() => adminApi.reviewIncident(details.incident.id, note))}
                  >标记已复核</Button>
                  <Button
                    variant="danger"
                    disabled={working}
                    onClick={banAll}
                  >封禁本事件全部账号</Button>
                  <Button
                    variant="secondary"
                    disabled={working}
                    onClick={() => void mutate(() => adminApi.closeIncident(details.incident.id, note))}
                  >关闭事件</Button>
                  <Button
                    variant="secondary"
                    disabled={working}
                    onClick={() => void mutate(() => adminApi.unbanIncident(details.incident.id, note))}
                  >解除本事件全部账号封禁</Button>
                </div>
                <div className="admin-ban-members">
                  {details.members.map((member) => (
                    <div key={member.user_id}>
                      <div>
                        <strong>#{member.user_id} · {member.email}</strong>
                        <span>{member.registration_source === 'email_verification' ? 'Economy 邮箱注册' : '主页账号首次进入'}</span>
                        <small>
                          注册于 {formatTime(member.registered_at)}
                          {' · '}
                          {member.ban_status === 'active' ? '管理员封禁中' : '当前可用'}
                        </small>
                      </div>
                      {member.ban_status === 'active' ? (
                        <Button
                          variant="secondary"
                          disabled={working}
                          onClick={() => void mutate(() => adminApi.unbanUser(member.user_id, note))}
                        >解禁</Button>
                      ) : (
                        <Button
                          variant="danger"
                          disabled={working}
                          onClick={() => void mutate(() => adminApi.banUser(member.user_id, note, details.incident.id))}
                        >封禁账号</Button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : <EmptyState>选择一个异常事件查看账号并进行人工复核。</EmptyState>}
          </div>
        </div>
      )}
    </Panel>
  );
}
