"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Copy,
  FolderPlus,
  Plus,
  Save,
  Trash2,
  AlertTriangle,
  RotateCcw,
  X,
} from "lucide-react";

import { estimateTotals, money } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import type { EstimateItemDraft } from "@/lib/types";

type CustomerOption = {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
};

type EstimateSectionDraft = {
  clientId: string;
  title: string;
  description: string;
  items: EstimateItemDraft[];
};

type PaymentMilestoneDraft = {
  clientId: string;
  title: string;
  amount_type: "percentage" | "fixed";
  amount_value: number;
  due_trigger: string;
  due_date: string;
};

type InitialEstimate = {
  id: string;
  status: string;
  revision_number: number | null;
  customer_id: string;
  title: string;
  project_address: string | null;
  scope: string | null;
  exclusions: string | null;
  customer_notes: string | null;
  private_notes: string | null;
  payment_schedule: string | null;
  payment_milestones?: Array<{
    id: string;
    title: string;
    amount_type: "percentage" | "fixed";
    amount_value: number | string;
    due_trigger: string | null;
    due_date: string | null;
    sort_order: number;
  }>;
  independence_assessment_id?: string | null;
  tax_rate: number | string | null;
  default_markup_rate: number | string | null;
  sections: Array<{
    id: string;
    title: string;
    description: string | null;
    sort_order: number;
    items: Array<{
      item_type: EstimateItemDraft["item_type"];
      category: string | null;
      description: string;
      quantity: number | string;
      unit: string | null;
      unit_cost: number | string;
      markup_rate: number | string;
      taxable: boolean | null;
      vendor: string | null;
      vendor_sku: string | null;
      vendor_url: string | null;
      private_notes: string | null;
      selection_status: EstimateItemDraft["selection_status"] | null;
      selection_responsibility: EstimateItemDraft["selection_responsibility"] | null;
      selection_deadline: string | null;
      selected_product: string | null;
      selection_notes: string | null;
      sort_order: number;
    }>;
  }>;
};

type EstimatePreset = {
  title?: string;
  paymentSchedule?: string;
  scopeStarter?: string;
  independenceAssessmentId?: string;
  sections?: Array<{
    title: string;
    description?: string;
  }>;
};

type EstimateDraft = {
  customerId: string;
  title: string;
  address: string;
  scope: string;
  exclusions: string;
  notes: string;
  privateNotes: string;
  revisionReason: string;
  schedule: string;
  taxRate: number;
  markupRate: number;
  sections: EstimateSectionDraft[];
  milestones: PaymentMilestoneDraft[];
  savedAt: string;
};

type EstimateBuilderProps = {
  customers: CustomerOption[];
  defaults: {
    tax_rate: number;
    markup_rate: number;
  };
  selectedCustomer?: string;
  initialEstimate?: InitialEstimate;
  preset?: EstimatePreset;
  sourceSiteVisit?: {
    id: string;
    customerId: string;
  };
};

function makeId() {
  return crypto.randomUUID();
}

function blankItem(markup = 20): EstimateItemDraft {
  return {
    item_type: "material",
    category: "",
    description: "",
    quantity: 1,
    unit: "each",
    unit_cost: 0,
    markup_rate: markup,
    taxable: true,
    vendor: "",
    vendor_sku: "",
    vendor_url: "",
    private_notes: "",
    selection_status: "final",
    selection_responsibility: "ironwood",
    selection_deadline: "",
    selected_product: "",
    selection_notes: "",
  };
}

function blankSection(title = "General", markup = 20): EstimateSectionDraft {
  return {
    clientId: makeId(),
    title,
    description: "",
    items: [blankItem(markup)],
  };
}

function defaultMilestones(): PaymentMilestoneDraft[] {
  return [
    { clientId: makeId(), title: "Initial deposit", amount_type: "percentage", amount_value: 30, due_trigger: "Due upon acceptance to reserve scheduling", due_date: "" },
    { clientId: makeId(), title: "Progress payment", amount_type: "percentage", amount_value: 40, due_trigger: "Due at the agreed midpoint of work", due_date: "" },
    { clientId: makeId(), title: "Final payment", amount_type: "percentage", amount_value: 30, due_trigger: "Due at final walkthrough", due_date: "" },
  ];
}

function loadSections(
  initialEstimate: InitialEstimate | undefined,
  markup: number,
): EstimateSectionDraft[] {
  if (!initialEstimate?.sections?.length) {
    return [blankSection("General", markup)];
  }

  return [...initialEstimate.sections]
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
    .map((section) => ({
      clientId: section.id || makeId(),
      title: section.title || "General",
      description: section.description || "",
      items: [...(section.items ?? [])]
        .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
        .map((item) => ({
          item_type: item.item_type || "material",
          category: item.category || "",
          description: item.description || "",
          quantity: Number(item.quantity ?? 1),
          unit: item.unit || "each",
          unit_cost: Number(item.unit_cost ?? 0),
          markup_rate: Number(item.markup_rate ?? markup),
          taxable: Boolean(item.taxable),
          vendor: item.vendor || "",
          vendor_sku: item.vendor_sku || "",
          vendor_url: item.vendor_url || "",
          private_notes: item.private_notes || "",
          selection_status: item.selection_status || "final",
          selection_responsibility: item.selection_responsibility || "ironwood",
          selection_deadline: item.selection_deadline || "",
          selected_product: item.selected_product || "",
          selection_notes: item.selection_notes || "",
        })),
    }));
}

