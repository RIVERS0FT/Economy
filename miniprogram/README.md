# Economy 抖音小程序单机版

这是 Economy 的抖音小程序单机最小可玩版本。

## 已实现链路

```text
点击工作 -> 获得劳动力 -> 生产食品包 -> 出售食品包 -> 获得金融货币 -> 升级工作席位
```

## 功能

- 点击工作获得劳动力
- 点击冷却：0.2 秒
- 点击不直接获得金融货币
- 3 劳动力生产 1 食品包
- 1 食品包出售获得 5 金融货币
- 金融货币升级工作席位
- 工作席位升级后提升点击收益
- 本地存档
- 操作日志
- 重置存档

## 文件结构

```text
miniprogram/
  app.json
  app.js
  app.ttss
  project.config.json
  pages/
    index/
      index.json
      index.js
      index.ttml
      index.ttss
```

## 运行方式

1. 打开抖音开发者工具。
2. 导入 `miniprogram` 目录。
3. 在 `project.config.json` 中填写自己的小程序 `appid`。
4. 编译运行。

## 存档

当前版本使用小程序本地存储：

```text
economy_single_player_save_v1
```

保存内容包括：

- 劳动力
- 食品包库存
- 金融货币
- 工作席位等级
- 食品包价格
- 统计数据
- 最近操作日志

## 下一步

建议下一步增加：

- 更多货物
- 本地价格波动
- 成就系统
- 每日任务
- 更完整的新手引导
