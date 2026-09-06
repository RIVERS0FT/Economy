from pathlib import Path
import re, subprocess

def replace(path, old, new, count=1):
    p=Path(path); s=p.read_text()
    assert s.count(old)==count, (path, 'anchor count', s.count(old), old[:120])
    p.write_text(s.replace(old,new))

def sub(path, pattern, new, count=1):
    p=Path(path); s,n=re.subn(pattern,new,p.read_text(),flags=re.S)
    assert n==count, (path, 'pattern count', n, pattern)
    p.write_text(s)

def prepend(path, text):
    p=Path(path); p.write_text(text+p.read_text())

p='src/components/buildings/BuildingAutoOperationSection.tsx'
replace(p, 'onChange, message, children', 'onChange, children')
replace(p, '  message?: string;\n', '')
replace(p, '      {message ? <small className="facility-auto-operation__message" role="status">{message}</small> : null}\n', '')
replace('src/styles/factory-auto-operation.css', '.facility-auto-operation__message {\n  line-height: 1.5;\n}\n\n', '')
replace('src/styles/commercial-buildings.css', '.commercial-action-error,\n', '')

p='src/notifications/notificationCenter.ts'
replace(p, 'export interface NotificationInput {\n', 'export interface NotificationInput {\n  id?: string;\n')
sub(p, r'  const first = current\[0\];.*?\n  const (record|notification)(?:: NotificationRecord)? =', lambda m: "  const id = normalizedString(input.id) || nextNotificationId(createdAt);\n  if (current.some((item) => item.id === id)) return current;\n  const "+m.group(1)+(': NotificationRecord' if ': NotificationRecord' in m.group(0).splitlines()[-1] else '')+' =')
replace(p, '    id: nextNotificationId(createdAt),', '    id,')

p='src/app/gameViewModel.ts'
prepend(p, "import { useOperationNotifications, type OperationNotice } from '../hooks/useOperationNotifications';\nimport type { NotificationTone } from '../notifications/notificationCenter';\n")
replace(p, '  notice: string;\n', '  notice: string;\n  noticeEvents?: readonly OperationNotice[];\n')
sub(p, r'notify: \(message: string\) => void;', 'notify: (message: string, tone?: NotificationTone) => void;')
replace(p, "  const [notice, setNotice] = useState('');", '  const { notice, noticeEvents, notify, showResult } = useOperationNotifications(user.id);')
replace(p, '  const noticeTimerRef = useRef<number | null>(null);\n', '')
sub(p, r'^    if \(noticeTimerRef\.current !== null\) window\.clearTimeout\(noticeTimerRef\.current\);\n', '', count=0) if False else None
replace(p, '    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);\n', '', count=2)
sub(p, r'  function notify\(message: string\) \{.*?\n  \}\n\n  async function showResult\(.*?\n  \}\n', '')
replace(p, '    notice,\n', '    notice,\n    noticeEvents,\n')

p='src/app/LocalGamePreviewApp.tsx'
prepend(p, "import { useOperationNotifications } from '../hooks/useOperationNotifications';\n")
replace(p, "  const [notice, setNotice] = useState('本地免登录游戏模式：模拟数据不会保存或提交。');", "  const { notice, noticeEvents, notify, showResult } = useOperationNotifications(authorityGame.userId, '本地免登录游戏模式：模拟数据不会保存或提交。');")
replace(p, '  const noticeTimerRef = useRef<number | null>(null);\n', '')
sub(p, r'  useEffect\(\(\) => \(\) => \{\n    if \(noticeTimerRef.*?\n  \}, \[\]\);\n\n  const notify = useCallback\(.*?\n  \}, \[\]\);\n', '')
sub(p, r'  const showResult = useCallback\(.*?\n  \}, \[notify\]\);\n', '')
replace(p, '    notice,\n', '    notice,\n    noticeEvents,\n')
s=Path(p).read_text()
for hook in ['useEffect','useRef']:
    if not re.search(r'\b'+hook+r'\s*[<(]',s): s=s.replace(hook+', ','')
Path(p).write_text(s)

