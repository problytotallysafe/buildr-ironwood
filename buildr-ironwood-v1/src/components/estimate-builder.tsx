"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  FolderPlus,
  Plus,
  Save,
  Trash2,
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

type InitialEstimate = {
  id: string;
  customer_id: string;
  title: string;
  project_address: string | null;
  scope: string | null;
  exclusions: string | null;
  customer_notes: string | null;
  private_notes: string | null;
  payment_schedule: string | null;
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
      sort_order: number;
    }>;
  }>;
};

type EstimateBuilderProps = {
  customers: CustomerOption[];

  defaults: {
    tax_rate: number;
    markup_rate: number;
  };

  selectedCustomer?: string;
  initialEstimate?: InitialEstimate;
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
  };
}

function blankSection(
  title = "General",
  markup = 20,
): EstimateSectionDraft {
  return {
    clientId: makeId(),
    title,
    description: "",
    items: [blankItem(markup)],
  };
}

function loadSections(
  initialEstimate: InitialEstimate | undefined,
  markup: number,
): EstimateSectionDraft[] {
  if (!initialEstimate?.sections?.length) {
    return [blankSection("General", markup)];
  }

  return [...initialEstimate.sections]
    .sort(
      (a, b) =>
        Number(a.sort_order) - Number(b.sort_order),
    )
    .map((section) => ({
      clientId: section.id || makeId(),

      title: section.title || "General",

      description: section.description || "",

      items: [...(section.items ?? [])]
        .sort(
          (a, b) =>
            Number(a.sort_order) - Number(b.sort_order),
        )
        .map((item) => ({
          item_type: item.item_type || "material",

          category: item.category || "",

          description: item.description || "",

          quantity: Number(item.quantity ?? 1),

          unit: item.unit || "each",

          unit_cost: Number(item.unit_cost ?? 0),

          markup_rate: Number(
            item.markup_rate ?? markup,
          ),

          taxable: Boolean(item.taxable),

          vendor: item.vendor || "",

          vendor_sku: item.vendor_sku || "",

          vendor_url: item.vendor_url || "",

          private_notes: item.private_notes || "",
        })),
    }));
}

