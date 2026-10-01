import { ListChecks, Plus, Trash2 } from "lucide-react";

export type WorkStepDraft = {
  title: string;
  assigneeId?: string;
};

type StepOwner = {
  id: string;
  name: string;
};

export function WorkStepsEditor({
  steps,
  owners = [],
  onChange
}: {
  steps: WorkStepDraft[];
  owners?: StepOwner[];
  onChange: (steps: WorkStepDraft[]) => void;
}) {
  const canAssignOwners = owners.length > 1;

  function updateStep(index: number, update: Partial<WorkStepDraft>) {
    onChange(steps.map((item, itemIndex) => itemIndex === index ? { ...item, ...update } : item));
  }

  return (
    <section className={`work-steps-editor ${canAssignOwners ? "with-owners" : "without-owners"}`}>
      <header>
        <ListChecks size={18} />
        <div>
          <strong>Work steps</strong>
          <p>{canAssignOwners ? "Assign each step to one person, or leave it open for anyone assigned." : "Optional steps to measure progress. Every step starts unfinished."}</p>
        </div>
        <span className="work-step-count">{steps.length}</span>
      </header>
      {steps.map((step, index) => (
        <div className="work-step-draft" key={index}>
          <span className="work-step-index">{index + 1}</span>
          <input
            aria-label={`Work step ${index + 1}`}
            maxLength={200}
            placeholder="Describe a measurable step"
            value={step.title}
            onChange={(event) => updateStep(index, { title: event.target.value })}
          />
          {canAssignOwners ? (
            <select
              aria-label={`Responsible user for work step ${index + 1}`}
              value={step.assigneeId ?? ""}
              onChange={(event) => updateStep(index, { assigneeId: event.target.value || undefined })}
            >
              <option value="">Anyone assigned</option>
              {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
            </select>
          ) : null}
          <button className="icon-button danger" type="button" aria-label={`Remove work step ${index + 1}`} onClick={() => onChange(steps.filter((_, itemIndex) => itemIndex !== index))}>
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <footer className="work-step-footer">
        <button className="ghost-button work-step-add-button" disabled={steps.length >= 100} type="button" onClick={() => onChange([...steps, { title: "" }])}>
          <Plus size={15} />Add work step
        </button>
      </footer>
    </section>
  );
}