p='src/hooks/useNotificationCenter.ts'
replace(p, '  type NotificationRecord,\n', '  type NotificationRecord,\n  type NotificationInput,\n')
replace(p, "  const lastNoticeRef = useRef('');", "  const lastNoticeRef = useRef('');\n  const consumedEventsRef = useRef(new Set<string>());\n  const [notificationOwnerId, setNotificationOwnerId] = useState(model.user.id);")
replace(p, '  const addNotification = useCallback((title: string) => {\n    const tone = inferNotificationTone(title);', '  const addNotification = useCallback((input: NotificationInput) => {\n    const { title } = input;\n    const tone = input.tone ?? inferNotificationTone(title);')
replace(p, '      { title, tone },', '      { ...input, title, tone },')
replace(p, "    lastNoticeRef.current = '';\n    pendingKeysRef.current = null;\n    setNotifications(loadNotifications(model.user.id));", "    lastNoticeRef.current = '';\n    pendingKeysRef.current = null;\n    const stored = loadNotifications(model.user.id);\n    consumedEventsRef.current = new Set(stored.map((item) => item.id));\n    setNotificationOwnerId(model.user.id);\n    setNotifications(stored);")
replace(p, '  useEffect(() => {\n    try {\n      window.localStorage.setItem(\n        notificationStorageKey(model.user.id),', '  useEffect(() => {\n    if (notificationOwnerId !== model.user.id) return;\n    try {\n      window.localStorage.setItem(\n        notificationStorageKey(model.user.id),')
replace(p, '  }, [model.user.id, notifications]);', '  }, [model.user.id, notificationOwnerId, notifications]);')
replace(p, '  useEffect(() => {\n    const notice = model.notice.trim();', '''  useEffect(() => {
    if (model.noticeEvents !== undefined) {
      for (const event of model.noticeEvents) {
        if (event.userId !== model.user.id || consumedEventsRef.current.has(event.id)) continue;
        consumedEventsRef.current.add(event.id);
        addNotification(event);
      }
      consumedEventsRef.current = new Set(model.noticeEvents.filter((event) => event.userId === model.user.id).map((event) => event.id));
      return;
    }
    // Compatibility for older read-only models. Real game actions always supply event IDs.
    const notice = model.notice.trim();''')
replace(p, '    addNotification(notice);\n  }, [addNotification, model.notice]);', '    addNotification({ title: notice });\n  }, [addNotification, model.notice, model.noticeEvents, model.user.id]);')

p='src/pages/production/ProductionFacilityDetail.tsx'
prepend(p, "import type { OperationFeedback } from '../../notifications/operationFeedback';\n")
replace(p, 'export interface FacilityClusterDetailSharedProps {\n', 'export interface FacilityClusterDetailSharedProps {\n  feedback: OperationFeedback;\n')
for name in ['FacilityClusterDetailBody','FacilityClusterDetailContent']:
    replace(p, 'export function '+name+'({\n', 'export function '+name+'({\n  feedback,\n')
replace(p, '<FacilityAutoOperationControls group={group}>', '<FacilityAutoOperationControls group={group} feedback={feedback}>')
replace(p, '      <FacilityClusterDetailBody\n', '      <FacilityClusterDetailBody\n        feedback={feedback}\n')
p='src/pages/production/MobileFacilityDetailSheet.tsx'
replace(p, 'export function MobileFacilityDetailSheet({\n', 'export function MobileFacilityDetailSheet({\n  feedback,\n')
replace(p, '      <FacilityClusterDetailBody\n', '      <FacilityClusterDetailBody\n        feedback={feedback}\n')
p='src/pages/BuildingsPage.tsx'
replace(p, '        <FacilityClusterDetailContent\n', '        <FacilityClusterDetailContent\n          feedback={model}\n')
for path in Path('src').rglob('*.tsx'):
    s=path.read_text()
    if '<MobileFacilityDetailSheet\n' in s:
        path.write_text(s.replace('<MobileFacilityDetailSheet\n','<MobileFacilityDetailSheet\n        feedback={model}\n'))

p='src/api/commercial.ts'
replace(p, '  message: string;\n', '  message: string;\n  code?: string;\n')
replace(p, "      message: String(payload.message || '商业建筑操作失败，请刷新后重试'),", "      message: String(payload.result?.message || payload.message || '商业建筑操作失败，请刷新后重试'),\n      ...(response.status >= 500 || response.status === 408 ? { code: 'ACTION_RESULT_UNCONFIRMED' } : {}),")
replace(p, "  return payload.result ?? { ok: false, message: '服务器未返回商业建筑操作结果' };", "  return payload.result && typeof payload.result.ok === 'boolean' && typeof payload.result.message === 'string'\n    ? payload.result\n    : { ok: false, code: 'ACTION_RESULT_UNCONFIRMED', message: '服务器未返回商业建筑操作结果' };")
p='src/pages/CommercePage.tsx'
prepend(p, "import { autoOperationSuccessMessage, reportActionException } from '../notifications/operationFeedback';\n")
replace(p, "  const [actionError, setActionError] = useState('');\n", '')
sub(p, r'  useEffect\(\(\) => \{\s*setActionError\(\'\'\);\s*\}, \[activeDetailTypeId, model.selectedProvinceId\]\);\n', '')
replace(p, "    setActionError('');\n", '')
replace(p, '      if (!result.ok) setActionError(result.message);\n      await model.showResult(result);', '''      if (result.code === 'ACTION_RESULT_UNCONFIRMED') {
        await reportActionException(model, null, operation === 'auto-operation' ? '自动经营设置' : '商业建筑操作');
      } else {
        const previousEnabled = game.commercialBuildingGroups?.find((group) => group.provinceId === model.selectedProvinceId && group.commercialTypeId === commercialTypeId)?.autoOperationPolicy?.enabled ?? true;
        await model.showResult(result.ok && operation === 'auto-operation' && policy
          ? { ...result, message: autoOperationSuccessMessage(previousEnabled, policy.enabled) }
          : result);
      }''')
