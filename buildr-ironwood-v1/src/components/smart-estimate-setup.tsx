"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type CustomerOption = {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
};

type ProjectType =
  | "bathroom"
  | "kitchen"
  | "flooring"
  | "small-job"
  | "large-remodel"
  | "independence"
  | "other";

export function SmartEstimateSetup({
  customers,
  selectedCustomer,
}: {
  customers: CustomerOption[];
  selectedCustomer?: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [customerOptions, setCustomerOptions] = useState(customers);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [customerBusy, setCustomerBusy] = useState(false);
  const [customerError, setCustomerError] = useState("");
  const [customerId, setCustomerId] = useState(selectedCustomer ?? "");
  const [projectType, setProjectType] = useState<ProjectType>("bathroom");
  const [projectSize, setProjectSize] = useState("standard");
  const [bathType, setBathType] = useState("full-remodel");
  const [floorSqFt, setFloorSqFt] = useState("");
  const [floorType, setFloorType] = useState("LVP");
  const [materialSelected, setMaterialSelected] = useState("no");
  const [largeScope, setLargeScope] = useState("multi-room");

  const description = useMemo(() => {
    switch (projectType) {
      case "bathroom":
        return "Buildr will start the estimate with bathroom-specific phases such as demolition, plumbing, shower/tub work, flooring, fixtures, and finish work.";
      case "kitchen":
        return "Buildr will start with demolition, cabinetry, countertops, plumbing, electrical, backsplash, flooring, paint, and finish work.";
      case "flooring":
        return "Buildr will set up removal/prep, subfloor work, flooring installation, trim, transitions, and cleanup.";
      case "small-job":
        return "Buildr will keep the estimate lean and use a simple deposit/materials/final payment structure.";
      case "large-remodel":
        return "Buildr will create a multi-phase proposal and a progress-payment schedule suitable for a larger project.";
      case "independence":
        return "Start with a saved Independence In-Home Evaluation so the base package and selected Independence options carry into the proposal.";
      default:
        return "Buildr will start with a flexible general structure that you can customize.";
    }
  }, [projectType]);

  async function createCustomer(formData: FormData) {
    setCustomerError("");
    setCustomerBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCustomerError("Your session expired. Sign in again.");
        return;
      }
      const value = (name: string) => String(formData.get(name) ?? "").trim() || null;
      const firstName = value("first_name");
      const lastName = value("last_name");
      if (!firstName || !lastName) {
        setCustomerError("Enter the customer's first and last name.");
        return;
      }
      const { data, error } = await supabase.from("customers").insert({
        owner_id: user.id,
        first_name: firstName,
        last_name: lastName,
        email: value("email"),
        phone: value("phone"),
        address_line1: value("address_line1"),
        city: value("city"),
        state: value("state") || "AR",
        postal_code: value("postal_code"),
      }).select("id,first_name,last_name,company_name").single();

      if (error || !data) {
        setCustomerError(error?.message || "Could not save the customer.");
        return;
      }

      setCustomerOptions((current) => [...current, data].sort((a, b) =>
        (a.last_name || "").localeCompare(b.last_name || "")
      ));
      setCustomerId(data.id);
      setAddingCustomer(false);
    } finally {
      setCustomerBusy(false);
    }
  }

  function continueToEstimate() {
    if (!customerId) return;

    if (projectType === "independence") {
      router.push(`/independence/new?customer=${customerId}`);
      return;
    }

    const params = new URLSearchParams({
      setup: "1",
      customer: customerId,
      projectType,
      projectSize,
    });

    if (projectType === "bathroom") {
      params.set("bathType", bathType);
    }

    if (projectType === "flooring") {
      params.set("floorSqFt", floorSqFt);
      params.set("floorType", floorType);
      params.set("materialSelected", materialSelected);
    }

    if (projectType === "large-remodel") {
      params.set("largeScope", largeScope);
    }

    router.push(`/estimates/new?${params.toString()}`);
  }

  return (
    <div className="stack">
      <section className="panel form-grid">
        <label className="span-2">
          Customer
          <select
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
          >
            <option value="">Choose a customer…</option>
            {customerOptions.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.first_name} {customer.last_name}
                {customer.company_name ? ` — ${customer.company_name}` : ""}
              </option>
            ))}
          </select>
        </label>

        <div className="span-2">
          {!addingCustomer ? (
            <button type="button" className="button button--outline" onClick={() => setAddingCustomer(true)}>
              <UserPlus size={16} /> Add new customer
            </button>
          ) : (
            <form action={createCustomer} className="quick-customer-form">
              <div className="panel-heading">
                <div><h3>New customer</h3><p>Save the essentials now. You can add more details later.</p></div>
                <button type="button" className="icon-button" aria-label="Close new customer form" onClick={() => setAddingCustomer(false)}><X size={17} /></button>
              </div>
              <div className="form-grid">
                <label>First name<input name="first_name" required /></label>
                <label>Last name<input name="last_name" required /></label>
                <label>Email<input name="email" type="email" /></label>
                <label>Phone<input name="phone" /></label>
                <label className="span-2">Street address<input name="address_line1" /></label>
                <label>City<input name="city" /></label>
                <label>State<input name="state" defaultValue="AR" /></label>
                <label>ZIP code<input name="postal_code" /></label>
              </div>
              {customerError && <p className="error-box">{customerError}</p>}
              <button className="button button--gold" disabled={customerBusy}>
                {customerBusy ? "Saving customer…" : "Save and use customer"}
              </button>
            </form>
          )}
        </div>

        <div className="span-2 smart-setup-group">
          <span className="smart-setup-label">What kind of project is this?</span>

          <div className="smart-choice-grid">
            {[
              ["bathroom", "Bathroom"],
              ["kitchen", "Kitchen"],
              ["flooring", "Flooring"],
              ["small-job", "Small job / repair"],
              ["large-remodel", "Whole-home / large remodel"],
              ["independence", "Independence Collection"],
              ["other", "Other / custom"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`smart-choice ${
                  projectType === value ? "smart-choice--active" : ""
                }`}
                onClick={() => setProjectType(value as ProjectType)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="span-2">
          Project size
          <select
            value={projectSize}
            onChange={(event) => setProjectSize(event.target.value)}
          >
            <option value="small">Small / straightforward</option>
            <option value="standard">Standard remodel</option>
            <option value="complex">Complex / extensive</option>
          </select>
        </label>

        {projectType === "bathroom" && (
          <label className="span-2">
            Bathroom project
            <select
              value={bathType}
              onChange={(event) => setBathType(event.target.value)}
            >
              <option value="full-remodel">Full bathroom remodel</option>
              <option value="tub-shower-conversion">
                Tub / shower conversion
              </option>
              <option value="shower-only">Shower-only remodel</option>
              <option value="partial">Partial bathroom update</option>
            </select>
          </label>
        )}

        {projectType === "flooring" && (
          <>
            <label>
              Approx. square footage
              <input
                type="number"
                min="0"
                value={floorSqFt}
                onChange={(event) => setFloorSqFt(event.target.value)}
                placeholder="850"
              />
            </label>

            <label>
              Material type
              <select
                value={floorType}
                onChange={(event) => setFloorType(event.target.value)}
              >
                <option value="LVP">LVP</option>
                <option value="Laminate">Laminate</option>
                <option value="Hardwood">Hardwood</option>
                <option value="Tile">Tile</option>
                <option value="Carpet">Carpet</option>
                <option value="Other">Other</option>
              </select>
            </label>

            <label className="span-2">
              Has the final flooring material been selected?
              <select
                value={materialSelected}
                onChange={(event) => setMaterialSelected(event.target.value)}
              >
                <option value="no">Not yet</option>
                <option value="yes">Yes</option>
              </select>
            </label>
          </>
        )}

        {projectType === "large-remodel" && (
          <label className="span-2">
            Large-project scope
            <select
              value={largeScope}
              onChange={(event) => setLargeScope(event.target.value)}
            >
              <option value="multi-room">Multiple rooms</option>
              <option value="whole-home">Whole-home remodel</option>
              <option value="addition">Addition / major structural work</option>
            </select>
          </label>
        )}
      </section>

      <section className="panel smart-setup-summary">
        <h2>Buildr will prepare the estimate</h2>
        <p>{description}</p>

        <div className="button-row">
          <button
            className="button button--gold"
            type="button"
            onClick={continueToEstimate}
            disabled={!customerId}
          >
            Build estimate
          </button>
        </div>

        {!customerId && (
          <p className="fine-print">Choose a customer before continuing.</p>
        )}
      </section>
    </div>
  );
}
