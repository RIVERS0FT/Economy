import { useState } from 'react';
import type { AuthUser } from '../types';
import { AdminBanPanel } from '../components/AdminBanPanel';

export function AdminBanApp({ user }: { user: AuthUser }) {
  const [notice, setNotice] = useState('');
  if (user.role !== 'admin') {
    return <main className="admin-shell admin-denied"><section><h1>无权访问</h1><p>当前账号不是 Economy 管理员。</p><a href="/economy/">返回游戏</a></section></main>;
  }
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><span>Economy</span><h1>账号封禁管理</h1><p>{user.email}</p></div>
        <div><a href="/economy/admin">返回管理员后台</a><a href="/economy/">返回游戏</a></div>
      </header>
      {notice ? <div className="admin-alert" role="status">{notice}</div> : null}
      <AdminBanPanel onNotice={setNotice} />
    </main>
  );
}
