import assert from "node:assert/strict";
import { onboardingStepFromResume, onboardingUrlWithBrand, shouldResumeOnboardingBrand } from "./onboarding-resume";

assert.equal(
  shouldResumeOnboardingBrand({
    startFresh: true,
    requestedBrandId: "a",
    brandIds: ["a"],
  }),
  null,
);

assert.equal(
  shouldResumeOnboardingBrand({
    startFresh: false,
    requestedBrandId: "a",
    brandIds: ["a", "b"],
  }),
  "a",
);

assert.equal(
  shouldResumeOnboardingBrand({
    startFresh: false,
    requestedBrandId: "missing",
    brandIds: ["a"],
  }),
  null,
);

assert.equal(
  shouldResumeOnboardingBrand({
    startFresh: false,
    requestedBrandId: null,
    brandIds: ["a"],
  }),
  null,
);

assert.equal(
  shouldResumeOnboardingBrand({
    startFresh: false,
    requestedBrandId: null,
    brandIds: ["a", "b"],
  }),
  null,
);

assert.equal(
  shouldResumeOnboardingBrand({
    startFresh: false,
    requestedBrandId: null,
    brandIds: [],
  }),
  null,
);

assert.equal(onboardingUrlWithBrand("/app/onboarding", "?brandId=a", "a"), null);
assert.equal(onboardingUrlWithBrand("/app/onboarding", "?new=1", "a"), "/app/onboarding?brandId=a");
assert.equal(onboardingUrlWithBrand("/app/onboarding", "", "a"), "/app/onboarding?brandId=a");
assert.equal(onboardingUrlWithBrand("/app/onboarding", "?brandId=b", "a"), "/app/onboarding?brandId=a");

assert.equal(onboardingStepFromResume({ reportId: "r", runId: null, prompts: [] }), 3);
assert.equal(onboardingStepFromResume({ reportId: null, runId: "run", prompts: [] }), 3);
assert.equal(
  onboardingStepFromResume({
    reportId: null,
    runId: null,
    prompts: [{ text: "q", mix: "discovery", sortOrder: 0 }],
  }),
  2,
);
assert.equal(onboardingStepFromResume({ reportId: null, runId: null, prompts: [] }), 1);
