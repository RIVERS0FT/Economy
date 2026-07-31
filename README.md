# Economy

Economy 是一款网页端多人在线经济模拟与产业经营游戏，包含统一资产交易、生产合作合同、银行和资产包拍卖。

- 游戏网页：<https://game.riversoft.top/economy/>
- 管理员页面：<https://game.riversoft.top/economy/admin>
- 权威设计索引：[docs/README.md](docs/README.md)
- 仓库协作规则：[AGENTS.md](AGENTS.md)

业务规则、当前版本和部署参数只在权威设计文档、实现代码及对应验证脚本中维护；本文件不复制会随产品迭代变化的详细口径。

## 本地开发

项目固定使用 Node.js 24.4.0 和 `package-lock.json`：

```bash
npm ci
npm run dev
```

默认开发地址：<http://localhost:5173>

## 验证与部署

```bash
npm run build
npm run test:browser
```

合入 `main` 后，[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) 会重新执行构建和浏览器测试，并在通过后部署及完成线上验收。
