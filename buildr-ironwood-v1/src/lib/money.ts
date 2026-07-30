export function money(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function estimateTotals(
  items: Array<{ quantity: number; unit_cost: number; markup_rate: number; taxable: boolean }>,
  taxRate: number,
) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);
  const markupTotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_cost * (item.markup_rate / 100),
    0,
  );
  const taxableTotal = items.reduce((sum, item) => {
    if (!item.taxable) return sum;
    const base = item.quantity * item.unit_cost;
    return sum + base + base * (item.markup_rate / 100);
  }, 0);
  const taxTotal = taxableTotal * (taxRate / 100);
  return {
    subtotal,
    markupTotal,
    taxTotal,
    total: subtotal + markupTotal + taxTotal,
  };
}
