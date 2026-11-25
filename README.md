# Digital Streetwise — payment backend

## Folder layout for Vercel

Put this folder's contents at the ROOT of your GitHub repo:

```
your-repo/
├── api/
│   ├── create-checkout.js
│   └── webhook.js
├── index.html   <- your game, renamed so Vercel serves it at "/" automatically
├── support.js
├── package.json
└── vercel.json
```

No rewrite needed anymore — `index.html` at the repo root is served at "/" by default.

## Steps

1. Create a new GitHub repo, push this folder + your game HTML file into it.
2. In Vercel: "Add New Project" -> import that repo -> Deploy.
3. In Vercel Project Settings -> Environment Variables, add:
   - STRIPE_SECRET_KEY (from Stripe Dashboard, test key first)
   - STRIPE_PRICE_ID (optional — your $15 Price ID)
   - STRIPE_WEBHOOK_SECRET (after step 4)
4. In Stripe Dashboard -> Developers -> Webhooks -> Add endpoint:
   - URL: https://your-project.vercel.app/api/webhook
   - Event: checkout.session.completed
   - Copy the signing secret into STRIPE_WEBHOOK_SECRET in Vercel, then redeploy.
5. Redeploy after adding env vars (Vercel doesn't hot-reload them).
6. Test with Stripe's test card 4242 4242 4242 4242 before switching to live keys.

## What's left to wire up in the game file

In `Digital Streetwise.dc.html`, the `purchase()` method currently just sets
`purchased: true` directly (demo mode). It needs to instead call
`/api/create-checkout` and redirect to the returned Stripe URL — say the word
and I'll make that edit once your backend URL is live.
