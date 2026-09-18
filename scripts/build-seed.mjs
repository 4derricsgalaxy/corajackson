/**
 * Builds web/content/seed.json from the scraped Wix export
 * (../content/wix-export/pages.json). Run: node scripts/build-seed.mjs
 *
 * The hierarchy below was verified by hand against the old site's pages.
 * Old slugs that were unedited template clones (carlos, lamont, sam, shaun,
 * hanna, bubba, copy-of-little-derrick) are NOT used as text sources.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const ROOT = path.resolve(process.cwd(), "..");
const pages = JSON.parse(fs.readFileSync(path.join(ROOT, "content/wix-export/pages.json"), "utf8"));
const page = (slug) => pages.find((p) => p.slug === slug);

/* deterministic GUID from a slug so references are stable across re-runs */
const id = (slug) => {
  const h = createHash("sha1").update("corajackson:" + slug).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const fileIdOf = (src) => src.replace("https://static.wixstatic.com/media/", "").split("/")[0];
const wixUri = (src, name) => `wix:image://v1/${fileIdOf(src)}/${encodeURIComponent((name || fileIdOf(src)).replace(/\s+/g, "_"))}`;
const NOISE = /^(t f b|Home|Family Tree|Cora Mae Jackson Family|Children|Show More|Continue|Memories:?)$/i;

function imagesOf(slug, kinds = ["wow-image", "img"]) {
  const p = page(slug);
  if (!p) return [];
  const seen = new Set();
  return p.images.filter((i) => kinds.includes(i.kind) && !seen.has(i.src) && seen.add(i.src));
}
/** gallery = a page's slider images minus the ones inherited from a template page */
function galleryFor(slug, templateSlug) {
  const tpl = new Set(templateSlug ? imagesOf(templateSlug).map((i) => i.src) : []);
  return imagesOf(slug, ["wow-image"]).filter((i) => !tpl.has(i.src) && !/^(Business|Recording|Singapore|Bubbles|rose)/i.test(i.alt || ""));
}
function findImage(slug, needle) {
  const n = needle.toLowerCase();
  return imagesOf(slug).find((i) => (i.alt || "").toLowerCase().replace(/%20/g, " ").includes(n));
}
function paragraphsBetween(slug, startRe, stopRe) {
  const t = page(slug)?.texts ?? [];
  const out = [];
  let on = false;
  for (const s of t) {
    if (!on && startRe.test(s)) on = true;
    if (on) {
      if (stopRe && stopRe.test(s)) break;
      if (!NOISE.test(s.trim())) out.push(s.trim());
    }
  }
  return out;
}
const html = (paras) => paras.map((p) => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`).join("\n");

/* ---------- family tree portraits: image order on the old tree page follows its link order ---------- */
const treeLinks = page("family-tree").links.filter((l) => l.label.startsWith("[image]")).map((l) => l.slug);
const treeImgs = imagesOf("family-tree", ["img"]);
const treePortrait = Object.fromEntries(treeLinks.map((slug, i) => [slug, treeImgs[i]?.src]));
console.log("tree portraits:", treeLinks.map((s, i) => `${s}←${(treeImgs[i]?.alt || fileIdOf(treeImgs[i]?.src || "")).slice(0, 18)}`).join(", "));

/* ---------- people ---------- */
const members = [];
const add = (m) => { members.push(m); return m; };
let order = 0;
const person = (slug, title, parentSlug, extra = {}) =>
  add({
    _id: id(slug),
    slug,
    title,
    parentId: parentSlug ? id(parentSlug) : null,
    generation: extra.generation ?? 0,
    sortOrder: ++order,
    published: true,
    ...extra,
  });

// Gen 0
const coraIntro = page("home").texts.find((t) => t.startsWith("Ms. Cora Mae Jackson"));
person("cora", "Cora Mae Jackson", null, {
  nickname: "Mu",
  generation: 0,
  birthplace: "Brinkley, Arkansas",
  shortBio: "Born Cora Mae Wilson in Brinkley, Arkansas. Mother of eight, grandmother of 35, great-grandmother of 39 and counting.",
  bio: html([coraIntro, "Her children called her Mu. This site was built by her family to honor her and to keep every branch of the tree within reach of the next generation."]),
  portrait: treePortrait.cora ? wixUri(treePortrait.cora, "Young Cora.jpg") : undefined,
  heroImage: wixUri("https://static.wixstatic.com/media/287d06_080c114be65443539bbef2ca36365a6a~mv2.jpg", "Cora.jpg"),
  gallery: galleryFor("cora").map((i) => wixUri(i.src, i.alt)),
  accentColor: "#c39a4a",
  featured: true,
});

// Gen 1: eight children in birth order, colors follow the frame colors on the old tree page
const lines = [
  ["joanne", "Joanne Jackson", "1955-05-19", { nickname: "Joanne", occupation: "Graduate of Brinkley High School and American Intercontinental University", shortBio: "Eldest child of Cora Mae Jackson. Mother of Nakita, Greg, Lamont, and Carlos." }],
  ["marietha", "Marietha Jackson", "1957-06-27", { nickname: "Mary", spouse: "Norman Timmerman (married 1984 to present)", shortBio: "Second child. Mother of Corey, NeCarlos (Shaun), Hanna, Dreama, and Curtis (Bubba). Author of the poem “God Made Me Who I Am.”" }],
  ["renae", "Renae B. McMath", "1960-04-21", { nickname: "Nay", occupation: "US Army, 4 years. Works for the Veterans Administration.", shortBio: "Third child. Brinkley High School graduate, US Army veteran, and mother of Keith and Derrick." }],
  ["derrick", "Derrick Lee McMath", "1961-10-18", { nickname: "Derrick", residence: "Tacoma, Washington", occupation: "US Navy, 4 years. U of A Jonesboro; Associated Tech, San Diego.", spouse: "Deanna Clarke (married 2011 to present)", shortBio: "Fourth child and eldest son. Navy veteran living in Tacoma, Washington. Father of Christopher, Chringle, Camren, Alisha, and Sarah." }],
  ["anthony", "Anthony Craig McMath", "1963-01-18", { nickname: "Tony", residence: "Tacoma, Washington", occupation: "US Army, 6 years. Sales Development Manager, Comcast Cable. Portrait artist. Master’s degree, University of Phoenix.", shortBio: "Fifth child, known as Tony and Anka. Army veteran, artist, drummer, and the builder of the original family website." }],
  ["tammie", "Tammie Denise McMath", "1964-09-25", { nickname: "Tammie", occupation: "Brinkley High School; Military", shortBio: "Sixth child. Mother of Joshua, Charity, and Gabrielle." }],
  ["tanya", "Tanya Rose Jackson", "1966-04-01", { nickname: "Tan", residence: "Jonesboro, Arkansas", occupation: "Manufacturing supervisor. Associate’s degree 2003; bachelor’s in business, technology management.", shortBio: "Baby girl of the family, number seven of eight. Mother of five sons and grandmother of ten." }],
  ["darwin", "Darwin Bernard McMath", "1968-02-05", { nickname: "Darwin", residence: "Washington State", occupation: "The Boeing Company", shortBio: "Baby of the family. Works for Boeing in Washington State. Father of Bernard and Jasmine." }],
];
const LINE_COLORS = ["#d8a63a", "#8a5a3a", "#5f9a48", "#c8508f", "#c8433d", "#e0853a", "#d98a8a", "#3d95d1"];
lines.forEach(([slug, title, birth, extra], i) => {
  const bioParas = {
    joanne: paragraphsBetween("joanne", /^I didn't just grow up/, /^Children$/),
    marietha: [],
    renae: ["Renae works for the Veterans Administration after four years in the US Army."],
    derrick: ["Derrick now resides in Tacoma, Washington."],
    anthony: paragraphsBetween("anthony", /^Currently I reside/, /^Anthony Craig McMath$/),
    tammie: paragraphsBetween("tammie", /^Growing$/, /^Cora Mae Jackson Family$/).join(" ").replace(/^Growing\s+/, "Growing ").split(/(?<=\.)\s+(?=[A-Z])/).length > 1 ? [paragraphsBetween("tammie", /^Growing$/, /^Cora Mae Jackson Family$/).join(" ")] : [],
    tanya: [paragraphsBetween("tanya", /^Baby girl of the family/, /^Cora Mae Jackson Family$/).join(" ")],
    darwin: ["Baby of the family, Darwin works for the Boeing Company in Washington State."],
  }[slug];
  person(slug, title, "cora", {
    generation: 1,
    birthDate: birth,
    birthplace: "Brinkley, Arkansas",
    accentColor: LINE_COLORS[i],
    portrait: treePortrait[slug] ? wixUri(treePortrait[slug]) : undefined,
    gallery: galleryFor(slug).map((im) => wixUri(im.src, im.alt)),
    bio: bioParas && bioParas.length ? html(bioParas) : undefined,
    featured: true,
    ...extra,
  });
});

// Gen 2 and 3
const kid = (slug, title, parentSlug, extra = {}) => person(slug, title, parentSlug, { generation: extra.generation ?? 2, ...extra });
const thumb = (pageSlug, alt) => { const im = findImage(pageSlug, alt); return im ? wixUri(im.src, im.alt) : undefined; };

// Joanne's line
kid("nakita", "Nakita Sharell McDaniel", "joanne", { nickname: "Kita", parentNote: "Father: Greg McDanial (never married)", residence: "Washington State", shortBio: "First and most successful of the Grands. Residing, for the moment, in Washington State with her five children. We call her The Traveler.", portrait: thumb("joanne", "Nakita as a baby") ?? thumb("nakita", "Nakita.jpg"), gallery: galleryFor("nakita").map((i) => wixUri(i.src, i.alt)) });
kid("greg", "Gregory Couch", "joanne", { nickname: "Greg", parentNote: "Father: Allen Couch (divorced)", spouse: "Tacia Bond (still married)", residence: "Jonesboro, Arkansas", shortBio: "Third of the Grands. Residing in Jonesboro, Arkansas with his four children. Known to be a great entrepreneur.", portrait: thumb("joanne", "Greg as a baby"), gallery: galleryFor("greg", "nakita").map((i) => wixUri(i.src, i.alt)) });
kid("lamont", "Lamont Couch", "joanne", { parentNote: "Father: Allen Couch (divorced)", portrait: thumb("joanne", "Lamont as a baby") });
kid("carlos", "Carlos Couch", "joanne", { parentNote: "Father: Allen Couch (divorced)", portrait: thumb("joanne", "Carlos as a baby") });
["Jalen", "Brandon", "Jordan", "Bryce"].forEach((n) => kid(`nakita-${n.toLowerCase()}`, `${n} McCray`, "nakita", { generation: 3, parentNote: "Father: Erik McCray (divorced)" }));
kid("zenaya", "Zenaya M.J. Akil", "nakita", { generation: 3, parentNote: "Father: Mazi Akil (divorced)" });
["Diamond", "Dakota", "Dylano", "Daking"].forEach((n) => kid(`greg-${n.toLowerCase()}`, `${n} Couch`, "greg", { generation: 3, parentNote: "Mother: Tacia Bond" }));

// Marietha's line
kid("corey", "Corey Shundale Chunn", "marietha", { nickname: "Corey", parentNote: "Father: Curtis Chunn (never married)", residence: "Tacoma, Washington", shortBio: "Second and most reliable of the Grands. Residing in Tacoma, WA. Corey has three children and a granddaughter, and he is well coordinated with his wardrobe.", bio: html([page("corey").texts.find((t) => t.startsWith("Second and most reliable"))]), portrait: thumb("marietha", "Lil Corey") ?? thumb("corey", "Corey"), gallery: galleryFor("corey").map((i) => wixUri(i.src, i.alt)) });
kid("shaun", "NeCarlos DeShun Chunn", "marietha", { nickname: "Shaun", parentNote: "Father: Curtis Chunn", portrait: thumb("h", "Shaun"), gallery: galleryFor("h", "nakita").map((i) => wixUri(i.src, i.alt)) });
kid("hanna", "Hanna", "marietha", { portrait: thumb("marietha", "Lil Hanna") });
kid("dreama", "Dreama", "marietha", {});
kid("bubba", "Curtis “Bubba”", "marietha", { nickname: "Bubba", portrait: thumb("marietha", "Bubba") });
kid("sam", "Sam", "marietha", { published: false, parentNote: "Line unconfirmed. Appears in Marietha's page templates and in Tammie's photo folder. Confirm and publish." });
kid("crystal", "Crystal", "marietha", { published: false, parentNote: "Line unconfirmed. Appears in Marietha's page templates and in Tammie's photo folder. Confirm and publish." });
kid("lakoria", "LaKoria Chunn", "corey", { generation: 3, birthDate: "1998-12-01" });
kid("corey-jr", "Corey Chunn Jr.", "corey", { generation: 3, birthDate: "2000-02-15" });
kid("miles", "Miles Chunn", "corey", { generation: 3, birthDate: "2008-10-20" });

// Renae's line
kid("keith", "Keith Jerome McMath", "renae", { parentNote: "Mother: Elizabeth Randall (never married)", portrait: thumb("renae", "Lil Keith") ?? thumb("page-28", "Big Keith"), gallery: galleryFor("page-28", "renae").map((i) => wixUri(i.src, i.alt)) });
kid("little-derrick", "Derrick McMath", "renae", { nickname: "Lil Dee", birthDate: "1993-01-07", birthplace: "Tacoma, Washington", parentNote: "Mother: Dinah Faye Callohan (1984 to 1994)", portrait: thumb("renae", "Lil Tiny Dee") ?? thumb("little-derrick", "Lil Dee"), gallery: galleryFor("little-derrick", "josh").map((i) => wixUri(i.src, i.alt)) });
kid("javeon", "Javeon McMath", "keith", { generation: 3, parentNote: "Mother: Janae Robles-Franco" });

// Derrick's line
kid("christopher", "Christopher Lavar McMath", "derrick", { nickname: "Chris", birthDate: "1981-05-27", birthplace: "Little Rock, Arkansas", occupation: "US Army, 6 years. Edwardsville High School 1999; Charter College, AK; Clover Park Tech, WA.", parentNote: "Mother: Angela Gooden (married 1982 to 2000, divorced)", spouse: "Janessa Webb (divorced)", portrait: thumb("derrick", "Picture8818") ?? thumb("page-26", "Chris 1"), gallery: galleryFor("page-26").map((i) => wixUri(i.src, i.alt)) });
kid("chringle", "Chringle McMath", "derrick", { parentNote: "Mother: Angela Gooden", portrait: thumb("derrick", "Chringle") });
kid("camren", "Camren Derrick Lee McMath", "derrick", { nickname: "Cam", birthDate: "1989-08-09", birthplace: "Tacoma, Washington", occupation: "Carbondale High School; Seattle Art Institute", parentNote: "Mother: Angela Gooden", portrait: thumb("derrick", "Lil Cam") ?? thumb("page-27", "Cam"), gallery: galleryFor("page-27").map((i) => wixUri(i.src, i.alt)) });
kid("alicia", "Alisha Nichole Clarke", "derrick", { nickname: "Alicia", birthDate: "1989-04-07", birthplace: "Oak Harbor, Washington", residence: "De Kalb, Texas", occupation: "Professional dental assistant. Lakeland Hills High; Medical Billing and Coding.", spouse: "Heath Annis (married)", parentNote: "Mother: Deanna Clarke", shortBio: "She is the first-born sister. Married with one child. An awesome wife and mother and a professional dental assistant.", portrait: thumb("derrick", "Lil Alicia"), gallery: galleryFor("copy-of-little-derrick-2").map((i) => wixUri(i.src, i.alt)) });
kid("sarah", "Sarah McMath", "derrick", { parentNote: "Mother: Deanna Clarke", portrait: thumb("derrick", "Little") });
kid("christopher-jr", "Christopher McMath Jr.", "christopher", { generation: 3, parentNote: "Mother: Jestina Lee (divorced)", portrait: thumb("page-26", "Lil Chris") });
kid("christina", "Christina McMath", "christopher", { generation: 3, parentNote: "Mother: Jestina Lee (divorced)", portrait: thumb("page-26", "Christina") });
kid("sofia", "Sofia McMath", "christopher", { generation: 3, parentNote: "Mother: Johanna Camacho (never married)", portrait: thumb("page-26", "Sofia") });
kid("kyla", "Kyla McMath", "camren", { generation: 3, parentNote: "Mother: Elizabeth Joy (never married)", portrait: thumb("page-27", "Kyla") });
kid("lochland", "Lochland Annis", "alicia", { generation: 3, parentNote: "Father: Heath Annis" });

// Anthony's line
[["anthony-c", "Anthony C. McMath", "My first born"], ["cameron", "Cameron L. McMath", "My second son"], ["margaret", "Margaret McMath", "Margaret"], ["lydia", "Lydia McMath", "Lydia"], ["stephen", "Stephen McMath", "Stephen"], ["toni", "Toni McMath", "Toni"]].forEach(([slug, title, alt]) =>
  kid(slug, title, "anthony", { portrait: thumb("anthony", alt) }));

// Tammie's line
kid("josh", "Joshua Aaron Lopp", "tammie", { nickname: "Josh", birthDate: "1988-01-20", birthplace: "Forrest City, Arkansas", residence: "Tacoma, Washington", occupation: "Nettleton High School; Tacoma Community College", parentNote: "Father: Donnie Lopp (divorced)", portrait: thumb("tammie", "Lil Josh") ?? thumb("josh", "Grad Josh"), gallery: galleryFor("josh").map((i) => wixUri(i.src, i.alt)) });
kid("charity", "Charity Lopp", "tammie", { parentNote: "Father: Donnie Lopp (divorced)" });
kid("gabrielle", "Gabrielle Taniece Lopp", "tammie", { nickname: "Gabrielle", birthDate: "1990-09-19", birthplace: "Stuttgart, Arkansas", occupation: "Wynne High School", parentNote: "Father: Donnie Lopp (divorced)", portrait: thumb("tammie", "lil Tammies") ?? thumb("gabrielle", "Garielle"), gallery: galleryFor("gabrielle").map((i) => wixUri(i.src, i.alt)) });
kid("madison", "Madison Lopp", "josh", { generation: 3, parentNote: "Mother: Kimberly Byrd (never married)", portrait: thumb("josh", "Madison") });
["Janice", "Joclyn", "Aiden", "Garielle"].forEach((n) => kid(`gabrielle-${n.toLowerCase()}`, `${n} Douglas`, "gabrielle", { generation: 3, parentNote: "Father: Keyshan Douglas (never married)", portrait: thumb("gabrielle", n) }));

// Tanya's line
[["daniel", "Daniel Joel"], ["ezekiel", "Ezekiel Jeremiah Rashad"], ["joseph", "Joseph Elisha Rozell"], ["micah", "Micah Jerimiah"], ["caleb", "Caleb Paul"]].forEach(([slug, title]) =>
  kid(slug, title, "tanya", { portrait: thumb("tanya", title.split(" ")[0]) }));

// Darwin's line
kid("bernard", "Darwin Bernard McMath Jr.", "darwin", { nickname: "Bernard", birthDate: "1992-04-20", birthplace: "Tacoma, Washington", occupation: "US Air Force, 2012 to present. Wilson High School; Military “A” School.", spouse: "Katrine McMath (married)", parentNote: "Mother: Jackie Cline (divorced)", portrait: thumb("darwin", "Lil fireman Bernard"), gallery: galleryFor("bernard").map((i) => wixUri(i.src, i.alt)) });
kid("jasmine", "Jasmine McMath", "darwin", { parentNote: "Mother: Jackie Cline (divorced)", portrait: thumb("darwin", "Jasmine") ?? thumb("darwin", "Jazz") });
kid("desmond", "Desmond McMath", "bernard", { generation: 3, parentNote: "Mother: Katrine McMath" });
kid("donavan", "Donavan McMath", "bernard", { generation: 3, parentNote: "Mother: Katrine McMath" });

// lineage = which of Cora's children a person descends from
const byId = new Map(members.map((m) => [m._id, m]));
for (const m of members) {
  let cur = m;
  while (cur && cur.generation > 1) cur = byId.get(cur.parentId);
  m.lineageId = cur && cur.generation === 1 ? cur._id : null;
}

/* ---------- photos derived from page galleries (tagged with the page owner) ---------- */
const photos = [];
const photoSeen = new Set();
for (const m of members) {
  for (const uri of m.gallery ?? []) {
    const fid = uri.replace("wix:image://v1/", "").split("/")[0];
    const name = decodeURIComponent(uri.split("/").pop());
    if (photoSeen.has(fid)) { const p = photos.find((x) => x.fileId === fid); if (p && !p.peopleIds.includes(m._id)) p.peopleIds.push(m._id); continue; }
    photoSeen.add(fid);
    photos.push({ _id: id("photo:" + fid), fileId: fid, title: name.replace(/\.[a-z]+$/i, "").replace(/_/g, " "), image: uri, album: undefined, lineageId: m.generation === 0 ? m._id : m.lineageId, peopleIds: [m._id], featured: false, published: true, sortOrder: photos.length + 1 });
  }
}
// "Meet the Family" gallery of Cora → featured
for (const im of imagesOf("gallery", ["wow-image"])) {
  const fid = fileIdOf(im.src);
  const existing = photos.find((p) => p.fileId === fid);
  if (existing) { existing.featured = true; existing.caption = im.alt; continue; }
  photoSeen.add(fid);
  photos.push({ _id: id("photo:" + fid), fileId: fid, title: im.alt || "Family photo", caption: im.alt, image: wixUri(im.src, im.alt), lineageId: id("cora"), peopleIds: [id("cora")], featured: true, published: true, sortOrder: photos.length + 1 });
}

/* ---------- stories ---------- */
const stories = [
  { slug: "god-made-me-who-i-am", title: "God Made Me Who I Am", authorSlug: "marietha", paras: paragraphsBetween("marietha", /^God$/, /^Born$|^Children$|^Home$/) },
  { slug: "i-didnt-just-grow-up", title: "I Didn’t Just Grow Up", authorSlug: "joanne", paras: paragraphsBetween("joanne", /^I didn't just grow up/, /^Children$/) },
  { slug: "growing-up-with-seven-siblings", title: "Growing Up With Seven Siblings", authorSlug: "tammie", paras: [paragraphsBetween("tammie", /^Growing$/, /^Cora Mae Jackson Family$/).join(" ").replace(/^Growing\s+up/, "Growing up")] },
].filter((s) => s.paras.length && s.paras.join("").length > 40).map((s, i) => {
  const author = members.find((m) => m.slug === s.authorSlug);
  const isPoem = s.slug !== "growing-up-with-seven-siblings";
  return {
    _id: id("story:" + s.slug),
    slug: s.slug,
    title: s.title,
    excerpt: s.paras.join(" ").slice(0, 160).replace(/\s\S*$/, "") + "…",
    body: isPoem ? `<p>${s.paras.map((l) => l.replace(/&/g, "&amp;").replace(/</g, "&lt;")).join("<br/>")}</p>` : html(s.paras),
    authorName: author?.title,
    authorId: author?._id ?? null,
    peopleIds: author ? [author._id] : [],
    coverImage: author?.portrait,
    sortOrder: i + 1,
    published: true,
  };
});

/* ---------- history (starter timeline from facts on the old pages) ---------- */
const history = [
  { _id: id("hist:brinkley"), title: "Roots in Brinkley, Arkansas", dateLabel: "Brinkley, Arkansas", location: "Brinkley, AR", body: html(["Cora Mae Wilson is a native of Brinkley, Arkansas. It is where she raised her eight children and where every line of this family begins."]), peopleIds: [id("cora")], sortOrder: 1, published: true, image: members.find((m) => m.slug === "cora")?.heroImage },
  { _id: id("hist:children"), title: "Eight children in thirteen years", year: 1955, dateLabel: "1955 to 1968", location: "Brinkley, AR", body: html(["Joanne (1955), Marietha (1957), Renae (1960), Derrick (1961), Anthony (1963), Tammie (1964), Tanya (1966), and Darwin (1968) were all born in Brinkley. Every one of them graduated from Brinkley High School."]), peopleIds: lines.map(([s]) => id(s)), sortOrder: 2, published: true },
  { _id: id("hist:service"), title: "A family of service", year: 1981, dateLabel: "1981 onward", body: html(["Renae served four years in the US Army, Derrick four years in the US Navy, Anthony six years in the Army beginning in 1981, and the next generation followed: Christopher in the Army and Bernard in the Air Force from 2012."]), peopleIds: ["renae", "derrick", "anthony", "christopher", "bernard"].map(id), sortOrder: 3, published: true },
  { _id: id("hist:west"), title: "The family moves west", dateLabel: "1980s to today", location: "Tacoma, Washington", body: html(["Several branches settled in the Pacific Northwest. Derrick, Anthony, Corey, Camren, Josh, and Bernard have all called Tacoma, Washington home, while Greg and Tanya built their lives in Jonesboro, Arkansas."]), peopleIds: ["derrick", "anthony", "corey", "tanya", "greg"].map(id), sortOrder: 4, published: true },
];

/* ---------- settings ---------- */
const settings = {
  _id: id("settings"),
  title: "Family Heritage of Cora Mae Jackson",
  tagline: "A living family tree honoring Ms. Cora Mae Jackson of Brinkley, Arkansas, her eight children, and every generation since.",
  heroIntro: html([coraIntro]),
  heroImage: wixUri("https://static.wixstatic.com/media/287d06_9f0255e035124fd1abac127a7ecd9d64~mv2.jpg", "Young Cora.jpg"),
  treeImage: wixUri("https://static.wixstatic.com/media/287d06_632550d8145142769ec05eded03dd100~mv2.png", "family tree.png"),
  backgroundImage: wixUri("https://static.wixstatic.com/media/287d06_d65a89e469fe4712be58c1d120ee277f~mv2.jpg", "family tree background.jpg"),
  footerText: "This site honors Ms. Cora and her commitment to her children as a dedicated mother who sacrificed to raise them with respect and in the fear of the Lord.",
  primaryColor: "#3b4a2f",
  accentColor: "#c39a4a",
};

const seed = { settings, members, stories, photos: photos.map((p) => { const { fileId: _omit, ...rest } = p; void _omit; return rest; }), history };
fs.writeFileSync(path.join(process.cwd(), "content/seed.json"), JSON.stringify(seed, null, 2));
const missingPortrait = members.filter((m) => !m.portrait).map((m) => m.slug);
console.log(`members=${members.length} (gen1=${members.filter((m) => m.generation === 1).length}, gen2=${members.filter((m) => m.generation === 2).length}, gen3=${members.filter((m) => m.generation === 3).length}) photos=${photos.length} stories=${stories.length} history=${history.length}`);
console.log("no portrait:", missingPortrait.join(", "));
console.log("stories paras:", stories.map((s) => `${s.slug}:${s.body.length}ch`).join(", "));
