SMART ESTIMATE BUILDER PATCH

1. Add this type above EstimateBuilderProps:

type EstimatePreset = {
  title?: string;
  paymentSchedule?: string;
  scopeStarter?: string;
  sections?: Array<{
    title: string;
    description?: string;
  }>;
};

2. Add this to EstimateBuilderProps:
  preset?: EstimatePreset;

3. Add preset to the EstimateBuilder destructuring:
  preset,

4. Change these state initializers:

title:
  initialEstimate?.title ?? preset?.title ?? ""

scope:
  initialEstimate?.scope ?? preset?.scopeStarter ?? ""

schedule:
  initialEstimate?.payment_schedule ??
  preset?.paymentSchedule ??
  "30% deposit ..."

sections:
  isEditing
    ? loadSections(initialEstimate, startingMarkup)
    : preset?.sections?.length
      ? preset.sections.map((section) => ({
          clientId: makeId(),
          title: section.title,
          description: section.description ?? "",
          items: [blankItem(startingMarkup)],
        }))
      : loadSections(initialEstimate, startingMarkup)

The included replacement builder file already contains these changes.