replace(p, "    } catch {\n      setActionError('商业建筑操作未能完成确认，请刷新状态后重试。');", "    } catch (reason) {\n      await reportActionException(model, reason, operation === 'auto-operation' ? '自动经营设置' : '商业建筑操作');")
replace(p, '{actionError ? <p className="commercial-action-error" role="alert">{actionError}</p> : null}', '', count=3)
s=Path(p).read_text()
if 'useEffect(' not in s: s=s.replace('useEffect, ','')
s='\n'.join(line.rstrip() for line in s.splitlines())+'\n'
Path(p).write_text(s)

p='src/components/InvitationSettings.tsx'
prepend(p, "import type { LoadedGameViewModel } from '../app/gameViewModel';\n")
replace(p, 'export function InvitationSettings() {', "export function InvitationSettings({ notify }: { notify: LoadedGameViewModel['notify'] }) {")
replace(p, "  const [status, setStatus] = useState('');", "  const [loadError, setLoadError] = useState('');")
replace(p, "      setStatus('');", "      setLoadError('');")
replace(p, "      setStatus(reason instanceof Error ? reason.message : '无法读取邀请信息');", "      setLoadError(reason instanceof Error ? reason.message : '无法读取邀请信息');")
replace(p, '      setStatus(success);', "      notify(success, 'success');")
replace(p, "      setStatus('无法自动复制，请手动选择并复制');", "      notify('无法自动复制，请手动选择并复制', 'error');")
replace(p, "        setStatus('分享链接已发送');", "        notify('分享链接已发送', 'success');")
replace(p, "      setStatus('无法分享邀请链接');", "      notify('无法分享邀请链接', 'error');")
replace(p, "loading ? '正在读取邀请信息…' : '邀请信息暂时不可用'", "loading ? '正在读取邀请信息…' : loadError || '邀请信息暂时不可用'")
replace(p, '      {status ? <small role="status">{status}</small> : null}\n', '')
for path in Path('src').rglob('*.tsx'):
    s=path.read_text()
    if '<InvitationSettings />' in s: path.write_text(s.replace('<InvitationSettings />', '<InvitationSettings notify={model.notify} />'))
p='src/pages/GemShopPage.tsx'
s=Path(p).read_text().replace('model.notify(result.message);','await model.showResult(result);').replace('model.notify(response.result.message);','await model.showResult(response.result);')
Path(p).write_text(s)

p='docs/UI_DESIGN_SYSTEM.md'
replace(p, '共用同一行的“自动经营”和开关及反馈区', '共用同一行的“自动经营”和开关，不提供正文操作反馈区')
replace(p, '### 燃料、化学品、化肥与化肥厂视觉资产', '''### 一次性操作结果不改变正文布局

玩家操作的成功、失败、保存、复制、分享、兑换等一次性回执统一进入现有通知中心，通过桌面 Toast／移动通知岛或已经打开的通知面板展示。禁止为回执插入正文消息行、展开结果区、替换操作面板、预留空白、改变容器高度或控件尺寸；不得强制滚动、移动焦点或自动打开通知面板。提交中只使用原控件的禁用／忙碌状态，不增加占位元素。既有移动通知岛安全通道不属于业务回执占位，不因本规则改变。

`BuildingAutoOperationSection` 不接收消息属性、不渲染反馈节点。工业与商业的自动经营保存都走统一通知；开启／关闭分别通知“自动经营已开启”／“自动经营已关闭”，其他策略更新通知“自动经营设置已更新”，不再显示“自动经营策略已保存”。明确拒绝保留或恢复权威设置；断网、超时、服务端异常或缺失有效回执只能通知结果未确认并读取权威状态，不自动重发写请求，不把未知结果认定为成功或确定失败。保留防重复提交、成功引导事件及真实业务状态更新。

统一通知入口以独立事件 ID 记录回执，级别优先使用明确操作结果，不依赖文案猜测。同一次结果重复转发只通知一次；不同操作即使文案相同或在同一渲染批次完成也必须分别记录。事件、历史与提醒开关按玩家隔离。继续保留最近 20 条历史、现有 Toast 数量和寿命；禁用主动提醒仍保存历史，面板打开期间不挂载或延迟补弹 Toast／通知岛。

真实库存、资金、开关、策略、建筑数量及持续业务状态可以正常变化；加载不可用状态和字段校验必须保留，不能机械删除全部 error／status 节点。邀请链接的复制／分享结果不得追加到邀请卡片正文。通知删除和清除已读继续不产生新的成功通知。上述规则由通知静态验证和真实操作浏览器回归锁定，验证桌面与移动控件、结算区几何及滚动位置不因纯回执变化。

### 燃料、化学品、化肥与化肥厂视觉资产''')

