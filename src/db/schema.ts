export * from "./auth.schema";
export * from "./app.schema";

import * as appSchema from "./app.schema";
import * as authSchema from "./auth.schema";

export const schema = {
  ...authSchema,
  ...appSchema,
};
