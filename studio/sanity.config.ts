import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { schemaTypes } from "./schemaTypes";

/** Standalone Studio, deliberately not embedded in the Next.js app.
 *
 *  The roadmap app builds in about two seconds and the team deploys it on every push;
 *  compiling the Studio through `next build` would spend most of that budget on a tool
 *  two people open once a day. Standalone also auto-updates, which an embedded Studio
 *  cannot. Run it with `npm run studio`, publish it with `npm run studio:deploy`. */
export default defineConfig({
  name: "stackback-help",
  title: "StackBack Help",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID || "",
  dataset: process.env.SANITY_STUDIO_DATASET || "production",
  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title("Help")
          .items([
            S.listItem()
              .title("Needs an answer")
              .child(
                S.documentList()
                  .title("Needs an answer")
                  .filter('_type == "merchantQuery" && status == "new"')
                  .defaultOrdering([{ field: "raisedAt", direction: "desc" }]),
              ),
            S.listItem()
              .title("Answered and public")
              .child(
                S.documentList()
                  .title("Answered and public")
                  .filter('_type == "merchantQuery" && status == "answered"')
                  .defaultOrdering([{ field: "raisedCount", direction: "desc" }]),
              ),
            S.divider(),
            S.documentTypeListItem("merchantQuery").title("Every query"),
          ]),
    }),
  ],
  schema: { types: schemaTypes },
});
