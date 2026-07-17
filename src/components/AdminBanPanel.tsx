import { useEffect, useState } from 'react';
import { adminApi, type BanIncidentDetails, type BanIncidentSummary } from '../api/admin';
import { formatDate, formatTime } from '../utils/formatters';

export function AdminBanPanel({ onNotice }: { onNotice: (message: string) => void }) {
  const [incidents, setIncidents] = useState<BanIncidentSummary[]>([]);
  const [details, setDetails] = useState<BanIncidentDetails | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  async function load() {
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
      onNotice(reason instanceof Error ? reason.message : '无法读取账号封禁记录');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function selectIncident(id: number) {
    try {
      setDetails(await adminApi.banIncident(id));
      setNote('');
    } catch (reason) {
      onNotice(reason instanceof Error ? reason.message : '无法读取封禁事件');
    }
  }

  async function mutate(task: () => Promise<{ message: string }>) {
    if (working) return;
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

  return (
    <section className="admin-panel admin-ban-panel">
      <div className="admin-panel-heading">
        <div><h2>同 IP 账号封禁</h2><p>同一个注册 IP 指纹出现多个 Economy 账号时，系统会封禁该组全部账号。</p></div>
        <button type="button" onClick={() => void load()}>刷新封禁记录</button>
      </div>
      {loading ? <p>正在读取封禁事件…</p> : incidents.length === 0 ? <p>暂无同 IP 封禁事件。</p> : (
        <div className="admin-ban-layout">
          <div className="admin-ban-incidents" role="list" aria-label="封禁事件">
            {incidents.map((incident) => (
              <button
                type="button"
                key={incident.id}
                className={details?.incident.id === incident.id ? 'active' : ''}
                onClick={() => void selectIncident(incident.id)}
              >
                <strong>事件 #{incident.id}</strong>
                <span>{incident.detected_user_count} 个账号 · {incident.active_ban_count} 个封禁中</span>
                <small>{incident.fingerprint_preview}… · {formatDate(incident.detected_at)}</small>
              </button>
            ))}
          </div>
          <div className="admin-ban-details">
            {details ? (
              <>
                <div className="admin-ban-summary">
                  <strong>事件 #{details.incident.id}</strong>
                  <span>状态：{details.incident.status}</span>
                  <span>检测时间：{formatTime(details.incident.detected_at)}</span>
                </div>
                <label>
                  管理员备注
                  <textarea
                    value={note}
                    maxLength={240}
                    placeholder="例如：家庭共享网络，人工核验通过"
                    onChange={(event) => setNote(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  disabled={working}
                  onClick={() => void mutate(() => adminApi.unbanIncident(details.incident.id, note))}
                >解除本事件全部账号封禁</button>
                <div className="admin-ban-members">
                  {details.members.map((member) => (
                    <div key={member.user_id}>
                      <div>
                        <strong>#{member.user_id} · {member.email}</strong>
                        <span>{member.registration_source === 'email_verification' ? 'Economy 邮箱注册' : '主页账号首次进入'}</span>
                        <small>注册于 {formatTime(member.registered_at)} · {member.ban_status === 'active' ? '封禁中' : '已解禁'}</small>
                      </div>
                      {member.ban_status === 'active' ? (
                        <button
                          type="button"
                          disabled={working}
                          onClick={() => void mutate(() => adminApi.unbanUser(member.user_id, note))}
                        >解禁</button>
                      ) : (
                        <button
                          type="button"
                          disabled={working}
                          className="danger"
                          onClick={() => void mutate(() => adminApi.rebanUser(member.user_id, note))}
                        >重新封禁</button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : <p>选择一个封禁事件查看账号并进行复核。</p>}
          </div>
        </div>
      )}
    </section>
  );
}
