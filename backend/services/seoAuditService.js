import * as cheerio from "cheerio";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 3;

function isPublicIPv4(ip) {
  if (net.isIP(ip) !== 4) return false;

  const parts = ip.split(".").map(Number);
  const [a, b, c] = parts;

  if (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 2) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0 && c === 113)
  ) {
    return false;
  }

  return true;
}

async function validatePublicUrl(value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error("The website URL is invalid.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS websites are supported.");
  }

  if (url.username || url.password) {
    throw new Error("URLs containing login credentials are not allowed.");
  }

  if (net.isIP(url.hostname)) {
    if (!isPublicIPv4(url.hostname)) {
      throw new Error("Private or reserved IP addresses are not allowed.");
    }

    // Reject direct IP URLs to keep auditing limited to public hostnames.
    throw new Error("Please enter a public website domain name.");
  }

  const hostname = url.hostname.toLowerCase();

  if (
    !hostname.includes(".") ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("Please enter a public website domain.");
  }

  let records;

  try {
    records = await dns.promises.lookup(hostname, {
      all: true,
      verbatim: true,
      family: 4,
    });
  } catch {
    throw new Error("The website domain could not be resolved.");
  }

  if (
    !records.length ||
    records.some((record) => !isPublicIPv4(record.address))
  ) {
    throw new Error("The website must resolve only to public IPv4 addresses.");
  }

  return url;
}

function requestHtml(url, redirects = 0) {
  return new Promise(async (resolve, reject) => {
    let safeUrl;

    try {
      safeUrl = await validatePublicUrl(url.toString());
    } catch (error) {
      reject(error);
      return;
    }

    const client = safeUrl.protocol === "https:" ? https : http;
    const hostname = safeUrl.hostname;

    // Pin the request to a verified public IPv4 address.
    const lookup = (host, options, callback) => {
      dns.lookup(
        host,
        { all: true, verbatim: true, family: 4 },
        (error, records) => {
          if (error) return callback(error);

          if (
            host.toLowerCase() !== hostname.toLowerCase() ||
            !records.length ||
            records.some((record) => !isPublicIPv4(record.address))
          ) {
            return callback(new Error("Unsafe website address."));
          }

          const selected = records[0];

          if (options?.all) {
            return callback(null, records);
          }

          callback(null, selected.address, selected.family);
        },
      );
    };

    const req = client.request(
      safeUrl,
      {
        method: "GET",
        lookup,
        timeout: TIMEOUT_MS,
        headers: {
          "User-Agent": "TN-SEO-Audit/1.0",
          Accept: "text/html,application/xhtml+xml",
        },
      },
      (res) => {
        const status = res.statusCode || 0;
        const location = res.headers.location;

        if ([301, 302, 303, 307, 308].includes(status) && location) {
          res.resume();

          if (redirects >= MAX_REDIRECTS) {
            reject(new Error("The website redirected too many times."));
            return;
          }

          let nextUrl;

          try {
            nextUrl = new URL(location, safeUrl);
          } catch {
            reject(new Error("The website returned an invalid redirect."));
            return;
          }

          requestHtml(nextUrl.toString(), redirects + 1)
            .then(resolve)
            .catch(reject);

          return;
        }

        if (status < 200 || status >= 300) {
          res.resume();
          reject(new Error(`The website returned HTTP ${status}.`));
          return;
        }

        const contentType = String(res.headers["content-type"] || "");

        if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
          res.resume();
          reject(new Error("The URL did not return an HTML page."));
          return;
        }

        const declaredLength = Number(res.headers["content-length"] || 0);

        if (declaredLength > MAX_BYTES) {
          res.destroy();
          reject(new Error("The website page is too large to audit."));
          return;
        }

        let body = "";
        let bytes = 0;

        res.on("data", (chunk) => {
          bytes += chunk.length;

          if (bytes > MAX_BYTES) {
            res.destroy(new Error("The website page exceeded the size limit."));
            return;
          }

          body += chunk.toString("utf8");
        });

        res.on("end", () =>
          resolve({ html: body, finalUrl: safeUrl.toString() }),
        );
        res.on("error", reject);
      },
    );

    req.on("timeout", () =>
      req.destroy(new Error("Website request timed out.")),
    );
    req.on("error", reject);
    req.end();
  });
}
function makeCheck(name, passed, warning, message, points, maxPoints) {
  return {
    name,
    status: passed ? "passed" : warning ? "warning" : "failed",
    message,
    points: passed ? maxPoints : warning ? Math.floor(maxPoints / 2) : 0,
    maxPoints,
  };
}

