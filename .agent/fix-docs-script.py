from pathlib import Path

path = Path('.agent/apply-docs.py')
text = path.read_text()
old_source = "        '- 工厂详情的生产公式只展示集群参数：运行中按 `participatingCount` 显示本周期输入、输出和成本，停止或异常按 `nextCycleCount` 显示启动后或恢复后的集群参数；周期时长不乘工厂数量，实际结算口径与公式一致。',"
new_source = "        '生产公式是集群运行能力展示，公式只展示集群输入、输出、周期和成本。当前周期只使用 `participatingCount`；停止或异常使用 `nextCycleCount` 表示启动后或恢复后的集群能力。周期时长不乘工厂数量，`pendingJoinCount` 不得提前进入当前周期，`group.count` 不得作为公式乘数。开关只改变服务器运行意图；异常时仍保持开启视觉，并等待资金、原料或仓库恢复后自动从完整新周期继续。',"
old_target = "        '- 工厂详情的生产公式只展示集群参数：运行中按 `participatingCount` 显示本周期输入、输出和成本，停止或异常按 `nextCycleCount` 显示启动后或恢复后的集群参数；周期时长不乘工厂数量，实际结算口径与公式一致。\\n- 当前施工属于对应工厂类型详情；详情显示剩余时间、1 宝石减少 30 分钟的服务器报价和权威按钮。尚无同类工厂时提供临时“施工中”详情入口，但不计入运行／停止／异常集群统计。',"
new_target = "        '生产公式是集群运行能力展示，公式只展示集群输入、输出、周期和成本。当前周期只使用 `participatingCount`；停止或异常使用 `nextCycleCount` 表示启动后或恢复后的集群能力。周期时长不乘工厂数量，`pendingJoinCount` 不得提前进入当前周期，`group.count` 不得作为公式乘数。开关只改变服务器运行意图；异常时仍保持开启视觉，并等待资金、原料或仓库恢复后自动从完整新周期继续。\\n\\n当前施工属于对应工厂类型详情；详情显示剩余时间、1 宝石减少 30 分钟的服务器报价和权威按钮。尚无同类工厂时提供临时“施工中”详情入口，但不计入运行／停止／异常集群统计。',"
for old, new, label in ((old_source, new_source, 'source'), (old_target, new_target, 'target')):
    if old not in text:
        raise SystemExit(f'missing docs script line: {label}')
    text = text.replace(old, new, 1)
path.write_text(text)
