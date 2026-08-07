"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
  | "other";

export function SmartEstimateSetup({
  customers,
  selectedCustomer,
}: {
  customers: CustomerOption[];
  selectedCustomer?: string;
}) {
  const router = useRouter();

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
      default:
        return "Buildr will start with a flexible general structure that you can customize.";
    }
  }, [projectType]);

  function continueToEstimate() {
    if (!customerId) return;

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
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.first_name} {customer.last_name}
                {customer.company_name ? ` — ${customer.company_name}` : ""}
              </option>
            ))}
          </select>
        </label>

        <div className="span-2 smart-setup-group">
          <span className="smart-setup-label">What kind of project is this?</span>

          <div className="smart-choice-grid">
            {[
              ["bathroom", "Bathroom"],
              ["kitchen", "Kitchen"],
              ["flooring", "Flooring"],
              ["small-job", "Small job / repair"],
              ["large-remodel", "Whole-home / large remodel"],
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
