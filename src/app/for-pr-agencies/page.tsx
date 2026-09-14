import { staticArticlePage } from "@/components/marketing/article-views";

const page = staticArticlePage("/for-pr-agencies");
export const dynamic = "force-dynamic";
export const metadata = page.metadata;
export default page.Page;
