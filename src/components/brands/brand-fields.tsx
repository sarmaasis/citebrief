import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type BrandFieldValues = {
  name: string;
  siteUrl: string;
  logoUrl: string;
  category: string;
  vertical: string;
  buyer: string;
  job: string;
  incumbent: string;
  competitors: string;
  constraintNote: string;
  clientOwner: string;
};

export const emptyBrandFields: BrandFieldValues = {
  name: "",
  siteUrl: "",
  logoUrl: "",
  category: "",
  vertical: "",
  buyer: "",
  job: "",
  incumbent: "",
  competitors: "",
  constraintNote: "",
  clientOwner: "",
};

export function BrandFields({
  values,
  onChange,
}: {
  values: BrandFieldValues;
  onChange: (next: BrandFieldValues) => void;
}) {
  function set<K extends keyof BrandFieldValues>(key: K, value: BrandFieldValues[K]) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="space-y-4">
      <Field id="name" label="Brand name">
        <Input id="name" required value={values.name} onChange={(event) => set("name", event.target.value)} />
      </Field>
      <Field id="siteUrl" label="Site URL">
        <Input
          id="siteUrl"
          type="url"
          placeholder="https://northstar.example"
          value={values.siteUrl}
          onChange={(event) => set("siteUrl", event.target.value)}
        />
      </Field>
      <Field id="logoUrl" label="Logo URL">
        <Input
          id="logoUrl"
          type="url"
          placeholder="https://"
          value={values.logoUrl}
          onChange={(event) => set("logoUrl", event.target.value)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="category" label="Category">
          <Input
            id="category"
            placeholder="project management"
            value={values.category}
            onChange={(event) => set("category", event.target.value)}
          />
        </Field>
        <Field id="vertical" label="Vertical">
          <Input
            id="vertical"
            placeholder="agencies"
            value={values.vertical}
            onChange={(event) => set("vertical", event.target.value)}
          />
        </Field>
      </div>
      <Field id="buyer" label="Buyer">
        <Input
          id="buyer"
          placeholder="12-person marketing agency"
          value={values.buyer}
          onChange={(event) => set("buyer", event.target.value)}
        />
      </Field>
      <Field id="job" label="Job">
        <Input
          id="job"
          placeholder="client work and time tracking"
          value={values.job}
          onChange={(event) => set("job", event.target.value)}
        />
      </Field>
      <Field id="incumbent" label="Incumbent">
        <Input
          id="incumbent"
          placeholder="Asana"
          value={values.incumbent}
          onChange={(event) => set("incumbent", event.target.value)}
        />
      </Field>
      <Field id="competitors" label="Competitors">
        <Input
          id="competitors"
          placeholder="ClickUp, Monday.com"
          value={values.competitors}
          onChange={(event) => set("competitors", event.target.value)}
        />
      </Field>
      <Field id="clientOwner" label="Client owner">
        <Input
          id="clientOwner"
          placeholder="Account manager on this retainer"
          value={values.clientOwner}
          onChange={(event) => set("clientOwner", event.target.value)}
        />
      </Field>
      <Field id="constraintNote" label="Must-have constraint">
        <Textarea
          id="constraintNote"
          placeholder="No 3-month implementation"
          value={values.constraintNote}
          onChange={(event) => set("constraintNote", event.target.value)}
        />
      </Field>
    </div>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
