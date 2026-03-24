# Free Web Push Worker

This folder is the free Cloudflare Workers skeleton for Ephone Web Push.

## Endpoints

- `POST /subscribe`
- `POST /unsubscribe`
- `POST /test`
- `POST /broadcast`

## What you still need

1. Create a Cloudflare KV namespace and bind it as `PUSH_SUBSCRIPTIONS`
2. Generate VAPID keys
3. Fill `wrangler.toml`
4. Deploy the worker
5. Paste the worker URL + VAPID public key into `设置 > 锁屏通知 / Web Push`

## Notes

- Frontend subscription is already wired in the app.
- iPhone lock-screen delivery still requires:
  - app added to Home Screen
  - notification permission granted
  - successful push subscription
  - deployed worker
