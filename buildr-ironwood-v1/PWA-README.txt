BUILDR PWA INSTALL

1. Upload buildr-pwa-install.zip into:
/workspaces/buildr-ironwood/buildr-ironwood-v1

2. Run:
unzip -o buildr-pwa-install.zip

3. Test:
pkill -f "next dev"
npm run dev

4. Commit/push/merge to main. Vercel deploys the production PWA.

ANDROID / CHROME:
Open the live Vercel Buildr URL, then browser menu > Add to Home screen / Install app.

DESKTOP CHROME / EDGE:
Open the live Buildr URL and use Install app from the address bar/menu.

Note: only static PWA assets are cached. Customer/project data stays online/fresh.
