import { readFileSync, rmSync, writeFileSync } from 'node:fs';

const path = 'scripts/verify-page-content.mjs';
let source = readFileSync(path, 'utf8');
const replacements = [
  [
    "  'src/pages/SettingsPage.tsx',\n",
    "  'src/pages/SettingsPage.tsx',\n  'src/components/InvitationSettings.tsx',\n",
  ],
  [
    "  '邀请好友',\n  '分享或复制邀请链接',\n",
    "  'InvitationSettings',\n",
  ],
  [
    "]) requireText('src/pages/SettingsPage.tsx', text);\nfor (const text of ['登录会话'",
    "]) requireText('src/pages/SettingsPage.tsx', text);\nfor (const text of ['邀请好友', '分享链接', '我的邀请码', '填写好友邀请码', '累计宝石']) {\n  requireText('src/components/InvitationSettings.tsx', text);\n}\nfor (const text of ['登录会话'",
  ],
  [
    "  '第一阶段邀请功能只分享或复制 Economy 正式入口',\n",
    "  '邀请卡必须展示服务器返回的宝石余额、专属分享链接、永久邀请码',\n",
  ],
];
for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error(`未找到待替换页面验证片段: ${before}`);
  source = source.replace(before, after);
}
writeFileSync(path, source, 'utf8');
rmSync('scripts/patch-invitation-page-verifier.mjs', { force: true });
rmSync('.github/workflows/patch-invitation-page-verifier.yml', { force: true });