export function EstimateBuilder({
  customers,
  defaults,
  selectedCustomer,
  initialEstimate,
  preset,
  sourceSiteVisit,
}: EstimateBuilderProps) {
  const router = useRouter();
  const supabase = createClient();
  const isEditing = Boolean(initialEstimate?.id);

  const startingMarkup = Number(
    initialEstimate?.default_markup_rate ?? defaults.markup_rate ?? 20,
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [customerId, setCustomerId] = useState(
    initialEstimate?.customer_id ?? selectedCustomer ?? "",
  );
  const [title, setTitle] = useState(
    initialEstimate?.title ?? preset?.title ?? "",
  );
  const [address, setAddress] = useState(
    initialEstimate?.project_address ?? "",
  );
  const [scope, setScope] = useState(
    initialEstimate?.scope ?? preset?.scopeStarter ?? "",
  );
  const [exclusions, setExclusions] = useState(
    initialEstimate?.exclusions ?? "",
  );
  const [notes, setNotes] = useState(
    initialEstimate?.customer_notes ?? "",
  );
  const [privateNotes, setPrivateNotes] = useState(
    initialEstimate?.private_notes ?? "",
  );
  const [revisionReason, setRevisionReason] = useState("");
  const [schedule, setSchedule] = useState(
    initialEstimate?.payment_schedule ??
      preset?.paymentSchedule ??
      "30% deposit to reserve scheduling; progress payments tied to completed phases; final balance due at final walkthrough.",
  );
  const [taxRate, setTaxRate] = useState(
    Number(initialEstimate?.tax_rate ?? defaults.tax_rate ?? 0),
  );
  const [markupRate, setMarkupRate] = useState(startingMarkup);
  const [sections, setSections] = useState<EstimateSectionDraft[]>(
    isEditing
      ? loadSections(initialEstimate, startingMarkup)
      : preset?.sections?.length
        ? preset.sections.map((section) => ({
            clientId: makeId(),
            title: section.title,
            description: section.description ?? "",
            items: [blankItem(startingMarkup)],
          }))
        : loadSections(initialEstimate, startingMarkup),
  );
  const [milestones, setMilestones] = useState<PaymentMilestoneDraft[]>(
    initialEstimate?.payment_milestones?.length
      ? [...initialEstimate.payment_milestones]
          .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
          .map((milestone) => ({
            clientId: milestone.id || makeId(),
            title: milestone.title,
            amount_type: milestone.amount_type,
            amount_value: Number(milestone.amount_value),
            due_trigger: milestone.due_trigger || "",
            due_date: milestone.due_date || "",
          }))
      : defaultMilestones(),
  );
  const [draftReady, setDraftReady] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<EstimateDraft | null>(null);
  const [draftStatus, setDraftStatus] = useState<"waiting" | "saving" | "saved">("waiting");
  const [lastDraftSaved, setLastDraftSaved] = useState<string | null>(null);

  const draftKey = "buildr:estimate-draft:" + (initialEstimate?.id ?? [selectedCustomer ?? "new", preset?.title ?? "custom"].join(":"));

  const allItems = useMemo(
    () => sections.flatMap((section) => section.items),
    [sections],
  );

  const totals = useMemo(
    () => estimateTotals(allItems, taxRate),
    [allItems, taxRate],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(draftKey);
        if (saved) {
          const draft = JSON.parse(saved) as EstimateDraft;
          if (draft?.savedAt && Array.isArray(draft.sections)) {
            setPendingDraft(draft);
            setLastDraftSaved(draft.savedAt);
            return;
          }
        }
      } catch {
        window.localStorage.removeItem(draftKey);
      }
      setDraftReady(true);
      setDraftStatus("saved");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draftKey]);

  useEffect(() => {
    if (!draftReady) return;
    const statusTimer = window.setTimeout(() => setDraftStatus("saving"), 0);
    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      const draft: EstimateDraft = {
        customerId, title, address, scope, exclusions, notes, privateNotes,
        revisionReason, schedule, taxRate, markupRate, sections, milestones, savedAt,
      };
      window.localStorage.setItem(draftKey, JSON.stringify(draft));
      setLastDraftSaved(savedAt);
      setDraftStatus("saved");
    }, 800);
    return () => {
      window.clearTimeout(statusTimer);
      window.clearTimeout(timer);
    };
  }, [
    address, customerId, draftKey, draftReady, exclusions, markupRate, notes,
    privateNotes, revisionReason, schedule, scope, sections, milestones, taxRate, title,
  ]);

  useEffect(() => {
    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      if (draftStatus !== "saving") return;
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [draftStatus]);

  function restoreDraft() {
    if (!pendingDraft) return;
    setCustomerId(pendingDraft.customerId);
    setTitle(pendingDraft.title);
    setAddress(pendingDraft.address);
    setScope(pendingDraft.scope);
    setExclusions(pendingDraft.exclusions);
    setNotes(pendingDraft.notes);
    setPrivateNotes(pendingDraft.privateNotes);
    setRevisionReason(pendingDraft.revisionReason);
    setSchedule(pendingDraft.schedule);
    setTaxRate(Number(pendingDraft.taxRate));
    setMarkupRate(Number(pendingDraft.markupRate));
    setSections(pendingDraft.sections);
    setMilestones(pendingDraft.milestones ?? defaultMilestones());
    setPendingDraft(null);
    setDraftReady(true);
    setDraftStatus("saved");
  }

  function discardDraft() {
    window.localStorage.removeItem(draftKey);
    setPendingDraft(null);
    setLastDraftSaved(null);
    setDraftReady(true);
    setDraftStatus("saved");
  }

  const readiness = useMemo(() => {
    const completedItems = allItems.filter((item) => item.description.trim());
    const warnings: string[] = [];
    if (!customerId) warnings.push("Choose a customer");
    if (!title.trim()) warnings.push("Add a project title");
    if (!address.trim()) warnings.push("Confirm the jobsite address");
    if (!scope.trim()) warnings.push("Write the detailed scope of work");
    if (!exclusions.trim()) warnings.push("Confirm exclusions and owner-supplied items");
    if (!schedule.trim()) warnings.push("Add the payment schedule");
    if (!milestones.length) warnings.push("Add at least one payment milestone");
    const percentageTotal = milestones.filter((milestone) => milestone.amount_type === "percentage").reduce((sum, milestone) => sum + Number(milestone.amount_value || 0), 0);
    const hasFixedMilestones = milestones.some((milestone) => milestone.amount_type === "fixed");
    if (!hasFixedMilestones && Math.abs(percentageTotal - 100) > 0.001) warnings.push(`Payment milestones total ${percentageTotal}% instead of 100%`);
    if (milestones.some((milestone) => !milestone.title.trim() || Number(milestone.amount_value) <= 0)) warnings.push("Complete every payment milestone");
    if (!completedItems.length) warnings.push("Add at least one priced line item");
    if (completedItems.some((item) => Number(item.unit_cost) === 0)) warnings.push("Review line items with a $0 cost");
    if (completedItems.some((item) => item.selection_status === "undecided")) warnings.push("Resolve or acknowledge undecided selections");
    if (completedItems.some((item) => item.selection_status === "allowance" && Number(item.unit_cost) === 0)) warnings.push("Enter an amount for every allowance");
    if (completedItems.some((item) => item.selection_status === "customer_supplied" && !item.selected_product.trim() && !item.selection_notes.trim())) warnings.push("Describe customer-supplied items");
    return warnings;
  }, [address, allItems, customerId, exclusions, milestones, schedule, scope, title]);

  function patchSection(
    sectionId: string,
    values: Partial<Pick<EstimateSectionDraft, "title" | "description">>,
  ) {
    setSections((current) =>
      current.map((section) =>
        section.clientId === sectionId ? { ...section, ...values } : section,
      ),
    );
  }

  function addSection() {
    setSections((current) => [
      ...current,
      blankSection(`Section ${current.length + 1}`, markupRate),
    ]);
  }

  function duplicateSection(sectionId: string) {
    setSections((current) => {
      const index = current.findIndex((section) => section.clientId === sectionId);
      if (index < 0) return current;
      const source = current[index];
      const copy = {
        ...source,
        clientId: makeId(),
        title: source.title + " copy",
        items: source.items.map((item) => ({ ...item })),
      };
      const next = [...current];
      next.splice(index + 1, 0, copy);
      return next;
    });
  }

  function removeSection(sectionId: string) {
    setSections((current) => {
      if (current.length === 1) return current;
      return current.filter((section) => section.clientId !== sectionId);
    });
  }

  function moveSection(sectionIndex: number, direction: -1 | 1) {
    setSections((current) => {
      const nextIndex = sectionIndex + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const copy = [...current];
      const [moved] = copy.splice(sectionIndex, 1);
      copy.splice(nextIndex, 0, moved);
      return copy;
    });
  }

  function patchItem(
    sectionId: string,
    itemIndex: number,
    values: Partial<EstimateItemDraft>,
  ) {
    setSections((current) =>
      current.map((section) => {
        if (section.clientId !== sectionId) return section;
        return {
          ...section,
          items: section.items.map((item, index) =>
            index === itemIndex ? { ...item, ...values } : item,
          ),
        };
      }),
    );
  }

  function addItem(sectionId: string) {
    setSections((current) =>
      current.map((section) =>
        section.clientId === sectionId
          ? {
              ...section,
              items: [...section.items, blankItem(markupRate)],
            }
          : section,
      ),
    );
  }

  function duplicateItem(sectionId: string, itemIndex: number) {
    setSections((current) =>
      current.map((section) => {
        if (section.clientId !== sectionId) return section;
        const nextItems = [...section.items];
        nextItems.splice(itemIndex + 1, 0, { ...section.items[itemIndex] });
        return { ...section, items: nextItems };
      }),
    );
  }

  function removeItem(sectionId: string, itemIndex: number) {
    setSections((current) =>
      current.map((section) => {
        if (section.clientId !== sectionId) return section;
        return {
          ...section,
          items: section.items.filter((_, index) => index !== itemIndex),
        };
      }),
    );
  }

  function applyMarkupToAll() {
    setSections((current) =>
      current.map((section) => ({
        ...section,
        items: section.items.map((item) => ({
          ...item,
          markup_rate: markupRate,
        })),
      })),
    );
  }

  async function save() {
    setError("");

    if (!customerId || !title.trim()) {
      setError("Choose a customer and enter a project title.");
      return;
    }

    if (isEditing && initialEstimate?.status !== "draft" && !revisionReason.trim()) {
      setError("Enter a reason for the revision so the approval log explains what changed.");
      return;
    }

    const sectionsWithItems = sections.filter((section) =>
      section.items.some((item) => item.description.trim()),
    );

    if (sectionsWithItems.length === 0) {
      setError("Add at least one completed line item.");
      return;
    }

    if (sectionsWithItems.some((section) => !section.title.trim())) {
      setError("Every section containing line items needs a title.");
      return;
    }

    if (sourceSiteVisit && customerId !== sourceSiteVisit.customerId) {
      setError("Keep the site visit’s customer selected so the estimate stays linked to the correct job.");
      return;
    }

    setBusy(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Your session expired. Sign in again.");
        return;
      }

      const estimateValues = {
        customer_id: customerId,
        title: title.trim(),
        project_address: address.trim() || null,
        scope: scope.trim() || null,
        exclusions: exclusions.trim() || null,
        customer_notes: notes.trim() || null,
        private_notes: privateNotes.trim() || null,
        payment_schedule: schedule.trim() || null,
        tax_rate: taxRate,
        default_markup_rate: markupRate,
        subtotal: totals.subtotal,
        markup_total: totals.markupTotal,
        tax_total: totals.taxTotal,
        total: totals.total,
        independence_assessment_id:
          initialEstimate?.independence_assessment_id ??
          preset?.independenceAssessmentId ??
          null,
      };

      let estimateId = initialEstimate?.id;

      if (isEditing && estimateId) {
        if (initialEstimate?.status !== "draft") {
          const { error: revisionError } = await supabase.rpc(
            "begin_estimate_revision",
            {
              p_estimate_id: estimateId,
              p_reason: revisionReason.trim() || null,
            },
          );

          if (revisionError) {
            setError(revisionError.message);
            return;
          }
        }

        const { error: updateError } = await supabase
          .from("estimates")
          .update(estimateValues)
          .eq("id", estimateId);

        if (updateError) {
          setError(updateError.message);
          return;
        }

        const { error: deleteItemsError } = await supabase
          .from("estimate_items")
          .delete()
          .eq("estimate_id", estimateId);

        if (deleteItemsError) {
          setError(deleteItemsError.message);
          return;
        }

        const { error: deleteSectionsError } = await supabase
          .from("estimate_sections")
          .delete()
          .eq("estimate_id", estimateId);

        if (deleteSectionsError) {
          setError(deleteSectionsError.message);
          return;
        }

        const { error: deleteMilestonesError } = await supabase
          .from("estimate_payment_milestones")
          .delete()
          .eq("estimate_id", estimateId);

        if (deleteMilestonesError) {
          setError(deleteMilestonesError.message);
          return;
        }
      } else {
        const { data: estimate, error: estimateError } = await supabase
          .from("estimates")
          .insert({
            owner_id: user.id,
            ...estimateValues,
          })
          .select("id")
          .single();

        if (estimateError || !estimate) {
          setError(estimateError?.message || "Could not save the estimate.");
          return;
        }

        estimateId = String(estimate.id);
      }

      if (!estimateId) {
        setError("Could not determine the estimate ID.");
        return;
      }

      const sectionRows = sectionsWithItems.map((section, index) => ({
        owner_id: user.id,
        estimate_id: estimateId,
        title: section.title.trim(),
        description: section.description.trim() || null,
        sort_order: index,
      }));

      const { data: savedSections, error: sectionError } = await supabase
        .from("estimate_sections")
        .insert(sectionRows)
        .select("id, sort_order");

      if (sectionError || !savedSections) {
        setError(sectionError?.message || "Could not save estimate sections.");
        return;
      }

      const sectionIdByOrder = new Map<number, string>(
        savedSections.map((section) => [
          Number(section.sort_order),
          String(section.id),
        ]),
      );

      const itemRows = sectionsWithItems.flatMap((section, sectionIndex) =>
        section.items
          .filter((item) => item.description.trim())
          .map((item, itemIndex) => {
            const baseCost = item.quantity * item.unit_cost;
            const lineMarkup = baseCost * (item.markup_rate / 100);

            return {
              owner_id: user.id,
              estimate_id: estimateId,
              section_id: sectionIdByOrder.get(sectionIndex),
              sort_order: itemIndex,
              item_type: item.item_type,
              category: item.category.trim() || null,
              description: item.description.trim(),
              quantity: item.quantity,
              unit: item.unit.trim() || "each",
              unit_cost: item.unit_cost,
              markup_rate: item.markup_rate,
              taxable: item.taxable,
              vendor: item.vendor.trim() || null,
              vendor_sku: item.vendor_sku.trim() || null,
              vendor_url: item.vendor_url.trim() || null,
              private_notes: item.private_notes.trim() || null,
              selection_status: item.selection_status,
              selection_responsibility: item.selection_responsibility,
              selection_deadline: item.selection_deadline || null,
              selected_product: item.selected_product.trim() || null,
              selection_notes: item.selection_notes.trim() || null,
              line_subtotal: baseCost,
              line_markup: lineMarkup,
              line_total: baseCost + lineMarkup,
            };
          }),
      );

      const { error: itemError } = await supabase
        .from("estimate_items")
        .insert(itemRows);

      if (itemError) {
        setError(itemError.message);
        return;
      }

      const milestoneRows = milestones
        .filter((milestone) => milestone.title.trim() && Number(milestone.amount_value) > 0)
        .map((milestone, index) => ({
          owner_id: user.id,
          estimate_id: estimateId,
          title: milestone.title.trim(),
          amount_type: milestone.amount_type,
          amount_value: Number(milestone.amount_value),
          due_trigger: milestone.due_trigger.trim() || null,
          due_date: milestone.due_date || null,
          sort_order: index,
        }));

      if (milestoneRows.length) {
        const { error: milestoneError } = await supabase
          .from("estimate_payment_milestones")
          .insert(milestoneRows);

        if (milestoneError) {
          setError(milestoneError.message);
          return;
        }
      }

      if (!isEditing && sourceSiteVisit) {
        const { error: siteVisitError } = await supabase
          .from("site_visit_worksheets")
          .update({ estimate_id: estimateId, status: "complete" })
          .eq("id", sourceSiteVisit.id);

        if (siteVisitError) {
          setError(siteVisitError.message);
          return;
        }
      }

      window.localStorage.removeItem(draftKey);
      router.push(`/estimates/${estimateId}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="builder-layout">
      <div className="builder-main">
        {pendingDraft && (
          <section className="panel draft-recovery">
            <div className="draft-recovery__copy">
              <RotateCcw size={20} />
              <div>
                <strong>Unsaved estimate work found</strong>
                <p>Buildr saved changes on this device {new Date(pendingDraft.savedAt).toLocaleString()}.</p>
              </div>
            </div>
            <div className="button-row">
              <button type="button" className="button button--gold" onClick={restoreDraft}>Restore draft</button>
              <button type="button" className="button button--outline" onClick={discardDraft}><X size={15} />Discard</button>
            </div>
          </section>
        )}

        <section className="panel form-grid">
          {isEditing && initialEstimate?.status !== "draft" && (
            <div className="span-2 revision-warning">
              <strong>
                This {initialEstimate?.status} estimate will become a new draft revision.
              </strong>
              <p>
                The existing version and customer acceptance will be preserved in the revision log. The revised estimate must be sent and accepted again.
              </p>
              <label>
                Reason for revision
                <input
                  value={revisionReason}
                  onChange={(event) => setRevisionReason(event.target.value)}
                  placeholder="Customer requested changes, corrected scope, selection change…"
                  required
                />
              </label>
            </div>
          )}
          <label className="span-2">
            Customer
            <select
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              required
            >
              <option value="">Choose a customer…</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.first_name} {customer.last_name}
                  {customer.company_name ? ` — ${customer.company_name}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="span-2">
            Project title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Primary bathroom remodel"
            />
          </label>

          <label className="span-2">
            Project address
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Use the customer address or enter another jobsite"
            />
          </label>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Estimate sections</h2>
              <p>
                Organize the job into phases such as demolition, framing,
                plumbing, electrical, drywall, and finishes.
              </p>
            </div>

            <button
              className="button button--outline"
              type="button"
              onClick={addSection}
            >
              <FolderPlus size={17} />
              Add section
            </button>
          </div>

          <div className="item-list">
            {sections.map((section, sectionIndex) => (
              <article className="estimate-section-card" key={section.clientId}>
                <div className="estimate-section-heading">
                  <div className="estimate-section-order">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Move section up"
                      disabled={sectionIndex === 0}
                      onClick={() => moveSection(sectionIndex, -1)}
                    >
                      <ChevronUp size={17} />
                    </button>

                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Move section down"
                      disabled={sectionIndex === sections.length - 1}
                      onClick={() => moveSection(sectionIndex, 1)}
                    >
                      <ChevronDown size={17} />
                    </button>
                  </div>

                  <div className="estimate-section-title">
                    <input
                      value={section.title}
                      onChange={(event) =>
                        patchSection(section.clientId, {
                          title: event.target.value,
                        })
                      }
                      placeholder="Section title"
                    />

                    <input
                      value={section.description}
                      onChange={(event) =>
                        patchSection(section.clientId, {
                          description: event.target.value,
                        })
                      }
                      placeholder="Optional customer-facing section description"
                    />
                  </div>

                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Duplicate section"
                    onClick={() => duplicateSection(section.clientId)}
                  >
                    <Copy size={17} />
                  </button>

                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label="Remove section"
                    disabled={sections.length === 1}
                    onClick={() => removeSection(section.clientId)}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>

                <div className="item-list estimate-section-items">
                  {section.items.map((item, itemIndex) => (
                    <article
                      className="line-item"
                      key={`${section.clientId}-${itemIndex}`}
                    >
                      <div className="line-item-top">
                        <select
                          value={item.item_type}
                          onChange={(event) =>
                            patchItem(section.clientId, itemIndex, {
                              item_type: event.target
                                .value as EstimateItemDraft["item_type"],
                            })
                          }
                        >
                          <option value="material">Material</option>
                          <option value="labor">Labor</option>
                          <option value="subcontractor">Subcontractor</option>
                          <option value="allowance">Allowance</option>
                          <option value="fee">Fee</option>
                          <option value="other">Other</option>
                        </select>

                        <input
                          className="grow"
                          value={item.description}
                          onChange={(event) =>
                            patchItem(section.clientId, itemIndex, {
                              description: event.target.value,
                            })
                          }
                          placeholder="Customer-facing description"
                        />

                        <button
                          type="button"
                          className="icon-button"
                          aria-label="Duplicate line item"
                          onClick={() => duplicateItem(section.clientId, itemIndex)}
                        >
                          <Copy size={17} />
                        </button>

                        <button
                          type="button"
                          className="icon-button danger"
                          aria-label="Remove line item"
                          onClick={() =>
                            removeItem(section.clientId, itemIndex)
                          }
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>

                      <div className="line-item-grid">
                        <label>
                          Category
                          <input
                            value={item.category}
                            onChange={(event) =>
                              patchItem(section.clientId, itemIndex, {
                                category: event.target.value,
                              })
                            }
                          />
                        </label>

                        <label>
                          Qty
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.quantity === 0 ? "" : item.quantity}
                            onFocus={(event) => event.currentTarget.select()}
                            onChange={(event) =>
                              patchItem(section.clientId, itemIndex, {
                                quantity:
                                  event.target.value === ""
                                    ? 0
                                    : Number(event.target.value),
                              })
                            }
                          />
                        </label>

                        <label>
                          Unit
                          <input
                            value={item.unit}
                            onChange={(event) =>
                              patchItem(section.clientId, itemIndex, {
                                unit: event.target.value,
                              })
                            }
                          />
                        </label>

                        <label>
                          Unit cost
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_cost === 0 ? "" : item.unit_cost}
                            onFocus={(event) => event.currentTarget.select()}
                            onChange={(event) =>
                              patchItem(section.clientId, itemIndex, {
                                unit_cost:
                                  event.target.value === ""
                                    ? 0
                                    : Number(event.target.value),
                              })
                            }
                          />
                        </label>

                        <label>
                          Markup %
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={
                              item.markup_rate === 0 ? "" : item.markup_rate
                            }
                            onFocus={(event) => event.currentTarget.select()}
                            onChange={(event) =>
                              patchItem(section.clientId, itemIndex, {
                                markup_rate:
                                  event.target.value === ""
                                    ? 0
                                    : Number(event.target.value),
                              })
                            }
                          />
                        </label>

                        <label className="checkbox">
                          <input
                            type="checkbox"
                            checked={item.taxable}
                            onChange={(event) =>
                              patchItem(section.clientId, itemIndex, {
                                taxable: event.target.checked,
                              })
                            }
                          />
                          Taxable
                        </label>

                        {item.item_type !== "labor" && (
                          <>
                            <label>
                              Vendor
                              <input
                                value={item.vendor}
                                onChange={(event) =>
                                  patchItem(section.clientId, itemIndex, {
                                    vendor: event.target.value,
                                  })
                                }
                                placeholder={item.item_type === "subcontractor" ? "Subcontractor name" : "Lowe's"}
                              />
                            </label>
                            <label>
                              SKU / item #
                              <input
                                value={item.vendor_sku}
                                onChange={(event) =>
                                  patchItem(section.clientId, itemIndex, {
                                    vendor_sku: event.target.value,
                                  })
                                }
                              />
                            </label>
                            <label className="span-2">
                              Vendor URL
                              <input
                                value={item.vendor_url}
                                onChange={(event) =>
                                  patchItem(section.clientId, itemIndex, {
                                    vendor_url: event.target.value,
                                  })
                                }
                              />
                            </label>
                          </>
                        )}

                        <div className="span-2 selection-fields">
                          <div className="selection-fields__heading">
                            <strong>Selection / allowance</strong>
                            <small>Track what is decided, who is responsible, and what still needs attention.</small>
                          </div>
                          <div className="form-grid">
                            <label>
                              Status
                              <select
                                value={item.selection_status}
                                onChange={(event) => {
                                  const status = event.target.value as EstimateItemDraft["selection_status"];
                                  patchItem(section.clientId, itemIndex, {
                                    selection_status: status,
                                    item_type: status === "allowance" ? "allowance" : item.item_type,
                                    selection_responsibility: status === "customer_supplied" ? "customer" : item.selection_responsibility,
                                  });
                                }}
                              >
                                <option value="final">Final selection</option>
                                <option value="allowance">Allowance</option>
                                <option value="customer_supplied">Customer supplied</option>
                                <option value="undecided">Undecided</option>
                                <option value="excluded">Excluded</option>
                              </select>
                            </label>
                            <label>
                              Responsible party
                              <select
                                value={item.selection_responsibility}
                                onChange={(event) =>
                                  patchItem(section.clientId, itemIndex, {
                                    selection_responsibility: event.target.value as EstimateItemDraft["selection_responsibility"],
                                  })
                                }
                              >
                                <option value="ironwood">Ironwood</option>
                                <option value="customer">Customer</option>
                              </select>
                            </label>
                            <label>
                              Decision deadline
                              <input
                                type="date"
                                value={item.selection_deadline}
                                onChange={(event) =>
                                  patchItem(section.clientId, itemIndex, { selection_deadline: event.target.value })
                                }
                              />
                            </label>
                            <label>
                              {item.selection_status === "allowance" ? "Allowance choice / category" : "Selected product"}
                              <input
                                value={item.selected_product}
                                onChange={(event) =>
                                  patchItem(section.clientId, itemIndex, { selected_product: event.target.value })
                                }
                                placeholder={item.selection_status === "allowance" ? "Vanity, tile, faucet…" : "Brand, model, color, finish…"}
                              />
                            </label>
                            <label className="span-2">
                              Selection notes
                              <input
                                value={item.selection_notes}
                                onChange={(event) =>
                                  patchItem(section.clientId, itemIndex, { selection_notes: event.target.value })
                                }
                                placeholder="What is still needed or what the customer is providing"
                              />
                            </label>
                          </div>
                        </div>

                        <label className="span-2">
                          Private line note
                          <input
                            value={item.private_notes}
                            onChange={(event) =>
                              patchItem(section.clientId, itemIndex, {
                                private_notes: event.target.value,
                              })
                            }
                            placeholder="Not shown to customer"
                          />
                        </label>
                      </div>

                      <div className="line-total">
                        Customer price:{" "}
                        <strong>
                          {money(
                            item.quantity *
                              item.unit_cost *
                              (1 + item.markup_rate / 100),
                          )}
                        </strong>
                      </div>
                    </article>
                  ))}
                </div>

                <button
                  className="button button--outline"
                  type="button"
                  onClick={() => addItem(section.clientId)}
                >
                  <Plus size={16} />
                  Add line to {section.title || "section"}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="panel form-grid">
          <label className="span-2">
            Detailed scope of work
            <textarea
              rows={10}
              value={scope}
              onChange={(event) => setScope(event.target.value)}
              placeholder="Describe exactly what Ironwood will provide and perform."
            />
          </label>

          <label className="span-2">
            Exclusions and owner-supplied items
            <textarea
              rows={5}
              value={exclusions}
              onChange={(event) => setExclusions(event.target.value)}
            />
          </label>

          <label className="span-2">
            Customer-facing notes
            <textarea
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>

          <label className="span-2">
            Payment schedule
            <textarea
              rows={4}
              value={schedule}
              onChange={(event) => setSchedule(event.target.value)}
            />
          </label>

          <div className="span-2 payment-milestones-editor">
            <div className="selection-fields__heading">
              <strong>Payment milestones</strong>
              <small>Build the actual deposit, progress draws, and final payment the customer will see.</small>
            </div>
            <div className="payment-milestone-list">
              {milestones.map((milestone, index) => {
                const calculatedAmount = milestone.amount_type === "percentage"
                  ? totals.total * Number(milestone.amount_value || 0) / 100
                  : Number(milestone.amount_value || 0);
                return <article key={milestone.clientId}>
                  <label>Milestone<input value={milestone.title} onChange={(event) => setMilestones((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))}/></label>
                  <label>Amount type<select value={milestone.amount_type} onChange={(event) => setMilestones((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, amount_type: event.target.value as PaymentMilestoneDraft["amount_type"] } : item))}><option value="percentage">Percent</option><option value="fixed">Fixed amount</option></select></label>
                  <label>{milestone.amount_type === "percentage" ? "Percent" : "Amount"}<input type="number" min="0" max={milestone.amount_type === "percentage" ? 100 : undefined} step="0.01" value={milestone.amount_value} onChange={(event) => setMilestones((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, amount_value: Number(event.target.value) } : item))}/></label>
                  <label>Trigger / when due<input value={milestone.due_trigger} onChange={(event) => setMilestones((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, due_trigger: event.target.value } : item))} placeholder="After cabinets are installed"/></label>
                  <label>Specific date (optional)<input type="date" value={milestone.due_date} onChange={(event) => setMilestones((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, due_date: event.target.value } : item))}/></label>
                  <div className="payment-milestone-total"><span>Expected</span><strong>{money(calculatedAmount)}</strong><button type="button" className="icon-button danger" aria-label="Remove milestone" onClick={() => setMilestones((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={16}/></button></div>
                </article>;
              })}
            </div>
            <button type="button" className="button button--outline" onClick={() => setMilestones((current) => [...current, { clientId: makeId(), title: `Progress payment ${current.length}`, amount_type: "percentage", amount_value: 0, due_trigger: "", due_date: "" }])}><Plus size={16}/>Add payment milestone</button>
          </div>

          <label className="span-2">
            Private Ironwood notes
            <textarea
              rows={4}
              value={privateNotes}
              onChange={(event) => setPrivateNotes(event.target.value)}
              placeholder="Never shown on the customer proposal."
            />
          </label>
        </section>
      </div>

      <aside className="builder-summary panel">
        <h2>{isEditing ? "Updated total" : "Estimate total"}</h2>

        <div className="draft-save-status" aria-live="polite">
          <span className={draftStatus === "saving" ? "draft-save-dot draft-save-dot--saving" : "draft-save-dot"} />
          {draftStatus === "saving"
            ? "Saving draft…"
            : lastDraftSaved
              ? "Draft saved " + new Date(lastDraftSaved).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
              : "Draft protection ready"}
        </div>

        <div className={readiness.length ? "estimate-readiness estimate-readiness--warning" : "estimate-readiness estimate-readiness--ready"}>
          <div className="estimate-readiness__heading">
            {readiness.length ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            <strong>{readiness.length ? readiness.length + " items to review" : "Ready for final review"}</strong>
          </div>
          {readiness.length > 0 && (
            <ul>
              {readiness.slice(0, 5).map((warning) => <li key={warning}>{warning}</li>)}
              {readiness.length > 5 && <li>Plus {readiness.length - 5} more</li>}
            </ul>
          )}
        </div>

        <label>
          Default markup %
          <input
            type="number"
            min="0"
            step="0.1"
            value={markupRate === 0 ? "" : markupRate}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) =>
              setMarkupRate(
                event.target.value === "" ? 0 : Number(event.target.value),
              )
            }
          />
        </label>

        <button
          type="button"
          className="button button--outline button--block"
          onClick={applyMarkupToAll}
        >
          Apply markup to all lines
        </button>

        <label>
          Sales tax %
          <input
            type="number"
            min="0"
            step="0.001"
            value={taxRate === 0 ? "" : taxRate}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) =>
              setTaxRate(
                event.target.value === "" ? 0 : Number(event.target.value),
              )
            }
          />
        </label>

        <dl className="totals">
          <div>
            <dt>Base cost</dt>
            <dd>{money(totals.subtotal)}</dd>
          </div>
          <div>
            <dt>Markup</dt>
            <dd>{money(totals.markupTotal)}</dd>
          </div>
          <div>
            <dt>Tax</dt>
            <dd>{money(totals.taxTotal)}</dd>
          </div>
          <div className="grand">
            <dt>Total</dt>
            <dd>{money(totals.total)}</dd>
          </div>
        </dl>

        {error && <p className="error-box">{error}</p>}

        <button
          onClick={save}
          disabled={busy}
          className="button button--gold button--block"
        >
          <Save size={17} />
          {busy
            ? "Saving…"
            : isEditing
              ? "Save changes"
              : "Save estimate"}
        </button>

        <p className="fine-print">
          Private notes and raw cost details stay inside Ironwood.
        </p>
      </aside>
    </div>
  );
}