p='tests/browser/runtime-harness.tsx'
prepend(p, "import { useOperationNotifications } from '../../src/hooks/useOperationNotifications';\n")
anchor="  const base = useMemo(() => buildOverviewModel(tab, setTab), [tab]);\n  const types = ["
replace(p, anchor, "  const base = useMemo(() => buildOverviewModel(tab, setTab), [tab]);\n  const feedback = useOperationNotifications(base.user.id);\n  const types = [")
replace(p, '    __setCommercialProvince: setProvinceId,', '''    __setCommercialProvince: setProvinceId,
    __operationNotify: feedback.notify,
    __operationShowResult: feedback.showResult,''')
replace(p, '  const model = { ...base, selectedProvinceId: provinceId, selectedProvince: provinces.find((province) => province.id === provinceId) ?? provinces[0],', '  const model = { ...base, ...feedback, selectedProvinceId: provinceId, selectedProvince: provinces.find((province) => province.id === provinceId) ?? provinces[0],\n    refresh: async () => { Object.assign(window, { __operationRefreshMode: \'authoritative\' }); },')
p='tests/browser/unified-buildings.spec.ts'
replace(p, "await expect(page.getByRole('alert')).toHaveText('自动经营策略无效');", "await expect(page.locator('.notification-toast--error, .notification-island--error')).toContainText('自动经营策略无效');\n  await expect(page.locator('.building-detail-page [role=\"alert\"], .commercial-action-error')).toHaveCount(0);")

p='scripts/verify-notification-center.mjs'
replace(p, "console.log('notification center verification passed');", '''// Receipt identity, not receipt text or time proximity, determines duplication.
const firstReceipt = { id: 'operation-a', title: '设置已更新', tone: 'success', createdAt: 900_000 };
const secondReceipt = { ...firstReceipt, id: 'operation-b' };
const receiptHistory = appendNotification(appendNotification([], firstReceipt), secondReceipt);
assert.equal(receiptHistory.length, 2, 'independent identical receipts must both be retained');
assert.strictEqual(appendNotification(receiptHistory, firstReceipt), receiptHistory, 'replaying one event must not duplicate history');
assert.equal(receiptHistory[0].tone, 'success', 'explicit operation outcome must determine tone');
for (const path of ['src/components/buildings/BuildingAutoOperationSection.tsx', 'src/components/facilities/FacilityAutoOperationControls.tsx', 'src/pages/CommercePage.tsx']) {
  assert.doesNotMatch(read(path), /facility-auto-operation__message|commercial-action-error|setActionError|setMessage/);
}
assert.doesNotMatch(read('src/components/InvitationSettings.tsx'), /setStatus|<small role="status">/);
assert.doesNotMatch(read('src/styles/factory-auto-operation.css'), /facility-auto-operation__message/);
assert.match(read('src/hooks/useOperationNotifications.ts'), /current\\.events/);
assert.match(read('src/hooks/useOperationNotifications.ts'), /result\\.ok \\? 'success' : 'error'/);
assert.match(read('src/hooks/useOperationNotifications.ts'), /reportedRef/);
assert.match(hook, /consumedEventsRef/);
assert.match(uiDesign, /一次性操作结果不改变正文布局/);
console.log('notification center verification passed');''')

print('SCOPED PATCH APPLIED', flush=True)
subprocess.run(['git','diff','--check'],check=True)
subprocess.run(['npm','ci'],check=True)
subprocess.run(['npm','run','build'],check=True)
subprocess.run(['node','scripts/verify-notification-center.mjs'],check=True)
# The helper is only a remote editing workspace, never part of the merged feature.
Path('.operation-notifications-edit.py').unlink()
Path('.github/workflows/prepare-operation-notifications.yml').unlink()
subprocess.run(['git','config','user.name','github-actions[bot]'],check=True)
subprocess.run(['git','config','user.email','41898282+github-actions[bot]@users.noreply.github.com'],check=True)
subprocess.run(['git','add','src','docs/UI_DESIGN_SYSTEM.md','scripts/verify-notification-center.mjs','tests/browser','.operation-notifications-edit.py','.github/workflows/prepare-operation-notifications.yml'],check=True)
subprocess.run(['git','commit','-m','fix: route action receipts through layout-stable notifications'],check=True)
subprocess.run(['git','push','origin','HEAD:refs/heads/fix/operation-result-notifications-20260906'],check=True)
