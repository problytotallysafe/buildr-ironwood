import { EstimateBuilder } from "@/components/estimate-builder";
import { PageHeader } from "@/components/page-header";
import { SmartEstimateSetup } from "@/components/smart-estimate-setup";
import { createClient } from "@/lib/supabase/server";

type SearchParams = {
  setup?: string;
  customer?: string;
  projectType?: string;
  projectSize?: string;
  bathType?: string;
  floorSqFt?: string;
  floorType?: string;
  materialSelected?: string;
  largeScope?: string;
  assessment?: string;
};

function buildPreset(query: SearchParams, assessment?: any) {
  const projectType = query.projectType ?? "other";
  const size = query.projectSize ?? "standard";

  const smallPayment =
    "30% deposit plus material costs to reserve scheduling. Remaining balance due upon completion.";

  const standardPayment =
    "30% deposit to reserve scheduling. Progress payment due after demolition and rough-in work. Remaining balance due at substantial completion.";

  const largePayment =
    "30% deposit at contract signing. Progress draws are due at agreed project milestones, with the final balance due after substantial completion and final walkthrough.";

  if (projectType === "independence" && assessment) {
    const baseItems = (assessment.base_package_items ?? []) as string[];
    const selectedOptions = (assessment.independence_options ?? []) as string[];

    return {
      title: "Ironwood Independence Collection",
      independenceAssessmentId: assessment.id,
      paymentSchedule: standardPayment,
      scopeStarter: [
        "Ironwood Independence Collection",
        "This plan is designed to improve everyday comfort, safety, and long-term independence.",
        assessment.customer_goals
          ? `Customer goals:\n${assessment.customer_goals}`
          : "",
        baseItems.length
          ? `Base package:\n${baseItems.map((item) => `• ${item}`).join("\n")}`
          : "",
        selectedOptions.length
          ? `Selected Independence options (priced separately):\n${selectedOptions.map((item) => `• ${item}`).join("\n")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      sections: [
        {
          title: "Independence Collection base package",
          description:
            "Standardized installation focused on comfort, safety, and daily independence.",
        },
        ...selectedOptions.map((title) => ({
          title,
          description: "Separately priced Independence option.",
        })),
      ],
    };
  }

  if (projectType === "bathroom") {
    const bathType = query.bathType ?? "full-remodel";

    const sections =
      bathType === "tub-shower-conversion"
        ? [
            "Site protection & demolition",
            "Framing & substrate preparation",
            "Plumbing",
            "Tub / shower system",
            "Drywall & paint",
            "Finish work & cleanup",
          ]
        : bathType === "shower-only"
          ? [
              "Site protection & demolition",
              "Framing & shower preparation",
              "Plumbing",
              "Shower system",
              "Glass / enclosure allowance",
              "Drywall & paint",
              "Finish work & cleanup",
            ]
          : bathType === "partial"
            ? [
                "Site protection",
                "Selective demolition",
                "Fixtures & finishes",
                "Flooring",
                "Paint & finish work",
                "Cleanup",
              ]
            : [
                "Site protection & demolition",
                "Framing",
                "Plumbing",
                "Electrical",
                "Tub / shower system",
                "Drywall & paint",
                "Flooring",
                "Vanity, toilet & fixtures",
                "Finish work & cleanup",
              ];

    return {
      title: "Bathroom Remodel",
      paymentSchedule: size === "small" ? smallPayment : standardPayment,
      sections: sections.map((title) => ({
        title,
        description: "",
      })),
    };
  }

  if (projectType === "kitchen") {
    return {
      title: "Kitchen Remodel",
      paymentSchedule: size === "complex" ? largePayment : standardPayment,
      sections: [
        "Site protection & demolition",
        "Framing & wall modifications",
        "Plumbing",
        "Electrical",
        "Cabinetry",
        "Countertops",
        "Backsplash",
        "Flooring",
        "Drywall & paint",
        "Finish work & cleanup",
      ].map((title) => ({ title, description: "" })),
    };
  }

  if (projectType === "flooring") {
    const sqFt = query.floorSqFt?.trim();
    const material = query.floorType || "Flooring";
    const selected =
      query.materialSelected === "yes"
        ? "Final material selected."
        : "Final material selection pending.";

    return {
      title: `${material} Flooring`,
      paymentSchedule: smallPayment,
      scopeStarter: [
        sqFt ? `Approximate flooring area: ${sqFt} sq. ft.` : "",
        `Material type: ${material}.`,
        selected,
      ]
        .filter(Boolean)
        .join("\n"),
      sections: [
        "Site protection & furniture coordination",
        "Existing flooring removal",
        "Subfloor preparation / repairs",
        `${material} installation`,
        "Transitions, trim & baseboards",
        "Cleanup",
      ].map((title) => ({ title, description: "" })),
    };
  }

  if (projectType === "small-job") {
    return {
      title: "Small Project",
      paymentSchedule: smallPayment,
      sections: [
        "Work to be performed",
        "Materials",
        "Finish work & cleanup",
      ].map((title) => ({ title, description: "" })),
    };
  }

  if (projectType === "large-remodel") {
    return {
      title:
        query.largeScope === "whole-home"
          ? "Whole-Home Remodel"
          : query.largeScope === "addition"
            ? "Major Remodel / Addition"
            : "Multi-Room Remodel",
      paymentSchedule: largePayment,
      sections: [
        "Preconstruction & site protection",
        "Demolition",
        "Structural & framing",
        "Plumbing",
        "Electrical",
        "HVAC / mechanical",
        "Insulation",
        "Drywall",
        "Cabinetry & built-ins",
        "Flooring",
        "Paint & finishes",
        "Trim, doors & hardware",
        "Fixtures & final installations",
        "Punch list & final cleanup",
      ].map((title) => ({ title, description: "" })),
    };
  }

  return {
    title: "Custom Project",
    paymentSchedule: size === "small" ? smallPayment : standardPayment,
    sections: [
      "Scope of work",
      "Materials",
      "Labor",
      "Finish work & cleanup",
    ].map((title) => ({ title, description: "" })),
  };
}

export default async function NewEstimatePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const query = await searchParams;
  const supabase = await createClient();

  const [{ data: customers }, { data: settings }] = await Promise.all([
    supabase
      .from("customers")
      .select("id,first_name,last_name,company_name")
      .order("last_name"),
    supabase
      .from("business_settings")
      .select("default_tax_rate,default_markup_rate")
      .maybeSingle(),
  ]);

  const { data: assessment } = query.assessment
    ? await supabase
        .from("independence_assessments")
        .select("*")
        .eq("id", query.assessment)
        .maybeSingle()
    : { data: null };

  if (query.setup !== "1") {
    return (
      <div className="page-wrap page-wrap--narrow">
        <PageHeader
          eyebrow="Smart estimate setup"
          title="Tell Buildr about the job"
          description="Answer a few quick questions and Buildr will prepare the right starting structure. You can change everything afterward."
        />

        <SmartEstimateSetup
          customers={customers ?? []}
          selectedCustomer={query.customer}
        />
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow="Estimate builder"
        title="Write a detailed bid"
        description="Buildr prepared a starting structure from your project answers. Adjust anything you need before saving."
      />

      <EstimateBuilder
        customers={customers ?? []}
        selectedCustomer={query.customer}
        defaults={{
          tax_rate: Number(settings?.default_tax_rate ?? 0),
          markup_rate: Number(settings?.default_markup_rate ?? 20),
        }}
        preset={buildPreset(query, assessment)}
      />
    </div>
  );
}
