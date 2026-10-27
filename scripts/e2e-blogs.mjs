// Local stand-ins for the Shopify GraphQL Admin API, the Webflow Data API and the Wix Blog API,
// for E2E only. They accept one key each, create the post, serve its public page, and record
// every request under GET /_stub/requests so specs can check exactly what was sent.
import { createServer } from "node:http";

export const BLOGS_STUB_PORT = 4040;
export const BLOG_STUB_KEYS = {
  shopify: "shpat_e2e_access_token",
  webflow: "wf_e2e_site_token",
  wix: "IST.e2e-wix-api-key",
};
const WEBFLOW_COLLECTION = "e2e-blog-collection";
const WIX_SITE_ID = "e2e-wix-site-id";

const json = (res, status, body) =>
  res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString();
  return text === "" ? {} : JSON.parse(text);
};

const escape = (text) => String(text).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Plain text of a Ricos document, for the stand-in Wix post page. */
const ricosText = (nodes = []) =>
  nodes.map((node) => node.textData?.text ?? ricosText(node.nodes)).join(" ");

export const startBlogsStub = () => {
  const base = `http://127.0.0.1:${BLOGS_STUB_PORT}`;
  const requests = [];
  /** Public path → { title, body } for every post the stubs published. */
  const pages = new Map();

  const shopify = async (req, res, body) => {
    if (req.headers["x-shopify-access-token"] !== BLOG_STUB_KEYS.shopify) {
      return json(res, 401, { errors: "[API] Invalid API key or access token" });
    }
    if (!body.query.includes("articleCreate")) {
      return json(res, 200, {
        data: {
          shop: { name: "Acme Store", primaryDomain: { url: `${base}/shop` } },
          blogs: { nodes: [{ id: "gid://shopify/Blog/1", handle: "news", title: "News" }] },
        },
      });
    }
    const article = body.variables.article;
    const handle = article.handle ?? slugify(article.title);
    pages.set(`/shop/blogs/news/${handle}`, { title: article.title, body: article.body });
    return json(res, 200, {
      data: {
        articleCreate: { article: { id: "gid://shopify/Article/1", handle }, userErrors: [] },
      },
    });
  };

  const webflow = async (req, res, path, body) => {
    if (req.headers.authorization !== `Bearer ${BLOG_STUB_KEYS.webflow}`) {
      return json(res, 401, { message: "Request not authorized", code: "not_authorized" });
    }
    const collection = `/webflow/v2/collections/${WEBFLOW_COLLECTION}`;
    if (req.method === "GET" && path === collection) {
      return json(res, 200, {
        id: WEBFLOW_COLLECTION,
        displayName: "Blog Posts",
        slug: "post",
        fields: [
          { type: "PlainText", slug: "name" },
          { type: "PlainText", slug: "slug" },
          { type: "RichText", slug: "post-body" },
          { type: "PlainText", slug: "post-summary" },
        ],
      });
    }
    if (req.method === "POST" && path === `${collection}/items/live`) {
      const { fieldData } = body;
      pages.set(`/webflow-site/post/${fieldData.slug}`, {
        title: fieldData.name,
        body: fieldData["post-body"],
      });
      return json(res, 202, { id: "item-1", isDraft: false, fieldData });
    }
    return json(res, 404, { message: "Requested resource not found", code: "resource_not_found" });
  };

  const wix = async (req, res, path, body) => {
    if (req.headers.authorization !== BLOG_STUB_KEYS.wix) {
      return json(res, 401, { message: "Unauthorized", details: {} });
    }
    if (req.headers["wix-site-id"] !== WIX_SITE_ID) {
      return json(res, 404, { message: "Site not found", details: {} });
    }
    if (req.method === "GET" && path === "/wix/blog/v3/categories") {
      return json(res, 200, { categories: [], metaData: { count: 0, offset: 0, total: 0 } });
    }
    if (req.method === "POST" && path === "/wix/blog/v3/draft-posts") {
      const { draftPost } = body;
      const slug = draftPost.seoSlug ?? slugify(draftPost.title);
      pages.set(`/wix-site/post/${slug}`, {
        title: draftPost.title,
        body: `<p>${escape(ricosText(draftPost.richContent.nodes))}</p>`,
      });
      return json(res, 200, {
        draftPost: {
          id: "post-1",
          seoSlug: slug,
          url: { base: `${base}/wix-site`, path: `/post/${slug}` },
        },
      });
    }
    return json(res, 404, { message: "Not found", details: {} });
  };

  const server = createServer(async (req, res) => {
    const path = new URL(req.url ?? "/", base).pathname;
    if (req.method === "GET" && path === "/_stub/requests") return json(res, 200, requests);
    if (req.method === "GET" && pages.has(path)) {
      const page = pages.get(path);
      return res
        .writeHead(200, { "content-type": "text/html; charset=utf-8" })
        .end(
          `<!doctype html><title>${escape(page.title)}</title><h1>${escape(page.title)}</h1>${page.body}`,
        );
    }
    const body = await readBody(req);
    const platform = path.startsWith("/admin/api/")
      ? "shopify"
      : path.startsWith("/webflow/")
        ? "webflow"
        : path.startsWith("/wix/")
          ? "wix"
          : undefined;
    if (!platform) return res.writeHead(404).end("Not found");
    // Never record the keys: specs check bodies, not credentials.
    requests.push({ platform, method: req.method, path, body });
    if (platform === "shopify") return shopify(req, res, body);
    if (platform === "webflow") return webflow(req, res, path, body);
    return wix(req, res, path, body);
  });

  return new Promise((resolve) => {
    server.listen(BLOGS_STUB_PORT, "127.0.0.1", () =>
      resolve({
        env: {
          E2E_BLOGS_URL: base,
          E2E_SHOPIFY_TOKEN: BLOG_STUB_KEYS.shopify,
          E2E_WEBFLOW_TOKEN: BLOG_STUB_KEYS.webflow,
          E2E_WEBFLOW_COLLECTION: WEBFLOW_COLLECTION,
          E2E_WIX_KEY: BLOG_STUB_KEYS.wix,
          E2E_WIX_SITE_ID: WIX_SITE_ID,
          WEBFLOW_API_BASE_URL: `${base}/webflow/`,
          WIX_API_BASE_URL: `${base}/wix/`,
        },
        stop: () => new Promise((done) => server.close(done)),
      }),
    );
  });
};