export function EstimateBuilder({
  customers,
  defaults,
  selectedCustomer,
  initialEstimate,
}: EstimateBuilderProps) {
  const router = useRouter();

  const supabase = createClient();

  const isEditing = Boolean(initialEstimate?.id);

  const startingMarkup = Number(
    initialEstimate?.default_markup_rate ??
      defaults.markup_rate ??
      20,
  );

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");

  const [customerId, setCustomerId] = useState(
    initialEstimate?.customer_id ??
      selectedCustomer ??
      "",
  );

  const [title, setTitle] = useState(
    initialEstimate?.title ?? "",
  );

  const [address, setAddress] = useState(
    initialEstimate?.project_address ?? "",
  );

  const [scope, setScope] = useState(
    initialEstimate?.scope ?? "",
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

  const [schedule, setSchedule] = useState(
    initialEstimate?.payment_schedule ??
      "30% deposit to reserve scheduling; progress payments tied to completed phases; final balance due at final walkthrough.",
  );

  const [taxRate, setTaxRate] = useState(
    Number(
      initialEstimate?.tax_rate ??
        defaults.tax_rate ??
        0,
    ),
  );

  const [markupRate, setMarkupRate] = useState(
    startingMarkup,
  );

  const [sections, setSections] = useState<
    EstimateSectionDraft[]
  >(
    loadSections(
      initialEstimate,
      startingMarkup,
    ),
  );

  const allItems = useMemo(
    () =>
      sections.flatMap(
        (section) => section.items,
      ),
    [sections],
  );

  const totals = useMemo(
    () =>
      estimateTotals(
        allItems,
        taxRate,
      ),
    [allItems, taxRate],
  );

  function patchSection(
    sectionId: string,
    values: Partial<
      Pick<
        EstimateSectionDraft,
        "title" | "description"
      >
    >,
  ) {
    setSections((current) =>
      current.map((section) =>
        section.clientId === sectionId
          ? {
              ...section,
              ...values,
            }
          : section,
      ),
    );
  }

  function addSection() {
    setSections((current) => [
      ...current,

      blankSection(
        `Section ${current.length + 1}`,
        markupRate,
      ),
    ]);
  }

  function removeSection(
    sectionId: string,
  ) {
    setSections((current) => {
      if (current.length === 1) {
        return current;
      }

      return current.filter(
        (section) =>
          section.clientId !== sectionId,
      );
    });
  }

  function moveSection(
    sectionIndex: number,
    direction: -1 | 1,
  ) {
    setSections((current) => {
      const nextIndex =
        sectionIndex + direction;

      if (
        nextIndex < 0 ||
        nextIndex >= current.length
      ) {
        return current;
      }

      const copy = [...current];

      const [moved] = copy.splice(
        sectionIndex,
        1,
      );

      copy.splice(
        nextIndex,
        0,
        moved,
      );

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
        if (
          section.clientId !== sectionId
        ) {
          return section;
        }

        return {
          ...section,

          items: section.items.map(
            (item, index) =>
              index === itemIndex
                ? {
                    ...item,
                    ...values,
                  }
                : item,
          ),
        };
      }),
    );
  }

  function addItem(
    sectionId: string,
  ) {
    setSections((current) =>
      current.map((section) =>
        section.clientId === sectionId
          ? {
              ...section,

              items: [
                ...section.items,
                blankItem(markupRate),
              ],
            }
          : section,
      ),
    );
  }

  function removeItem(
    sectionId: string,
    itemIndex: number,
  ) {
    setSections((current) =>
      current.map((section) => {
        if (
          section.clientId !== sectionId
        ) {
          return section;
        }

        return {
          ...section,

          items: section.items.filter(
            (_, index) =>
              index !== itemIndex,
          ),
        };
      }),
    );
  }

  function applyMarkupToAll() {
    setSections((current) =>
      current.map((section) => ({
        ...section,

        items: section.items.map(
          (item) => ({
            ...item,

            markup_rate:
              markupRate,
          }),
        ),
      })),
    );
  }

  async function save() {
    setError("");

    if (
      !customerId ||
      !title.trim()
    ) {
      setError(
        "Choose a customer and enter a project title.",
      );

      return;
    }

    const sectionsWithItems =
      sections.filter((section) =>
        section.items.some(
          (item) =>
            item.description.trim(),
        ),
      );

    if (
      sectionsWithItems.length === 0
    ) {
      setError(
        "Add at least one completed line item.",
      );

      return;
    }

    if (
      sectionsWithItems.some(
        (section) =>
          !section.title.trim(),
      )
    ) {
      setError(
        "Every section containing line items needs a title.",
      );

      return;
    }

    setBusy(true);

    try {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        setError(
          "Your session expired. Sign in again.",
        );

        return;
      }

      const estimateValues = {
        customer_id:
          customerId,

        title:
          title.trim(),

        project_address:
          address.trim() || null,

        scope:
          scope.trim() || null,

        exclusions:
          exclusions.trim() || null,

        customer_notes:
          notes.trim() || null,

        private_notes:
          privateNotes.trim() ||
          null,

        payment_schedule:
          schedule.trim() || null,

        tax_rate:
          taxRate,

        default_markup_rate:
          markupRate,

        subtotal:
          totals.subtotal,

        markup_total:
          totals.markupTotal,

        tax_total:
          totals.taxTotal,

        total:
          totals.total,
      };

      let estimateId =
        initialEstimate?.id;

      if (
        isEditing &&
        estimateId
      ) {
        const {
          error:
            updateError,
        } =
          await supabase
            .from("estimates")
            .update(
              estimateValues,
            )
            .eq(
              "id",
              estimateId,
            );

        if (updateError) {
          setError(
            updateError.message,
          );

          return;
        }

        const {
          error:
            deleteItemsError,
        } =
          await supabase
            .from(
              "estimate_items",
            )
            .delete()
            .eq(
              "estimate_id",
              estimateId,
            );

        if (
          deleteItemsError
        ) {
          setError(
            deleteItemsError.message,
          );

          return;
        }

        const {
          error:
            deleteSectionsError,
        } =
          await supabase
            .from(
              "estimate_sections",
            )
            .delete()
            .eq(
              "estimate_id",
              estimateId,
            );

        if (
          deleteSectionsError
        ) {
          setError(
            deleteSectionsError.message,
          );

          return;
        }
      } else {
        const {
          data:
            estimate,

          error:
            estimateError,
        } =
          await supabase
            .from("estimates")
            .insert({
              owner_id:
                user.id,

              ...estimateValues,
            })
            .select("id")
            .single();

        if (
          estimateError ||
          !estimate
        ) {
          setError(
            estimateError?.message ||
              "Could not save the estimate.",
          );

          return;
        }

        estimateId =
          String(
            estimate.id,
          );
      }

      if (!estimateId) {
        setError(
          "Could not determine the estimate ID.",
        );

        return;
      }

      const sectionRows =
        sectionsWithItems.map(
          (
            section,
            index,
          ) => ({
            owner_id:
              user.id,

            estimate_id:
              estimateId,

            title:
              section.title.trim(),

            description:
              section.description.trim() ||
              null,

            sort_order:
              index,
          }),
        );

      const {
        data:
          savedSections,

        error:
          sectionError,
      } =
        await supabase
          .from(
            "estimate_sections",
          )
          .insert(
            sectionRows,
          )
          .select(
            "id, sort_order",
          );

      if (
        sectionError ||
        !savedSections
      ) {
        setError(
          sectionError?.message ||
            "Could not save estimate sections.",
        );

        return;
      }

      const sectionIdByOrder =
        new Map<
          number,
          string
        >(
          savedSections.map(
            (section) => [
              Number(
                section.sort_order,
              ),

              String(
                section.id,
              ),
            ],
          ),
        );

      const itemRows =
        sectionsWithItems.flatMap(
          (
            section,
            sectionIndex,
          ) =>
            section.items
              .filter(
                (item) =>
                  item.description.trim(),
              )
              .map(
                (
                  item,
                  itemIndex,
                ) => {
                  const baseCost =
                    item.quantity *
                    item.unit_cost;

                  const lineMarkup =
                    baseCost *
                    (item.markup_rate /
                      100);

                  return {
                    owner_id:
                      user.id,

                    estimate_id:
                      estimateId,

                    section_id:
                      sectionIdByOrder.get(
                        sectionIndex,
                      ),

                    sort_order:
                      itemIndex,

                    item_type:
                      item.item_type,

                    category:
                      item.category.trim() ||
                      null,

                    description:
                      item.description.trim(),

                    quantity:
                      item.quantity,

                    unit:
                      item.unit.trim() ||
                      "each",

                    unit_cost:
                      item.unit_cost,

                    markup_rate:
                      item.markup_rate,

                    taxable:
                      item.taxable,

                    vendor:
                      item.vendor.trim() ||
                      null,

                    vendor_sku:
                      item.vendor_sku.trim() ||
                      null,

                    vendor_url:
                      item.vendor_url.trim() ||
                      null,

                    private_notes:
                      item.private_notes.trim() ||
                      null,

                    line_subtotal:
                      baseCost,

                    line_markup:
                      lineMarkup,

                    line_total:
                      baseCost +
                      lineMarkup,
                  };
                },
              ),
        );

      const {
        error:
          itemError,
      } =
        await supabase
          .from(
            "estimate_items",
          )
          .insert(
            itemRows,
          );

      if (itemError) {
        setError(
          itemError.message,
        );

        return;
      }

      router.push(
        `/estimates/${estimateId}`,
      );

      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="builder-layout">
      <div className="builder-main">
        <section className="panel form-grid">
          <label className="span-2">
            Customer

            <select
              value={customerId}
              onChange={(event) =>
                setCustomerId(
                  event.target.value,
                )
              }
              required
            >
              <option value="">
                Choose a customer…
              </option>

              {customers.map(
                (customer) => (
                  <option
                    key={
                      customer.id
                    }
                    value={
                      customer.id
                    }
                  >
                    {
                      customer.first_name
                    }{" "}
                    {
                      customer.last_name
                    }

                    {customer.company_name
                      ? ` — ${customer.company_name}`
                      : ""}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="span-2">
            Project title

            <input
              value={title}
              onChange={(event) =>
                setTitle(
                  event.target.value,
                )
              }
              placeholder="Primary bathroom remodel"
            />
          </label>

          <label className="span-2">
            Project address

            <input
              value={address}
              onChange={(event) =>
                setAddress(
                  event.target.value,
                )
              }
              placeholder="Use the customer address or enter another jobsite"
            />
          </label>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>
                Estimate sections
              </h2>

              <p>
                Organize the job
                into phases such
                as demolition,
                framing,
                plumbing,
                electrical,
                drywall, and
                finishes.
              </p>
            </div>

            <button
              className="button button--outline"
              type="button"
              onClick={
                addSection
              }
            >
              <FolderPlus
                size={17}
              />

              Add section
            </button>
          </div>

          <div className="item-list">
            {sections.map(
              (
                section,
                sectionIndex,
              ) => (
                <article
                  className="estimate-section-card"
                  key={
                    section.clientId
                  }
                >
                  <div className="estimate-section-heading">
                    <div className="estimate-section-order">
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Move section up"
                        disabled={
                          sectionIndex ===
                          0
                        }
                        onClick={() =>
                          moveSection(
                            sectionIndex,
                            -1,
                          )
                        }
                      >
                        <ChevronUp
                          size={
                            17
                          }
                        />
                      </button>

                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Move section down"
                        disabled={
                          sectionIndex ===
                          sections.length -
                            1
                        }
                        onClick={() =>
                          moveSection(
                            sectionIndex,
                            1,
                          )
                        }
                      >
                        <ChevronDown
                          size={
                            17
                          }
                        />
                      </button>
                    </div>

                    <div className="estimate-section-title">
                      <input
                        value={
                          section.title
                        }
                        onChange={(
                          event,
                        ) =>
                          patchSection(
                            section.clientId,
                            {
                              title:
                                event
                                  .target
                                  .value,
                            },
                          )
                        }
                        placeholder="Section title"
                      />

                      <input
                        value={
                          section.description
                        }
                        onChange={(
                          event,
                        ) =>
                          patchSection(
                            section.clientId,
                            {
                              description:
                                event
                                  .target
                                  .value,
                            },
                          )
                        }
                        placeholder="Optional customer-facing section description"
                      />
                    </div>

                    <button
                      type="button"
                      className="icon-button danger"
                      aria-label="Remove section"
                      disabled={
                        sections.length ===
                        1
                      }
                      onClick={() =>
                        removeSection(
                          section.clientId,
                        )
                      }
                    >
                      <Trash2
                        size={17}
                      />
                    </button>
                  </div>

                  <div className="item-list estimate-section-items">
                    {section.items.map(
                      (
                        item,
                        itemIndex,
                      ) => (
                        <article
                          className="line-item"
                          key={`${section.clientId}-${itemIndex}`}
                        >
                          <div className="line-item-top">
                            <select
                              value={
                                item.item_type
                              }
                              onChange={(
                                event,
                              ) =>
                                patchItem(
                                  section.clientId,
                                  itemIndex,
                                  {
                                    item_type:
                                      event
                                        .target
                                        .value as EstimateItemDraft["item_type"],
                                  },
                                )
                              }
                            >
                              <option value="material">
                                Material
                              </option>

                              <option value="labor">
                                Labor
                              </option>

                              <option value="subcontractor">
                                Subcontractor
                              </option>

                              <option value="allowance">
                                Allowance
                              </option>

                              <option value="fee">
                                Fee
                              </option>

                              <option value="other">
                                Other
                              </option>
                            </select>

                            <input
                              className="grow"
                              value={
                                item.description
                              }
                              onChange={(
                                event,
                              ) =>
                                patchItem(
                                  section.clientId,
                                  itemIndex,
                                  {
                                    description:
                                      event
                                        .target
                                        .value,
                                  },
                                )
                              }
                              placeholder="Customer-facing description"
                            />

                            <button
                              type="button"
                              className="icon-button danger"
                              aria-label="Remove line item"
                              onClick={() =>
                                removeItem(
                                  section.clientId,
                                  itemIndex,
                                )
                              }
                            >
                              <Trash2
                                size={
                                  17
                                }
                              />
                            </button>
                          </div>

                          <div className="line-item-grid">
                            <label>
                              Category

                              <input
                                value={
                                  item.category
                                }
                                onChange={(
                                  event,
                                ) =>
                                  patchItem(
                                    section.clientId,
                                    itemIndex,
                                    {
                                      category:
                                        event
                                          .target
                                          .value,
                                    },
                                  )
                                }
                              />
                            </label>

                            <label>
                              Qty

                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                  item.quantity ===
                                  0
                                    ? ""
                                    : item.quantity
                                }
                                onFocus={(
                                  event,
                                ) =>
                                  event.currentTarget.select()
                                }
                                onChange={(
                                  event,
                                ) =>
                                  patchItem(
                                    section.clientId,
                                    itemIndex,
                                    {
                                      quantity:
                                        event
                                          .target
                                          .value ===
                                        ""
                                          ? 0
                                          : Number(
                                              event
                                                .target
                                                .value,
                                            ),
                                    },
                                  )
                                }
                              />
                            </label>

                            <label>
                              Unit

                              <input
                                value={
                                  item.unit
                                }
                                onChange={(
                                  event,
                                ) =>
                                  patchItem(
                                    section.clientId,
                                    itemIndex,
                                    {
                                      unit:
                                        event
                                          .target
                                          .value,
                                    },
                                  )
                                }
                              />
                            </label>

                            <label>
                              Unit cost

                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                  item.unit_cost ===
                                  0
                                    ? ""
                                    : item.unit_cost
                                }
                                onFocus={(
                                  event,
                                ) =>
                                  event.currentTarget.select()
                                }
                                onChange={(
                                  event,
                                ) =>
                                  patchItem(
                                    section.clientId,
                                    itemIndex,
                                    {
                                      unit_cost:
                                        event
                                          .target
                                          .value ===
                                        ""
                                          ? 0
                                          : Number(
                                              event
                                                .target
                                                .value,
                                            ),
                                    },
                                  )
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
                                  item.markup_rate ===
                                  0
                                    ? ""
                                    : item.markup_rate
                                }
                                onFocus={(
                                  event,
                                ) =>
                                  event.currentTarget.select()
                                }
                                onChange={(
                                  event,
                                ) =>
                                  patchItem(
                                    section.clientId,
                                    itemIndex,
                                    {
                                      markup_rate:
                                        event
                                          .target
                                          .value ===
                                        ""
                                          ? 0
                                          : Number(
                                              event
                                                .target
                                                .value,
                                            ),
                                    },
                                  )
                                }
                              />
                            </label>

                            <label className="checkbox">
                              <input
                                type="checkbox"
                                checked={
                                  item.taxable
                                }
                                onChange={(
                                  event,
                                ) =>
                                  patchItem(
                                    section.clientId,
                                    itemIndex,
                                    {
                                      taxable:
                                        event
                                          .target
                                          .checked,
                                    },
                                  )
                                }
                              />

                              Taxable
                            </label>

                            <label>
                              Vendor

                              <input
                                value={
                                  item.vendor
                                }
                                onChange={(
                                  event,
                                ) =>
                                  patchItem(
                                    section.clientId,
                                    itemIndex,
                                    {
                                      vendor:
                                        event
                                          .target
                                          .value,
                                    },
                                  )
                                }
                                placeholder="Lowe's"
                              />
                            </label>

                            <label>
                              SKU / item #

                              <input
                                value={
                                  item.vendor_sku
                                }
                                onChange={(
                                  event,
                                ) =>
                                  patchItem(
                                    section.clientId,
                                    itemIndex,
                                    {
                                      vendor_sku:
                                        event
                                          .target
                                          .value,
                                    },
                                  )
                                }
                              />
                            </label>

                            <label className="span-2">
                              Vendor URL

                              <input
                                value={
                                  item.vendor_url
                                }
                                onChange={(
                                  event,
                                ) =>
                                  patchItem(
                                    section.clientId,
                                    itemIndex,
                                    {
                                      vendor_url:
                                        event
                                          .target
                                          .value,
                                    },
                                  )
                                }
                              />
                            </label>

                            <label className="span-2">
                              Private line
                              note

                              <input
                                value={
                                  item.private_notes
                                }
                                onChange={(
                                  event,
                                ) =>
                                  patchItem(
                                    section.clientId,
                                    itemIndex,
                                    {
                                      private_notes:
                                        event
                                          .target
                                          .value,
                                    },
                                  )
                                }
                                placeholder="Not shown to customer"
                              />
                            </label>
                          </div>

                          <div className="line-total">
                            Customer
                            price:{" "}

                            <strong>
                              {money(
                                item.quantity *
                                  item.unit_cost *
                                  (1 +
                                    item.markup_rate /
                                      100),
                              )}
                            </strong>
                          </div>
                        </article>
                      ),
                    )}
                  </div>

                  <button
                    className="button button--outline"
                    type="button"
                    onClick={() =>
                      addItem(
                        section.clientId,
                      )
                    }
                  >
                    <Plus
                      size={16}
                    />

                    Add line to{" "}
                    {section.title ||
                      "section"}
                  </button>
                </article>
              ),
            )}
          </div>
        </section>

        <section className="panel form-grid">
          <label className="span-2">
            Detailed scope of work

            <textarea
              rows={10}
              value={scope}
              onChange={(event) =>
                setScope(
                  event.target.value,
                )
              }
              placeholder="Describe exactly what Ironwood will provide and perform."
            />
          </label>

          <label className="span-2">
            Exclusions and
            owner-supplied items

            <textarea
              rows={5}
              value={exclusions}
              onChange={(event) =>
                setExclusions(
                  event.target.value,
                )
              }
            />
          </label>

          <label className="span-2">
            Customer-facing notes

            <textarea
              rows={4}
              value={notes}
              onChange={(event) =>
                setNotes(
                  event.target.value,
                )
              }
            />
          </label>

          <label className="span-2">
            Payment schedule

            <textarea
              rows={4}
              value={schedule}
              onChange={(event) =>
                setSchedule(
                  event.target.value,
                )
              }
            />
          </label>

          <label className="span-2">
            Private Ironwood notes

            <textarea
              rows={4}
              value={privateNotes}
              onChange={(event) =>
                setPrivateNotes(
                  event.target.value,
                )
              }
              placeholder="Never shown on the customer proposal."
            />
          </label>
        </section>
      </div>

      <aside className="builder-summary panel">
        <h2>
          {isEditing
            ? "Updated total"
            : "Estimate total"}
        </h2>

        <label>
          Default markup %

          <input
            type="number"
            min="0"
            step="0.1"
            value={
              markupRate === 0
                ? ""
                : markupRate
            }
            onFocus={(event) =>
              event.currentTarget.select()
            }
            onChange={(event) =>
              setMarkupRate(
                event.target.value === ""
                  ? 0
                  : Number(
                      event.target.value,
                    ),
              )
            }
          />
        </label>

        <button
          type="button"
          className="button button--outline button--block"
          onClick={
            applyMarkupToAll
          }
        >
          Apply markup to all lines
        </button>

        <label>
          Sales tax %

          <input
            type="number"
            min="0"
            step="0.001"
            value={
              taxRate === 0
                ? ""
                : taxRate
            }
            onFocus={(event) =>
              event.currentTarget.select()
            }
            onChange={(event) =>
              setTaxRate(
                event.target.value === ""
                  ? 0
                  : Number(
                      event.target.value,
                    ),
              )
            }
          />
        </label>

        <dl className="totals">
          <div>
            <dt>
              Base cost
            </dt>

            <dd>
              {money(
                totals.subtotal,
              )}
            </dd>
          </div>

          <div>
            <dt>
              Markup
            </dt>

            <dd>
              {money(
                totals.markupTotal,
              )}
            </dd>
          </div>

          <div>
            <dt>
              Tax
            </dt>

            <dd>
              {money(
                totals.taxTotal,
              )}
            </dd>
          </div>

          <div className="grand">
            <dt>
              Total
            </dt>

            <dd>
              {money(
                totals.total,
              )}
            </dd>
          </div>
        </dl>

        {error && (
          <p className="error-box">
            {error}
          </p>
        )}

        <button
          onClick={save}
          disabled={busy}
          className="button button--gold button--block"
        >
          <Save
            size={17}
          />

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