export async function runSeoAudit(websiteUrl) {
  const { html, finalUrl } = await requestHtml(websiteUrl);
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim();
  const description =
    $('meta[name="description"]').attr("content")?.trim() || "";
  const h1Count = $("h1").length;
  const images = $("img").toArray();
  const imagesWithoutAlt = images.filter(
    (image) => !$(image).attr("alt")?.trim(),
  ).length;
  const canonical = $('link[rel="canonical"]').attr("href")?.trim() || "";
  const robots = $('meta[name="robots"]').attr("content")?.toLowerCase() || "";
  const language = $("html").attr("lang")?.trim() || "";
  const headings = $("h1, h2, h3, h4, h5, h6").length;

  const checks = [
    makeCheck(
      "Page title",
      title.length >= 10 && title.length <= 60,
      Boolean(title),
      !title
        ? "The page is missing a title."
        : title.length < 10
          ? "The title may be too short."
          : title.length > 60
            ? "The title may be too long."
            : "The page has a title of a reasonable length.",
      10,
      10,
    ),
    makeCheck(
      "Meta description",
      description.length >= 70 && description.length <= 160,
      Boolean(description),
      !description
        ? "The page is missing a meta description."
        : description.length < 70
          ? "The meta description may be too short."
          : description.length > 160
            ? "The meta description may be too long."
            : "The page has a meta description of a reasonable length.",
      10,
      10,
    ),
    makeCheck(
      "H1 heading",
      h1Count === 1,
      h1Count > 0,
      h1Count === 0
        ? "No H1 heading was found."
        : h1Count > 1
          ? `Found ${h1Count} H1 headings; review the main heading structure.`
          : "Exactly one H1 heading was found.",
      10,
      10,
    ),
    makeCheck(
      "Heading structure",
      headings > 0,
      false,
      headings > 0
        ? `Found ${headings} heading elements.`
        : "No heading elements were found.",
      10,
      10,
    ),
    makeCheck(
      "Image alt text",
      imagesWithoutAlt === 0,
      images.length > 0,
      images.length === 0
        ? "No images were found on this page."
        : imagesWithoutAlt
          ? `${imagesWithoutAlt} of ${images.length} images lack alt text.`
          : "All detected images have alt attributes.",
      10,
      10,
    ),
    makeCheck(
      "Canonical URL",
      Boolean(canonical),
      false,
      canonical ? "A canonical URL is present." : "No canonical URL was found.",
      10,
      10,
    ),
    makeCheck(
      "Indexing directive",
      !robots.includes("noindex"),
      false,
      robots.includes("noindex")
        ? "The robots meta tag contains noindex."
        : robots
          ? `Robots directive: ${robots}.`
          : "No robots meta directive was found.",
      10,
      10,
    ),
    makeCheck(
      "HTML language",
      Boolean(language),
      false,
      language
        ? `HTML language is set to "${language}".`
        : "The HTML element has no lang attribute.",
      10,
      10,
    ),
    makeCheck(
      "Viewport",
      Boolean($('meta[name="viewport"]').attr("content")),
      false,
      $('meta[name="viewport"]').length
        ? "A viewport meta tag was found."
        : "No viewport meta tag was found.",
      10,
      10,
    ),
    makeCheck(
      "HTTPS",
      new URL(finalUrl).protocol === "https:",
      false,
      new URL(finalUrl).protocol === "https:"
        ? "The final page uses HTTPS."
        : "The final page uses HTTP, not HTTPS.",
      10,
      10,
    ),
  ];

  const totalPoints = checks.reduce((sum, check) => sum + check.points, 0);
  const maxPoints = checks.reduce((sum, check) => sum + check.maxPoints, 0);

  return {
    websiteUrl: finalUrl,
    seoScore: Math.round((totalPoints / maxPoints) * 100),
    pagesCrawled: 1,
    checks,
  };
}
