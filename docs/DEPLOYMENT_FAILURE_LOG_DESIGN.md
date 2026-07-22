# Economy 部署失败日志设计

> 状态：生产部署失败诊断权威规则
> 适用项目：`RIVERS0FT/Economy`
> 适用工作流：`.github/workflows/deploy.yml`
> 更新时间：2026-07-22

## 1. 目标

生产部署失败时必须保留足够完整的命令输出用于定位问题，同时避免把所有成功步骤日志打包上传，防止 Artifact 体积和读取时间无意义增长。

## 2. 日志采集

- 部署中的每个 shell 命令步骤必须把标准输出和标准错误保存到独立临时日志。
- 任一步失败时，只复制该失败步骤的完整命令输出到 `$RUNNER_TEMP/economy-failure-log`。
- 成功步骤日志不得上传；运行器中的临时成功日志只用于当前任务内生成简短提交状态。
- 非 shell Action 步骤失败且无法取得独立文件日志时，只生成说明文件并保留 GitHub Actions 原始 job log 作为来源。

## 3. Artifact

- 失败 Artifact 名称固定为 `economy-deploy-failure-<run>-<attempt>`。
- 只在任务失败时上传，使用 `actions/upload-artifact@v7`。
- Artifact 只包含 `$RUNNER_TEMP/economy-failure-log`，不得直接上传 `/tmp/economy-*.log` 通配结果。
- Artifact 保留 3 天，并使用 `compression-level: 9` 压缩文本日志。
- 不得再为单次构建失败创建临时诊断工作流。

## 4. 防回退

`scripts/verify-runtime-reliability.mjs` 必须验证失败日志收集步骤、失败目录、Artifact 名称、保留时间、压缩级别和本设计文档。任何删除或改回上传全部步骤日志的修改都必须阻止构建与部署。
