BUILDR ANALYTICS DASHBOARD

Included:
- src/app/(private)/analytics/page.tsx
- src/components/app-shell.tsx
- analytics-dashboard.css

Install:
1. Upload buildr-analytics-dashboard.zip into:
   /workspaces/buildr-ironwood/buildr-ironwood-v1

2. Run:
   unzip -o buildr-analytics-dashboard.zip

3. Append analytics-dashboard.css to:
   src/app/globals.css

4. Restart:
   pkill -f "next dev"
   npm run dev

5. Open Analytics from the left navigation.

Profitability logic:
- Pre-tax revenue = estimate subtotal + markup_total
- Estimated direct cost = estimate subtotal
- Estimated gross profit = pre-tax revenue - estimated direct cost
- Projected direct cost = estimated direct cost - estimated labor + actual tracked labor cost
- Projected gross profit = pre-tax revenue - projected direct cost
- Payments are cash collection only and are NOT counted as profit
- Materials/subcontractors remain estimated until actual expense tracking is added
