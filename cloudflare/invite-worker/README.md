# 0615 Invite Worker

这个 Worker 只负责邀请码门禁，不保存聊天、图片或用户私密数据。

规则：

- 每个邀请码默认最多绑定 2 台设备。
- 已绑定设备可以无限打开。
- 第 3 台设备会被拒绝。
- 邀请码可以撤销。
- 管理页生成邀请码时必须填写用户名，并会生成一个不重复的“xxx的xx” USERNAME，方便玩家和管理员核对。
- 删除邀请码会写入隐藏记录，刷新或同用户名重新生成时不会把已删除的邀请码带回来。
- 打开 `/admin` 会先显示口令验证弹窗，验证通过后才显示管理面板；刷新后需要重新输入口令。
- 小手机验证码弹窗可以从 `/public-name` 拉取一个只读 USERNAME 用于展示。

## Cloudflare 准备

1. 注册 / 登录 Cloudflare。
2. 进入 Workers & Pages。
3. 创建一个 D1 database，例如 `phone_invites`。
4. 复制 `wrangler.example.toml` 为 `wrangler.toml`，填入 D1 的 `database_id`。
5. 执行 schema：

```bash
wrangler d1 execute phone_invites --file=cloudflare/invite-worker/schema.sql
```

6. 添加测试邀请码：

```bash
wrangler d1 execute phone_invites --file=cloudflare/invite-worker/seed.example.sql
```

7. 部署 Worker：

```bash
wrangler deploy --config cloudflare/invite-worker/wrangler.toml
```

部署完成后，把 Worker URL 填到 `main.js` 的 `INVITE_GATE_CONFIG.apiBase`，并把 `enabled` 改成 `true`。
