# Editing the family site in Snackbox

Everything on the site comes from five collections in Snackbox (snackboxcms.com → Cora Mae Jackson Family). You can also click **Edit** on any page of the live site to change text and photos in place. Changes go live within seconds of publishing.

## The standard page for anyone who has children

Every person gets the SAME page, at any generation - Cora's children, grandchildren, great-grandchildren. It exists the moment their entry is published, at `/family/<Page address>`. Nothing has to be built per person.

The page always shows, top to bottom:

1. Full name.
2. Framed **Portrait**, with the facts beside it (Born, Passed, Place, Resides, Spouse, Life & Work, plus the other-parent line taken from their parent's *Children on this page* block).
3. The write-up under the portrait (**Quote / biography**, else **Short bio**).
4. **Children** - one block per other parent: role + name, marital status, that person's small photo, then a tile per child linking to the child's page.
5. **Memories** - every photo the person is tagged in.
6. Stories they are in, then the Home / Family Tree buttons.

**Optional personal background:** set **Page background** on the entry. Upload it at full strength (about 1280 x 850); the site fades it to 45% and softens the bottom edge itself. Empty = autumn leaves.

### Checklist: setting up someone who now has children

1. **Their own entry:** Full name, Short name, Page address, Portrait (their own page), Childhood photo (Family Tree), optional Page background, the facts, a write-up.
2. **Each child:** Family Members -> Add item: Full name, Short name, Page address, Portrait, **Parent** = this person, Family line, Generation. Publish.
3. **Parent's entry -> Children on this page:** one block per other parent (Father/Mother, name, marital status, their photo), each child inside it, optional *Photo on this page*.
4. Publish, then check the live page: name, portrait, facts, write-up, Children blocks, Memories.

A child whose Parent is set but who is not in the list still shows (safety net, grouped by their own *Other parent* field); the list only adds control over block, order and photo. The same text is in the Snackbox Help panel ("The standard page for anyone who has children").

## Edit a person's page

Open **Family Members** and pick the person (e.g. *Tammie Denise McMath*). The form runs in the same order as their page: name, photos, the facts beside the portrait, the quote, then **Children on this page**.

### Children on this page

This list is everything under *Children* on that person's page. It works the same for every parent on the site.

- **One block per other parent.** Each block has: *They are the children's...* (Father / Mother; Spouse / Partner for someone with no children here), the **other parent's name**, **marital status** (e.g. `divorced`, `never married`, `married 1984 to present`), and **their photo** (the small black-framed picture beside the group).
- **Children** inside the block: pick the child's Family Member entry, and choose a **Photo on this page**. That picture is used ONLY here - for example the photo of Josh on Tammie's page. Josh's own page keeps its own **Portrait**, and the Family Tree keeps his **Childhood photo**. Leave *Photo on this page* empty and the site falls back to his Childhood photo, then his Portrait.
- **Order:** blocks and children show in the order of the list - drag to rearrange.
- The line beside a child's own portrait ("Father: Donnie Lopp (divorced)") is taken from the block they sit in on their parent's page, so it is typed once, on the parent.
- **Safety net:** a person whose **Parent** is set to this member but who isn't in the list still shows on the page automatically (grouped by their own *Other parent* field), so nobody disappears. Add them to the list to control their block, order and photo.
- For a parent with no other parent to show (e.g. Cora), use one block with the name left empty.

### Editing on the live page

You can also click **Edit** on the live site and click things directly: the name, portrait, facts, quote, page background, a child's picture (opens the *Children on this page* list), a child's name (opens the child's entry), or a **Memories** photo (opens its entry in **Photos**). The **Page content** button lists everyone on the page. Use **Browse** mode when you want a click to follow the link instead.

Where each picture on a person's page comes from:

| On the page | Lives in |
| --- | --- |
| Big framed portrait | that person -> **Portrait (their own page)** |
| Faded page background | that person -> **Page background** |
| A child's tile under *Children* | the PARENT's entry -> **Children on this page** -> child -> **Photo on this page** |
| Small photo beside a group of children | the parent's entry -> **Children on this page** -> block -> **Their photo** |
| Family Tree frame | that person -> **Childhood photo** (else their Portrait) |
| Memories slider | **Photos** entries that tag the person (plus their *Extra Memories photos*) |

## Add a new family member

1. Open **Family Members** -> **Add item**. The fields run in the same order as the page.
2. Fill in:
   - **Full name** (required), **Short name** (shown under their picture on a parent's page and on the tree) and **Page address** (required, lowercase, no spaces, e.g. `maya-jackson` gives `/family/maya-jackson`).
   - **Portrait (their own page)**: a vertical (4:5) photo looks best.
   - **Childhood photo**: their Family Tree frame (and their tile on a parent's page when the parent hasn't picked a photo). Leave it empty and the Portrait is used.
   - **Page background**: the faded artwork behind their page. Leave it empty for the autumn leaves.
   - **Born / Passed / Place / Resides / Spouse / Life & Work**: the facts beside the portrait. Empty ones simply don't show.
   - **Quote / biography**: the italic text under the portrait. **Short bio** is used there only when the biography is empty.
   - **Parent**: pick the mother or father. This is what puts them on the tree and on that person's page.
   - **Family line** and **Generation** (1 for Cora's children, 2 grandchildren, 3 great-grandchildren, 4 great-great-grandchildren) keep albums and the tree tidy.
   - **Publish** when done. Keep someone as a draft to hide them without deleting them.
3. Then open the **parent's** entry and add the new person to **Children on this page** (in the right block, with the photo you want there).

## Add photos

1. Open **Photos** → **Add item**.
2. Upload the **Image**, give it a **Title**, optional **Caption** and **Year Taken**.
3. **People Pictured**: tag everyone in the photo. Tagged photos appear on each person's page.
4. **Family Line**: choose the line the photo belongs to. This decides which album it's filed in on `/gallery`.
5. **Featured in Gallery**: turn on for the best photos; they appear on the home page.

You can also add several photos at once to a person's **Extra Memories photos** field on their Family Member entry.

## Stories and history

- **Stories**: title, slug, story text, cover image, "Told By", and tag the people in it.
- **History Timeline**: title, year, a date label like "Spring 1952", text, image, location, people.

## Site settings

The **Site Settings** collection has one item: site title, tagline, the home page intro paragraph, the hero portrait of Cora, the tree artwork, and the footer text.

## Things to confirm

- The home text says "four boys and four girls", but the tree lists five daughters (Joanne, Marietha, Renae, Tammie, Tanya) and three sons (Derrick, Anthony, Darwin). Edit the intro in Site settings once the family confirms.
- **Sam** and **Crystal** are saved as drafts under Marietha's line because the old site had them in both Marietha's page templates and Tammie's photo folder. Move them to the right parent and publish.
- Portraits are still missing for about 28 great-grandchildren and a few others; the old site had none for them.
